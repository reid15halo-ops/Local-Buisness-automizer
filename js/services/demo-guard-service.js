/* ============================================
   Demo Guard Service
   Prevents accidental demo data in production.
   Blocks: Supabase writes, Email, SMS, Payments.
   Manages developer mode settings.
   ============================================ */

class DemoGuardService {
    constructor() {
        this.isDeveloperMode = this.getDevMode();
        this.listeners = [];
        this._intercepted = false;
        this._supabaseDBIntercepted = false;

        if (this.isDemo()) {
            this.interceptSupabaseWrites();
            this.interceptSupabaseDBService();
        }
    }

    getDevMode() {
        return localStorage.getItem('app_mode') === 'development';
    }

    setDevMode(enabled) {
        if (enabled) {
            localStorage.setItem('app_mode', 'development');
        } else {
            localStorage.removeItem('app_mode');
        }
        this.isDeveloperMode = enabled;
        this._notify();
        return enabled;
    }

    // Check if demo data is already loaded
    isDemo() {
        return localStorage.getItem('demo_data_loaded') === 'true';
    }

    markDemoLoaded() {
        localStorage.setItem('demo_data_loaded', 'true');
    }

    clearDemoFlag() {
        localStorage.removeItem('demo_data_loaded');
    }

    // ============================================
    // External Service Guards
    // Called by email-service, sms-service, payment-service etc.
    // ============================================

    /**
     * Check if an outbound action (email, SMS, payment) should be blocked.
     * Returns true if the action is allowed, false if blocked.
     * Shows a user-visible info toast when blocking.
     * @param {string} actionName - e.g. 'E-Mail senden', 'SMS senden'
     * @returns {boolean}
     */
    allowExternalAction(actionName) {
        if (!this.isDemo()) {return true;}
        console.warn(`[DemoGuard] Blocked: ${actionName} (Demo-Modus aktiv)`);
        if (window.errorHandler) {
            window.errorHandler.info(`${actionName} ist im Demo-Modus deaktiviert.`);
        }
        return false;
    }

    /**
     * Check if a record ID looks like demo data.
     * Demo IDs contain 'DEMO' (e.g. ANF-DEMO-001, RE-DEMO-301).
     * @param {string} id
     * @returns {boolean}
     */
    isDemoId(id) {
        return typeof id === 'string' && id.includes('DEMO');
    }

    // Show confirmation dialog before loading demo data
    async confirmDemoLoad(title = 'Demo-Daten laden') {
        if (window.confirmDialogService) {
            return new Promise((resolve) => {
                window.confirmDialogService.showConfirmDialog({
                    title: title,
                    message: 'Diese Aktion erstellt Testdaten in Ihrer Datenbank. Nur f\u00fcr Testzwecke verwenden!',
                    confirmText: 'Ja, fortfahren',
                    destructive: true,
                    onConfirm: () => resolve(true),
                    onCancel: () => resolve(false)
                });
            });
        }
        return confirm(`\u26a0\ufe0f ${title}\n\nDiese Aktion erstellt Testdaten in Ihrer Datenbank. Nur f\u00fcr Testzwecke verwenden!\n\nFortfahren?`);
    }

    // Show banner indicating demo mode is active
    showDemoBanner() {
        const existingBanner = document.getElementById('demo-mode-banner');
        if (existingBanner) {return;} // Already shown

        const banner = document.createElement('div');
        banner.id = 'demo-mode-banner';
        banner.className = 'demo-mode-banner';
        banner.innerHTML = `
            <div class="demo-banner-content">
                <span class="demo-banner-icon">\ud83d\udd27</span>
                <span class="demo-banner-text">Demo-Modus aktiv \u2014 E-Mails, SMS und Zahlungen sind deaktiviert</span>
                <button class="demo-banner-exit" onclick="window.demoGuardService?.exitDemoMode()">Demo beenden</button>
                <button class="demo-banner-close" onclick="document.getElementById('demo-mode-banner')?.remove()">\u2715</button>
            </div>
        `;

        // Insert at top of body
        if (document.body.firstChild) {
            document.body.insertBefore(banner, document.body.firstChild);
        } else {
            document.body.appendChild(banner);
        }
    }

    // Hide demo buttons if not in dev mode
    hideDemoButtons() {
        if (this.isDeveloperMode) {return;}

        const demoElements = document.querySelectorAll(
            '[data-action="load-demo-materials"], #qa-demo-workflow, #btn-load-demo-emails, #btn-demo-materials'
        );

        demoElements.forEach(el => {
            el.style.display = 'none';
        });
    }

