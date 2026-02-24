// Supabase Edge Function: Process Inbound Email (Resend Webhook)
// Deploy: supabase functions deploy process-inbound-email --no-verify-jwt
// Env vars: RESEND_API_KEY, GEMINI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_WEBHOOK_SECRET

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { PDFDocument, rgb, StandardFonts } from 'https://esm.sh/pdf-lib@1.17.1'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ============================================
// Configurable business defaults (override via env vars or admin_settings)
// ============================================
// Tax rate: set DEFAULT_TAX_RATE env var to override (e.g. 0.07 for reduced rate)
const DEFAULT_TAX_RATE = parseFloat(Deno.env.get('DEFAULT_TAX_RATE') ?? '0.19')

// Hourly rate fallback: admin_settings.stundensatz > env var > 65 EUR
const DEFAULT_STUNDENSATZ = parseFloat(Deno.env.get('DEFAULT_STUNDENSATZ') ?? '65')

// Sender addresses: configure per-deployment via env vars
const SENDER_EMAIL = Deno.env.get('SENDER_EMAIL') ?? 'angebote@handwerkflow.de'
const REPLY_TO_EMAIL = Deno.env.get('REPLY_TO_EMAIL') ?? 'info@handwerkflow.de'

// Company phone shown in email footers (leave empty to omit)
const COMPANY_PHONE = Deno.env.get('COMPANY_PHONE') ?? ''

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
// Rate Limiter (in-memory, resets on cold start)
// ============================================

// Simple in-memory rate limiter (resets on function cold start)
const rateLimitMap = new Map<string, { count: number; windowStart: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 20; // max 20 emails per sender per minute

function checkRateLimit(senderEmail: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(senderEmail);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(senderEmail, { count: 1, windowStart: now });
    return true; // allowed
  }
  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false; // rate limited
  }
  entry.count++;
  return true; // allowed
}

