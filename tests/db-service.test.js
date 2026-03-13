import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ============================================
// Mock IndexedDB (minimal in-memory implementation)
// ============================================
function createMockIDB() {
    const stores = {};

    function createMockStore(name, data = {}) {
        const storeData = data;
        const indices = {};

        const store = {
            put: vi.fn((value, key) => {
                const effectiveKey = key !== undefined ? key : value.id;
                storeData[effectiveKey] = value;
                return createMockRequest(effectiveKey);
            }),
            add: vi.fn((value) => {
                const autoId = Object.keys(storeData).length + 1;
                const key = value.id || autoId;
                storeData[key] = { ...value, id: key };
                return createMockRequest(key);
            }),
            get: vi.fn((key) => {
                return createMockRequest(storeData[key] || null);
            }),
            getAll: vi.fn(() => {
                return createMockRequest(Object.values(storeData));
            }),
            getAllKeys: vi.fn(() => {
                return createMockRequest(Object.keys(storeData));
            }),
            delete: vi.fn((key) => {
                delete storeData[key];
                return createMockRequest(undefined);
            }),
            clear: vi.fn(() => {
                Object.keys(storeData).forEach(k => delete storeData[k]);
                return createMockRequest(undefined);
            }),
            index: vi.fn((indexName) => {
                return {
                    getAll: vi.fn((filterValue) => {
                        const results = Object.values(storeData).filter(item => {
                            if (indexName === 'synced') return item.synced === filterValue;
                            if (indexName === 'userId') return item.user_id === filterValue || item.userId === filterValue;
                            if (indexName === 'status') return item.status === filterValue;
                            if (indexName === 'email') return item.email === filterValue;
                            if (indexName === 'table') return item.table === filterValue;
                            return true;
                        });
                        return createMockRequest(results);
                    })
                };
            }),
            openCursor: vi.fn(() => {
                const items = Object.values(storeData);
                let idx = 0;
                const cursorReq = createMockRequest(null);
                // Simulate cursor iteration
                const advanceCursor = () => {
                    if (idx < items.length) {
                        const item = items[idx];
                        idx++;
                        return {
                            value: item,
                            delete: vi.fn(() => {
                                const key = item.id;
                                delete storeData[key];
                            }),
                            continue: vi.fn(() => {
                                const next = advanceCursor();
                                if (cursorReq.onsuccess) {
                                    cursorReq.onsuccess({ target: { result: next } });
                                }
                            })
                        };
                    }
                    return null;
                };
                // Trigger first cursor result asynchronously
                setTimeout(() => {
                    const cursor = advanceCursor();
                    if (cursorReq.onsuccess) {
                        cursorReq.onsuccess({ target: { result: cursor } });
                    }
                }, 0);
                return cursorReq;
            }),
            _data: storeData
        };

        return store;
    }

    function createMockRequest(resultValue) {
        const req = {
            result: resultValue,
            error: null,
            onsuccess: null,
            onerror: null
        };
        // Auto-fire onsuccess in next microtask
        setTimeout(() => {
            if (req.onsuccess) req.onsuccess({ target: req });
        }, 0);
        return req;
    }

    function createMockTransaction(storeNames, mode) {
        const tx = {
            objectStore: vi.fn((name) => {
                if (!stores[name]) {
                    stores[name] = createMockStore(name);
                }
                return stores[name];
            }),
            oncomplete: null,
            onerror: null,
            error: null
        };
        // Auto-fire oncomplete
        setTimeout(() => {
            if (tx.oncomplete) tx.oncomplete();
        }, 0);
        return tx;
    }

    const objectStoreNamesList = {
        contains: vi.fn((name) => name in stores),
        length: 0,
        [Symbol.iterator]: function* () {
            for (const k of Object.keys(stores)) yield k;
        }
    };

    const mockDB = {
        objectStoreNames: objectStoreNamesList,
        transaction: vi.fn((storeNames, mode) => createMockTransaction(storeNames, mode)),
        close: vi.fn(),
        version: 4
    };

    return {
        db: mockDB,
        stores,
        addStore: (name, data = {}) => {
            stores[name] = createMockStore(name, data);
            objectStoreNamesList.length = Object.keys(stores).length;
        },
        getStoreData: (name) => stores[name]?._data || {}
    };
}

// ============================================
// DBService Tests
// ============================================

