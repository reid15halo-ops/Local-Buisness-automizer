/* ============================================
   Supabase Client Service - Singleton
   FreyAI Visions - 95/5 Architecture
   
   Loads config from:
   1. window.SUPABASE_URL / window.SUPABASE_ANON_KEY (set at build/runtime)
   2. localStorage (set via Admin Panel)
   3. Falls back gracefully to offline mode if not configured
   ============================================ */

class SupabaseClientService {
    constructor() {
        this._client = null;
        this._isConfigured = false;
        this._isConnected = false;
        this._initPromise = null;
        this._connectionCheckInterval = null;
        this._onlineListeners = [];
        this._offlineListeners = [];
    }

    /**
     * Initialize the Supabase client.
     * Safe to call multiple times — returns the same promise.
     * @returns {Promise<boolean>} true if configured and ready
     */
    async init() {
        if (this._initPromise) {
            return this._initPromise;
        }

        this._initPromise = this._doInit();
        return this._initPromise;
    }

    async _doInit() {
        try {
            // Resolve URL and key from multiple sources (priority order)
            const url = this._resolveConfig('SUPABASE_URL', 'supabase_url');
            const anonKey = this._resolveConfig('SUPABASE_ANON_KEY', 'supabase_anon_key');

            if (!url || !anonKey) {
                console.info('[SupabaseClient] Not configured — running in offline/localStorage mode.');
                this._isConfigured = false;
                return false;
            }

            // Wait for Supabase CDN library to load
            const sdkReady = await this._waitForSDK();
            if (!sdkReady) {
                console.warn('[SupabaseClient] Supabase SDK not available — running in offline mode.');
                this._isConfigured = false;
                return false;
            }

            // Create client
            this._client = window.supabase.createClient(url, anonKey, {
                auth: {
                    autoRefreshToken: true,
                    persistSession: true,
                    detectSessionInUrl: true
                },
                realtime: {
                    params: {
                        eventsPerSecond: 10
                    }
                }
            });

            this._isConfigured = true;

            // Test connectivity (non-blocking — don't fail init if offline)
            this._checkConnection().catch((err) => {
                console.warn('[SupabaseClient] Initial connection check failed:', err?.message ?? err);
            });

            // Start periodic connection checks (every 30s)
            this._startConnectionMonitor();

            // Listen to browser online/offline events
            window.addEventListener('online', () => this._onBrowserOnline());
            window.addEventListener('offline', () => this._onBrowserOffline());

            console.info('[SupabaseClient] Initialized successfully.');
            return true;

        } catch (err) {
            console.error('[SupabaseClient] Init error:', err);
            this._isConfigured = false;
            return false;
        }
    }

    /**
     * Resolve a config value from window globals, then localStorage.
     * @param {string} windowKey - e.g. 'SUPABASE_URL'
     * @param {string} localStorageKey - e.g. 'supabase_url'
     * @returns {string|null}
     */
    _resolveConfig(windowKey, localStorageKey) {
        // 1. Window global (set by build system / env injection)
        if (window[windowKey] && window[windowKey].length > 10) {
            return window[windowKey];
        }
        // 2. localStorage (set by Admin Panel)
        const stored = localStorage.getItem(localStorageKey);
        if (stored && stored.length > 10) {
            return stored;
        }
        // 3. Legacy supabaseConfig object
        if (window.supabaseConfig && window.supabaseConfig.config) {
            const legacyVal = windowKey === 'SUPABASE_URL'
                ? window.supabaseConfig.config.url
                : window.supabaseConfig.config.anonKey;
            if (legacyVal && legacyVal.length > 10) {
                return legacyVal;
            }
        }
        return null;
    }

    /**
     * Wait for Supabase SDK to load from CDN (max 10 seconds).
     * @returns {Promise<boolean>}
     */
    async _waitForSDK(maxWaitMs = 10000) {
        if (typeof window.supabase !== 'undefined' && typeof window.supabase.createClient === 'function') {
            return true;
        }

        const start = Date.now();
        return new Promise((resolve) => {
            const interval = setInterval(() => {
                if (typeof window.supabase !== 'undefined' && typeof window.supabase.createClient === 'function') {
                    clearInterval(interval);
                    resolve(true);
                } else if (Date.now() - start > maxWaitMs) {
                    clearInterval(interval);
                    resolve(false);
                }
            }, 100);
        });
    }

