# Architektur - E-Mail-zu-Angebot-Automation

## System-Übersicht

```
┌─────────────────────────────────────────────────────────────────┐
│                         KUNDE                                   │
│                                                                 │
│  📧 Sendet E-Mail an: anfragen@handwerkflow.de                 │
│                                                                 │
│  "Ich benötige ein Metalltor, 2m breit, feuerverzinkt.        │
│   Mein Budget liegt bei ca. 1.500€"                           │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ SMTP
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│                    RESEND INBOUND                               │
│                                                                 │
│  • Empfängt E-Mail via MX Record                               │
│  • Parst: From, Subject, Body, Attachments                     │
│  • Spam-Filter                                                  │
│  • Webhook-Trigger                                              │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ HTTPS POST Webhook
                         │ {from: {...}, subject: "...", text: "..."}
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│           SUPABASE EDGE FUNCTION (Deno Runtime)                 │
│           process-inbound-email                                 │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 1. E-Mail speichern                                     │   │
│  │    → inbound_emails Tabelle                            │   │
│  │    → from_email, subject, body, received_at            │   │
│  └─────────────────────────────────────────────────────────┘   │
│                         │                                       │
│                         ↓                                       │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 2. Gemini AI Analyse                                   │   │
│  │    → Kundendaten extrahieren                           │   │
│  │    → Leistungsart erkennen                             │   │
│  │    → Positionen schätzen                               │   │
│  │    → Preise kalkulieren                                │   │
│  └─────────────────────────────────────────────────────────┘   │
│                         │                                       │
│         ┌───────────────┴───────────────┐                      │
│         │ Erfolg?                       │                      │
│         ↓                               ↓                      │
│    ┌─────────┐                    ┌──────────┐                │
│    │   JA    │                    │   NEIN   │                │
│    └────┬────┘                    └────┬─────┘                │
│         │                              │                      │
│         ↓                              ↓                      │
│  ┌─────────────────────┐        ┌─────────────────────┐      │
│  │ 3a. Auto-Processing │        │ 3b. Fallback        │      │
│  │                     │        │                     │      │
│  │ - Kunde anlegen     │        │ - Einfache          │      │
│  │ - Anfrage erstellen │        │   Bestätigung       │      │
│  │ - Angebot erstellen │        │   senden            │      │
│  │ - Preise berechnen  │        │ - Für manuellen     │      │
│  │ - PDF generieren    │        │   Review markieren  │      │
│  └──────┬──────────────┘        └──────┬──────────────┘      │
│         │                              │                      │
│         ↓                              ↓                      │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 4. E-Mail versenden (Resend API)                       │   │
│  │    → Professionelles HTML-Template                     │   │
│  │    → Alle Positionen                                   │   │
│  │    → Netto/MwSt/Brutto                                 │   │
│  │    → PDF-Anhang (optional)                             │   │
│  └─────────────────────────────────────────────────────────┘   │
│                         │                                       │
│                         ↓                                       │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 5. Logging & Analytics                                 │   │
│  │    → automation_log                                    │   │
│  │    → Metriken aktualisieren                            │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                         │
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│                    SUPABASE DATABASE                            │
│                                                                 │
│  ┌──────────────────┐  ┌──────────────────┐                   │
│  │ inbound_emails   │  │ automation_log   │                   │
│  │ ────────────────│  │ ────────────────│                   │
│  │ • id             │  │ • action         │                   │
│  │ • from_email     │  │ • target         │                   │
│  │ • subject        │  │ • metadata       │                   │
│  │ • body           │  │ • created_at     │                   │
│  │ • processed      │  └──────────────────┘                   │
│  │ • anfrage_id     │                                          │
│  │ • angebot_id     │                                          │
│  │ • error          │                                          │
│  └──────────────────┘                                          │
│                                                                 │
│  ┌──────────────────┐  ┌──────────────────┐                   │
│  │ kunden           │  │ anfragen         │                   │
│  │ ────────────────│  │ ────────────────│                   │
│  │ • id             │  │ • id             │                   │
│  │ • name           │  │ • nummer         │                   │
│  │ • firma          │  │ • kunde_id       │                   │
│  │ • email          │  │ • leistungsart   │                   │
│  │ • telefon        │  │ • beschreibung   │                   │
│  │ • quelle         │  │ • budget         │                   │
│  └──────────────────┘  │ • status         │                   │
│                        └──────────────────┘                   │
│                                                                 │
│  ┌──────────────────┐                                          │
│  │ angebote         │                                          │
│  │ ────────────────│                                          │
│  │ • id             │                                          │
│  │ • nummer         │                                          │
│  │ • anfrage_id     │                                          │
│  │ • kunde_id       │                                          │
│  │ • positionen     │ ← JSONB Array                           │
│  │ • netto          │                                          │
│  │ • mwst           │                                          │
│  │ • brutto         │                                          │
│  │ • status         │                                          │
│  └──────────────────┘                                          │
└─────────────────────────────────────────────────────────────────┘
                         │
                         │ Realtime Subscriptions
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│                    FRONTEND (Browser)                           │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Email Automation Widget                                 │   │
│  │                                                         │   │
│  │  📊 Statistiken:                                       │   │
│  │     • 127 E-Mails empfangen                           │   │
│  │     • 115 automatisch verarbeitet                     │   │
│  │     • 98 Angebote erstellt                            │   │
│  │     • 45.780€ Gesamt-Volumen                          │   │
│  │                                                         │   │
│  │  📧 Letzte E-Mails:                                    │   │
│  │     ✅ Max Mustermann - Metalltor (1.850€)            │   │
│  │     ✅ Anna Schmidt - Hydraulik (450€)                │   │
│  │     ⚠️  Peter - Unklare Anfrage                       │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Manuelle Review (für Fallback-Fälle)                   │   │
│  │                                                         │   │
│  │  ⚠️  E-Mail: "Können Sie mir helfen?"                 │   │
│  │     Von: peter@example.com                            │   │
│  │                                                         │   │
│  │     [ Kunde anlegen ]  [ Ignorieren ]                 │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                         │
                         │ Kunde erhält E-Mail
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│                         KUNDE                                   │
│                                                                 │
│  📧 Empfängt Antwort-E-Mail                                    │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ Betreff: Ihr Angebot ANG-1234567890 - FreyAI Visions     │ │
│  │                                                           │ │
│  │ Sehr geehrter Max Mustermann,                           │ │
│  │                                                           │ │
│  │ vielen Dank für Ihre Anfrage. Gerne unterbreiten wir    │ │
│  │ Ihnen folgendes Angebot:                                │ │
│  │                                                           │ │
│  │ Leistungen:                                              │ │
│  │ ───────────                                              │ │
│  │ 1. Metalltor 2x1.8m, feuerverzinkt                      │ │
│  │    1 Stk. × 850,00€ = 850,00€                           │ │
│  │                                                           │ │
│  │ 2. Montage und Installation                             │ │
│  │    4 Stunden × 65,00€ = 260,00€                         │ │
│  │                                                           │ │
│  │ 3. Farbbeschichtung RAL 7016                            │ │
│  │    1 Stk. × 180,00€ = 180,00€                           │ │
│  │                                                           │ │
│  │ ───────────────────────────────────────                  │ │
│  │ Netto:        1.290,00€                                  │ │
│  │ MwSt (19%):     245,10€                                  │ │
│  │ ═══════════════════════════════════════                  │ │
│  │ Gesamt:       1.535,10€                                  │ │
│  │                                                           │ │
│  │ Gültigkeitsdauer: 30 Tage                               │ │
│  │                                                           │ │
│  │ Mit freundlichen Grüßen                                  │ │
│  │ Ihr Team von FreyAI Visions            │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Komponenten-Details

### 1. Resend Inbound

**Aufgaben**:
- MX Record Handling
- E-Mail-Empfang und Parsing
- Spam-Filter
- Webhook-Auslösung

**Konfiguration**:
- Domain: `handwerkflow.de`
- Route: `*@handwerkflow.de` → Webhook
- Webhook: `https://[project].supabase.co/functions/v1/process-inbound-email`

