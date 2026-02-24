/* ============================================
   Agent Workflow UI
   KI-Agenten Dashboard & Steuerung

   Sections:
   1. Agent Dashboard - Cards for each agent with status
   2. Morning Briefing - Hero card with key metrics
   3. Execution Log - Timeline of all agent actions
   4. Agent Configuration - Toggle on/off, set schedule
   5. Manual Trigger - "Jetzt ausfuehren" buttons
   6. Dry Run Preview - Preview mode
   ============================================ */

class AgentWorkflowUI {
    constructor() {
        this.container = null;
        this.currentTab = 'dashboard';
        this.isLoading = false;
        this.currentBriefing = null;
        this.previewResult = null;
        this.init();
    }

    init() {
        this.container = document.getElementById('view-agent-workflows');
        if (!this.container) {return;}

        this.render();
        this.attachEventListeners();
    }

    // ============================================
    // Main Render
    // ============================================

    render() {
        if (!this.container) {return;}

        this.container.innerHTML = `
            <div class="agent-workflow-wrapper">
                <!-- Header -->
                <div class="agent-header">
                    <div class="agent-header-left">
                        <h1 class="agent-title">KI-Autopilot</h1>
                        <p class="agent-subtitle">Autonome Agenten fuer Ihre Geschaeftsprozesse</p>
                    </div>
                    <div class="agent-header-actions">
                        <button class="btn btn-secondary agent-btn-scheduler" id="btn-toggle-scheduler">
                            <span class="agent-btn-icon">&#9201;</span>
                            Scheduler starten
                        </button>
                        <button class="btn btn-primary agent-btn-run-all" id="btn-run-all-agents">
                            <span class="agent-btn-icon">&#9654;</span>
                            Alle ausfuehren
                        </button>
                    </div>
                </div>

                <!-- Tab Navigation -->
                <div class="agent-tab-bar">
                    <button class="agent-tab active" data-tab="dashboard">
                        <span class="agent-tab-icon">&#9881;</span>
                        Dashboard
                    </button>
                    <button class="agent-tab" data-tab="briefing">
                        <span class="agent-tab-icon">&#9788;</span>
                        Morgen-Briefing
                    </button>
                    <button class="agent-tab" data-tab="log">
                        <span class="agent-tab-icon">&#128203;</span>
                        Protokoll
                    </button>
                    <button class="agent-tab" data-tab="config">
                        <span class="agent-tab-icon">&#9881;</span>
                        Einstellungen
                    </button>
                </div>

                <!-- Tab Content -->
                <div class="agent-tab-content">
                    <div class="agent-tab-pane active" id="agent-pane-dashboard">
                        ${this._renderDashboard()}
                    </div>
                    <div class="agent-tab-pane" id="agent-pane-briefing">
                        ${this._renderBriefingPanel()}
                    </div>
                    <div class="agent-tab-pane" id="agent-pane-log">
                        ${this._renderExecutionLog()}
                    </div>
                    <div class="agent-tab-pane" id="agent-pane-config">
                        ${this._renderConfigPanel()}
                    </div>
                </div>

                <!-- Dry Run Preview Modal -->
                <div class="agent-preview-modal" id="agent-preview-modal" style="display:none;">
                    <div class="agent-preview-backdrop"></div>
                    <div class="agent-preview-content">
                        <div class="agent-preview-header">
                            <h3>Vorschau (Trockenlauf)</h3>
                            <button class="agent-preview-close" id="btn-close-preview">&times;</button>
                        </div>
                        <div class="agent-preview-body" id="agent-preview-body">
                            <!-- Filled dynamically -->
                        </div>
                        <div class="agent-preview-footer">
                            <button class="btn btn-secondary" id="btn-cancel-preview">Schliessen</button>
                            <button class="btn btn-primary" id="btn-execute-from-preview">Jetzt ausfuehren</button>
                        </div>
                    </div>
                </div>

                <!-- Loading Overlay -->
                <div class="agent-loading-overlay" id="agent-loading" style="display:none;">
                    <div class="agent-loading-spinner"></div>
                    <p class="agent-loading-text">Agent wird ausgefuehrt...</p>
                </div>
            </div>
        `;
    }

    // ============================================
    // Dashboard Tab
    // ============================================

