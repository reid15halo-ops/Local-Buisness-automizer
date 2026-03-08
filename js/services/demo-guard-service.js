/* ============================================
   Demo Guard Service
   Prevents accidental demo data loading in production
   Manages developer mode settings
   ============================================ */

class DemoGuardService {
    constructor() {
        this.isDeveloperMode = this.getDevMode();
        this.listeners = [];
        this._intercepted = false;

        if (this.isDemo()) {
            this.interceptSupabaseWrites();
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
                <span class="demo-banner-icon">🔧</span>
                <span class="demo-banner-text">Demo-Daten aktiv — Nicht für Produktivbetrieb</span>
                <button class="demo-banner-exit" onclick="window.demoGuardService?.exitDemoMode()">Demo beenden</button>
                <button class="demo-banner-close" onclick="document.getElementById('demo-mode-banner')?.remove()">✕</button>
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
            <h3>🚀 Entwicklermodus</h3>
            <p>Demo-Funktionen und Test-Tools aktivieren</p>
            <div class="form-group">
                <label style="display: flex; align-items: center; cursor: pointer;">
                    <input type="checkbox" id="dev-mode-toggle" ${this.isDeveloperMode ? 'checked' : ''} style="margin-right: 8px;">
                    <span>Entwicklermodus aktivieren</span>
                </label>
                <small style="display: block; margin-top: 8px; color: var(--text-muted);">
                    Zeigt Demo-Daten Buttons und Test-Tools. Nur für Entwicklung verwenden.
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

    interceptSupabaseWrites() {
        if (!this.isDemo()) return;
        const client = window.supabaseClient?.client;
        if (!client) {
            // Supabase not ready yet — retry once after delay
            setTimeout(() => this.interceptSupabaseWrites(), 2000);
            return;
        }

        const originalFrom = client.from.bind(client);
        const blockedResult = { data: null, error: null, count: 0 };
        // Make blocked result thenable so await works, and chainable for .select()/.eq() etc.
        const makeChainable = () => {
            const handler = {
                get(target, prop) {
                    if (prop === 'then') return (resolve) => resolve(blockedResult);
                    if (prop === 'data' || prop === 'error' || prop === 'count') return target[prop];
                    // Any chained method (.select(), .eq(), .single(), etc.) returns the same proxy
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
                        window.errorHandler.info('Im Demo-Modus können keine Daten gespeichert werden.');
                    }
                    return makeChainable();
                };
            };
            ['insert', 'update', 'delete', 'upsert'].forEach(blockWrite);
            return builder;
        };
        this._intercepted = true;
    }

    async exitDemoMode() {
        // Lösche Demo-Daten aus localStorage
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (key.startsWith('demo_') || key.includes('DEMO'))) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach(k => localStorage.removeItem(k));

        // Lösche gecachte Store-Daten die Demo-IDs haben
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

        this.clearDemoFlag();
        document.getElementById('demo-mode-banner')?.remove();

        if (window.errorHandler) {
            window.errorHandler.success('Demo-Modus beendet. Daten wurden zurückgesetzt.');
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
