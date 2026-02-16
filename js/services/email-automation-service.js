/**
 * Email Automation Service
 * Verwaltung der automatischen E-Mail-Verarbeitung
 */

class EmailAutomationService {
    constructor() {
        this.initialized = false;
        this.storageKey = 'email_automation_config';
        this.historyKey = 'email_automation_history';
        this.defaultConfig = {
            enabled: false,
            requireApproval: true,
            inboundAddress: 'anfragen@handwerkflow.de',
            replyTemplate: `Sehr geehrte/r {kunde.name},

vielen Dank für Ihre Anfrage. Anbei erhalten Sie unser Angebot.

Bei Fragen stehen wir Ihnen gerne zur Verfügung.

Mit freundlichen Grüßen
{firma.name}`,
            autoCreateQuote: true,
            autoSendReply: false,
            notifyOnNewEmail: true
        };
    }

    async init() {
        if (this.initialized) {return;}

        // Ensure config exists
        const config = this.getConfig();
        if (!config) {
            this.setConfig(this.defaultConfig);
        }

        this.initialized = true;
        console.log('✅ EmailAutomationService initialized');
    }

    /**
     * Hole aktuelle Konfiguration
     */
    getConfig() {
        const stored = localStorage.getItem(this.storageKey);
        if (!stored) {return { ...this.defaultConfig };}

        try {
            return { ...this.defaultConfig, ...JSON.parse(stored) };
        } catch (e) {
            console.error('Error loading email automation config:', e);
            return { ...this.defaultConfig };
        }
    }

    /**
     * Speichere Konfiguration
     */
    async setConfig(config) {
        try {
            const merged = { ...this.defaultConfig, ...config };
            localStorage.setItem(this.storageKey, JSON.stringify(merged));

            // Event für UI-Updates
            window.dispatchEvent(new CustomEvent('emailAutomationConfigChanged', {
                detail: merged
            }));

            return { success: true, config: merged };
        } catch (e) {
            console.error('Error saving email automation config:', e);
            return { success: false, error: e.message };
        }
    }

    /**
     * Hole Verarbeitungs-Historie
     */
    async getProcessedEmails(limit = 50) {
        const stored = localStorage.getItem(this.historyKey);
        if (!stored) {return [];}

        try {
            const history = JSON.parse(stored);
            return history.slice(0, limit);
        } catch (e) {
            console.error('Error loading email history:', e);
            return [];
        }
    }

    /**
     * Füge Email zur Historie hinzu
     */
    async addToHistory(entry) {
        try {
            const history = await this.getProcessedEmails(1000);
            history.unshift({
                ...entry,
                id: this.generateId(),
                timestamp: new Date().toISOString()
            });

            // Behalte nur letzten 100 Einträge
            const trimmed = history.slice(0, 100);
            localStorage.setItem(this.historyKey, JSON.stringify(trimmed));

            return { success: true, entry };
        } catch (e) {
            console.error('Error adding to history:', e);
            return { success: false, error: e.message };
        }
    }

    /**
     * Test-Modus: Verarbeite Beispiel-Email
     */
    async testProcessing(emailText) {
        try {
            // Simuliere KI-Analyse
            const analysis = await this.analyzeEmail(emailText);

            // Erstelle Test-Angebot
            const quote = await this.createQuoteFromAnalysis(analysis);

            // Füge zur Historie hinzu (mit Test-Flag)
            await this.addToHistory({
                type: 'test',
                emailText: emailText.substring(0, 200),
                analysis,
                quote,
                status: 'success'
            });

            return {
                success: true,
                analysis,
                quote,
                message: 'Test erfolgreich durchgeführt'
            };
        } catch (e) {
            console.error('Test processing error:', e);
            return {
                success: false,
                error: e.message
            };
        }
    }

    /**
     * Analysiere E-Mail Inhalt
     */
    async analyzeEmail(emailText) {
        // Extrahiere wichtige Informationen aus der E-Mail
        const analysis = {
            sender: this.extractSender(emailText),
            customerName: this.extractCustomerName(emailText),
            phone: this.extractPhone(emailText),
            email: this.extractEmail(emailText),
            projectType: this.detectProjectType(emailText),
            dimensions: this.extractDimensions(emailText),
            urgency: this.detectUrgency(emailText),
            estimatedValue: this.estimateValue(emailText)
        };

        return analysis;
    }

    /**
     * Erstelle Angebot aus Analyse
     */
    async createQuoteFromAnalysis(analysis) {
        const quote = {
            title: `Angebot für ${analysis.projectType}`,
            customer: {
                name: analysis.customerName || 'Unbekannt',
                email: analysis.email || '',
                phone: analysis.phone || ''
            },
            items: this.generateQuoteItems(analysis),
            total: analysis.estimatedValue || 0,
            status: 'Entwurf',
            created: new Date().toISOString()
        };

        return quote;
    }

