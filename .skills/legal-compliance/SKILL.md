---
name: legal-compliance
description: |
  German legal compliance for FreyAI Visions — a SaaS business suite for Handwerker.
  Trigger on ANY mention of: DSGVO, Datenschutz, Datenschutzerklärung, Impressum, AGB,
  GoBD, Kleinunternehmer, §19 UStG, Aufbewahrungspflicht, Cookie, Cookie-Banner,
  Auftragsverarbeitung, AVV, Verarbeitungsverzeichnis, Löschkonzept, TMG, ePrivacy,
  Double-Opt-In, Abmeldelink, UWG, legal, compliance, rechtlich, Rechtskonformität,
  Datenschutzbeauftragter, Verfahrensdokumentation, Mahnverfahren, Widerrufsrecht,
  Nutzungsbedingungen, Terms of Service. Be pushy — always activate on legal topics.
---

# Legal Compliance — FreyAI Visions

German legal requirements for a Kleinunternehmer SaaS business. All output must reflect current German law. When in doubt, recommend consulting a Fachanwalt für IT-Recht.

## Business Identity

| Field | Value |
|-------|-------|
| **Inhaber** | Jonas Glawion |
| **Firma** | FreyAI Visions |
| **Adresse** | Grabenstraße 135, 63762 Großostheim |
| **E-Mail** | kontakt@freyaivisions.de |
| **Telefon** | +49 179 4228285 |
| **Website** | freyaivisions.de |
| **Steuerstatus** | Kleinunternehmer gemäß §19 UStG |
| **Gemeindekennzahl** | 09671122 |

---

## 1. DSGVO Compliance Checklist

### Datenschutzerklärung (Art. 13/14 DSGVO)
Must be on every page (link in footer). Required content:
- Verantwortlicher (Name, Adresse, E-Mail)
- Zweck und Rechtsgrundlage jeder Verarbeitung (Art. 6 Abs. 1 DSGVO)
- Empfänger / Auftragsverarbeiter (Supabase, Stripe, Resend, Twilio, Hostinger)
- Übermittlung in Drittländer (USA) + Schutzmaßnahmen (EU-US Data Privacy Framework, SCCs)
- Speicherdauer je Datenkategorie
- Betroffenenrechte (Auskunft, Berichtigung, Löschung, Einschränkung, Datenportabilität, Widerspruch)
- Beschwerderecht bei Aufsichtsbehörde (BayLDA für Bayern)
- Keine Pflicht zur Bereitstellung + Folgen der Nichtbereitstellung

### Verarbeitungsverzeichnis (Art. 30 DSGVO)
Even Kleinunternehmer need one if processing is not merely occasional (SaaS = regular). Document:
- Verarbeitungstätigkeit (z.B. Kundenverwaltung, Rechnungsstellung, E-Mail-Versand)
- Zweck und Rechtsgrundlage
- Betroffene Kategorien (Kunden, Interessenten, Mitarbeiter der Kunden)
- Datenkategorien (Name, E-Mail, Adresse, Zahlungsdaten, Auftragsdaten)
- Empfänger (Supabase, Stripe, Resend, Twilio)
- Löschfristen
- TOM-Verweis

### Auftragsverarbeitungsverträge (AVV) — Art. 28 DSGVO
**Required with every processor.** Status:

| Processor | Service | Data | AVV Status |
|-----------|---------|------|------------|
| **Supabase** (US) | Database, Auth, Edge Functions | All customer data | DPA available at supabase.com/legal |
| **Stripe** (US) | Payment processing | Payment data, email, name | DPA at stripe.com/legal/dpa |
| **Resend** (US) | Transactional email | Email addresses, names | DPA at resend.com/legal/dpa |
| **Twilio** (US) | SMS notifications | Phone numbers, message content | DPA at twilio.com/legal/data-protection-addendum |
| **Hostinger** (LT) | VPS hosting | All data on server | DPA at hostinger.com/legal/dpa |
| **Hetzner** (DE) | Infrastructure | Backups, logs | DPA at hetzner.com/legal/privacy-policy |
| **Google** (US) | Gemini AI API | Processed text snippets | DPA in Google Cloud terms |

**Action:** Download/sign each DPA. Store in `docs/security/avv/`. For US processors, verify EU-US DPF certification or SCCs.

### Technische und organisatorische Maßnahmen (TOM) — Art. 32 DSGVO
Document these measures:
- **Verschlüsselung:** TLS 1.3 in transit, AES-256 at rest (Supabase)
- **Zugriffskontrolle:** Supabase RLS policies, JWT auth, IP-whitelist on staging/app
- **Pseudonymisierung:** UUIDs as primary keys, no PII in URLs
- **Backup:** Automated Supabase backups + VPS backup rotation
- **Monitoring:** Umami analytics (self-hosted, no PII), VPS log monitoring
- **Incident Response:** Documented procedure, 72h notification to BayLDA

