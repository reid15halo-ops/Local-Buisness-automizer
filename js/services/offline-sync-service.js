/* ============================================
   Offline Sync Service
   localStorage queue + offline indicator

   Uses localStorage for the action queue (small
   list of pending mutations) instead of a
   separate IndexedDB database. Data caching
   goes through StoreService's dbService.
   ============================================ */

class OfflineSyncService {
    constructor() {
        this.STORES = ['kunden', 'anfragen', 'angebote', 'auftraege', 'rechnungen'];
        this.QUEUE_KEY = 'freyai-offline-queue';
        this.MAX_RETRIES = 3;
        this._isOnline = navigator.onLine;
        this._indicatorEl = null;
        this._processing = false;

        // Listen for online/offline events
        window.addEventListener('online', () => {
            this._isOnline = true;
            this._updateIndicator();
            this._onOnline();
        });
        window.addEventListener('offline', () => {
            this._isOnline = false;
            this._updateIndicator();
        });
    }

    /**
     * Initialize the service (no separate DB needed).
     * Cleans up the old freyai-offline IndexedDB if it exists.
     */
    async init() {
        try {
            indexedDB.deleteDatabase('freyai-offline');
        } catch { /* ignore */ }
    }

    // ============================================
    // Online transition — correct order
    // ============================================

    /**
     * When coming back online:
     * 1. FIRST process the offline queue (push pending changes TO Supabase)
     * 2. THEN reload from Supabase (pull fresh data)
     */
    async _onOnline() {
        await this.processQueue();
        // After queue is drained, pull fresh data
        if (window.storeService?.load) {
            await window.storeService.load();
        }
    }

    // ============================================
    // Data Caching (through StoreService's dbService)
    // ============================================

    /**
     * Cache data into StoreService's IndexedDB via dbService.
     */
    async cacheData(storeName, items) {
        if (!this.STORES.includes(storeName)) { return; }
        if (window.dbService?._cacheEntities) {
            const storeMap = {
                'kunden': 'customers',
                'rechnungen': 'invoices',
                'angebote': 'quotes',
                'auftraege': 'orders'
            };
            const dbStoreName = storeMap[storeName];
            if (dbStoreName) {
                try {
                    await window.dbService._cacheEntities(dbStoreName, items);
                } catch (err) {
                    console.warn(`[OfflineSync] cacheData via dbService failed for ${storeName}:`, err);
                }
            }
        }
    }

    /**
     * Read cached data via dbService.
     */
    async getCachedData(storeName) {
        if (!this.STORES.includes(storeName)) { return []; }

        const methodMap = {
            'kunden': 'getCustomers',
            'rechnungen': 'getInvoices',
            'angebote': 'getQuotes',
            'auftraege': 'getOrders'
        };

        const method = methodMap[storeName];
        if (method && window.dbService?.[method]) {
            try {
                return await window.dbService[method]();
            } catch {
                return [];
            }
        }

        // Fallback: read from storeService state
        return window.storeService?.state?.[storeName] || [];
    }

    /**
     * Cache all current store data into dbService.
     */
    async cacheAllFromStore() {
        const state = window.storeService?.state;
        if (!state) { return; }

        const promises = this.STORES.map(storeName => {
            const data = state[storeName];
            if (Array.isArray(data) && data.length > 0) {
                return this.cacheData(storeName, data);
            }
            return Promise.resolve();
        });

        await Promise.allSettled(promises);
        console.debug('[OfflineSync] All data cached via dbService');
    }

    /**
     * Load cached data into store when offline.
     * Calls storeService.save() after mutating state to persist properly.
     */
    async loadCachedIntoStore() {
        if (this._isOnline) { return false; }

        const state = window.storeService?.state;
        if (!state) { return false; }

        let loaded = false;
        for (const storeName of this.STORES) {
            const cached = await this.getCachedData(storeName);
            if (cached.length > 0) {
                state[storeName] = cached;
                loaded = true;
            }
        }

        if (loaded) {
            await window.storeService.save();
            console.debug('[OfflineSync] Loaded cached data into store and saved');
        }
        return loaded;
    }

    // ============================================
    // Offline Action Queue (localStorage)
    // ============================================