    // Show dev mode controls in settings
    initDevModeToggle() {
        const settingsModal = document.getElementById('settings-panel');
        if (!settingsModal) {return;}

        // Check if toggle already exists
        if (document.getElementById('dev-mode-toggle')) {return;}

        const devModeSection = document.createElement('div');
        devModeSection.className = 'settings-card';
        devModeSection.innerHTML = `
            <h3>\ud83d\ude80 Entwicklermodus</h3>
            <p>Demo-Funktionen und Test-Tools aktivieren</p>
            <div class="form-group">
                <label style="display: flex; align-items: center; cursor: pointer;">
                    <input type="checkbox" id="dev-mode-toggle" ${this.isDeveloperMode ? 'checked' : ''} style="margin-right: 8px;">
                    <span>Entwicklermodus aktivieren</span>
                </label>
                <small style="display: block; margin-top: 8px; color: var(--text-muted);">
                    Zeigt Demo-Daten Buttons und Test-Tools. Nur f\u00fcr Entwicklung verwenden.
                </small>
            </div>
        `;

        // Find settings grid and append
        const settingsGrid = settingsModal.querySelector('.settings-grid');
        if (settingsGrid) {
            settingsGrid.appendChild(devModeSection);

            // Add event listener (named function for cleanup)
            this._devModeHandler = (e) => {
                this.setDevMode(e.target.checked);
                if (e.target.checked) {
                    // Show demo buttons
                    document.querySelectorAll('[data-action="load-demo-materials"], #qa-demo-workflow, #btn-load-demo-emails, #btn-demo-materials').forEach(el => {
                        el.style.display = '';
                    });
                } else {
                    // Hide demo buttons
                    this.hideDemoButtons();
                }
            };
            document.getElementById('dev-mode-toggle')?.addEventListener('change', this._devModeHandler);
        }
    }

    // Subscribe to dev mode changes
    onDevModeChange(callback) {
        this.listeners.push(callback);
        return () => {
            this.listeners = this.listeners.filter(l => l !== callback);
        };
    }

    // ============================================
    // Supabase Raw Client Interceptor
    // Blocks insert/update/delete/upsert on the raw Supabase client
    // ============================================
    interceptSupabaseWrites() {
        if (!this.isDemo()) {return;}

        // Try both access paths: supabaseClient.client AND supabaseConfig.get()
        const tryIntercept = () => {
            const clients = [];

            // Path 1: window.supabaseClient?.client (legacy)
            if (window.supabaseClient?.client) {
                clients.push(window.supabaseClient.client);
            }

            // Path 2: window.supabaseConfig?.get() (current, used by supabase-db-service)
            try {
                const configClient = window.supabaseConfig?.get();
                if (configClient && !clients.includes(configClient)) {
                    clients.push(configClient);
                }
            } catch (e) { /* not ready yet */ }

            if (clients.length === 0) {
                // Supabase not ready yet -- retry once after delay
                setTimeout(() => this.interceptSupabaseWrites(), 2000);
                return;
            }

            clients.forEach(client => this._patchClient(client));
            this._intercepted = true;
        };

        tryIntercept();
    }

    _patchClient(client) {
        if (client._demoGuardPatched) {return;}
        const originalFrom = client.from.bind(client);
        const blockedResult = { data: null, error: null, count: 0 };

        const makeChainable = () => {
            const handler = {
                get(target, prop) {
                    if (prop === 'then') {return (resolve) => resolve(blockedResult);}
                    if (prop === 'data' || prop === 'error' || prop === 'count') {return target[prop];}
                    return () => new Proxy({ ...blockedResult }, handler);
                }
            };
            return new Proxy({ ...blockedResult }, handler);
        };

        client.from = (table) => {
            const builder = originalFrom(table);
            const blockWrite = (method) => {
                builder[method] = (...args) => {
                    console.warn(`[DemoGuard] Blocked ${method} on ${table} in demo mode`);
                    if (window.errorHandler) {
                        window.errorHandler.info('Im Demo-Modus k\u00f6nnen keine Daten gespeichert werden.');
                    }
                    return makeChainable();
                };
            };
            ['insert', 'update', 'delete', 'upsert'].forEach(blockWrite);
            return builder;
        };

        client._demoGuardPatched = true;
    }

