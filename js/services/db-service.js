/* ============================================
   Database Service - v3
   Dual-Layer Data Access: Supabase + IndexedDB
   
   95/5 Architecture: All data flows through
   this service. Supabase = online truth,
   IndexedDB = offline fallback + local cache.
   
   Pattern for every operation:
   1. Try Supabase (if configured + connected)
   2. On error or offline: use IndexedDB
   3. Track offline changes in sync_queue
   4. Sync when connection restored
   ============================================ */

class DBService {
    constructor() {
        // IndexedDB config
        this.dbName = 'freyai_app_db';
        this.storeName = 'app_state';
        this.version = 3;
        this.db = null;
        this.userStores = new Set();

        // Sync state
        this._syncInProgress = false;
        this._syncListeners = [];

        // Subscribe to connection restore for auto-sync
        if (window.supabaseClient) {
            window.supabaseClient.onOnline(() => this._syncOfflineQueue());
        }
    }

    // ========================================
    // IndexedDB Initialization
    // ========================================

    /**
     * Initializes the IndexedDB database.
     * @returns {Promise<IDBDatabase>}
     */
    init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                const oldVersion = event.oldVersion;
                const transaction = event.target.transaction;

                console.log(`[DBService] DB upgrade: ${oldVersion} → ${this.version}`);

                // Version 1 → 2: Create users, sync_queue, user_default_data
                if (oldVersion < 2) {
                    if (!db.objectStoreNames.contains('users')) {
                        const usersStore = db.createObjectStore('users', { keyPath: 'id' });
                        usersStore.createIndex('name', 'name', { unique: false });
                    }
                    if (!db.objectStoreNames.contains('sync_queue')) {
                        const syncStore = db.createObjectStore('sync_queue', { keyPath: 'id', autoIncrement: true });
                        syncStore.createIndex('userId', 'userId', { unique: false });
                        syncStore.createIndex('synced', 'synced', { unique: false });
                        syncStore.createIndex('table', 'table', { unique: false });
                    }
                    if (!db.objectStoreNames.contains('user_default_data')) {
                        db.createObjectStore('user_default_data');
                        if (db.objectStoreNames.contains('app_state')) {
                            const oldStore = transaction.objectStore('app_state');
                            const newStore = transaction.objectStore('user_default_data');
                            const getAllRequest = oldStore.getAll();
                            const getAllKeysRequest = oldStore.getAllKeys();
                            getAllRequest.onsuccess = () => {
                                const values = getAllRequest.result;
                                const keys = getAllKeysRequest.result;
                                keys.forEach((key, index) => { newStore.put(values[index], key); });
                            };
                        }
                    }
                }

