/* ============================================
   Marketing UI - Automatisiertes Marketing
   Bewertungen, Kampagnen & Saisonale Vorlagen
   ============================================ */

class MarketingUI {
    constructor() {
        this.currentTab = 'uebersicht';
        this.editingCampaignId = null;
        this.initCSS();
    }

    // ============================================
    // CSS Injection
    // ============================================

    initCSS() {
        if (document.getElementById('marketing-ui-styles')) { return; }

        const style = document.createElement('style');
        style.id = 'marketing-ui-styles';
        style.textContent = `
            /* Marketing Container */
            .mkt-container {
                max-width: 1100px;
                margin: 0 auto;
                padding: 16px;
            }

            .mkt-page-title {
                font-size: 22px;
                font-weight: 700;
                margin: 0 0 20px 0;
                color: var(--text-primary, #e4e4e7);
            }

            /* Summary Cards */
            .mkt-summary-row {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 14px;
                margin-bottom: 22px;
            }

            .mkt-stat-card {
                background: var(--bg-secondary, #1c1c21);
                border: 1px solid var(--border-color, #2a2a32);
                border-radius: 10px;
                padding: 18px;
                text-align: center;
            }

            .mkt-stat-number {
                font-size: 28px;
                font-weight: 700;
                color: var(--primary, #3b82f6);
                display: block;
                line-height: 1.2;
            }

            .mkt-stat-label {
                font-size: 13px;
                color: var(--text-muted, #a1a1aa);
                margin-top: 4px;
                display: block;
            }

            /* Google Review Box */
            .mkt-review-box {
                background: var(--bg-secondary, #1c1c21);
                border: 1px solid var(--border-color, #2a2a32);
                border-radius: 10px;
                padding: 18px;
                margin-bottom: 22px;
                display: flex;
                align-items: center;
                gap: 16px;
                flex-wrap: wrap;
            }

            .mkt-review-box-icon {
                font-size: 36px;
                flex-shrink: 0;
            }

            .mkt-review-box-info {
                flex: 1;
                min-width: 200px;
            }

            .mkt-review-box-info h4 {
                margin: 0 0 4px 0;
                font-size: 15px;
                color: var(--text-primary, #e4e4e7);
            }

            .mkt-review-box-info p {
                margin: 0;
                font-size: 13px;
                color: var(--text-muted, #a1a1aa);
                word-break: break-all;
            }

            .mkt-review-box .mkt-btn {
                flex-shrink: 0;
            }

            /* Tabs */
            .mkt-tabs {
                display: flex;
                gap: 0;
                border-bottom: 2px solid var(--border-color, #2a2a32);
                margin-bottom: 20px;
            }

            .mkt-tab-btn {
                padding: 10px 20px;
                background: none;
                border: none;
                border-bottom: 3px solid transparent;
                color: var(--text-muted, #a1a1aa);
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s ease;
                margin-bottom: -2px;
            }

            .mkt-tab-btn:hover {
                color: var(--text-primary, #e4e4e7);
            }

            .mkt-tab-btn.active {
                color: var(--primary, #3b82f6);
                border-bottom-color: var(--primary, #3b82f6);
                font-weight: 600;
            }

            .mkt-tab-content {
                display: none;
            }

            .mkt-tab-content.active {
                display: block;
            }

            /* Buttons */
            .mkt-btn {
                display: inline-flex;
                align-items: center;
                gap: 6px;
                padding: 8px 16px;
                border: none;
                border-radius: 6px;
                font-size: 13px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s ease;
                white-space: nowrap;
            }

            .mkt-btn-primary {
                background: var(--primary, #3b82f6);
                color: #fff;
            }

            .mkt-btn-primary:hover {
                background: #2563eb;
            }

            .mkt-btn-secondary {
                background: var(--bg-secondary, #27272a);
                color: var(--text-primary, #e4e4e7);
                border: 1px solid var(--border-color, #3a3a42);
            }

            .mkt-btn-secondary:hover {
                background: var(--border-color, #3a3a42);
            }

            .mkt-btn-danger {
                background: #dc2626;
                color: #fff;
            }

            .mkt-btn-danger:hover {
                background: #b91c1c;
            }

            .mkt-btn-success {
                background: #16a34a;
                color: #fff;
            }

            .mkt-btn-success:hover {
                background: #15803d;
            }

            .mkt-btn-small {
                padding: 5px 10px;
                font-size: 12px;
            }

            /* Review Request List */
            .mkt-request-list {
                display: flex;
                flex-direction: column;
                gap: 10px;
            }

            .mkt-request-item {
                background: var(--bg-secondary, #1c1c21);
                border: 1px solid var(--border-color, #2a2a32);
                border-radius: 8px;
                padding: 14px 16px;
                display: flex;
                align-items: center;
                gap: 14px;
                flex-wrap: wrap;
            }

            .mkt-request-info {
                flex: 1;
                min-width: 180px;
            }

            .mkt-request-name {
                font-weight: 600;
                font-size: 14px;
                color: var(--text-primary, #e4e4e7);
            }

            .mkt-request-order {
                font-size: 12px;
                color: var(--text-muted, #a1a1aa);
                margin-top: 2px;
            }

            .mkt-request-meta {
                font-size: 12px;
                color: var(--text-muted, #a1a1aa);
                min-width: 120px;
                text-align: center;
            }

            .mkt-request-actions {
                display: flex;
                gap: 6px;
                flex-shrink: 0;
            }

            /* Status Badges */
            .mkt-badge {
                display: inline-block;
                padding: 3px 10px;
                border-radius: 12px;
                font-size: 11px;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 0.3px;
            }

            .mkt-badge-geplant { background: #3b82f622; color: #60a5fa; }
            .mkt-badge-gesendet { background: #f59e0b22; color: #fbbf24; }
            .mkt-badge-beantwortet { background: #22c55e22; color: #4ade80; }
            .mkt-badge-abgelehnt { background: #ef444422; color: #f87171; }
            .mkt-badge-entwurf { background: #6b728022; color: #9ca3af; }
            .mkt-badge-abgeschlossen { background: #22c55e22; color: #4ade80; }

            /* Campaign Cards */
            .mkt-campaign-list {
                display: flex;
                flex-direction: column;
                gap: 10px;
            }

            .mkt-campaign-item {
                background: var(--bg-secondary, #1c1c21);
                border: 1px solid var(--border-color, #2a2a32);
                border-radius: 8px;
                padding: 14px 16px;
                display: flex;
                align-items: center;
                gap: 14px;
                flex-wrap: wrap;
            }

            .mkt-campaign-info {
                flex: 1;
                min-width: 180px;
            }

            .mkt-campaign-name {
                font-weight: 600;
                font-size: 14px;
                color: var(--text-primary, #e4e4e7);
            }

            .mkt-campaign-detail {
                font-size: 12px;
                color: var(--text-muted, #a1a1aa);
                margin-top: 2px;
            }

            .mkt-campaign-meta {
                font-size: 12px;
                color: var(--text-muted, #a1a1aa);
                min-width: 100px;
                text-align: center;
            }

            .mkt-campaign-actions {
                display: flex;
                gap: 6px;
                flex-shrink: 0;
            }

            /* Seasonal Template Cards */
            .mkt-template-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
                gap: 14px;
            }

            .mkt-template-card {
                background: var(--bg-secondary, #1c1c21);
                border: 1px solid var(--border-color, #2a2a32);
                border-radius: 10px;
                padding: 18px;
                transition: border-color 0.2s ease;
            }

            .mkt-template-card:hover {
                border-color: var(--primary, #3b82f6);
            }

            .mkt-template-header {
                display: flex;
                align-items: center;
                gap: 10px;
                margin-bottom: 10px;
            }

            .mkt-template-icon {
                font-size: 28px;
                flex-shrink: 0;
            }

            .mkt-template-title {
                font-weight: 600;
                font-size: 15px;
                color: var(--text-primary, #e4e4e7);
            }

            .mkt-template-months {
                font-size: 12px;
                color: var(--primary, #3b82f6);
                margin-bottom: 8px;
            }

            .mkt-template-preview {
                font-size: 13px;
                color: var(--text-muted, #a1a1aa);
                line-height: 1.5;
                margin-bottom: 12px;
                max-height: 70px;
                overflow: hidden;
                text-overflow: ellipsis;
            }

            /* Forms */
            .mkt-form {
                background: var(--bg-secondary, #1c1c21);
                border: 1px solid var(--border-color, #2a2a32);
                border-radius: 10px;
                padding: 20px;
                margin-bottom: 20px;
            }

            .mkt-form-title {
                font-size: 16px;
                font-weight: 600;
                margin: 0 0 16px 0;
                color: var(--text-primary, #e4e4e7);
            }

            .mkt-form-row {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 14px;
                margin-bottom: 14px;
            }

            .mkt-form-row-full {
                margin-bottom: 14px;
            }

            .mkt-form-group label {
                display: block;
                font-size: 13px;
                font-weight: 500;
                color: var(--text-muted, #a1a1aa);
                margin-bottom: 5px;
            }

            .mkt-form-group input,
            .mkt-form-group select,
            .mkt-form-group textarea {
                width: 100%;
                padding: 8px 12px;
                background: var(--bg-primary, #09090b);
                border: 1px solid var(--border-color, #3a3a42);
                border-radius: 6px;
                color: var(--text-primary, #e4e4e7);
                font-size: 13px;
                font-family: inherit;
                box-sizing: border-box;
            }

            .mkt-form-group textarea {
                min-height: 120px;
                resize: vertical;
            }

            .mkt-form-group input:focus,
            .mkt-form-group select:focus,
            .mkt-form-group textarea:focus {
                outline: none;
                border-color: var(--primary, #3b82f6);
            }

            .mkt-form-actions {
                display: flex;
                gap: 10px;
                margin-top: 16px;
            }

            .mkt-tpl-vars {
                display: flex;
                gap: 6px;
                margin-bottom: 8px;
                flex-wrap: wrap;
            }

            .mkt-tpl-var-btn {
                padding: 4px 10px;
                background: var(--primary, #3b82f6);
                color: #fff;
                border: none;
                border-radius: 4px;
                font-size: 11px;
                cursor: pointer;
                opacity: 0.8;
            }

            .mkt-tpl-var-btn:hover {
                opacity: 1;
            }

            /* Toggle Switch */
            .mkt-toggle-row {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 12px 16px;
                background: var(--bg-secondary, #1c1c21);
                border: 1px solid var(--border-color, #2a2a32);
                border-radius: 8px;
                margin-bottom: 16px;
            }

            .mkt-toggle-label {
                flex: 1;
                font-size: 14px;
                color: var(--text-primary, #e4e4e7);
            }

            .mkt-toggle-sub {
                font-size: 12px;
                color: var(--text-muted, #a1a1aa);
                display: block;
            }

            .mkt-toggle {
                position: relative;
                width: 44px;
                height: 24px;
                flex-shrink: 0;
            }

            .mkt-toggle input {
                opacity: 0;
                width: 0;
                height: 0;
            }

            .mkt-toggle-slider {
                position: absolute;
                cursor: pointer;
                top: 0; left: 0; right: 0; bottom: 0;
                background: #52525b;
                border-radius: 24px;
                transition: 0.2s;
            }

            .mkt-toggle-slider:before {
                content: '';
                position: absolute;
                height: 18px;
                width: 18px;
                left: 3px;
                bottom: 3px;
                background: #fff;
                border-radius: 50%;
                transition: 0.2s;
            }

            .mkt-toggle input:checked + .mkt-toggle-slider {
                background: var(--primary, #3b82f6);
            }

            .mkt-toggle input:checked + .mkt-toggle-slider:before {
                transform: translateX(20px);
            }

            /* Message Preview */
            .mkt-msg-preview {
                background: var(--bg-primary, #09090b);
                border: 1px solid var(--border-color, #2a2a32);
                border-radius: 8px;
                padding: 14px;
                margin-top: 10px;
                font-size: 13px;
                line-height: 1.6;
                color: var(--text-muted, #a1a1aa);
                white-space: pre-wrap;
                max-height: 200px;
                overflow-y: auto;
            }

            /* Empty State */
            .mkt-empty {
                text-align: center;
                padding: 40px 20px;
                color: var(--text-muted, #a1a1aa);
                font-size: 14px;
            }

            .mkt-empty-icon {
                font-size: 40px;
                display: block;
                margin-bottom: 10px;
            }

            /* Modal Overlay */
            .mkt-modal-overlay {
                position: fixed;
                top: 0; left: 0; right: 0; bottom: 0;
                background: rgba(0,0,0,0.6);
                z-index: 9999;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
            }

            .mkt-modal {
                background: var(--bg-primary, #09090b);
                border: 1px solid var(--border-color, #2a2a32);
                border-radius: 12px;
                padding: 24px;
                max-width: 600px;
                width: 100%;
                max-height: 80vh;
                overflow-y: auto;
            }

            .mkt-modal-title {
                font-size: 18px;
                font-weight: 600;
                margin: 0 0 16px 0;
                color: var(--text-primary, #e4e4e7);
            }

            /* Responsive */
            @media (max-width: 600px) {
                .mkt-summary-row {
                    grid-template-columns: 1fr 1fr;
                }
                .mkt-form-row {
                    grid-template-columns: 1fr;
                }
                .mkt-template-grid {
                    grid-template-columns: 1fr;
                }
                .mkt-request-item,
                .mkt-campaign-item {
                    flex-direction: column;
                    align-items: stretch;
                }
                .mkt-request-meta,
                .mkt-campaign-meta {
                    text-align: left;
                }
            }
        `;
        document.head.appendChild(style);
    }

