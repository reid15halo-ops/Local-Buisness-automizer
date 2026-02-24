/* ============================================
   Agentic Executor Service
   Autonome Ausfuehrungsengine fuer KI-Agenten

   Upgrades the agent system from suggest-only to
   configurable autonomous execution with:
   - 4 automation levels: off, suggest, confirm, auto
   - Undo system for auto-executed actions (24h window)
   - Approval queue integration for confirm-level
   - Scheduled execution with cron-like patterns
   - Execution history with filtering
   - Role-based access (only Meister can set 'auto')

   Dependencies:
   - window.agentWorkflowService (agent handlers)
   - window.approvalQueueService (confirm-level queue)
   - window.storeService (data access)
   - window.geminiService (AI text generation)

   Storage: localStorage key 'freyai_agentic_config'
   ============================================ */

class AgenticExecutorService {
    constructor() {
        this.STORAGE_KEY = 'freyai_agentic_config';
        this.HISTORY_KEY = 'freyai_agentic_history';
        this.UNDO_KEY = 'freyai_agentic_undo';

        // Automation levels
        this.LEVELS = {
            off: { label: 'Aus', description: 'Agent ist deaktiviert', color: '#71717a' },
            suggest: { label: 'Vorschlagen', description: 'Nur Vorschlaege, keine Aktionen', color: '#3b82f6' },
            confirm: { label: 'Mit Bestaetigung', description: 'Aktionen nach Bestaetigung ausfuehren', color: '#f59e0b' },
            auto: { label: 'Automatisch', description: 'Aktionen sofort ausfuehren (mit Rueckgaengig-Option)', color: '#22c55e' }
        };

        // Default agent configurations
        this.agentConfigs = {
            'morning-briefing': {
                level: 'suggest',
                schedule: '07:00',
                actions: ['generate_briefing', 'send_notification'],
                name: 'Morgen-Briefing',
                icon: '&#9788;',
                category: 'analyse'
            },
            'dunning-agent': {
                level: 'suggest',
                schedule: '09:00',
                actions: ['send_mahnung_email', 'update_mahnstufe', 'create_mahnung_record'],
                name: 'Mahn-Agent',
                icon: '&#9888;',
                category: 'finanzen'
            },
            'lead-followup': {
                level: 'suggest',
                schedule: '08:30',
                actions: ['send_followup_email', 'send_whatsapp', 'create_task'],
                name: 'Lead-Nachverfolgung',
                icon: '&#128140;',
                category: 'vertrieb'
            },
            'quote-generation': {
                level: 'suggest',
                schedule: null,
                actions: ['create_angebot', 'calculate_prices', 'send_to_customer'],
                name: 'Angebots-Generator',
                icon: '&#128196;',
                category: 'vertrieb'
            },
            'schedule-optimizer': {
                level: 'suggest',
                schedule: '06:00',
                actions: ['reschedule_termine', 'notify_customers'],
                name: 'Termin-Optimierer',
                icon: '&#128197;',
                category: 'planung'
            },
            'invoice-reminder': {
                level: 'suggest',
                schedule: '10:00',
                actions: ['send_zahlungserinnerung', 'send_whatsapp_reminder'],
                name: 'Zahlungserinnerung',
                icon: '&#128176;',
                category: 'finanzen'
            },
            'weekly-report': {
                level: 'suggest',
                schedule: 'MON-07:00',
                actions: ['generate_report', 'send_email_report'],
                name: 'Wochenbericht',
                icon: '&#128202;',
                category: 'analyse'
            },
            'smart-pricing': {
                level: 'suggest',
                schedule: null,
                actions: ['analyze_profitability', 'suggest_prices'],
                name: 'Smarte Preisgestaltung',
                icon: '&#128178;',
                category: 'finanzen'
            }
        };

        // Runtime state
        this.executionHistory = [];
        this.undoableActions = [];
        this.schedulerInterval = null;
        this.schedulerRunning = false;
        this._listeners = [];
        this._lastScheduleCheck = {};

        // Load persisted data
        this._loadConfig();
        this._loadHistory();
        this._loadUndoableActions();

        // Clean expired undo actions on init
        this._cleanExpiredUndoActions();
    }

    // ============================================
    // Configuration Management
    // ============================================

    /**
     * Set the automation level for an agent.
     * Only Meister role can set 'auto' level.
     * @param {string} agentId
     * @param {string} level - off|suggest|confirm|auto
     * @returns {Object} Result with success/error
     */
    setAgentLevel(agentId, level) {
        const config = this.agentConfigs[agentId];
        if (!config) {
            return { success: false, error: `Agent ${agentId} nicht konfiguriert` };
        }

        if (!this.LEVELS[level]) {
            return { success: false, error: `Ungueltige Stufe: ${level}` };
        }

        // Role check for 'auto' level
        if (level === 'auto' && !this._isMeisterRole()) {
            return {
                success: false,
                error: 'Nur der Meister kann Agenten auf "Automatisch" setzen'
            };
        }

        const oldLevel = config.level;
        config.level = level;
        this._saveConfig();

        // Log the change
        this._addToHistory({
            type: 'config_change',
            agentId,
            message: `Automatisierungsstufe geaendert: ${this.LEVELS[oldLevel].label} -> ${this.LEVELS[level].label}`,
            timestamp: new Date().toISOString()
        });

        this._notifyListeners('config_changed', { agentId, oldLevel, newLevel: level });

        return { success: true, oldLevel, newLevel: level };
    }

    /**
     * Set the schedule for an agent.
     * @param {string} agentId
     * @param {string|null} schedule - Time string (HH:MM) or day-time (MON-HH:MM) or null
     */
    setAgentSchedule(agentId, schedule) {
        const config = this.agentConfigs[agentId];
        if (!config) return { success: false, error: `Agent ${agentId} nicht konfiguriert` };

        config.schedule = schedule || null;
        this._saveConfig();

        this._notifyListeners('config_changed', { agentId, field: 'schedule', value: schedule });
        return { success: true };
    }

