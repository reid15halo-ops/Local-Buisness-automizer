// Supabase Edge Function: Generic Automation Runner
// Deploy: supabase functions deploy run-automation
// Executes a workflow action server-side (email, sms, webhook, notification)
// Called from the frontend workflow engine for each action step

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const corsHeaders = {
    'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') || 'https://app.freyaivisions.de',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function isBlockedUrl(parsedUrl: URL): boolean {
    const hostname = parsedUrl.hostname.toLowerCase().replace(/\[|\]/g, '')
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) return true
    if (hostname === 'localhost' || hostname === '::1') return true
    if (/^127\./.test(hostname)) return true
    if (hostname === '0.0.0.0') return true
    if (/^169\.254\./.test(hostname)) return true
    if (hostname.includes('metadata.google') || hostname.includes('metadata.internal')) return true
    if (/^10\./.test(hostname)) return true
    if (/^192\.168\./.test(hostname)) return true
    if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname)) return true
    if (/^\d+$/.test(hostname)) return true
    if (/^fc[0-9a-f]{2}:/i.test(hostname) || /^fe[89ab][0-9a-f]:/i.test(hostname)) return true
    return false
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
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

        const { action, params, workflowId, executionId } = await req.json()

        if (!action) {
            return new Response(
                JSON.stringify({ error: 'Aktion ist erforderlich' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        let result: { success: boolean; data?: unknown; error?: string }

        switch (action) {
            case 'email.send': {
                const relayUrl = Deno.env.get('EMAIL_RELAY_URL')
                const relaySecret = Deno.env.get('EMAIL_RELAY_SECRET')
                if (!relayUrl || !relaySecret) {
                    result = { success: false, error: 'EMAIL_RELAY_URL/EMAIL_RELAY_SECRET nicht konfiguriert' }
                    break
                }

                const emailRes = await fetch(`${relayUrl}/send-email`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${relaySecret}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        to: Array.isArray(params.to) ? params.to.join(', ') : params.to,
                        subject: params.subject || 'HandwerkFlow Benachrichtigung',
                        body: params.body || '',
                    }),
                })
                const emailData = await emailRes.json()
                result = emailRes.ok
                    ? { success: true, data: { messageId: emailData.messageId } }
                    : { success: false, error: emailData.error || 'E-Mail Fehler' }
                break
            }

            case 'sms.send': {
                const sid = Deno.env.get('TWILIO_ACCOUNT_SID')
                const token = Deno.env.get('TWILIO_AUTH_TOKEN')
                const from = Deno.env.get('TWILIO_FROM_NUMBER')
                if (!sid || !token || !from) {
                    result = { success: false, error: 'Twilio nicht konfiguriert' }
                    break
                }

                let toNum = (params.to || '').replace(/[\s\-()]/g, '')
                if (toNum.startsWith('0')) toNum = '+49' + toNum.substring(1)
                if (!toNum.startsWith('+')) toNum = '+49' + toNum

                const smsRes = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
                    method: 'POST',
                    headers: {
                        'Authorization': 'Basic ' + btoa(`${sid}:${token}`),
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: new URLSearchParams({ To: toNum, From: from, Body: params.message || '' }),
                })
                const smsData = await smsRes.json()
                result = smsRes.ok
                    ? { success: true, data: { sid: smsData.sid } }
                    : { success: false, error: smsData.message || 'SMS Fehler' }
                break
            }

            case 'webhook.call': {
                if (!params.url) {
                    result = { success: false, error: 'Webhook URL fehlt' }
                    break
                }
                let webhookParsedUrl: URL
                try {
                    webhookParsedUrl = new URL(params.url)
                } catch {
                    result = { success: false, error: 'Ungültige URL' }
                    break
                }
                if (isBlockedUrl(webhookParsedUrl)) {
                    result = { success: false, error: 'Diese URL ist nicht erlaubt' }
                    break
                }

                const method = (params.method || 'POST').toUpperCase()
                const whRes = await fetch(params.url, {
                    method,
                    headers: { 'Content-Type': 'application/json', 'User-Agent': 'HandwerkFlow-Automation/1.0' },
                    body: ['GET', 'HEAD'].includes(method) ? undefined : JSON.stringify(params.data || {}),
                })
                result = { success: whRes.ok, data: { status: whRes.status } }
                break
            }

            case 'notification.push': {
                // Store notification in DB for the user
                await supabase.from('notifications').insert({
                    user_id: user.id,
                    title: params.title || 'HandwerkFlow',
                    message: params.message || '',
                    type: params.type || 'info',
                    read: false,
                }).throwOnError().catch(() => {})
                result = { success: true }
                break
            }

            default:
                result = { success: false, error: `Unbekannte Aktion: ${action}` }
        }

        // Log execution
        await supabase.from('automation_log').insert({
            user_id: user.id,
            action,
            target: params?.to || params?.url || '',
            metadata: {
                workflow_id: workflowId,
                execution_id: executionId,
                success: result.success,
                error: result.error,
            },
        }).throwOnError().catch(() => {})

        return new Response(
            JSON.stringify(result),
            {
                status: result.success ? 200 : 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
        )
    } catch (err) {
        return new Response(
            JSON.stringify({ error: 'Interner Serverfehler' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