    // ============================================
    // XSS Escape
    // ============================================

    _esc(str) {
        if (!str) { return ''; }
        const el = document.createElement('span');
        el.textContent = str;
        return el.innerHTML;
    }

    // ============================================
    // Main Render
    // ============================================

    render(containerId) {
        const container = document.getElementById(containerId);
        if (!container) { return; }

        const svc = window.marketingService;
        if (!svc) {
            container.innerHTML = '<p>Marketing-Service nicht geladen.</p>';
            return;
        }

        const stats = svc.getMarketingStats();

        container.innerHTML = `
            <div class="mkt-container">
                <h2 class="mkt-page-title">Automatisiertes Marketing</h2>

                <!-- Summary Cards -->
                <div class="mkt-summary-row">
                    <div class="mkt-stat-card">
                        <span class="mkt-stat-number">${stats.reviewRequests.gesendet + stats.reviewRequests.beantwortet}</span>
                        <span class="mkt-stat-label">Bewertungen angefragt</span>
                    </div>
                    <div class="mkt-stat-card">
                        <span class="mkt-stat-number">${stats.campaigns.geplant + stats.campaigns.entwurf}</span>
                        <span class="mkt-stat-label">Kampagnen aktiv</span>
                    </div>
                    <div class="mkt-stat-card">
                        <span class="mkt-stat-number">${stats.reviewRequests.beantwortet}</span>
                        <span class="mkt-stat-label">Bewertungen erhalten</span>
                    </div>
                    <div class="mkt-stat-card">
                        <span class="mkt-stat-number">${stats.campaigns.totalSent}</span>
                        <span class="mkt-stat-label">Nachrichten gesendet</span>
                    </div>
                </div>

                <!-- Google Review Box -->
                ${this._renderGoogleReviewBox(svc)}

                <!-- Tabs -->
                <div class="mkt-tabs">
                    <button class="mkt-tab-btn ${this.currentTab === 'bewertungen' ? 'active' : ''}" data-mkt-tab="bewertungen">Bewertungen</button>
                    <button class="mkt-tab-btn ${this.currentTab === 'kampagnen' ? 'active' : ''}" data-mkt-tab="kampagnen">Kampagnen</button>
                    <button class="mkt-tab-btn ${this.currentTab === 'vorlagen' ? 'active' : ''}" data-mkt-tab="vorlagen">Vorlagen</button>
                </div>

                <!-- Tab Content: Bewertungen -->
                <div class="mkt-tab-content ${this.currentTab === 'bewertungen' ? 'active' : ''}" id="mkt-tab-bewertungen">
                    ${this._renderReviewsTab(svc)}
                </div>

                <!-- Tab Content: Kampagnen -->
                <div class="mkt-tab-content ${this.currentTab === 'kampagnen' ? 'active' : ''}" id="mkt-tab-kampagnen">
                    ${this._renderCampaignsTab(svc)}
                </div>

                <!-- Tab Content: Vorlagen -->
                <div class="mkt-tab-content ${this.currentTab === 'vorlagen' ? 'active' : ''}" id="mkt-tab-vorlagen">
                    ${this._renderTemplatesTab(svc)}
                </div>
            </div>
        `;

        this._attachEventListeners(containerId);
    }

