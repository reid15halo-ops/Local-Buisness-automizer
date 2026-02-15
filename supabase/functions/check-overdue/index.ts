// Supabase Edge Function: Check Overdue Invoices & Send Reminders via Proton Mail
// Deploy: supabase functions deploy check-overdue
// Env vars: EMAIL_RELAY_URL, EMAIL_RELAY_SECRET
//
// Trigger: Supabase pg_cron (daily at 08:00) or manual call
// Setup cron in SQL Editor (after enabling pg_cron + pg_net):
//   SELECT cron.schedule('check-overdue-daily', '0 8 * * *',
//     $$SELECT net.http_post(
//       url := '<SUPABASE_URL>/functions/v1/check-overdue',
//       headers := '{"Authorization": "Bearer <SERVICE_ROLE_KEY>", "Content-Type": "application/json"}'::jsonb,
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
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        )

        // Fetch all open invoices
        const { data: rechnungen, error: fetchError } = await supabase
            .from('rechnungen')
            .select('*')
            .eq('status', 'offen')

        if (fetchError) {
            return new Response(
                JSON.stringify({ error: fetchError.message }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const now = new Date()
        const results = { checked: rechnungen?.length || 0, reminders_sent: 0, errors: [] as string[] }

        const relayUrl = Deno.env.get('EMAIL_RELAY_URL')
        const relaySecret = Deno.env.get('EMAIL_RELAY_SECRET')
        const senderName = Deno.env.get('SENDER_NAME') || 'HandwerkFlow'

        for (const rechnung of (rechnungen || [])) {
            const createdAt = new Date(rechnung.created_at)
            const daysSince = Math.floor((now.getTime() - createdAt.getTime()) / 86400000)
            const escalation = rechnung.mahnstufe || 0

            let shouldSend = false, level = 0, subject = '', body = ''
            const name = rechnung.kunde_name || 'Kunde'
            const rid = rechnung.rechnung_id || rechnung.id
            const betrag = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(rechnung.brutto || 0)

            if (daysSince >= 14 && escalation < 1) {
                shouldSend = true; level = 1
                subject = `Zahlungserinnerung - Rechnung ${rid}`
                body = `Sehr geehrte/r ${name},\n\nbei Durchsicht unserer Buchhaltung haben wir festgestellt, dass die Rechnung ${rid} über ${betrag} noch nicht beglichen wurde.\n\nWir bitten Sie, den offenen Betrag innerhalb der nächsten 7 Tage zu überweisen.\n\nMit freundlichen Grüßen\n${senderName}`
            } else if (daysSince >= 28 && escalation < 2) {
                shouldSend = true; level = 2
                subject = `1. Mahnung - Rechnung ${rid}`
                body = `Sehr geehrte/r ${name},\n\ntrotz unserer Zahlungserinnerung konnten wir keinen Zahlungseingang für Rechnung ${rid} über ${betrag} feststellen.\n\nWir bitten Sie dringend, den Betrag innerhalb von 7 Tagen zu überweisen.\n\nMit freundlichen Grüßen\n${senderName}`
            } else if (daysSince >= 42 && escalation < 3) {
                shouldSend = true; level = 3
                subject = `2. Mahnung - Rechnung ${rid}`
                body = `Sehr geehrte/r ${name},\n\nwir müssen Sie erneut an die offene Rechnung ${rid} erinnern.\n\nGesamtforderung: ${betrag}\n\nSollten wir innerhalb von 5 Werktagen keinen Zahlungseingang verzeichnen, sehen wir uns gezwungen, ein gerichtliches Mahnverfahren einzuleiten.\n\nMit freundlichen Grüßen\n${senderName}`
            } else if (daysSince >= 56 && escalation < 4) {
                shouldSend = true; level = 4
                subject = `Letzte Mahnung - Rechnung ${rid}`
                body = `Sehr geehrte/r ${name},\n\ndies ist unsere letzte außergerichtliche Mahnung bezüglich Rechnung ${rid}.\n\nGesamtforderung: ${betrag}\n\nNach Ablauf von 3 Werktagen werden wir die Forderung an ein Inkassounternehmen übergeben.\n\nMit freundlichen Grüßen\n${senderName}`
            }

            if (!shouldSend) continue

            const kundenEmail = rechnung.kunde_email || rechnung.kunde?.email
            if (kundenEmail && relayUrl && relaySecret) {
                try {
                    const res = await fetch(`${relayUrl}/send-email`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${relaySecret}`,
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ to: kundenEmail, subject, body }),
                    })

                    if (res.ok) {
                        results.reminders_sent++
                    } else {
                        const err = await res.json()
                        results.errors.push(`${rid}: ${err.error || 'Fehler'}`)
                    }
                } catch (e) {
                    results.errors.push(`${rid}: ${e.message}`)
                }
            }

            // Update escalation level
            await supabase
                .from('rechnungen')
                .update({ mahnstufe: level, letzte_mahnung: now.toISOString() })
                .eq('id', rechnung.id)
                .catch(e => results.errors.push(`Update ${rid}: ${e.message}`))

            // Log
            await supabase.from('automation_log').insert({
                user_id: rechnung.user_id,
                action: 'overdue.reminder',
                target: kundenEmail || name,
                metadata: { rechnung_id: rid, level, days_overdue: daysSince },
            }).catch(() => {})
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
