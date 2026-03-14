#!/usr/bin/env python3
"""
Fix the process-inbound-email Edge Function:
1. Replace Gemini prompt with FreyAI Visions context (not a tradesperson!)
2. Fix email templates to Industrial Luxury style
3. Fix null variable mapping
"""

import sys

FILE = '/home/openclaw/workspace/projects/freyai-app/supabase/functions/process-inbound-email/index.ts'

with open(FILE, 'r') as f:
    content = f.read()

# ============================================================
# 1. REPLACE THE GEMINI PROMPT
# ============================================================

OLD_PROMPT = '''    const prompt = `Analysiere diese Kundenanfrage und pr\\u00fcfe, ob genug Informationen f\\u00fcr ein Angebot vorhanden sind:

E-Mail Betreff: ${subject}
E-Mail Text:
${emailBody}

Extrahiere:
1. Kundendaten:
   - Name (Vor- und Nachname wenn m\\u00f6glich)
   - Firma (falls erw\\u00e4hnt)
   - Telefon (falls erw\\u00e4hnt)

2. Anfrage-Details:
   - Leistungsart: metallbau, schweissen, hydraulik, rohrleitungsbau, industriemontage, reparatur, sonstiges
   - Beschreibung: Kurze Zusammenfassung (max. 200 Zeichen)
   - Budget: Falls erw\\u00e4hnt (nur Zahl)
   - Termin: Falls erw\\u00e4hnt (Format: YYYY-MM-DD)

3. Vollst\\u00e4ndigkeits-Pr\\u00fcfung:
   - Sind ALLE wichtigen Details f\\u00fcr ein Angebot vorhanden (Ma\\u00dfe, Material, Menge)?
   - Wenn NEIN: Welche Informationen fehlen?
   - Formuliere h\\u00f6fliche R\\u00fcckfragen

4. Angebots-Positionen (NUR wenn Anfrage vollst\\u00e4ndig):
   - Liste der Leistungen mit realistischen Preisen
   - Gesch\\u00e4tzte Arbeitsstunden

Antworte NUR im JSON-Format (ohne Markdown):

Beispiel 1 - VOLLST\\u00c4NDIG:
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

Beispiel 2 - UNVOLLST\\u00c4NDIG:
{
  "kunde": {"name": "Max M\\u00fcller", "firma": null, "telefon": null},
  "anfrage": {"leistungsart": "metallbau", "beschreibung": "Kunde m\\u00f6chte ein Tor", "budget": null, "termin": null},
  "vollstaendig": false,
  "fehlende_infos": ["Ma\\u00dfe (Breite und H\\u00f6he)", "Material-Wunsch", "Termin"],
  "rueckfragen": [
    "Welche Ma\\u00dfe soll das Tor haben (Breite und H\\u00f6he)?",
    "Haben Sie einen Wunsch bez\\u00fcglich des Materials (z.B. Stahl, Aluminium, verzinkt)?",
    "Bis wann ben\\u00f6tigen Sie die Ausf\\u00fchrung?"
  ],
  "positionen": [],
  "geschaetzteStunden": 0
}`'''

# Try without unicode escapes too (the file may have actual UTF-8)
OLD_PROMPT_ALT = OLD_PROMPT.encode().decode('unicode_escape') if False else None

NEW_PROMPT = r'''    const prompt = `Du bist der Lead Triage Agent von "FreyAI Visions" — einer exklusiven KI-Automatisierungsagentur.

DEINE IDENTITÄT:
- Firma: FreyAI Visions (Inhaber: Jonas Glawion)
- Produkt: Hochmoderne, lokale SaaS-Lösung (Finance & Org Suite) zur Automatisierung von Buchhaltung, Inventar, CRM und Backoffice für deutsche Handwerksbetriebe und KMUs.
- DU BIST KEIN HANDWERKER. Du bietest KEINE handwerklichen Dienstleistungen an (kein Metallbau, keine Elektrik, keine Installation).
- Du verkaufst Software, KI-Beratung und Prozessautomatisierung.

DEINE AUFGABE:
Analysiere die folgende Kundenanfrage. Der Kunde ist typischerweise ein Handwerksbetrieb oder KMU, der digitale Lösungen sucht.

E-Mail Betreff: ${subject}
E-Mail Text:
${emailBody}

Extrahiere:
1. Kundendaten:
   - Name (Vor- und Nachname, NIEMALS null — nutze "Interessent" als Fallback)
   - Firma (falls erwähnt, sonst null)
   - Telefon (falls erwähnt, sonst null)

2. Anfrage-Details:
   - Leistungsart: webentwicklung, prozessautomatisierung, ki-beratung, saas-setup, it-beratung, buchhaltung-digital, crm-setup, sonstiges
   - Beschreibung: Kurze Zusammenfassung des Kundenbedarfs (max. 200 Zeichen)
   - Budget: Falls erwähnt (nur Zahl in EUR)
   - Termin: Falls erwähnt (Format: YYYY-MM-DD)

3. Vollständigkeits-Prüfung:
   - Ist genug Information für ein konkretes Angebot vorhanden?
   - Mindestens nötig: Welche Lösung wird gesucht + Unternehmensgröße/Kontext
   - Wenn NEIN: Welche Informationen fehlen?
   - Formuliere maximal 3-4 präzise, professionelle Rückfragen. Kurz und direkt, kein Smalltalk.

4. Angebots-Positionen (NUR wenn Anfrage vollständig):
   - Liste der Leistungen mit realistischen Preisen für IT/SaaS-Dienstleistungen
   - Typische Positionen: Setup-Gebühr, Monatliches Abo, Schulung, Custom-Entwicklung
   - Geschätzte Arbeitsstunden

Antworte NUR im JSON-Format (ohne Markdown):
{
  "kunde": {"name": "string (nie null!)", "firma": "string|null", "telefon": "string|null"},
  "anfrage": {"leistungsart": "string", "beschreibung": "string", "budget": "number|null", "termin": "string|null"},
  "vollstaendig": true/false,
  "fehlende_infos": ["string"],
  "rueckfragen": ["string"],
  "positionen": [{"beschreibung": "string", "menge": 1, "einheit": "string", "einzelpreis": 0}],
  "geschaetzteStunden": 0
}`'''