    // ============================================
    // Google Review Box
    // ============================================

    _renderGoogleReviewBox(svc) {
        const url = svc.getGoogleReviewUrl();
        const stats = svc.getMarketingStats();

        if (url) {
            return `
                <div class="mkt-review-box">
                    <div class="mkt-review-box-icon">&#11088;</div>
                    <div class="mkt-review-box-info">
                        <h4>Google-Bewertungslink eingerichtet</h4>
                        <p>${this._esc(url)}</p>
                    </div>
                    <button class="mkt-btn mkt-btn-secondary mkt-btn-small" data-mkt-action="edit-review-url">Aendern</button>
                </div>
            `;
        }

        return `
            <div class="mkt-review-box">
                <div class="mkt-review-box-icon">&#11088;</div>
                <div class="mkt-review-box-info">
                    <h4>Google-Bewertungslink einrichten</h4>
                    <p>Hinterlegen Sie Ihren Google-Bewertungslink, damit Kunden mit einem Klick bewerten koennen.</p>
                </div>
                <button class="mkt-btn mkt-btn-primary" data-mkt-action="edit-review-url">Bewertungslink einrichten</button>
            </div>
        `;
    }

    // ============================================
    // Reviews Tab
    // ============================================

    _renderReviewsTab(svc) {
        const settings = svc.getSettings();
        const requests = svc.getReviewRequests();

        let html = '';

        // Auto-schedule toggle
        html += `
            <div class="mkt-toggle-row">
                <div class="mkt-toggle-label">
                    Automatisch Bewertungen anfragen
                    <span class="mkt-toggle-sub">Sendet ${settings.defaultDelayDays || 7} Tage nach Auftragsabschluss automatisch eine Bewertungsanfrage</span>
                </div>
                <label class="mkt-toggle">
                    <input type="checkbox" id="mkt-auto-review-toggle" ${settings.autoScheduleEnabled ? 'checked' : ''}>
                    <span class="mkt-toggle-slider"></span>
                </label>
            </div>
        `;

        // Action buttons
        html += `
            <div style="display: flex; gap: 10px; margin-bottom: 16px; flex-wrap: wrap;">
                <button class="mkt-btn mkt-btn-primary" data-mkt-action="manual-review">Bewertung anfragen</button>
                <button class="mkt-btn mkt-btn-secondary" data-mkt-action="auto-schedule-now">Alle abgeschlossenen Auftraege pruefen</button>
            </div>
        `;

        // Request list
        if (requests.length === 0) {
            html += `
                <div class="mkt-empty">
                    <span class="mkt-empty-icon">&#11088;</span>
                    Noch keine Bewertungsanfragen. Erstellen Sie Ihre erste Anfrage!
                </div>
            `;
        } else {
            html += '<div class="mkt-request-list">';
            requests.forEach(req => {
                const statusClass = 'mkt-badge-' + req.status;
                const statusLabel = this._getReviewStatusLabel(req.status);

                html += `
                    <div class="mkt-request-item">
                        <div class="mkt-request-info">
                            <div class="mkt-request-name">${this._esc(req.customerName)}</div>
                            <div class="mkt-request-order">${this._esc(req.orderDescription)} &middot; ${this._esc(req.channel)}</div>
                        </div>
                        <div class="mkt-request-meta">
                            <span class="mkt-badge ${statusClass}">${statusLabel}</span>
                            <div style="margin-top: 4px;">${this._formatDate(req.scheduledDate)}</div>
                        </div>
                        <div class="mkt-request-actions">
                            ${req.status === 'geplant' ? `
                                <button class="mkt-btn mkt-btn-success mkt-btn-small" data-mkt-action="send-review" data-mkt-id="${this._esc(req.id)}">Jetzt senden</button>
                                <button class="mkt-btn mkt-btn-secondary mkt-btn-small" data-mkt-action="preview-review" data-mkt-id="${this._esc(req.id)}">Vorschau</button>
                                <button class="mkt-btn mkt-btn-danger mkt-btn-small" data-mkt-action="cancel-review" data-mkt-id="${this._esc(req.id)}">Abbrechen</button>
                            ` : ''}
                            ${req.status === 'gesendet' ? `
                                <button class="mkt-btn mkt-btn-success mkt-btn-small" data-mkt-action="mark-answered" data-mkt-id="${this._esc(req.id)}">Bewertet!</button>
                            ` : ''}
                        </div>
                    </div>
                `;
            });
            html += '</div>';
        }

        return html;
    }