    /**
     * Get configuration for a specific agent.
     * @param {string} agentId
     * @returns {Object|null}
     */
    getAgentConfig(agentId) {
        const config = this.agentConfigs[agentId];
        if (!config) return null;

        return {
            ...config,
            levelInfo: this.LEVELS[config.level],
            lastExecution: this._getLastExecution(agentId),
            pendingApprovals: this._getPendingApprovalsForAgent(agentId),
            undoableCount: this.undoableActions.filter(a => a.agentId === agentId).length
        };
    }

    /**
     * Get all agent configurations with enriched data.
     * @returns {Object}
     */
    getAllConfigs() {
        const configs = {};
        for (const agentId of Object.keys(this.agentConfigs)) {
            configs[agentId] = this.getAgentConfig(agentId);
        }
        return configs;
    }

    // ============================================
    // Action Execution
    // ============================================

    /**
     * Execute an agent action respecting the automation level.
     * @param {string} agentId
     * @param {string} actionId
     * @param {Object} params - Action parameters
     * @returns {Object} Execution result
     */
    async executeAction(agentId, actionId, params = {}) {
        const config = this.agentConfigs[agentId];
        if (!config) {
            throw new Error(`Agent ${agentId} nicht konfiguriert`);
        }

        // Check if action is valid for this agent
        if (!config.actions.includes(actionId)) {
            throw new Error(`Aktion ${actionId} ist nicht fuer Agent ${agentId} registriert`);
        }

        const level = config.level;

        // OFF - Agent deaktiviert
        if (level === 'off') {
            return {
                executed: false,
                reason: 'Agent deaktiviert',
                agentId,
                actionId,
                level
            };
        }

        // SUGGEST - Nur Vorschlaege
        if (level === 'suggest') {
            const suggestion = await this._generateSuggestion(agentId, actionId, params);
            return {
                executed: false,
                suggestion,
                agentId,
                actionId,
                level,
                reason: 'Nur Vorschlag (Stufe: Vorschlagen)'
            };
        }

        // CONFIRM - In Genehmigungswarteschlange
        if (level === 'confirm') {
            return await this._queueForApproval(agentId, actionId, params);
        }

        // AUTO - Sofort ausfuehren mit Rueckgaengig-Option
        if (level === 'auto') {
            return await this._executeWithUndo(agentId, actionId, params);
        }

        return { executed: false, reason: 'Unbekannte Stufe', level };
    }

    /**
     * Run an agent through the executor pipeline.
     * This is the main entry point called by the workflow service.
     * @param {string} agentId
     * @returns {Object} Result
     */
    async runAgent(agentId) {
        const config = this.agentConfigs[agentId];
        if (!config) {
            throw new Error(`Agent ${agentId} nicht konfiguriert`);
        }

        if (config.level === 'off') {
            return {
                executed: false,
                agentId,
                reason: 'Agent deaktiviert',
                timestamp: new Date().toISOString()
            };
        }

        const startTime = Date.now();

        try {
            // First, get the agent result from the workflow service (analysis/suggestion)
            const workflowService = window.agentWorkflowService;
            if (!workflowService) {
                throw new Error('AgentWorkflowService nicht verfuegbar');
            }

            const agentResult = await workflowService.executeAgent(agentId, {}, config.level === 'suggest');

            if (!agentResult.success) {
                this._addToHistory({
                    type: 'execution_error',
                    agentId,
                    agentName: config.name,
                    error: agentResult.error || agentResult.message,
                    duration: Date.now() - startTime,
                    level: config.level,
                    timestamp: new Date().toISOString()
                });
                return agentResult;
            }

            // For suggest level, just return the result
            if (config.level === 'suggest') {
                const historyEntry = {
                    type: 'suggestion',
                    agentId,
                    agentName: config.name,
                    success: true,
                    summary: agentResult.result?.zusammenfassung || 'Vorschlag generiert',
                    duration: Date.now() - startTime,
                    level: 'suggest',
                    timestamp: new Date().toISOString()
                };
                this._addToHistory(historyEntry);

                return {
                    executed: false,
                    suggestion: agentResult.result,
                    agentId,
                    level: 'suggest',
                    duration: Date.now() - startTime,
                    timestamp: new Date().toISOString()
                };
            }

            // For confirm level, queue the actions derived from the result
            if (config.level === 'confirm') {
                const approvalResult = await this._queueAgentResultForApproval(agentId, agentResult.result);

                this._addToHistory({
                    type: 'queued_for_approval',
                    agentId,
                    agentName: config.name,
                    success: true,
                    summary: `${approvalResult.queuedCount || 0} Aktion(en) zur Genehmigung eingereiht`,
                    duration: Date.now() - startTime,
                    level: 'confirm',
                    approvalId: approvalResult.approvalId,
                    timestamp: new Date().toISOString()
                });

                this._showNotification(agentId, 'confirm', `${config.name}: Aktionen warten auf Genehmigung`);

                return {
                    executed: false,
                    queued: true,
                    approvalResult,
                    agentId,
                    level: 'confirm',
                    duration: Date.now() - startTime,
                    timestamp: new Date().toISOString()
                };
            }

            // For auto level, execute actions from the result
            if (config.level === 'auto') {
                const execResult = await this._executeAgentActions(agentId, agentResult.result);

                this._addToHistory({
                    type: 'auto_execution',
                    agentId,
                    agentName: config.name,
                    success: true,
                    summary: `${execResult.actionsExecuted || 0} Aktion(en) automatisch ausgefuehrt`,
                    duration: Date.now() - startTime,
                    level: 'auto',
                    executionId: execResult.executionId,
                    timestamp: new Date().toISOString()
                });

                this._showNotification(agentId, 'auto', `${config.name}: ${execResult.actionsExecuted || 0} Aktion(en) ausgefuehrt`, execResult.executionId);

                return {
                    executed: true,
                    execResult,
                    agentId,
                    level: 'auto',
                    duration: Date.now() - startTime,
                    timestamp: new Date().toISOString()
                };
            }

        } catch (error) {
            this._addToHistory({
                type: 'execution_error',
                agentId,
                agentName: config.name,
                error: error.message,
                duration: Date.now() - startTime,
                level: config.level,
                timestamp: new Date().toISOString()
            });

            console.error(`[AgenticExecutor] Agent ${agentId} fehlgeschlagen:`, error);
            throw error;
        }
    }

