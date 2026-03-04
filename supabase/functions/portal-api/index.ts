// Supabase Edge Function: Customer Portal API
// Token-based access to customer data (no auth required)
// Deploy: supabase functions deploy portal-api

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

function jsonResponse(data: unknown, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const url = new URL(req.url)
        const token = url.searchParams.get('token')

        if (!token) {
            return jsonResponse({ error: 'Token erforderlich' }, 400)
        }

        // Use service role for DB access (no user auth needed)
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        )

        // Validate token
        const { data: tokenData, error: tokenError } = await supabase
            .from('portal_tokens')
            .select('*')
            .eq('token', token)
            .single()

        if (tokenError || !tokenData) {
            return jsonResponse({ error: 'Ung\u00fcltiger oder abgelaufener Link' }, 401)
        }

        // Check expiry
        if (new Date(tokenData.expires_at) < new Date()) {
            return jsonResponse({ error: 'Dieser Link ist abgelaufen. Bitte fordern Sie einen neuen an.' }, 401)
        }

        const { tenant_id, kunde_id } = tokenData

        // GET: Fetch customer portal data
        if (req.method === 'GET') {
            // Fetch tenant info
            const { data: tenant } = await supabase
                .from('tenants')
                .select('name, telefon, email_outbound, website, adresse, plz, stadt, logo_url, iban, bic, bank, inhaber')
                .eq('id', tenant_id)
                .single()

            // Fetch customer data
            const { data: kunde } = await supabase
                .from('kunden')
                .select('*')
                .eq('id', kunde_id)
                .eq('tenant_id', tenant_id)
                .single()

            // Fetch Angebote for this customer
            const { data: angebote } = await supabase
                .from('angebote')
                .select('id, nummer, erstellt_am, gueltig_bis, status, netto, brutto, positionen')
                .eq('kunde_id', kunde_id)
                .eq('tenant_id', tenant_id)
                .order('erstellt_am', { ascending: false })

            // Fetch Auftr\u00e4ge
            const { data: auftraege } = await supabase
                .from('auftraege')
                .select('id, nummer, erstellt_am, status, beschreibung, gesamtpreis')
                .eq('kunde_id', kunde_id)
                .eq('tenant_id', tenant_id)
                .order('erstellt_am', { ascending: false })

            // Fetch Rechnungen
            const { data: rechnungen } = await supabase
                .from('rechnungen')
                .select('id, nummer, erstellt_am, faelligkeitsdatum, status, netto, brutto, positionen')
                .eq('kunde_id', kunde_id)
                .eq('tenant_id', tenant_id)
                .order('erstellt_am', { ascending: false })

            return jsonResponse({
                firma: tenant,
                kunde: kunde ? { name: kunde.name, email: kunde.email } : null,
                angebote: angebote || [],
                auftraege: auftraege || [],
                rechnungen: rechnungen || [],
            })
        }

        // POST: Actions
        if (req.method === 'POST') {
            const action = url.searchParams.get('action')

            if (action === 'accept_angebot') {
                const angebotId = url.searchParams.get('id')
                if (!angebotId) {
                    return jsonResponse({ error: 'Angebots-ID erforderlich' }, 400)
                }

                // Verify the Angebot belongs to this customer
                const { data: angebot, error: angebotError } = await supabase
                    .from('angebote')
                    .select('id, status')
                    .eq('id', angebotId)
                    .eq('kunde_id', kunde_id)
                    .eq('tenant_id', tenant_id)
                    .single()

                if (angebotError || !angebot) {
                    return jsonResponse({ error: 'Angebot nicht gefunden' }, 404)
                }

                if (angebot.status !== 'offen') {
                    return jsonResponse({ error: 'Dieses Angebot kann nicht mehr angenommen werden' }, 400)
                }

                // Update status
                const { error: updateError } = await supabase
                    .from('angebote')
                    .update({ status: 'angenommen', angenommen_am: new Date().toISOString() })
                    .eq('id', angebotId)

                if (updateError) {
                    return jsonResponse({ error: 'Fehler beim Annehmen des Angebots' }, 500)
                }

                return jsonResponse({ success: true, message: 'Angebot erfolgreich angenommen!' })
            }

            if (action === 'contact') {
                const body = await req.json()
                const message = body.message

                if (!message || message.trim().length === 0) {
                    return jsonResponse({ error: 'Nachricht darf nicht leer sein' }, 400)
                }

                // Fetch customer name
                const { data: kunde } = await supabase
                    .from('kunden')
                    .select('name, email')
                    .eq('id', kunde_id)
                    .eq('tenant_id', tenant_id)
                    .single()

                // Create Anfrage for the tenant
                const { error: insertError } = await supabase
                    .from('anfragen')
                    .insert({
                        tenant_id,
                        kunde_id,
                        quelle: 'portal',
                        status: 'neu',
                        beschreibung: message.trim(),
                        kunde: {
                            name: kunde?.name || 'Portal-Kunde',
                            email: kunde?.email || '',
                        },
                        erstellt_am: new Date().toISOString(),
                    })

                if (insertError) {
                    return jsonResponse({ error: 'Fehler beim Senden der Nachricht' }, 500)
                }

                return jsonResponse({ success: true, message: 'Nachricht wurde gesendet!' })
            }

            return jsonResponse({ error: 'Unbekannte Aktion' }, 400)
        }

        return jsonResponse({ error: 'Methode nicht erlaubt' }, 405)

    } catch (err) {
        console.error('Portal API Error:', err)
        return jsonResponse({ error: 'Interner Serverfehler' }, 500)
    }
})
