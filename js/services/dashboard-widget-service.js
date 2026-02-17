/* ============================================
   Dashboard Widget Service
   Manages widget configuration, ordering,
   and data providers for the customizable dashboard.
   Storage key: mhs_dashboard_widgets
   ============================================ */

class DashboardWidgetService {
    constructor() {
        this.STORAGE_KEY = 'mhs_dashboard_widgets';

        /**
         * Registry of all available widget types with metadata.
         * Each entry defines the widget's default config and description.
         */
        this.widgetRegistry = [
            {
                id: 'stat-cards',
                type: 'stat-cards',
                title: 'Statistik-Karten',
                description: 'Offene Anfragen, Angebote, Auftraege, Rechnungen',
                icon: '📊',
                defaultSize: 'full',
                defaultEnabled: true,
                defaultOrder: 0
            },
            {
                id: 'priority-actions',
                type: 'priority-actions',
                title: 'Was steht an?',
                description: 'Priorisierte Aufgaben und dringende Aktionen',
                icon: '❓',
                defaultSize: 'large',
                defaultEnabled: true,
                defaultOrder: 1
            },
            {
                id: 'recent-activities',
                type: 'recent-activities',
                title: 'Letzte Aktivitaeten',
                description: 'Die letzten 10 Aktivitaeten im System',
                icon: '🕐',
                defaultSize: 'medium',
                defaultEnabled: true,
                defaultOrder: 2
            },
            {
                id: 'revenue-chart',
                type: 'revenue-chart',
                title: 'Umsatz-Diagramm',
                description: 'Monatlicher Umsatz der letzten 6 Monate',
                icon: '📈',
                defaultSize: 'large',
                defaultEnabled: true,
                defaultOrder: 3
            },
            {
                id: 'pipeline',
                type: 'pipeline',
                title: 'Workflow-Pipeline',
                description: 'Anfrage → Angebot → Auftrag → Rechnung',
                icon: '🔄',
                defaultSize: 'full',
                defaultEnabled: true,
                defaultOrder: 4
            },
            {
                id: 'calendar-upcoming',
                type: 'calendar-upcoming',
                title: 'Naechste Termine',
                description: 'Die naechsten 5 Termine und Fristen',
                icon: '📅',
                defaultSize: 'medium',
                defaultEnabled: false,
                defaultOrder: 5
            },
            {
                id: 'overdue-invoices',
                type: 'overdue-invoices',
                title: 'Ueberfaellige Rechnungen',
                description: 'Liste ueberfaelliger Rechnungen mit Betraegen',
                icon: '⚠️',
                defaultSize: 'medium',
                defaultEnabled: false,
                defaultOrder: 6
            },
            {
                id: 'team-status',
                type: 'team-status',
                title: 'Team-Status',
                description: 'Verfuegbarkeit der Teammitglieder',
                icon: '👥',
                defaultSize: 'medium',
                defaultEnabled: false,
                defaultOrder: 7
            },
            {
                id: 'weather',
                type: 'weather',
                title: 'Wetter',
                description: 'Aktuelle Wetterdaten am Standort',
                icon: '🌤️',
                defaultSize: 'small',
                defaultEnabled: false,
                defaultOrder: 8
            },
            {
                id: 'quick-notes',
                type: 'quick-notes',
                title: 'Schnellnotizen',
                description: 'Notizblock fuer schnelle Memos',
                icon: '📝',
                defaultSize: 'medium',
                defaultEnabled: false,
                defaultOrder: 9
            }
        ];

        // Load user config from localStorage
        this.widgetConfigs = this._loadConfigs();
    }

    // ============================================
    // Config Persistence
    // ============================================

