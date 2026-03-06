/* ============================================
   Offline Sync Service
   IndexedDB cache + offline action queue
   ============================================ */

class OfflineSyncService {
    constructor() {
        this.DB_NAME = 'freyai-offline';
        this.DB_VERSION = 1;
        this.STORES = ['kunden', 'anfragen', 'angebote', 'auftraege', 'rechnungen'];
        this.QUEUE_STORE = 'sync_queue';
        this.db = null;
        this._isOnline = navigator.onLine;
        this._syncInProgress = false;
        this._indicatorEl = null;

        // Listen for online/offline events
        window.addEventListener('online', () => {
            this._isOnline = true;
            this._updateIndicator();
            this.processQueue();
        });
        window.addEventListener('offline', () => {
            this._isOnline = false;
            this._updateIndicator();
        });
    }

    /**
     * Initialize IndexedDB
     */
    async init() {
        if (this.db) {return this.db;}

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                // Create object stores for each data type
                this.STORES.forEach(storeName => {
                    if (!db.objectStoreNames.contains(storeName)) {
                        db.createObjectStore(storeName, { keyPath: 'id' });
                    }
                });
                // Sync queue store
                if (!db.objectStoreNames.contains(this.QUEUE_STORE)) {
                    const queueStore = db.createObjectStore(this.QUEUE_STORE, { keyPath: 'queueId', autoIncrement: true });
                    queueStore.createIndex('timestamp', 'timestamp');
                }
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve(this.db);
            };

            request.onerror = (event) => {
                console.error('IndexedDB open failed:', event.target.error);
                reject(event.target.error);
            };
        });
    }

    /**
     * Cache data from Supabase into IndexedDB
     * Call this after successful data loads
     */
    async cacheData(storeName, items) {
        if (!this.STORES.includes(storeName)) {return;}
        await this.init();

        const tx = this.db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);

        // Clear old data and write new
        store.clear();
        items.forEach(item => {
            if (item.id) {store.put(item);}
        });

        return new Promise((resolve, reject) => {
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
        });
    }

    /**
     * Read cached data from IndexedDB
     */
    async getCachedData(storeName) {
        if (!this.STORES.includes(storeName)) {return [];}
        await this.init();

        const tx = this.db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const request = store.getAll();

        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Cache all current store data
     */
    async cacheAllFromStore() {
        const state = window.storeService?.state;
        if (!state) {return;}

        const promises = this.STORES.map(storeName => {
            const data = state[storeName];
            if (Array.isArray(data) && data.length > 0) {
                return this.cacheData(storeName, data);
            }
            return Promise.resolve();
        });

        await Promise.allSettled(promises);
        console.log('[OfflineSync] All data cached to IndexedDB');
    }

    /**
     * Load cached data into store when offline
     */
    async loadCachedIntoStore() {
        if (this._isOnline) {return false;}

        const state = window.storeService?.state;
        if (!state) {return false;}

        let loaded = false;
        for (const storeName of this.STORES) {
            const cached = await this.getCachedData(storeName);
            if (cached.length > 0) {
                state[storeName] = cached;
                loaded = true;
            }
        }

        if (loaded) {
            console.log('[OfflineSync] Loaded cached data into store');
        }
        return loaded;
    }

    // ============================================
    // Offline Action Queue
    // ============================================

    /**
     * Queue an action for later sync
     * @param {string} type - 'CREATE', 'UPDATE', 'DELETE'
     * @param {string} table - Table/store name
     * @param {object} data - The data to sync
     */
    async queueAction(type, table, data) {
        await this.init();

        const tx = this.db.transaction(this.QUEUE_STORE, 'readwrite');
        const store = tx.objectStore(this.QUEUE_STORE);

        store.add({
            type,
            table,
            data,
            timestamp: Date.now(),
            retries: 0,
        });

        return new Promise((resolve, reject) => {
            tx.oncomplete = () => {
                console.log(`[OfflineSync] Queued ${type} for ${table}`);
                resolve();
            };
            tx.onerror = () => reject(tx.error);
        });
    }

    /**
     * Process the sync queue when back online
     */
    async processQueue() {
        if (!this._isOnline || this._syncInProgress) {return;}
        this._syncInProgress = true;

        try {
            await this.init();
            const supabase = window.supabaseClient || (typeof initSupabase === 'function' ? initSupabase() : null);
            if (!supabase) {
                this._syncInProgress = false;
                return;
            }

            const tx = this.db.transaction(this.QUEUE_STORE, 'readonly');
            const store = tx.objectStore(this.QUEUE_STORE);
            const items = await new Promise((resolve, reject) => {
                const req = store.getAll();
                req.onsuccess = () => resolve(req.result || []);
                req.onerror = () => reject(req.error);
            });

            if (items.length === 0) {
                this._syncInProgress = false;
                return;
            }

            console.log(`[OfflineSync] Processing ${items.length} queued actions...`);

            // Sort by timestamp
            items.sort((a, b) => a.timestamp - b.timestamp);

            const processedIds = [];

            for (const item of items) {
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
                        console.warn(`[OfflineSync] Sync failed for ${item.type} ${item.table}:`, result.error);
                        // Server wins on conflict - skip this item
                    }

                    processedIds.push(item.queueId);
                } catch (err) {
                    console.warn(`[OfflineSync] Error processing queue item:`, err);
                    processedIds.push(item.queueId); // Remove on error too (server wins)
                }
            }

            // Remove processed items
            if (processedIds.length > 0) {
                const delTx = this.db.transaction(this.QUEUE_STORE, 'readwrite');
                const delStore = delTx.objectStore(this.QUEUE_STORE);
                processedIds.forEach(id => delStore.delete(id));
                await new Promise((resolve) => { delTx.oncomplete = resolve; });
            }

            console.log(`[OfflineSync] Queue processed: ${processedIds.length} items synced`);

            // Notify the app
            if (window.storeService?.load) {
                await window.storeService.load();
            }

        } catch (err) {
            console.error('[OfflineSync] Queue processing error:', err);
        }

        this._syncInProgress = false;
        this._updateIndicator();
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
                // Create indicator element
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
                // Network error while supposedly online
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
