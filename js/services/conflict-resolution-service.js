/* ============================================
   Conflict Resolution Service

   Detects and manages sync conflicts between
   local (offline) and remote (Supabase) data.

   Features:
   - Field-level conflict detection with timestamps
   - Multiple resolution strategies (local-wins, remote-wins, manual)
   - Conflict storage and history tracking
   - Batch resolution for bulk operations
   - Auto-resolve configurable per user preference
   - CustomEvent dispatch for UI notifications

   Storage: localStorage key 'freyai_sync_conflicts'
   ============================================ */

class ConflictResolutionService {
    constructor() {
        this.STORAGE_KEY = 'freyai_sync_conflicts';
        this.SETTINGS_KEY = 'freyai_conflict_settings';
        this.conflicts = [];

        // Fields to ignore during conflict comparison (metadata only)
        this.ignoredFields = ['user_id', 'created_at', 'id'];

        // Load persisted conflicts
        this._loadConflicts();
    }

    // ---- Conflict Detection ----

    /**
     * Compare local and remote records to detect field-level conflicts.
     * @param {string} table - Table name
     * @param {Object} localRecord - The locally-stored version
     * @param {Object} remoteRecord - The server version
     * @returns {{ hasConflict: boolean, fields: Array<{ field: string, localValue: any, remoteValue: any, localTimestamp: string, remoteTimestamp: string }> }}
     */
    detectConflict(table, localRecord, remoteRecord) {
        try {
            if (!localRecord || !remoteRecord) {
                return { hasConflict: false, fields: [] };
            }

            const localTimestamp = localRecord.updated_at || localRecord.created_at || null;
            const remoteTimestamp = remoteRecord.updated_at || remoteRecord.created_at || null;

            // Gather all field keys from both records
            const allFields = new Set([
                ...Object.keys(localRecord),
                ...Object.keys(remoteRecord)
            ]);

            const conflictingFields = [];

            for (const field of allFields) {
                // Skip metadata fields
                if (this.ignoredFields.includes(field)) {
                    continue;
                }

                const localValue = localRecord[field];
                const remoteValue = remoteRecord[field];

                // Deep compare values
                if (!this._valuesEqual(localValue, remoteValue)) {
                    conflictingFields.push({
                        field,
                        localValue,
                        remoteValue,
                        localTimestamp,
                        remoteTimestamp
                    });
                }
            }

            return {
                hasConflict: conflictingFields.length > 0,
                fields: conflictingFields
            };
        } catch (err) {
            console.error('ConflictResolutionService: Error detecting conflict:', err);
            return { hasConflict: false, fields: [] };
        }
    }

    // ---- Conflict Storage ----

    /**
     * Store a detected conflict for user resolution.
     * @param {{ table: string, recordId: string, recordTitle: string, localRecord: Object, remoteRecord: Object, conflictingFields: Array }} conflictData
     * @returns {Object} The created conflict entry
     */
    addConflict(conflictData) {
        try {
            const conflict = {
                id: this._generateId(),
                table: conflictData.table,
                recordId: conflictData.recordId,
                recordTitle: conflictData.recordTitle || this._deriveRecordTitle(conflictData.localRecord, conflictData.remoteRecord),
                detectedAt: new Date().toISOString(),
                localRecord: conflictData.localRecord,
                remoteRecord: conflictData.remoteRecord,
                conflictingFields: conflictData.conflictingFields || [],
                status: 'pending',
                resolvedAt: null,
                resolution: null
            };

            // Avoid duplicates for the same table + recordId
            const existingIdx = this.conflicts.findIndex(
                c => c.table === conflict.table && c.recordId === conflict.recordId && c.status === 'pending'
            );

            if (existingIdx >= 0) {
                // Update existing pending conflict with fresh data
                this.conflicts[existingIdx] = {
                    ...this.conflicts[existingIdx],
                    detectedAt: conflict.detectedAt,
                    localRecord: conflict.localRecord,
                    remoteRecord: conflict.remoteRecord,
                    conflictingFields: conflict.conflictingFields
                };
            } else {
                this.conflicts.push(conflict);
            }

            this._saveConflicts();
            this._dispatchEvent('conflict-added', { conflict });

            return conflict;
        } catch (err) {
            console.error('ConflictResolutionService: Error adding conflict:', err);
            return null;
        }
    }

    // ---- Resolution Strategies ----

    /**
     * Resolve a conflict by keeping the local version.
     * @param {string} conflictId
     * @returns {Object|null} The resolved record, or null on failure
     */
    resolveKeepLocal(conflictId) {
        try {
            const conflict = this._findConflict(conflictId);
            if (!conflict) {
                console.warn('ConflictResolutionService: Conflict not found:', conflictId);
                return null;
            }

            conflict.status = 'resolved';
            conflict.resolvedAt = new Date().toISOString();
            conflict.resolution = 'keep-local';

            const resolvedRecord = { ...conflict.localRecord };

            this._saveConflicts();
            this._applyResolution(conflict.table, resolvedRecord);
            this._dispatchEvent('conflict-resolved', { conflict, resolvedRecord });

            return resolvedRecord;
        } catch (err) {
            console.error('ConflictResolutionService: Error resolving (keep local):', err);
            return null;
        }
    }

