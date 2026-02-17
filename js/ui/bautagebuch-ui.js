/* ============================================
   Bautagebuch UI (Construction Diary)
   Three views: Project List, Project Diary, Entry Form
   Legally required for VOB/B construction projects.
   ============================================ */

class BautagebuchUI {
    constructor() {
        this.service = null;
        this.container = null;
        this.currentView = 'projectList'; // 'projectList' | 'projectDiary' | 'entryForm'
        this.currentProjectId = null;
        this.currentEntryId = null;
        this.entryWorkers = [];
        this.entryMaterials = [];
        this.entryVisitors = [];
        this.entryPhotos = [];
        this.projectFilter = 'aktiv';
        this._initialized = false;
    }

    // ============================================
    // Initialization
    // ============================================

    init() {
        this.service = window.bautagebuchService;
        if (!this.service) {
            console.error('[BautagebuchUI] BautagebuchService nicht verfuegbar.');
            return;
        }

        this.container = document.getElementById('bautagebuch-content');
        if (!this.container) {
            console.warn('[BautagebuchUI] Container #bautagebuch-content nicht gefunden.');
            return;
        }

        if (!this._initialized) {
            this.initCSS();
            this._initialized = true;
        }

        this.currentView = 'projectList';
        this.currentProjectId = null;
        this.currentEntryId = null;
        this.renderProjectList();
    }

    // ============================================
    // CSS Injection
    // ============================================