                // Version 2 → 3: Add dedicated entity stores for structured data
                if (oldVersion < 3) {
                    const entityStores = [
                        { name: 'customers', keyPath: 'id', indices: [
                            { name: 'userId', keyPath: 'user_id', unique: false },
                            { name: 'email', keyPath: 'email', unique: false }
                        ]},
                        { name: 'invoices', keyPath: 'id', indices: [
                            { name: 'userId', keyPath: 'user_id', unique: false },
                            { name: 'status', keyPath: 'status', unique: false },
                            { name: 'customerId', keyPath: 'customer_id', unique: false }
                        ]},
                        { name: 'quotes', keyPath: 'id', indices: [
                            { name: 'userId', keyPath: 'user_id', unique: false },
                            { name: 'status', keyPath: 'status', unique: false }
                        ]},
                        { name: 'orders', keyPath: 'id', indices: [
                            { name: 'userId', keyPath: 'user_id', unique: false },
                            { name: 'status', keyPath: 'status', unique: false }
                        ]},
                        { name: 'jobs_queue', keyPath: 'id', indices: [
                            { name: 'userId', keyPath: 'user_id', unique: false },
                            { name: 'status', keyPath: 'status', unique: false },
                            { name: 'jobType', keyPath: 'job_type', unique: false }
                        ]},
                        { name: 'communications', keyPath: 'id', indices: [
                            { name: 'userId', keyPath: 'user_id', unique: false },
                            { name: 'status', keyPath: 'status', unique: false }
                        ]}
                    ];

                    entityStores.forEach(({ name, keyPath, indices }) => {
                        if (!db.objectStoreNames.contains(name)) {
                            const store = db.createObjectStore(name, { keyPath });
                            indices.forEach(({ name: idxName, keyPath: idxKeyPath, unique }) => {
                                store.createIndex(idxName, idxKeyPath, { unique });
                            });
                        }
                    });
                }
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                console.log('[DBService] IndexedDB v3 initialized.');
                resolve(this.db);
            };

            request.onerror = (event) => {
                console.error('[DBService] IndexedDB error:', event.target.error);
                reject(event.target.error);
            };
        });
    }

    // ========================================
    // Internal Helpers
    // ========================================

    async _ensureDB() {
        if (!this.db) { await this.init(); }
    }

    _getCurrentUserId() {
        // Try Supabase auth first
        if (window.supabaseClient && window.supabaseClient.client) {
            const session = window.supabaseClient.client.auth.getSession
                ? null  // async — we use cached user instead
                : null;
        }
        // Try auth service
        if (window.authService && window.authService.getUser()) {
            return window.authService.getUser().id;
        }
        // Try user manager
        if (window.userManager && window.userManager.getCurrentUser()) {
            return window.userManager.getCurrentUser().id;
        }
        return 'default';
    }

    _getSupabase() {
        if (window.supabaseClient && window.supabaseClient.isConfigured()) {
            return window.supabaseClient.client;
        }
        return null;
    }

    /**
     * Execute an operation on an IndexedDB entity store.
     * @param {string} storeName
     * @param {string} mode - 'readonly' | 'readwrite'
     * @param {Function} operation - receives the IDBObjectStore, returns Promise
     */
    async _idbOperation(storeName, mode, operation) {
        await this._ensureDB();

        // Ensure store exists (entity stores added in v3)
        if (!this.db.objectStoreNames.contains(storeName)) {
            console.warn(`[DBService] Store '${storeName}' not found — using localStorage fallback.`);
            return null;
        }

        return new Promise((resolve, reject) => {
            const tx = this.db.transaction([storeName], mode);
            const store = tx.objectStore(storeName);
            const result = operation(store);

            if (result && typeof result.then === 'function') {
                result.then(resolve).catch(reject);
            } else if (result && result.onsuccess !== undefined) {
                // IDBRequest
                result.onsuccess = () => resolve(result.result);
                result.onerror = () => reject(result.error);
            } else {
                tx.oncomplete = () => resolve(result);
                tx.onerror = () => reject(tx.error);
            }
        });
    }

    // ========================================
    // Offline Sync Queue
    // ========================================

    /**
     * Queue a change for later sync when Supabase becomes available.
     */
    async _queueOfflineChange(action, table, data, userId = null) {
        await this._ensureDB();
        const effectiveUserId = userId || this._getCurrentUserId();

        return this.addToSyncQueue({
            userId: effectiveUserId,
            action, // 'insert' | 'update' | 'delete'
            table,
            data,
            timestamp: Date.now()
        });
    }

    /**
     * Sync all pending offline changes to Supabase.
     */
    async _syncOfflineQueue() {
        if (this._syncInProgress) { return; }
        const supabase = this._getSupabase();
        if (!supabase) { return; }

        this._syncInProgress = true;
        console.info('[DBService] Syncing offline queue to Supabase...');

        try {
            const pending = await this.getUnsyncedQueue();
            if (pending.length === 0) {
                this._syncInProgress = false;
                return;
            }

            let synced = 0;
            let failed = 0;

            for (const item of pending) {
                try {
                    let error = null;

                    if (item.action === 'insert' || item.action === 'upsert') {
                        const result = await supabase.from(item.table).upsert(item.data);
                        error = result.error;
                    } else if (item.action === 'update') {
                        const result = await supabase.from(item.table)
                            .update(item.data)
                            .eq('id', item.data.id);
                        error = result.error;
                    } else if (item.action === 'delete') {
                        const result = await supabase.from(item.table)
                            .delete()
                            .eq('id', item.data.id);
                        error = result.error;
                    }

                    if (error) {
                        console.warn(`[DBService] Sync failed for ${item.table} (id: ${item.id}):`, error);
                        // Increment retry counter
                        await this._incrementRetry(item.id);
                        failed++;
                    } else {
                        await this.markQueueItemSynced(item.id);
                        synced++;
                    }
                } catch (err) {
                    console.warn(`[DBService] Sync error for queue item ${item.id}:`, err);
                    failed++;
                }
            }

            console.info(`[DBService] Sync complete: ${synced} synced, ${failed} failed.`);
            this._syncListeners.forEach(cb => { try { cb({ synced, failed, total: pending.length }); } catch (e) {} });

        } finally {
            this._syncInProgress = false;
        }
    }

    async _incrementRetry(queueId) {
        await this._ensureDB();
        return new Promise((resolve) => {
            const tx = this.db.transaction(['sync_queue'], 'readwrite');
            const store = tx.objectStore('sync_queue');
            const req = store.get(queueId);
            req.onsuccess = () => {
                const item = req.result;
                if (item) {
                    item.retries = (item.retries || 0) + 1;
                    store.put(item);
                }
                resolve();
            };
            req.onerror = () => resolve();
        });
    }

    onSync(callback) {
        this._syncListeners.push(callback);
        return () => { this._syncListeners = this._syncListeners.filter(cb => cb !== callback); };
    }

    // ========================================
    // CUSTOMERS
    // ========================================

    /**
     * Get all customers for the current user.
     * @returns {Promise<Array>}
     */
    async getCustomers() {
        const supabase = this._getSupabase();
        const userId = this._getCurrentUserId();

        if (supabase) {
            try {
                const { data, error } = await supabase
                    .from('customers')
                    .select('*')
                    .eq('user_id', userId)
                    .order('created_at', { ascending: false });

                if (error) { throw error; }

                // Cache locally
                await this._cacheEntities('customers', data || []);
                return data || [];
            } catch (err) {
                console.warn('[DBService] getCustomers Supabase error, falling back to IndexedDB:', err.message);
            }
        }

        // Fallback: IndexedDB
        return this._getLocalCustomers(userId);
    }

    async _getLocalCustomers(userId) {
        await this._ensureDB();
        if (!this.db.objectStoreNames.contains('customers')) {
            // Further fallback: storeService
            return window.storeService?.state?.anfragen?.map(a => a.kunde).filter(Boolean) || [];
        }
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['customers'], 'readonly');
            const store = tx.objectStore('customers');
            const index = store.index('userId');
            const req = index.getAll(userId);
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => resolve([]);
        });
    }

    /**
     * Save (upsert) a customer.
     * @param {Object} data - Customer object (must have id or will be generated)
     * @returns {Promise<Object>} Saved customer
     */
    async saveCustomer(data) {
        const userId = this._getCurrentUserId();
        const customer = {
            ...data,
            id: data.id || this._generateId(),
            user_id: userId,
            updated_at: new Date().toISOString(),
            created_at: data.created_at || new Date().toISOString()
        };

        const supabase = this._getSupabase();

        if (supabase) {
            try {
                const { data: saved, error } = await supabase
                    .from('customers')
                    .upsert(customer)
                    .select()
                    .single();

                if (error) { throw error; }

                // Cache locally
                await this._putLocalEntity('customers', saved);
                return saved;
            } catch (err) {
                console.warn('[DBService] saveCustomer Supabase error, queuing for sync:', err.message);
                await this._queueOfflineChange('upsert', 'customers', customer, userId);
            }
        } else {
            await this._queueOfflineChange('upsert', 'customers', customer, userId);
        }

        // Save to IndexedDB regardless
        await this._putLocalEntity('customers', customer);
        return customer;
    }

    /**
     * Delete a customer by ID.
     * @param {string} id
     */
    async deleteCustomer(id) {
        const supabase = this._getSupabase();

        if (supabase) {
            try {
                const { error } = await supabase
                    .from('customers')
                    .delete()
                    .eq('id', id);

                if (error) { throw error; }
            } catch (err) {
                console.warn('[DBService] deleteCustomer Supabase error, queuing for sync:', err.message);
                await this._queueOfflineChange('delete', 'customers', { id });
            }
        } else {
            await this._queueOfflineChange('delete', 'customers', { id });
        }

        await this._deleteLocalEntity('customers', id);
    }

    // ========================================
    // INVOICES
    // ========================================

    /**
     * Get invoices, optionally filtered.
     * @param {Object} filter - e.g. { status: 'pending_approval' }
     * @returns {Promise<Array>}
     */
    async getInvoices(filter = {}) {
        const supabase = this._getSupabase();
        const userId = this._getCurrentUserId();

        if (supabase) {
            try {
                let query = supabase
                    .from('invoices')
                    .select('*')
                    .eq('user_id', userId)
                    .order('created_at', { ascending: false });

                // Apply filters
                Object.entries(filter).forEach(([key, val]) => {
                    query = query.eq(key, val);
                });

                const { data, error } = await query;
                if (error) { throw error; }

                await this._cacheEntities('invoices', data || []);
                return data || [];
            } catch (err) {
                console.warn('[DBService] getInvoices Supabase error, falling back to IndexedDB:', err.message);
            }
        }

        // Fallback: IndexedDB or storeService
        return this._getLocalInvoices(userId, filter);
    }

    async _getLocalInvoices(userId, filter = {}) {
        await this._ensureDB();

        if (!this.db.objectStoreNames.contains('invoices')) {
            // Further fallback to storeService
            let rechnungen = window.storeService?.state?.rechnungen || [];
            Object.entries(filter).forEach(([key, val]) => {
                rechnungen = rechnungen.filter(r => r[key] === val || r.status === val);
            });
            return rechnungen;
        }

        return new Promise((resolve) => {
            const tx = this.db.transaction(['invoices'], 'readonly');
            const store = tx.objectStore('invoices');

            let req;
            if (filter.status) {
                const index = store.index('status');
                req = index.getAll(filter.status);
            } else {
                const index = store.index('userId');
                req = index.getAll(userId);
            }

            req.onsuccess = () => {
                let results = req.result || [];
                // Apply remaining filters
                Object.entries(filter).forEach(([key, val]) => {
                    if (key !== 'status') {
                        results = results.filter(r => r[key] === val);
                    }
                });
                resolve(results);
            };
            req.onerror = () => resolve([]);
        });
    }

    /**
     * Save (upsert) an invoice.
     * @param {Object} data
     * @returns {Promise<Object>}
     */
    async saveInvoice(data) {
        const userId = this._getCurrentUserId();
        const invoice = {
            ...data,
            id: data.id || this._generateId(),
            user_id: userId,
            updated_at: new Date().toISOString(),
            created_at: data.created_at || new Date().toISOString()
        };

        const supabase = this._getSupabase();

        if (supabase) {
            try {
                const { data: saved, error } = await supabase
                    .from('invoices')
                    .upsert(invoice)
                    .select()
                    .single();

                if (error) { throw error; }
                await this._putLocalEntity('invoices', saved);
                return saved;
            } catch (err) {
                console.warn('[DBService] saveInvoice Supabase error, queuing for sync:', err.message);
                await this._queueOfflineChange('upsert', 'invoices', invoice, userId);
            }
        } else {
            await this._queueOfflineChange('upsert', 'invoices', invoice, userId);
        }

        await this._putLocalEntity('invoices', invoice);

        // Also update storeService for UI consistency
        if (window.storeService) {
            const existing = window.storeService.state.rechnungen.find(r => r.id === invoice.id);
            if (existing) {
                Object.assign(existing, invoice);
            } else {
                window.storeService.state.rechnungen.push(invoice);
            }
            window.storeService.save();
        }

        return invoice;
    }

    /**
     * Update the status of an invoice.
     * @param {string} id - Invoice ID
     * @param {string} status - New status
     * @param {Object} extra - Optional extra fields to update
     * @returns {Promise<Object>}
     */
    async updateInvoiceStatus(id, status, extra = {}) {
        const updateData = {
            id,
            status,
            updated_at: new Date().toISOString(),
            ...extra
        };

        const supabase = this._getSupabase();

        if (supabase) {
            try {
                const { data: saved, error } = await supabase
                    .from('invoices')
                    .update(updateData)
                    .eq('id', id)
                    .select()
                    .single();

                if (error) { throw error; }
                await this._putLocalEntity('invoices', saved);

                // Update storeService
                if (window.storeService) {
                    const r = window.storeService.state.rechnungen.find(r => r.id === id);
                    if (r) { Object.assign(r, { status, ...extra }); window.storeService.save(); }
                }

                return saved;
            } catch (err) {
                console.warn('[DBService] updateInvoiceStatus Supabase error:', err.message);
                await this._queueOfflineChange('update', 'invoices', updateData);
            }
        } else {
            await this._queueOfflineChange('update', 'invoices', updateData);
        }

        // Local update
        await this._ensureDB();
        if (this.db.objectStoreNames.contains('invoices')) {
            const existing = await this._getLocalEntity('invoices', id);
            if (existing) {
                await this._putLocalEntity('invoices', { ...existing, ...updateData });
            }
        }

        // Update storeService
        if (window.storeService) {
            const r = window.storeService.state.rechnungen.find(r => r.id === id);
            if (r) { Object.assign(r, { status, ...extra }); window.storeService.save(); }
        }

        return { id, status, ...extra };
    }

    // ========================================
    // QUOTES
    // ========================================

    /**
     * Get all quotes for the current user.
     * @returns {Promise<Array>}
     */
    async getQuotes() {
        const supabase = this._getSupabase();
        const userId = this._getCurrentUserId();

        if (supabase) {
            try {
                const { data, error } = await supabase
                    .from('quotes')
                    .select('*')
                    .eq('user_id', userId)
                    .order('created_at', { ascending: false });

                if (error) { throw error; }
                await this._cacheEntities('quotes', data || []);
                return data || [];
            } catch (err) {
                console.warn('[DBService] getQuotes Supabase error, falling back:', err.message);
            }
        }

        // Fallback: IndexedDB or storeService
        await this._ensureDB();
        if (this.db.objectStoreNames.contains('quotes')) {
            return new Promise((resolve) => {
                const tx = this.db.transaction(['quotes'], 'readonly');
                const index = tx.objectStore('quotes').index('userId');
                const req = index.getAll(userId);
                req.onsuccess = () => resolve(req.result || []);
                req.onerror = () => resolve(window.storeService?.state?.angebote || []);
            });
        }
        return window.storeService?.state?.angebote || [];
    }

    /**
     * Save (upsert) a quote.
     * @param {Object} data
     * @returns {Promise<Object>}
     */
    async saveQuote(data) {
        const userId = this._getCurrentUserId();
        const quote = {
            ...data,
            id: data.id || this._generateId(),
            user_id: userId,
            updated_at: new Date().toISOString(),
            created_at: data.created_at || new Date().toISOString()
        };

        const supabase = this._getSupabase();

        if (supabase) {
            try {
                const { data: saved, error } = await supabase
                    .from('quotes')
                    .upsert(quote)
                    .select()
                    .single();

                if (error) { throw error; }
                await this._putLocalEntity('quotes', saved);
                return saved;
            } catch (err) {
                console.warn('[DBService] saveQuote Supabase error, queuing for sync:', err.message);
                await this._queueOfflineChange('upsert', 'quotes', quote, userId);
            }
        } else {
            await this._queueOfflineChange('upsert', 'quotes', quote, userId);
        }

        await this._putLocalEntity('quotes', quote);
        return quote;
    }

    // ========================================
    // ORDERS
    // ========================================

    /**
     * Get all orders for the current user.
     * @returns {Promise<Array>}
     */
    async getOrders() {
        const supabase = this._getSupabase();
        const userId = this._getCurrentUserId();

        if (supabase) {
            try {
                const { data, error } = await supabase
                    .from('orders')
                    .select('*')
                    .eq('user_id', userId)
                    .order('created_at', { ascending: false });

                if (error) { throw error; }
                await this._cacheEntities('orders', data || []);
                return data || [];
            } catch (err) {
                console.warn('[DBService] getOrders Supabase error, falling back:', err.message);
            }
        }

        await this._ensureDB();
        if (this.db.objectStoreNames.contains('orders')) {
            return new Promise((resolve) => {
                const tx = this.db.transaction(['orders'], 'readonly');
                const index = tx.objectStore('orders').index('userId');
                const req = index.getAll(userId);
                req.onsuccess = () => resolve(req.result || []);
                req.onerror = () => resolve(window.storeService?.state?.auftraege || []);
            });
        }
        return window.storeService?.state?.auftraege || [];
    }

    /**
     * Save (upsert) an order.
     * @param {Object} data
     * @returns {Promise<Object>}
     */
    async saveOrder(data) {
        const userId = this._getCurrentUserId();
        const order = {
            ...data,
            id: data.id || this._generateId(),
            user_id: userId,
            updated_at: new Date().toISOString(),
            created_at: data.created_at || new Date().toISOString()
        };

        const supabase = this._getSupabase();

        if (supabase) {
            try {
                const { data: saved, error } = await supabase
                    .from('orders')
                    .upsert(order)
                    .select()
                    .single();

                if (error) { throw error; }
                await this._putLocalEntity('orders', saved);
                return saved;
            } catch (err) {
                console.warn('[DBService] saveOrder Supabase error, queuing for sync:', err.message);
                await this._queueOfflineChange('upsert', 'orders', order, userId);
            }
        } else {
            await this._queueOfflineChange('upsert', 'orders', order, userId);
        }

        await this._putLocalEntity('orders', order);
        return order;
    }

    // ========================================
    // JOBS QUEUE (95/5 Core)
    // ========================================

    /**
     * Get jobs from the queue, optionally filtered by status.
     * @param {string|null} status - e.g. 'pending', 'processing', 'done', 'failed'
     * @returns {Promise<Array>}
     */
    async getJobsQueue(status = null) {
        const supabase = this._getSupabase();
        const userId = this._getCurrentUserId();

        if (supabase) {
            try {
                let query = supabase
                    .from('jobs_queue')
                    .select('*')
                    .eq('user_id', userId)
                    .order('created_at', { ascending: false });

                if (status) { query = query.eq('status', status); }

                const { data, error } = await query;
                if (error) { throw error; }
                return data || [];
            } catch (err) {
                console.warn('[DBService] getJobsQueue Supabase error, falling back:', err.message);
            }
        }

        // Fallback: IndexedDB
        await this._ensureDB();
        if (!this.db.objectStoreNames.contains('jobs_queue')) { return []; }

        return new Promise((resolve) => {
            const tx = this.db.transaction(['jobs_queue'], 'readonly');
            const store = tx.objectStore('jobs_queue');

            let req;
            if (status) {
                const index = store.index('status');
                req = index.getAll(status);
            } else {
                const index = store.index('userId');
                req = index.getAll(userId);
            }

            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => resolve([]);
        });
    }

    /**
     * Add a new job to the queue.
     * @param {string} jobType - e.g. 'invoice_ocr', 'email_draft', 'dunning_check'
     * @param {Object} payload - Job-specific data
     * @param {number} priority - 1 (highest) to 10 (lowest), default 5
     * @returns {Promise<Object>} Created job
     */
    async addJob(jobType, payload, priority = 5) {
        const userId = this._getCurrentUserId();
        const job = {
            id: this._generateId(),
            user_id: userId,
            job_type: jobType,
            payload: JSON.stringify(payload),
            priority,
            status: 'pending',
            result: null,
            error: null,
            attempts: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        const supabase = this._getSupabase();

        if (supabase) {
            try {
                const { data: saved, error } = await supabase
                    .from('jobs_queue')
                    .insert(job)
                    .select()
                    .single();

                if (error) { throw error; }
                // Parse payload back to object
                if (saved.payload && typeof saved.payload === 'string') {
                    saved.payload = JSON.parse(saved.payload);
                }
                await this._putLocalEntity('jobs_queue', saved);
                return saved;
            } catch (err) {
                console.warn('[DBService] addJob Supabase error, saving locally:', err.message);
            }
        }

        // Save locally
        await this._putLocalEntity('jobs_queue', job);
        const localJob = { ...job, payload: JSON.parse(job.payload) };
        return localJob;
    }

    /**
     * Update job status (and optionally result/error).
     * @param {string} id - Job ID
     * @param {string} status - New status
     * @param {*} result - Optional result data
     * @param {string|null} error - Optional error message
     * @returns {Promise<Object>}
     */
    async updateJobStatus(id, status, result = null, error = null) {
        const updateData = {
            id,
            status,
            result: result !== null ? JSON.stringify(result) : null,
            error: error,
            updated_at: new Date().toISOString()
        };

        const supabase = this._getSupabase();

        if (supabase) {
            try {
                const { data: saved, error: supaErr } = await supabase
                    .from('jobs_queue')
                    .update(updateData)
                    .eq('id', id)
                    .select()
                    .single();

                if (supaErr) { throw supaErr; }
                return saved;
            } catch (err) {
                console.warn('[DBService] updateJobStatus Supabase error:', err.message);
            }
        }

        // Local update
        await this._ensureDB();
        if (this.db.objectStoreNames.contains('jobs_queue')) {
            const existing = await this._getLocalEntity('jobs_queue', id);
            if (existing) {
                await this._putLocalEntity('jobs_queue', { ...existing, ...updateData });
            }
        }

        return { id, status, result, error };
    }

    /**
     * Subscribe to real-time job queue updates via Supabase Realtime.
     * Falls back to polling if Supabase not configured.
     * @param {Function} callback - Called with updated job data
     * @returns {Function} Unsubscribe function
     */
    subscribeToJobUpdates(callback) {
        const supabase = this._getSupabase();
        const userId = this._getCurrentUserId();

        if (supabase && window.realtimeService) {
            return window.realtimeService.subscribeToJobQueue(userId, callback);
        }

        // Fallback: poll every 5 seconds
        console.info('[DBService] Realtime not available, using polling for job updates.');
        let active = true;
        let lastCheck = Date.now();

        const poll = async () => {
            if (!active) { return; }
            try {
                const jobs = await this.getJobsQueue();
                const recent = jobs.filter(j => new Date(j.updated_at).getTime() > lastCheck);
                if (recent.length > 0) {
                    lastCheck = Date.now();
                    recent.forEach(job => callback(job));
                }
            } catch (e) {}
            setTimeout(poll, 5000);
        };

        setTimeout(poll, 5000);

        return () => { active = false; };
    }

    // ========================================
    // IndexedDB Entity Helpers
    // ========================================

    async _putLocalEntity(storeName, entity) {
        await this._ensureDB();
        if (!this.db.objectStoreNames.contains(storeName)) { return; }

        return new Promise((resolve, reject) => {
            const tx = this.db.transaction([storeName], 'readwrite');
            const store = tx.objectStore(storeName);
            const req = store.put(entity);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    }

    async _getLocalEntity(storeName, id) {
        await this._ensureDB();
        if (!this.db.objectStoreNames.contains(storeName)) { return null; }

        return new Promise((resolve) => {
            const tx = this.db.transaction([storeName], 'readonly');
            const store = tx.objectStore(storeName);
            const req = store.get(id);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => resolve(null);
        });
    }

    async _deleteLocalEntity(storeName, id) {
        await this._ensureDB();
        if (!this.db.objectStoreNames.contains(storeName)) { return; }

        return new Promise((resolve) => {
            const tx = this.db.transaction([storeName], 'readwrite');
            const store = tx.objectStore(storeName);
            const req = store.delete(id);
            req.onsuccess = () => resolve();
            req.onerror = () => resolve();
        });
    }

    async _cacheEntities(storeName, entities) {
        await this._ensureDB();
        if (!this.db.objectStoreNames.contains(storeName)) { return; }

        return new Promise((resolve) => {
            const tx = this.db.transaction([storeName], 'readwrite');
            const store = tx.objectStore(storeName);
            entities.forEach(entity => store.put(entity));
            tx.oncomplete = () => resolve();
            tx.onerror = () => resolve();
        });
    }

    // ========================================
    // Legacy Methods (v1/v2 backward compat)
    // ========================================

    async get(key) {
        if (!this.db) { await this.init(); }
        return new Promise((resolve, reject) => {
            if (!this.db.objectStoreNames.contains(this.storeName)) {
                resolve(undefined);
                return;
            }
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.get(key);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async set(key, value) {
        if (!this.db) { await this.init(); }
        return new Promise((resolve, reject) => {
            if (!this.db.objectStoreNames.contains(this.storeName)) {
                resolve();
                return;
            }
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.put(value, key);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async clear() {
        if (!this.db) { await this.init(); }
        return new Promise((resolve, reject) => {
            if (!this.db.objectStoreNames.contains(this.storeName)) {
                resolve();
                return;
            }
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.clear();
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    // ========================================
    // Multi-User Methods (v2 compat)
    // ========================================

    async createUserStore(userId) {
        const storeName = `user_${userId}_data`;
        if (this.db && this.db.objectStoreNames.contains(storeName)) {
            this.userStores.add(storeName);
            return;
        }
        this.db.close();
        this.version++;

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(storeName)) {
                    db.createObjectStore(storeName);
                }
            };
            request.onsuccess = (event) => {
                this.db = event.target.result;
                this.userStores.add(storeName);
                resolve();
            };
            request.onerror = () => reject(request.error);
        });
    }

    async getUserData(userId, key) {
        if (!this.db) { await this.init(); }
        const storeName = `user_${userId}_data`;
        if (!this.db.objectStoreNames.contains(storeName)) {
            await this.createUserStore(userId);
        }
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.get(key);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async setUserData(userId, key, value) {
        if (!this.db) { await this.init(); }
        const storeName = `user_${userId}_data`;
        if (!this.db.objectStoreNames.contains(storeName)) {
            await this.createUserStore(userId);
        }
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.put(value, key);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async clearUserData(userId) {
        if (!this.db) { await this.init(); }
        const storeName = `user_${userId}_data`;
        if (!this.db.objectStoreNames.contains(storeName)) { return; }
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.clear();
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async getAllUsers() {
        if (!this.db) { await this.init(); }
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['users'], 'readonly');
            const store = transaction.objectStore('users');
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    }

    async getUser(userId) {
        if (!this.db) { await this.init(); }
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['users'], 'readonly');
            const store = transaction.objectStore('users');
            const request = store.get(userId);
            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error);
        });
    }

    async saveUser(user) {
        if (!this.db) { await this.init(); }
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['users'], 'readwrite');
            const store = transaction.objectStore('users');
            const request = store.put(user);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async deleteUser(userId) {
        if (!this.db) { await this.init(); }
        await new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['users'], 'readwrite');
            const store = transaction.objectStore('users');
            const request = store.delete(userId);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
        await this.clearUserData(userId);
    }

    // ========================================
    // Sync Queue Methods
    // ========================================

    async addToSyncQueue(item) {
        if (!this.db) { await this.init(); }
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['sync_queue'], 'readwrite');
            const store = transaction.objectStore('sync_queue');
            const request = store.add({
                ...item,
                synced: false,
                retries: 0,
                timestamp: item.timestamp || Date.now()
            });
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getUnsyncedQueue(userId = null) {
        if (!this.db) { await this.init(); }
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['sync_queue'], 'readonly');
            const store = transaction.objectStore('sync_queue');
            const index = store.index('synced');
            const request = index.getAll(false);
            request.onsuccess = () => {
                let results = request.result || [];
                if (userId) { results = results.filter(item => item.userId === userId); }
                // Exclude items with too many retries (give up after 5)
                results = results.filter(item => (item.retries || 0) < 5);
                resolve(results);
            };
            request.onerror = () => reject(request.error);
        });
    }

    async markQueueItemSynced(queueId) {
        if (!this.db) { await this.init(); }
        return new Promise((resolve) => {
            const transaction = this.db.transaction(['sync_queue'], 'readwrite');
            const store = transaction.objectStore('sync_queue');
            const getRequest = store.get(queueId);
            getRequest.onsuccess = () => {
                const item = getRequest.result;
                if (item) {
                    item.synced = true;
                    item.syncedAt = Date.now();
                    store.put(item);
                }
                resolve();
            };
            getRequest.onerror = () => resolve();
        });
    }

    async deleteQueueItem(queueId) {
        if (!this.db) { await this.init(); }
        return new Promise((resolve) => {
            const transaction = this.db.transaction(['sync_queue'], 'readwrite');
            const store = transaction.objectStore('sync_queue');
            const request = store.delete(queueId);
            request.onsuccess = () => resolve();
            request.onerror = () => resolve();
        });
    }

    async cleanupSyncedQueue(olderThanMs = Date.now() - 7 * 24 * 60 * 60 * 1000) {
        if (!this.db) { await this.init(); }
        return new Promise((resolve) => {
            const transaction = this.db.transaction(['sync_queue'], 'readwrite');
            const store = transaction.objectStore('sync_queue');
            const request = store.openCursor();
            let deletedCount = 0;
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    const item = cursor.value;
                    if (item.synced && item.syncedAt < olderThanMs) {
                        cursor.delete();
                        deletedCount++;
                    }
                    cursor.continue();
                } else {
                    resolve(deletedCount);
                }
            };
            request.onerror = () => resolve(0);
        });
    }

    // ========================================
    // Utility
    // ========================================

    _generateId() {
        return `${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 9)}`.toUpperCase();
    }

    /**
     * Manually trigger offline queue sync (e.g., called on demand).
     */
    async syncNow() {
        return this._syncOfflineQueue();
    }
}

window.dbService = new DBService();
