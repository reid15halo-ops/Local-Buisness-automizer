// Supabase Edge Function: Process Call Recording
// Empfaengt Audio + phone, transkribiert via VPS STT, Gemini-Zusammenfassung, speichert in call_summaries
// Deploy: supabase functions deploy process-call-recording
// Env vars: VPS_STT_URL, GEMINI_API_KEY

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const corsHeaders = {
    'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') || 'https://app.freyaivisions.de',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const VPS_STT_URL = Deno.env.get('VPS_STT_URL')
if (!VPS_STT_URL) {
    console.warn('VPS_STT_URL not configured - call recording processing will fail')
}
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') || ''

serve(async (req) => {
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

        // Parse multipart form data
        const formData = await req.formData()
        const audioFile = formData.get('audio') as File | null
        const phone = formData.get('phone') as string || ''
        const kundeId = formData.get('kunde_id') as string || ''
        const kundeName = formData.get('kunde_name') as string || ''
        const direction = formData.get('direction') as string || 'outbound'

        if (!audioFile) {
            return new Response(
                JSON.stringify({ error: 'Audio-Datei erforderlich' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        if (!VPS_STT_URL) {
            return new Response(
                JSON.stringify({ error: 'STT-Service nicht konfiguriert' }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // 1. Transcribe via VPS STT
        const sttForm = new FormData()
        sttForm.append('audio', audioFile)
        sttForm.append('language', 'de')

        const sttResp = await fetch(VPS_STT_URL, {
            method: 'POST',
            body: sttForm,
        })

        if (!sttResp.ok) {
            throw new Error(`STT fehlgeschlagen: ${sttResp.status}`)
        }

        const sttResult = await sttResp.json()
        const transcript = sttResult.text || ''

        if (!transcript) {
            return new Response(
                JSON.stringify({ error: 'Transkription leer' }),
                { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // 2. Gemini-Zusammenfassung
        let summary = transcript.substring(0, 200)
        let keywords: string[] = []

        if (GEMINI_API_KEY) {
            const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${GEMINI_API_KEY}`

            const prompt = `Du bist ein Assistent fuer Gespraechszusammenfassungen.
Analysiere das folgende Transkript eines Telefonats.
${kundeName ? `Gespraechspartner: ${kundeName}` : ''}

Erstelle:
1. Eine kurze Zusammenfassung (2-4 Saetze) der wichtigsten Punkte
2. 3-6 relevante Keywords/Themen

Antworte AUSSCHLIESSLICH im folgenden JSON-Format (kein Markdown, keine Codeblocks):
{"summary": "...", "keywords": ["keyword1", "keyword2", ...]}

Transkript:
${transcript}`

            const geminiResp = await fetch(geminiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 0.3, maxOutputTokens: 300, thinkingConfig: { thinkingBudget: 0 } },
                }),
            })

            if (geminiResp.ok) {
                const geminiResult = await geminiResp.json()
                let text = geminiResult.candidates?.[0]?.content?.parts?.[0]?.text || ''
                text = text.trim()
                if (text.startsWith('```')) {
                    text = text.split('\n').slice(1).join('\n').replace(/```$/, '').trim()
                }
                try {
                    const parsed = JSON.parse(text)
                    summary = parsed.summary || summary
                    keywords = parsed.keywords || []
                } catch {
                    // Gemini output not valid JSON, use transcript excerpt
                }
            }
        }

        // 3. Save to call_summaries
        const serviceClient = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
        )

        const id = `cs-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`
        const { error: insertError } = await serviceClient.from('call_summaries').insert({
            id,
            user_id: user.id,
            kunde_id: kundeId || null,
            kunde_name: kundeName || null,
            phone: phone || null,
            direction,
            transcript,
            summary,
            keywords,
        })

        if (insertError) {
            console.error('call_summaries insert error:', insertError)
        }

        return new Response(
            JSON.stringify({
                id,
                transcript,
                summary,
                keywords,
                saved: !insertError,
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (err) {
        console.error('process-call-recording error:', err)
        return new Response(
            JSON.stringify({ error: err.message || 'Interner Fehler' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
