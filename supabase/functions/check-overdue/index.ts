// Supabase Edge Function: Check Overdue Invoices & Send Reminders
// Deploy: supabase functions deploy check-overdue
// Trigger: Supabase pg_cron (daily at 08:00) or manual call
// Env vars: RESEND_API_KEY, SENDER_EMAIL
//
// Setup cron in Supabase SQL Editor:
//   SELECT cron.schedule('check-overdue-daily', '0 8 * * *',
//     $$SELECT net.http_post(
//       url := current_setting('app.settings.supabase_url') || '/functions/v1/check-overdue',
//       headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')),
//       body := '{}'::jsonb
//     )$$
//   );

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
        // Use service role for cron-triggered calls
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        )

        // Fetch all open invoices
        const { data: rechnungen, error: fetchError } = await supabase
            .from('rechnungen')
            .select('*, profiles!rechnungen_user_id_fkey(email, company_name)')
            .eq('status', 'offen')

        if (fetchError) {
            console.error('Fetch error:', fetchError)
            return new Response(
                JSON.stringify({ error: fetchError.message }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const now = new Date()
        const results = {
            checked: rechnungen?.length || 0,
            reminders_sent: 0,
            errors: [] as string[],
        }

        const resendKey = Deno.env.get('RESEND_API_KEY')
        const senderEmail = Deno.env.get('SENDER_EMAIL') || 'noreply@handwerkflow.de'
        const senderName = Deno.env.get('SENDER_NAME') || 'HandwerkFlow'

        for (const rechnung of (rechnungen || [])) {
            const createdAt = new Date(rechnung.created_at)
            const daysSinceCreation = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24))

            // Escalation levels: 14 days = reminder, 28 = 1st warning, 42 = 2nd, 56 = final
            const escalation = rechnung.mahnstufe || 0
            let shouldSend = false
            let level = 0
            let subject = ''
            let body = ''

            const kundenName = rechnung.kunde_name || rechnung.kunde?.name || 'Kunde'
            const rechnungId = rechnung.rechnung_id || rechnung.id
            const betrag = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(rechnung.brutto || 0)

            if (daysSinceCreation >= 14 && escalation < 1) {
                shouldSend = true; level = 1
                subject = `Zahlungserinnerung - Rechnung ${rechnungId}`
                body = `Sehr geehrte/r ${kundenName},\n\nbei Durchsicht unserer Buchhaltung haben wir festgestellt, dass die Rechnung ${rechnungId} über ${betrag} noch nicht beglichen wurde.\n\nWir bitten Sie, den offenen Betrag innerhalb der nächsten 7 Tage zu überweisen.\n\nMit freundlichen Grüßen\n${senderName}`
            } else if (daysSinceCreation >= 28 && escalation < 2) {
                shouldSend = true; level = 2
                subject = `1. Mahnung - Rechnung ${rechnungId}`
                body = `Sehr geehrte/r ${kundenName},\n\ntrotz unserer Zahlungserinnerung konnten wir keinen Zahlungseingang für die Rechnung ${rechnungId} über ${betrag} feststellen.\n\nWir bitten Sie dringend, den Betrag innerhalb von 7 Tagen zu überweisen.\n\nMit freundlichen Grüßen\n${senderName}`
            } else if (daysSinceCreation >= 42 && escalation < 3) {
                shouldSend = true; level = 3
                subject = `2. Mahnung - Rechnung ${rechnungId}`
                body = `Sehr geehrte/r ${kundenName},\n\nwir müssen Sie erneut an die offene Rechnung ${rechnungId} erinnern. Trotz mehrfacher Mahnung ist kein Zahlungseingang erfolgt.\n\nGesamtforderung: ${betrag}\n\nSollten wir innerhalb von 5 Werktagen keinen Zahlungseingang verzeichnen, sehen wir uns gezwungen, ein gerichtliches Mahnverfahren einzuleiten.\n\nMit freundlichen Grüßen\n${senderName}`
            } else if (daysSinceCreation >= 56 && escalation < 4) {
                shouldSend = true; level = 4
                subject = `Letzte Mahnung - Rechnung ${rechnungId}`
                body = `Sehr geehrte/r ${kundenName},\n\ndies ist unsere letzte außergerichtliche Mahnung bezüglich der Rechnung ${rechnungId}.\n\nGesamtforderung: ${betrag}\n\nNach Ablauf von 3 Werktagen werden wir die Forderung ohne weitere Ankündigung an ein Inkassounternehmen übergeben.\n\nMit freundlichen Grüßen\n${senderName}`
            }

            if (!shouldSend) continue

            // Send email if customer email exists and Resend is configured
            const kundenEmail = rechnung.kunde_email || rechnung.kunde?.email
            if (kundenEmail && resendKey) {
                try {
                    const emailResponse = await fetch('https://api.resend.com/emails', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${resendKey}`,
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            from: `${senderName} <${senderEmail}>`,
                            to: [kundenEmail],
                            subject,
                            html: `<pre style="font-family:Arial,sans-serif;white-space:pre-wrap;line-height:1.6;">${body}</pre>`,
                        }),
                    })

                    if (emailResponse.ok) {
                        results.reminders_sent++
                    } else {
                        const err = await emailResponse.json()
                        results.errors.push(`${rechnungId}: ${err.message || 'Unbekannter Fehler'}`)
                    }
                } catch (e) {
                    results.errors.push(`${rechnungId}: ${e.message}`)
                }
            }

            // Update escalation level in DB
            await supabase
                .from('rechnungen')
                .update({ mahnstufe: level, letzte_mahnung: now.toISOString() })
                .eq('id', rechnung.id)
                .throwOnError()
                .catch(e => results.errors.push(`Update ${rechnungId}: ${e.message}`))

            // Log
            await supabase.from('automation_log').insert({
                user_id: rechnung.user_id,
                action: 'overdue.reminder',
                target: kundenEmail || kundenName,
                metadata: { rechnung_id: rechnungId, level, days_overdue: daysSinceCreation },
            }).throwOnError().catch(() => {})
        }

        return new Response(
            JSON.stringify({ success: true, ...results }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    } catch (err) {
        return new Response(
            JSON.stringify({ error: err.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
