/* ============================================
   Warranty & Maintenance UI
   (Gewährleistung & Wartung)

   Views:
   1. Overview Dashboard (summary cards + Handlungsbedarf)
   2. Warranty List (Gewährleistungen)
   3. Warranty Detail (with claims/Reklamationen)
   4. Maintenance List (Wartungsverträge)
   5. Maintenance Detail (with history + log form)
   6. Maintenance Log Form

   German throughout, boomer-friendly.
   ============================================ */

class WarrantyMaintenanceUI {
    constructor() {
        this.service = window.warrantyMaintenanceService;
        this.currentView = 'dashboard';
        this.currentWarrantyId = null;
        this.currentContractId = null;
        this.currentTab = 'gewaehrleistung';
        this.warrantyFilter = 'alle';
        this.maintenanceLogParts = [];
        this._initialized = false;
    }

    /* =======================================================
       INITIALIZATION
       ======================================================= */

    /**
     * Initialize the UI module. Call once on app load.
     */
    init(containerId) {
        if (this._initialized) { return; }
        this._initialized = true;

        this.containerId = containerId || 'warranty-maintenance-container';
        this.initCSS();
        this.render();
    }

    /**
     * Inject all CSS styles for this module
     */
    initCSS() {
        if (document.getElementById('warranty-maintenance-styles')) { return; }

        const style = document.createElement('style');
        style.id = 'warranty-maintenance-styles';
        style.textContent = `
            /* ============================================
               Warranty & Maintenance Styles
               ============================================ */

            .wm-container {
                max-width: 900px;
                margin: 0 auto;
                padding: 16px;
            }

            /* --- Header & Navigation --- */
            .wm-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 20px;
                flex-wrap: wrap;
                gap: 10px;
            }

            .wm-header h2 {
                margin: 0;
                font-size: 20px;
                font-weight: 700;
                color: var(--text-primary, #e4e4e7);
            }

            .wm-back-btn {
                background: none;
                border: 1px solid var(--border-color, #2a2a32);
                color: var(--text-primary, #e4e4e7);
                padding: 8px 16px;
                border-radius: 8px;
                cursor: pointer;
                font-size: 14px;
                font-family: inherit;
                transition: background 0.2s;
            }

            .wm-back-btn:hover {
                background: var(--bg-secondary, #1c1c21);
            }

            /* --- Summary Cards --- */
            .wm-summary-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
                gap: 12px;
                margin-bottom: 20px;
            }

            .wm-summary-card {
                background: var(--bg-secondary, #1c1c21);
                border: 1px solid var(--border-color, #2a2a32);
                border-radius: 10px;
                padding: 16px;
                text-align: center;
                transition: border-color 0.2s;
            }

            .wm-summary-card:hover {
                border-color: var(--accent-primary, #6366f1);
            }

            .wm-summary-number {
                font-size: 32px;
                font-weight: 700;
                color: var(--text-primary, #e4e4e7);
                line-height: 1.2;
            }

            .wm-summary-label {
                font-size: 13px;
                color: var(--text-secondary, #71717a);
                margin-top: 4px;
            }

            .wm-summary-card.accent-green .wm-summary-number { color: #22c55e; }
            .wm-summary-card.accent-amber .wm-summary-number { color: #f59e0b; }
            .wm-summary-card.accent-red .wm-summary-number { color: #ef4444; }
            .wm-summary-card.accent-blue .wm-summary-number { color: #6366f1; }

            /* --- Handlungsbedarf (Action needed) --- */
            .wm-actions-section {
                margin-bottom: 24px;
            }

            .wm-actions-title {
                font-size: 16px;
                font-weight: 600;
                color: var(--text-primary, #e4e4e7);
                margin-bottom: 12px;
            }

            .wm-action-item {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 12px 16px;
                background: var(--bg-secondary, #1c1c21);
                border-radius: 8px;
                margin-bottom: 8px;
                cursor: pointer;
                transition: background 0.15s, border-color 0.15s;
                border-left: 4px solid transparent;
            }

            .wm-action-item:hover {
                background: var(--bg-primary, #0f0f12);
            }

            .wm-action-item.severity-urgent {
                border-left-color: #ef4444;
                background: #ef444410;
            }

            .wm-action-item.severity-warning {
                border-left-color: #f59e0b;
                background: #f59e0b10;
            }

            .wm-action-item.severity-info {
                border-left-color: #6366f1;
                background: #6366f110;
            }

            .wm-action-icon {
                font-size: 20px;
                flex-shrink: 0;
                width: 28px;
                text-align: center;
            }

            .wm-action-content {
                flex: 1;
                min-width: 0;
            }

            .wm-action-title {
                font-size: 14px;
                font-weight: 600;
                color: var(--text-primary, #e4e4e7);
            }

            .wm-action-detail {
                font-size: 12px;
                color: var(--text-secondary, #71717a);
                margin-top: 2px;
            }

            .wm-action-arrow {
                font-size: 18px;
                color: var(--text-secondary, #71717a);
                flex-shrink: 0;
            }

            /* --- Tab Bar --- */
            .wm-tab-bar {
                display: flex;
                gap: 4px;
                margin-bottom: 20px;
                background: var(--bg-secondary, #1c1c21);
                border-radius: 10px;
                padding: 4px;
            }

            .wm-tab-btn {
                flex: 1;
                padding: 10px 16px;
                border: none;
                background: transparent;
                color: var(--text-secondary, #71717a);
                font-size: 14px;
                font-weight: 600;
                font-family: inherit;
                cursor: pointer;
                border-radius: 8px;
                transition: all 0.2s;
            }

            .wm-tab-btn.active {
                background: var(--accent-primary, #6366f1);
                color: #fff;
            }

            .wm-tab-btn:hover:not(.active) {
                background: var(--bg-primary, #0f0f12);
                color: var(--text-primary, #e4e4e7);
            }

            /* --- Warranty & Maintenance Cards --- */
            .wm-card {
                background: var(--bg-secondary, #1c1c21);
                border: 1px solid var(--border-color, #2a2a32);
                border-radius: 10px;
                padding: 16px;
                margin-bottom: 12px;
                cursor: pointer;
                transition: border-color 0.15s, transform 0.1s;
            }

            .wm-card:hover {
                border-color: var(--accent-primary, #6366f1);
                transform: translateY(-1px);
            }

            .wm-card-header {
                display: flex;
                align-items: flex-start;
                justify-content: space-between;
                margin-bottom: 10px;
                gap: 8px;
            }

            .wm-card-title {
                font-size: 15px;
                font-weight: 600;
                color: var(--text-primary, #e4e4e7);
            }

            .wm-card-subtitle {
                font-size: 13px;
                color: var(--text-secondary, #71717a);
                margin-top: 2px;
            }

            .wm-card-meta {
                display: flex;
                flex-wrap: wrap;
                gap: 12px;
                font-size: 12px;
                color: var(--text-secondary, #71717a);
                margin-top: 8px;
            }

            .wm-card-meta span {
                display: flex;
                align-items: center;
                gap: 4px;
            }

            /* --- Status Badges --- */
            .wm-badge {
                display: inline-block;
                padding: 3px 10px;
                border-radius: 12px;
                font-size: 11px;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                white-space: nowrap;
            }

            .wm-badge-aktiv {
                background: #22c55e20;
                color: #22c55e;
                border: 1px solid #22c55e40;
            }

            .wm-badge-reklamation {
                background: #ef444420;
                color: #ef4444;
                border: 1px solid #ef444440;
            }

            .wm-badge-abgelaufen {
                background: #71717a20;
                color: #71717a;
                border: 1px solid #71717a40;
            }

            .wm-badge-offen {
                background: #f59e0b20;
                color: #f59e0b;
                border: 1px solid #f59e0b40;
            }

            .wm-badge-bearbeitet {
                background: #22c55e20;
                color: #22c55e;
                border: 1px solid #22c55e40;
            }

            .wm-badge-abgelehnt {
                background: #71717a20;
                color: #71717a;
                border: 1px solid #71717a40;
            }

            .wm-badge-pausiert {
                background: #f59e0b20;
                color: #f59e0b;
                border: 1px solid #f59e0b40;
            }

            .wm-badge-gekuendigt {
                background: #ef444420;
                color: #ef4444;
                border: 1px solid #ef444440;
            }

            .wm-badge-green {
                background: #22c55e20;
                color: #22c55e;
            }

            .wm-badge-amber {
                background: #f59e0b20;
                color: #f59e0b;
            }

            .wm-badge-red {
                background: #ef444420;
                color: #ef4444;
            }

            /* --- Progress Bar (Warranty Timeline) --- */
            .wm-progress-container {
                margin-top: 10px;
            }

            .wm-progress-labels {
                display: flex;
                justify-content: space-between;
                font-size: 11px;
                color: var(--text-secondary, #71717a);
                margin-bottom: 4px;
            }

            .wm-progress-bar {
                width: 100%;
                height: 8px;
                background: var(--bg-primary, #0f0f12);
                border-radius: 4px;
                overflow: hidden;
                position: relative;
            }

            .wm-progress-fill {
                height: 100%;
                border-radius: 4px;
                transition: width 0.4s ease;
            }

            .wm-progress-fill.green { background: #22c55e; }
            .wm-progress-fill.amber { background: #f59e0b; }
            .wm-progress-fill.red { background: #ef4444; }

            .wm-remaining-text {
                font-size: 12px;
                font-weight: 600;
                margin-top: 4px;
            }

            .wm-remaining-text.green { color: #22c55e; }
            .wm-remaining-text.amber { color: #f59e0b; }
            .wm-remaining-text.red { color: #ef4444; }

            /* --- Timeline (Detail View) --- */
            .wm-timeline {
                display: flex;
                align-items: center;
                gap: 0;
                margin: 20px 0;
                padding: 16px;
                background: var(--bg-primary, #0f0f12);
                border-radius: 10px;
                border: 1px solid var(--border-color, #2a2a32);
                overflow-x: auto;
            }

            .wm-timeline-point {
                display: flex;
                flex-direction: column;
                align-items: center;
                min-width: 100px;
                flex-shrink: 0;
            }

            .wm-timeline-dot {
                width: 14px;
                height: 14px;
                border-radius: 50%;
                border: 3px solid;
                margin-bottom: 6px;
            }

            .wm-timeline-dot.past { border-color: #22c55e; background: #22c55e; }
            .wm-timeline-dot.current { border-color: #6366f1; background: #6366f1; box-shadow: 0 0 8px #6366f180; }
            .wm-timeline-dot.future { border-color: var(--border-color, #2a2a32); background: transparent; }

            .wm-timeline-label {
                font-size: 11px;
                color: var(--text-secondary, #71717a);
                text-align: center;
            }

            .wm-timeline-date {
                font-size: 12px;
                font-weight: 600;
                color: var(--text-primary, #e4e4e7);
                text-align: center;
            }

            .wm-timeline-line {
                flex: 1;
                height: 3px;
                min-width: 30px;
                background: var(--border-color, #2a2a32);
                margin-bottom: 24px;
            }

            .wm-timeline-line.filled { background: #22c55e; }

            /* --- Filter Bar --- */
            .wm-filter-bar {
                display: flex;
                gap: 8px;
                margin-bottom: 16px;
                flex-wrap: wrap;
            }

            .wm-filter-btn {
                padding: 6px 14px;
                border: 1px solid var(--border-color, #2a2a32);
                border-radius: 20px;
                background: transparent;
                color: var(--text-secondary, #71717a);
                font-size: 13px;
                font-family: inherit;
                cursor: pointer;
                transition: all 0.15s;
            }

            .wm-filter-btn.active {
                background: var(--accent-primary, #6366f1);
                color: #fff;
                border-color: var(--accent-primary, #6366f1);
            }

            .wm-filter-btn:hover:not(.active) {
                border-color: var(--text-secondary, #71717a);
                color: var(--text-primary, #e4e4e7);
            }

            /* --- Buttons --- */
            .wm-btn {
                display: inline-flex;
                align-items: center;
                gap: 6px;
                padding: 10px 20px;
                border: none;
                border-radius: 8px;
                font-size: 14px;
                font-weight: 600;
                font-family: inherit;
                cursor: pointer;
                transition: all 0.15s;
            }

            .wm-btn-primary {
                background: var(--accent-primary, #6366f1);
                color: #fff;
            }

            .wm-btn-primary:hover {
                opacity: 0.9;
                transform: translateY(-1px);
            }

            .wm-btn-success {
                background: #22c55e;
                color: #fff;
            }

            .wm-btn-success:hover {
                opacity: 0.9;
            }

            .wm-btn-danger {
                background: #ef4444;
                color: #fff;
            }

            .wm-btn-danger:hover {
                opacity: 0.9;
            }

            .wm-btn-outline {
                background: transparent;
                border: 1px solid var(--border-color, #2a2a32);
                color: var(--text-primary, #e4e4e7);
            }

            .wm-btn-outline:hover {
                background: var(--bg-secondary, #1c1c21);
            }

            .wm-btn-small {
                padding: 6px 12px;
                font-size: 12px;
            }

            /* --- Detail Section --- */
            .wm-detail-section {
                background: var(--bg-secondary, #1c1c21);
                border: 1px solid var(--border-color, #2a2a32);
                border-radius: 10px;
                padding: 20px;
                margin-bottom: 16px;
            }

            .wm-detail-section h3 {
                margin: 0 0 16px 0;
                font-size: 16px;
                font-weight: 600;
                color: var(--text-primary, #e4e4e7);
            }

            .wm-detail-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 12px;
            }

            .wm-detail-field {
                display: flex;
                flex-direction: column;
                gap: 2px;
            }

            .wm-detail-label {
                font-size: 11px;
                font-weight: 600;
                color: var(--text-secondary, #71717a);
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }

            .wm-detail-value {
                font-size: 14px;
                color: var(--text-primary, #e4e4e7);
            }

            /* --- Claims / History Table --- */
            .wm-table {
                width: 100%;
                border-collapse: collapse;
                margin-top: 12px;
            }

            .wm-table th {
                text-align: left;
                padding: 8px 12px;
                font-size: 11px;
                font-weight: 600;
                color: var(--text-secondary, #71717a);
                text-transform: uppercase;
                letter-spacing: 0.5px;
                border-bottom: 1px solid var(--border-color, #2a2a32);
            }

            .wm-table td {
                padding: 10px 12px;
                font-size: 13px;
                color: var(--text-primary, #e4e4e7);
                border-bottom: 1px solid var(--border-color, #2a2a32);
                vertical-align: top;
            }

            .wm-table tr:last-child td {
                border-bottom: none;
            }

            .wm-table tr:hover td {
                background: var(--bg-primary, #0f0f12);
            }

            /* --- Forms --- */
            .wm-form {
                display: flex;
                flex-direction: column;
                gap: 14px;
            }

            .wm-form-group {
                display: flex;
                flex-direction: column;
                gap: 4px;
            }

            .wm-form-group label {
                font-size: 13px;
                font-weight: 600;
                color: var(--text-secondary, #71717a);
            }

            .wm-form-group input,
            .wm-form-group select,
            .wm-form-group textarea {
                padding: 10px 12px;
                background: var(--bg-primary, #0f0f12);
                border: 1px solid var(--border-color, #2a2a32);
                border-radius: 8px;
                color: var(--text-primary, #e4e4e7);
                font-size: 14px;
                font-family: inherit;
                transition: border-color 0.15s;
            }

            .wm-form-group input:focus,
            .wm-form-group select:focus,
            .wm-form-group textarea:focus {
                outline: none;
                border-color: var(--accent-primary, #6366f1);
            }

            .wm-form-group textarea {
                min-height: 80px;
                resize: vertical;
            }

            .wm-form-row {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 12px;
            }

            .wm-form-actions {
                display: flex;
                gap: 10px;
                margin-top: 8px;
                flex-wrap: wrap;
            }

            /* --- Parts List (Maintenance Log) --- */
            .wm-parts-list {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }

            .wm-parts-row {
                display: grid;
                grid-template-columns: 2fr 1fr auto;
                gap: 8px;
                align-items: end;
            }

            .wm-parts-row input {
                padding: 8px 10px;
                background: var(--bg-primary, #0f0f12);
                border: 1px solid var(--border-color, #2a2a32);
                border-radius: 6px;
                color: var(--text-primary, #e4e4e7);
                font-size: 13px;
                font-family: inherit;
            }

            .wm-parts-row input:focus {
                outline: none;
                border-color: var(--accent-primary, #6366f1);
            }

            .wm-parts-remove {
                background: #ef444430;
                color: #ef4444;
                border: none;
                border-radius: 6px;
                width: 36px;
                height: 36px;
                cursor: pointer;
                font-size: 16px;
                transition: background 0.15s;
            }

            .wm-parts-remove:hover {
                background: #ef444450;
            }

            /* --- Modal Overlay --- */
            .wm-modal-overlay {
                position: fixed;
                inset: 0;
                background: rgba(0, 0, 0, 0.6);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 1000;
                animation: wm-fade-in 0.2s ease;
                padding: 20px;
            }

            .wm-modal {
                background: var(--bg-secondary, #1c1c21);
                border: 1px solid var(--border-color, #2a2a32);
                border-radius: 12px;
                padding: 24px;
                width: 100%;
                max-width: 600px;
                max-height: 90vh;
                overflow-y: auto;
            }

            .wm-modal h3 {
                margin: 0 0 20px 0;
                font-size: 18px;
                font-weight: 700;
                color: var(--text-primary, #e4e4e7);
            }

            @keyframes wm-fade-in {
                from { opacity: 0; }
                to { opacity: 1; }
            }

            /* --- Empty State --- */
            .wm-empty {
                text-align: center;
                padding: 40px 20px;
                color: var(--text-secondary, #71717a);
            }

            .wm-empty-icon {
                font-size: 48px;
                margin-bottom: 12px;
            }

            .wm-empty-text {
                font-size: 15px;
            }

            /* --- Urgency indicators for maintenance cards --- */
            .wm-card.urgency-green { border-left: 4px solid #22c55e; }
            .wm-card.urgency-amber { border-left: 4px solid #f59e0b; }
            .wm-card.urgency-red { border-left: 4px solid #ef4444; }

            /* --- Responsive --- */
            @media (max-width: 600px) {
                .wm-summary-grid {
                    grid-template-columns: 1fr 1fr;
                }

                .wm-form-row {
                    grid-template-columns: 1fr;
                }

                .wm-header {
                    flex-direction: column;
                    align-items: flex-start;
                }

                .wm-tab-bar {
                    flex-direction: column;
                }

                .wm-timeline {
                    flex-direction: column;
                    align-items: stretch;
                }

                .wm-timeline-line {
                    width: 3px;
                    height: 20px;
                    min-width: unset;
                    margin: 0 auto;
                    margin-bottom: 0;
                }

                .wm-detail-grid {
                    grid-template-columns: 1fr;
                }

                .wm-parts-row {
                    grid-template-columns: 1fr;
                }
            }
        `;

        document.head.appendChild(style);
    }

