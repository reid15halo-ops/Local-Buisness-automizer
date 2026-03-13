import { describe, it, expect, beforeEach, vi } from 'vitest';

// ============================================
// Mocks
// ============================================

globalThis.localStorage = {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
};

globalThis.StorageUtils = {
    getJSON: vi.fn((key, fallback) => fallback),
    setJSON: vi.fn(() => true),
};

globalThis.document = {
    createElement: vi.fn(() => ({
        id: '', className: '', innerHTML: '', textContent: '',
        style: {}, classList: { add: vi.fn(), remove: vi.fn() },
        appendChild: vi.fn(), contains: vi.fn(() => false),
    })),
    getElementById: vi.fn(() => null),
    body: { appendChild: vi.fn() },
    head: { appendChild: vi.fn() },
    addEventListener: vi.fn(),
};

globalThis.window = globalThis;
window.storeService = null;
window.taskService = null;
window.navigationController = null;
window.UI = {
    formatCurrency: vi.fn(a => `${a} €`),
    sanitize: vi.fn(s => s || ''),
};
window.CSS = { escape: vi.fn(s => s) };

await import('../js/services/search-service.js');

const svc = () => window.searchService;

// ============================================
// Tests
// ============================================

describe('SearchService', () => {
    beforeEach(() => {
        svc().index = [];
        svc().resultsContainer = null;
    });

    // ── Fuzzy Match ──

    describe('fuzzyMatch', () => {
        it('scores 100 for exact match', () => {
            const result = svc().fuzzyMatch('test', 'this is a test string');
            expect(result.score).toBe(100);
            expect(result.match).toBe(true);
        });

        it('matches case-insensitively', () => {
            const result = svc().fuzzyMatch('TEST', 'this is a test');
            expect(result.match).toBe(true);
            expect(result.score).toBe(100);
        });

        it('does fuzzy matching for partial matches', () => {
            const result = svc().fuzzyMatch('meir', 'max meier gmbh');
            expect(result.match).toBe(true);
        });

        it('rejects very poor matches', () => {
            const result = svc().fuzzyMatch('xyz', 'abc def ghi');
            expect(result.match).toBe(false);
        });
    });

    // ── Search ──

    describe('search', () => {
        it('returns empty for short query', () => {
            expect(svc().search('')).toEqual([]);
            expect(svc().search('a')).toEqual([]);
        });

        it('returns empty for null query', () => {
            expect(svc().search(null)).toEqual([]);
        });

        it('searches across indexed items', () => {
            window.storeService = {
                state: {
                    anfragen: [
                        { id: 'ANF-001', kunde: { name: 'Meier GmbH', email: 'meier@test.de' }, leistungsart: 'Schweißarbeiten', beschreibung: 'Stahltor reparieren' },
                    ],
                    angebote: [],
                    auftraege: [],
                    rechnungen: [],
                },
            };

            const results = svc().search('Meier');
            expect(results.length).toBeGreaterThan(0);
            expect(results[0].type).toBe('anfrage');
        });

        it('limits results to 10', () => {
            const anfragen = [];
            for (let i = 0; i < 20; i++) {
                anfragen.push({
                    id: `ANF-${i}`,
                    kunde: { name: `Kunde Test ${i}` },
                    leistungsart: 'Test',
                    beschreibung: 'Test Beschreibung',
                });
            }
            window.storeService = {
                state: { anfragen, angebote: [], auftraege: [], rechnungen: [] },
            };

            const results = svc().search('Test');
            expect(results.length).toBeLessThanOrEqual(10);
        });

        it('sorts results by score descending', () => {
            window.storeService = {
                state: {
                    anfragen: [
                        { id: 'ANF-001', kunde: { name: 'ABC' }, leistungsart: 'xyz', beschreibung: '' },
                        { id: 'ANF-002', kunde: { name: 'Rechnung Meier' }, leistungsart: 'Rechnung', beschreibung: 'Rechnung' },
                    ],
                    angebote: [],
                    auftraege: [],
                    rechnungen: [],
                },
            };

            const results = svc().search('Rechnung');
            if (results.length >= 1) {
                expect(results[0].title).toBe('Rechnung Meier');
            }
        });
    });

    // ── Build Index ──

    describe('buildIndex', () => {
        it('builds empty index when no storeService', () => {
            window.storeService = null;
            svc().buildIndex();
            expect(svc().index).toEqual([]);
        });

        it('indexes anfragen', () => {
            window.storeService = {
                state: {
                    anfragen: [
                        { id: 'ANF-001', kunde: { name: 'Test' }, leistungsart: 'Art', beschreibung: 'Desc' },
                    ],
                },
            };
            svc().buildIndex();
            expect(svc().index.length).toBe(1);
            expect(svc().index[0].type).toBe('anfrage');
            expect(svc().index[0].icon).toBe('📋');
        });

        it('indexes rechnungen', () => {
            window.storeService = {
                state: {
                    rechnungen: [
                        { id: 'RE-001', kunde: { name: 'Firma' }, status: 'offen', brutto: 1190 },
                    ],
                },
            };
            svc().buildIndex();
            const inv = svc().index.find(i => i.type === 'rechnung');
            expect(inv).toBeTruthy();
            expect(inv.view).toBe('rechnungen');
        });

        it('indexes tasks when taskService available', () => {
            window.storeService = { state: {} };
            window.taskService = {
                getAllTasks: () => [
                    { id: 'T-1', title: 'Fix pump', priority: 'high', description: 'Repair' },
                ],
            };
            svc().buildIndex();
            const task = svc().index.find(i => i.type === 'task');
            expect(task).toBeTruthy();
            expect(task.title).toBe('Fix pump');
            window.taskService = null;
        });
    });

    // ── Navigation ──

    describe('navigateToResult', () => {
        it('hides results and navigates', () => {
            svc().resultsContainer = { classList: { remove: vi.fn() } };
            window.navigationController = { navigateTo: vi.fn() };
            svc().navigateToResult('rechnung', 'RE-001', 'rechnungen');
            expect(window.navigationController.navigateTo).toHaveBeenCalledWith('rechnungen');
            window.navigationController = null;
        });
    });
});