### Löschkonzept
Define retention and deletion per data category:
- **Kundendaten:** Retain during business relationship + 10 years (§257 HGB, §147 AO)
- **Rechnungen/Buchungsdaten:** 10 years (GoBD)
- **E-Mail-Logs:** 6 months operational, then delete
- **SMS-Logs:** 6 months operational, then delete
- **Analytics:** Aggregated only, no PII, retain indefinitely
- **Bewerberdaten:** Delete 6 months after rejection (unless consent)
- **Account deletion:** On request, delete within 30 days (except legally required retention)

---

## 2. Impressum (TMG §5 / DDG §5)

**Mandatory for all commercial websites.** Must be reachable within 2 clicks from every page.

### Required Fields for Kleinunternehmer

```
Impressum

Jonas Glawion
FreyAI Visions

Grabenstraße 135
63762 Großostheim

Telefon: +49 179 4228285
E-Mail: kontakt@freyaivisions.de

Umsatzsteuer:
Gemäß §19 UStG wird keine Umsatzsteuer berechnet.
(Keine USt-IdNr. vorhanden)

Verantwortlich für den Inhalt nach §18 Abs. 2 MStV:
Jonas Glawion
Grabenstraße 135
63762 Großostheim

EU-Streitschlichtung:
Die Europäische Kommission stellt eine Plattform zur
Online-Streitbeilegung (OS) bereit:
https://ec.europa.eu/consumers/odr/
Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren
vor einer Verbraucherschlichtungsstelle teilzunehmen.
```

### Placement
- Footer link on every page: `impressum.html` or anchor `#impressum`
- Also link in: landing.html, auth.html, booking page
- Label: "Impressum" (not "Legal Notice" — German law requires German label)

### NOT Required for Kleinunternehmer
- Handelsregisternummer (no HRB entry)
- USt-IdNr. (§19 UStG exempt — but must state the exemption)
- Wirtschafts-Identifikationsnummer (not yet assigned broadly)

---

## 3. AGB for SaaS (Allgemeine Geschäftsbedingungen)

Key clauses for a German SaaS AGB:

### Pflichtklauseln

1. **Geltungsbereich:** AGB gelten für alle Leistungen zwischen FreyAI Visions und dem Kunden
2. **Leistungsbeschreibung:** Klare Definition der SaaS-Leistung (cloud-based business suite, Funktionsumfang, Verfügbarkeit)
3. **Vertragsschluss:** Registrierung + Bestätigung = Vertrag. Kein konkludenter Vertrag.
4. **Vergütung / Preise:**
   - Setup: 3.500–7.500 EUR (einmalig)
   - Retainer: 300–500 EUR/monat
   - "Gemäß §19 UStG wird keine Umsatzsteuer berechnet." — MUST appear on every price reference
   - Zahlungsbedingungen: 14 Tage netto
5. **Vertragslaufzeit und Kündigung:**
   - Mindestlaufzeit: [define, max 24 months for B2B]
   - Kündigungsfrist: [e.g., 3 Monate zum Vertragsende]
   - Kündigung in Textform (E-Mail genügt)
   - Außerordentliche Kündigung bei wichtigem Grund
6. **Verfügbarkeit / SLA:** 99% uptime target, geplante Wartungsfenster ausgenommen
7. **Haftungsbeschränkung:**
   - Unbeschränkte Haftung bei Vorsatz und grober Fahrlässigkeit
   - Bei leichter Fahrlässigkeit: nur bei Verletzung wesentlicher Vertragspflichten (Kardinalpflichten)
   - Haftungshöhe: begrenzt auf vorhersehbare, vertragstypische Schäden
   - Haftung für Leben, Körper, Gesundheit: unbeschränkt
8. **Datenschutz-Verweis:** Verweis auf Datenschutzerklärung, AVV als Anlage
9. **Geistiges Eigentum:** Software bleibt Eigentum von FreyAI Visions. Kunde erhält Nutzungsrecht.
10. **Datenherausgabe bei Vertragsende:** Kunde kann Datenexport anfordern (30 Tage Frist), danach Löschung
11. **Änderungsvorbehalt:** FreyAI darf AGB mit 4 Wochen Ankündigung ändern. Widerspruchsrecht des Kunden.
12. **Schlussbestimmungen:** Deutsches Recht, Gerichtsstand Aschaffenburg (B2B), salvatorische Klausel

