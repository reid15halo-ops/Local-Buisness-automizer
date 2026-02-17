/* ============================================
   Team & Subcontractor UI
   Mitarbeiter-Übersicht, Detailansicht,
   Zeiterfassung, Warnungen
   ============================================ */

class TeamUI {
    constructor() {
        this.currentView = 'overview'; // overview | detail | timelog | alerts
        this.currentMemberId = null;
        this.filterType = 'alle'; // alle | intern | subunternehmer
        this.container = null;
        this.initCSS();
    }

    // ============================================
    // CSS Injection
    // ============================================

    initCSS() {
        if (document.getElementById('team-ui-styles')) { return; }

        const style = document.createElement('style');
        style.id = 'team-ui-styles';
        style.textContent = `
            /* ========== Team Container ========== */
            .team-container {
                padding: 16px;
                max-width: 1200px;
                margin: 0 auto;
            }

            .team-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                flex-wrap: wrap;
                gap: 12px;
                margin-bottom: 20px;
            }

            .team-header h2 {
                font-size: 22px;
                font-weight: 700;
                color: var(--text-primary);
                margin: 0;
            }

            .team-header-actions {
                display: flex;
                gap: 8px;
                flex-wrap: wrap;
            }

            /* ========== Summary Bar ========== */
            .team-summary-bar {
                display: flex;
                gap: 16px;
                flex-wrap: wrap;
                margin-bottom: 16px;
                padding: 12px 16px;
                background: var(--bg-card);
                border: 1px solid var(--border-color);
                border-radius: var(--border-radius-sm);
            }

            .team-summary-stat {
                font-size: 14px;
                color: var(--text-secondary);
            }

            .team-summary-stat strong {
                color: var(--text-primary);
                font-weight: 600;
            }

            /* ========== Filter Tabs ========== */
            .team-filter-tabs {
                display: flex;
                gap: 4px;
                margin-bottom: 16px;
                padding: 4px;
                background: var(--bg-card);
                border-radius: var(--border-radius-sm);
                border: 1px solid var(--border-color);
                width: fit-content;
            }

            .team-filter-tab {
                padding: 8px 18px;
                border: none;
                background: transparent;
                color: var(--text-secondary);
                font-size: 14px;
                font-weight: 500;
                border-radius: 6px;
                cursor: pointer;
                transition: all var(--transition-fast);
                min-height: 44px;
            }

            .team-filter-tab:hover {
                color: var(--text-primary);
                background: var(--bg-hover);
            }

            .team-filter-tab.active {
                background: var(--accent-primary);
                color: #fff;
            }

            /* ========== Member Grid ========== */
            .team-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
                gap: 12px;
            }

            .team-card {
                background: var(--bg-card);
                border: 1px solid var(--border-color);
                border-radius: var(--border-radius);
                padding: 16px;
                cursor: pointer;
                transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
                display: flex;
                flex-direction: column;
                gap: 10px;
            }

            .team-card:hover {
                border-color: var(--accent-primary);
                box-shadow: var(--shadow-md);
            }

            .team-card-top {
                display: flex;
                align-items: center;
                gap: 12px;
            }

            .team-avatar {
                width: 44px;
                height: 44px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 18px;
                font-weight: 700;
                color: #fff;
                flex-shrink: 0;
            }

            .team-card-info {
                flex: 1;
                min-width: 0;
            }

            .team-card-name {
                font-size: 16px;
                font-weight: 600;
                color: var(--text-primary);
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }

            .team-card-company {
                font-size: 12px;
                color: var(--text-muted);
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }

            .team-card-meta {
                display: flex;
                align-items: center;
                gap: 8px;
                flex-wrap: wrap;
            }

            /* ========== Role Badges ========== */
            .team-role-badge {
                display: inline-block;
                padding: 3px 10px;
                border-radius: 12px;
                font-size: 11px;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 0.3px;
            }

            .team-role-badge--meister {
                background: rgba(139, 92, 246, 0.18);
                color: #a78bfa;
                border: 1px solid rgba(139, 92, 246, 0.35);
            }

            .team-role-badge--geselle {
                background: rgba(59, 130, 246, 0.18);
                color: #60a5fa;
                border: 1px solid rgba(59, 130, 246, 0.35);
            }

            .team-role-badge--azubi {
                background: rgba(34, 197, 94, 0.18);
                color: #4ade80;
                border: 1px solid rgba(34, 197, 94, 0.35);
            }

            .team-role-badge--helfer {
                background: rgba(161, 161, 170, 0.18);
                color: #a1a1aa;
                border: 1px solid rgba(161, 161, 170, 0.35);
            }

            .team-role-badge--buero {
                background: rgba(6, 182, 212, 0.18);
                color: #22d3ee;
                border: 1px solid rgba(6, 182, 212, 0.35);
            }

            .team-role-badge--sub {
                background: rgba(249, 115, 22, 0.18);
                color: #fb923c;
                border: 1px solid rgba(249, 115, 22, 0.35);
            }

            /* ========== Status Dots ========== */
            .team-status-dot {
                width: 10px;
                height: 10px;
                border-radius: 50%;
                display: inline-block;
                flex-shrink: 0;
            }

            .team-status-dot--aktiv {
                background: #22c55e;
                box-shadow: 0 0 4px rgba(34, 197, 94, 0.5);
            }

            .team-status-dot--urlaub {
                background: #f59e0b;
                box-shadow: 0 0 4px rgba(245, 158, 11, 0.5);
            }

            .team-status-dot--krank {
                background: #ef4444;
                box-shadow: 0 0 4px rgba(239, 68, 68, 0.5);
            }

            .team-status-dot--inaktiv {
                background: #71717a;
            }

            .team-status-label {
                font-size: 12px;
                color: var(--text-muted);
                text-transform: capitalize;
            }

            /* ========== Phone Link ========== */
            .team-phone-link {
                display: inline-flex;
                align-items: center;
                gap: 4px;
                color: var(--accent-info);
                font-size: 13px;
                text-decoration: none;
                padding: 4px 0;
                min-height: 44px;
                min-width: 44px;
            }

            .team-phone-link:hover {
                color: var(--accent-primary-hover);
            }

            /* ========== Buttons ========== */
            .team-btn {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                gap: 6px;
                padding: 10px 18px;
                border: none;
                border-radius: var(--border-radius-sm);
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                transition: all var(--transition-fast);
                min-height: 44px;
                white-space: nowrap;
            }

            .team-btn--primary {
                background: var(--accent-primary);
                color: #fff;
            }

            .team-btn--primary:hover {
                background: var(--accent-primary-hover);
            }

            .team-btn--secondary {
                background: var(--bg-hover);
                color: var(--text-primary);
                border: 1px solid var(--border-color);
            }

            .team-btn--secondary:hover {
                background: var(--bg-card);
                border-color: var(--text-muted);
            }

            .team-btn--danger {
                background: var(--accent-danger);
                color: #fff;
            }

            .team-btn--danger:hover {
                background: #dc2626;
            }

            .team-btn--success {
                background: var(--accent-success);
                color: #fff;
            }

            .team-btn--success:hover {
                background: #16a34a;
            }

            .team-btn--small {
                padding: 6px 12px;
                font-size: 13px;
                min-height: 36px;
            }

            /* ========== Back Nav ========== */
            .team-back-nav {
                display: flex;
                align-items: center;
                gap: 8px;
                margin-bottom: 16px;
            }

            .team-back-btn {
                display: inline-flex;
                align-items: center;
                gap: 4px;
                background: none;
                border: none;
                color: var(--text-secondary);
                font-size: 14px;
                cursor: pointer;
                padding: 8px 4px;
                min-height: 44px;
            }

            .team-back-btn:hover {
                color: var(--text-primary);
            }

            /* ========== Detail / Form ========== */
            .team-detail-grid {
                display: grid;
                grid-template-columns: 1fr;
                gap: 20px;
            }

            @media (min-width: 768px) {
                .team-detail-grid {
                    grid-template-columns: 1fr 1fr;
                }
            }

            .team-form-section {
                background: var(--bg-card);
                border: 1px solid var(--border-color);
                border-radius: var(--border-radius);
                padding: 20px;
            }

            .team-form-section h3 {
                font-size: 15px;
                font-weight: 600;
                color: var(--text-primary);
                margin: 0 0 16px 0;
                padding-bottom: 8px;
                border-bottom: 1px solid var(--border-color);
            }

            .team-form-group {
                margin-bottom: 14px;
            }

            .team-form-group label {
                display: block;
                font-size: 12px;
                font-weight: 500;
                color: var(--text-secondary);
                margin-bottom: 4px;
                text-transform: uppercase;
                letter-spacing: 0.3px;
            }

            .team-form-group input,
            .team-form-group select,
            .team-form-group textarea {
                width: 100%;
                padding: 10px 12px;
                background: var(--bg-input);
                border: 1px solid var(--border-color);
                border-radius: 6px;
                color: var(--text-primary);
                font-size: 14px;
                transition: border-color var(--transition-fast);
                min-height: 44px;
            }

            .team-form-group input:focus,
            .team-form-group select:focus,
            .team-form-group textarea:focus {
                outline: none;
                border-color: var(--accent-primary);
                background: var(--input-bg-focus);
            }

            .team-form-row {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 12px;
            }

            /* ========== Chips / Tags ========== */
            .team-chips-container {
                display: flex;
                flex-wrap: wrap;
                gap: 6px;
                margin-top: 6px;
            }

            .team-chip {
                display: inline-flex;
                align-items: center;
                gap: 4px;
                padding: 4px 10px;
                background: var(--accent-primary-light);
                color: var(--accent-primary-hover);
                border: 1px solid rgba(99, 102, 241, 0.3);
                border-radius: 14px;
                font-size: 12px;
                font-weight: 500;
            }

            .team-chip-remove {
                background: none;
                border: none;
                color: inherit;
                cursor: pointer;
                font-size: 14px;
                padding: 0 2px;
                line-height: 1;
                opacity: 0.7;
                min-width: 20px;
                min-height: 20px;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .team-chip-remove:hover {
                opacity: 1;
            }

            .team-chip-input {
                display: flex;
                gap: 6px;
            }

            .team-chip-input input {
                flex: 1;
            }

            /* ========== Time Entries Table ========== */
            .team-time-table {
                width: 100%;
                border-collapse: collapse;
                font-size: 13px;
            }

            .team-time-table th {
                text-align: left;
                padding: 10px 8px;
                background: var(--bg-hover);
                color: var(--text-secondary);
                font-weight: 600;
                font-size: 11px;
                text-transform: uppercase;
                letter-spacing: 0.3px;
                border-bottom: 1px solid var(--border-color);
                white-space: nowrap;
            }

            .team-time-table td {
                padding: 10px 8px;
                border-bottom: 1px solid var(--border-color);
                color: var(--text-primary);
                vertical-align: middle;
            }

            .team-time-table tr:hover td {
                background: var(--bg-hover);
            }

            .team-time-table .approved-check {
                width: 18px;
                height: 18px;
                cursor: pointer;
                accent-color: var(--accent-success);
            }

            /* ========== Monthly Summary Card ========== */
            .team-month-summary {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
                gap: 12px;
                margin-top: 16px;
            }

            .team-month-stat {
                background: var(--bg-hover);
                border-radius: var(--border-radius-sm);
                padding: 14px;
                text-align: center;
            }

            .team-month-stat-value {
                font-size: 24px;
                font-weight: 700;
                color: var(--text-primary);
            }

            .team-month-stat-label {
                font-size: 12px;
                color: var(--text-muted);
                margin-top: 4px;
            }

            /* ========== Time Log Form ========== */
            .team-timelog-form {
                background: var(--bg-card);
                border: 1px solid var(--border-color);
                border-radius: var(--border-radius);
                padding: 20px;
                margin-bottom: 20px;
            }

            .team-timelog-form h3 {
                font-size: 15px;
                font-weight: 600;
                color: var(--text-primary);
                margin: 0 0 16px 0;
            }

            .team-timelog-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
                gap: 12px;
            }

            .team-clock-buttons {
                display: flex;
                gap: 8px;
                margin-bottom: 16px;
            }

            /* ========== Weekly Timesheet ========== */
            .team-timesheet {
                overflow-x: auto;
                margin-top: 20px;
            }

            .team-timesheet-table {
                width: 100%;
                border-collapse: collapse;
                font-size: 13px;
                min-width: 700px;
            }

            .team-timesheet-table th {
                padding: 10px 8px;
                background: var(--bg-hover);
                color: var(--text-secondary);
                font-weight: 600;
                font-size: 11px;
                text-transform: uppercase;
                letter-spacing: 0.3px;
                border-bottom: 1px solid var(--border-color);
                text-align: center;
                min-width: 80px;
            }

            .team-timesheet-table th:first-child {
                text-align: left;
                min-width: 140px;
            }

            .team-timesheet-table td {
                padding: 8px;
                border-bottom: 1px solid var(--border-color);
                text-align: center;
                color: var(--text-primary);
                vertical-align: middle;
            }

            .team-timesheet-table td:first-child {
                text-align: left;
                font-weight: 500;
            }

            .team-timesheet-cell {
                font-size: 13px;
                font-weight: 500;
            }

            .team-timesheet-cell--empty {
                color: var(--text-muted);
            }

            .team-timesheet-cell--overtime {
                color: var(--accent-warning);
                font-weight: 600;
            }

            /* ========== Alert Cards ========== */
            .team-alerts-grid {
                display: grid;
                gap: 12px;
            }

            .team-alert-card {
                display: flex;
                align-items: flex-start;
                gap: 12px;
                padding: 14px 16px;
                border-radius: var(--border-radius-sm);
                border-left: 4px solid;
            }

            .team-alert-card--warning {
                background: rgba(245, 158, 11, 0.08);
                border-left-color: var(--accent-warning);
            }

            .team-alert-card--info {
                background: rgba(59, 130, 246, 0.08);
                border-left-color: var(--accent-info);
            }

            .team-alert-card--danger {
                background: rgba(239, 68, 68, 0.08);
                border-left-color: var(--accent-danger);
            }

            .team-alert-icon {
                font-size: 20px;
                flex-shrink: 0;
                line-height: 1;
            }

            .team-alert-content {
                flex: 1;
            }

            .team-alert-title {
                font-size: 14px;
                font-weight: 600;
                color: var(--text-primary);
                margin-bottom: 2px;
            }

            .team-alert-desc {
                font-size: 13px;
                color: var(--text-secondary);
            }

            /* ========== Nav Tabs (views) ========== */
            .team-nav-tabs {
                display: flex;
                gap: 4px;
                margin-bottom: 20px;
                border-bottom: 1px solid var(--border-color);
                padding-bottom: 0;
                overflow-x: auto;
            }

            .team-nav-tab {
                padding: 10px 16px;
                border: none;
                background: transparent;
                color: var(--text-secondary);
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                border-bottom: 2px solid transparent;
                transition: all var(--transition-fast);
                white-space: nowrap;
                min-height: 44px;
            }

            .team-nav-tab:hover {
                color: var(--text-primary);
            }

            .team-nav-tab.active {
                color: var(--accent-primary);
                border-bottom-color: var(--accent-primary);
            }

            /* ========== Empty State ========== */
            .team-empty-state {
                text-align: center;
                padding: 48px 20px;
                color: var(--text-muted);
            }

            .team-empty-state-icon {
                font-size: 48px;
                margin-bottom: 12px;
            }

            .team-empty-state-text {
                font-size: 16px;
                margin-bottom: 8px;
                color: var(--text-secondary);
            }

            .team-empty-state-hint {
                font-size: 13px;
            }

            /* ========== Toggle Switch ========== */
            .team-toggle {
                position: relative;
                display: inline-block;
                width: 44px;
                height: 24px;
            }

            .team-toggle input {
                opacity: 0;
                width: 0;
                height: 0;
            }

            .team-toggle-slider {
                position: absolute;
                cursor: pointer;
                top: 0; left: 0; right: 0; bottom: 0;
                background: var(--bg-hover);
                border-radius: 24px;
                border: 1px solid var(--border-color);
                transition: all var(--transition-fast);
            }

            .team-toggle-slider::before {
                content: '';
                position: absolute;
                height: 18px;
                width: 18px;
                left: 2px;
                bottom: 2px;
                background: var(--text-secondary);
                border-radius: 50%;
                transition: all var(--transition-fast);
            }

            .team-toggle input:checked + .team-toggle-slider {
                background: var(--accent-success);
                border-color: var(--accent-success);
            }

            .team-toggle input:checked + .team-toggle-slider::before {
                transform: translateX(20px);
                background: #fff;
            }

            /* ========== Responsive ========== */
            @media (max-width: 640px) {
                .team-grid {
                    grid-template-columns: 1fr;
                }

                .team-header {
                    flex-direction: column;
                    align-items: flex-start;
                }

                .team-form-row {
                    grid-template-columns: 1fr;
                }

                .team-timelog-grid {
                    grid-template-columns: 1fr;
                }

                .team-month-summary {
                    grid-template-columns: 1fr 1fr;
                }
            }
        `;
        document.head.appendChild(style);
    }