if OLD_PROMPT in content:
    content = content.replace(OLD_PROMPT, NEW_PROMPT)
    print("✓ Gemini prompt replaced")
else:
    # Try finding it by a unique substring
    marker = 'metallbau, schweissen, hydraulik'
    if marker in content:
        # Find the prompt boundaries
        start = content.find("    const prompt = `Analysiere diese Kundenanfrage")
        if start == -1:
            start = content.find("    const prompt = `")

        end = content.find("}`", start)
        if start != -1 and end != -1:
            old = content[start:end+2]
            content = content.replace(old, NEW_PROMPT)
            print("✓ Gemini prompt replaced (alt method)")
        else:
            print("✗ Could not find prompt boundaries")
            sys.exit(1)
    else:
        print("✗ Old prompt not found — may already be updated")


# ============================================================
# 2. REPLACE THE FOLLOW-UP EMAIL TEMPLATE (Industrial Luxury)
# ============================================================

# Find the sendFollowUpQuestions function's HTML template
old_followup_html_start = "const questionsHTML = questions.map"
old_followup_html_end = "await sendViaRelay(to, 'Rückfrage zu Ihrer Anfrage', htmlBody)"

if old_followup_html_start in content:
    start = content.find(old_followup_html_start)
    end = content.find(old_followup_html_end)

    if start != -1 and end != -1:
        old_block = content[start:end]

        new_block = '''const kundenName = name || 'Interessent'
    const questionsHTML = questions.map((q, i) =>
        `<tr><td style="padding:8px 0;color:#2dd4a8;font-weight:700;vertical-align:top;width:24px;">${i + 1}.</td><td style="padding:8px 0;color:#e0e0e0;">${escapeHtml(q)}</td></tr>`
    ).join('')

    const htmlBody = `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"></head>
        <body style="margin:0;padding:0;background:#0a0a0a;font-family:'Segoe UI',Arial,sans-serif;">
            <div style="max-width:600px;margin:0 auto;background:#0c1a1a;border:1px solid rgba(45,212,168,0.15);">
                <!-- Header -->
                <div style="padding:32px 32px 24px;border-bottom:1px solid rgba(45,212,168,0.1);">
                    <div style="font-size:20px;font-weight:700;color:#2dd4a8;letter-spacing:0.05em;">FreyAI Visions</div>
                    <div style="font-size:11px;color:#666;margin-top:4px;letter-spacing:0.1em;text-transform:uppercase;">KI-Automatisierung &middot; SaaS &middot; Prozessoptimierung</div>
                </div>

                <!-- Body -->
                <div style="padding:32px;">
                    <p style="color:#e0e0e0;margin:0 0 20px;font-size:15px;">Guten Tag, <strong>${escapeHtml(kundenName)}</strong>.</p>

                    <p style="color:#aaa;margin:0 0 24px;font-size:14px;line-height:1.6;">
                        Ihre Anfrage ist eingegangen. Um Ihnen ein passendes Angebot zu erstellen, benötigen wir noch einige Details:
                    </p>

                    <table style="width:100%;border-collapse:collapse;background:rgba(45,212,168,0.04);border-left:3px solid #2dd4a8;margin:0 0 24px;">
                        <tbody style="padding:16px;">
                            ${questionsHTML}
                        </tbody>
                    </table>

                    <p style="color:#aaa;margin:0 0 24px;font-size:14px;line-height:1.6;">
                        Antworten Sie direkt auf diese E-Mail. Wir erstellen Ihr Angebot umgehend.
                    </p>

                    <div style="text-align:center;margin:32px 0 16px;">
                        <a href="https://buchung.freyaivisions.de" style="display:inline-block;padding:12px 32px;background:#2dd4a8;color:#0c1a1a;font-weight:700;font-size:14px;text-decoration:none;border-radius:4px;letter-spacing:0.02em;">Termin vereinbaren</a>
                    </div>
                </div>

                <!-- Footer -->
                <div style="padding:20px 32px;border-top:1px solid rgba(45,212,168,0.1);text-align:center;">
                    <div style="font-size:12px;color:#555;">
                        FreyAI Visions &mdash; Jonas Glawion<br>
                        <a href="https://freyaivisions.de" style="color:#2dd4a8;text-decoration:none;">freyaivisions.de</a>
                        &middot; +49 163 6727787
                    </div>
                </div>
            </div>
        </body>
        </html>
    `

    '''

        content = content.replace(old_block, new_block)
        print("✓ Follow-up email template replaced (Industrial Luxury)")
    else:
        print("✗ Could not find follow-up template boundaries")