    /**
     * Load widget configs from localStorage.
     * If none exist, generate defaults from the registry.
     * @returns {Array<WidgetConfig>}
     * @private
     */
    _loadConfigs() {
        try {
            const raw = localStorage.getItem(this.STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    // Merge with registry to pick up any new widgets added after save
                    return this._mergeWithRegistry(parsed);
                }
            }
        } catch (e) {
            console.warn('DashboardWidgetService: Failed to load configs, using defaults.', e);
        }
        return this._getDefaultConfigs();
    }

    /**
     * Build the default widget config array from the registry.
     * @returns {Array<WidgetConfig>}
     * @private
     */
    _getDefaultConfigs() {
        return this.widgetRegistry.map(w => ({
            id: w.id,
            type: w.type,
            title: w.title,
            enabled: w.defaultEnabled,
            order: w.defaultOrder,
            size: w.defaultSize,
            settings: {}
        }));
    }

    /**
     * Merge saved configs with current registry so newly added widgets appear.
     * @param {Array<WidgetConfig>} saved
     * @returns {Array<WidgetConfig>}
     * @private
     */
    _mergeWithRegistry(saved) {
        const savedMap = {};
        saved.forEach(c => { savedMap[c.id] = c; });

        const merged = [];

        // Keep all saved configs in their order
        saved.forEach(c => {
            // Make sure the widget still exists in registry
            const reg = this.widgetRegistry.find(r => r.id === c.id);
            if (reg) {
                merged.push({
                    id: c.id,
                    type: c.type || reg.type,
                    title: c.title || reg.title,
                    enabled: typeof c.enabled === 'boolean' ? c.enabled : reg.defaultEnabled,
                    order: typeof c.order === 'number' ? c.order : reg.defaultOrder,
                    size: c.size || reg.defaultSize,
                    settings: c.settings || {}
                });
            }
        });

        // Add any new registry entries that aren't in saved data
        this.widgetRegistry.forEach(reg => {
            if (!savedMap[reg.id]) {
                merged.push({
                    id: reg.id,
                    type: reg.type,
                    title: reg.title,
                    enabled: false, // new widgets default to disabled
                    order: merged.length,
                    size: reg.defaultSize,
                    settings: {}
                });
            }
        });

        return merged;
    }

    /**
     * Save current widget configs to localStorage.
     * @private
     */
    _saveConfigs() {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.widgetConfigs));
        } catch (e) {
            console.error('DashboardWidgetService: Failed to save configs.', e);
        }
    }

    // ============================================
    // Public API
    // ============================================

    /**
     * Get all available widget types with metadata from the registry.
     * Includes current enabled/order state from user config.
     * @returns {Array<Object>}
     */
    getAvailableWidgets() {
        return this.widgetRegistry.map(reg => {
            const config = this.widgetConfigs.find(c => c.id === reg.id);
            return {
                ...reg,
                enabled: config ? config.enabled : reg.defaultEnabled,
                order: config ? config.order : reg.defaultOrder,
                size: config ? config.size : reg.defaultSize,
                settings: config ? config.settings : {}
            };
        });
    }

    /**
     * Get the user's enabled widgets, sorted by order.
     * @returns {Array<WidgetConfig>}
     */
    getActiveWidgets() {
        return this.widgetConfigs
            .filter(c => c.enabled)
            .sort((a, b) => a.order - b.order);
    }

    /**
     * Get a single widget's config by ID.
     * @param {string} widgetId
     * @returns {WidgetConfig|null}
     */
    getWidgetConfig(widgetId) {
        return this.widgetConfigs.find(c => c.id === widgetId) || null;
    }

    /**
     * Enable a widget.
     * @param {string} widgetId
     */
    enableWidget(widgetId) {
        const config = this.widgetConfigs.find(c => c.id === widgetId);
        if (config) {
            config.enabled = true;
            // Place at end of active list
            const maxOrder = Math.max(...this.widgetConfigs.filter(c => c.enabled).map(c => c.order), -1);
            config.order = maxOrder + 1;
            this._saveConfigs();
        }
    }

    /**
     * Disable a widget.
     * @param {string} widgetId
     */
    disableWidget(widgetId) {
        const config = this.widgetConfigs.find(c => c.id === widgetId);
        if (config) {
            config.enabled = false;
            this._saveConfigs();
        }
    }

    /**
     * Reorder widgets by providing an array of widget IDs in new order.
     * @param {Array<string>} widgetIds - ordered list of widget IDs
     */
    reorderWidgets(widgetIds) {
        widgetIds.forEach((id, index) => {
            const config = this.widgetConfigs.find(c => c.id === id);
            if (config) {
                config.order = index;
            }
        });
        this._saveConfigs();
    }

    /**
     * Update widget-specific settings.
     * @param {string} widgetId
     * @param {Object} settings - partial settings to merge
     */
    updateWidgetSettings(widgetId, settings) {
        const config = this.widgetConfigs.find(c => c.id === widgetId);
        if (config) {
            config.settings = { ...config.settings, ...settings };
            this._saveConfigs();
        }
    }

    /**
     * Reset all widget configs to defaults.
     */
    resetToDefault() {
        this.widgetConfigs = this._getDefaultConfigs();
        this._saveConfigs();
    }

    // ============================================
    // Widget Data Providers
    // ============================================

    /**
     * Get data for a specific widget to render.
     * Each widget type has its own data-fetching logic.
     * @param {string} widgetId
     * @returns {Object} data payload for the widget renderer
     */
    getWidgetData(widgetId) {
        const state = window.storeService ? window.storeService.state : null;
        if (!state) {
            return { error: 'Store nicht verfuegbar' };
        }

        switch (widgetId) {
        case 'stat-cards':
            return this._getStatCardsData(state);
        case 'priority-actions':
            return this._getPriorityActionsData(state);
        case 'recent-activities':
            return this._getRecentActivitiesData(state);
        case 'revenue-chart':
            return this._getRevenueChartData(state);
        case 'pipeline':
            return this._getPipelineData(state);
        case 'calendar-upcoming':
            return this._getCalendarUpcomingData();
        case 'overdue-invoices':
            return this._getOverdueInvoicesData(state);
        case 'team-status':
            return this._getTeamStatusData();
        case 'weather':
            return this._getWeatherData();
        case 'quick-notes':
            return this._getQuickNotesData();
        default:
            return { error: 'Unbekannter Widget-Typ' };
        }
    }

    // ============================================
    // Individual Data Providers
    // ============================================

    /**
     * Stat cards: counts of open items in each category.
     * @private
     */
    _getStatCardsData(state) {
        return {
            anfragen: (state.anfragen || []).filter(a => a.status === 'neu').length,
            angebote: (state.angebote || []).filter(a => a.status === 'offen' || a.status === 'entwurf').length,
            auftraege: (state.auftraege || []).filter(a => a.status !== 'abgeschlossen').length,
            rechnungen: (state.rechnungen || []).filter(r => r.status === 'offen' || r.status === 'versendet').length
        };
    }

    /**
     * Priority actions: delegate to ActivityIndicatorService if available.
     * @private
     */
    _getPriorityActionsData(state) {
        if (window.activityIndicatorService && typeof window.activityIndicatorService.generatePriorityActions === 'function') {
            return {
                actions: window.activityIndicatorService.generatePriorityActions(state)
            };
        }

        // Fallback: generate minimal priority items
        const actions = [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Overdue invoices
        const overdue = (state.rechnungen || []).filter(r => {
            if (r.status === 'bezahlt' || r.status === 'storniert') { return false; }
            if (r.status === 'ueberfaellig') { return true; }
            if (r.zahlungsziel) {
                const d = new Date(r.zahlungsziel);
                d.setHours(0, 0, 0, 0);
                return d < today;
            }
            return false;
        });

        if (overdue.length > 0) {
            actions.push({
                icon: '🔴',
                text: `${overdue.length} Rechnung(en) ueberfaellig`,
                detail: overdue[0].kunde ? overdue[0].kunde.name : '',
                severity: 'danger',
                view: 'rechnungen'
            });
        }

        // New inquiries
        const newAnfragen = (state.anfragen || []).filter(a => a.status === 'neu');
        if (newAnfragen.length > 0) {
            actions.push({
                icon: '📥',
                text: `${newAnfragen.length} neue Anfrage(n)`,
                detail: '',
                severity: 'info',
                view: 'anfragen'
            });
        }

        // Draft quotes
        const drafts = (state.angebote || []).filter(a => a.status === 'entwurf');
        if (drafts.length > 0) {
            actions.push({
                icon: '📝',
                text: `${drafts.length} Angebot(e) im Entwurf`,
                detail: 'Warten auf Versand',
                severity: 'info',
                view: 'angebote'
            });
        }

        return { actions: actions.slice(0, 5) };
    }

    /**
     * Recent activities from the store.
     * @private
     */
    _getRecentActivitiesData(state) {
        const activities = (state.activities || [])
            .slice()
            .sort((a, b) => new Date(b.timestamp || b.createdAt || 0) - new Date(a.timestamp || a.createdAt || 0))
            .slice(0, 10);
        return { activities };
    }

    /**
     * Revenue chart data: last 6 months of paid invoice totals.
     * @private
     */
    _getRevenueChartData(state) {
        const monthNames = ['Jan', 'Feb', 'Maer', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
        const now = new Date();
        const months = [];

        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const month = d.getMonth();
            const year = d.getFullYear();

            const revenue = (state.rechnungen || [])
                .filter(r => {
                    if (r.status !== 'bezahlt') { return false; }
                    const paid = r.paidAt || r.bezahltAm || r.createdAt;
                    if (!paid) { return false; }
                    const paidDate = new Date(paid);
                    return paidDate.getMonth() === month && paidDate.getFullYear() === year;
                })
                .reduce((sum, r) => sum + (r.brutto || r.gesamtBrutto || 0), 0);

            months.push({
                label: monthNames[month],
                value: revenue,
                month: month,
                year: year
            });
        }

        return { months };
    }

    /**
     * Pipeline data: counts at each workflow stage.
     * @private
     */
    _getPipelineData(state) {
        return {
            stages: [
                {
                    label: 'Anfragen',
                    count: (state.anfragen || []).length,
                    icon: '📥',
                    color: '#3b82f6'
                },
                {
                    label: 'Angebote',
                    count: (state.angebote || []).length,
                    icon: '📝',
                    color: '#6366f1'
                },
                {
                    label: 'Auftraege',
                    count: (state.auftraege || []).length,
                    icon: '🔧',
                    color: '#22c55e'
                },
                {
                    label: 'Rechnungen',
                    count: (state.rechnungen || []).length,
                    icon: '💰',
                    color: '#f59e0b'
                }
            ]
        };
    }

    /**
     * Calendar upcoming: next 5 appointments/deadlines.
     * @private
     */
    _getCalendarUpcomingData() {
        const events = [];
        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];

        // Gather appointments from CalendarService
        if (window.calendarService && typeof window.calendarService.getUpcomingAppointments === 'function') {
            const upcoming = window.calendarService.getUpcomingAppointments(5);
            upcoming.forEach(apt => {
                events.push({
                    title: apt.title || 'Termin',
                    date: apt.date,
                    time: apt.startTime || '',
                    type: apt.type || 'termin',
                    customer: apt.customerName || ''
                });
            });
        } else if (window.calendarService && window.calendarService.appointments) {
            // Fallback: filter upcoming appointments manually
            const upcoming = window.calendarService.appointments
                .filter(a => a.date >= todayStr && a.status !== 'abgesagt')
                .sort((a, b) => {
                    const cmp = a.date.localeCompare(b.date);
                    if (cmp !== 0) { return cmp; }
                    return (a.startTime || '').localeCompare(b.startTime || '');
                })
                .slice(0, 5);

            upcoming.forEach(apt => {
                events.push({
                    title: apt.title || 'Termin',
                    date: apt.date,
                    time: apt.startTime || '',
                    type: apt.type || 'termin',
                    customer: apt.customerName || ''
                });
            });
        }

        // Also check order deadlines from store
        if (window.storeService && window.storeService.state) {
            const auftraege = window.storeService.state.auftraege || [];
            auftraege
                .filter(a => a.deadline && a.deadline >= todayStr && a.status !== 'abgeschlossen')
                .sort((a, b) => a.deadline.localeCompare(b.deadline))
                .slice(0, 5)
                .forEach(a => {
                    events.push({
                        title: 'Auftrag-Deadline: ' + (a.id || ''),
                        date: a.deadline,
                        time: '',
                        type: 'deadline',
                        customer: a.kunde ? a.kunde.name : ''
                    });
                });
        }

        // Sort all events and take top 5
        events.sort((a, b) => {
            const cmp = a.date.localeCompare(b.date);
            if (cmp !== 0) { return cmp; }
            return (a.time || '').localeCompare(b.time || '');
        });

        return { events: events.slice(0, 5) };
    }

    /**
     * Overdue invoices list with amounts and days overdue.
     * @private
     */
    _getOverdueInvoicesData(state) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const overdue = (state.rechnungen || [])
            .filter(r => {
                if (r.status === 'bezahlt' || r.status === 'storniert') { return false; }
                if (r.status === 'ueberfaellig') { return true; }

                let dueDate = null;
                if (r.zahlungsziel) {
                    dueDate = new Date(r.zahlungsziel);
                } else if (r.faelligkeitsdatum) {
                    dueDate = new Date(r.faelligkeitsdatum);
                } else if (r.createdAt) {
                    dueDate = new Date(r.createdAt);
                    dueDate.setDate(dueDate.getDate() + 30);
                }

                if (dueDate) {
                    dueDate.setHours(0, 0, 0, 0);
                    return dueDate < today;
                }
                return false;
            })
            .map(r => {
                let dueDate = null;
                if (r.zahlungsziel) {
                    dueDate = new Date(r.zahlungsziel);
                } else if (r.faelligkeitsdatum) {
                    dueDate = new Date(r.faelligkeitsdatum);
                } else if (r.createdAt) {
                    dueDate = new Date(r.createdAt);
                    dueDate.setDate(dueDate.getDate() + 30);
                }

                let daysOverdue = 0;
                if (dueDate) {
                    dueDate.setHours(0, 0, 0, 0);
                    daysOverdue = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));
                }

                return {
                    id: r.id || r.nummer || '',
                    customer: r.kunde ? r.kunde.name : (r.kundenName || ''),
                    amount: r.brutto || r.gesamtBrutto || 0,
                    daysOverdue: Math.max(0, daysOverdue),
                    dueDate: dueDate ? dueDate.toISOString().split('T')[0] : ''
                };
            })
            .sort((a, b) => b.daysOverdue - a.daysOverdue);

        return { invoices: overdue };
    }

    /**
     * Team status: availability of team members.
     * @private
     */
    _getTeamStatusData() {
        if (window.teamService && window.teamService.members) {
            const members = window.teamService.members.map(m => ({
                id: m.id,
                name: m.name,
                role: m.role || '',
                status: m.status || 'aktiv',
                color: m.color || '#6366f1'
            }));
            return { members };
        }
        return { members: [] };
    }

    /**
     * Weather data: returns placeholder config.
     * Actual fetching is handled by the UI layer.
     * @private
     */
    _getWeatherData() {
        const cached = localStorage.getItem('mhs_weather_cache');
        if (cached) {
            try {
                const data = JSON.parse(cached);
                // Cache is valid for 30 minutes
                if (data.timestamp && (Date.now() - data.timestamp) < 30 * 60 * 1000) {
                    return data;
                }
            } catch (e) {
                // ignore
            }
        }
        return { needsFetch: true };
    }

    /**
     * Quick notes data from localStorage.
     * @private
     */
    _getQuickNotesData() {
        const notes = localStorage.getItem('mhs_quick_notes') || '';
        return { notes };
    }
}

// Initialize and export as global singleton
window.dashboardWidgetService = new DashboardWidgetService();
