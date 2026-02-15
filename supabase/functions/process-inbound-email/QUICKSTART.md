# Quick Start Guide - E-Mail Automation

Komplette Einrichtung in 15 Minuten.

## Voraussetzungen

- [x] Supabase Account und Projekt
- [x] Resend Account (kostenlos)
- [x] Gemini API Key (kostenlos)
- [x] Domain (z.B. handwerkflow.de)

## Schritt-für-Schritt

### 1️⃣ Gemini API Key besorgen (2 Min)

1. Gehe zu: https://makersuite.google.com/app/apikey
2. Klicke **"Create API Key"**
3. Wähle **"Create API key in new project"**
4. Kopiere den Key: `AIzaSy...`

### 2️⃣ Resend einrichten (5 Min)

1. **Account erstellen**: https://resend.com/signup
2. **API Key erstellen**:
   - Dashboard → API Keys
   - **Create API Key**
   - Kopiere: `re_...`

3. **Domain hinzufügen**:
   - Dashboard → Domains
   - **Add Domain**
   - Domain eingeben: `handwerkflow.de`
   - DNS Records notieren

### 3️⃣ DNS konfigurieren (3 Min)

Bei deinem Domain-Provider (z.B. Hostinger):

```
Record Type | Name    | Value                              | Priority
------------|---------|------------------------------------|---------
MX          | @       | mx.resend.com                      | 10
TXT         | @       | v=spf1 include:_spf.resend.com ~all| -
TXT         | _dmarc  | v=DMARC1; p=none;                  | -
```

**Warten**: DNS-Propagation (5-30 Min)

### 4️⃣ Supabase Function deployen (3 Min)

#### Option A: PowerShell (Windows)

```powershell
cd C:\Users\reid1\Documents\Local-Buisness-automizer
.\supabase\functions\process-inbound-email\deploy.ps1
```

#### Option B: Bash (Linux/Mac)

```bash
cd /path/to/Local-Buisness-automizer
./supabase/functions/process-inbound-email/deploy.sh
```

#### Option C: Manuell

```bash
# 1. Login
supabase login

# 2. Link Projekt
cd C:\Users\reid1\Documents\Local-Buisness-automizer
supabase link

# 3. Schema deployen
# Öffne Supabase Dashboard → SQL Editor
# Kopiere Inhalt von schema.sql und führe aus

# 4. Function deployen
supabase functions deploy process-inbound-email --no-verify-jwt

# 5. Secrets setzen
supabase secrets set RESEND_API_KEY=re_xxxxx
supabase secrets set GEMINI_API_KEY=AIzaSyxxxxx
```

### 5️⃣ Resend Webhook konfigurieren (2 Min)

1. **Resend Dashboard** → **Inbound**
2. **Create Route**:
   - **From**: `*@handwerkflow.de` (alle Adressen)
   - **Webhook URL**: `https://<your-project-ref>.supabase.co/functions/v1/process-inbound-email`
   - **Enable**: ✅

**Deine Project Ref** findest du:
- Supabase Dashboard → Settings → API
- URL: `https://xxxxxxxxxxxxx.supabase.co`
- Ref: `xxxxxxxxxxxxx`

### 6️⃣ Test durchführen (2 Min)

Sende eine Test-E-Mail:

**An**: `anfragen@handwerkflow.de`

**Betreff**: Test Metalltor

**Text**:
```
Hallo,

ich benötige ein Metalltor:
- Breite: 2 Meter
- Feuerverzinkt
- Budget: 1.500€

Max Mustermann
Tel: 0123/456789
```

**Erwartung**:
- Nach 5-10 Sekunden kommt automatisch Antwort-E-Mail
- Enthält vollständiges Angebot
- Alle Positionen aufgelistet

### 7️⃣ Logs prüfen

```bash
# Live-Logs anzeigen
supabase functions logs process-inbound-email --follow

# Was du sehen solltest:
# 📧 Inbound email received: { from: "...", subject: "..." }
# ✅ Gemini analysis successful
# ✅ Customer created/updated
# ✅ Anfrage created: ANF-...
# ✅ Angebot created: ANG-...
# ✅ Email sent
```

## Troubleshooting

### E-Mail kommt nicht an

**Problem**: Keine E-Mail empfangen

**Lösung**:
1. DNS-Records prüfen:
   ```bash
   nslookup -type=MX handwerkflow.de
   # Sollte zeigen: mx.resend.com
   ```

2. Resend Logs prüfen:
   - Dashboard → Logs
   - Fehler suchen

3. Webhook-URL testen:
   ```bash
   curl -X POST https://your-ref.supabase.co/functions/v1/process-inbound-email \
     -H "Content-Type: application/json" \
     -d '{"from":{"email":"test@test.com"},"to":"anfragen@handwerkflow.de","subject":"Test","text":"Test"}'
   ```

