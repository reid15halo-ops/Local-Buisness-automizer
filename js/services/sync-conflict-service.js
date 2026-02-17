/* ============================================
   Sync Conflict Service
   Offline-first conflict detection and resolution.

   When the app reconnects after being offline,
   local and server data may have diverged. This
   service tracks those conflicts and provides
   simple resolution helpers (keep local, keep
   server, or merge field-by-field).

   Storage keys:
     mhs_sync_conflicts   – conflict records
     mhs_pending_changes  – local edits not yet pushed
     mhs_last_sync        – ISO timestamp of last sync
   ============================================ */

class SyncConflictService {
    constructor() {
        this.STORAGE_CONFLICTS  = 'mhs_sync_conflicts';
        this.STORAGE_PENDING    = 'mhs_pending_changes';
        this.STORAGE_LAST_SYNC  = 'mhs_last_sync';

        /** @type {Function[]} */
        this._subscribers = [];

        /** @type {boolean} */
        this._monitoring = false;

        /** Bound handlers so we can add/remove them cleanly */
        this._onOnlineBound  = this._onOnline.bind(this);
        this._onOfflineBound = this._onOffline.bind(this);

        /** Cached status (avoids repeated localStorage reads) */
        this._syncInProgress = false;

        // Start monitoring by default
        this.startMonitoring();
    }

    // ============================================
    //  ID Generation
    // ============================================

    _generateId() {
        const ts = Date.now();
        const rand = Math.random().toString(36).substring(2, 8);
        return `CNF-${ts}-${rand}`;
    }

    // ============================================
    //  Sync Status
    // ============================================

    /**
     * Returns the current SyncStatus object.
     * @returns {SyncStatus}
     */
    getSyncStatus() {
        return {
            isOnline:       this.isOnline(),
            lastSyncAt:     this.getLastSyncTime(),
            pendingChanges: this.getPendingChangesCount(),
            conflicts:      this.getUnresolvedConflicts().length,
            syncInProgress: this._syncInProgress
        };
    }

    /**
     * @returns {boolean}
     */
    isOnline() {
        return navigator.onLine;
    }

    /**
     * @returns {string|null} ISO string or null
     */
    getLastSyncTime() {
        return localStorage.getItem(this.STORAGE_LAST_SYNC) || null;
    }

    /**
     * Update the last-sync timestamp to now.
     */
    _setLastSyncTime() {
        const iso = new Date().toISOString();
        localStorage.setItem(this.STORAGE_LAST_SYNC, iso);
    }

    /**
     * @returns {number}
     */
    getPendingChangesCount() {
        return this.getPendingChanges().length;
    }

    // ============================================
    //  Conflict Management
    // ============================================

    /**
     * Create and store a new conflict.
     *
     * @param {Object} conflictData
     * @param {string} conflictData.entityType  'anfrage'|'angebot'|'auftrag'|'rechnung'|'kunde'
     * @param {string} conflictData.entityId
     * @param {string} conflictData.entityName  Human-readable name
     * @param {Object} conflictData.localVersion   { data, modifiedAt, modifiedBy }
     * @param {Object} conflictData.serverVersion  { data, modifiedAt, modifiedBy }
     * @param {Array}  [conflictData.conflictingFields]  Pre-computed diff (optional)
     * @param {Object} [conflictData.fieldLabels]  Map of field -> German label (used if conflictingFields absent)
     * @returns {SyncConflict} The created conflict record
     */
    addConflict(conflictData) {
        const now = new Date().toISOString();

        // Auto-generate diff when not supplied
        let fields = conflictData.conflictingFields;
        if (!fields && conflictData.localVersion && conflictData.serverVersion) {
            fields = this.generateDiff(
                conflictData.localVersion.data,
                conflictData.serverVersion.data,
                conflictData.fieldLabels || {}
            );
        }

        /** @type {SyncConflict} */
        const conflict = {
            id:                this._generateId(),
            entityType:        conflictData.entityType,
            entityId:          conflictData.entityId,
            entityName:        conflictData.entityName || conflictData.entityId,
            localVersion:      conflictData.localVersion,
            serverVersion:     conflictData.serverVersion,
            conflictingFields: fields || [],
            status:            'unresolved',
            resolution:        null,
            resolvedAt:        null,
            createdAt:         now
        };

        const conflicts = this._loadConflicts();
        conflicts.push(conflict);
        this._saveConflicts(conflicts);
        this._notify();
        return conflict;
    }

    /**
     * Return all conflicts (resolved and unresolved).
     * @returns {SyncConflict[]}
     */
    getConflicts() {
        return this._loadConflicts();
    }