    /**
     * Resolve a conflict by keeping the remote/server version.
     * @param {string} conflictId
     * @returns {Object|null} The resolved record, or null on failure
     */
    resolveKeepRemote(conflictId) {
        try {
            const conflict = this._findConflict(conflictId);
            if (!conflict) {
                console.warn('ConflictResolutionService: Conflict not found:', conflictId);
                return null;
            }

            conflict.status = 'resolved';
            conflict.resolvedAt = new Date().toISOString();
            conflict.resolution = 'keep-remote';

            const resolvedRecord = { ...conflict.remoteRecord };

            this._saveConflicts();
            this._applyResolution(conflict.table, resolvedRecord);
            this._dispatchEvent('conflict-resolved', { conflict, resolvedRecord });

            return resolvedRecord;
        } catch (err) {
            console.error('ConflictResolutionService: Error resolving (keep remote):', err);
            return null;
        }
    }

    /**
     * Resolve a conflict with a user-composed merged record.
     * The mergedRecord should contain the user's chosen value for each field.
     * @param {string} conflictId
     * @param {Object} mergedRecord - The manually merged record
     * @returns {Object|null} The resolved record, or null on failure
     */
    resolveManualMerge(conflictId, mergedRecord) {
        try {
            const conflict = this._findConflict(conflictId);
            if (!conflict) {
                console.warn('ConflictResolutionService: Conflict not found:', conflictId);
                return null;
            }

            conflict.status = 'resolved';
            conflict.resolvedAt = new Date().toISOString();
            conflict.resolution = 'manual-merge';

            // Ensure the record retains the correct id
            const resolvedRecord = {
                ...conflict.localRecord,
                ...mergedRecord,
                id: conflict.recordId
            };

            this._saveConflicts();
            this._applyResolution(conflict.table, resolvedRecord);
            this._dispatchEvent('conflict-resolved', { conflict, resolvedRecord });

            return resolvedRecord;
        } catch (err) {
            console.error('ConflictResolutionService: Error resolving (manual merge):', err);
            return null;
        }
    }

    /**
     * Batch resolve all pending conflicts by keeping local versions.
     * @returns {number} Number of conflicts resolved
     */
    resolveAllKeepLocal() {
        try {
            const pending = this.getPendingConflicts();
            let resolved = 0;

            for (const conflict of pending) {
                if (this.resolveKeepLocal(conflict.id)) {
                    resolved++;
                }
            }

            this._dispatchEvent('conflicts-batch-resolved', { count: resolved, strategy: 'keep-local' });
            return resolved;
        } catch (err) {
            console.error('ConflictResolutionService: Error in batch resolve (local):', err);
            return 0;
        }
    }

    /**
     * Batch resolve all pending conflicts by keeping remote versions.
     * @returns {number} Number of conflicts resolved
     */
    resolveAllKeepRemote() {
        try {
            const pending = this.getPendingConflicts();
            let resolved = 0;

            for (const conflict of pending) {
                if (this.resolveKeepRemote(conflict.id)) {
                    resolved++;
                }
            }

            this._dispatchEvent('conflicts-batch-resolved', { count: resolved, strategy: 'keep-remote' });
            return resolved;
        } catch (err) {
            console.error('ConflictResolutionService: Error in batch resolve (remote):', err);
            return 0;
        }
    }

    // ---- Queries ----

    /**
     * Get all unresolved (pending) conflicts.
     * @returns {Array} Pending conflict entries
     */
    getPendingConflicts() {
        return this.conflicts.filter(c => c.status === 'pending');
    }

    /**
     * Get resolved conflict history.
     * @returns {Array} Resolved conflict entries, newest first
     */
    getConflictHistory() {
        return this.conflicts
            .filter(c => c.status === 'resolved')
            .sort((a, b) => new Date(b.resolvedAt) - new Date(a.resolvedAt));
    }

    /**
     * Get the number of pending conflicts (for badge display).
     * @returns {number}
     */
    getConflictCount() {
        return this.getPendingConflicts().length;
    }

    /**
     * Get a single conflict by ID.
     * @param {string} conflictId
     * @returns {Object|null}
     */
    getConflict(conflictId) {
        return this._findConflict(conflictId) || null;
    }

    // ---- Auto-Resolution Settings ----

    /**
     * Set the auto-resolve strategy.
     * @param {'local-wins'|'remote-wins'|'manual'} strategy
     */
    setAutoResolveStrategy(strategy) {
        try {
            const validStrategies = ['local-wins', 'remote-wins', 'manual'];
            if (!validStrategies.includes(strategy)) {
                console.warn('ConflictResolutionService: Invalid strategy:', strategy);
                return;
            }

            const settings = this._loadSettings();
            settings.autoResolveStrategy = strategy;
            this._saveSettings(settings);

            this._dispatchEvent('conflict-settings-changed', { strategy });
        } catch (err) {
            console.error('ConflictResolutionService: Error setting strategy:', err);
        }
    }

