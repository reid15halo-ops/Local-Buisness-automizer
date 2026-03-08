/* ============================================
   KPI Alert Service
   Schwellwert-basierte Warnungen fuer das Dashboard.
   Prueft ueberfaellige Rechnungen, Cashflow, Angebote,
   offene Tickets und nicht gelieferte Bestellungen.
   ============================================ */

class KpiAlertService {
    constructor() {
        this._cache = null;
        this._cacheTime = 0;
        this._cacheTTL = 5 * 60 * 1000; // 5 Minuten
        this._tenantId = 'a0000000-0000-0000-0000-000000000001';
    }

    async init() {
        // Nichts zu initialisieren — Daten werden lazy geladen
    }

    /**
     * Gibt den Supabase-Client zurueck oder null.
     * @returns {Object|null}
     * @private
     */
    _getClient() {
        // Primaer: SupabaseClientService (supabase-client.js)
        if (window.supabaseClient && window.supabaseClient.client) {
            return window.supabaseClient.client;
        }
        // Fallback: supabaseConfig (supabase-db-service.js Pattern)
        if (window.supabaseConfig && typeof window.supabaseConfig.get === 'function') {
            return window.supabaseConfig.get();
        }
        return null;
    }

    /**
     * Escape-Funktion fuer HTML-Ausgabe (XSS-Schutz).
     * @param {string} str
     * @returns {string}
     * @private
     */
    _esc(str) {
        if (typeof window.esc === 'function') {
            return window.esc(str);
        }
        if (!str) {return '';}
        const div = document.createElement('div');
        div.textContent = String(str);
        return div.innerHTML;
    }

    /**
     * Liefert alle KPI-Alerts. Nutzt einen 5-Minuten-Cache.
     * @param {boolean} [forceRefresh=false] - Cache ignorieren
     * @returns {Promise<Array<{type: string, message: string, count: number, action: string}>>}
     */
    async getAlerts(forceRefresh = false) {
        const now = Date.now();
        if (!forceRefresh && this._cache && (now - this._cacheTime) < this._cacheTTL) {
            return this._cache;
        }

        const client = this._getClient();
        if (!client) {
            // Fallback: Daten aus dem lokalen Store lesen
            return this._getAlertsFromStore();
        }

        const today = new Date().toISOString().split('T')[0];

        const results = await Promise.allSettled([
            this._checkOverdueInvoices(client, today),
            this._checkCashflow(client, today),
            this._checkStaleOffers(client, today),
            this._checkOpenTickets(client),
            this._checkUndeliveredPOs(client, today)
        ]);

        const alerts = [];
        for (const result of results) {
            if (result.status === 'fulfilled' && result.value) {
                alerts.push(result.value);
            }
        }

        this._cache = alerts;
        this._cacheTime = now;
        return alerts;
    }

    /**
     * Cache leeren (z.B. nach Datenänderung).
     */
    invalidateCache() {
        this._cache = null;
        this._cacheTime = 0;
    }

    // ============================================
    // Einzelne Alert-Checks (Supabase)
    // ============================================

    /**
     * 1. Ueberfaellige Rechnungen
     */
    async _checkOverdueInvoices(client, today) {
        try {
            const { data, error, count } = await client
                .from('rechnungen')
                .select('id', { count: 'exact', head: true })
                .eq('tenant_id', this._tenantId)
                .neq('status', 'bezahlt')
                .lt('faelligkeitsdatum', today);

            if (error) {throw error;}
            const n = count || 0;
            if (n === 0) {return null;}

            return {
                type: 'danger',
                message: `${n} Rechnung${n > 1 ? 'en' : ''} ueberfaellig`,
                count: n,
                action: 'rechnungen'
            };
        } catch (err) {
            console.warn('[KpiAlertService] Ueberfaellige Rechnungen Fehler:', err.message);
            return null;
        }
    }