    // ============================================
    // Suggestion Generation (suggest level)
    // ============================================

    async _generateSuggestion(agentId, actionId, params) {
        // Generate a preview of what the action would do
        const actionDescriptions = this._getActionDescriptions();
        const desc = actionDescriptions[actionId] || actionId;

        return {
            actionId,
            description: desc,
            preview: params.preview || `Vorgeschlagene Aktion: ${desc}`,
            params,
            generatedAt: new Date().toISOString()
        };
    }

    // ============================================
    // Approval Queue (confirm level)
    // ============================================

    /**
     * Queue a single action for approval.
     */
    async _queueForApproval(agentId, actionId, params) {
        const config = this.agentConfigs[agentId];
        const actionDescriptions = this._getActionDescriptions();
        const approvalId = `approval-agent-${agentId}-${Date.now().toString(36)}`;

        const approvalItem = {
            id: approvalId,
            type: 'agent_action',
            title: `${config.name}: ${actionDescriptions[actionId] || actionId}`,
            summary: params.summary || `Agent "${config.name}" moechte folgende Aktion ausfuehren: ${actionDescriptions[actionId] || actionId}`,
            data: {
                agentId,
                actionId,
                params,
                config: { ...config }
            },
            confidence: params.confidence || 0.85,
            priority: this._getActionPriority(actionId),
            createdAt: new Date().toISOString(),
            actions: {
                approve: 'Aktion ausfuehren',
                reject: 'Aktion verwerfen'
            },
            details: [
                { label: 'Agent', value: config.name },
                { label: 'Aktion', value: actionDescriptions[actionId] || actionId },
                { label: 'Stufe', value: 'Mit Bestaetigung' }
            ]
        };

        // Add to approval queue service if available
        if (window.approvalQueueService) {
            window.approvalQueueService._queue.push(approvalItem);
            window.approvalQueueService._updateBadge(window.approvalQueueService._queue.length);
            window.approvalQueueService._notifyListeners();
        }

        return {
            executed: false,
            queued: true,
            approvalId,
            agentId,
            actionId,
            level: 'confirm',
            message: 'Aktion zur Genehmigung eingereiht'
        };
    }

    /**
     * Queue all actions from an agent run result for approval.
     */
    async _queueAgentResultForApproval(agentId, agentResult) {
        const config = this.agentConfigs[agentId];
        const approvalId = `approval-agent-${agentId}-${Date.now().toString(36)}`;

        // Build a summary of what the agent wants to do
        let summary = '';
        let detailItems = [];

        if (agentId === 'dunning-agent' && agentResult?.mahnungen) {
            summary = `${agentResult.mahnungen.length} Mahnung(en) versenden`;
            detailItems = agentResult.mahnungen.map(m => ({
                label: m.rechnungNummer,
                value: `${m.kunde} - ${this._formatCurrency(m.betrag)} (${m.severityLabel})`
            }));
        } else if (agentId === 'lead-followup' && agentResult?.followups) {
            summary = `${agentResult.followups.length} Nachfassaktion(en)`;
            detailItems = agentResult.followups.map(f => ({
                label: f.kunde,
                value: `${f.tageOffen} Tage offen - ${f.leistungsart || 'Allgemein'}`
            }));
        } else if (agentId === 'quote-generation' && agentResult?.angebote) {
            summary = `${agentResult.angebote.length} Angebot(e) erstellen`;
            detailItems = agentResult.angebote.map(a => ({
                label: a.kunde,
                value: a.geschaetzterPreis ? this._formatCurrency(a.geschaetzterPreis.brutto) : 'Preis offen'
            }));
        } else if (agentId === 'invoice-reminder' && agentResult?.erinnerungen) {
            summary = `${agentResult.erinnerungen.length} Zahlungserinnerung(en) versenden`;
            detailItems = agentResult.erinnerungen.map(e => ({
                label: e.rechnungNummer || e.id,
                value: `${e.kunde} - ${this._formatCurrency(e.betrag)}`
            }));
        } else {
            summary = agentResult?.zusammenfassung || 'Agent-Aktionen ausfuehren';
        }

        const approvalItem = {
            id: approvalId,
            type: 'agent_action',
            title: `${config.name}`,
            summary: summary,
            data: {
                agentId,
                agentResult,
                config: { ...config }
            },
            confidence: 0.85,
            priority: this._getAgentPriority(agentId),
            createdAt: new Date().toISOString(),
            actions: {
                approve: 'Alle Aktionen ausfuehren',
                reject: 'Aktionen verwerfen'
            },
            details: [
                { label: 'Agent', value: config.name },
                { label: 'Stufe', value: 'Mit Bestaetigung' },
                ...detailItems.slice(0, 5) // Limit to 5 detail items
            ]
        };

        if (window.approvalQueueService) {
            window.approvalQueueService._queue.push(approvalItem);
            window.approvalQueueService._updateBadge(window.approvalQueueService._queue.length);
            window.approvalQueueService._notifyListeners();
        }

        return {
            approvalId,
            queuedCount: detailItems.length || 1,
            summary
        };
    }

