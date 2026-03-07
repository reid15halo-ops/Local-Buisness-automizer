/* ============================================
   Cashflow Forecast Service
   Laedt KI-Prognosen aus der cashflow_forecasts Supabase-Tabelle
   und stellt sie fuer das Dashboard-Widget bereit.
   ============================================ */

class CashflowForecastService {
    constructor() {
        this._cache = null;
        this._cacheAt = 0;
        this._ttl = 15 * 60 * 1000; // 15 Minuten Cache
    }

    /**
     * Ampel-Status basierend auf Betrag
     * Gruen >= 5000, Gelb >= 1000, Rot < 1000
     */
    getAmpel(betrag) {
        if (betrag >= 5000) return 'gruen';
        if (betrag >= 1000) return 'gelb';
        return 'rot';
    }

    getAmpelColor(betrag) {
        const ampel = this.getAmpel(betrag);
        return { gruen: '#22c55e', gelb: '#eab308', rot: '#ef4444' }[ampel];
    }

    getAmpelLabel(betrag) {
        const ampel = this.getAmpel(betrag);
        return { gruen: 'Gut', gelb: 'Achtung', rot: 'Kritisch' }[ampel];
    }

    /**
     * Letzte Prognose aus Supabase laden (mit Cache).
     * @returns {Promise<Object|null>}
     */
    async loadLatestForecast() {
        const now = Date.now();
        if (this._cache && now - this._cacheAt < this._ttl) {
            return this._cache;
        }

        try {
            const db = window.supabaseClient || window.supabase;
            if (!db) {
                console.warn('CashflowForecastService: kein Supabase-Client verfuegbar');
                return null;
            }

            const { data, error } = await db
                .from('cashflow_forecasts')
                .select('*')
                .order('forecast_date', { ascending: false })
                .limit(1)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    // Noch keine Prognose vorhanden
                    return null;
                }
                console.error('CashflowForecastService: Ladefehler:', error);
                return null;
            }

