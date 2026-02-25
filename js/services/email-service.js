/* ============================================
   Email Service - Inbox Parsing & Management
   Smart Email Processing für kleine Unternehmen
   ============================================ */

class EmailService {
    constructor() {
        this.emails = JSON.parse(localStorage.getItem('freyai_emails') || '[]');
        this.emailConfig = JSON.parse(localStorage.getItem('freyai_email_config') || '{}');
        this.templates = this.loadDefaultTemplates();
        
        // Email categorization keywords
        this.categoryKeywords = {
            anfrage: ['anfrage', 'angebot', 'preis', 'kosten', 'interesse', 'anfordern', 'bitte um'],
            rechnung: ['rechnung', 'zahlung', 'überweisung', 'bezahlung', 'invoice'],
            beschwerde: ['beschwerde', 'problem', 'fehler', 'mangel', 'reklamation', 'unzufrieden'],
            termin: ['termin', 'meeting', 'besprechung', 'treffen', 'uhrzeit', 'datum'],
            lieferant: ['lieferung', 'bestellung', 'versand', 'liefertermin', 'ware'],
            support: ['hilfe', 'frage', 'support', 'unterstützung', 'wie funktioniert']
        };
        
        // Action keywords for task generation
        this.actionKeywords = [
            'bitte', 'dringend', 'bis', 'deadline', 'frist', 
            'erledigen', 'prüfen', 'senden', 'anrufen', 'zurückrufen',
            'bestellen', 'reparieren', 'installieren', 'montieren'
        ];
    }

    // ============================================
    // Email Configuration
    // ============================================
    setEmailConfig(config) {
        this.emailConfig = {
            imapHost: config.imapHost || '',
            imapPort: config.imapPort || 993,
            smtpHost: config.smtpHost || '',
            smtpPort: config.smtpPort || 587,
            email: config.email || '',
            password: config.password || '',
            useTLS: config.useTLS !== false
        };
        this.saveConfig();
    }

    getEmailConfig() {
        return this.emailConfig;
    }

    isConfigured() {
        return !!(this.emailConfig.email && this.emailConfig.imapHost);
    }

    // ============================================
    // Email Fetching (Demo Mode)
    // ============================================
    async fetchEmails() {
        if (!this.isConfigured()) {
            // Return demo emails for testing
            return this.getDemoEmails();
        }
        
        // In a real implementation, this would use a backend service
        // or WebSocket to an IMAP proxy (browser can't do IMAP directly)
        console.log('Email fetch would use IMAP:', this.emailConfig.imapHost);
        return this.getDemoEmails();
    }

    getDemoEmails() {
        const now = new Date();
        return [
            {
                id: 'demo-1',
                from: 'max.mueller@firma.de',
                fromName: 'Max Müller',
                subject: 'Anfrage: Metalltor für Einfahrt',
                body: `Sehr geehrte Damen und Herren,

ich benötige ein Doppelflügeltor für unsere Einfahrt (Breite ca. 4m, Höhe 1,80m).
Bitte senden Sie mir ein Angebot zu.

Mit freundlichen Grüßen
Max Müller
Tel: 0171-1234567`,
                date: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
                read: false,
                category: 'anfrage',
                attachments: []
            },
            {
                id: 'demo-2',
                from: 'buchhaltung@supplier.de',
                fromName: 'Metallhandel Schmidt',
                subject: 'Rechnung Nr. 2026-0142',
                body: `Sehr geehrter Kunde,

anbei übersenden wir Ihnen die Rechnung für Ihre letzte Bestellung.

Rechnungsbetrag: 1.234,56 €
Fällig bis: 15.02.2026

Mit freundlichen Grüßen
Metallhandel Schmidt`,
                date: new Date(now - 5 * 60 * 60 * 1000).toISOString(),
                read: false,
                category: 'lieferant',
                attachments: ['Rechnung_2026-0142.pdf']
            },
            {
                id: 'demo-3',
                from: 'peter.schmidt@web.de',
                fromName: 'Peter Schmidt',
                subject: 'Dringend: Termin für Reparatur',
                body: `Hallo,

unser Garagentor klemmt und lässt sich nicht mehr öffnen.
Können Sie bitte dringend bis morgen einen Techniker schicken?

Adresse: Hauptstraße 42, 63456 Hanau
Telefon: 06181-987654

Danke!
Peter Schmidt`,
                date: new Date(now - 1 * 60 * 60 * 1000).toISOString(),
                read: false,
                category: 'anfrage',
                attachments: []
            },
            {
                id: 'demo-4',
                from: 'info@versicherung.de',
                fromName: 'ABC Versicherung',
                subject: 'Ihre Anfrage zur Betriebshaftpflicht',
                body: `Sehr geehrte Damen und Herren,

vielen Dank für Ihre Anfrage. Bitte prüfen Sie das beigefügte Angebot.
Frist zur Annahme: 31.01.2026

Mit freundlichen Grüßen
ABC Versicherung AG`,
                date: new Date(now - 24 * 60 * 60 * 1000).toISOString(),
                read: true,
                category: 'support',
                attachments: ['Versicherungsangebot.pdf']
            }
        ];
    }