    /**
     * Get the current auto-resolve strategy. Defaults to 'manual'.
     * @returns {'local-wins'|'remote-wins'|'manual'}
     */
    getAutoResolveStrategy() {
        try {
            const settings = this._loadSettings();
            return settings.autoResolveStrategy || 'manual';
        } catch {
            return 'manual';
        }
    }

    // ---- Cleanup ----

    /**
     * Remove resolved conflicts older than the given number of days.
     * @param {number} olderThanDays - Remove resolved conflicts older than this many days
     * @returns {number} Number of conflicts removed
     */
    clearResolvedConflicts(olderThanDays = 30) {
        try {
            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - olderThanDays);

            const before = this.conflicts.length;
            this.conflicts = this.conflicts.filter(c => {
                if (c.status !== 'resolved') {
                    return true; // Keep all pending conflicts
                }
                return new Date(c.resolvedAt) > cutoff;
            });

            this._saveConflicts();

            const removed = before - this.conflicts.length;
            if (removed > 0) {
                console.log(`ConflictResolutionService: Cleared ${removed} old resolved conflicts`);
            }
            return removed;
        } catch (err) {
            console.error('ConflictResolutionService: Error clearing resolved conflicts:', err);
            return 0;
        }
    }

    // ---- Private Helpers ----

    /**
     * Deep-compare two values for equality.
     */
    _valuesEqual(a, b) {
        // Both null/undefined
        if (a == null && b == null) {
            return true;
        }
        // One null/undefined
        if (a == null || b == null) {
            return false;
        }
        // Primitive types
        if (typeof a !== 'object' && typeof b !== 'object') {
            return String(a) === String(b);
        }
        // Object/Array comparison via JSON
        try {
            return JSON.stringify(a) === JSON.stringify(b);
        } catch {
            return false;
        }
    }

    /**
     * Try to derive a human-readable title for the conflicting record.
     */
    _deriveRecordTitle(localRecord, remoteRecord) {
        const record = localRecord || remoteRecord || {};
        return record.name
            || record.title
            || record.nummer
            || record.po_nummer
            || record.description
            || record.bezeichnung
            || record.id
            || 'Unbekannter Datensatz';
    }

    /**
     * Apply the resolved record back to local storage and queue for sync.
     */
    _applyResolution(table, resolvedRecord) {
        try {
            // Update local storage
            const storageKey = `hwf_${table}`;
            let items = [];
            try {
                items = JSON.parse(localStorage.getItem(storageKey) || '[]');
            } catch {
                items = [];
            }

            const idx = items.findIndex(i => i.id === resolvedRecord.id);
            if (idx >= 0) {
                items[idx] = { ...items[idx], ...resolvedRecord, updated_at: new Date().toISOString() };
            } else {
                items.push({ ...resolvedRecord, updated_at: new Date().toISOString() });
            }

            localStorage.setItem(storageKey, JSON.stringify(items));

            // Queue the resolved record for sync to Supabase
            if (window.syncService) {
                window.syncService.queueForSync(table, 'upsert', resolvedRecord);
            }
        } catch (err) {
            console.error('ConflictResolutionService: Error applying resolution:', err);
        }
    }

    /**
     * Find a conflict by ID in the in-memory array.
     */
    _findConflict(conflictId) {
        return this.conflicts.find(c => c.id === conflictId);
    }

    /**
     * Generate a unique conflict ID.
     */
    _generateId() {
        return 'conflict_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Load conflicts from localStorage.
     */
    _loadConflicts() {
        try {
            const stored = localStorage.getItem(this.STORAGE_KEY);
            this.conflicts = stored ? JSON.parse(stored) : [];
        } catch (err) {
            console.error('ConflictResolutionService: Error loading conflicts:', err);
            this.conflicts = [];
        }
    }

    /**
     * Persist conflicts to localStorage.
     */
    _saveConflicts() {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.conflicts));
        } catch (err) {
            console.error('ConflictResolutionService: Error saving conflicts:', err);
        }
    }

    /**
     * Load settings from localStorage.
     */
    _loadSettings() {
        try {
            return JSON.parse(localStorage.getItem(this.SETTINGS_KEY) || '{}');
        } catch {
            return {};
        }
    }

    /**
     * Save settings to localStorage.
     */
    _saveSettings(settings) {
        try {
            localStorage.setItem(this.SETTINGS_KEY, JSON.stringify(settings));
        } catch (err) {
            console.error('ConflictResolutionService: Error saving settings:', err);
        }
    }

    /**
     * Dispatch a CustomEvent on window for UI listeners.
     */
    _dispatchEvent(name, detail) {
        try {
            window.dispatchEvent(new CustomEvent(name, { detail }));
        } catch (err) {
            console.error('ConflictResolutionService: Error dispatching event:', err);
        }
    }
}

// Global instance
window.conflictResolutionService = new ConflictResolutionService();
