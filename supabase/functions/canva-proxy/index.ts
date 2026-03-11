// Supabase Edge Function: Canva Connect API Proxy
// Proxies requests to Canva's Connect API, keeping the API key server-side.
// Deploy: supabase functions deploy canva-proxy
// Env vars: CANVA_API_KEY (from https://www.canva.dev/docs/connect/quick-start/)

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const corsHeaders = {
    'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') || 'https://app.freyaivisions.de',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const CANVA_API_BASE = 'https://api.canva.com/rest/v1'

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_ANON_KEY')!,
            { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
        )
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return jsonResponse({ error: 'Nicht authentifiziert' }, 401)
        }

        const canvaApiKey = Deno.env.get('CANVA_API_KEY')
        if (!canvaApiKey) {
            console.error('CANVA_API_KEY not configured')
            return jsonResponse({ error: 'Canva-Service vorübergehend nicht verfügbar' }, 500)
        }

        const body = await req.json()
        const { action } = body

        if (!action) {
            return jsonResponse({ error: 'Field "action" is required' }, 400)
        }

        const handlers: Record<string, (key: string, body: Record<string, unknown>) => Promise<Record<string, unknown>>> = {
            clone: handleClone,
            autofill: handleAutofill,
            personalize: handleAutofill, // alias
            export: handleExport,
            status: handleStatus,
            'upload-asset': handleUploadAsset,
            'list-designs': handleListDesigns,
            'list-brand-templates': handleListBrandTemplates,
            'autofill-status': handleAutofillStatus,
            persist: handlePersist,
        }

        const handler = handlers[action]
        if (!handler) {
            return jsonResponse({ error: `Unknown action: ${action}` }, 400)
        }

        const result = await handler(canvaApiKey, body)

        // Log to automation_log
        const serviceClient = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
        )
        await serviceClient.from('automation_log').insert({
            user_id: user.id,
            action: `canva.${action}`,
            target: body.design_id || body.template_id || null,
            metadata: { campaign_id: body.campaign_id || null },
        }).catch(() => {})

        return jsonResponse(result)
    } catch (err) {
        console.error('Canva Proxy error:', err)
        const message = err instanceof Error ? err.message : 'Interner Serverfehler'
        return jsonResponse({ error: message }, 500)
    }
})

