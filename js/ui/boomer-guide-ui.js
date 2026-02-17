/* ============================================
   Boomer Guide UI
   Visual guidance system: welcome splash, bouncing
   arrows, glow highlights, greyed-out sections,
   floating action button, guided home feed.
   ============================================ */

class BoomerGuideUI {
    constructor() {
        this.service = window.boomerGuideService;
        this.arrows = [];
        this.fabEl = null;
        this._initialized = false;
    }

    /**
     * Initialize the guide system. Called once on app load.
     */
    init() {
        if (this._initialized) { return; }
        this._initialized = true;

        // Wait for store to be ready
        const tryInit = () => {
            if (!window.storeService?.state) {
                setTimeout(tryInit, 200);
                return;
            }
            this.service.scan();
            this._applyNavVisuals();
            this._createFAB();

            // Show welcome splash if needed
            if (this.service.shouldShowSplash()) {
                setTimeout(() => this._showSplash(), 400);
            }

            // Re-render home feed
            this._renderHomeFeed();

            // Subscribe to store changes for live updates
            if (window.storeService) {
                window.storeService.subscribe(() => {
                    this.service.scan();
                    this._applyNavVisuals();
                    this._updateFAB();
                });
            }

            // Listen for view changes to refresh home feed
            document.addEventListener('viewchange', (e) => {
                if (e.detail?.view === 'quick-actions') {
                    this.service.scan();
                    this._renderHomeFeed();
                    this._applyNavVisuals();
                }
            });

            // Trigger external notifications for critical items
            this._triggerExternalNotifications();
        };

        tryInit();
    }

    /* ===== WELCOME SPLASH ===== */