            this._cache = data;
            this._cacheAt = now;
            return data;
        } catch (err) {
            console.error('CashflowForecastService: Unerwarteter Fehler:', err);
            return null;
        }
    }

    /**
     * Alle Prognosen der letzten N Wochen laden (fuer Verlaufschart).
     * @param {number} wochen
     * @returns {Promise<Array>}
     */
    async loadForecastHistory(wochen = 8) {
        try {
            const db = window.supabaseClient || window.supabase;
            if (!db) return [];

            const seit = new Date();
            seit.setDate(seit.getDate() - wochen * 7);

            const { data, error } = await db
                .from('cashflow_forecasts')
                .select('forecast_date,current_balance,forecast_30d,forecast_60d,forecast_90d')
                .gte('forecast_date', seit.toISOString().split('T')[0])
                .order('forecast_date', { ascending: true });

            if (error) {
                console.error('CashflowForecastService: History-Ladefehler:', error);
                return [];
            }
            return data || [];
        } catch (err) {
            console.error('CashflowForecastService:', err);
            return [];
        }
    }

    /**
     * Cache leeren (z.B. nach manuellem Refresh).
     */
    clearCache() {
        this._cache = null;
        this._cacheAt = 0;
    }

    /**
     * Widget-Daten fuer das Dashboard aufbereiten.
     * @returns {Promise<Object>}
     */
    async getWidgetData() {
        const forecast = await this.loadLatestForecast();

        if (!forecast) {
            return {
                type: 'cashflow-ai',
                hasData: false,
                message: 'Noch keine KI-Prognose verfuegbar. Script laeuft montags um 9:00 Uhr.',
            };
        }

        const details = forecast.details || {};
        const forecastDate = new Date(forecast.forecast_date);
        const ageMs = Date.now() - forecastDate.getTime();
        const ageTage = Math.floor(ageMs / 86400000);

        return {
            type: 'cashflow-ai',
            hasData: true,
            forecastDate: forecast.forecast_date,
            ageTage,
            currentBalance: forecast.current_balance,
            forecast30d: forecast.forecast_30d,
            forecast60d: forecast.forecast_60d,
            forecast90d: forecast.forecast_90d,
            bewertung: details.bewertung || this.getAmpel(forecast.current_balance).toUpperCase(),
            analyse: details.gemini_analyse || '',
            empfehlung: details.gemini_empfehlung || '',
            offeneForderungen: details.offene_forderungen || 0,
            offeneVerbindlichkeiten: details.offene_verbindlichkeiten || 0,
            avgEinnahmen: details.avg_einnahmen || 0,
            avgAusgaben: details.avg_ausgaben || 0,
            ampel: {
                current: this.getAmpel(forecast.current_balance),
                d30: this.getAmpel(forecast.forecast_30d),
                d60: this.getAmpel(forecast.forecast_60d),
                d90: this.getAmpel(forecast.forecast_90d),
            },
        };
    }

    /**
     * HTML fuer das Dashboard-Widget rendern.
     * @returns {Promise<string>}
     */
    async renderWidget() {
        const data = await this.getWidgetData();

        if (!data.hasData) {
            return `
                <div class="cashflow-ai-widget cashflow-empty">
                    <div class="cashflow-ai-header">
                        <span class="cashflow-ai-icon">KI</span>
                        <span class="cashflow-ai-title">KI Cashflow-Prognose</span>
                    </div>
                    <div class="cashflow-ai-placeholder">
                        <p>${data.message}</p>
                    </div>
                </div>`;
        }

        const fmt = (v) => {
            const abs = Math.abs(v);
            const formatted = abs.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            return v < 0 ? `-${formatted} EUR` : `${formatted} EUR`;
        };

        const ampelBadge = (ampel, label) => {
            const colors = { gruen: '#22c55e', gelb: '#eab308', rot: '#ef4444' };
            const labels = { gruen: 'Gut', gelb: 'Achtung', rot: 'Kritisch' };
            return `<span class="cashflow-ampel cashflow-ampel-${ampel}" style="background:${colors[ampel]}20;color:${colors[ampel]};border:1px solid ${colors[ampel]}40">${labels[ampel]}</span>`;
        };

        const alterHinweis = data.ageTage > 7
            ? `<div class="cashflow-age-warn">Prognose ist ${data.ageTage} Tage alt</div>`
            : `<div class="cashflow-age-info">Stand: ${new Date(data.forecastDate).toLocaleDateString('de-DE')}</div>`;

        return `
            <div class="cashflow-ai-widget">
                <div class="cashflow-ai-header">
                    <span class="cashflow-ai-icon">KI</span>
                    <span class="cashflow-ai-title">KI Cashflow-Prognose</span>
                    ${alterHinweis}
                </div>

                <div class="cashflow-ai-current">
                    <div class="cashflow-ai-balance-label">Aktueller Stand</div>
                    <div class="cashflow-ai-balance-value" style="color:${this.getAmpelColor(data.currentBalance)}">
                        ${fmt(data.currentBalance)}
                    </div>
                    ${ampelBadge(data.ampel.current)}
                </div>

                <div class="cashflow-ai-grid">
                    <div class="cashflow-ai-period">
                        <div class="cashflow-period-label">30 Tage</div>
                        <div class="cashflow-period-value" style="color:${this.getAmpelColor(data.forecast30d)}">${fmt(data.forecast30d)}</div>
                        ${ampelBadge(data.ampel.d30)}
                    </div>
                    <div class="cashflow-ai-period">
                        <div class="cashflow-period-label">60 Tage</div>
                        <div class="cashflow-period-value" style="color:${this.getAmpelColor(data.forecast60d)}">${fmt(data.forecast60d)}</div>
                        ${ampelBadge(data.ampel.d60)}
                    </div>
                    <div class="cashflow-ai-period">
                        <div class="cashflow-period-label">90 Tage</div>
                        <div class="cashflow-period-value" style="color:${this.getAmpelColor(data.forecast90d)}">${fmt(data.forecast90d)}</div>
                        ${ampelBadge(data.ampel.d90)}
                    </div>
                </div>

                <div class="cashflow-ai-offene">
                    <span>Forderungen: <strong style="color:#22c55e">+${fmt(data.offeneForderungen)}</strong></span>
                    <span>Verbindlichkeiten: <strong style="color:#ef4444">-${fmt(data.offeneVerbindlichkeiten)}</strong></span>
                </div>

                ${data.analyse ? `
                <div class="cashflow-ai-analyse">
                    <div class="cashflow-ai-analyse-title">Analyse</div>
                    <div class="cashflow-ai-analyse-text">${data.analyse}</div>
                </div>` : ''}

                ${data.empfehlung ? `
                <div class="cashflow-ai-empfehlung">
                    <div class="cashflow-ai-empfehlung-title">Empfehlung</div>
                    <div class="cashflow-ai-empfehlung-text">${data.empfehlung}</div>
                </div>` : ''}
            </div>`;
    }
}

// Singleton
window.cashflowForecastService = window.cashflowForecastService || new CashflowForecastService();
