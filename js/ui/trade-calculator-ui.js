/* ============================================
   Trade Calculator UI
   Gewerke-Kalkulation mit interaktiven Vorlagen
   Mobile-first für Handwerker auf der Baustelle
   ============================================ */

class TradeCalculatorUI {
    constructor() {
        this.service = window.tradeCalculatorService;
        this.container = null;
        this.currentView = 'list'; // 'trade-select' | 'list' | 'calculator' | 'quick'
        this.currentTemplateId = null;
        this.currentQuantities = {};
        this.activeTab = 'own'; // 'own' | 'all' | 'custom'
        this.initCSS();
    }

    // ============================================
    // CSS Injection
    // ============================================
    initCSS() {
        if (document.getElementById('trade-calculator-ui-styles')) { return; }

        const style = document.createElement('style');
        style.id = 'trade-calculator-ui-styles';
        style.textContent = `
            /* ---- Container ---- */
            .tc-container {
                max-width: 900px;
                margin: 0 auto;
                padding: 16px;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                color: #e4e4e7;
            }

            .tc-container * { box-sizing: border-box; }

            /* ---- Header ---- */
            .tc-page-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 20px;
                flex-wrap: wrap;
                gap: 10px;
            }
            .tc-page-header h2 {
                margin: 0;
                font-size: 22px;
                font-weight: 700;
                color: #e4e4e7;
            }
            .tc-back-btn {
                background: none;
                border: 1px solid #3a3a42;
                color: #a1a1aa;
                padding: 8px 16px;
                border-radius: 8px;
                cursor: pointer;
                font-size: 14px;
                transition: all 0.2s;
            }
            .tc-back-btn:hover {
                background: #27272a;
                color: #e4e4e7;
                border-color: #52525b;
            }

            /* ---- Trade Selection Cards ---- */
            .tc-trade-select-header {
                text-align: center;
                margin-bottom: 28px;
            }
            .tc-trade-select-header h2 {
                font-size: 24px;
                font-weight: 700;
                color: #e4e4e7;
                margin: 0 0 8px;
            }
            .tc-trade-select-header p {
                font-size: 14px;
                color: #71717a;
                margin: 0;
            }
            .tc-trade-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
                gap: 14px;
                margin-bottom: 24px;
            }
            .tc-trade-card {
                background: #1c1c21;
                border: 2px solid #2a2a32;
                border-radius: 14px;
                padding: 24px 14px;
                text-align: center;
                cursor: pointer;
                transition: all 0.25s ease;
                user-select: none;
            }
            .tc-trade-card:hover {
                border-color: #6366f1;
                background: #1e1e26;
                transform: translateY(-2px);
            }
            .tc-trade-card.active {
                border-color: #6366f1;
                background: #1e1b4b;
            }
            .tc-trade-icon {
                font-size: 40px;
                margin-bottom: 10px;
                display: block;
                line-height: 1.2;
            }
            .tc-trade-name {
                font-size: 14px;
                font-weight: 600;
                color: #e4e4e7;
                margin-bottom: 2px;
            }
            .tc-trade-fullname {
                font-size: 11px;
                color: #71717a;
            }

            /* ---- Tabs ---- */
            .tc-tabs {
                display: flex;
                gap: 4px;
                margin-bottom: 18px;
                background: #18181b;
                border-radius: 10px;
                padding: 4px;
                overflow-x: auto;
            }
            .tc-tab {
                flex: 1;
                padding: 10px 12px;
                border: none;
                background: transparent;
                color: #71717a;
                font-size: 13px;
                font-weight: 500;
                border-radius: 8px;
                cursor: pointer;
                transition: all 0.2s;
                white-space: nowrap;
                text-align: center;
            }
            .tc-tab:hover { color: #a1a1aa; background: #27272a; }
            .tc-tab.active {
                background: #27272a;
                color: #e4e4e7;
                font-weight: 600;
            }

            /* ---- Template Cards ---- */
            .tc-template-list {
                display: grid;
                gap: 12px;
            }
            .tc-template-card {
                background: #1c1c21;
                border: 1px solid #2a2a32;
                border-radius: 12px;
                padding: 18px;
                transition: all 0.2s;
            }
            .tc-template-card:hover {
                border-color: #3a3a42;
            }
            .tc-template-card-header {
                display: flex;
                align-items: flex-start;
                justify-content: space-between;
                gap: 12px;
                margin-bottom: 8px;
            }
            .tc-template-card h3 {
                margin: 0;
                font-size: 16px;
                font-weight: 600;
                color: #e4e4e7;
            }
            .tc-template-trade-badge {
                display: inline-block;
                padding: 2px 8px;
                font-size: 11px;
                font-weight: 600;
                border-radius: 4px;
                background: #6366f122;
                color: #818cf8;
                border: 1px solid #6366f133;
                white-space: nowrap;
                flex-shrink: 0;
            }
            .tc-template-desc {
                font-size: 13px;
                color: #a1a1aa;
                margin-bottom: 12px;
            }
            .tc-template-meta {
                display: flex;
                align-items: center;
                gap: 14px;
                font-size: 12px;
                color: #71717a;
                margin-bottom: 14px;
            }
            .tc-template-actions {
                display: flex;
                gap: 8px;
                flex-wrap: wrap;
            }
            .tc-btn {
                padding: 10px 18px;
                border-radius: 8px;
                border: none;
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s;
                font-family: inherit;
            }
            .tc-btn-primary {
                background: #6366f1;
                color: #fff;
            }
            .tc-btn-primary:hover { background: #4f46e5; }
            .tc-btn-secondary {
                background: #27272a;
                color: #a1a1aa;
                border: 1px solid #3a3a42;
            }
            .tc-btn-secondary:hover { background: #3a3a42; color: #e4e4e7; }
            .tc-btn-danger {
                background: #7f1d1d;
                color: #fca5a5;
                border: 1px solid #991b1b;
            }
            .tc-btn-danger:hover { background: #991b1b; }
            .tc-btn-success {
                background: #166534;
                color: #bbf7d0;
            }
            .tc-btn-success:hover { background: #15803d; }
            .tc-btn-sm {
                padding: 6px 12px;
                font-size: 12px;
            }
            .tc-btn-lg {
                padding: 14px 24px;
                font-size: 16px;
                font-weight: 600;
                width: 100%;
            }

            /* ---- Calculator View ---- */
            .tc-calc-section {
                margin-bottom: 20px;
            }
            .tc-calc-section-title {
                font-size: 13px;
                font-weight: 600;
                color: #71717a;
                text-transform: uppercase;
                letter-spacing: 0.8px;
                margin-bottom: 10px;
                padding-bottom: 6px;
                border-bottom: 1px solid #2a2a32;
            }

            /* Line item row */
            .tc-line-item {
                display: grid;
                grid-template-columns: 1fr 80px 50px 90px 90px;
                gap: 8px;
                align-items: center;
                padding: 10px 0;
                border-bottom: 1px solid #1a1a1f;
                font-size: 14px;
            }
            @media (max-width: 600px) {
                .tc-line-item {
                    grid-template-columns: 1fr;
                    gap: 6px;
                    padding: 12px 0;
                }
                .tc-line-item-sub {
                    display: grid;
                    grid-template-columns: 1fr 50px 1fr 1fr;
                    gap: 6px;
                    align-items: center;
                }
            }
            .tc-line-label {
                color: #e4e4e7;
                font-weight: 500;
            }
            .tc-line-label .tc-optional-tag {
                font-size: 10px;
                color: #f59e0b;
                background: #f59e0b18;
                border: 1px solid #f59e0b33;
                padding: 1px 6px;
                border-radius: 3px;
                margin-left: 6px;
                font-weight: 600;
                vertical-align: middle;
            }
            .tc-line-waste {
                font-size: 11px;
                color: #71717a;
                display: block;
                margin-top: 2px;
            }
            .tc-line-unit {
                color: #71717a;
                font-size: 13px;
                text-align: center;
            }
            .tc-line-total {
                color: #e4e4e7;
                font-weight: 600;
                text-align: right;
                white-space: nowrap;
            }
            .tc-input {
                background: #0f0f12;
                border: 1px solid #2a2a32;
                border-radius: 6px;
                color: #e4e4e7;
                padding: 10px 8px;
                font-size: 15px;
                width: 100%;
                text-align: right;
                font-family: 'SF Mono', 'Cascadia Code', monospace, sans-serif;
                transition: border-color 0.2s;
                -moz-appearance: textfield;
            }
            .tc-input::-webkit-outer-spin-button,
            .tc-input::-webkit-inner-spin-button {
                -webkit-appearance: none;
                margin: 0;
            }
            .tc-input:focus {
                outline: none;
                border-color: #6366f1;
            }

            /* ---- Totals Section ---- */
            .tc-totals {
                background: #0f0f12;
                border: 1px solid #2a2a32;
                border-radius: 12px;
                padding: 20px;
                margin-top: 20px;
            }
            .tc-total-row {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 6px 0;
                font-size: 14px;
            }
            .tc-total-row.tc-total-label { color: #a1a1aa; }
            .tc-total-row .tc-total-value { color: #e4e4e7; font-weight: 500; font-family: 'SF Mono', 'Cascadia Code', monospace, sans-serif; }
            .tc-total-divider {
                border: none;
                border-top: 1px solid #2a2a32;
                margin: 8px 0;
            }
            .tc-total-row.tc-brutto {
                font-size: 22px;
                font-weight: 700;
                padding: 12px 0 4px;
            }
            .tc-total-row.tc-brutto .tc-total-value {
                color: #22c55e;
                font-size: 26px;
                font-weight: 800;
            }
            .tc-surcharge-row {
                display: flex;
                justify-content: space-between;
                padding: 4px 0;
                font-size: 13px;
                color: #a1a1aa;
            }

            /* ---- Quick Calculators ---- */
            .tc-quick-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
                gap: 14px;
            }
            .tc-quick-card {
                background: #1c1c21;
                border: 1px solid #2a2a32;
                border-radius: 12px;
                padding: 18px;
            }
            .tc-quick-card h3 {
                margin: 0 0 14px;
                font-size: 15px;
                font-weight: 600;
                color: #e4e4e7;
            }
            .tc-quick-inputs {
                display: flex;
                flex-direction: column;
                gap: 10px;
                margin-bottom: 14px;
            }
            .tc-quick-field {
                display: flex;
                align-items: center;
                gap: 8px;
            }
            .tc-quick-field label {
                font-size: 13px;
                color: #a1a1aa;
                min-width: 80px;
            }
            .tc-quick-field .tc-input {
                max-width: 120px;
            }
            .tc-quick-result {
                background: #0f0f12;
                border: 1px solid #2a2a32;
                border-radius: 8px;
                padding: 12px;
                text-align: center;
            }
            .tc-quick-result-value {
                font-size: 28px;
                font-weight: 700;
                color: #22c55e;
                font-family: 'SF Mono', 'Cascadia Code', monospace, sans-serif;
            }
            .tc-quick-result-unit {
                font-size: 13px;
                color: #71717a;
                margin-top: 2px;
            }

            /* ---- Toolbar ---- */
            .tc-toolbar {
                display: flex;
                gap: 8px;
                flex-wrap: wrap;
                margin-bottom: 16px;
            }

            /* ---- Create Template Modal ---- */
            .tc-modal-overlay {
                position: fixed;
                inset: 0;
                background: rgba(0,0,0,0.7);
                z-index: 9999;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 16px;
            }
            .tc-modal {
                background: #1c1c21;
                border: 1px solid #2a2a32;
                border-radius: 14px;
                padding: 24px;
                width: 100%;
                max-width: 600px;
                max-height: 85vh;
                overflow-y: auto;
            }
            .tc-modal h3 {
                margin: 0 0 18px;
                font-size: 18px;
                font-weight: 700;
                color: #e4e4e7;
            }
            .tc-form-group {
                margin-bottom: 14px;
            }
            .tc-form-group label {
                display: block;
                font-size: 13px;
                font-weight: 500;
                color: #a1a1aa;
                margin-bottom: 5px;
            }
            .tc-form-group input,
            .tc-form-group select,
            .tc-form-group textarea {
                width: 100%;
                background: #0f0f12;
                border: 1px solid #2a2a32;
                border-radius: 6px;
                color: #e4e4e7;
                padding: 10px 12px;
                font-size: 14px;
                font-family: inherit;
            }
            .tc-form-group input:focus,
            .tc-form-group select:focus,
            .tc-form-group textarea:focus {
                outline: none;
                border-color: #6366f1;
            }
            .tc-form-group textarea {
                resize: vertical;
                min-height: 60px;
            }
            .tc-modal-actions {
                display: flex;
                justify-content: flex-end;
                gap: 8px;
                margin-top: 20px;
            }

            /* ---- Empty State ---- */
            .tc-empty {
                text-align: center;
                padding: 40px 20px;
                color: #71717a;
            }
            .tc-empty-icon {
                font-size: 48px;
                margin-bottom: 12px;
                display: block;
            }
            .tc-empty p {
                font-size: 14px;
                margin: 0 0 16px;
            }

            /* ---- Type Badges ---- */
            .tc-type-badge {
                display: inline-block;
                padding: 1px 6px;
                font-size: 10px;
                font-weight: 600;
                border-radius: 3px;
                text-transform: uppercase;
                letter-spacing: 0.3px;
            }
            .tc-type-material { background: #3b82f622; color: #60a5fa; border: 1px solid #3b82f633; }
            .tc-type-arbeit { background: #f59e0b22; color: #fbbf24; border: 1px solid #f59e0b33; }
            .tc-type-fahrt { background: #8b5cf622; color: #a78bfa; border: 1px solid #8b5cf633; }
            .tc-type-entsorgung { background: #ef444422; color: #f87171; border: 1px solid #ef444433; }
            .tc-type-pauschale { background: #22c55e22; color: #4ade80; border: 1px solid #22c55e33; }
        `;

        document.head.appendChild(style);
    }