function jsonResponse(data: unknown, status = 200) {
    return new Response(
        JSON.stringify(data),
        { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
}

// ── Action Handlers ──────────────────────────────────────

/**
 * Clone a design (create a copy from an existing design or brand template)
 * @see https://www.canva.dev/docs/connect/api-reference/designs/create-design-copy/
 */
async function handleClone(
    apiKey: string,
    body: Record<string, unknown>
): Promise<Record<string, unknown>> {
    const templateId = body.template_id as string
    if (!templateId) throw new Error('template_id is required for clone action')

    const suffix = body.campaign_id ? ` — Campaign ${body.campaign_id}` : ' — Copy'

    const response = await canvaFetch(apiKey, '/designs', 'POST', {
        design_source: {
            type: 'design',
            design_id: templateId,
        },
        title_suffix: suffix,
    })

    const design = response.design as Record<string, unknown> | undefined
    return {
        design_id: design?.id,
        title: design?.title,
        edit_url: (design?.urls as Record<string, unknown>)?.edit_url,
        thumbnail_url: (design?.thumbnail as Record<string, unknown>)?.url,
    }
}

/**
 * Autofill a brand template with customer data.
 * Creates a new design from a brand template, replacing placeholders.
 * @see https://www.canva.dev/docs/connect/api-reference/autofill/create-design-autofill-job/
 */
async function handleAutofill(
    apiKey: string,
    body: Record<string, unknown>
): Promise<Record<string, unknown>> {
    // Accept either design_id (legacy) or brand_template_id
    const brandTemplateId = (body.brand_template_id || body.design_id) as string
    if (!brandTemplateId) throw new Error('brand_template_id is required for autofill action')

    const brand = (body.brand_data || {}) as Record<string, unknown>
    const autofillData: Record<string, unknown> = {}

    // Text fields — keys must match placeholder names in Canva brand template
    const textFields: Record<string, string> = {
        company_name: brand.company_name as string,
        trade: brand.trade as string,
        city: brand.city as string,
        phone: brand.phone as string,
        email: brand.email as string,
        website: brand.website as string,
    }

    for (const [key, value] of Object.entries(textFields)) {
        if (value) autofillData[key] = { type: 'text', text: value }
    }

    // USPs as numbered placeholders
    const usps = (brand.usps || []) as string[]
    usps.forEach((usp: string, i: number) => {
        autofillData[`usp_${i + 1}`] = { type: 'text', text: usp }
    })

    // Image fields
    if (brand.logo_url) {
        autofillData['logo'] = { type: 'image', asset_id: brand.logo_asset_id || undefined, url: brand.logo_url as string }
    }

    // Project photos
    const photos = (brand.photos || []) as Array<Record<string, unknown>>
    photos.forEach((photo, i) => {
        autofillData[`photo_${i + 1}`] = { type: 'image', url: photo.url as string }
    })

    // Brand colors
    const colors = (brand.brand_colors || []) as string[]
    colors.forEach((color, i) => {
        autofillData[`brand_color_${i + 1}`] = { type: 'color', color }
    })

    const response = await canvaFetch(apiKey, '/autofills', 'POST', {
        brand_template_id: brandTemplateId,
        title: body.title || `${brand.company_name || 'Campaign'} — Post`,
        data: autofillData,
    })

    const job = response.job as Record<string, unknown> | undefined
    return {
        job_id: job?.id,
        status: job?.status, // 'in_progress' or 'completed'
        design_id: (job?.result as Record<string, unknown>)?.design_id,
    }
}

/**
 * Start an async export job for a design
 * @see https://www.canva.dev/docs/connect/api-reference/exports/create-design-export-job/
 */
async function handleExport(
    apiKey: string,
    body: Record<string, unknown>
): Promise<Record<string, unknown>> {
    const designId = body.design_id as string
    if (!designId) throw new Error('design_id is required for export action')

    const format = (body.format || 'png') as string
    const pages = body.pages as number[] | undefined

    // Build format spec based on type
    const formatSpec: Record<string, unknown> = { type: format }

    if (format === 'png' || format === 'jpg') {
        formatSpec.quality = body.quality || 'regular'
        if (body.width) formatSpec.width = body.width
        if (body.height) formatSpec.height = body.height
    }

    const exportBody: Record<string, unknown> = {
        design_id: designId,
        format: formatSpec,
    }
    if (pages) exportBody.pages = pages

    const response = await canvaFetch(apiKey, '/exports', 'POST', exportBody)

    const job = response.job as Record<string, unknown> | undefined
    return {
        export_id: job?.id,
        status: job?.status || 'in_progress',
        urls: (job?.urls as unknown[]) || [],
    }
}

/**
 * Check the status of an export job
 * @see https://www.canva.dev/docs/connect/api-reference/exports/get-design-export-job/
 */
async function handleStatus(
    apiKey: string,
    body: Record<string, unknown>
): Promise<Record<string, unknown>> {
    const exportId = (body.export_id || body.design_id) as string
    if (!exportId) throw new Error('export_id is required for status action')

    const response = await canvaFetch(apiKey, `/exports/${exportId}`, 'GET')

    const job = response.job as Record<string, unknown> | undefined
    return {
        status: job?.status || 'unknown',
        urls: (job?.urls as unknown[]) || [],
    }
}

/**
 * Upload an asset (image) to Canva for use in designs
 * @see https://www.canva.dev/docs/connect/api-reference/assets/create-asset-upload-job/
 */
async function handleUploadAsset(
    apiKey: string,
    body: Record<string, unknown>
): Promise<Record<string, unknown>> {
    const imageUrl = body.image_url as string
    const name = (body.name || 'upload') as string

    if (!imageUrl) throw new Error('image_url is required for upload-asset action')

    // Download image from URL
    const imageResponse = await fetch(imageUrl)
    if (!imageResponse.ok) throw new Error(`Failed to fetch image: ${imageResponse.status}`)
    const imageBlob = await imageResponse.blob()

    // Upload to Canva using multipart form
    const formData = new FormData()
    formData.append('name', name)
    formData.append('name_base64', btoa(name))

    const metadataBlob = new Blob(
        [JSON.stringify({ name_base64: btoa(name) })],
        { type: 'application/json' }
    )
    formData.append('metadata', metadataBlob)
    formData.append('media', imageBlob, `${name}.png`)

    const url = `${CANVA_API_BASE}/asset-uploads`
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}` },
        body: formData,
    })

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(`Canva asset upload ${response.status}: ${(errorData as Record<string, string>)?.message || response.statusText}`)
    }

    const data = await response.json() as Record<string, unknown>
    const job = data.job as Record<string, unknown> | undefined
    return {
        job_id: job?.id,
        status: job?.status,
        asset_id: (job?.asset as Record<string, unknown>)?.id,
    }
}

/**
 * Check status of an autofill job
 * @see https://www.canva.dev/docs/connect/api-reference/autofill/get-design-autofill-job/
 */
async function handleAutofillStatus(
    apiKey: string,
    body: Record<string, unknown>
): Promise<Record<string, unknown>> {
    const jobId = body.job_id as string
    if (!jobId) throw new Error('job_id is required for autofill-status action')

    const response = await canvaFetch(apiKey, `/autofills/${jobId}`, 'GET')

    const job = response.job as Record<string, unknown> | undefined
    return {
        job_id: job?.id,
        status: job?.status,
        design_id: (job?.result as Record<string, unknown>)?.design_id,
    }
}

/**
 * List designs (optionally filtered by folder)
 * @see https://www.canva.dev/docs/connect/api-reference/designs/list-designs/
 */
async function handleListDesigns(
    apiKey: string,
    body: Record<string, unknown>
): Promise<Record<string, unknown>> {
    const params = new URLSearchParams()
    if (body.query) params.set('query', body.query as string)
    if (body.continuation) params.set('continuation', body.continuation as string)
    if (body.ownership) params.set('ownership', body.ownership as string)
    if (body.sort_by) params.set('sort_by', body.sort_by as string)

    const queryStr = params.toString()
    const path = queryStr ? `/designs?${queryStr}` : '/designs'
    const response = await canvaFetch(apiKey, path, 'GET')

    return {
        designs: response.items || [],
        continuation: response.continuation,
    }
}

/**
 * List brand templates
 * @see https://www.canva.dev/docs/connect/api-reference/brand-templates/list-brand-templates/
 */
async function handleListBrandTemplates(
    apiKey: string,
    body: Record<string, unknown>
): Promise<Record<string, unknown>> {
    const params = new URLSearchParams()
    if (body.query) params.set('query', body.query as string)
    if (body.continuation) params.set('continuation', body.continuation as string)

    const queryStr = params.toString()
    const path = queryStr ? `/brand-templates?${queryStr}` : '/brand-templates'
    const response = await canvaFetch(apiKey, path, 'GET')

    return {
        templates: response.items || [],
        continuation: response.continuation,
    }
}

/**
 * Download a Canva export and persist it to Supabase Storage.
 * Returns a permanent Supabase Storage URL instead of the expiring Canva CDN URL.
 */
async function handlePersist(
    apiKey: string,
    body: Record<string, unknown>
): Promise<Record<string, unknown>> {
    const exportUrl = body.export_url as string
    const campaignId = body.campaign_id as string
    const postId = body.post_id as string
    const format = (body.format || 'png') as string

    if (!exportUrl) throw new Error('export_url is required for persist action')
    if (!campaignId || !postId) throw new Error('campaign_id and post_id are required for persist action')

    // Download the exported image from Canva CDN
    const imageResponse = await fetch(exportUrl)
    if (!imageResponse.ok) throw new Error(`Failed to download export: ${imageResponse.status}`)
    const imageBuffer = await imageResponse.arrayBuffer()

    // Upload to Supabase Storage
    const storagePath = `${campaignId}/${postId}.${format}`
    const serviceClient = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data, error } = await serviceClient.storage
        .from('marketing-assets')
        .upload(storagePath, imageBuffer, {
            contentType: `image/${format}`,
            upsert: true,
        })

    if (error) throw new Error(`Storage upload failed: ${error.message}`)

    const { data: urlData } = serviceClient.storage
        .from('marketing-assets')
        .getPublicUrl(storagePath)

    return {
        storage_path: data?.path,
        public_url: urlData?.publicUrl,
    }
}

// ── Canva API Helper ─────────────────────────────────────

async function canvaFetch(
    apiKey: string,
    path: string,
    method: string,
    body?: Record<string, unknown>
): Promise<Record<string, unknown>> {
    const url = `${CANVA_API_BASE}${path}`

    const headers: Record<string, string> = {
        'Authorization': `Bearer ${apiKey}`,
    }

    const options: RequestInit = { method, headers }
    if (body && method !== 'GET') {
        headers['Content-Type'] = 'application/json'
        options.body = JSON.stringify(body)
    }

    const response = await fetch(url, options)

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as Record<string, unknown>
        console.error(`Canva API ${method} ${path} failed:`, response.status, errorData)
        throw new Error(`Canva API ${response.status}: ${errorData?.message || response.statusText}`)
    }

    return await response.json() as Record<string, unknown>
}