    // ============================================
    // Email Parsing
    // ============================================
    parseEmail(rawEmail) {
        // Extract structured data from email
        const parsed = {
            id: rawEmail.id || this.generateId(),
            from: rawEmail.from,
            fromName: rawEmail.fromName || this.extractName(rawEmail.from),
            subject: rawEmail.subject,
            body: rawEmail.body,
            date: rawEmail.date || new Date().toISOString(),
            read: rawEmail.read || false,
            category: rawEmail.category || this.categorizeEmail(rawEmail),
            attachments: rawEmail.attachments || [],
            extractedData: this.extractData(rawEmail)
        };
        
        return parsed;
    }

    extractName(email) {
        // Extract name from email address
        const match = email.match(/^([^@]+)@/);
        if (match) {
            return match[1].split('.').map(s => 
                s.charAt(0).toUpperCase() + s.slice(1)
            ).join(' ');
        }
        return email;
    }

    extractData(email) {
        const text = `${email.subject} ${email.body}`.toLowerCase();
        const data = {
            phoneNumbers: [],
            emails: [],
            dates: [],
            amounts: [],
            addresses: [],
            actionItems: []
        };

        // Extract phone numbers
        const phoneRegex = /(?:\+49|0049|0)[\s.-]?(\d{2,4})[\s.-]?(\d{3,4})[\s.-]?(\d{3,5})/g;
        let match;
        while ((match = phoneRegex.exec(email.body)) !== null) {
            data.phoneNumbers.push(match[0].replace(/\s/g, ''));
        }

        // Extract email addresses
        const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
        while ((match = emailRegex.exec(email.body)) !== null) {
            if (match[0] !== email.from) {
                data.emails.push(match[0]);
            }
        }

        // Extract amounts (Euro)
        const amountRegex = /(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)\s*€|€\s*(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)/g;
        while ((match = amountRegex.exec(email.body)) !== null) {
            const amount = (match[1] || match[2]).replace('.', '').replace(',', '.');
            data.amounts.push(parseFloat(amount));
        }

        // Extract dates (German format)
        const dateRegex = /(\d{1,2})\.(\d{1,2})\.(\d{2,4})/g;
        while ((match = dateRegex.exec(email.body)) !== null) {
            const year = match[3].length === 2 ? '20' + match[3] : match[3];
            data.dates.push(`${year}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`);
        }

        // Extract action items
        this.actionKeywords.forEach(keyword => {
            if (text.includes(keyword)) {
                const sentences = email.body.split(/[.!?\n]/);
                sentences.forEach(sentence => {
                    if (sentence.toLowerCase().includes(keyword)) {
                        data.actionItems.push(sentence.trim());
                    }
                });
            }
        });

        return data;
    }

    // ============================================
    // Email Categorization
    // ============================================
    categorizeEmail(email) {
        const text = `${email.subject} ${email.body}`.toLowerCase();
        let bestCategory = 'sonstiges';
        let maxScore = 0;

        for (const [category, keywords] of Object.entries(this.categoryKeywords)) {
            let score = 0;
            keywords.forEach(keyword => {
                if (text.includes(keyword)) {
                    score++;
                }
            });
            if (score > maxScore) {
                maxScore = score;
                bestCategory = category;
            }
        }

        return bestCategory;
    }

