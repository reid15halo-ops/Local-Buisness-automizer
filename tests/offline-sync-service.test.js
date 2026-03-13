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
    safeDate: vi.fn(s => s ? new Date(s) : null),
};

globalThis.navigator = { onLine: true };
globalThis.indexedDB = { deleteDatabase: vi.fn() };
globalThis.document = {
    readyState: 'complete',
    getElementById: vi.fn(() => null),
    querySelector: vi.fn(() => null),
    createElement: vi.fn(() => ({
        id: '', style: { cssText: '', display: '' }, textContent: '',
        after: vi.fn(),
    })),
    addEventListener: vi.fn(),
};

globalThis.window = globalThis;
window.addEventListener = vi.fn();
window.storeService = null;
window.dbService = null;
window.supabaseClient = null;

// Load the service
await import('../js/services/offline-sync-service.js');

const svc = () => window.offlineSyncService;

// ============================================
// Tests
// ============================================

describe('OfflineSyncService', () => {
    beforeEach(() => {
        Object.keys(mockStorage).forEach(k => delete mockStorage[k]);
        // Reset internal state
        svc()._processing = false;
        svc()._isOnline = true;
        svc().QUEUE_KEY = 'freyai-offline-queue';
    });

    // ── Online/Offline status ──

    describe('Online Status', () => {
        it('reports online when navigator.onLine is true', () => {
            svc()._isOnline = true;
            expect(svc().isOnline).toBe(true);
        });

        it('reports offline when set to false', () => {
            svc()._isOnline = false;
            expect(svc().isOnline).toBe(false);
        });
    });

    // ── Queue Operations ──

    describe('Queue Operations', () => {
        it('queues an action', async () => {
            await svc().queueAction('CREATE', 'kunden', { id: '1', name: 'Test' });
            const queue = svc()._getQueue();
            expect(queue).toHaveLength(1);
            expect(queue[0].type).toBe('CREATE');
            expect(queue[0].table).toBe('kunden');
            expect(queue[0].data.name).toBe('Test');
        });

        it('queues multiple actions in order', async () => {
            await svc().queueAction('CREATE', 'kunden', { id: '1' });
            await svc().queueAction('UPDATE', 'kunden', { id: '1', name: 'Updated' });
            await svc().queueAction('DELETE', 'kunden', { id: '1' });
            const queue = svc()._getQueue();
            expect(queue).toHaveLength(3);
            expect(queue[0].type).toBe('CREATE');
            expect(queue[1].type).toBe('UPDATE');
            expect(queue[2].type).toBe('DELETE');
        });

        it('adds timestamp and retries to queue items', async () => {
            await svc().queueAction('CREATE', 'kunden', { id: '1' });
            const queue = svc()._getQueue();
            expect(queue[0].timestamp).toBeGreaterThan(0);
            expect(queue[0].retries).toBe(0);
        });

        it('generates unique IDs for queue items', async () => {
            await svc().queueAction('CREATE', 'kunden', { id: '1' });
            await svc().queueAction('CREATE', 'kunden', { id: '2' });
            const queue = svc()._getQueue();
            expect(queue[0].id).not.toBe(queue[1].id);
        });
    });

    // ── _getQueue / _setQueue ──

    describe('Queue Persistence', () => {
        it('returns empty array when no queue stored', () => {
            expect(svc()._getQueue()).toEqual([]);
        });

        it('stores and retrieves queue via localStorage', () => {
            const items = [{ id: '1', type: 'CREATE', table: 'kunden', data: {} }];
            svc()._setQueue(items);
            expect(svc()._getQueue()).toEqual(items);
        });

        it('handles corrupt localStorage data', () => {
            mockStorage['freyai-offline-queue'] = 'not-json{';
            expect(svc()._getQueue()).toEqual([]);
        });
    });

    // ── processQueue ──

    describe('processQueue', () => {
        it('does nothing when offline', async () => {
            svc()._isOnline = false;
            await svc().queueAction('CREATE', 'kunden', { id: '1' });
            await svc().processQueue();
            expect(svc()._getQueue()).toHaveLength(1);
        });

        it('does nothing when already processing', async () => {
            svc()._processing = true;
            await svc().processQueue();
            // No error thrown
        });

        it('does nothing when no supabase client', async () => {
            window.supabaseClient = null;
            window.supabase = null;
            await svc().queueAction('CREATE', 'kunden', { id: '1' });
            await svc().processQueue();
            // Queue remains because no client to process with
            expect(svc()._getQueue()).toHaveLength(1);
        });

        it('processes CREATE actions via supabase', async () => {
            const mockInsert = vi.fn().mockResolvedValue({ data: {}, error: null });
            window.supabase = {
                from: vi.fn(() => ({ insert: mockInsert })),
            };
            await svc().queueAction('CREATE', 'kunden', { id: '1', name: 'Test' });
            await svc().processQueue();
            expect(mockInsert).toHaveBeenCalledWith({ id: '1', name: 'Test' });
            expect(svc()._getQueue()).toHaveLength(0);
        });

        it('processes UPDATE actions via supabase', async () => {
            const mockEq = vi.fn().mockResolvedValue({ data: {}, error: null });
            const mockUpdate = vi.fn(() => ({ eq: mockEq }));
            window.supabase = {
                from: vi.fn(() => ({ update: mockUpdate })),
            };
            await svc().queueAction('UPDATE', 'kunden', { id: '1', name: 'Updated' });
            await svc().processQueue();
            expect(mockUpdate).toHaveBeenCalledWith({ id: '1', name: 'Updated' });
            expect(mockEq).toHaveBeenCalledWith('id', '1');
        });

        it('processes DELETE actions via supabase', async () => {
            const mockEq = vi.fn().mockResolvedValue({ data: {}, error: null });
            const mockDelete = vi.fn(() => ({ eq: mockEq }));
            window.supabase = {
                from: vi.fn(() => ({ delete: mockDelete })),
            };
            await svc().queueAction('DELETE', 'kunden', { id: '1' });
            await svc().processQueue();
            expect(mockDelete).toHaveBeenCalled();
        });

        it('retries failed items up to MAX_RETRIES', async () => {
            const mockInsert = vi.fn().mockResolvedValue({ data: null, error: { message: 'fail' } });
            window.supabase = {
                from: vi.fn(() => ({ insert: mockInsert })),
            };
            await svc().queueAction('CREATE', 'kunden', { id: '1' });

            // Process 3 times (MAX_RETRIES)
            await svc().processQueue();
            expect(svc()._getQueue()).toHaveLength(1);
            expect(svc()._getQueue()[0].retries).toBe(1);

            await svc().processQueue();
            expect(svc()._getQueue()[0].retries).toBe(2);

            await svc().processQueue();
            // After 3rd retry, item is discarded
            expect(svc()._getQueue()).toHaveLength(0);
        });

        it('resets _processing flag after completion', async () => {
            window.supabase = null;
            window.supabaseClient = null;
            await svc().processQueue();
            expect(svc()._processing).toBe(false);
        });
    });

    // ── executeOrQueue ──

    describe('executeOrQueue', () => {
        it('executes function when online', async () => {
            svc()._isOnline = true;
            const fn = vi.fn().mockResolvedValue({ data: 'ok' });
            await svc().executeOrQueue('CREATE', 'kunden', { id: '1' }, fn);
            expect(fn).toHaveBeenCalled();
            expect(svc()._getQueue()).toHaveLength(0);
        });

        it('queues when offline', async () => {
            svc()._isOnline = false;
            const fn = vi.fn();
            await svc().executeOrQueue('CREATE', 'kunden', { id: '1' }, fn);
            expect(fn).not.toHaveBeenCalled();
            expect(svc()._getQueue()).toHaveLength(1);
        });

        it('queues when online function throws', async () => {
            svc()._isOnline = true;
            const fn = vi.fn().mockRejectedValue(new Error('network'));
            await svc().executeOrQueue('CREATE', 'kunden', { id: '1' }, fn);
            expect(svc()._getQueue()).toHaveLength(1);
        });
    });

    // ── Data Caching ──

    describe('Data Caching', () => {
        it('only caches known stores', async () => {
            window.dbService = { _cacheEntities: vi.fn() };
            await svc().cacheData('unknown_store', []);
            expect(window.dbService._cacheEntities).not.toHaveBeenCalled();
        });

        it('caches kunden via dbService', async () => {
            window.dbService = { _cacheEntities: vi.fn() };
            await svc().cacheData('kunden', [{ id: '1' }]);
            expect(window.dbService._cacheEntities).toHaveBeenCalledWith('customers', [{ id: '1' }]);
        });

        it('returns empty array for unknown store', async () => {
            const result = await svc().getCachedData('unknown_store');
            expect(result).toEqual([]);
        });

        it('falls back to storeService state', async () => {
            window.dbService = null;
            window.storeService = { state: { kunden: [{ id: '1' }] } };
            const result = await svc().getCachedData('kunden');
            expect(result).toEqual([{ id: '1' }]);
        });
    });

    // ── STORES config ──

    describe('Configuration', () => {
        it('has all required store names', () => {
            expect(svc().STORES).toContain('kunden');
            expect(svc().STORES).toContain('anfragen');
            expect(svc().STORES).toContain('angebote');
            expect(svc().STORES).toContain('auftraege');
            expect(svc().STORES).toContain('rechnungen');
        });

        it('has MAX_RETRIES set to 3', () => {
            expect(svc().MAX_RETRIES).toBe(3);
        });
    });
});