    initCSS() {
        if (document.getElementById('bautagebuch-ui-styles')) { return; }

        const style = document.createElement('style');
        style.id = 'bautagebuch-ui-styles';
        style.textContent = `
            /* ========== Layout ========== */
            .btb-container {
                max-width: 960px;
                margin: 0 auto;
                padding: 20px 16px;
            }

            .btb-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                flex-wrap: wrap;
                gap: 12px;
                margin-bottom: 20px;
            }

            .btb-header h2 {
                font-size: 22px;
                font-weight: 700;
                color: var(--text-primary);
                margin: 0;
            }

            .btb-back-btn {
                display: inline-flex;
                align-items: center;
                gap: 6px;
                background: none;
                border: 1px solid var(--border-color);
                color: var(--text-secondary);
                padding: 6px 14px;
                border-radius: var(--border-radius-sm);
                cursor: pointer;
                font-size: 13px;
                font-family: inherit;
                transition: background var(--transition-fast), color var(--transition-fast);
            }

            .btb-back-btn:hover {
                background: var(--bg-hover);
                color: var(--text-primary);
            }

            /* ========== Filter Bar ========== */
            .btb-filter-bar {
                display: flex;
                gap: 8px;
                margin-bottom: 16px;
                flex-wrap: wrap;
            }

            .btb-filter-btn {
                padding: 6px 16px;
                border-radius: 20px;
                border: 1px solid var(--border-color);
                background: var(--bg-card);
                color: var(--text-secondary);
                font-size: 13px;
                font-family: inherit;
                cursor: pointer;
                transition: all var(--transition-fast);
            }

            .btb-filter-btn:hover {
                background: var(--bg-hover);
                color: var(--text-primary);
            }

            .btb-filter-btn.active {
                background: var(--accent-primary);
                color: #fff;
                border-color: var(--accent-primary);
            }

            /* ========== Cards ========== */
            .btb-card {
                background: var(--bg-card);
                border: 1px solid var(--border-color);
                border-radius: var(--border-radius);
                padding: 18px 20px;
                margin-bottom: 12px;
                cursor: pointer;
                transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
            }

            .btb-card:hover {
                border-color: var(--accent-primary);
                box-shadow: var(--shadow-sm);
            }

            .btb-card-top {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                margin-bottom: 8px;
            }

            .btb-card-name {
                font-size: 16px;
                font-weight: 600;
                color: var(--text-primary);
            }

            .btb-card-badge {
                display: inline-block;
                padding: 2px 10px;
                border-radius: 12px;
                font-size: 11px;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 0.4px;
                white-space: nowrap;
            }

            .btb-badge-aktiv {
                background: var(--accent-success-light);
                color: var(--accent-success);
            }

            .btb-badge-abgeschlossen {
                background: var(--accent-info-light);
                color: var(--accent-info);
            }

            .btb-badge-pausiert {
                background: var(--accent-warning-light);
                color: var(--accent-warning);
            }

            .btb-card-meta {
                display: flex;
                flex-wrap: wrap;
                gap: 16px;
                font-size: 13px;
                color: var(--text-muted);
            }

            .btb-card-meta span {
                display: inline-flex;
                align-items: center;
                gap: 4px;
            }

            /* ========== Stats Row ========== */
            .btb-stats-row {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
                gap: 12px;
                margin-bottom: 20px;
            }

            .btb-stat-card {
                background: var(--bg-card);
                border: 1px solid var(--border-color);
                border-radius: var(--border-radius-sm);
                padding: 14px 16px;
                text-align: center;
            }

            .btb-stat-value {
                font-size: 26px;
                font-weight: 700;
                color: var(--text-primary);
                line-height: 1.2;
            }

            .btb-stat-label {
                font-size: 12px;
                color: var(--text-muted);
                margin-top: 4px;
            }

            /* ========== Entry List ========== */
            .btb-entry-item {
                display: flex;
                align-items: center;
                gap: 14px;
                background: var(--bg-card);
                border: 1px solid var(--border-color);
                border-radius: var(--border-radius-sm);
                padding: 14px 18px;
                margin-bottom: 8px;
                cursor: pointer;
                transition: border-color var(--transition-fast);
            }

            .btb-entry-item:hover {
                border-color: var(--accent-primary);
            }

            .btb-entry-dot {
                width: 12px;
                height: 12px;
                border-radius: 50%;
                flex-shrink: 0;
            }

            .btb-dot-signed {
                background: var(--accent-success);
            }

            .btb-dot-unsigned {
                background: var(--accent-warning);
            }

            .btb-dot-missing {
                background: var(--accent-danger);
            }

            .btb-entry-date {
                font-size: 14px;
                font-weight: 600;
                color: var(--text-primary);
                min-width: 100px;
            }

            .btb-entry-summary {
                flex: 1;
                font-size: 13px;
                color: var(--text-secondary);
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }

            .btb-entry-workers {
                font-size: 12px;
                color: var(--text-muted);
                white-space: nowrap;
            }

            /* ========== Form ========== */
            .btb-form-section {
                background: var(--bg-card);
                border: 1px solid var(--border-color);
                border-radius: var(--border-radius);
                padding: 20px;
                margin-bottom: 16px;
            }

            .btb-form-section-title {
                font-size: 15px;
                font-weight: 600;
                color: var(--text-primary);
                margin-bottom: 14px;
                padding-bottom: 8px;
                border-bottom: 1px solid var(--border-color);
            }

            .btb-form-row {
                display: flex;
                flex-wrap: wrap;
                gap: 12px;
                margin-bottom: 12px;
            }

            .btb-form-group {
                flex: 1;
                min-width: 120px;
            }

            .btb-form-group label {
                display: block;
                font-size: 12px;
                font-weight: 600;
                color: var(--text-muted);
                margin-bottom: 4px;
                text-transform: uppercase;
                letter-spacing: 0.3px;
            }

            .btb-form-group input,
            .btb-form-group select,
            .btb-form-group textarea {
                width: 100%;
                padding: 8px 12px;
                background: var(--bg-input);
                border: 1px solid var(--border-color);
                border-radius: 6px;
                color: var(--text-primary);
                font-size: 14px;
                font-family: inherit;
                transition: border-color var(--transition-fast);
            }

            .btb-form-group input:focus,
            .btb-form-group select:focus,
            .btb-form-group textarea:focus {
                outline: none;
                border-color: var(--accent-primary);
            }

            .btb-form-group textarea {
                min-height: 80px;
                resize: vertical;
            }

            /* ========== Weather Icons ========== */
            .btb-weather-icons {
                display: flex;
                gap: 8px;
                flex-wrap: wrap;
            }

            .btb-weather-btn {
                width: 48px;
                height: 48px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 22px;
                border: 2px solid var(--border-color);
                border-radius: var(--border-radius-sm);
                background: var(--bg-input);
                cursor: pointer;
                transition: all var(--transition-fast);
            }

            .btb-weather-btn:hover {
                border-color: var(--accent-primary);
                background: var(--bg-hover);
            }

            .btb-weather-btn.active {
                border-color: var(--accent-primary);
                background: var(--accent-primary-light);
            }

            /* ========== Dynamic Table ========== */
            .btb-table-wrapper {
                overflow-x: auto;
            }

            .btb-dyn-table {
                width: 100%;
                border-collapse: collapse;
                font-size: 13px;
            }

            .btb-dyn-table th {
                text-align: left;
                padding: 8px 10px;
                font-size: 11px;
                font-weight: 600;
                color: var(--text-muted);
                text-transform: uppercase;
                letter-spacing: 0.3px;
                border-bottom: 1px solid var(--border-color);
                white-space: nowrap;
            }

            .btb-dyn-table td {
                padding: 6px 10px;
                border-bottom: 1px solid var(--border-color);
                vertical-align: middle;
            }

            .btb-dyn-table input,
            .btb-dyn-table select {
                width: 100%;
                padding: 6px 8px;
                background: var(--bg-input);
                border: 1px solid var(--border-color);
                border-radius: 4px;
                color: var(--text-primary);
                font-size: 13px;
                font-family: inherit;
            }

            .btb-dyn-table input:focus,
            .btb-dyn-table select:focus {
                outline: none;
                border-color: var(--accent-primary);
            }

            .btb-row-remove {
                background: none;
                border: none;
                color: var(--accent-danger);
                cursor: pointer;
                font-size: 16px;
                padding: 4px;
                border-radius: 4px;
                transition: background var(--transition-fast);
            }

            .btb-row-remove:hover {
                background: var(--accent-danger-light);
            }

            .btb-add-row-btn {
                display: inline-flex;
                align-items: center;
                gap: 6px;
                background: none;
                border: 1px dashed var(--border-color);
                color: var(--accent-primary);
                padding: 8px 16px;
                border-radius: 6px;
                cursor: pointer;
                font-size: 13px;
                font-family: inherit;
                margin-top: 8px;
                transition: all var(--transition-fast);
            }

            .btb-add-row-btn:hover {
                border-color: var(--accent-primary);
                background: var(--accent-primary-alpha);
            }

            /* ========== Photo Section ========== */
            .btb-photo-grid {
                display: flex;
                flex-wrap: wrap;
                gap: 10px;
                margin-top: 10px;
            }

            .btb-photo-thumb {
                width: 100px;
                height: 100px;
                border-radius: 6px;
                overflow: hidden;
                border: 1px solid var(--border-color);
                position: relative;
                background: var(--bg-input);
            }

            .btb-photo-thumb img {
                width: 100%;
                height: 100%;
                object-fit: cover;
            }

            .btb-photo-remove {
                position: absolute;
                top: 4px;
                right: 4px;
                width: 22px;
                height: 22px;
                background: rgba(0,0,0,0.7);
                border: none;
                border-radius: 50%;
                color: #fff;
                font-size: 12px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .btb-photo-upload-btn {
                width: 100px;
                height: 100px;
                border: 2px dashed var(--border-color);
                border-radius: 6px;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                gap: 4px;
                color: var(--text-muted);
                font-size: 11px;
                cursor: pointer;
                background: var(--bg-input);
                transition: border-color var(--transition-fast), color var(--transition-fast);
            }

            .btb-photo-upload-btn:hover {
                border-color: var(--accent-primary);
                color: var(--accent-primary);
            }

            .btb-photo-upload-btn .btb-camera-icon {
                font-size: 24px;
            }

            /* ========== Buttons ========== */
            .btb-btn {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
                padding: 10px 22px;
                border-radius: var(--border-radius-sm);
                font-size: 14px;
                font-weight: 600;
                font-family: inherit;
                cursor: pointer;
                border: 1px solid transparent;
                transition: all var(--transition-fast);
            }

            .btb-btn-primary {
                background: var(--accent-primary);
                color: #fff;
                border-color: var(--accent-primary);
            }

            .btb-btn-primary:hover {
                background: var(--accent-primary-hover);
                border-color: var(--accent-primary-hover);
            }

            .btb-btn-success {
                background: var(--accent-success);
                color: #fff;
                border-color: var(--accent-success);
            }

            .btb-btn-success:hover {
                background: #16a34a;
                border-color: #16a34a;
            }

            .btb-btn-secondary {
                background: var(--bg-hover);
                color: var(--text-secondary);
                border-color: var(--border-color);
            }

            .btb-btn-secondary:hover {
                background: var(--bg-card);
                color: var(--text-primary);
            }

            .btb-btn-danger {
                background: var(--accent-danger);
                color: #fff;
                border-color: var(--accent-danger);
            }

            .btb-btn-danger:hover {
                background: #dc2626;
                border-color: #dc2626;
            }

            .btb-form-actions {
                display: flex;
                gap: 10px;
                flex-wrap: wrap;
                margin-top: 20px;
            }

            /* ========== Empty State ========== */
            .btb-empty {
                text-align: center;
                padding: 48px 20px;
                color: var(--text-muted);
            }

            .btb-empty-icon {
                font-size: 48px;
                margin-bottom: 12px;
                opacity: 0.5;
            }

            .btb-empty-text {
                font-size: 15px;
                margin-bottom: 16px;
            }

            /* ========== Project Info Header ========== */
            .btb-project-info {
                background: var(--bg-card);
                border: 1px solid var(--border-color);
                border-radius: var(--border-radius);
                padding: 16px 20px;
                margin-bottom: 16px;
                display: flex;
                flex-wrap: wrap;
                gap: 20px;
                align-items: center;
            }

            .btb-project-info-item {
                font-size: 13px;
            }

            .btb-project-info-item strong {
                color: var(--text-primary);
            }

            .btb-project-info-item span {
                color: var(--text-muted);
            }

            /* ========== Modal Overlay ========== */
            .btb-modal-overlay {
                position: fixed;
                inset: 0;
                background: rgba(0,0,0,0.6);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 1000;
                padding: 20px;
            }

            .btb-modal {
                background: var(--bg-card);
                border: 1px solid var(--border-color);
                border-radius: var(--border-radius);
                padding: 24px;
                max-width: 520px;
                width: 100%;
                max-height: 90vh;
                overflow-y: auto;
            }

            .btb-modal h3 {
                font-size: 18px;
                font-weight: 700;
                color: var(--text-primary);
                margin-bottom: 16px;
            }

            /* ========== Responsive ========== */
            @media (max-width: 600px) {
                .btb-container {
                    padding: 12px 10px;
                }

                .btb-header {
                    flex-direction: column;
                    align-items: flex-start;
                }

                .btb-entry-item {
                    flex-direction: column;
                    align-items: flex-start;
                    gap: 6px;
                }

                .btb-entry-date {
                    min-width: unset;
                }

                .btb-form-row {
                    flex-direction: column;
                }

                .btb-stats-row {
                    grid-template-columns: repeat(2, 1fr);
                }

                .btb-form-actions {
                    flex-direction: column;
                }

                .btb-form-actions .btb-btn {
                    width: 100%;
                }

                .btb-project-info {
                    flex-direction: column;
                    gap: 8px;
                }
            }
        `;
        document.head.appendChild(style);
    }

