/* ============================================
   Apprentice Training Tracker UI - Berichtsheft
   Views: Apprentice Overview, Berichtsheft List,
   Weekly Report Form, Master Review
   ============================================ */

class ApprenticeUI {
    constructor() {
        this.container = null;
        this.currentView = 'overview';       // overview | reports | form | review
        this.currentApprenticeId = null;
        this.currentReportId = null;
        this.initCSS();
    }

    // ============================================
    // CSS Injection
    // ============================================

    initCSS() {
        if (document.getElementById('apprentice-ui-styles')) { return; }

        const style = document.createElement('style');
        style.id = 'apprentice-ui-styles';
        style.textContent = `
            /* Container */
            .azubi-container {
                max-width: 1100px;
                margin: 0 auto;
                padding: 20px;
            }

            /* Header bar */
            .azubi-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 24px;
                flex-wrap: wrap;
                gap: 12px;
            }

            .azubi-header h2 {
                margin: 0;
                font-size: 22px;
                font-weight: 700;
                color: var(--text-primary, #e4e4e7);
            }

            .azubi-header-sub {
                font-size: 13px;
                color: var(--text-muted, #71717a);
                margin-top: 2px;
            }

            /* Quick stats row */
            .azubi-stats {
                display: flex;
                gap: 16px;
                margin-bottom: 24px;
                flex-wrap: wrap;
            }

            .azubi-stat-card {
                flex: 1;
                min-width: 140px;
                background: var(--bg-secondary, #1c1c21);
                border: 1px solid var(--border-color, #2a2a32);
                border-radius: 10px;
                padding: 16px;
                text-align: center;
            }

            .azubi-stat-value {
                font-size: 28px;
                font-weight: 700;
                color: var(--text-primary, #e4e4e7);
                line-height: 1.2;
            }

            .azubi-stat-label {
                font-size: 12px;
                color: var(--text-muted, #71717a);
                margin-top: 4px;
            }

            /* Apprentice cards */
            .azubi-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
                gap: 16px;
            }

            .azubi-card {
                background: var(--bg-secondary, #1c1c21);
                border: 1px solid var(--border-color, #2a2a32);
                border-radius: 10px;
                padding: 20px;
                cursor: pointer;
                transition: border-color 0.2s, transform 0.15s;
            }

            .azubi-card:hover {
                border-color: var(--accent-primary, #6366f1);
                transform: translateY(-2px);
            }

            .azubi-card-name {
                font-size: 18px;
                font-weight: 700;
                color: var(--text-primary, #e4e4e7);
                margin-bottom: 4px;
            }

            .azubi-card-trade {
                font-size: 13px;
                color: var(--accent-primary, #6366f1);
                margin-bottom: 12px;
            }

            .azubi-card-info {
                font-size: 13px;
                color: var(--text-muted, #71717a);
                margin-bottom: 4px;
            }

            .azubi-card-info span {
                color: var(--text-primary, #e4e4e7);
            }

            /* Progress bar */
            .azubi-progress-wrap {
                margin-top: 12px;
            }

            .azubi-progress-label {
                display: flex;
                justify-content: space-between;
                font-size: 11px;
                color: var(--text-muted, #71717a);
                margin-bottom: 4px;
            }

            .azubi-progress-bar {
                width: 100%;
                height: 6px;
                background: var(--border-color, #2a2a32);
                border-radius: 3px;
                overflow: hidden;
            }

            .azubi-progress-fill {
                height: 100%;
                border-radius: 3px;
                background: var(--accent-primary, #6366f1);
                transition: width 0.4s ease;
            }

            /* Status badge */
            .azubi-badge {
                display: inline-block;
                padding: 3px 10px;
                font-size: 11px;
                font-weight: 600;
                border-radius: 4px;
                text-transform: uppercase;
                letter-spacing: 0.3px;
            }

            .azubi-badge-aktiv {
                background: #22c55e22;
                color: #22c55e;
                border: 1px solid #22c55e44;
            }

            .azubi-badge-abgeschlossen {
                background: #3b82f622;
                color: #3b82f6;
                border: 1px solid #3b82f644;
            }

            .azubi-badge-abgebrochen {
                background: #ef444422;
                color: #ef4444;
                border: 1px solid #ef444444;
            }

            /* Report status badges */
            .azubi-badge-genehmigt {
                background: #22c55e22;
                color: #22c55e;
                border: 1px solid #22c55e44;
            }

            .azubi-badge-eingereicht {
                background: #3b82f622;
                color: #3b82f6;
                border: 1px solid #3b82f644;
            }

            .azubi-badge-entwurf {
                background: #f59e0b22;
                color: #f59e0b;
                border: 1px solid #f59e0b44;
            }

            .azubi-badge-zurueckgewiesen {
                background: #ef444422;
                color: #ef4444;
                border: 1px solid #ef444444;
            }

            .azubi-badge-fehlend {
                background: #ef444422;
                color: #ef4444;
                border: 1px solid #ef444444;
            }

            /* Back button */
            .azubi-back-btn {
                display: inline-flex;
                align-items: center;
                gap: 6px;
                background: none;
                border: none;
                color: var(--accent-primary, #6366f1);
                font-size: 14px;
                cursor: pointer;
                padding: 6px 0;
                margin-bottom: 16px;
                font-family: inherit;
                transition: color 0.2s;
            }

            .azubi-back-btn:hover {
                color: var(--accent-secondary, #818cf8);
            }

            /* Buttons */
            .azubi-btn {
                display: inline-flex;
                align-items: center;
                gap: 6px;
                padding: 10px 20px;
                border-radius: 8px;
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
                border: 1px solid transparent;
                transition: all 0.2s ease;
                font-family: inherit;
            }

            .azubi-btn-primary {
                background: var(--accent-primary, #6366f1);
                color: #fff;
            }

            .azubi-btn-primary:hover {
                background: #4f46e5;
            }

            .azubi-btn-success {
                background: #22c55e;
                color: #fff;
            }

            .azubi-btn-success:hover {
                background: #16a34a;
            }

            .azubi-btn-danger {
                background: #ef4444;
                color: #fff;
            }

            .azubi-btn-danger:hover {
                background: #dc2626;
            }

            .azubi-btn-secondary {
                background: var(--bg-secondary, #2a2a32);
                color: var(--text-primary, #e4e4e7);
                border: 1px solid var(--border-color, #3a3a42);
            }

            .azubi-btn-secondary:hover {
                background: var(--border-color, #3a3a42);
            }

            .azubi-btn-small {
                padding: 6px 12px;
                font-size: 12px;
            }

            /* Week list */
            .azubi-week-list {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }

            .azubi-week-row {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 14px 18px;
                background: var(--bg-secondary, #1c1c21);
                border: 1px solid var(--border-color, #2a2a32);
                border-radius: 8px;
                cursor: pointer;
                transition: border-color 0.2s;
            }

            .azubi-week-row:hover {
                border-color: var(--accent-primary, #6366f1);
            }

            .azubi-week-kw {
                font-size: 16px;
                font-weight: 700;
                color: var(--text-primary, #e4e4e7);
                min-width: 60px;
            }

            .azubi-week-dates {
                font-size: 13px;
                color: var(--text-muted, #71717a);
                flex: 1;
            }

            .azubi-week-wordcount {
                font-size: 11px;
                color: var(--text-muted, #71717a);
                min-width: 60px;
                text-align: right;
            }

            /* Warning banner */
            .azubi-warning-banner {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 14px 18px;
                margin-bottom: 16px;
                background: #ef444418;
                border: 1px solid #ef444433;
                border-radius: 8px;
                color: #fca5a5;
                font-size: 14px;
            }

            .azubi-warning-banner strong {
                color: #ef4444;
            }

            /* Form section */
            .azubi-form {
                background: var(--bg-secondary, #1c1c21);
                border: 1px solid var(--border-color, #2a2a32);
                border-radius: 10px;
                padding: 24px;
                margin-bottom: 16px;
            }

            .azubi-form-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 20px;
                padding-bottom: 16px;
                border-bottom: 1px solid var(--border-color, #2a2a32);
            }

            .azubi-form-header h3 {
                margin: 0;
                font-size: 18px;
                font-weight: 700;
                color: var(--text-primary, #e4e4e7);
            }

            .azubi-form-group {
                margin-bottom: 16px;
            }

            .azubi-form-group label {
                display: block;
                font-size: 13px;
                font-weight: 600;
                color: var(--text-muted, #a1a1aa);
                margin-bottom: 6px;
            }

            .azubi-form-group input,
            .azubi-form-group select,
            .azubi-form-group textarea {
                width: 100%;
                padding: 10px 12px;
                font-size: 14px;
                background: var(--bg-primary, #0f0f12);
                border: 1px solid var(--border-color, #2a2a32);
                border-radius: 6px;
                color: var(--text-primary, #e4e4e7);
                font-family: inherit;
                box-sizing: border-box;
            }

            .azubi-form-group input:focus,
            .azubi-form-group select:focus,
            .azubi-form-group textarea:focus {
                outline: none;
                border-color: var(--accent-primary, #6366f1);
            }

            .azubi-form-group textarea {
                min-height: 80px;
                resize: vertical;
            }

            .azubi-form-row {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 16px;
            }

            /* Day entry rows */
            .azubi-day-entry {
                padding: 16px;
                margin-bottom: 12px;
                background: var(--bg-primary, #0f0f12);
                border: 1px solid var(--border-color, #2a2a32);
                border-radius: 8px;
            }

            .azubi-day-header {
                display: flex;
                align-items: center;
                gap: 12px;
                margin-bottom: 12px;
                flex-wrap: wrap;
            }

            .azubi-day-name {
                font-size: 15px;
                font-weight: 700;
                color: var(--text-primary, #e4e4e7);
                min-width: 110px;
            }

            .azubi-day-date {
                font-size: 13px;
                color: var(--text-muted, #71717a);
            }

            .azubi-day-header select,
            .azubi-day-header input {
                padding: 6px 10px;
                font-size: 13px;
                background: var(--bg-secondary, #1c1c21);
                border: 1px solid var(--border-color, #2a2a32);
                border-radius: 6px;
                color: var(--text-primary, #e4e4e7);
                font-family: inherit;
            }

            .azubi-day-header input[type="number"] {
                width: 70px;
                text-align: center;
            }

            .azubi-day-activities textarea {
                width: 100%;
                min-height: 60px;
                padding: 10px 12px;
                font-size: 13px;
                background: var(--bg-secondary, #1c1c21);
                border: 1px solid var(--border-color, #2a2a32);
                border-radius: 6px;
                color: var(--text-primary, #e4e4e7);
                font-family: inherit;
                resize: vertical;
                box-sizing: border-box;
            }

            .azubi-day-activities textarea:focus {
                outline: none;
                border-color: var(--accent-primary, #6366f1);
            }

            .azubi-day-activities label {
                display: block;
                font-size: 12px;
                font-weight: 600;
                color: var(--text-muted, #a1a1aa);
                margin-bottom: 4px;
            }

            /* Form actions */
            .azubi-form-actions {
                display: flex;
                gap: 12px;
                margin-top: 24px;
                flex-wrap: wrap;
            }

            /* Review list */
            .azubi-review-list {
                display: flex;
                flex-direction: column;
                gap: 12px;
            }

            .azubi-review-card {
                background: var(--bg-secondary, #1c1c21);
                border: 1px solid var(--border-color, #2a2a32);
                border-radius: 10px;
                padding: 20px;
            }

            .azubi-review-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 12px;
                flex-wrap: wrap;
                gap: 8px;
            }

            .azubi-review-meta {
                font-size: 13px;
                color: var(--text-muted, #71717a);
            }

            .azubi-review-day {
                padding: 8px 12px;
                margin-bottom: 6px;
                background: var(--bg-primary, #0f0f12);
                border-radius: 6px;
                font-size: 13px;
                color: var(--text-primary, #e4e4e7);
            }

            .azubi-review-day strong {
                color: var(--text-muted, #a1a1aa);
                min-width: 100px;
                display: inline-block;
            }

            .azubi-review-actions {
                display: flex;
                gap: 12px;
                margin-top: 16px;
                align-items: flex-start;
                flex-wrap: wrap;
            }

            .azubi-review-actions textarea {
                flex: 1;
                min-width: 200px;
                min-height: 60px;
                padding: 10px 12px;
                font-size: 13px;
                background: var(--bg-primary, #0f0f12);
                border: 1px solid var(--border-color, #2a2a32);
                border-radius: 6px;
                color: var(--text-primary, #e4e4e7);
                font-family: inherit;
                resize: vertical;
                box-sizing: border-box;
            }

            /* Empty state */
            .azubi-empty {
                text-align: center;
                padding: 48px 24px;
                color: var(--text-muted, #71717a);
                font-size: 15px;
            }

            .azubi-empty-icon {
                font-size: 48px;
                margin-bottom: 12px;
                display: block;
            }

            /* Modal */
            .azubi-modal-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0,0,0,0.6);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 9999;
                padding: 20px;
            }

            .azubi-modal {
                background: var(--bg-secondary, #1c1c21);
                border: 1px solid var(--border-color, #2a2a32);
                border-radius: 12px;
                padding: 28px;
                max-width: 520px;
                width: 100%;
                max-height: 90vh;
                overflow-y: auto;
            }

            .azubi-modal h3 {
                margin: 0 0 20px 0;
                font-size: 18px;
                font-weight: 700;
                color: var(--text-primary, #e4e4e7);
            }

            /* Checkbox row for school days */
            .azubi-checkbox-row {
                display: flex;
                flex-wrap: wrap;
                gap: 12px;
                margin-top: 6px;
            }

            .azubi-checkbox-row label {
                display: inline-flex;
                align-items: center;
                gap: 4px;
                font-size: 13px;
                font-weight: 400;
                color: var(--text-primary, #e4e4e7);
                cursor: pointer;
            }

            /* Responsive */
            @media (max-width: 600px) {
                .azubi-container {
                    padding: 12px;
                }

                .azubi-grid {
                    grid-template-columns: 1fr;
                }

                .azubi-form-row {
                    grid-template-columns: 1fr;
                }

                .azubi-header {
                    flex-direction: column;
                    align-items: flex-start;
                }

                .azubi-stats {
                    flex-direction: column;
                }

                .azubi-day-header {
                    flex-direction: column;
                    align-items: flex-start;
                }

                .azubi-review-actions {
                    flex-direction: column;
                }
            }
        `;
        document.head.appendChild(style);
    }

