// Supabase Edge Function: Canva Connect API Proxy
// Proxies requests to Canva's Connect API, keeping the API key server-side.
// Deploy: supabase functions deploy canva-proxy
// Env vars: CANVA_API_KEY
//
// TODO: Set CANVA_API_KEY in Supabase Dashboard → Edge Functions → Secrets
//       Get your key at https://www.canva.dev/docs/connect/quick-start/

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const corsHeaders = {
    'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') || 'https://app.freyaivisions.de',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const CANVA_API_BASE = 'https://api.canva.com/rest/v1'

serve(async (req) => {
    // CORS preflight
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

        // Get Canva API key from environment
        // TODO: Configure this secret in Supabase Dashboard → Edge Functions → Secrets
        const canvaApiKey = Deno.env.get('CANVA_API_KEY')
        if (!canvaApiKey) {
            console.error('CANVA_API_KEY environment variable not configured')
            return new Response(
                JSON.stringify({ error: 'Canva-Service vorübergehend nicht verfügbar' }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const body = await req.json()
        const { action } = body

        if (!action) {
            return new Response(
                JSON.stringify({ error: 'Field "action" is required' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        let result: Record<string, unknown>

        switch (action) {
            case 'clone':
                result = await handleClone(canvaApiKey, body)
                break
            case 'personalize':
                result = await handlePersonalize(canvaApiKey, body)
                break
            case 'export':
                result = await handleExport(canvaApiKey, body)
                break
            case 'status':
                result = await handleStatus(canvaApiKey, body)
                break
            default:
                return new Response(
                    JSON.stringify({ error: `Unknown action: ${action}` }),
                    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
        }

        // Log to automation_log for tracking
        await supabase.from('automation_log').insert({
            user_id: user.id,
            action: `canva.${action}`,
            target: body.design_id || body.template_id || null,
            metadata: { campaign_id: body.campaign_id || null },
        }).catch(() => {}) // Don't fail if logging fails

        return new Response(
            JSON.stringify(result),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    } catch (err) {
        console.error('Canva Proxy error:', err)
        return new Response(
            JSON.stringify({ error: 'Interner Serverfehler' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})

// ── Action Handlers ──────────────────────────────────────

/**
 * Clone a Canva design (template → editable copy)
 * @see https://www.canva.dev/docs/connect/api-reference/designs/create-design-copy/
 */
async function handleClone(
    apiKey: string,
    body: { template_id: string; campaign_id?: string }
): Promise<Record<string, unknown>> {
    if (!body.template_id) {
        throw new Error('template_id is required for clone action')
    }

    // TODO: Adjust endpoint and payload to match your Canva Connect API version
    const response = await canvaFetch(apiKey, `/designs/${body.template_id}/copy`, 'POST', {
        title_suffix: body.campaign_id ? ` — Campaign ${body.campaign_id}` : ' — Copy',
    })

    return {
        design_id: response.design?.id,
        title: response.design?.title,
        edit_url: response.design?.urls?.edit_url,
    }
}

/**
 * Personalize a design with customer brand data (logo, colors, text)
 * Uses Canva's autofill / design editing endpoints.
 * @see https://www.canva.dev/docs/connect/api-reference/autofill/
 */
async function handlePersonalize(
    apiKey: string,
    body: { design_id: string; brand_data: Record<string, unknown> }
): Promise<Record<string, unknown>> {
    if (!body.design_id) {
        throw new Error('design_id is required for personalize action')
    }

    const brand = body.brand_data || {}

    // Build autofill data map — keys must match placeholder names in Canva template
    // TODO: Adjust placeholder keys to match your Canva master template text fields
    const autofillData: Record<string, unknown> = {}

    if (brand.company_name) autofillData['company_name'] = { type: 'text', text: brand.company_name as string }
    if (brand.trade) autofillData['trade'] = { type: 'text', text: brand.trade as string }
    if (brand.city) autofillData['city'] = { type: 'text', text: brand.city as string }
    if (brand.phone) autofillData['phone'] = { type: 'text', text: brand.phone as string }
    if (brand.email) autofillData['email'] = { type: 'text', text: brand.email as string }

    // USPs as numbered placeholders (usp_1, usp_2, ...)
    const usps = (brand.usps || []) as string[]
    usps.forEach((usp: string, i: number) => {
        autofillData[`usp_${i + 1}`] = { type: 'text', text: usp }
    })

    // Logo as image replacement
    if (brand.logo_url) {
        autofillData['logo'] = { type: 'image', url: brand.logo_url as string }
    }

    // TODO: Adjust endpoint based on Canva Connect API version
    // Canva autofill creates a new design from a brand template with data
    const response = await canvaFetch(apiKey, `/designs/${body.design_id}/autofill`, 'POST', {
        data: autofillData,
        // TODO: If brand_colors mapping is supported, add color overrides here
    })

    return {
        design_id: response.design?.id || body.design_id,
        status: 'personalized',
    }
}

/**
 * Start an async export job for a design
 * @see https://www.canva.dev/docs/connect/api-reference/exports/create-design-export/
 */
async function handleExport(
    apiKey: string,
    body: { design_id: string; format?: string }
): Promise<Record<string, unknown>> {
    if (!body.design_id) {
        throw new Error('design_id is required for export action')
    }

    const format = body.format || 'png'

    const response = await canvaFetch(apiKey, '/exports', 'POST', {
        design_id: body.design_id,
        format: {
            type: format,
            ...(format === 'png' || format === 'jpg' ? { quality: 'high', width: 1080, height: 1080 } : {}),
            ...(format === 'pdf' ? { quality: 'high' } : {}),
        },
    })

    return {
        export_id: response.export?.id,
        status: response.export?.status || 'in_progress',
        urls: response.export?.urls || [],
    }
}

/**
 * Check the status of an export job
 * @see https://www.canva.dev/docs/connect/api-reference/exports/get-design-export/
 */
async function handleStatus(
    apiKey: string,
    body: { design_id: string; export_id?: string }
): Promise<Record<string, unknown>> {
    // If an export_id is provided, check that specific export
    const exportId = body.export_id || body.design_id
    if (!exportId) {
        throw new Error('design_id or export_id is required for status action')
    }

    const response = await canvaFetch(apiKey, `/exports/${exportId}`, 'GET')

    return {
        status: response.export?.status || 'unknown',
        urls: response.export?.urls || [],
    }
}

// ── Canva API Helper ─────────────────────────────────────

/**
 * Make an authenticated request to the Canva Connect API
 */
async function canvaFetch(
    apiKey: string,
    path: string,
    method: string,
    body?: Record<string, unknown>
): Promise<Record<string, unknown>> {
    const url = `${CANVA_API_BASE}${path}`

    const headers: Record<string, string> = {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
    }

    const options: RequestInit = { method, headers }
    if (body && method !== 'GET') {
        options.body = JSON.stringify(body)
    }

    const response = await fetch(url, options)

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error(`Canva API ${method} ${path} failed:`, response.status, errorData)
        throw new Error(`Canva API ${response.status}: ${errorData?.message || response.statusText}`)
    }

    return await response.json()
}