    _renderDashboard() {
        const service = window.agentWorkflowService;
        if (!service) {
            return '<p class="agent-empty-state">Agent-Service nicht verfuegbar.</p>';
        }

        const config = service.getAgentConfig();
        const agents = Object.values(config);

        return `
            <div class="agent-dashboard">
                <!-- Quick Stats -->
                <div class="agent-stats-row">
                    <div class="agent-stat-card">
                        <div class="agent-stat-value">${agents.length}</div>
                        <div class="agent-stat-label">Agenten</div>
                    </div>
                    <div class="agent-stat-card">
                        <div class="agent-stat-value agent-stat-active">${agents.filter(a => a.enabled).length}</div>
                        <div class="agent-stat-label">Aktiv</div>
                    </div>
                    <div class="agent-stat-card">
                        <div class="agent-stat-value">${service.executionLog.length}</div>
                        <div class="agent-stat-label">Ausfuehrungen</div>
                    </div>
                    <div class="agent-stat-card">
                        <div class="agent-stat-value">${service.isRunning ? '<span class="agent-status-pulse">Laeuft</span>' : 'Bereit'}</div>
                        <div class="agent-stat-label">Status</div>
                    </div>
                </div>

                <!-- Agent Cards Grid -->
                <div class="agent-cards-grid">
                    ${agents.map(agent => this._renderAgentCard(agent)).join('')}
                </div>
            </div>
        `;
    }

    _renderAgentCard(agent) {
        const lastRunFormatted = agent.lastRun
            ? new Date(agent.lastRun).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
            : 'Noch nie';
        const lastSuccess = agent.lastResult?.success;
        const statusClass = agent.enabled
            ? (lastSuccess === false ? 'agent-card-error' : 'agent-card-active')
            : 'agent-card-disabled';
        const statusBadge = agent.enabled
            ? (lastSuccess === false
                ? '<span class="agent-badge agent-badge-error">Fehler</span>'
                : '<span class="agent-badge agent-badge-active">Aktiv</span>')
            : '<span class="agent-badge agent-badge-disabled">Inaktiv</span>';

        return `
            <div class="agent-card ${statusClass}" data-agent-id="${agent.id}">
                <div class="agent-card-header">
                    <span class="agent-card-icon">${agent.icon}</span>
                    <div class="agent-card-title-group">
                        <h3 class="agent-card-name">${agent.name}</h3>
                        ${statusBadge}
                    </div>
                </div>
                <p class="agent-card-desc">${agent.description}</p>
                <div class="agent-card-meta">
                    <div class="agent-card-meta-item">
                        <span class="agent-meta-label">Letzter Lauf:</span>
                        <span class="agent-meta-value">${lastRunFormatted}</span>
                    </div>
                    <div class="agent-card-meta-item">
                        <span class="agent-meta-label">Geplant:</span>
                        <span class="agent-meta-value">${agent.schedule || '--:--'} Uhr</span>
                    </div>
                    ${agent.lastResult?.summary ? `
                    <div class="agent-card-meta-item agent-card-summary">
                        <span class="agent-meta-value">${this._truncate(agent.lastResult.summary, 100)}</span>
                    </div>
                    ` : ''}
                </div>
                <div class="agent-card-actions">
                    <button class="btn btn-sm btn-primary agent-btn-run" data-agent-id="${agent.id}">
                        <span class="agent-btn-icon">&#9654;</span> Ausfuehren
                    </button>
                    <button class="btn btn-sm btn-secondary agent-btn-preview" data-agent-id="${agent.id}">
                        <span class="agent-btn-icon">&#128065;</span> Vorschau
                    </button>
                </div>
            </div>
        `;
    }

    // ============================================
    // Morning Briefing Tab
    // ============================================

    _renderBriefingPanel() {
        if (this.currentBriefing) {
            return this._renderBriefingContent(this.currentBriefing);
        }

        return `
            <div class="agent-briefing-empty">
                <div class="agent-briefing-icon">&#9788;</div>
                <h2>Morgen-Briefing</h2>
                <p>Starten Sie Ihr Tagesbriefing, um einen ueberblick ueber alle Geschaeftsaktivitaeten zu erhalten.</p>
                <button class="btn btn-primary btn-lg agent-btn-generate-briefing" id="btn-generate-briefing">
                    <span class="agent-btn-icon">&#9654;</span> Briefing generieren
                </button>
            </div>
        `;
    }