**Datenformat**:
```json
{
  "from": {
    "name": "Max Mustermann",
    "email": "max@example.com"
  },
  "to": "anfragen@handwerkflow.de",
  "subject": "Anfrage Metalltor",
  "text": "Ich benötige...",
  "html": "<p>Ich benötige...</p>",
  "attachments": []
}
```

### 2. Edge Function (Deno Runtime)

**Technologie**:
- Runtime: Deno (TypeScript)
- Region: Automatisch (näher am User)
- Timeout: 60 Sekunden
- Memory: 512MB

**Dependencies**:
- `@supabase/supabase-js` - Database Client
- Fetch API - Gemini & Resend Calls
- Standard Library - JSON, Date, etc.

**Umgebungsvariablen**:
```env
RESEND_API_KEY=re_xxxxx
GEMINI_API_KEY=AIzaSyxxxxx
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGxxxxx
SENDER_EMAIL=angebote@handwerkflow.de
SENDER_NAME=FreyAI Visions Angebote
```

**Performance**:
- Cold Start: ~1-2s
- Warm Start: ~100-500ms
- Gemini API: 2-5s
- Database: 50-200ms
- E-Mail-Versand: 500ms-1s
- **Gesamt**: 5-10 Sekunden

### 3. Gemini AI Integration

