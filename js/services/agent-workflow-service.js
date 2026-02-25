/* ============================================
   Agent Workflow Service - KI-Agenten-System
   Autonome Geschaeftsprozessautomatisierung

   Agents:
   - MorningBriefingAgent: Tagesbriefing mit dringenden Punkten
   - DunningAgent: Mahneskalation basierend auf Rechnungshistorie
   - LeadFollowUpAgent: Nachverfolgung inaktiver Anfragen
   - QuoteGenerationAgent: Automatische Angebotserstellung
   - ScheduleOptimizerAgent: Terminoptimierung

   Architecture:
   - Each agent analyzes store state, calls Gemini AI, returns structured results
   - Supports dry-run mode (preview without side effects)
   - All text in German (production UI)
   - Graceful fallback if Gemini is unavailable
   - Execution log persisted in localStorage by date
   ============================================ */

class AgentWorkflowService {
    constructor() {
        this.agents = new Map();
        this.executionLog = [];
        this.isRunning = false;
        this.schedules = [];
        this.schedulerInterval = null;

        // Default agent configuration
        this.configKey = 'mhs_agent_workflow_config';
        this.logKey = 'mhs_agent_execution_log';

        // Load persisted data
        this._loadExecutionLog();
        this._loadConfig();

        // Register built-in agents
        this.registerDefaultAgents();
    }

    // ============================================
    // Agent Registration
    // ============================================

    registerDefaultAgents() {
        this.agents.set('morning-briefing', {
            id: 'morning-briefing',
            name: 'Morgen-Briefing',
            description: 'Zusammenfassung aller Geschaeftsaktivitaeten, dringende Punkte und Tagesueberblick',
            icon: '&#9788;',
            category: 'analyse',
            defaultSchedule: '07:00',
            enabled: true,
            lastRun: null,
            lastResult: null,
            handler: () => this.generateMorningBriefing()
        });

        this.agents.set('dunning-agent', {
            id: 'dunning-agent',
            name: 'Mahn-Agent',
            description: 'Analysiert ueberfaellige Rechnungen und erstellt passende Mahntexte',
            icon: '&#9888;',
            category: 'finanzen',
            defaultSchedule: '09:00',
            enabled: true,
            lastRun: null,
            lastResult: null,
            handler: () => this.runDunningAgent()
        });

        this.agents.set('lead-followup', {
            id: 'lead-followup',
            name: 'Lead-Nachverfolgung',
            description: 'Erkennt inaktive Anfragen (>3 Tage) und erstellt Nachfasstexte',
            icon: '&#128140;',
            category: 'vertrieb',
            defaultSchedule: '08:30',
            enabled: true,
            lastRun: null,
            lastResult: null,
            handler: () => this.runLeadFollowUpAgent()
        });

        this.agents.set('quote-generation', {
            id: 'quote-generation',
            name: 'Angebots-Generator',
            description: 'Erstellt automatisch Angebotsentwuerfe aus neuen Anfragen',
            icon: '&#128196;',
            category: 'vertrieb',
            defaultSchedule: '08:00',
            enabled: true,
            lastRun: null,
            lastResult: null,
            handler: () => this.runQuoteGenerationAgent()
        });

        this.agents.set('schedule-optimizer', {
            id: 'schedule-optimizer',
            name: 'Termin-Optimierer',
            description: 'Analysiert Auftraege und schlaegt optimale Terminplanung vor',
            icon: '&#128197;',
            category: 'planung',
            defaultSchedule: '07:30',
            enabled: true,
            lastRun: null,
            lastResult: null,
            handler: () => this.runScheduleOptimizer()
        });

        // Apply saved config overrides
        this._applyConfig();
    }

    // ============================================
    // Agent Execution
    // ============================================

    /**
     * Execute a specific agent by ID.
     * @param {string} agentId - The agent identifier
     * @param {Object} context - Optional execution context
     * @param {boolean} dryRun - If true, preview only (no side effects)
     * @returns {Object} Execution result
     */
    async executeAgent(agentId, context = {}, dryRun = false) {
        const agent = this.agents.get(agentId);
        if (!agent) {
            throw new Error(`Agent nicht gefunden: ${agentId}`);
        }

        if (!agent.enabled && !context.forceRun) {
            return {
                success: false,
                agentId,
                message: `Agent "${agent.name}" ist deaktiviert`,
                timestamp: new Date().toISOString()
            };
        }

        if (this.isRunning) {
            return {
                success: false,
                agentId,
                message: 'Ein anderer Agent laeuft bereits. Bitte warten.',
                timestamp: new Date().toISOString()
            };
        }

        this.isRunning = true;
        const startTime = Date.now();

        try {
            const result = await agent.handler();

            const executionResult = {
                success: true,
                agentId,
                agentName: agent.name,
                dryRun,
                result,
                duration: Date.now() - startTime,
                timestamp: new Date().toISOString()
            };

            // Update agent state
            agent.lastRun = executionResult.timestamp;
            agent.lastResult = executionResult;

            // Log execution
            this._logExecution(executionResult);

            // Add activity to store (unless dry run)
            if (!dryRun) {
                this._addStoreActivity(agent.icon, `KI-Agent "${agent.name}" ausgefuehrt`);
            }

            return executionResult;
        } catch (error) {
            const errorResult = {
                success: false,
                agentId,
                agentName: agent.name,
                dryRun,
                error: error.message,
                duration: Date.now() - startTime,
                timestamp: new Date().toISOString()
            };

            this._logExecution(errorResult);
            window.errorHandler?.handle(error, `AgentWorkflow:${agentId}`, false);

            return errorResult;
        } finally {
            this.isRunning = false;
        }
    }

    /**
     * Run all scheduled agents whose time has arrived.
     */
    async runScheduledAgents() {
        const now = new Date();
        const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

        for (const [agentId, agent] of this.agents) {
            if (!agent.enabled) {continue;}

            const schedule = this._getAgentSchedule(agentId);
            if (!schedule) {continue;}

            // Check if the agent should run at this time
            if (schedule === currentTime) {
                // Check if already run today
                if (agent.lastRun) {
                    const lastRunDate = new Date(agent.lastRun).toDateString();
                    if (lastRunDate === now.toDateString()) {continue;}
                }

                try {
                    await this.executeAgent(agentId);
                } catch (error) {
                    console.error(`Geplanter Agent ${agentId} fehlgeschlagen:`, error);
                }
            }
        }
    }

    /**
     * Start the scheduler that checks every minute for due agents.
     */
    startScheduler() {
        if (this.schedulerInterval) {return;}
        this.schedulerInterval = setInterval(() => this.runScheduledAgents(), 60000);
        console.log('[AgentWorkflow] Scheduler gestartet');
    }

