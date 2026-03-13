// Supabase Edge Function: GoCardless API Proxy
// Keeps GoCardless secret_id and secret_key server-side
// Deploy: supabase functions deploy gocardless-proxy
// Env vars: GOCARDLESS_SECRET_ID, GOCARDLESS_SECRET_KEY

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const GOCARDLESS_BASE_URL = 'https://bankaccountdata.gocardless.com/api/v2'

const corsHeaders = {
    'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') || 'https://app.freyaivisions.de',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Allowlisted GoCardless API paths (prevent arbitrary proxying)
const ALLOWED_PATHS = [
    '/token/new/',
    '/institutions/',
    '/agreements/enduser/',
    '/requisitions/',
    '/accounts/',
]

function isAllowedPath(path: string): boolean {
    return ALLOWED_PATHS.some(allowed => path.startsWith(allowed))
}

// In-memory token cache (per isolate lifetime)
let cachedToken: string | null = null
let tokenExpiry = 0

async function getAccessToken(): Promise<string> {
    if (cachedToken && Date.now() < tokenExpiry - 300000) {
        return cachedToken
    }

    const secretId = Deno.env.get('GOCARDLESS_SECRET_ID')
    const secretKey = Deno.env.get('GOCARDLESS_SECRET_KEY')

    if (!secretId || !secretKey) {
        throw new Error('GOCARDLESS_SECRET_ID und GOCARDLESS_SECRET_KEY nicht konfiguriert')
    }

    const response = await fetch(`${GOCARDLESS_BASE_URL}/token/new/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ secret_id: secretId, secret_key: secretKey }),
    })

    if (!response.ok) {
        const errorBody = await response.text()
        throw new Error(`GoCardless auth failed (${response.status}): ${errorBody}`)
    }

    const data = await response.json()
    cachedToken = data.access
    tokenExpiry = Date.now() + (data.access_expires || 86400) * 1000

    return cachedToken!
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // Authenticate user via Supabase JWT
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

        // Parse request
        const { method, path, body } = await req.json()

        if (!path || typeof path !== 'string') {
            return new Response(
                JSON.stringify({ error: 'Feld "path" ist erforderlich (z.B. "/institutions/?country=DE")' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Validate path against allowlist
        if (!isAllowedPath(path)) {
            return new Response(
                JSON.stringify({ error: `Pfad nicht erlaubt: ${path}` }),
                { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const httpMethod = (method || 'GET').toUpperCase()
        if (!['GET', 'POST', 'PUT', 'DELETE'].includes(httpMethod)) {
            return new Response(
                JSON.stringify({ error: `HTTP-Methode nicht erlaubt: ${httpMethod}` }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Get access token (handles caching + refresh)
        const token = await getAccessToken()

        // Proxy request to GoCardless
        const gcOptions: RequestInit = {
            method: httpMethod,
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
        }
        if (body && httpMethod !== 'GET') {
            gcOptions.body = JSON.stringify(body)
        }

        const gcResponse = await fetch(`${GOCARDLESS_BASE_URL}${path}`, gcOptions)
        const gcData = await gcResponse.text()

        // Log to automation_log
        await supabase.from('automation_log').insert({
            user_id: user.id,
            action: 'banking.gocardless_proxy',
            target: `${httpMethod} ${path}`,
            metadata: { status: gcResponse.status },
        }).catch(() => {})

        return new Response(gcData, {
            status: gcResponse.status,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Interner Serverfehler'
        return new Response(
            JSON.stringify({ error: message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