### Wichtig
- AGB müssen VOR Vertragsschluss zugänglich sein (Registrierungsseite)
- Checkbox: "Ich habe die AGB gelesen und akzeptiere sie" — MUSS aktiv gesetzt werden (kein Pre-Check)
- AGB-Link in Footer jeder Seite

---

## 4. Kleinunternehmer §19 UStG

### Pflicht-Hinweis
Every invoice, quote, and price display must include:
> **Gemäß §19 UStG wird keine Umsatzsteuer berechnet.**

### Where to Show
- Rechnungen (invoice PDF + email)
- Angebote (quote PDF + email)
- AGB (Vergütungsklausel)
- Impressum
- Preisseiten / Landing Page pricing section
- Booking page (if prices shown)

### Invoice Requirements (§14 UStG + §19 UStG)
Rechnungen müssen enthalten:
- Vollständiger Name und Anschrift des Leistenden und Empfängers
- Steuernummer ODER USt-IdNr. (Steuernummer reicht für §19)
- Ausstellungsdatum
- Fortlaufende Rechnungsnummer
- Menge und Art der Leistung
- Zeitpunkt der Leistung
- Nettobetrag (= Bruttobetrag, da keine USt)
- **Kein USt-Ausweis** — bei §19 darf KEINE Umsatzsteuer auf der Rechnung stehen
- Hinweis: "Gemäß §19 UStG wird keine Umsatzsteuer berechnet."

### Umsatzgrenzen
- Vorjahr: max. 22.000 EUR Brutto-Umsatz
- Laufendes Jahr: voraussichtlich max. 50.000 EUR
- Bei Überschreitung: ab Folgejahr reguläre USt-Pflicht
- **Tracking:** Monitor revenue via `bookkeeping-service.js` — alert when approaching 80% of 22.000 EUR

---

## 5. GoBD — Digitale Buchführung

### Grundsätze (BMF-Schreiben 28.11.2019)

1. **Nachvollziehbarkeit und Nachprüfbarkeit:** Jeder Geschäftsvorfall muss von Beleg bis Buchung nachvollziehbar sein
2. **Vollständigkeit:** Alle Geschäftsvorfälle lückenlos erfassen
3. **Richtigkeit:** Geschäftsvorfälle wahrheitsgemäß abbilden
4. **Zeitgerechte Buchung:** Innerhalb von 10 Tagen erfassen
5. **Ordnung:** Systematische Ablage, Kontenrahmen
6. **Unveränderbarkeit:** Einmal gebuchte Vorgänge dürfen nicht mehr verändert werden — nur Stornobuchungen. Technisch: Audit-Trail, keine DELETE/UPDATE auf Buchungssätze
7. **Aufbewahrung:** 10 Jahre für Buchungsbelege, Rechnungen, Jahresabschlüsse. 6 Jahre für Geschäftsbriefe.

### Implementation in FreyAI
- `bookkeeping-service.js`: Buchungen sind append-only (INSERT only, corrections via Stornobuchung)
- `datev-export-service.js`: DATEV-konforme CSV-Exporte für den Steuerberater
- IndexedDB + Supabase sync: Offline-Buchungen werden synchronisiert, nie überschrieben
- Rechnungs-PDFs: Einmal erzeugt, unveränderbar gespeichert (`dokumente` table)
- **Verfahrensdokumentation:** Must exist — describes the bookkeeping system, data flows, access controls, backup procedures. Store in `docs/architecture/verfahrensdokumentation.md`.

### Aufbewahrungsfristen
| Dokument | Frist | Grundlage |
|----------|-------|-----------|
| Rechnungen (ein-/ausgehend) | 10 Jahre | §257 HGB, §147 AO |
| Buchungsbelege | 10 Jahre | §257 HGB |
| Jahresabschlüsse | 10 Jahre | §257 HGB |
| Angebote (angenommen) | 6 Jahre | §257 HGB |
| Geschäftsbriefe | 6 Jahre | §257 HGB |
| Verträge | 10 Jahre nach Vertragsende | §257 HGB |

---

## 6. Cookie / Tracking Rules

### Umami Analytics (Self-Hosted)
- Umami is self-hosted at `analytics.freyaivisions.de`
- **No cookies set** — Umami uses no cookies by default
- **No PII collected** — only aggregated page views, referrers, device types
- **DSGVO-Status:** No consent banner needed for Umami (no cookies, no PII, no tracking across sites)
- **ePrivacy:** Cookie consent only required for non-essential cookies. Umami sets none → no banner needed.
- **Still mention in Datenschutzerklärung:** Describe Umami as analytics tool, note: no cookies, no PII, self-hosted, no third-party data sharing.