    // ============================================
    // XSS Prevention
    // ============================================

    _esc(str) {
        if (!str && str !== 0) { return ''; }
        const div = document.createElement('div');
        div.textContent = String(str);
        return div.innerHTML;
    }

    // ============================================
    // Main Render Entry Point
    // ============================================

    /**
     * Render the team UI into a container element.
     * @param {HTMLElement|string} target - Element or element ID
     */
    render(target) {
        this.container = typeof target === 'string' ? document.getElementById(target) : target;
        if (!this.container) { return; }

        switch (this.currentView) {
            case 'overview':
                this._renderOverview();
                break;
            case 'detail':
                this._renderDetail();
                break;
            case 'timelog':
                this._renderTimeLog();
                break;
            case 'alerts':
                this._renderAlerts();
                break;
            default:
                this._renderOverview();
        }
    }

    /**
     * Navigate to a view
     */
    navigate(view, memberId) {
        this.currentView = view;
        if (memberId !== undefined) { this.currentMemberId = memberId; }
        this.render(this.container);
    }

    // ============================================
    // 1. Team Overview
    // ============================================

    _renderOverview() {
        const service = window.teamService;
        if (!service) {
            this.container.innerHTML = '<p style="color: var(--text-muted); padding: 20px;">TeamService nicht geladen.</p>';
            return;
        }

        const allMembers = service.getMembers();
        const filtered = this.filterType === 'alle'
            ? allMembers
            : allMembers.filter(m => m.type === this.filterType);

        const aktivCount = allMembers.filter(m => m.status === 'aktiv').length;
        const urlaubCount = allMembers.filter(m => m.status === 'urlaub').length;
        const krankCount = allMembers.filter(m => m.status === 'krank').length;

        // Check for alerts
        const expiringInsurances = service.getExpiringInsurances();
        const alertCount = expiringInsurances.length + krankCount + urlaubCount;

        this.container.innerHTML = `
            <div class="team-container">
                <!-- Nav Tabs -->
                <div class="team-nav-tabs">
                    <button class="team-nav-tab active" data-team-view="overview">Team</button>
                    <button class="team-nav-tab" data-team-view="timelog">Zeiterfassung</button>
                    <button class="team-nav-tab" data-team-view="alerts">
                        Warnungen${alertCount > 0 ? ' (' + alertCount + ')' : ''}
                    </button>
                </div>

                <!-- Header -->
                <div class="team-header">
                    <h2>Team-Verwaltung</h2>
                    <div class="team-header-actions">
                        <button class="team-btn team-btn--primary" data-action="add-member">
                            + Neuer Mitarbeiter
                        </button>
                        <button class="team-btn team-btn--secondary" data-action="add-sub" style="border-color: #fb923c; color: #fb923c;">
                            + Neuer Subunternehmer
                        </button>
                    </div>
                </div>

                <!-- Summary Bar -->
                <div class="team-summary-bar">
                    <div class="team-summary-stat"><strong>${allMembers.length}</strong> Mitarbeiter</div>
                    <div class="team-summary-stat"><strong>${aktivCount}</strong> aktiv</div>
                    ${urlaubCount > 0 ? `<div class="team-summary-stat"><strong>${urlaubCount}</strong> im Urlaub</div>` : ''}
                    ${krankCount > 0 ? `<div class="team-summary-stat"><strong>${krankCount}</strong> krank</div>` : ''}
                </div>

                <!-- Filter Tabs -->
                <div class="team-filter-tabs">
                    <button class="team-filter-tab ${this.filterType === 'alle' ? 'active' : ''}" data-filter="alle">Alle</button>
                    <button class="team-filter-tab ${this.filterType === 'intern' ? 'active' : ''}" data-filter="intern">Intern</button>
                    <button class="team-filter-tab ${this.filterType === 'subunternehmer' ? 'active' : ''}" data-filter="subunternehmer">Subunternehmer</button>
                </div>

                <!-- Member Grid -->
                ${filtered.length === 0 ? this._renderEmptyState() : `
                    <div class="team-grid">
                        ${filtered.map(m => this._renderMemberCard(m)).join('')}
                    </div>
                `}
            </div>
        `;

        this._bindOverviewEvents();
    }