    // ============================================
    // Campaigns Tab
    // ============================================

    _renderCampaignsTab(svc) {
        const campaigns = svc.getCampaigns();

        let html = '';

        // New campaign button
        html += `
            <div style="display: flex; gap: 10px; margin-bottom: 16px;">
                <button class="mkt-btn mkt-btn-primary" data-mkt-action="new-campaign">Neue Kampagne</button>
            </div>
        `;

        // Campaign form (hidden by default, shown when creating/editing)
        html += '<div id="mkt-campaign-form-container"></div>';

        // Campaign list
        if (campaigns.length === 0) {
            html += `
                <div class="mkt-empty">
                    <span class="mkt-empty-icon">&#128232;</span>
                    Noch keine Kampagnen erstellt. Starten Sie mit einer saisonalen Vorlage!
                </div>
            `;
        } else {
            html += '<div class="mkt-campaign-list">';
            campaigns.forEach(c => {
                const statusClass = 'mkt-badge-' + c.status;
                const statusLabel = this._getCampaignStatusLabel(c.status);
                const typeLabel = this._getCampaignTypeLabel(c.type);

                html += `
                    <div class="mkt-campaign-item">
                        <div class="mkt-campaign-info">
                            <div class="mkt-campaign-name">${this._esc(c.name)}</div>
                            <div class="mkt-campaign-detail">${typeLabel} &middot; ${this._esc(c.channel)} &middot; Zielgruppe: ${this._getTargetGroupLabel(c.targetGroup)}</div>
                        </div>
                        <div class="mkt-campaign-meta">
                            <span class="mkt-badge ${statusClass}">${statusLabel}</span>
                            <div style="margin-top: 4px;">${this._formatDate(c.scheduledDate)}</div>
                            ${c.sentCount > 0 ? `<div style="margin-top: 2px;">${c.sentCount} gesendet</div>` : ''}
                        </div>
                        <div class="mkt-campaign-actions">
                            ${c.status === 'entwurf' || c.status === 'geplant' ? `
                                <button class="mkt-btn mkt-btn-success mkt-btn-small" data-mkt-action="send-campaign" data-mkt-id="${this._esc(c.id)}">Senden</button>
                                <button class="mkt-btn mkt-btn-secondary mkt-btn-small" data-mkt-action="edit-campaign" data-mkt-id="${this._esc(c.id)}">Bearbeiten</button>
                                <button class="mkt-btn mkt-btn-danger mkt-btn-small" data-mkt-action="delete-campaign" data-mkt-id="${this._esc(c.id)}">Loeschen</button>
                            ` : ''}
                        </div>
                    </div>
                `;
            });
            html += '</div>';
        }

        return html;
    }

