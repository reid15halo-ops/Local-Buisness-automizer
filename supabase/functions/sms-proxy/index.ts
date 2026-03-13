// Supabase Edge Function: SMS Proxy (Twilio)
// Keeps TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN server-side.
// Deploy: supabase functions deploy sms-proxy
// Env vars: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const corsHeaders = {
    'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') || 'https://app.freyaivisions.de',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Rate limit: max 10 SMS per user per hour
const RATE_LIMIT_MAX = 10
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000 // 1 hour

// Validation
const PHONE_REGEX = /^\+[0-9]{8,15}$/
const MAX_BODY_LENGTH = 1600

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // ── Authenticate user via Supabase JWT ──────────────────────────
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_ANON_KEY')!,
            { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
        )
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return new Response(
                JSON.stringify({ error: 'Nicht authentifiziert' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // ── Parse and validate request body ─────────────────────────────
        const { to, body } = await req.json()

        if (!to || typeof to !== 'string') {
            return new Response(
                JSON.stringify({ error: 'Feld "to" ist erforderlich (Telefonnummer mit +Ländervorwahl)' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        if (!body || typeof body !== 'string') {
            return new Response(
                JSON.stringify({ error: 'Feld "body" ist erforderlich (SMS-Text)' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Normalize German phone numbers (0xxx → +49xxx)
        let normalizedTo = to.replace(/[\s\-()]/g, '')
        if (normalizedTo.startsWith('0')) {
            normalizedTo = '+49' + normalizedTo.substring(1)
        }
        if (!normalizedTo.startsWith('+')) {
            normalizedTo = '+49' + normalizedTo
        }

        // Validate phone number format
        if (!PHONE_REGEX.test(normalizedTo)) {
            return new Response(
                JSON.stringify({ error: 'Ungültiges Telefonnummernformat (erwartet: +Ländervorwahl + 8-15 Ziffern)' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Validate body length
        const trimmedBody = body.trim()
        if (trimmedBody.length === 0) {
            return new Response(
                JSON.stringify({ error: 'SMS-Text darf nicht leer sein' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }
        if (trimmedBody.length > MAX_BODY_LENGTH) {
            return new Response(
                JSON.stringify({ error: `SMS-Text zu lang (${trimmedBody.length}/${MAX_BODY_LENGTH} Zeichen)` }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // ── Rate limiting via automation_log ─────────────────────────────
        const oneHourAgo = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString()
        const { count, error: countError } = await supabase
            .from('automation_log')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .eq('action', 'sms.send')
            .gte('created_at', oneHourAgo)

        if (!countError && (count ?? 0) >= RATE_LIMIT_MAX) {
            return new Response(
                JSON.stringify({ error: `Rate-Limit erreicht: max. ${RATE_LIMIT_MAX} SMS pro Stunde` }),
                { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // ── Read Twilio credentials from env ────────────────────────────
        const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID')
        const authToken = Deno.env.get('TWILIO_AUTH_TOKEN')
        const fromNumber = Deno.env.get('TWILIO_FROM_NUMBER')

        if (!accountSid || !authToken || !fromNumber) {
            return new Response(
                JSON.stringify({ error: 'Twilio nicht konfiguriert (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER)' }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // ── Send via Twilio REST API ────────────────────────────────────
        const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`
        const twilioResponse = await fetch(twilioUrl, {
            method: 'POST',
            headers: {
                'Authorization': 'Basic ' + btoa(`${accountSid}:${authToken}`),
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                To: normalizedTo,
                From: fromNumber,
                Body: trimmedBody,
            }),
        })

        const twilioData = await twilioResponse.json()

        if (!twilioResponse.ok) {
            console.error('Twilio error:', twilioData)
            return new Response(
                JSON.stringify({ error: 'SMS Versand fehlgeschlagen', details: twilioData.message }),
                { status: twilioResponse.status >= 400 && twilioResponse.status < 500 ? 400 : 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // ── Log to automation_log ───────────────────────────────────────
        await supabase.from('automation_log').insert({
            user_id: user.id,
            action: 'sms.send',
            target: normalizedTo,
            metadata: {
                sid: twilioData.sid,
                status: twilioData.status,
                segments: Math.ceil(trimmedBody.length / (trimmedBody.length <= 160 ? 160 : 153)),
            },
        }).catch(() => {})

        // ── Return Twilio response ──────────────────────────────────────
        return new Response(
            JSON.stringify({
                success: true,
                messageSid: twilioData.sid,
                status: twilioData.status,
                to: normalizedTo,
                segments: Math.ceil(trimmedBody.length / (trimmedBody.length <= 160 ? 160 : 153)),
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Interner Serverfehler'
        return new Response(
            JSON.stringify({ error: message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