    /* =======================================================
       MAIN RENDER
       ======================================================= */

    render() {
        const container = document.getElementById(this.containerId);
        if (!container) { return; }

        switch (this.currentView) {
            case 'dashboard':
                container.innerHTML = this._renderDashboard();
                break;
            case 'warranty-list':
                container.innerHTML = this._renderWarrantyList();
                break;
            case 'warranty-detail':
                container.innerHTML = this._renderWarrantyDetail();
                break;
            case 'maintenance-list':
                container.innerHTML = this._renderMaintenanceList();
                break;
            case 'maintenance-detail':
                container.innerHTML = this._renderMaintenanceDetail();
                break;
            default:
                container.innerHTML = this._renderDashboard();
        }

        this._attachEventListeners();
    }

    /**
     * Navigate to a specific view
     */
    navigateTo(view, data) {
        this.currentView = view;
        if (data && data.warrantyId) { this.currentWarrantyId = data.warrantyId; }
        if (data && data.contractId) { this.currentContractId = data.contractId; }
        this.render();
    }

    /* =======================================================
       DASHBOARD VIEW
       ======================================================= */

    _renderDashboard() {
        const wStats = this.service.getWarrantyStats();
        const mStats = this.service.getMaintenanceStats();
        const actions = this.service.getUpcomingActions();

        const urgentActions = actions.filter(a => a.severity === 'urgent');
        const warningActions = actions.filter(a => a.severity === 'warning');
        const infoActions = actions.filter(a => a.severity === 'info');

        let html = '<div class="wm-container">';

        // Header
        html += '<div class="wm-header">';
        html += '<h2>Gewaehrleistung & Wartung</h2>';
        html += '</div>';

        // Summary cards
        html += '<div class="wm-summary-grid">';
        html += this._renderSummaryCard(wStats.active, 'Aktive Gewaehrleistungen', 'accent-green');
        html += this._renderSummaryCard(wStats.expiringSoon, 'Ablaufend (90 Tage)', 'accent-amber');
        html += this._renderSummaryCard(mStats.overdue + mStats.dueSoon, 'Faellige Wartungen', mStats.overdue > 0 ? 'accent-red' : 'accent-amber');
        html += this._renderSummaryCard(mStats.activeContracts, 'Wartungsvertraege', 'accent-blue');
        html += '</div>';

        // Handlungsbedarf section
        if (urgentActions.length > 0 || warningActions.length > 0 || infoActions.length > 0) {
            html += '<div class="wm-actions-section">';
            html += '<div class="wm-actions-title">Handlungsbedarf</div>';

            // Red: urgent items
            urgentActions.forEach(a => {
                const icon = a.type.includes('maintenance') ? '\u{1F527}' : '\u{1F6A8}';
                html += this._renderActionItem(a, icon, 'urgent');
            });

            // Amber: warning items
            warningActions.forEach(a => {
                const icon = a.type.includes('maintenance') ? '\u{23F0}' : '\u{26A0}\u{FE0F}';
                html += this._renderActionItem(a, icon, 'warning');
            });

            // Blue: info items
            infoActions.slice(0, 5).forEach(a => {
                const icon = a.type.includes('maintenance') ? '\u{1F4C5}' : '\u{1F4CB}';
                html += this._renderActionItem(a, icon, 'info');
            });

            html += '</div>';
        }

        // Tabs: Gewährleistung | Wartung
        html += this._renderTabBar();

        // Tab content
        if (this.currentTab === 'gewaehrleistung') {
            html += this._renderWarrantyListContent(5);
            html += '<div style="text-align:center; margin-top:12px;">';
            html += '<button class="wm-btn wm-btn-outline" data-action="show-all-warranties">Alle Gewaehrleistungen anzeigen</button>';
            html += '</div>';
        } else {
            html += this._renderMaintenanceListContent(5);
            html += '<div style="text-align:center; margin-top:12px;">';
            html += '<button class="wm-btn wm-btn-outline" data-action="show-all-maintenance">Alle Wartungsvertraege anzeigen</button>';
            html += '</div>';
        }

        html += '</div>';
        return html;
    }

