/* ============================================
   Dashboard Widget Service
   Manages customizable dashboard widgets:
   - Widget registry (available widget types)
   - User layout persistence (localStorage)
   - Widget data providers (computed from store)
   ============================================ */

class DashboardWidgetService {
    constructor() {
        this.STORAGE_KEY = 'freyai_dashboard_widgets';

        // Registry of all available widget types
        this.availableWidgets = [
            { id: 'kpi-anfragen', name: 'Offene Anfragen', category: 'kpi', size: 'small', icon: '\u{1F4E5}' },
            { id: 'kpi-angebote', name: 'Wartende Angebote', category: 'kpi', size: 'small', icon: '\u{1F4DD}' },
            { id: 'kpi-auftraege', name: 'Aktive Auftr\u00E4ge', category: 'kpi', size: 'small', icon: '\u{1F527}' },
            { id: 'kpi-rechnungen', name: 'Offene Rechnungen', category: 'kpi', size: 'small', icon: '\u{1F4B0}' },
            { id: 'kpi-umsatz', name: 'Umsatz (Monat)', category: 'kpi', size: 'small', icon: '\u{1F4C8}' },
            { id: 'kpi-cashflow', name: 'Cashflow', category: 'kpi', size: 'small', icon: '\u{1F4B6}' },
            { id: 'activity-feed', name: 'Aktivit\u00E4ten', category: 'feed', size: 'medium', icon: '\u{1F4CB}' },
            { id: 'upcoming-termine', name: 'Anstehende Termine', category: 'schedule', size: 'medium', icon: '\u{1F4C5}' },
            { id: 'overdue-invoices', name: '\u00DCberf\u00E4llige Rechnungen', category: 'finance', size: 'medium', icon: '\u26A0\uFE0F' },
            { id: 'recent-anfragen', name: 'Neue Anfragen', category: 'sales', size: 'medium', icon: '\u{1F4E8}' },
            { id: 'material-alerts', name: 'Lager-Warnungen', category: 'inventory', size: 'small', icon: '\u{1F4E6}' },
            { id: 'quick-chart', name: 'Umsatz-Chart', category: 'charts', size: 'large', icon: '\u{1F4CA}' }
        ];

        // Default layout matching the current static dashboard
        this.defaultLayout = [
            { widgetId: 'kpi-anfragen', order: 0 },
            { widgetId: 'kpi-angebote', order: 1 },
            { widgetId: 'kpi-auftraege', order: 2 },
            { widgetId: 'kpi-rechnungen', order: 3 },
            { widgetId: 'activity-feed', order: 4 }
        ];

        this.layout = this._loadLayout();
    }

    // ============================================
    // Layout Management
    // ============================================