    _renderMemberCard(member) {
        const initials = (member.name || '?').split(' ').map(w => w[0]).join('').toUpperCase().substring(0, 2);
        const roleBadgeClass = member.type === 'subunternehmer' ? 'sub' : member.role;
        const roleLabel = this._getRoleLabel(member);

        return `
            <div class="team-card" data-member-id="${this._esc(member.id)}">
                <div class="team-card-top">
                    <div class="team-avatar" style="background: ${this._esc(member.color)}">
                        ${this._esc(initials)}
                    </div>
                    <div class="team-card-info">
                        <div class="team-card-name">${this._esc(member.name)}</div>
                        ${member.companyName ? `<div class="team-card-company">${this._esc(member.companyName)}</div>` : ''}
                    </div>
                </div>
                <div class="team-card-meta">
                    <span class="team-role-badge team-role-badge--${this._esc(roleBadgeClass)}">${this._esc(roleLabel)}</span>
                    <span class="team-status-dot team-status-dot--${this._esc(member.status)}"></span>
                    <span class="team-status-label">${this._esc(member.status)}</span>
                </div>
                ${member.phone ? `<a href="tel:${this._esc(member.phone)}" class="team-phone-link" onclick="event.stopPropagation();">${this._esc(member.phone)}</a>` : ''}
            </div>
        `;
    }

