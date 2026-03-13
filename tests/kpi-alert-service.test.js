import { describe, it, expect, beforeEach, vi } from 'vitest';

// ============================================
// Mocks
// ============================================

globalThis.localStorage = {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
};

globalThis.StorageUtils = {
    getJSON: vi.fn((key, fallback) => fallback),
};

globalThis.document = {
    createElement: vi.fn(() => ({ textContent: '', innerHTML: '' })),
};

globalThis.window = globalThis;
window.supabaseClient = null;
window.supabaseConfig = null;
window.storeService = null;
window.esc = null;

await import('../js/services/kpi-alert-service.js');

const svc = () => window.kpiAlertService;

// ============================================
// Tests
// ============================================

describe('KpiAlertService', () => {
    beforeEach(() => {
        window.kpiAlertService = new window.kpiAlertService.constructor();
        window.supabaseClient = null;
        window.storeService = null;
    });

    // ── Cache ──

    describe('Cache', () => {
        it('returns cached alerts within TTL', async () => {
            svc()._cache = [{ type: 'danger', message: 'test', count: 1 }];
            svc()._cacheTime = Date.now();
            const alerts = await svc().getAlerts();
            expect(alerts).toHaveLength(1);
        });

        it('invalidates cache', () => {
            svc()._cache = [{ type: 'test' }];
            svc()._cacheTime = Date.now();
            svc().invalidateCache();
            expect(svc()._cache).toBeNull();
            expect(svc()._cacheTime).toBe(0);
        });

        it('force refresh ignores cache', async () => {
            svc()._cache = [{ type: 'old' }];
            svc()._cacheTime = Date.now();
            // No supabase, no store -> should return empty
            const alerts = await svc().getAlerts(true);
            expect(alerts).toEqual([]);
        });
    });

    // ── Offline Alerts ──

    describe('Offline Alerts (Store)', () => {
        it('returns empty when no store', async () => {
            const alerts = await svc().getAlerts();
            expect(alerts).toEqual([]);
        });

        it('detects overdue invoices from store', async () => {
            const pastDate = '2020-01-01';
            window.storeService = {
                store: {
                    rechnungen: [
                        { status: 'offen', faelligkeitsdatum: pastDate },
                        { status: 'bezahlt', faelligkeitsdatum: pastDate },
                    ],
                },
            };
            const alerts = await svc().getAlerts();
            const overdue = alerts.find(a => a.message.includes('ueberfaellig'));
            expect(overdue).toBeTruthy();
            expect(overdue.count).toBe(1);
            expect(overdue.type).toBe('danger');
        });

        it('detects stale offers from store', async () => {
            const oldDate = '2020-01-01';
            window.storeService = {
                store: {
                    angebote: [
                        { status: 'gesendet', datum: oldDate },
                        { status: 'angenommen', datum: oldDate },
                    ],
                },
            };
            const alerts = await svc().getAlerts();
            const stale = alerts.find(a => a.message.includes('Angebot'));
            expect(stale).toBeTruthy();
            expect(stale.count).toBe(1);
            expect(stale.type).toBe('warning');
        });

        it('returns no alerts when all invoices are paid', async () => {
            window.storeService = {
                store: {
                    rechnungen: [{ status: 'bezahlt', faelligkeitsdatum: '2020-01-01' }],
                    angebote: [],
                },
            };
            const alerts = await svc().getAlerts();
            expect(alerts).toHaveLength(0);
        });
    });

    // ── HTML Escaping ──

    describe('_esc', () => {
        it('uses window.esc if available', () => {
            window.esc = vi.fn(s => `escaped:${s}`);
            expect(svc()._esc('test')).toBe('escaped:test');
            window.esc = null;
        });

        it('returns empty string for falsy input', () => {
            expect(svc()._esc(null)).toBe('');
            expect(svc()._esc('')).toBe('');
        });
    });

    // ── Init ──

    describe('init', () => {
        it('initializes without error', async () => {
            await svc().init();
        });
    });

    // ── _getClient ──

    describe('_getClient', () => {
        it('returns null when no supabase', () => {
            expect(svc()._getClient()).toBeNull();
        });

        it('returns supabaseClient.client if available', () => {
            const mockClient = { from: vi.fn() };
            window.supabaseClient = { client: mockClient };
            expect(svc()._getClient()).toBe(mockClient);
            window.supabaseClient = null;
        });
    });
});