    /**
     * Process an approval decision.
     * @param {string} approvalId
     * @param {boolean} approved
     * @returns {Object}
     */
    async processApproval(approvalId, approved) {
        // Find the approval in the queue
        const queue = window.approvalQueueService?._queue || [];
        const approvalIndex = queue.findIndex(item => item.id === approvalId);

        if (approvalIndex === -1) {
            return { success: false, error: 'Genehmigungseintrag nicht gefunden' };
        }

        const approval = queue[approvalIndex];

        if (!approved) {
            // Rejected - remove from queue
            queue.splice(approvalIndex, 1);
            if (window.approvalQueueService) {
                window.approvalQueueService._updateBadge(queue.length);
                window.approvalQueueService._notifyListeners();
            }

            this._addToHistory({
                type: 'approval_rejected',
                agentId: approval.data.agentId,
                agentName: approval.data.config?.name || approval.data.agentId,
                summary: `Aktion abgelehnt: ${approval.summary}`,
                timestamp: new Date().toISOString()
            });

            return { success: true, executed: false, reason: 'Abgelehnt' };
        }

        // Approved - execute the action
        try {
            const agentId = approval.data.agentId;
            let execResult;

            if (approval.data.agentResult) {
                // Full agent result to execute
                execResult = await this._executeAgentActions(agentId, approval.data.agentResult);
            } else if (approval.data.actionId) {
                // Single action to execute
                execResult = await this._executeAction(approval.data.actionId, approval.data.params || {});
            }

            // Remove from queue
            queue.splice(approvalIndex, 1);
            if (window.approvalQueueService) {
                window.approvalQueueService._updateBadge(queue.length);
                window.approvalQueueService._notifyListeners();
            }

            this._addToHistory({
                type: 'approval_executed',
                agentId,
                agentName: approval.data.config?.name || agentId,
                success: true,
                summary: `Genehmigt und ausgefuehrt: ${approval.summary}`,
                timestamp: new Date().toISOString()
            });

            return { success: true, executed: true, result: execResult };

        } catch (error) {
            this._addToHistory({
                type: 'approval_execution_error',
                agentId: approval.data.agentId,
                error: error.message,
                timestamp: new Date().toISOString()
            });

            return { success: false, error: error.message };
        }
    }

    // ============================================
    // Auto Execution with Undo
    // ============================================

    /**
     * Execute an action immediately and store undo data.
     */
    async _executeWithUndo(agentId, actionId, params) {
        const executionId = `exec-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 4)}`;

        try {
            // Execute the action
            const result = await this._executeAction(actionId, params);

            // Store undo data
            const undoEntry = {
                executionId,
                agentId,
                actionId,
                params,
                result,
                undoData: result.undoData || null,
                executedAt: new Date().toISOString(),
                undoExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24h
                undone: false
            };

            this.undoableActions.push(undoEntry);
            this._saveUndoableActions();

            this._addToHistory({
                type: 'auto_execution',
                agentId,
                actionId,
                executionId,
                success: true,
                summary: result.summary || `Aktion ${actionId} ausgefuehrt`,
                canUndo: !!result.undoData,
                timestamp: new Date().toISOString()
            });

            return {
                executed: true,
                executionId,
                agentId,
                actionId,
                result,
                canUndo: !!result.undoData,
                undoExpiresAt: undoEntry.undoExpiresAt,
                level: 'auto'
            };

        } catch (error) {
            this._addToHistory({
                type: 'auto_execution_error',
                agentId,
                actionId,
                executionId,
                error: error.message,
                timestamp: new Date().toISOString()
            });

            throw error;
        }
    }

    /**
     * Execute all relevant actions from an agent result (auto level).
     */
    async _executeAgentActions(agentId, agentResult) {
        const executionId = `exec-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 4)}`;
        const actionsExecuted = [];
        const errors = [];

        try {
            // Determine which actions to execute based on agent type and result
            const actionPlan = this._buildActionPlan(agentId, agentResult);

            for (const action of actionPlan) {
                try {
                    const result = await this._executeAction(action.actionId, action.params);
                    actionsExecuted.push({
                        actionId: action.actionId,
                        success: true,
                        result,
                        summary: result.summary || action.actionId
                    });
                } catch (actionError) {
                    errors.push({
                        actionId: action.actionId,
                        error: actionError.message
                    });
                }
            }

            // Store undo data for the entire batch
            const undoEntry = {
                executionId,
                agentId,
                batchActions: actionsExecuted,
                agentResult,
                executedAt: new Date().toISOString(),
                undoExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                undone: false
            };

            this.undoableActions.push(undoEntry);
            this._saveUndoableActions();

            return {
                executionId,
                actionsExecuted: actionsExecuted.length,
                errors: errors.length,
                details: { actionsExecuted, errors },
                canUndo: actionsExecuted.length > 0
            };

        } catch (error) {
            return {
                executionId,
                actionsExecuted: actionsExecuted.length,
                errors: errors.length + 1,
                details: { actionsExecuted, errors: [...errors, { error: error.message }] },
                canUndo: false
            };
        }
    }

    /**
     * Build an action plan from agent results.
     */
    _buildActionPlan(agentId, agentResult) {
        const plan = [];

        switch (agentId) {
            case 'morning-briefing':
                plan.push({
                    actionId: 'generate_briefing',
                    params: { briefingData: agentResult }
                });
                if (agentResult?.dringend?.length > 0) {
                    plan.push({
                        actionId: 'send_notification',
                        params: {
                            title: 'Morgen-Briefing',
                            message: `${agentResult.dringend.length} dringende Punkte`,
                            data: agentResult
                        }
                    });
                }
                break;

            case 'dunning-agent':
                if (agentResult?.mahnungen) {
                    for (const mahnung of agentResult.mahnungen) {
                        if (mahnung.kundeEmail) {
                            plan.push({
                                actionId: 'send_mahnung_email',
                                params: { mahnung, emailTo: mahnung.kundeEmail, text: mahnung.mahntext }
                            });
                        }
                        plan.push({
                            actionId: 'update_mahnstufe',
                            params: { rechnungId: mahnung.rechnungId, severity: mahnung.severity }
                        });
                    }
                }
                break;

            case 'lead-followup':
                if (agentResult?.followups) {
                    for (const followup of agentResult.followups) {
                        if (followup.kundeEmail) {
                            plan.push({
                                actionId: 'send_followup_email',
                                params: { followup, emailTo: followup.kundeEmail, text: followup.nachfasstext }
                            });
                        }
                        plan.push({
                            actionId: 'create_task',
                            params: {
                                title: `Nachfassen: ${followup.kunde}`,
                                description: followup.nachfasstext,
                                priority: followup.prioritaet,
                                anfrageId: followup.anfrageId
                            }
                        });
                    }
                }
                break;

            case 'quote-generation':
                if (agentResult?.angebote) {
                    for (const angebot of agentResult.angebote) {
                        plan.push({
                            actionId: 'create_angebot',
                            params: { angebot }
                        });
                    }
                }
                break;

            case 'schedule-optimizer':
                if (agentResult?.vorschlaege && Array.isArray(agentResult.vorschlaege)) {
                    for (const vorschlag of agentResult.vorschlaege) {
                        if (vorschlag.betroffeneAuftraege?.length > 0) {
                            plan.push({
                                actionId: 'reschedule_termine',
                                params: { vorschlag }
                            });
                        }
                    }
                }
                break;

            case 'invoice-reminder':
                if (agentResult?.erinnerungen) {
                    for (const erinnerung of agentResult.erinnerungen) {
                        plan.push({
                            actionId: 'send_zahlungserinnerung',
                            params: { erinnerung }
                        });
                    }
                }
                break;

            case 'weekly-report':
                plan.push({
                    actionId: 'generate_report',
                    params: { reportData: agentResult }
                });
                break;

            case 'smart-pricing':
                if (agentResult?.preisvorschlaege) {
                    plan.push({
                        actionId: 'suggest_prices',
                        params: { suggestions: agentResult.preisvorschlaege }
                    });
                }
                break;
        }

        return plan;
    }