    // ============================================
    // Templates Tab
    // ============================================

    _renderTemplatesTab(svc) {
        const templates = svc.getSeasonalTemplates();

        let html = '<div class="mkt-template-grid">';

        templates.forEach(tpl => {
            const previewText = tpl.message.replace(/\{\{name\}\}/g, 'Max Mustermann').replace(/\{\{firma\}\}/g, 'Musterbetrieb').substring(0, 140) + '...';

            html += `
                <div class="mkt-template-card">
                    <div class="mkt-template-header">
                        <span class="mkt-template-icon">${tpl.seasonIcon}</span>
                        <span class="mkt-template-title">${this._esc(tpl.name)}</span>
                    </div>
                    <div class="mkt-template-months">Beste Zeit: ${this._esc(tpl.bestMonths)}</div>
                    <div class="mkt-template-preview">${this._esc(previewText)}</div>
                    <div style="display: flex; gap: 6px;">
                        <button class="mkt-btn mkt-btn-primary mkt-btn-small" data-mkt-action="use-template" data-mkt-tpl="${this._esc(tpl.id)}">Verwenden</button>
                        <button class="mkt-btn mkt-btn-secondary mkt-btn-small" data-mkt-action="preview-template" data-mkt-tpl="${this._esc(tpl.id)}">Vorschau</button>
                    </div>
                </div>
            `;
        });

        html += '</div>';

        // Maintenance reminder template at bottom
        html += `
            <div style="margin-top: 20px;">
                <div class="mkt-template-card" style="max-width: 400px;">
                    <div class="mkt-template-header">
                        <span class="mkt-template-icon">&#128295;</span>
                        <span class="mkt-template-title">Wartungserinnerung</span>
                    </div>
                    <div class="mkt-template-months">Ganzjaehrig - fuer Bestandskunden</div>
                    <div class="mkt-template-preview">Erinnert Kunden an faellige Wartungsarbeiten nach X Monaten.</div>
                    <button class="mkt-btn mkt-btn-primary mkt-btn-small" data-mkt-action="use-maintenance-template">Verwenden</button>
                </div>
            </div>
        `;

        return html;
    }

    // ============================================
    // Campaign Form
    // ============================================

    _renderCampaignForm(campaignData) {
        const data = campaignData || {};
        const isEditing = !!data.id;

        return `
            <div class="mkt-form" id="mkt-campaign-form">
                <h3 class="mkt-form-title">${isEditing ? 'Kampagne bearbeiten' : 'Neue Kampagne erstellen'}</h3>

                <div class="mkt-form-row">
                    <div class="mkt-form-group">
                        <label>Kampagnenname</label>
                        <input type="text" id="mkt-c-name" value="${this._esc(data.name || '')}" placeholder="z.B. Herbst-Wartungsaktion">
                    </div>
                    <div class="mkt-form-group">
                        <label>Typ</label>
                        <select id="mkt-c-type">
                            <option value="saisonal" ${data.type === 'saisonal' ? 'selected' : ''}>Saisonal</option>
                            <option value="erinnerung" ${data.type === 'erinnerung' ? 'selected' : ''}>Erinnerung</option>
                            <option value="angebot" ${data.type === 'angebot' ? 'selected' : ''}>Angebot</option>
                            <option value="info" ${data.type === 'info' ? 'selected' : ''}>Information</option>
                        </select>
                    </div>
                </div>

                <div class="mkt-form-row">
                    <div class="mkt-form-group">
                        <label>Zielgruppe</label>
                        <select id="mkt-c-target">
                            <option value="alle" ${data.targetGroup === 'alle' ? 'selected' : ''}>Alle Kunden</option>
                            <option value="aktive_kunden" ${data.targetGroup === 'aktive_kunden' ? 'selected' : ''}>Aktive Kunden</option>
                            <option value="inaktive_kunden" ${data.targetGroup === 'inaktive_kunden' ? 'selected' : ''}>Inaktive Kunden</option>
                            <option value="wartungskunden" ${data.targetGroup === 'wartungskunden' ? 'selected' : ''}>Wartungskunden</option>
                        </select>
                    </div>
                    <div class="mkt-form-group">
                        <label>Kanal</label>
                        <select id="mkt-c-channel">
                            <option value="email" ${data.channel === 'email' ? 'selected' : ''}>E-Mail</option>
                            <option value="sms" ${data.channel === 'sms' ? 'selected' : ''}>SMS</option>
                            <option value="whatsapp" ${data.channel === 'whatsapp' ? 'selected' : ''}>WhatsApp</option>
                        </select>
                    </div>
                </div>

                <div class="mkt-form-row-full">
                    <div class="mkt-form-group">
                        <label>Betreff</label>
                        <input type="text" id="mkt-c-subject" value="${this._esc(data.subject || '')}" placeholder="Betreffzeile der Nachricht">
                    </div>
                </div>

                <div class="mkt-form-row-full">
                    <div class="mkt-form-group">
                        <label>Nachricht</label>
                        <div class="mkt-tpl-vars">
                            <button class="mkt-tpl-var-btn" data-mkt-var="{{name}}">{{name}}</button>
                            <button class="mkt-tpl-var-btn" data-mkt-var="{{firma}}">{{firma}}</button>
                            <button class="mkt-tpl-var-btn" data-mkt-var="{{datum}}">{{datum}}</button>
                        </div>
                        <textarea id="mkt-c-message" placeholder="Ihre Nachricht an die Kunden...">${this._esc(data.message || '')}</textarea>
                    </div>
                </div>

                <div class="mkt-form-row">
                    <div class="mkt-form-group">
                        <label>Geplantes Sendedatum</label>
                        <input type="date" id="mkt-c-date" value="${data.scheduledDate || new Date().toISOString().split('T')[0]}">
                    </div>
                    <div class="mkt-form-group">
                        <label>Wiederkehrend</label>
                        <select id="mkt-c-recurring">
                            <option value="nein" ${!data.recurring ? 'selected' : ''}>Einmalig</option>
                            <option value="monatlich" ${data.recurring && data.recurringInterval === 'monatlich' ? 'selected' : ''}>Monatlich</option>
                            <option value="quartalsweise" ${data.recurring && data.recurringInterval === 'quartalsweise' ? 'selected' : ''}>Quartalsweise</option>
                            <option value="jaehrlich" ${data.recurring && data.recurringInterval === 'jaehrlich' ? 'selected' : ''}>Jaehrlich</option>
                        </select>
                    </div>
                </div>

                <div class="mkt-form-actions">
                    <button class="mkt-btn mkt-btn-primary" data-mkt-action="save-campaign" data-mkt-editing="${data.id || ''}">${isEditing ? 'Speichern' : 'Kampagne erstellen'}</button>
                    <button class="mkt-btn mkt-btn-secondary" data-mkt-action="cancel-campaign-form">Abbrechen</button>
                </div>
            </div>
        `;
    }

