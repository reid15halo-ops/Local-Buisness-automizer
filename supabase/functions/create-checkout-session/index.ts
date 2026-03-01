// Supabase Edge Function: Create Stripe Checkout Session
// Deploy: supabase functions deploy create-checkout-session
// Env vars needed: STRIPE_SECRET_KEY

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@14.14.0?target=deno'

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
        const { priceId, userId, email, successUrl, cancelUrl } = await req.json()

        if (!priceId || !userId || !email) {
            return new Response(
                JSON.stringify({ error: 'Missing required fields' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Check if customer already exists
        const existingCustomers = await stripe.customers.list({
            email: email,
            limit: 1,
        })

        let customerId: string
        if (existingCustomers.data.length > 0) {
            customerId = existingCustomers.data[0].id
        } else {
            const customer = await stripe.customers.create({
                email: email,
                metadata: { supabase_user_id: userId },
            })
            customerId = customer.id
        }

        // Create checkout session
        const session = await stripe.checkout.sessions.create({
            customer: customerId,
            mode: 'subscription',
            payment_method_types: ['card', 'sepa_debit'],
            line_items: [{ price: priceId, quantity: 1 }],
            success_url: successUrl || 'https://localhost:3000/success',
            cancel_url: cancelUrl || 'https://localhost:3000/cancel',
            subscription_data: {
                metadata: { supabase_user_id: userId },
                trial_period_days: 14,
            },
            locale: 'de',
            tax_id_collection: { enabled: true },
            allow_promotion_codes: true,
        })

        return new Response(
            JSON.stringify({ sessionId: session.id, url: session.url }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    } catch (err) {
        return new Response(
            JSON.stringify({ error: err.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
