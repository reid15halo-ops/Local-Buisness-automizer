# Integration Guide - E-Mail-zu-Angebot-Automation

## Frontend Integration

### 1. Dashboard Widget für E-Mail-Aktivitäten

Füge im Hauptdashboard ein Widget hinzu:

```javascript
// js/ui/email-automation-widget.js

class EmailAutomationWidget {
    constructor() {
        this.supabase = window.supabaseClient
    }

    async render(container) {
        const stats = await this.getStats()
        const recentEmails = await this.getRecentEmails()

        container.innerHTML = `
            <div class="email-automation-widget">
                <h3>📧 E-Mail Automation</h3>

                <div class="stats-grid">
                    <div class="stat-card">
                        <span class="stat-value">${stats.total_emails}</span>
                        <span class="stat-label">Empfangene E-Mails</span>
                    </div>
                    <div class="stat-card">
                        <span class="stat-value">${stats.processed_emails}</span>
                        <span class="stat-label">Verarbeitet</span>
                    </div>
                    <div class="stat-card">
                        <span class="stat-value">${stats.total_angebote}</span>
                        <span class="stat-label">Angebote erstellt</span>
                    </div>
                    <div class="stat-card">
                        <span class="stat-value">${this.formatCurrency(stats.total_value)}</span>
                        <span class="stat-label">Gesamt-Volumen</span>
                    </div>
                </div>

                <div class="recent-emails">
                    <h4>Letzte E-Mails</h4>
                    ${recentEmails.map(email => this.renderEmailCard(email)).join('')}
                </div>
            </div>
        `
    }

    async getStats() {
        const { data, error } = await this.supabase.rpc('get_automation_stats', {
            user_uuid: window.currentUser?.id,
            days: 30
        })

        if (error) {
            console.error('Failed to load stats:', error)
            return { total_emails: 0, processed_emails: 0, total_angebote: 0, total_value: 0 }
        }

        return data[0]
    }

    async getRecentEmails(limit = 5) {
        const { data, error } = await this.supabase
            .from('automation_dashboard')
            .select('*')
            .limit(limit)

        if (error) {
            console.error('Failed to load emails:', error)
            return []
        }

        return data
    }

    renderEmailCard(email) {
        const statusIcon = email.processed
            ? (email.error ? '⚠️' : '✅')
            : '⏳'

        const statusText = email.processed
            ? (email.error ? 'Fehler' : 'Verarbeitet')
            : 'In Bearbeitung'

        return `
            <div class="email-card ${email.error ? 'error' : ''}">
                <div class="email-header">
                    <span class="status-icon">${statusIcon}</span>
                    <span class="email-from">${email.from_name || email.from_email}</span>
                    <span class="email-date">${this.formatDate(email.received_at)}</span>
                </div>
                <div class="email-subject">${email.subject}</div>
                ${email.angebot_nummer ? `
                    <div class="email-result">
                        <span class="tag">Angebot ${email.angebot_nummer}</span>
                        <span class="amount">${this.formatCurrency(email.brutto)}</span>
                    </div>
                ` : `
                    <div class="email-status">${statusText}</div>
                `}
                ${email.error ? `
                    <div class="email-error">${email.error}</div>
                ` : ''}
            </div>
        `
    }

    formatCurrency(amount) {
        return new Intl.NumberFormat('de-DE', {
            style: 'currency',
            currency: 'EUR'
        }).format(amount || 0)
    }

    formatDate(dateString) {
        const date = new Date(dateString)
        const now = new Date()
        const diffMs = now - date
        const diffMins = Math.floor(diffMs / 60000)

        if (diffMins < 60) return `vor ${diffMins} Min.`
        if (diffMins < 1440) return `vor ${Math.floor(diffMins / 60)} Std.`
        return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })
    }
}

// Create global instance
window.emailAutomationWidget = new EmailAutomationWidget()
```

### 2. CSS Styling