**Model**: `gemini-2.0-flash`

**Prompt-Engineering**:
```
INPUT:
E-Mail Betreff + Body

ANALYSE:
1. Kundendaten (Name, Firma, Tel)
2. Leistungsart (metallbau, hydraulik, etc.)
3. Anfrage-Details (Beschreibung, Budget, Termin)
4. Positionen (Was wird benötigt?)
5. Arbeitsaufwand (Geschätzte Stunden)

OUTPUT:
JSON-Format mit strukturierten Daten
```

**Parameter**:
- Temperature: 0.3 (deterministisch)
- Max Tokens: 1000
- Response: JSON only

**Rate Limits**:
- Free Tier: 15 RPM
- Bei Überschreitung: 429 Error → Fallback

### 4. Datenbank-Schema

**Tabellen-Beziehungen**:
```
inbound_emails (1) ──→ (1) anfragen ──→ (1) angebote
                            ↓                ↓
                       (N) kunden (1) ──────┘

automation_log (standalone)
```

**RLS Policies**:
- Service Role: Voller Zugriff
- Authenticated User: Nur eigene Daten
- Anon: Kein Zugriff

**Indices**:
- `idx_inbound_emails_processed` - Schnelles Filtern unverarbeiteter
- `idx_kunden_email` - Duplikat-Check
- `idx_anfragen_status` - Dashboard-Queries
- `idx_angebote_kunde_id` - Join-Performance

### 5. Frontend-Integration

**Services**:
- `EmailAutomationService` - API-Wrapper
- `EmailAutomationWidget` - Dashboard-Komponente

**Realtime-Updates**:
```javascript
supabase
  .channel('inbound_emails')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'inbound_emails'
  }, (payload) => {
    // Update UI
  })
  .subscribe()
```

## Datenfluss

### Erfolgreiche Verarbeitung

```
1. E-Mail empfangen (0s)
   ↓
2. Webhook-Aufruf (0.1s)
   ↓
3. E-Mail speichern (0.2s)
   ↓
4. Gemini-Analyse (2-5s)
   ↓
5. Kunde anlegen/update (0.3s)
   ↓
6. Anfrage erstellen (0.2s)
   ↓
7. Angebot berechnen (0.1s)
   ↓
8. Angebot speichern (0.3s)
   ↓
9. E-Mail versenden (1s)
   ↓
10. Logging (0.2s)
    ↓
TOTAL: ~5-10 Sekunden
```

### Fallback-Verarbeitung

```
1-3. Wie oben
   ↓
4. Gemini-Analyse → FEHLER
   ↓
5. Fallback-Modus aktivieren
   ↓
6. Einfache Bestätigung senden
   ↓
7. Für Review markieren
   ↓
TOTAL: ~2-3 Sekunden
```

## Skalierung

### Horizontal Scaling

Edge Functions skalieren automatisch:
- Auto-Scaling bei Last
- Multi-Region Deployment
- Load Balancing

**Limits**:
- Concurrent Requests: Unbegrenzt (Supabase Free)
- Execution Time: 60s Max
- Memory: 512MB

### Vertikales Scaling

**Datenbank**:
- Free Tier: 500MB
- Pro: Bis 8GB+
- Connection Pooling

**Gemini API**:
- Free: 15 RPM
- Paid: Höhere Limits

### Kosten bei Skalierung

**100 E-Mails/Monat**: 0€
**1.000 E-Mails/Monat**: ~10-20€
**10.000 E-Mails/Monat**: ~100-200€

## Sicherheit

### Edge Function

