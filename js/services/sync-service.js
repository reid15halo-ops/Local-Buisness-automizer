/* ============================================
   Sync Service - Lightweight Sync Layer

   Handles offline-first sync for new entities:
   - Purchase Orders
   - Stock Movements
   - Material Reservations
   - Suppliers
   - Communication Log

   Pattern: Save locally first (immediate), queue for Supabase,
   push on reconnect, pull on load if newer.
   ============================================ */

class SyncService {
    constructor() {
        this.newTables = [
            'purchase_orders',
            'stock_movements',
            'material_reservations',
            'suppliers',
            'communication_log'
        ];

        // Track per-table sync timestamps
        this.lastSyncTimes = this._loadLastSyncTimes();

        // Listen for online/offline events
        window.addEventListener('online', () => this._onOnline());
        window.addEventListener('offline', () => this._onOffline());
    }

    // ---- Main Public API ----

    /**
     * Save entity to local storage and queue for Supabase sync
     * Returns the record with id
     */
    async syncEntity(table, data) {
        if (!this._isValidTable(table)) {
            throw new Error(`Invalid table: ${table}`);
        }

        // Always save locally first (offline-first)
        this._saveLocal(table, data);

        // Queue for Supabase if online or add to sync queue
        if (this._isOnline()) {
            try {
                const result = await this._pushToSupabase(table, 'upsert', data);
                this._updateLastSyncTime(table);
                return result;
            } catch (err) {
                console.warn(`Supabase upsert failed, queued for sync:`, err.message);
                this._queueForSync(table, 'upsert', data);
                return data;
            }
        } else {
            this._queueForSync(table, 'upsert', data);
            return data;
        }
    }

    /**
     * Fetch entity from Supabase, fallback to local if offline
     */
    async pullEntity(table, userId, filters = {}) {
        if (!this._isValidTable(table)) {
            throw new Error(`Invalid table: ${table}`);
        }

        if (this._isOnline()) {
            try {
                const data = await this._pullFromSupabase(table, userId, filters);
                this._updateLastSyncTime(table);
                // Update local cache with fresh data
                const localItems = this._getLocal(table);
                const merged = this._mergeData(localItems, data);
                localStorage.setItem(`hwf_${table}`, JSON.stringify(merged));
                return data;
            } catch (err) {
                console.warn(`Supabase pull failed, using local:`, err.message);
                return this._getLocal(table);
            }
        } else {
            return this._getLocal(table);
        }
    }

    /**
     * Queue an action for later sync
     */
    queueForSync(table, action, data) {
        if (!this._isValidTable(table)) {
            throw new Error(`Invalid table: ${table}`);
        }
        this._queueForSync(table, action, data);
    }

    /**
     * Process all queued items (call on reconnect)
     */
    async processSyncQueue() {
        if (!this._isOnline()) {
            console.warn('Cannot sync: offline');
            return { synced: 0, errors: 0 };
        }

        const queue = this._getSyncQueue();
        if (queue.length === 0) {
            return { synced: 0, errors: 0 };
        }

        console.log(`Processing ${queue.length} queued sync items...`);

        let synced = 0;
        let errors = 0;

        for (const item of queue) {
            try {
                await this._pushToSupabase(item.table, item.action, item.data);
                synced++;
            } catch (err) {
                errors++;
                console.error(`Sync error for ${item.table}:`, err.message);
            }
        }

        if (synced > 0) {
            this._clearSyncQueue();
            console.log(`Sync complete: ${synced} synced, ${errors} errors`);
        }

        return { synced, errors };
    }

    /**
     * Get last sync timestamp for a table
     */
    getLastSyncTime(table) {
        if (!this._isValidTable(table)) {
            throw new Error(`Invalid table: ${table}`);
        }
        return this.lastSyncTimes[table] || null;
    }

    /**
     * Perform full data pull from Supabase (e.g., on first login)
     */
    async pullAllEntities(userId) {
        if (!this._isOnline()) {
            throw new Error('Cannot pull: offline');
        }

        let pulled = 0;
        for (const table of this.newTables) {
            try {
                const data = await this.pullEntity(table, userId);
                pulled += data.length;
            } catch (err) {
                console.warn(`Failed to pull ${table}:`, err.message);
            }
        }

        return { pulled };
    }

    /**
     * Get sync queue stats
     */
    getSyncQueueSize() {
        return this._getSyncQueue().length;
    }

    /**
     * Get local data for a table
     */
    getLocalData(table) {
        if (!this._isValidTable(table)) {
            throw new Error(`Invalid table: ${table}`);
        }
        return this._getLocal(table);
    }