    _renderEmptyState() {
        return `
            <div class="team-empty-state">
                <div class="team-empty-state-icon">👷</div>
                <div class="team-empty-state-text">Noch keine Teammitglieder</div>
                <div class="team-empty-state-hint">Legen Sie Mitarbeiter oder Subunternehmer an, um loszulegen.</div>
            </div>
        `;
    }

    _getRoleLabel(member) {
        if (member.type === 'subunternehmer') { return 'Sub'; }
        const labels = {
            meister: 'Meister',
            geselle: 'Geselle',
            azubi: 'Azubi',
            helfer: 'Helfer',
            buero: 'Buero'
        };
        return labels[member.role] || member.role;
    }

    _bindOverviewEvents() {
        if (!this.container) { return; }

        // Nav tabs
        this.container.querySelectorAll('.team-nav-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const view = tab.getAttribute('data-team-view');
                if (view) { this.navigate(view); }
            });
        });

        // Filter tabs
        this.container.querySelectorAll('.team-filter-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                this.filterType = tab.getAttribute('data-filter') || 'alle';
                this._renderOverview();
            });
        });

        // Add member
        this.container.querySelector('[data-action="add-member"]')?.addEventListener('click', () => {
            this.currentMemberId = null;
            this._memberFormType = 'intern';
            this.navigate('detail', null);
        });

        // Add subcontractor
        this.container.querySelector('[data-action="add-sub"]')?.addEventListener('click', () => {
            this.currentMemberId = null;
            this._memberFormType = 'subunternehmer';
            this.navigate('detail', null);
        });

        // Card click -> detail
        this.container.querySelectorAll('.team-card').forEach(card => {
            card.addEventListener('click', () => {
                const id = card.getAttribute('data-member-id');
                if (id) { this.navigate('detail', id); }
            });
        });
    }

    // ============================================
    // 2. Member Detail / Edit
    // ============================================

    _renderDetail() {
        const service = window.teamService;
        const isNew = !this.currentMemberId;
        const member = isNew ? this._getBlankMember() : service.getMember(this.currentMemberId);

        if (!member && !isNew) {
            this.navigate('overview');
            return;
        }

        const isSub = isNew ? (this._memberFormType === 'subunternehmer') : (member.type === 'subunternehmer');

        // Time entries for last 4 weeks
        const now = new Date();
        const fourWeeksAgo = new Date(now);
        fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
        const startDateStr = fourWeeksAgo.toISOString().split('T')[0];
        const endDateStr = now.toISOString().split('T')[0];

        const timeEntries = !isNew ? service.getTimeEntries(member.id, startDateStr, endDateStr) : [];

        // Monthly summary
        const currentMonth = now.getMonth() + 1;
        const currentYear = now.getFullYear();
        const monthlyHours = !isNew ? service.getMonthlyHours(member.id, currentYear, currentMonth) : 0;
        const overtime = !isNew ? service.getOvertime(member.id, currentMonth, currentYear) : 0;
        const monthlyCost = monthlyHours * (member.hourlyRate || 0);

        this.container.innerHTML = `
            <div class="team-container">
                <div class="team-back-nav">
                    <button class="team-back-btn" data-action="back-overview">&larr; Zurueck zur Uebersicht</button>
                </div>

                <div class="team-header">
                    <h2>${isNew ? (isSub ? 'Neuer Subunternehmer' : 'Neuer Mitarbeiter') : this._esc(member.name)}</h2>
                    <div class="team-header-actions">
                        <button class="team-btn team-btn--primary" data-action="save-member">Speichern</button>
                        ${!isNew ? `<button class="team-btn team-btn--danger" data-action="delete-member">Loeschen</button>` : ''}
                    </div>
                </div>

                <div class="team-detail-grid">
                    <!-- Stammdaten -->
                    <div class="team-form-section">
                        <h3>Stammdaten</h3>
                        <div class="team-form-group">
                            <label>Name</label>
                            <input type="text" id="tm-name" value="${this._esc(member.name)}" placeholder="Vor- und Nachname">
                        </div>
                        <div class="team-form-row">
                            <div class="team-form-group">
                                <label>Rolle</label>
                                <select id="tm-role">
                                    <option value="meister" ${member.role === 'meister' ? 'selected' : ''}>Meister</option>
                                    <option value="geselle" ${member.role === 'geselle' ? 'selected' : ''}>Geselle</option>
                                    <option value="azubi" ${member.role === 'azubi' ? 'selected' : ''}>Azubi</option>
                                    <option value="helfer" ${member.role === 'helfer' ? 'selected' : ''}>Helfer</option>
                                    <option value="buero" ${member.role === 'buero' ? 'selected' : ''}>Buero</option>
                                </select>
                            </div>
                            <div class="team-form-group">
                                <label>Status</label>
                                <select id="tm-status">
                                    <option value="aktiv" ${member.status === 'aktiv' ? 'selected' : ''}>Aktiv</option>
                                    <option value="urlaub" ${member.status === 'urlaub' ? 'selected' : ''}>Urlaub</option>
                                    <option value="krank" ${member.status === 'krank' ? 'selected' : ''}>Krank</option>
                                    <option value="inaktiv" ${member.status === 'inaktiv' ? 'selected' : ''}>Inaktiv</option>
                                </select>
                            </div>
                        </div>
                        <div class="team-form-row">
                            <div class="team-form-group">
                                <label>Telefon</label>
                                <input type="tel" id="tm-phone" value="${this._esc(member.phone)}" placeholder="+49 123 456789">
                            </div>
                            <div class="team-form-group">
                                <label>E-Mail</label>
                                <input type="email" id="tm-email" value="${this._esc(member.email)}" placeholder="name@firma.de">
                            </div>
                        </div>
                        <div class="team-form-group">
                            <label>Farbe (Kalender/Einsatzplanung)</label>
                            <input type="color" id="tm-color" value="${member.color || '#6366f1'}" style="height: 44px; cursor: pointer;">
                        </div>
                    </div>

                    <!-- Anstellung -->
                    <div class="team-form-section">
                        <h3>Anstellung</h3>
                        <div class="team-form-group">
                            <label>Eingestellt seit</label>
                            <input type="date" id="tm-employed-since" value="${this._esc(member.employedSince)}">
                        </div>
                        <div class="team-form-row">
                            <div class="team-form-group">
                                <label>Stundensatz (intern, EUR/h)</label>
                                <input type="number" id="tm-hourly-rate" value="${member.hourlyRate || 0}" min="0" step="0.50">
                            </div>
                            <div class="team-form-group">
                                <label>Abrechnungssatz (Kunde, EUR/h)</label>
                                <input type="number" id="tm-billing-rate" value="${member.billingRate || 0}" min="0" step="0.50">
                            </div>
                        </div>
                        <div class="team-form-group">
                            <label>Wochenstunden</label>
                            <input type="number" id="tm-weekly-hours" value="${member.weeklyHours || 40}" min="0" max="60" step="1">
                        </div>

                        <!-- Qualifications -->
                        <div class="team-form-group">
                            <label>Qualifikationen</label>
                            <div class="team-chip-input">
                                <input type="text" id="tm-qual-input" placeholder="z.B. Schweisserschein">
                                <button class="team-btn team-btn--secondary team-btn--small" data-action="add-qual">+</button>
                            </div>
                            <div class="team-chips-container" id="tm-qual-chips">
                                ${(member.qualifications || []).map((q, i) => `
                                    <span class="team-chip">
                                        ${this._esc(q)}
                                        <button class="team-chip-remove" data-remove-qual="${i}">&times;</button>
                                    </span>
                                `).join('')}
                            </div>
                        </div>

                        <!-- Trades -->
                        <div class="team-form-group">
                            <label>Gewerke</label>
                            <div class="team-chip-input">
                                <input type="text" id="tm-trade-input" placeholder="z.B. SHK, Elektro">
                                <button class="team-btn team-btn--secondary team-btn--small" data-action="add-trade">+</button>
                            </div>
                            <div class="team-chips-container" id="tm-trade-chips">
                                ${(member.trades || []).map((t, i) => `
                                    <span class="team-chip">
                                        ${this._esc(t)}
                                        <button class="team-chip-remove" data-remove-trade="${i}">&times;</button>
                                    </span>
                                `).join('')}
                            </div>
                        </div>
                    </div>

                    ${isSub ? `
                    <!-- Subcontractor Fields -->
                    <div class="team-form-section" style="grid-column: 1 / -1;">
                        <h3>Subunternehmer-Daten</h3>
                        <div class="team-form-row">
                            <div class="team-form-group">
                                <label>Firmenname</label>
                                <input type="text" id="tm-company" value="${this._esc(member.companyName)}" placeholder="Firma GmbH">
                            </div>
                            <div class="team-form-group">
                                <label>Steuernummer</label>
                                <input type="text" id="tm-tax-id" value="${this._esc(member.taxId)}" placeholder="12/345/67890">
                            </div>
                        </div>
                        <div class="team-form-row">
                            <div class="team-form-group">
                                <label>Versicherung gueltig bis</label>
                                <input type="date" id="tm-insurance-expiry" value="${this._esc(member.insuranceExpiry)}">
                            </div>
                            <div class="team-form-group">
                                <label>Haftpflicht bestaetigt</label>
                                <div style="padding-top: 6px;">
                                    <label class="team-toggle">
                                        <input type="checkbox" id="tm-insurance-verified" ${member.insuranceVerified ? 'checked' : ''}>
                                        <span class="team-toggle-slider"></span>
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>
                    ` : ''}

                    ${!isNew ? `
                    <!-- Time Entries (last 4 weeks) -->
                    <div class="team-form-section" style="grid-column: 1 / -1;">
                        <h3>Zeiteintraege (letzte 4 Wochen)</h3>
                        ${timeEntries.length === 0 ? `
                            <p style="color: var(--text-muted); font-size: 14px;">Keine Eintraege vorhanden.</p>
                        ` : `
                            <div style="overflow-x: auto;">
                                <table class="team-time-table">
                                    <thead>
                                        <tr>
                                            <th>Datum</th>
                                            <th>Start</th>
                                            <th>Ende</th>
                                            <th>Pause</th>
                                            <th>Stunden</th>
                                            <th>Auftrag</th>
                                            <th>Typ</th>
                                            <th>OK</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${timeEntries.map(e => `
                                            <tr>
                                                <td>${this._esc(this._formatDate(e.date))}</td>
                                                <td>${this._esc(e.startTime)}</td>
                                                <td>${this._esc(e.endTime)}</td>
                                                <td>${e.breakMinutes} min</td>
                                                <td>${e.totalHours.toFixed(2).replace('.', ',')} h</td>
                                                <td>${this._esc(e.orderName || '-')}</td>
                                                <td>${this._esc(this._getTypeLabel(e.type))}</td>
                                                <td>
                                                    <input type="checkbox" class="approved-check" data-entry-id="${this._esc(e.id)}" ${e.approved ? 'checked' : ''}>
                                                </td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                        `}

                        <!-- Monthly Summary -->
                        <div class="team-month-summary">
                            <div class="team-month-stat">
                                <div class="team-month-stat-value">${monthlyHours.toFixed(1).replace('.', ',')} h</div>
                                <div class="team-month-stat-label">Gearbeitete Stunden</div>
                            </div>
                            <div class="team-month-stat">
                                <div class="team-month-stat-value">${monthlyCost.toFixed(0)} EUR</div>
                                <div class="team-month-stat-label">Kosten (intern)</div>
                            </div>
                            <div class="team-month-stat">
                                <div class="team-month-stat-value" style="${overtime > 0 ? 'color: var(--accent-warning);' : ''}">${overtime > 0 ? '+' : ''}${overtime.toFixed(1).replace('.', ',')} h</div>
                                <div class="team-month-stat-label">Ueberstunden</div>
                            </div>
                        </div>
                    </div>
                    ` : ''}
                </div>
            </div>
        `;

        this._currentQualifications = [...(member.qualifications || [])];
        this._currentTrades = [...(member.trades || [])];
        this._bindDetailEvents(isNew, isSub);
    }

    _getBlankMember() {
        return {
            name: '',
            role: 'geselle',
            type: this._memberFormType || 'intern',
            phone: '',
            email: '',
            employedSince: new Date().toISOString().split('T')[0],
            hourlyRate: 0,
            billingRate: 0,
            weeklyHours: 40,
            qualifications: [],
            trades: [],
            companyName: '',
            taxId: '',
            insuranceVerified: false,
            insuranceExpiry: '',
            status: 'aktiv',
            color: '#6366f1'
        };
    }

    _bindDetailEvents(isNew, isSub) {
        if (!this.container) { return; }

        // Back
        this.container.querySelector('[data-action="back-overview"]')?.addEventListener('click', () => {
            this.navigate('overview');
        });

        // Save
        this.container.querySelector('[data-action="save-member"]')?.addEventListener('click', () => {
            this._saveMember(isNew, isSub);
        });

        // Delete
        this.container.querySelector('[data-action="delete-member"]')?.addEventListener('click', () => {
            this._deleteMember();
        });

        // Add qualification
        this.container.querySelector('[data-action="add-qual"]')?.addEventListener('click', () => {
            this._addChip('qual');
        });

        const qualInput = this.container.querySelector('#tm-qual-input');
        qualInput?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); this._addChip('qual'); }
        });

        // Add trade
        this.container.querySelector('[data-action="add-trade"]')?.addEventListener('click', () => {
            this._addChip('trade');
        });

        const tradeInput = this.container.querySelector('#tm-trade-input');
        tradeInput?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); this._addChip('trade'); }
        });

        // Remove chips
        this.container.querySelectorAll('[data-remove-qual]').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.getAttribute('data-remove-qual'), 10);
                this._currentQualifications.splice(idx, 1);
                this._refreshChips('qual');
            });
        });

        this.container.querySelectorAll('[data-remove-trade]').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.getAttribute('data-remove-trade'), 10);
                this._currentTrades.splice(idx, 1);
                this._refreshChips('trade');
            });
        });

        // Approve time entries
        this.container.querySelectorAll('.approved-check').forEach(cb => {
            cb.addEventListener('change', () => {
                const entryId = cb.getAttribute('data-entry-id');
                if (cb.checked && entryId) {
                    window.teamService.approveTimeEntry(entryId, 'Meister');
                }
            });
        });
    }

    _addChip(type) {
        const inputId = type === 'qual' ? 'tm-qual-input' : 'tm-trade-input';
        const input = this.container.querySelector('#' + inputId);
        const value = (input?.value || '').trim();
        if (!value) { return; }

        if (type === 'qual') {
            this._currentQualifications.push(value);
        } else {
            this._currentTrades.push(value);
        }

        input.value = '';
        this._refreshChips(type);
    }

    _refreshChips(type) {
        const containerId = type === 'qual' ? 'tm-qual-chips' : 'tm-trade-chips';
        const items = type === 'qual' ? this._currentQualifications : this._currentTrades;
        const removeAttr = type === 'qual' ? 'data-remove-qual' : 'data-remove-trade';
        const container = this.container.querySelector('#' + containerId);
        if (!container) { return; }

        container.innerHTML = items.map((item, i) => `
            <span class="team-chip">
                ${this._esc(item)}
                <button class="team-chip-remove" ${removeAttr}="${i}">&times;</button>
            </span>
        `).join('');

        // Re-bind remove events
        container.querySelectorAll(`[${removeAttr}]`).forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.getAttribute(removeAttr), 10);
                items.splice(idx, 1);
                this._refreshChips(type);
            });
        });
    }

    _saveMember(isNew, isSub) {
        const service = window.teamService;

        const data = {
            name: (this.container.querySelector('#tm-name')?.value || '').trim(),
            role: this.container.querySelector('#tm-role')?.value || 'geselle',
            type: isSub ? 'subunternehmer' : 'intern',
            phone: (this.container.querySelector('#tm-phone')?.value || '').trim(),
            email: (this.container.querySelector('#tm-email')?.value || '').trim(),
            status: this.container.querySelector('#tm-status')?.value || 'aktiv',
            color: this.container.querySelector('#tm-color')?.value || '#6366f1',
            employedSince: this.container.querySelector('#tm-employed-since')?.value || '',
            hourlyRate: parseFloat(this.container.querySelector('#tm-hourly-rate')?.value) || 0,
            billingRate: parseFloat(this.container.querySelector('#tm-billing-rate')?.value) || 0,
            weeklyHours: parseFloat(this.container.querySelector('#tm-weekly-hours')?.value) || 40,
            qualifications: [...this._currentQualifications],
            trades: [...this._currentTrades]
        };

        if (!data.name) {
            alert('Bitte geben Sie einen Namen ein.');
            return;
        }

        if (isSub) {
            data.companyName = (this.container.querySelector('#tm-company')?.value || '').trim();
            data.taxId = (this.container.querySelector('#tm-tax-id')?.value || '').trim();
            data.insuranceExpiry = this.container.querySelector('#tm-insurance-expiry')?.value || '';
            data.insuranceVerified = this.container.querySelector('#tm-insurance-verified')?.checked || false;
        }

        if (isNew) {
            const created = service.addMember(data);
            this.currentMemberId = created.id;
        } else {
            service.updateMember(this.currentMemberId, data);
        }

        // Show brief confirmation
        this._showToast(isNew ? 'Mitarbeiter angelegt' : 'Aenderungen gespeichert');
        this.navigate('overview');
    }

    _deleteMember() {
        if (!this.currentMemberId) { return; }

        const member = window.teamService.getMember(this.currentMemberId);
        const name = member ? member.name : '';

        if (!confirm(`"${name}" wirklich loeschen? Dieser Vorgang kann nicht rueckgaengig gemacht werden.`)) {
            return;
        }

        window.teamService.removeMember(this.currentMemberId);
        this.currentMemberId = null;
        this._showToast('Mitarbeiter geloescht');
        this.navigate('overview');
    }

    // ============================================
    // 3. Time Logging
    // ============================================

    _renderTimeLog() {
        const service = window.teamService;
        const members = service.getMembers();

        // Get active orders from store for dropdown
        const orders = this._getActiveOrders();

        // Current week dates
        const today = new Date();
        const monday = this._getMonday(today);
        const weekDates = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(monday);
            d.setDate(d.getDate() + i);
            weekDates.push(d.toISOString().split('T')[0]);
        }
        const dayLabels = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

        this.container.innerHTML = `
            <div class="team-container">
                <!-- Nav Tabs -->
                <div class="team-nav-tabs">
                    <button class="team-nav-tab" data-team-view="overview">Team</button>
                    <button class="team-nav-tab active" data-team-view="timelog">Zeiterfassung</button>
                    <button class="team-nav-tab" data-team-view="alerts">Warnungen</button>
                </div>

                <div class="team-header">
                    <h2>Zeiterfassung</h2>
                </div>

                <!-- Quick Clock Buttons -->
                <div class="team-clock-buttons">
                    <button class="team-btn team-btn--success" data-action="clock-in">Jetzt einstempeln</button>
                    <button class="team-btn team-btn--danger" data-action="clock-out">Jetzt ausstempeln</button>
                </div>

                <!-- Quick-Log Form -->
                <div class="team-timelog-form">
                    <h3>Neuer Zeiteintrag</h3>
                    <div class="team-timelog-grid">
                        <div class="team-form-group">
                            <label>Mitarbeiter</label>
                            <select id="tl-member">
                                <option value="">-- Waehlen --</option>
                                ${members.map(m => `<option value="${this._esc(m.id)}">${this._esc(m.name)}</option>`).join('')}
                            </select>
                        </div>
                        <div class="team-form-group">
                            <label>Datum</label>
                            <input type="date" id="tl-date" value="${today.toISOString().split('T')[0]}">
                        </div>
                        <div class="team-form-group">
                            <label>Start</label>
                            <input type="time" id="tl-start" value="07:00">
                        </div>
                        <div class="team-form-group">
                            <label>Ende</label>
                            <input type="time" id="tl-end" value="16:00">
                        </div>
                        <div class="team-form-group">
                            <label>Pause (Min)</label>
                            <input type="number" id="tl-break" value="30" min="0" step="5">
                        </div>
                        <div class="team-form-group">
                            <label>Auftrag</label>
                            <select id="tl-order">
                                <option value="">-- Kein Auftrag --</option>
                                ${orders.map(o => `<option value="${this._esc(o.id)}" data-name="${this._esc(o.name)}" data-customer="${this._esc(o.customer)}">${this._esc(o.name)}</option>`).join('')}
                            </select>
                        </div>
                        <div class="team-form-group">
                            <label>Typ</label>
                            <select id="tl-type">
                                <option value="arbeit">Arbeit</option>
                                <option value="fahrt">Fahrt</option>
                                <option value="bereitschaft">Bereitschaft</option>
                                <option value="schulung">Schulung</option>
                            </select>
                        </div>
                        <div class="team-form-group">
                            <label>Notizen</label>
                            <input type="text" id="tl-notes" placeholder="Optionale Notizen">
                        </div>
                    </div>
                    <div style="margin-top: 14px;">
                        <button class="team-btn team-btn--primary" data-action="log-time">Zeit erfassen</button>
                    </div>
                </div>

                <!-- Weekly Timesheet -->
                <div class="team-form-section">
                    <h3>Wochenansicht (${this._formatDate(weekDates[0])} - ${this._formatDate(weekDates[6])})</h3>
                    <div class="team-timesheet">
                        <table class="team-timesheet-table">
                            <thead>
                                <tr>
                                    <th>Mitarbeiter</th>
                                    ${dayLabels.map((label, i) => `<th>${label}<br><span style="font-weight: 400; font-size: 10px;">${this._formatDateShort(weekDates[i])}</span></th>`).join('')}
                                    <th>Gesamt</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${members.filter(m => m.status !== 'inaktiv').map(m => {
                                    let total = 0;
                                    const cells = weekDates.map(date => {
                                        const entries = service.getTimeEntries(m.id, date, date);
                                        const dayHours = entries.reduce((sum, e) => sum + e.totalHours, 0);
                                        total += dayHours;
                                        if (dayHours === 0) {
                                            return '<td><span class="team-timesheet-cell team-timesheet-cell--empty">-</span></td>';
                                        }
                                        const cls = dayHours > 10 ? 'team-timesheet-cell team-timesheet-cell--overtime' : 'team-timesheet-cell';
                                        return `<td><span class="${cls}">${dayHours.toFixed(1).replace('.', ',')}h</span></td>`;
                                    }).join('');

                                    return `
                                        <tr>
                                            <td>
                                                <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: ${this._esc(m.color)}; margin-right: 6px; vertical-align: middle;"></span>
                                                ${this._esc(m.name)}
                                            </td>
                                            ${cells}
                                            <td><strong>${total.toFixed(1).replace('.', ',')}h</strong></td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;

        this._bindTimeLogEvents();
    }

    _bindTimeLogEvents() {
        if (!this.container) { return; }

        // Nav tabs
        this.container.querySelectorAll('.team-nav-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const view = tab.getAttribute('data-team-view');
                if (view) { this.navigate(view); }
            });
        });

        // Log time
        this.container.querySelector('[data-action="log-time"]')?.addEventListener('click', () => {
            this._logTimeFromForm();
        });

        // Clock in
        this.container.querySelector('[data-action="clock-in"]')?.addEventListener('click', () => {
            this._quickClockIn();
        });

        // Clock out
        this.container.querySelector('[data-action="clock-out"]')?.addEventListener('click', () => {
            this._quickClockOut();
        });
    }

    _logTimeFromForm() {
        const service = window.teamService;
        const memberId = this.container.querySelector('#tl-member')?.value;
        if (!memberId) {
            alert('Bitte waehlen Sie einen Mitarbeiter.');
            return;
        }

        const orderSelect = this.container.querySelector('#tl-order');
        const selectedOption = orderSelect?.selectedOptions[0];

        const data = {
            date: this.container.querySelector('#tl-date')?.value || '',
            startTime: this.container.querySelector('#tl-start')?.value || '07:00',
            endTime: this.container.querySelector('#tl-end')?.value || '16:00',
            breakMinutes: parseInt(this.container.querySelector('#tl-break')?.value, 10) || 30,
            orderId: orderSelect?.value || '',
            orderName: selectedOption?.getAttribute('data-name') || '',
            customerName: selectedOption?.getAttribute('data-customer') || '',
            type: this.container.querySelector('#tl-type')?.value || 'arbeit',
            notes: this.container.querySelector('#tl-notes')?.value || ''
        };

        try {
            service.logTime(memberId, data);
            this._showToast('Zeiteintrag erfasst');
            this._renderTimeLog(); // Refresh
        } catch (err) {
            alert('Fehler: ' + err.message);
        }
    }

    _quickClockIn() {
        const memberId = this.container.querySelector('#tl-member')?.value;
        if (!memberId) {
            alert('Bitte waehlen Sie einen Mitarbeiter.');
            return;
        }

        const now = new Date();
        const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        this.container.querySelector('#tl-start').value = time;
        this.container.querySelector('#tl-date').value = now.toISOString().split('T')[0];
        this._showToast(`Eingestempelt: ${time}`);
    }

    _quickClockOut() {
        const memberId = this.container.querySelector('#tl-member')?.value;
        if (!memberId) {
            alert('Bitte waehlen Sie einen Mitarbeiter.');
            return;
        }

        const now = new Date();
        const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        this.container.querySelector('#tl-end').value = time;

        // Auto-submit the form
        this._logTimeFromForm();
    }

    // ============================================
    // 4. Alerts Section
    // ============================================

    _renderAlerts() {
        const service = window.teamService;
        const alerts = [];

        // Expiring insurances
        const expiringIns = service.getExpiringInsurances();
        expiringIns.forEach(item => {
            const daysText = item.expired
                ? `Abgelaufen seit ${Math.abs(item.daysLeft)} Tagen`
                : `Laeuft ab in ${item.daysLeft} Tagen`;

            alerts.push({
                type: item.expired ? 'danger' : 'warning',
                icon: '🛡',
                title: `Versicherung: ${item.member.name}`,
                desc: `${item.member.companyName || ''} - ${daysText} (${this._formatDate(item.member.insuranceExpiry)})`
            });
        });

        // Overtime workers (current month)
        const now = new Date();
        const month = now.getMonth() + 1;
        const year = now.getFullYear();

        service.getActiveMembers().forEach(m => {
            const overtime = service.getOvertime(m.id, month, year);
            if (overtime > 0) {
                alerts.push({
                    type: 'info',
                    icon: '⏰',
                    title: `Ueberstunden: ${m.name}`,
                    desc: `+${overtime.toFixed(1).replace('.', ',')} Stunden diesen Monat`
                });
            }
        });

        // Sick / vacation members
        service.getMembers().forEach(m => {
            if (m.status === 'krank') {
                alerts.push({
                    type: 'danger',
                    icon: '🤒',
                    title: `Krank: ${m.name}`,
                    desc: `${this._getRoleLabel(m)} - Status: krankgemeldet`
                });
            }
            if (m.status === 'urlaub') {
                alerts.push({
                    type: 'warning',
                    icon: '🏖',
                    title: `Urlaub: ${m.name}`,
                    desc: `${this._getRoleLabel(m)} - aktuell im Urlaub`
                });
            }
        });

        this.container.innerHTML = `
            <div class="team-container">
                <!-- Nav Tabs -->
                <div class="team-nav-tabs">
                    <button class="team-nav-tab" data-team-view="overview">Team</button>
                    <button class="team-nav-tab" data-team-view="timelog">Zeiterfassung</button>
                    <button class="team-nav-tab active" data-team-view="alerts">Warnungen (${alerts.length})</button>
                </div>

                <div class="team-header">
                    <h2>Warnungen &amp; Hinweise</h2>
                </div>

                ${alerts.length === 0 ? `
                    <div class="team-empty-state">
                        <div class="team-empty-state-icon">✅</div>
                        <div class="team-empty-state-text">Keine Warnungen</div>
                        <div class="team-empty-state-hint">Alles in Ordnung - es gibt keine offenen Hinweise.</div>
                    </div>
                ` : `
                    <div class="team-alerts-grid">
                        ${alerts.map(a => `
                            <div class="team-alert-card team-alert-card--${a.type}">
                                <div class="team-alert-icon">${a.icon}</div>
                                <div class="team-alert-content">
                                    <div class="team-alert-title">${this._esc(a.title)}</div>
                                    <div class="team-alert-desc">${this._esc(a.desc)}</div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                `}
            </div>
        `;

        // Nav tabs
        this.container.querySelectorAll('.team-nav-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const view = tab.getAttribute('data-team-view');
                if (view) { this.navigate(view); }
            });
        });
    }

    // ============================================
    // Helpers
    // ============================================

    /**
     * Get active orders from the app store, if available
     */
    _getActiveOrders() {
        try {
            // Try AppUtils store first
            if (window.AppUtils && window.AppUtils.store && window.AppUtils.store.auftraege) {
                return window.AppUtils.store.auftraege
                    .filter(a => a.status !== 'abgeschlossen' && a.status !== 'storniert')
                    .map(a => ({
                        id: a.id,
                        name: a.titel || a.name || a.beschreibung || a.id,
                        customer: a.kunde || a.kundenName || ''
                    }));
            }

            // Try storeService
            if (window.storeService && window.storeService.store && window.storeService.store.auftraege) {
                return window.storeService.store.auftraege
                    .filter(a => a.status !== 'abgeschlossen' && a.status !== 'storniert')
                    .map(a => ({
                        id: a.id,
                        name: a.titel || a.name || a.beschreibung || a.id,
                        customer: a.kunde || a.kundenName || ''
                    }));
            }
        } catch (e) {
            console.warn('TeamUI: Konnte Auftraege nicht laden', e);
        }
        return [];
    }

    /**
     * Get Monday of the week containing the given date
     */
    _getMonday(date) {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        return new Date(d.setDate(diff));
    }

    /**
     * Format YYYY-MM-DD to German dd.mm.yyyy
     */
    _formatDate(dateStr) {
        if (!dateStr) { return '-'; }
        const parts = dateStr.split('-');
        if (parts.length !== 3) { return dateStr; }
        return `${parts[2]}.${parts[1]}.${parts[0]}`;
    }

    /**
     * Format YYYY-MM-DD to dd.mm.
     */
    _formatDateShort(dateStr) {
        if (!dateStr) { return ''; }
        const parts = dateStr.split('-');
        if (parts.length !== 3) { return dateStr; }
        return `${parts[2]}.${parts[1]}.`;
    }

    /**
     * Get German label for time entry type
     */
    _getTypeLabel(type) {
        const labels = {
            arbeit: 'Arbeit',
            fahrt: 'Fahrt',
            bereitschaft: 'Bereitschaft',
            schulung: 'Schulung'
        };
        return labels[type] || type;
    }

    /**
     * Show a brief toast notification
     */
    _showToast(message) {
        // Try app-level toast if available
        if (window.ErrorDisplay && typeof window.ErrorDisplay.showSuccess === 'function') {
            window.ErrorDisplay.showSuccess(message);
            return;
        }

        // Fallback: simple DOM toast
        const toast = document.createElement('div');
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            bottom: 24px;
            left: 50%;
            transform: translateX(-50%);
            background: var(--accent-success, #22c55e);
            color: #fff;
            padding: 10px 24px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 500;
            z-index: 10000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.4);
            transition: opacity 0.3s ease;
        `;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 2200);
    }
}

window.teamUI = new TeamUI();
