// Supabase Edge Function: Create Stripe Checkout for Invoice Payment
// Deploy: supabase functions deploy create-checkout
// Env vars needed: STRIPE_SECRET_KEY

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@14.14.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
    apiVersion: '2024-12-18.acacia',
})

const corsHeaders = {
    'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') || 'https://app.freyaivisions.de',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    // CORS preflight
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

        const {
            invoice_id, invoice_number, amount,
            customer_email, customer_name,
            description, success_url, cancel_url
        } = await req.json()

        if (!invoice_id || !amount || !customer_email) {
            return new Response(
                JSON.stringify({ error: 'Pflichtfelder fehlen: invoice_id, amount, customer_email' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Validate amount (must be at least 0.50 EUR = 50 cents)
        if (amount < 50) {
            return new Response(
                JSON.stringify({ error: 'Amount must be at least €0.50' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Check if customer already exists in Stripe
        const existingCustomers = await stripe.customers.list({
            email: customer_email,
            limit: 1,
        })

        let customerId: string
        if (existingCustomers.data.length > 0) {
            customerId = existingCustomers.data[0].id
            // Update name if provided and not already set
            if (customer_name && !existingCustomers.data[0].name) {
                await stripe.customers.update(customerId, { name: customer_name })
            }
        } else {
            const customer = await stripe.customers.create({
                email: customer_email,
                name: customer_name || undefined,
                metadata: {
                    supabase_user_id: user.id,
                    source: 'freyai_invoice'
                },
            })
            customerId = customer.id
        }

        const invoiceRef = invoice_number || invoice_id
        const appOrigin = Deno.env.get('ALLOWED_ORIGIN') || 'https://app.freyaivisions.de'

        // Create checkout session for one-time payment
        // Note: giropay/sofort are deprecated by Stripe -- use card, sepa_debit, eps, bancontact
        const session = await stripe.checkout.sessions.create({
            customer: customerId,
            customer_email: undefined, // already set via customer object
            mode: 'payment',
            payment_method_types: ['card', 'sepa_debit', 'eps', 'bancontact', 'klarna'],
            line_items: [
                {
                    price_data: {
                        currency: 'eur',
                        product_data: {
                            name: description || `Rechnung ${invoiceRef}`,
                            description: `Rechnungsnummer: ${invoiceRef}`,
                            metadata: {
                                invoice_id: invoice_id,
                                invoice_number: invoiceRef,
                            },
                        },
                        unit_amount: amount, // amount in cents
                    },
                    quantity: 1,
                }
            ],
            payment_intent_data: {
                description: `Rechnung ${invoiceRef}`,
                metadata: {
                    invoice_id: invoice_id,
                    invoice_number: invoiceRef,
                },
                statement_descriptor_suffix: `RE ${invoiceRef}`.substring(0, 22),
            },
            success_url: success_url || `${appOrigin}/index.html?payment=success&invoice=${invoice_id}`,
            cancel_url: cancel_url || `${appOrigin}/index.html?payment=cancelled&invoice=${invoice_id}`,
            metadata: {
                invoice_id: invoice_id,
                invoice_number: invoiceRef,
                supabase_user_id: user.id,
                customer_name: customer_name || '',
            },
            locale: 'de',
            tax_id_collection: { enabled: false },
            allow_promotion_codes: false,
            expires_at: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24h expiry
        })

        return new Response(
            JSON.stringify({
                sessionId: session.id,
                url: session.url,
                invoice_id: invoice_id,
                invoice_number: invoiceRef,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    } catch (err) {
        console.error('Checkout error:', err)
        return new Response(
            JSON.stringify({ error: err.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
