// Supabase Edge Function: Send Email via Resend
// Deploy: supabase functions deploy send-email
// Env vars: RESEND_API_KEY, SENDER_EMAIL (default: noreply@handwerkflow.de)

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

        const { to, subject, body, replyTo } = await req.json()

        if (!to || !subject || !body) {
            return new Response(
                JSON.stringify({ error: 'Felder "to", "subject" und "body" sind erforderlich' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const resendKey = Deno.env.get('RESEND_API_KEY')
        if (!resendKey) {
            return new Response(
                JSON.stringify({ error: 'RESEND_API_KEY nicht konfiguriert' }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const senderEmail = Deno.env.get('SENDER_EMAIL') || 'noreply@handwerkflow.de'
        const senderName = Deno.env.get('SENDER_NAME') || 'HandwerkFlow'

        // Send via Resend API
        const resendResponse = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${resendKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                from: `${senderName} <${senderEmail}>`,
                to: Array.isArray(to) ? to : [to],
                subject,
                html: body.includes('<') ? body : `<pre style="font-family:Arial,sans-serif;white-space:pre-wrap;">${body}</pre>`,
                reply_to: replyTo || undefined,
            }),
        })

        const resendData = await resendResponse.json()

        if (!resendResponse.ok) {
            console.error('Resend error:', resendData)
            return new Response(
                JSON.stringify({ error: 'E-Mail Versand fehlgeschlagen', details: resendData }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Log to automation_log table
        await supabase.from('automation_log').insert({
            user_id: user.id,
            action: 'email.send',
            target: to,
            metadata: { subject, resend_id: resendData.id },
        }).throwOnError().catch(() => {}) // non-critical

        return new Response(
            JSON.stringify({ success: true, id: resendData.id }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    } catch (err) {
        return new Response(
            JSON.stringify({ error: err.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