    getCategoryIcon(category) {
        const icons = {
            anfrage: '📥',
            rechnung: '💰',
            beschwerde: '⚠️',
            termin: '📅',
            lieferant: '📦',
            support: '❓',
            sonstiges: '📧'
        };
        return icons[category] || '📧';
    }

    getCategoryLabel(category) {
        const labels = {
            anfrage: 'Kundenanfrage',
            rechnung: 'Rechnung',
            beschwerde: 'Beschwerde',
            termin: 'Terminanfrage',
            lieferant: 'Lieferant',
            support: 'Support',
            sonstiges: 'Sonstiges'
        };
        return labels[category] || category;
    }

    // ============================================
    // Task Generation from Email
    // ============================================
    createTaskFromEmail(email) {
        const parsed = this.parseEmail(email);
        
        // Determine priority based on keywords
        let priority = 'normal';
        const urgentKeywords = ['dringend', 'urgent', 'asap', 'sofort', 'eilig'];
        if (urgentKeywords.some(k => email.body.toLowerCase().includes(k))) {
            priority = 'high';
        }

        // Determine due date
        let dueDate = null;
        if (parsed.extractedData.dates.length > 0) {
            dueDate = parsed.extractedData.dates[0];
        } else if (priority === 'high') {
            // High priority = due tomorrow
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            dueDate = tomorrow.toISOString().split('T')[0];
        }

        const task = {
            id: 'task-' + Date.now(),
            title: this.generateTaskTitle(parsed),
            description: parsed.extractedData.actionItems.join('\n') || parsed.body.substring(0, 200),
            priority: priority,
            status: 'offen',
            dueDate: dueDate,
            source: 'email',
            sourceId: parsed.id,
            customer: {
                name: parsed.fromName,
                email: parsed.from,
                phone: parsed.extractedData.phoneNumbers[0] || null
            },
            createdAt: new Date().toISOString()
        };

        return task;
    }

    generateTaskTitle(parsedEmail) {
        const categoryActions = {
            anfrage: 'Anfrage bearbeiten',
            rechnung: 'Rechnung prüfen',
            beschwerde: 'Beschwerde bearbeiten',
            termin: 'Termin vereinbaren',
            lieferant: 'Lieferung prüfen',
            support: 'Anfrage beantworten',
            sonstiges: 'E-Mail bearbeiten'
        };
        
        const action = categoryActions[parsedEmail.category] || 'E-Mail bearbeiten';
        return `${action}: ${parsedEmail.fromName}`;
    }

    // ============================================
    // Create Anfrage from Email
    // ============================================
    createAnfrageFromEmail(email) {
        const parsed = this.parseEmail(email);
        
        // Detect service type from email content
        let leistungsart = 'sonstiges';
        const serviceKeywords = {
            metallbau: ['tor', 'zaun', 'geländer', 'treppe', 'balkon'],
            schweissen: ['schweißen', 'schweissen', 'schweiß'],
            reparatur: ['reparatur', 'reparieren', 'defekt', 'kaputt', 'klemmt'],
            montage: ['montage', 'montieren', 'installation', 'einbau'],
            wartung: ['wartung', 'warten', 'prüfung', 'inspektion']
        };

        const text = email.body.toLowerCase();
        for (const [service, keywords] of Object.entries(serviceKeywords)) {
            if (keywords.some(k => text.includes(k))) {
                leistungsart = service;
                break;
            }
        }

        const anfrage = {
            id: 'ANF-' + Date.now(),
            datum: new Date().toISOString(),
            status: 'neu',
            kunde: {
                name: parsed.fromName,
                email: parsed.from,
                telefon: parsed.extractedData.phoneNumbers[0] || '',
                firma: ''
            },
            leistungsart: leistungsart,
            beschreibung: parsed.body,
            quelle: 'email',
            quelleId: parsed.id
        };

        return anfrage;
    }

