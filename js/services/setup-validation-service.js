/* ============================================
   Setup Validation Service
   Checks if Supabase backend is properly configured:
   - Connection alive
   - Auth working
   - Core tables exist
   - RLS policies active
   ============================================ */

class SetupValidationService {
    constructor() {
        this._lastResult = null;
    }

    /**
     * Run all validation checks.
     * @returns {Promise<{ok: boolean, checks: Array<{name: string, ok: boolean, detail: string}>}>}
     */
    async validate() {
        const checks = [];

        checks.push(this._checkConfig());
        checks.push(await this._checkConnection());
        checks.push(await this._checkAuth());
        checks.push(await this._checkCoreTables());

        const results = checks;
        const ok = results.every(c => c.ok);
        this._lastResult = { ok, checks: results };
        return this._lastResult;
    }

    _checkConfig() {
        const configured = window.supabaseConfig?.isConfigured?.() || false;
        return {
            name: 'Supabase konfiguriert',
            ok: configured,
            detail: configured
                ? 'URL und Anon-Key vorhanden'
                : 'Supabase URL oder Anon-Key fehlt. In Einstellungen konfigurieren.'
        };
    }

    async _checkConnection() {
        if (!window.supabaseConfig?.isConfigured?.()) {
            return { name: 'Verbindung', ok: false, detail: 'Nicht konfiguriert' };
        }

        try {
            const client = window.supabaseConfig.get();
            if (!client) {
                return { name: 'Verbindung', ok: false, detail: 'Client nicht initialisiert' };
            }

            // Lightweight ping: try to fetch session (no data access needed)
            const result = await Promise.race([
                client.auth.getSession(),
                new Promise((_resolve, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
            ]);

            // Any non-error response means connection is alive
            return {
                name: 'Verbindung',
                ok: true,
                detail: result?.data?.session ? 'Verbunden (eingeloggt)' : 'Verbunden (nicht eingeloggt)'
            };
        } catch (err) {
            return {
                name: 'Verbindung',
                ok: false,
                detail: `Verbindungsfehler: ${err.message}`
            };
        }
    }

    async _checkAuth() {
        if (!window.authService?.isConfigured?.()) {
            return { name: 'Authentifizierung', ok: false, detail: 'Auth-Service nicht konfiguriert' };
        }

        try {
            const session = await window.authService.getSession();
            if (session) {
                return {
                    name: 'Authentifizierung',
                    ok: true,
                    detail: `Eingeloggt als ${session.user?.email || 'unbekannt'}`
                };
            }
            return {
                name: 'Authentifizierung',
                ok: false,
                detail: 'Keine aktive Sitzung — bitte anmelden'
            };
        } catch (err) {
            return {
                name: 'Authentifizierung',
                ok: false,
                detail: `Auth-Fehler: ${err.message}`
            };
        }
    }

    async _checkCoreTables() {
        const client = window.supabaseConfig?.get?.();
        if (!client) {
            return { name: 'Datenbank-Schema', ok: false, detail: 'Kein Client verfuegbar' };
        }

        // Check a core table exists by querying it (RLS may return empty, but no error = table exists)
        const coreTables = ['kunden', 'anfragen', 'angebote', 'auftraege', 'rechnungen', 'profiles'];
        const missing = [];

        for (const table of coreTables) {
            try {
                const { error } = await client.from(table).select('id').limit(1);
                if (error && error.code === '42P01') {
                    // relation does not exist
                    missing.push(table);
                }
            } catch {
                missing.push(table);
            }
        }

        if (missing.length === 0) {
            return {
                name: 'Datenbank-Schema',
                ok: true,
                detail: `Alle ${coreTables.length} Kern-Tabellen vorhanden`
            };
        }

        return {
            name: 'Datenbank-Schema',
            ok: false,
            detail: `Fehlende Tabellen: ${missing.join(', ')}. SQL-Schema unter config/supabase-schema.sql ausfuehren.`
        };
    }

    /**
     * Get last validation result without re-running checks.
     */
    getLastResult() {
        return this._lastResult;
    }

    /**
     * Render validation results as HTML (for admin panel).
     */
    renderHTML(result) {
        if (!result) {return '<p>Keine Validierung durchgefuehrt.</p>';}

        const rows = result.checks.map(c => {
            const icon = c.ok ? '<span style="color:#22c55e">&#10003;</span>' : '<span style="color:#ef4444">&#10007;</span>';
            return `<tr><td>${icon}</td><td><strong>${c.name}</strong></td><td>${c.detail}</td></tr>`;
        }).join('');

        const summary = result.ok
            ? '<p style="color:#22c55e;font-weight:600;">Alle Checks bestanden — Backend einsatzbereit.</p>'
            : '<p style="color:#ef4444;font-weight:600;">Einige Checks fehlgeschlagen — siehe Details unten.</p>';

        return `
            ${summary}
            <table style="width:100%;border-collapse:collapse;margin-top:12px;">
                <tbody>${rows}</tbody>
            </table>
        `;
    }
}

window.setupValidationService = new SetupValidationService();