### Angebot wird nicht erstellt

**Problem**: Confirmation-E-Mail, aber kein Angebot

**Lösung**:
1. Gemini API Key prüfen:
   ```bash
   supabase secrets list | grep GEMINI
   ```

2. Logs prüfen:
   ```bash
   supabase functions logs process-inbound-email
   # Suche nach "Gemini" Fehlern
   ```

3. Rate Limit erreicht?
   - Gemini: Max. 15 Requests/Minute
   - Warte 1 Minute und versuche erneut

### Database Fehler

**Problem**: `relation "inbound_emails" does not exist`

**Lösung**:
1. Schema deployen:
   - Supabase Dashboard → SQL Editor
   - Inhalt von `schema.sql` einfügen
   - **Run** klicken

2. Tabellen prüfen:
   ```sql
   SELECT table_name
   FROM information_schema.tables
   WHERE table_schema = 'public'
   AND table_name IN ('inbound_emails', 'automation_log', 'kunden', 'anfragen', 'angebote');
   ```

## Konfiguration anpassen

### Preise ändern

Bearbeite `index.ts`, Zeile ~150:

```typescript
const prompt = `...
Bei der Preisschätzung beachte:
- Stundensatz: 75€/Stunde (statt 65€)
- Material: +40% Aufschlag (statt 30%)
- Mindestpreis: 100€
...`
```

Nach Änderung neu deployen:
```bash
supabase functions deploy process-inbound-email --no-verify-jwt
```

### E-Mail-Template anpassen

Bearbeite `sendAngebotEmail()` in `index.ts`:

```typescript
const htmlBody = `
    <div style="background: YOUR_COLOR">
        <img src="YOUR_LOGO_URL" />
        ...
    </div>
`
```

### Leistungsarten erweitern

In `index.ts`, Gemini Prompt:

```typescript
Leistungsart: Wähle aus:
- metallbau
- schweissen
- hydraulik
- rohrleitungsbau
- industriemontage
- reparatur
- sonstiges
- dach_fassade    ← NEU
- blitzschutz     ← NEU
```

## Nächste Schritte

### Frontend-Integration

1. **Widget hinzufügen**:
   ```html
   <script src="js/ui/email-automation-widget.js"></script>
   <div id="email-automation-container"></div>
   ```

2. **Statistiken anzeigen**:
   ```javascript
   const stats = await emailAutomationService.getStats(30)
   console.log(`${stats.total_emails} E-Mails verarbeitet`)
   ```

### Monitoring einrichten

1. **Slack Notifications** (optional):
   ```typescript
   // Bei neuer E-Mail
   await fetch('https://hooks.slack.com/...', {
       body: JSON.stringify({
           text: `📧 Neue Anfrage von ${email.from.name}`
       })
   })
   ```

2. **Daily Summary** (optional):
   ```sql
   -- Cron Job für tägliche Zusammenfassung
   SELECT * FROM get_automation_stats(NULL, 1);
   ```

## Kosten-Übersicht

**Free Tier (0€/Monat)**:
- Resend: 100 Inbound E-Mails
- Gemini: 15 RPM (≈ 900/Stunde)
- Supabase: 500MB DB, 2GB Bandwidth

**Bei 100 E-Mails/Monat**: 0€
**Bei 500 E-Mails/Monat**: ~10€ (nur Resend Paid)
**Bei 1000 E-Mails/Monat**: ~20€

## Support

**Dokumentation**:
- README.md - Vollständige Dokumentation
- INTEGRATION.md - Frontend-Integration
- EMAIL_AUTOMATION_SUMMARY.md - Übersicht

**Logs**:
```bash
supabase functions logs process-inbound-email --follow
```

**Datenbank**:
```sql
-- Letzte E-Mails
SELECT * FROM automation_dashboard LIMIT 10;

-- Fehler
SELECT * FROM inbound_emails WHERE error IS NOT NULL;
```

## Checkliste

- [ ] Gemini API Key erstellt
- [ ] Resend Account erstellt
- [ ] DNS Records konfiguriert (MX, TXT)
- [ ] Supabase Function deployed
- [ ] Secrets gesetzt (RESEND_API_KEY, GEMINI_API_KEY)
- [ ] Resend Inbound Route erstellt
- [ ] Test-E-Mail versendet
- [ ] Angebot empfangen
- [ ] Logs geprüft
- [ ] Frontend-Widget integriert (optional)

## Fertig!

✅ Dein E-Mail-Automation-System ist live!

Jede E-Mail an `*@handwerkflow.de` wird jetzt automatisch:
1. Empfangen
2. Analysiert
3. Angebot erstellt
4. Kunde benachrichtigt

**Zeitersparnis**: ~10-15 Min pro Anfrage
**ROI**: Nach ~20 Anfragen amortisiert

---

Bei Fragen: Siehe README.md oder INTEGRATION.md