    _renderSummaryCard(number, label, accentClass) {
        return '<div class="wm-summary-card ' + accentClass + '">' +
               '<div class="wm-summary-number">' + number + '</div>' +
               '<div class="wm-summary-label">' + _esc(label) + '</div>' +
               '</div>';
    }

    _renderActionItem(action, icon, severity) {
        const dataType = action.type.includes('maintenance') ? 'maintenance' : 'warranty';
        return '<div class="wm-action-item severity-' + severity + '" ' +
               'data-action="open-action" data-type="' + dataType + '" data-id="' + _esc(action.id) + '">' +
               '<div class="wm-action-icon">' + icon + '</div>' +
               '<div class="wm-action-content">' +
               '<div class="wm-action-title">' + _esc(action.title) + '</div>' +
               '<div class="wm-action-detail">' + _esc(action.detail) + '</div>' +
               '</div>' +
               '<div class="wm-action-arrow">\u203A</div>' +
               '</div>';
    }

    _renderTabBar() {
        return '<div class="wm-tab-bar">' +
               '<button class="wm-tab-btn' + (this.currentTab === 'gewaehrleistung' ? ' active' : '') + '" data-tab="gewaehrleistung">Gewaehrleistung</button>' +
               '<button class="wm-tab-btn' + (this.currentTab === 'wartung' ? ' active' : '') + '" data-tab="wartung">Wartung</button>' +
               '</div>';
    }

    /* =======================================================
       WARRANTY LIST VIEW
       ======================================================= */

    _renderWarrantyList() {
        let html = '<div class="wm-container">';

        // Header with back button
        html += '<div class="wm-header">';
        html += '<div>';
        html += '<button class="wm-back-btn" data-action="back-to-dashboard">\u2190 Zurueck</button>';
        html += ' <span style="font-size:18px; font-weight:700; color:var(--text-primary, #e4e4e7); margin-left:12px;">Gewaehrleistungen</span>';
        html += '</div>';
        html += '<button class="wm-btn wm-btn-primary" data-action="new-warranty">+ Neue Gewaehrleistung</button>';
        html += '</div>';

        // Filter bar
        html += '<div class="wm-filter-bar">';
        ['alle', 'aktiv', 'ablaufend', 'abgelaufen'].forEach(filter => {
            const labels = { alle: 'Alle', aktiv: 'Aktiv', ablaufend: 'Ablaufend', abgelaufen: 'Abgelaufen' };
            html += '<button class="wm-filter-btn' + (this.warrantyFilter === filter ? ' active' : '') + '" data-filter="' + filter + '">' + labels[filter] + '</button>';
        });
        html += '</div>';

        // Warranty cards
        html += this._renderWarrantyListContent();

        html += '</div>';
        return html;
    }

    _renderWarrantyListContent(limit) {
        const today = this.service._today();
        let warranties = this.service.getWarranties();

        // Apply filter
        if (this.warrantyFilter === 'aktiv') {
            warranties = warranties.filter(w => w.status === 'aktiv' && w.warrantyEndDate >= today);
        } else if (this.warrantyFilter === 'ablaufend') {
            const cutoff90 = this.service._addDays(today, 90);
            warranties = warranties.filter(w => w.status === 'aktiv' && w.warrantyEndDate >= today && w.warrantyEndDate <= cutoff90);
        } else if (this.warrantyFilter === 'abgelaufen') {
            warranties = warranties.filter(w => w.status === 'abgelaufen' || (w.status === 'aktiv' && w.warrantyEndDate < today));
        }

        if (limit) {
            warranties = warranties.slice(0, limit);
        }

        if (warranties.length === 0) {
            return '<div class="wm-empty">' +
                   '<div class="wm-empty-icon">\u{1F6E1}\u{FE0F}</div>' +
                   '<div class="wm-empty-text">Keine Gewaehrleistungen vorhanden</div>' +
                   '</div>';
        }

        let html = '';
        warranties.forEach(w => {
            html += this._renderWarrantyCard(w);
        });

        return html;
    }