    // ============================================
    // XSS Prevention
    // ============================================
    _esc(str) {
        if (!str && str !== 0) { return ''; }
        const el = document.createElement('span');
        el.textContent = String(str);
        return el.innerHTML;
    }

    // ============================================
    // Currency Formatting
    // ============================================
    _formatCurrency(amount) {
        return new Intl.NumberFormat('de-DE', {
            style: 'currency',
            currency: 'EUR'
        }).format(amount || 0);
    }

    _formatNumber(num, decimals = 2) {
        return new Intl.NumberFormat('de-DE', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        }).format(num || 0);
    }

    // ============================================
    // Main Render Entry Point
    // ============================================

    /**
     * Render the trade calculator into a container
     * @param {string|HTMLElement} target - Container element or selector
     */
    render(target) {
        if (typeof target === 'string') {
            this.container = document.querySelector(target);
        } else {
            this.container = target;
        }

        if (!this.container) { return; }

        // Check if user has selected a trade
        const userTrade = this.service.getUserTrade();
        if (!userTrade) {
            this.currentView = 'trade-select';
        } else {
            this.currentView = 'list';
        }

        this._renderCurrentView();
    }

    _renderCurrentView() {
        if (!this.container) { return; }

        switch (this.currentView) {
            case 'trade-select':
                this._renderTradeSelection();
                break;
            case 'list':
                this._renderTemplateList();
                break;
            case 'calculator':
                this._renderCalculator();
                break;
            case 'quick':
                this._renderQuickCalculators();
                break;
            default:
                this._renderTemplateList();
        }
    }

    // ============================================
    // View 1: Trade Selection
    // ============================================
    _renderTradeSelection() {
        const trades = this.service.getAvailableTrades();
        const currentTrade = this.service.getUserTrade();

        this.container.innerHTML = `
            <div class="tc-container">
                <div class="tc-trade-select-header">
                    <h2>Welches Gewerk betreiben Sie?</h2>
                    <p>Wählen Sie Ihr Gewerk für passende Kalkulationsvorlagen</p>
                </div>
                <div class="tc-trade-grid">
                    ${trades.map(t => `
                        <div class="tc-trade-card ${currentTrade === t.id ? 'active' : ''}"
                             data-trade="${this._esc(t.id)}">
                            <span class="tc-trade-icon">${t.icon}</span>
                            <div class="tc-trade-name">${this._esc(t.name)}</div>
                            <div class="tc-trade-fullname">${this._esc(t.fullName)}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        // Bind trade card clicks
        this.container.querySelectorAll('.tc-trade-card').forEach(card => {
            card.addEventListener('click', () => {
                const trade = card.getAttribute('data-trade');
                this.service.setUserTrade(trade);
                this.currentView = 'list';
                this._renderCurrentView();
            });
        });
    }

    // ============================================
    // View 2: Template List
    // ============================================
    _renderTemplateList() {
        const userTrade = this.service.getUserTrade();
        const tradeDef = this.service.getAvailableTrades().find(t => t.id === userTrade);

        let templates;
        if (this.activeTab === 'own') {
            templates = userTrade ? this.service.getTemplates(userTrade) : [];
            // Also include allgemein templates
            if (userTrade !== 'allgemein') {
                templates = [...templates, ...this.service.getTemplates('allgemein')];
            }
        } else if (this.activeTab === 'all') {
            templates = this.service.getAllTemplates();
        } else {
            templates = this.service.getAllTemplates().filter(t => t.isCustom);
        }

        const trades = this.service.getAvailableTrades();
        const tradeMap = {};
        trades.forEach(t => { tradeMap[t.id] = t; });

        this.container.innerHTML = `
            <div class="tc-container">
                <div class="tc-page-header">
                    <h2>${tradeDef ? tradeDef.icon + ' ' : ''}Kalkulation</h2>
                    <div style="display:flex;gap:8px;flex-wrap:wrap;">
                        <button class="tc-btn tc-btn-secondary tc-btn-sm" id="tc-btn-change-trade">Gewerk wechseln</button>
                        <button class="tc-btn tc-btn-secondary tc-btn-sm" id="tc-btn-quick-calc">Schnellrechner</button>
                    </div>
                </div>

                <div class="tc-tabs">
                    <button class="tc-tab ${this.activeTab === 'own' ? 'active' : ''}" data-tab="own">
                        Mein Gewerk${tradeDef ? ' (' + this._esc(tradeDef.name) + ')' : ''}
                    </button>
                    <button class="tc-tab ${this.activeTab === 'all' ? 'active' : ''}" data-tab="all">
                        Alle Gewerke
                    </button>
                    <button class="tc-tab ${this.activeTab === 'custom' ? 'active' : ''}" data-tab="custom">
                        Eigene Vorlagen
                    </button>
                </div>

                <div class="tc-toolbar">
                    <button class="tc-btn tc-btn-primary tc-btn-sm" id="tc-btn-create-template">+ Eigene Vorlage erstellen</button>
                </div>

                <div class="tc-template-list">
                    ${templates.length === 0 ? `
                        <div class="tc-empty">
                            <span class="tc-empty-icon">${this.activeTab === 'custom' ? '\uD83D\uDCC1' : '\uD83D\uDD0D'}</span>
                            <p>${this.activeTab === 'custom' ? 'Noch keine eigenen Vorlagen erstellt.' : 'Keine Vorlagen gefunden.'}</p>
                            ${this.activeTab === 'custom' ? '<button class="tc-btn tc-btn-primary tc-btn-sm" id="tc-btn-create-empty">Erste Vorlage erstellen</button>' : ''}
                        </div>
                    ` : templates.map(t => `
                        <div class="tc-template-card" data-template-id="${this._esc(t.id)}">
                            <div class="tc-template-card-header">
                                <h3>${this._esc(t.name)}</h3>
                                <span class="tc-template-trade-badge">${tradeMap[t.trade] ? tradeMap[t.trade].icon + ' ' + this._esc(tradeMap[t.trade].name) : this._esc(t.trade)}</span>
                            </div>
                            <div class="tc-template-desc">${this._esc(t.description)}</div>
                            <div class="tc-template-meta">
                                <span>${t.items.length} Positionen</span>
                                <span>${t.isCustom ? 'Eigene Vorlage' : 'Standard-Vorlage'}</span>
                                ${t.surcharges.length > 0 ? `<span>${t.surcharges.length} Zuschläge</span>` : ''}
                            </div>
                            <div class="tc-template-actions">
                                <button class="tc-btn tc-btn-primary tc-btn-sm tc-action-start" data-id="${this._esc(t.id)}">Kalkulation starten</button>
                                <button class="tc-btn tc-btn-secondary tc-btn-sm tc-action-duplicate" data-id="${this._esc(t.id)}">Duplizieren</button>
                                ${t.isCustom ? `<button class="tc-btn tc-btn-danger tc-btn-sm tc-action-delete" data-id="${this._esc(t.id)}">Löschen</button>` : ''}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        // Bind events
        this.container.querySelectorAll('.tc-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                this.activeTab = tab.getAttribute('data-tab');
                this._renderTemplateList();
            });
        });

        this.container.querySelector('#tc-btn-change-trade')?.addEventListener('click', () => {
            this.currentView = 'trade-select';
            this._renderCurrentView();
        });

        this.container.querySelector('#tc-btn-quick-calc')?.addEventListener('click', () => {
            this.currentView = 'quick';
            this._renderCurrentView();
        });

        this.container.querySelector('#tc-btn-create-template')?.addEventListener('click', () => {
            this._showCreateTemplateModal();
        });

        this.container.querySelector('#tc-btn-create-empty')?.addEventListener('click', () => {
            this._showCreateTemplateModal();
        });

        this.container.querySelectorAll('.tc-action-start').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.currentTemplateId = btn.getAttribute('data-id');
                this.currentQuantities = {};
                this.currentView = 'calculator';
                this._renderCurrentView();
            });
        });

        this.container.querySelectorAll('.tc-action-duplicate').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.getAttribute('data-id');
                this.service.duplicateTemplate(id);
                this.activeTab = 'custom';
                this._renderTemplateList();
            });
        });

        this.container.querySelectorAll('.tc-action-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.getAttribute('data-id');
                if (confirm('Vorlage wirklich löschen?')) {
                    this.service.deleteTemplate(id);
                    this._renderTemplateList();
                }
            });
        });
    }

    // ============================================
    // View 3: Calculator
    // ============================================
    _renderCalculator() {
        const template = this.service.getTemplate(this.currentTemplateId);
        if (!template) {
            this.currentView = 'list';
            this._renderCurrentView();
            return;
        }

        const tradeDef = this.service.getAvailableTrades().find(t => t.id === template.trade);

        // Initialize quantities from defaults if not set
        for (const item of template.items) {
            if (!this.currentQuantities[item.id]) {
                this.currentQuantities[item.id] = {
                    qty: item.defaultQuantity,
                    price: item.defaultPrice
                };
            }
        }

        // Calculate current totals
        const result = this.service.calculate(this.currentTemplateId, this.currentQuantities);

        // Group items by type
        const typeOrder = ['material', 'arbeit', 'fahrt', 'entsorgung', 'pauschale'];
        const typeLabels = {
            material: 'Material',
            arbeit: 'Arbeitsleistung',
            fahrt: 'Fahrtkosten',
            entsorgung: 'Entsorgung',
            pauschale: 'Pauschale'
        };

        const grouped = {};
        for (const item of template.items) {
            const type = item.type || 'material';
            if (!grouped[type]) { grouped[type] = []; }
            grouped[type].push(item);
        }

        let itemsHtml = '';
        for (const type of typeOrder) {
            if (!grouped[type] || grouped[type].length === 0) { continue; }
            itemsHtml += `
                <div class="tc-calc-section">
                    <div class="tc-calc-section-title">
                        <span class="tc-type-badge tc-type-${type}">${this._esc(typeLabels[type] || type)}</span>
                    </div>
                    ${grouped[type].map(item => {
                        const q = this.currentQuantities[item.id] || { qty: item.defaultQuantity, price: item.defaultPrice };
                        const waste = item.wasteFactor && item.wasteFactor > 1.0 ? item.wasteFactor : null;
                        const effectiveQty = q.qty * (item.wasteFactor || 1.0);
                        const lineTotal = effectiveQty * q.price;
                        return `
                            <div class="tc-line-item">
                                <div class="tc-line-label">
                                    ${this._esc(item.label)}
                                    ${item.optional ? '<span class="tc-optional-tag">optional</span>' : ''}
                                    ${waste ? `<span class="tc-line-waste">+${Math.round((waste - 1) * 100)}% Verschnitt</span>` : ''}
                                </div>
                                <div class="tc-line-item-sub" style="display:contents;">
                                    <input type="number" class="tc-input tc-qty-input"
                                        data-item-id="${this._esc(item.id)}"
                                        value="${q.qty}"
                                        min="0" step="any"
                                        aria-label="Menge ${this._esc(item.label)}">
                                    <div class="tc-line-unit">${this._esc(item.unit)}</div>
                                    <input type="number" class="tc-input tc-price-input"
                                        data-item-id="${this._esc(item.id)}"
                                        value="${q.price}"
                                        min="0" step="0.01"
                                        aria-label="Preis ${this._esc(item.label)}">
                                    <div class="tc-line-total" data-total-id="${this._esc(item.id)}">${this._formatCurrency(lineTotal)}</div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
        }

        this.container.innerHTML = `
            <div class="tc-container">
                <div class="tc-page-header">
                    <h2>${tradeDef ? tradeDef.icon + ' ' : ''}${this._esc(template.name)}</h2>
                    <button class="tc-back-btn" id="tc-btn-back-list">&larr; Zurück</button>
                </div>
                <p style="color:#a1a1aa;font-size:13px;margin:0 0 20px;">${this._esc(template.description)}</p>

                ${itemsHtml}

                <div class="tc-totals" id="tc-totals-container">
                    ${this._renderTotals(result)}
                </div>

                <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:20px;">
                    <button class="tc-btn tc-btn-success tc-btn-lg" id="tc-btn-create-angebot">Als Angebot übernehmen</button>
                </div>
                <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:10px;">
                    <button class="tc-btn tc-btn-secondary" id="tc-btn-save-template">Vorlage speichern</button>
                    <button class="tc-btn tc-btn-secondary" id="tc-btn-reset-calc">Zurücksetzen</button>
                </div>
            </div>
        `;

        // Bind events
        this.container.querySelector('#tc-btn-back-list')?.addEventListener('click', () => {
            this.currentView = 'list';
            this.currentTemplateId = null;
            this.currentQuantities = {};
            this._renderCurrentView();
        });

        // Live update on quantity/price change
        this.container.querySelectorAll('.tc-qty-input').forEach(input => {
            input.addEventListener('input', () => {
                const itemId = input.getAttribute('data-item-id');
                if (!this.currentQuantities[itemId]) { this.currentQuantities[itemId] = {}; }
                this.currentQuantities[itemId].qty = parseFloat(input.value) || 0;
                this._updateTotals(template);
            });
        });

        this.container.querySelectorAll('.tc-price-input').forEach(input => {
            input.addEventListener('input', () => {
                const itemId = input.getAttribute('data-item-id');
                if (!this.currentQuantities[itemId]) { this.currentQuantities[itemId] = {}; }
                this.currentQuantities[itemId].price = parseFloat(input.value) || 0;
                this._updateTotals(template);
            });
        });

        this.container.querySelector('#tc-btn-create-angebot')?.addEventListener('click', () => {
            this._createAngebotFromCurrent();
        });

        this.container.querySelector('#tc-btn-save-template')?.addEventListener('click', () => {
            this._saveCurrentAsTemplate(template);
        });

        this.container.querySelector('#tc-btn-reset-calc')?.addEventListener('click', () => {
            this.currentQuantities = {};
            this._renderCalculator();
        });
    }

    _renderTotals(result) {
        if (!result) { return ''; }

        let surchargesHtml = '';
        if (result.surcharges && result.surcharges.length > 0) {
            surchargesHtml = result.surcharges.map(s => `
                <div class="tc-surcharge-row">
                    <span>${this._esc(s.label)}${s.type === 'percentage' ? ' (' + s.value + '%)' : ''}</span>
                    <span>${this._formatCurrency(s.amount)}</span>
                </div>
            `).join('');
        }

        return `
            <div class="tc-total-row tc-total-label">
                <span>Zwischensumme</span>
                <span class="tc-total-value" id="tc-val-subtotal">${this._formatCurrency(result.subtotal)}</span>
            </div>
            ${surchargesHtml}
            ${result.surcharges && result.surcharges.length > 0 ? '<hr class="tc-total-divider">' : ''}
            <div class="tc-total-row tc-total-label">
                <span>Netto</span>
                <span class="tc-total-value" id="tc-val-netto">${this._formatCurrency(result.netto)}</span>
            </div>
            <div class="tc-total-row tc-total-label">
                <span>MwSt. (19%)</span>
                <span class="tc-total-value" id="tc-val-mwst">${this._formatCurrency(result.mwst)}</span>
            </div>
            <hr class="tc-total-divider">
            <div class="tc-total-row tc-brutto">
                <span>Brutto</span>
                <span class="tc-total-value" id="tc-val-brutto">${this._formatCurrency(result.brutto)}</span>
            </div>
        `;
    }

    _updateTotals(template) {
        const result = this.service.calculate(this.currentTemplateId, this.currentQuantities);
        if (!result) { return; }

        // Update individual line totals
        for (const item of result.items) {
            const el = this.container.querySelector(`[data-total-id="${item.id}"]`);
            if (el) { el.textContent = this._formatCurrency(item.total); }
        }

        // Also update zero-qty items that may have been cleared
        for (const item of template.items) {
            const found = result.items.find(r => r.id === item.id);
            if (!found) {
                const el = this.container.querySelector(`[data-total-id="${item.id}"]`);
                if (el) { el.textContent = this._formatCurrency(0); }
            }
        }

        // Update totals section
        const totalsContainer = this.container.querySelector('#tc-totals-container');
        if (totalsContainer) {
            totalsContainer.innerHTML = this._renderTotals(result);
        }
    }

    // ============================================
    // View 4: Quick Calculators
    // ============================================
    _renderQuickCalculators() {
        this.container.innerHTML = `
            <div class="tc-container">
                <div class="tc-page-header">
                    <h2>Schnellrechner</h2>
                    <button class="tc-back-btn" id="tc-btn-back-from-quick">&larr; Zurück</button>
                </div>

                <div class="tc-quick-grid">
                    <!-- Fläche -->
                    <div class="tc-quick-card">
                        <h3>Fläche (L x B)</h3>
                        <div class="tc-quick-inputs">
                            <div class="tc-quick-field">
                                <label>Länge (m)</label>
                                <input type="number" class="tc-input" id="tc-q-area-l" value="5" min="0" step="0.01">
                            </div>
                            <div class="tc-quick-field">
                                <label>Breite (m)</label>
                                <input type="number" class="tc-input" id="tc-q-area-w" value="4" min="0" step="0.01">
                            </div>
                            <div class="tc-quick-field">
                                <label>Verschnitt (%)</label>
                                <input type="number" class="tc-input" id="tc-q-area-waste" value="10" min="0" step="1">
                            </div>
                        </div>
                        <div class="tc-quick-result">
                            <div class="tc-quick-result-value" id="tc-q-area-result">22,00</div>
                            <div class="tc-quick-result-unit">m²</div>
                        </div>
                    </div>

                    <!-- Volumen -->
                    <div class="tc-quick-card">
                        <h3>Volumen (L x B x H)</h3>
                        <div class="tc-quick-inputs">
                            <div class="tc-quick-field">
                                <label>Länge (m)</label>
                                <input type="number" class="tc-input" id="tc-q-vol-l" value="3" min="0" step="0.01">
                            </div>
                            <div class="tc-quick-field">
                                <label>Breite (m)</label>
                                <input type="number" class="tc-input" id="tc-q-vol-w" value="2" min="0" step="0.01">
                            </div>
                            <div class="tc-quick-field">
                                <label>Höhe (m)</label>
                                <input type="number" class="tc-input" id="tc-q-vol-h" value="2.5" min="0" step="0.01">
                            </div>
                        </div>
                        <div class="tc-quick-result">
                            <div class="tc-quick-result-value" id="tc-q-vol-result">15,000</div>
                            <div class="tc-quick-result-unit">m³</div>
                        </div>
                    </div>

                    <!-- Farbmenge -->
                    <div class="tc-quick-card">
                        <h3>Farbmenge</h3>
                        <div class="tc-quick-inputs">
                            <div class="tc-quick-field">
                                <label>Fläche (m²)</label>
                                <input type="number" class="tc-input" id="tc-q-paint-area" value="60" min="0" step="0.1">
                            </div>
                            <div class="tc-quick-field">
                                <label>Ergiebigkeit (m²/l)</label>
                                <input type="number" class="tc-input" id="tc-q-paint-cov" value="6" min="0.1" step="0.1">
                            </div>
                        </div>
                        <div class="tc-quick-result">
                            <div class="tc-quick-result-value" id="tc-q-paint-result">10</div>
                            <div class="tc-quick-result-unit">Liter</div>
                        </div>
                    </div>

                    <!-- Fliesenmenge -->
                    <div class="tc-quick-card">
                        <h3>Fliesenmenge</h3>
                        <div class="tc-quick-inputs">
                            <div class="tc-quick-field">
                                <label>Fläche (m²)</label>
                                <input type="number" class="tc-input" id="tc-q-tile-area" value="15" min="0" step="0.1">
                            </div>
                            <div class="tc-quick-field">
                                <label>Fliese L (cm)</label>
                                <input type="number" class="tc-input" id="tc-q-tile-l" value="30" min="1" step="1">
                            </div>
                            <div class="tc-quick-field">
                                <label>Fliese B (cm)</label>
                                <input type="number" class="tc-input" id="tc-q-tile-w" value="30" min="1" step="1">
                            </div>
                            <div class="tc-quick-field">
                                <label>Verschnitt (%)</label>
                                <input type="number" class="tc-input" id="tc-q-tile-waste" value="10" min="0" step="1">
                            </div>
                        </div>
                        <div class="tc-quick-result">
                            <div class="tc-quick-result-value" id="tc-q-tile-result">184</div>
                            <div class="tc-quick-result-unit">Stück (<span id="tc-q-tile-cartons">8</span> Kartons)</div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Bind back button
        this.container.querySelector('#tc-btn-back-from-quick')?.addEventListener('click', () => {
            this.currentView = 'list';
            this._renderCurrentView();
        });

        // Bind all quick calculator inputs
        const areaInputs = ['tc-q-area-l', 'tc-q-area-w', 'tc-q-area-waste'];
        areaInputs.forEach(id => {
            this.container.querySelector('#' + id)?.addEventListener('input', () => this._updateQuickArea());
        });

        const volInputs = ['tc-q-vol-l', 'tc-q-vol-w', 'tc-q-vol-h'];
        volInputs.forEach(id => {
            this.container.querySelector('#' + id)?.addEventListener('input', () => this._updateQuickVolume());
        });

        const paintInputs = ['tc-q-paint-area', 'tc-q-paint-cov'];
        paintInputs.forEach(id => {
            this.container.querySelector('#' + id)?.addEventListener('input', () => this._updateQuickPaint());
        });

        const tileInputs = ['tc-q-tile-area', 'tc-q-tile-l', 'tc-q-tile-w', 'tc-q-tile-waste'];
        tileInputs.forEach(id => {
            this.container.querySelector('#' + id)?.addEventListener('input', () => this._updateQuickTile());
        });

        // Run initial calculations
        this._updateQuickArea();
        this._updateQuickVolume();
        this._updateQuickPaint();
        this._updateQuickTile();
    }

    _updateQuickArea() {
        const l = parseFloat(this.container.querySelector('#tc-q-area-l')?.value) || 0;
        const w = parseFloat(this.container.querySelector('#tc-q-area-w')?.value) || 0;
        const waste = parseFloat(this.container.querySelector('#tc-q-area-waste')?.value) || 0;
        const factor = 1 + (waste / 100);
        const result = this.service.calculateArea(l, w, factor);
        const el = this.container.querySelector('#tc-q-area-result');
        if (el) { el.textContent = this._formatNumber(result); }
    }

    _updateQuickVolume() {
        const l = parseFloat(this.container.querySelector('#tc-q-vol-l')?.value) || 0;
        const w = parseFloat(this.container.querySelector('#tc-q-vol-w')?.value) || 0;
        const h = parseFloat(this.container.querySelector('#tc-q-vol-h')?.value) || 0;
        const result = this.service.calculateVolume(l, w, h);
        const el = this.container.querySelector('#tc-q-vol-result');
        if (el) { el.textContent = this._formatNumber(result, 3); }
    }

    _updateQuickPaint() {
        const area = parseFloat(this.container.querySelector('#tc-q-paint-area')?.value) || 0;
        const cov = parseFloat(this.container.querySelector('#tc-q-paint-cov')?.value) || 1;
        const result = this.service.calculatePaintNeeded(area, cov);
        const el = this.container.querySelector('#tc-q-paint-result');
        if (el) { el.textContent = result; }
    }

    _updateQuickTile() {
        const area = parseFloat(this.container.querySelector('#tc-q-tile-area')?.value) || 0;
        const tl = parseFloat(this.container.querySelector('#tc-q-tile-l')?.value) || 30;
        const tw = parseFloat(this.container.querySelector('#tc-q-tile-w')?.value) || 30;
        const waste = parseFloat(this.container.querySelector('#tc-q-tile-waste')?.value) || 10;
        const tileSize = (tl / 100) * (tw / 100); // cm → m²
        const result = this.service.calculateTileNeeded(area, tileSize, waste);
        const elTiles = this.container.querySelector('#tc-q-tile-result');
        const elCartons = this.container.querySelector('#tc-q-tile-cartons');
        if (elTiles) { elTiles.textContent = result.tiles; }
        if (elCartons) { elCartons.textContent = result.cartons; }
    }

    // ============================================
    // Create Template Modal
    // ============================================
    _showCreateTemplateModal() {
        const trades = this.service.getAvailableTrades();
        const userTrade = this.service.getUserTrade() || 'allgemein';

        const overlay = document.createElement('div');
        overlay.className = 'tc-modal-overlay';
        overlay.innerHTML = `
            <div class="tc-modal">
                <h3>Eigene Vorlage erstellen</h3>
                <div class="tc-form-group">
                    <label>Name der Vorlage</label>
                    <input type="text" id="tc-modal-name" placeholder="z.B. Badumbau Standard">
                </div>
                <div class="tc-form-group">
                    <label>Beschreibung</label>
                    <textarea id="tc-modal-desc" placeholder="Kurze Beschreibung der Vorlage..."></textarea>
                </div>
                <div class="tc-form-group">
                    <label>Gewerk</label>
                    <select id="tc-modal-trade">
                        ${trades.map(t => `<option value="${this._esc(t.id)}" ${t.id === userTrade ? 'selected' : ''}>${this._esc(t.icon)} ${this._esc(t.name)}</option>`).join('')}
                    </select>
                </div>

                <h4 style="color:#e4e4e7;margin:18px 0 10px;font-size:15px;">Positionen</h4>
                <div id="tc-modal-items-container"></div>
                <button class="tc-btn tc-btn-secondary tc-btn-sm" id="tc-modal-add-item" style="margin-top:8px;">+ Position hinzufügen</button>

                <div class="tc-modal-actions">
                    <button class="tc-btn tc-btn-secondary" id="tc-modal-cancel">Abbrechen</button>
                    <button class="tc-btn tc-btn-primary" id="tc-modal-save">Vorlage speichern</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        const itemsContainer = overlay.querySelector('#tc-modal-items-container');
        let itemCount = 0;

        const addItemRow = () => {
            itemCount++;
            const row = document.createElement('div');
            row.style.cssText = 'display:grid;grid-template-columns:1fr 80px 60px 80px;gap:6px;margin-bottom:8px;align-items:center;';
            row.innerHTML = `
                <input type="text" class="tc-input tc-modal-item-label" placeholder="Bezeichnung" style="text-align:left;font-family:inherit;">
                <select class="tc-input tc-modal-item-type" style="text-align:left;font-size:12px;padding:8px 4px;">
                    <option value="material">Material</option>
                    <option value="arbeit">Arbeit</option>
                    <option value="fahrt">Fahrt</option>
                    <option value="entsorgung">Entso.</option>
                    <option value="pauschale">Pausch.</option>
                </select>
                <select class="tc-input tc-modal-item-unit" style="text-align:left;font-size:12px;padding:8px 4px;">
                    <option value="Stk">Stk</option>
                    <option value="m">m</option>
                    <option value="m²">m²</option>
                    <option value="m³">m³</option>
                    <option value="kg">kg</option>
                    <option value="l">l</option>
                    <option value="h">h</option>
                    <option value="km">km</option>
                    <option value="pauschal">pausch.</option>
                </select>
                <input type="number" class="tc-input tc-modal-item-price" placeholder="Preis" min="0" step="0.01">
            `;
            itemsContainer.appendChild(row);
        };

        // Start with one row
        addItemRow();

        overlay.querySelector('#tc-modal-add-item').addEventListener('click', addItemRow);

        overlay.querySelector('#tc-modal-cancel').addEventListener('click', () => {
            overlay.remove();
        });

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) { overlay.remove(); }
        });

        overlay.querySelector('#tc-modal-save').addEventListener('click', () => {
            const name = overlay.querySelector('#tc-modal-name').value.trim();
            const desc = overlay.querySelector('#tc-modal-desc').value.trim();
            const trade = overlay.querySelector('#tc-modal-trade').value;

            if (!name) {
                alert('Bitte geben Sie einen Namen ein.');
                return;
            }

            const labels = overlay.querySelectorAll('.tc-modal-item-label');
            const types = overlay.querySelectorAll('.tc-modal-item-type');
            const units = overlay.querySelectorAll('.tc-modal-item-unit');
            const prices = overlay.querySelectorAll('.tc-modal-item-price');

            const items = [];
            for (let i = 0; i < labels.length; i++) {
                const label = labels[i].value.trim();
                if (!label) { continue; }
                items.push({
                    label: label,
                    type: types[i].value,
                    unit: units[i].value,
                    defaultQuantity: 1,
                    defaultPrice: parseFloat(prices[i].value) || 0,
                    wasteFactor: 1.0,
                    optional: false
                });
            }

            if (items.length === 0) {
                alert('Bitte fügen Sie mindestens eine Position hinzu.');
                return;
            }

            this.service.createCustomTemplate({
                name: name,
                description: desc,
                trade: trade,
                items: items,
                surcharges: []
            });

            overlay.remove();
            this.activeTab = 'custom';
            this._renderTemplateList();
        });
    }

    // ============================================
    // Angebot Creation
    // ============================================
    _createAngebotFromCurrent() {
        const angebotData = this.service.createAngebotFromCalculation(
            this.currentTemplateId,
            this.currentQuantities
        );

        if (!angebotData) {
            alert('Fehler bei der Angebotserstellung.');
            return;
        }

        // Try to pass to the store service if available
        if (window.storeService) {
            try {
                const angebot = {
                    id: window.storeService.generateId ? window.storeService.generateId('ANG') : 'ANG-' + Date.now(),
                    betreff: angebotData.betreff,
                    beschreibung: angebotData.beschreibung,
                    kunde: angebotData.kunde,
                    positionen: angebotData.positionen,
                    netto: angebotData.netto,
                    mwst: angebotData.mwst,
                    brutto: angebotData.brutto,
                    status: 'entwurf',
                    erstelltAm: angebotData.erstelltAm,
                    erstelltAus: angebotData.erstelltAus,
                    kalkulationsVorlage: angebotData.kalkulationsVorlage
                };

                if (window.storeService.store && window.storeService.store.angebote) {
                    window.storeService.store.angebote.push(angebot);
                    if (window.storeService.save) {
                        window.storeService.save();
                    }
                }

                alert(`Angebot erstellt: ${angebot.betreff}\nNetto: ${this._formatCurrency(angebot.netto)}\nBrutto: ${this._formatCurrency(angebot.brutto)}`);
            } catch (e) {
                console.error('Fehler beim Speichern des Angebots:', e);
                alert('Angebotsdaten erstellt. Bitte manuell in das Angebotssystem übernehmen.');
            }
        } else {
            // Fallback: show the data
            const json = JSON.stringify(angebotData, null, 2);
            console.log('Angebotsdaten:', angebotData);
            alert(`Angebot "${angebotData.betreff}" vorbereitet.\nNetto: ${this._formatCurrency(angebotData.netto)}\nBrutto: ${this._formatCurrency(angebotData.brutto)}\n\n(Daten in der Konsole verfügbar)`);
        }
    }

    // ============================================
    // Save Current Calculation as Template
    // ============================================
    _saveCurrentAsTemplate(sourceTemplate) {
        const name = prompt('Name der neuen Vorlage:', sourceTemplate.name + ' (Angepasst)');
        if (!name) { return; }

        const items = sourceTemplate.items.map(item => {
            const q = this.currentQuantities[item.id] || {};
            return {
                ...item,
                defaultQuantity: q.qty !== undefined ? q.qty : item.defaultQuantity,
                defaultPrice: q.price !== undefined ? q.price : item.defaultPrice
            };
        });

        this.service.createCustomTemplate({
            name: name,
            description: sourceTemplate.description,
            trade: sourceTemplate.trade,
            items: items,
            surcharges: sourceTemplate.surcharges
        });

        alert('Vorlage gespeichert!');
    }
}

// Initialize as global singleton
window.tradeCalculatorUI = new TradeCalculatorUI();