    /**
     * 2. Cashflow unter Schwellwert in 14 Tagen
     */
    async _checkCashflow(client, today) {
        try {
            const in14Days = new Date();
            in14Days.setDate(in14Days.getDate() + 14);
            const targetDate = in14Days.toISOString().split('T')[0];

            const { data, error } = await client
                .from('cashflow_forecasts')
                .select('projected_balance')
                .eq('tenant_id', this._tenantId)
                .gte('forecast_date', today)
                .lte('forecast_date', targetDate)
                .order('forecast_date', { ascending: false })
                .limit(1);

            if (error) {throw error;}
            if (!data || data.length === 0) {return null;}

            const balance = data[0].projected_balance;
            if (typeof balance !== 'number') {return null;}

            // Schwellwert: Warnung unter 5000 EUR, Gefahr unter 1000 EUR
            if (balance >= 5000) {return null;}

            const type = balance < 1000 ? 'danger' : 'warning';
            const formatted = balance.toLocaleString('de-DE', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });

            return {
                type,
                message: `Cashflow unter ${formatted} EUR in 14 Tagen`,
                count: 1,
                action: 'dashboard'
            };
        } catch (err) {
            console.warn('[KpiAlertService] Cashflow Fehler:', err.message);
            return null;
        }
    }

    /**
     * 3. Angebote seit 7 Tagen ohne Antwort
     */
    async _checkStaleOffers(client, today) {
        try {
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            const cutoff = sevenDaysAgo.toISOString().split('T')[0];

            const { data, error, count } = await client
                .from('angebote')
                .select('id', { count: 'exact', head: true })
                .eq('tenant_id', this._tenantId)
                .eq('status', 'gesendet')
                .lt('datum', cutoff);

            if (error) {throw error;}
            const n = count || 0;
            if (n === 0) {return null;}

            return {
                type: 'warning',
                message: `${n} Angebot${n > 1 ? 'e' : ''} seit 7 Tagen ohne Antwort`,
                count: n,
                action: 'angebote'
            };
        } catch (err) {
            console.warn('[KpiAlertService] Angebote Fehler:', err.message);
            return null;
        }
    }

    /**
     * 4. Offene Support-Tickets
     */
    async _checkOpenTickets(client) {
        try {
            const { data, error, count } = await client
                .from('support_tickets')
                .select('id', { count: 'exact', head: true })
                .eq('tenant_id', this._tenantId)
                .neq('status', 'geloest');

            if (error) {throw error;}
            const n = count || 0;
            if (n === 0) {return null;}

            return {
                type: 'info',
                message: `${n} offene${n > 1 ? '' : 's'} Ticket${n > 1 ? 's' : ''}`,
                count: n,
                action: 'support'
            };
        } catch (err) {
            console.warn('[KpiAlertService] Tickets Fehler:', err.message);
            return null;
        }
    }

    /**
     * 5. Nicht gelieferte Bestellungen (> 14 Tage)
     */
    async _checkUndeliveredPOs(client, today) {
        try {
            const fourteenDaysAgo = new Date();
            fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
            const cutoff = fourteenDaysAgo.toISOString().split('T')[0];

            const { data, error, count } = await client
                .from('purchase_orders')
                .select('id', { count: 'exact', head: true })
                .eq('tenant_id', this._tenantId)
                .eq('status', 'bestellt')
                .lt('bestelldatum', cutoff);

            if (error) {throw error;}
            const n = count || 0;
            if (n === 0) {return null;}

            return {
                type: 'warning',
                message: `${n} Bestellung${n > 1 ? 'en' : ''} seit 14 Tagen nicht geliefert`,
                count: n,
                action: 'bestellungen'
            };
        } catch (err) {
            console.warn('[KpiAlertService] POs Fehler:', err.message);
            return null;
        }
    }

    // ============================================
    // Fallback: Lokaler Store (offline)
    // ============================================

    /**
     * Liest Alerts aus dem lokalen storeService (offline-Modus).
     * @returns {Array}
     * @private
     */
    _getAlertsFromStore() {
        const alerts = [];
        const store = window.storeService?.store;
        if (!store) {return alerts;}

        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];

        // 1. Ueberfaellige Rechnungen
        if (Array.isArray(store.rechnungen)) {
            const overdue = store.rechnungen.filter(r =>
                r.status !== 'bezahlt' && r.faelligkeitsdatum && r.faelligkeitsdatum < todayStr
            );
            if (overdue.length > 0) {
                alerts.push({
                    type: 'danger',
                    message: `${overdue.length} Rechnung${overdue.length > 1 ? 'en' : ''} ueberfaellig`,
                    count: overdue.length,
                    action: 'rechnungen'
                });
            }
        }

        // 3. Angebote ohne Antwort
        if (Array.isArray(store.angebote)) {
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            const cutoff = sevenDaysAgo.toISOString().split('T')[0];

            const stale = store.angebote.filter(a =>
                a.status === 'gesendet' && a.datum && a.datum < cutoff
            );
            if (stale.length > 0) {
                alerts.push({
                    type: 'warning',
                    message: `${stale.length} Angebot${stale.length > 1 ? 'e' : ''} seit 7 Tagen ohne Antwort`,
                    count: stale.length,
                    action: 'angebote'
                });
            }
        }

        this._cache = alerts;
        this._cacheTime = Date.now();
        return alerts;
    }
}

// Globale Instanz registrieren
window.kpiAlertService = new KpiAlertService();