    /**
     * Stop the scheduler.
     */
    stopScheduler() {
        if (this.schedulerInterval) {
            clearInterval(this.schedulerInterval);
            this.schedulerInterval = null;
            console.log('[AgentWorkflow] Scheduler gestoppt');
        }
    }

    // ============================================
    // Morning Briefing Agent
    // ============================================

    /**
     * Generate a comprehensive morning briefing analyzing all business data.
     * @returns {Object} Structured briefing data
     */
    async generateMorningBriefing() {
        const store = this._getStore();
        if (!store) {
            return this._fallbackMorningBriefing();
        }

        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];

        // Gather data
        const anfragen = store.anfragen || [];
        const angebote = store.angebote || [];
        const auftraege = store.auftraege || [];
        const rechnungen = store.rechnungen || [];
        const activities = store.activities || [];

        // Urgent items
        const overdueInvoices = rechnungen.filter(r => {
            if (r.status === 'bezahlt') {return false;}
            const due = r.faelligkeitsdatum ? new Date(r.faelligkeitsdatum) : null;
            return due && due < today;
        });

        const staleLeads = anfragen.filter(a => {
            if (a.status === 'angebot-erstellt' || a.status === 'abgeschlossen') {return false;}
            const created = new Date(a.createdAt);
            const daysSince = (today - created) / (1000 * 60 * 60 * 24);
            return daysSince > 3;
        });

        const activeOrders = auftraege.filter(a =>
            a.status === 'in-bearbeitung' || a.status === 'geplant'
        );

        const pendingQuotes = angebote.filter(a =>
            a.status === 'offen' || a.status === 'erstellt'
        );

        // Today's new items (last 24h)
        const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
        const newAnfragen = anfragen.filter(a => new Date(a.createdAt) > yesterday);
        const recentActivities = activities.slice(0, 10);

        // Cash flow summary
        const totalOverdue = overdueInvoices.reduce((sum, r) =>
            sum + (r.brutto || r.betrag || 0), 0
        );
        const totalPending = rechnungen
            .filter(r => r.status !== 'bezahlt')
            .reduce((sum, r) => sum + (r.brutto || r.betrag || 0), 0);

        // Build briefing summary
        const briefingData = {
            datum: todayStr,
            zusammenfassung: {
                neueAnfragen: newAnfragen.length,
                offeneAnfragen: anfragen.filter(a => a.status === 'neu' || a.status === 'offen').length,
                offeneAngebote: pendingQuotes.length,
                aktiveAuftraege: activeOrders.length,
                ueberfaelligeRechnungen: overdueInvoices.length,
                inaktiveLeads: staleLeads.length
            },
            dringend: [],
            cashflow: {
                ueberfaellig: totalOverdue,
                ausstehend: totalPending,
                offeneRechnungenAnzahl: rechnungen.filter(r => r.status !== 'bezahlt').length
            },
            staleLeads: staleLeads.map(a => ({
                id: a.id,
                kunde: a.kunde?.name || 'Unbekannt',
                leistungsart: a.leistungsart || '',
                tageOffen: Math.floor((today - new Date(a.createdAt)) / (1000 * 60 * 60 * 24))
            })),
            overdueInvoices: overdueInvoices.map(r => ({
                id: r.id,
                nummer: r.nummer || r.id,
                kunde: r.kunde?.name || 'Unbekannt',
                betrag: r.brutto || r.betrag || 0,
                tageUeberfaellig: Math.floor((today - new Date(r.faelligkeitsdatum)) / (1000 * 60 * 60 * 24))
            })),
            aktiveAuftraege: activeOrders.map(a => ({
                id: a.id,
                kunde: a.kunde?.name || 'Unbekannt',
                leistungsart: a.leistungsart || '',
                status: a.status,
                fortschritt: a.fortschritt || 0
            })),
            letzteAktivitaeten: recentActivities,
            aiSummary: null
        };

        // Build urgency flags
        if (overdueInvoices.length > 0) {
            briefingData.dringend.push({
                typ: 'rechnung',
                prioritaet: 'hoch',
                nachricht: `${overdueInvoices.length} ueberfaellige Rechnung(en) - Gesamtwert: ${this._formatCurrency(totalOverdue)}`,
                details: overdueInvoices.map(r => r.nummer || r.id)
            });
        }

        if (staleLeads.length > 0) {
            briefingData.dringend.push({
                typ: 'lead',
                prioritaet: 'mittel',
                nachricht: `${staleLeads.length} Anfrage(n) warten seit ueber 3 Tagen auf Bearbeitung`,
                details: staleLeads.map(a => a.kunde?.name || a.id)
            });
        }

        const nearDeadlineOrders = activeOrders.filter(a => {
            if (!a.endDatum) {return false;}
            const deadline = new Date(a.endDatum);
            const daysLeft = (deadline - today) / (1000 * 60 * 60 * 24);
            return daysLeft >= 0 && daysLeft <= 3;
        });

        if (nearDeadlineOrders.length > 0) {
            briefingData.dringend.push({
                typ: 'auftrag',
                prioritaet: 'hoch',
                nachricht: `${nearDeadlineOrders.length} Auftrag/Auftraege mit Frist in den naechsten 3 Tagen`,
                details: nearDeadlineOrders.map(a => a.id)
            });
        }

        // AI-enhanced summary via Gemini
        try {
            briefingData.aiSummary = await this._generateAIBriefingSummary(briefingData);
        } catch (e) {
            briefingData.aiSummary = this._getFallbackBriefingSummary(briefingData);
        }

