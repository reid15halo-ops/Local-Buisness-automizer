/* ============================================
   Boomer Guide Service
   Tracks what changed since last visit and builds
   a prioritized activity feed. Drives the visual
   guide system (arrows, glow, grey-out).
   ============================================ */

class BoomerGuideService {
    constructor() {
        this.STORAGE_KEY = 'mhs_boomer_guide';
        this.LAST_VISIT_KEY = 'mhs_last_visit';
        this.SPLASH_DISMISSED_KEY = 'mhs_splash_dismissed_session';

        this.listeners = [];
        this.feedItems = [];
        this.navStates = {}; // viewId -> 'urgent' | 'warning' | 'info' | 'done' | 'inactive'

        this._loadState();
    }

    /* ===== PUBLIC API ===== */

    /**
     * Scan all services for changes and build the activity feed.
     * Call this on app startup and periodically.
     */
    scan() {
        const state = window.storeService?.state;
        if (!state) { return; }

        this.feedItems = [];
        this.navStates = {};

        const lastVisit = this._getLastVisit();

        // === URGENT (red) ===
        this._scanOverdueInvoices(state);
        this._scanOldInquiries(state);

        // === WARNING (amber) ===
        this._scanNearDeadlineOrders(state);
        this._scanDueTasks(state);

        // === INFO (blue) ===
        this._scanNewInquiries(state, lastVisit);
        this._scanDraftQuotes(state);
        this._scanActiveOrders(state);
        this._scanRecentPayments(state, lastVisit);

        // Sort: urgent first, then warning, then info, then success
        const severityOrder = { urgent: 0, warning: 1, info: 2, success: 3 };
        this.feedItems.sort((a, b) =>
            (severityOrder[a.severity] || 99) - (severityOrder[b.severity] || 99)
        );

        // Build nav states based on feed
        this._buildNavStates();

        // Notify listeners
        this._notify();
    }

    /**
     * Get the prioritized activity feed
     * @returns {Array} Feed items sorted by urgency
     */
    getFeed() {
        return this.feedItems;
    }

    /**
     * Get feed items filtered by urgency level
     * @param {string} severity - 'urgent', 'warning', 'info', 'success'
     */
    getFeedBySeverity(severity) {
        return this.feedItems.filter(item => item.severity === severity);
    }

    /**
     * Get nav state for a specific view
     * @param {string} viewId
     * @returns {string} 'urgent' | 'warning' | 'info' | 'done' | 'inactive'
     */
    getNavState(viewId) {
        return this.navStates[viewId] || 'inactive';
    }

    /**
     * Get all nav states
     * @returns {Object} viewId -> state
     */
    getAllNavStates() {
        return { ...this.navStates };
    }

    /**
     * Check if the welcome splash should be shown
     * @returns {boolean}
     */
    shouldShowSplash() {
        // Don't show if already dismissed this session
        if (sessionStorage.getItem(this.SPLASH_DISMISSED_KEY) === 'true') {
            return false;
        }
        // Show if there are any feed items (something happened)
        return this.feedItems.length > 0;
    }

    /**
     * Mark the splash as dismissed for this session
     */
    dismissSplash() {
        sessionStorage.setItem(this.SPLASH_DISMISSED_KEY, 'true');
    }

    /**
     * Record current time as last visit
     */
    recordVisit() {
        localStorage.setItem(this.LAST_VISIT_KEY, new Date().toISOString());
    }

    /**
     * Subscribe to feed updates
     * @param {Function} callback
     * @returns {Function} Unsubscribe function
     */
    subscribe(callback) {
        this.listeners.push(callback);
        return () => {
            const i = this.listeners.indexOf(callback);
            if (i !== -1) { this.listeners.splice(i, 1); }
        };
    }

    /**
     * Get count of items needing attention
     * @returns {number}
     */
    getAttentionCount() {
        return this.feedItems.filter(f =>
            f.severity === 'urgent' || f.severity === 'warning'
        ).length;
    }

