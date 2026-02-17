/* ============================================
   Workflow Builder UI
   Visual drag-and-drop node editor for
   workflow automation (rendered into view-workflow-builder)
   ============================================ */

class WorkflowBuilderUI {
    constructor() {
        this.container = null;
        this.svgCanvas = null;
        this.nodesLayer = null;
        this.connectionsLayer = null;

        // State
        this.currentWorkflowId = null;
        this.selectedNodeId = null;
        this.selectedConnectionId = null;
        this.viewMode = 'list'; // 'list' | 'editor'

        // Canvas transform
        this.zoom = 1;
        this.panX = 0;
        this.panY = 0;
        this.minZoom = 0.3;
        this.maxZoom = 2.5;

        // Interaction state
        this.isDraggingNode = false;
        this.isDraggingCanvas = false;
        this.isDrawingConnection = false;
        this.dragState = null;
        this.connectionDraft = null;

        // Constants
        this.NODE_WIDTH = 180;
        this.NODE_HEIGHT = 60;
        this.PORT_RADIUS = 7;
        this.CONDITION_SIZE = 80;

        // Bound handlers for cleanup
        this._boundKeyDown = this._handleKeyDown.bind(this);
        this._boundMouseMove = this._handleGlobalMouseMove.bind(this);
        this._boundMouseUp = this._handleGlobalMouseUp.bind(this);
    }

    // ================================================================
    // PUBLIC API
    // ================================================================

    mount(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            console.error('[WorkflowBuilderUI] Container nicht gefunden:', containerId);
            return;
        }

        document.addEventListener('keydown', this._boundKeyDown);
        document.addEventListener('mousemove', this._boundMouseMove);
        document.addEventListener('mouseup', this._boundMouseUp);

