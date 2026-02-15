// Supabase Edge Function: Send Email via Proton Mail (VPS Relay)
// Deploy: supabase functions deploy send-email
// Env vars: EMAIL_RELAY_URL, EMAIL_RELAY_SECRET

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

        const { to, subject, body, replyTo, cc, bcc } = await req.json()

        if (!to || !subject || !body) {
            return new Response(
                JSON.stringify({ error: 'Felder "to", "subject" und "body" sind erforderlich' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Route to VPS Email Relay (Proton Mail Bridge)
        const relayUrl = Deno.env.get('EMAIL_RELAY_URL')
        const relaySecret = Deno.env.get('EMAIL_RELAY_SECRET')

        if (!relayUrl || !relaySecret) {
            return new Response(
                JSON.stringify({ error: 'EMAIL_RELAY_URL und EMAIL_RELAY_SECRET nicht konfiguriert' }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const relayResponse = await fetch(`${relayUrl}/send-email`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${relaySecret}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ to, subject, body, replyTo, cc, bcc }),
        })

        const relayData = await relayResponse.json()

        if (!relayResponse.ok) {
            console.error('Relay error:', relayData)
            return new Response(
                JSON.stringify({ error: relayData.error || 'E-Mail Versand fehlgeschlagen', details: relayData.details }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Log to automation_log table
        await supabase.from('automation_log').insert({
            user_id: user.id,
            action: 'email.send',
            target: to,
            metadata: { subject, messageId: relayData.messageId, provider: 'protonmail' },
        }).throwOnError().catch(() => {})

        return new Response(
            JSON.stringify({ success: true, messageId: relayData.messageId }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    } catch (err) {
        return new Response(
            JSON.stringify({ error: err.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