// ============================================
// Main Handler
// ============================================
serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    // C-1: Webhook signature verification via shared secret
    // C-1: Webhook signature verification via shared secret
    // Hard-fail if RESEND_WEBHOOK_SECRET is not configured — unauthenticated requests are never allowed.
    const webhookSecret = Deno.env.get('RESEND_WEBHOOK_SECRET')
    if (!webhookSecret) {
        console.error('process-inbound-email: RESEND_WEBHOOK_SECRET is not set - rejecting all requests')
        return new Response(
            JSON.stringify({ error: 'Server misconfiguration: webhook secret not configured' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
    const authHeader = req.headers.get('Authorization')
    if (authHeader !== `Bearer ${webhookSecret}`) {
        return new Response(
            JSON.stringify({ error: 'Unauthorized' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

    try {
        const email: InboundEmail = await req.json()

        // Extract fields for validation
        const fromEmail: string = email.from?.email ?? ''
        let subject: string = email.subject ?? ''
        let body: string = email.text ?? ''

        // Validate inbound email fields
        const MAX_SUBJECT_LENGTH = 500;
        const MAX_BODY_LENGTH = 50000;
        const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!fromEmail || !EMAIL_REGEX.test(fromEmail)) {
          console.warn('[webhook] Invalid or missing from email:', fromEmail);
          return new Response(JSON.stringify({ error: 'Invalid sender email' }), { status: 400 });
        }
        if (subject && subject.length > MAX_SUBJECT_LENGTH) {
          console.warn('[webhook] Subject too long, truncating');
          subject = subject.slice(0, MAX_SUBJECT_LENGTH);
        }
        if (body && body.length > MAX_BODY_LENGTH) {
          console.warn('[webhook] Body too long, truncating to', MAX_BODY_LENGTH, 'chars');
          body = body.slice(0, MAX_BODY_LENGTH);
        }

        // Rate limit check (after email is validated)
        if (!checkRateLimit(fromEmail)) {
          console.warn('[webhook] Rate limit exceeded for sender:', fromEmail);
          return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), { status: 429 });
        }

        console.log('Inbound email received:', {
            from: fromEmail,
            subject: subject
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

    return extractJsonFromGeminiResponse(text)
}

function extractJsonFromGeminiResponse(text: string): unknown {
  // Try to find JSON block wrapped in ```json ... ``` or ``` ... ```
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    try { return JSON.parse(codeBlockMatch[1].trim()); } catch {}
  }
  // Try to find raw JSON object or array
  const jsonMatch = text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  if (jsonMatch) {
    try { return JSON.parse(jsonMatch[1]); } catch {}
  }
  // Try parsing the entire text as JSON
  try { return JSON.parse(text.trim()); } catch {}

  console.error('[extractJson] Failed to extract JSON from Gemini response, first 200 chars:', text.slice(0, 200));
  throw new Error('Could not extract valid JSON from Gemini response');
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
    // M-4: Resolve user_id from recipient email for multi-tenancy
    const toEmail = email.to
    let resolvedUserId: string | null = null;
    if (toEmail) {
      const { data: userMapping } = await supabase
        .from('email_routing')
        .select('user_id')
        .eq('email', toEmail)
        .single();
      resolvedUserId = userMapping?.user_id ?? null;
      if (!resolvedUserId) {
        console.warn('[processWithGemini] No user_id found for recipient:', toEmail);
      }
    }

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
                quelle: 'email-automation',
                ...(resolvedUserId ? { user_id: resolvedUserId } : {})
            })
            .select()
            .single()

        kundeId = newCustomer.id
    }

    // 2. Create Anfrage
    const anfrageNummer = `ANF-${Date.now()}`
    const { data: anfrage, error: anfrageError } = await supabase
        .from('anfragen')
        .insert({
            nummer: anfrageNummer,
            kunde_id: kundeId,
            leistungsart: analysis.anfrage.leistungsart,
            beschreibung: analysis.anfrage.beschreibung,
            budget: analysis.anfrage.budget,
            termin: analysis.anfrage.termin,
            status: 'neu',
            quelle: 'email',
            ...(resolvedUserId ? { user_id: resolvedUserId } : {})
        })
        .select()
        .single()
    if (anfrageError || !anfrage) {
        console.error('[processWithGemini] Failed to insert anfrage:', anfrageError)
        throw new Error('Failed to create anfrage record')
    }

    // 3. Fetch admin settings (for configurable business values)
    // Falls back to env var DEFAULT_STUNDENSATZ, then hardcoded 65 as last resort
    const { data: adminSettings } = await supabase
        .from('admin_settings')
        .select('stundensatz, payment_days')
        .single()

    // 4. Calculate prices and create Angebot
    // Priority: admin_settings.stundensatz > DEFAULT_STUNDENSATZ env var > 65
    const stundensatz = adminSettings?.stundensatz ?? DEFAULT_STUNDENSATZ

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

    const mwst = netto * DEFAULT_TAX_RATE
    const brutto = netto + mwst

    const angebotNummer = `ANG-${Date.now()}`
    const { data: angebot, error: angebotError } = await supabase
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
            versanddatum: new Date().toISOString(),
            ...(resolvedUserId ? { user_id: resolvedUserId } : {})
        })
        .select()
        .single()
    if (angebotError || !angebot) {
        console.error('[processWithGemini] Failed to insert angebot:', angebotError)
        throw new Error('Failed to create angebot record')
    }

    // 4. Generate PDF and upload to Supabase Storage
    const { url: pdfUrl, bytes: pdfBytes } = await generateAngebotPDF(supabase, angebot, analysis, email)

    // 5. Send response email with offer (PDF attached)
    await sendAngebotEmail(
        email.from.email,
        analysis.kunde.name,
        angebotNummer,
        pdfUrl,
        enrichedPositionen,
        { netto, mwst, brutto },
        pdfBytes
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
// PDF Generation
// ============================================
async function generateAngebotPDF(
    supabase: any,
    angebot: any,
    analysis: GeminiAnalysisResult,
    email: InboundEmail
): Promise<{ url: string, bytes: Uint8Array }> {
    const pdfDoc = await PDFDocument.create()
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)

    const pageWidth = 595.28  // A4
    const pageHeight = 841.89
    const margin = 50
    const darkBlue = rgb(0.17, 0.24, 0.31)
    const accentBlue = rgb(0.20, 0.60, 0.86)
    const grey = rgb(0.5, 0.5, 0.5)

    let currentPage = pdfDoc.addPage([pageWidth, pageHeight])
    let y = pageHeight - margin

    const addPageIfNeeded = () => {
        if (y < 120) {
            currentPage = pdfDoc.addPage([pageWidth, pageHeight])
            y = pageHeight - margin
        }
    }

    // Header bar
    currentPage.drawRectangle({ x: 0, y: pageHeight - 80, width: pageWidth, height: 80, color: darkBlue })
    currentPage.drawText('FreyAI Visions', { x: margin, y: pageHeight - 48, size: 20, font: fontBold, color: rgb(1, 1, 1) })
    currentPage.drawText(`Angebot ${angebot.nummer}`, { x: margin, y: pageHeight - 68, size: 11, font: fontRegular, color: rgb(0.8, 0.8, 0.8) })

    y = pageHeight - 105

    // Date + number (top right)
    const datum = new Date().toLocaleDateString('de-DE')
    currentPage.drawText(`Datum: ${datum}`, { x: pageWidth - margin - 130, y: y, size: 10, font: fontRegular, color: darkBlue })
    currentPage.drawText(`Angebot-Nr.: ${angebot.nummer}`, { x: pageWidth - margin - 130, y: y - 14, size: 10, font: fontRegular, color: darkBlue })

    // Customer block
    currentPage.drawText('An:', { x: margin, y, size: 10, font: fontBold, color: darkBlue })
    const addressLines = [analysis.kunde.name, analysis.kunde.firma, email.from.email].filter(Boolean) as string[]
    addressLines.forEach((line, i) => {
        currentPage.drawText(line, { x: margin + 30, y: y - i * 14, size: 10, font: fontRegular, color: darkBlue })
    })
    y -= addressLines.length * 14 + 25

    // Section divider
    currentPage.drawText('Leistungsübersicht', { x: margin, y, size: 13, font: fontBold, color: darkBlue })
    y -= 8
    currentPage.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 1, color: accentBlue })
    y -= 18

    // Column headers
    const col = { pos: margin, desc: margin + 35, qty: 330, unit: 370, price: 415, total: 490 }
    ;[
        { x: col.pos, text: 'Pos.' },
        { x: col.desc, text: 'Beschreibung' },
        { x: col.qty, text: 'Menge' },
        { x: col.unit, text: 'Einh.' },
        { x: col.price, text: 'Einzelpr.' },
        { x: col.total, text: 'Gesamt' },
    ].forEach(({ x, text }) => {
        currentPage.drawText(text, { x, y, size: 9, font: fontBold, color: darkBlue })
    })
    y -= 12

    // Positions
    const positionen: any[] = angebot.positionen || []
    for (const pos of positionen) {
        addPageIfNeeded()

        const desc = String(pos.beschreibung || '')
        const line1 = desc.substring(0, 52)
        const line2 = desc.length > 52 ? desc.substring(52, 104) : ''
        const rowHeight = line2 ? 24 : 14

        currentPage.drawText(String(pos.position ?? ''), { x: col.pos, y, size: 9, font: fontRegular, color: darkBlue })
        currentPage.drawText(line1, { x: col.desc, y, size: 9, font: fontRegular, color: darkBlue })
        if (line2) currentPage.drawText(line2, { x: col.desc, y: y - 11, size: 9, font: fontRegular, color: darkBlue })
        currentPage.drawText(String(pos.menge ?? ''), { x: col.qty, y, size: 9, font: fontRegular, color: darkBlue })
        currentPage.drawText(String(pos.einheit || ''), { x: col.unit, y, size: 9, font: fontRegular, color: darkBlue })
        currentPage.drawText(pdfCurrency(pos.einzelpreis), { x: col.price, y, size: 9, font: fontRegular, color: darkBlue })
        currentPage.drawText(pdfCurrency(pos.gesamt), { x: col.total, y, size: 9, font: fontRegular, color: darkBlue })
        y -= rowHeight
    }

    // Totals
    y -= 8
    currentPage.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 0.5, color: grey })
    y -= 16

    currentPage.drawText('Netto:', { x: col.price, y, size: 10, font: fontRegular, color: darkBlue })
    currentPage.drawText(pdfCurrency(angebot.netto), { x: col.total, y, size: 10, font: fontRegular, color: darkBlue })
    y -= 14

    currentPage.drawText('MwSt. (19%):', { x: col.price, y, size: 10, font: fontRegular, color: darkBlue })
    currentPage.drawText(pdfCurrency(angebot.mwst), { x: col.total, y, size: 10, font: fontRegular, color: darkBlue })
    y -= 6

    currentPage.drawLine({ start: { x: col.price - 5, y }, end: { x: pageWidth - margin, y }, thickness: 1, color: darkBlue })
    y -= 16

    currentPage.drawText('Gesamtbetrag:', { x: col.price, y, size: 11, font: fontBold, color: darkBlue })
    currentPage.drawText(pdfCurrency(angebot.brutto), { x: col.total, y, size: 11, font: fontBold, color: darkBlue })
    y -= 30

    // Terms
    // Payment terms read from admin_settings, fallback to DEFAULT_PAYMENT_DAYS env var, then 30
    const validityDays = adminSettings?.payment_days ?? Deno.env.get('DEFAULT_PAYMENT_DAYS') ?? '30'
    const paymentTerms = adminSettings?.payment_days ?? Deno.env.get('DEFAULT_PAYMENT_DAYS') ?? '14'
    currentPage.drawText(`Gültigkeitsdauer: ${validityDays} Tage ab Angebotsdatum`, { x: margin, y, size: 9, font: fontRegular, color: grey })
    y -= 13
    currentPage.drawText(`Zahlungsbedingungen: ${paymentTerms} Tage netto nach Erhalt der Rechnung`, { x: margin, y, size: 9, font: fontRegular, color: grey })

    // Footer
    currentPage.drawLine({ start: { x: margin, y: 60 }, end: { x: pageWidth - margin, y: 60 }, thickness: 0.5, color: grey })
    currentPage.drawText('FreyAI Visions  |  info@freyai-visions.de', { x: margin, y: 44, size: 8, font: fontRegular, color: grey })

    const bytes = await pdfDoc.save()

    // Upload to Supabase Storage
    const fileName = `${angebot.nummer}.pdf`
    const { data: uploadData, error: uploadError } = await supabase.storage
        .from('angebote')
        .upload(fileName, bytes, { contentType: 'application/pdf', upsert: true })

    if (uploadError) {
        console.error('[uploadPDF] Storage upload failed:', uploadError)
        throw new Error(`PDF upload failed: ${uploadError.message}`)
    }

    const { data: { publicUrl } } = supabase.storage.from('angebote').getPublicUrl(fileName)
    return { url: publicUrl, bytes }
}