    /**
     * Generiere Angebots-Positionen
     */
    generateQuoteItems(analysis) {
        const items = [];

        if (analysis.projectType) {
            items.push({
                description: analysis.projectType,
                quantity: 1,
                unit: 'Stk',
                price: analysis.estimatedValue || 0
            });
        }

        if (analysis.dimensions && analysis.dimensions.width && analysis.dimensions.height) {
            items.push({
                description: `Maße: ${analysis.dimensions.width} x ${analysis.dimensions.height}`,
                quantity: 1,
                unit: 'pausch',
                price: 0
            });
        }

        return items;
    }

    /**
     * Statistiken abrufen
     */
    async getStats() {
        const history = await this.getProcessedEmails(1000);
        const config = this.getConfig();

        const stats = {
            totalProcessed: history.length,
            successful: history.filter(e => e.status === 'success').length,
            failed: history.filter(e => e.status === 'failed').length,
            pending: history.filter(e => e.status === 'pending').length,
            quotesCreated: history.filter(e => e.quote).length,
            automationEnabled: config.enabled,
            lastProcessed: history[0]?.timestamp || null
        };

        return stats;
    }

    // ===== Hilfsfunktionen für E-Mail-Analyse =====

    extractSender(text) {
        const senderMatch = text.match(/Von:\s*(.+?)(?:\n|$)/i);
        return senderMatch ? senderMatch[1].trim() : null;
    }

    extractCustomerName(text) {
        // Suche nach "Mit freundlichen Grüßen\n[Name]"
        const greetingMatch = text.match(/(?:Freundlichen Grüßen|Grüße|MfG)\s*\n\s*([^\n]+)/i);
        if (greetingMatch) {return greetingMatch[1].trim();}

        // Suche nach "ich bin [Name]"
        const introMatch = text.match(/ich bin\s+([A-Z][a-zäöüß]+\s+[A-Z][a-zäöüß]+)/i);
        if (introMatch) {return introMatch[1].trim();}

        return null;
    }

    extractPhone(text) {
        const phoneMatch = text.match(/(?:Tel|Telefon|Phone)[:\s]*([+\d\s\-\/()]{8,})/i);
        return phoneMatch ? phoneMatch[1].trim() : null;
    }

    extractEmail(text) {
        const emailMatch = text.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/i);
        return emailMatch ? emailMatch[1].trim() : null;
    }

    detectProjectType(text) {
        const lowerText = text.toLowerCase();

        if (lowerText.includes('tor') || lowerText.includes('einfahrt')) {
            return 'Metalltor / Einfahrtstor';
        }
        if (lowerText.includes('zaun') || lowerText.includes('geländer')) {
            return 'Zaun / Geländer';
        }
        if (lowerText.includes('treppe')) {
            return 'Treppe';
        }
        if (lowerText.includes('balkon')) {
            return 'Balkon';
        }
        if (lowerText.includes('überdachung') || lowerText.includes('carport')) {
            return 'Überdachung / Carport';
        }

        return 'Metallbau-Projekt';
    }

    extractDimensions(text) {
        const dimensions = {};

        // Suche nach Breite
        const widthMatch = text.match(/Breite[:\s]*(\d+(?:[.,]\d+)?)\s*(?:m|meter)?/i);
        if (widthMatch) {
            dimensions.width = widthMatch[1].replace(',', '.') + 'm';
        }

        // Suche nach Höhe
        const heightMatch = text.match(/H[öo]he[:\s]*(\d+(?:[.,]\d+)?)\s*(?:m|meter)?/i);
        if (heightMatch) {
            dimensions.height = heightMatch[1].replace(',', '.') + 'm';
        }

        return dimensions;
    }

    detectUrgency(text) {
        const lowerText = text.toLowerCase();

        if (lowerText.includes('dringend') || lowerText.includes('eilig') || lowerText.includes('schnell')) {
            return 'hoch';
        }
        if (lowerText.includes('zeit') || lowerText.includes('termin')) {
            return 'mittel';
        }

        return 'normal';
    }

    estimateValue(text) {
        // Sehr vereinfachte Schätzung basierend auf Projekttyp
        const projectType = this.detectProjectType(text);
        const dimensions = this.extractDimensions(text);

        let baseValue = 1000; // Basis

        if (projectType.includes('Tor')) {baseValue = 2500;}
        if (projectType.includes('Zaun')) {baseValue = 1500;}
        if (projectType.includes('Treppe')) {baseValue = 3500;}
        if (projectType.includes('Balkon')) {baseValue = 4000;}
        if (projectType.includes('Überdachung')) {baseValue = 3000;}

        // Erhöhe Wert basierend auf Dimensionen
        if (dimensions.width) {
            const width = parseFloat(dimensions.width);
            if (width > 4) {baseValue *= 1.5;}
        }

        return baseValue;
    }

    generateId() {
        return 'email_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Lösche alte Historie
     */
    async clearHistory() {
        localStorage.removeItem(this.historyKey);
        return { success: true };
    }
}

// Global verfügbar machen
window.EmailAutomationService = EmailAutomationService;
