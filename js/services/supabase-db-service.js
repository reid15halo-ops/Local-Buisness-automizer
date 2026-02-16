/* ============================================
   Supabase Database Service
   Cloud-Sync für alle Daten (Kunden, Angebote, etc.)
   Fallback auf localStorage wenn nicht konfiguriert
   ============================================ */

class SupabaseDBService {
    constructor() {
        this.tables = [
            'anfragen', 'angebote', 'auftraege', 'rechnungen',
            'kunden', 'materialien', 'buchungen', 'aufgaben',
            'termine', 'zeiteintraege', 'dokumente', 'emails'
        ];
    }

    getClient() {
        return window.supabaseConfig?.get();
    }

    isOnline() {
        return !!this.getClient() && window.authService?.isLoggedIn();
    }

    // ---- Generic CRUD ----

    async getAll(table, filters = {}) {
        if (!this.isOnline()) {return this._getLocal(table);}

        try {
            let query = this.getClient()
                .from(table)
                .select('*')
                .order('created_at', { ascending: false });

            // Apply filters
            Object.entries(filters).forEach(([key, value]) => {
                query = query.eq(key, value);
            });

            const { data, error } = await query;
            if (error) {throw error;}
            return data || [];
        } catch (err) {
            console.warn(`Supabase getAll(${table}) failed, using local:`, err.message);
            return this._getLocal(table);
        }
    }

    async getById(table, id) {
        if (!this.isOnline()) {return this._getLocalById(table, id);}

        try {
            const { data, error } = await this.getClient()
                .from(table)
                .select('*')
                .eq('id', id)
                .single();

            if (error) {throw error;}
            return data;
        } catch (err) {
            console.warn(`Supabase getById(${table}, ${id}) failed:`, err.message);
            return this._getLocalById(table, id);
        }
    }

    async create(table, record) {
        // Always save locally first (offline-first)
        this._saveLocal(table, record);

        if (!this.isOnline()) {return record;}

        try {
            const { data, error } = await this.getClient()
                .from(table)
                .insert([{
                    ...record,
                    user_id: window.authService.getUser()?.id
                }])
                .select()
                .single();

            if (error) {throw error;}
            return data;
        } catch (err) {
            console.warn(`Supabase create(${table}) failed, saved locally:`, err.message);
            this._addToSyncQueue(table, 'create', record);
            return record;
        }
    }

    async update(table, id, updates) {
        // Update locally first
        this._updateLocal(table, id, updates);

        if (!this.isOnline()) {return updates;}

        try {
            const { data, error } = await this.getClient()
                .from(table)
                .update(updates)
                .eq('id', id)
                .select()
                .single();

            if (error) {throw error;}
            return data;
        } catch (err) {
            console.warn(`Supabase update(${table}, ${id}) failed:`, err.message);
            this._addToSyncQueue(table, 'update', { id, ...updates });
            return updates;
        }
    }

    async delete(table, id) {
        this._deleteLocal(table, id);

        if (!this.isOnline()) {return;}

        try {
            const { error } = await this.getClient()
                .from(table)
                .delete()
                .eq('id', id);

            if (error) {throw error;}
        } catch (err) {
            console.warn(`Supabase delete(${table}, ${id}) failed:`, err.message);
            this._addToSyncQueue(table, 'delete', { id });
        }
    }

    // ---- Sync ----

    async syncAll() {
        if (!this.isOnline()) {return { synced: 0, errors: 0 };}

        const queue = this._getSyncQueue();
        let synced = 0;
        let errors = 0;

        for (const item of queue) {
            try {
                switch (item.action) {
                    case 'create':
                        await this.getClient()
                            .from(item.table)
                            .upsert([{
                                ...item.data,
                                user_id: window.authService.getUser()?.id
                            }]);
                        break;
                    case 'update':
                        await this.getClient()
                            .from(item.table)
                            .update(item.data)
                            .eq('id', item.data.id);
                        break;
                    case 'delete':
                        await this.getClient()
                            .from(item.table)
                            .delete()
                            .eq('id', item.data.id);
                        break;
                }
                synced++;
            } catch (err) {
                errors++;
                console.warn('Sync error:', err.message);
            }
        }

        if (synced > 0) {
            this._clearSyncQueue();
        }

        return { synced, errors };
    }

    // Upload all local data to Supabase (initial migration)
    async migrateToCloud() {
        if (!this.isOnline()) {throw new Error('Nicht eingeloggt');}

        const userId = window.authService.getUser()?.id;
        let migrated = 0;

        for (const table of this.tables) {
            const localData = this._getLocal(table);
            if (localData.length === 0) {continue;}

            const records = localData.map(record => ({
                ...record,
                user_id: userId,
                migrated_from_local: true
            }));

            try {
                const { error } = await this.getClient()
                    .from(table)
                    .upsert(records, { onConflict: 'id' });

                if (error) {
                    console.warn(`Migration ${table} error:`, error.message);
                } else {
                    migrated += records.length;
                }
            } catch (err) {
                console.warn(`Migration ${table} failed:`, err.message);
            }
        }

        return { migrated };
    }

    // ---- Local Storage Fallback ----

    _getLocal(table) {
        const store = window.storeService?.state;
        if (store && store[table]) {return store[table];}

        try {
            return JSON.parse(localStorage.getItem(`hwf_${table}`) || '[]');
        } catch {
            return [];
        }
    }

    _getLocalById(table, id) {
        const items = this._getLocal(table);
        return items.find(item => item.id === id) || null;
    }

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

    _updateLocal(table, id, updates) {
        const items = this._getLocal(table);
        const idx = items.findIndex(i => i.id === id);
        if (idx >= 0) {
            items[idx] = { ...items[idx], ...updates };
            localStorage.setItem(`hwf_${table}`, JSON.stringify(items));
        }
    }

    _deleteLocal(table, id) {
        const items = this._getLocal(table).filter(i => i.id !== id);
        localStorage.setItem(`hwf_${table}`, JSON.stringify(items));
    }

    // ---- Sync Queue ----

    _getSyncQueue() {
        try {
            return JSON.parse(localStorage.getItem('hwf_sync_queue') || '[]');
        } catch {
            return [];
        }
    }

    _addToSyncQueue(table, action, data) {
        const queue = this._getSyncQueue();
        queue.push({ table, action, data, timestamp: Date.now() });
        localStorage.setItem('hwf_sync_queue', JSON.stringify(queue));
    }

    _clearSyncQueue() {
        localStorage.removeItem('hwf_sync_queue');
    }

    getSyncQueueSize() {
        return this._getSyncQueue().length;
    }
}

window.supabaseDB = new SupabaseDBService();