function pdfCurrency(amount: number): string {
    if (amount == null || isNaN(amount)) return '0,00 €'
    return `${amount.toFixed(2).replace('.', ',')} €`
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
    summen: { netto: number, mwst: number, brutto: number },
    pdfBytes?: Uint8Array
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

                    <p><strong>Gültigkeitsdauer:</strong> ${adminSettings?.payment_days ?? Deno.env.get('DEFAULT_PAYMENT_DAYS') ?? '30'} Tage ab Angebotsdatum</p>
                    <p><strong>Zahlungsbedingungen:</strong> ${adminSettings?.payment_days ?? Deno.env.get('DEFAULT_PAYMENT_DAYS') ?? '14'} Tage netto nach Erhalt der Rechnung</p>

                    ${pdfUrl && pdfUrl !== 'inline' ? `<p><a href="${escapeHtml(pdfUrl)}" style="display:inline-block;background:#2c3e50;color:white;padding:10px 20px;text-decoration:none;border-radius:4px;">📄 Angebot als PDF herunterladen</a></p>` : ''}

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

    let pdfBase64: string | undefined
    if (pdfBytes) {
        let binary = ''
        pdfBytes.forEach(b => binary += String.fromCharCode(b))
        pdfBase64 = btoa(binary)
    }

    const resendResponse = await fetch('https://api.resend.com/emails', {
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
            reply_to: 'info@handwerkflow.de',
            ...(pdfBase64 && {
                attachments: [{
                    filename: `${angebotNummer}.pdf`,
                    content: pdfBase64
                }]
            })
        }),
    })
    const resendResult = await resendResponse.json().catch(() => ({}))
    if (!resendResponse.ok || resendResult.error) {
        console.error('[sendAngebotEmail] Resend API error:', resendResult.error)
        throw new Error(`Email delivery failed: ${resendResult.error?.message ?? resendResponse.statusText}`)
    }
    console.log('[sendAngebotEmail] Email sent successfully, id:', resendResult.id)
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

    const resendResponse = await fetch('https://api.resend.com/emails', {
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
    const resendResult = await resendResponse.json().catch(() => ({}))
    if (!resendResponse.ok || resendResult.error) {
        console.error('[sendFollowUpQuestions] Resend API error:', resendResult.error)
        throw new Error(`Email delivery failed: ${resendResult.error?.message ?? resendResponse.statusText}`)
    }
    console.log('[sendFollowUpQuestions] Email sent successfully, id:', resendResult.id)

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

    const resendResponse = await fetch('https://api.resend.com/emails', {
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
    const resendResult = await resendResponse.json().catch(() => ({}))
    if (!resendResponse.ok || resendResult.error) {
        console.error('[sendSimpleConfirmation] Resend API error:', resendResult.error)
        throw new Error(`Email delivery failed: ${resendResult.error?.message ?? resendResponse.statusText}`)
    }
    console.log('[sendSimpleConfirmation] Email sent successfully, id:', resendResult.id)
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