    // ============================================
    // SupabaseDB Service Interceptor
    // Also blocks the higher-level create/update/delete methods
    // in supabase-db-service.js which save locally + sync to cloud
    // ============================================
    interceptSupabaseDBService() {
        if (!this.isDemo()) {return;}

        const tryPatch = () => {
            const dbService = window.supabaseDB;
            if (!dbService || dbService._demoGuardPatched) {return;}

            const origCreate = dbService.create.bind(dbService);
            const origUpdate = dbService.update.bind(dbService);
            const origDelete = dbService.delete.bind(dbService);

            dbService.create = async (table, record) => {
                console.warn(`[DemoGuard] Blocked supabaseDB.create(${table}) in demo mode`);
                // Still save locally so demo UX works, but never sync to cloud
                dbService._saveLocal(table, record);
                return record;
            };

            dbService.update = async (table, id, updates) => {
                console.warn(`[DemoGuard] Blocked supabaseDB.update(${table}, ${id}) in demo mode`);
                dbService._updateLocal(table, id, updates);
                return updates;
            };

            dbService.delete = async (table, id) => {
                console.warn(`[DemoGuard] Blocked supabaseDB.delete(${table}, ${id}) in demo mode`);
                dbService._deleteLocal(table, id);
            };

            // Block sync queue processing too
            dbService.syncAll = async () => {
                console.warn('[DemoGuard] Blocked supabaseDB.syncAll() in demo mode');
                return { synced: 0, errors: 0 };
            };

            dbService._demoGuardPatched = true;
            this._supabaseDBIntercepted = true;
        };

        // supabaseDB may not be ready yet
        if (window.supabaseDB) {
            tryPatch();
        } else {
            setTimeout(tryPatch, 2000);
        }
    }

    // ============================================
    // Exit Demo Mode
    // ============================================
    async exitDemoMode() {
        // 1. L\u00f6sche Demo-Daten aus localStorage
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (key.startsWith('demo_') || key.includes('DEMO'))) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach(k => localStorage.removeItem(k));

        // 2. L\u00f6sche gecachte Store-Daten die Demo-IDs haben
        ['anfragen', 'angebote', 'auftraege', 'rechnungen'].forEach(key => {
            const data = localStorage.getItem(key);
            if (data) {
                try {
                    const parsed = JSON.parse(data);
                    if (Array.isArray(parsed)) {
                        const filtered = parsed.filter(item => !String(item.id || '').includes('DEMO'));
                        localStorage.setItem(key, JSON.stringify(filtered));
                    }
                } catch(e) {}
            }
        });

        // 3. L\u00f6sche Demo-Daten aus IndexedDB (Store-Service nutzt user-spezifische Keys)
        try {
            if (window.dbService) {
                const userId = window.storeService?.currentUserId || 'default';
                const storeKey = 'freyai-workflow-store';
                const storeData = await window.dbService.getUserData(userId, storeKey);
                if (storeData) {
                    const COLLECTIONS = ['anfragen', 'angebote', 'auftraege', 'rechnungen', 'activities'];
                    let changed = false;
                    for (const col of COLLECTIONS) {
                        if (Array.isArray(storeData[col])) {
                            const before = storeData[col].length;
                            storeData[col] = storeData[col].filter(
                                item => !String(item.id || '').includes('DEMO')
                            );
                            if (storeData[col].length !== before) {changed = true;}
                        }
                    }
                    // Remove demo activities (title contains 'DEMO')
                    if (Array.isArray(storeData.activities)) {
                        const before = storeData.activities.length;
                        storeData.activities = storeData.activities.filter(
                            a => !String(a.title || '').includes('DEMO')
                        );
                        if (storeData.activities.length !== before) {changed = true;}
                    }
                    if (changed) {
                        await window.dbService.setUserData(userId, storeKey, storeData);
                    }
                }
            }
        } catch (e) {
            console.warn('[DemoGuard] IndexedDB cleanup error:', e);
        }

        // 4. L\u00f6sche Sync-Queue (verhindert verz\u00f6gerten Upload von Demo-Daten)
        try {
            localStorage.removeItem('supabase_sync_queue');
        } catch (e) {}

        this.clearDemoFlag();
        document.getElementById('demo-mode-banner')?.remove();

        if (window.errorHandler) {
            window.errorHandler.success('Demo-Modus beendet. Daten wurden zur\u00fcckgesetzt.');
        }

        setTimeout(() => location.reload(), 1500);
    }

    // Cleanup event listeners to prevent memory leaks
    destroy() {
        const toggle = document.getElementById('dev-mode-toggle');
        if (toggle && this._devModeHandler) {
            toggle.removeEventListener('change', this._devModeHandler);
        }
        this._devModeHandler = null;
    }

    _notify() {
        this.listeners.forEach(cb => cb(this.isDeveloperMode));
    }
}

window.demoGuardService = new DemoGuardService();
