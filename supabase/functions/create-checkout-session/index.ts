// Supabase Edge Function: Create Stripe Checkout Session
// Deploy: supabase functions deploy create-checkout-session
// Env vars needed: STRIPE_SECRET_KEY

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'
import Stripe from 'https://esm.sh/stripe@14.14.0?target=deno'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
    apiVersion: '2024-12-18.acacia',
})

const corsHeaders = {
    'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') || 'https://app.freyaivisions.de',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ALLOWED_REDIRECT_ORIGINS = [
    'https://app.freyaivisions.de',
    'https://freyaivisions.de',
    Deno.env.get('ALLOWED_ORIGIN') || '',
].filter(Boolean)

function isAllowedRedirectUrl(url: string | undefined): boolean {
    if (!url) return false
    try {
        const parsed = new URL(url)
        return ALLOWED_REDIRECT_ORIGINS.some(origin => parsed.origin === origin)
    } catch {
        return false
    }
}

serve(async (req) => {
    // CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // Authenticate the request via Supabase JWT
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) {
            return new Response(
                JSON.stringify({ error: 'Missing authorization header' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: authHeader } } }
        )

        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return new Response(
                JSON.stringify({ error: 'Invalid or expired token' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const { priceId, successUrl, cancelUrl } = await req.json()
        const userId = user.id
        const email = user.email

        if (!priceId) {
            return new Response(
                JSON.stringify({ error: 'Missing required field: priceId' }),
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
            success_url: isAllowedRedirectUrl(successUrl) ? successUrl : `${ALLOWED_REDIRECT_ORIGINS[0]}/success`,
            cancel_url: isAllowedRedirectUrl(cancelUrl) ? cancelUrl : `${ALLOWED_REDIRECT_ORIGINS[0]}/cancel`,
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