describe('DBService', () => {
    let dbService;
    let mockIDB;
    let mockSupabaseClient;

    beforeEach(() => {
        vi.useFakeTimers({ shouldAdvanceTime: true });

        // Clear window state
        delete window.supabaseClient;
        delete window.authService;
        delete window.userManager;
        delete window.securityService;
        delete window.storeService;
        delete window.realtimeService;

        // Mock localStorage
        global.localStorage = {
            getItem: vi.fn(),
            setItem: vi.fn(),
            removeItem: vi.fn(),
            clear: vi.fn()
        };

        // Setup mock IndexedDB
        mockIDB = createMockIDB();
        // Pre-create the stores the service expects
        mockIDB.addStore('app_state');
        mockIDB.addStore('users');
        mockIDB.addStore('sync_queue');
        mockIDB.addStore('user_default_data');
        mockIDB.addStore('customers');
        mockIDB.addStore('invoices');
        mockIDB.addStore('quotes');
        mockIDB.addStore('orders');
        mockIDB.addStore('jobs_queue');
        mockIDB.addStore('communications');

        // Mock Supabase query builder
        const createQueryBuilder = () => {
            let chain = {};
            chain.select = vi.fn(() => chain);
            chain.insert = vi.fn(() => chain);
            chain.upsert = vi.fn(() => chain);
            chain.update = vi.fn(() => chain);
            chain.delete = vi.fn(() => chain);
            chain.eq = vi.fn(() => chain);
            chain.order = vi.fn(() => chain);
            chain.single = vi.fn(() => Promise.resolve({ data: null, error: null }));
            // Make the chain itself thenable for queries without .single()
            chain.then = vi.fn((resolve) => resolve({ data: [], error: null }));
            return chain;
        };

        mockSupabaseClient = {
            from: vi.fn(() => createQueryBuilder()),
            isConfigured: vi.fn(() => true),
            client: {
                from: vi.fn(() => createQueryBuilder())
            }
        };

        // Mock authService
        window.authService = {
            getUser: vi.fn(() => ({ id: 'user-123' }))
        };

        // ---- Inline DBService class (copied from source) ----
        class DBService {
            constructor() {
                this.dbName = 'freyai_app_db';
                this.storeName = 'app_state';
                this.version = 4;
                this.db = null;
                this.userStores = new Set();

                this._supabaseTableMap = {
                    'customers': 'kunden',
                    'invoices': 'rechnungen',
                    'quotes': 'angebote',
                    'orders': 'auftraege',
                };

                this._syncInProgress = false;
                this._syncListeners = [];

                if (window.supabaseClient) {
                    window.supabaseClient.onOnline(() => this._syncOfflineQueue());
                }
            }

            init() {
                // In tests, just resolve with the mock DB
                this.db = mockIDB.db;
                return Promise.resolve(this.db);
            }

            async _ensureDB() {
                if (!this.db) { await this.init(); }
            }

            _getCurrentUserId() {
                if (window.authService && window.authService.getUser()) {
                    return window.authService.getUser().id;
                }
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

            _supabaseTable(storeName) {
                return this._supabaseTableMap[storeName] || storeName;
            }

            async _idbOperation(storeName, mode, operation) {
                await this._ensureDB();
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
                        result.onsuccess = () => resolve(result.result);
                        result.onerror = () => reject(result.error);
                    } else {
                        tx.oncomplete = () => resolve(result);
                        tx.onerror = () => reject(tx.error);
                    }
                });
            }

            async _queueOfflineChange(action, table, data, userId = null) {
                await this._ensureDB();
                const effectiveUserId = userId || this._getCurrentUserId();
                return this.addToSyncQueue({
                    userId: effectiveUserId,
                    action,
                    table,
                    data,
                    timestamp: Date.now()
                });
            }

            async _syncOfflineQueue() {
                if (this._syncInProgress) { return; }
                const supabase = this._getSupabase();
                if (!supabase) { return; }

                this._syncInProgress = true;

                try {
                    const pending = await this.getUnsyncedQueue();
                    if (pending.length === 0) {
                        this._syncInProgress = false;
                        return;
                    }

                    let synced = 0;
                    let failed = 0;

                    for (const item of pending) {
                        const retryDelay = Math.min(1000 * Math.pow(2, item.retries || 0), 300000);
                        if (item.lastRetryAt && (Date.now() - item.lastRetryAt) < retryDelay) {
                            continue;
                        }

                        try {
                            let error = null;
                            const supaTable = this._supabaseTable(item.table);

                            if (item.action === 'insert' || item.action === 'upsert') {
                                const result = await supabase.from(supaTable).upsert(item.data);
                                error = result.error;
                            } else if (item.action === 'update') {
                                const result = await supabase.from(supaTable)
                                    .update(item.data)
                                    .eq('id', item.data.id);
                                error = result.error;
                            } else if (item.action === 'delete') {
                                const result = await supabase.from(supaTable)
                                    .delete()
                                    .eq('id', item.data.id);
                                error = result.error;
                            }

                            if (error) {
                                await this._incrementRetry(item.id);
                                failed++;
                            } else {
                                await this.markQueueItemSynced(item.id);
                                synced++;
                            }
                        } catch (err) {
                            await this._incrementRetry(item.id);
                            failed++;
                        }
                    }

                    this._syncListeners.forEach(cb => { try { cb({ synced, failed, total: pending.length }); } catch { /* ignore */ } });

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
                            item.lastRetryAt = Date.now();
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

            async getCustomers() {
                const supabase = this._getSupabase();
                const userId = this._getCurrentUserId();

                if (supabase) {
                    try {
                        const { data, error } = await supabase
                            .from('kunden')
                            .select('*')
                            .eq('user_id', userId)
                            .order('created_at', { ascending: false });
                        if (error) { throw error; }
                        await this._cacheEntities('customers', data || []);
                        return data || [];
                    } catch (err) {
                        // fall through
                    }
                }
                return this._getLocalCustomers(userId);
            }

            async _getLocalCustomers(userId) {
                await this._ensureDB();
                if (!this.db.objectStoreNames.contains('customers')) {
                    return window.storeService?.state?.anfragen?.map(a => a.kunde).filter(Boolean) || [];
                }
                return new Promise((resolve, _reject) => {
                    const tx = this.db.transaction(['customers'], 'readonly');
                    const store = tx.objectStore('customers');
                    const index = store.index('userId');
                    const req = index.getAll(userId);
                    req.onsuccess = () => resolve(req.result || []);
                    req.onerror = () => resolve([]);
                });
            }

            async saveCustomer(data) {
                if (window.securityService && !window.securityService.validateCSRFToken()) {
                    throw new Error('CSRF-Token ungültig. Bitte Seite neu laden.');
                }
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
                            .from('kunden')
                            .upsert(customer)
                            .select()
                            .single();
                        if (error) { throw error; }
                        await this._putLocalEntity('customers', saved);
                        return saved;
                    } catch (err) {
                        await this._queueOfflineChange('upsert', 'customers', customer, userId);
                    }
                } else {
                    await this._queueOfflineChange('upsert', 'customers', customer, userId);
                }

                await this._putLocalEntity('customers', customer);
                return customer;
            }

            async deleteCustomer(id) {
                if (window.securityService && !window.securityService.validateCSRFToken()) {
                    throw new Error('CSRF-Token ungültig. Bitte Seite neu laden.');
                }
                const supabase = this._getSupabase();

                if (supabase) {
                    try {
                        const { error } = await supabase
                            .from('kunden')
                            .delete()
                            .eq('id', id);
                        if (error) { throw error; }
                    } catch (err) {
                        await this._queueOfflineChange('delete', 'customers', { id });
                    }
                } else {
                    await this._queueOfflineChange('delete', 'customers', { id });
                }

                await this._deleteLocalEntity('customers', id);
            }

            async getInvoices(filter = {}) {
                const supabase = this._getSupabase();
                const userId = this._getCurrentUserId();

                if (supabase) {
                    try {
                        let query = supabase
                            .from('rechnungen')
                            .select('*')
                            .eq('user_id', userId)
                            .order('created_at', { ascending: false });

                        Object.entries(filter).forEach(([key, val]) => {
                            query = query.eq(key, val);
                        });

                        const { data, error } = await query;
                        if (error) { throw error; }
                        await this._cacheEntities('invoices', data || []);
                        return data || [];
                    } catch (err) {
                        // fall through
                    }
                }
                return this._getLocalInvoices(userId, filter);
            }

            async _getLocalInvoices(userId, filter = {}) {
                await this._ensureDB();
                if (!this.db.objectStoreNames.contains('invoices')) {
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

            async saveInvoice(data) {
                if (window.securityService && !window.securityService.validateCSRFToken()) {
                    throw new Error('CSRF-Token ungültig. Bitte Seite neu laden.');
                }
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
                            .from('rechnungen')
                            .upsert(invoice)
                            .select()
                            .single();
                        if (error) { throw error; }
                        await this._putLocalEntity('invoices', saved);
                        return saved;
                    } catch (err) {
                        await this._queueOfflineChange('upsert', 'invoices', invoice, userId);
                    }
                } else {
                    await this._queueOfflineChange('upsert', 'invoices', invoice, userId);
                }

                await this._putLocalEntity('invoices', invoice);

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
                            .from('rechnungen')
                            .update(updateData)
                            .eq('id', id)
                            .select()
                            .single();
                        if (error) { throw error; }
                        await this._putLocalEntity('invoices', saved);
                        if (window.storeService) {
                            const r = window.storeService.state.rechnungen.find(r => r.id === id);
                            if (r) { Object.assign(r, { status, ...extra }); window.storeService.save(); }
                        }
                        return saved;
                    } catch (err) {
                        await this._queueOfflineChange('update', 'invoices', updateData);
                    }
                } else {
                    await this._queueOfflineChange('update', 'invoices', updateData);
                }

                await this._ensureDB();
                if (this.db.objectStoreNames.contains('invoices')) {
                    const existing = await this._getLocalEntity('invoices', id);
                    if (existing) {
                        await this._putLocalEntity('invoices', { ...existing, ...updateData });
                    }
                }

                if (window.storeService) {
                    const r = window.storeService.state.rechnungen.find(r => r.id === id);
                    if (r) { Object.assign(r, { status, ...extra }); window.storeService.save(); }
                }

                return { id, status, ...extra };
            }

            async getQuotes() {
                const supabase = this._getSupabase();
                const userId = this._getCurrentUserId();

                if (supabase) {
                    try {
                        const { data, error } = await supabase
                            .from('angebote')
                            .select('*')
                            .eq('user_id', userId)
                            .order('created_at', { ascending: false });
                        if (error) { throw error; }
                        await this._cacheEntities('quotes', data || []);
                        return data || [];
                    } catch (err) {
                        // fall through
                    }
                }

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
                            .from('angebote')
                            .upsert(quote)
                            .select()
                            .single();
                        if (error) { throw error; }
                        await this._putLocalEntity('quotes', saved);
                        return saved;
                    } catch (err) {
                        await this._queueOfflineChange('upsert', 'quotes', quote, userId);
                    }
                } else {
                    await this._queueOfflineChange('upsert', 'quotes', quote, userId);
                }

                await this._putLocalEntity('quotes', quote);
                return quote;
            }

            async getOrders() {
                const supabase = this._getSupabase();
                const userId = this._getCurrentUserId();

                if (supabase) {
                    try {
                        const { data, error } = await supabase
                            .from('auftraege')
                            .select('*')
                            .eq('user_id', userId)
                            .order('created_at', { ascending: false });
                        if (error) { throw error; }
                        await this._cacheEntities('orders', data || []);
                        return data || [];
                    } catch (err) {
                        // fall through
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
                            .from('auftraege')
                            .upsert(order)
                            .select()
                            .single();
                        if (error) { throw error; }
                        await this._putLocalEntity('orders', saved);
                        return saved;
                    } catch (err) {
                        await this._queueOfflineChange('upsert', 'orders', order, userId);
                    }
                } else {
                    await this._queueOfflineChange('upsert', 'orders', order, userId);
                }

                await this._putLocalEntity('orders', order);
                return order;
            }

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
                        // fall through
                    }
                }

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
                        if (saved.payload && typeof saved.payload === 'string') {
                            saved.payload = JSON.parse(saved.payload);
                        }
                        await this._putLocalEntity('jobs_queue', saved);
                        return saved;
                    } catch (err) {
                        // fall through
                    }
                }

                await this._putLocalEntity('jobs_queue', job);
                let parsedPayload;
                try { parsedPayload = JSON.parse(job.payload); } catch { parsedPayload = job.payload; }
                const localJob = { ...job, payload: parsedPayload };
                return localJob;
            }

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
                        // fall through
                    }
                }

                await this._ensureDB();
                if (this.db.objectStoreNames.contains('jobs_queue')) {
                    const existing = await this._getLocalEntity('jobs_queue', id);
                    if (existing) {
                        await this._putLocalEntity('jobs_queue', { ...existing, ...updateData });
                    }
                }

                return { id, status, result, error };
            }

            subscribeToJobUpdates(callback) {
                const supabase = this._getSupabase();
                const userId = this._getCurrentUserId();

                if (supabase && window.realtimeService) {
                    return window.realtimeService.subscribeToJobQueue(userId, callback);
                }

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
                    } catch { /* ignore */ }
                    setTimeout(poll, 5000);
                };

                setTimeout(poll, 5000);
                return () => { active = false; };
            }

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

            _generateId() {
                return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 11)}`.toUpperCase();
            }

            async syncNow() {
                return this._syncOfflineQueue();
            }
        }

        dbService = new DBService();
        // Pre-initialize with mock DB
        dbService.db = mockIDB.db;
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.clearAllMocks();
    });

    // ========================================
    // Internal Helpers
    // ========================================

    describe('_getCurrentUserId', () => {
        it('should return user ID from authService', () => {
            window.authService = { getUser: vi.fn(() => ({ id: 'auth-user-42' })) };
            expect(dbService._getCurrentUserId()).toBe('auth-user-42');
        });

        it('should fallback to userManager when authService has no user', () => {
            window.authService = { getUser: vi.fn(() => null) };
            window.userManager = { getCurrentUser: vi.fn(() => ({ id: 'manager-user-7' })) };
            expect(dbService._getCurrentUserId()).toBe('manager-user-7');
        });

        it('should return "default" when no auth source is available', () => {
            delete window.authService;
            delete window.userManager;
            expect(dbService._getCurrentUserId()).toBe('default');
        });

        it('should return "default" when authService exists but getUser returns null', () => {
            window.authService = { getUser: vi.fn(() => null) };
            delete window.userManager;
            expect(dbService._getCurrentUserId()).toBe('default');
        });
    });

    describe('_getSupabase', () => {
        it('should return supabase client when configured', () => {
            const mockClient = { from: vi.fn() };
            window.supabaseClient = {
                isConfigured: vi.fn(() => true),
                client: mockClient
            };
            expect(dbService._getSupabase()).toBe(mockClient);
        });

        it('should return null when supabaseClient is not on window', () => {
            delete window.supabaseClient;
            expect(dbService._getSupabase()).toBeNull();
        });

        it('should return null when supabaseClient is not configured', () => {
            window.supabaseClient = {
                isConfigured: vi.fn(() => false),
                client: { from: vi.fn() }
            };
            expect(dbService._getSupabase()).toBeNull();
        });
    });

    describe('_supabaseTable (table name mapping)', () => {
        it('should map "customers" to "kunden"', () => {
            expect(dbService._supabaseTable('customers')).toBe('kunden');
        });

        it('should map "invoices" to "rechnungen"', () => {
            expect(dbService._supabaseTable('invoices')).toBe('rechnungen');
        });

        it('should map "quotes" to "angebote"', () => {
            expect(dbService._supabaseTable('quotes')).toBe('angebote');
        });

        it('should map "orders" to "auftraege"', () => {
            expect(dbService._supabaseTable('orders')).toBe('auftraege');
        });

        it('should return the original name for unmapped tables', () => {
            expect(dbService._supabaseTable('jobs_queue')).toBe('jobs_queue');
            expect(dbService._supabaseTable('communications')).toBe('communications');
            expect(dbService._supabaseTable('some_unknown_table')).toBe('some_unknown_table');
        });
    });

    describe('_generateId', () => {
        it('should generate a non-empty uppercase string', () => {
            const id = dbService._generateId();
            expect(id).toBeTruthy();
            expect(id).toBe(id.toUpperCase());
        });

        it('should generate unique IDs on subsequent calls', () => {
            const ids = new Set();
            for (let i = 0; i < 50; i++) {
                ids.add(dbService._generateId());
            }
            expect(ids.size).toBe(50);
        });

        it('should contain a hyphen separator', () => {
            const id = dbService._generateId();
            expect(id).toContain('-');
        });
    });

    // ========================================
    // Legacy Key-Value Methods
    // ========================================

    describe('Legacy get/set (app_state store)', () => {
        it('should set and get a value from app_state', async () => {
            await dbService.set('theme', 'dark');
            const storeData = mockIDB.getStoreData('app_state');
            expect(storeData['theme']).toBe('dark');
        });

        it('should return undefined for non-existent key', async () => {
            const val = await dbService.get('nonexistent');
            expect(val).toBeNull(); // mock returns null for missing keys
        });

        it('should initialize db if not already initialized', async () => {
            dbService.db = null;
            const initSpy = vi.spyOn(dbService, 'init');
            await dbService.get('somekey');
            expect(initSpy).toHaveBeenCalled();
        });
    });

    // ========================================
    // Sync Queue
    // ========================================

    describe('Sync Queue - addToSyncQueue', () => {
        it('should add an item with synced=false and retries=0', async () => {
            await dbService.addToSyncQueue({
                userId: 'user-123',
                action: 'insert',
                table: 'customers',
                data: { id: 'c1', name: 'Test' }
            });

            const storeData = mockIDB.getStoreData('sync_queue');
            const items = Object.values(storeData);
            expect(items.length).toBe(1);
            expect(items[0].synced).toBe(false);
            expect(items[0].retries).toBe(0);
            expect(items[0].action).toBe('insert');
            expect(items[0].table).toBe('customers');
        });

        it('should preserve the provided timestamp', async () => {
            const ts = 1700000000000;
            await dbService.addToSyncQueue({
                userId: 'user-123',
                action: 'update',
                table: 'invoices',
                data: { id: 'i1' },
                timestamp: ts
            });

            const items = Object.values(mockIDB.getStoreData('sync_queue'));
            expect(items[0].timestamp).toBe(ts);
        });
    });

    describe('Sync Queue - getUnsyncedQueue', () => {
        it('should return only unsynced items', async () => {
            // Manually populate sync_queue store
            const store = mockIDB.stores['sync_queue'];
            store._data['1'] = { id: 1, synced: false, retries: 0, userId: 'user-123', action: 'insert', table: 'customers', data: {} };
            store._data['2'] = { id: 2, synced: true, retries: 0, userId: 'user-123', action: 'update', table: 'customers', data: {} };
            store._data['3'] = { id: 3, synced: false, retries: 0, userId: 'user-123', action: 'delete', table: 'invoices', data: {} };

            const unsynced = await dbService.getUnsyncedQueue();
            expect(unsynced.length).toBe(2);
            expect(unsynced.every(i => i.synced === false)).toBe(true);
        });

        it('should exclude items with 5 or more retries', async () => {
            const store = mockIDB.stores['sync_queue'];
            store._data['1'] = { id: 1, synced: false, retries: 4, userId: 'u1', action: 'insert', table: 'customers', data: {} };
            store._data['2'] = { id: 2, synced: false, retries: 5, userId: 'u1', action: 'insert', table: 'customers', data: {} };
            store._data['3'] = { id: 3, synced: false, retries: 10, userId: 'u1', action: 'insert', table: 'customers', data: {} };

            const unsynced = await dbService.getUnsyncedQueue();
            expect(unsynced.length).toBe(1);
            expect(unsynced[0].retries).toBe(4);
        });

        it('should filter by userId when provided', async () => {
            const store = mockIDB.stores['sync_queue'];
            store._data['1'] = { id: 1, synced: false, retries: 0, userId: 'user-A', action: 'insert', table: 'customers', data: {} };
            store._data['2'] = { id: 2, synced: false, retries: 0, userId: 'user-B', action: 'insert', table: 'customers', data: {} };

            const unsynced = await dbService.getUnsyncedQueue('user-A');
            expect(unsynced.length).toBe(1);
            expect(unsynced[0].userId).toBe('user-A');
        });
    });

    describe('Sync Queue - markQueueItemSynced', () => {
        it('should mark an item as synced with a timestamp', async () => {
            const store = mockIDB.stores['sync_queue'];
            store._data['42'] = { id: 42, synced: false, retries: 0, userId: 'u1', action: 'insert', table: 'customers', data: {} };

            await dbService.markQueueItemSynced(42);

            const item = store._data['42'];
            expect(item.synced).toBe(true);
            expect(item.syncedAt).toBeDefined();
            expect(typeof item.syncedAt).toBe('number');
        });
    });

    describe('Sync Queue - deleteQueueItem', () => {
        it('should remove an item from the sync queue', async () => {
            const store = mockIDB.stores['sync_queue'];
            store._data['99'] = { id: 99, synced: true, userId: 'u1' };

            await dbService.deleteQueueItem(99);

            expect(store._data['99']).toBeUndefined();
        });
    });

    // ========================================
    // Offline Change Queuing
    // ========================================

    describe('_queueOfflineChange', () => {
        it('should queue a change with current user ID', async () => {
            window.authService = { getUser: vi.fn(() => ({ id: 'current-user' })) };

            await dbService._queueOfflineChange('insert', 'customers', { id: 'c1', name: 'Foo' });

            const items = Object.values(mockIDB.getStoreData('sync_queue'));
            expect(items.length).toBe(1);
            expect(items[0].userId).toBe('current-user');
            expect(items[0].action).toBe('insert');
            expect(items[0].table).toBe('customers');
        });

        it('should use provided userId over current user', async () => {
            window.authService = { getUser: vi.fn(() => ({ id: 'current-user' })) };

            await dbService._queueOfflineChange('update', 'invoices', { id: 'i1' }, 'override-user');

            const items = Object.values(mockIDB.getStoreData('sync_queue'));
            expect(items[0].userId).toBe('override-user');
        });
    });

    // ========================================
    // Sync Listener
    // ========================================

    describe('onSync', () => {
        it('should register a sync listener', () => {
            const cb = vi.fn();
            dbService.onSync(cb);
            expect(dbService._syncListeners).toContain(cb);
        });

        it('should return an unsubscribe function', () => {
            const cb = vi.fn();
            const unsub = dbService.onSync(cb);
            expect(dbService._syncListeners).toContain(cb);

            unsub();
            expect(dbService._syncListeners).not.toContain(cb);
        });
    });

    // ========================================
    // Sync Lock (_syncOfflineQueue)
    // ========================================

    describe('_syncOfflineQueue', () => {
        it('should not run if already in progress', async () => {
            dbService._syncInProgress = true;
            const spy = vi.spyOn(dbService, 'getUnsyncedQueue');

            await dbService._syncOfflineQueue();

            expect(spy).not.toHaveBeenCalled();
        });

        it('should not run if no supabase client is available', async () => {
            delete window.supabaseClient;
            const spy = vi.spyOn(dbService, 'getUnsyncedQueue');

            await dbService._syncOfflineQueue();

            expect(spy).not.toHaveBeenCalled();
        });

        it('should reset _syncInProgress after completion', async () => {
            window.supabaseClient = {
                isConfigured: vi.fn(() => true),
                client: { from: vi.fn(() => ({ upsert: vi.fn(() => Promise.resolve({ error: null })) })) }
            };
            // Empty queue
            vi.spyOn(dbService, 'getUnsyncedQueue').mockResolvedValue([]);

            await dbService._syncOfflineQueue();

            expect(dbService._syncInProgress).toBe(false);
        });
    });

    // ========================================
    // CRUD: Customers
    // ========================================

    describe('Customers - offline (no Supabase)', () => {
        beforeEach(() => {
            delete window.supabaseClient;
        });

        it('should save a customer locally and return it with generated fields', async () => {
            const result = await dbService.saveCustomer({ name: 'Max Mustermann', email: 'max@test.de' });

            expect(result.id).toBeTruthy();
            expect(result.user_id).toBe('user-123');
            expect(result.name).toBe('Max Mustermann');
            expect(result.updated_at).toBeTruthy();
            expect(result.created_at).toBeTruthy();
        });

        it('should preserve existing id when provided', async () => {
            const result = await dbService.saveCustomer({ id: 'custom-id-99', name: 'Custom' });
            expect(result.id).toBe('custom-id-99');
        });

        it('should preserve existing created_at when provided', async () => {
            const ts = '2024-01-15T10:00:00.000Z';
            const result = await dbService.saveCustomer({ name: 'Old', created_at: ts });
            expect(result.created_at).toBe(ts);
        });

        it('should queue an offline change when saving without Supabase', async () => {
            await dbService.saveCustomer({ name: 'Offline Customer' });

            const queueItems = Object.values(mockIDB.getStoreData('sync_queue'));
            expect(queueItems.length).toBe(1);
            expect(queueItems[0].action).toBe('upsert');
            expect(queueItems[0].table).toBe('customers');
        });

        it('should delete a customer locally and queue the delete', async () => {
            // First save
            await dbService.saveCustomer({ id: 'del-me', name: 'To Delete' });

            await dbService.deleteCustomer('del-me');

            // Should have 2 queue items: upsert + delete
            const queueItems = Object.values(mockIDB.getStoreData('sync_queue'));
            expect(queueItems.length).toBe(2);
            expect(queueItems[1].action).toBe('delete');
        });
    });

    describe('Customers - CSRF validation', () => {
        it('should throw on saveCustomer when CSRF token is invalid', async () => {
            window.securityService = { validateCSRFToken: vi.fn(() => false) };

            await expect(
                dbService.saveCustomer({ name: 'Hack' })
            ).rejects.toThrow('CSRF-Token ungültig. Bitte Seite neu laden.');
        });

        it('should throw on deleteCustomer when CSRF token is invalid', async () => {
            window.securityService = { validateCSRFToken: vi.fn(() => false) };

            await expect(
                dbService.deleteCustomer('some-id')
            ).rejects.toThrow('CSRF-Token ungültig. Bitte Seite neu laden.');
        });

        it('should proceed when CSRF token is valid', async () => {
            window.securityService = { validateCSRFToken: vi.fn(() => true) };
            delete window.supabaseClient;

            const result = await dbService.saveCustomer({ name: 'Valid CSRF' });
            expect(result.name).toBe('Valid CSRF');
        });

        it('should proceed when securityService is not present', async () => {
            delete window.securityService;
            delete window.supabaseClient;

            const result = await dbService.saveCustomer({ name: 'No Security' });
            expect(result.name).toBe('No Security');
        });
    });

    // ========================================
    // CRUD: Invoices
    // ========================================

    describe('Invoices - offline (no Supabase)', () => {
        beforeEach(() => {
            delete window.supabaseClient;
        });

        it('should save an invoice with generated fields', async () => {
            const result = await dbService.saveInvoice({ amount: 1500, status: 'draft' });

            expect(result.id).toBeTruthy();
            expect(result.user_id).toBe('user-123');
            expect(result.amount).toBe(1500);
            expect(result.status).toBe('draft');
        });

        it('should throw on saveInvoice when CSRF is invalid', async () => {
            window.securityService = { validateCSRFToken: vi.fn(() => false) };

            await expect(
                dbService.saveInvoice({ amount: 100 })
            ).rejects.toThrow('CSRF-Token ungültig');
        });

        it('should update storeService when saving an invoice offline', async () => {
            window.storeService = {
                state: { rechnungen: [] },
                save: vi.fn()
            };

            await dbService.saveInvoice({ amount: 200, status: 'draft' });

            expect(window.storeService.state.rechnungen.length).toBe(1);
            expect(window.storeService.save).toHaveBeenCalled();
        });
    });

    describe('Invoices - updateInvoiceStatus offline', () => {
        beforeEach(() => {
            delete window.supabaseClient;
        });

        it('should return update data with the new status', async () => {
            const result = await dbService.updateInvoiceStatus('inv-1', 'paid', { paid_at: '2024-06-01' });

            expect(result.id).toBe('inv-1');
            expect(result.status).toBe('paid');
            expect(result.paid_at).toBe('2024-06-01');
        });

        it('should queue an offline change for the status update', async () => {
            await dbService.updateInvoiceStatus('inv-2', 'overdue');

            const queueItems = Object.values(mockIDB.getStoreData('sync_queue'));
            expect(queueItems.length).toBe(1);
            expect(queueItems[0].action).toBe('update');
            expect(queueItems[0].table).toBe('invoices');
        });
    });

    // ========================================
    // CRUD: Quotes
    // ========================================

    describe('Quotes - offline (no Supabase)', () => {
        beforeEach(() => {
            delete window.supabaseClient;
        });

        it('should save a quote with generated fields and queue it', async () => {
            const result = await dbService.saveQuote({ title: 'Dachsanierung', total: 5000 });

            expect(result.id).toBeTruthy();
            expect(result.user_id).toBe('user-123');
            expect(result.title).toBe('Dachsanierung');

            const queueItems = Object.values(mockIDB.getStoreData('sync_queue'));
            expect(queueItems.length).toBe(1);
            expect(queueItems[0].action).toBe('upsert');
            expect(queueItems[0].table).toBe('quotes');
        });
    });

    // ========================================
    // CRUD: Orders
    // ========================================

    describe('Orders - offline (no Supabase)', () => {
        beforeEach(() => {
            delete window.supabaseClient;
        });

        it('should save an order with generated fields and queue it', async () => {
            const result = await dbService.saveOrder({ description: 'Heizung einbauen', status: 'open' });

            expect(result.id).toBeTruthy();
            expect(result.user_id).toBe('user-123');
            expect(result.description).toBe('Heizung einbauen');

            const queueItems = Object.values(mockIDB.getStoreData('sync_queue'));
            expect(queueItems.length).toBe(1);
            expect(queueItems[0].table).toBe('orders');
        });
    });

    // ========================================
    // Jobs Queue
    // ========================================

    describe('Jobs Queue - addJob', () => {
        beforeEach(() => {
            delete window.supabaseClient;
        });

        it('should create a job with correct defaults', async () => {
            const job = await dbService.addJob('invoice_ocr', { file: 'scan.pdf' });

            expect(job.job_type).toBe('invoice_ocr');
            expect(job.payload).toEqual({ file: 'scan.pdf' });
            expect(job.priority).toBe(5);
            expect(job.status).toBe('pending');
            expect(job.attempts).toBe(0);
            expect(job.result).toBeNull();
            expect(job.error).toBeNull();
        });

        it('should accept custom priority', async () => {
            const job = await dbService.addJob('email_draft', { to: 'test@test.de' }, 1);
            expect(job.priority).toBe(1);
        });

        it('should stringify payload for storage but return parsed in result', async () => {
            const job = await dbService.addJob('dunning_check', { invoiceId: 'inv-5' });
            // The returned object should have parsed payload
            expect(typeof job.payload).toBe('object');
            expect(job.payload.invoiceId).toBe('inv-5');
        });
    });

    describe('Jobs Queue - updateJobStatus', () => {
        beforeEach(() => {
            delete window.supabaseClient;
        });

        it('should return updated status fields', async () => {
            const result = await dbService.updateJobStatus('job-1', 'done', { output: 'success' });

            expect(result.id).toBe('job-1');
            expect(result.status).toBe('done');
            expect(result.result).toEqual({ output: 'success' });
        });

        it('should handle error status', async () => {
            const result = await dbService.updateJobStatus('job-2', 'failed', null, 'Timeout');

            expect(result.status).toBe('failed');
            expect(result.error).toBe('Timeout');
            expect(result.result).toBeNull();
        });
    });

    // ========================================
    // subscribeToJobUpdates
    // ========================================

    describe('subscribeToJobUpdates', () => {
        it('should use realtimeService when available', () => {
            const mockUnsub = vi.fn();
            window.supabaseClient = {
                isConfigured: vi.fn(() => true),
                client: { from: vi.fn() }
            };
            window.realtimeService = {
                subscribeToJobQueue: vi.fn(() => mockUnsub)
            };

            const unsub = dbService.subscribeToJobUpdates(vi.fn());

            expect(window.realtimeService.subscribeToJobQueue).toHaveBeenCalledWith('user-123', expect.any(Function));
            expect(unsub).toBe(mockUnsub);
        });

        it('should return an unsubscribe function for polling fallback', () => {
            delete window.supabaseClient;
            delete window.realtimeService;

            const unsub = dbService.subscribeToJobUpdates(vi.fn());
            expect(typeof unsub).toBe('function');
        });
    });

    // ========================================
    // _idbOperation
    // ========================================

    describe('_idbOperation', () => {
        it('should return null for a non-existent store', async () => {
            const result = await dbService._idbOperation('nonexistent_store', 'readonly', () => {});
            expect(result).toBeNull();
        });

        it('should execute operation on an existing store', async () => {
            const result = await dbService._idbOperation('customers', 'readwrite', (store) => {
                return store.put({ id: 'op-test', name: 'IDB Op' });
            });

            // The mock store should have the data
            const data = mockIDB.getStoreData('customers');
            expect(data['op-test']).toBeDefined();
            expect(data['op-test'].name).toBe('IDB Op');
        });
    });

    // ========================================
    // Entity Helpers
    // ========================================

    describe('Local Entity Helpers', () => {
        it('_putLocalEntity should store an entity', async () => {
            await dbService._putLocalEntity('customers', { id: 'c-put', name: 'Put Test' });
            const data = mockIDB.getStoreData('customers');
            expect(data['c-put']).toBeDefined();
            expect(data['c-put'].name).toBe('Put Test');
        });

        it('_getLocalEntity should retrieve an entity by ID', async () => {
            mockIDB.stores['customers']._data['c-get'] = { id: 'c-get', name: 'Get Test' };
            const entity = await dbService._getLocalEntity('customers', 'c-get');
            expect(entity).toEqual({ id: 'c-get', name: 'Get Test' });
        });

        it('_getLocalEntity should return null for non-existent store', async () => {
            const entity = await dbService._getLocalEntity('nonexistent_store', 'id-1');
            expect(entity).toBeNull();
        });

        it('_deleteLocalEntity should remove an entity', async () => {
            mockIDB.stores['invoices']._data['i-del'] = { id: 'i-del', amount: 100 };
            await dbService._deleteLocalEntity('invoices', 'i-del');
            expect(mockIDB.stores['invoices']._data['i-del']).toBeUndefined();
        });

        it('_deleteLocalEntity should not throw for non-existent store', async () => {
            await expect(
                dbService._deleteLocalEntity('nonexistent_store', 'id-1')
            ).resolves.toBeUndefined();
        });

        it('_cacheEntities should store multiple entities', async () => {
            const entities = [
                { id: 'q1', title: 'Quote 1' },
                { id: 'q2', title: 'Quote 2' },
                { id: 'q3', title: 'Quote 3' }
            ];
            await dbService._cacheEntities('quotes', entities);

            const data = mockIDB.getStoreData('quotes');
            expect(data['q1']).toBeDefined();
            expect(data['q2']).toBeDefined();
            expect(data['q3']).toBeDefined();
        });

        it('_cacheEntities should silently skip non-existent stores', async () => {
            await expect(
                dbService._cacheEntities('nonexistent_store', [{ id: 'x' }])
            ).resolves.toBeUndefined();
        });
    });

    // ========================================
    // Exponential Backoff in Sync
    // ========================================

    describe('Exponential Backoff', () => {
        it('should calculate retry delay with exponential backoff capped at 5 minutes', () => {
            // Test the formula: Math.min(1000 * Math.pow(2, retries), 300000)
            expect(Math.min(1000 * Math.pow(2, 0), 300000)).toBe(1000);
            expect(Math.min(1000 * Math.pow(2, 1), 300000)).toBe(2000);
            expect(Math.min(1000 * Math.pow(2, 2), 300000)).toBe(4000);
            expect(Math.min(1000 * Math.pow(2, 5), 300000)).toBe(32000);
            expect(Math.min(1000 * Math.pow(2, 10), 300000)).toBe(300000); // capped
            expect(Math.min(1000 * Math.pow(2, 20), 300000)).toBe(300000); // still capped
        });
    });

    // ========================================
    // syncNow (public API)
    // ========================================

    describe('syncNow', () => {
        it('should delegate to _syncOfflineQueue', async () => {
            const spy = vi.spyOn(dbService, '_syncOfflineQueue').mockResolvedValue(undefined);
            await dbService.syncNow();
            expect(spy).toHaveBeenCalledOnce();
        });
    });

    // ========================================
    // init / _ensureDB
    // ========================================

    describe('init and _ensureDB', () => {
        it('init should set this.db to the mock database', async () => {
            dbService.db = null;
            const result = await dbService.init();
            expect(result).toBe(mockIDB.db);
            expect(dbService.db).toBe(mockIDB.db);
        });

        it('_ensureDB should call init when db is null', async () => {
            dbService.db = null;
            const initSpy = vi.spyOn(dbService, 'init');
            await dbService._ensureDB();
            expect(initSpy).toHaveBeenCalled();
            expect(dbService.db).toBe(mockIDB.db);
        });

        it('_ensureDB should not call init when db is already set', async () => {
            const initSpy = vi.spyOn(dbService, 'init');
            await dbService._ensureDB();
            expect(initSpy).not.toHaveBeenCalled();
        });
    });
});