    /**
     * Get the Supabase client instance.
     * Returns null if not configured (callers must handle null case).
     * @returns {import('@supabase/supabase-js').SupabaseClient|null}
     */
    get client() {
        return this._client;
    }

    /**
     * @returns {boolean} Whether Supabase is configured with URL + key
     */
    isConfigured() {
        return this._isConfigured;
    }

    /**
     * @returns {boolean} Whether the last connection check succeeded
     */
    isOnline() {
        return this._isConnected;
    }

    /**
     * Ping Supabase to verify connectivity.
     * @returns {Promise<boolean>}
     */
    async isConnected() {
        return this._checkConnection();
    }

    async _checkConnection() {
        if (!this._client) {
            this._isConnected = false;
            return false;
        }

        try {
            // Lightweight ping: fetch auth session (doesn't require data access)
            const { error } = await Promise.race([
                this._client.auth.getSession(),
                new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
            ]);

            // If we get a response (even an auth error), we're connected
            this._isConnected = true;
            return true;
        } catch (err) {
            this._isConnected = false;
            return false;
        }
    }

    _startConnectionMonitor() {
        if (this._connectionCheckInterval) {
            clearInterval(this._connectionCheckInterval);
        }
        this._connectionCheckInterval = setInterval(async () => {
            const wasConnected = this._isConnected;
            await this._checkConnection();
            if (!wasConnected && this._isConnected) {
                this._notifyOnline();
            } else if (wasConnected && !this._isConnected) {
                this._notifyOffline();
            }
        }, 30000);
    }

    _onBrowserOnline() {
        // Re-check actual Supabase connectivity when browser reports online
        setTimeout(() => this._checkConnection().then((connected) => {
            if (connected) { this._notifyOnline(); }
        }), 1000);
    }

    _onBrowserOffline() {
        this._isConnected = false;
        this._notifyOffline();
    }

    _notifyOnline() {
        console.info('[SupabaseClient] Connection restored.');
        this._onlineListeners.forEach(cb => { try { cb(); } catch (e) {} });
    }

    _notifyOffline() {
        console.warn('[SupabaseClient] Connection lost — switching to offline mode.');
        this._offlineListeners.forEach(cb => { try { cb(); } catch (e) {} });
    }

    /**
     * Register a callback for when Supabase connection is restored.
     * @param {Function} callback
     * @returns {Function} Unsubscribe function
     */
    onOnline(callback) {
        this._onlineListeners.push(callback);
        return () => {
            this._onlineListeners = this._onlineListeners.filter(cb => cb !== callback);
        };
    }

    /**
     * Register a callback for when Supabase connection is lost.
     * @param {Function} callback
     * @returns {Function} Unsubscribe function
     */
    onOffline(callback) {
        this._offlineListeners.push(callback);
        return () => {
            this._offlineListeners = this._offlineListeners.filter(cb => cb !== callback);
        };
    }

    /**
     * Update Supabase config (called from Admin Panel).
     * Resets the client so it re-initializes with new credentials.
     * @param {string} url
     * @param {string} anonKey
     */
    async updateConfig(url, anonKey) {
        localStorage.setItem('supabase_url', url);
        localStorage.setItem('supabase_anon_key', anonKey);
        window.SUPABASE_URL = url;
        window.SUPABASE_ANON_KEY = anonKey;

        // Also update legacy config object for compatibility
        if (window.supabaseConfig && window.supabaseConfig.config) {
            window.supabaseConfig.config.url = url;
            window.supabaseConfig.config.anonKey = anonKey;
        }

        // Reset and re-init
        this._client = null;
        this._isConfigured = false;
        this._isConnected = false;
        this._initPromise = null;

        if (this._connectionCheckInterval) {
            clearInterval(this._connectionCheckInterval);
            this._connectionCheckInterval = null;
        }

        return this.init();
    }

    /**
     * Destroy the client and cleanup.
     */
    destroy() {
        if (this._connectionCheckInterval) {
            clearInterval(this._connectionCheckInterval);
        }
        this._client = null;
        this._isConfigured = false;
        this._isConnected = false;
        this._initPromise = null;
        this._onlineListeners = [];
        this._offlineListeners = [];
    }
}

window.supabaseClient = new SupabaseClientService();

// Auto-initialize on script load
window.supabaseClient.init().catch(err => {
    console.warn('[SupabaseClient] Auto-init failed (offline mode active):', err.message);
});
