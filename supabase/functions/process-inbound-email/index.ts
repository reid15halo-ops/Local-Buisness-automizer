// Supabase Edge Function: Process Inbound Email (Resend Webhook)
// Deploy: supabase functions deploy process-inbound-email --no-verify-jwt
// Env vars: RESEND_API_KEY, GEMINI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
// Main Handler
// ============================================
serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    // Webhook shared-secret authentication.
    // The function is deployed with --no-verify-jwt because the external email
    // service (Resend) cannot supply a Supabase JWT. The shared secret takes its
    // place and prevents arbitrary callers from triggering business logic.
    const webhookSecret = Deno.env.get('WEBHOOK_SECRET')
    const providedSecret = req.headers.get('x-webhook-secret')

    if (!webhookSecret || providedSecret !== webhookSecret) {
        return new Response(
            JSON.stringify({ error: 'Unauthorized' }),
            { status: 401, headers: { 'Content-Type': 'application/json' } }
        )
    }

    try {
        const email: InboundEmail = await req.json()

        // Validate sender email format before any processing.
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!email.from?.email || !emailRegex.test(email.from.email)) {
            return new Response(
                JSON.stringify({ error: 'Invalid sender' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            )
        }

        console.log('📧 Inbound email received:', {
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
            JSON.stringify({ error: err.message }),
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

    // 5. Send response email with offer (pdfUrl contains base64 PDF data)
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
// PDF Generation
// ============================================

/**
 * Encodes a string to Latin-1 bytes (PDF standard encoding).
 * Characters outside Latin-1 range are replaced with '?'.
 */
function toBytes(str: string): Uint8Array {
    const bytes = new Uint8Array(str.length)
    for (let i = 0; i < str.length; i++) {
        const code = str.charCodeAt(i)
        bytes[i] = code < 256 ? code : 63 // '?' for out-of-range
    }
    return bytes
}

/**
 * Escapes a string for use inside a PDF text string literal (parentheses notation).
 * Also replaces common German umlauts with ASCII equivalents for Latin-1 safety.
 */
function pdfEscape(str: string): string {
    return str
        .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue')
        .replace(/Ä/g, 'Ae').replace(/Ö/g, 'Oe').replace(/Ü/g, 'Ue')
        .replace(/ß/g, 'ss')
        .replace(/\\/g, '\\\\')
        .replace(/\(/g, '\\(')
        .replace(/\)/g, '\\)')
        .replace(/\r/g, '\\r')
        .replace(/\n/g, '\\n')
}

/**
 * Truncates a string to a max byte length for PDF lines.
 */
function truncate(str: string, max = 80): string {
    return str.length > max ? str.substring(0, max - 3) + '...' : str
}

/**
 * Builds a minimal but valid PDF binary and returns it as a Uint8Array.
 * Uses only Helvetica (a standard PDF font, no embedding needed).
 */
function buildAngebotPDF(
    angebotNummer: string,
    datum: string,
    kunde: { name: string; firma?: string | null; email: string },
    positionen: Array<{ beschreibung: string; menge: number; einheit: string; einzelpreis: number; gesamt: number }>,
    summen: { netto: number; mwst: number; brutto: number }
): Uint8Array {
    const fmt = (n: number) =>
        new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) + ' EUR'

    // Build page content stream
    const lines: string[] = []

    // -- Header bar (filled rectangle) --
    lines.push('0.173 0.239 0.314 rg') // dark blue #2c3e50
    lines.push('0 792 595 -60 re f')   // rect across top (A4 width=595, height=842)

    // -- Company name in header --
    lines.push('1 1 1 rg')             // white text
    lines.push('BT')
    lines.push('/F1 22 Tf')
    lines.push('40 790 Td')
    lines.push(`(FreyAI Visions) Tj`)
    lines.push('ET')

    lines.push('BT')
    lines.push('/F2 10 Tf')
    lines.push('350 790 Td')
    lines.push(`(Angebot ${pdfEscape(angebotNummer)}) Tj`)
    lines.push('ET')

    // -- Reset to black for body --
    lines.push('0 0 0 rg')

    // -- Offer title --
    lines.push('BT')
    lines.push('/F1 16 Tf')
    lines.push('40 720 Td')
    lines.push(`(Angebot) Tj`)
    lines.push('ET')

    // Horizontal rule under title
    lines.push('0.2 0.467 0.741 rg')   // blue #3498db
    lines.push('40 712 515 -2 re f')
    lines.push('0 0 0 rg')

    // -- Document meta --
    let y = 695
    const lineH = 16
    const drawText = (x: number, yPos: number, font: string, size: number, text: string) => {
        lines.push('BT')
        lines.push(`/${font} ${size} Tf`)
        lines.push(`${x} ${yPos} Td`)
        lines.push(`(${pdfEscape(truncate(text))}) Tj`)
        lines.push('ET')
    }

    drawText(40, y, 'F1', 10, `Angebotsnummer: ${angebotNummer}`)
    drawText(320, y, 'F2', 10, `Datum: ${datum}`)
    y -= lineH

    drawText(40, y, 'F1', 10, `Angebotsdatum: ${datum}`)
    drawText(320, y, 'F2', 10, 'Gueltig: 30 Tage')
    y -= lineH * 2

    // -- Customer section --
    lines.push('0.961 0.961 0.961 rg') // light gray background
    lines.push(`40 ${y + 4} 515 -${lineH * 4 + 8} re f`)
    lines.push('0 0 0 rg')

    drawText(48, y, 'F1', 11, 'Kunde')
    y -= lineH

    drawText(48, y, 'F2', 10, `Name: ${kunde.name}`)
    y -= lineH

    if (kunde.firma) {
        drawText(48, y, 'F2', 10, `Firma: ${kunde.firma}`)
        y -= lineH
    }

    drawText(48, y, 'F2', 10, `E-Mail: ${kunde.email}`)
    y -= lineH * 2

    // -- Positions table header --
    lines.push('0.173 0.239 0.314 rg') // dark header
    lines.push(`40 ${y + 4} 515 -${lineH + 4} re f`)
    lines.push('1 1 1 rg')             // white text for header

    lines.push('BT')
    lines.push('/F1 9 Tf')
    lines.push(`48 ${y} Td`)
    lines.push('(Pos.) Tj')
    lines.push('ET')

    lines.push('BT')
    lines.push('/F1 9 Tf')
    lines.push(`75 ${y} Td`)
    lines.push('(Beschreibung) Tj')
    lines.push('ET')

    lines.push('BT')
    lines.push('/F1 9 Tf')
    lines.push(`340 ${y} Td`)
    lines.push('(Menge) Tj')
    lines.push('ET')

    lines.push('BT')
    lines.push('/F1 9 Tf')
    lines.push(`395 ${y} Td`)
    lines.push('(Einzelpreis) Tj')
    lines.push('ET')

    lines.push('BT')
    lines.push('/F1 9 Tf')
    lines.push(`480 ${y} Td`)
    lines.push('(Gesamt) Tj')
    lines.push('ET')

    lines.push('0 0 0 rg') // reset to black
    y -= lineH

    // -- Position rows --
    for (let i = 0; i < positionen.length; i++) {
        const pos = positionen[i]
        // Alternating row background
        if (i % 2 === 0) {
            lines.push('0.973 0.973 0.973 rg')
            lines.push(`40 ${y + 4} 515 -${lineH + 2} re f`)
            lines.push('0 0 0 rg')
        }

        drawText(48, y, 'F2', 9, `${i + 1}.`)
        drawText(75, y, 'F2', 9, truncate(pos.beschreibung, 55))
        drawText(340, y, 'F2', 9, `${pos.menge} ${pos.einheit}`)
        drawText(395, y, 'F2', 9, fmt(pos.einzelpreis))
        drawText(480, y, 'F2', 9, fmt(pos.gesamt))
        y -= lineH + 2

        // Safety: stop if we're near bottom of page
        if (y < 160) break
    }

    y -= 8

    // Separator line
    lines.push('0.7 0.7 0.7 rg')
    lines.push(`40 ${y + 4} 515 -1 re f`)
    lines.push('0 0 0 rg')
    y -= 10

    // -- Totals --
    const totalsX = 380

    drawText(totalsX, y, 'F2', 10, 'Nettobetrag:')
    drawText(480, y, 'F2', 10, fmt(summen.netto))
    y -= lineH

    drawText(totalsX, y, 'F2', 10, 'MwSt. (19%):')
    drawText(480, y, 'F2', 10, fmt(summen.mwst))
    y -= 4

    // Bold total line
    lines.push('0.173 0.239 0.314 rg')
    lines.push(`${totalsX - 5} ${y} 170 -${lineH + 6} re f`)
    lines.push('1 1 1 rg')

    lines.push('BT')
    lines.push('/F1 11 Tf')
    lines.push(`${totalsX} ${y - 2} Td`)
    lines.push(`(Gesamtbetrag (brutto):) Tj`)
    lines.push('ET')

    lines.push('BT')
    lines.push('/F1 11 Tf')
    lines.push(`480 ${y - 2} Td`)
    lines.push(`(${pdfEscape(fmt(summen.brutto))}) Tj`)
    lines.push('ET')

    lines.push('0 0 0 rg')
    y -= lineH + 16

    // -- Payment terms --
    drawText(40, y, 'F2', 9, 'Zahlungsbedingungen: 14 Tage netto nach Erhalt der Rechnung')
    y -= lineH
    drawText(40, y, 'F2', 9, 'Gueltigkeitsdauer: 30 Tage ab Angebotsdatum')
    y -= lineH * 2

    // -- Footer --
    lines.push('0.173 0.239 0.314 rg')
    lines.push('40 60 515 -1 re f')
    lines.push('0.5 0.5 0.5 rg')

    drawText(40, 45, 'F2', 8, 'FreyAI Visions | Tel: +49 (0) xxx xxx xxx | E-Mail: info@freyai-visions.de')
    drawText(40, 33, 'F2', 8, 'Zertifiziert nach DIN EN 1090 | Alle Preise zzgl. der gesetzlichen MwSt.')

    lines.push('0 0 0 rg')

    const streamContent = lines.join('\n')
    const streamBytes = toBytes(streamContent)

    // PDF object structure:
    // 1: Catalog
    // 2: Pages
    // 3: Page
    // 4: Font F1 (Helvetica-Bold)
    // 5: Font F2 (Helvetica)
    // 6: Content stream

    const header = '%PDF-1.4\n'
    currentOffset = toBytes(header).length

    // We need to build objects in order. Let's collect them:
    const rawObjects: { id: number; content: string }[] = [
        {
            id: 1,
            content: `<< /Type /Catalog /Pages 2 0 R >>`
        },
        {
            id: 2,
            content: `<< /Type /Pages /Kids [3 0 R] /Count 1 >>`
        },
        {
            id: 4,
            content: `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>`
        },
        {
            id: 5,
            content: `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>`
        },
        {
            id: 6,
            content: `<< /Length ${streamBytes.length} >>\nstream\n${streamContent}\nendstream`
        },
        {
            id: 3,
            content: `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 6 0 R /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> >>`
        },
    ]

    // Sort by object id for xref table
    rawObjects.sort((a, b) => a.id - b.id)

    // Build xref offsets
    const xrefOffsets: number[] = [0] // object 0 is free
    let offset = toBytes(header).length

    const objectStrings: string[] = []
    for (const obj of rawObjects) {
        xrefOffsets[obj.id] = offset
        const str = `${obj.id} 0 obj\n${obj.content}\nendobj\n`
        objectStrings.push(str)
        offset += toBytes(str).length
    }

    // xref table
    const maxObj = Math.max(...rawObjects.map(o => o.id))
    let xref = `xref\n0 ${maxObj + 1}\n`
    xref += '0000000000 65535 f \n'
    for (let i = 1; i <= maxObj; i++) {
        const off = xrefOffsets[i] ?? 0
        const isFree = !xrefOffsets[i]
        xref += `${String(off).padStart(10, '0')} 00000 ${isFree ? 'f' : 'n'} \n`
    }

    const trailer = `trailer\n<< /Size ${maxObj + 1} /Root 1 0 R >>\nstartxref\n${offset}\n%%EOF\n`

    // Assemble final PDF
    const parts: Uint8Array[] = [
        toBytes(header),
        ...objectStrings.map(s => toBytes(s)),
        toBytes(xref),
        toBytes(trailer),
    ]

    const totalLength = parts.reduce((sum, p) => sum + p.length, 0)
    const result = new Uint8Array(totalLength)
    let pos = 0
    for (const part of parts) {
        result.set(part, pos)
        pos += part.length
    }

    return result
}

/**
 * Converts a Uint8Array to a base64 string (Deno-compatible).
 */
function uint8ArrayToBase64(bytes: Uint8Array): string {
    let binary = ''
    const chunkSize = 8192
    for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, i + chunkSize)
        binary += String.fromCharCode(...chunk)
    }
    return btoa(binary)
}

async function generateAngebotPDF(angebot: any, analysis: GeminiAnalysisResult, email: InboundEmail): Promise<string> {
    const datum = new Date().toISOString().split('T')[0]

    const pdfBytes = buildAngebotPDF(
        angebot.nummer,
        datum,
        {
            name: analysis.kunde.name,
            firma: analysis.kunde.firma,
            email: email.from.email,
        },
        angebot.positionen,
        {
            netto: angebot.netto,
            mwst: angebot.mwst,
            brutto: angebot.brutto,
        }
    )

    const base64 = uint8ArrayToBase64(pdfBytes)
    console.log(`PDF generated for ${angebot.nummer}: ${pdfBytes.length} bytes`)

    return base64
}

// ============================================
// Email Responses
// ============================================
async function sendAngebotEmail(
    to: string,
    kundenName: string,
    angebotNummer: string,
    pdfBase64: string,
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
                    <p>Ihr Angebot ${angebotNummer}</p>
                </div>

                <div class="content">
                    <p>Sehr geehrte/r ${kundenName},</p>

                    <p>vielen Dank für Ihre Anfrage. Gerne unterbreiten wir Ihnen folgendes Angebot:</p>

                    <div class="positions">
                        <h3>Leistungen</h3>
                        ${positionen.map(pos => `
                            <div class="position">
                                <strong>${pos.beschreibung}</strong><br>
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

    // Build attachments array: include PDF if available
    const attachments = pdfBase64 && pdfBase64 !== 'inline'
        ? [
            {
                filename: `Angebot-${angebotNummer}.pdf`,
                content: pdfBase64,
                content_type: 'application/pdf',
            }
          ]
        : []

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
            reply_to: 'info@handwerkflow.de',
            ...(attachments.length > 0 && { attachments }),
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
        `<li style="margin-bottom: 12px;"><strong>${i + 1}.</strong> ${q}</li>`
    ).join('')

    const htmlBody = `
        <!DOCTYPE html>
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2>Vielen Dank für Ihre Anfrage!</h2>

                <p>Sehr geehrte/r ${name},</p>

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

                <p>Sehr geehrte/r ${name},</p>

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