    /**
     * Read the queue from localStorage.
     * @returns {Array} queue items
     */
    _getQueue() {
        try {
            const raw = localStorage.getItem(this.QUEUE_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch {
            return [];
        }
    }

    /**
     * Write the queue to localStorage.
     * @param {Array} queue
     */
    _setQueue(queue) {
        localStorage.setItem(this.QUEUE_KEY, JSON.stringify(queue));
    }

    /**
     * Queue an action for later sync.
     * @param {string} type - 'CREATE', 'UPDATE', 'DELETE'
     * @param {string} table - Table/store name
     * @param {object} data - The data to sync
     */
    async queueAction(type, table, data) {
        const queue = this._getQueue();
        queue.push({
            id: Date.now() + '-' + Math.random().toString(36).substring(2, 7),
            type,
            table,
            data,
            timestamp: Date.now(),
            retries: 0
        });
        this._setQueue(queue);
        console.debug(`[OfflineSync] Queued ${type} for ${table}`);
    }

    /**
     * Process the sync queue when back online.
     * Failed items get retried up to MAX_RETRIES times before being discarded.
     */
    async processQueue() {
        if (!this._isOnline || this._processing) { return; }
        this._processing = true;

        try {
            const supabase = window.supabaseClient?.client || window.supabase;
            if (!supabase) {
                return;
            }

            let queue = this._getQueue();
            if (queue.length === 0) {
                return;
            }

            console.debug(`[OfflineSync] Processing ${queue.length} queued actions...`);

            queue.sort((a, b) => a.timestamp - b.timestamp);

            const remaining = [];
            let synced = 0;
            let discarded = 0;

            for (const item of queue) {
                try {
                    let result;
                    switch (item.type) {
                        case 'CREATE':
                            result = await supabase.from(item.table).insert(item.data);
                            break;
                        case 'UPDATE':
                            result = await supabase.from(item.table).update(item.data).eq('id', item.data.id);
                            break;
                        case 'DELETE':
                            result = await supabase.from(item.table).delete().eq('id', item.data.id);
                            break;
                    }

                    if (result?.error) {
                        item.retries = (item.retries || 0) + 1;
                        if (item.retries >= this.MAX_RETRIES) {
                            console.warn(`[OfflineSync] Discarding item after ${this.MAX_RETRIES} failed retries:`, item.type, item.table, item.data?.id, result.error);
                            discarded++;
                        } else {
                            console.warn(`[OfflineSync] Retry ${item.retries}/${this.MAX_RETRIES} for ${item.type} ${item.table}:`, result.error);
                            remaining.push(item);
                        }
                    } else {
                        synced++;
                    }
                } catch (err) {
                    item.retries = (item.retries || 0) + 1;
                    if (item.retries >= this.MAX_RETRIES) {
                        console.warn(`[OfflineSync] Discarding item after ${this.MAX_RETRIES} failed retries:`, item.type, item.table, item.data?.id, err);
                        discarded++;
                    } else {
                        console.warn(`[OfflineSync] Retry ${item.retries}/${this.MAX_RETRIES} for ${item.type} ${item.table}:`, err);
                        remaining.push(item);
                    }
                }
            }

            // Save only items that still need retry
            this._setQueue(remaining);

            console.debug(`[OfflineSync] Queue processed: ${synced} synced, ${remaining.length} pending retry, ${discarded} discarded`);

            // NOTE: storeService.load() is called by _onOnline() AFTER processQueue,
            // so we do NOT call it here — that was the old reversed-order bug.

        } catch (err) {
            console.error('[OfflineSync] Queue processing error:', err);
        } finally {
            this._processing = false;
            this._updateIndicator();
        }
    }

    // ============================================
    // Sync Indicator
    // ============================================

    /**
     * Create or update the offline indicator in the mobile header
     */
    _updateIndicator() {
        if (!this._indicatorEl) {
            this._indicatorEl = document.getElementById('offline-sync-indicator');
            if (!this._indicatorEl) {
                const header = document.querySelector('.mobile-header') || document.querySelector('header');
                if (header) {
                    this._indicatorEl = document.createElement('div');
                    this._indicatorEl.id = 'offline-sync-indicator';
                    this._indicatorEl.style.cssText = 'display:none;background:#f59e0b;color:#000;text-align:center;padding:4px 8px;font-size:12px;font-weight:600;';
                    header.after(this._indicatorEl);
                }
            }
        }

        if (this._indicatorEl) {
            if (!this._isOnline) {
                this._indicatorEl.style.display = 'block';
                this._indicatorEl.textContent = 'Offline \u2014 Daten aus Cache';
            } else {
                this._indicatorEl.style.display = 'none';
            }
        }
    }

    /**
     * Whether the app is currently online
     */
    get isOnline() {
        return this._isOnline;
    }

    /**
     * Wrap a Supabase operation: if offline, queue it; if online, execute it
     * @param {string} type - 'CREATE', 'UPDATE', 'DELETE'
     * @param {string} table - Table name
     * @param {object} data - Data payload
     * @param {Function} onlineFn - Function to call when online (receives supabase client)
     */
    async executeOrQueue(type, table, data, onlineFn) {
        if (this._isOnline) {
            try {
                return await onlineFn();
            } catch (err) {
                console.warn('[OfflineSync] Online operation failed, queuing:', err);
                await this.queueAction(type, table, data);
            }
        } else {
            await this.queueAction(type, table, data);
        }
    }
}

// Initialize and export
window.offlineSyncService = new OfflineSyncService();

// Auto-init when DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => window.offlineSyncService.init());
} else {
    window.offlineSyncService.init();
}

// Listen for SW messages to process queue
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'PROCESS_OFFLINE_QUEUE') {
            window.offlineSyncService.processQueue();
        }
    });
}

// Cache data whenever store updates (debounced)
let _cacheDebounce = null;
let _subscribeRetries = 0;
function _subscribeToStore() {
    if (window.storeService) {
        window.storeService.subscribe(() => {
            clearTimeout(_cacheDebounce);
            _cacheDebounce = setTimeout(() => {
                if (navigator.onLine) {
                    window.offlineSyncService.cacheAllFromStore();
                }
            }, 5000);
        });
    } else {
        if (_subscribeRetries++ > 20) { console.warn('storeService not available after 20 retries'); return; }
        setTimeout(_subscribeToStore, 500);
    }
}
_subscribeToStore();