    // ============================================
    // XSS Prevention
    // ============================================

    _esc(str) {
        if (!str) { return ''; }
        const el = document.createElement('div');
        el.textContent = String(str);
        return el.innerHTML;
    }

    // ============================================
    // Formatting Helpers
    // ============================================

    _formatDate(dateStr) {
        if (!dateStr) { return '-'; }
        try {
            const d = new Date(dateStr + 'T00:00:00');
            return d.toLocaleDateString('de-DE', {
                weekday: 'short',
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });
        } catch (e) {
            return dateStr;
        }
    }

    _formatShortDate(dateStr) {
        if (!dateStr) { return '-'; }
        try {
            const d = new Date(dateStr + 'T00:00:00');
            return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
        } catch (e) {
            return dateStr;
        }
    }

    _todayStr() {
        return new Date().toISOString().split('T')[0];
    }

    _weatherIcon(condition) {
        const icons = {
            'sonnig': '\u2600\uFE0F',
            'bew\u00f6lkt': '\u2601\uFE0F',
            'regen': '\uD83C\uDF27\uFE0F',
            'schnee': '\u2744\uFE0F',
            'frost': '\uD83E\uDD76',
            'sturm': '\uD83C\uDF2C\uFE0F'
        };
        return icons[condition] || '\u2601\uFE0F';
    }

    _windLabel(wind) {
        const labels = {
            'windstill': 'Windstill',
            'leicht': 'Leicht',
            'm\u00e4\u00dfig': 'M\u00e4\u00dfig',
            'stark': 'Stark',
            'sturm': 'Sturm'
        };
        return labels[wind] || wind || '-';
    }

    _roleLabel(role) {
        const labels = {
            'meister': 'Meister',
            'geselle': 'Geselle',
            'azubi': 'Azubi',
            'helfer': 'Helfer',
            'subunternehmer': 'Subunternehmer'
        };
        return labels[role] || role || '-';
    }

    _visitorRoleLabel(role) {
        const labels = {
            'Bauleiter': 'Bauleiter',
            'Architekt': 'Architekt',
            'Bauherr': 'Bauherr',
            'Beh\u00f6rde': 'Beh\u00f6rde',
            'Sonstiger': 'Sonstiger'
        };
        return labels[role] || role || '-';
    }

    _statusBadge(status) {
        const cls = {
            'aktiv': 'btb-badge-aktiv',
            'abgeschlossen': 'btb-badge-abgeschlossen',
            'pausiert': 'btb-badge-pausiert'
        };
        const labels = {
            'aktiv': 'Aktiv',
            'abgeschlossen': 'Abgeschlossen',
            'pausiert': 'Pausiert'
        };
        return `<span class="btb-card-badge ${cls[status] || ''}">${this._esc(labels[status] || status)}</span>`;
    }

    // ============================================
    // View 1: Project List
    // ============================================

    renderProjectList() {
        this.currentView = 'projectList';
        const projects = this.service.getProjects();

        const filtered = this.projectFilter === 'alle'
            ? projects
            : projects.filter(p => p.status === this.projectFilter);

        this.container.innerHTML = `
            <div class="btb-container">
                <div class="btb-header">
                    <h2>Bautagebuch</h2>
                    <button class="btb-btn btb-btn-primary" id="btb-new-project-btn">+ Neues Projekt</button>
                </div>

                <div class="btb-filter-bar">
                    <button class="btb-filter-btn ${this.projectFilter === 'aktiv' ? 'active' : ''}" data-filter="aktiv">Aktiv</button>
                    <button class="btb-filter-btn ${this.projectFilter === 'abgeschlossen' ? 'active' : ''}" data-filter="abgeschlossen">Abgeschlossen</button>
                    <button class="btb-filter-btn ${this.projectFilter === 'alle' ? 'active' : ''}" data-filter="alle">Alle</button>
                </div>

                ${filtered.length === 0
                    ? this._renderEmpty('Keine Projekte gefunden', 'Erstellen Sie ein neues Bautagebuch-Projekt.')
                    : filtered.map(p => this._renderProjectCard(p)).join('')
                }
            </div>
        `;

        this._attachProjectListEvents();
    }

