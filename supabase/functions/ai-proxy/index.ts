// Supabase Edge Function: AI Proxy for Gemini API
// This function proxies requests to Google's Gemini API, keeping the API key server-side
// Deploy: supabase functions deploy ai-proxy
// Env vars: GEMINI_API_KEY

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Simple in-memory rate limiter: max 50 requests per user per hour
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()

function checkRateLimit(userId: string): boolean {
    const now = Date.now()
    const entry = rateLimitMap.get(userId)

    if (!entry || now > entry.resetTime) {
        // Reset or create new entry
        rateLimitMap.set(userId, { count: 1, resetTime: now + 3600000 }) // 1 hour
        return true
    }

    if (entry.count >= 50) {
        return false // Rate limit exceeded
    }

    entry.count++
    return true
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

        // Rate limit check
        if (!checkRateLimit(user.id)) {
            return new Response(
                JSON.stringify({ error: 'Rate limit exceeded: max 50 requests per hour' }),
                { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Get request body
        const body = await req.json()

        // Validate required fields
        if (!body.contents) {
            return new Response(
                JSON.stringify({ error: 'Field "contents" is required' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Get API key from environment
        const geminiApiKey = Deno.env.get('GEMINI_API_KEY')
        if (!geminiApiKey) {
            console.error('GEMINI_API_KEY environment variable not configured')
            return new Response(
                JSON.stringify({ error: 'Server configuration error: GEMINI_API_KEY not set' }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Proxy request to Google's Gemini API
        const geminiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent'
        const geminiResponse = await fetch(`${geminiUrl}?key=${geminiApiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        })

        // Handle Gemini API errors
        if (!geminiResponse.ok) {
            const errorData = await geminiResponse.json().catch(() => ({}))
            console.error('Gemini API error:', geminiResponse.status, errorData)
            return new Response(
                JSON.stringify({ error: 'Gemini API error', status: geminiResponse.status }),
                { status: geminiResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const responseData = await geminiResponse.json()

        // Log to automation_log table for tracking
        await supabase.from('automation_log').insert({
            user_id: user.id,
            action: 'ai.gemini_request',
            target: 'gemini-2.0-flash',
            metadata: { tokens_estimated: body.generationConfig?.maxOutputTokens || 0 },
        }).catch(() => {}) // Don't fail if logging fails

        return new Response(
            JSON.stringify(responseData),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    } catch (err) {
        console.error('AI Proxy error:', err)
        return new Response(
            JSON.stringify({ error: err.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