```css
/* css/email-automation-widget.css */

.email-automation-widget {
    background: white;
    border-radius: 8px;
    padding: 20px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 15px;
    margin: 20px 0;
}

.stat-card {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 20px;
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
}

.stat-value {
    font-size: 2em;
    font-weight: bold;
    margin-bottom: 5px;
}

.stat-label {
    font-size: 0.9em;
    opacity: 0.9;
}

.recent-emails {
    margin-top: 30px;
}

.email-card {
    background: #f9f9f9;
    border-left: 3px solid #667eea;
    padding: 15px;
    margin: 10px 0;
    border-radius: 4px;
    transition: transform 0.2s;
}

.email-card:hover {
    transform: translateX(5px);
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.email-card.error {
    border-left-color: #e74c3c;
    background: #fff5f5;
}

.email-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 5px;
}

.status-icon {
    font-size: 1.2em;
}

.email-from {
    font-weight: bold;
    flex: 1;
}

.email-date {
    font-size: 0.85em;
    color: #7f8c8d;
}

.email-subject {
    color: #2c3e50;
    margin: 5px 0;
}

.email-result {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 10px;
}

.tag {
    background: #3498db;
    color: white;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 0.85em;
}

.amount {
    font-weight: bold;
    color: #27ae60;
    font-size: 1.1em;
}

.email-error {
    color: #e74c3c;
    font-size: 0.9em;
    margin-top: 5px;
    padding: 8px;
    background: white;
    border-radius: 4px;
}
```

### 3. Integration in index.html

```html
<!-- In index.html nach dem Dashboard-Header -->

<div id="email-automation-container"></div>

<script>
// Nach dem DOM-Load
document.addEventListener('DOMContentLoaded', async () => {
    const container = document.getElementById('email-automation-container')
    await window.emailAutomationWidget.render(container)

    // Auto-refresh alle 30 Sekunden
    setInterval(async () => {
        await window.emailAutomationWidget.render(container)
    }, 30000)
})
</script>
```

## Backend Services Integration

### 1. Service für manuelle Nachbearbeitung

```javascript
// js/services/email-automation-service.js

class EmailAutomationService {
    constructor() {
        this.supabase = window.supabaseClient
    }

    /**
     * Holt unverarbeitete E-Mails
     */
    async getUnprocessedEmails() {
        const { data, error } = await this.supabase
            .from('inbound_emails')
            .select('*')
            .eq('processed', false)
            .order('received_at', { ascending: false })

        if (error) throw error
        return data
    }

    /**
     * Holt E-Mails mit Fehlern
     */
    async getFailedEmails() {
        const { data, error } = await this.supabase
            .from('inbound_emails')
            .select('*')
            .not('error', 'is', null)
            .order('received_at', { ascending: false })

        if (error) throw error
        return data
    }

    /**
     * Manuelles Erstellen eines Angebots aus E-Mail
     */
    async createManualOffer(emailId, offerData) {
        // 1. E-Mail laden
        const { data: email } = await this.supabase
            .from('inbound_emails')
            .select('*')
            .eq('id', emailId)
            .single()

        // 2. Kunde anlegen (falls noch nicht vorhanden)
        let kundeId
        const { data: existingKunde } = await this.supabase
            .from('kunden')
            .select('id')
            .eq('email', email.from_email)
            .single()

        if (existingKunde) {
            kundeId = existingKunde.id
        } else {
            const { data: newKunde } = await this.supabase
                .from('kunden')
                .insert({
                    name: offerData.kundeName,
                    email: email.from_email,
                    telefon: offerData.telefon,
                    user_id: window.currentUser.id
                })
                .select()
                .single()

            kundeId = newKunde.id
        }

        // 3. Anfrage erstellen
        const anfrageNummer = `ANF-${Date.now()}`
        const { data: anfrage } = await this.supabase
            .from('anfragen')
            .insert({
                nummer: anfrageNummer,
                kunde_id: kundeId,
                leistungsart: offerData.leistungsart,
                beschreibung: offerData.beschreibung,
                status: 'neu',
                quelle: 'email-manual',
                user_id: window.currentUser.id
            })
            .select()
            .single()

        // 4. Angebot erstellen
        const angebotNummer = `ANG-${Date.now()}`
        const { data: angebot } = await this.supabase
            .from('angebote')
            .insert({
                nummer: angebotNummer,
                anfrage_id: anfrage.id,
                kunde_id: kundeId,
                positionen: offerData.positionen,
                netto: offerData.netto,
                mwst: offerData.mwst,
                brutto: offerData.brutto,
                status: 'entwurf',
                user_id: window.currentUser.id
            })
            .select()
            .single()

        // 5. E-Mail als verarbeitet markieren
        await this.supabase
            .from('inbound_emails')
            .update({
                processed: true,
                anfrage_id: anfrage.id,
                angebot_id: angebot.id
            })
            .eq('id', emailId)

        return {
            kunde: kundeId,
            anfrage: anfrage.id,
            angebot: angebot.id
        }
    }

    /**
     * E-Mail als "ignoriert" markieren
     */
    async ignoreEmail(emailId) {
        await this.supabase
            .from('inbound_emails')
            .update({
                processed: true,
                error: 'Manually ignored'
            })
            .eq('id', emailId)
    }

    /**
     * Statistiken abrufen
     */
    async getStats(days = 30) {
        const { data } = await this.supabase.rpc('get_automation_stats', {
            user_uuid: window.currentUser?.id,
            days: days
        })

        return data?.[0] || {}
    }
}

window.emailAutomationService = new EmailAutomationService()
```

