import { describe, it, expect, beforeEach, vi } from 'vitest';

// ============================================
// Mocks
// ============================================

const mockStorage = {};
globalThis.localStorage = {
    getItem: vi.fn(k => mockStorage[k] || null),
    setItem: vi.fn((k, v) => { mockStorage[k] = v; }),
};

globalThis.StorageUtils = {
    getJSON: vi.fn((key, fallback) => {
        const raw = mockStorage[key];
        return raw ? JSON.parse(raw) : fallback;
    }),
};

globalThis.window = globalThis;
window.communicationService = null;

vi.useFakeTimers();

await import('../js/services/print-digital-service.js');

const svc = () => window.printDigitalService;

// ============================================
// Tests
// ============================================

describe('PrintDigitalService', () => {
    beforeEach(() => {
        Object.keys(mockStorage).forEach(k => delete mockStorage[k]);
        vi.clearAllTimers();
        window.printDigitalService = new window.printDigitalService.constructor();
        window.communicationService = null;
    });

    describe('constructor defaults', () => {
        it('has default settings', () => {
            expect(svc().settings.preferDigital).toBe(true);
            expect(svc().settings.autoDigitize).toBe(true);
        });
    });

    describe('canSendDigital', () => {
        it('returns truthy with email', () => {
            expect(svc().canSendDigital({ email: 'test@test.de' })).toBeTruthy();
        });

        it('returns truthy with fax', () => {
            expect(svc().canSendDigital({ fax: '+491234' })).toBeTruthy();
        });

        it('returns falsy without contact info', () => {
            expect(svc().canSendDigital({})).toBeFalsy();
        });

        it('returns falsy for null', () => {
            expect(svc().canSendDigital(null)).toBeFalsy();
        });
    });

    describe('addToPrintQueue', () => {
        it('adds print item to queue', () => {
            const item = svc().addToPrintQueue({
                id: 'doc-1',
                type: 'rechnung',
                title: 'Rechnung 001',
                recipient: {},
            });
            expect(item.id).toMatch(/^print-/);
            expect(item.documentType).toBe('rechnung');
            expect(item.deliveryMethod).toBe('print');
        });

        it('prefers digital when recipient has email', () => {
            const item = svc().addToPrintQueue({
                id: 'doc-1',
                type: 'angebot',
                title: 'Angebot',
                recipient: { email: 'kunde@test.de' },
            });
            expect(item.deliveryMethod).toBe('email');
            expect(item.status).toBe('digital_sent'); // auto-processed
        });

        it('persists queue', () => {
            svc().addToPrintQueue({ id: 'd1', type: 'brief', title: 'T', recipient: {} });
            expect(mockStorage['freyai_print_queue']).toBeTruthy();
        });

        it('respects options', () => {
            const item = svc().addToPrintQueue(
                { id: 'd1', type: 'rechnung', title: 'T', recipient: {} },
                { copies: 3, color: true, duplex: true, priority: 'high' }
            );
            expect(item.copies).toBe(3);
            expect(item.color).toBe(true);
            expect(item.duplex).toBe(true);
            expect(item.priority).toBe('high');
        });
    });

    describe('processPrintItem', () => {
        it('returns error for unknown item', () => {
            const result = svc().processPrintItem('print-999');
            expect(result.success).toBe(false);
        });

        it('processes print item', () => {
            const item = svc().addToPrintQueue({
                id: 'd1', type: 'rechnung', title: 'Test', recipient: {},
            }, { preferDigital: false });
            const result = svc().processPrintItem(item.id);
            expect(result.success).toBe(true);
            expect(result.method).toBe('print');
        });
    });

    describe('sendDigital', () => {
        it('sends digitally and updates status', () => {
            const item = svc().addToPrintQueue({
                id: 'd1', type: 'angebot', title: 'Test',
                recipient: { email: 'test@test.de' },
            }, { preferDigital: false, digitalFallback: false });
            // Force print delivery so we can test sendDigital separately
            item.deliveryMethod = 'print';
            item.status = 'pending';

            const result = svc().sendDigital(item.id);
            expect(result.success || item.status === 'digital_sent').toBe(true);
        });

        it('returns error for unknown item', () => {
            const result = svc().sendDigital('print-999');
            expect(result.success).toBe(false);
        });
    });
});