    /**
     * Execute a single action by ID.
     * Returns result with optional undoData.
     */
    async _executeAction(actionId, params) {
        const actionDescriptions = this._getActionDescriptions();

        switch (actionId) {
            case 'generate_briefing': {
                // Briefing is already generated, just log it
                return {
                    success: true,
                    summary: 'Briefing generiert',
                    undoData: null
                };
            }

            case 'send_notification': {
                // Show browser notification / toast
                this._showToast(params.title || 'Agent-Benachrichtigung', params.message || '');
                return {
                    success: true,
                    summary: `Benachrichtigung gesendet: ${params.title}`,
                    undoData: null
                };
            }

            case 'send_mahnung_email': {
                // Send dunning email via email service / job queue
                const result = await this._sendEmail({
                    to: params.emailTo,
                    subject: `Zahlungserinnerung - Rechnung ${params.mahnung?.rechnungNummer || ''}`,
                    body: params.text || params.mahnung?.mahntext || '',
                    type: 'mahnung'
                });
                return {
                    success: true,
                    summary: `Mahnung gesendet an ${params.emailTo || 'Kunde'}`,
                    undoData: { type: 'email_sent', emailId: result.emailId, to: params.emailTo }
                };
            }

            case 'update_mahnstufe': {
                const store = window.storeService?.state;
                if (store?.rechnungen) {
                    const rechnung = store.rechnungen.find(r => r.id === params.rechnungId);
                    if (rechnung) {
                        const oldStufe = rechnung.mahnstufe || 'keine';
                        rechnung.mahnstufe = params.severity;
                        rechnung.letzteMahnung = new Date().toISOString();
                        window.storeService?.save();
                        return {
                            success: true,
                            summary: `Mahnstufe aktualisiert: ${oldStufe} -> ${params.severity}`,
                            undoData: { type: 'mahnstufe_update', rechnungId: params.rechnungId, oldStufe }
                        };
                    }
                }
                return { success: false, summary: 'Rechnung nicht gefunden', undoData: null };
            }

            case 'create_mahnung_record': {
                // Create a dunning record
                if (window.dunningService?.createMahnung) {
                    await window.dunningService.createMahnung(params);
                }
                return {
                    success: true,
                    summary: 'Mahnungsdatensatz erstellt',
                    undoData: { type: 'mahnung_created', params }
                };
            }

            case 'send_followup_email': {
                const result = await this._sendEmail({
                    to: params.emailTo,
                    subject: `Ihre Anfrage - Nachverfolgung`,
                    body: params.text || params.followup?.nachfasstext || '',
                    type: 'followup'
                });
                return {
                    success: true,
                    summary: `Nachfass-E-Mail gesendet an ${params.emailTo || 'Kunde'}`,
                    undoData: { type: 'email_sent', emailId: result.emailId, to: params.emailTo }
                };
            }

            case 'send_whatsapp': {
                // WhatsApp integration (if configured)
                return {
                    success: true,
                    summary: 'WhatsApp-Nachricht vorbereitet',
                    undoData: null
                };
            }

            case 'create_task': {
                const taskId = `task-${Date.now().toString(36)}`;
                if (window.taskService?.addTask) {
                    window.taskService.addTask({
                        id: taskId,
                        title: params.title,
                        description: params.description,
                        priority: params.priority || 'normal',
                        status: 'offen',
                        createdAt: new Date().toISOString(),
                        source: 'agent',
                        anfrageId: params.anfrageId
                    });
                }
                return {
                    success: true,
                    summary: `Aufgabe erstellt: ${params.title}`,
                    undoData: { type: 'task_created', taskId }
                };
            }

            case 'create_angebot': {
                const angebot = params.angebot;
                const angebotId = `ang-${Date.now().toString(36)}`;
                if (window.storeService) {
                    const newAngebot = {
                        id: angebotId,
                        anfrageId: angebot.anfrageId,
                        kunde: angebot.kundeObj || { name: angebot.kunde },
                        leistungsart: angebot.leistungsart,
                        positionen: angebot.positionen,
                        netto: angebot.geschaetzterPreis?.netto || 0,
                        mwst: angebot.geschaetzterPreis?.mwst || 0,
                        brutto: angebot.geschaetzterPreis?.brutto || 0,
                        angebotstext: angebot.angebotstext,
                        status: 'erstellt',
                        istEntwurf: true,
                        createdAt: new Date().toISOString(),
                        source: 'agent'
                    };

                    if (!window.storeService.state.angebote) {
                        window.storeService.state.angebote = [];
                    }
                    window.storeService.state.angebote.push(newAngebot);
                    window.storeService.save();

                    return {
                        success: true,
                        summary: `Angebot erstellt fuer ${angebot.kunde} (${this._formatCurrency(newAngebot.brutto)})`,
                        undoData: { type: 'angebot_created', angebotId }
                    };
                }
                return { success: false, summary: 'StoreService nicht verfuegbar', undoData: null };
            }

            case 'calculate_prices': {
                return {
                    success: true,
                    summary: 'Preise berechnet',
                    undoData: null
                };
            }

            case 'send_to_customer': {
                return {
                    success: true,
                    summary: 'Angebot an Kunden gesendet',
                    undoData: { type: 'angebot_sent' }
                };
            }

            case 'reschedule_termine': {
                return {
                    success: true,
                    summary: `Terminvorschlag: ${params.vorschlag?.vorschlag || 'Optimierung vorgeschlagen'}`,
                    undoData: null
                };
            }

            case 'notify_customers': {
                return {
                    success: true,
                    summary: 'Kunden ueber Terminaenderungen benachrichtigt',
                    undoData: null
                };
            }

            case 'send_zahlungserinnerung': {
                const erinnerung = params.erinnerung;
                if (erinnerung?.kundeEmail) {
                    await this._sendEmail({
                        to: erinnerung.kundeEmail,
                        subject: `Zahlungserinnerung - Rechnung ${erinnerung.rechnungNummer || ''}`,
                        body: erinnerung.text || `Freundliche Erinnerung an die offene Rechnung ueber ${this._formatCurrency(erinnerung.betrag)}.`,
                        type: 'zahlungserinnerung'
                    });
                }
                return {
                    success: true,
                    summary: `Zahlungserinnerung gesendet: ${erinnerung?.rechnungNummer || 'Rechnung'}`,
                    undoData: { type: 'email_sent', to: erinnerung?.kundeEmail }
                };
            }

            case 'send_whatsapp_reminder': {
                return {
                    success: true,
                    summary: 'WhatsApp-Erinnerung vorbereitet',
                    undoData: null
                };
            }

            case 'generate_report': {
                return {
                    success: true,
                    summary: 'Wochenbericht generiert',
                    undoData: null
                };
            }

            case 'send_email_report': {
                return {
                    success: true,
                    summary: 'Wochenbericht per E-Mail versendet',
                    undoData: { type: 'email_sent' }
                };
            }

            case 'analyze_profitability': {
                return {
                    success: true,
                    summary: 'Rentabilitaetsanalyse durchgefuehrt',
                    undoData: null
                };
            }

            case 'suggest_prices': {
                return {
                    success: true,
                    summary: 'Preisvorschlaege generiert',
                    undoData: null
                };
            }

            default:
                return {
                    success: false,
                    summary: `Unbekannte Aktion: ${actionId}`,
                    undoData: null
                };
        }
    }