        return briefingData;
    }

    async _generateAIBriefingSummary(briefingData) {
        const gemini = window.geminiService;
        if (!gemini?.isConfigured) {
            return this._getFallbackBriefingSummary(briefingData);
        }

        const bizType = this._getBusinessType();
        const prompt = `Du bist ein Geschaeftsassistent fuer einen ${bizType}.
Erstelle ein kurzes, praegnantes Morgen-Briefing (max 200 Woerter) basierend auf diesen Daten:

- Neue Anfragen (letzte 24h): ${briefingData.zusammenfassung.neueAnfragen}
- Offene Anfragen gesamt: ${briefingData.zusammenfassung.offeneAnfragen}
- Offene Angebote: ${briefingData.zusammenfassung.offeneAngebote}
- Aktive Auftraege: ${briefingData.zusammenfassung.aktiveAuftraege}
- Ueberfaellige Rechnungen: ${briefingData.zusammenfassung.ueberfaelligeRechnungen} (Wert: ${this._formatCurrency(briefingData.cashflow.ueberfaellig)})
- Inaktive Leads (>3 Tage): ${briefingData.zusammenfassung.inaktiveLeads}
- Ausstehende Zahlungen gesamt: ${this._formatCurrency(briefingData.cashflow.ausstehend)}

Dringende Punkte:
${briefingData.dringend.map(d => `- [${d.prioritaet.toUpperCase()}] ${d.nachricht}`).join('\n') || '- Keine dringenden Punkte'}

Formuliere einen kurzen, motivierenden Tagesueberblick mit konkreten Handlungsempfehlungen.
Antworte NUR mit dem Briefing-Text auf Deutsch.`;

        try {
            const data = await gemini._callGeminiAPI({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 500
                }
            });

            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
            return text || this._getFallbackBriefingSummary(briefingData);
        } catch (error) {
            console.warn('[AgentWorkflow] Gemini-Briefing fehlgeschlagen:', error.message);
            return this._getFallbackBriefingSummary(briefingData);
        }
    }

    _getFallbackBriefingSummary(data) {
        const lines = [];
        lines.push(`Guten Morgen! Hier ist Ihr Tagesueberblick fuer den ${new Date().toLocaleDateString('de-DE')}:`);
        lines.push('');

        if (data.zusammenfassung.neueAnfragen > 0) {
            lines.push(`${data.zusammenfassung.neueAnfragen} neue Anfrage(n) sind eingegangen.`);
        }

        if (data.zusammenfassung.ueberfaelligeRechnungen > 0) {
            lines.push(`ACHTUNG: ${data.zusammenfassung.ueberfaelligeRechnungen} Rechnung(en) sind ueberfaellig (${this._formatCurrency(data.cashflow.ueberfaellig)}).`);
        }

        if (data.zusammenfassung.inaktiveLeads > 0) {
            lines.push(`${data.zusammenfassung.inaktiveLeads} Anfrage(n) warten seit ueber 3 Tagen - Nachfassen empfohlen.`);
        }

        if (data.zusammenfassung.aktiveAuftraege > 0) {
            lines.push(`${data.zusammenfassung.aktiveAuftraege} aktive(r) Auftrag/Auftraege in Bearbeitung.`);
        }

        if (data.dringend.length === 0) {
            lines.push('Keine dringenden Punkte - alles im gruenen Bereich!');
        }

        return lines.join('\n');
    }

    _fallbackMorningBriefing() {
        return {
            datum: new Date().toISOString().split('T')[0],
            zusammenfassung: {
                neueAnfragen: 0, offeneAnfragen: 0, offeneAngebote: 0,
                aktiveAuftraege: 0, ueberfaelligeRechnungen: 0, inaktiveLeads: 0
            },
            dringend: [],
            cashflow: { ueberfaellig: 0, ausstehend: 0, offeneRechnungenAnzahl: 0 },
            staleLeads: [],
            overdueInvoices: [],
            aktiveAuftraege: [],
            letzteAktivitaeten: [],
            aiSummary: 'Keine Daten verfuegbar. Bitte stellen Sie sicher, dass der Store geladen ist.'
        };
    }

    // ============================================
    // Dunning Agent
    // ============================================

    /**
     * Analyze overdue invoices, classify severity, and generate reminder texts.
     * @returns {Object} Dunning analysis results
     */
    async runDunningAgent() {
        const store = this._getStore();
        if (!store) {
            return { mahnungen: [], zusammenfassung: 'Store nicht verfuegbar' };
        }

        const today = new Date();
        const rechnungen = store.rechnungen || [];

        // Find overdue invoices
        const overdueInvoices = rechnungen.filter(r => {
            if (r.status === 'bezahlt') {return false;}
            const due = r.faelligkeitsdatum ? new Date(r.faelligkeitsdatum) : null;
            if (!due) {
                // No due date: check if created more than 30 days ago
                const created = new Date(r.createdAt);
                return (today - created) / (1000 * 60 * 60 * 24) > 30;
            }
            return due < today;
        });

        if (overdueInvoices.length === 0) {
            return {
                mahnungen: [],
                zusammenfassung: 'Keine ueberfaelligen Rechnungen gefunden. Alles in Ordnung!'
            };
        }

        // Classify each overdue invoice
        const mahnungen = [];
        for (const rechnung of overdueInvoices) {
            const dueDate = rechnung.faelligkeitsdatum
                ? new Date(rechnung.faelligkeitsdatum)
                : new Date(new Date(rechnung.createdAt).getTime() + 30 * 24 * 60 * 60 * 1000);
            const daysOverdue = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));

            // Classify severity
            let severity, severityLabel, tone;
            if (daysOverdue <= 14) {
                severity = 'freundlich';
                severityLabel = 'Zahlungserinnerung';
                tone = 'hoeflich und freundlich';
            } else if (daysOverdue <= 28) {
                severity = 'bestimmt';
                severityLabel = '1. Mahnung';
                tone = 'bestimmt aber sachlich';
            } else if (daysOverdue <= 42) {
                severity = 'nachdrücklich';
                severityLabel = '2. Mahnung';
                tone = 'nachdrücklich mit Hinweis auf Konsequenzen';
            } else {
                severity = 'letzte_warnung';
                severityLabel = 'Letzte Mahnung';
                tone = 'streng mit Ankuendigung rechtlicher Schritte';
            }

            // Check existing dunning history
            const existingDunning = window.dunningService
                ? window.dunningService.getMahnungenForRechnung?.(rechnung.id) || []
                : [];

            const mahnung = {
                rechnungId: rechnung.id,
                rechnungNummer: rechnung.nummer || rechnung.id,
                kunde: rechnung.kunde?.name || 'Unbekannt',
                kundeEmail: rechnung.kunde?.email || '',
                betrag: rechnung.brutto || rechnung.betrag || 0,
                faelligkeitsdatum: dueDate.toISOString().split('T')[0],
                tageUeberfaellig: daysOverdue,
                severity,
                severityLabel,
                tone,
                bisherigeMahnungen: existingDunning.length,
                mahntext: null,
                mahngebuehr: this._calculateDunningFee(severity)
            };

            // Generate reminder text via AI
            try {
                mahnung.mahntext = await this._generateDunningText(mahnung);
            } catch (e) {
                mahnung.mahntext = this._getFallbackDunningText(mahnung);
            }

            mahnungen.push(mahnung);
        }

        // Sort by urgency (most overdue first)
        mahnungen.sort((a, b) => b.tageUeberfaellig - a.tageUeberfaellig);

        const totalOverdue = mahnungen.reduce((sum, m) => sum + m.betrag, 0);

        return {
            mahnungen,
            zusammenfassung: `${mahnungen.length} ueberfaellige Rechnung(en) gefunden. Gesamtwert: ${this._formatCurrency(totalOverdue)}. ` +
                `Davon ${mahnungen.filter(m => m.severity === 'letzte_warnung').length} mit letzter Warnung.`,
            statistik: {
                gesamt: mahnungen.length,
                freundlich: mahnungen.filter(m => m.severity === 'freundlich').length,
                bestimmt: mahnungen.filter(m => m.severity === 'bestimmt').length,
                nachdrücklich: mahnungen.filter(m => m.severity === 'nachdrücklich').length,
                letzteWarnung: mahnungen.filter(m => m.severity === 'letzte_warnung').length,
                gesamtBetrag: totalOverdue
            }
        };
    }

    async _generateDunningText(mahnung) {
        const gemini = window.geminiService;
        if (!gemini?.isConfigured) {
            return this._getFallbackDunningText(mahnung);
        }

        const bizType = this._getBusinessType();
        const prompt = `Du bist der Geschaeftsfuehrer eines ${bizType}.
Erstelle einen ${mahnung.tone}en Mahntext fuer folgende Rechnung:

- Rechnungsnummer: ${mahnung.rechnungNummer}
- Kunde: ${mahnung.kunde}
- Rechnungsbetrag: ${this._formatCurrency(mahnung.betrag)}
- Faelligkeitsdatum: ${mahnung.faelligkeitsdatum}
- Tage ueberfaellig: ${mahnung.tageUeberfaellig}
- Mahnstufe: ${mahnung.severityLabel}
- Bisherige Mahnungen: ${mahnung.bisherigeMahnungen}
${mahnung.mahngebuehr > 0 ? `- Mahngebuehr: ${this._formatCurrency(mahnung.mahngebuehr)}` : ''}

Der Text soll:
- Professionell und ${mahnung.tone} formuliert sein
- Die offene Rechnung klar benennen
- Eine konkrete Zahlungsaufforderung mit neuer Frist (7 Tage) enthalten
${mahnung.severity === 'letzte_warnung' ? '- Auf moegliche rechtliche Schritte / Inkasso hinweisen' : ''}
- Ca. 100-150 Woerter umfassen

Antworte NUR mit dem Mahntext.`;

        try {
            const data = await gemini._callGeminiAPI({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.5,
                    maxOutputTokens: 400
                }
            });

            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
            return text || this._getFallbackDunningText(mahnung);
        } catch (error) {
            console.warn('[AgentWorkflow] Gemini-Mahnung fehlgeschlagen:', error.message);
            return this._getFallbackDunningText(mahnung);
        }
    }

    _getFallbackDunningText(mahnung) {
        const firma = window.storeService?.state?.settings?.companyName || 'FreyAI Visions';
        const neueFrist = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('de-DE');

        if (mahnung.severity === 'freundlich') {
            return `Sehr geehrte(r) ${mahnung.kunde},\n\n` +
                `hiermit moechten wir Sie freundlich daran erinnern, dass die Rechnung Nr. ${mahnung.rechnungNummer} ` +
                `ueber ${this._formatCurrency(mahnung.betrag)} seit dem ${mahnung.faelligkeitsdatum} faellig ist.\n\n` +
                `Sollte sich Ihre Zahlung mit diesem Schreiben gekreuzt haben, betrachten Sie dieses bitte als gegenstandslos.\n\n` +
                `Bitte ueberweisen Sie den Betrag bis zum ${neueFrist}.\n\n` +
                `Mit freundlichen Gruessen\n${firma}`;
        }

        if (mahnung.severity === 'bestimmt') {
            return `Sehr geehrte(r) ${mahnung.kunde},\n\n` +
                `trotz unserer Zahlungserinnerung ist die Rechnung Nr. ${mahnung.rechnungNummer} ` +
                `ueber ${this._formatCurrency(mahnung.betrag)} weiterhin offen (${mahnung.tageUeberfaellig} Tage ueberfaellig).\n\n` +
                `Wir bitten Sie dringend, den ausstehenden Betrag bis zum ${neueFrist} zu begleichen.\n\n` +
                `${mahnung.mahngebuehr > 0 ? `Mahngebuehr: ${this._formatCurrency(mahnung.mahngebuehr)}\n\n` : ''}` +
                `Mit freundlichen Gruessen\n${firma}`;
        }

        if (mahnung.severity === 'nachdrücklich') {
            return `Sehr geehrte(r) ${mahnung.kunde},\n\n` +
                `wir stellen fest, dass die Rechnung Nr. ${mahnung.rechnungNummer} ` +
                `ueber ${this._formatCurrency(mahnung.betrag)} trotz mehrfacher Aufforderung nicht beglichen wurde ` +
                `(${mahnung.tageUeberfaellig} Tage ueberfaellig).\n\n` +
                `Wir fordern Sie hiermit nachdrücklich auf, den Gesamtbetrag ` +
                `${mahnung.mahngebuehr > 0 ? `zzgl. ${this._formatCurrency(mahnung.mahngebuehr)} Mahngebuehr ` : ''}` +
                `bis zum ${neueFrist} zu ueberweisen.\n\n` +
                `Sollte keine Zahlung erfolgen, behalten wir uns weitere Massnahmen vor.\n\n` +
                `Mit freundlichen Gruessen\n${firma}`;
        }

        // letzte_warnung
        return `Sehr geehrte(r) ${mahnung.kunde},\n\n` +
            `LETZTE MAHNUNG\n\n` +
            `Die Rechnung Nr. ${mahnung.rechnungNummer} ueber ${this._formatCurrency(mahnung.betrag)} ` +
            `ist seit ${mahnung.tageUeberfaellig} Tagen ueberfaellig.\n\n` +
            `Dies ist unsere letzte Aufforderung zur Zahlung. Sollte der Gesamtbetrag ` +
            `${mahnung.mahngebuehr > 0 ? `zzgl. ${this._formatCurrency(mahnung.mahngebuehr)} Mahngebuehr ` : ''}` +
            `nicht bis zum ${neueFrist} bei uns eingehen, werden wir ohne weitere Ankuendigung ` +
            `ein Inkassoverfahren einleiten bzw. rechtliche Schritte ergreifen.\n\n` +
            `Mit freundlichen Gruessen\n${firma}`;
    }

    _calculateDunningFee(severity) {
        switch (severity) {
            case 'freundlich': return 0;
            case 'bestimmt': return 5.00;
            case 'nachdrücklich': return 10.00;
            case 'letzte_warnung': return 15.00;
            default: return 0;
        }
    }

    // ============================================
    // Lead Follow-Up Agent
    // ============================================

    /**
     * Detect stale inquiries (>3 days with no response) and draft follow-ups.
     * @returns {Object} Follow-up analysis with drafts
     */
    async runLeadFollowUpAgent() {
        const store = this._getStore();
        if (!store) {
            return { followups: [], zusammenfassung: 'Store nicht verfuegbar' };
        }

        const today = new Date();
        const anfragen = store.anfragen || [];
        const angebote = store.angebote || [];

        // Find stale inquiries: created > 3 days ago, no angebot created
        const staleAnfragen = anfragen.filter(a => {
            // Only check new/open inquiries
            if (a.status === 'angebot-erstellt' || a.status === 'abgeschlossen' || a.status === 'abgelehnt') {
                return false;
            }

            const created = new Date(a.createdAt);
            const daysSince = (today - created) / (1000 * 60 * 60 * 24);

            // Must be older than 3 days
            if (daysSince <= 3) {return false;}

            // Check if an angebot has been created for this anfrage
            const hasAngebot = angebote.some(ang => ang.anfrageId === a.id);
            return !hasAngebot;
        });

        if (staleAnfragen.length === 0) {
            return {
                followups: [],
                zusammenfassung: 'Alle Anfragen sind aktuell bearbeitet. Keine Nachverfolgung noetig.'
            };
        }

        const followups = [];
        for (const anfrage of staleAnfragen) {
            const daysSince = Math.floor((today - new Date(anfrage.createdAt)) / (1000 * 60 * 60 * 24));

            const followup = {
                anfrageId: anfrage.id,
                kunde: anfrage.kunde?.name || 'Unbekannt',
                kundeEmail: anfrage.kunde?.email || '',
                kundeTelefon: anfrage.kunde?.telefon || '',
                leistungsart: anfrage.leistungsart || '',
                beschreibung: anfrage.beschreibung || '',
                tageOffen: daysSince,
                prioritaet: daysSince > 7 ? 'hoch' : daysSince > 5 ? 'mittel' : 'normal',
                nachfasstext: null
            };

            // Generate follow-up text via AI
            try {
                followup.nachfasstext = await this._generateFollowUpText(followup, anfrage);
            } catch (e) {
                followup.nachfasstext = this._getFallbackFollowUpText(followup);
            }

            followups.push(followup);
        }

        // Sort by priority (most urgent first)
        followups.sort((a, b) => b.tageOffen - a.tageOffen);

        return {
            followups,
            zusammenfassung: `${followups.length} Anfrage(n) warten seit ueber 3 Tagen auf Bearbeitung. ` +
                `Davon ${followups.filter(f => f.prioritaet === 'hoch').length} mit hoher Prioritaet.`
        };
    }

    async _generateFollowUpText(followup, anfrage) {
        const gemini = window.geminiService;
        if (!gemini?.isConfigured) {
            return this._getFallbackFollowUpText(followup);
        }

        const bizType = this._getBusinessType();
        const prompt = `Du bist Vertriebsmitarbeiter eines ${bizType}.
Erstelle einen freundlichen Nachfass-Text fuer folgende Anfrage:

- Kunde: ${followup.kunde}
- Leistungsart: ${followup.leistungsart}
- Beschreibung: ${followup.beschreibung}
- Tage seit Anfrage: ${followup.tageOffen}
${anfrage.budget ? `- Budget: ${anfrage.budget}` : ''}
${anfrage.termin ? `- Wunschtermin: ${anfrage.termin}` : ''}

Der Text soll:
- Freundlich und proaktiv formuliert sein
- Auf die urspruengliche Anfrage Bezug nehmen
- Einen Gespraechstermin oder Rueckruf anbieten
- Ca. 80-120 Woerter umfassen

Antworte NUR mit dem Nachfass-Text.`;

        try {
            const data = await gemini._callGeminiAPI({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 300
                }
            });

            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
            return text || this._getFallbackFollowUpText(followup);
        } catch (error) {
            console.warn('[AgentWorkflow] Gemini-FollowUp fehlgeschlagen:', error.message);
            return this._getFallbackFollowUpText(followup);
        }
    }

    _getFallbackFollowUpText(followup) {
        const firma = window.storeService?.state?.settings?.companyName || 'FreyAI Visions';

        return `Sehr geehrte(r) ${followup.kunde},\n\n` +
            `vor ${followup.tageOffen} Tagen haben Sie uns eine Anfrage ` +
            `${followup.leistungsart ? `zum Thema "${followup.leistungsart}" ` : ''}gesendet.\n\n` +
            `Wir moechten uns erkundigen, ob Sie noch Interesse an unserer Dienstleistung haben. ` +
            `Gerne erstellen wir Ihnen ein unverbindliches Angebot oder beantworten offene Fragen.\n\n` +
            `Wir freuen uns auf Ihre Rueckmeldung!\n\n` +
            `Mit freundlichen Gruessen\n${firma}`;
    }

    // ============================================
    // Quote Generation Agent
    // ============================================

    /**
     * Auto-generate quote drafts from new inquiry details.
     * @returns {Object} Generated quote drafts
     */
    async runQuoteGenerationAgent() {
        const store = this._getStore();
        if (!store) {
            return { angebote: [], zusammenfassung: 'Store nicht verfuegbar' };
        }

        const anfragen = store.anfragen || [];
        const angebote = store.angebote || [];

        // Find inquiries that don't yet have quotes
        const unquotedAnfragen = anfragen.filter(a => {
            if (a.status === 'abgeschlossen' || a.status === 'abgelehnt') {return false;}
            const hasAngebot = angebote.some(ang => ang.anfrageId === a.id);
            return !hasAngebot;
        });

        if (unquotedAnfragen.length === 0) {
            return {
                angebote: [],
                zusammenfassung: 'Alle Anfragen haben bereits Angebote. Keine neuen Entwuerfe noetig.'
            };
        }

        const angeboteDrafts = [];
        for (const anfrage of unquotedAnfragen) {
            const draft = {
                anfrageId: anfrage.id,
                kunde: anfrage.kunde?.name || 'Unbekannt',
                kundeObj: anfrage.kunde || {},
                leistungsart: anfrage.leistungsart || '',
                beschreibung: anfrage.beschreibung || '',
                positionen: [],
                geschaetzterPreis: null,
                angebotstext: null,
                istEntwurf: true
            };

            // Estimate pricing and generate text via AI
            try {
                const aiResult = await this._generateQuoteDraft(anfrage);
                draft.positionen = aiResult.positionen || [];
                draft.geschaetzterPreis = aiResult.geschaetzterPreis || null;
                draft.angebotstext = aiResult.angebotstext || null;
            } catch (e) {
                const fallback = this._getFallbackQuoteDraft(anfrage);
                draft.positionen = fallback.positionen;
                draft.geschaetzterPreis = fallback.geschaetzterPreis;
                draft.angebotstext = fallback.angebotstext;
            }

            angeboteDrafts.push(draft);
        }

        return {
            angebote: angeboteDrafts,
            zusammenfassung: `${angeboteDrafts.length} Angebotsentwurf/entwuerfe fuer offene Anfragen erstellt.`
        };
    }

    async _generateQuoteDraft(anfrage) {
        const gemini = window.geminiService;
        if (!gemini?.isConfigured) {
            return this._getFallbackQuoteDraft(anfrage);
        }

        const bizType = this._getBusinessType();
        const companyName = this._getCompanyName();
        const prompt = `Du bist ein Kalkulations-Experte fuer einen ${bizType} (${companyName}).
Erstelle einen Angebotsentwurf basierend auf folgender Kundenanfrage:

- Kunde: ${anfrage.kunde?.name || 'Unbekannt'}
- Leistungsart: ${anfrage.leistungsart || 'Nicht angegeben'}
- Beschreibung: ${anfrage.beschreibung || 'Keine Beschreibung'}
${anfrage.budget ? `- Budget des Kunden: ${anfrage.budget} EUR` : ''}
${anfrage.termin ? `- Wunschtermin: ${anfrage.termin}` : ''}

Antworte im JSON-Format:
{
  "positionen": [
    {"beschreibung": "...", "menge": 1, "einheit": "Stk", "einzelpreis": 0.00}
  ],
  "geschaetzterPreis": {
    "netto": 0.00,
    "mwst": 0.00,
    "brutto": 0.00,
    "arbeitsstunden": 0
  },
  "angebotstext": "Professioneller Angebotstext auf Deutsch (ca. 150 Woerter)"
}

Schaetze realistische Preise fuer Handwerksarbeiten in Deutschland.
Antworte NUR mit dem JSON.`;

        try {
            const data = await gemini._callGeminiAPI({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.4,
                    maxOutputTokens: 800
                }
            });

            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) {
                const jsonMatch = text.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    return JSON.parse(jsonMatch[0]);
                }
            }

            return this._getFallbackQuoteDraft(anfrage);
        } catch (error) {
            console.warn('[AgentWorkflow] Gemini-Quote fehlgeschlagen:', error.message);
            return this._getFallbackQuoteDraft(anfrage);
        }
    }

    _getFallbackQuoteDraft(anfrage) {
        // Estimate based on leistungsart
        const basePrice = this._estimateBasePrice(anfrage.leistungsart);
        const netto = basePrice;
        const mwst = Math.round(netto * _getTaxRate() * 100) / 100;
        const brutto = Math.round((netto + mwst) * 100) / 100;

        return {
            positionen: [
                {
                    beschreibung: anfrage.leistungsart || 'Handwerksleistung',
                    menge: 1,
                    einheit: 'pauschal',
                    einzelpreis: netto
                }
            ],
            geschaetzterPreis: {
                netto,
                mwst,
                brutto,
                arbeitsstunden: Math.ceil(netto / 65) // ~65 EUR/h
            },
            angebotstext: `Sehr geehrte(r) ${anfrage.kunde?.name || 'Kunde'},\n\n` +
                `vielen Dank fuer Ihre Anfrage${anfrage.leistungsart ? ` zum Thema "${anfrage.leistungsart}"` : ''}. ` +
                `Gerne unterbreiten wir Ihnen folgendes Angebot:\n\n` +
                `Gesamtbetrag: ${this._formatCurrency(brutto)} (inkl. MwSt.)\n\n` +
                `Dieses Angebot ist 30 Tage gueltig. Die Ausfuehrung erfolgt nach unseren ` +
                `allgemeinen Geschaeftsbedingungen. Bei Fragen stehen wir Ihnen gerne zur Verfuegung.\n\n` +
                `Mit freundlichen Gruessen\n${this._getCompanyName()}`
        };
    }

    _estimateBasePrice(leistungsart) {
        if (!leistungsart) {return 850;}

        const la = leistungsart.toLowerCase();
        if (la.includes('schweiss') || la.includes('schweiß')) {return 1200;}
        if (la.includes('treppen') || la.includes('gelaender') || la.includes('geländer')) {return 3500;}
        if (la.includes('tor') || la.includes('zaun')) {return 2800;}
        if (la.includes('hydraulik')) {return 1500;}
        if (la.includes('reparatur') || la.includes('wartung')) {return 650;}
        if (la.includes('montage')) {return 1100;}
        if (la.includes('konstruktion') || la.includes('stahlbau')) {return 4500;}
        if (la.includes('beratung') || la.includes('planung')) {return 450;}
        return 850;
    }

    // ============================================
    // Schedule Optimizer Agent
    // ============================================

    /**
     * Analyze orders and calendar, suggest better scheduling.
     * @returns {Object} Scheduling optimization suggestions
     */
    async runScheduleOptimizer() {
        const store = this._getStore();
        if (!store) {
            return { vorschlaege: [], zusammenfassung: 'Store nicht verfuegbar' };
        }

        const today = new Date();
        const auftraege = store.auftraege || [];

        // Get active and planned orders
        const relevantOrders = auftraege.filter(a =>
            a.status === 'geplant' || a.status === 'in-bearbeitung'
        );

        if (relevantOrders.length === 0) {
            return {
                vorschlaege: [],
                zusammenfassung: 'Keine aktiven Auftraege zur Optimierung vorhanden.'
            };
        }

        // Analyze scheduling conflicts and gaps
        const orderTimeline = relevantOrders.map(a => ({
            id: a.id,
            kunde: a.kunde?.name || 'Unbekannt',
            leistungsart: a.leistungsart || '',
            status: a.status,
            startDatum: a.startDatum ? new Date(a.startDatum) : null,
            endDatum: a.endDatum ? new Date(a.endDatum) : null,
            fortschritt: a.fortschritt || 0,
            mitarbeiter: a.mitarbeiter || []
        }));

        // Detect issues
        const issues = [];

        // 1. Orders without start dates
        const noStartDate = orderTimeline.filter(o => !o.startDatum && o.status === 'geplant');
        if (noStartDate.length > 0) {
            issues.push({
                typ: 'kein_startdatum',
                prioritaet: 'mittel',
                nachricht: `${noStartDate.length} geplante(r) Auftrag/Auftraege ohne Startdatum`,
                auftraege: noStartDate.map(o => o.id)
            });
        }

        // 2. Overlapping orders (resource conflicts)
        const withDates = orderTimeline.filter(o => o.startDatum && o.endDatum);
        const overlaps = [];
        for (let i = 0; i < withDates.length; i++) {
            for (let j = i + 1; j < withDates.length; j++) {
                const a = withDates[i];
                const b = withDates[j];
                if (a.startDatum <= b.endDatum && a.endDatum >= b.startDatum) {
                    overlaps.push({ auftrag1: a.id, auftrag2: b.id });
                }
            }
        }
        if (overlaps.length > 0) {
            issues.push({
                typ: 'ueberschneidung',
                prioritaet: 'hoch',
                nachricht: `${overlaps.length} Terminueberschneidung(en) erkannt`,
                details: overlaps
            });
        }

        // 3. Overdue orders (past deadline)
        const overdue = orderTimeline.filter(o =>
            o.endDatum && o.endDatum < today && o.status !== 'abgeschlossen'
        );
        if (overdue.length > 0) {
            issues.push({
                typ: 'ueberfaellig',
                prioritaet: 'hoch',
                nachricht: `${overdue.length} Auftrag/Auftraege haben die Frist ueberschritten`,
                auftraege: overdue.map(o => o.id)
            });
        }

        // 4. Low progress on near-deadline orders
        const behindSchedule = orderTimeline.filter(o => {
            if (!o.startDatum || !o.endDatum) {return false;}
            const totalDuration = o.endDatum - o.startDatum;
            const elapsed = today - o.startDatum;
            if (totalDuration <= 0 || elapsed <= 0) {return false;}
            const expectedProgress = Math.min(100, (elapsed / totalDuration) * 100);
            return o.fortschritt < expectedProgress - 20; // More than 20% behind
        });
        if (behindSchedule.length > 0) {
            issues.push({
                typ: 'hinter_plan',
                prioritaet: 'mittel',
                nachricht: `${behindSchedule.length} Auftrag/Auftraege liegen hinter dem Zeitplan`,
                auftraege: behindSchedule.map(o => o.id)
            });
        }

        // Generate AI optimization suggestions
        let aiVorschlaege = null;
        try {
            aiVorschlaege = await this._generateScheduleSuggestions(orderTimeline, issues);
        } catch (e) {
            aiVorschlaege = this._getFallbackScheduleSuggestions(issues);
        }

        return {
            vorschlaege: aiVorschlaege,
            probleme: issues,
            auftraegeAnalysiert: relevantOrders.length,
            zusammenfassung: issues.length > 0
                ? `${issues.length} Planungsproblem(e) bei ${relevantOrders.length} aktiven Auftraegen erkannt.`
                : `${relevantOrders.length} aktive Auftraege analysiert. Keine Probleme gefunden.`
        };
    }

    async _generateScheduleSuggestions(timeline, issues) {
        const gemini = window.geminiService;
        if (!gemini?.isConfigured) {
            return this._getFallbackScheduleSuggestions(issues);
        }

        const timelineText = timeline.map(o =>
            `- ${o.id}: ${o.kunde} / ${o.leistungsart} | Status: ${o.status} | ` +
            `Start: ${o.startDatum ? o.startDatum.toLocaleDateString('de-DE') : 'Offen'} | ` +
            `Ende: ${o.endDatum ? o.endDatum.toLocaleDateString('de-DE') : 'Offen'} | ` +
            `Fortschritt: ${o.fortschritt}%`
        ).join('\n');

        const issuesText = issues.map(i =>
            `- [${i.prioritaet.toUpperCase()}] ${i.nachricht}`
        ).join('\n');

        const bizType = this._getBusinessType();
        const prompt = `Du bist ein Planungsexperte fuer einen ${bizType}.
Analysiere folgende Auftraege und gib Optimierungsvorschlaege:

Aktuelle Auftraege:
${timelineText}

Erkannte Probleme:
${issuesText || 'Keine Probleme erkannt'}

Heutiges Datum: ${new Date().toLocaleDateString('de-DE')}

Gib 3-5 konkrete, umsetzbare Vorschlaege zur Terminoptimierung.
Antworte im JSON-Format:
[
  {"vorschlag": "...", "prioritaet": "hoch|mittel|niedrig", "betroffeneAuftraege": ["ID1"]}
]

Antworte NUR mit dem JSON-Array.`;

        try {
            const data = await gemini._callGeminiAPI({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.5,
                    maxOutputTokens: 600
                }
            });

            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) {
                const jsonMatch = text.match(/\[[\s\S]*\]/);
                if (jsonMatch) {
                    return JSON.parse(jsonMatch[0]);
                }
            }

            return this._getFallbackScheduleSuggestions(issues);
        } catch (error) {
            console.warn('[AgentWorkflow] Gemini-Schedule fehlgeschlagen:', error.message);
            return this._getFallbackScheduleSuggestions(issues);
        }
    }

    _getFallbackScheduleSuggestions(issues) {
        const suggestions = [];

        for (const issue of issues) {
            switch (issue.typ) {
                case 'kein_startdatum':
                    suggestions.push({
                        vorschlag: `Startdatum fuer ${issue.auftraege.length} geplante Auftraege festlegen, um Ressourcen besser planen zu koennen.`,
                        prioritaet: 'mittel',
                        betroffeneAuftraege: issue.auftraege
                    });
                    break;
                case 'ueberschneidung':
                    suggestions.push({
                        vorschlag: 'Terminueberschneidungen pruefen und Auftraege zeitlich entzerren oder zusaetzliche Ressourcen einplanen.',
                        prioritaet: 'hoch',
                        betroffeneAuftraege: issue.details.flatMap(d => [d.auftrag1, d.auftrag2])
                    });
                    break;
                case 'ueberfaellig':
                    suggestions.push({
                        vorschlag: 'Ueberfaellige Auftraege priorisieren und Kunden ueber neue Zeitplanung informieren.',
                        prioritaet: 'hoch',
                        betroffeneAuftraege: issue.auftraege
                    });
                    break;
                case 'hinter_plan':
                    suggestions.push({
                        vorschlag: 'Auftraege mit Rueckstand beschleunigen: mehr Personal einsetzen oder Umfang anpassen.',
                        prioritaet: 'mittel',
                        betroffeneAuftraege: issue.auftraege
                    });
                    break;
            }
        }

        if (suggestions.length === 0) {
            suggestions.push({
                vorschlag: 'Terminplanung sieht gut aus. Regelmaessig pruefen, ob neue Konflikte entstehen.',
                prioritaet: 'niedrig',
                betroffeneAuftraege: []
            });
        }

        return suggestions;
    }

    // ============================================
    // Execution Log
    // ============================================

    _logExecution(result) {
        const entry = {
            id: `log-${Date.now().toString(36)}`,
            agentId: result.agentId,
            agentName: result.agentName || result.agentId,
            success: result.success,
            dryRun: result.dryRun || false,
            error: result.error || null,
            duration: result.duration || 0,
            timestamp: result.timestamp || new Date().toISOString(),
            summary: result.result?.zusammenfassung || result.message || ''
        };

        this.executionLog.unshift(entry);

        // Keep log manageable (max 200 entries)
        if (this.executionLog.length > 200) {
            this.executionLog = this.executionLog.slice(0, 200);
        }

        this._saveExecutionLog();
    }

    getExecutionLog(limit = 50) {
        return this.executionLog.slice(0, limit);
    }

    getExecutionLogForAgent(agentId, limit = 20) {
        return this.executionLog
            .filter(e => e.agentId === agentId)
            .slice(0, limit);
    }

    clearExecutionLog() {
        this.executionLog = [];
        this._saveExecutionLog();
    }

    _loadExecutionLog() {
        try {
            const stored = localStorage.getItem(this.logKey);
            if (stored) {
                this.executionLog = JSON.parse(stored);
            }
        } catch (e) {
            console.warn('[AgentWorkflow] Log laden fehlgeschlagen:', e);
            this.executionLog = [];
        }
    }

    _saveExecutionLog() {
        try {
            localStorage.setItem(this.logKey, JSON.stringify(this.executionLog));
        } catch (e) {
            console.warn('[AgentWorkflow] Log speichern fehlgeschlagen:', e);
        }
    }

    // ============================================
    // Agent Configuration
    // ============================================

    getAgentConfig() {
        const config = {};
        for (const [agentId, agent] of this.agents) {
            config[agentId] = {
                id: agent.id,
                name: agent.name,
                description: agent.description,
                icon: agent.icon,
                category: agent.category,
                enabled: agent.enabled,
                schedule: this._getAgentSchedule(agentId),
                lastRun: agent.lastRun,
                lastResult: agent.lastResult ? {
                    success: agent.lastResult.success,
                    timestamp: agent.lastResult.timestamp,
                    duration: agent.lastResult.duration,
                    summary: agent.lastResult.result?.zusammenfassung || ''
                } : null
            };
        }
        return config;
    }

    saveAgentConfig(config) {
        try {
            for (const [agentId, settings] of Object.entries(config)) {
                const agent = this.agents.get(agentId);
                if (!agent) {continue;}

                if (typeof settings.enabled === 'boolean') {
                    agent.enabled = settings.enabled;
                }
                if (settings.schedule) {
                    this._setAgentSchedule(agentId, settings.schedule);
                }
            }

            this._persistConfig();
        } catch (e) {
            console.error('[AgentWorkflow] Konfiguration speichern fehlgeschlagen:', e);
            window.errorHandler?.handle(e, 'AgentWorkflow:Config');
        }
    }

    toggleAgent(agentId, enabled) {
        const agent = this.agents.get(agentId);
        if (!agent) {return false;}

        agent.enabled = enabled;
        this._persistConfig();
        return true;
    }

    setAgentSchedule(agentId, schedule) {
        this._setAgentSchedule(agentId, schedule);
        this._persistConfig();
    }

    _getAgentSchedule(agentId) {
        const saved = this._savedConfig?.schedules?.[agentId];
        if (saved) {return saved;}
        const agent = this.agents.get(agentId);
        return agent?.defaultSchedule || null;
    }

    _setAgentSchedule(agentId, schedule) {
        if (!this._savedConfig) {this._savedConfig = {};}
        if (!this._savedConfig.schedules) {this._savedConfig.schedules = {};}
        this._savedConfig.schedules[agentId] = schedule;
    }

    _loadConfig() {
        try {
            const stored = localStorage.getItem(this.configKey);
            this._savedConfig = stored ? JSON.parse(stored) : {};
        } catch (e) {
            console.warn('[AgentWorkflow] Konfiguration laden fehlgeschlagen:', e);
            this._savedConfig = {};
        }
    }

    _persistConfig() {
        try {
            const config = {
                schedules: {},
                enabled: {}
            };

            for (const [agentId, agent] of this.agents) {
                config.enabled[agentId] = agent.enabled;
                config.schedules[agentId] = this._getAgentSchedule(agentId);
            }

            this._savedConfig = config;
            localStorage.setItem(this.configKey, JSON.stringify(config));
        } catch (e) {
            console.warn('[AgentWorkflow] Konfiguration speichern fehlgeschlagen:', e);
        }
    }

    _applyConfig() {
        if (!this._savedConfig) {return;}

        const enabledMap = this._savedConfig.enabled || {};
        for (const [agentId, enabled] of Object.entries(enabledMap)) {
            const agent = this.agents.get(agentId);
            if (agent && typeof enabled === 'boolean') {
                agent.enabled = enabled;
            }
        }
    }

    // ============================================
    // Utility Methods
    // ============================================

    _getStore() {
        return window.storeService?.state || null;
    }

    _addStoreActivity(icon, title) {
        try {
            window.storeService?.addActivity(icon, title);
        } catch (e) {
            console.warn('[AgentWorkflow] Aktivitaet speichern fehlgeschlagen:', e);
        }
    }

    _formatCurrency(amount) {
        return new Intl.NumberFormat('de-DE', {
            style: 'currency',
            currency: 'EUR'
        }).format(amount || 0);
    }

    _getBusinessType() {
        let ap = {};
        try {
            ap = JSON.parse(localStorage.getItem('freyai_admin_settings') || '{}');
            if (typeof ap !== 'object' || ap === null || Array.isArray(ap)) {
                console.warn('[AgentWorkflow] admin_settings is not a valid object, using defaults');
                ap = {};
            }
        } catch (e) {
            console.warn('[AgentWorkflow] Failed to parse admin_settings JSON:', e?.message);
            ap = {};
        }
        const storeSettings = window.storeService?.state?.settings || {};
        return ap.business_type || storeSettings.businessType || 'Handwerksbetrieb';
    }

    _getCompanyName() {
        let ap = {};
        try {
            ap = JSON.parse(localStorage.getItem('freyai_admin_settings') || '{}');
            if (typeof ap !== 'object' || ap === null || Array.isArray(ap)) {
                console.warn('[AgentWorkflow] admin_settings is not a valid object, using defaults');
                ap = {};
            }
        } catch (e) {
            console.warn('[AgentWorkflow] Failed to parse admin_settings JSON:', e?.message);
            ap = {};
        }
        const storeSettings = window.storeService?.state?.settings || {};
        return ap.company_name || storeSettings.companyName || 'FreyAI Visions';
    }

    /**
     * Get a quick status overview of all agents.
     * @returns {Object} Status summary
     */
    getStatus() {
        const agents = [];
        for (const [agentId, agent] of this.agents) {
            agents.push({
                id: agentId,
                name: agent.name,
                icon: agent.icon,
                enabled: agent.enabled,
                lastRun: agent.lastRun,
                lastSuccess: agent.lastResult?.success ?? null,
                schedule: this._getAgentSchedule(agentId)
            });
        }

        return {
            isRunning: this.isRunning,
            schedulerActive: !!this.schedulerInterval,
            agentCount: this.agents.size,
            enabledCount: agents.filter(a => a.enabled).length,
            agents,
            lastExecution: this.executionLog[0] || null,
            totalExecutions: this.executionLog.length
        };
    }

    /**
     * Run all agents sequentially (manual "Run All" action).
     * @param {boolean} dryRun - If true, preview only
     * @returns {Array} Results from all agents
     */
    async runAllAgents(dryRun = false) {
        const results = [];

        for (const [agentId, agent] of this.agents) {
            if (!agent.enabled) {continue;}

            try {
                const result = await this.executeAgent(agentId, {}, dryRun);
                results.push(result);
            } catch (e) {
                results.push({
                    success: false,
                    agentId,
                    agentName: agent.name,
                    error: e.message,
                    timestamp: new Date().toISOString()
                });
            }
        }

        return results;
    }
}

// Register on window
window.agentWorkflowService = new AgentWorkflowService();