### If Adding Other Tracking
- Google Analytics, Meta Pixel, etc.: REQUIRE consent banner (ePrivacy + DSGVO)
- Consent must be: informed, voluntary, specific, prior to tracking (opt-in, not opt-out)
- Use a CMP (Consent Management Platform) if adding cookie-based tracking
- Currently: NOT needed. Keep it that way.

### Service Worker / PWA
- Service Worker caches are NOT cookies — no consent needed
- IndexedDB storage for offline: NOT cookies — no consent needed
- localStorage for app state: NOT cookies — no consent needed (but mention in Datenschutzerklärung)

---

## 7. Email Marketing Rules (UWG §7)

### Grundregel
Werbliche E-Mails nur mit **ausdrücklicher Einwilligung** (Double-Opt-In).

### Double-Opt-In Prozess
1. Nutzer gibt E-Mail-Adresse ein (Registrierung, Newsletter, Waitlist)
2. System sendet Bestätigungs-E-Mail mit Verifizierungslink
3. Nutzer klickt Link → Einwilligung bestätigt
4. **Protokollierung:** Zeitpunkt, IP-Adresse, bestätigter Umfang speichern (Beweislast beim Versender)

### Pflichtangaben in jeder Werbe-E-Mail
- Absender-Identität (Name + Firma)
- **Abmeldelink** oder Abmeldemöglichkeit (z.B. "Antworten Sie mit 'Abmelden'")
- Impressum oder Link zum Impressum

### Ausnahmen (§7 Abs. 3 UWG — Bestandskundenregelung)
Werbung an Bestandskunden OHNE erneute Einwilligung erlaubt, wenn:
1. E-Mail-Adresse im Zusammenhang mit einem Kauf erhalten
2. Werbung für eigene ähnliche Produkte/Dienstleistungen
3. Kunde hat nicht widersprochen
4. Bei jedem Kontakt auf Widerspruchsrecht hingewiesen

### Implementation
- Waitlist (`waitlist` table): Double-Opt-In via `auth-service.js` email verification
- Transaktions-E-Mails (Rechnungen, Bestätigungen): Kein Opt-In nötig — keine Werbung
- Marketing-E-Mails: Only send to confirmed opt-in addresses
- Every email footer: Abmeldemöglichkeit (see email-templates skill)

---

## 8. AVV Requirements per Processor

For each third-party processor, a written AVV (Auftragsverarbeitungsvertrag) must cover:

### Minimum AVV Content (Art. 28 Abs. 3 DSGVO)
1. Gegenstand und Dauer der Verarbeitung
2. Art und Zweck der Verarbeitung
3. Art der personenbezogenen Daten
4. Kategorien betroffener Personen
5. Pflichten und Rechte des Verantwortlichen
6. Weisungsgebundenheit des Auftragsverarbeiters
7. Vertraulichkeit (Mitarbeiter auf Datenschutz verpflichtet)
8. TOM des Auftragsverarbeiters
9. Subunternehmer-Regelung (Genehmigungsvorbehalt)
10. Unterstützungspflichten (Betroffenenrechte, Datenschutz-Folgenabschätzung)
11. Löschung/Rückgabe nach Vertragsende
12. Kontrollrechte des Verantwortlichen

### Processor-Specific Notes

**Supabase:** Hosts ALL customer data. Primary AVV priority. US-based → verify DPF certification. DPA: `https://supabase.com/legal/dpa`

**Stripe:** Processes payment data. Joint controller for some processing. DPA: `https://stripe.com/legal/dpa`

**Resend:** Sends transactional emails. Has access to email addresses + email content. DPA: `https://resend.com/legal/dpa`

**Twilio:** Sends SMS. Has access to phone numbers + message content. DPA: `https://www.twilio.com/legal/data-protection-addendum`

**Hostinger:** VPS provider. All data stored on their hardware. EU-based (Lithuania). DPA: `https://www.hostinger.com/legal/dpa`

---

## Safety Rules

- **Never give definitive legal advice** — always caveat with "Dies ist keine Rechtsberatung. Konsultieren Sie einen Fachanwalt für IT-Recht."
- **When generating legal texts** (Impressum, AGB, Datenschutzerklärung): Include disclaimer that they need legal review
- **Track §19 UStG threshold** — alert when revenue approaches 22.000 EUR
- **AVV audit** — remind user quarterly to verify all DPAs are current
- **Aufbewahrungsfristen** — never delete invoices or booking records before 10-year retention expires
- **Double-Opt-In** — never send marketing emails without confirmed consent
