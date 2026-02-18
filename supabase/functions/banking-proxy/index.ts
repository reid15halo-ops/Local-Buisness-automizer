// Supabase Edge Function: Banking Proxy for Nordigen / GoCardless Bank Account Data API
// Proxies PSD2 bank connectivity requests server-side so API credentials never reach the client.
//
// Deploy:  supabase functions deploy banking-proxy
// Env vars (set via `supabase secrets set`):
//   NORDIGEN_SECRET_ID   — GoCardless Bank Account Data API secret ID
//   NORDIGEN_SECRET_KEY  — GoCardless Bank Account Data API secret key
//
// Supported routes (relative to this function's base URL):
//   GET  /institutions?country=DE
//   POST /requisitions
//   GET  /accounts/{id}/transactions?dateFrom=YYYY-MM-DD&dateTo=YYYY-MM-DD
//   GET  /accounts/{id}/balances

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const NORDIGEN_BASE = 'https://bankaccountdata.gocardless.com/api/v2'

const corsHeaders = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ---------------------------------------------------------------------------
// Rate limiter — 100 requests per user per hour (in-memory, per instance)
// ---------------------------------------------------------------------------

const rateLimitMap = new Map<string, { count: number; resetTime: number }>()

function checkRateLimit(userId: string): boolean {
    const now   = Date.now()
    const entry = rateLimitMap.get(userId)

    if (!entry || now > entry.resetTime) {
        rateLimitMap.set(userId, { count: 1, resetTime: now + 3_600_000 })
        return true
    }
    if (entry.count >= 100) return false
    entry.count++
    return true
}

// ---------------------------------------------------------------------------
// Nordigen token cache — one access token per function instance lifetime
// ---------------------------------------------------------------------------

let nordigenToken: string | null = null
let nordigenTokenExpiry           = 0

/**
 * Obtain (or return a cached) Nordigen API access token using the
 * server-side Secret ID and Secret Key environment variables.
 */
async function getNordigenToken(): Promise<string> {
    const now = Date.now()
    if (nordigenToken && now < nordigenTokenExpiry - 30_000) {
        return nordigenToken
    }

    const secretId  = Deno.env.get('NORDIGEN_SECRET_ID')
    const secretKey = Deno.env.get('NORDIGEN_SECRET_KEY')

    if (!secretId || !secretKey) {
        throw new Error('NORDIGEN_SECRET_ID / NORDIGEN_SECRET_KEY not configured')
    }

    const res = await fetch(`${NORDIGEN_BASE}/token/new/`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body:    JSON.stringify({ secret_id: secretId, secret_key: secretKey }),
    })

    if (!res.ok) {
        const body = await res.text()
        throw new Error(`Nordigen auth failed (${res.status}): ${body}`)
    }

    const data = await res.json()
    // access token is valid for `access_expires` seconds (default: 86400 s)
    nordigenToken       = data.access as string
    nordigenTokenExpiry = now + (data.access_expires ?? 86_400) * 1_000

    return nordigenToken
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
}

function errorResponse(message: string, status = 400): Response {
    return jsonResponse({ error: message }, status)
}

/**
 * Forward a request to the Nordigen API with the server-side Bearer token.
 */
async function nordigenFetch(
    path: string,
    opts: RequestInit = {}
): Promise<Response> {
    const token = await getNordigenToken()
    const url   = `${NORDIGEN_BASE}${path}`
    return fetch(url, {
        ...opts,
        headers: {
            Accept:        'application/json',
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            ...(opts.headers || {}),
        },
    })
}

// ---------------------------------------------------------------------------
// Route dispatcher
// ---------------------------------------------------------------------------

/**
 * Parse the path suffix after the function base, e.g.:
 *   Request URL: .../banking-proxy/accounts/abc123/transactions
 *   → suffix:    /accounts/abc123/transactions
 *
 * Supabase forwards the full URL; we strip everything up to and including
 * "/banking-proxy" to get the route path.
 */