    // ============================================
    // Helpers
    // ============================================

    _esc(str) {
        if (!str) { return ''; }
        const div = document.createElement('div');
        div.textContent = String(str);
        return div.innerHTML;
    }

    _formatDateDE(dateStr) {
        if (!dateStr) { return '-'; }
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) { return dateStr; }
        return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
    }

    _getService() {
        return window.apprenticeService;
    }

    // ============================================
    // Mount / Navigation
    // ============================================

    /**
     * Mount the UI into a container element.
     * @param {string} containerId - DOM element ID
     */
    mount(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            console.error('[ApprenticeUI] Container nicht gefunden:', containerId);
            return;
        }
        this.showOverview();
    }

    /**
     * Navigate to a specific view.
     */
    showOverview() {
        this.currentView = 'overview';
        this.currentApprenticeId = null;
        this.currentReportId = null;
        this._renderOverview();
    }

    showReports(apprenticeId) {
        this.currentView = 'reports';
        this.currentApprenticeId = apprenticeId;
        this.currentReportId = null;
        this._renderReports();
    }

    showReportForm(reportId) {
        this.currentView = 'form';
        this.currentReportId = reportId;
        this._renderReportForm();
    }

    showNewReport(apprenticeId) {
        const svc = this._getService();
        const week = svc.getCurrentWeek();
        const report = svc.createWeeklyReport(apprenticeId, week.weekStart);
        this.currentView = 'form';
        this.currentReportId = report.id;
        this.currentApprenticeId = apprenticeId;
        this._renderReportForm();
    }

    showNewReportForWeek(apprenticeId, weekStart) {
        const svc = this._getService();
        const report = svc.createWeeklyReport(apprenticeId, weekStart);
        this.currentView = 'form';
        this.currentReportId = report.id;
        this.currentApprenticeId = apprenticeId;
        this._renderReportForm();
    }

    showReview() {
        this.currentView = 'review';
        this._renderReview();
    }

    // ============================================
    // 1. Apprentice Overview
    // ============================================

    _renderOverview() {
        if (!this.container) { return; }
        const svc = this._getService();
        const apprentices = svc.getApprentices();

        // Calculate quick stats
        const active = apprentices.filter(a => a.status === 'aktiv').length;
        let missingCount = 0;
        let pendingApproval = 0;

        apprentices.forEach(a => {
            if (a.status === 'aktiv') {
                missingCount += svc.getMissingReports(a.id).length;
            }
            const reports = svc.getWeeklyReports(a.id);
            pendingApproval += reports.filter(r => r.status === 'eingereicht').length;
        });

        let cardsHtml = '';
        if (apprentices.length === 0) {
            cardsHtml = `
                <div class="azubi-empty">
                    <span class="azubi-empty-icon">&#128218;</span>
                    Noch keine Azubis angelegt.<br>
                    Legen Sie Ihren ersten Auszubildenden an.
                </div>
            `;
        } else {
            cardsHtml = '<div class="azubi-grid">' + apprentices.map(a => this._renderApprenticeCard(a)).join('') + '</div>';
        }

        this.container.innerHTML = `
            <div class="azubi-container">
                <div class="azubi-header">
                    <div>
                        <h2>Berichtsheft - Azubi-Verwaltung</h2>
                        <div class="azubi-header-sub">Ausbildungsnachweise und Wochenberichte</div>
                    </div>
                    <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                        ${pendingApproval > 0 ? `<button class="azubi-btn azubi-btn-secondary" data-action="show-review">Zur Genehmigung (${pendingApproval})</button>` : ''}
                        <button class="azubi-btn azubi-btn-primary" data-action="new-apprentice">+ Neuer Azubi</button>
                    </div>
                </div>

                <div class="azubi-stats">
                    <div class="azubi-stat-card">
                        <div class="azubi-stat-value">${active}</div>
                        <div class="azubi-stat-label">Aktive Azubis</div>
                    </div>
                    <div class="azubi-stat-card">
                        <div class="azubi-stat-value" style="color: ${missingCount > 0 ? '#ef4444' : '#22c55e'};">${missingCount}</div>
                        <div class="azubi-stat-label">Fehlende Berichte</div>
                    </div>
                    <div class="azubi-stat-card">
                        <div class="azubi-stat-value" style="color: ${pendingApproval > 0 ? '#f59e0b' : '#22c55e'};">${pendingApproval}</div>
                        <div class="azubi-stat-label">Zur Genehmigung</div>
                    </div>
                </div>

                ${cardsHtml}
            </div>
        `;

        this._attachOverviewEvents();
    }

    _renderApprenticeCard(apprentice) {
        const svc = this._getService();
        const progress = this._calcTrainingProgress(apprentice);
        const submissionRate = svc.getSubmissionRate(apprentice.id);
        const badgeClass = 'azubi-badge-' + apprentice.status;
        const statusLabels = { aktiv: 'Aktiv', abgeschlossen: 'Abgeschlossen', abgebrochen: 'Abgebrochen' };

        return `
            <div class="azubi-card" data-action="open-reports" data-id="${this._esc(apprentice.id)}">
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <div>
                        <div class="azubi-card-name">${this._esc(apprentice.name)}</div>
                        <div class="azubi-card-trade">${this._esc(apprentice.trade)}</div>
                    </div>
                    <span class="azubi-badge ${badgeClass}">${statusLabels[apprentice.status] || apprentice.status}</span>
                </div>
                <div class="azubi-card-info">Lehrjahr: <span>${this._esc(String(apprentice.trainingYear))}</span></div>
                <div class="azubi-card-info">Schule: <span>${this._esc(apprentice.school || '-')}</span></div>
                <div class="azubi-card-info">Schultage: <span>${apprentice.schoolDays.length > 0 ? this._esc(apprentice.schoolDays.join(', ')) : '-'}</span></div>
                <div class="azubi-card-info">Berichtsquote: <span>${submissionRate}%</span></div>
                <div class="azubi-progress-wrap">
                    <div class="azubi-progress-label">
                        <span>${this._formatDateDE(apprentice.trainingStart)}</span>
                        <span>${progress}% Ausbildung</span>
                        <span>${this._formatDateDE(apprentice.trainingEnd)}</span>
                    </div>
                    <div class="azubi-progress-bar">
                        <div class="azubi-progress-fill" style="width: ${Math.min(100, Math.max(0, progress))}%;"></div>
                    </div>
                </div>
            </div>
        `;
    }

    _calcTrainingProgress(apprentice) {
        if (!apprentice.trainingStart || !apprentice.trainingEnd) { return 0; }
        const start = new Date(apprentice.trainingStart).getTime();
        const end = new Date(apprentice.trainingEnd).getTime();
        const now = Date.now();
        if (end <= start) { return 0; }
        const progress = ((now - start) / (end - start)) * 100;
        return Math.round(Math.min(100, Math.max(0, progress)));
    }

    _attachOverviewEvents() {
        if (!this.container) { return; }

        // Open reports for an apprentice
        this.container.querySelectorAll('[data-action="open-reports"]').forEach(el => {
            el.addEventListener('click', () => {
                const id = el.dataset.id;
                if (id) { this.showReports(id); }
            });
        });

        // New apprentice
        this.container.querySelector('[data-action="new-apprentice"]')?.addEventListener('click', () => {
            this._showApprenticeModal();
        });

        // Show review
        this.container.querySelector('[data-action="show-review"]')?.addEventListener('click', () => {
            this.showReview();
        });
    }

    // ============================================
    // Apprentice Modal (Add/Edit)
    // ============================================

    _showApprenticeModal(apprenticeId) {
        const svc = this._getService();
        const existing = apprenticeId ? svc.getApprentice(apprenticeId) : null;
        const isEdit = !!existing;
        const title = isEdit ? 'Azubi bearbeiten' : 'Neuen Azubi anlegen';

        const weekDays = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag'];
        const schoolDaysChecks = weekDays.map(day => {
            const checked = existing && existing.schoolDays.includes(day) ? 'checked' : '';
            return `<label><input type="checkbox" name="schoolDay" value="${day}" ${checked}> ${day}</label>`;
        }).join('');

        const overlay = document.createElement('div');
        overlay.className = 'azubi-modal-overlay';
        overlay.id = 'azubi-modal-overlay';
        overlay.innerHTML = `
            <div class="azubi-modal">
                <h3>${this._esc(title)}</h3>
                <form id="azubi-modal-form">
                    <div class="azubi-form-group">
                        <label for="azubi-name">Name *</label>
                        <input type="text" id="azubi-name" required value="${this._esc(existing?.name || '')}" placeholder="Vor- und Nachname">
                    </div>
                    <div class="azubi-form-group">
                        <label for="azubi-trade">Ausbildungsberuf *</label>
                        <input type="text" id="azubi-trade" required value="${this._esc(existing?.trade || '')}" placeholder="z.B. Anlagenmechaniker SHK">
                    </div>
                    <div class="azubi-form-row">
                        <div class="azubi-form-group">
                            <label for="azubi-start">Ausbildungsbeginn</label>
                            <input type="date" id="azubi-start" value="${this._esc(existing?.trainingStart || '')}">
                        </div>
                        <div class="azubi-form-group">
                            <label for="azubi-end">Geplantes Ende</label>
                            <input type="date" id="azubi-end" value="${this._esc(existing?.trainingEnd || '')}">
                        </div>
                    </div>
                    <div class="azubi-form-row">
                        <div class="azubi-form-group">
                            <label for="azubi-year">Lehrjahr</label>
                            <select id="azubi-year">
                                <option value="1" ${existing?.trainingYear === 1 ? 'selected' : ''}>1. Lehrjahr</option>
                                <option value="2" ${existing?.trainingYear === 2 ? 'selected' : ''}>2. Lehrjahr</option>
                                <option value="3" ${existing?.trainingYear === 3 ? 'selected' : ''}>3. Lehrjahr</option>
                                <option value="3.5" ${existing?.trainingYear === 3.5 ? 'selected' : ''}>3,5. Lehrjahr</option>
                            </select>
                        </div>
                        <div class="azubi-form-group">
                            <label for="azubi-status">Status</label>
                            <select id="azubi-status">
                                <option value="aktiv" ${existing?.status === 'aktiv' || !existing ? 'selected' : ''}>Aktiv</option>
                                <option value="abgeschlossen" ${existing?.status === 'abgeschlossen' ? 'selected' : ''}>Abgeschlossen</option>
                                <option value="abgebrochen" ${existing?.status === 'abgebrochen' ? 'selected' : ''}>Abgebrochen</option>
                            </select>
                        </div>
                    </div>
                    <div class="azubi-form-group">
                        <label for="azubi-school">Berufsschule</label>
                        <input type="text" id="azubi-school" value="${this._esc(existing?.school || '')}" placeholder="Name der Berufsschule">
                    </div>
                    <div class="azubi-form-group">
                        <label>Schultage</label>
                        <div class="azubi-checkbox-row">
                            ${schoolDaysChecks}
                        </div>
                    </div>
                    <div class="azubi-form-row">
                        <div class="azubi-form-group">
                            <label for="azubi-phone">Telefon</label>
                            <input type="tel" id="azubi-phone" value="${this._esc(existing?.phone || '')}" placeholder="Telefonnummer">
                        </div>
                        <div class="azubi-form-group">
                            <label for="azubi-email">E-Mail</label>
                            <input type="email" id="azubi-email" value="${this._esc(existing?.email || '')}" placeholder="E-Mail-Adresse">
                        </div>
                    </div>
                    <div class="azubi-form-actions">
                        <button type="submit" class="azubi-btn azubi-btn-primary">${isEdit ? 'Speichern' : 'Azubi anlegen'}</button>
                        <button type="button" class="azubi-btn azubi-btn-secondary" data-action="close-modal">Abbrechen</button>
                        ${isEdit ? `<button type="button" class="azubi-btn azubi-btn-danger azubi-btn-small" data-action="delete-apprentice" style="margin-left: auto;">Entfernen</button>` : ''}
                    </div>
                </form>
            </div>
        `;

        document.body.appendChild(overlay);

        // Close modal
        overlay.querySelector('[data-action="close-modal"]').addEventListener('click', () => {
            overlay.remove();
        });
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) { overlay.remove(); }
        });

        // Delete
        overlay.querySelector('[data-action="delete-apprentice"]')?.addEventListener('click', () => {
            if (confirm('Azubi und alle Berichte wirklich loeschen?')) {
                svc.removeApprentice(apprenticeId);
                overlay.remove();
                this.showOverview();
            }
        });

        // Submit form
        overlay.querySelector('#azubi-modal-form').addEventListener('submit', (e) => {
            e.preventDefault();

            const schoolDays = [];
            overlay.querySelectorAll('input[name="schoolDay"]:checked').forEach(cb => {
                schoolDays.push(cb.value);
            });

            const data = {
                name: document.getElementById('azubi-name').value.trim(),
                trade: document.getElementById('azubi-trade').value.trim(),
                trainingStart: document.getElementById('azubi-start').value,
                trainingEnd: document.getElementById('azubi-end').value,
                trainingYear: parseFloat(document.getElementById('azubi-year').value),
                school: document.getElementById('azubi-school').value.trim(),
                schoolDays: schoolDays,
                phone: document.getElementById('azubi-phone').value.trim(),
                email: document.getElementById('azubi-email').value.trim(),
                status: document.getElementById('azubi-status').value
            };

            if (!data.name) {
                alert('Bitte einen Namen eingeben.');
                return;
            }

            if (isEdit) {
                svc.updateApprentice(apprenticeId, data);
            } else {
                svc.addApprentice(data);
            }

            overlay.remove();
            this.showOverview();
        });

        // Focus first field
        setTimeout(() => {
            document.getElementById('azubi-name')?.focus();
        }, 100);
    }

    // ============================================
    // 2. Berichtsheft Overview (per apprentice)
    // ============================================

    _renderReports() {
        if (!this.container) { return; }
        const svc = this._getService();
        const apprentice = svc.getApprentice(this.currentApprenticeId);
        if (!apprentice) {
            this.showOverview();
            return;
        }

        const reports = svc.getWeeklyReports(this.currentApprenticeId);
        const missing = svc.getMissingReports(this.currentApprenticeId);
        const submissionRate = svc.getSubmissionRate(this.currentApprenticeId);

        // Warning banner for missing reports
        let warningHtml = '';
        if (missing.length > 0) {
            warningHtml = `
                <div class="azubi-warning-banner">
                    <strong>Achtung:</strong> ${missing.length} Woche${missing.length > 1 ? 'n' : ''} ohne Bericht.
                    Fuer die Gesellenpruefung muessen alle Wochen ausgefuellt sein.
                </div>
            `;
        }

        // Build week rows
        let weekListHtml = '';
        if (reports.length === 0 && missing.length === 0) {
            weekListHtml = `
                <div class="azubi-empty">
                    <span class="azubi-empty-icon">&#128221;</span>
                    Noch keine Wochenberichte vorhanden.
                </div>
            `;
        } else {
            // Merge reports and missing weeks, sort by year/week descending
            const allWeeks = [];

            reports.forEach(r => {
                // Count total characters in activities
                let wordCount = 0;
                if (Array.isArray(r.days)) {
                    r.days.forEach(d => {
                        wordCount += (d.activities || '').length + (d.schoolSubjects || '').length;
                    });
                }
                wordCount += (r.weeklyNotes || '').length;

                allWeeks.push({
                    type: 'report',
                    weekNumber: r.weekNumber,
                    year: r.year,
                    weekStart: r.weekStart,
                    weekEnd: r.weekEnd,
                    status: r.status,
                    reportId: r.id,
                    wordCount: wordCount
                });
            });

            // Add missing weeks (only recent ones, limit to 20)
            missing.slice(0, 20).forEach(m => {
                // Check if we already have this week
                const exists = allWeeks.find(w => w.weekNumber === m.weekNumber && w.year === m.year);
                if (!exists) {
                    allWeeks.push({
                        type: 'missing',
                        weekNumber: m.weekNumber,
                        year: m.year,
                        weekStart: m.weekStart,
                        weekEnd: '',
                        status: 'fehlend',
                        reportId: null,
                        wordCount: 0
                    });
                }
            });

            // Sort descending
            allWeeks.sort((a, b) => {
                if (a.year !== b.year) { return b.year - a.year; }
                return b.weekNumber - a.weekNumber;
            });

            weekListHtml = '<div class="azubi-week-list">' + allWeeks.map(w => {
                const badgeClass = 'azubi-badge-' + w.status;
                const statusLabels = {
                    genehmigt: 'Genehmigt',
                    eingereicht: 'Eingereicht',
                    entwurf: 'Entwurf',
                    zurueckgewiesen: 'Korrektur noetig',
                    fehlend: 'Fehlend'
                };
                const statusLabel = statusLabels[w.status] || w.status;

                const wordIndicator = w.wordCount > 0
                    ? `${w.wordCount} Zeichen`
                    : '';

                const dateRange = w.weekEnd
                    ? `${this._formatDateDE(w.weekStart)} - ${this._formatDateDE(w.weekEnd)}`
                    : this._formatDateDE(w.weekStart);

                const action = w.type === 'report'
                    ? `data-action="open-report" data-id="${this._esc(w.reportId)}"`
                    : `data-action="create-report-week" data-week-start="${this._esc(w.weekStart)}"`;

                return `
                    <div class="azubi-week-row" ${action}>
                        <div class="azubi-week-kw">KW ${w.weekNumber}</div>
                        <div class="azubi-week-dates">${dateRange}</div>
                        <div class="azubi-week-wordcount">${this._esc(wordIndicator)}</div>
                        <span class="azubi-badge ${badgeClass}">${this._esc(statusLabel)}</span>
                    </div>
                `;
            }).join('') + '</div>';
        }

        this.container.innerHTML = `
            <div class="azubi-container">
                <button class="azubi-back-btn" data-action="back-overview">&larr; Zurueck zur Uebersicht</button>

                <div class="azubi-header">
                    <div>
                        <h2>${this._esc(apprentice.name)}</h2>
                        <div class="azubi-header-sub">
                            ${this._esc(apprentice.trade)} &middot; ${apprentice.trainingYear}. Lehrjahr &middot; Berichtsquote: ${submissionRate}%
                        </div>
                    </div>
                    <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                        <button class="azubi-btn azubi-btn-secondary azubi-btn-small" data-action="edit-apprentice">Azubi bearbeiten</button>
                        <button class="azubi-btn azubi-btn-primary" data-action="new-report">+ Neuer Wochenbericht</button>
                    </div>
                </div>

                ${warningHtml}
                ${weekListHtml}
            </div>
        `;

        this._attachReportsEvents();
    }

    _attachReportsEvents() {
        if (!this.container) { return; }

        this.container.querySelector('[data-action="back-overview"]')?.addEventListener('click', () => {
            this.showOverview();
        });

        this.container.querySelector('[data-action="edit-apprentice"]')?.addEventListener('click', () => {
            this._showApprenticeModal(this.currentApprenticeId);
        });

        this.container.querySelector('[data-action="new-report"]')?.addEventListener('click', () => {
            this.showNewReport(this.currentApprenticeId);
        });

        this.container.querySelectorAll('[data-action="open-report"]').forEach(el => {
            el.addEventListener('click', () => {
                const id = el.dataset.id;
                if (id) { this.showReportForm(id); }
            });
        });

        this.container.querySelectorAll('[data-action="create-report-week"]').forEach(el => {
            el.addEventListener('click', () => {
                const weekStart = el.dataset.weekStart;
                if (weekStart) {
                    this.showNewReportForWeek(this.currentApprenticeId, weekStart);
                }
            });
        });
    }

    // ============================================
    // 3. Weekly Report Form
    // ============================================

    _renderReportForm() {
        if (!this.container) { return; }
        const svc = this._getService();
        const report = svc.getWeeklyReport(this.currentReportId);
        if (!report) {
            this.showOverview();
            return;
        }

        const apprentice = svc.getApprentice(report.apprenticeId);
        const isReadOnly = report.status === 'genehmigt';

        const typeLabels = {
            betrieb: 'Betrieb',
            schule: 'Berufsschule',
            urlaub: 'Urlaub',
            krank: 'Krank',
            feiertag: 'Feiertag'
        };

        // Day entries
        const daysHtml = (report.days || []).map((day, idx) => {
            const typeOptions = Object.entries(typeLabels).map(([val, label]) => {
                return `<option value="${val}" ${day.type === val ? 'selected' : ''}>${label}</option>`;
            }).join('');

            const isSchool = day.type === 'schule';
            const activityLabel = isSchool ? 'Schulstoff (Was wurde gelernt?)' : 'Taetigkeiten (Was wurde gemacht?)';
            const activityValue = isSchool ? (day.schoolSubjects || '') : (day.activities || '');

            return `
                <div class="azubi-day-entry" data-day-idx="${idx}">
                    <div class="azubi-day-header">
                        <div class="azubi-day-name">${this._esc(day.dayName)}</div>
                        <div class="azubi-day-date">${this._formatDateDE(day.date)}</div>
                        <select data-field="type" data-idx="${idx}" ${isReadOnly ? 'disabled' : ''}>
                            ${typeOptions}
                        </select>
                        <input type="number" data-field="hours" data-idx="${idx}" value="${day.hours}" min="0" max="12" step="0.5" ${isReadOnly ? 'disabled' : ''}> Std.
                    </div>
                    <div class="azubi-day-activities">
                        <label>${activityLabel}</label>
                        <textarea data-field="activity" data-idx="${idx}" placeholder="Beschreiben Sie die Taetigkeiten des Tages..." ${isReadOnly ? 'disabled' : ''}>${this._esc(activityValue)}</textarea>
                    </div>
                </div>
            `;
        }).join('');

        // Feedback banner
        let feedbackHtml = '';
        if (report.status === 'zurueckgewiesen' && report.feedback) {
            feedbackHtml = `
                <div class="azubi-warning-banner">
                    <strong>Korrektur noetig:</strong> ${this._esc(report.feedback)}
                </div>
            `;
        }

        // Status info
        const statusLabels = {
            entwurf: 'Entwurf',
            eingereicht: 'Eingereicht',
            genehmigt: 'Genehmigt',
            zurueckgewiesen: 'Korrektur noetig'
        };

        // Sign-off info
        let signoffHtml = '';
        if (report.apprenticeSigned) {
            signoffHtml += `<div class="azubi-card-info">Azubi unterschrieben: <span>${this._formatDateDE(report.apprenticeSignedAt)}</span></div>`;
        }
        if (report.masterSigned) {
            signoffHtml += `<div class="azubi-card-info">Meister: <span>${this._esc(report.masterName)} (${this._formatDateDE(report.masterSignedAt)})</span></div>`;
        }

        this.container.innerHTML = `
            <div class="azubi-container">
                <button class="azubi-back-btn" data-action="back-reports">&larr; Zurueck zu den Berichten</button>

                ${feedbackHtml}

                <div class="azubi-form">
                    <div class="azubi-form-header">
                        <div>
                            <h3>Wochenbericht KW ${report.weekNumber} / ${report.year}</h3>
                            <div class="azubi-header-sub">
                                ${this._formatDateDE(report.weekStart)} - ${this._formatDateDE(report.weekEnd)}
                                ${apprentice ? ' &middot; ' + this._esc(apprentice.name) : ''}
                            </div>
                        </div>
                        <span class="azubi-badge azubi-badge-${report.status}">${statusLabels[report.status] || report.status}</span>
                    </div>

                    <div class="azubi-form-row">
                        <div class="azubi-form-group">
                            <label for="report-department">Abteilung / Einsatzbereich</label>
                            <input type="text" id="report-department" value="${this._esc(report.department)}" placeholder="z.B. Werkstatt, Baustelle, Buero" ${isReadOnly ? 'disabled' : ''}>
                        </div>
                        <div class="azubi-form-group">
                            <label for="report-year">Ausbildungsjahr</label>
                            <select id="report-year" ${isReadOnly ? 'disabled' : ''}>
                                <option value="1" ${report.trainingYear === 1 ? 'selected' : ''}>1. Lehrjahr</option>
                                <option value="2" ${report.trainingYear === 2 ? 'selected' : ''}>2. Lehrjahr</option>
                                <option value="3" ${report.trainingYear === 3 ? 'selected' : ''}>3. Lehrjahr</option>
                                <option value="3.5" ${report.trainingYear === 3.5 ? 'selected' : ''}>3,5. Lehrjahr</option>
                            </select>
                        </div>
                    </div>

                    <h3 style="margin: 20px 0 12px; font-size: 16px; color: var(--text-primary, #e4e4e7);">Tageseintraege</h3>

                    ${!isReadOnly ? `<button class="azubi-btn azubi-btn-secondary azubi-btn-small" data-action="auto-fill" style="margin-bottom: 16px;">Aus Zeiterfassung uebernehmen</button>` : ''}

                    ${daysHtml}

                    <div class="azubi-form-group" style="margin-top: 20px;">
                        <label for="report-notes">Wochennotizen (optional)</label>
                        <textarea id="report-notes" placeholder="Zusammenfassung der Woche, besondere Vorkommnisse..." ${isReadOnly ? 'disabled' : ''}>${this._esc(report.weeklyNotes)}</textarea>
                    </div>

                    ${signoffHtml}

                    ${!isReadOnly ? `
                        <div class="azubi-form-actions">
                            <button class="azubi-btn azubi-btn-secondary" data-action="save-draft">Speichern (Entwurf)</button>
                            <button class="azubi-btn azubi-btn-primary" data-action="submit-report">Einreichen</button>
                            <button class="azubi-btn azubi-btn-danger azubi-btn-small" data-action="delete-report" style="margin-left: auto;">Loeschen</button>
                        </div>
                    ` : `
                        <div class="azubi-form-actions">
                            <button class="azubi-btn azubi-btn-secondary" data-action="export-text">Als Text exportieren</button>
                        </div>
                    `}
                </div>
            </div>
        `;

        this._attachFormEvents(report);
    }

    _collectFormData() {
        const data = {
            department: document.getElementById('report-department')?.value.trim() || '',
            trainingYear: parseFloat(document.getElementById('report-year')?.value) || 1,
            weeklyNotes: document.getElementById('report-notes')?.value || '',
            days: []
        };

        // Collect day entries
        this.container.querySelectorAll('.azubi-day-entry').forEach(dayEl => {
            const idx = parseInt(dayEl.dataset.dayIdx, 10);
            const type = dayEl.querySelector('[data-field="type"]')?.value || 'betrieb';
            const hours = parseFloat(dayEl.querySelector('[data-field="hours"]')?.value) || 0;
            const activityText = dayEl.querySelector('[data-field="activity"]')?.value || '';

            // Get existing day data
            const svc = this._getService();
            const report = svc.getWeeklyReport(this.currentReportId);
            const existingDay = report?.days?.[idx] || {};

            const dayData = {
                date: existingDay.date || '',
                dayName: existingDay.dayName || '',
                type: type,
                hours: hours,
                activities: type !== 'schule' ? activityText : (existingDay.activities || ''),
                schoolSubjects: type === 'schule' ? activityText : (existingDay.schoolSubjects || ''),
                skills: existingDay.skills || []
            };

            data.days.push(dayData);
        });

        return data;
    }

    _attachFormEvents(report) {
        if (!this.container) { return; }

        this.container.querySelector('[data-action="back-reports"]')?.addEventListener('click', () => {
            this.showReports(report.apprenticeId);
        });

        // Type change: update textarea label
        this.container.querySelectorAll('[data-field="type"]').forEach(sel => {
            sel.addEventListener('change', () => {
                const dayEntry = sel.closest('.azubi-day-entry');
                const label = dayEntry.querySelector('.azubi-day-activities label');
                if (sel.value === 'schule') {
                    label.textContent = 'Schulstoff (Was wurde gelernt?)';
                } else {
                    label.textContent = 'Taetigkeiten (Was wurde gemacht?)';
                }
            });
        });

        // Auto-fill from time entries
        this.container.querySelector('[data-action="auto-fill"]')?.addEventListener('click', () => {
            const svc = this._getService();
            const filled = svc.autoFillWeek(report.apprenticeId, report.weekStart);

            filled.forEach((day, idx) => {
                const dayEl = this.container.querySelector(`[data-day-idx="${idx}"]`);
                if (dayEl && day.activities) {
                    const textarea = dayEl.querySelector('[data-field="activity"]');
                    if (textarea && !textarea.value.trim()) {
                        textarea.value = day.activities;
                    }
                    const hoursInput = dayEl.querySelector('[data-field="hours"]');
                    if (hoursInput && day.hours > 0) {
                        hoursInput.value = day.hours;
                    }
                }
            });

            if (window.errorHandler) {
                window.errorHandler.success('Zeiterfassungsdaten uebernommen');
            }
        });

        // Save as draft
        this.container.querySelector('[data-action="save-draft"]')?.addEventListener('click', () => {
            const data = this._collectFormData();
            data.status = 'entwurf';
            const svc = this._getService();
            svc.updateWeeklyReport(this.currentReportId, data);

            if (window.errorHandler) {
                window.errorHandler.success('Bericht als Entwurf gespeichert');
            }
        });

        // Submit report
        this.container.querySelector('[data-action="submit-report"]')?.addEventListener('click', () => {
            const data = this._collectFormData();

            // Check that at least some content was written
            const hasContent = data.days.some(d =>
                (d.activities && d.activities.trim()) || (d.schoolSubjects && d.schoolSubjects.trim())
            );

            if (!hasContent) {
                alert('Bitte fuer mindestens einen Tag Taetigkeiten eintragen.');
                return;
            }

            const svc = this._getService();
            svc.updateWeeklyReport(this.currentReportId, data);
            svc.submitReport(this.currentReportId);

            if (window.errorHandler) {
                window.errorHandler.success('Bericht eingereicht');
            }

            this.showReports(report.apprenticeId);
        });

        // Delete report
        this.container.querySelector('[data-action="delete-report"]')?.addEventListener('click', () => {
            if (confirm('Wochenbericht wirklich loeschen?')) {
                const svc = this._getService();
                svc.deleteWeeklyReport(this.currentReportId);

                if (window.errorHandler) {
                    window.errorHandler.success('Bericht geloescht');
                }

                this.showReports(report.apprenticeId);
            }
        });

        // Export as text
        this.container.querySelector('[data-action="export-text"]')?.addEventListener('click', () => {
            const svc = this._getService();
            const text = svc.exportReportAsText(this.currentReportId);
            if (text) {
                const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `Berichtsheft_KW${report.weekNumber}_${report.year}.txt`;
                a.click();
                URL.revokeObjectURL(url);
            }
        });
    }

    // ============================================
    // 4. Master Review View
    // ============================================

    _renderReview() {
        if (!this.container) { return; }
        const svc = this._getService();

        // Gather all submitted reports across all apprentices
        const allApprentices = svc.getApprentices();
        const pendingReports = [];

        allApprentices.forEach(a => {
            const reports = svc.getWeeklyReports(a.id);
            reports.forEach(r => {
                if (r.status === 'eingereicht') {
                    pendingReports.push({
                        report: r,
                        apprentice: a
                    });
                }
            });
        });

        // Sort by submission date
        pendingReports.sort((a, b) => {
            return (a.report.apprenticeSignedAt || '').localeCompare(b.report.apprenticeSignedAt || '');
        });

        const typeLabels = {
            betrieb: 'Betrieb',
            schule: 'Schule',
            urlaub: 'Urlaub',
            krank: 'Krank',
            feiertag: 'Feiertag'
        };

        let listHtml = '';
        if (pendingReports.length === 0) {
            listHtml = `
                <div class="azubi-empty">
                    <span class="azubi-empty-icon">&#9989;</span>
                    Keine Berichte zur Genehmigung vorhanden.
                </div>
            `;
        } else {
            listHtml = '<div class="azubi-review-list">' + pendingReports.map(({ report, apprentice }) => {
                const daysHtml = (report.days || []).map(day => {
                    const activity = day.type === 'schule'
                        ? (day.schoolSubjects || '-')
                        : (day.activities || '-');

                    return `
                        <div class="azubi-review-day">
                            <strong>${this._esc(day.dayName)}</strong>
                            ${this._esc(typeLabels[day.type] || day.type)} (${day.hours} Std.) &mdash;
                            ${this._esc(activity)}
                        </div>
                    `;
                }).join('');

                return `
                    <div class="azubi-review-card" data-report-id="${this._esc(report.id)}">
                        <div class="azubi-review-header">
                            <div>
                                <strong style="font-size: 16px; color: var(--text-primary, #e4e4e7);">${this._esc(apprentice.name)}</strong>
                                <span class="azubi-badge azubi-badge-eingereicht" style="margin-left: 8px;">Eingereicht</span>
                            </div>
                            <div class="azubi-review-meta">
                                KW ${report.weekNumber} / ${report.year} &middot;
                                ${this._formatDateDE(report.weekStart)} - ${this._formatDateDE(report.weekEnd)}
                                ${report.department ? ' &middot; ' + this._esc(report.department) : ''}
                            </div>
                        </div>

                        ${daysHtml}

                        ${report.weeklyNotes ? `<div style="margin-top: 8px; font-size: 13px; color: var(--text-muted, #a1a1aa);"><strong>Wochennotizen:</strong> ${this._esc(report.weeklyNotes)}</div>` : ''}

                        <div class="azubi-review-actions">
                            <textarea placeholder="Feedback / Grund fuer Ablehnung..." data-feedback="${this._esc(report.id)}"></textarea>
                            <div style="display: flex; flex-direction: column; gap: 8px;">
                                <button class="azubi-btn azubi-btn-success" data-action="approve" data-id="${this._esc(report.id)}">Genehmigen</button>
                                <button class="azubi-btn azubi-btn-danger" data-action="reject" data-id="${this._esc(report.id)}">Zurueckweisen</button>
                            </div>
                        </div>
                    </div>
                `;
            }).join('') + '</div>';
        }

        this.container.innerHTML = `
            <div class="azubi-container">
                <button class="azubi-back-btn" data-action="back-overview">&larr; Zurueck zur Uebersicht</button>

                <div class="azubi-header">
                    <div>
                        <h2>Berichte genehmigen</h2>
                        <div class="azubi-header-sub">${pendingReports.length} Bericht${pendingReports.length !== 1 ? 'e' : ''} warten auf Genehmigung</div>
                    </div>
                </div>

                ${listHtml}
            </div>
        `;

        this._attachReviewEvents();
    }

    _attachReviewEvents() {
        if (!this.container) { return; }

        this.container.querySelector('[data-action="back-overview"]')?.addEventListener('click', () => {
            this.showOverview();
        });

        // Approve buttons
        this.container.querySelectorAll('[data-action="approve"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const reportId = btn.dataset.id;
                // Ask for master name
                const masterName = prompt('Name des Meisters / Ausbilders:');
                if (masterName === null) { return; } // cancelled

                const svc = this._getService();
                svc.approveReport(reportId, masterName.trim());

                if (window.errorHandler) {
                    window.errorHandler.success('Bericht genehmigt');
                }

                this._renderReview();
            });
        });

        // Reject buttons
        this.container.querySelectorAll('[data-action="reject"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const reportId = btn.dataset.id;
                const feedbackEl = this.container.querySelector(`[data-feedback="${reportId}"]`);
                const feedback = feedbackEl ? feedbackEl.value.trim() : '';

                if (!feedback) {
                    alert('Bitte einen Grund fuer die Ablehnung eingeben.');
                    return;
                }

                const svc = this._getService();
                svc.rejectReport(reportId, feedback);

                if (window.errorHandler) {
                    window.errorHandler.success('Bericht zurueckgewiesen');
                }

                this._renderReview();
            });
        });
    }
}

// Create global instance
window.apprenticeUI = new ApprenticeUI();