    _renderWarrantyCard(w) {
        const today = this.service._today();
        const progress = this._calcWarrantyProgress(w);
        const remaining = this._calcRemainingText(w);
        const progressColor = progress.percentage >= 90 ? 'red' : (progress.percentage >= 70 ? 'amber' : 'green');

        const badgeClass = 'wm-badge-' + w.status;
        const statusLabels = { aktiv: 'Aktiv', reklamation: 'Reklamation', abgelaufen: 'Abgelaufen' };
        const statusLabel = statusLabels[w.status] || w.status;

        let html = '<div class="wm-card" data-action="open-warranty" data-id="' + _esc(w.id) + '">';

        html += '<div class="wm-card-header">';
        html += '<div>';
        html += '<div class="wm-card-title">' + _esc(w.orderName || w.category || 'Gewaehrleistung') + '</div>';
        html += '<div class="wm-card-subtitle">' + _esc(w.customerName) + '</div>';
        html += '</div>';
        html += '<span class="wm-badge ' + badgeClass + '">' + _esc(statusLabel) + '</span>';
        html += '</div>';

        html += '<div class="wm-card-meta">';
        html += '<span>\u{1F4C5} Abnahme: ' + _esc(this.service._formatDateDE(w.completionDate)) + '</span>';
        html += '<span>\u{23F3} Ablauf: ' + _esc(this.service._formatDateDE(w.warrantyEndDate)) + '</span>';
        html += '<span>\u{1F4DC} ' + _esc(w.contractBasis) + '</span>';
        html += '</div>';

        // Progress bar
        if (w.status !== 'abgelaufen') {
            html += '<div class="wm-progress-container">';
            html += '<div class="wm-progress-labels">';
            html += '<span>' + _esc(this.service._formatDateDE(w.completionDate)) + '</span>';
            html += '<span>' + _esc(this.service._formatDateDE(w.warrantyEndDate)) + '</span>';
            html += '</div>';
            html += '<div class="wm-progress-bar">';
            html += '<div class="wm-progress-fill ' + progressColor + '" style="width:' + Math.min(progress.percentage, 100) + '%"></div>';
            html += '</div>';
            html += '<div class="wm-remaining-text ' + progressColor + '">' + _esc(remaining) + '</div>';
            html += '</div>';
        }

        html += '</div>';
        return html;
    }

    /* =======================================================
       WARRANTY DETAIL VIEW
       ======================================================= */

    _renderWarrantyDetail() {
        const w = this.service.getWarranty(this.currentWarrantyId);
        if (!w) {
            return '<div class="wm-container"><div class="wm-empty"><div class="wm-empty-text">Gewaehrleistung nicht gefunden</div></div></div>';
        }

        let html = '<div class="wm-container">';

        // Header
        html += '<div class="wm-header">';
        html += '<div>';
        html += '<button class="wm-back-btn" data-action="back-to-warranty-list">\u2190 Zurueck</button>';
        html += ' <span style="font-size:18px; font-weight:700; color:var(--text-primary, #e4e4e7); margin-left:12px;">' + _esc(w.orderName || w.category || 'Gewaehrleistung') + '</span>';
        html += '</div>';
        const statusLabels = { aktiv: 'Aktiv', reklamation: 'Reklamation', abgelaufen: 'Abgelaufen' };
        html += '<span class="wm-badge wm-badge-' + w.status + '">' + _esc(statusLabels[w.status] || w.status) + '</span>';
        html += '</div>';

        // Customer & Job Info
        html += '<div class="wm-detail-section">';
        html += '<h3>Details</h3>';
        html += '<div class="wm-detail-grid">';
        html += this._renderDetailField('Kunde', w.customerName);
        html += this._renderDetailField('Adresse', w.address);
        html += this._renderDetailField('Telefon', w.customerPhone);
        html += this._renderDetailField('E-Mail', w.customerEmail);
        html += this._renderDetailField('Auftrag', w.orderName);
        html += this._renderDetailField('Kategorie', w.category);
        html += this._renderDetailField('Vertragsbasis', w.contractBasis === 'BGB' ? 'BGB (5 Jahre)' : 'VOB/B (4 Jahre)');
        html += this._renderDetailField('Typ', this._typeLabel(w.type));
        html += '</div>';
        if (w.description) {
            html += '<div style="margin-top:12px;">';
            html += this._renderDetailField('Beschreibung', w.description);
            html += '</div>';
        }
        html += '</div>';

        // Timeline
        html += this._renderWarrantyTimeline(w);

        // Claims section
        html += '<div class="wm-detail-section">';
        html += '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">';
        html += '<h3 style="margin:0;">Reklamationen (' + w.claims.length + ')</h3>';
        html += '<button class="wm-btn wm-btn-danger wm-btn-small" data-action="add-claim" data-warranty-id="' + _esc(w.id) + '">+ Reklamation melden</button>';
        html += '</div>';

        if (w.claims.length === 0) {
            html += '<div style="text-align:center; color:var(--text-secondary, #71717a); padding:16px;">Keine Reklamationen vorhanden</div>';
        } else {
            html += '<table class="wm-table">';
            html += '<thead><tr><th>Datum</th><th>Beschreibung</th><th>Kosten</th><th>Status</th><th></th></tr></thead>';
            html += '<tbody>';
            w.claims.forEach(claim => {
                const claimStatusLabels = { offen: 'Offen', bearbeitet: 'Bearbeitet', abgelehnt: 'Abgelehnt' };
                html += '<tr>';
                html += '<td>' + _esc(this.service._formatDateDE(claim.date)) + '</td>';
                html += '<td>' + _esc(claim.description) + '</td>';
                html += '<td>' + this._formatCurrency(claim.cost) + '</td>';
                html += '<td><span class="wm-badge wm-badge-' + claim.status + '">' + _esc(claimStatusLabels[claim.status] || claim.status) + '</span></td>';
                html += '<td><button class="wm-btn wm-btn-outline wm-btn-small" data-action="edit-claim" data-warranty-id="' + _esc(w.id) + '" data-claim-id="' + _esc(claim.id) + '">Bearbeiten</button></td>';
                html += '</tr>';
            });
            html += '</tbody></table>';
        }

        html += '</div>';

        html += '</div>';
        return html;
    }

    _renderWarrantyTimeline(w) {
        const today = this.service._today();
        const completionDate = w.completionDate;
        const endDate = w.warrantyEndDate;
        const isExpired = endDate < today;

        let html = '<div class="wm-timeline">';

        // Completion point
        html += '<div class="wm-timeline-point">';
        html += '<div class="wm-timeline-dot past"></div>';
        html += '<div class="wm-timeline-date">' + _esc(this.service._formatDateDE(completionDate)) + '</div>';
        html += '<div class="wm-timeline-label">Abnahme</div>';
        html += '</div>';

        html += '<div class="wm-timeline-line filled"></div>';

        // Today point
        if (!isExpired) {
            html += '<div class="wm-timeline-point">';
            html += '<div class="wm-timeline-dot current"></div>';
            html += '<div class="wm-timeline-date">' + _esc(this.service._formatDateDE(today)) + '</div>';
            html += '<div class="wm-timeline-label">Heute</div>';
            html += '</div>';

            html += '<div class="wm-timeline-line"></div>';
        }

        // End point
        html += '<div class="wm-timeline-point">';
        html += '<div class="wm-timeline-dot ' + (isExpired ? 'past' : 'future') + '"></div>';
        html += '<div class="wm-timeline-date">' + _esc(this.service._formatDateDE(endDate)) + '</div>';
        html += '<div class="wm-timeline-label">Ablauf (' + _esc(w.contractBasis) + ')</div>';
        html += '</div>';

        html += '</div>';
        return html;
    }

    /* =======================================================
       MAINTENANCE LIST VIEW
       ======================================================= */

    _renderMaintenanceList() {
        let html = '<div class="wm-container">';

        // Header
        html += '<div class="wm-header">';
        html += '<div>';
        html += '<button class="wm-back-btn" data-action="back-to-dashboard">\u2190 Zurueck</button>';
        html += ' <span style="font-size:18px; font-weight:700; color:var(--text-primary, #e4e4e7); margin-left:12px;">Wartungsvertraege</span>';
        html += '</div>';
        html += '<button class="wm-btn wm-btn-primary" data-action="new-maintenance">+ Neuer Wartungsvertrag</button>';
        html += '</div>';

        // Content
        html += this._renderMaintenanceListContent();

        html += '</div>';
        return html;
    }

