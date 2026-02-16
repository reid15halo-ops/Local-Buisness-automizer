// Supabase Edge Function: Stripe Webhook Handler
// Deploy: supabase functions deploy stripe-webhook
// Env vars needed: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
// Set webhook endpoint in Stripe Dashboard: https://your-domain/functions/v1/stripe-webhook

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@14.14.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!)

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
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

        // Initialize Supabase client
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
        console.error('Webhook error:', err)
        return new Response(
            JSON.stringify({ error: err.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})

/**
 * Handle checkout.session.completed
 * Called when customer completes payment at Stripe Checkout
 */
async function handleCheckoutSessionCompleted(session: any, supabase: any) {
    try {
        const invoice_id = session.metadata?.invoice_id
        if (!invoice_id) {
            console.warn('No invoice_id in session metadata')
            return
        }

        // Record payment in database
        const { error: insertError } = await supabase.from('stripe_payments').insert({
            stripe_session_id: session.id,
            stripe_customer_id: session.customer,
            invoice_id: invoice_id,
            amount: session.amount_total,
            currency: session.currency,
            payment_status: 'completed',
            payment_method: session.payment_method_types?.[0] || 'card',
            created_at: new Date().toISOString(),
            metadata: session.metadata
        }).catch(err => console.error('Insert error:', err))

        if (insertError) {
            console.error('Error recording payment:', insertError)
        }

        // Update invoice status (if using Supabase database)
        // Note: This assumes you have an 'invoices' table with an 'id' and 'status' column
        try {
            const { error: updateError } = await supabase
                .from('invoices')
                .update({
                    status: 'bezahlt',
                    paid_at: new Date().toISOString(),
                    stripe_payment_id: session.id,
                    payment_method: session.payment_method_types?.[0] || 'card'
                })
                .eq('id', invoice_id)

            if (updateError) {
                // Table might not exist - this is optional
                console.warn('Could not update invoice table:', updateError.message)
            } else {
                console.log(`Invoice ${invoice_id} marked as paid`)
            }
        } catch (err) {
            console.warn('Invoice update failed (optional):', err)
        }

        // Log the action
        await supabase.from('automation_log').insert({
            action: 'payment.checkout_completed',
            target: invoice_id,
            metadata: {
                session_id: session.id,
                amount: session.amount_total,
                customer_email: session.customer_details?.email
            }
        }).catch(() => {})

        console.log(`Payment completed for invoice ${invoice_id}: €${(session.amount_total / 100).toFixed(2)}`)
    } catch (err) {
        console.error('Error handling checkout completion:', err)
    }
}

/**
 * Handle payment_intent.succeeded
 * Called when a PaymentIntent succeeds (may be redundant with checkout.session.completed)
 */
async function handlePaymentIntentSucceeded(paymentIntent: any, supabase: any) {
    try {
        const invoice_id = paymentIntent.metadata?.invoice_id
        if (!invoice_id) {
            return
        }

        console.log(`PaymentIntent succeeded for invoice ${invoice_id}`)

        // Log the action
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
 * Called when a payment attempt fails
 */
async function handlePaymentIntentFailed(paymentIntent: any, supabase: any) {
    try {
        const invoice_id = paymentIntent.metadata?.invoice_id
        if (!invoice_id) {
            return
        }

        console.log(`Payment failed for invoice ${invoice_id}: ${paymentIntent.last_payment_error?.message}`)

        // Log the failed payment
        await supabase.from('automation_log').insert({
            action: 'payment.intent_failed',
            target: invoice_id,
            metadata: {
                payment_intent_id: paymentIntent.id,
                error: paymentIntent.last_payment_error?.message,
                error_code: paymentIntent.last_payment_error?.code
            }
        }).catch(() => {})

        // Optionally: Mark invoice as payment_failed in database
        try {
            await supabase
                .from('invoices')
                .update({
                    status: 'zahlungsfehlgeschlagen',
                    payment_failure_reason: paymentIntent.last_payment_error?.message
                })
                .eq('id', invoice_id)
                .catch(() => {})
        } catch (err) {
            console.warn('Could not update invoice with payment failure:', err)
        }
    } catch (err) {
        console.error('Error handling payment intent failure:', err)
    }
}

/**
 * Handle charge.refunded
 * Called when a charge is refunded
 */
async function handleChargeRefunded(charge: any, supabase: any) {
    try {
        const invoice_id = charge.metadata?.invoice_id
        if (!invoice_id) {
            return
        }

        console.log(`Charge refunded for invoice ${invoice_id}: €${(charge.amount_refunded / 100).toFixed(2)}`)

        // Log refund
        await supabase.from('automation_log').insert({
            action: 'payment.refunded',
            target: invoice_id,
            metadata: {
                charge_id: charge.id,
                amount_refunded: charge.amount_refunded,
                reason: charge.refunds?.data?.[0]?.reason
            }
        }).catch(() => {})

        // Update invoice status
        try {
            await supabase
                .from('invoices')
                .update({
                    status: 'erstattet',
                    refunded_at: new Date().toISOString()
                })
                .eq('id', invoice_id)
                .catch(() => {})
        } catch (err) {
            console.warn('Could not update invoice with refund:', err)
        }
    } catch (err) {
        console.error('Error handling refund:', err)
    }
}