    _showSplash() {
        const feed = this.service.getFeed();
        if (feed.length === 0) { return; }

        const store = window.storeService?.state || {};
        const userName = store.settings?.userName || store.settings?.firmenname || 'Chef';
        const greeting = this._getGreeting(userName);

        const urgentCount = feed.filter(f => f.severity === 'urgent').length;
        const warningCount = feed.filter(f => f.severity === 'warning').length;

        let summaryText;
        if (urgentCount > 0) {
            summaryText = `${urgentCount} dringend${urgentCount > 1 ? 'e' : ''} Sache${urgentCount > 1 ? 'n' : ''} braucht Ihre Aufmerksamkeit:`;
        } else if (warningCount > 0) {
            summaryText = `${warningCount} Sache${warningCount > 1 ? 'n' : ''} sollten Sie sich ansehen:`;
        } else {
            summaryText = 'Hier ist was passiert ist:';
        }

        // Build feed HTML (max 5 items)
        const displayItems = feed.slice(0, 5);
        const feedHTML = displayItems.map(item => `
            <div class="boomer-feed-item feed-${item.severity}" data-view="${item.view}">
                <div class="boomer-feed-icon">${item.icon}</div>
                <div class="boomer-feed-content">
                    <div class="boomer-feed-title">${this._esc(item.title)}</div>
                    <div class="boomer-feed-detail">${this._esc(item.detail)}</div>
                </div>
                <div class="boomer-feed-arrow">›</div>
            </div>
        `).join('');

        // Create overlay
        const overlay = document.createElement('div');
        overlay.className = 'boomer-splash-overlay';
        overlay.id = 'boomer-splash';
        overlay.innerHTML = `
            <div class="boomer-splash-card">
                <div class="boomer-splash-header">
                    <div class="boomer-splash-greeting">${this._esc(greeting)}</div>
                    <div class="boomer-splash-subtitle">${this._formatDate(new Date())}</div>
                </div>

                <div class="boomer-splash-summary">${urgentCount > 0 ? '🚨' : '📋'} ${summaryText}</div>

                <div class="boomer-feed">
                    ${feedHTML}
                </div>

                <div class="boomer-splash-actions">
                    ${urgentCount > 0 ? `
                        <button class="boomer-splash-btn boomer-splash-btn-primary" id="splash-go-urgent">
                            Dringendes zuerst ansehen
                        </button>
                    ` : ''}
                    <button class="boomer-splash-btn boomer-splash-btn-secondary" id="splash-dismiss">
                        Verstanden, zur Startseite
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        // Event listeners
        overlay.querySelectorAll('.boomer-feed-item').forEach(item => {
            item.addEventListener('click', () => {
                const viewId = item.dataset.view;
                this._closeSplash();
                if (viewId && window.navigationController) {
                    window.navigationController.navigateTo(viewId);
                }
            });
        });

        const goUrgent = overlay.querySelector('#splash-go-urgent');
        if (goUrgent) {
            goUrgent.addEventListener('click', () => {
                const firstUrgent = feed.find(f => f.severity === 'urgent');
                this._closeSplash();
                if (firstUrgent?.view && window.navigationController) {
                    window.navigationController.navigateTo(firstUrgent.view);
                }
            });
        }

        const dismiss = overlay.querySelector('#splash-dismiss');
        if (dismiss) {
            dismiss.addEventListener('click', () => {
                this._closeSplash();
            });
        }

        // Close on overlay click (outside card)
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                this._closeSplash();
            }
        });
    }

    _closeSplash() {
        const overlay = document.getElementById('boomer-splash');
        if (overlay) {
            overlay.style.animation = 'splash-fade-in 0.2s ease reverse';
            setTimeout(() => overlay.remove(), 200);
        }
        this.service.dismissSplash();
        this.service.recordVisit();
    }

    /* ===== NAV VISUAL INDICATORS ===== */

    _applyNavVisuals() {
        // Clean up previous arrows and classes
        this._cleanupArrows();

        const navStates = this.service.getAllNavStates();
        const navItems = document.querySelectorAll('.nav-item[data-view]');

        navItems.forEach(navItem => {
            const viewId = navItem.dataset.view;
            const state = navStates[viewId];

            // Remove all boomer classes
            navItem.classList.remove('boomer-glow', 'boomer-glow-urgent', 'boomer-glow-warning', 'boomer-inactive');
            const doneBadge = navItem.querySelector('.boomer-done-badge');
            if (doneBadge) { doneBadge.remove(); }

            // Don't apply guide visuals to the currently active nav item
            if (navItem.classList.contains('active')) { return; }

            switch (state) {
                case 'urgent':
                    navItem.classList.add('boomer-glow-urgent');
                    this._addArrow(navItem, 'arrow-urgent', '👈');
                    break;
                case 'warning':
                    navItem.classList.add('boomer-glow-warning');
                    this._addArrow(navItem, 'arrow-warning', '👈');
                    break;
                case 'info':
                    navItem.classList.add('boomer-glow');
                    break;
                case 'done':
                    // Subtle done badge
                    const badge = document.createElement('span');
                    badge.className = 'boomer-done-badge';
                    badge.textContent = '✓';
                    navItem.appendChild(badge);
                    break;
                case 'inactive':
                default:
                    navItem.classList.add('boomer-inactive');
                    break;
            }
        });
    }

    _addArrow(navItem, arrowClass, emoji) {
        const arrow = document.createElement('span');
        arrow.className = `boomer-arrow ${arrowClass}`;
        arrow.textContent = emoji;
        navItem.style.position = 'relative';
        navItem.appendChild(arrow);
        this.arrows.push(arrow);
    }

    _cleanupArrows() {
        this.arrows.forEach(arrow => arrow.remove());
        this.arrows = [];
    }

    /* ===== FLOATING ACTION BUTTON ===== */

    _createFAB() {
        if (this.fabEl) { return; }

        this.fabEl = document.createElement('button');
        this.fabEl.className = 'boomer-guide-fab';
        this.fabEl.id = 'boomer-guide-fab';
        this.fabEl.innerHTML = '📋';
        this.fabEl.title = 'Was steht an?';

        const badge = document.createElement('span');
        badge.className = 'boomer-guide-fab-badge';
        badge.id = 'boomer-fab-badge';
        badge.style.display = 'none';
        this.fabEl.appendChild(badge);

        document.body.appendChild(this.fabEl);

        this.fabEl.addEventListener('click', () => {
            this.service.scan();
            this._showSplash();
        });

        this._updateFAB();
    }

    _updateFAB() {
        if (!this.fabEl) { return; }

        const count = this.service.getAttentionCount();
        const badge = this.fabEl.querySelector('#boomer-fab-badge');

        if (count > 0) {
            badge.textContent = count;
            badge.style.display = 'flex';
            this.fabEl.classList.add('has-updates');
        } else {
            badge.style.display = 'none';
            this.fabEl.classList.remove('has-updates');
        }
    }

    /* ===== GUIDED HOME FEED (replaces quick-actions) ===== */

    _renderHomeFeed() {
        const container = document.getElementById('quick-actions-container');
        if (!container) { return; }

        const store = window.storeService?.state || {};
        const userName = store.settings?.userName || store.settings?.firmenname || 'Chef';
        const greeting = this._getGreeting(userName);
        const feed = this.service.getFeed();

        const urgent = feed.filter(f => f.severity === 'urgent');
        const warnings = feed.filter(f => f.severity === 'warning');
        const info = feed.filter(f => f.severity === 'info' || f.severity === 'success');

        let html = `<div class="boomer-home-feed">`;

        // Header
        html += `
            <div class="boomer-home-header">
                <div class="boomer-home-greeting">${this._esc(greeting)}</div>
                <div class="boomer-home-date">${this._formatDate(new Date())}</div>
            </div>
        `;

        // URGENT section
        if (urgent.length > 0) {
            html += `
                <div class="boomer-home-section">
                    <div class="boomer-home-section-title">
                        🚨 Sofort erledigen
                        <span class="section-count count-urgent">${urgent.length}</span>
                    </div>
                    ${this._renderFeedItems(urgent)}
                </div>
            `;
        }

        // WARNING section
        if (warnings.length > 0) {
            html += `
                <div class="boomer-home-section">
                    <div class="boomer-home-section-title">
                        ⚠️ Bald fällig
                        <span class="section-count count-warning">${warnings.length}</span>
                    </div>
                    ${this._renderFeedItems(warnings)}
                </div>
            `;
        }

        // INFO section
        if (info.length > 0) {
            html += `
                <div class="boomer-home-section">
                    <div class="boomer-home-section-title">
                        📋 Aktueller Stand
                        <span class="section-count">${info.length}</span>
                    </div>
                    ${this._renderFeedItems(info)}
                </div>
            `;
        }

        // ALL GOOD state
        if (feed.length === 0) {
            html += `
                <div class="boomer-all-good">
                    <div class="boomer-all-good-icon">✅</div>
                    <div class="boomer-all-good-text">
                        Alles erledigt! Keine offenen Aufgaben.<br>
                        Nutzen Sie die Buttons unten, um etwas Neues zu starten.
                    </div>
                </div>
            `;
        }

        // Quick action buttons (always shown at bottom)
        html += `
            <div class="boomer-home-section" style="margin-top: 12px;">
                <div class="boomer-home-section-title">➕ Neue Aktion starten</div>
                <div class="qa-cards-grid">
                    <button class="qa-card" id="qa-neuer-kunde" title="Neuen Kunden hinzufügen">
                        <div class="qa-card-icon">👤</div>
                        <div class="qa-card-label">Neuer Kunde</div>
                    </button>
                    <button class="qa-card" id="qa-neues-angebot" title="Neues Angebot erstellen">
                        <div class="qa-card-icon">📝</div>
                        <div class="qa-card-label">Neues Angebot</div>
                    </button>
                    <button class="qa-card" id="qa-neue-anfrage" title="Neue Anfrage erfassen">
                        <div class="qa-card-icon">📋</div>
                        <div class="qa-card-label">Neue Anfrage</div>
                    </button>
                    <button class="qa-card" id="qa-neue-rechnung" title="Neue Rechnung schreiben">
                        <div class="qa-card-icon">💶</div>
                        <div class="qa-card-label">Neue Rechnung</div>
                    </button>
                </div>
            </div>
        `;

        html += `</div>`;

        container.innerHTML = html;

        // Attach feed item click handlers
        container.querySelectorAll('.boomer-feed-item').forEach(item => {
            item.addEventListener('click', () => {
                const viewId = item.dataset.view;
                if (viewId && window.navigationController) {
                    window.navigationController.navigateTo(viewId);
                }
            });
        });

        // Attach quick action handlers (reuse existing logic)
        this._attachQuickActionListeners();
    }

    _renderFeedItems(items) {
        return items.map(item => `
            <div class="boomer-feed-item feed-${item.severity}" data-view="${item.view}">
                <div class="boomer-feed-icon">${item.icon}</div>
                <div class="boomer-feed-content">
                    <div class="boomer-feed-title">${this._esc(item.title)}</div>
                    <div class="boomer-feed-detail">${this._esc(item.detail)}</div>
                </div>
                <div class="boomer-feed-arrow">›</div>
            </div>
        `).join('');
    }

    _attachQuickActionListeners() {
        const actions = {
            'qa-neuer-kunde': () => {
                if (window.navigationController) { window.navigationController.navigateTo('kunden'); }
                setTimeout(() => {
                    const btn = document.getElementById('btn-neuer-kunde');
                    if (btn) { btn.click(); }
                }, 200);
            },
            'qa-neues-angebot': () => {
                if (window.navigationController) { window.navigationController.navigateTo('angebote'); }
                setTimeout(() => {
                    const btn = document.getElementById('btn-neues-angebot');
                    if (btn) { btn.click(); }
                }, 200);
            },
            'qa-neue-anfrage': () => {
                if (window.navigationController) { window.navigationController.navigateTo('anfragen'); }
                setTimeout(() => {
                    const btn = document.getElementById('btn-neue-anfrage');
                    if (btn) { btn.click(); }
                }, 200);
            },
            'qa-neue-rechnung': () => {
                if (window.navigationController) { window.navigationController.navigateTo('rechnungen'); }
                setTimeout(() => {
                    const btn = document.getElementById('btn-neue-rechnung');
                    if (btn) { btn.click(); }
                }, 200);
            }
        };

        Object.entries(actions).forEach(([id, handler]) => {
            const el = document.getElementById(id);
            if (el) { el.addEventListener('click', handler); }
        });
    }

    /* ===== EXTERNAL NOTIFICATIONS ===== */

    _triggerExternalNotifications() {
        const critical = this.service.getCriticalItems();
        if (critical.length === 0) { return; }

        // Only trigger if push messenger is configured
        if (!window.pushMessengerService) { return; }

        // Build message
        const lines = critical.map(item => `${item.icon} ${item.title} — ${item.detail}`);
        const message = `🚨 MHS Workflow — Dringende Meldungen:\n\n${lines.join('\n')}`;

        // Send via configured channels
        window.pushMessengerService.sendAlert(message);
    }

    /* ===== HELPERS ===== */

    _getGreeting(userName) {
        const hour = new Date().getHours();
        let time;
        if (hour < 12) { time = 'Morgen'; }
        else if (hour < 18) { time = 'Tag'; }
        else { time = 'Abend'; }
        return `Guten ${time}, ${userName}!`;
    }

    _formatDate(date) {
        return date.toLocaleDateString('de-DE', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
    }

    _esc(str) {
        if (!str) { return ''; }
        const el = document.createElement('span');
        el.textContent = str;
        return el.innerHTML;
    }
}

// Initialize as global singleton
window.boomerGuideUI = new BoomerGuideUI();
