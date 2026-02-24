import { describe, it, expect, beforeEach } from 'vitest';

// Mock localStorage
const localStorageMock = (() => {
    let store = {};
    return {
        getItem: (key) => store[key] !== undefined ? store[key] : null,
        setItem: (key, value) => { store[key] = String(value); },
        removeItem: (key) => { delete store[key]; },
        clear: () => { store = {}; }
    };
})();

global.localStorage = localStorageMock;

// Mock window.dispatchEvent for the CustomEvent dispatching
global.window = global.window || {};
const dispatchedEvents = [];
global.window.dispatchEvent = (event) => {
    dispatchedEvents.push({ type: event.type, detail: event.detail });
};

// Self-contained ConflictResolutionService (extracted from js/services/conflict-resolution-service.js)
class ConflictResolutionService {
    constructor() {
        this.STORAGE_KEY = 'freyai_sync_conflicts';
        this.SETTINGS_KEY = 'freyai_conflict_settings';
        this.conflicts = [];
        this.ignoredFields = ['user_id', 'created_at', 'id'];
        this._loadConflicts();
    }

    detectConflict(table, localRecord, remoteRecord) {
        try {
            if (!localRecord || !remoteRecord) {
                return { hasConflict: false, fields: [] };
            }

            const localTimestamp = localRecord.updated_at || localRecord.created_at || null;
            const remoteTimestamp = remoteRecord.updated_at || remoteRecord.created_at || null;

            const allFields = new Set([
                ...Object.keys(localRecord),
                ...Object.keys(remoteRecord)
            ]);

            const conflictingFields = [];

            for (const field of allFields) {
                if (this.ignoredFields.includes(field)) { continue; }

                const localValue = localRecord[field];
                const remoteValue = remoteRecord[field];

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
            return { hasConflict: false, fields: [] };
        }
    }

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

            const existingIdx = this.conflicts.findIndex(
                c => c.table === conflict.table && c.recordId === conflict.recordId && c.status === 'pending'
            );

            if (existingIdx >= 0) {
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
            return null;
        }
    }

    resolveKeepLocal(conflictId) {
        try {
            const conflict = this._findConflict(conflictId);
            if (!conflict) { return null; }

            conflict.status = 'resolved';
            conflict.resolvedAt = new Date().toISOString();
            conflict.resolution = 'keep-local';

            const resolvedRecord = { ...conflict.localRecord };

            this._saveConflicts();
            this._applyResolution(conflict.table, resolvedRecord);
            this._dispatchEvent('conflict-resolved', { conflict, resolvedRecord });

            return resolvedRecord;
        } catch (err) {
            return null;
        }
    }

    resolveKeepRemote(conflictId) {
        try {
            const conflict = this._findConflict(conflictId);
            if (!conflict) { return null; }

            conflict.status = 'resolved';
            conflict.resolvedAt = new Date().toISOString();
            conflict.resolution = 'keep-remote';

            const resolvedRecord = { ...conflict.remoteRecord };

            this._saveConflicts();
            this._applyResolution(conflict.table, resolvedRecord);
            this._dispatchEvent('conflict-resolved', { conflict, resolvedRecord });

            return resolvedRecord;
        } catch (err) {
            return null;
        }
    }

    resolveManualMerge(conflictId, mergedRecord) {
        try {
            const conflict = this._findConflict(conflictId);
            if (!conflict) { return null; }

            conflict.status = 'resolved';
            conflict.resolvedAt = new Date().toISOString();
            conflict.resolution = 'manual-merge';

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
            return null;
        }
    }

    resolveAllKeepLocal() {
        try {
            const pending = this.getPendingConflicts();
            let resolved = 0;
            for (const conflict of pending) {
                if (this.resolveKeepLocal(conflict.id)) { resolved++; }
            }
            this._dispatchEvent('conflicts-batch-resolved', { count: resolved, strategy: 'keep-local' });
            return resolved;
        } catch (err) {
            return 0;
        }
    }