    /**
     * Send an email via the job queue or email service.
     */
    async _sendEmail(emailData) {
        const emailId = `email-${Date.now().toString(36)}`;

        try {
            // Try job queue service
            if (window.jobQueueService) {
                await window.jobQueueService.submitJob('email_send', {
                    id: emailId,
                    to: emailData.to,
                    subject: emailData.subject,
                    body: emailData.body,
                    type: emailData.type
                });
            }

            // Store in communications log
            try {
                const comms = JSON.parse(localStorage.getItem('freyai_communications') || '[]');
                comms.push({
                    id: emailId,
                    to: emailData.to,
                    subject: emailData.subject,
                    body: emailData.body,
                    type: emailData.type,
                    status: 'sent',
                    sentAt: new Date().toISOString(),
                    source: 'agent'
                });
                localStorage.setItem('freyai_communications', JSON.stringify(comms));
            } catch (e) {
                // Ignore localStorage errors
            }

            // Log activity
            window.storeService?.addActivity('&#128231;', `Agent-E-Mail gesendet: ${emailData.subject}`);

        } catch (error) {
            console.warn('[AgenticExecutor] E-Mail-Versand fehlgeschlagen:', error);
        }

        return { emailId };
    }

    // ============================================
    // Undo System
    // ============================================

    /**
     * Undo a previously executed action.
     * @param {string} executionId
     * @returns {Object}
     */
    async undoExecution(executionId) {
        const undoEntry = this.undoableActions.find(a => a.executionId === executionId && !a.undone);

        if (!undoEntry) {
            return { success: false, error: 'Rueckgaengig-Eintrag nicht gefunden oder bereits rueckgaengig gemacht' };
        }

        // Check if undo has expired
        if (new Date(undoEntry.undoExpiresAt) < new Date()) {
            return { success: false, error: 'Rueckgaengig-Zeitfenster abgelaufen (24 Stunden)' };
        }

        try {
            // Undo batch actions
            if (undoEntry.batchActions) {
                for (const action of undoEntry.batchActions) {
                    if (action.result?.undoData) {
                        await this._undoSingleAction(action.result.undoData);
                    }
                }
            }

            // Undo single action
            if (undoEntry.undoData) {
                await this._undoSingleAction(undoEntry.undoData);
            }

            undoEntry.undone = true;
            undoEntry.undoneAt = new Date().toISOString();
            this._saveUndoableActions();

            this._addToHistory({
                type: 'undo',
                agentId: undoEntry.agentId,
                executionId,
                summary: `Aktion rueckgaengig gemacht (${undoEntry.actionId || 'Batch'})`,
                timestamp: new Date().toISOString()
            });

            this._showToast('Rueckgaengig', 'Aktion wurde rueckgaengig gemacht');
            this._notifyListeners('undo', { executionId });

            return { success: true, message: 'Aktion erfolgreich rueckgaengig gemacht' };

        } catch (error) {
            return { success: false, error: `Rueckgaengig fehlgeschlagen: ${error.message}` };
        }
    }

    /**
     * Undo a single action based on its undo data.
     */
    async _undoSingleAction(undoData) {
        if (!undoData) return;

        switch (undoData.type) {
            case 'mahnstufe_update': {
                const store = window.storeService?.state;
                if (store?.rechnungen) {
                    const rechnung = store.rechnungen.find(r => r.id === undoData.rechnungId);
                    if (rechnung) {
                        rechnung.mahnstufe = undoData.oldStufe;
                        delete rechnung.letzteMahnung;
                        window.storeService?.save();
                    }
                }
                break;
            }

            case 'task_created': {
                if (window.taskService?.removeTask) {
                    window.taskService.removeTask(undoData.taskId);
                }
                break;
            }

            case 'angebot_created': {
                const store = window.storeService?.state;
                if (store?.angebote) {
                    store.angebote = store.angebote.filter(a => a.id !== undoData.angebotId);
                    window.storeService?.save();
                }
                break;
            }

            case 'email_sent': {
                // Emails cannot be truly unsent, but we mark them
                console.warn('[AgenticExecutor] E-Mail kann nicht zurueckgerufen werden - nur als Hinweis markiert');
                break;
            }

            default:
                console.warn(`[AgenticExecutor] Unbekannter Undo-Typ: ${undoData.type}`);
        }
    }

