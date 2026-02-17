# Process Inbound Email - Edge Function

Vollautomatische E-Mail-zu-Angebot-Verarbeitung mit Gemini AI.

## Funktionsweise

1. **E-Mail empfangen** (Resend Inbound Webhook)
2. **Analyse mit Gemini AI**
   - Kundendaten extrahieren
   - Anfrage kategorisieren (Metallbau, Hydraulik, etc.)
   - Positionen und Preise schätzen
3. **Automatische Erstellung**
   - Kunde anlegen/aktualisieren
   - Anfrage erstellen
   - Angebot generieren
4. **PDF erstellen** und per E-Mail versenden

## Setup

### 1. Resend Inbound konfigurieren

1. **Resend Dashboard öffnen**: https://resend.com/domains
2. **Domain hinzufügen**: `handwerkflow.de`
3. **DNS Records konfigurieren**:
   ```
   MX Record:
   Name: @
   Value: mx.resend.com
   Priority: 10

   TXT Record (SPF):
   Name: @
   Value: v=spf1 include:_spf.resend.com ~all

   TXT Record (DMARC):
   Name: _dmarc
   Value: v=DMARC1; p=none; rua=mailto:dmarc@handwerkflow.de
   ```

4. **Inbound Route erstellen**:
   - Gehe zu **Inbound** → **Create Route**
   - From: `*@handwerkflow.de` (alle Adressen)
   - Webhook URL: `https://<your-project>.supabase.co/functions/v1/process-inbound-email`
   - Enable: ✅

### 2. Environment Variables

Im Supabase Dashboard unter **Settings → Edge Functions** setzen:

```bash
RESEND_API_KEY=re_xxxxxxxxxxxxx
GEMINI_API_KEY=AIzaSyxxxxxxxxxxxxxxxxxxxxxxxx
SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGxxxxxxxxxxxxxxxxxx
SENDER_EMAIL=angebote@handwerkflow.de
SENDER_NAME=FreyAI Visions Angebote
```

### 3. Deployment

```bash
# Aus dem Projektverzeichnis
cd C:\Users\reid1\Documents\Local-Buisness-automizer

# Function deployen (ohne JWT-Verifizierung für Webhook)
supabase functions deploy process-inbound-email --no-verify-jwt

# Environment Variables setzen
supabase secrets set RESEND_API_KEY=re_xxxxx
supabase secrets set GEMINI_API_KEY=AIzaSyxxxxx
```

### 4. Datenbank-Schema

Führe das SQL-Skript aus:

```sql
-- Siehe schema.sql
```

## Test

### Test-E-Mail senden

Sende eine E-Mail an `anfragen@handwerkflow.de`:

```
Betreff: Anfrage Metalltor

Hallo,

ich benötige ein Metalltor mit folgenden Maßen:
- Breite: 2 Meter
- Höhe: 1,8 Meter
- Feuerverzinkt
- Farbe: RAL 7016 Anthrazit

Mein Budget liegt bei ca. 1.500€.
Wäre eine Montage in der KW 12 möglich?

Vielen Dank!
Max Mustermann
Musterstraße 123
12345 Musterstadt
Tel: 0123/456789
```

### Erwartetes Ergebnis

1. **Automatische Analyse**:
   - Kunde: Max Mustermann wird angelegt
   - Anfrage: Metallbau, ca. 1.500€ Budget
   - Positionen werden geschätzt (Tor, Montage, Material)

2. **Angebot erstellt**:
   - Nummer: ANG-{timestamp}
   - Positionen mit realistischen Preisen
   - PDF wird generiert

3. **E-Mail versendet**:
   - An: Max Mustermann
   - Betreff: "Ihr Angebot ANG-... - FreyAI Visions"
   - Inhalt: Angebot mit allen Positionen
   - Anhang: PDF (wenn implementiert)

### Logs prüfen

```bash
# Logs in Echtzeit anzeigen
supabase functions logs process-inbound-email --follow

# Letzte 100 Zeilen
supabase functions logs process-inbound-email
```

## Fallback-Verhalten

Wenn Gemini API fehlschlägt:
- ✅ E-Mail wird trotzdem gespeichert
- ✅ Einfache Bestätigung wird versendet
- ⚠️ Manueller Review erforderlich
- 📧 Admin wird benachrichtigt (optional)

## Anpassungen

### Preise anpassen

Bearbeite die Gemini-Prompt in `index.ts` um realistischere Preise zu generieren:

```typescript
const prompt = `...
Bei der Preisschätzung beachte:
- Stundensatz: 65€/Stunde
- Material: Marktübliche Preise + 30% Aufschlag
- Mindestpreis für Anfahrt: 50€
...`
```

### Leistungsarten erweitern

Verfügbare Kategorien:
- `metallbau` (Geländer, Treppen, Tore, Carports)
- `schweissen` (WIG, MIG/MAG, E-Hand)
- `hydraulik` (Schlauchservice, Zylinder, Aggregate)
- `rohrleitungsbau` (Ermeto, Presssysteme)
- `industriemontage` (Maschinen, Anlagen)
- `reparatur` (Wartung, Instandsetzung)
- `sonstiges` (Alles andere)

### E-Mail-Templates anpassen

Bearbeite `sendAngebotEmail()` und `sendSimpleConfirmation()` für:
- Corporate Design
- Andere Sprachen
- Zusätzliche Infos

## Überwachung

### Automation Logs

Alle Aktivitäten werden in `automation_log` gespeichert:

```sql
SELECT
    created_at,
    action,
    target,
    metadata
FROM automation_log
WHERE action = 'email.auto_process'
ORDER BY created_at DESC
LIMIT 20;
```

### Fehlerhafte E-Mails

```sql
SELECT *
FROM inbound_emails
WHERE processed = false
   OR error IS NOT NULL
ORDER BY received_at DESC;
```

## Sicherheit

- ✅ Service Role Key nur serverseitig (nicht im Frontend!)
- ✅ Webhook ohne Auth (Resend verifiziert via Signature)
- ✅ Rate Limiting empfohlen (max. 100 E-Mails/Stunde)
- ✅ Spam-Filter in Resend aktivieren

## Kosten

- **Resend**: 100 Inbound E-Mails/Monat kostenlos
- **Gemini API**: 15 RPM kostenlos (ca. 900/Stunde)
- **Supabase**: Im Free Plan enthalten

## Troubleshooting

### E-Mails kommen nicht an

1. DNS Records prüfen: `dig MX handwerkflow.de`
2. Resend Dashboard → Logs prüfen
3. Webhook URL testen: `curl https://...`

### Gemini liefert keine Ergebnisse

1. API Key prüfen: `echo $GEMINI_API_KEY`
2. Rate Limit erreicht? (15 RPM)
3. Logs prüfen: `supabase functions logs`

### Angebote werden nicht erstellt

1. Datenbank-Schema vollständig? `schema.sql` ausführen
2. Foreign Keys korrekt? `kunde_id`, `anfrage_id`
3. Service Role Key gültig?

## Nächste Schritte

- [ ] PDF-Generierung implementieren (jsPDF, PDFKit)
- [ ] Attachment-Handling (Bilder, Pläne vom Kunden)
- [ ] Multi-Tenant Support (verschiedene Firmen)
- [ ] WhatsApp/SMS-Benachrichtigung bei neuen Angeboten
- [ ] Dashboard für manuellen Review