    /**
     * Check if any critical items need external notification
     * @returns {Array} Items that should trigger Telegram/WhatsApp
     */
    getCriticalItems() {
        return this.feedItems.filter(f => f.severity === 'urgent' && f.pushWorthy);
    }

    /* ===== SCANNING METHODS ===== */

    _scanOverdueInvoices(state) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const overdue = (state.rechnungen || []).filter(r => {
            if (r.status === 'bezahlt' || r.status === 'storniert') { return false; }
            if (r.status === 'überfällig') { return true; }
            if (r.zahlungsziel) {
                return new Date(r.zahlungsziel) < today;
            }
            if (r.createdAt) {
                const due = new Date(r.createdAt);
                due.setDate(due.getDate() + 30);
                return due < today;
            }
            return false;
        });

        if (overdue.length > 0) {
            const totalAmount = overdue.reduce((sum, r) => sum + (r.brutto || 0), 0);
            this.feedItems.push({
                id: 'overdue-invoices',
                severity: 'urgent',
                icon: '🔴',
                title: `${overdue.length} Rechnung${overdue.length > 1 ? 'en' : ''} überfällig!`,
                detail: `Gesamt: ${this._formatCurrency(totalAmount)}`,
                view: 'rechnungen',
                pushWorthy: true
            });
        }
    }

    _scanOldInquiries(state) {
        const now = new Date();
        const old = (state.anfragen || []).filter(a => {
            if (a.status !== 'neu') { return false; }
            if (!a.createdAt) { return false; }
            const hours = (now - new Date(a.createdAt)) / (1000 * 60 * 60);
            return hours > 48;
        });

        if (old.length > 0) {
            this.feedItems.push({
                id: 'old-inquiries',
                severity: 'urgent',
                icon: '🚨',
                title: `${old.length} Anfrage${old.length > 1 ? 'n' : ''} warten seit >48h!`,
                detail: old.slice(0, 2).map(a => a.kunde?.name || 'Unbekannt').join(', '),
                view: 'anfragen',
                pushWorthy: true
            });
        }
    }

    _scanNearDeadlineOrders(state) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 2);

        const nearDeadline = (state.auftraege || []).filter(a => {
            if (a.status === 'abgeschlossen' || a.status === 'storniert') { return false; }
            if (!a.deadline) { return false; }
            const d = new Date(a.deadline);
            return d >= today && d <= tomorrow;
        });

        if (nearDeadline.length > 0) {
            this.feedItems.push({
                id: 'deadline-orders',
                severity: 'warning',
                icon: '⏰',
                title: `${nearDeadline.length} Auftrag${nearDeadline.length > 1 ? 'e' : ''} — Deadline bald!`,
                detail: nearDeadline.map(a => a.kunde?.name || a.id).slice(0, 2).join(', '),
                view: 'auftraege',
                pushWorthy: true
            });
        }
    }

    _scanDueTasks(state) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const tasks = state.aufgaben || [];
        const dueTasks = tasks.filter(t => {
            if (t.completed || t.status === 'erledigt') { return false; }
            if (!t.dueDate) { return false; }
            return new Date(t.dueDate) <= today;
        });

        if (dueTasks.length > 0) {
            this.feedItems.push({
                id: 'due-tasks',
                severity: 'warning',
                icon: '📋',
                title: `${dueTasks.length} Aufgabe${dueTasks.length > 1 ? 'n' : ''} fällig!`,
                detail: dueTasks.slice(0, 2).map(t => t.title || t.titel).join(', '),
                view: 'aufgaben',
                pushWorthy: false
            });
        }
    }

    _scanNewInquiries(state, lastVisit) {
        const newSinceVisit = (state.anfragen || []).filter(a => {
            if (a.status !== 'neu') { return false; }
            if (!a.createdAt) { return false; }
            const hours = (new Date() - new Date(a.createdAt)) / (1000 * 60 * 60);
            return hours <= 48; // Only show recent ones (not covered by "old inquiries")
        });

        if (newSinceVisit.length > 0) {
            this.feedItems.push({
                id: 'new-inquiries',
                severity: 'info',
                icon: '📥',
                title: `${newSinceVisit.length} neue Anfrage${newSinceVisit.length > 1 ? 'n' : ''}`,
                detail: newSinceVisit.slice(0, 2).map(a => a.kunde?.name || 'Unbekannt').join(', '),
                view: 'anfragen',
                pushWorthy: false
            });
        }
    }

    _scanDraftQuotes(state) {
        const drafts = (state.angebote || []).filter(a => a.status === 'entwurf');

        if (drafts.length > 0) {
            this.feedItems.push({
                id: 'draft-quotes',
                severity: 'info',
                icon: '📝',
                title: `${drafts.length} Angebot${drafts.length > 1 ? 'e' : ''} im Entwurf`,
                detail: 'Warten auf Fertigstellung & Versand',
                view: 'angebote',
                pushWorthy: false
            });
        }
    }

    _scanActiveOrders(state) {
        const active = (state.auftraege || []).filter(a =>
            a.status === 'in_bearbeitung' || a.status === 'aktiv'
        );

        if (active.length > 0) {
            this.feedItems.push({
                id: 'active-orders',
                severity: 'info',
                icon: '🔧',
                title: `${active.length} aktive${active.length > 1 ? '' : 'r'} Auftrag${active.length > 1 ? 'e' : ''}`,
                detail: 'In Bearbeitung',
                view: 'auftraege',
                pushWorthy: false
            });
        }
    }

    _scanRecentPayments(state, lastVisit) {
        const recentPaid = (state.rechnungen || []).filter(r => {
            if (r.status !== 'bezahlt') { return false; }
            if (!r.bezahltAm && !r.updatedAt) { return false; }
            const paidDate = new Date(r.bezahltAm || r.updatedAt);
            const cutoff = lastVisit ? new Date(lastVisit) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            return paidDate > cutoff;
        });

        if (recentPaid.length > 0) {
            const total = recentPaid.reduce((sum, r) => sum + (r.brutto || 0), 0);
            this.feedItems.push({
                id: 'recent-payments',
                severity: 'success',
                icon: '💰',
                title: `${recentPaid.length} Zahlung${recentPaid.length > 1 ? 'en' : ''} eingegangen!`,
                detail: `Gesamt: ${this._formatCurrency(total)}`,
                view: 'rechnungen',
                pushWorthy: total > 1000 // Only push if substantial amount
            });
        }
    }

    /* ===== NAV STATE BUILDING ===== */

    _buildNavStates() {
        // Map feed items to their target views
        const viewPriority = {}; // viewId -> highest severity

        const severityRank = { urgent: 0, warning: 1, info: 2, success: 3 };

        this.feedItems.forEach(item => {
            if (!item.view) { return; }
            const current = viewPriority[item.view];
            if (!current || severityRank[item.severity] < severityRank[current]) {
                viewPriority[item.view] = item.severity;
            }
        });

        // Simple mode views that are always visible
        const simpleViews = ['quick-actions', 'anfragen', 'angebote', 'auftraege', 'rechnungen', 'kunden', 'einstellungen'];

        simpleViews.forEach(view => {
            if (viewPriority[view]) {
                this.navStates[view] = viewPriority[view];
            } else if (view === 'quick-actions' || view === 'einstellungen') {
                this.navStates[view] = 'done'; // Always accessible
            } else {
                this.navStates[view] = 'inactive';
            }
        });
    }

    /* ===== HELPERS ===== */

    _getLastVisit() {
        const val = localStorage.getItem(this.LAST_VISIT_KEY);
        return val ? new Date(val) : null;
    }

    _loadState() {
        // State is rebuilt on every scan, no persistent state needed
    }

    _notify() {
        this.listeners.forEach(cb => {
            try { cb(this.feedItems, this.navStates); } catch (e) { console.error('BoomerGuide listener error:', e); }
        });
    }

    _formatCurrency(amount) {
        return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount);
    }
}

// Initialize as global singleton
window.boomerGuideService = new BoomerGuideService();
