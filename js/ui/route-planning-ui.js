/* ============================================
   Route Planning & Dispatch UI
   Tourenplanung-Oberflaeche fuer Handwerker
   Daily route overview, timeline map, stop editing,
   team management, WhatsApp sharing
   ============================================ */

class RoutePlanningUI {
    constructor() {
        this.service = window.routePlanningService;
        this.container = null;
        this.currentDate = this._todayStr();
        this.currentView = 'overview'; // 'overview' | 'map' | 'team'
        this.currentRouteId = null;
        this.dragSrcIndex = null;

        this.initCSS();
    }

    // ============================================
    // CSS Injection
    // ============================================

    initCSS() {
        if (document.getElementById('route-planning-ui-styles')) { return; }

        const style = document.createElement('style');
        style.id = 'route-planning-ui-styles';
        style.textContent = `
            /* ============================================
               Route Planning Layout
               ============================================ */
            .rp-container {
                padding: 16px;
                max-width: 900px;
                margin: 0 auto;
            }

            /* Header / date navigation */
            .rp-header {
                display: flex;
                flex-wrap: wrap;
                align-items: center;
                gap: 12px;
                margin-bottom: 20px;
            }

            .rp-header h2 {
                margin: 0;
                font-size: 20px;
                font-weight: 700;
                color: var(--text-primary);
                flex-shrink: 0;
            }

            .rp-date-nav {
                display: flex;
                align-items: center;
                gap: 6px;
                margin-left: auto;
            }

            .rp-date-nav button {
                min-width: 48px;
                min-height: 48px;
                display: flex;
                align-items: center;
                justify-content: center;
                border: 1px solid var(--border-color);
                background: var(--bg-card);
                color: var(--text-primary);
                border-radius: var(--border-radius-sm);
                cursor: pointer;
                font-size: 18px;
                transition: background var(--transition-fast);
            }

            .rp-date-nav button:hover {
                background: var(--bg-hover);
            }

            .rp-date-nav input[type="date"] {
                min-height: 48px;
                padding: 0 12px;
                border: 1px solid var(--border-color);
                background: var(--bg-card);
                color: var(--text-primary);
                border-radius: var(--border-radius-sm);
                font-size: 15px;
                font-family: inherit;
            }

            .rp-date-label {
                font-size: 15px;
                color: var(--text-secondary);
                font-weight: 500;
            }

            /* View tabs */
            .rp-tabs {
                display: flex;
                gap: 4px;
                margin-bottom: 16px;
                background: var(--bg-card);
                border-radius: var(--border-radius-sm);
                padding: 4px;
                border: 1px solid var(--border-color);
            }

            .rp-tab {
                flex: 1;
                min-height: 48px;
                padding: 8px 12px;
                border: none;
                background: transparent;
                color: var(--text-secondary);
                border-radius: 6px;
                cursor: pointer;
                font-size: 14px;
                font-weight: 500;
                font-family: inherit;
                transition: all var(--transition-fast);
                text-align: center;
            }

            .rp-tab:hover {
                background: var(--bg-hover);
                color: var(--text-primary);
            }

            .rp-tab.active {
                background: var(--accent-primary);
                color: #fff;
            }

            /* Quick stats bar */
            .rp-stats {
                display: flex;
                gap: 16px;
                margin-bottom: 16px;
                padding: 12px 16px;
                background: var(--bg-card);
                border: 1px solid var(--border-color);
                border-radius: var(--border-radius-sm);
                flex-wrap: wrap;
            }

            .rp-stat {
                display: flex;
                align-items: center;
                gap: 8px;
                font-size: 14px;
                color: var(--text-secondary);
            }

            .rp-stat-value {
                font-weight: 700;
                color: var(--text-primary);
                font-size: 16px;
            }

            /* Action buttons row */
            .rp-actions {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
                margin-bottom: 16px;
            }

            .rp-btn {
                min-height: 48px;
                padding: 10px 18px;
                border: 1px solid var(--border-color);
                background: var(--bg-card);
                color: var(--text-primary);
                border-radius: var(--border-radius-sm);
                cursor: pointer;
                font-size: 14px;
                font-weight: 500;
                font-family: inherit;
                transition: all var(--transition-fast);
                display: inline-flex;
                align-items: center;
                gap: 8px;
            }

            .rp-btn:hover {
                background: var(--bg-hover);
            }

            .rp-btn-primary {
                background: var(--accent-primary);
                border-color: var(--accent-primary);
                color: #fff;
            }

            .rp-btn-primary:hover {
                background: var(--accent-primary-hover);
            }

            .rp-btn-success {
                background: var(--accent-success);
                border-color: var(--accent-success);
                color: #fff;
            }

            .rp-btn-danger {
                background: var(--accent-danger);
                border-color: var(--accent-danger);
                color: #fff;
            }

            .rp-btn-small {
                min-height: 36px;
                padding: 6px 12px;
                font-size: 13px;
            }

            /* ============================================
               Stop Cards (Overview)
               ============================================ */
            .rp-stop-list {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }

            .rp-stop-card {
                display: flex;
                align-items: flex-start;
                gap: 12px;
                padding: 14px 16px;
                background: var(--bg-card);
                border: 1px solid var(--border-color);
                border-radius: var(--border-radius-sm);
                border-left: 4px solid var(--border-color);
                transition: all var(--transition-fast);
                cursor: pointer;
            }

            .rp-stop-card:hover {
                background: var(--bg-hover);
                border-color: var(--accent-primary);
            }

            .rp-stop-card[data-status="geplant"]    { border-left-color: #3b82f6; }
            .rp-stop-card[data-status="unterwegs"]   { border-left-color: #f59e0b; }
            .rp-stop-card[data-status="vor_ort"]     { border-left-color: #8b5cf6; }
            .rp-stop-card[data-status="erledigt"]    { border-left-color: #22c55e; }
            .rp-stop-card[data-status="verschoben"]  { border-left-color: #ef4444; }

            .rp-stop-drag {
                display: flex;
                align-items: center;
                justify-content: center;
                min-width: 28px;
                min-height: 48px;
                cursor: grab;
                color: var(--text-muted);
                font-size: 18px;
                user-select: none;
                touch-action: none;
                flex-shrink: 0;
            }

            .rp-stop-drag:active {
                cursor: grabbing;
            }

            .rp-stop-num {
                min-width: 30px;
                min-height: 30px;
                display: flex;
                align-items: center;
                justify-content: center;
                background: var(--bg-hover);
                border-radius: 50%;
                font-weight: 700;
                font-size: 14px;
                color: var(--text-primary);
                flex-shrink: 0;
            }

            .rp-stop-body {
                flex: 1;
                min-width: 0;
            }

            .rp-stop-customer {
                font-weight: 600;
                font-size: 15px;
                color: var(--text-primary);
                margin-bottom: 2px;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            .rp-stop-address {
                font-size: 13px;
                color: var(--text-secondary);
                margin-bottom: 6px;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            .rp-stop-meta {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
                align-items: center;
            }

            .rp-stop-time {
                font-size: 13px;
                font-weight: 600;
                color: var(--accent-info);
            }

            .rp-stop-duration {
                font-size: 12px;
                color: var(--text-muted);
            }

            .rp-stop-workers {
                display: flex;
                gap: 4px;
                flex-wrap: wrap;
            }

            .rp-worker-chip {
                display: inline-flex;
                align-items: center;
                gap: 4px;
                padding: 2px 8px;
                font-size: 11px;
                font-weight: 600;
                border-radius: 12px;
                background: var(--accent-primary-light);
                color: var(--accent-primary-hover);
            }

            .rp-worker-dot {
                width: 8px;
                height: 8px;
                border-radius: 50%;
                flex-shrink: 0;
            }

            /* Status badges */
            .rp-status-badge {
                display: inline-flex;
                align-items: center;
                padding: 2px 10px;
                font-size: 11px;
                font-weight: 600;
                border-radius: 12px;
                text-transform: uppercase;
                letter-spacing: 0.3px;
            }

            .rp-status-geplant    { background: rgba(59,130,246,0.15); color: #60a5fa; }
            .rp-status-unterwegs  { background: rgba(245,158,11,0.15); color: #fbbf24; }
            .rp-status-vor_ort    { background: rgba(139,92,246,0.15); color: #a78bfa; }
            .rp-status-erledigt   { background: rgba(34,197,94,0.15);  color: #4ade80; }
            .rp-status-verschoben { background: rgba(239,68,68,0.15);  color: #f87171; }

            /* Priority indicators */
            .rp-priority-hoch    { color: #ef4444; }
            .rp-priority-mittel  { color: #f59e0b; }
            .rp-priority-niedrig { color: #22c55e; }

            /* Drag state */
            .rp-stop-card.dragging {
                opacity: 0.4;
                border-style: dashed;
            }

            .rp-stop-card.drag-over {
                border-top: 3px solid var(--accent-primary);
            }

            /* Empty state */
            .rp-empty {
                text-align: center;
                padding: 48px 24px;
                color: var(--text-muted);
            }

            .rp-empty-icon {
                font-size: 48px;
                margin-bottom: 12px;
                opacity: 0.5;
            }

            .rp-empty-text {
                font-size: 15px;
                margin-bottom: 16px;
            }

            /* ============================================
               Timeline / Map View (no external tiles)
               ============================================ */
            .rp-timeline {
                position: relative;
                padding: 0 0 0 60px;
            }

            .rp-timeline::before {
                content: '';
                position: absolute;
                left: 29px;
                top: 0;
                bottom: 0;
                width: 3px;
                background: var(--border-color);
                border-radius: 2px;
            }

            .rp-timeline-start {
                position: relative;
                padding: 12px 16px;
                margin-bottom: 8px;
                background: var(--bg-card);
                border: 1px solid var(--border-color);
                border-radius: var(--border-radius-sm);
                font-size: 13px;
                color: var(--text-secondary);
            }

            .rp-timeline-start::before {
                content: '';
                position: absolute;
                left: -39px;
                top: 50%;
                transform: translateY(-50%);
                width: 16px;
                height: 16px;
                background: var(--accent-primary);
                border: 3px solid var(--bg-dark);
                border-radius: 50%;
                z-index: 1;
            }

            .rp-timeline-node {
                position: relative;
                margin-bottom: 8px;
            }

            .rp-timeline-node::before {
                content: '';
                position: absolute;
                left: -39px;
                top: 20px;
                width: 16px;
                height: 16px;
                border: 3px solid var(--bg-dark);
                border-radius: 50%;
                z-index: 1;
            }

            .rp-timeline-node[data-status="geplant"]::before    { background: #3b82f6; }
            .rp-timeline-node[data-status="unterwegs"]::before   { background: #f59e0b; }
            .rp-timeline-node[data-status="vor_ort"]::before     { background: #8b5cf6; }
            .rp-timeline-node[data-status="erledigt"]::before    { background: #22c55e; }
            .rp-timeline-node[data-status="verschoben"]::before  { background: #ef4444; }

            .rp-timeline-card {
                padding: 14px 16px;
                background: var(--bg-card);
                border: 1px solid var(--border-color);
                border-radius: var(--border-radius-sm);
            }

            .rp-timeline-card-header {
                display: flex;
                align-items: center;
                gap: 10px;
                margin-bottom: 6px;
            }

            .rp-timeline-time {
                font-weight: 700;
                font-size: 15px;
                color: var(--accent-info);
                min-width: 50px;
            }

            .rp-timeline-customer {
                font-weight: 600;
                font-size: 15px;
                color: var(--text-primary);
            }

            .rp-timeline-address {
                font-size: 13px;
                color: var(--text-secondary);
                margin-bottom: 8px;
            }

            .rp-timeline-info {
                display: flex;
                flex-wrap: wrap;
                gap: 12px;
                align-items: center;
                font-size: 13px;
                color: var(--text-muted);
            }

            .rp-timeline-distance {
                position: relative;
                padding: 4px 0 4px 60px;
                margin: 4px 0;
                font-size: 12px;
                color: var(--text-muted);
                text-align: left;
            }

            .rp-timeline-distance-line {
                position: absolute;
                left: 24px;
                top: 0;
                bottom: 0;
                width: 3px;
                background: repeating-linear-gradient(
                    to bottom,
                    var(--text-muted) 0px,
                    var(--text-muted) 4px,
                    transparent 4px,
                    transparent 8px
                );
                opacity: 0.4;
            }

            /* ============================================
               Team Management
               ============================================ */
            .rp-team-section {
                margin-bottom: 24px;
            }

            .rp-team-section h3 {
                font-size: 16px;
                font-weight: 600;
                color: var(--text-primary);
                margin-bottom: 12px;
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .rp-team-list {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }

            .rp-team-card {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 12px 16px;
                background: var(--bg-card);
                border: 1px solid var(--border-color);
                border-radius: var(--border-radius-sm);
                transition: background var(--transition-fast);
            }

            .rp-team-card:hover {
                background: var(--bg-hover);
            }

            .rp-team-color {
                width: 12px;
                height: 12px;
                border-radius: 50%;
                flex-shrink: 0;
            }

            .rp-team-name {
                font-weight: 600;
                font-size: 14px;
                color: var(--text-primary);
                flex: 1;
                min-width: 0;
            }

            .rp-team-role {
                font-size: 12px;
                padding: 2px 8px;
                border-radius: 12px;
                background: var(--bg-hover);
                color: var(--text-secondary);
                text-transform: capitalize;
            }

            .rp-team-phone {
                font-size: 13px;
                color: var(--text-muted);
            }

            .rp-team-actions {
                display: flex;
                gap: 6px;
            }

            .rp-team-toggle {
                width: 44px;
                height: 24px;
                border-radius: 12px;
                border: none;
                cursor: pointer;
                position: relative;
                transition: background var(--transition-fast);
            }

            .rp-team-toggle.on {
                background: var(--accent-success);
            }

            .rp-team-toggle.off {
                background: var(--text-muted);
            }

            .rp-team-toggle::after {
                content: '';
                position: absolute;
                top: 3px;
                left: 3px;
                width: 18px;
                height: 18px;
                border-radius: 50%;
                background: #fff;
                transition: transform var(--transition-fast);
            }

            .rp-team-toggle.on::after {
                transform: translateX(20px);
            }

            /* Vehicle card additions */
            .rp-vehicle-plate {
                font-family: monospace;
                font-size: 13px;
                padding: 2px 8px;
                background: var(--bg-hover);
                border-radius: 4px;
                color: var(--text-secondary);
                border: 1px solid var(--border-color);
            }

            .rp-vehicle-capacity {
                font-size: 12px;
                color: var(--text-muted);
            }

            /* ============================================
               Stop Detail Modal
               ============================================ */
            .rp-modal-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0,0,0,0.6);
                z-index: 9999;
                display: flex;
                align-items: flex-end;
                justify-content: center;
                padding: 0;
            }

            @media (min-width: 768px) {
                .rp-modal-overlay {
                    align-items: center;
                    padding: 24px;
                }
            }

            .rp-modal {
                background: var(--bg-card);
                border: 1px solid var(--border-color);
                border-radius: 16px 16px 0 0;
                width: 100%;
                max-height: 90vh;
                overflow-y: auto;
                padding: 24px;
            }

            @media (min-width: 768px) {
                .rp-modal {
                    max-width: 560px;
                    border-radius: var(--border-radius);
                }
            }

            .rp-modal h3 {
                margin: 0 0 20px 0;
                font-size: 18px;
                font-weight: 700;
                color: var(--text-primary);
            }

            .rp-form-group {
                margin-bottom: 16px;
            }

            .rp-form-group label {
                display: block;
                font-size: 13px;
                font-weight: 600;
                color: var(--text-secondary);
                margin-bottom: 6px;
            }

            .rp-form-group input,
            .rp-form-group textarea,
            .rp-form-group select {
                width: 100%;
                min-height: 48px;
                padding: 10px 14px;
                background: var(--bg-input);
                border: 1px solid var(--border-color);
                border-radius: var(--border-radius-sm);
                color: var(--text-primary);
                font-size: 15px;
                font-family: inherit;
                transition: border-color var(--transition-fast);
            }

            .rp-form-group input:focus,
            .rp-form-group textarea:focus,
            .rp-form-group select:focus {
                outline: none;
                border-color: var(--accent-primary);
            }

            .rp-form-group textarea {
                min-height: 80px;
                resize: vertical;
            }

            .rp-form-row {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 12px;
            }

            /* Worker checkboxes */
            .rp-worker-checks {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
            }

            .rp-worker-check {
                display: flex;
                align-items: center;
                gap: 6px;
                padding: 8px 14px;
                background: var(--bg-hover);
                border: 1px solid var(--border-color);
                border-radius: var(--border-radius-sm);
                cursor: pointer;
                min-height: 48px;
                transition: all var(--transition-fast);
            }

            .rp-worker-check:hover {
                border-color: var(--accent-primary);
            }

            .rp-worker-check.selected {
                background: var(--accent-primary-light);
                border-color: var(--accent-primary);
            }

            .rp-worker-check input[type="checkbox"] {
                width: 18px;
                height: 18px;
                min-height: auto;
                cursor: pointer;
            }

            .rp-worker-check-name {
                font-size: 14px;
                font-weight: 500;
                color: var(--text-primary);
            }

            /* Priority radios */
            .rp-priority-radios {
                display: flex;
                gap: 8px;
            }

            .rp-priority-radio {
                flex: 1;
                min-height: 48px;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 6px;
                padding: 8px 14px;
                background: var(--bg-hover);
                border: 2px solid var(--border-color);
                border-radius: var(--border-radius-sm);
                cursor: pointer;
                font-size: 14px;
                font-weight: 600;
                transition: all var(--transition-fast);
            }

            .rp-priority-radio input[type="radio"] {
                display: none;
            }

            .rp-priority-radio.selected-hoch {
                border-color: #ef4444;
                background: rgba(239,68,68,0.1);
                color: #ef4444;
            }

            .rp-priority-radio.selected-mittel {
                border-color: #f59e0b;
                background: rgba(245,158,11,0.1);
                color: #f59e0b;
            }

            .rp-priority-radio.selected-niedrig {
                border-color: #22c55e;
                background: rgba(34,197,94,0.1);
                color: #22c55e;
            }

            /* Status flow buttons */
            .rp-status-flow {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
            }

            .rp-status-btn {
                min-height: 48px;
                padding: 10px 16px;
                border: 2px solid var(--border-color);
                background: var(--bg-hover);
                border-radius: var(--border-radius-sm);
                cursor: pointer;
                font-size: 13px;
                font-weight: 600;
                font-family: inherit;
                transition: all var(--transition-fast);
                color: var(--text-secondary);
            }

            .rp-status-btn:hover {
                border-color: var(--accent-primary);
                color: var(--text-primary);
            }

            .rp-status-btn.active {
                color: #fff;
            }

            .rp-status-btn.active[data-status="geplant"]    { background: #3b82f6; border-color: #3b82f6; }
            .rp-status-btn.active[data-status="unterwegs"]   { background: #f59e0b; border-color: #f59e0b; }
            .rp-status-btn.active[data-status="vor_ort"]     { background: #8b5cf6; border-color: #8b5cf6; }
            .rp-status-btn.active[data-status="erledigt"]    { background: #22c55e; border-color: #22c55e; }
            .rp-status-btn.active[data-status="verschoben"]  { background: #ef4444; border-color: #ef4444; }

            /* Modal footer */
            .rp-modal-footer {
                display: flex;
                gap: 8px;
                margin-top: 24px;
                justify-content: flex-end;
                flex-wrap: wrap;
            }

            /* Phone link */
            .rp-phone-link {
                color: var(--accent-info);
                text-decoration: none;
                font-weight: 500;
            }

            .rp-phone-link:hover {
                text-decoration: underline;
            }

            /* Share text preview */
            .rp-share-preview {
                background: var(--bg-dark);
                border: 1px solid var(--border-color);
                border-radius: var(--border-radius-sm);
                padding: 16px;
                font-family: monospace;
                font-size: 13px;
                white-space: pre-wrap;
                color: var(--text-secondary);
                max-height: 400px;
                overflow-y: auto;
                line-height: 1.6;
            }

            /* ============================================
               Team form modal
               ============================================ */
            .rp-form-inline {
                display: flex;
                gap: 8px;
                flex-wrap: wrap;
            }

            .rp-form-inline input,
            .rp-form-inline select {
                flex: 1;
                min-width: 120px;
            }

            /* ============================================
               Responsive
               ============================================ */
            @media (max-width: 600px) {
                .rp-container {
                    padding: 10px;
                }

                .rp-header {
                    flex-direction: column;
                    align-items: stretch;
                }

                .rp-date-nav {
                    margin-left: 0;
                    justify-content: center;
                }

                .rp-form-row {
                    grid-template-columns: 1fr;
                }

                .rp-stats {
                    flex-direction: column;
                    gap: 8px;
                }

                .rp-stop-card {
                    flex-wrap: wrap;
                }

                .rp-actions {
                    flex-direction: column;
                }

                .rp-actions .rp-btn {
                    justify-content: center;
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
        const el = document.createElement('span');
        el.textContent = String(str);
        return el.innerHTML;
    }

    // ============================================
    // Helpers
    // ============================================

    _todayStr() {
        return new Date().toISOString().split('T')[0];
    }

    _formatDateDE(dateStr) {
        if (!dateStr) { return ''; }
        const d = new Date(dateStr + 'T00:00:00');
        return d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
    }

    _formatDuration(minutes) {
        if (!minutes || minutes <= 0) { return '0min'; }
        if (minutes < 60) { return `${minutes}min`; }
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        return m > 0 ? `${h}h ${m}min` : `${h}h`;
    }

    _statusLabel(status) {
        const labels = {
            'geplant': 'Geplant',
            'unterwegs': 'Unterwegs',
            'vor_ort': 'Vor Ort',
            'erledigt': 'Erledigt',
            'verschoben': 'Verschoben'
        };
        return labels[status] || status;
    }

    _priorityLabel(priority) {
        const labels = { 'hoch': 'Hoch', 'mittel': 'Mittel', 'niedrig': 'Niedrig' };
        return labels[priority] || priority;
    }

    _roleLabel(role) {
        const labels = { 'meister': 'Meister', 'geselle': 'Geselle', 'azubi': 'Azubi', 'helfer': 'Helfer' };
        return labels[role] || role;
    }

    // ============================================
    // Mount / Main Render
    // ============================================

    /**
     * Mount the UI into a container
     * @param {string} containerId
     */
    mount(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            console.error('[RoutePlanningUI] Container not found:', containerId);
            return;
        }
        this.render();
    }

    render() {
        if (!this.container) { return; }

        const route = this.service.getRoute(this.currentDate);
        this.currentRouteId = route ? route.id : null;

        let html = '<div class="rp-container">';

        // Header with title and date nav
        html += this._renderHeader();

        // View tabs
        html += this._renderTabs();

        // Content
        if (this.currentView === 'overview') {
            html += this._renderOverview(route);
        } else if (this.currentView === 'map') {
            html += this._renderMapView(route);
        } else if (this.currentView === 'team') {
            html += this._renderTeamView();
        }

        html += '</div>';
        this.container.innerHTML = html;

        this._attachEventListeners();
    }

    // ============================================
    // Header
    // ============================================

    _renderHeader() {
        const isToday = this.currentDate === this._todayStr();
        const todayBadge = isToday ? ' (Heute)' : '';
        const dateLabel = this._formatDateDE(this.currentDate);

        return `
            <div class="rp-header">
                <h2>\u{1F697} Tourenplanung</h2>
                <span class="rp-date-label">${this._esc(dateLabel)}${todayBadge}</span>
                <div class="rp-date-nav">
                    <button data-action="rp-prev-day" title="Vortag">\u25C0</button>
                    <button data-action="rp-today" title="Heute" style="font-size:14px;">Heute</button>
                    <input type="date" value="${this._esc(this.currentDate)}" data-action="rp-date-pick" />
                    <button data-action="rp-next-day" title="Naechster Tag">\u25B6</button>
                </div>
            </div>
        `;
    }

    // ============================================
    // Tabs
    // ============================================

    _renderTabs() {
        const tabs = [
            { id: 'overview', label: '\u{1F4CB} \u00DCbersicht' },
            { id: 'map', label: '\u{1F5FA}\uFE0F Routenansicht' },
            { id: 'team', label: '\u{1F477} Team & Fahrzeuge' }
        ];

        let html = '<div class="rp-tabs">';
        for (const tab of tabs) {
            const cls = tab.id === this.currentView ? ' active' : '';
            html += `<button class="rp-tab${cls}" data-action="rp-switch-tab" data-tab="${tab.id}">${tab.label}</button>`;
        }
        html += '</div>';
        return html;
    }

    // ============================================
    // Overview View
    // ============================================

    _renderOverview(route) {
        let html = '';

        // Stats bar
        if (route && route.stops.length > 0) {
            html += this._renderStatsBar(route);
        }

        // Action buttons
        html += this._renderActions(route);

        // Stop list
        if (!route || route.stops.length === 0) {
            html += `
                <div class="rp-empty">
                    <div class="rp-empty-icon">\u{1F5FA}\uFE0F</div>
                    <div class="rp-empty-text">Keine Stops f\u00FCr diesen Tag geplant.</div>
                    <button class="rp-btn rp-btn-primary" data-action="rp-add-stop">+ Stop hinzuf\u00FCgen</button>
                </div>
            `;
        } else {
            html += '<div class="rp-stop-list" id="rp-stop-list">';
            route.stops.forEach((stop, index) => {
                html += this._renderStopCard(stop, index);
            });
            html += '</div>';
        }

        return html;
    }

    _renderStatsBar(route) {
        const stopCount = route.stops.length;
        const doneCount = route.stops.filter(s => s.status === 'erledigt').length;
        const totalKm = route.totalDistance || 0;
        const totalMin = route.totalDuration || 0;

        return `
            <div class="rp-stats">
                <div class="rp-stat">
                    <span class="rp-stat-value">${stopCount}</span> Stops
                </div>
                <div class="rp-stat">
                    <span class="rp-stat-value">${doneCount}/${stopCount}</span> Erledigt
                </div>
                <div class="rp-stat">
                    ~<span class="rp-stat-value">${totalKm}</span> km
                </div>
                <div class="rp-stat">
                    ~<span class="rp-stat-value">${this._formatDuration(totalMin)}</span>
                </div>
            </div>
        `;
    }

    _renderActions(route) {
        let html = '<div class="rp-actions">';
        html += `<button class="rp-btn rp-btn-primary" data-action="rp-add-stop">+ Stop hinzuf\u00FCgen</button>`;
        html += `<button class="rp-btn" data-action="rp-auto-assign">\u26A1 Aus Auftr\u00E4gen laden</button>`;

        if (route && route.stops.length > 0) {
            html += `<button class="rp-btn" data-action="rp-share-route">\u{1F4E4} Route teilen</button>`;
        }

        html += '</div>';
        return html;
    }

    _renderStopCard(stop, index) {
        const addr = [stop.address, stop.postalCode, stop.city].filter(Boolean).join(', ');
        const workers = this.service.getWorkers();

        let workerChips = '';
        if (stop.assignedWorkers && stop.assignedWorkers.length > 0) {
            for (const wName of stop.assignedWorkers) {
                const w = workers.find(wr => wr.name === wName);
                const color = w ? w.color : '#6366f1';
                workerChips += `<span class="rp-worker-chip"><span class="rp-worker-dot" style="background:${this._esc(color)}"></span>${this._esc(wName)}</span>`;
            }
        }

        return `
            <div class="rp-stop-card" data-status="${this._esc(stop.status)}" data-stop-id="${this._esc(stop.id)}" data-index="${index}">
                <div class="rp-stop-drag" draggable="true" data-drag-index="${index}" title="Ziehen zum Sortieren">\u2630</div>
                <div class="rp-stop-num">${index + 1}</div>
                <div class="rp-stop-body" data-action="rp-edit-stop" data-stop-id="${this._esc(stop.id)}">
                    <div class="rp-stop-customer">${this._esc(stop.customerName) || 'Unbenannt'}</div>
                    <div class="rp-stop-address">${this._esc(addr) || 'Keine Adresse'}</div>
                    <div class="rp-stop-meta">
                        ${stop.plannedArrival ? `<span class="rp-stop-time">${this._esc(stop.plannedArrival)}</span>` : ''}
                        <span class="rp-stop-duration">${this._formatDuration(stop.plannedDuration)}</span>
                        <span class="rp-status-badge rp-status-${this._esc(stop.status)}">${this._statusLabel(stop.status)}</span>
                        ${stop.priority === 'hoch' ? '<span class="rp-priority-hoch">\u25B2 Hoch</span>' : ''}
                        <div class="rp-stop-workers">${workerChips}</div>
                    </div>
                </div>
            </div>
        `;
    }

    // ============================================
    // Map / Timeline View
    // ============================================

    _renderMapView(route) {
        if (!route || route.stops.length === 0) {
            return `
                <div class="rp-empty">
                    <div class="rp-empty-icon">\u{1F5FA}\uFE0F</div>
                    <div class="rp-empty-text">Keine Stops zum Anzeigen.</div>
                </div>
            `;
        }

        let html = '<div class="rp-timeline">';

        // Start point
        html += `
            <div class="rp-timeline-start">
                <strong>Start:</strong> ${this._esc(route.startAddress) || 'Firmensitz'}
            </div>
        `;

        const workers = this.service.getWorkers();

        for (let i = 0; i < route.stops.length; i++) {
            const stop = route.stops[i];
            const addr = [stop.address, stop.postalCode, stop.city].filter(Boolean).join(', ');

            // Distance segment between stops
            let distLabel = '';
            if (i === 0) {
                const dist = this.service.estimateDistance(route.startAddress || '', [stop.address, stop.postalCode, stop.city].filter(Boolean).join(' '));
                distLabel = `~${Math.round(dist)} km`;
            } else {
                const prevStop = route.stops[i - 1];
                const prevAddr = [prevStop.address, prevStop.postalCode, prevStop.city].filter(Boolean).join(' ');
                const currAddr = [stop.address, stop.postalCode, stop.city].filter(Boolean).join(' ');
                const dist = this.service.estimateDistance(prevAddr, currAddr);
                distLabel = `~${Math.round(dist)} km`;
            }

            // Distance line between nodes
            html += `
                <div class="rp-timeline-distance">
                    <div class="rp-timeline-distance-line"></div>
                    \u{1F697} ${distLabel}
                </div>
            `;

            // Worker chips for timeline
            let workerChips = '';
            if (stop.assignedWorkers && stop.assignedWorkers.length > 0) {
                workerChips = stop.assignedWorkers.map(wName => {
                    const w = workers.find(wr => wr.name === wName);
                    const color = w ? w.color : '#6366f1';
                    return `<span class="rp-worker-chip"><span class="rp-worker-dot" style="background:${this._esc(color)}"></span>${this._esc(wName)}</span>`;
                }).join('');
            }

            html += `
                <div class="rp-timeline-node" data-status="${this._esc(stop.status)}">
                    <div class="rp-timeline-card">
                        <div class="rp-timeline-card-header">
                            <span class="rp-timeline-time">${this._esc(stop.plannedArrival) || '--:--'}</span>
                            <span class="rp-timeline-customer">${this._esc(stop.customerName) || 'Unbenannt'}</span>
                            <span class="rp-status-badge rp-status-${this._esc(stop.status)}">${this._statusLabel(stop.status)}</span>
                        </div>
                        <div class="rp-timeline-address">${this._esc(addr) || 'Keine Adresse'}</div>
                        <div class="rp-timeline-info">
                            <span>\u23F1 ${this._formatDuration(stop.plannedDuration)}</span>
                            ${stop.priority === 'hoch' ? '<span class="rp-priority-hoch">\u25B2 Hoch</span>' : ''}
                            ${stop.notes ? `<span>\u{1F4DD} ${this._esc(stop.notes.substring(0, 50))}${stop.notes.length > 50 ? '...' : ''}</span>` : ''}
                        </div>
                        ${workerChips ? `<div class="rp-stop-workers" style="margin-top:8px;">${workerChips}</div>` : ''}
                    </div>
                </div>
            `;
        }

        html += '</div>';
        return html;
    }

    // ============================================
    // Team Management View
    // ============================================

    _renderTeamView() {
        let html = '';

        // Workers section
        html += '<div class="rp-team-section">';
        html += '<h3>\u{1F477} Mitarbeiter</h3>';

        const workers = this.service.getWorkers();

        if (workers.length === 0) {
            html += '<div class="rp-empty"><div class="rp-empty-text">Noch keine Mitarbeiter angelegt.</div></div>';
        } else {
            html += '<div class="rp-team-list">';
            for (const w of workers) {
                html += `
                    <div class="rp-team-card" data-worker-id="${this._esc(w.id)}">
                        <div class="rp-team-color" style="background:${this._esc(w.color)}"></div>
                        <div class="rp-team-name">${this._esc(w.name)}</div>
                        <span class="rp-team-role">${this._esc(this._roleLabel(w.role))}</span>
                        ${w.phone ? `<span class="rp-team-phone"><a href="tel:${this._esc(w.phone)}" class="rp-phone-link">${this._esc(w.phone)}</a></span>` : ''}
                        <button class="rp-team-toggle ${w.available ? 'on' : 'off'}" data-action="rp-toggle-worker" data-worker-id="${this._esc(w.id)}" title="${w.available ? 'Verf\u00FCgbar' : 'Nicht verf\u00FCgbar'}"></button>
                        <div class="rp-team-actions">
                            <button class="rp-btn rp-btn-small" data-action="rp-edit-worker" data-worker-id="${this._esc(w.id)}" title="Bearbeiten">\u270F\uFE0F</button>
                            <button class="rp-btn rp-btn-small rp-btn-danger" data-action="rp-remove-worker" data-worker-id="${this._esc(w.id)}" title="Entfernen">\u{1F5D1}\uFE0F</button>
                        </div>
                    </div>
                `;
            }
            html += '</div>';
        }

        html += `<button class="rp-btn rp-btn-primary" style="margin-top:12px;" data-action="rp-add-worker">+ Mitarbeiter hinzuf\u00FCgen</button>`;
        html += '</div>';

        // Vehicles section
        html += '<div class="rp-team-section">';
        html += '<h3>\u{1F69A} Fahrzeuge</h3>';

        const vehicles = this.service.getVehicles();

        if (vehicles.length === 0) {
            html += '<div class="rp-empty"><div class="rp-empty-text">Noch keine Fahrzeuge angelegt.</div></div>';
        } else {
            html += '<div class="rp-team-list">';
            for (const v of vehicles) {
                html += `
                    <div class="rp-team-card" data-vehicle-id="${this._esc(v.id)}">
                        <div class="rp-team-name">${this._esc(v.name)}</div>
                        <span class="rp-vehicle-plate">${this._esc(v.plate)}</span>
                        <span class="rp-vehicle-capacity">${v.capacity} Pl\u00E4tze</span>
                        <div class="rp-team-actions">
                            <button class="rp-btn rp-btn-small" data-action="rp-edit-vehicle" data-vehicle-id="${this._esc(v.id)}" title="Bearbeiten">\u270F\uFE0F</button>
                            <button class="rp-btn rp-btn-small rp-btn-danger" data-action="rp-remove-vehicle" data-vehicle-id="${this._esc(v.id)}" title="Entfernen">\u{1F5D1}\uFE0F</button>
                        </div>
                    </div>
                `;
            }
            html += '</div>';
        }

        html += `<button class="rp-btn rp-btn-primary" style="margin-top:12px;" data-action="rp-add-vehicle">+ Fahrzeug hinzuf\u00FCgen</button>`;
        html += '</div>';

        return html;
    }

    // ============================================
    // Event Listeners
    // ============================================

    _attachEventListeners() {
        if (!this.container) { return; }

        // Delegated click handler
        this.container.addEventListener('click', (e) => {
            const target = e.target.closest('[data-action]');
            if (!target) { return; }

            const action = target.dataset.action;

            switch (action) {
            case 'rp-prev-day':
                this._changeDay(-1);
                break;
            case 'rp-next-day':
                this._changeDay(1);
                break;
            case 'rp-today':
                this.currentDate = this._todayStr();
                this.render();
                break;
            case 'rp-switch-tab':
                this.currentView = target.dataset.tab;
                this.render();
                break;
            case 'rp-add-stop':
                this._openStopModal(null);
                break;
            case 'rp-edit-stop':
                this._openStopModal(target.dataset.stopId);
                break;
            case 'rp-auto-assign':
                this._autoAssign();
                break;
            case 'rp-share-route':
                this._openShareModal();
                break;
            case 'rp-add-worker':
                this._openWorkerModal(null);
                break;
            case 'rp-edit-worker':
                this._openWorkerModal(target.dataset.workerId);
                break;
            case 'rp-remove-worker':
                this._confirmRemoveWorker(target.dataset.workerId);
                break;
            case 'rp-toggle-worker':
                this._toggleWorkerAvailability(target.dataset.workerId);
                break;
            case 'rp-add-vehicle':
                this._openVehicleModal(null);
                break;
            case 'rp-edit-vehicle':
                this._openVehicleModal(target.dataset.vehicleId);
                break;
            case 'rp-remove-vehicle':
                this._confirmRemoveVehicle(target.dataset.vehicleId);
                break;
            }
        });

        // Date picker change
        const datePicker = this.container.querySelector('[data-action="rp-date-pick"]');
        if (datePicker) {
            datePicker.addEventListener('change', (e) => {
                this.currentDate = e.target.value;
                this.render();
            });
        }

        // Drag and drop for stop reordering
        this._attachDragListeners();
    }

    _changeDay(offset) {
        const d = new Date(this.currentDate + 'T00:00:00');
        d.setDate(d.getDate() + offset);
        this.currentDate = d.toISOString().split('T')[0];
        this.render();
    }

    // ============================================
    // Drag & Drop Reorder
    // ============================================

    _attachDragListeners() {
        const handles = this.container.querySelectorAll('.rp-stop-drag');
        const cards = this.container.querySelectorAll('.rp-stop-card');

        handles.forEach(handle => {
            handle.addEventListener('dragstart', (e) => {
                this.dragSrcIndex = parseInt(handle.dataset.dragIndex);
                const card = handle.closest('.rp-stop-card');
                if (card) { card.classList.add('dragging'); }
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', String(this.dragSrcIndex));
            });

            handle.addEventListener('dragend', () => {
                this.container.querySelectorAll('.rp-stop-card').forEach(c => {
                    c.classList.remove('dragging', 'drag-over');
                });
                this.dragSrcIndex = null;
            });
        });

        cards.forEach(card => {
            card.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                card.classList.add('drag-over');
            });

            card.addEventListener('dragleave', () => {
                card.classList.remove('drag-over');
            });

            card.addEventListener('drop', (e) => {
                e.preventDefault();
                card.classList.remove('drag-over');

                const fromIndex = this.dragSrcIndex;
                const toIndex = parseInt(card.dataset.index);

                if (fromIndex === null || fromIndex === toIndex || !this.currentRouteId) { return; }

                const route = this.service.getRoute(this.currentDate);
                if (!route) { return; }

                // Reorder: move fromIndex to toIndex
                const ids = route.stops.map(s => s.id);
                const movedId = ids.splice(fromIndex, 1)[0];
                ids.splice(toIndex, 0, movedId);

                this.service.reorderStops(route.id, ids);
                this.render();
            });
        });

        // Touch drag support (simple approach for mobile)
        this._attachTouchDrag();
    }

    _attachTouchDrag() {
        const handles = this.container.querySelectorAll('.rp-stop-drag');
        let touchSrcIndex = null;
        let touchClone = null;

        handles.forEach(handle => {
            handle.addEventListener('touchstart', (e) => {
                touchSrcIndex = parseInt(handle.dataset.dragIndex);
                const card = handle.closest('.rp-stop-card');
                if (card) {
                    touchClone = card.cloneNode(true);
                    touchClone.style.position = 'fixed';
                    touchClone.style.opacity = '0.7';
                    touchClone.style.pointerEvents = 'none';
                    touchClone.style.zIndex = '10000';
                    touchClone.style.width = card.offsetWidth + 'px';
                    document.body.appendChild(touchClone);
                }
            }, { passive: true });

            handle.addEventListener('touchmove', (e) => {
                if (touchClone && e.touches[0]) {
                    touchClone.style.left = '16px';
                    touchClone.style.top = (e.touches[0].clientY - 30) + 'px';
                }
            }, { passive: true });

            handle.addEventListener('touchend', (e) => {
                if (touchClone) {
                    document.body.removeChild(touchClone);
                    touchClone = null;
                }

                if (touchSrcIndex === null || !this.currentRouteId) { return; }

                // Determine drop target from touch position
                const touch = e.changedTouches[0];
                if (!touch) { return; }

                const elemBelow = document.elementFromPoint(touch.clientX, touch.clientY);
                if (!elemBelow) { return; }

                const targetCard = elemBelow.closest('.rp-stop-card');
                if (!targetCard) { return; }

                const toIndex = parseInt(targetCard.dataset.index);
                if (isNaN(toIndex) || touchSrcIndex === toIndex) { return; }

                const route = this.service.getRoute(this.currentDate);
                if (!route) { return; }

                const ids = route.stops.map(s => s.id);
                const movedId = ids.splice(touchSrcIndex, 1)[0];
                ids.splice(toIndex, 0, movedId);

                this.service.reorderStops(route.id, ids);
                touchSrcIndex = null;
                this.render();
            });
        });
    }

    // ============================================
    // Auto-Assign from Orders
    // ============================================

    _autoAssign() {
        const route = this.service.autoAssignFromOrders(this.currentDate);
        if (route && route.stops.length > 0) {
            this._showToast(`${route.stops.length} Stop(s) aus Auftr\u00E4gen geladen.`, 'success');
        } else {
            this._showToast('Keine passenden Auftr\u00E4ge gefunden.', 'info');
        }
        this.render();
    }

    // ============================================
    // Stop Detail / Edit Modal
    // ============================================

    _openStopModal(stopId) {
        // Ensure a route exists
        let route = this.service.getRoute(this.currentDate);
        if (!route) {
            route = this.service.createRoute(this.currentDate);
            this.currentRouteId = route.id;
        }

        const isNew = !stopId;
        let stop = null;
        if (stopId) {
            stop = route.stops.find(s => s.id === stopId);
        }

        const workers = this.service.getWorkers();
        const vehicles = this.service.getVehicles();
        const assignedWorkers = stop ? (stop.assignedWorkers || []) : [];
        const currentPriority = stop ? stop.priority : 'mittel';
        const currentStatus = stop ? stop.status : 'geplant';

        // Worker checkboxes
        let workerChecksHtml = '';
        for (const w of workers) {
            const checked = assignedWorkers.includes(w.name);
            workerChecksHtml += `
                <label class="rp-worker-check ${checked ? 'selected' : ''}">
                    <input type="checkbox" name="rp-stop-workers" value="${this._esc(w.name)}" ${checked ? 'checked' : ''} />
                    <span class="rp-worker-dot" style="background:${this._esc(w.color)}"></span>
                    <span class="rp-worker-check-name">${this._esc(w.name)}</span>
                </label>
            `;
        }

        if (workers.length === 0) {
            workerChecksHtml = '<span style="color:var(--text-muted);font-size:13px;">Keine Mitarbeiter angelegt. Gehen Sie zu "Team & Fahrzeuge".</span>';
        }

        // Vehicle dropdown
        let vehicleOptions = '<option value="">-- Kein Fahrzeug --</option>';
        for (const v of vehicles) {
            const sel = (stop && stop.assignedVehicle === v.name) ? 'selected' : '';
            vehicleOptions += `<option value="${this._esc(v.name)}" ${sel}>${this._esc(v.name)} (${this._esc(v.plate)})</option>`;
        }

        // Priority radios
        const priorities = ['hoch', 'mittel', 'niedrig'];
        let priorityHtml = '<div class="rp-priority-radios">';
        for (const p of priorities) {
            const selected = p === currentPriority ? ` selected-${p}` : '';
            const checked = p === currentPriority ? 'checked' : '';
            priorityHtml += `
                <label class="rp-priority-radio${selected}">
                    <input type="radio" name="rp-stop-priority" value="${p}" ${checked} />
                    ${this._priorityLabel(p)}
                </label>
            `;
        }
        priorityHtml += '</div>';

        // Status flow buttons
        const statuses = ['geplant', 'unterwegs', 'vor_ort', 'erledigt', 'verschoben'];
        let statusHtml = '<div class="rp-status-flow">';
        for (const s of statuses) {
            const active = s === currentStatus ? ' active' : '';
            statusHtml += `<button class="rp-status-btn${active}" data-status="${s}" type="button">${this._statusLabel(s)}</button>`;
        }
        statusHtml += '</div>';

        // Phone link
        const phoneVal = stop ? (stop.customerPhone || '') : '';
        const phoneLink = phoneVal ? `<a href="tel:${this._esc(phoneVal)}" class="rp-phone-link">\u{1F4DE} ${this._esc(phoneVal)}</a>` : '';

        // Auftrag link
        const orderLink = (stop && stop.orderId) ? `<div style="font-size:13px;color:var(--text-muted);margin-bottom:12px;">Auftrag: <strong>${this._esc(stop.orderId)}</strong></div>` : '';

        const modalHtml = `
            <div class="rp-modal-overlay" id="rp-stop-modal">
                <div class="rp-modal">
                    <h3>${isNew ? 'Neuer Stop' : 'Stop bearbeiten'}</h3>

                    ${orderLink}

                    <div class="rp-form-group">
                        <label>Kundenname</label>
                        <input type="text" id="rp-stop-customer" value="${this._esc(stop ? stop.customerName : '')}" placeholder="z.B. M\u00FCller GmbH" />
                    </div>

                    <div class="rp-form-group">
                        <label>Adresse</label>
                        <input type="text" id="rp-stop-address" value="${this._esc(stop ? stop.address : '')}" placeholder="Hauptstr. 12" />
                    </div>

                    <div class="rp-form-row">
                        <div class="rp-form-group">
                            <label>PLZ</label>
                            <input type="text" id="rp-stop-plz" value="${this._esc(stop ? stop.postalCode : '')}" placeholder="74523" maxlength="5" />
                        </div>
                        <div class="rp-form-group">
                            <label>Ort</label>
                            <input type="text" id="rp-stop-city" value="${this._esc(stop ? stop.city : '')}" placeholder="Schw\u00E4bisch Hall" />
                        </div>
                    </div>

                    <div class="rp-form-row">
                        <div class="rp-form-group">
                            <label>Geplante Ankunft</label>
                            <input type="time" id="rp-stop-arrival" value="${this._esc(stop ? stop.plannedArrival : '')}" />
                        </div>
                        <div class="rp-form-group">
                            <label>Dauer (Minuten)</label>
                            <input type="number" id="rp-stop-duration" value="${stop ? stop.plannedDuration : 60}" min="15" step="15" />
                        </div>
                    </div>

                    <div class="rp-form-group">
                        <label>Mitarbeiter zuweisen</label>
                        <div class="rp-worker-checks" id="rp-worker-checks">
                            ${workerChecksHtml}
                        </div>
                    </div>

                    <div class="rp-form-group">
                        <label>Fahrzeug</label>
                        <select id="rp-stop-vehicle">${vehicleOptions}</select>
                    </div>

                    <div class="rp-form-group">
                        <label>Priorit\u00E4t</label>
                        ${priorityHtml}
                    </div>

                    <div class="rp-form-group">
                        <label>Telefon Kunde</label>
                        <input type="tel" id="rp-stop-phone" value="${this._esc(phoneVal)}" placeholder="+49 123 456789" />
                        ${phoneLink}
                    </div>

                    <div class="rp-form-group">
                        <label>Notizen</label>
                        <textarea id="rp-stop-notes" placeholder="z.B. Heizung warten, Zugang \u00FCber Hintereingang...">${this._esc(stop ? stop.notes : '')}</textarea>
                    </div>

                    <div class="rp-form-group">
                        <label>Status</label>
                        ${statusHtml}
                    </div>

                    <div class="rp-modal-footer">
                        ${!isNew ? `<button class="rp-btn rp-btn-danger" id="rp-stop-delete">L\u00F6schen</button>` : ''}
                        <button class="rp-btn" id="rp-stop-cancel">Abbrechen</button>
                        <button class="rp-btn rp-btn-primary" id="rp-stop-save">Speichern</button>
                    </div>
                </div>
            </div>
        `;

        // Insert modal
        const existing = document.getElementById('rp-stop-modal');
        if (existing) { existing.remove(); }

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Attach modal events
        this._attachStopModalEvents(stopId, isNew);
    }

    _attachStopModalEvents(stopId, isNew) {
        const modal = document.getElementById('rp-stop-modal');
        if (!modal) { return; }

        // Close modal
        const close = () => {
            modal.remove();
        };

        // Cancel
        document.getElementById('rp-stop-cancel')?.addEventListener('click', close);

        // Close on overlay click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) { close(); }
        });

        // Priority radio click styling
        modal.querySelectorAll('.rp-priority-radio').forEach(radio => {
            radio.addEventListener('click', () => {
                modal.querySelectorAll('.rp-priority-radio').forEach(r => {
                    r.className = 'rp-priority-radio';
                });
                const val = radio.querySelector('input').value;
                radio.classList.add(`selected-${val}`);
                radio.querySelector('input').checked = true;
            });
        });

        // Worker checkbox styling
        modal.querySelectorAll('.rp-worker-check').forEach(label => {
            label.addEventListener('click', (e) => {
                // Don't double-toggle if they clicked the checkbox directly
                if (e.target.tagName === 'INPUT') {
                    setTimeout(() => {
                        label.classList.toggle('selected', label.querySelector('input').checked);
                    }, 0);
                } else {
                    const cb = label.querySelector('input');
                    cb.checked = !cb.checked;
                    label.classList.toggle('selected', cb.checked);
                    e.preventDefault();
                }
            });
        });

        // Status buttons
        let selectedStatus = isNew ? 'geplant' : (this.service.getRoute(this.currentDate)?.stops.find(s => s.id === stopId)?.status || 'geplant');
        modal.querySelectorAll('.rp-status-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                modal.querySelectorAll('.rp-status-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                selectedStatus = btn.dataset.status;
            });
        });

        // Delete
        document.getElementById('rp-stop-delete')?.addEventListener('click', () => {
            if (!this.currentRouteId || !stopId) { return; }
            this.service.removeStop(this.currentRouteId, stopId);
            close();
            this.render();
            this._showToast('Stop entfernt.', 'info');
        });

        // Save
        document.getElementById('rp-stop-save')?.addEventListener('click', () => {
            const route = this.service.getRoute(this.currentDate);
            if (!route) { return; }

            // Gather values
            const checkedWorkers = [];
            modal.querySelectorAll('input[name="rp-stop-workers"]:checked').forEach(cb => {
                checkedWorkers.push(cb.value);
            });

            const selectedPriority = modal.querySelector('input[name="rp-stop-priority"]:checked')?.value || 'mittel';

            const data = {
                customerName: document.getElementById('rp-stop-customer')?.value || '',
                address: document.getElementById('rp-stop-address')?.value || '',
                postalCode: document.getElementById('rp-stop-plz')?.value || '',
                city: document.getElementById('rp-stop-city')?.value || '',
                plannedArrival: document.getElementById('rp-stop-arrival')?.value || '',
                plannedDuration: parseInt(document.getElementById('rp-stop-duration')?.value) || 60,
                assignedWorkers: checkedWorkers,
                assignedVehicle: document.getElementById('rp-stop-vehicle')?.value || '',
                priority: selectedPriority,
                customerPhone: document.getElementById('rp-stop-phone')?.value || '',
                notes: document.getElementById('rp-stop-notes')?.value || '',
                status: selectedStatus
            };

            if (isNew) {
                this.service.addStop(route.id, data);
                this._showToast('Stop hinzugef\u00FCgt.', 'success');
            } else {
                this.service.updateStop(route.id, stopId, data);
                this._showToast('Stop aktualisiert.', 'success');
            }

            close();
            this.render();
        });
    }

    // ============================================
    // Share Modal
    // ============================================

    _openShareModal() {
        if (!this.currentRouteId) { return; }

        const text = this.service.exportRouteAsText(this.currentRouteId);
        if (!text) { return; }

        const modalHtml = `
            <div class="rp-modal-overlay" id="rp-share-modal">
                <div class="rp-modal">
                    <h3>\u{1F4E4} Route teilen</h3>
                    <p style="font-size:14px;color:var(--text-secondary);margin-bottom:16px;">
                        Kopiere den Text und sende ihn per WhatsApp, SMS oder E-Mail an dein Team.
                    </p>
                    <div class="rp-share-preview" id="rp-share-text">${this._esc(text)}</div>
                    <div class="rp-modal-footer">
                        <button class="rp-btn" id="rp-share-cancel">Schlie\u00DFen</button>
                        <button class="rp-btn rp-btn-primary" id="rp-share-copy">\u{1F4CB} Text kopieren</button>
                        <button class="rp-btn rp-btn-success" id="rp-share-whatsapp">\u{1F4AC} WhatsApp</button>
                    </div>
                </div>
            </div>
        `;

        const existing = document.getElementById('rp-share-modal');
        if (existing) { existing.remove(); }

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Events
        const modal = document.getElementById('rp-share-modal');

        document.getElementById('rp-share-cancel')?.addEventListener('click', () => modal.remove());

        modal.addEventListener('click', (e) => {
            if (e.target === modal) { modal.remove(); }
        });

        document.getElementById('rp-share-copy')?.addEventListener('click', () => {
            navigator.clipboard.writeText(text).then(() => {
                this._showToast('Text in Zwischenablage kopiert!', 'success');
            }).catch(() => {
                // Fallback
                const textArea = document.createElement('textarea');
                textArea.value = text;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                this._showToast('Text kopiert!', 'success');
            });
        });

        document.getElementById('rp-share-whatsapp')?.addEventListener('click', () => {
            const encoded = encodeURIComponent(text);
            window.open(`https://wa.me/?text=${encoded}`, '_blank');
        });
    }

    // ============================================
    // Worker Modal
    // ============================================

    _openWorkerModal(workerId) {
        const isNew = !workerId;
        let worker = null;
        if (workerId) {
            worker = this.service.getWorkers().find(w => w.id === workerId);
            if (!worker) { return; }
        }

        const roles = ['meister', 'geselle', 'azubi', 'helfer'];
        let roleOptions = '';
        for (const r of roles) {
            const sel = (worker && worker.role === r) ? 'selected' : '';
            roleOptions += `<option value="${r}" ${sel}>${this._roleLabel(r)}</option>`;
        }

        const modalHtml = `
            <div class="rp-modal-overlay" id="rp-worker-modal">
                <div class="rp-modal">
                    <h3>${isNew ? 'Neuer Mitarbeiter' : 'Mitarbeiter bearbeiten'}</h3>

                    <div class="rp-form-group">
                        <label>Name</label>
                        <input type="text" id="rp-worker-name" value="${this._esc(worker ? worker.name : '')}" placeholder="z.B. Max Mustermann" />
                    </div>

                    <div class="rp-form-row">
                        <div class="rp-form-group">
                            <label>Rolle</label>
                            <select id="rp-worker-role">${roleOptions}</select>
                        </div>
                        <div class="rp-form-group">
                            <label>Telefon</label>
                            <input type="tel" id="rp-worker-phone" value="${this._esc(worker ? worker.phone : '')}" placeholder="+49 ..." />
                        </div>
                    </div>

                    <div class="rp-form-group">
                        <label>Farbe</label>
                        <input type="color" id="rp-worker-color" value="${worker ? worker.color : '#6366f1'}" style="min-height:48px;cursor:pointer;padding:4px;" />
                    </div>

                    <div class="rp-modal-footer">
                        <button class="rp-btn" id="rp-worker-cancel">Abbrechen</button>
                        <button class="rp-btn rp-btn-primary" id="rp-worker-save">Speichern</button>
                    </div>
                </div>
            </div>
        `;

        const existing = document.getElementById('rp-worker-modal');
        if (existing) { existing.remove(); }

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        const modal = document.getElementById('rp-worker-modal');

        document.getElementById('rp-worker-cancel')?.addEventListener('click', () => modal.remove());
        modal.addEventListener('click', (e) => { if (e.target === modal) { modal.remove(); } });

        document.getElementById('rp-worker-save')?.addEventListener('click', () => {
            const name = document.getElementById('rp-worker-name')?.value?.trim();
            if (!name) {
                this._showToast('Bitte einen Namen eingeben.', 'warning');
                return;
            }

            const data = {
                name: name,
                role: document.getElementById('rp-worker-role')?.value || 'geselle',
                phone: document.getElementById('rp-worker-phone')?.value || '',
                color: document.getElementById('rp-worker-color')?.value || '#6366f1'
            };

            if (isNew) {
                this.service.addWorker(data);
                this._showToast('Mitarbeiter hinzugef\u00FCgt.', 'success');
            } else {
                this.service.updateWorker(workerId, data);
                this._showToast('Mitarbeiter aktualisiert.', 'success');
            }

            modal.remove();
            this.render();
        });
    }

    _confirmRemoveWorker(workerId) {
        const worker = this.service.getWorkers().find(w => w.id === workerId);
        if (!worker) { return; }

        if (confirm(`Mitarbeiter "${worker.name}" wirklich entfernen?`)) {
            this.service.removeWorker(workerId);
            this._showToast('Mitarbeiter entfernt.', 'info');
            this.render();
        }
    }

    _toggleWorkerAvailability(workerId) {
        const worker = this.service.getWorkers().find(w => w.id === workerId);
        if (!worker) { return; }

        this.service.updateWorker(workerId, { available: !worker.available });
        this.render();
    }

    // ============================================
    // Vehicle Modal
    // ============================================

    _openVehicleModal(vehicleId) {
        const isNew = !vehicleId;
        let vehicle = null;
        if (vehicleId) {
            vehicle = this.service.getVehicles().find(v => v.id === vehicleId);
            if (!vehicle) { return; }
        }

        const modalHtml = `
            <div class="rp-modal-overlay" id="rp-vehicle-modal">
                <div class="rp-modal">
                    <h3>${isNew ? 'Neues Fahrzeug' : 'Fahrzeug bearbeiten'}</h3>

                    <div class="rp-form-group">
                        <label>Bezeichnung</label>
                        <input type="text" id="rp-vehicle-name" value="${this._esc(vehicle ? vehicle.name : '')}" placeholder="z.B. Sprinter 1, VW Caddy" />
                    </div>

                    <div class="rp-form-row">
                        <div class="rp-form-group">
                            <label>Kennzeichen</label>
                            <input type="text" id="rp-vehicle-plate" value="${this._esc(vehicle ? vehicle.plate : '')}" placeholder="SHA-MW 123" />
                        </div>
                        <div class="rp-form-group">
                            <label>Kapazit\u00E4t (Personen)</label>
                            <input type="number" id="rp-vehicle-capacity" value="${vehicle ? vehicle.capacity : 3}" min="1" max="20" />
                        </div>
                    </div>

                    <div class="rp-modal-footer">
                        <button class="rp-btn" id="rp-vehicle-cancel">Abbrechen</button>
                        <button class="rp-btn rp-btn-primary" id="rp-vehicle-save">Speichern</button>
                    </div>
                </div>
            </div>
        `;

        const existing = document.getElementById('rp-vehicle-modal');
        if (existing) { existing.remove(); }

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        const modal = document.getElementById('rp-vehicle-modal');

        document.getElementById('rp-vehicle-cancel')?.addEventListener('click', () => modal.remove());
        modal.addEventListener('click', (e) => { if (e.target === modal) { modal.remove(); } });

        document.getElementById('rp-vehicle-save')?.addEventListener('click', () => {
            const name = document.getElementById('rp-vehicle-name')?.value?.trim();
            if (!name) {
                this._showToast('Bitte eine Bezeichnung eingeben.', 'warning');
                return;
            }

            const data = {
                name: name,
                plate: document.getElementById('rp-vehicle-plate')?.value || '',
                capacity: parseInt(document.getElementById('rp-vehicle-capacity')?.value) || 3
            };

            if (isNew) {
                this.service.addVehicle(data);
                this._showToast('Fahrzeug hinzugef\u00FCgt.', 'success');
            } else {
                this.service.updateVehicle(vehicleId, data);
                this._showToast('Fahrzeug aktualisiert.', 'success');
            }

            modal.remove();
            this.render();
        });
    }

    _confirmRemoveVehicle(vehicleId) {
        const vehicle = this.service.getVehicles().find(v => v.id === vehicleId);
        if (!vehicle) { return; }

        if (confirm(`Fahrzeug "${vehicle.name}" wirklich entfernen?`)) {
            this.service.removeVehicle(vehicleId);
            this._showToast('Fahrzeug entfernt.', 'info');
            this.render();
        }
    }

    // ============================================
    // Toast (uses global showToast if available)
    // ============================================

    _showToast(message, type) {
        if (typeof window.AppUtils?.showToast === 'function') {
            window.AppUtils.showToast(message, type);
        } else if (typeof window.showToast === 'function') {
            window.showToast(message, type);
        } else {
            console.log(`[RoutePlanningUI] ${type}: ${message}`);
        }
    }
}

window.routePlanningUI = new RoutePlanningUI();
