// Supabase Edge Function: Execute Webhook (CORS-free proxy)
// Deploy: supabase functions deploy run-webhook
// Allows frontend workflows to call external webhooks without CORS issues

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const corsHeaders = {
    'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') || 'https://app.freyaivisions.de',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function isBlockedUrl(parsedUrl: URL): boolean {
    const hostname = parsedUrl.hostname.toLowerCase().replace(/\[|\]/g, '')

    // Block non-HTTP(S) protocols
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) return true

    // Block loopback
    if (hostname === 'localhost' || hostname === '::1') return true
    if (/^127\./.test(hostname)) return true
    if (hostname === '0.0.0.0') return true

    // Block link-local / APIPA / cloud metadata
    if (/^169\.254\./.test(hostname)) return true
    if (hostname.includes('metadata.google') || hostname.includes('metadata.internal')) return true

    // Block private RFC 1918 ranges
    if (/^10\./.test(hostname)) return true
    if (/^192\.168\./.test(hostname)) return true
    if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname)) return true

    // Block decimal/hex encoded IPs that resolve to private (basic check)
    // Pure numeric hostnames like 2130706433 (= 127.0.0.1)
    if (/^\d+$/.test(hostname)) return true

    // Block IPv6 private/link-local
    if (/^fc[0-9a-f]{2}:/i.test(hostname) || /^fe[89ab][0-9a-f]:/i.test(hostname)) return true

    return false
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

        const { url, method, data, headers: customHeaders } = await req.json()

        if (!url) {
            return new Response(
                JSON.stringify({ error: 'URL ist erforderlich' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Validate URL
        let parsedUrl: URL
        try {
            parsedUrl = new URL(url)
        } catch {
            return new Response(
                JSON.stringify({ error: 'Ungültige URL' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Security: block internal/private URLs
        if (isBlockedUrl(parsedUrl)) {
            return new Response(
                JSON.stringify({ error: 'Diese URL ist nicht erlaubt' }),
                { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Execute webhook
        const webhookHeaders: Record<string, string> = {
            'Content-Type': 'application/json',
            'User-Agent': 'HandwerkFlow-Automation/1.0',
            ...(customHeaders || {}),
        }

        const webhookResponse = await fetch(url, {
            method: method || 'POST',
            headers: webhookHeaders,
            body: ['GET', 'HEAD'].includes((method || 'POST').toUpperCase())
                ? undefined
                : JSON.stringify(data || {}),
        })

        const responseText = await webhookResponse.text()
        let responseData: unknown
        try { responseData = JSON.parse(responseText) } catch { responseData = responseText }

        // Log
        await supabase.from('automation_log').insert({
            user_id: user.id,
            action: 'webhook.call',
            target: url,
            metadata: { method: method || 'POST', status: webhookResponse.status },
        }).throwOnError().catch(() => {})

        return new Response(
            JSON.stringify({
                success: webhookResponse.ok,
                status: webhookResponse.status,
                data: responseData,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    } catch (err) {
        console.error(err)
        return new Response(
            JSON.stringify({ error: 'Interner Serverfehler' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