    _renderMaintenanceListContent(limit) {
        const contracts = this.service.getMaintenanceContracts();
        const display = limit ? contracts.slice(0, limit) : contracts;

        if (display.length === 0) {
            return '<div class="wm-empty">' +
                   '<div class="wm-empty-icon">\u{1F527}</div>' +
                   '<div class="wm-empty-text">Keine Wartungsvertraege vorhanden</div>' +
                   '</div>';
        }

        let html = '';
        const today = this.service._today();

        display.forEach(c => {
            const urgency = this._getMaintenanceUrgency(c, today);
            const intervalLabels = {
                monatlich: 'Monatlich',
                quartalsweise: 'Quartalsweise',
                halbjaehrlich: 'Halbjaehrlich',
                jaehrlich: 'Jaehrlich'
            };

            html += '<div class="wm-card urgency-' + urgency + '" data-action="open-maintenance" data-id="' + _esc(c.id) + '">';

            html += '<div class="wm-card-header">';
            html += '<div>';
            html += '<div class="wm-card-title">' + _esc(c.name || 'Wartungsvertrag') + '</div>';
            html += '<div class="wm-card-subtitle">' + _esc(c.customerName) + '</div>';
            html += '</div>';
            const statusLabels = { aktiv: 'Aktiv', pausiert: 'Pausiert', gekuendigt: 'Gekuendigt' };
            const badgeClass = c.status === 'aktiv' ? 'wm-badge-aktiv' : (c.status === 'pausiert' ? 'wm-badge-pausiert' : 'wm-badge-gekuendigt');
            html += '<span class="wm-badge ' + badgeClass + '">' + _esc(statusLabels[c.status] || c.status) + '</span>';
            html += '</div>';

            html += '<div class="wm-card-meta">';
            html += '<span>\u{1F504} ' + _esc(intervalLabels[c.interval] || c.interval) + '</span>';
            html += '<span>\u{1F4C5} Naechster Termin: ' + _esc(this.service._formatDateDE(c.nextDueDate)) + '</span>';
            html += '<span>\u{1F4B6} ' + this._formatCurrency(c.flatRate) + ' / Einsatz</span>';
            html += '</div>';

            html += '</div>';
        });

        return html;
    }

    /* =======================================================
       MAINTENANCE DETAIL VIEW
       ======================================================= */

    _renderMaintenanceDetail() {
        const c = this.service.getMaintenanceContract(this.currentContractId);
        if (!c) {
            return '<div class="wm-container"><div class="wm-empty"><div class="wm-empty-text">Wartungsvertrag nicht gefunden</div></div></div>';
        }

        const today = this.service._today();
        const intervalLabels = {
            monatlich: 'Monatlich',
            quartalsweise: 'Quartalsweise',
            halbjaehrlich: 'Halbjaehrlich',
            jaehrlich: 'Jaehrlich'
        };

        let html = '<div class="wm-container">';

        // Header
        html += '<div class="wm-header">';
        html += '<div>';
        html += '<button class="wm-back-btn" data-action="back-to-maintenance-list">\u2190 Zurueck</button>';
        html += ' <span style="font-size:18px; font-weight:700; color:var(--text-primary, #e4e4e7); margin-left:12px;">' + _esc(c.name || 'Wartungsvertrag') + '</span>';
        html += '</div>';
        html += '<button class="wm-btn wm-btn-success" data-action="open-maintenance-log" data-id="' + _esc(c.id) + '">Wartung durchfuehren</button>';
        html += '</div>';

        // Contract info
        html += '<div class="wm-detail-section">';
        html += '<h3>Vertragsdetails</h3>';
        html += '<div class="wm-detail-grid">';
        html += this._renderDetailField('Kunde', c.customerName);
        html += this._renderDetailField('Telefon', c.customerPhone);
        html += this._renderDetailField('Adresse', c.address);
        html += this._renderDetailField('Intervall', intervalLabels[c.interval] || c.interval);
        html += this._renderDetailField('Naechster Termin', this.service._formatDateDE(c.nextDueDate));
        html += this._renderDetailField('Letzte Wartung', c.lastPerformedDate ? this.service._formatDateDE(c.lastPerformedDate) : 'Noch nicht durchgefuehrt');
        html += this._renderDetailField('Pauschale', this._formatCurrency(c.flatRate));
        html += this._renderDetailField('Teile inklusive bis', this._formatCurrency(c.includesPartsUpTo));
        html += '</div>';
        if (c.description) {
            html += '<div style="margin-top:12px;">';
            html += this._renderDetailField('Beschreibung', c.description);
            html += '</div>';
        }
        html += '</div>';

        // History section
        html += '<div class="wm-detail-section">';
        html += '<h3>Wartungshistorie (' + c.history.length + ')</h3>';

        if (c.history.length === 0) {
            html += '<div style="text-align:center; color:var(--text-secondary, #71717a); padding:16px;">Noch keine Wartungen durchgefuehrt</div>';
        } else {
            html += '<table class="wm-table">';
            html += '<thead><tr><th>Datum</th><th>Durchgefuehrt von</th><th>Bemerkungen</th><th>Teile</th><th>Kosten</th></tr></thead>';
            html += '<tbody>';

            // Show newest first
            [...c.history].reverse().forEach(entry => {
                const partsText = (entry.partsUsed || []).map(p => _esc(p.name) + ' (' + this._formatCurrency(p.cost) + ')').join(', ') || '-';
                html += '<tr>';
                html += '<td>' + _esc(this.service._formatDateDE(entry.date)) + '</td>';
                html += '<td>' + _esc(entry.performedBy || '-') + '</td>';
                html += '<td>' + _esc(entry.notes || '-') + '</td>';
                html += '<td>' + partsText + '</td>';
                html += '<td>' + this._formatCurrency(entry.totalCost) + '</td>';
                html += '</tr>';
            });

            html += '</tbody></table>';
        }

        html += '</div>';

        html += '</div>';
        return html;
    }

    /* =======================================================
       MODALS: Create/Edit Forms
       ======================================================= */

