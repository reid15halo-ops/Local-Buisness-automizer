// Supabase Edge Function: Send SMS via Twilio
// Deploy: supabase functions deploy send-sms
// Env vars: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // Authenticate user
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

        const { to, message } = await req.json()

        if (!to || !message) {
            return new Response(
                JSON.stringify({ error: 'Felder "to" und "message" sind erforderlich' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID')
        const authToken = Deno.env.get('TWILIO_AUTH_TOKEN')
        const fromNumber = Deno.env.get('TWILIO_FROM_NUMBER')

        if (!accountSid || !authToken || !fromNumber) {
            return new Response(
                JSON.stringify({ error: 'Twilio nicht konfiguriert (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER)' }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Normalize German phone number
        let normalizedTo = to.replace(/[\s\-()]/g, '')
        if (normalizedTo.startsWith('0')) {
            normalizedTo = '+49' + normalizedTo.substring(1)
        }
        if (!normalizedTo.startsWith('+')) {
            normalizedTo = '+49' + normalizedTo
        }

        // Send via Twilio REST API
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
                Body: message,
            }),
        })

        const twilioData = await twilioResponse.json()

        if (!twilioResponse.ok) {
            console.error('Twilio error:', twilioData)
            return new Response(
                JSON.stringify({ error: 'SMS Versand fehlgeschlagen', details: twilioData.message }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Log
        await supabase.from('automation_log').insert({
            user_id: user.id,
            action: 'sms.send',
            target: normalizedTo,
            metadata: { sid: twilioData.sid },
        }).throwOnError().catch(() => {})

        return new Response(
            JSON.stringify({
                success: true,
                messageId: twilioData.sid,
                status: twilioData.status,
                segments: Math.ceil(message.length / (message.length <= 160 ? 160 : 153))
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    } catch (err) {
        return new Response(
            JSON.stringify({ error: err.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