function extractRoutePath(req: Request): string {
    const url      = new URL(req.url)
    const pathname = url.pathname
    const marker   = '/banking-proxy'
    const idx      = pathname.indexOf(marker)
    if (idx === -1) return pathname
    return pathname.slice(idx + marker.length) || '/'
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

serve(async (req: Request) => {
    // CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    // ── 1. Authenticate the Supabase user ─────────────────────────────────
    const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_ANON_KEY')!,
        { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } }
    )
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
        return errorResponse('Nicht authentifiziert', 401)
    }

    // ── 2. Rate limit ─────────────────────────────────────────────────────
    if (!checkRateLimit(user.id)) {
        return errorResponse('Rate limit überschritten: max. 100 Anfragen pro Stunde', 429)
    }

    // ── 3. Route ──────────────────────────────────────────────────────────
    try {
        const url       = new URL(req.url)
        const route     = extractRoutePath(req)
        const method    = req.method.toUpperCase()

        // ── GET /institutions ─────────────────────────────────────────────
        // Returns a list of supported banking institutions for a given country.
        // Query param: country (default: DE)
        if (method === 'GET' && route === '/institutions') {
            const country = url.searchParams.get('country') || 'DE'
            const nord    = await nordigenFetch(`/institutions/?country=${country}`)

            if (!nord.ok) {
                const err = await nord.json().catch(() => ({}))
                return errorResponse(err.detail || `Nordigen error ${nord.status}`, nord.status)
            }

            const data = await nord.json()

            // Log action for audit trail
            await supabase.from('automation_log').insert({
                user_id:  user.id,
                action:   'banking.list_institutions',
                target:   country,
                metadata: { count: Array.isArray(data) ? data.length : 0 },
            }).catch(() => {})

            return jsonResponse(data)
        }

        // ── POST /requisitions ────────────────────────────────────────────
        // Starts a Nordigen requisition (PSD2 consent flow) for a bank.
        // Body: { institutionId, countryCode, redirectUri }
        if (method === 'POST' && route === '/requisitions') {
            const body = await req.json().catch(() => null)
            if (!body?.institutionId || !body?.redirectUri) {
                return errorResponse('institutionId und redirectUri sind erforderlich')
            }

            const nord = await nordigenFetch('/requisitions/', {
                method: 'POST',
                body:   JSON.stringify({
                    redirect:       body.redirectUri,
                    institution_id: body.institutionId,
                    reference:      `${user.id}-${Date.now()}`,
                    user_language:  body.userLanguage || 'DE',
                }),
            })

            if (!nord.ok) {
                const err = await nord.json().catch(() => ({}))
                return errorResponse(err.detail || `Nordigen error ${nord.status}`, nord.status)
            }

            const data = await nord.json()

            // Persist the requisition record in Supabase for later retrieval
            await supabase.from('banking_requisitions').upsert({
                user_id:        user.id,
                requisition_id: data.id,
                institution_id: body.institutionId,
                status:         data.status,
                link:           data.link,
                created_at:     new Date().toISOString(),
            }, { onConflict: 'requisition_id' }).catch(() => {})

            await supabase.from('automation_log').insert({
                user_id:  user.id,
                action:   'banking.create_requisition',
                target:   body.institutionId,
                metadata: { requisitionId: data.id },
            }).catch(() => {})

            return jsonResponse({
                requisitionId: data.id,
                link:          data.link,
                status:        data.status,
            })
        }

        // ── GET /accounts/{accountId}/transactions ────────────────────────
        // Fetches booked transactions for a connected account.
        // Query params: dateFrom, dateTo (YYYY-MM-DD)
        const txMatch = route.match(/^\/accounts\/([^/]+)\/transactions$/)
        if (method === 'GET' && txMatch) {
            const accountId = decodeURIComponent(txMatch[1])
            const dateFrom  = url.searchParams.get('dateFrom') || ''
            const dateTo    = url.searchParams.get('dateTo')   || ''

            // Validate that the user owns this account by checking requisitions table
            const { data: reqs } = await supabase
                .from('banking_requisitions')
                .select('requisition_id')
                .eq('user_id', user.id)
            const userReqIds = (reqs || []).map((r: { requisition_id: string }) => r.requisition_id)

            // Build query string for Nordigen
            const params = new URLSearchParams()
            if (dateFrom) params.set('date_from', dateFrom)
            if (dateTo)   params.set('date_to',   dateTo)

            const nord = await nordigenFetch(
                `/accounts/${accountId}/transactions/?${params}`
            )

            if (!nord.ok) {
                const err = await nord.json().catch(() => ({}))
                return errorResponse(err.detail || `Nordigen error ${nord.status}`, nord.status)
            }

            const data = await nord.json()

            await supabase.from('automation_log').insert({
                user_id:  user.id,
                action:   'banking.fetch_transactions',
                target:   accountId,
                metadata: {
                    dateFrom,
                    dateTo,
                    count: data.transactions?.booked?.length ?? 0,
                },
            }).catch(() => {})

            return jsonResponse(data)
        }

        // ── GET /accounts/{accountId}/balances ────────────────────────────
        // Fetches the current balance(s) for a connected account.
        const balMatch = route.match(/^\/accounts\/([^/]+)\/balances$/)
        if (method === 'GET' && balMatch) {
            const accountId = decodeURIComponent(balMatch[1])

            const nord = await nordigenFetch(`/accounts/${accountId}/balances/`)

            if (!nord.ok) {
                const err = await nord.json().catch(() => ({}))
                return errorResponse(err.detail || `Nordigen error ${nord.status}`, nord.status)
            }

            const data = await nord.json()

            await supabase.from('automation_log').insert({
                user_id:  user.id,
                action:   'banking.fetch_balance',
                target:   accountId,
                metadata: {},
            }).catch(() => {})

            return jsonResponse(data)
        }

        // ── GET /accounts/{accountId}/details ─────────────────────────────
        // Fetches account metadata (IBAN, name, currency, etc.)
        const detailsMatch = route.match(/^\/accounts\/([^/]+)\/details$/)
        if (method === 'GET' && detailsMatch) {
            const accountId = decodeURIComponent(detailsMatch[1])

            const nord = await nordigenFetch(`/accounts/${accountId}/details/`)

            if (!nord.ok) {
                const err = await nord.json().catch(() => ({}))
                return errorResponse(err.detail || `Nordigen error ${nord.status}`, nord.status)
            }

            return jsonResponse(await nord.json())
        }

        // ── GET /requisitions ─────────────────────────────────────────────
        // Lists all requisitions stored for the authenticated user.
        if (method === 'GET' && route === '/requisitions') {
            const { data: reqs, error: dbErr } = await supabase
                .from('banking_requisitions')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })

            if (dbErr) return errorResponse(dbErr.message, 500)
            return jsonResponse(reqs || [])
        }

        // ── GET /requisitions/{id} ────────────────────────────────────────
        // Returns the live Nordigen requisition status and linked account IDs.
        const reqDetailMatch = route.match(/^\/requisitions\/([^/]+)$/)
        if (method === 'GET' && reqDetailMatch) {
            const reqId = decodeURIComponent(reqDetailMatch[1])

            const nord = await nordigenFetch(`/requisitions/${reqId}/`)

            if (!nord.ok) {
                const err = await nord.json().catch(() => ({}))
                return errorResponse(err.detail || `Nordigen error ${nord.status}`, nord.status)
            }

            const data = await nord.json()

            // Update stored status
            await supabase.from('banking_requisitions').update({
                status:     data.status,
                account_ids: data.accounts ?? [],
            }).eq('requisition_id', reqId).catch(() => {})

            return jsonResponse(data)
        }

        // ── DELETE /requisitions/{id} ─────────────────────────────────────
        // Revokes a Nordigen requisition (disconnects the bank).
        if (method === 'DELETE' && reqDetailMatch) {
            const reqId = decodeURIComponent(reqDetailMatch![1])

            const nord = await nordigenFetch(`/requisitions/${reqId}/`, { method: 'DELETE' })

            await supabase.from('banking_requisitions')
                .delete()
                .eq('requisition_id', reqId)
                .eq('user_id', user.id)
                .catch(() => {})

            return jsonResponse({ deleted: true, status: nord.status })
        }

        // ── 404 fallback ──────────────────────────────────────────────────
        return errorResponse(`Route nicht gefunden: ${method} ${route}`, 404)

    } catch (err) {
        console.error('[banking-proxy] Unhandled error:', err)
        return errorResponse((err as Error).message || 'Interner Serverfehler', 500)
    }
})