    // ---- Private Helpers ----

    _isValidTable(table) {
        return this.newTables.includes(table);
    }

    _isOnline() {
        return window.navigator.onLine && window.supabaseConfig?.get() && window.authService?.isLoggedIn();
    }

    /**
     * Push changes to Supabase
     */
    async _pushToSupabase(table, action, data) {
        const client = window.supabaseConfig?.get();
        if (!client) {
            throw new Error('Supabase not configured');
        }

        const userId = window.authService?.getUser()?.id;
        if (!userId) {
            throw new Error('Not authenticated');
        }

        const record = {
            ...data,
            user_id: userId
        };

        switch (action) {
            case 'upsert':
            case 'create':
                const { data: inserted, error: insertErr } = await client
                    .from(table)
                    .upsert([record], { onConflict: 'id' })
                    .select();
                if (insertErr) {throw insertErr;}
                return inserted?.[0] || record;

            case 'update':
                const { data: updated, error: updateErr } = await client
                    .from(table)
                    .update(record)
                    .eq('id', data.id)
                    .select();
                if (updateErr) {throw updateErr;}
                return updated?.[0] || record;

            case 'delete':
                const { error: deleteErr } = await client
                    .from(table)
                    .delete()
                    .eq('id', data.id);
                if (deleteErr) {throw deleteErr;}
                return null;

            default:
                throw new Error(`Unknown action: ${action}`);
        }
    }

    /**
     * Pull data from Supabase
     */
    async _pullFromSupabase(table, userId, filters = {}) {
        const client = window.supabaseConfig?.get();
        if (!client) {
            throw new Error('Supabase not configured');
        }

        let query = client
            .from(table)
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        // Apply additional filters
        Object.entries(filters).forEach(([key, value]) => {
            query = query.eq(key, value);
        });

        const { data, error } = await query;
        if (error) {throw error;}

        return data || [];
    }

    /**
     * Save to local storage
     */
    _saveLocal(table, record) {
        const items = this._getLocal(table);
        const existingIdx = items.findIndex(i => i.id === record.id);

        if (existingIdx >= 0) {
            items[existingIdx] = { ...items[existingIdx], ...record };
        } else {
            items.push(record);
        }

        localStorage.setItem(`hwf_${table}`, JSON.stringify(items));
    }

    /**
     * Get from local storage
     */
    _getLocal(table) {
        try {
            return JSON.parse(localStorage.getItem(`hwf_${table}`) || '[]');
        } catch {
            return [];
        }
    }

    /**
     * Merge local and remote data (prefer remote if newer)
     */
    _mergeData(local, remote) {
        const remoteMap = new Map(remote.map(r => [r.id, r]));

        // Start with remote data
        const merged = [...remote];

        // Add/update with local items that are newer or not in remote
        for (const item of local) {
            const remoteItem = remoteMap.get(item.id);
            if (!remoteItem || new Date(item.updated_at || item.created_at) > new Date(remoteItem.updated_at || remoteItem.created_at)) {
                const idx = merged.findIndex(m => m.id === item.id);
                if (idx >= 0) {
                    merged[idx] = item;
                } else {
                    merged.push(item);
                }
            }
        }

        return merged;
    }

    // ---- Sync Queue Management ----

    _queueForSync(table, action, data) {
        const queue = this._getSyncQueue();
        queue.push({
            table,
            action,
            data,
            timestamp: Date.now()
        });
        localStorage.setItem('hwf_sync_queue', JSON.stringify(queue));
    }

    _getSyncQueue() {
        try {
            return JSON.parse(localStorage.getItem('hwf_sync_queue') || '[]');
        } catch {
            return [];
        }
    }

    _clearSyncQueue() {
        localStorage.removeItem('hwf_sync_queue');
    }

    // ---- Last Sync Time Tracking ----

    _loadLastSyncTimes() {
        try {
            return JSON.parse(localStorage.getItem('hwf_last_sync_times') || '{}');
        } catch {
            return {};
        }
    }

    _updateLastSyncTime(table) {
        this.lastSyncTimes[table] = new Date().toISOString();
        localStorage.setItem('hwf_last_sync_times', JSON.stringify(this.lastSyncTimes));
    }

    // ---- Event Handlers ----

    async _onOnline() {
        console.log('Back online - processing sync queue...');
        await this.processSyncQueue();
    }

    _onOffline() {
        console.log('Offline - will sync when reconnected');
    }
}

// Global instance
window.syncService = new SyncService();