    /**
     * Return only unresolved conflicts.
     * @returns {SyncConflict[]}
     */
    getUnresolvedConflicts() {
        return this._loadConflicts().filter(c => c.status === 'unresolved');
    }

    /**
     * Fetch a single conflict by id.
     * @param {string} id
     * @returns {SyncConflict|null}
     */
    getConflict(id) {
        return this._loadConflicts().find(c => c.id === id) || null;
    }

    // ============================================
    //  Resolution
    // ============================================

    /**
     * Resolve a conflict by keeping the local version.
     * @param {string} conflictId
     * @returns {SyncConflict|null}
     */
    resolveWithLocal(conflictId) {
        return this._resolveConflict(conflictId, 'local');
    }

    /**
     * Resolve a conflict by keeping the server version.
     * @param {string} conflictId
     * @returns {SyncConflict|null}
     */
    resolveWithServer(conflictId) {
        return this._resolveConflict(conflictId, 'server');
    }

    /**
     * Resolve a conflict with a custom merged dataset.
     * @param {string} conflictId
     * @param {Object} mergedData  The final merged data to use
     * @returns {SyncConflict|null}
     */
    resolveWithMerge(conflictId, mergedData) {
        return this._resolveConflict(conflictId, 'merged', mergedData);
    }

    /**
     * Batch-resolve all unresolved conflicts with the local version.
     * @returns {number} Number of resolved conflicts
     */
    resolveAllWithLocal() {
        const unresolved = this.getUnresolvedConflicts();
        unresolved.forEach(c => this._resolveConflict(c.id, 'local'));
        return unresolved.length;
    }

    /**
     * Batch-resolve all unresolved conflicts with the server version.
     * @returns {number} Number of resolved conflicts
     */
    resolveAllWithServer() {
        const unresolved = this.getUnresolvedConflicts();
        unresolved.forEach(c => this._resolveConflict(c.id, 'server'));
        return unresolved.length;
    }

    /**
     * Internal resolver — mutates and persists the conflict.
     * @private
     */
    _resolveConflict(conflictId, resolution, mergedData) {
        const conflicts = this._loadConflicts();
        const idx = conflicts.findIndex(c => c.id === conflictId);
        if (idx === -1) { return null; }

        const conflict = conflicts[idx];
        conflict.status     = 'resolved';
        conflict.resolution = resolution;
        conflict.resolvedAt = new Date().toISOString();

        if (resolution === 'merged' && mergedData) {
            conflict.mergedData = mergedData;
        }

        this._saveConflicts(conflicts);
        this._notify();
        return conflict;
    }

    // ============================================
    //  Diff Generation
    // ============================================

    /**
     * Compare two data objects and return an array of conflictingFields.
     *
     * @param {Object} localData
     * @param {Object} serverData
     * @param {Object} fieldLabels  Map of field name -> German label
     * @returns {Array<{field:string, fieldLabel:string, localValue:any, serverValue:any}>}
     */
    generateDiff(localData, serverData, fieldLabels) {
        if (!localData || !serverData) { return []; }

        const labels = fieldLabels || {};
        const allKeys = new Set([
            ...Object.keys(localData),
            ...Object.keys(serverData)
        ]);

        const diffs = [];
        for (const key of allKeys) {
            // Skip internal / meta fields
            if (key.startsWith('_') || key === 'id' || key === 'user_id') { continue; }

            const lv = localData[key];
            const sv = serverData[key];

            if (!this._deepEqual(lv, sv)) {
                diffs.push({
                    field:       key,
                    fieldLabel:  labels[key] || this._humanizeField(key),
                    localValue:  lv,
                    serverValue: sv
                });
            }
        }

        return diffs;
    }

    /**
     * Simple deep equality (handles primitives, arrays, plain objects).
     * @private
     */
    _deepEqual(a, b) {
        if (a === b) { return true; }
        if (a == null || b == null) { return false; }
        if (typeof a !== typeof b) { return false; }

        if (Array.isArray(a) && Array.isArray(b)) {
            if (a.length !== b.length) { return false; }
            return a.every((v, i) => this._deepEqual(v, b[i]));
        }

        if (typeof a === 'object') {
            const keysA = Object.keys(a);
            const keysB = Object.keys(b);
            if (keysA.length !== keysB.length) { return false; }
            return keysA.every(k => this._deepEqual(a[k], b[k]));
        }

        return false;
    }

    /**
     * Convert a snake_case or camelCase field name to a simple label.
     * e.g. "customer_name" -> "Customer Name", "totalAmount" -> "Total Amount"
     * @private
     */
    _humanizeField(field) {
        return field
            .replace(/_/g, ' ')
            .replace(/([a-z])([A-Z])/g, '$1 $2')
            .replace(/\b\w/g, c => c.toUpperCase());
    }

