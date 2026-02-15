// Supabase Edge Function: Execute Webhook (CORS-free proxy)
// Deploy: supabase functions deploy run-webhook
// Allows frontend workflows to call external webhooks without CORS issues

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Blocked hosts to prevent SSRF
const BLOCKED_HOSTS = ['localhost', '127.0.0.1', '0.0.0.0', '169.254.169.254', 'metadata.google']

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
        if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
            return new Response(
                JSON.stringify({ error: 'Nur HTTP/HTTPS URLs erlaubt' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        if (BLOCKED_HOSTS.some(h => parsedUrl.hostname.includes(h))) {
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
        return new Response(
            JSON.stringify({ error: err.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
