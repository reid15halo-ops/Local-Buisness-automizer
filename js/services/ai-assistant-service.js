/* ============================================
   AI Chat Assistant Service ("Ask FreyAI")
   Natural language queries about business data
   ============================================ */

class AiAssistantService {
    constructor() {
        this.conversationHistory = JSON.parse(localStorage.getItem('freyai_ai_history') || '[]');
        this.settings = JSON.parse(localStorage.getItem('freyai_ai_settings') || '{}');

        // Default settings
        if (!this.settings.language) {this.settings.language = 'de';}
        if (!this.settings.personality) {this.settings.personality = 'professional';}
    }

    // Ask a natural language question
    async ask(question) {
        const analysis = this.analyzeQuestion(question);

        // Get relevant data based on intent
        const data = await this.gatherData(analysis.intent, analysis.entities);

        // Generate response
        let response;
        if (window.geminiService && window.geminiService.apiKey) {
            response = await this.generateAiResponse(question, data, analysis);
        } else {
            response = this.generateRuleBasedResponse(question, data, analysis);
        }

        // Log conversation
        this.logConversation(question, response, analysis);

        return response;
    }

    // Analyze question for intent and entities
    analyzeQuestion(question) {
        const lower = question.toLowerCase();

        const intents = {
            revenue: ['umsatz', 'einnahmen', 'verdient', 'erlös'],
            expenses: ['ausgaben', 'kosten', 'gezahlt'],
            invoices: ['rechnungen', 'offen', 'unbezahlt', 'fällig'],
            customers: ['kunden', 'auftraggeber', 'wer'],
            appointments: ['termine', 'termin', 'kalender', 'heute', 'morgen'],
            tasks: ['aufgaben', 'todo', 'tasks', 'erledigen'],
            time: ['stunden', 'arbeitszeit', 'zeit'],
            profit: ['gewinn', 'profit', 'marge'],
            comparison: ['vergleich', 'versus', 'vs', 'mehr', 'weniger'],
            forecast: ['prognose', 'vorhersage', 'erwarten']
        };

        const timeframes = {
            today: ['heute'],
            yesterday: ['gestern'],
            thisWeek: ['diese woche', 'woche'],
            thisMonth: ['diesen monat', 'monat', 'aktueller monat'],
            lastMonth: ['letzten monat', 'vormonat'],
            thisYear: ['dieses jahr', 'jahr'],
            lastYear: ['letztes jahr', 'vorjahr']
        };

        // Detect intent
        let detectedIntent = 'general';
        for (const [intent, keywords] of Object.entries(intents)) {
            if (keywords.some(k => lower.includes(k))) {
                detectedIntent = intent;
                break;
            }
        }

        // Detect timeframe
        let timeframe = 'thisMonth';
        for (const [tf, keywords] of Object.entries(timeframes)) {
            if (keywords.some(k => lower.includes(k))) {
                timeframe = tf;
                break;
            }
        }

        // Extract entities (numbers, names, etc.)
        const numbers = question.match(/\d+/g) || [];
        const customerMention = this.extractCustomerName(lower);

        return {
            intent: detectedIntent,
            timeframe: timeframe,
            entities: {
                numbers: numbers.map(Number),
                customer: customerMention
            },
            originalQuestion: question
        };
    }