    // ============================================
    //  Pending Changes
    // ============================================

    /**
     * Track a local change that needs to be synced.
     *
     * @param {string} entityType  'anfrage'|'angebot'|'auftrag'|'rechnung'|'kunde'
     * @param {string} entityId
     * @param {Object} data        The changed data
     */
    trackLocalChange(entityType, entityId, data) {
        const changes = this.getPendingChanges();
        const now = new Date().toISOString();

        // If a change for the same entity already exists, update it
        const existingIdx = changes.findIndex(
            c => c.entityType === entityType && c.entityId === entityId
        );

        const entry = {
            entityType,
            entityId,
            entityName: data.name || data.kunde || data.firmenname || data.bezeichnung || entityId,
            data,
            changedAt: now
        };

        if (existingIdx >= 0) {
            changes[existingIdx] = entry;
        } else {
            changes.push(entry);
        }

        this._savePendingChanges(changes);
        this._notify();
    }

    /**
     * @returns {Array} List of pending changes
     */
    getPendingChanges() {
        try {
            return JSON.parse(localStorage.getItem(this.STORAGE_PENDING) || '[]');
        } catch {
            return [];
        }
    }

    /**
     * Clear all pending changes (e.g. after successful sync).
     */
    clearPendingChanges() {
        localStorage.removeItem(this.STORAGE_PENDING);
        this._notify();
    }

    // ============================================
    //  Online / Offline Monitoring
    // ============================================

    /**
     * Start listening to browser online/offline events.
     */
    startMonitoring() {
        if (this._monitoring) { return; }
        this._monitoring = true;
        window.addEventListener('online',  this._onOnlineBound);
        window.addEventListener('offline', this._onOfflineBound);
    }

    /**
     * Stop listening.
     */
    stopMonitoring() {
        if (!this._monitoring) { return; }
        this._monitoring = false;
        window.removeEventListener('online',  this._onOnlineBound);
        window.removeEventListener('offline', this._onOfflineBound);
    }

    /** @private */
    _onOnline() {
        console.log('[SyncConflict] Wieder online');
        this._notify();
        // Auto-trigger sync attempt
        this.requestSync();
    }

    /** @private */
    _onOffline() {
        console.log('[SyncConflict] Offline');
        this._notify();
    }

    // ============================================
    //  Sync Trigger
    // ============================================

    /**
     * Request a sync attempt. This coordinates with the existing
     * SyncService if available and updates the internal state.
     */
    async requestSync() {
        if (!this.isOnline()) {
            console.warn('[SyncConflict] Sync nicht moeglich: offline');
            return;
        }

        if (this._syncInProgress) {
            console.warn('[SyncConflict] Sync laeuft bereits');
            return;
        }

        this._syncInProgress = true;
        this._notify();

        try {
            // Delegate to existing SyncService if present
            if (window.syncService && typeof window.syncService.processSyncQueue === 'function') {
                await window.syncService.processSyncQueue();
            }

            // After sync, clear pending changes that were successfully pushed
            // (In a real integration the sync service would report which items succeeded)
            this.clearPendingChanges();
            this._setLastSyncTime();
        } catch (err) {
            console.error('[SyncConflict] Sync fehlgeschlagen:', err);
        } finally {
            this._syncInProgress = false;
            this._notify();
        }
    }

    // ============================================
    //  Event System
    // ============================================

    /**
     * Subscribe to conflict/status changes.
     * Callback receives the current SyncStatus.
     *
     * @param {Function} callback
     * @returns {Function} Unsubscribe function
     */
    subscribe(callback) {
        if (typeof callback !== 'function') { return () => {}; }
        this._subscribers.push(callback);
        return () => {
            this._subscribers = this._subscribers.filter(fn => fn !== callback);
        };
    }

    /** @private */
    _notify() {
        const status = this.getSyncStatus();
        for (const fn of this._subscribers) {
            try {
                fn(status);
            } catch (err) {
                console.error('[SyncConflict] Subscriber error:', err);
            }
        }
    }

    // ============================================
    //  LocalStorage Helpers
    // ============================================

    /** @private */
    _loadConflicts() {
        try {
            return JSON.parse(localStorage.getItem(this.STORAGE_CONFLICTS) || '[]');
        } catch {
            return [];
        }
    }

    /** @private */
    _saveConflicts(conflicts) {
        localStorage.setItem(this.STORAGE_CONFLICTS, JSON.stringify(conflicts));
    }

    /** @private */
    _savePendingChanges(changes) {
        localStorage.setItem(this.STORAGE_PENDING, JSON.stringify(changes));
    }
}

// Global instance
window.syncConflictService = new SyncConflictService();
