import { describe, it, expect, beforeEach, vi } from 'vitest';

// ============================================
// Mocks
// ============================================

const mockStorage = {};
globalThis.localStorage = {
    getItem: vi.fn(k => mockStorage[k] || null),
    setItem: vi.fn((k, v) => { mockStorage[k] = v; }),
    removeItem: vi.fn(k => { delete mockStorage[k]; }),
};

globalThis.StorageUtils = {
    getJSON: vi.fn((key, fallback) => {
        const raw = mockStorage[key];
        return raw ? JSON.parse(raw) : fallback;
    }),
    setJSON: vi.fn((key, val) => {
        mockStorage[key] = JSON.stringify(val);
        return true;
    }),
};

globalThis.window = globalThis;

await import('../js/services/version-control-service.js');

const svc = () => window.versionControlService;

// ============================================
// Tests
// ============================================

describe('VersionControlService', () => {
    beforeEach(() => {
        Object.keys(mockStorage).forEach(k => delete mockStorage[k]);
        window.versionControlService = new window.versionControlService.constructor();
    });

    // ── Create Version ──

    describe('createVersion', () => {
        it('creates first version of a document', () => {
            const v = svc().createVersion('doc-1', 'angebot', { title: 'Test' });
            expect(v.number).toBe(1);
            expect(v.versionId).toBe('doc-1-v1');
            expect(v.content).toEqual({ title: 'Test' });
            expect(v.status).toBe('draft');
        });

        it('increments version numbers', () => {
            svc().createVersion('doc-1', 'angebot', { v: 1 });
            const v2 = svc().createVersion('doc-1', 'angebot', { v: 2 });
            expect(v2.number).toBe(2);
            expect(v2.versionId).toBe('doc-1-v2');
        });

        it('stores metadata', () => {
            const v = svc().createVersion('doc-1', 'rechnung', { x: 1 }, {
                changedBy: 'admin',
                changeReason: 'Preis korrigiert',
                changes: ['Preis geändert'],
                status: 'approved',
            });
            expect(v.changedBy).toBe('admin');
            expect(v.changeReason).toBe('Preis korrigiert');
            expect(v.changes).toEqual(['Preis geändert']);
            expect(v.status).toBe('approved');
        });

        it('generates content hash', () => {
            const v = svc().createVersion('doc-1', 'angebot', { a: 1 });
            expect(v.contentHash).toBeTruthy();
        });
    });

    // ── Get Versions ──

    describe('getVersions', () => {
        it('returns all versions for a document', () => {
            svc().createVersion('doc-1', 'angebot', { v: 1 });
            svc().createVersion('doc-1', 'angebot', { v: 2 });
            expect(svc().getVersions('doc-1')).toHaveLength(2);
        });

        it('returns empty array for unknown document', () => {
            expect(svc().getVersions('unknown')).toEqual([]);
        });
    });

    // ── Get Specific Version ──

    describe('getVersion', () => {
        it('returns specific version by number', () => {
            svc().createVersion('doc-1', 'angebot', { v: 1 });
            svc().createVersion('doc-1', 'angebot', { v: 2 });
            const v = svc().getVersion('doc-1', 1);
            expect(v.content).toEqual({ v: 1 });
        });

        it('returns null for unknown document', () => {
            expect(svc().getVersion('unknown', 1)).toBeNull();
        });
    });

    // ── Latest Version ──

    describe('getLatestVersion', () => {
        it('returns the latest version', () => {
            svc().createVersion('doc-1', 'angebot', { v: 1 });
            svc().createVersion('doc-1', 'angebot', { v: 2 });
            expect(svc().getLatestVersion('doc-1').content).toEqual({ v: 2 });
        });

        it('returns null for unknown document', () => {
            expect(svc().getLatestVersion('unknown')).toBeNull();
        });
    });

    // ── Compare Versions ──

    describe('compareVersions', () => {
        it('detects changes between versions', () => {
            svc().createVersion('doc-1', 'angebot', { title: 'A', price: 100 });
            svc().createVersion('doc-1', 'angebot', { title: 'A', price: 200 });
            const comp = svc().compareVersions('doc-1', 1, 2);
            expect(comp.hasChanges).toBe(true);
            expect(comp.differences.length).toBeGreaterThan(0);
            expect(comp.differences[0].path).toBe('price');
        });

        it('detects no changes for identical versions', () => {
            svc().createVersion('doc-1', 'angebot', { title: 'A' });
            svc().createVersion('doc-1', 'angebot', { title: 'A' });
            const comp = svc().compareVersions('doc-1', 1, 2);
            expect(comp.hasChanges).toBe(false);
        });

        it('returns null for missing versions', () => {
            expect(svc().compareVersions('doc-1', 1, 2)).toBeNull();
        });
    });

    // ── Deep Diff ──

    describe('deepDiff', () => {
        it('detects added keys', () => {
            const diff = svc().deepDiff({ a: 1 }, { a: 1, b: 2 });
            expect(diff.find(d => d.path === 'b' && d.type === 'added')).toBeTruthy();
        });

        it('detects removed keys', () => {
            const diff = svc().deepDiff({ a: 1, b: 2 }, { a: 1 });
            expect(diff.find(d => d.path === 'b' && d.type === 'removed')).toBeTruthy();
        });

        it('detects changed values', () => {
            const diff = svc().deepDiff({ a: 1 }, { a: 2 });
            expect(diff[0].type).toBe('changed');
            expect(diff[0].oldValue).toBe(1);
            expect(diff[0].newValue).toBe(2);
        });

        it('handles nested objects', () => {
            const diff = svc().deepDiff({ a: { b: 1 } }, { a: { b: 2 } });
            expect(diff[0].path).toBe('a.b');
        });

        it('handles primitives', () => {
            const diff = svc().deepDiff('old', 'new');
            expect(diff[0].type).toBe('changed');
        });

        it('handles null comparison', () => {
            const diff = svc().deepDiff(null, { a: 1 });
            expect(diff[0].type).toBe('added');
        });
    });

    // ── Restore Version ──

    describe('restoreVersion', () => {
        it('creates new version with restored content', () => {
            svc().createVersion('doc-1', 'angebot', { v: 1 });
            svc().createVersion('doc-1', 'angebot', { v: 2 });
            const restored = svc().restoreVersion('doc-1', 1);
            expect(restored.number).toBe(3);
            expect(restored.content).toEqual({ v: 1 });
            expect(restored.changes[0]).toContain('Wiederhergestellt');
        });

        it('returns null for non-existent version', () => {
            expect(svc().restoreVersion('doc-1', 99)).toBeNull();
        });
    });

    // ── Version History ──

    describe('getVersionHistory', () => {
        it('returns history summary', () => {
            svc().createVersion('doc-1', 'angebot', { v: 1 }, { changedBy: 'admin' });
            const history = svc().getVersionHistory('doc-1');
            expect(history).toHaveLength(1);
            expect(history[0].changedBy).toBe('admin');
            expect(history[0].formattedDate).toBeTruthy();
        });

        it('returns empty for unknown document', () => {
            expect(svc().getVersionHistory('unknown')).toEqual([]);
        });
    });

    // ── Update Version Status ──

    describe('updateVersionStatus', () => {
        it('updates status', () => {
            svc().createVersion('doc-1', 'angebot', { v: 1 });
            const updated = svc().updateVersionStatus('doc-1', 1, 'approved');
            expect(updated.status).toBe('approved');
            expect(updated.statusUpdatedAt).toBeTruthy();
        });

        it('returns null for unknown version', () => {
            expect(svc().updateVersionStatus('doc-1', 99, 'approved')).toBeNull();
        });
    });

    // ── Hash ──

    describe('hashContent', () => {
        it('generates consistent hash', () => {
            const h1 = svc().hashContent('test');
            const h2 = svc().hashContent('test');
            expect(h1).toBe(h2);
        });

        it('generates different hash for different content', () => {
            expect(svc().hashContent('a')).not.toBe(svc().hashContent('b'));
        });
    });

    // ── All Documents ──

    describe('getAllDocuments', () => {
        it('lists all versioned documents', () => {
            svc().createVersion('doc-1', 'angebot', { v: 1 });
            svc().createVersion('doc-2', 'rechnung', { v: 1 });
            const docs = svc().getAllDocuments();
            expect(docs).toHaveLength(2);
            expect(docs[0].totalVersions).toBe(1);
        });
    });

    // ── Delete History ──

    describe('deleteVersionHistory', () => {
        it('removes version history for document', () => {
            svc().createVersion('doc-1', 'angebot', { v: 1 });
            svc().deleteVersionHistory('doc-1');
            expect(svc().getVersions('doc-1')).toEqual([]);
        });
    });

    // ── Export ──

    describe('exportHistory', () => {
        it('exports version history', () => {
            svc().createVersion('doc-1', 'angebot', { v: 1 });
            const exp = svc().exportHistory('doc-1');
            expect(exp.documentId).toBe('doc-1');
            expect(exp.versions).toHaveLength(1);
            expect(exp.exportedAt).toBeTruthy();
        });

        it('returns null for unknown document', () => {
            expect(svc().exportHistory('unknown')).toBeNull();
        });
    });

    // ── Statistics ──

    describe('getStatistics', () => {
        it('calculates stats', () => {
            svc().createVersion('doc-1', 'angebot', { v: 1 });
            svc().createVersion('doc-1', 'angebot', { v: 2 });
            svc().createVersion('doc-2', 'rechnung', { v: 1 });
            const stats = svc().getStatistics();
            expect(stats.totalDocuments).toBe(2);
            expect(stats.totalVersions).toBe(3);
            expect(stats.recentChanges).toBe(3);
        });
    });
});
