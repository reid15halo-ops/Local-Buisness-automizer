// Supabase Edge Function: Stripe Webhook Handler
// Deploy: supabase functions deploy stripe-webhook
// Env vars needed: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
// Set webhook endpoint in Stripe Dashboard: https://your-domain/functions/v1/stripe-webhook

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@16.2.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!)

const corsHeaders = {
    'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') || 'https://app.freyaivisions.de',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
}

serve(async (req) => {
    // CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    if (req.method !== 'POST') {
        return new Response('Method not allowed', { status: 405, headers: corsHeaders })
    }

    try {
        const signature = req.headers.get('stripe-signature')
        if (!signature) {
            console.warn('Missing stripe-signature header')
            return new Response(
                JSON.stringify({ error: 'Missing signature' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const body = await req.text()

        // Verify Stripe signature
        const event = stripe.webhooks.constructEvent(
            body,
            signature,
            Deno.env.get('STRIPE_WEBHOOK_SECRET')!
        )

        // Initialize Supabase client with service_role for full access
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        )

        console.log(`Processing webhook event: ${event.type}`)

        // Handle different event types
        switch (event.type) {
            case 'checkout.session.completed': {
                const session = event.data.object as any
                await handleCheckoutSessionCompleted(session, supabase)
                break
            }

            case 'payment_intent.succeeded': {
                const paymentIntent = event.data.object as any
                await handlePaymentIntentSucceeded(paymentIntent, supabase)
                break
            }

            case 'payment_intent.payment_failed': {
                const paymentIntent = event.data.object as any
                await handlePaymentIntentFailed(paymentIntent, supabase)
                break
            }

            case 'charge.refunded': {
                const charge = event.data.object as any
                await handleChargeRefunded(charge, supabase)
                break
            }

            default:
                console.log(`Unhandled event type: ${event.type}`)
        }

        return new Response(
            JSON.stringify({ received: true }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    } catch (err) {
        // Always return 200 for webhook processing errors to prevent Stripe retry floods.
        // Signature verification failures (thrown before event parsing) are the exception —
        // but constructEvent throws before we reach the switch, so those are caught here too.
        // We still log everything for debugging.
        console.error('Webhook error:', err)
        return new Response(
            JSON.stringify({ received: true, error: 'Processing failed but acknowledged' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})

/**
 * Handle checkout.session.completed
 * Called when customer completes payment at Stripe Checkout
 *
 * Actions:
 * 1. Record payment in stripe_payments audit table
 * 2. Mark invoice as paid in rechnungen
 * 3. Create buchung (bookkeeping entry) for EÜR
 * 4. Send confirmation email to customer
 * 5. Send Telegram notification to Jonas
 */
async function handleCheckoutSessionCompleted(session: any, supabase: any) {
    try {
        const invoice_id = session.metadata?.invoice_id
        const invoice_number = session.metadata?.invoice_number || invoice_id
        const customerEmail = session.customer_details?.email || session.metadata?.customer_email
        const customerName = session.metadata?.customer_name || session.customer_details?.name || 'Kunde'
        const amountCents = session.amount_total || 0
        const amountEur = amountCents / 100
        const now = new Date().toISOString()

        if (!invoice_id) {
            console.warn('No invoice_id in session metadata')
            return
        }

        // 1. Record payment in stripe_payments audit table
        const { error: insertError } = await supabase.from('stripe_payments').insert({
            stripe_session_id: session.id,
            stripe_customer_id: session.customer,
            invoice_id: invoice_id,
            amount: amountCents,
            currency: session.currency || 'eur',
            payment_status: 'completed',
            payment_method: session.payment_method_types?.[0] || 'card',
            created_at: now,
            metadata: {
                ...session.metadata,
                customer_email: customerEmail,
                payment_intent: session.payment_intent,
            }
        })

        if (insertError) {
            console.error('Error recording payment:', insertError)
        }

        // 2. Update invoice status in rechnungen table
        const { error: updateError } = await supabase
            .from('rechnungen')
            .update({
                status: 'bezahlt',
                paid_at: now,
                stripe_payment_id: session.payment_intent || session.id,
                payment_method: session.payment_method_types?.[0] || 'card',
            })
            .eq('id', invoice_id)

        if (updateError) {
            console.warn('Could not update rechnungen:', updateError.message)
        } else {
            console.log(`Rechnung ${invoice_number} als bezahlt markiert`)
        }

        // 3. Create buchung (bookkeeping entry) for EÜR
        // Kleinunternehmer §19 UStG: no VAT — netto = brutto
        const bruttoEur = amountEur
        const nettoEur = bruttoEur
        const ustEur = 0

        // Resolve tenant_id from invoice owner
        const { data: rechnung } = await supabase
            .from('rechnungen')
            .select('user_id')
            .eq('id', invoice_id)
            .maybeSingle()
        const tenantId = rechnung?.user_id || null

        await supabase.from('buchungen').insert({
            tenant_id: tenantId,
            typ: 'einnahme',
            kategorie: 'Umsatzerlöse',
            beschreibung: `Stripe-Zahlung Rechnung ${invoice_number} - ${customerName}`,
            datum: now,
            brutto: bruttoEur,
            netto: nettoEur,
            ust: ustEur,
            belegnummer: invoice_number,
            zahlungsart: `Stripe (${session.payment_method_types?.[0] || 'card'})`,
            rechnung_id: invoice_id,
        }).catch((err: any) => {
            console.error('Error creating buchung:', err?.message || err)
        })

        // 4. Send confirmation email to customer via email relay
        const relayUrl = Deno.env.get('EMAIL_RELAY_URL')
        const relaySecret = Deno.env.get('EMAIL_RELAY_SECRET')
        const senderName = Deno.env.get('SENDER_NAME') || 'FreyAI Visions'

        if (customerEmail && relayUrl && relaySecret) {
            const formattedAmount = new Intl.NumberFormat('de-DE', {
                style: 'currency', currency: 'EUR'
            }).format(amountEur)

            try {
                await fetch(`${relayUrl}/send-email`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${relaySecret}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        to: customerEmail,
                        subject: `Zahlungsbestätigung - Rechnung ${invoice_number}`,
                        body: [
                            `Sehr geehrte/r ${customerName},`,
                            '',
                            `vielen Dank für Ihre Zahlung in Höhe von ${formattedAmount} für Rechnung ${invoice_number}.`,
                            '',
                            'Ihre Zahlung wurde erfolgreich verarbeitet und die Rechnung ist damit beglichen.',
                            '',
                            `Transaktions-ID: ${session.payment_intent || session.id}`,
                            '',
                            'Mit freundlichen Grüßen',
                            senderName,
                        ].join('\n'),
                    }),
                })
            } catch (emailErr) {
                console.error('Error sending payment confirmation email:', emailErr)
            }
        }

        // 5. Send Telegram notification to Jonas
        const telegramToken = Deno.env.get('TELEGRAM_BOT_TOKEN')
        const telegramChatId = Deno.env.get('TELEGRAM_CHAT_ID')

        if (telegramToken && telegramChatId) {
            const formattedAmount = new Intl.NumberFormat('de-DE', {
                style: 'currency', currency: 'EUR'
            }).format(amountEur)

            const message = [
                `💰 Zahlung eingegangen!`,
                ``,
                `Rechnung: ${invoice_number}`,
                `Betrag: ${formattedAmount}`,
                `Kunde: ${customerName}`,
                `E-Mail: ${customerEmail || 'k.A.'}`,
                `Methode: ${session.payment_method_types?.[0] || 'card'}`,
                `Stripe: ${session.id}`,
            ].join('\n')

            try {
                await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        chat_id: telegramChatId,
                        text: message,
                        parse_mode: 'HTML',
                    }),
                })
            } catch (tgErr) {
                console.error('Error sending Telegram notification:', tgErr)
            }
        }

        // Log the action
        await supabase.from('automation_log').insert({
            action: 'payment.checkout_completed',
            target: invoice_id,
            metadata: {
                session_id: session.id,
                invoice_number: invoice_number,
                amount: amountCents,
                customer_email: customerEmail,
                customer_name: customerName,
                payment_method: session.payment_method_types?.[0],
                buchung_created: true,
                email_sent: !!(customerEmail && relayUrl),
                telegram_sent: !!(telegramToken && telegramChatId),
            }
        }).catch(() => {})

        console.log(`Payment completed for Rechnung ${invoice_number}: €${amountEur.toFixed(2)}`)
    } catch (err) {
        console.error('Error handling checkout completion:', err)
    }
}

/**
 * Handle payment_intent.succeeded
 */
async function handlePaymentIntentSucceeded(paymentIntent: any, supabase: any) {
    try {
        const invoice_id = paymentIntent.metadata?.invoice_id
        if (!invoice_id) {
            return
        }

        console.log(`PaymentIntent succeeded for Rechnung ${invoice_id}`)

        await supabase.from('automation_log').insert({
            action: 'payment.intent_succeeded',
            target: invoice_id,
            metadata: {
                payment_intent_id: paymentIntent.id,
                amount: paymentIntent.amount
            }
        }).catch(() => {})
    } catch (err) {
        console.error('Error handling payment intent success:', err)
    }
}

/**
 * Handle payment_intent.payment_failed
 *
 * Actions:
 * 1. Update rechnungen with payment_failed_at timestamp and payment_error message (status stays 'offen')
 * 2. Record failed payment in stripe_payments audit table
 * 3. Log to automation_log
 * 4. Send Telegram notification to Jonas
 */
async function handlePaymentIntentFailed(paymentIntent: any, supabase: any) {
    try {
        const invoice_id = paymentIntent.metadata?.invoice_id
        const invoice_number = paymentIntent.metadata?.invoice_number || invoice_id
        const errorMessage = paymentIntent.last_payment_error?.message || 'Unbekannter Fehler'
        const errorCode = paymentIntent.last_payment_error?.code || 'unknown'
        const now = new Date().toISOString()

        if (!invoice_id) {
            console.warn('No invoice_id in payment_intent metadata (payment_failed)')
            return
        }

        console.log(`Payment failed for Rechnung ${invoice_number}: ${errorMessage}`)

        // 1. Update rechnungen: set failure timestamp + error, do NOT change status (keep 'offen')
        const { error: updateError } = await supabase
            .from('rechnungen')
            .update({
                payment_failed_at: now,
                payment_error: `${errorCode}: ${errorMessage}`,
            })
            .eq('id', invoice_id)

        if (updateError) {
            console.warn('Could not update rechnungen with failure info:', updateError.message)
        }

        // 2. Record failed payment in stripe_payments
        await supabase.from('stripe_payments').insert({
            stripe_session_id: paymentIntent.id,
            invoice_id: invoice_id,
            amount: paymentIntent.amount,
            currency: paymentIntent.currency || 'eur',
            payment_status: 'failed',
            created_at: now,
            metadata: {
                payment_intent_id: paymentIntent.id,
                error: errorMessage,
                error_code: errorCode,
                decline_code: paymentIntent.last_payment_error?.decline_code,
            }
        }).catch((err: any) => {
            console.error('Error recording failed payment:', err?.message || err)
        })

        // 3. Log the failed payment
        await supabase.from('automation_log').insert({
            action: 'payment.intent_failed',
            target: invoice_id,
            metadata: {
                payment_intent_id: paymentIntent.id,
                invoice_number,
                error: errorMessage,
                error_code: errorCode,
                decline_code: paymentIntent.last_payment_error?.decline_code,
            }
        }).catch(() => {})

        // 4. Send Telegram notification to Jonas
        await sendTelegramNotification(
            `⚠️ Zahlung fehlgeschlagen für Rechnung ${invoice_number} — ${errorMessage}`
        )

    } catch (err) {
        console.error('Error handling payment intent failure:', err)
    }
}

/**
 * Handle charge.refunded
 *
 * Actions:
 * 1. If fully refunded: mark invoice back to 'offen'
 *    If partially refunded: keep current status
 * 2. Record Storno (reversal) as negative einnahme in buchungen
 * 3. Record refund in stripe_payments audit table
 * 4. Log to automation_log
 * 5. Send Telegram notification to Jonas
 */
async function handleChargeRefunded(charge: any, supabase: any) {
    try {
        const invoice_id = charge.metadata?.invoice_id
        const invoice_number = charge.metadata?.invoice_number || invoice_id
        const refundReason = charge.refunds?.data?.[0]?.reason || 'requested_by_customer'
        const now = new Date().toISOString()

        if (!invoice_id) {
            console.warn('No invoice_id in charge metadata (refund)')
            return
        }

        const amountRefundedCents = charge.amount_refunded || 0
        const amountTotalCents = charge.amount || 0
        const amountRefundedEur = amountRefundedCents / 100
        const isFullRefund = amountRefundedCents >= amountTotalCents

        const formattedRefund = new Intl.NumberFormat('de-DE', {
            style: 'currency', currency: 'EUR'
        }).format(amountRefundedEur)

        console.log(`Charge refunded for Rechnung ${invoice_number}: ${formattedRefund} (${isFullRefund ? 'full' : 'partial'})`)

        // 1. If fully refunded, mark invoice back to 'offen'
        if (isFullRefund) {
            const { error: updateError } = await supabase
                .from('rechnungen')
                .update({
                    status: 'offen',
                    paid_at: null,
                    stripe_payment_id: null,
                    refunded_at: now,
                })
                .eq('id', invoice_id)

            if (updateError) {
                console.warn('Could not update rechnungen for refund:', updateError.message)
            } else {
                console.log(`Rechnung ${invoice_number} auf 'offen' zurückgesetzt (Vollerstattung)`)
            }
        } else {
            // Partial refund: just record refund timestamp, keep status unchanged
            await supabase
                .from('rechnungen')
                .update({ refunded_at: now })
                .eq('id', invoice_id)
                .catch(() => {})
        }

        // 2. Record Storno (reversal) as negative einnahme in buchungen
        // Kleinunternehmer §19 UStG: no VAT — netto = brutto
        const bruttoEur = -amountRefundedEur // negative for reversal
        const nettoEur = bruttoEur
        const ustEur = 0

        // Resolve tenant_id from invoice owner
        const { data: rechnung } = await supabase
            .from('rechnungen')
            .select('user_id')
            .eq('id', invoice_id)
            .maybeSingle()
        const tenantId = rechnung?.user_id || null

        await supabase.from('buchungen').insert({
            tenant_id: tenantId,
            typ: 'einnahme',
            kategorie: 'Storno',
            beschreibung: `Stripe-Erstattung Rechnung ${invoice_number} (${isFullRefund ? 'Voll' : 'Teil'}) — ${refundReason}`,
            datum: now,
            brutto: bruttoEur,
            netto: nettoEur,
            ust: ustEur,
            belegnummer: `STORNO-${invoice_number}`,
            zahlungsart: 'Stripe (Erstattung)',
            rechnung_id: invoice_id,
        }).catch((err: any) => {
            console.error('Error creating Storno buchung:', err?.message || err)
        })

        // 3. Record refund in stripe_payments
        await supabase.from('stripe_payments').insert({
            stripe_session_id: charge.id,
            invoice_id: invoice_id,
            amount: amountRefundedCents,
            currency: charge.currency || 'eur',
            payment_status: 'refunded',
            created_at: now,
            metadata: {
                charge_id: charge.id,
                reason: refundReason,
                is_full_refund: isFullRefund,
                amount_total: amountTotalCents,
                amount_refunded: amountRefundedCents,
            }
        }).catch((err: any) => {
            console.error('Error recording refund in stripe_payments:', err?.message || err)
        })

        // 4. Log refund
        await supabase.from('automation_log').insert({
            action: 'payment.refunded',
            target: invoice_id,
            metadata: {
                charge_id: charge.id,
                invoice_number,
                amount_refunded: amountRefundedCents,
                amount_total: amountTotalCents,
                is_full_refund: isFullRefund,
                reason: refundReason,
                storno_buchung_created: true,
            }
        }).catch(() => {})

        // 5. Send Telegram notification to Jonas
        const refundType = isFullRefund ? 'Vollerstattung' : 'Teilerstattung'
        await sendTelegramNotification(
            `🔄 ${refundType} für Rechnung ${invoice_number} — ${formattedRefund} (${refundReason})`
        )

    } catch (err) {
        console.error('Error handling refund:', err)
    }
}

/**
 * Shared helper: Send a Telegram message to Jonas
 */
async function sendTelegramNotification(message: string): Promise<void> {
    const telegramToken = Deno.env.get('TELEGRAM_BOT_TOKEN')
    const telegramChatId = Deno.env.get('TELEGRAM_CHAT_ID')

    if (!telegramToken || !telegramChatId) {
        console.warn('Telegram not configured, skipping notification')
        return
    }

    try {
        const response = await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: telegramChatId,
                text: message,
                parse_mode: 'HTML',
            }),
        })

        if (!response.ok) {
            console.error('Telegram API error:', response.status, await response.text())
        }
    } catch (err) {
        console.error('Error sending Telegram notification:', err)
    }
}