    _renderBriefingContent(briefing) {
        const z = briefing.zusammenfassung;
        const urgentItems = briefing.dringend || [];
        const hasUrgent = urgentItems.length > 0;

        return `
            <div class="agent-briefing">
                <!-- Briefing Header -->
                <div class="agent-briefing-hero">
                    <div class="agent-briefing-hero-header">
                        <span class="agent-briefing-hero-icon">&#9788;</span>
                        <div>
                            <h2 class="agent-briefing-hero-title">Morgen-Briefing</h2>
                            <p class="agent-briefing-hero-date">${new Date(briefing.datum).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
                        </div>
                    </div>
                    <button class="btn btn-secondary btn-sm" id="btn-refresh-briefing">
                        <span class="agent-btn-icon">&#8635;</span> Aktualisieren
                    </button>
                </div>

                <!-- Key Metrics -->
                <div class="agent-briefing-metrics">
                    <div class="agent-briefing-metric">
                        <div class="agent-briefing-metric-value">${z.neueAnfragen}</div>
                        <div class="agent-briefing-metric-label">Neue Anfragen</div>
                    </div>
                    <div class="agent-briefing-metric">
                        <div class="agent-briefing-metric-value">${z.offeneAngebote}</div>
                        <div class="agent-briefing-metric-label">Offene Angebote</div>
                    </div>
                    <div class="agent-briefing-metric">
                        <div class="agent-briefing-metric-value">${z.aktiveAuftraege}</div>
                        <div class="agent-briefing-metric-label">Aktive Auftraege</div>
                    </div>
                    <div class="agent-briefing-metric ${z.ueberfaelligeRechnungen > 0 ? 'agent-metric-danger' : ''}">
                        <div class="agent-briefing-metric-value">${z.ueberfaelligeRechnungen}</div>
                        <div class="agent-briefing-metric-label">Ueberfaellige Rechnungen</div>
                    </div>
                    <div class="agent-briefing-metric ${z.inaktiveLeads > 0 ? 'agent-metric-warning' : ''}">
                        <div class="agent-briefing-metric-value">${z.inaktiveLeads}</div>
                        <div class="agent-briefing-metric-label">Inaktive Leads</div>
                    </div>
                </div>

                <!-- Urgent Items -->
                ${hasUrgent ? `
                <div class="agent-briefing-section agent-briefing-urgent">
                    <h3 class="agent-briefing-section-title">
                        <span class="agent-section-icon">&#9888;</span> Dringende Punkte
                    </h3>
                    <div class="agent-urgent-list">
                        ${urgentItems.map(item => `
                            <div class="agent-urgent-item agent-urgent-${item.prioritaet}">
                                <span class="agent-urgent-badge">${item.prioritaet.toUpperCase()}</span>
                                <span class="agent-urgent-text">${item.nachricht}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
                ` : ''}

                <!-- Cash Flow -->
                <div class="agent-briefing-section">
                    <h3 class="agent-briefing-section-title">
                        <span class="agent-section-icon">&#128176;</span> Finanzueberblick
                    </h3>
                    <div class="agent-cashflow-row">
                        <div class="agent-cashflow-item">
                            <span class="agent-cashflow-label">Ueberfaellige Forderungen</span>
                            <span class="agent-cashflow-value agent-cashflow-danger">${this._formatCurrency(briefing.cashflow.ueberfaellig)}</span>
                        </div>
                        <div class="agent-cashflow-item">
                            <span class="agent-cashflow-label">Ausstehende Zahlungen</span>
                            <span class="agent-cashflow-value">${this._formatCurrency(briefing.cashflow.ausstehend)}</span>
                        </div>
                        <div class="agent-cashflow-item">
                            <span class="agent-cashflow-label">Offene Rechnungen</span>
                            <span class="agent-cashflow-value">${briefing.cashflow.offeneRechnungenAnzahl}</span>
                        </div>
                    </div>
                </div>

                <!-- AI Summary -->
                ${briefing.aiSummary ? `
                <div class="agent-briefing-section agent-briefing-ai-summary">
                    <h3 class="agent-briefing-section-title">
                        <span class="agent-section-icon">&#129302;</span> KI-Zusammenfassung
                    </h3>
                    <div class="agent-ai-summary-text">${this._nl2br(briefing.aiSummary)}</div>
                </div>
                ` : ''}

                <!-- Overdue Invoices Detail -->
                ${briefing.overdueInvoices.length > 0 ? `
                <div class="agent-briefing-section">
                    <h3 class="agent-briefing-section-title">
                        <span class="agent-section-icon">&#128176;</span> Ueberfaellige Rechnungen
                    </h3>
                    <div class="agent-detail-list">
                        ${briefing.overdueInvoices.map(inv => `
                            <div class="agent-detail-item">
                                <div class="agent-detail-main">
                                    <strong>${inv.nummer}</strong> - ${inv.kunde}
                                </div>
                                <div class="agent-detail-right">
                                    <span class="agent-detail-amount">${this._formatCurrency(inv.betrag)}</span>
                                    <span class="agent-detail-badge agent-badge-error">${inv.tageUeberfaellig} Tage</span>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                ` : ''}

                <!-- Stale Leads Detail -->
                ${briefing.staleLeads.length > 0 ? `
                <div class="agent-briefing-section">
                    <h3 class="agent-briefing-section-title">
                        <span class="agent-section-icon">&#128140;</span> Unbeantwortete Anfragen
                    </h3>
                    <div class="agent-detail-list">
                        ${briefing.staleLeads.map(lead => `
                            <div class="agent-detail-item">
                                <div class="agent-detail-main">
                                    <strong>${this._esc(lead.kunde)}</strong> ${lead.leistungsart ? `- ${this._esc(lead.leistungsart)}` : ''}
                                </div>
                                <div class="agent-detail-right">
                                    <span class="agent-detail-badge agent-badge-warning">${lead.tageOffen} Tage</span>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                ` : ''}

                <!-- Active Orders -->
                ${briefing.aktiveAuftraege.length > 0 ? `
                <div class="agent-briefing-section">
                    <h3 class="agent-briefing-section-title">
                        <span class="agent-section-icon">&#128295;</span> Aktive Auftraege
                    </h3>
                    <div class="agent-detail-list">
                        ${briefing.aktiveAuftraege.map(a => `
                            <div class="agent-detail-item">
                                <div class="agent-detail-main">
                                    <strong>${this._esc(a.id)}</strong> - ${this._esc(a.kunde)} ${a.leistungsart ? `(${this._esc(a.leistungsart)})` : ''}
                                </div>
                                <div class="agent-detail-right">
                                    <div class="agent-progress-bar-sm">
                                        <div class="agent-progress-fill" style="width: ${a.fortschritt}%"></div>
                                    </div>
                                    <span class="agent-detail-badge">${a.fortschritt}%</span>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                ` : ''}
            </div>
        `;
    }

    // ============================================
    // Execution Log Tab
    // ============================================

    _renderExecutionLog() {
        const service = window.agentWorkflowService;
        if (!service) {
            return '<p class="agent-empty-state">Agent-Service nicht verfuegbar.</p>';
        }

        const logs = service.getExecutionLog(50);

        if (logs.length === 0) {
            return `
                <div class="agent-log-empty">
                    <div class="agent-log-empty-icon">&#128203;</div>
                    <h3>Ausfuehrungsprotokoll</h3>
                    <p>Noch keine Agent-Ausfuehrungen aufgezeichnet.</p>
                </div>
            `;
        }

        return `
            <div class="agent-log">
                <div class="agent-log-header">
                    <h3>Ausfuehrungsprotokoll</h3>
                    <button class="btn btn-sm btn-secondary" id="btn-clear-log">Protokoll loeschen</button>
                </div>
                <div class="agent-log-timeline">
                    ${logs.map(entry => this._renderLogEntry(entry)).join('')}
                </div>
            </div>
        `;
    }

    _renderLogEntry(entry) {
        const time = new Date(entry.timestamp).toLocaleString('de-DE', {
            day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit'
        });
        const statusClass = entry.success ? 'agent-log-success' : 'agent-log-error';
        const statusIcon = entry.success ? '&#10003;' : '&#10007;';
        const durationSec = (entry.duration / 1000).toFixed(1);

        return `
            <div class="agent-log-entry ${statusClass}">
                <div class="agent-log-indicator">
                    <span class="agent-log-dot">${statusIcon}</span>
                </div>
                <div class="agent-log-body">
                    <div class="agent-log-entry-header">
                        <strong>${entry.agentName || entry.agentId}</strong>
                        ${entry.dryRun ? '<span class="agent-badge agent-badge-info">Trockenlauf</span>' : ''}
                        <span class="agent-log-time">${time}</span>
                    </div>
                    ${entry.summary ? `<p class="agent-log-summary">${this._truncate(entry.summary, 200)}</p>` : ''}
                    ${entry.error ? `<p class="agent-log-error-msg">Fehler: ${entry.error}</p>` : ''}
                    <span class="agent-log-duration">${durationSec}s</span>
                </div>
            </div>
        `;
    }

    // ============================================
    // Configuration Tab
    // ============================================

    _renderConfigPanel() {
        const service = window.agentWorkflowService;
        if (!service) {
            return '<p class="agent-empty-state">Agent-Service nicht verfuegbar.</p>';
        }

        const config = service.getAgentConfig();
        const agents = Object.values(config);

        return `
            <div class="agent-config">
                <div class="agent-config-header">
                    <h3>Agent-Einstellungen</h3>
                    <p class="agent-config-desc">Aktivieren oder deaktivieren Sie einzelne Agenten und passen Sie die Ausfuehrungszeiten an.</p>
                </div>
                <div class="agent-config-list">
                    ${agents.map(agent => `
                        <div class="agent-config-item" data-agent-id="${agent.id}">
                            <div class="agent-config-item-left">
                                <span class="agent-config-icon">${agent.icon}</span>
                                <div class="agent-config-info">
                                    <h4 class="agent-config-name">${agent.name}</h4>
                                    <p class="agent-config-item-desc">${agent.description}</p>
                                    <span class="agent-config-category">${this._getCategoryLabel(agent.category)}</span>
                                </div>
                            </div>
                            <div class="agent-config-item-right">
                                <div class="agent-config-schedule">
                                    <label class="agent-config-label">Geplant um:</label>
                                    <input type="time" class="agent-config-time" data-agent-id="${agent.id}"
                                        value="${agent.schedule || ''}" />
                                </div>
                                <div class="agent-config-toggle">
                                    <label class="agent-toggle-switch">
                                        <input type="checkbox" class="agent-toggle-input" data-agent-id="${agent.id}"
                                            ${agent.enabled ? 'checked' : ''} />
                                        <span class="agent-toggle-slider"></span>
                                    </label>
                                    <span class="agent-toggle-label">${agent.enabled ? 'Aktiv' : 'Inaktiv'}</span>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    // ============================================
    // Event Listeners
    // ============================================

    attachEventListeners() {
        if (!this.container) {return;}

        // Use event delegation on the container
        this.container.addEventListener('click', (e) => this._handleClick(e));
        this.container.addEventListener('change', (e) => this._handleChange(e));
    }

    _handleClick(e) {
        const target = e.target.closest('button, [data-tab]');
        if (!target) {return;}

        // Tab switching
        if (target.classList.contains('agent-tab')) {
            e.preventDefault();
            this._switchTab(target.dataset.tab);
            return;
        }

        // Run single agent
        if (target.classList.contains('agent-btn-run')) {
            e.preventDefault();
            const agentId = target.dataset.agentId;
            if (agentId) {this._executeAgent(agentId);}
            return;
        }

        // Preview (dry run) single agent
        if (target.classList.contains('agent-btn-preview')) {
            e.preventDefault();
            const agentId = target.dataset.agentId;
            if (agentId) {this._previewAgent(agentId);}
            return;
        }

        // Run all agents
        if (target.id === 'btn-run-all-agents') {
            e.preventDefault();
            this._runAllAgents();
            return;
        }

        // Toggle scheduler
        if (target.id === 'btn-toggle-scheduler') {
            e.preventDefault();
            this._toggleScheduler();
            return;
        }

        // Generate briefing
        if (target.id === 'btn-generate-briefing' || target.id === 'btn-refresh-briefing') {
            e.preventDefault();
            this._generateBriefing();
            return;
        }

        // Clear log
        if (target.id === 'btn-clear-log') {
            e.preventDefault();
            this._clearLog();
            return;
        }

        // Close preview modal
        if (target.id === 'btn-close-preview' || target.id === 'btn-cancel-preview') {
            e.preventDefault();
            this._closePreview();
            return;
        }

        // Execute from preview
        if (target.id === 'btn-execute-from-preview') {
            e.preventDefault();
            this._executeFromPreview();
            return;
        }

        // Backdrop click to close
        if (target.classList.contains('agent-preview-backdrop')) {
            this._closePreview();
            return;
        }
    }

    _handleChange(e) {
        const target = e.target;

        // Toggle agent enabled/disabled
        if (target.classList.contains('agent-toggle-input')) {
            const agentId = target.dataset.agentId;
            const enabled = target.checked;
            this._toggleAgent(agentId, enabled);
            return;
        }

        // Update agent schedule time
        if (target.classList.contains('agent-config-time')) {
            const agentId = target.dataset.agentId;
            const time = target.value;
            this._updateSchedule(agentId, time);
            return;
        }
    }

    // ============================================
    // Actions
    // ============================================

    _switchTab(tabId) {
        this.currentTab = tabId;

        // Update tab buttons
        this.container.querySelectorAll('.agent-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabId);
        });

        // Update tab panes
        this.container.querySelectorAll('.agent-tab-pane').forEach(pane => {
            pane.classList.toggle('active', pane.id === `agent-pane-${tabId}`);
        });

        // Refresh the active pane content
        this._refreshPane(tabId);
    }

    _refreshPane(tabId) {
        const pane = this.container.querySelector(`#agent-pane-${tabId}`);
        if (!pane) {return;}

        switch (tabId) {
            case 'dashboard':
                pane.innerHTML = this._renderDashboard();
                break;
            case 'briefing':
                pane.innerHTML = this._renderBriefingPanel();
                break;
            case 'log':
                pane.innerHTML = this._renderExecutionLog();
                break;
            case 'config':
                pane.innerHTML = this._renderConfigPanel();
                break;
        }
    }

    async _executeAgent(agentId) {
        if (this.isLoading) {return;}

        this._showLoading(true);
        try {
            const result = await window.agentWorkflowService.executeAgent(agentId);
            if (result.success) {
                window.errorHandler?.success(`Agent "${result.agentName}" erfolgreich ausgefuehrt`);
            } else {
                window.errorHandler?.warning(result.message || `Agent "${agentId}" fehlgeschlagen`);
            }
        } catch (error) {
            window.errorHandler?.handle(error, 'AgentUI');
        } finally {
            this._showLoading(false);
            this._refreshPane(this.currentTab);
        }
    }

    async _previewAgent(agentId) {
        if (this.isLoading) {return;}

        this._showLoading(true);
        try {
            const result = await window.agentWorkflowService.executeAgent(agentId, {}, true);
            this.previewResult = result;
            this._showPreview(result);
        } catch (error) {
            window.errorHandler?.handle(error, 'AgentUI:Preview');
        } finally {
            this._showLoading(false);
        }
    }

    async _runAllAgents() {
        if (this.isLoading) {return;}

        this._showLoading(true);
        try {
            const results = await window.agentWorkflowService.runAllAgents(false);
            const successCount = results.filter(r => r.success).length;
            window.errorHandler?.success(
                `${successCount} von ${results.length} Agenten erfolgreich ausgefuehrt`
            );
        } catch (error) {
            window.errorHandler?.handle(error, 'AgentUI:RunAll');
        } finally {
            this._showLoading(false);
            this._refreshPane(this.currentTab);
        }
    }

    _toggleScheduler() {
        const service = window.agentWorkflowService;
        if (!service) {return;}

        const btn = this.container.querySelector('#btn-toggle-scheduler');
        if (service.schedulerInterval) {
            service.stopScheduler();
            if (btn) {btn.innerHTML = '<span class="agent-btn-icon">&#9201;</span> Scheduler starten';}
            window.errorHandler?.info('Scheduler gestoppt');
        } else {
            service.startScheduler();
            if (btn) {btn.innerHTML = '<span class="agent-btn-icon">&#9209;</span> Scheduler stoppen';}
            window.errorHandler?.success('Scheduler gestartet - Agenten werden automatisch ausgefuehrt');
        }
    }

    async _generateBriefing() {
        if (this.isLoading) {return;}

        this._showLoading(true);
        try {
            const result = await window.agentWorkflowService.executeAgent('morning-briefing');
            if (result.success) {
                this.currentBriefing = result.result;
                this._refreshPane('briefing');
                window.errorHandler?.success('Morgen-Briefing erfolgreich generiert');
            } else {
                window.errorHandler?.warning('Briefing konnte nicht generiert werden');
            }
        } catch (error) {
            window.errorHandler?.handle(error, 'AgentUI:Briefing');
        } finally {
            this._showLoading(false);
        }
    }

    _clearLog() {
        window.agentWorkflowService?.clearExecutionLog();
        this._refreshPane('log');
        window.errorHandler?.info('Protokoll geloescht');
    }

    _toggleAgent(agentId, enabled) {
        const service = window.agentWorkflowService;
        if (!service) {return;}

        service.toggleAgent(agentId, enabled);

        // Update the toggle label
        const item = this.container.querySelector(`.agent-config-item[data-agent-id="${agentId}"]`);
        if (item) {
            const label = item.querySelector('.agent-toggle-label');
            if (label) {label.textContent = enabled ? 'Aktiv' : 'Inaktiv';}
        }
    }

    _updateSchedule(agentId, time) {
        window.agentWorkflowService?.setAgentSchedule(agentId, time);
    }

    // ============================================
    // Preview Modal
    // ============================================

    _showPreview(result) {
        const modal = this.container.querySelector('#agent-preview-modal');
        const body = this.container.querySelector('#agent-preview-body');
        if (!modal || !body) {return;}

        body.innerHTML = this._renderPreviewContent(result);
        modal.style.display = 'flex';
    }

    _closePreview() {
        const modal = this.container.querySelector('#agent-preview-modal');
        if (modal) {modal.style.display = 'none';}
        this.previewResult = null;
    }

    async _executeFromPreview() {
        if (!this.previewResult) {return;}

        const agentId = this.previewResult.agentId;
        this._closePreview();
        await this._executeAgent(agentId);
    }

    _renderPreviewContent(result) {
        if (!result.success) {
            return `
                <div class="agent-preview-error">
                    <p>Vorschau fehlgeschlagen: ${result.error || result.message}</p>
                </div>
            `;
        }

        const data = result.result;
        let content = `
            <div class="agent-preview-section">
                <h4>${result.agentName} - Vorschau</h4>
                <p class="agent-preview-summary">${data?.zusammenfassung || 'Keine Zusammenfassung verfuegbar'}</p>
            </div>
        `;

        // Render agent-specific previews
        if (result.agentId === 'morning-briefing' && data) {
            content += this._renderBriefingPreview(data);
        } else if (result.agentId === 'dunning-agent' && data?.mahnungen) {
            content += this._renderDunningPreview(data);
        } else if (result.agentId === 'lead-followup' && data?.followups) {
            content += this._renderFollowUpPreview(data);
        } else if (result.agentId === 'quote-generation' && data?.angebote) {
            content += this._renderQuotePreview(data);
        } else if (result.agentId === 'schedule-optimizer' && data?.vorschlaege) {
            content += this._renderSchedulePreview(data);
        }

        return content;
    }

    _renderBriefingPreview(data) {
        const z = data.zusammenfassung;
        return `
            <div class="agent-preview-section">
                <h4>Ueberblick</h4>
                <ul class="agent-preview-list">
                    <li>Neue Anfragen: ${z.neueAnfragen}</li>
                    <li>Offene Angebote: ${z.offeneAngebote}</li>
                    <li>Aktive Auftraege: ${z.aktiveAuftraege}</li>
                    <li>Ueberfaellige Rechnungen: ${z.ueberfaelligeRechnungen}</li>
                    <li>Inaktive Leads: ${z.inaktiveLeads}</li>
                </ul>
                ${data.dringend.length > 0 ? `
                <h4>Dringende Punkte</h4>
                <ul class="agent-preview-list">
                    ${data.dringend.map(d => `<li>[${d.prioritaet}] ${d.nachricht}</li>`).join('')}
                </ul>
                ` : '<p>Keine dringenden Punkte.</p>'}
            </div>
        `;
    }

    _renderDunningPreview(data) {
        return `
            <div class="agent-preview-section">
                <h4>Mahnungen (${data.mahnungen.length})</h4>
                ${data.mahnungen.map(m => `
                    <div class="agent-preview-card">
                        <strong>${this._esc(m.rechnungNummer)}</strong> - ${this._esc(m.kunde)}
                        <span class="agent-badge agent-badge-${m.severity === 'letzte_warnung' ? 'error' : m.severity === 'freundlich' ? 'active' : 'warning'}">
                            ${m.severityLabel}
                        </span>
                        <br>Betrag: ${this._formatCurrency(m.betrag)} | ${m.tageUeberfaellig} Tage ueberfaellig
                        ${m.mahntext ? `<div class="agent-preview-text">${this._esc(this._truncate(m.mahntext, 200))}</div>` : ''}
                    </div>
                `).join('')}
            </div>
        `;
    }

    _renderFollowUpPreview(data) {
        return `
            <div class="agent-preview-section">
                <h4>Nachverfolgungen (${data.followups.length})</h4>
                ${data.followups.map(f => `
                    <div class="agent-preview-card">
                        <strong>${this._esc(f.kunde)}</strong> ${f.leistungsart ? `- ${this._esc(f.leistungsart)}` : ''}
                        <span class="agent-badge agent-badge-${f.prioritaet === 'hoch' ? 'error' : f.prioritaet === 'mittel' ? 'warning' : 'info'}">
                            ${f.tageOffen} Tage
                        </span>
                        ${f.nachfasstext ? `<div class="agent-preview-text">${this._esc(this._truncate(f.nachfasstext, 200))}</div>` : ''}
                    </div>
                `).join('')}
            </div>
        `;
    }

    _renderQuotePreview(data) {
        return `
            <div class="agent-preview-section">
                <h4>Angebotsentwuerfe (${data.angebote.length})</h4>
                ${data.angebote.map(a => `
                    <div class="agent-preview-card">
                        <strong>${this._esc(a.kunde)}</strong> ${a.leistungsart ? `- ${this._esc(a.leistungsart)}` : ''}
                        ${a.geschaetzterPreis ? `<br>Geschaetzter Preis: ${this._formatCurrency(a.geschaetzterPreis.brutto)} (brutto)` : ''}
                        ${a.positionen.length > 0 ? `
                            <ul class="agent-preview-list">
                                ${a.positionen.map(p => `<li>${this._esc(p.beschreibung)}: ${p.menge} ${this._esc(p.einheit)} x ${this._formatCurrency(p.einzelpreis)}</li>`).join('')}
                            </ul>
                        ` : ''}
                    </div>
                `).join('')}
            </div>
        `;
    }

    _renderSchedulePreview(data) {
        return `
            <div class="agent-preview-section">
                ${data.probleme?.length > 0 ? `
                <h4>Erkannte Probleme</h4>
                <ul class="agent-preview-list">
                    ${data.probleme.map(p => `<li>[${this._esc(p.prioritaet.toUpperCase())}] ${this._esc(p.nachricht)}</li>`).join('')}
                </ul>
                ` : ''}
                <h4>Vorschlaege (${Array.isArray(data.vorschlaege) ? data.vorschlaege.length : 0})</h4>
                ${Array.isArray(data.vorschlaege) ? data.vorschlaege.map(v => `
                    <div class="agent-preview-card">
                        <span class="agent-badge agent-badge-${v.prioritaet === 'hoch' ? 'error' : v.prioritaet === 'mittel' ? 'warning' : 'info'}">
                            ${v.prioritaet}
                        </span>
                        ${this._esc(v.vorschlag)}
                    </div>
                `).join('') : '<p>Keine Vorschlaege generiert.</p>'}
            </div>
        `;
    }

    // ============================================
    // UI Helpers
    // ============================================

    _showLoading(show) {
        this.isLoading = show;
        const overlay = this.container?.querySelector('#agent-loading');
        if (overlay) {overlay.style.display = show ? 'flex' : 'none';}
    }

    _formatCurrency(amount) {
        return new Intl.NumberFormat('de-DE', {
            style: 'currency',
            currency: 'EUR'
        }).format(amount || 0);
    }

    _truncate(text, maxLen) {
        if (!text) {return '';}
        if (text.length <= maxLen) {return text;}
        return text.substring(0, maxLen) + '...';
    }

    _esc(str) {
        if (!str) {return '';}
        return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    _nl2br(text) {
        if (!text) {return '';}
        return text.replace(/\n/g, '<br>');
    }

    _getCategoryLabel(category) {
        const labels = {
            analyse: 'Analyse',
            finanzen: 'Finanzen',
            vertrieb: 'Vertrieb',
            planung: 'Planung'
        };
        return labels[category] || category;
    }

    /**
     * Refresh the entire UI. Call after external state changes.
     */
    refresh() {
        this._refreshPane(this.currentTab);
    }
}

// Register on window
window.agentWorkflowUI = new AgentWorkflowUI();
