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
            { id: 'quick-chart', name: 'Umsatz-Chart', category: 'charts', size: 'large', icon: '\u{1F4CA}' },
            { id: 'morning-briefing', name: 'Tagesbriefing', category: 'feed', size: 'large', icon: '\u2600\uFE0F' },
            { id: 'team-status', name: 'Team-Status', category: 'schedule', size: 'medium', icon: '\u{1F465}' },
            { id: 'conversion-rate', name: 'Conversion-Rate', category: 'sales', size: 'small', icon: '\u{1F4C9}' },
            { id: 'cashflow-forecast', name: 'Cashflow-Prognose', category: 'finance', size: 'large', icon: '\u{1F52E}' },
            { id: 'overdue-tasks', name: 'Offene Aufgaben', category: 'schedule', size: 'medium', icon: '\u2705' },
            { id: 'social-media', name: 'Social Media', category: 'social', size: 'medium', icon: '\u{1F4F1}' },
            { id: 'euer-live', name: 'E\u00DCR Live', category: 'finance', size: 'large', icon: '\u00A7' },
            { id: 'paperless-recent', name: 'Letzte Dokumente', category: 'dokumente', size: 'medium', icon: '\u{1F4C4}' },
            { id: 'calcom-next', name: 'N\u00E4chste Termine', category: 'termine', size: 'small', icon: '\u{1F4C5}' }
        ];

        // Default layout matching the current static dashboard
        this.defaultLayout = [
            { widgetId: 'kpi-anfragen', order: 0 },
            { widgetId: 'kpi-angebote', order: 1 },
            { widgetId: 'kpi-auftraege', order: 2 },
            { widgetId: 'kpi-rechnungen', order: 3 },
            { widgetId: 'activity-feed', order: 4 },
            { widgetId: 'paperless-recent', order: 5 },
            { widgetId: 'calcom-next', order: 6 }
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
            charts: 'Diagramme',
            social: 'Social Media',
            dokumente: 'Dokumente',
            termine: 'Termine'
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
     * @returns {Object|Promise<Object>} Widget data (varies by type; cashflow-forecast returns a Promise)
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
                case 'morning-briefing':
                    return this._getMorningBriefing(state);
                case 'team-status':
                    return this._getTeamStatus();
                case 'conversion-rate':
                    return this._getConversionRate(state);
                case 'cashflow-forecast':
                    // Async: gibt Promise zurueck — Aufrufer muss await/then verwenden
                    return this._getCashflowForecast();
                case 'overdue-tasks':
                    return this._getOverdueTasks(state);
                case 'social-media':
                    return this._getSocialMediaPosts();
                case 'euer-live':
                    return this._getEuerLive(state);
                case 'paperless-recent':
                    return this._getPaperlessRecent();
                case 'calcom-next':
                    return this._getCalcomNext();
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
            } catch {
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

    // --- New widget data providers ---

    _getMorningBriefing(state) {
        if (window.morningBriefingService) {
            try {
                const briefing = window.morningBriefingService.getCachedBriefing();
                if (briefing) {
                    return {
                        type: 'briefing',
                        greeting: briefing.greeting,
                        summary: briefing.summary,
                        alerts: briefing.alerts || [],
                        recommendations: briefing.recommendations || [],
                        generatedAt: briefing.generatedAt
                    };
                }
            } catch { /* fall through */ }
        }
        // Fallback: basic summary
        const rechnungen = state.rechnungen || [];
        const anfragen = state.anfragen || [];
        const openInvoices = rechnungen.filter(r => r.status === 'offen').length;
        const newInquiries = anfragen.filter(a => a.status === 'neu').length;
        return {
            type: 'briefing',
            greeting: 'Guten Morgen!',
            summary: {
                overdueInvoices: { count: rechnungen.filter(r => r.status !== 'bezahlt' && r.faelligkeitsdatum && new Date(r.faelligkeitsdatum) < new Date()).length },
                newInquiries: { count: newInquiries },
                openInvoices: { count: openInvoices }
            },
            alerts: [],
            generatedAt: new Date().toISOString()
        };
    }

    _getTeamStatus() {
        if (!window.teamManagementService?.hasTeam()) {
            return { type: 'list', items: [], emptyMessage: 'Kein Team eingerichtet.' };
        }
        try {
            const schedule = window.teamManagementService.getTeamSchedule();
            return {
                type: 'list',
                items: schedule.map(s => ({
                    icon: s.roleIcon,
                    title: s.memberName,
                    subTitle: `${s.roleLabel} \u2022 ${s.isClockedIn ? 'Eingestempelt' : 'Nicht aktiv'}`,
                    status: s.isClockedIn ? 'active' : 'inactive',
                    hoursToday: Math.round(s.totalHoursToday * 10) / 10,
                    activeJobs: s.activeJobs.length
                })),
                emptyMessage: 'Kein Team eingerichtet.'
            };
        } catch {
            return { type: 'list', items: [], emptyMessage: 'Team-Daten nicht verf\u00FCgbar.' };
        }
    }

    _getConversionRate(state) {
        const anfragen = state.anfragen || [];
        const angebote = state.angebote || [];
        const auftraege = state.auftraege || [];
        const totalAnfragen = anfragen.length || 1;
        const totalAngebote = angebote.length;
        const totalAuftraege = auftraege.length;
        const anfrageToAngebot = Math.round((totalAngebote / totalAnfragen) * 100);
        const angebotToAuftrag = totalAngebote ? Math.round((totalAuftraege / totalAngebote) * 100) : 0;
        return {
            type: 'kpi',
            value: `${angebotToAuftrag}%`,
            label: 'Angebot \u2192 Auftrag',
            subValue: `Anfrage \u2192 Angebot: ${anfrageToAngebot}%`,
            isFormattedValue: true
        };
    }

    async _getCashflowForecast() {
        // KI-Prognose aus Supabase via cashflow-forecast-service
        if (window.cashflowForecastService) {
            try {
                const data = await window.cashflowForecastService.getWidgetData();
                return data;
            } catch (err) {
                console.error('DashboardWidgetService: CashflowForecast-Fehler:', err);
            }
        }
        // Fallback auf lokalen cashFlowService (alte Logik)
        if (!window.cashFlowService) {
            return { type: 'cashflow-ai', hasData: false, message: 'cashflow-forecast-service nicht geladen.' };
        }
        try {
            const forecasts = window.cashFlowService.generateForecast(6);
            return {
                type: 'chart',
                title: 'Cashflow-Prognose (6 Monate)',
                data: forecasts.map(f => ({
                    label: f.month.split(' ')[0].substring(0, 3),
                    value: f.projectedBalance,
                    status: f.status
                })),
                maxValue: Math.max(...forecasts.map(f => Math.abs(f.projectedBalance)), 1000)
            };
        } catch {
            return { type: 'cashflow-ai', hasData: false, message: 'Keine Prognose verfuegbar.' };
        }
    }

    _getOverdueTasks(state) {
        const aufgaben = state.aufgaben || state.tasks || [];
        const overdue = aufgaben.filter(t => {
            if (t.status === 'erledigt' || t.status === 'done') { return false; }
            if (!t.dueDate && !t.faelligkeitsdatum) { return false; }
            const due = new Date(t.dueDate || t.faelligkeitsdatum);
            return !isNaN(due.getTime()) && due < new Date();
        });
        return {
            type: 'list',
            items: overdue.slice(0, 8).map(t => ({
                icon: '\u2705',
                title: t.title || t.titel || 'Aufgabe',
                subTitle: t.priority || t.prioritaet || '',
                time: t.dueDate || t.faelligkeitsdatum,
                timeFormatted: `F\u00E4llig: ${this._formatDate(t.dueDate || t.faelligkeitsdatum)}`,
                status: 'danger'
            })),
            emptyMessage: 'Keine \u00FCberf\u00E4lligen Aufgaben.'
        };
    }

    // --- Social Media (Postiz) data provider ---

    async _getSocialMediaPosts() {
        const cfg = window.APP_CONFIG || {};
        const baseUrl = cfg.POSTIZ_URL || 'https://social.freyaivisions.de';
        const apiKey = cfg.POSTIZ_API_KEY || '';

        if (!apiKey) {
            return { type: 'list', items: [], emptyMessage: 'Postiz API-Key nicht konfiguriert.' };
        }

        try {
            const resp = await fetch(`${baseUrl}/api/posts`, {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Accept': 'application/json'
                }
            });

            if (!resp.ok) {
                console.warn('DashboardWidgetService: Postiz API Fehler:', resp.status);
                return { type: 'list', items: [], emptyMessage: 'Postiz nicht erreichbar.' };
            }

            const posts = await resp.json();
            const now = new Date();

            // Filter scheduled (future) posts, sort ascending by date
            const scheduled = (Array.isArray(posts) ? posts : [])
                .filter(p => {
                    const pubDate = new Date(p.publishDate || p.scheduledAt || p.createdAt);
                    return pubDate > now || (p.state || p.status) === 'SCHEDULED';
                })
                .sort((a, b) => new Date(a.publishDate || a.scheduledAt || a.createdAt) - new Date(b.publishDate || b.scheduledAt || b.createdAt))
                .slice(0, 5);

            return {
                type: 'list',
                items: scheduled.map(p => {
                    const pubDate = p.publishDate || p.scheduledAt || p.createdAt;
                    const content = p.content || p.text || p.description || '';
                    const preview = content.length > 60 ? content.substring(0, 57) + '...' : content;
                    return {
                        icon: '\u{1F4F1}',
                        title: preview || 'Geplanter Beitrag',
                        subTitle: (p.integration?.name || p.platform || ''),
                        time: pubDate,
                        timeFormatted: this._formatDate(pubDate) + ' ' + this._formatTime(pubDate)
                    };
                }),
                emptyMessage: 'Keine geplanten Beitr\u00E4ge.',
                externalLink: baseUrl,
                externalLinkLabel: 'Postiz \u00F6ffnen'
            };
        } catch (err) {
            console.error('DashboardWidgetService: Postiz-Fehler:', err);
            return { type: 'list', items: [], emptyMessage: 'Fehler beim Laden der Social-Media-Daten.' };
        }
    }

    // --- E\u00DCR Live data provider ---

    _getEuerLive(state) {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentQuarter = Math.floor(now.getMonth() / 3) + 1;
        const quarterLabels = ['Q1', 'Q2', 'Q3', 'Q4'];

        // --- Buchungen aus bookkeepingService ---
        let einnahmenYTD = 0;
        let ausgabenYTD = 0;
        let einnahmenQuartal = 0;
        let ausgabenQuartal = 0;
        let kleinunternehmer = true;
        let eurData = null;

        if (window.bookkeepingService && window.bookkeepingService._ready) {
            const bs = window.bookkeepingService;
            kleinunternehmer = bs.einstellungen?.kleinunternehmer !== false;

            // E\u00DCR-Berechnung fuer das aktuelle Jahr
            eurData = bs.berechneEUR(currentYear);
            einnahmenYTD = eurData.einnahmen.brutto;
            ausgabenYTD = eurData.ausgabenGesamt.brutto;

            // Quartals-Buchungen
            const quartalsBuchungen = bs.buchungen.filter(b => {
                const d = new Date(b.datum);
                return d.getFullYear() === currentYear &&
                       Math.floor(d.getMonth() / 3) + 1 === currentQuarter;
            });
            einnahmenQuartal = quartalsBuchungen
                .filter(b => b.typ === 'einnahme')
                .reduce((sum, b) => sum + (b.brutto || 0), 0);
            ausgabenQuartal = quartalsBuchungen
                .filter(b => b.typ === 'ausgabe')
                .reduce((sum, b) => sum + (b.brutto || 0), 0);
        } else {
            // Fallback: aus State (Rechnungen) berechnen
            const rechnungen = state.rechnungen || [];
            einnahmenYTD = rechnungen
                .filter(r => r.status === 'bezahlt' && r.paidAt)
                .filter(r => new Date(r.paidAt).getFullYear() === currentYear)
                .reduce((sum, r) => sum + (r.brutto || 0), 0);
        }

        const gewinn = einnahmenYTD - ausgabenYTD;

        // --- Steuer-Ruecklage ---
        // ESt ~25% vom Gewinn (wenn positiv)
        let steuerRuecklage = 0;
        if (gewinn > 0) {
            // ESt-Anteil (~25%)
            steuerRuecklage = gewinn * 0.25;
            // USt-Zahllast (nur wenn kein Kleinunternehmer)
            if (!kleinunternehmer && eurData) {
                steuerRuecklage += Math.max(0, eurData.ustZahllast || 0);
            }
        }

        // --- Offene Forderungen (unbezahlte ausgehende Rechnungen) ---
        const rechnungen = state.rechnungen || [];
        const offeneForderungen = rechnungen
            .filter(r => r.status === 'offen')
            .reduce((sum, r) => sum + (r.brutto || 0), 0);

        // --- Offene Verbindlichkeiten (unbezahlte Eingangsrechnungen / POs) ---
        let offeneVerbindlichkeiten = 0;
        if (window.purchaseOrderService) {
            try {
                const pos = window.purchaseOrderService.getAllPOs();
                offeneVerbindlichkeiten = pos
                    .filter(po => ['bestellt', 'teillieferung', 'geliefert'].includes(po.status))
                    .reduce((sum, po) => sum + (po.brutto || 0), 0);
            } catch { /* ignore */ }
        }

        return {
            type: 'euer-live',
            jahr: currentYear,
            einnahmenYTD,
            ausgabenYTD,
            gewinn,
            quartal: {
                label: quarterLabels[currentQuarter - 1],
                einnahmen: einnahmenQuartal,
                ausgaben: ausgabenQuartal
            },
            steuerRuecklage,
            kleinunternehmer,
            offeneForderungen,
            offeneVerbindlichkeiten
        };
    }

    // --- Paperless-ngx data provider ---

    async _getPaperlessRecent() {
        if (!window.documentService || typeof window.documentService.paperlessListDocuments !== 'function') {
            return { type: 'list', items: [], emptyMessage: 'Paperless-Service nicht verf\u00FCgbar.' };
        }

        try {
            const docs = await window.documentService.paperlessListDocuments({ page_size: 5, ordering: '-created' });
            const results = Array.isArray(docs) ? docs : (docs?.results || []);
            const paperlessUrl = localStorage.getItem('freyai_paperless_url') || '';

            return {
                type: 'list',
                items: results.slice(0, 5).map(doc => {
                    const typeIcon = doc.document_type ? '\u{1F4C1}' : '\u{1F4C4}';
                    const created = doc.created || doc.added || '';
                    return {
                        icon: typeIcon,
                        title: doc.title || 'Unbenanntes Dokument',
                        subTitle: doc.correspondent_name || doc.correspondent || '',
                        time: created,
                        timeFormatted: created ? this._formatDate(created) : '',
                        externalLink: paperlessUrl ? `${paperlessUrl}/documents/${doc.id}/details` : null
                    };
                }),
                emptyMessage: 'Keine Dokumente in Paperless.',
                externalLink: paperlessUrl || null,
                externalLinkLabel: 'Paperless \u00F6ffnen'
            };
        } catch (err) {
            console.error('DashboardWidgetService: Paperless-Fehler:', err);
            return { type: 'list', items: [], emptyMessage: 'Fehler beim Laden der Dokumente.' };
        }
    }

    // --- Cal.com data provider ---

    async _getCalcomNext() {
        if (!window.bookingService || typeof window.bookingService.fetchCalcomBookings !== 'function') {
            return { type: 'list', items: [], emptyMessage: 'Buchungsservice nicht verf\u00FCgbar.' };
        }

        try {
            const bookings = await window.bookingService.fetchCalcomBookings();
            const now = new Date();

            // Filter future bookings, sort ascending
            const upcoming = (Array.isArray(bookings) ? bookings : [])
                .filter(b => {
                    const start = new Date(b.startTime || b.start || b.date);
                    return !isNaN(start.getTime()) && start >= now;
                })
                .sort((a, b) => new Date(a.startTime || a.start || a.date) - new Date(b.startTime || b.start || b.date))
                .slice(0, 3);

            return {
                type: 'list',
                items: upcoming.map(b => {
                    const startDate = b.startTime || b.start || b.date || '';
                    const customerName = b.attendees?.[0]?.name || b.attendeeName || b.name || 'Unbekannt';
                    const eventType = b.eventType?.title || b.title || b.type || '';
                    return {
                        icon: '\u{1F4C5}',
                        title: customerName,
                        subTitle: eventType,
                        time: startDate,
                        timeFormatted: startDate ? (this._formatDate(startDate) + ' ' + this._formatTime(startDate)) : ''
                    };
                }),
                emptyMessage: 'Keine anstehenden Buchungen.'
            };
        } catch (err) {
            console.error('DashboardWidgetService: Cal.com-Fehler:', err);
            return { type: 'list', items: [], emptyMessage: 'Fehler beim Laden der Termine.' };
        }
    }

    /**
     * Format time portion of an ISO date string.
     * @param {string} dateStr
     * @returns {string} e.g. "14:30"
     * @private
     */
    _formatTime(dateStr) {
        try {
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) { return ''; }
            return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
        } catch { return ''; }
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
        } catch {
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
        } catch {
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
            } catch {
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
        } catch {
            return '';
        }
    }
}

// Register as global service
window.dashboardWidgetService = new DashboardWidgetService();