    /**
     * Load layout from localStorage, falling back to defaults.
     * @returns {Array} Ordered array of widget layout entries
     * @private
     */
    _loadLayout() {
        try {
            const stored = localStorage.getItem(this.STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    // Validate that all widgetIds are still valid
                    const validIds = new Set(this.availableWidgets.map(w => w.id));
                    const validated = parsed.filter(entry => validIds.has(entry.widgetId));
                    if (validated.length > 0) {
                        return validated;
                    }
                }
            }
        } catch (error) {
            console.warn('DashboardWidgetService: Fehler beim Laden der Widget-Konfiguration:', error);
        }
        return [...this.defaultLayout];
    }

    /**
     * Returns the current widget layout with full widget metadata merged in.
     * @returns {Array} Ordered array of widget configs with layout info
     */
    getLayout() {
        return this.layout
            .sort((a, b) => a.order - b.order)
            .map(entry => {
                const widgetDef = this.availableWidgets.find(w => w.id === entry.widgetId);
                if (!widgetDef) { return null; }
                return {
                    ...widgetDef,
                    order: entry.order,
                    config: entry.config || {}
                };
            })
            .filter(Boolean);
    }

    /**
     * Persist the current layout to localStorage.
     * @param {Array} [layout] Optional layout array to save; uses internal layout if omitted
     */
    saveLayout(layout) {
        try {
            if (layout) {
                this.layout = layout;
            }
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.layout));
        } catch (error) {
            console.error('DashboardWidgetService: Fehler beim Speichern der Widget-Konfiguration:', error);
        }
    }

    /**
     * Add a widget to the dashboard layout.
     * @param {string} widgetId - ID of the widget type to add
     * @returns {boolean} true if added, false if already present or invalid
     */
    addWidget(widgetId) {
        try {
            // Check if widget type exists
            const widgetDef = this.availableWidgets.find(w => w.id === widgetId);
            if (!widgetDef) {
                console.warn(`DashboardWidgetService: Unbekannter Widget-Typ "${widgetId}"`);
                return false;
            }

            // Check if already in layout
            if (this.layout.some(entry => entry.widgetId === widgetId)) {
                console.warn(`DashboardWidgetService: Widget "${widgetId}" ist bereits im Dashboard`);
                return false;
            }

            // Add at the end
            const maxOrder = this.layout.length > 0
                ? Math.max(...this.layout.map(e => e.order))
                : -1;

            this.layout.push({
                widgetId: widgetId,
                order: maxOrder + 1
            });

            this.saveLayout();
            return true;
        } catch (error) {
            console.error('DashboardWidgetService: Fehler beim Hinzuf\u00FCgen des Widgets:', error);
            return false;
        }
    }

    /**
     * Remove a widget from the dashboard layout.
     * @param {string} widgetId - ID of the widget to remove
     * @returns {boolean} true if removed
     */
    removeWidget(widgetId) {
        try {
            const initialLength = this.layout.length;
            this.layout = this.layout.filter(entry => entry.widgetId !== widgetId);

            if (this.layout.length < initialLength) {
                // Re-normalize order indices
                this.layout
                    .sort((a, b) => a.order - b.order)
                    .forEach((entry, index) => { entry.order = index; });
                this.saveLayout();
                return true;
            }
            return false;
        } catch (error) {
            console.error('DashboardWidgetService: Fehler beim Entfernen des Widgets:', error);
            return false;
        }
    }

    /**
     * Move a widget from one position to another (reorder).
     * @param {number} fromIndex - Current position index
     * @param {number} toIndex - Target position index
     * @returns {boolean} true if moved successfully
     */
    moveWidget(fromIndex, toIndex) {
        try {
            const sorted = this.layout.sort((a, b) => a.order - b.order);

            if (fromIndex < 0 || fromIndex >= sorted.length ||
                toIndex < 0 || toIndex >= sorted.length) {
                return false;
            }

            // Remove item from old position and insert at new
            const [moved] = sorted.splice(fromIndex, 1);
            sorted.splice(toIndex, 0, moved);

            // Re-assign order indices
            sorted.forEach((entry, index) => { entry.order = index; });

            this.layout = sorted;
            this.saveLayout();
            return true;
        } catch (error) {
            console.error('DashboardWidgetService: Fehler beim Verschieben des Widgets:', error);
            return false;
        }
    }

    /**
     * Reset dashboard to the default layout.
     */
    resetToDefault() {
        this.layout = [...this.defaultLayout];
        this.saveLayout();
    }

    /**
     * Returns widgets that are available but not currently in the layout.
     * @returns {Array} Available widgets not yet added
     */
    getAvailableToAdd() {
        const activeIds = new Set(this.layout.map(e => e.widgetId));
        return this.availableWidgets.filter(w => !activeIds.has(w.id));
    }

    /**
     * Returns available widgets grouped by category.
     * @returns {Object} { categoryName: [widgets...], ... }
     */
    getAvailableGroupedByCategory() {
        const available = this.getAvailableToAdd();
        const groups = {};
        const categoryLabels = {
            kpi: 'Kennzahlen (KPI)',
            feed: 'Feeds',
            schedule: 'Termine & Planung',
            finance: 'Finanzen',
            sales: 'Vertrieb',
            inventory: 'Lagerverwaltung',
            charts: 'Diagramme'
        };

        available.forEach(widget => {
            const label = categoryLabels[widget.category] || widget.category;
            if (!groups[label]) { groups[label] = []; }
            groups[label].push(widget);
        });

        return groups;
    }

    // ============================================
    // Widget Data Providers
    // ============================================

    /**
     * Computes and returns live data for a given widget.
     * @param {string} widgetId - The widget type ID
     * @returns {Object} Widget data (varies by type)
     */
    getWidgetData(widgetId) {
        try {
            const state = window.storeService?.state;
            if (!state) {
                return { error: true, message: 'Daten nicht verf\u00FCgbar' };
            }

            switch (widgetId) {
                case 'kpi-anfragen':
                    return this._getKpiAnfragen(state);
                case 'kpi-angebote':
                    return this._getKpiAngebote(state);
                case 'kpi-auftraege':
                    return this._getKpiAuftraege(state);
                case 'kpi-rechnungen':
                    return this._getKpiRechnungen(state);
                case 'kpi-umsatz':
                    return this._getKpiUmsatz(state);
                case 'kpi-cashflow':
                    return this._getKpiCashflow(state);
                case 'activity-feed':
                    return this._getActivityFeed(state);
                case 'upcoming-termine':
                    return this._getUpcomingTermine();
                case 'overdue-invoices':
                    return this._getOverdueInvoices(state);
                case 'recent-anfragen':
                    return this._getRecentAnfragen(state);
                case 'material-alerts':
                    return this._getMaterialAlerts();
                case 'quick-chart':
                    return this._getQuickChartData(state);
                default:
                    return { error: true, message: 'Unbekannter Widget-Typ' };
            }
        } catch (error) {
            console.error(`DashboardWidgetService: Fehler bei Widget-Daten f\u00FCr "${widgetId}":`, error);
            return { error: true, message: 'Fehler beim Laden der Daten' };
        }
    }

    // --- KPI data providers ---

    _getKpiAnfragen(state) {
        const anfragen = state.anfragen || [];
        const offene = anfragen.filter(a => a.status === 'neu');
        return {
            type: 'kpi',
            value: offene.length,
            label: 'Offene Anfragen',
            trend: this._calculateTrend(anfragen, 'neu'),
            navigateTo: 'anfragen'
        };
    }

    _getKpiAngebote(state) {
        const angebote = state.angebote || [];
        const wartende = angebote.filter(a => a.status === 'offen');
        return {
            type: 'kpi',
            value: wartende.length,
            label: 'Wartende Angebote',
            trend: this._calculateTrend(angebote, 'offen'),
            navigateTo: 'angebote'
        };
    }

    _getKpiAuftraege(state) {
        const auftraege = state.auftraege || [];
        const aktive = auftraege.filter(a => a.status !== 'abgeschlossen');
        return {
            type: 'kpi',
            value: aktive.length,
            label: 'Aktive Auftr\u00E4ge',
            trend: null,
            navigateTo: 'auftraege'
        };
    }

    _getKpiRechnungen(state) {
        const rechnungen = state.rechnungen || [];
        const offene = rechnungen.filter(r => r.status === 'offen');
        const totalOpen = offene.reduce((sum, r) => sum + (r.brutto || 0), 0);
        return {
            type: 'kpi',
            value: offene.length,
            label: 'Offene Rechnungen',
            subValue: this._formatCurrency(totalOpen),
            navigateTo: 'rechnungen'
        };
    }

    _getKpiUmsatz(state) {
        const rechnungen = state.rechnungen || [];
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        const monthlyRevenue = rechnungen
            .filter(r => r.status === 'bezahlt' && r.paidAt)
            .filter(r => {
                const d = new Date(r.paidAt);
                return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
            })
            .reduce((sum, r) => sum + (r.brutto || 0), 0);

        return {
            type: 'kpi',
            value: this._formatCurrency(monthlyRevenue),
            label: 'Umsatz diesen Monat',
            isFormattedValue: true
        };
    }

    _getKpiCashflow(state) {
        let snapshot = null;
        if (window.cashFlowService) {
            try {
                snapshot = window.cashFlowService.getCurrentSnapshot();
            } catch (e) {
                // Cashflow service may not be ready
            }
        }

        if (snapshot) {
            const balance = snapshot.currentBalance || 0;
            return {
                type: 'kpi',
                value: this._formatCurrency(balance),
                label: 'Aktueller Cashflow',
                isFormattedValue: true,
                status: balance >= 0 ? 'positive' : 'negative'
            };
        }

        // Fallback: calculate from invoices
        const rechnungen = state.rechnungen || [];
        const paidTotal = rechnungen
            .filter(r => r.status === 'bezahlt')
            .reduce((sum, r) => sum + (r.brutto || 0), 0);

        return {
            type: 'kpi',
            value: this._formatCurrency(paidTotal),
            label: 'Bezahlte Rechnungen',
            isFormattedValue: true
        };
    }

    // --- Feed / list data providers ---

    _getActivityFeed(state) {
        const activities = state.activities || [];
        return {
            type: 'list',
            items: activities.slice(0, 8).map(a => ({
                icon: a.icon,
                title: a.title,
                time: a.time,
                timeFormatted: this._getRelativeTime(a.time)
            })),
            emptyMessage: 'Noch keine Aktivit\u00E4ten.'
        };
    }

    _getUpcomingTermine() {
        const items = [];
        if (window.calendarService) {
            try {
                const today = new Date();
                // Get appointments for the next 7 days
                for (let i = 0; i < 7; i++) {
                    const date = new Date(today);
                    date.setDate(date.getDate() + i);
                    const dateStr = date.toISOString().split('T')[0];
                    const dayAppointments = window.calendarService.getAppointmentsForDay(dateStr);
                    dayAppointments.forEach(apt => {
                        items.push({
                            icon: '\u{1F4C5}',
                            title: apt.title || apt.beschreibung || 'Termin',
                            time: apt.date,
                            startTime: apt.startTime || '',
                            endTime: apt.endTime || '',
                            timeFormatted: this._formatDate(apt.date) + (apt.startTime ? ` ${apt.startTime}` : '')
                        });
                    });
                }
            } catch (e) {
                console.warn('DashboardWidgetService: Kalender-Daten nicht verf\u00FCgbar:', e);
            }
        }
        return {
            type: 'list',
            items: items.slice(0, 8),
            emptyMessage: 'Keine anstehenden Termine.'
        };
    }

    _getOverdueInvoices(state) {
        const rechnungen = state.rechnungen || [];
        const now = new Date();
        const overdue = rechnungen.filter(r => {
            if (r.status === 'bezahlt') { return false; }
            if (!r.faelligkeitsdatum) { return false; }
            return new Date(r.faelligkeitsdatum) < now;
        });

        return {
            type: 'list',
            items: overdue.slice(0, 8).map(r => ({
                icon: '\u26A0\uFE0F',
                title: `${r.kunde?.name || 'Unbekannt'} - ${r.nummer || r.id}`,
                subTitle: this._formatCurrency(r.brutto || 0),
                time: r.faelligkeitsdatum,
                timeFormatted: `F\u00E4llig: ${this._formatDate(r.faelligkeitsdatum)}`,
                status: 'danger'
            })),
            totalAmount: overdue.reduce((sum, r) => sum + (r.brutto || 0), 0),
            emptyMessage: 'Keine \u00FCberf\u00E4lligen Rechnungen.'
        };
    }

    _getRecentAnfragen(state) {
        const anfragen = state.anfragen || [];
        const sorted = [...anfragen]
            .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

        return {
            type: 'list',
            items: sorted.slice(0, 8).map(a => ({
                icon: '\u{1F4E8}',
                title: a.kunde?.name || 'Unbekannt',
                subTitle: a.leistungsart || a.beschreibung || '',
                time: a.createdAt,
                timeFormatted: this._getRelativeTime(a.createdAt),
                status: a.status === 'neu' ? 'new' : a.status
            })),
            emptyMessage: 'Keine Anfragen vorhanden.'
        };
    }

    _getMaterialAlerts() {
        const items = [];
        if (window.materialService) {
            try {
                const lowStock = window.materialService.getLowStockItems();
                lowStock.forEach(m => {
                    const verfuegbar = window.materialService.getAvailableStock(m.id);
                    items.push({
                        icon: '\u{1F4E6}',
                        title: m.bezeichnung || m.name || 'Unbekanntes Material',
                        subTitle: `Bestand: ${verfuegbar} / Min: ${m.minBestand}`,
                        status: verfuegbar <= 0 ? 'danger' : 'warning'
                    });
                });
            } catch (e) {
                console.warn('DashboardWidgetService: Material-Daten nicht verf\u00FCgbar:', e);
            }
        }
        return {
            type: 'list',
            items: items.slice(0, 6),
            emptyMessage: 'Keine Lager-Warnungen.'
        };
    }

    _getQuickChartData(state) {
        const rechnungen = state.rechnungen || [];
        const monthNames = ['Jan', 'Feb', 'M\u00E4r', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
        const now = new Date();
        const months = [];

        for (let i = 5; i >= 0; i--) {
            const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const month = date.getMonth();
            const year = date.getFullYear();

            const revenue = rechnungen
                .filter(r => r.status === 'bezahlt' && r.paidAt)
                .filter(r => {
                    const d = new Date(r.paidAt);
                    return d.getMonth() === month && d.getFullYear() === year;
                })
                .reduce((sum, r) => sum + (r.brutto || 0), 0);

            months.push({
                label: monthNames[month],
                value: revenue
            });
        }

        return {
            type: 'chart',
            title: 'Umsatz (letzte 6 Monate)',
            data: months,
            maxValue: Math.max(...months.map(m => m.value), 1000)
        };
    }

    // ============================================
    // Helpers
    // ============================================

    /**
     * Calculate a simple trend indicator based on recent items with a given status.
     * @param {Array} items - Array of items (anfragen, angebote, etc.)
     * @param {string} status - Status to filter for
     * @returns {string|null} 'up', 'down', 'stable', or null
     * @private
     */
    _calculateTrend(items, status) {
        try {
            const now = new Date();
            const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

            const thisWeek = items.filter(i =>
                i.status === status && new Date(i.createdAt) >= oneWeekAgo
            ).length;

            const lastWeek = items.filter(i =>
                i.status === status &&
                new Date(i.createdAt) >= twoWeeksAgo &&
                new Date(i.createdAt) < oneWeekAgo
            ).length;

            if (thisWeek > lastWeek) { return 'up'; }
            if (thisWeek < lastWeek) { return 'down'; }
            return 'stable';
        } catch (e) {
            return null;
        }
    }

    /**
     * Format a number as EUR currency.
     * @param {number} amount
     * @returns {string}
     * @private
     */
    _formatCurrency(amount) {
        if (typeof amount !== 'number' || isNaN(amount)) { return '0,00 \u20AC'; }
        return new Intl.NumberFormat('de-DE', {
            style: 'currency',
            currency: 'EUR'
        }).format(amount);
    }

    /**
     * Format a date string to German locale date.
     * @param {string} dateStr - ISO date string
     * @returns {string}
     * @private
     */
    _formatDate(dateStr) {
        try {
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) { return ''; }
            return d.toLocaleDateString('de-DE', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });
        } catch (e) {
            return '';
        }
    }

    /**
     * Get relative time string (e.g. "vor 5 Min.").
     * Falls back to window.UI.getRelativeTime if available.
     * @param {string} timeStr - ISO date/time string
     * @returns {string}
     * @private
     */
    _getRelativeTime(timeStr) {
        if (window.UI?.getRelativeTime) {
            try {
                return window.UI.getRelativeTime(timeStr);
            } catch (e) {
                // Fall through to built-in implementation
            }
        }

        try {
            const now = new Date();
            const date = new Date(timeStr);
            if (isNaN(date.getTime())) { return ''; }

            const diffMs = now - date;
            const diffMin = Math.floor(diffMs / 60000);
            const diffHrs = Math.floor(diffMs / 3600000);
            const diffDays = Math.floor(diffMs / 86400000);

            if (diffMin < 1) { return 'Gerade eben'; }
            if (diffMin < 60) { return `vor ${diffMin} Min.`; }
            if (diffHrs < 24) { return `vor ${diffHrs} Std.`; }
            if (diffDays < 7) { return `vor ${diffDays} Tag${diffDays > 1 ? 'en' : ''}`; }
            return this._formatDate(timeStr);
        } catch (e) {
            return '';
        }
    }
}

// Register as global service
window.dashboardWidgetService = new DashboardWidgetService();