    // ============================================
    // Email Templates
    // ============================================
    loadDefaultTemplates() {
        return {
            angebot_followup: {
                name: 'Angebots-Nachverfolgung',
                subject: 'Rückfrage zu unserem Angebot {{angebotId}}',
                body: `Sehr geehrte(r) {{kundeName}},

vor einigen Tagen haben wir Ihnen unser Angebot {{angebotId}} zugesendet.

Haben Sie noch Fragen zu unserem Angebot? Gerne stehen wir Ihnen für ein persönliches Gespräch zur Verfügung.

Mit freundlichen Grüßen
FreyAI Visions`
            },
            termin_bestaetigung: {
                name: 'Terminbestätigung',
                subject: 'Terminbestätigung: {{datum}} um {{uhrzeit}}',
                body: `Sehr geehrte(r) {{kundeName}},

hiermit bestätigen wir Ihren Termin am {{datum}} um {{uhrzeit}} Uhr.

Adresse: {{adresse}}
Ansprechpartner: {{mitarbeiter}}

Bei Fragen erreichen Sie uns unter +49 6029 99 22 96 4.

Mit freundlichen Grüßen
FreyAI Visions`
            },
            rechnung_erinnerung: {
                name: 'Zahlungserinnerung',
                subject: 'Freundliche Erinnerung: Rechnung {{rechnungId}}',
                body: `Sehr geehrte(r) {{kundeName}},

bei der Durchsicht unserer Buchhaltung ist uns aufgefallen, dass die Rechnung {{rechnungId}} vom {{datum}} über {{betrag}} € noch offen ist.

Wir bitten Sie, den Betrag in den nächsten Tagen zu überweisen.

Mit freundlichen Grüßen
FreyAI Visions`
            }
        };
    }

    fillTemplate(templateKey, data) {
        const template = this.templates[templateKey];
        if (!template) {return null;}

        let subject = template.subject;
        let body = template.body;

        for (const [key, value] of Object.entries(data)) {
            const placeholder = `{{${key}}}`;
            subject = subject.replace(new RegExp(placeholder, 'g'), value);
            body = body.replace(new RegExp(placeholder, 'g'), value);
        }

        return { subject, body };
    }

    // ============================================
    // Outgoing Email (via VPS Email Relay)
    // ============================================

    /**
     * Send an email through the configured VPS email relay.
     *
     * Relay URL and HMAC secret are read from window.APP_CONFIG (populated
     * by config/app-config.js from .env) with a localStorage fallback for
     * installations that configure via the setup wizard.
     *
     * @param {string} to        - Recipient email address
     * @param {string} subject   - Email subject line
     * @param {string} html      - HTML body (plain text auto-derived for non-HTML clients)
     * @param {Object} [opts]    - Optional overrides: { from, fromName, replyTo, attachments }
     * @returns {Promise<{success:boolean, messageId?:string, error?:string}>}
     */
    async sendEmail(to, subject, html, opts = {}) {
        const relayUrl = window.APP_CONFIG?.EMAIL_RELAY_URL
            || localStorage.getItem('freyai_email_relay_url');
        const secret   = window.APP_CONFIG?.EMAIL_RELAY_SECRET
            || localStorage.getItem('freyai_email_relay_secret');
        const companyInfo = window.companySettings
            ? await window.companySettings.load()
            : {};

        if (!relayUrl) {
            console.warn('[EmailService] EMAIL_RELAY_URL not configured — email not sent.');
            return { success: false, error: 'E-Mail-Relay nicht konfiguriert.' };
        }

        const fromAddress = opts.from
            || companyInfo?.noReplyEmail
            || window.APP_CONFIG?.COMPANY_EMAIL
            || localStorage.getItem('freyai_company_email')
            || '';
        const fromName = opts.fromName
            || companyInfo?.companyName
            || window.APP_CONFIG?.COMPANY_NAME
            || 'FreyAI Visions';

        const payload = {
            to,
            subject,
            html,
            from: fromAddress,
            fromName,
            ...(opts.replyTo  ? { replyTo: opts.replyTo } : {}),
            ...(opts.attachments ? { attachments: opts.attachments } : {})
        };

        try {
            const headers = {
                'Content-Type': 'application/json'
            };
            if (secret) {
                headers['X-Relay-Secret'] = secret;
            }

            const response = await fetch(`${relayUrl}/send-email`, {
                method: 'POST',
                headers,
                body: JSON.stringify(payload)
            });

            const result = await response.json().catch(() => ({}));

            if (!response.ok) {
                const msg = result.error || `HTTP ${response.status}`;
                console.error('[EmailService] Relay error:', msg);
                return { success: false, error: msg };
            }

            console.log('[EmailService] Email sent:', subject, '→', to);
            if (window.storeService) {
                window.storeService.addActivity('📧', `E-Mail gesendet: ${subject} → ${to}`);
            }
            return { success: true, messageId: result.messageId };
        } catch (err) {
            console.error('[EmailService] Network error sending email:', err);
            return { success: false, error: err.message };
        }
    }