else:
    print("⚠ Follow-up template marker not found")


# ============================================================
# 3. REPLACE THE SIMPLE CONFIRMATION TEMPLATE
# ============================================================

old_simple = '''async function sendSimpleConfirmation(to: string, name: string) {
    const htmlBody = `
        <!DOCTYPE html>
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2>Vielen Dank für Ihre Anfrage!</h2>
                <p>Sehr geehrte/r ${escapeHtml(name)},</p>
                <p>Ihre Nachricht ist bei uns eingegangen. Wir werden uns schnellstmöglich bei Ihnen melden.</p>
                <p>Mit freundlichen Grüßen<br>Ihr Team von ${COMPANY_NAME}</p>
            </div>
        </body>
        </html>
    `
    await sendViaRelay(to, 'Bestätigung Ihrer Anfrage', htmlBody)
}'''

new_simple = r'''async function sendSimpleConfirmation(to: string, name: string) {
    const kundenName = name || 'Interessent'
    const htmlBody = `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"></head>
        <body style="margin:0;padding:0;background:#0a0a0a;font-family:'Segoe UI',Arial,sans-serif;">
            <div style="max-width:600px;margin:0 auto;background:#0c1a1a;border:1px solid rgba(45,212,168,0.15);">
                <div style="padding:32px 32px 24px;border-bottom:1px solid rgba(45,212,168,0.1);">
                    <div style="font-size:20px;font-weight:700;color:#2dd4a8;letter-spacing:0.05em;">FreyAI Visions</div>
                    <div style="font-size:11px;color:#666;margin-top:4px;letter-spacing:0.1em;text-transform:uppercase;">Anfrage eingegangen</div>
                </div>
                <div style="padding:32px;">
                    <p style="color:#e0e0e0;margin:0 0 20px;font-size:15px;">Guten Tag, <strong>${escapeHtml(kundenName)}</strong>.</p>
                    <p style="color:#aaa;margin:0 0 24px;font-size:14px;line-height:1.6;">
                        Ihre Nachricht ist bei uns eingegangen. Wir melden uns zeitnah mit einem konkreten Vorschlag.
                    </p>
                    <div style="text-align:center;margin:24px 0;">
                        <a href="https://buchung.freyaivisions.de" style="display:inline-block;padding:12px 32px;background:#2dd4a8;color:#0c1a1a;font-weight:700;font-size:14px;text-decoration:none;border-radius:4px;">Direkt Termin buchen</a>
                    </div>
                </div>
                <div style="padding:20px 32px;border-top:1px solid rgba(45,212,168,0.1);text-align:center;">
                    <div style="font-size:12px;color:#555;">
                        FreyAI Visions &mdash; Jonas Glawion<br>
                        <a href="https://freyaivisions.de" style="color:#2dd4a8;text-decoration:none;">freyaivisions.de</a>
                        &middot; +49 163 6727787
                    </div>
                </div>
            </div>
        </body>
        </html>
    `
    await sendViaRelay(to, 'Ihre Anfrage bei FreyAI Visions', htmlBody)
}'''

if old_simple in content:
    content = content.replace(old_simple, new_simple)
    print("✓ Simple confirmation template replaced")
else:
    print("⚠ Simple confirmation template not found (may differ)")


# ============================================================
# 4. FIX NULL NAME IN sendFollowUpQuestions CALL
# ============================================================

# The call passes: email.from.name || analysis.kunde.name
# If both are null/undefined, we get "null"
old_call = "email.from.name || analysis.kunde.name"
new_call = "email.from.name || analysis.kunde?.name || 'Interessent'"
content = content.replace(old_call, new_call)
print("✓ Null name fallback added")


# ============================================================
# WRITE
# ============================================================

with open(FILE, 'w') as f:
    f.write(content)

print("\n=== All fixes applied ===")