    _showNewWarrantyForm() {
        const overlay = document.createElement('div');
        overlay.className = 'wm-modal-overlay';
        overlay.id = 'wm-modal-overlay';

        overlay.innerHTML = '<div class="wm-modal">' +
            '<h3>Neue Gewaehrleistung erfassen</h3>' +
            '<div class="wm-form" id="wm-warranty-form">' +

            '<div class="wm-form-row">' +
            '<div class="wm-form-group">' +
            '<label for="wm-w-customerName">Kundenname *</label>' +
            '<input type="text" id="wm-w-customerName" placeholder="z.B. Familie Mueller">' +
            '</div>' +
            '<div class="wm-form-group">' +
            '<label for="wm-w-customerPhone">Telefon</label>' +
            '<input type="tel" id="wm-w-customerPhone" placeholder="z.B. 0171 1234567">' +
            '</div>' +
            '</div>' +

            '<div class="wm-form-group">' +
            '<label for="wm-w-customerEmail">E-Mail</label>' +
            '<input type="email" id="wm-w-customerEmail" placeholder="z.B. mueller@email.de">' +
            '</div>' +

            '<div class="wm-form-group">' +
            '<label for="wm-w-address">Adresse</label>' +
            '<input type="text" id="wm-w-address" placeholder="z.B. Hauptstr. 12, 12345 Musterstadt">' +
            '</div>' +

            '<div class="wm-form-row">' +
            '<div class="wm-form-group">' +
            '<label for="wm-w-orderName">Auftragsbezeichnung *</label>' +
            '<input type="text" id="wm-w-orderName" placeholder="z.B. Heizungsinstallation">' +
            '</div>' +
            '<div class="wm-form-group">' +
            '<label for="wm-w-category">Kategorie</label>' +
            '<input type="text" id="wm-w-category" placeholder="z.B. Heizung, Bad, Dach">' +
            '</div>' +
            '</div>' +

            '<div class="wm-form-group">' +
            '<label for="wm-w-description">Beschreibung der Leistung</label>' +
            '<textarea id="wm-w-description" placeholder="Was wurde ausgefuehrt?"></textarea>' +
            '</div>' +

            '<div class="wm-form-row">' +
            '<div class="wm-form-group">' +
            '<label for="wm-w-completionDate">Abnahmedatum *</label>' +
            '<input type="date" id="wm-w-completionDate" value="' + this.service._today() + '">' +
            '</div>' +
            '<div class="wm-form-group">' +
            '<label for="wm-w-contractBasis">Vertragsbasis *</label>' +
            '<select id="wm-w-contractBasis">' +
            '<option value="BGB">BGB (5 Jahre)</option>' +
            '<option value="VOB">VOB/B (4 Jahre)</option>' +
            '</select>' +
            '</div>' +
            '</div>' +

            '<div class="wm-form-group">' +
            '<label for="wm-w-type">Art</label>' +
            '<select id="wm-w-type">' +
            '<option value="gewaehrleistung">Gewaehrleistung</option>' +
            '<option value="garantie">Garantie</option>' +
            '<option value="herstellergarantie">Herstellergarantie</option>' +
            '</select>' +
            '</div>' +

            '<div class="wm-form-actions">' +
            '<button class="wm-btn wm-btn-primary" data-action="save-warranty">Speichern</button>' +
            '<button class="wm-btn wm-btn-outline" data-action="cancel-modal">Abbrechen</button>' +
            '</div>' +
            '</div>' +
            '</div>';

        document.body.appendChild(overlay);

        // Close on backdrop click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) { this._closeModal(); }
        });

        this._attachModalListeners();
    }

    _showClaimForm(warrantyId) {
        const overlay = document.createElement('div');
        overlay.className = 'wm-modal-overlay';
        overlay.id = 'wm-modal-overlay';

        overlay.innerHTML = '<div class="wm-modal">' +
            '<h3>Reklamation melden</h3>' +
            '<div class="wm-form" id="wm-claim-form">' +

            '<div class="wm-form-group">' +
            '<label for="wm-c-date">Datum</label>' +
            '<input type="date" id="wm-c-date" value="' + this.service._today() + '">' +
            '</div>' +

            '<div class="wm-form-group">' +
            '<label for="wm-c-description">Beschreibung des Mangels *</label>' +
            '<textarea id="wm-c-description" placeholder="Was ist das Problem?"></textarea>' +
            '</div>' +

            '<div class="wm-form-group">' +
            '<label for="wm-c-resolution">Loesung / Massnahme</label>' +
            '<textarea id="wm-c-resolution" placeholder="Was wurde unternommen? (optional)"></textarea>' +
            '</div>' +

            '<div class="wm-form-row">' +
            '<div class="wm-form-group">' +
            '<label for="wm-c-cost">Kosten (EUR)</label>' +
            '<input type="number" id="wm-c-cost" value="0" min="0" step="0.01">' +
            '</div>' +
            '<div class="wm-form-group">' +
            '<label for="wm-c-status">Status</label>' +
            '<select id="wm-c-status">' +
            '<option value="offen">Offen</option>' +
            '<option value="bearbeitet">Bearbeitet</option>' +
            '<option value="abgelehnt">Abgelehnt</option>' +
            '</select>' +
            '</div>' +
            '</div>' +

            '<input type="hidden" id="wm-c-warrantyId" value="' + _esc(warrantyId) + '">' +

            '<div class="wm-form-actions">' +
            '<button class="wm-btn wm-btn-danger" data-action="save-claim">Reklamation speichern</button>' +
            '<button class="wm-btn wm-btn-outline" data-action="cancel-modal">Abbrechen</button>' +
            '</div>' +
            '</div>' +
            '</div>';

        document.body.appendChild(overlay);

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) { this._closeModal(); }
        });

        this._attachModalListeners();
    }

    _showEditClaimForm(warrantyId, claimId) {
        const w = this.service.getWarranty(warrantyId);
        if (!w) { return; }
        const claim = w.claims.find(c => c.id === claimId);
        if (!claim) { return; }

        const overlay = document.createElement('div');
        overlay.className = 'wm-modal-overlay';
        overlay.id = 'wm-modal-overlay';

        overlay.innerHTML = '<div class="wm-modal">' +
            '<h3>Reklamation bearbeiten</h3>' +
            '<div class="wm-form" id="wm-edit-claim-form">' +

            '<div class="wm-form-group">' +
            '<label for="wm-ec-date">Datum</label>' +
            '<input type="date" id="wm-ec-date" value="' + _esc(claim.date) + '">' +
            '</div>' +

            '<div class="wm-form-group">' +
            '<label for="wm-ec-description">Beschreibung des Mangels</label>' +
            '<textarea id="wm-ec-description">' + _esc(claim.description) + '</textarea>' +
            '</div>' +

            '<div class="wm-form-group">' +
            '<label for="wm-ec-resolution">Loesung / Massnahme</label>' +
            '<textarea id="wm-ec-resolution">' + _esc(claim.resolution) + '</textarea>' +
            '</div>' +

            '<div class="wm-form-row">' +
            '<div class="wm-form-group">' +
            '<label for="wm-ec-cost">Kosten (EUR)</label>' +
            '<input type="number" id="wm-ec-cost" value="' + (claim.cost || 0) + '" min="0" step="0.01">' +
            '</div>' +
            '<div class="wm-form-group">' +
            '<label for="wm-ec-status">Status</label>' +
            '<select id="wm-ec-status">' +
            '<option value="offen"' + (claim.status === 'offen' ? ' selected' : '') + '>Offen</option>' +
            '<option value="bearbeitet"' + (claim.status === 'bearbeitet' ? ' selected' : '') + '>Bearbeitet</option>' +
            '<option value="abgelehnt"' + (claim.status === 'abgelehnt' ? ' selected' : '') + '>Abgelehnt</option>' +
            '</select>' +
            '</div>' +
            '</div>' +

            '<input type="hidden" id="wm-ec-warrantyId" value="' + _esc(warrantyId) + '">' +
            '<input type="hidden" id="wm-ec-claimId" value="' + _esc(claimId) + '">' +

            '<div class="wm-form-actions">' +
            '<button class="wm-btn wm-btn-primary" data-action="update-claim">Speichern</button>' +
            '<button class="wm-btn wm-btn-outline" data-action="cancel-modal">Abbrechen</button>' +
            '</div>' +
            '</div>' +
            '</div>';

        document.body.appendChild(overlay);

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) { this._closeModal(); }
        });

        this._attachModalListeners();
    }

    _showNewMaintenanceForm() {
        const overlay = document.createElement('div');
        overlay.className = 'wm-modal-overlay';
        overlay.id = 'wm-modal-overlay';

        overlay.innerHTML = '<div class="wm-modal">' +
            '<h3>Neuer Wartungsvertrag</h3>' +
            '<div class="wm-form" id="wm-maintenance-form">' +

            '<div class="wm-form-row">' +
            '<div class="wm-form-group">' +
            '<label for="wm-m-customerName">Kundenname *</label>' +
            '<input type="text" id="wm-m-customerName" placeholder="z.B. Familie Mueller">' +
            '</div>' +
            '<div class="wm-form-group">' +
            '<label for="wm-m-customerPhone">Telefon</label>' +
            '<input type="tel" id="wm-m-customerPhone" placeholder="z.B. 0171 1234567">' +
            '</div>' +
            '</div>' +

            '<div class="wm-form-group">' +
            '<label for="wm-m-address">Adresse</label>' +
            '<input type="text" id="wm-m-address" placeholder="z.B. Hauptstr. 12, 12345 Musterstadt">' +
            '</div>' +

            '<div class="wm-form-row">' +
            '<div class="wm-form-group">' +
            '<label for="wm-m-name">Bezeichnung *</label>' +
            '<input type="text" id="wm-m-name" placeholder="z.B. Heizungswartung">' +
            '</div>' +
            '<div class="wm-form-group">' +
            '<label for="wm-m-interval">Intervall *</label>' +
            '<select id="wm-m-interval">' +
            '<option value="jaehrlich">Jaehrlich</option>' +
            '<option value="halbjaehrlich">Halbjaehrlich</option>' +
            '<option value="quartalsweise">Quartalsweise</option>' +
            '<option value="monatlich">Monatlich</option>' +
            '</select>' +
            '</div>' +
            '</div>' +

            '<div class="wm-form-group">' +
            '<label for="wm-m-description">Beschreibung</label>' +
            '<textarea id="wm-m-description" placeholder="Was wird bei der Wartung gemacht?"></textarea>' +
            '</div>' +

            '<div class="wm-form-row">' +
            '<div class="wm-form-group">' +
            '<label for="wm-m-flatRate">Pauschale (EUR) *</label>' +
            '<input type="number" id="wm-m-flatRate" value="0" min="0" step="0.01" placeholder="z.B. 250">' +
            '</div>' +
            '<div class="wm-form-group">' +
            '<label for="wm-m-includesPartsUpTo">Teile inklusive bis (EUR)</label>' +
            '<input type="number" id="wm-m-includesPartsUpTo" value="0" min="0" step="0.01" placeholder="z.B. 50">' +
            '</div>' +
            '</div>' +

            '<div class="wm-form-group">' +
            '<label for="wm-m-nextDueDate">Erster Wartungstermin</label>' +
            '<input type="date" id="wm-m-nextDueDate" value="' + this.service._today() + '">' +
            '</div>' +

            '<div class="wm-form-actions">' +
            '<button class="wm-btn wm-btn-primary" data-action="save-maintenance">Speichern</button>' +
            '<button class="wm-btn wm-btn-outline" data-action="cancel-modal">Abbrechen</button>' +
            '</div>' +
            '</div>' +
            '</div>';

        document.body.appendChild(overlay);

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) { this._closeModal(); }
        });

        this._attachModalListeners();
    }

    _showMaintenanceLogForm(contractId) {
        const c = this.service.getMaintenanceContract(contractId);
        if (!c) { return; }

        this.maintenanceLogParts = [];

        const overlay = document.createElement('div');
        overlay.className = 'wm-modal-overlay';
        overlay.id = 'wm-modal-overlay';

        // Check for team members if available
        let performedByField = '<input type="text" id="wm-l-performedBy" placeholder="Name des Mitarbeiters">';
        if (window.storeService?.state?.team && window.storeService.state.team.length > 0) {
            performedByField = '<select id="wm-l-performedBy">' +
                '<option value="">Bitte waehlen...</option>';
            window.storeService.state.team.forEach(member => {
                const name = member.name || member.vorname + ' ' + member.nachname;
                performedByField += '<option value="' + _esc(name) + '">' + _esc(name) + '</option>';
            });
            performedByField += '</select>';
        }

        overlay.innerHTML = '<div class="wm-modal">' +
            '<h3>Wartung durchfuehren: ' + _esc(c.name) + '</h3>' +
            '<div class="wm-form" id="wm-log-form">' +

            '<div class="wm-form-row">' +
            '<div class="wm-form-group">' +
            '<label for="wm-l-date">Datum</label>' +
            '<input type="date" id="wm-l-date" value="' + this.service._today() + '">' +
            '</div>' +
            '<div class="wm-form-group">' +
            '<label for="wm-l-performedBy">Durchgefuehrt von</label>' +
            performedByField +
            '</div>' +
            '</div>' +

            '<div class="wm-form-group">' +
            '<label for="wm-l-notes">Bemerkungen</label>' +
            '<textarea id="wm-l-notes" placeholder="Was wurde gemacht? Besonderheiten?"></textarea>' +
            '</div>' +

            '<div class="wm-form-group">' +
            '<label>Verwendete Teile</label>' +
            '<div class="wm-parts-list" id="wm-parts-list">' +
            '<div style="text-align:center; color:var(--text-secondary, #71717a); font-size:13px; padding:8px;">Keine Teile hinzugefuegt</div>' +
            '</div>' +
            '<button class="wm-btn wm-btn-outline wm-btn-small" data-action="add-part" style="margin-top:8px;">+ Teil hinzufuegen</button>' +
            '</div>' +

            '<div class="wm-form-group">' +
            '<label for="wm-l-totalCost">Gesamtkosten (EUR)</label>' +
            '<input type="number" id="wm-l-totalCost" value="' + (c.flatRate || 0) + '" min="0" step="0.01">' +
            '</div>' +

            '<input type="hidden" id="wm-l-contractId" value="' + _esc(contractId) + '">' +

            '<div class="wm-form-actions">' +
            '<button class="wm-btn wm-btn-success" data-action="save-maintenance-log">Abschliessen & Rechnung erstellen</button>' +
            '<button class="wm-btn wm-btn-outline" data-action="cancel-modal">Abbrechen</button>' +
            '</div>' +
            '</div>' +
            '</div>';

        document.body.appendChild(overlay);

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) { this._closeModal(); }
        });

        this._attachModalListeners();
    }

    _renderPartsRows() {
        const container = document.getElementById('wm-parts-list');
        if (!container) { return; }

        if (this.maintenanceLogParts.length === 0) {
            container.innerHTML = '<div style="text-align:center; color:var(--text-secondary, #71717a); font-size:13px; padding:8px;">Keine Teile hinzugefuegt</div>';
            return;
        }

        let html = '';
        this.maintenanceLogParts.forEach((part, index) => {
            html += '<div class="wm-parts-row">' +
                '<input type="text" placeholder="Bezeichnung" value="' + _esc(part.name) + '" data-part-index="' + index + '" data-part-field="name">' +
                '<input type="number" placeholder="Kosten" value="' + (part.cost || 0) + '" min="0" step="0.01" data-part-index="' + index + '" data-part-field="cost">' +
                '<button class="wm-parts-remove" data-action="remove-part" data-part-index="' + index + '">\u2716</button>' +
                '</div>';
        });

        container.innerHTML = html;

        // Re-attach part field change listeners
        container.querySelectorAll('input[data-part-index]').forEach(input => {
            input.addEventListener('change', (e) => {
                const idx = parseInt(e.target.dataset.partIndex);
                const field = e.target.dataset.partField;
                if (this.maintenanceLogParts[idx]) {
                    if (field === 'cost') {
                        this.maintenanceLogParts[idx][field] = parseFloat(e.target.value) || 0;
                    } else {
                        this.maintenanceLogParts[idx][field] = e.target.value;
                    }
                }
            });
        });

        container.querySelectorAll('[data-action="remove-part"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.target.dataset.partIndex);
                this.maintenanceLogParts.splice(idx, 1);
                this._renderPartsRows();
            });
        });
    }

    _closeModal() {
        const overlay = document.getElementById('wm-modal-overlay');
        if (overlay) {
            overlay.style.animation = 'wm-fade-in 0.15s ease reverse';
            setTimeout(() => overlay.remove(), 150);
        }
    }

    /* =======================================================
       EVENT LISTENERS
       ======================================================= */

    _attachEventListeners() {
        const container = document.getElementById(this.containerId);
        if (!container) { return; }

        // Tab buttons
        container.querySelectorAll('.wm-tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.currentTab = e.target.dataset.tab === 'wartung' ? 'wartung' : 'gewaehrleistung';
                this.render();
            });
        });

        // Filter buttons (warranty)
        container.querySelectorAll('.wm-filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.warrantyFilter = e.target.dataset.filter || 'alle';
                this.render();
            });
        });

        // Action items (Handlungsbedarf clicks)
        container.querySelectorAll('[data-action="open-action"]').forEach(el => {
            el.addEventListener('click', () => {
                const type = el.dataset.type;
                const id = el.dataset.id;
                if (type === 'warranty') {
                    this.navigateTo('warranty-detail', { warrantyId: id });
                } else {
                    this.navigateTo('maintenance-detail', { contractId: id });
                }
            });
        });

        // Open warranty detail
        container.querySelectorAll('[data-action="open-warranty"]').forEach(el => {
            el.addEventListener('click', () => {
                this.navigateTo('warranty-detail', { warrantyId: el.dataset.id });
            });
        });

        // Open maintenance detail
        container.querySelectorAll('[data-action="open-maintenance"]').forEach(el => {
            el.addEventListener('click', () => {
                this.navigateTo('maintenance-detail', { contractId: el.dataset.id });
            });
        });

        // Navigation buttons
        container.querySelectorAll('[data-action="back-to-dashboard"]').forEach(el => {
            el.addEventListener('click', () => { this.navigateTo('dashboard'); });
        });
        container.querySelectorAll('[data-action="back-to-warranty-list"]').forEach(el => {
            el.addEventListener('click', () => { this.navigateTo('warranty-list'); });
        });
        container.querySelectorAll('[data-action="back-to-maintenance-list"]').forEach(el => {
            el.addEventListener('click', () => { this.navigateTo('maintenance-list'); });
        });

        // Show all buttons
        container.querySelectorAll('[data-action="show-all-warranties"]').forEach(el => {
            el.addEventListener('click', () => { this.navigateTo('warranty-list'); });
        });
        container.querySelectorAll('[data-action="show-all-maintenance"]').forEach(el => {
            el.addEventListener('click', () => { this.navigateTo('maintenance-list'); });
        });

        // New warranty / maintenance
        container.querySelectorAll('[data-action="new-warranty"]').forEach(el => {
            el.addEventListener('click', () => { this._showNewWarrantyForm(); });
        });
        container.querySelectorAll('[data-action="new-maintenance"]').forEach(el => {
            el.addEventListener('click', () => { this._showNewMaintenanceForm(); });
        });

        // Add claim
        container.querySelectorAll('[data-action="add-claim"]').forEach(el => {
            el.addEventListener('click', () => {
                this._showClaimForm(el.dataset.warrantyId);
            });
        });

        // Edit claim
        container.querySelectorAll('[data-action="edit-claim"]').forEach(el => {
            el.addEventListener('click', () => {
                this._showEditClaimForm(el.dataset.warrantyId, el.dataset.claimId);
            });
        });

        // Maintenance log
        container.querySelectorAll('[data-action="open-maintenance-log"]').forEach(el => {
            el.addEventListener('click', () => {
                this._showMaintenanceLogForm(el.dataset.id);
            });
        });
    }

    _attachModalListeners() {
        // Cancel
        document.querySelectorAll('[data-action="cancel-modal"]').forEach(el => {
            el.addEventListener('click', () => { this._closeModal(); });
        });

        // Save warranty
        document.querySelectorAll('[data-action="save-warranty"]').forEach(el => {
            el.addEventListener('click', () => { this._saveWarranty(); });
        });

        // Save claim
        document.querySelectorAll('[data-action="save-claim"]').forEach(el => {
            el.addEventListener('click', () => { this._saveClaim(); });
        });

        // Update claim
        document.querySelectorAll('[data-action="update-claim"]').forEach(el => {
            el.addEventListener('click', () => { this._updateClaimFromForm(); });
        });

        // Save maintenance contract
        document.querySelectorAll('[data-action="save-maintenance"]').forEach(el => {
            el.addEventListener('click', () => { this._saveMaintenanceContract(); });
        });

        // Add part
        document.querySelectorAll('[data-action="add-part"]').forEach(el => {
            el.addEventListener('click', () => {
                this.maintenanceLogParts.push({ name: '', cost: 0 });
                this._renderPartsRows();
            });
        });

        // Save maintenance log
        document.querySelectorAll('[data-action="save-maintenance-log"]').forEach(el => {
            el.addEventListener('click', () => { this._saveMaintenanceLog(); });
        });
    }

    /* =======================================================
       FORM SAVE HANDLERS
       ======================================================= */

    _saveWarranty() {
        const customerName = (document.getElementById('wm-w-customerName')?.value || '').trim();
        const orderName = (document.getElementById('wm-w-orderName')?.value || '').trim();
        const completionDate = document.getElementById('wm-w-completionDate')?.value || '';

        if (!customerName || !orderName || !completionDate) {
            alert('Bitte fuellen Sie alle Pflichtfelder aus (Kundenname, Auftragsbezeichnung, Abnahmedatum).');
            return;
        }

        this.service.createWarranty({
            customerName: customerName,
            customerPhone: (document.getElementById('wm-w-customerPhone')?.value || '').trim(),
            customerEmail: (document.getElementById('wm-w-customerEmail')?.value || '').trim(),
            address: (document.getElementById('wm-w-address')?.value || '').trim(),
            orderName: orderName,
            category: (document.getElementById('wm-w-category')?.value || '').trim(),
            description: (document.getElementById('wm-w-description')?.value || '').trim(),
            completionDate: completionDate,
            contractBasis: document.getElementById('wm-w-contractBasis')?.value || 'BGB',
            type: document.getElementById('wm-w-type')?.value || 'gewaehrleistung'
        });

        this._closeModal();
        this.render();
    }

    _saveClaim() {
        const description = (document.getElementById('wm-c-description')?.value || '').trim();
        if (!description) {
            alert('Bitte beschreiben Sie den Mangel.');
            return;
        }

        const warrantyId = document.getElementById('wm-c-warrantyId')?.value;
        const result = this.service.addClaim(warrantyId, {
            date: document.getElementById('wm-c-date')?.value || '',
            description: description,
            resolution: (document.getElementById('wm-c-resolution')?.value || '').trim(),
            cost: parseFloat(document.getElementById('wm-c-cost')?.value) || 0,
            status: document.getElementById('wm-c-status')?.value || 'offen'
        });

        if (!result.success) {
            alert(result.error || 'Fehler beim Speichern der Reklamation.');
            return;
        }

        this._closeModal();
        this.render();
    }

    _updateClaimFromForm() {
        const warrantyId = document.getElementById('wm-ec-warrantyId')?.value;
        const claimId = document.getElementById('wm-ec-claimId')?.value;

        const result = this.service.updateClaim(warrantyId, claimId, {
            date: document.getElementById('wm-ec-date')?.value || '',
            description: (document.getElementById('wm-ec-description')?.value || '').trim(),
            resolution: (document.getElementById('wm-ec-resolution')?.value || '').trim(),
            cost: parseFloat(document.getElementById('wm-ec-cost')?.value) || 0,
            status: document.getElementById('wm-ec-status')?.value || 'offen'
        });

        if (!result.success) {
            alert(result.error || 'Fehler beim Aktualisieren.');
            return;
        }

        this._closeModal();
        this.render();
    }

    _saveMaintenanceContract() {
        const customerName = (document.getElementById('wm-m-customerName')?.value || '').trim();
        const name = (document.getElementById('wm-m-name')?.value || '').trim();

        if (!customerName || !name) {
            alert('Bitte fuellen Sie alle Pflichtfelder aus (Kundenname, Bezeichnung).');
            return;
        }

        this.service.createMaintenanceContract({
            customerName: customerName,
            customerPhone: (document.getElementById('wm-m-customerPhone')?.value || '').trim(),
            address: (document.getElementById('wm-m-address')?.value || '').trim(),
            name: name,
            description: (document.getElementById('wm-m-description')?.value || '').trim(),
            interval: document.getElementById('wm-m-interval')?.value || 'jaehrlich',
            flatRate: parseFloat(document.getElementById('wm-m-flatRate')?.value) || 0,
            includesPartsUpTo: parseFloat(document.getElementById('wm-m-includesPartsUpTo')?.value) || 0,
            nextDueDate: document.getElementById('wm-m-nextDueDate')?.value || ''
        });

        this._closeModal();
        this.render();
    }

    _saveMaintenanceLog() {
        const contractId = document.getElementById('wm-l-contractId')?.value;

        // Collect current part values from the DOM before saving
        document.querySelectorAll('#wm-parts-list input[data-part-index]').forEach(input => {
            const idx = parseInt(input.dataset.partIndex);
            const field = input.dataset.partField;
            if (this.maintenanceLogParts[idx]) {
                if (field === 'cost') {
                    this.maintenanceLogParts[idx][field] = parseFloat(input.value) || 0;
                } else {
                    this.maintenanceLogParts[idx][field] = input.value;
                }
            }
        });

        const result = this.service.logMaintenance(contractId, {
            date: document.getElementById('wm-l-date')?.value || '',
            performedBy: document.getElementById('wm-l-performedBy')?.value || '',
            notes: (document.getElementById('wm-l-notes')?.value || '').trim(),
            partsUsed: this.maintenanceLogParts.filter(p => p.name),
            totalCost: parseFloat(document.getElementById('wm-l-totalCost')?.value) || 0
        });

        if (!result.success) {
            alert(result.error || 'Fehler beim Speichern.');
            return;
        }

        this._closeModal();

        // Link to invoice creation if available
        if (window.navigationController) {
            const goToInvoice = confirm('Wartung gespeichert! Moechten Sie jetzt eine Rechnung erstellen?');
            if (goToInvoice) {
                window.navigationController.navigateTo('rechnungen');
                return;
            }
        }

        this.render();
    }

    /* =======================================================
       HELPER METHODS
       ======================================================= */

    _renderDetailField(label, value) {
        return '<div class="wm-detail-field">' +
               '<div class="wm-detail-label">' + _esc(label) + '</div>' +
               '<div class="wm-detail-value">' + _esc(value || '-') + '</div>' +
               '</div>';
    }

    _calcWarrantyProgress(w) {
        const start = new Date(w.completionDate + 'T00:00:00').getTime();
        const end = new Date(w.warrantyEndDate + 'T00:00:00').getTime();
        const now = Date.now();

        const total = end - start;
        const elapsed = now - start;

        if (total <= 0) { return { percentage: 100 }; }
        if (elapsed <= 0) { return { percentage: 0 }; }

        return {
            percentage: Math.round((elapsed / total) * 100)
        };
    }

    _calcRemainingText(w) {
        const end = new Date(w.warrantyEndDate + 'T00:00:00');
        const now = new Date();
        now.setHours(0, 0, 0, 0);

        const diffMs = end - now;
        if (diffMs <= 0) { return 'Abgelaufen'; }

        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays > 365) {
            const years = Math.floor(diffDays / 365);
            const months = Math.floor((diffDays % 365) / 30);
            return years + ' Jahr' + (years > 1 ? 'e' : '') + (months > 0 ? ', ' + months + ' Monat' + (months > 1 ? 'e' : '') : '') + ' verbleibend';
        } else if (diffDays > 30) {
            const months = Math.floor(diffDays / 30);
            return months + ' Monat' + (months > 1 ? 'e' : '') + ' verbleibend';
        } else {
            return diffDays + ' Tag' + (diffDays > 1 ? 'e' : '') + ' verbleibend';
        }
    }

    _getMaintenanceUrgency(contract, today) {
        if (!contract.nextDueDate || contract.status !== 'aktiv') { return 'green'; }

        if (contract.nextDueDate < today) {
            return 'red';
        }

        const weekCutoff = this.service._addDays(today, 7);
        if (contract.nextDueDate <= weekCutoff) {
            return 'amber';
        }

        return 'green';
    }

    _typeLabel(type) {
        const labels = {
            gewaehrleistung: 'Gewaehrleistung',
            garantie: 'Garantie',
            herstellergarantie: 'Herstellergarantie'
        };
        return labels[type] || type || '-';
    }

    _formatCurrency(amount) {
        return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount || 0);
    }
}

/* =======================================================
   XSS ESCAPE HELPER (global, matches _esc convention)
   ======================================================= */
function _esc(str) {
    if (!str) { return ''; }
    const el = document.createElement('span');
    el.textContent = String(str);
    return el.innerHTML;
}

// Initialize as global singleton
window.warrantyMaintenanceUI = new WarrantyMaintenanceUI();