    resolveAllKeepRemote() {
        try {
            const pending = this.getPendingConflicts();
            let resolved = 0;
            for (const conflict of pending) {
                if (this.resolveKeepRemote(conflict.id)) { resolved++; }
            }
            this._dispatchEvent('conflicts-batch-resolved', { count: resolved, strategy: 'keep-remote' });
            return resolved;
        } catch (err) {
            return 0;
        }
    }

    getPendingConflicts() {
        return this.conflicts.filter(c => c.status === 'pending');
    }

    getConflictHistory() {
        return this.conflicts
            .filter(c => c.status === 'resolved')
            .sort((a, b) => new Date(b.resolvedAt) - new Date(a.resolvedAt));
    }

    getConflictCount() {
        return this.getPendingConflicts().length;
    }

    getConflict(conflictId) {
        return this._findConflict(conflictId) || null;
    }

    setAutoResolveStrategy(strategy) {
        const validStrategies = ['local-wins', 'remote-wins', 'manual'];
        if (!validStrategies.includes(strategy)) { return; }
        const settings = this._loadSettings();
        settings.autoResolveStrategy = strategy;
        this._saveSettings(settings);
        this._dispatchEvent('conflict-settings-changed', { strategy });
    }

    getAutoResolveStrategy() {
        try {
            const settings = this._loadSettings();
            return settings.autoResolveStrategy || 'manual';
        } catch {
            return 'manual';
        }
    }

    clearResolvedConflicts(olderThanDays = 30) {
        try {
            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - olderThanDays);

            const before = this.conflicts.length;
            this.conflicts = this.conflicts.filter(c => {
                if (c.status !== 'resolved') { return true; }
                return new Date(c.resolvedAt) > cutoff;
            });

            this._saveConflicts();
            return before - this.conflicts.length;
        } catch (err) {
            return 0;
        }
    }

    _valuesEqual(a, b) {
        if (a == null && b == null) { return true; }
        if (a == null || b == null) { return false; }
        if (typeof a !== 'object' && typeof b !== 'object') {
            return String(a) === String(b);
        }
        try {
            return JSON.stringify(a) === JSON.stringify(b);
        } catch {
            return false;
        }
    }

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

    _applyResolution(table, resolvedRecord) {
        try {
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
        } catch (err) {}
    }

    _findConflict(conflictId) {
        return this.conflicts.find(c => c.id === conflictId);
    }

    _generateId() {
        return 'conflict_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    _loadConflicts() {
        try {
            const stored = localStorage.getItem(this.STORAGE_KEY);
            this.conflicts = stored ? JSON.parse(stored) : [];
        } catch (err) {
            this.conflicts = [];
        }
    }

    _saveConflicts() {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.conflicts));
        } catch (err) {}
    }

    _loadSettings() {
        try {
            return JSON.parse(localStorage.getItem(this.SETTINGS_KEY) || '{}');
        } catch {
            return {};
        }
    }

    _saveSettings(settings) {
        try {
            localStorage.setItem(this.SETTINGS_KEY, JSON.stringify(settings));
        } catch (err) {}
    }

    _dispatchEvent(name, detail) {
        try {
            window.dispatchEvent(new CustomEvent(name, { detail }));
        } catch (err) {}
    }
}

// ---- Fixture Records ----
const LOCAL_RECORD = {
    id: 'rec-001',
    name: 'Lokaler Name',
    status: 'offen',
    betrag: 1000,
    updated_at: '2026-02-24T10:00:00Z'
};

const REMOTE_RECORD = {
    id: 'rec-001',
    name: 'Remote Name',
    status: 'bezahlt',
    betrag: 1000,
    updated_at: '2026-02-24T12:00:00Z'
};