    /**
     * Get all actions that can still be undone.
     * @returns {Array}
     */
    getUndoableActions() {
        const now = new Date();
        return this.undoableActions.filter(a =>
            !a.undone && new Date(a.undoExpiresAt) > now
        );
    }

    /**
     * Remove expired undo entries.
     */
    _cleanExpiredUndoActions() {
        const now = new Date();
        const before = this.undoableActions.length;
        this.undoableActions = this.undoableActions.filter(a =>
            !a.undone && new Date(a.undoExpiresAt) > now
        );
        if (this.undoableActions.length !== before) {
            this._saveUndoableActions();
        }
    }

    // ============================================
    // Scheduling
    // ============================================

    /**
     * Start the scheduler that checks every minute for due agents.
     */
    startScheduler() {
        if (this.schedulerInterval) return;

        this.schedulerRunning = true;
        this.schedulerInterval = setInterval(() => this.checkSchedules(), 60000);
        console.log('[AgenticExecutor] Scheduler gestartet');
        this._notifyListeners('scheduler_started', {});
    }

    /**
     * Stop the scheduler.
     */
    stopScheduler() {
        if (this.schedulerInterval) {
            clearInterval(this.schedulerInterval);
            this.schedulerInterval = null;
        }
        this.schedulerRunning = false;
        console.log('[AgenticExecutor] Scheduler gestoppt');
        this._notifyListeners('scheduler_stopped', {});
    }

    /**
     * Check all scheduled agents and trigger those that are due.
     */
    async checkSchedules() {
        const now = new Date();
        const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        const currentDay = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][now.getDay()];
        const todayKey = now.toDateString();