        this.render();
    }

    unmount() {
        document.removeEventListener('keydown', this._boundKeyDown);
        document.removeEventListener('mousemove', this._boundMouseMove);
        document.removeEventListener('mouseup', this._boundMouseUp);
    }

    refresh() {
        if (!this.container) return;
        if (this.viewMode === 'list') {
            this.render();
        } else {
            this._renderEditor();
        }
    }

    // ================================================================
    // MAIN RENDER
    // ================================================================

    render() {
        if (!this.container) return;

        if (this.viewMode === 'list') {
            this._renderWorkflowList();
        } else {
            this._renderEditor();
        }
    }

    // ================================================================
    // WORKFLOW LIST VIEW
    // ================================================================

    _renderWorkflowList() {
        const service = this._getService();
        const workflows = service.getWorkflows();
        const stats = service.getStats();
        const templates = service.getTemplates();

        this.container.innerHTML = `
            <div class="wfb-list-view">
                <!-- Stats Bar -->
                <div class="wfb-stats-bar">
                    <div class="wfb-stat">
                        <span class="wfb-stat-value">${stats.total}</span>
                        <span class="wfb-stat-label">Workflows</span>
                    </div>
                    <div class="wfb-stat">
                        <span class="wfb-stat-value wfb-stat-active">${stats.active}</span>
                        <span class="wfb-stat-label">Aktiv</span>
                    </div>
                    <div class="wfb-stat">
                        <span class="wfb-stat-value">${stats.totalRuns}</span>
                        <span class="wfb-stat-label">Ausfuehrungen</span>
                    </div>
                    <div class="wfb-stat">
                        <span class="wfb-stat-value wfb-stat-error">${stats.recentErrors}</span>
                        <span class="wfb-stat-label">Fehler (7 Tage)</span>
                    </div>
                </div>

                <!-- Action Bar -->
                <div class="wfb-action-bar">
                    <button class="wfb-btn wfb-btn-primary" id="wfb-btn-new">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
                        Neuer Workflow
                    </button>
                    <div class="wfb-template-dropdown">
                        <button class="wfb-btn wfb-btn-secondary" id="wfb-btn-template">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>
                            Vorlage laden
                        </button>
                        <div class="wfb-dropdown-content" id="wfb-template-menu">
                            ${templates.map(t => `
                                <div class="wfb-dropdown-item" data-template-id="${t.id}">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="${t.color}"><path d="${t.icon}"/></svg>
                                    <div>
                                        <div class="wfb-dropdown-item-title">${t.name}</div>
                                        <div class="wfb-dropdown-item-desc">${t.description}</div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    <button class="wfb-btn wfb-btn-secondary" id="wfb-btn-history">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M13 3a9 9 0 0 0-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42A8.954 8.954 0 0 0 13 21a9 9 0 0 0 0-18zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"/></svg>
                        Ausfuehrungsprotokoll
                    </button>
                </div>

                <!-- Workflow Cards -->
                <div class="wfb-cards-grid" id="wfb-cards-grid">
                    ${workflows.length === 0 ? `
                        <div class="wfb-empty-state">
                            <svg width="64" height="64" viewBox="0 0 24 24" fill="var(--text-muted)"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>
                            <h3>Noch keine Workflows erstellt</h3>
                            <p>Erstellen Sie Ihren ersten Workflow oder laden Sie eine Vorlage.</p>
                        </div>
                    ` : workflows.map(wf => this._renderWorkflowCard(wf)).join('')}
                </div>
            </div>
        `;

        this._bindListEvents();
    }

    _renderWorkflowCard(wf) {
        const service = this._getService();
        const triggerNode = wf.nodes.find(n => n.type === 'trigger');
        const triggerDef = triggerNode ? service.getTriggerTypes()[triggerNode.action] : null;
        const nodeCount = wf.nodes.length;
        const validation = service.validateWorkflow(wf.id);
        const lastRun = wf.lastRun ? this._formatRelativeTime(wf.lastRun) : 'Nie';

        return `
            <div class="wfb-card ${wf.isActive ? 'wfb-card-active' : ''}" data-workflow-id="${wf.id}">
                <div class="wfb-card-header">
                    <div class="wfb-card-title-row">
                        <h3 class="wfb-card-title">${this._escapeHtml(wf.name)}</h3>
                        <div class="wfb-card-actions">
                            <button class="wfb-icon-btn wfb-btn-edit" data-action="edit" data-id="${wf.id}" title="Bearbeiten">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
                            </button>
                            <button class="wfb-icon-btn wfb-btn-duplicate" data-action="duplicate" data-id="${wf.id}" title="Duplizieren">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
                            </button>
                            <button class="wfb-icon-btn wfb-btn-delete" data-action="delete" data-id="${wf.id}" title="Loeschen">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                            </button>
                        </div>
                    </div>
                    ${wf.description ? `<p class="wfb-card-desc">${this._escapeHtml(wf.description)}</p>` : ''}
                </div>
                <div class="wfb-card-body">
                    <div class="wfb-card-meta">
                        ${triggerDef ? `
                            <span class="wfb-card-trigger">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="${triggerDef.color}"><path d="${triggerDef.icon}"/></svg>
                                ${triggerDef.name}
                            </span>
                        ` : '<span class="wfb-card-trigger wfb-no-trigger">Kein Ausloeser</span>'}
                        <span class="wfb-card-nodes">${nodeCount} Knoten</span>
                        <span class="wfb-card-runs">${wf.runCount || 0}x ausgefuehrt</span>
                    </div>
                    <div class="wfb-card-footer">
                        <span class="wfb-card-time">Letzter Lauf: ${lastRun}</span>
                        <div class="wfb-card-controls">
                            ${!validation.valid ? `<span class="wfb-validation-warn" title="${validation.errors.join(', ')}">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="var(--accent-warning)"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>
                            </span>` : ''}
                            <label class="wfb-toggle" title="${wf.isActive ? 'Deaktivieren' : 'Aktivieren'}">
                                <input type="checkbox" ${wf.isActive ? 'checked' : ''} data-action="toggle" data-id="${wf.id}">
                                <span class="wfb-toggle-slider"></span>
                            </label>
                            <button class="wfb-btn wfb-btn-small wfb-btn-run" data-action="run" data-id="${wf.id}" title="Manuell ausfuehren">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7L8 5z"/></svg>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    _bindListEvents() {
        const service = this._getService();

        // New workflow
        const btnNew = document.getElementById('wfb-btn-new');
        if (btnNew) {
            btnNew.addEventListener('click', () => {
                const wf = service.createWorkflow({ name: 'Neuer Workflow' });
                this.currentWorkflowId = wf.id;
                this.viewMode = 'editor';
                this.render();
            });
        }

        // Template dropdown
        const btnTemplate = document.getElementById('wfb-btn-template');
        const templateMenu = document.getElementById('wfb-template-menu');
        if (btnTemplate && templateMenu) {
            btnTemplate.addEventListener('click', (e) => {
                e.stopPropagation();
                templateMenu.classList.toggle('wfb-dropdown-open');
            });
            document.addEventListener('click', () => {
                templateMenu.classList.remove('wfb-dropdown-open');
            }, { once: true });
        }

        // Template items
        this.container.querySelectorAll('[data-template-id]').forEach(item => {
            item.addEventListener('click', () => {
                const templateId = item.dataset.templateId;
                const wf = service.loadTemplate(templateId);
                if (wf) {
                    this.currentWorkflowId = wf.id;
                    this.viewMode = 'editor';
                    this.render();
                }
            });
        });

        // History button
        const btnHistory = document.getElementById('wfb-btn-history');
        if (btnHistory) {
            btnHistory.addEventListener('click', () => this._showHistoryModal());
        }

        // Card actions
        this.container.querySelectorAll('[data-action]').forEach(el => {
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = el.dataset.action;
                const id = el.dataset.id;
                this._handleCardAction(action, id);
            });
        });

        // Card click -> open editor
        this.container.querySelectorAll('.wfb-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (e.target.closest('[data-action]')) return;
                const id = card.dataset.workflowId;
                this.currentWorkflowId = id;
                this.viewMode = 'editor';
                this.render();
            });
        });
    }

    _handleCardAction(action, id) {
        const service = this._getService();

        switch (action) {
        case 'edit':
            this.currentWorkflowId = id;
            this.viewMode = 'editor';
            this.render();
            break;
        case 'duplicate':
            service.duplicateWorkflow(id);
            this.render();
            break;
        case 'delete':
            if (confirm('Workflow wirklich loeschen?')) {
                service.deleteWorkflow(id);
                this.render();
            }
            break;
        case 'toggle': {
            const wf = service.getWorkflow(id);
            if (wf) {
                if (wf.isActive) {
                    service.deactivateWorkflow(id);
                } else {
                    service.activateWorkflow(id);
                }
                this.render();
            }
            break;
        }
        case 'run':
            service.executeWorkflow(id, { manual: true }).then(result => {
                const msg = result.status === 'completed'
                    ? 'Workflow erfolgreich ausgefuehrt!'
                    : 'Workflow-Fehler: ' + (result.error || 'Unbekannt');
                this._showToast(msg, result.status === 'completed' ? 'success' : 'error');
                this.render();
            });
            break;
        }
    }

    // ================================================================
    // EDITOR VIEW
    // ================================================================

    _renderEditor() {
        const service = this._getService();
        const workflow = service.getWorkflow(this.currentWorkflowId);
        if (!workflow) {
            this.viewMode = 'list';
            this.render();
            return;
        }

        const allTypes = service.getAllNodeTypes();

        this.container.innerHTML = `
            <div class="wfb-editor">
                <!-- Top Bar -->
                <div class="wfb-topbar">
                    <button class="wfb-icon-btn wfb-btn-back" id="wfb-btn-back" title="Zurueck zur Liste">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
                    </button>
                    <input type="text" class="wfb-workflow-name" id="wfb-workflow-name" value="${this._escapeHtml(workflow.name)}" placeholder="Workflow-Name">
                    <div class="wfb-topbar-actions">
                        <button class="wfb-btn wfb-btn-secondary wfb-btn-small" id="wfb-btn-validate" title="Validieren">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>
                            Pruefen
                        </button>
                        <button class="wfb-btn wfb-btn-secondary wfb-btn-small" id="wfb-btn-run-editor" title="Ausfuehren">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7L8 5z"/></svg>
                            Ausfuehren
                        </button>
                        <label class="wfb-toggle wfb-topbar-toggle" title="${workflow.isActive ? 'Deaktivieren' : 'Aktivieren'}">
                            <input type="checkbox" id="wfb-toggle-active" ${workflow.isActive ? 'checked' : ''}>
                            <span class="wfb-toggle-slider"></span>
                            <span class="wfb-toggle-label">${workflow.isActive ? 'Aktiv' : 'Inaktiv'}</span>
                        </label>
                    </div>
                </div>

                <div class="wfb-editor-body">
                    <!-- Left Sidebar - Node Palette -->
                    <div class="wfb-palette" id="wfb-palette">
                        <div class="wfb-palette-header">
                            <h3>Bausteine</h3>
                        </div>

                        <div class="wfb-palette-section">
                            <h4 class="wfb-palette-group-title">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="var(--accent-success)"><path d="M7 2v11h3v9l7-12h-4l4-8H7z"/></svg>
                                Ausloeser
                            </h4>
                            <div class="wfb-palette-items">
                                ${Object.values(allTypes.triggers).map(t => `
                                    <div class="wfb-palette-item" draggable="true" data-node-type="trigger" data-node-action="${t.id}">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="${t.color}"><path d="${t.icon}"/></svg>
                                        <span>${t.name}</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>

                        <div class="wfb-palette-section">
                            <h4 class="wfb-palette-group-title">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="var(--accent-info)"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>
                                Aktionen
                            </h4>
                            <div class="wfb-palette-items">
                                ${Object.values(allTypes.actions).filter(a => a.category === 'action').map(a => `
                                    <div class="wfb-palette-item" draggable="true" data-node-type="action" data-node-action="${a.id}">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="${a.color}"><path d="${a.icon}"/></svg>
                                        <span>${a.name}</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>

                        <div class="wfb-palette-section">
                            <h4 class="wfb-palette-group-title">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="var(--accent-warning)"><path d="M12 2L1 12l11 10 11-10L12 2zm0 3.27L19.73 12 12 18.73 4.27 12 12 5.27z"/></svg>
                                Bedingungen
                            </h4>
                            <div class="wfb-palette-items">
                                ${Object.values(allTypes.actions).filter(a => a.category === 'condition').map(c => `
                                    <div class="wfb-palette-item" draggable="true" data-node-type="condition" data-node-action="${c.id}">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="${c.color}"><path d="${c.icon}"/></svg>
                                        <span>${c.name}</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>

                    <!-- Center Canvas -->
                    <div class="wfb-canvas-wrapper" id="wfb-canvas-wrapper">
                        <svg class="wfb-canvas" id="wfb-canvas" xmlns="http://www.w3.org/2000/svg">
                            <defs>
                                <pattern id="wfb-grid" width="20" height="20" patternUnits="userSpaceOnUse">
                                    <circle cx="1" cy="1" r="0.8" fill="var(--border-color)" opacity="0.5"/>
                                </pattern>
                                <marker id="wfb-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                                    <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--text-muted)"/>
                                </marker>
                                <marker id="wfb-arrow-active" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                                    <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--accent-primary)"/>
                                </marker>
                                <filter id="wfb-shadow" x="-20%" y="-20%" width="140%" height="140%">
                                    <feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="#000" flood-opacity="0.4"/>
                                </filter>
                                <filter id="wfb-glow" x="-50%" y="-50%" width="200%" height="200%">
                                    <feGaussianBlur stdDeviation="4" result="blur"/>
                                    <feMerge>
                                        <feMergeNode in="blur"/>
                                        <feMergeNode in="SourceGraphic"/>
                                    </feMerge>
                                </filter>
                            </defs>
                            <rect width="100%" height="100%" fill="url(#wfb-grid)" class="wfb-grid-bg"/>
                            <g id="wfb-transform-group" transform="translate(${this.panX},${this.panY}) scale(${this.zoom})">
                                <g id="wfb-connections-layer"></g>
                                <g id="wfb-nodes-layer"></g>
                            </g>
                            <path id="wfb-connection-draft" class="wfb-connection-draft" d="" style="display:none"/>
                        </svg>
                        <!-- Zoom Controls -->
                        <div class="wfb-zoom-controls">
                            <button class="wfb-zoom-btn" id="wfb-zoom-in" title="Vergroessern">+</button>
                            <span class="wfb-zoom-level" id="wfb-zoom-level">${Math.round(this.zoom * 100)}%</span>
                            <button class="wfb-zoom-btn" id="wfb-zoom-out" title="Verkleinern">-</button>
                            <button class="wfb-zoom-btn" id="wfb-zoom-fit" title="Einpassen">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M15 3l2.3 2.3-2.89 2.87 1.42 1.42L18.7 6.7 21 9V3h-6zM3 9l2.3-2.3 2.87 2.89 1.42-1.42L6.7 5.3 9 3H3v6zm6 12l-2.3-2.3 2.89-2.87-1.42-1.42L5.3 17.3 3 15v6h6zm12-6l-2.3 2.3-2.87-2.89-1.42 1.42 2.89 2.87L15 21h6v-6z"/></svg>
                            </button>
                        </div>
                    </div>

                    <!-- Right Panel - Node Config -->
                    <div class="wfb-config-panel ${this.selectedNodeId ? 'wfb-config-open' : ''}" id="wfb-config-panel">
                        <div id="wfb-config-content">
                            ${this.selectedNodeId ? this._renderConfigPanel(workflow) : this._renderConfigEmpty()}
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Store references
        this.svgCanvas = document.getElementById('wfb-canvas');
        this.nodesLayer = document.getElementById('wfb-nodes-layer');
        this.connectionsLayer = document.getElementById('wfb-connections-layer');

        // Render nodes and connections
        this._renderCanvasContent(workflow);

        // Bind events
        this._bindEditorEvents(workflow);
    }

    // ================================================================
    // CANVAS RENDERING
    // ================================================================

    _renderCanvasContent(workflow) {
        if (!this.nodesLayer || !this.connectionsLayer) return;

        // Render connections first (below nodes)
        this.connectionsLayer.innerHTML = '';
        workflow.connections.forEach(conn => {
            this._renderConnection(workflow, conn);
        });

        // Render nodes
        this.nodesLayer.innerHTML = '';
        workflow.nodes.forEach(node => {
            this._renderNode(node, workflow);
        });
    }

    _renderNode(node, workflow) {
        const service = this._getService();
        let typeDef;

        if (node.type === 'trigger') {
            typeDef = service.getTriggerTypes()[node.action];
        } else {
            typeDef = service.getActionTypes()[node.action];
        }

        const color = typeDef ? typeDef.color : '#71717a';
        const icon = typeDef ? typeDef.icon : '';
        const isSelected = node.id === this.selectedNodeId;
        const isCondition = node.action === 'condition' || node.type === 'condition';

        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('class', `wfb-node ${isSelected ? 'wfb-node-selected' : ''} wfb-node-${node.type}`);
        g.setAttribute('data-node-id', node.id);
        g.setAttribute('transform', `translate(${node.position.x}, ${node.position.y})`);

        if (isCondition) {
            // Diamond shape for conditions
            const size = this.CONDITION_SIZE;
            const halfSize = size / 2;
            g.innerHTML = `
                <polygon points="${halfSize},0 ${size},${halfSize} ${halfSize},${size} 0,${halfSize}"
                    class="wfb-node-shape" fill="var(--bg-card)" stroke="${color}" stroke-width="${isSelected ? 2.5 : 1.5}"
                    filter="url(#wfb-shadow)" ${isSelected ? 'filter="url(#wfb-glow)"' : ''}/>
                <svg x="${halfSize - 8}" y="${halfSize - 16}" width="16" height="16" viewBox="0 0 24 24" fill="${color}">
                    <path d="${icon}"/>
                </svg>
                <text x="${halfSize}" y="${halfSize + 8}" text-anchor="middle" class="wfb-node-label" fill="var(--text-primary)" font-size="9">${this._truncateText(node.label || 'Bedingung', 12)}</text>
                <!-- Input port (left) -->
                <circle cx="0" cy="${halfSize}" r="${this.PORT_RADIUS}" class="wfb-port wfb-port-input" data-port="input" data-node-id="${node.id}" fill="var(--bg-hover)" stroke="${color}" stroke-width="2"/>
                <!-- Output port Ja (right-top) -->
                <circle cx="${size}" cy="${halfSize - 14}" r="${this.PORT_RADIUS}" class="wfb-port wfb-port-output" data-port="ja" data-node-id="${node.id}" fill="var(--accent-success)" stroke="var(--accent-success)" stroke-width="2"/>
                <text x="${size + 12}" y="${halfSize - 10}" class="wfb-port-label" fill="var(--accent-success)" font-size="10">Ja</text>
                <!-- Output port Nein (right-bottom) -->
                <circle cx="${size}" cy="${halfSize + 14}" r="${this.PORT_RADIUS}" class="wfb-port wfb-port-output" data-port="nein" data-node-id="${node.id}" fill="var(--accent-danger)" stroke="var(--accent-danger)" stroke-width="2"/>
                <text x="${size + 12}" y="${halfSize + 18}" class="wfb-port-label" fill="var(--accent-danger)" font-size="10">Nein</text>
            `;
        } else {
            // Rounded rectangle for triggers and actions
            const w = this.NODE_WIDTH;
            const h = this.NODE_HEIGHT;
            const r = 10;
            const typeIndicator = node.type === 'trigger'
                ? `<rect x="0" y="0" width="4" height="${h}" rx="2" fill="${color}"/>`
                : '';

            g.innerHTML = `
                <rect x="0" y="0" width="${w}" height="${h}" rx="${r}" ry="${r}"
                    class="wfb-node-shape" fill="var(--bg-card)" stroke="${color}" stroke-width="${isSelected ? 2.5 : 1.5}"
                    filter="url(#wfb-shadow)"/>
                ${typeIndicator}
                <svg x="12" y="${h / 2 - 10}" width="20" height="20" viewBox="0 0 24 24" fill="${color}">
                    <path d="${icon}"/>
                </svg>
                <text x="40" y="${h / 2 - 3}" class="wfb-node-label" fill="var(--text-primary)" font-size="11" font-weight="500">${this._truncateText(node.label || '', 16)}</text>
                <text x="40" y="${h / 2 + 12}" class="wfb-node-sublabel" fill="var(--text-muted)" font-size="9">${node.type === 'trigger' ? 'Ausloeser' : 'Aktion'}</text>
                <!-- Input port (left) -->
                ${node.type !== 'trigger' ? `
                    <circle cx="0" cy="${h / 2}" r="${this.PORT_RADIUS}" class="wfb-port wfb-port-input" data-port="input" data-node-id="${node.id}" fill="var(--bg-hover)" stroke="${color}" stroke-width="2"/>
                ` : ''}
                <!-- Output port (right) -->
                <circle cx="${w}" cy="${h / 2}" r="${this.PORT_RADIUS}" class="wfb-port wfb-port-output" data-port="output" data-node-id="${node.id}" fill="${color}" stroke="${color}" stroke-width="2"/>
            `;
        }

        this.nodesLayer.appendChild(g);
    }

    _renderConnection(workflow, conn) {
        const fromNode = workflow.nodes.find(n => n.id === conn.fromNodeId);
        const toNode = workflow.nodes.find(n => n.id === conn.toNodeId);
        if (!fromNode || !toNode) return;

        const fromPos = this._getPortPosition(fromNode, conn.fromPort, 'output');
        const toPos = this._getPortPosition(toNode, conn.toPort, 'input');

        const path = this._createBezierPath(fromPos.x, fromPos.y, toPos.x, toPos.y);
        const isSelected = conn.id === this.selectedConnectionId;

        const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        pathEl.setAttribute('d', path);
        pathEl.setAttribute('class', `wfb-connection ${isSelected ? 'wfb-connection-selected' : ''}`);
        pathEl.setAttribute('data-connection-id', conn.id);
        pathEl.setAttribute('fill', 'none');
        pathEl.setAttribute('stroke', isSelected ? 'var(--accent-primary)' : 'var(--text-muted)');
        pathEl.setAttribute('stroke-width', isSelected ? '3' : '2');
        pathEl.setAttribute('marker-end', isSelected ? 'url(#wfb-arrow-active)' : 'url(#wfb-arrow)');
        pathEl.style.cursor = 'pointer';

        // Click to select connection
        pathEl.addEventListener('click', (e) => {
            e.stopPropagation();
            this.selectedNodeId = null;
            this.selectedConnectionId = conn.id;
            this._renderEditor();
        });

        // Add label if exists
        if (conn.label) {
            const midX = (fromPos.x + toPos.x) / 2;
            const midY = (fromPos.y + toPos.y) / 2 - 10;
            const labelEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            labelEl.setAttribute('x', midX);
            labelEl.setAttribute('y', midY);
            labelEl.setAttribute('text-anchor', 'middle');
            labelEl.setAttribute('class', 'wfb-connection-label');
            labelEl.setAttribute('fill', 'var(--text-secondary)');
            labelEl.setAttribute('font-size', '10');
            labelEl.textContent = conn.label;
            this.connectionsLayer.appendChild(labelEl);
        }

        this.connectionsLayer.appendChild(pathEl);
    }

    _getPortPosition(node, port, direction) {
        const isCondition = node.action === 'condition' || node.type === 'condition';

        if (isCondition) {
            const halfSize = this.CONDITION_SIZE / 2;
            if (direction === 'input' || port === 'input') {
                return { x: node.position.x, y: node.position.y + halfSize };
            }
            if (port === 'ja') {
                return { x: node.position.x + this.CONDITION_SIZE, y: node.position.y + halfSize - 14 };
            }
            if (port === 'nein') {
                return { x: node.position.x + this.CONDITION_SIZE, y: node.position.y + halfSize + 14 };
            }
            return { x: node.position.x + this.CONDITION_SIZE, y: node.position.y + halfSize };
        }

        if (direction === 'input' || port === 'input') {
            return { x: node.position.x, y: node.position.y + this.NODE_HEIGHT / 2 };
        }
        return { x: node.position.x + this.NODE_WIDTH, y: node.position.y + this.NODE_HEIGHT / 2 };
    }

    _createBezierPath(x1, y1, x2, y2) {
        const dx = Math.abs(x2 - x1);
        const cp = Math.max(dx * 0.5, 50);
        return `M ${x1} ${y1} C ${x1 + cp} ${y1}, ${x2 - cp} ${y2}, ${x2} ${y2}`;
    }

    // ================================================================
    // CONFIG PANEL
    // ================================================================

    _renderConfigPanel(workflow) {
        const service = this._getService();
        const node = workflow.nodes.find(n => n.id === this.selectedNodeId);
        if (!node) return this._renderConfigEmpty();

        let typeDef;
        if (node.type === 'trigger') {
            typeDef = service.getTriggerTypes()[node.action];
        } else {
            typeDef = service.getActionTypes()[node.action];
        }

        if (!typeDef) return this._renderConfigEmpty();

        const configFields = typeDef.configFields || [];

        return `
            <div class="wfb-config-header">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="${typeDef.color}"><path d="${typeDef.icon}"/></svg>
                <div>
                    <h3>${typeDef.name}</h3>
                    <p class="wfb-config-desc">${typeDef.description || ''}</p>
                </div>
                <button class="wfb-icon-btn wfb-config-close" id="wfb-config-close" title="Schliessen">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"/></svg>
                </button>
            </div>
            <div class="wfb-config-body">
                <div class="wfb-config-field">
                    <label>Bezeichnung</label>
                    <input type="text" class="wfb-input" id="wfb-config-label" value="${this._escapeHtml(node.label || '')}" placeholder="Knotenbezeichnung">
                </div>
                ${configFields.map(field => this._renderConfigField(field, node.config)).join('')}
            </div>
            <div class="wfb-config-footer">
                <button class="wfb-btn wfb-btn-primary wfb-btn-small" id="wfb-config-save">Uebernehmen</button>
                <button class="wfb-btn wfb-btn-danger wfb-btn-small" id="wfb-config-delete">Knoten loeschen</button>
            </div>
        `;
    }

    _renderConfigField(field, config) {
        const value = config[field.key] || '';

        if (field.type === 'select') {
            return `
                <div class="wfb-config-field">
                    <label>${field.label}</label>
                    <select class="wfb-select" data-config-key="${field.key}">
                        ${(field.options || []).map(opt => `
                            <option value="${opt}" ${value === opt ? 'selected' : ''}>${opt.charAt(0).toUpperCase() + opt.slice(1).replace(/_/g, ' ')}</option>
                        `).join('')}
                    </select>
                </div>
            `;
        }

        if (field.type === 'textarea') {
            return `
                <div class="wfb-config-field">
                    <label>${field.label}</label>
                    <textarea class="wfb-textarea" data-config-key="${field.key}" placeholder="${field.placeholder || ''}" rows="4">${this._escapeHtml(value)}</textarea>
                </div>
            `;
        }

        return `
            <div class="wfb-config-field">
                <label>${field.label}</label>
                <input type="${field.type || 'text'}" class="wfb-input" data-config-key="${field.key}" value="${this._escapeHtml(String(value))}" placeholder="${field.placeholder || ''}">
            </div>
        `;
    }

    _renderConfigEmpty() {
        return `
            <div class="wfb-config-empty">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="var(--text-muted)"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
                <p>Knoten auswaehlen um die Konfiguration zu bearbeiten</p>
            </div>
        `;
    }

    // ================================================================
    // EDITOR EVENT BINDING
    // ================================================================

    _bindEditorEvents(workflow) {
        // Back button
        const btnBack = document.getElementById('wfb-btn-back');
        if (btnBack) {
            btnBack.addEventListener('click', () => {
                this.viewMode = 'list';
                this.selectedNodeId = null;
                this.selectedConnectionId = null;
                this.panX = 0;
                this.panY = 0;
                this.zoom = 1;
                this.render();
            });
        }

        // Workflow name
        const nameInput = document.getElementById('wfb-workflow-name');
        if (nameInput) {
            nameInput.addEventListener('change', () => {
                this._getService().updateWorkflow(this.currentWorkflowId, { name: nameInput.value });
            });
        }

        // Validate button
        const btnValidate = document.getElementById('wfb-btn-validate');
        if (btnValidate) {
            btnValidate.addEventListener('click', () => {
                const result = this._getService().validateWorkflow(this.currentWorkflowId);
                if (result.valid) {
                    this._showToast('Workflow ist gueltig!', 'success');
                } else {
                    const msgs = [...result.errors, ...result.warnings];
                    this._showToast(msgs.join('\n'), result.errors.length > 0 ? 'error' : 'warning');
                }
            });
        }

        // Run button
        const btnRun = document.getElementById('wfb-btn-run-editor');
        if (btnRun) {
            btnRun.addEventListener('click', () => {
                this._getService().executeWorkflow(this.currentWorkflowId, { manual: true }).then(result => {
                    const msg = result.status === 'completed'
                        ? `Workflow erfolgreich! ${result.nodeResults.length} Knoten ausgefuehrt.`
                        : 'Fehler: ' + (result.error || 'Unbekannt');
                    this._showToast(msg, result.status === 'completed' ? 'success' : 'error');
                });
            });
        }

        // Toggle active
        const toggleActive = document.getElementById('wfb-toggle-active');
        if (toggleActive) {
            toggleActive.addEventListener('change', () => {
                const service = this._getService();
                if (toggleActive.checked) {
                    service.activateWorkflow(this.currentWorkflowId);
                } else {
                    service.deactivateWorkflow(this.currentWorkflowId);
                }
                this._renderEditor();
            });
        }

        // Palette drag
        this._bindPaletteDrag();

        // Canvas interactions
        this._bindCanvasEvents();

        // Config panel
        this._bindConfigEvents();

        // Zoom controls
        this._bindZoomControls();
    }

    // ================================================================
    // PALETTE DRAG AND DROP
    // ================================================================

    _bindPaletteDrag() {
        const paletteItems = this.container.querySelectorAll('.wfb-palette-item');
        const canvasWrapper = document.getElementById('wfb-canvas-wrapper');

        paletteItems.forEach(item => {
            item.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', JSON.stringify({
                    type: item.dataset.nodeType,
                    action: item.dataset.nodeAction
                }));
                e.dataTransfer.effectAllowed = 'copy';
                item.classList.add('wfb-dragging');
            });

            item.addEventListener('dragend', () => {
                item.classList.remove('wfb-dragging');
            });
        });

        if (canvasWrapper) {
            canvasWrapper.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'copy';
                canvasWrapper.classList.add('wfb-drop-target');
            });

            canvasWrapper.addEventListener('dragleave', () => {
                canvasWrapper.classList.remove('wfb-drop-target');
            });

            canvasWrapper.addEventListener('drop', (e) => {
                e.preventDefault();
                canvasWrapper.classList.remove('wfb-drop-target');

                try {
                    const data = JSON.parse(e.dataTransfer.getData('text/plain'));
                    const rect = this.svgCanvas.getBoundingClientRect();
                    const x = (e.clientX - rect.left - this.panX) / this.zoom;
                    const y = (e.clientY - rect.top - this.panY) / this.zoom;

                    const service = this._getService();
                    service.addNode(this.currentWorkflowId, {
                        type: data.type,
                        action: data.action,
                        config: {},
                        position: { x: Math.round(x), y: Math.round(y) }
                    });

                    this._renderEditor();
                } catch (err) {
                    console.error('[WorkflowBuilderUI] Drop-Fehler:', err);
                }
            });
        }
    }

    // ================================================================
    // CANVAS EVENTS
    // ================================================================

    _bindCanvasEvents() {
        if (!this.svgCanvas) return;

        // Node interaction
        this.nodesLayer.querySelectorAll('.wfb-node').forEach(nodeEl => {
            const nodeId = nodeEl.dataset.nodeId;

            // Click to select
            nodeEl.addEventListener('mousedown', (e) => {
                if (e.target.closest('.wfb-port')) return;
                e.stopPropagation();

                this.selectedNodeId = nodeId;
                this.selectedConnectionId = null;

                // Start drag
                const rect = this.svgCanvas.getBoundingClientRect();
                const service = this._getService();
                const wf = service.getWorkflow(this.currentWorkflowId);
                const node = wf ? wf.nodes.find(n => n.id === nodeId) : null;

                if (node) {
                    this.isDraggingNode = true;
                    this.dragState = {
                        nodeId,
                        startMouseX: (e.clientX - rect.left - this.panX) / this.zoom,
                        startMouseY: (e.clientY - rect.top - this.panY) / this.zoom,
                        startNodeX: node.position.x,
                        startNodeY: node.position.y
                    };
                }

                this._renderEditor();
            });
        });

        // Port interaction (drawing connections)
        this.nodesLayer.querySelectorAll('.wfb-port-output').forEach(port => {
            port.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                e.preventDefault();

                const nodeId = port.dataset.nodeId;
                const portName = port.dataset.port;

                this.isDrawingConnection = true;
                const rect = this.svgCanvas.getBoundingClientRect();

                const service = this._getService();
                const wf = service.getWorkflow(this.currentWorkflowId);
                const fromNode = wf ? wf.nodes.find(n => n.id === nodeId) : null;

                if (fromNode) {
                    const fromPos = this._getPortPosition(fromNode, portName, 'output');
                    this.connectionDraft = {
                        fromNodeId: nodeId,
                        fromPort: portName,
                        startX: fromPos.x,
                        startY: fromPos.y,
                        endX: (e.clientX - rect.left - this.panX) / this.zoom,
                        endY: (e.clientY - rect.top - this.panY) / this.zoom
                    };
                }
            });
        });

        // Canvas pan (on empty space)
        const gridBg = this.svgCanvas.querySelector('.wfb-grid-bg');
        if (gridBg) {
            gridBg.addEventListener('mousedown', (e) => {
                this.isDraggingCanvas = true;
                this.dragState = {
                    startMouseX: e.clientX,
                    startMouseY: e.clientY,
                    startPanX: this.panX,
                    startPanY: this.panY
                };

                // Deselect
                this.selectedNodeId = null;
                this.selectedConnectionId = null;
                const configContent = document.getElementById('wfb-config-content');
                if (configContent) {
                    configContent.innerHTML = this._renderConfigEmpty();
                }
                const configPanel = document.getElementById('wfb-config-panel');
                if (configPanel) {
                    configPanel.classList.remove('wfb-config-open');
                }
            });
        }

        // Mousewheel zoom
        const canvasWrapper = document.getElementById('wfb-canvas-wrapper');
        if (canvasWrapper) {
            canvasWrapper.addEventListener('wheel', (e) => {
                e.preventDefault();
                const delta = e.deltaY > 0 ? -0.1 : 0.1;
                const newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom + delta));
                this.zoom = Math.round(newZoom * 100) / 100;
                this._updateTransform();
            }, { passive: false });
        }
    }

    _handleGlobalMouseMove(e) {
        if (this.isDraggingNode && this.dragState) {
            const rect = this.svgCanvas.getBoundingClientRect();
            const mouseX = (e.clientX - rect.left - this.panX) / this.zoom;
            const mouseY = (e.clientY - rect.top - this.panY) / this.zoom;

            const dx = mouseX - this.dragState.startMouseX;
            const dy = mouseY - this.dragState.startMouseY;

            const newX = Math.round(this.dragState.startNodeX + dx);
            const newY = Math.round(this.dragState.startNodeY + dy);

            // Live update the node position in DOM
            const nodeEl = this.nodesLayer.querySelector(`[data-node-id="${this.dragState.nodeId}"]`);
            if (nodeEl) {
                nodeEl.setAttribute('transform', `translate(${newX}, ${newY})`);
            }

            // Update connections live
            const service = this._getService();
            const wf = service.getWorkflow(this.currentWorkflowId);
            if (wf) {
                const node = wf.nodes.find(n => n.id === this.dragState.nodeId);
                if (node) {
                    // Temporarily update position for connection rendering
                    const oldPos = { ...node.position };
                    node.position = { x: newX, y: newY };
                    this.connectionsLayer.innerHTML = '';
                    wf.connections.forEach(conn => this._renderConnection(wf, conn));
                    node.position = oldPos; // Restore until mouseup
                    this.dragState._lastX = newX;
                    this.dragState._lastY = newY;
                }
            }
        }

        if (this.isDraggingCanvas && this.dragState) {
            const dx = e.clientX - this.dragState.startMouseX;
            const dy = e.clientY - this.dragState.startMouseY;
            this.panX = this.dragState.startPanX + dx;
            this.panY = this.dragState.startPanY + dy;
            this._updateTransform();
        }

        if (this.isDrawingConnection && this.connectionDraft) {
            const rect = this.svgCanvas.getBoundingClientRect();
            this.connectionDraft.endX = (e.clientX - rect.left - this.panX) / this.zoom;
            this.connectionDraft.endY = (e.clientY - rect.top - this.panY) / this.zoom;

            // Update draft path
            const draftPath = document.getElementById('wfb-connection-draft');
            if (draftPath) {
                const path = this._createBezierPath(
                    this.connectionDraft.startX, this.connectionDraft.startY,
                    this.connectionDraft.endX, this.connectionDraft.endY
                );
                draftPath.setAttribute('d', path);
                draftPath.style.display = 'block';
                // The draft line needs to be in the transformed coordinate space
                // Since it is outside the transform group, we use the transformed coordinates
                const tx = this.panX;
                const ty = this.panY;
                const s = this.zoom;
                const draftPathTransformed = `M ${this.connectionDraft.startX * s + tx} ${this.connectionDraft.startY * s + ty} C ${(this.connectionDraft.startX + Math.max(Math.abs(this.connectionDraft.endX - this.connectionDraft.startX) * 0.5, 50)) * s + tx} ${this.connectionDraft.startY * s + ty}, ${(this.connectionDraft.endX - Math.max(Math.abs(this.connectionDraft.endX - this.connectionDraft.startX) * 0.5, 50)) * s + tx} ${this.connectionDraft.endY * s + ty}, ${this.connectionDraft.endX * s + tx} ${this.connectionDraft.endY * s + ty}`;
                draftPath.setAttribute('d', draftPathTransformed);
            }
        }
    }

    _handleGlobalMouseUp(e) {
        if (this.isDraggingNode && this.dragState) {
            // Commit node position
            const service = this._getService();
            const finalX = this.dragState._lastX !== undefined ? this.dragState._lastX : this.dragState.startNodeX;
            const finalY = this.dragState._lastY !== undefined ? this.dragState._lastY : this.dragState.startNodeY;
            service.updateNode(this.currentWorkflowId, this.dragState.nodeId, {
                position: { x: finalX, y: finalY }
            });
        }

        if (this.isDrawingConnection && this.connectionDraft) {
            // Find if we dropped on an input port
            const target = document.elementFromPoint(e.clientX, e.clientY);
            const port = target ? target.closest('.wfb-port-input') : null;

            if (port) {
                const toNodeId = port.dataset.nodeId;
                const toPort = port.dataset.port || 'input';

                if (toNodeId !== this.connectionDraft.fromNodeId) {
                    const service = this._getService();
                    service.addConnection(this.currentWorkflowId, {
                        fromNodeId: this.connectionDraft.fromNodeId,
                        toNodeId: toNodeId,
                        fromPort: this.connectionDraft.fromPort,
                        toPort: toPort,
                        label: this.connectionDraft.fromPort === 'ja' ? 'Ja' : this.connectionDraft.fromPort === 'nein' ? 'Nein' : ''
                    });
                }
            }

            // Hide draft
            const draftPath = document.getElementById('wfb-connection-draft');
            if (draftPath) {
                draftPath.style.display = 'none';
                draftPath.setAttribute('d', '');
            }

            this.connectionDraft = null;
        }

        const needsRerender = this.isDraggingNode || this.isDrawingConnection;
        this.isDraggingNode = false;
        this.isDraggingCanvas = false;
        this.isDrawingConnection = false;
        this.dragState = null;

        if (needsRerender) {
            this._renderEditor();
        }
    }

    // ================================================================
    // CONFIG PANEL EVENTS
    // ================================================================

    _bindConfigEvents() {
        const btnClose = document.getElementById('wfb-config-close');
        if (btnClose) {
            btnClose.addEventListener('click', () => {
                this.selectedNodeId = null;
                this._renderEditor();
            });
        }

        const btnSave = document.getElementById('wfb-config-save');
        if (btnSave) {
            btnSave.addEventListener('click', () => {
                this._saveNodeConfig();
                this._showToast('Konfiguration gespeichert', 'success');
                this._renderEditor();
            });
        }

        const btnDelete = document.getElementById('wfb-config-delete');
        if (btnDelete) {
            btnDelete.addEventListener('click', () => {
                if (confirm('Knoten wirklich loeschen?')) {
                    this._getService().removeNode(this.currentWorkflowId, this.selectedNodeId);
                    this.selectedNodeId = null;
                    this._renderEditor();
                }
            });
        }
    }

    _saveNodeConfig() {
        const service = this._getService();
        const labelInput = document.getElementById('wfb-config-label');
        const configInputs = this.container.querySelectorAll('[data-config-key]');

        const config = {};
        configInputs.forEach(input => {
            config[input.dataset.configKey] = input.value;
        });

        const updates = { config };
        if (labelInput) {
            updates.label = labelInput.value;
        }

        service.updateNode(this.currentWorkflowId, this.selectedNodeId, updates);
    }

    // ================================================================
    // ZOOM CONTROLS
    // ================================================================

    _bindZoomControls() {
        const btnZoomIn = document.getElementById('wfb-zoom-in');
        const btnZoomOut = document.getElementById('wfb-zoom-out');
        const btnZoomFit = document.getElementById('wfb-zoom-fit');

        if (btnZoomIn) {
            btnZoomIn.addEventListener('click', () => {
                this.zoom = Math.min(this.maxZoom, this.zoom + 0.15);
                this._updateTransform();
            });
        }

        if (btnZoomOut) {
            btnZoomOut.addEventListener('click', () => {
                this.zoom = Math.max(this.minZoom, this.zoom - 0.15);
                this._updateTransform();
            });
        }

        if (btnZoomFit) {
            btnZoomFit.addEventListener('click', () => {
                this._zoomToFit();
            });
        }
    }

    _updateTransform() {
        const transformGroup = document.getElementById('wfb-transform-group');
        if (transformGroup) {
            transformGroup.setAttribute('transform', `translate(${this.panX},${this.panY}) scale(${this.zoom})`);
        }
        const zoomLabel = document.getElementById('wfb-zoom-level');
        if (zoomLabel) {
            zoomLabel.textContent = Math.round(this.zoom * 100) + '%';
        }
    }

    _zoomToFit() {
        const service = this._getService();
        const wf = service.getWorkflow(this.currentWorkflowId);
        if (!wf || wf.nodes.length === 0) {
            this.zoom = 1;
            this.panX = 0;
            this.panY = 0;
            this._updateTransform();
            return;
        }

        const padding = 80;
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

        wf.nodes.forEach(node => {
            minX = Math.min(minX, node.position.x);
            minY = Math.min(minY, node.position.y);
            maxX = Math.max(maxX, node.position.x + this.NODE_WIDTH);
            maxY = Math.max(maxY, node.position.y + this.NODE_HEIGHT);
        });

        const canvasWrapper = document.getElementById('wfb-canvas-wrapper');
        if (!canvasWrapper) return;

        const wrapperRect = canvasWrapper.getBoundingClientRect();
        const contentW = maxX - minX + padding * 2;
        const contentH = maxY - minY + padding * 2;

        const scaleX = wrapperRect.width / contentW;
        const scaleY = wrapperRect.height / contentH;
        this.zoom = Math.max(this.minZoom, Math.min(1.2, Math.min(scaleX, scaleY)));

        this.panX = (wrapperRect.width - contentW * this.zoom) / 2 - minX * this.zoom + padding * this.zoom;
        this.panY = (wrapperRect.height - contentH * this.zoom) / 2 - minY * this.zoom + padding * this.zoom;

        this._updateTransform();
    }

    // ================================================================
    // KEYBOARD SHORTCUTS
    // ================================================================

    _handleKeyDown(e) {
        if (this.viewMode !== 'editor') return;
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

        if (e.key === 'Delete' || e.key === 'Backspace') {
            e.preventDefault();
            const service = this._getService();

            if (this.selectedNodeId) {
                service.removeNode(this.currentWorkflowId, this.selectedNodeId);
                this.selectedNodeId = null;
                this._renderEditor();
            } else if (this.selectedConnectionId) {
                service.removeConnection(this.currentWorkflowId, this.selectedConnectionId);
                this.selectedConnectionId = null;
                this._renderEditor();
            }
        }

        if (e.key === 'Escape') {
            if (this.isDrawingConnection) {
                this.isDrawingConnection = false;
                this.connectionDraft = null;
                const draftPath = document.getElementById('wfb-connection-draft');
                if (draftPath) {
                    draftPath.style.display = 'none';
                }
            } else {
                this.selectedNodeId = null;
                this.selectedConnectionId = null;
                this._renderEditor();
            }
        }

        // Ctrl+S to save (prevent default)
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            if (this.selectedNodeId) {
                this._saveNodeConfig();
            }
            this._showToast('Workflow gespeichert', 'success');
        }
    }

    // ================================================================
    // HISTORY MODAL
    // ================================================================

    _showHistoryModal() {
        const service = this._getService();
        const history = service.getExecutionHistory();

        const overlay = document.createElement('div');
        overlay.className = 'wfb-modal-overlay';
        overlay.innerHTML = `
            <div class="wfb-modal">
                <div class="wfb-modal-header">
                    <h2>Ausfuehrungsprotokoll</h2>
                    <button class="wfb-icon-btn wfb-modal-close">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"/></svg>
                    </button>
                </div>
                <div class="wfb-modal-body">
                    ${history.length === 0 ? '<p class="wfb-empty-msg">Noch keine Ausfuehrungen protokolliert.</p>' : `
                        <div class="wfb-history-list">
                            ${history.slice(0, 50).map(exec => `
                                <div class="wfb-history-item wfb-history-${exec.status}">
                                    <div class="wfb-history-status">
                                        ${exec.status === 'completed' ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="var(--accent-success)"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>'
                                        : exec.status === 'error' ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="var(--accent-danger)"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"/></svg>'
                                        : '<svg width="16" height="16" viewBox="0 0 24 24" fill="var(--accent-warning)"><path d="M12 6v3l4-4-4-4v3c-4.42 0-8 3.58-8 8 0 1.57.46 3.03 1.24 4.26L6.7 14.8A5.87 5.87 0 0 1 6 12c0-3.31 2.69-6 6-6z"/></svg>'}
                                    </div>
                                    <div class="wfb-history-info">
                                        <strong>${this._escapeHtml(exec.workflowName || 'Unbekannt')}</strong>
                                        <span class="wfb-history-time">${this._formatDateTime(exec.startedAt)}</span>
                                        ${exec.error ? `<span class="wfb-history-error">${this._escapeHtml(exec.error)}</span>` : ''}
                                        <span class="wfb-history-nodes">${exec.nodeResults ? exec.nodeResults.length : 0} Knoten ausgefuehrt</span>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    `}
                </div>
                <div class="wfb-modal-footer">
                    <button class="wfb-btn wfb-btn-danger wfb-btn-small" id="wfb-clear-history">Protokoll loeschen</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        overlay.querySelector('.wfb-modal-close').addEventListener('click', () => overlay.remove());
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) overlay.remove();
        });

        const btnClear = overlay.querySelector('#wfb-clear-history');
        if (btnClear) {
            btnClear.addEventListener('click', () => {
                service.clearExecutionHistory();
                overlay.remove();
                this._showToast('Protokoll geloescht', 'success');
            });
        }
    }

    // ================================================================
    // TOAST NOTIFICATIONS
    // ================================================================

    _showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `wfb-toast wfb-toast-${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);

        requestAnimationFrame(() => {
            toast.classList.add('wfb-toast-visible');
        });

        setTimeout(() => {
            toast.classList.remove('wfb-toast-visible');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // ================================================================
    // HELPERS
    // ================================================================

    _getService() {
        return window.workflowBuilderService;
    }

    _escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    _truncateText(text, maxLen) {
        if (!text) return '';
        return text.length > maxLen ? text.substring(0, maxLen) + '...' : text;
    }

    _formatRelativeTime(isoString) {
        if (!isoString) return 'Nie';
        const date = new Date(isoString);
        const now = new Date();
        const diffMs = now - date;
        const diffMin = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMin < 1) return 'Gerade eben';
        if (diffMin < 60) return `vor ${diffMin} Min.`;
        if (diffHours < 24) return `vor ${diffHours} Std.`;
        if (diffDays < 7) return `vor ${diffDays} Tagen`;
        return date.toLocaleDateString('de-DE');
    }

    _formatDateTime(isoString) {
        if (!isoString) return '';
        const d = new Date(isoString);
        return d.toLocaleDateString('de-DE') + ' ' + d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    }
}

// Attach to window
window.workflowBuilderUI = new WorkflowBuilderUI();
