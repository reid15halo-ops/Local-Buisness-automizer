// Supabase Edge Function: Process Inbound Email (Resend Webhook)
// Deploy: supabase functions deploy process-inbound-email --no-verify-jwt
// Env vars: RESEND_API_KEY, GEMINI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_WEBHOOK_SECRET

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ============================================
// Types
// ============================================
interface InboundEmail {
    from: {
        name?: string
        email: string
    }
    to: string
    subject: string
    text: string
    html?: string
    attachments?: Array<{
        filename: string
        content: string
        contentType: string
    }>
}

interface CustomerData {
    name: string
    firma?: string
    email: string
    telefon?: string
}

interface AnfrageData {
    leistungsart: string
    beschreibung: string
    budget?: number
    termin?: string
}

interface Position {
    beschreibung: string
    menge: number
    einheit: string
    einzelpreis: number
}

interface GeminiAnalysisResult {
    kunde: CustomerData
    anfrage: AnfrageData
    vollstaendig: boolean
    fehlende_infos: string[]
    rueckfragen: string[]
    positionen: Position[]
    geschaetzteStunden: number
}

// ============================================
// HTML Escape Helper
// ============================================
function escapeHtml(s: string | null | undefined): string {
    if (!s) return ''
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
}

// ============================================
// Main Handler
// ============================================
serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    // C-1: Webhook signature verification via shared secret
    const webhookSecret = Deno.env.get('RESEND_WEBHOOK_SECRET')
    if (webhookSecret) {
        const authHeader = req.headers.get('Authorization')
        if (authHeader !== `Bearer ${webhookSecret}`) {
            return new Response(
                JSON.stringify({ error: 'Unauthorized' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }
    } else {
        console.warn('process-inbound-email: RESEND_WEBHOOK_SECRET is not set - webhook requests are unauthenticated')
    }

    try {
        const email: InboundEmail = await req.json()

        console.log('Inbound email received:', {
            from: email.from.email,
            subject: email.subject
        })

        // Initialize Supabase with service role (no auth required for webhooks)
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        )

        // Store raw email first
        const { data: emailRecord, error: emailError } = await supabase
            .from('inbound_emails')
            .insert({
                from_email: email.from.email,
                from_name: email.from.name,
                subject: email.subject,
                body: email.text,
                html_body: email.html,
                processed: false
            })
            .select()
            .single()

        if (emailError) {
            console.error('Failed to store email:', emailError)
            throw new Error('Database error')
        }

        // Try to process with Gemini
        let analysis: GeminiAnalysisResult | null = null
        try {
            analysis = await analyzeEmailWithGemini(email.text, email.subject)
        } catch (error) {
            console.error('Gemini analysis failed:', error)
            // Continue with fallback
        }

        if (analysis) {
            // Prüfe ob Anfrage vollständig ist
            if (!analysis.vollstaendig && analysis.rueckfragen.length > 0) {
                // Sende Rückfragen
                const result = await sendFollowUpQuestions(
                    email.from.email,
                    email.from.name || analysis.kunde.name,
                    analysis.rueckfragen,
                    analysis.fehlende_infos
                )

                await supabase
                    .from('inbound_emails')
                    .update({
                        processed: true,
                        error: `Incomplete - follow-up sent: ${analysis.fehlende_infos.join(', ')}`
                    })
                    .eq('id', emailRecord.id)

                return new Response(
                    JSON.stringify({
                        success: true,
                        automated: true,
                        follow_up_sent: true,
                        missing_info: analysis.fehlende_infos,
                        message: 'Rückfragen gesendet'
                    }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            } else {
                // Vollständige Anfrage - erstelle Angebot
                const result = await processWithGemini(supabase, email, analysis, emailRecord.id)

                return new Response(
                    JSON.stringify({
                        success: true,
                        automated: true,
                        ...result
                    }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }
        } else {
            // Fallback: Send confirmation only
            await sendSimpleConfirmation(email.from.email, email.from.name || 'Kunde')

            await supabase
                .from('inbound_emails')
                .update({
                    processed: true,
                    error: 'Gemini analysis failed - confirmation sent'
                })
                .eq('id', emailRecord.id)

            return new Response(
                JSON.stringify({
                    success: true,
                    automated: false,
                    message: 'Confirmation sent, manual review required'
                }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }
    } catch (err: any) {
        console.error('Error processing inbound email:', err)
        return new Response(
            JSON.stringify({ error: 'Interner Serverfehler' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})

// ============================================
// Gemini Analysis
// ============================================
async function analyzeEmailWithGemini(emailBody: string, subject: string): Promise<GeminiAnalysisResult> {
    const geminiKey = Deno.env.get('GEMINI_API_KEY')
    if (!geminiKey) {
        throw new Error('GEMINI_API_KEY not configured')
    }

    const prompt = `Analysiere diese Kundenanfrage und prüfe, ob genug Informationen für ein Angebot vorhanden sind:

E-Mail Betreff: ${subject}
E-Mail Text:
${emailBody}

Extrahiere:
1. Kundendaten:
   - Name (Vor- und Nachname wenn möglich)
   - Firma (falls erwähnt)
   - Telefon (falls erwähnt)

2. Anfrage-Details:
   - Leistungsart: metallbau, schweissen, hydraulik, rohrleitungsbau, industriemontage, reparatur, sonstiges
   - Beschreibung: Kurze Zusammenfassung (max. 200 Zeichen)
   - Budget: Falls erwähnt (nur Zahl)
   - Termin: Falls erwähnt (Format: YYYY-MM-DD)

3. Vollständigkeits-Prüfung:
   - Sind ALLE wichtigen Details für ein Angebot vorhanden (Maße, Material, Menge)?
   - Wenn NEIN: Welche Informationen fehlen?
   - Formuliere höfliche Rückfragen

4. Angebots-Positionen (NUR wenn Anfrage vollständig):
   - Liste der Leistungen mit realistischen Preisen
   - Geschätzte Arbeitsstunden

Antworte NUR im JSON-Format (ohne Markdown):

Beispiel 1 - VOLLSTÄNDIG:
{
  "kunde": {"name": "Max Mustermann", "firma": "Beispiel GmbH", "telefon": "+49123456789"},
  "anfrage": {"leistungsart": "metallbau", "beschreibung": "Metalltor 2x2m, feuerverzinkt", "budget": 1500, "termin": "2026-03-15"},
  "vollstaendig": true,
  "fehlende_infos": [],
  "rueckfragen": [],
  "positionen": [
    {"beschreibung": "Metalltor 2x2m, feuerverzinkt", "menge": 1, "einheit": "Stk.", "einzelpreis": 850},
    {"beschreibung": "Montage", "menge": 4, "einheit": "Stunden", "einzelpreis": 65}
  ],
  "geschaetzteStunden": 4
}

Beispiel 2 - UNVOLLSTÄNDIG:
{
  "kunde": {"name": "Max Müller", "firma": null, "telefon": null},
  "anfrage": {"leistungsart": "metallbau", "beschreibung": "Kunde möchte ein Tor", "budget": null, "termin": null},
  "vollstaendig": false,
  "fehlende_infos": ["Maße (Breite und Höhe)", "Material-Wunsch", "Termin"],
  "rueckfragen": [
    "Welche Maße soll das Tor haben (Breite und Höhe)?",
    "Haben Sie einen Wunsch bezüglich des Materials (z.B. Stahl, Aluminium, verzinkt)?",
    "Bis wann benötigen Sie die Ausführung?"
  ],
  "positionen": [],
  "geschaetzteStunden": 0
}`

    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.3,
                    maxOutputTokens: 1000
                }
            })
        }
    )

    if (!response.ok) {
        throw new Error('Gemini API request failed')
    }

    const data = await response.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text

    if (!text) {
        throw new Error('No response from Gemini')
    }

    // Extract JSON from response (remove markdown if present)
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
        throw new Error('Invalid JSON response from Gemini')
    }

    return JSON.parse(jsonMatch[0])
}

// ============================================
// Process with Gemini Results
// ============================================
async function processWithGemini(
    supabase: any,
    email: InboundEmail,
    analysis: GeminiAnalysisResult,
    emailRecordId: string
) {
    // 1. Create or find customer
    const { data: existingCustomer } = await supabase
        .from('kunden')
        .select('id')
        .eq('email', email.from.email)
        .single()

    let kundeId: string

    if (existingCustomer) {
        kundeId = existingCustomer.id
        // Update customer data
        await supabase
            .from('kunden')
            .update({
                name: analysis.kunde.name,
                firma: analysis.kunde.firma,
                telefon: analysis.kunde.telefon
            })
            .eq('id', kundeId)
    } else {
        // M-4: No user_id context available in this webhook handler - records are created without
        // user association. The service role bypasses RLS, but multi-tenancy requires a designated
        // user_id. Configure a default user_id env var or update this logic for proper tenancy.
        console.warn('process-inbound-email: No user_id context - records created without user association')
        const { data: newCustomer } = await supabase
            .from('kunden')
            .insert({
                name: analysis.kunde.name,
                firma: analysis.kunde.firma,
                email: email.from.email,
                telefon: analysis.kunde.telefon,
                quelle: 'email-automation'
            })
            .select()
            .single()

        kundeId = newCustomer.id
    }

    // 2. Create Anfrage
    const anfrageNummer = `ANF-${Date.now()}`
    const { data: anfrage } = await supabase
        .from('anfragen')
        .insert({
            nummer: anfrageNummer,
            kunde_id: kundeId,
            leistungsart: analysis.anfrage.leistungsart,
            beschreibung: analysis.anfrage.beschreibung,
            budget: analysis.anfrage.budget,
            termin: analysis.anfrage.termin,
            status: 'neu',
            quelle: 'email'
        })
        .select()
        .single()

    // 3. Calculate prices and create Angebot
    const stundensatz = 65 // Default hourly rate

    // Calculate totals
    let netto = 0
    const enrichedPositionen = analysis.positionen.map((pos, index) => {
        const gesamt = pos.menge * pos.einzelpreis
        netto += gesamt
        return {
            position: index + 1,
            beschreibung: pos.beschreibung,
            menge: pos.menge,
            einheit: pos.einheit,
            einzelpreis: pos.einzelpreis,
            gesamt: gesamt
        }
    })

    const mwst = netto * 0.19
    const brutto = netto + mwst

    const angebotNummer = `ANG-${Date.now()}`
    const { data: angebot } = await supabase
        .from('angebote')
        .insert({
            nummer: angebotNummer,
            anfrage_id: anfrage.id,
            kunde_id: kundeId,
            positionen: enrichedPositionen,
            netto: netto,
            mwst: mwst,
            brutto: brutto,
            status: 'versendet',
            arbeitszeit: analysis.geschaetzteStunden,
            versanddatum: new Date().toISOString()
        })
        .select()
        .single()

    // 4. Generate PDF (simplified - would need actual PDF library)
    const pdfUrl = await generateAngebotPDF(angebot, analysis, email)

    // 5. Send response email with offer
    await sendAngebotEmail(
        email.from.email,
        analysis.kunde.name,
        angebotNummer,
        pdfUrl,
        enrichedPositionen,
        { netto, mwst, brutto }
    )

    // 6. Update email record
    await supabase
        .from('inbound_emails')
        .update({
            processed: true,
            anfrage_id: anfrage.id,
            angebot_id: angebot.id
        })
        .eq('id', emailRecordId)

    // 7. Log automation
    await supabase.from('automation_log').insert({
        action: 'email.auto_process',
        target: email.from.email,
        metadata: {
            anfrage_nummer: anfrageNummer,
            angebot_nummer: angebotNummer,
            leistungsart: analysis.anfrage.leistungsart
        }
    })

    return {
        kunde_id: kundeId,
        anfrage_id: anfrage.id,
        anfrage_nummer: anfrageNummer,
        angebot_id: angebot.id,
        angebot_nummer: angebotNummer,
        brutto: brutto
    }
}

// ============================================
// PDF Generation (Simplified)
// ============================================
async function generateAngebotPDF(angebot: any, analysis: GeminiAnalysisResult, email: InboundEmail): Promise<string> {
    // In production, this would use a PDF library
    // For now, return a placeholder URL
    // TODO: Implement actual PDF generation with jsPDF or similar

    const pdfContent = {
        type: 'angebot',
        nummer: angebot.nummer,
        datum: new Date().toISOString().split('T')[0],
        kunde: {
            name: analysis.kunde.name,
            firma: analysis.kunde.firma,
            email: email.from.email
        },
        positionen: angebot.positionen,
        summen: {
            netto: angebot.netto,
            mwst: angebot.mwst,
            brutto: angebot.brutto
        }
    }

    // Store PDF data in Supabase Storage or return inline
    // For now, we'll include it in the email as text
    return 'inline' // Placeholder
}

// ============================================
// Email Responses
// ============================================
async function sendAngebotEmail(
    to: string,
    kundenName: string,
    angebotNummer: string,
    pdfUrl: string,
    positionen: any[],
    summen: { netto: number, mwst: number, brutto: number }
) {
    const resendKey = Deno.env.get('RESEND_API_KEY')
    if (!resendKey) throw new Error('RESEND_API_KEY not configured')

    const senderEmail = Deno.env.get('SENDER_EMAIL') || 'angebote@handwerkflow.de'

    const htmlBody = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: #2c3e50; color: white; padding: 20px; text-align: center; }
                .content { padding: 20px; background: #f9f9f9; }
                .positions { margin: 20px 0; }
                .position { background: white; padding: 10px; margin: 5px 0; border-left: 3px solid #3498db; }
                .totals { background: white; padding: 15px; margin-top: 20px; }
                .total-row { display: flex; justify-content: space-between; padding: 5px 0; }
                .total-row.final { font-weight: bold; font-size: 1.2em; border-top: 2px solid #2c3e50; margin-top: 10px; padding-top: 10px; }
                .footer { text-align: center; padding: 20px; color: #7f8c8d; font-size: 0.9em; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>FreyAI Visions</h1>
                    <p>Ihr Angebot ${escapeHtml(angebotNummer)}</p>
                </div>

                <div class="content">
                    <p>Sehr geehrte/r ${escapeHtml(kundenName)},</p>

                    <p>vielen Dank für Ihre Anfrage. Gerne unterbreiten wir Ihnen folgendes Angebot:</p>

                    <div class="positions">
                        <h3>Leistungen</h3>
                        ${positionen.map(pos => `
                            <div class="position">
                                <strong>${escapeHtml(pos.beschreibung)}</strong><br>
                                ${pos.menge} ${pos.einheit} × ${formatCurrency(pos.einzelpreis)} = ${formatCurrency(pos.gesamt)}
                            </div>
                        `).join('')}
                    </div>

                    <div class="totals">
                        <div class="total-row">
                            <span>Netto:</span>
                            <span>${formatCurrency(summen.netto)}</span>
                        </div>
                        <div class="total-row">
                            <span>MwSt. (19%):</span>
                            <span>${formatCurrency(summen.mwst)}</span>
                        </div>
                        <div class="total-row final">
                            <span>Gesamt:</span>
                            <span>${formatCurrency(summen.brutto)}</span>
                        </div>
                    </div>

                    <p><strong>Gültigkeitsdauer:</strong> 30 Tage ab Angebotsdatum</p>
                    <p><strong>Zahlungsbedingungen:</strong> 14 Tage netto nach Erhalt der Rechnung</p>

                    <p>Bei Fragen oder für weitere Informationen stehen wir Ihnen gerne zur Verfügung.</p>

                    <p>Mit freundlichen Grüßen<br>
                    Ihr Team von FreyAI Visions</p>
                </div>

                <div class="footer">
                    <p>
                        FreyAI Visions<br>
                        Tel: +49 (0) xxx xxx xxx | Email: info@freyai-visions.de<br>
                        Zertifiziert nach DIN EN 1090
                    </p>
                </div>
            </div>
        </body>
        </html>
    `

    await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${resendKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            from: `FreyAI Visions Angebote <${senderEmail}>`,
            to: [to],
            subject: `Ihr Angebot ${angebotNummer} - FreyAI Visions`,
            html: htmlBody,
            reply_to: 'info@handwerkflow.de'
        }),
    })
}

// ============================================
// Send Follow-Up Questions
// ============================================
async function sendFollowUpQuestions(
    to: string,
    name: string,
    questions: string[],
    missingInfo: string[]
) {
    const resendKey = Deno.env.get('RESEND_API_KEY')
    if (!resendKey) throw new Error('RESEND_API_KEY not configured')

    const senderEmail = Deno.env.get('SENDER_EMAIL') || 'info@handwerkflow.de'

    const questionsHTML = questions.map((q, i) =>
        `<li style="margin-bottom: 12px;"><strong>${i + 1}.</strong> ${escapeHtml(q)}</li>`
    ).join('')

    const htmlBody = `
        <!DOCTYPE html>
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2>Vielen Dank für Ihre Anfrage!</h2>

                <p>Sehr geehrte/r ${escapeHtml(name)},</p>

                <p>vielen Dank für Ihr Interesse an unseren Leistungen.</p>

                <p>Um Ihnen ein präzises Angebot erstellen zu können, benötigen wir noch einige zusätzliche Informationen:</p>

                <ul style="background: #f8f9fa; padding: 20px; border-left: 4px solid #6366f1; margin: 20px 0;">
                    ${questionsHTML}
                </ul>

                <p>Bitte beantworten Sie diese Fragen einfach per Antwort auf diese E-Mail.
                   Wir erstellen dann umgehend ein detailliertes Angebot für Sie.</p>

                <p>Bei dringenden Fragen erreichen Sie uns auch telefonisch.</p>

                <p>Mit freundlichen Grüßen<br>
                Ihr Team von FreyAI Visions</p>

                <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">

                <p style="font-size: 0.9em; color: #7f8c8d;">
                    FreyAI Visions<br>
                    Tel: +49 (0) xxx xxx xxx | Email: info@freyai-visions.de
                </p>
            </div>
        </body>
        </html>
    `

    await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${resendKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            from: `FreyAI Visions Info <${senderEmail}>`,
            to: [to],
            subject: 'Rückfrage zu Ihrer Anfrage',
            html: htmlBody
        })
    })

    return { follow_up_sent: true, questions_count: questions.length }
}

// ============================================
// Send Simple Confirmation
// ============================================
async function sendSimpleConfirmation(to: string, name: string) {
    const resendKey = Deno.env.get('RESEND_API_KEY')
    if (!resendKey) throw new Error('RESEND_API_KEY not configured')

    const senderEmail = Deno.env.get('SENDER_EMAIL') || 'info@handwerkflow.de'

    const htmlBody = `
        <!DOCTYPE html>
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2>Vielen Dank für Ihre Anfrage!</h2>

                <p>Sehr geehrte/r ${escapeHtml(name)},</p>

                <p>wir haben Ihre Anfrage erhalten und werden diese schnellstmöglich bearbeiten.</p>

                <p>Ein Mitarbeiter wird sich in Kürze bei Ihnen melden.</p>

                <p>Mit freundlichen Grüßen<br>
                Ihr Team von FreyAI Visions</p>

                <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">

                <p style="font-size: 0.9em; color: #7f8c8d;">
                    FreyAI Visions<br>
                    Tel: +49 (0) xxx xxx xxx | Email: info@freyai-visions.de
                </p>
            </div>
        </body>
        </html>
    `

    await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${resendKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            from: `FreyAI Visions Info <${senderEmail}>`,
            to: [to],
            subject: 'Ihre Anfrage bei FreyAI Visions',
            html: htmlBody
        }),
    })
}

// ============================================
// Utilities
// ============================================
function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('de-DE', {
        style: 'currency',
        currency: 'EUR'
    }).format(amount)
}