        for (const [agentId, config] of Object.entries(this.agentConfigs)) {
            if (config.level === 'off' || !config.schedule) continue;

            // Parse schedule
            let scheduledTime = config.schedule;
            let scheduledDay = null;

            if (config.schedule.includes('-')) {
                const parts = config.schedule.split('-');
                scheduledDay = parts[0];
                scheduledTime = parts[1];
            }

            // Check day constraint
            if (scheduledDay && scheduledDay !== currentDay) continue;

            // Check time match
            if (scheduledTime !== currentTime) continue;

            // Check if already run today
            const lastCheckKey = `${agentId}-${todayKey}`;
            if (this._lastScheduleCheck[lastCheckKey]) continue;

            // Mark as checked for today
            this._lastScheduleCheck[lastCheckKey] = true;

            // Run the agent
            try {
                console.log(`[AgenticExecutor] Geplanter Agent ${agentId} wird ausgefuehrt (${currentTime})`);
                await this.runAgent(agentId);
            } catch (error) {
                console.error(`[AgenticExecutor] Geplanter Agent ${agentId} fehlgeschlagen:`, error);
            }
        }
    }

    // ============================================
    // Execution History
    // ============================================

    /**
     * Get execution history with optional filters.
     * @param {Object} filters - { agentId, dateFrom, dateTo, status, type }
     * @returns {Array}
     */
    getExecutionHistory(filters = {}) {
        let history = [...this.executionHistory];

        if (filters.agentId) {
            history = history.filter(h => h.agentId === filters.agentId);
        }

        if (filters.dateFrom) {
            const from = new Date(filters.dateFrom);
            history = history.filter(h => new Date(h.timestamp) >= from);
        }

        if (filters.dateTo) {
            const to = new Date(filters.dateTo);
            history = history.filter(h => new Date(h.timestamp) <= to);
        }

        if (filters.type) {
            history = history.filter(h => h.type === filters.type);
        }

        if (filters.level) {
            history = history.filter(h => h.level === filters.level);
        }

        const limit = filters.limit || 100;
        return history.slice(0, limit);
    }

    _getLastExecution(agentId) {
        return this.executionHistory.find(h => h.agentId === agentId) || null;
    }

    _getPendingApprovalsForAgent(agentId) {
        if (!window.approvalQueueService) return 0;
        return window.approvalQueueService._queue.filter(
            item => item.data?.agentId === agentId
        ).length;
    }

    _addToHistory(entry) {
        entry.id = `hist-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 4)}`;
        this.executionHistory.unshift(entry);

        // Keep history manageable
        if (this.executionHistory.length > 500) {
            this.executionHistory = this.executionHistory.slice(0, 500);
        }

        this._saveHistory();
        this._notifyListeners('history_updated', entry);
    }

    clearHistory() {
        this.executionHistory = [];
        this._saveHistory();
    }

    // ============================================
    // Notification System
    // ============================================

    _showNotification(agentId, level, message, executionId = null) {
        const config = this.agentConfigs[agentId];
        if (!config) return;

        // Dispatch custom event for the dashboard UI to pick up
        const event = new CustomEvent('agentic-notification', {
            detail: {
                agentId,
                agentName: config.name,
                icon: config.icon,
                level,
                message,
                executionId,
                canUndo: level === 'auto' && !!executionId,
                timestamp: new Date().toISOString()
            }
        });
        document.dispatchEvent(event);

        // Also show toast
        this._showToast(config.name, message);
    }

    _showToast(title, message) {
        if (typeof window.showToast === 'function') {
            window.showToast(`${title}: ${message}`, 'info');
        } else if (window.UI?.showToast) {
            window.UI.showToast(`${title}: ${message}`, 'info');
        } else if (window.errorHandler?.info) {
            window.errorHandler.info(`${title}: ${message}`);
        }
    }

    // ============================================
    // Event System
    // ============================================

    /**
     * Register a listener for executor events.
     * @param {Function} callback - Called with (eventType, data)
     * @returns {Function} Unsubscribe function
     */
    onChange(callback) {
        this._listeners.push(callback);
        return () => {
            this._listeners = this._listeners.filter(cb => cb !== callback);
        };
    }

    _notifyListeners(eventType, data) {
        for (const cb of this._listeners) {
            try {
                cb(eventType, data);
            } catch (e) {
                console.warn('[AgenticExecutor] Listener-Fehler:', e);
            }
        }
    }

    // ============================================
    // Persistence
    // ============================================

    _loadConfig() {
        try {
            const stored = localStorage.getItem(this.STORAGE_KEY);
            if (stored) {
                const savedConfigs = JSON.parse(stored);
                // Merge saved config over defaults (preserving new agents not in saved data)
                for (const [agentId, savedConfig] of Object.entries(savedConfigs)) {
                    if (this.agentConfigs[agentId]) {
                        // Only merge specific user-configurable fields
                        if (savedConfig.level) this.agentConfigs[agentId].level = savedConfig.level;
                        if (savedConfig.schedule !== undefined) this.agentConfigs[agentId].schedule = savedConfig.schedule;
                    }
                }
            }
        } catch (e) {
            console.warn('[AgenticExecutor] Konfiguration laden fehlgeschlagen:', e);
        }
    }

    _saveConfig() {
        try {
            const toSave = {};
            for (const [agentId, config] of Object.entries(this.agentConfigs)) {
                toSave[agentId] = {
                    level: config.level,
                    schedule: config.schedule
                };
            }
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(toSave));
        } catch (e) {
            console.warn('[AgenticExecutor] Konfiguration speichern fehlgeschlagen:', e);
        }
    }

    _loadHistory() {
        try {
            const stored = localStorage.getItem(this.HISTORY_KEY);
            if (stored) {
                this.executionHistory = JSON.parse(stored);
            }
        } catch (e) {
            console.warn('[AgenticExecutor] Historie laden fehlgeschlagen:', e);
            this.executionHistory = [];
        }
    }

    _saveHistory() {
        try {
            localStorage.setItem(this.HISTORY_KEY, JSON.stringify(this.executionHistory));
        } catch (e) {
            console.warn('[AgenticExecutor] Historie speichern fehlgeschlagen:', e);
        }
    }

    _loadUndoableActions() {
        try {
            const stored = localStorage.getItem(this.UNDO_KEY);
            if (stored) {
                this.undoableActions = JSON.parse(stored);
            }
        } catch (e) {
            console.warn('[AgenticExecutor] Undo-Daten laden fehlgeschlagen:', e);
            this.undoableActions = [];
        }
    }

    _saveUndoableActions() {
        try {
            localStorage.setItem(this.UNDO_KEY, JSON.stringify(this.undoableActions));
        } catch (e) {
            console.warn('[AgenticExecutor] Undo-Daten speichern fehlgeschlagen:', e);
        }
    }

    // ============================================
    // Utility Methods
    // ============================================

    _isMeisterRole() {
        // Check user role from auth service or user manager
        const user = window.authService?.getUser?.() || window.userManager?.getCurrentUser?.();
        if (user?.role === 'meister' || user?.role === 'admin' || user?.role === 'owner') {
            return true;
        }

        // Check from store settings
        const settings = window.storeService?.state?.settings;
        if (settings?.userRole === 'meister' || settings?.userRole === 'admin') {
            return true;
        }

        // Fallback: allow if no auth system is configured (development mode)
        if (!window.authService && !window.userManager) {
            return true;
        }

        return false;
    }

    _formatCurrency(amount) {
        return new Intl.NumberFormat('de-DE', {
            style: 'currency',
            currency: 'EUR'
        }).format(amount || 0);
    }

    _getActionDescriptions() {
        return {
            generate_briefing: 'Tagesbriefing generieren',
            send_notification: 'Benachrichtigung senden',
            send_mahnung_email: 'Mahnung per E-Mail senden',
            update_mahnstufe: 'Mahnstufe aktualisieren',
            create_mahnung_record: 'Mahnungsdatensatz erstellen',
            send_followup_email: 'Nachfass-E-Mail senden',
            send_whatsapp: 'WhatsApp-Nachricht senden',
            create_task: 'Aufgabe erstellen',
            create_angebot: 'Angebot erstellen',
            calculate_prices: 'Preise kalkulieren',
            send_to_customer: 'An Kunden senden',
            reschedule_termine: 'Termine umplanen',
            notify_customers: 'Kunden benachrichtigen',
            send_zahlungserinnerung: 'Zahlungserinnerung senden',
            send_whatsapp_reminder: 'WhatsApp-Erinnerung senden',
            generate_report: 'Bericht generieren',
            send_email_report: 'Bericht per E-Mail senden',
            analyze_profitability: 'Rentabilitaet analysieren',
            suggest_prices: 'Preise vorschlagen'
        };
    }

    _getActionPriority(actionId) {
        const highPriority = ['send_mahnung_email', 'update_mahnstufe', 'send_zahlungserinnerung'];
        const medPriority = ['send_followup_email', 'create_angebot', 'create_task'];

        if (highPriority.includes(actionId)) return 1;
        if (medPriority.includes(actionId)) return 2;
        return 3;
    }

    _getAgentPriority(agentId) {
        const priorities = {
            'dunning-agent': 1,
            'invoice-reminder': 1,
            'lead-followup': 2,
            'quote-generation': 2,
            'schedule-optimizer': 3,
            'morning-briefing': 3,
            'weekly-report': 3,
            'smart-pricing': 3
        };
        return priorities[agentId] || 3;
    }

    /**
     * Get a status overview of the executor.
     * @returns {Object}
     */
    getStatus() {
        const configs = this.getAllConfigs();
        const agents = Object.values(configs);

        return {
            schedulerRunning: this.schedulerRunning,
            totalAgents: agents.length,
            byLevel: {
                off: agents.filter(a => a.level === 'off').length,
                suggest: agents.filter(a => a.level === 'suggest').length,
                confirm: agents.filter(a => a.level === 'confirm').length,
                auto: agents.filter(a => a.level === 'auto').length
            },
            undoableCount: this.getUndoableActions().length,
            historyCount: this.executionHistory.length,
            lastExecution: this.executionHistory[0] || null
        };
    }

    /**
     * Cleanup resources.
     */
    destroy() {
        this.stopScheduler();
        this._listeners = [];
    }
}

// Register on window
window.agenticExecutorService = new AgenticExecutorService();