    /**
     * Send bulk emails (uses /send-bulk endpoint with relay-side rate limiting).
     * @param {Array<{to, subject, html}>} messages
     * @param {Object} [opts]
     * @returns {Promise<{sent:number, failed:number}>}
     */
    async sendBulkEmails(messages, opts = {}) {
        const relayUrl = window.APP_CONFIG?.EMAIL_RELAY_URL
            || localStorage.getItem('freyai_email_relay_url');
        const secret   = window.APP_CONFIG?.EMAIL_RELAY_SECRET
            || localStorage.getItem('freyai_email_relay_secret');

        if (!relayUrl) {
            return { sent: 0, failed: messages.length };
        }

        const companyInfo = window.companySettings
            ? await window.companySettings.load()
            : {};
        const fromAddress = opts.from || companyInfo?.noReplyEmail || '';
        const fromName    = opts.fromName || companyInfo?.companyName || 'FreyAI Visions';

        const enriched = messages.map(m => ({
            ...m,
            from: m.from || fromAddress,
            fromName: m.fromName || fromName
        }));

        const headers = { 'Content-Type': 'application/json' };
        if (secret) headers['X-Relay-Secret'] = secret;

        const response = await fetch(`${relayUrl}/send-bulk`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ messages: enriched })
        });
        const result = await response.json().catch(() => ({ sent: 0, failed: messages.length }));
        return { sent: result.sent ?? 0, failed: result.failed ?? messages.length };
    }

    // ============================================
    // Email Actions
    // ============================================
    markAsRead(emailId) {
        const email = this.emails.find(e => e.id === emailId);
        if (email) {
            email.read = true;
            this.save();
        }
    }

    archiveEmail(emailId) {
        const index = this.emails.findIndex(e => e.id === emailId);
        if (index !== -1) {
            this.emails[index].archived = true;
            this.save();
        }
    }

    deleteEmail(emailId) {
        this.emails = this.emails.filter(e => e.id !== emailId);
        this.save();
    }

    getUnreadCount() {
        return this.emails.filter(e => !e.read && !e.archived).length;
    }

    getEmailsByCategory(category) {
        return this.emails.filter(e => e.category === category && !e.archived);
    }

    getAllEmails() {
        return this.emails.filter(e => !e.archived);
    }

    addEmail(email) {
        const parsed = this.parseEmail(email);
        this.emails.unshift(parsed);
        this.save();
        return parsed;
    }

    // ============================================
    // Persistence
    // ============================================
    save() {
        localStorage.setItem('freyai_emails', JSON.stringify(this.emails));
    }

    saveConfig() {
        localStorage.setItem('freyai_email_config', JSON.stringify(this.emailConfig));
    }

    generateId() {
        return 'email-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    }

    // ============================================
    // Formatting Helpers
    // ============================================
    formatDate(dateStr) {
        const date = new Date(dateStr);
        return date.toLocaleDateString('de-DE', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    }

    formatDateTime(dateStr) {
        const date = new Date(dateStr);
        return date.toLocaleDateString('de-DE', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    getRelativeTime(dateStr) {
        const date = new Date(dateStr);
        const now = new Date();
        const diff = now - date;
        
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) {return 'Gerade eben';}
        if (minutes < 60) {return `vor ${minutes} Min.`;}
        if (hours < 24) {return `vor ${hours} Std.`;}
        if (days === 1) {return 'Gestern';}
        return this.formatDate(dateStr);
    }
}

// Create global instance
window.emailService = new EmailService();