    // ============================================
    // Event Listeners
    // ============================================

    _attachEventListeners(containerId) {
        const container = document.getElementById(containerId);
        if (!container) { return; }

        container.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-mkt-action]');
            if (!btn) { return; }

            const action = btn.getAttribute('data-mkt-action');
            const id = btn.getAttribute('data-mkt-id');
            const tplId = btn.getAttribute('data-mkt-tpl');
            const editingId = btn.getAttribute('data-mkt-editing');

            switch (action) {
                // Tabs
                case 'tab':
                    break;

                // Google Review URL
                case 'edit-review-url':
                    this._showReviewUrlDialog(containerId);
                    break;

                // Reviews
                case 'manual-review':
                    this._showManualReviewDialog(containerId);
                    break;
                case 'auto-schedule-now':
                    this._autoScheduleNow(containerId);
                    break;
                case 'send-review':
                    this._sendReview(id, containerId);
                    break;
                case 'preview-review':
                    this._previewReview(id);
                    break;
                case 'cancel-review':
                    this._cancelReview(id, containerId);
                    break;
                case 'mark-answered':
                    this._markReviewAnswered(id, containerId);
                    break;

                // Campaigns
                case 'new-campaign':
                    this._showCampaignForm(null, containerId);
                    break;
                case 'edit-campaign':
                    this._showCampaignForm(id, containerId);
                    break;
                case 'save-campaign':
                    this._saveCampaign(editingId, containerId);
                    break;
                case 'cancel-campaign-form':
                    this._hideCampaignForm(containerId);
                    break;
                case 'send-campaign':
                    this._sendCampaign(id, containerId);
                    break;
                case 'delete-campaign':
                    this._deleteCampaign(id, containerId);
                    break;

                // Templates
                case 'use-template':
                    this._useTemplate(tplId, containerId);
                    break;
                case 'preview-template':
                    this._previewTemplate(tplId);
                    break;
                case 'use-maintenance-template':
                    this._useMaintenanceTemplate(containerId);
                    break;
            }
        });

        // Tab switching
        container.querySelectorAll('.mkt-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.getAttribute('data-mkt-tab');
                this.currentTab = tab;
                this.render(containerId);
            });
        });

        // Auto-schedule toggle
        const autoToggle = container.querySelector('#mkt-auto-review-toggle');
        if (autoToggle) {
            autoToggle.addEventListener('change', () => {
                window.marketingService.updateSettings({
                    autoScheduleEnabled: autoToggle.checked
                });
            });
        }

        // Template variable buttons (for campaign form)
        container.querySelectorAll('.mkt-tpl-var-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const varText = btn.getAttribute('data-mkt-var');
                const textarea = container.querySelector('#mkt-c-message');
                if (textarea) {
                    const start = textarea.selectionStart;
                    const end = textarea.selectionEnd;
                    const text = textarea.value;
                    textarea.value = text.substring(0, start) + varText + text.substring(end);
                    textarea.selectionStart = textarea.selectionEnd = start + varText.length;
                    textarea.focus();
                }
            });
        });
    }

    // ============================================
    // Action Handlers
    // ============================================

    _showReviewUrlDialog(containerId) {
        const svc = window.marketingService;
        const currentUrl = svc.getGoogleReviewUrl();

        const url = prompt(
            'Google-Bewertungslink eingeben:\n\n' +
            'Tipp: Suchen Sie Ihren Betrieb auf Google Maps,\n' +
            'klicken Sie auf "Rezension schreiben" und kopieren Sie den Link.',
            currentUrl || 'https://g.page/IHR-BETRIEB/review'
        );

        if (url !== null) {
            svc.setGoogleReviewUrl(url.trim());
            this.render(containerId);
        }
    }

    _showManualReviewDialog(containerId) {
        const svc = window.marketingService;

        // Get available orders
        let auftraege = [];
        if (window.storeService) {
            const s = window.storeService.getStore();
            auftraege = (s.auftraege || []).filter(a => a.status === 'abgeschlossen');
        } else if (typeof store !== 'undefined') {
            auftraege = (store.auftraege || []).filter(a => a.status === 'abgeschlossen');
        }

        if (auftraege.length === 0) {
            alert('Keine abgeschlossenen Auftraege vorhanden.\nBewertungsanfragen koennen nur fuer abgeschlossene Auftraege erstellt werden.');
            return;
        }

        // Build a simple selection list
        let listText = 'Bitte waehlen Sie den Auftrag (Nummer eingeben):\n\n';
        auftraege.forEach((a, i) => {
            const name = a.kunde || a.kundenName || 'Kunde';
            const title = a.titel || a.beschreibung || a.id;
            listText += `${i + 1}. ${name} - ${title}\n`;
        });

        const selection = prompt(listText);
        if (!selection) { return; }

        const index = parseInt(selection) - 1;
        if (isNaN(index) || index < 0 || index >= auftraege.length) {
            alert('Ungueltige Auswahl.');
            return;
        }

        const delayStr = prompt('In wie vielen Tagen soll die Anfrage gesendet werden?', '7');
        const delay = parseInt(delayStr) || 7;

        const result = svc.scheduleReviewRequest(auftraege[index].id, delay);
        if (result) {
            this.render(containerId);
            if (window.errorHandler) {
                window.errorHandler.success('Bewertungsanfrage geplant fuer ' + result.customerName);
            }
        }
    }

    _autoScheduleNow(containerId) {
        const svc = window.marketingService;
        const result = svc.autoScheduleReviewRequests();

        if (result.scheduled > 0) {
            this.render(containerId);
            if (window.errorHandler) {
                window.errorHandler.success(result.scheduled + ' neue Bewertungsanfrage(n) geplant');
            }
        } else {
            alert('Keine neuen abgeschlossenen Auftraege ohne Bewertungsanfrage gefunden.');
        }
    }

    _sendReview(id, containerId) {
        const svc = window.marketingService;
        if (!confirm('Bewertungsanfrage jetzt senden?')) { return; }

        const result = svc.sendReviewRequest(id);
        if (result.success) {
            this.render(containerId);
            if (window.errorHandler) {
                window.errorHandler.success('Bewertungsanfrage gesendet!');
            }
        } else {
            alert('Fehler: ' + result.error);
        }
    }

    _previewReview(id) {
        const svc = window.marketingService;
        const request = svc.getReviewRequest(id);
        if (!request) { return; }

        const message = svc.generateReviewMessage(request.customerName, request.orderDescription);
        this._showPreviewModal('Vorschau: Bewertungsanfrage', message);
    }

    _cancelReview(id, containerId) {
        if (!confirm('Bewertungsanfrage abbrechen?')) { return; }

        window.marketingService.cancelReviewRequest(id);
        this.render(containerId);
    }

    _markReviewAnswered(id, containerId) {
        window.marketingService.markAsAnswered(id);
        this.render(containerId);
        if (window.errorHandler) {
            window.errorHandler.success('Als beantwortet markiert. Vielen Dank!');
        }
    }

    // Campaign actions

    _showCampaignForm(campaignId, containerId) {
        const container = document.getElementById(containerId);
        const formContainer = container?.querySelector('#mkt-campaign-form-container');
        if (!formContainer) { return; }

        let data = {};
        if (campaignId) {
            data = window.marketingService.getCampaign(campaignId) || {};
        }

        formContainer.innerHTML = this._renderCampaignForm(data);
        this.editingCampaignId = campaignId || null;

        // Re-attach template variable button listeners
        formContainer.querySelectorAll('.mkt-tpl-var-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const varText = btn.getAttribute('data-mkt-var');
                const textarea = formContainer.querySelector('#mkt-c-message');
                if (textarea) {
                    const start = textarea.selectionStart;
                    const end = textarea.selectionEnd;
                    const text = textarea.value;
                    textarea.value = text.substring(0, start) + varText + text.substring(end);
                    textarea.selectionStart = textarea.selectionEnd = start + varText.length;
                    textarea.focus();
                }
            });
        });

        // Re-attach save/cancel listeners
        formContainer.querySelectorAll('[data-mkt-action]').forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.getAttribute('data-mkt-action');
                if (action === 'save-campaign') {
                    this._saveCampaign(btn.getAttribute('data-mkt-editing'), containerId);
                } else if (action === 'cancel-campaign-form') {
                    this._hideCampaignForm(containerId);
                }
            });
        });

        // Scroll into view
        formContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    _hideCampaignForm(containerId) {
        const container = document.getElementById(containerId);
        const formContainer = container?.querySelector('#mkt-campaign-form-container');
        if (formContainer) {
            formContainer.innerHTML = '';
        }
        this.editingCampaignId = null;
    }

    _saveCampaign(editingId, containerId) {
        const container = document.getElementById(containerId);
        if (!container) { return; }

        const name = container.querySelector('#mkt-c-name')?.value?.trim();
        const type = container.querySelector('#mkt-c-type')?.value;
        const targetGroup = container.querySelector('#mkt-c-target')?.value;
        const channel = container.querySelector('#mkt-c-channel')?.value;
        const subject = container.querySelector('#mkt-c-subject')?.value?.trim();
        const message = container.querySelector('#mkt-c-message')?.value?.trim();
        const scheduledDate = container.querySelector('#mkt-c-date')?.value;
        const recurringVal = container.querySelector('#mkt-c-recurring')?.value;

        if (!name) {
            alert('Bitte geben Sie einen Kampagnennamen ein.');
            return;
        }
        if (!message) {
            alert('Bitte geben Sie eine Nachricht ein.');
            return;
        }

        const recurring = recurringVal !== 'nein';
        const recurringInterval = recurring ? recurringVal : 'jaehrlich';

        const data = {
            name, type, targetGroup, channel, subject, message,
            scheduledDate,
            recurring, recurringInterval,
            status: 'geplant'
        };

        const svc = window.marketingService;

        if (editingId) {
            svc.updateCampaign(editingId, data);
            if (window.errorHandler) {
                window.errorHandler.success('Kampagne aktualisiert');
            }
        } else {
            svc.createCampaign(data);
            if (window.errorHandler) {
                window.errorHandler.success('Kampagne erstellt');
            }
        }

        this.render(containerId);
    }

    _sendCampaign(id, containerId) {
        const svc = window.marketingService;
        const campaign = svc.getCampaign(id);
        if (!campaign) { return; }

        if (!confirm(`Kampagne "${campaign.name}" jetzt an die Zielgruppe senden?`)) { return; }

        const result = svc.sendCampaign(id);
        if (result.success) {
            this.render(containerId);
            if (window.errorHandler) {
                window.errorHandler.success(`Kampagne an ${result.sentCount} Empfaenger gesendet`);
            }
        } else {
            alert('Fehler: ' + result.error);
        }
    }

    _deleteCampaign(id, containerId) {
        if (!confirm('Kampagne wirklich loeschen?')) { return; }

        window.marketingService.deleteCampaign(id);
        this.render(containerId);
    }

    // Template actions

    _useTemplate(tplId, containerId) {
        const svc = window.marketingService;
        const templates = svc.getSeasonalTemplates();
        const tpl = templates.find(t => t.id === tplId);
        if (!tpl) { return; }

        // Switch to campaigns tab and open form pre-filled
        this.currentTab = 'kampagnen';
        this.render(containerId);

        // Wait for re-render, then show form
        setTimeout(() => {
            this._showCampaignForm(null, containerId);
            const container = document.getElementById(containerId);
            if (container) {
                const nameInput = container.querySelector('#mkt-c-name');
                const typeInput = container.querySelector('#mkt-c-type');
                const subjectInput = container.querySelector('#mkt-c-subject');
                const messageInput = container.querySelector('#mkt-c-message');

                if (nameInput) { nameInput.value = tpl.name; }
                if (typeInput) { typeInput.value = tpl.type || 'saisonal'; }
                if (subjectInput) { subjectInput.value = tpl.subject; }
                if (messageInput) { messageInput.value = tpl.message; }
            }
        }, 50);
    }

    _useMaintenanceTemplate(containerId) {
        const svc = window.marketingService;
        const tpl = svc.getMaintenanceReminderTemplate();

        this.currentTab = 'kampagnen';
        this.render(containerId);

        setTimeout(() => {
            this._showCampaignForm(null, containerId);
            const container = document.getElementById(containerId);
            if (container) {
                const nameInput = container.querySelector('#mkt-c-name');
                const typeInput = container.querySelector('#mkt-c-type');
                const targetInput = container.querySelector('#mkt-c-target');
                const subjectInput = container.querySelector('#mkt-c-subject');
                const messageInput = container.querySelector('#mkt-c-message');

                if (nameInput) { nameInput.value = 'Wartungserinnerung'; }
                if (typeInput) { typeInput.value = 'erinnerung'; }
                if (targetInput) { targetInput.value = 'wartungskunden'; }
                if (subjectInput) { subjectInput.value = tpl.subject; }
                if (messageInput) { messageInput.value = tpl.message; }
            }
        }, 50);
    }

    _previewTemplate(tplId) {
        const svc = window.marketingService;
        const templates = svc.getSeasonalTemplates();
        const tpl = templates.find(t => t.id === tplId);
        if (!tpl) { return; }

        const previewMsg = svc.fillTemplate(tpl.message, {
            name: 'Max Mustermann',
            firma: 'Musterbetrieb GmbH',
            datum: new Date().toLocaleDateString('de-DE')
        });

        this._showPreviewModal(tpl.name + ' - Vorschau', previewMsg);
    }

    // ============================================
    // Preview Modal
    // ============================================

    _showPreviewModal(title, message) {
        // Remove existing modal if any
        const existing = document.querySelector('.mkt-modal-overlay');
        if (existing) { existing.remove(); }

        const overlay = document.createElement('div');
        overlay.className = 'mkt-modal-overlay';
        overlay.innerHTML = `
            <div class="mkt-modal">
                <h3 class="mkt-modal-title">${this._esc(title)}</h3>
                <div class="mkt-msg-preview">${this._esc(message)}</div>
                <div style="margin-top: 16px; text-align: right;">
                    <button class="mkt-btn mkt-btn-secondary" id="mkt-close-preview">Schliessen</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        // Close on button click
        overlay.querySelector('#mkt-close-preview').addEventListener('click', () => {
            overlay.remove();
        });

        // Close on overlay click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.remove();
            }
        });
    }

    // ============================================
    // Helpers
    // ============================================

    _getReviewStatusLabel(status) {
        const labels = {
            'geplant': 'Geplant',
            'gesendet': 'Gesendet',
            'beantwortet': 'Beantwortet',
            'abgelehnt': 'Abgebrochen'
        };
        return labels[status] || status;
    }

    _getCampaignStatusLabel(status) {
        const labels = {
            'entwurf': 'Entwurf',
            'geplant': 'Geplant',
            'gesendet': 'Gesendet',
            'abgeschlossen': 'Abgeschlossen'
        };
        return labels[status] || status;
    }

    _getCampaignTypeLabel(type) {
        const labels = {
            'saisonal': 'Saisonal',
            'erinnerung': 'Erinnerung',
            'angebot': 'Angebot',
            'info': 'Information'
        };
        return labels[type] || type;
    }

    _getTargetGroupLabel(group) {
        const labels = {
            'alle': 'Alle Kunden',
            'aktive_kunden': 'Aktive Kunden',
            'inaktive_kunden': 'Inaktive Kunden',
            'wartungskunden': 'Wartungskunden'
        };
        return labels[group] || group;
    }

    _formatDate(dateStr) {
        if (!dateStr) { return '-'; }
        try {
            const date = new Date(dateStr);
            return date.toLocaleDateString('de-DE');
        } catch (e) {
            return dateStr;
        }
    }
}

window.marketingUI = new MarketingUI();