✅ **Implementiert**:
- Keine JWT-Verifizierung (Webhook)
- Service Role Key serverseitig
- Input Validation
- Error Handling

⚠️ **Empfohlen**:
- Resend Signature Verification
- Rate Limiting
- IP Allowlist

### Datenbank

✅ **Implementiert**:
- RLS (Row Level Security)
- User-spezifischer Zugriff
- Service Role für Automation

### Secrets

✅ **Sichere Speicherung**:
- Supabase Secrets Manager
- Nicht im Code
- Umgebungsvariablen

## Monitoring

### Logs

```bash
# Realtime
supabase functions logs process-inbound-email --follow

# Formatiert
supabase functions logs process-inbound-email | jq '.'
```

### Metriken

**Automatisch erfasst**:
- Total E-Mails
- Processed E-Mails
- Failed E-Mails
- Total Angebote
- Total Value

**Query**:
```sql
SELECT * FROM get_automation_stats(NULL, 30);
```

### Alerts

**Beispiel**: Hohe Fehlerrate

```sql
CREATE OR REPLACE FUNCTION check_error_rate()
RETURNS TRIGGER AS $$
BEGIN
  IF (
    SELECT COUNT(*)
    FROM inbound_emails
    WHERE received_at > NOW() - INTERVAL '1 hour'
      AND error IS NOT NULL
  ) > 5 THEN
    -- Alert senden
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

## Erweiterbarkeit

### 1. PDF-Generierung

```typescript
import { jsPDF } from 'jspdf'

const pdf = new jsPDF()
// ... PDF aufbauen
const pdfBytes = pdf.output('arraybuffer')

// In Supabase Storage hochladen
const { data } = await supabase.storage
  .from('angebote-pdfs')
  .upload(`${angebot.nummer}.pdf`, pdfBytes)
```

### 2. Bild-Analyse (Gemini Vision)

```typescript
if (email.attachments?.length > 0) {
  const imageAnalysis = await analyzeImages(email.attachments)
  // Maße, Material aus Bildern extrahieren
}
```

### 3. Multi-Tenant

```typescript
// Domain-basiertes Routing
const recipientDomain = email.to.split('@')[1]
const company = await getCompanyByDomain(recipientDomain)

// Company-spezifische Settings
const settings = company.settings
const stundensatz = settings.hourly_rate
```

### 4. WhatsApp/SMS

```typescript
// Nach Angebotserstellung
await fetch('https://api.twilio.com/2010-04-01/Accounts/.../Messages.json', {
  body: new URLSearchParams({
    To: company.owner_phone,
    From: twilioNumber,
    Body: `Neues Angebot ${angebot.nummer} erstellt`
  })
})
```

## Testing-Strategie

### Unit Tests

```typescript
// test.ts
Deno.test('Parse simple metallbau request', async () => {
  const result = await analyzeEmail(testEmail)
  assertEquals(result.anfrage.leistungsart, 'metallbau')
})
```

### Integration Tests

```typescript
Deno.test('Full automation flow', async () => {
  const response = await sendTestEmail(email)
  assertEquals(response.status, 200)
  assertExists(response.data.angebot_nummer)
})
```

### E2E Tests

```bash
# Mit echten E-Mails
curl -X POST https://api.resend.com/emails \
  -H "Authorization: Bearer $RESEND_KEY" \
  -d '{"to": "anfragen@handwerkflow.de", ...}'
```

## Deployment-Prozess

```
1. Code ändern
   ↓
2. Lokal testen
   supabase functions serve
   ↓
3. Deployen
   supabase functions deploy process-inbound-email --no-verify-jwt
   ↓
4. Smoke Test
   curl POST webhook-url
   ↓
5. Monitoring
   supabase functions logs --follow
```

## Disaster Recovery

### Backup

**Datenbank**:
- Automatische Backups (Supabase)
- Point-in-Time Recovery

**Code**:
- Git Repository
- Version Control

### Rollback

```bash
# Vorherige Version deployen
git checkout previous-commit
supabase functions deploy process-inbound-email
```

### Failover

Bei Ausfall:
1. Resend speichert E-Mails (30 Tage)
2. Webhook-Retry (automatisch)
3. Manuelle Nachbearbeitung möglich

---

**Dokumentations-Version**: 1.0.0
**Zuletzt aktualisiert**: 2026-02-15
**Autor**: Claude Code (Sonnet 4.5)