### 2. Realtime Notifications

```javascript
// Realtime-Subscription für neue E-Mails
const emailChannel = supabase
    .channel('inbound_emails')
    .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'inbound_emails'
    }, (payload) => {
        // Benachrichtigung anzeigen
        showNotification({
            title: '📧 Neue E-Mail empfangen',
            message: `Von: ${payload.new.from_name || payload.new.from_email}`,
            type: 'info'
        })

        // Widget aktualisieren
        window.emailAutomationWidget?.render(
            document.getElementById('email-automation-container')
        )
    })
    .subscribe()
```

## Testing

### Lokales Testing mit Supabase CLI

```bash
# Edge Function lokal starten
supabase functions serve process-inbound-email

# Test-Request senden
curl -X POST http://localhost:54321/functions/v1/process-inbound-email \
  -H "Content-Type: application/json" \
  -d '{
    "from": {
      "name": "Test User",
      "email": "test@example.com"
    },
    "to": "anfragen@handwerkflow.de",
    "subject": "Test",
    "text": "Ich brauche ein Angebot für ein Metalltor."
  }'
```

### E2E Test mit echten E-Mails

1. **Resend Testing Domain nutzen**:
   - Temporäre Test-Domain in Resend
   - E-Mails an `test@your-test-domain.com` senden

2. **Mailhog für lokale Tests**:
   ```bash
   docker run -d -p 1025:1025 -p 8025:8025 mailhog/mailhog
   ```

3. **Monitoring**:
   ```bash
   # Logs in Echtzeit
   supabase functions logs process-inbound-email --follow
   ```

## Produktions-Monitoring

### 1. Alert Rules erstellen

```sql
-- Alert bei hoher Fehlerrate
CREATE OR REPLACE FUNCTION check_email_error_rate()
RETURNS TRIGGER AS $$
BEGIN
    IF (
        SELECT COUNT(*)
        FROM inbound_emails
        WHERE received_at > NOW() - INTERVAL '1 hour'
          AND error IS NOT NULL
    ) > 5 THEN
        -- Sende Alert (via Edge Function)
        PERFORM net.http_post(
            url := 'https://your-project.supabase.co/functions/v1/send-alert',
            body := jsonb_build_object(
                'type', 'high_error_rate',
                'count', 5
            )
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER email_error_alert
    AFTER INSERT ON inbound_emails
    FOR EACH ROW
    EXECUTE FUNCTION check_email_error_rate();
```

### 2. Grafana Dashboard

Verbinde Supabase mit Grafana für Visualisierung:
- E-Mails pro Tag
- Erfolgsrate
- Durchschnittliche Angebotswerte
- Response Time

## FAQ

**Q: Was passiert bei Gemini API-Ausfällen?**
A: Automatischer Fallback auf einfache Bestätigungs-E-Mail. E-Mail wird gespeichert für manuelle Nachbearbeitung.

**Q: Kann ich die Preiskalkulation anpassen?**
A: Ja, bearbeite den Gemini-Prompt in `index.ts` oder implementiere eigene Logik basierend auf `work-estimation-service.js`.

**Q: Wie verhindere ich Spam?**
A: Resend hat built-in Spam-Filter. Zusätzlich kannst du Allowlist/Blocklist implementieren.

**Q: Werden Anhänge verarbeitet?**
A: Aktuell nur Text. Bild-Analyse kann mit Gemini Vision API ergänzt werden.