describe('ConflictResolutionService', () => {
    let service;

    beforeEach(() => {
        localStorage.clear();
        dispatchedEvents.length = 0; // Clear event history
        service = new ConflictResolutionService();
    });

    describe('Conflict Detection', () => {
        it('should detect conflict when field values differ', () => {
            const result = service.detectConflict('invoices', LOCAL_RECORD, REMOTE_RECORD);
            expect(result.hasConflict).toBe(true);
            expect(result.fields.length).toBeGreaterThan(0);
        });

        it('should list specific conflicting fields', () => {
            const result = service.detectConflict('invoices', LOCAL_RECORD, REMOTE_RECORD);
            const fieldNames = result.fields.map(f => f.field);
            expect(fieldNames).toContain('name');
            expect(fieldNames).toContain('status');
        });

        it('should not conflict when records are identical', () => {
            const result = service.detectConflict('invoices', LOCAL_RECORD, { ...LOCAL_RECORD });
            expect(result.hasConflict).toBe(false);
            expect(result.fields).toHaveLength(0);
        });

        it('should ignore id, user_id, created_at fields', () => {
            const local = { id: 'rec-001', user_id: 'user-a', created_at: '2026-01-01', name: 'Same' };
            const remote = { id: 'rec-002', user_id: 'user-b', created_at: '2026-02-01', name: 'Same' };

            const result = service.detectConflict('customers', local, remote);
            expect(result.hasConflict).toBe(false); // Only ignored fields differ
        });

        it('should handle missing localRecord gracefully', () => {
            const result = service.detectConflict('invoices', null, REMOTE_RECORD);
            expect(result.hasConflict).toBe(false);
        });

        it('should handle missing remoteRecord gracefully', () => {
            const result = service.detectConflict('invoices', LOCAL_RECORD, null);
            expect(result.hasConflict).toBe(false);
        });

        it('should detect conflict in nested object fields', () => {
            const local = { id: 'r1', data: { sub: 'old' } };
            const remote = { id: 'r1', data: { sub: 'new' } };
            const result = service.detectConflict('records', local, remote);
            expect(result.hasConflict).toBe(true);
        });

        it('should include both values in conflicting field info', () => {
            const result = service.detectConflict('invoices', LOCAL_RECORD, REMOTE_RECORD);
            const nameConflict = result.fields.find(f => f.field === 'name');
            expect(nameConflict.localValue).toBe('Lokaler Name');
            expect(nameConflict.remoteValue).toBe('Remote Name');
        });
    });

    describe('_valuesEqual Comparisons', () => {
        it('should treat both null as equal', () => {
            expect(service._valuesEqual(null, null)).toBe(true);
            expect(service._valuesEqual(undefined, undefined)).toBe(true);
            expect(service._valuesEqual(null, undefined)).toBe(true);
        });

        it('should treat null and non-null as unequal', () => {
            expect(service._valuesEqual(null, 'value')).toBe(false);
            expect(service._valuesEqual('value', null)).toBe(false);
        });

        it('should compare strings by value', () => {
            expect(service._valuesEqual('hello', 'hello')).toBe(true);
            expect(service._valuesEqual('hello', 'world')).toBe(false);
        });

        it('should compare numbers as strings (type coercion)', () => {
            expect(service._valuesEqual(42, 42)).toBe(true);
            expect(service._valuesEqual(42, 43)).toBe(false);
        });

        it('should compare objects using JSON stringify', () => {
            expect(service._valuesEqual({ a: 1 }, { a: 1 })).toBe(true);
            expect(service._valuesEqual({ a: 1 }, { a: 2 })).toBe(false);
        });

        it('should compare arrays using JSON stringify', () => {
            expect(service._valuesEqual([1, 2], [1, 2])).toBe(true);
            expect(service._valuesEqual([1, 2], [2, 1])).toBe(false);
        });

        it('should handle boolean values', () => {
            expect(service._valuesEqual(true, true)).toBe(true);
            expect(service._valuesEqual(true, false)).toBe(false);
        });
    });

    describe('Conflict Storage', () => {
        it('should add a conflict to the queue', () => {
            const conflict = service.addConflict({
                table: 'invoices',
                recordId: 'rec-001',
                localRecord: LOCAL_RECORD,
                remoteRecord: REMOTE_RECORD,
                conflictingFields: [{ field: 'name', localValue: 'A', remoteValue: 'B' }]
            });

            expect(conflict).not.toBeNull();
            expect(conflict.id).toMatch(/^conflict_/);
            expect(conflict.status).toBe('pending');
        });

        it('should persist conflict to localStorage', () => {
            service.addConflict({
                table: 'invoices',
                recordId: 'rec-001',
                localRecord: LOCAL_RECORD,
                remoteRecord: REMOTE_RECORD
            });

            const stored = JSON.parse(localStorage.getItem('freyai_sync_conflicts'));
            expect(stored.length).toBe(1);
        });

        it('should update existing pending conflict for same record', () => {
            service.addConflict({ table: 'invoices', recordId: 'rec-001', localRecord: LOCAL_RECORD, remoteRecord: REMOTE_RECORD });
            service.addConflict({ table: 'invoices', recordId: 'rec-001', localRecord: { ...LOCAL_RECORD, name: 'Updated' }, remoteRecord: REMOTE_RECORD });

            expect(service.getPendingConflicts().length).toBe(1); // Not duplicated
        });

        it('should dispatch conflict-added event', () => {
            service.addConflict({ table: 'invoices', recordId: 'r1', localRecord: LOCAL_RECORD, remoteRecord: REMOTE_RECORD });
            const event = dispatchedEvents.find(e => e.type === 'conflict-added');
            expect(event).toBeDefined();
        });

        it('should derive record title from localRecord using name field', () => {
            // _deriveRecordTitle prioritizes: name > title > nummer > ...
            const conflict = service.addConflict({
                table: 'invoices',
                recordId: 'r1',
                localRecord: { ...LOCAL_RECORD, name: 'Lokaler Name', nummer: 'RE-001' },
                remoteRecord: REMOTE_RECORD
            });
            // 'name' takes priority over 'nummer'
            expect(conflict.recordTitle).toBe('Lokaler Name');
        });

        it('should derive record title using nummer when no name', () => {
            const localNoName = { id: 'r1', nummer: 'RE-001', betrag: 100 };
            const conflict = service.addConflict({
                table: 'invoices',
                recordId: 'r1',
                localRecord: localNoName,
                remoteRecord: { id: 'r1', nummer: 'RE-001', betrag: 200 }
            });
            expect(conflict.recordTitle).toBe('RE-001');
        });

        it('should get conflict by id', () => {
            const added = service.addConflict({ table: 'invoices', recordId: 'r1', localRecord: LOCAL_RECORD, remoteRecord: REMOTE_RECORD });
            const found = service.getConflict(added.id);
            expect(found).not.toBeNull();
            expect(found.id).toBe(added.id);
        });
    });

    describe('Resolution Strategies - Keep Local', () => {
        it('should resolve conflict keeping local record', () => {
            const added = service.addConflict({
                table: 'invoices',
                recordId: 'rec-001',
                localRecord: LOCAL_RECORD,
                remoteRecord: REMOTE_RECORD
            });

            const resolved = service.resolveKeepLocal(added.id);
            expect(resolved).not.toBeNull();
            expect(resolved.name).toBe('Lokaler Name'); // Local wins
        });

        it('should mark conflict as resolved with keep-local strategy', () => {
            const added = service.addConflict({ table: 'invoices', recordId: 'r1', localRecord: LOCAL_RECORD, remoteRecord: REMOTE_RECORD });
            service.resolveKeepLocal(added.id);

            const conflict = service.getConflict(added.id);
            expect(conflict.status).toBe('resolved');
            expect(conflict.resolution).toBe('keep-local');
        });

        it('should return null for non-existent conflict', () => {
            const result = service.resolveKeepLocal('NONEXISTENT');
            expect(result).toBeNull();
        });
    });

    describe('Resolution Strategies - Keep Remote', () => {
        it('should resolve conflict keeping remote record', () => {
            const added = service.addConflict({
                table: 'invoices',
                recordId: 'rec-001',
                localRecord: LOCAL_RECORD,
                remoteRecord: REMOTE_RECORD
            });

            const resolved = service.resolveKeepRemote(added.id);
            expect(resolved).not.toBeNull();
            expect(resolved.name).toBe('Remote Name'); // Remote wins
            expect(resolved.status).toBe('bezahlt');
        });

        it('should mark conflict as resolved with keep-remote strategy', () => {
            const added = service.addConflict({ table: 'invoices', recordId: 'r1', localRecord: LOCAL_RECORD, remoteRecord: REMOTE_RECORD });
            service.resolveKeepRemote(added.id);

            const conflict = service.getConflict(added.id);
            expect(conflict.resolution).toBe('keep-remote');
        });
    });

    describe('Resolution Strategies - Manual Merge', () => {
        it('should resolve with manually merged values', () => {
            const added = service.addConflict({
                table: 'invoices',
                recordId: 'rec-001',
                localRecord: LOCAL_RECORD,
                remoteRecord: REMOTE_RECORD
            });

            const merged = service.resolveManualMerge(added.id, {
                name: 'Merged Name',
                status: 'bezahlt'
            });

            expect(merged).not.toBeNull();
            expect(merged.name).toBe('Merged Name');
            expect(merged.status).toBe('bezahlt');
        });

        it('should always retain the original recordId in merged result', () => {
            const added = service.addConflict({
                table: 'invoices',
                recordId: 'rec-original-001',
                localRecord: LOCAL_RECORD,
                remoteRecord: REMOTE_RECORD
            });

            const merged = service.resolveManualMerge(added.id, { name: 'Merged' });
            expect(merged.id).toBe('rec-original-001');
        });

        it('should mark conflict as resolved with manual-merge strategy', () => {
            const added = service.addConflict({ table: 'invoices', recordId: 'r1', localRecord: LOCAL_RECORD, remoteRecord: REMOTE_RECORD });
            service.resolveManualMerge(added.id, { name: 'X' });
            expect(service.getConflict(added.id).resolution).toBe('manual-merge');
        });
    });

    describe('Batch Resolution', () => {
        beforeEach(() => {
            service.addConflict({ table: 'invoices', recordId: 'r1', localRecord: LOCAL_RECORD, remoteRecord: REMOTE_RECORD });
            service.addConflict({ table: 'customers', recordId: 'r2', localRecord: { id: 'r2', name: 'A' }, remoteRecord: { id: 'r2', name: 'B' } });
            service.addConflict({ table: 'products', recordId: 'r3', localRecord: { id: 'r3', price: 10 }, remoteRecord: { id: 'r3', price: 20 } });
        });

        it('should resolve all pending conflicts with keep-local', () => {
            const count = service.resolveAllKeepLocal();
            expect(count).toBe(3);
            expect(service.getPendingConflicts().length).toBe(0);
        });

        it('should resolve all pending conflicts with keep-remote', () => {
            const count = service.resolveAllKeepRemote();
            expect(count).toBe(3);
            expect(service.getPendingConflicts().length).toBe(0);
        });

        it('should dispatch batch-resolved event', () => {
            service.resolveAllKeepLocal();
            const event = dispatchedEvents.find(e => e.type === 'conflicts-batch-resolved');
            expect(event).toBeDefined();
            expect(event.detail.count).toBe(3);
        });
    });

    describe('Pending and History Queries', () => {
        it('should count pending conflicts', () => {
            service.addConflict({ table: 'invoices', recordId: 'r1', localRecord: LOCAL_RECORD, remoteRecord: REMOTE_RECORD });
            service.addConflict({ table: 'customers', recordId: 'r2', localRecord: { id: 'r2' }, remoteRecord: { id: 'r2', x: 1 } });

            expect(service.getConflictCount()).toBe(2);
        });

        it('should return resolved conflicts in history', () => {
            const c = service.addConflict({ table: 'inv', recordId: 'r1', localRecord: LOCAL_RECORD, remoteRecord: REMOTE_RECORD });
            service.resolveKeepLocal(c.id);

            const history = service.getConflictHistory();
            expect(history.length).toBe(1);
            expect(history[0].resolution).toBe('keep-local');
        });

        it('should sort history by resolvedAt newest first', () => {
            const c1 = service.addConflict({ table: 'inv', recordId: 'r1', localRecord: LOCAL_RECORD, remoteRecord: REMOTE_RECORD });
            const c2 = service.addConflict({ table: 'cust', recordId: 'r2', localRecord: { id: 'r2' }, remoteRecord: { id: 'r2', x: 1 } });
            service.resolveKeepLocal(c1.id);
            service.resolveKeepRemote(c2.id);

            const history = service.getConflictHistory();
            expect(history.length).toBe(2);
            // Newest first
            expect(new Date(history[0].resolvedAt) >= new Date(history[1].resolvedAt)).toBe(true);
        });

        it('should not include pending conflicts in history', () => {
            service.addConflict({ table: 'inv', recordId: 'r1', localRecord: LOCAL_RECORD, remoteRecord: REMOTE_RECORD });
            const history = service.getConflictHistory();
            expect(history.length).toBe(0);
        });
    });

    describe('Auto-Resolve Settings', () => {
        it('should default to manual strategy', () => {
            expect(service.getAutoResolveStrategy()).toBe('manual');
        });

        it('should set and retrieve auto-resolve strategy', () => {
            service.setAutoResolveStrategy('local-wins');
            expect(service.getAutoResolveStrategy()).toBe('local-wins');
        });

        it('should persist strategy in localStorage', () => {
            service.setAutoResolveStrategy('remote-wins');
            const saved = JSON.parse(localStorage.getItem('freyai_conflict_settings'));
            expect(saved.autoResolveStrategy).toBe('remote-wins');
        });

        it('should reject invalid strategy', () => {
            service.setAutoResolveStrategy('invalid-strategy');
            // Should remain unchanged (default)
            expect(service.getAutoResolveStrategy()).toBe('manual');
        });

        it('should dispatch settings-changed event', () => {
            dispatchedEvents.length = 0;
            service.setAutoResolveStrategy('local-wins');
            const event = dispatchedEvents.find(e => e.type === 'conflict-settings-changed');
            expect(event).toBeDefined();
        });
    });

    describe('Conflict Cleanup', () => {
        it('should clear old resolved conflicts', () => {
            const c = service.addConflict({ table: 'inv', recordId: 'r1', localRecord: LOCAL_RECORD, remoteRecord: REMOTE_RECORD });
            service.resolveKeepLocal(c.id);

            // Force the resolvedAt to be very old
            const conflict = service.conflicts.find(x => x.id === c.id);
            conflict.resolvedAt = new Date('2020-01-01').toISOString();
            service._saveConflicts();

            const removed = service.clearResolvedConflicts(30); // 30 days threshold
            expect(removed).toBe(1);
        });

        it('should not remove recently resolved conflicts', () => {
            const c = service.addConflict({ table: 'inv', recordId: 'r1', localRecord: LOCAL_RECORD, remoteRecord: REMOTE_RECORD });
            service.resolveKeepLocal(c.id);

            const removed = service.clearResolvedConflicts(30);
            expect(removed).toBe(0); // Recently resolved
        });

        it('should not remove pending conflicts during cleanup', () => {
            service.addConflict({ table: 'inv', recordId: 'r1', localRecord: LOCAL_RECORD, remoteRecord: REMOTE_RECORD });

            const removed = service.clearResolvedConflicts(0); // Remove all resolved
            expect(removed).toBe(0); // Pending, not removed
            expect(service.getConflictCount()).toBe(1); // Still there
        });
    });

    describe('Persistence', () => {
        it('should reload conflicts from localStorage', () => {
            service.addConflict({ table: 'inv', recordId: 'r1', localRecord: LOCAL_RECORD, remoteRecord: REMOTE_RECORD });

            // Create fresh instance
            const fresh = new ConflictResolutionService();
            expect(fresh.getPendingConflicts().length).toBe(1);
        });

        it('should apply resolution to localStorage', () => {
            const c = service.addConflict({
                table: 'invoices',
                recordId: 'rec-001',
                localRecord: LOCAL_RECORD,
                remoteRecord: REMOTE_RECORD
            });

            service.resolveKeepLocal(c.id);

            const stored = JSON.parse(localStorage.getItem('hwf_invoices'));
            expect(stored).not.toBeNull();
            expect(stored.length).toBeGreaterThan(0);
        });
    });
});
