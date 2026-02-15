# E-Mail Automation Frontend - Implementierung

## Übersicht

Das E-Mail-Automation-Frontend bietet eine vollständige UI zur Konfiguration und Überwachung der automatischen E-Mail-Verarbeitung.

## Implementierte Komponenten

### 1. Email Automation Service (`js/services/email-automation-service.js`)

**Funktionen:**
- `getConfig()` - Hole aktuelle Konfiguration
- `setConfig(config)` - Speichere Konfiguration
- `getProcessedEmails(limit)` - Hole Verarbeitungs-Historie
- `testProcessing(emailText)` - Test-Modus mit Beispiel-Email
- `getStats()` - Statistiken abrufen

**KI-Analyse Features:**
- Extrahiert Kundenname, Telefon, E-Mail
- Erkennt Projekttyp (Tor, Zaun, Treppe, etc.)
- Extrahiert Dimensionen (Breite, Höhe)
- Schätzt Dringlichkeit
- Berechnet geschätzten Projektwert

### 2. Settings UI (in `index.html`)

**Neue Settings-Karte** (nach Webhook-Karte):
- Checkbox: Automatische Angebotserstellung aktivieren
- Empfangs-Adresse (readonly)
- Antwort-Template mit Platzhaltern
- Checkbox: Manuelle Prüfung vor Versand
- Buttons: Speichern, Test, Historie anzeigen
- Status-Indikator

### 3. Email Automation View (in `index.html`)

**Neue View** `view-email-automation`:
- **Statistik-Cards:**
  - E-Mails empfangen
  - Erfolgreich verarbeitet
  - Angebote erstellt
  - Durchschnittliche Bearbeitungszeit

- **Verarbeitungs-Historie:**
  - Liste aller verarbeiteten E-Mails
  - Filter nach Status (Alle, Erfolgreich, Ausstehend, Fehler, Test)
  - Detaillierte Analyse-Anzeige
  - Email-Vorschau
  - Actions: Angebot anzeigen

### 4. Test-Modal (in `index.html`)

**Modal** `modal-test-email`:
- Textarea für Beispiel-E-Mail
- Button: "Beispiel laden" (3 vorgefertigte Beispiele)
- Button: "Verarbeitung testen"
- Ergebnis-Anzeige mit:
  - Analyse-Details (Kunde, Telefon, E-Mail, Projekttyp, etc.)
  - Erstelltes Angebot (Titel, Kunde, Summe)

### 5. CSS Styling (`css/components.css`)

**Neue Styles:**
- `.automation-stats` - Grid für Statistik-Cards
- `.email-history-list` - Historie-Container
- `.email-history-item` - Einzelne Email-Einträge
- `.email-history-status` - Status-Badges (success, pending, failed, test)
- `.email-preview` - Monospace Email-Vorschau
- `.email-analysis` - Grid für Analyse-Daten
- `.test-result-section` - Test-Ergebnis Darstellung

### 6. Event Handlers (`js/app.js`)

**Settings:**
- `btn-save-email-automation` - Speichert Konfiguration
- `btn-test-email-processing` - Öffnet Test-Modal
- `btn-view-email-automation` - Wechselt zur Historie-View

**Test-Modal:**
- `btn-run-test` - Führt Test-Verarbeitung durch
- `btn-load-example-email` - Lädt zufälliges Beispiel

**Historie-View:**
- `btn-refresh-email-history` - Aktualisiert Historie
- `email-history-filter` - Filtert nach Status

### 7. View-Integration

**Switch-View erweitert:**
```javascript
case 'einstellungen':
    updateSettingsStatus();
    loadEmailAutomationConfig();
    break;
case 'email-automation':
    renderEmailAutomation();
    break;
```

### 8. Lazy Loading Integration

**lazy-loader.js:**
- Service zur CRM-Gruppe hinzugefügt
- Views `emails` und `email-automation` nutzen CRM-Gruppe
- Settings-View lädt ebenfalls CRM-Gruppe

**init-lazy-services.js:**
- Auto-Initialisierung des EmailAutomationService
- Instance wird global unter `window.emailAutomationService` verfügbar

## Verwendung

### 1. Konfiguration

1. Navigiere zu **Einstellungen**
2. Scrolle zu **"🤖 Automatische E-Mail-Verarbeitung"**
3. Aktiviere die Checkbox
4. Passe das Antwort-Template an
5. Wähle ob manuelle Prüfung erforderlich ist
6. Klicke **"Speichern"**

### 2. Test durchführen