    // Extract customer name from question
    extractCustomerName(text) {
        // Look for patterns like "von Müller" or "für Schmidt GmbH"
        const patterns = [
            /(?:von|für|bei|mit)\s+([A-ZÄÖÜa-zäöüß]+(?:\s+(?:gmbh|ag|kg|ohg))?)/i,
            /kunde\s+([A-ZÄÖÜa-zäöüß]+)/i
        ];

        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match) {return match[1];}
        }
        return null;
    }

    // Gather relevant data based on intent
    async gatherData(intent, entities) {
        const data = {};

        switch (intent) {
            case 'revenue':
            case 'expenses':
            case 'profit':
                if (window.bookkeepingService) {
                    data.buchungen = window.bookkeepingService.buchungen || [];
                    data.summary = window.bookkeepingService.getMonthSummary
                        ? window.bookkeepingService.getMonthSummary()
                        : null;
                }
                if (typeof store !== 'undefined') {
                    data.rechnungen = store.rechnungen || [];
                }
                break;

            case 'invoices':
                if (typeof store !== 'undefined') {
                    data.rechnungen = store.rechnungen || [];
                    data.openInvoices = data.rechnungen.filter(r =>
                        r.status === 'offen' || r.status === 'versendet'
                    );
                }
                break;

            case 'customers':
                if (window.customerService) {
                    data.customers = window.customerService.getCustomers();
                }
                if (entities.customer) {
                    data.specificCustomer = window.customerService?.searchCustomers(entities.customer)[0];
                }
                break;

            case 'appointments':
                if (window.calendarService) {
                    const today = new Date().toISOString().split('T')[0];
                    data.todayAppointments = window.calendarService.getAppointmentsForDay(today);
                    data.allAppointments = window.calendarService.getAppointments();
                }
                break;

            case 'tasks':
                if (window.taskService) {
                    data.tasks = window.taskService.getTasks();
                    data.openTasks = data.tasks.filter(t => t.status !== 'done');
                }
                break;

            case 'time':
                if (window.timeTrackingService) {
                    data.timeEntries = window.timeTrackingService.getEntries();
                    data.todayHours = window.timeTrackingService.getTodayHours?.() || 0;
                }
                break;

            case 'forecast':
                if (window.cashFlowService) {
                    data.forecast = window.cashFlowService.generateForecast?.();
                }
                break;
        }

        return data;
    }

    // Generate AI response using Gemini
    async generateAiResponse(question, data, analysis) {
        const ap = JSON.parse(localStorage.getItem('freyai_admin_settings') || '{}');
        const companyName = ap.company_name || window.storeService?.state?.settings?.companyName || 'FreyAI Visions';
        const bizType = ap.business_type || window.storeService?.state?.settings?.businessType || 'Handwerksbetrieb';
        const systemPrompt = `Du bist ein hilfreicher Business-Assistent für einen deutschen ${bizType} (${companyName}).
Antworte kurz und präzise in deutscher Sprache.
Nutze die bereitgestellten Daten für deine Antwort.
Formatiere Geldbeträge als Euro (€).
Bei Fragen zu Daten, die nicht vorliegen, sage das klar.`;

        const dataContext = JSON.stringify(data, null, 2);

        const prompt = `${systemPrompt}

Relevante Geschäftsdaten:
${dataContext}

Frage: ${question}

Antworte direkt und hilfreich:`;

        try {
            const response = await window.geminiService.generateText(prompt);
            return {
                success: true,
                answer: response,
                intent: analysis.intent,
                source: 'ai'
            };
        } catch (error) {
            return this.generateRuleBasedResponse(question, data, analysis);
        }
    }

    // Generate rule-based response (fallback)
    generateRuleBasedResponse(question, data, analysis) {
        let answer = '';

        switch (analysis.intent) {
            case 'revenue':
                const einnahmen = data.buchungen?.filter(b => b.typ === 'einnahme') || [];
                const totalEinnahmen = einnahmen.reduce((sum, b) => sum + b.betrag, 0);
                answer = `Die Einnahmen betragen ${this.formatCurrency(totalEinnahmen)}.`;
                break;

            case 'expenses':
                const ausgaben = data.buchungen?.filter(b => b.typ === 'ausgabe') || [];
                const totalAusgaben = ausgaben.reduce((sum, b) => sum + b.betrag, 0);
                answer = `Die Ausgaben betragen ${this.formatCurrency(totalAusgaben)}.`;
                break;

            case 'invoices':
                const open = data.openInvoices || [];
                const totalOpen = open.reduce((sum, r) => sum + (r.betrag || 0), 0);
                answer = `Es gibt ${open.length} offene Rechnungen im Wert von ${this.formatCurrency(totalOpen)}.`;
                break;

            case 'customers':
                if (data.specificCustomer) {
                    const c = data.specificCustomer;
                    answer = `Kunde ${c.name}: ${c.email || 'keine E-Mail'}, ${c.telefon || 'kein Telefon'}.`;
                } else {
                    answer = `Sie haben ${data.customers?.length || 0} Kunden in der Datenbank.`;
                }
                break;

            case 'appointments':
                const todayApts = data.todayAppointments || [];
                if (todayApts.length === 0) {
                    answer = 'Heute sind keine Termine geplant.';
                } else {
                    answer = `Heute ${todayApts.length} Termin(e): ${todayApts.map(a => `${a.startTime} ${a.title}`).join(', ')}.`;
                }
                break;

            case 'tasks':
                const openTasks = data.openTasks || [];
                answer = `Es gibt ${openTasks.length} offene Aufgaben.`;
                if (openTasks.length > 0) {
                    const high = openTasks.filter(t => t.priority === 'high');
                    if (high.length > 0) {
                        answer += ` Davon ${high.length} mit hoher Priorität.`;
                    }
                }
                break;

            case 'time':
                const hours = data.todayHours || 0;
                answer = `Heute wurden ${hours.toFixed(1)} Stunden erfasst.`;
                break;

            case 'profit':
                const ein = data.buchungen?.filter(b => b.typ === 'einnahme').reduce((s, b) => s + b.betrag, 0) || 0;
                const aus = data.buchungen?.filter(b => b.typ === 'ausgabe').reduce((s, b) => s + b.betrag, 0) || 0;
                const profit = ein - aus;
                answer = `Der Gewinn beträgt ${this.formatCurrency(profit)} (Einnahmen: ${this.formatCurrency(ein)}, Ausgaben: ${this.formatCurrency(aus)}).`;
                break;

            default:
                answer = 'Ich verstehe die Frage leider nicht. Versuchen Sie Fragen wie: "Wie viel Umsatz heute?", "Welche Termine habe ich?", oder "Wie viele offene Rechnungen?"';
        }

        return {
            success: true,
            answer: answer,
            intent: analysis.intent,
            source: 'rules'
        };
    }

    // Quick queries
    async getRevenueToday() {
        return this.ask('Wie viel Umsatz heute?');
    }

    async getOpenInvoices() {
        return this.ask('Wie viele offene Rechnungen?');
    }

    async getTodaySchedule() {
        return this.ask('Welche Termine heute?');
    }

    async getOpenTasks() {
        return this.ask('Welche Aufgaben sind offen?');
    }

    // Format currency
    formatCurrency(amount) {
        return new Intl.NumberFormat('de-DE', {
            style: 'currency',
            currency: 'EUR'
        }).format(amount);
    }

    // Log conversation
    logConversation(question, response, analysis) {
        this.conversationHistory.push({
            timestamp: new Date().toISOString(),
            question: question,
            answer: response.answer,
            intent: analysis.intent,
            source: response.source
        });

        // Keep last 100 entries
        if (this.conversationHistory.length > 100) {
            this.conversationHistory = this.conversationHistory.slice(-100);
        }

        localStorage.setItem('freyai_ai_history', JSON.stringify(this.conversationHistory));
    }

    // Get conversation history
    getHistory(limit = 20) {
        return this.conversationHistory.slice(-limit);
    }

    // Clear history
    clearHistory() {
        this.conversationHistory = [];
        localStorage.setItem('freyai_ai_history', JSON.stringify([]));
    }
}

window.aiAssistantService = new AiAssistantService();