    _renderProjectCard(project) {
        const entries = this.service.getEntries(project.id);
        const lastEntry = entries.length > 0 ? entries[0] : null;

        return `
            <div class="btb-card" data-project-id="${this._esc(project.id)}">
                <div class="btb-card-top">
                    <div class="btb-card-name">${this._esc(project.name)}</div>
                    ${this._statusBadge(project.status)}
                </div>
                <div class="btb-card-meta">
                    <span>\uD83D\uDCCD ${this._esc(project.address || 'Keine Adresse')}</span>
                    <span>\uD83D\uDC64 ${this._esc(project.client || '-')}</span>
                    <span>\uD83D\uDCC4 ${entries.length} Eintr\u00e4ge</span>
                    <span>\uD83D\uDCC5 ${lastEntry ? this._formatShortDate(lastEntry.date) : 'Kein Eintrag'}</span>
                    <span>\uD83D\uDCDC ${this._esc(project.contractType || 'VOB')}</span>
                </div>
            </div>
        `;
    }

    _attachProjectListEvents() {
        // New Project button
        this.container.querySelector('#btb-new-project-btn')?.addEventListener('click', () => {
            this._showNewProjectModal();
        });

        // Filter buttons
        this.container.querySelectorAll('.btb-filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.projectFilter = btn.dataset.filter;
                this.renderProjectList();
            });
        });

        // Card clicks
        this.container.querySelectorAll('.btb-card[data-project-id]').forEach(card => {
            card.addEventListener('click', () => {
                this.currentProjectId = card.dataset.projectId;
                this.renderProjectDiary();
            });
        });
    }

    // ============================================
    // New Project Modal
    // ============================================

    _showNewProjectModal() {
        // Remove any existing modal
        document.getElementById('btb-project-modal')?.remove();

        const overlay = document.createElement('div');
        overlay.id = 'btb-project-modal';
        overlay.className = 'btb-modal-overlay';
        overlay.innerHTML = `
            <div class="btb-modal">
                <h3>Neues Bautagebuch-Projekt</h3>

                <div class="btb-form-group" style="margin-bottom:12px;">
                    <label>Projektname *</label>
                    <input type="text" id="btb-mp-name" placeholder="z.B. Neubau Lagerhalle M\u00fcller">
                </div>
                <div class="btb-form-group" style="margin-bottom:12px;">
                    <label>Baustellenadresse</label>
                    <input type="text" id="btb-mp-address" placeholder="Industriestr. 12, 74523 Ort">
                </div>
                <div class="btb-form-group" style="margin-bottom:12px;">
                    <label>Bauherr</label>
                    <input type="text" id="btb-mp-client" placeholder="Name des Auftraggebers">
                </div>
                <div class="btb-form-row">
                    <div class="btb-form-group">
                        <label>Startdatum</label>
                        <input type="date" id="btb-mp-start" value="${this._todayStr()}">
                    </div>
                    <div class="btb-form-group">
                        <label>Enddatum</label>
                        <input type="date" id="btb-mp-end">
                    </div>
                </div>
                <div class="btb-form-row" style="margin-top:12px;">
                    <div class="btb-form-group">
                        <label>Vertragsart</label>
                        <select id="btb-mp-contract">
                            <option value="VOB">VOB/B</option>
                            <option value="BGB">BGB</option>
                        </select>
                    </div>
                    <div class="btb-form-group">
                        <label>Auftrags-ID (optional)</label>
                        <input type="text" id="btb-mp-auftrag" placeholder="Verkn\u00fcpfung zu Auftrag">
                    </div>
                </div>

                <div class="btb-form-actions" style="margin-top:20px;">
                    <button class="btb-btn btb-btn-primary" id="btb-mp-save">Projekt anlegen</button>
                    <button class="btb-btn btb-btn-secondary" id="btb-mp-cancel">Abbrechen</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        // Close on overlay click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) { overlay.remove(); }
        });

        // Cancel
        document.getElementById('btb-mp-cancel').addEventListener('click', () => overlay.remove());

        // Save
        document.getElementById('btb-mp-save').addEventListener('click', () => {
            const name = document.getElementById('btb-mp-name').value.trim();
            if (!name) {
                alert('Bitte Projektnamen eingeben.');
                return;
            }

            this.service.createProject({
                name: name,
                address: document.getElementById('btb-mp-address').value.trim(),
                client: document.getElementById('btb-mp-client').value.trim(),
                startDate: document.getElementById('btb-mp-start').value,
                endDate: document.getElementById('btb-mp-end').value,
                contractType: document.getElementById('btb-mp-contract').value,
                auftragId: document.getElementById('btb-mp-auftrag').value.trim()
            });

            overlay.remove();
            this.renderProjectList();

            if (window.errorHandler) {
                window.errorHandler.success('Bautagebuch-Projekt angelegt');
            }
        });

        // Auto-focus
        document.getElementById('btb-mp-name')?.focus();
    }

    // ============================================
    // View 2: Project Diary (Entries List)
    // ============================================

    renderProjectDiary() {
        this.currentView = 'projectDiary';
        const project = this.service.getProject(this.currentProjectId);
        if (!project) {
            this.renderProjectList();
            return;
        }

        const entries = this.service.getEntries(project.id);
        const totalHours = this.service.getTotalWorkerHours(project.id);
        const lastEntry = entries.length > 0 ? entries[0] : null;
        const daysSinceLast = lastEntry
            ? Math.floor((Date.now() - new Date(lastEntry.date + 'T00:00:00').getTime()) / 86400000)
            : null;

        this.container.innerHTML = `
            <div class="btb-container">
                <div class="btb-header">
                    <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
                        <button class="btb-back-btn" id="btb-back-to-list">\u2190 Zur\u00fcck</button>
                        <h2>${this._esc(project.name)}</h2>
                    </div>
                    <button class="btb-btn btb-btn-primary" id="btb-new-entry-btn">+ Neuer Eintrag</button>
                </div>

                <div class="btb-project-info">
                    <div class="btb-project-info-item">
                        <span>Adresse: </span><strong>${this._esc(project.address || '-')}</strong>
                    </div>
                    <div class="btb-project-info-item">
                        <span>Bauherr: </span><strong>${this._esc(project.client || '-')}</strong>
                    </div>
                    <div class="btb-project-info-item">
                        <span>Vertrag: </span><strong>${this._esc(project.contractType || 'VOB')}</strong>
                    </div>
                    <div class="btb-project-info-item">
                        ${this._statusBadge(project.status)}
                    </div>
                </div>

                <div class="btb-stats-row">
                    <div class="btb-stat-card">
                        <div class="btb-stat-value">${entries.length}</div>
                        <div class="btb-stat-label">Eintr\u00e4ge</div>
                    </div>
                    <div class="btb-stat-card">
                        <div class="btb-stat-value">${totalHours}</div>
                        <div class="btb-stat-label">Arbeitsstunden</div>
                    </div>
                    <div class="btb-stat-card">
                        <div class="btb-stat-value">${daysSinceLast !== null ? daysSinceLast : '-'}</div>
                        <div class="btb-stat-label">Tage seit letztem Eintrag</div>
                    </div>
                </div>

                <div id="btb-entries-list">
                    ${entries.length === 0
                        ? this._renderEmpty('Noch keine Eintr\u00e4ge', 'Erstellen Sie den ersten Tagesbericht f\u00fcr dieses Projekt.')
                        : entries.map(e => this._renderEntryItem(e)).join('')
                    }
                </div>
            </div>
        `;

        this._attachProjectDiaryEvents();
    }

    _renderEntryItem(entry) {
        const dotClass = entry.signed ? 'btb-dot-signed' : 'btb-dot-unsigned';
        const workerCount = Array.isArray(entry.workers) ? entry.workers.length : 0;
        const summary = entry.workPerformed
            ? (entry.workPerformed.length > 80 ? entry.workPerformed.substring(0, 80) + '...' : entry.workPerformed)
            : 'Kein Eintrag';

        return `
            <div class="btb-entry-item" data-entry-id="${this._esc(entry.id)}">
                <div class="btb-entry-dot ${dotClass}" title="${entry.signed ? 'Unterschrieben' : 'Nicht unterschrieben'}"></div>
                <div class="btb-entry-date">
                    ${this._weatherIcon(entry.weather?.condition)} ${this._formatDate(entry.date)}
                </div>
                <div class="btb-entry-summary">${this._esc(summary)}</div>
                <div class="btb-entry-workers">${workerCount} Arbeiter</div>
            </div>
        `;
    }

    _attachProjectDiaryEvents() {
        // Back
        this.container.querySelector('#btb-back-to-list')?.addEventListener('click', () => {
            this.renderProjectList();
        });

        // New entry
        this.container.querySelector('#btb-new-entry-btn')?.addEventListener('click', () => {
            this.currentEntryId = null;
            this.renderEntryForm();
        });

        // Entry click
        this.container.querySelectorAll('.btb-entry-item[data-entry-id]').forEach(el => {
            el.addEventListener('click', () => {
                this.currentEntryId = el.dataset.entryId;
                this.renderEntryForm();
            });
        });
    }

    // ============================================
    // View 3: Entry Form (New / Edit)
    // ============================================

    renderEntryForm() {
        this.currentView = 'entryForm';
        const project = this.service.getProject(this.currentProjectId);
        if (!project) {
            this.renderProjectList();
            return;
        }

        const isEdit = !!this.currentEntryId;
        const entry = isEdit ? this.service.getEntry(this.currentEntryId) : null;

        // Populate working arrays for dynamic table rows
        this.entryWorkers = entry && Array.isArray(entry.workers) ? [...entry.workers] : [];
        this.entryMaterials = entry && Array.isArray(entry.materials) ? [...entry.materials] : [];
        this.entryVisitors = entry && Array.isArray(entry.visitors) ? [...entry.visitors] : [];
        this.entryPhotos = entry && Array.isArray(entry.photos) ? [...entry.photos] : [];

        const weather = entry?.weather || {};
        const activeCondition = weather.condition || '';

        this.container.innerHTML = `
            <div class="btb-container">
                <div class="btb-header">
                    <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
                        <button class="btb-back-btn" id="btb-back-to-diary">\u2190 Zur\u00fcck</button>
                        <h2>${isEdit ? 'Eintrag bearbeiten' : 'Neuer Eintrag'}</h2>
                    </div>
                    <span style="color:var(--text-muted);font-size:13px;">${this._esc(project.name)}</span>
                </div>

                <!-- Date -->
                <div class="btb-form-section">
                    <div class="btb-form-section-title">Datum</div>
                    <div class="btb-form-group" style="max-width:220px;">
                        <label>Datum</label>
                        <input type="date" id="btb-entry-date" value="${entry?.date || this._todayStr()}">
                    </div>
                </div>

                <!-- Weather -->
                <div class="btb-form-section">
                    <div class="btb-form-section-title">Wetter (gesetzlich erforderlich)</div>
                    <div class="btb-form-group" style="margin-bottom:12px;">
                        <label>Wetterlage</label>
                        <div class="btb-weather-icons" id="btb-weather-icons">
                            <button type="button" class="btb-weather-btn ${activeCondition === 'sonnig' ? 'active' : ''}" data-condition="sonnig" title="Sonnig">\u2600\uFE0F</button>
                            <button type="button" class="btb-weather-btn ${activeCondition === 'bew\u00f6lkt' ? 'active' : ''}" data-condition="bew\u00f6lkt" title="Bew\u00f6lkt">\u2601\uFE0F</button>
                            <button type="button" class="btb-weather-btn ${activeCondition === 'regen' ? 'active' : ''}" data-condition="regen" title="Regen">\uD83C\uDF27\uFE0F</button>
                            <button type="button" class="btb-weather-btn ${activeCondition === 'schnee' ? 'active' : ''}" data-condition="schnee" title="Schnee">\u2744\uFE0F</button>
                            <button type="button" class="btb-weather-btn ${activeCondition === 'frost' ? 'active' : ''}" data-condition="frost" title="Frost">\uD83E\uDD76</button>
                            <button type="button" class="btb-weather-btn ${activeCondition === 'sturm' ? 'active' : ''}" data-condition="sturm" title="Sturm">\uD83C\uDF2C\uFE0F</button>
                        </div>
                    </div>
                    <div class="btb-form-row">
                        <div class="btb-form-group">
                            <label>Morgens 7:00 (\u00b0C)</label>
                            <input type="number" id="btb-temp-morning" step="0.5" placeholder="z.B. 5" value="${weather.tempMorning ?? ''}">
                        </div>
                        <div class="btb-form-group">
                            <label>Mittags 12:00 (\u00b0C)</label>
                            <input type="number" id="btb-temp-noon" step="0.5" placeholder="z.B. 12" value="${weather.tempNoon ?? ''}">
                        </div>
                        <div class="btb-form-group">
                            <label>Abends 17:00 (\u00b0C)</label>
                            <input type="number" id="btb-temp-evening" step="0.5" placeholder="z.B. 8" value="${weather.tempEvening ?? ''}">
                        </div>
                    </div>
                    <div class="btb-form-row">
                        <div class="btb-form-group">
                            <label>Wind</label>
                            <select id="btb-wind">
                                <option value="windstill" ${weather.wind === 'windstill' ? 'selected' : ''}>Windstill</option>
                                <option value="leicht" ${weather.wind === 'leicht' ? 'selected' : ''}>Leicht</option>
                                <option value="m\u00e4\u00dfig" ${weather.wind === 'm\u00e4\u00dfig' ? 'selected' : ''}>M\u00e4\u00dfig</option>
                                <option value="stark" ${weather.wind === 'stark' ? 'selected' : ''}>Stark</option>
                                <option value="sturm" ${weather.wind === 'sturm' ? 'selected' : ''}>Sturm</option>
                            </select>
                        </div>
                        <div class="btb-form-group">
                            <label>Niederschlag</label>
                            <select id="btb-precipitation">
                                <option value="false" ${!weather.precipitation ? 'selected' : ''}>Nein</option>
                                <option value="true" ${weather.precipitation ? 'selected' : ''}>Ja</option>
                            </select>
                        </div>
                    </div>
                </div>

                <!-- Workers -->
                <div class="btb-form-section">
                    <div class="btb-form-section-title">Anwesende Arbeitskr\u00e4fte (gesetzlich erforderlich)</div>
                    <div class="btb-table-wrapper">
                        <table class="btb-dyn-table" id="btb-workers-table">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Rolle</th>
                                    <th style="width:70px;">Stunden</th>
                                    <th style="width:90px;">Ankunft</th>
                                    <th style="width:90px;">Abgang</th>
                                    <th style="width:36px;"></th>
                                </tr>
                            </thead>
                            <tbody id="btb-workers-body"></tbody>
                        </table>
                    </div>
                    <button type="button" class="btb-add-row-btn" id="btb-add-worker">+ Arbeitskraft hinzuf\u00fcgen</button>
                </div>

                <!-- Work Performed -->
                <div class="btb-form-section">
                    <div class="btb-form-section-title">Ausgef\u00fchrte Arbeiten (gesetzlich erforderlich)</div>
                    <div class="btb-form-group">
                        <textarea id="btb-work-performed" rows="5" placeholder="Beschreiben Sie die heute ausgef\u00fchrten Arbeiten...">${this._esc(entry?.workPerformed || '')}</textarea>
                    </div>
                </div>

                <!-- Materials -->
                <div class="btb-form-section">
                    <div class="btb-form-section-title">Verwendete Materialien</div>
                    <div class="btb-table-wrapper">
                        <table class="btb-dyn-table" id="btb-materials-table">
                            <thead>
                                <tr>
                                    <th>Material</th>
                                    <th style="width:80px;">Menge</th>
                                    <th style="width:100px;">Einheit</th>
                                    <th style="width:36px;"></th>
                                </tr>
                            </thead>
                            <tbody id="btb-materials-body"></tbody>
                        </table>
                    </div>
                    <button type="button" class="btb-add-row-btn" id="btb-add-material">+ Material hinzuf\u00fcgen</button>
                </div>

                <!-- Incidents -->
                <div class="btb-form-section">
                    <div class="btb-form-section-title">Besondere Vorkommnisse</div>
                    <div class="btb-form-group">
                        <textarea id="btb-incidents" rows="3" placeholder="Verz\u00f6gerungen, Unf\u00e4lle, St\u00f6rungen...">${this._esc(entry?.incidents || '')}</textarea>
                    </div>
                </div>

                <!-- Visitors -->
                <div class="btb-form-section">
                    <div class="btb-form-section-title">Besucher</div>
                    <div class="btb-table-wrapper">
                        <table class="btb-dyn-table" id="btb-visitors-table">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th style="width:130px;">Rolle</th>
                                    <th style="width:90px;">Uhrzeit</th>
                                    <th>Notizen</th>
                                    <th style="width:36px;"></th>
                                </tr>
                            </thead>
                            <tbody id="btb-visitors-body"></tbody>
                        </table>
                    </div>
                    <button type="button" class="btb-add-row-btn" id="btb-add-visitor">+ Besucher hinzuf\u00fcgen</button>
                </div>

                <!-- Instructions -->
                <div class="btb-form-section">
                    <div class="btb-form-section-title">Anweisungen (Bauleiter / Bauherr)</div>
                    <div class="btb-form-group">
                        <textarea id="btb-instructions" rows="3" placeholder="Erhaltene Anweisungen...">${this._esc(entry?.instructions || '')}</textarea>
                    </div>
                </div>

                <!-- Photos -->
                <div class="btb-form-section">
                    <div class="btb-form-section-title">Fotos</div>
                    <div class="btb-photo-grid" id="btb-photo-grid"></div>
                    <input type="file" id="btb-photo-input" accept="image/*" capture="environment" multiple style="display:none;">
                </div>

                <!-- Actions -->
                <div class="btb-form-actions">
                    <button class="btb-btn btb-btn-primary" id="btb-save-entry">Speichern</button>
                    <button class="btb-btn btb-btn-success" id="btb-sign-entry">${isEdit && entry?.signed ? '\u2705 Unterschrieben' : 'Speichern & Unterschreiben'}</button>
                    ${isEdit ? '<button class="btb-btn btb-btn-danger" id="btb-delete-entry">L\u00f6schen</button>' : ''}
                    <button class="btb-btn btb-btn-secondary" id="btb-cancel-entry">Abbrechen</button>
                </div>
            </div>
        `;

        // Render dynamic tables
        this._renderWorkersTable();
        this._renderMaterialsTable();
        this._renderVisitorsTable();
        this._renderPhotoGrid();
        this._attachEntryFormEvents();
    }

    // ============================================
    // Dynamic Table: Workers
    // ============================================

    _renderWorkersTable() {
        const tbody = document.getElementById('btb-workers-body');
        if (!tbody) { return; }

        tbody.innerHTML = this.entryWorkers.map((w, i) => `
            <tr>
                <td><input type="text" value="${this._esc(w.name)}" data-field="name" data-index="${i}" placeholder="Name"></td>
                <td>
                    <select data-field="role" data-index="${i}">
                        <option value="meister" ${w.role === 'meister' ? 'selected' : ''}>Meister</option>
                        <option value="geselle" ${w.role === 'geselle' ? 'selected' : ''}>Geselle</option>
                        <option value="azubi" ${w.role === 'azubi' ? 'selected' : ''}>Azubi</option>
                        <option value="helfer" ${w.role === 'helfer' ? 'selected' : ''}>Helfer</option>
                        <option value="subunternehmer" ${w.role === 'subunternehmer' ? 'selected' : ''}>Sub</option>
                    </select>
                </td>
                <td><input type="number" value="${w.hours || ''}" data-field="hours" data-index="${i}" step="0.5" min="0" placeholder="8"></td>
                <td><input type="time" value="${this._esc(w.arrived)}" data-field="arrived" data-index="${i}"></td>
                <td><input type="time" value="${this._esc(w.left)}" data-field="left" data-index="${i}"></td>
                <td><button type="button" class="btb-row-remove" data-remove-worker="${i}">\u2716</button></td>
            </tr>
        `).join('');

        // Attach inline events
        tbody.querySelectorAll('input, select').forEach(el => {
            el.addEventListener('change', () => {
                const idx = parseInt(el.dataset.index);
                const field = el.dataset.field;
                if (isNaN(idx) || !field) { return; }
                if (field === 'hours') {
                    this.entryWorkers[idx][field] = parseFloat(el.value) || 0;
                } else {
                    this.entryWorkers[idx][field] = el.value;
                }
            });
        });

        tbody.querySelectorAll('[data-remove-worker]').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.dataset.removeWorker);
                this.entryWorkers.splice(idx, 1);
                this._renderWorkersTable();
            });
        });
    }

    // ============================================
    // Dynamic Table: Materials
    // ============================================

    _renderMaterialsTable() {
        const tbody = document.getElementById('btb-materials-body');
        if (!tbody) { return; }

        tbody.innerHTML = this.entryMaterials.map((m, i) => `
            <tr>
                <td><input type="text" value="${this._esc(m.name)}" data-field="name" data-index="${i}" placeholder="z.B. Bewehrungsstahl"></td>
                <td><input type="number" value="${m.quantity || ''}" data-field="quantity" data-index="${i}" step="0.1" min="0" placeholder="0"></td>
                <td>
                    <select data-field="unit" data-index="${i}">
                        <option value="Stk" ${m.unit === 'Stk' ? 'selected' : ''}>Stk</option>
                        <option value="m" ${m.unit === 'm' ? 'selected' : ''}>m</option>
                        <option value="m\u00b2" ${m.unit === 'm\u00b2' ? 'selected' : ''}>m\u00b2</option>
                        <option value="m\u00b3" ${m.unit === 'm\u00b3' ? 'selected' : ''}>m\u00b3</option>
                        <option value="kg" ${m.unit === 'kg' ? 'selected' : ''}>kg</option>
                        <option value="l" ${m.unit === 'l' ? 'selected' : ''}>l</option>
                        <option value="Sack" ${m.unit === 'Sack' ? 'selected' : ''}>Sack</option>
                        <option value="Palette" ${m.unit === 'Palette' ? 'selected' : ''}>Palette</option>
                    </select>
                </td>
                <td><button type="button" class="btb-row-remove" data-remove-material="${i}">\u2716</button></td>
            </tr>
        `).join('');

        tbody.querySelectorAll('input, select').forEach(el => {
            el.addEventListener('change', () => {
                const idx = parseInt(el.dataset.index);
                const field = el.dataset.field;
                if (isNaN(idx) || !field) { return; }
                if (field === 'quantity') {
                    this.entryMaterials[idx][field] = parseFloat(el.value) || 0;
                } else {
                    this.entryMaterials[idx][field] = el.value;
                }
            });
        });

        tbody.querySelectorAll('[data-remove-material]').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.dataset.removeMaterial);
                this.entryMaterials.splice(idx, 1);
                this._renderMaterialsTable();
            });
        });
    }

    // ============================================
    // Dynamic Table: Visitors
    // ============================================

    _renderVisitorsTable() {
        const tbody = document.getElementById('btb-visitors-body');
        if (!tbody) { return; }

        tbody.innerHTML = this.entryVisitors.map((v, i) => `
            <tr>
                <td><input type="text" value="${this._esc(v.name)}" data-field="name" data-index="${i}" placeholder="Name"></td>
                <td>
                    <select data-field="role" data-index="${i}">
                        <option value="Bauleiter" ${v.role === 'Bauleiter' ? 'selected' : ''}>Bauleiter</option>
                        <option value="Architekt" ${v.role === 'Architekt' ? 'selected' : ''}>Architekt</option>
                        <option value="Bauherr" ${v.role === 'Bauherr' ? 'selected' : ''}>Bauherr</option>
                        <option value="Beh\u00f6rde" ${v.role === 'Beh\u00f6rde' ? 'selected' : ''}>Beh\u00f6rde</option>
                        <option value="Sonstiger" ${v.role === 'Sonstiger' ? 'selected' : ''}>Sonstiger</option>
                    </select>
                </td>
                <td><input type="time" value="${this._esc(v.time)}" data-field="time" data-index="${i}"></td>
                <td><input type="text" value="${this._esc(v.notes)}" data-field="notes" data-index="${i}" placeholder="Notizen"></td>
                <td><button type="button" class="btb-row-remove" data-remove-visitor="${i}">\u2716</button></td>
            </tr>
        `).join('');

        tbody.querySelectorAll('input, select').forEach(el => {
            el.addEventListener('change', () => {
                const idx = parseInt(el.dataset.index);
                const field = el.dataset.field;
                if (isNaN(idx) || !field) { return; }
                this.entryVisitors[idx][field] = el.value;
            });
        });

        tbody.querySelectorAll('[data-remove-visitor]').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.dataset.removeVisitor);
                this.entryVisitors.splice(idx, 1);
                this._renderVisitorsTable();
            });
        });
    }

    // ============================================
    // Photo Grid
    // ============================================

    _renderPhotoGrid() {
        const grid = document.getElementById('btb-photo-grid');
        if (!grid) { return; }

        const thumbsHtml = this.entryPhotos.map((p, i) => `
            <div class="btb-photo-thumb">
                <img src="${this._esc(p.dataUrl)}" alt="${this._esc(p.caption)}">
                <button type="button" class="btb-photo-remove" data-remove-photo="${i}">\u2716</button>
            </div>
        `).join('');

        grid.innerHTML = thumbsHtml + `
            <div class="btb-photo-upload-btn" id="btb-photo-trigger">
                <span class="btb-camera-icon">\uD83D\uDCF7</span>
                <span>Foto</span>
            </div>
        `;

        // Attach events
        grid.querySelector('#btb-photo-trigger')?.addEventListener('click', () => {
            document.getElementById('btb-photo-input')?.click();
        });

        grid.querySelectorAll('[data-remove-photo]').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.dataset.removePhoto);
                this.entryPhotos.splice(idx, 1);
                this._renderPhotoGrid();
            });
        });
    }

    _handlePhotoUpload(files) {
        if (!files || files.length === 0) { return; }

        Array.from(files).forEach(file => {
            if (!file.type.startsWith('image/')) { return; }

            const reader = new FileReader();
            reader.onload = (e) => {
                this.entryPhotos.push({
                    id: 'PH-' + Date.now() + '-' + Math.random().toString(36).substring(2, 8),
                    caption: file.name,
                    timestamp: new Date().toISOString(),
                    dataUrl: e.target.result
                });
                this._renderPhotoGrid();
            };
            reader.readAsDataURL(file);
        });
    }

    // ============================================
    // Entry Form Events
    // ============================================

    _attachEntryFormEvents() {
        // Back
        this.container.querySelector('#btb-back-to-diary')?.addEventListener('click', () => {
            this.renderProjectDiary();
        });

        // Weather icon toggles
        this.container.querySelectorAll('.btb-weather-btn[data-condition]').forEach(btn => {
            btn.addEventListener('click', () => {
                this.container.querySelectorAll('.btb-weather-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });

        // Add rows
        this.container.querySelector('#btb-add-worker')?.addEventListener('click', () => {
            this.entryWorkers.push({ name: '', role: 'geselle', hours: 8, arrived: '07:00', left: '16:00' });
            this._renderWorkersTable();
        });

        this.container.querySelector('#btb-add-material')?.addEventListener('click', () => {
            this.entryMaterials.push({ name: '', quantity: 0, unit: 'Stk' });
            this._renderMaterialsTable();
        });

        this.container.querySelector('#btb-add-visitor')?.addEventListener('click', () => {
            this.entryVisitors.push({ name: '', role: 'Sonstiger', time: '', notes: '' });
            this._renderVisitorsTable();
        });

        // Photo upload
        const photoInput = document.getElementById('btb-photo-input');
        if (photoInput) {
            photoInput.addEventListener('change', (e) => {
                this._handlePhotoUpload(e.target.files);
                photoInput.value = ''; // reset so same file can be uploaded again
            });
        }

        // Save
        this.container.querySelector('#btb-save-entry')?.addEventListener('click', () => {
            this._saveEntry(false);
        });

        // Save & Sign
        this.container.querySelector('#btb-sign-entry')?.addEventListener('click', () => {
            this._saveEntry(true);
        });

        // Delete
        this.container.querySelector('#btb-delete-entry')?.addEventListener('click', () => {
            this._deleteEntry();
        });

        // Cancel
        this.container.querySelector('#btb-cancel-entry')?.addEventListener('click', () => {
            this.renderProjectDiary();
        });
    }

    // ============================================
    // Gather Form Data & Save
    // ============================================

    _gatherFormData() {
        const activeWeatherBtn = this.container.querySelector('.btb-weather-btn.active');
        const condition = activeWeatherBtn ? activeWeatherBtn.dataset.condition : 'bew\u00f6lkt';

        const tempMorningVal = document.getElementById('btb-temp-morning')?.value;
        const tempNoonVal = document.getElementById('btb-temp-noon')?.value;
        const tempEveningVal = document.getElementById('btb-temp-evening')?.value;

        return {
            date: document.getElementById('btb-entry-date')?.value || this._todayStr(),
            weather: {
                condition: condition,
                tempMorning: tempMorningVal !== '' && tempMorningVal !== undefined ? parseFloat(tempMorningVal) : null,
                tempNoon: tempNoonVal !== '' && tempNoonVal !== undefined ? parseFloat(tempNoonVal) : null,
                tempEvening: tempEveningVal !== '' && tempEveningVal !== undefined ? parseFloat(tempEveningVal) : null,
                wind: document.getElementById('btb-wind')?.value || 'windstill',
                precipitation: document.getElementById('btb-precipitation')?.value === 'true'
            },
            workers: this.entryWorkers.filter(w => w.name.trim() !== ''),
            workPerformed: document.getElementById('btb-work-performed')?.value || '',
            materials: this.entryMaterials.filter(m => m.name.trim() !== ''),
            incidents: document.getElementById('btb-incidents')?.value || '',
            visitors: this.entryVisitors.filter(v => v.name.trim() !== ''),
            instructions: document.getElementById('btb-instructions')?.value || '',
            photos: this.entryPhotos
        };
    }

    _saveEntry(andSign) {
        const data = this._gatherFormData();

        // Basic validation
        if (!data.workPerformed.trim()) {
            alert('Bitte beschreiben Sie die ausgef\u00fchrten Arbeiten (gesetzlich erforderlich).');
            document.getElementById('btb-work-performed')?.focus();
            return;
        }

        let entry;

        if (this.currentEntryId) {
            // Update existing
            entry = this.service.updateEntry(this.currentEntryId, data);
        } else {
            // Create new
            entry = this.service.createEntry(this.currentProjectId, data);
            this.currentEntryId = entry.id;
        }

        if (!entry) {
            alert('Fehler beim Speichern.');
            return;
        }

        // Sign if requested
        if (andSign && !entry.signed) {
            const signerName = prompt('Name f\u00fcr die digitale Unterschrift:');
            if (signerName && signerName.trim()) {
                this.service.signEntry(entry.id, signerName.trim());
            }
        }

        if (window.errorHandler) {
            window.errorHandler.success(andSign ? 'Eintrag gespeichert & unterschrieben' : 'Eintrag gespeichert');
        }

        this.renderProjectDiary();
    }

    _deleteEntry() {
        if (!this.currentEntryId) { return; }

        if (!confirm('M\u00f6chten Sie diesen Eintrag wirklich l\u00f6schen?')) { return; }

        this.service.deleteEntry(this.currentEntryId);
        this.currentEntryId = null;

        if (window.errorHandler) {
            window.errorHandler.success('Eintrag gel\u00f6scht');
        }

        this.renderProjectDiary();
    }

    // ============================================
    // Empty State Helper
    // ============================================

    _renderEmpty(title, subtitle) {
        return `
            <div class="btb-empty">
                <div class="btb-empty-icon">\uD83D\uDCCB</div>
                <div class="btb-empty-text">${this._esc(title)}</div>
                <div style="color:var(--text-muted);font-size:13px;">${this._esc(subtitle)}</div>
            </div>
        `;
    }
}

// Create global instance
window.bautagebuchUI = new BautagebuchUI();