1. Klicke **"Test mit Beispiel-Email"** in den Settings
2. Optional: Klicke **"Beispiel laden"** für vorgefertigte Email
3. Oder gib eigene Beispiel-Email ein
4. Klicke **"Verarbeitung testen"**
5. Analyse und erstelltes Angebot werden angezeigt

### 3. Historie ansehen

1. Klicke **"📊 Historie anzeigen"** in den Settings
   ODER navigiere direkt zu **E-Mail Automation** (muss zum Menü hinzugefügt werden)
2. Sehe Statistiken und Verarbeitungs-Historie
3. Filtere nach Status
4. Klicke auf Einträge für Details

## Beispiel-Emails

Das System enthält 3 vorgefertigte Beispiele:

1. **Metalltor-Anfrage** (Max Mustermann)
   - Breite: 4m, Höhe: 1,80m
   - Geschätzter Wert: ~2.500€

2. **Zaun-Anfrage** (Sarah Schmidt)
   - Länge: 20m, Höhe: 1,50m
   - Geschätzter Wert: ~1.500€

3. **Treppe-Anfrage** (Thomas Weber)
   - Höhenunterschied: 3m, 15-20 Stufen
   - Geschätzter Wert: ~3.500€

## E-Mail Analyse-Algorithmus

Der Service extrahiert folgende Informationen:

### Kontaktdaten
- **Name:** Aus Grußformel oder "ich bin [Name]"
- **Telefon:** Pattern-Matching für Telefonnummern
- **E-Mail:** Standard Email-Pattern

### Projekt-Erkennung
Keywords für Projekttypen:
- "tor", "einfahrt" → Metalltor / Einfahrtstor
- "zaun", "geländer" → Zaun / Geländer
- "treppe" → Treppe
- "balkon" → Balkon
- "überdachung", "carport" → Überdachung / Carport

### Dimensionen
- Breite: "Breite: X m"
- Höhe: "Höhe: X m"

### Dringlichkeit
- "dringend", "eilig", "schnell" → hoch
- "zeit", "termin" → mittel
- Standard → normal

### Wert-Schätzung
Basis-Werte pro Projekttyp:
- Tor: 2.500€
- Zaun: 1.500€
- Treppe: 3.500€
- Balkon: 4.000€
- Überdachung: 3.000€
- Standard: 1.000€

Faktor +50% bei Breite > 4m

## Datenspeicherung

### Config Storage
```javascript
localStorage.setItem('email_automation_config', JSON.stringify({
    enabled: true/false,
    requireApproval: true/false,
    replyTemplate: "...",
    autoCreateQuote: true/false,
    autoSendReply: true/false
}));
```

### History Storage
```javascript
localStorage.setItem('email_automation_history', JSON.stringify([
    {
        id: "email_...",
        timestamp: "2026-02-15T...",
        type: "test" | "production",
        emailText: "...",
        status: "success" | "pending" | "failed",
        analysis: {
            customerName, phone, email,
            projectType, dimensions,
            urgency, estimatedValue
        },
        quote: { ... }
    }
]));
```

Maximale Historie: 100 Einträge (automatisch getrimmt)

## Navigation

Die E-Mail Automation View ist im Hauptmenü integriert:
- Position: Nach "E-Mails", vor "Dokumente"
- Badge zeigt Anzahl ausstehender (pending) Verarbeitungen
- Auto-Update beim App-Start und nach Verarbeitung

## Dashboard-Integration

Badge-Update-Funktion implementiert:
```javascript
async function updateEmailAutomationBadge() {
    const history = await emailAutomationService.getProcessedEmails(100);
    const pending = history.filter(e => e.status === 'pending').length;
    document.getElementById('email-automation-badge').textContent = pending;
}
```

Wird automatisch aufgerufen bei:
- App-Initialisierung
- Nach Test-Verarbeitung
- Nach Konfigurationsänderung

## Weitere Erweiterungsmöglichkeiten

### 3. Backend-Integration
Wenn Supabase konfiguriert:
- Speichere Historie in Cloud
- Triggere echte E-Mail-Antworten
- Webhook-Notifications

### 4. Erweiterte KI-Analyse
- Integration mit Gemini API für bessere Texterkennung
- OCR für E-Mail-Anhänge (Skizzen, Pläne)
- Automatische Materialberechnung

## Testing

1. Öffne http://localhost:8080
2. Gehe zu Einstellungen
3. Teste mit Beispiel-Emails
4. Prüfe Historie-View
5. Validiere Statistiken

## Produktions-Deployment

Die Implementierung ist vollständig client-seitig und benötigt keine zusätzlichen Dependencies. Einfach deployen und verwenden.

**Status:** ✅ Vollständig implementiert und ready for testing
