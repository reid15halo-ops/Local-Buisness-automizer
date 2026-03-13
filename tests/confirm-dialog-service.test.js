import { describe, it, expect, beforeEach, vi } from 'vitest';

// ============================================
// Mocks
// ============================================

const mockElements = [];
const mockElement = () => {
    const el = {
        className: '', textContent: '', id: '', type: '',
        setAttribute: vi.fn(),
        appendChild: vi.fn(),
        addEventListener: vi.fn(),
        remove: vi.fn(),
        focus: vi.fn(),
    };
    mockElements.push(el);
    return el;
};

globalThis.document = {
    createElement: vi.fn(() => mockElement()),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    body: {
        appendChild: vi.fn(),
        style: { overflow: '' },
    },
};

globalThis.window = globalThis;
window.AppUtils = null;

globalThis.localStorage = { getItem: vi.fn(() => null), setItem: vi.fn() };
globalThis.StorageUtils = { getJSON: vi.fn((k, f) => f) };

await import('../js/services/confirm-dialog-service.js');

const svc = () => window.confirmDialogService;

// ============================================
// Tests
// ============================================

describe('ConfirmDialogService', () => {
    beforeEach(() => {
        mockElements.length = 0;
        vi.clearAllMocks();
    });

    describe('showConfirmDialog', () => {
        it('creates dialog elements', () => {
            svc().showConfirmDialog({
                title: 'Test?',
                message: 'Are you sure?',
                confirmText: 'Yes',
                onConfirm: vi.fn(),
            });
            expect(document.createElement).toHaveBeenCalled();
            expect(document.body.appendChild).toHaveBeenCalled();
        });

        it('returns object with remove method', () => {
            const result = svc().showConfirmDialog({
                title: 'Test?',
                message: 'Sure?',
                confirmText: 'Yes',
                onConfirm: vi.fn(),
            });
            expect(result.remove).toBeDefined();
            expect(typeof result.remove).toBe('function');
        });

        it('sets destructive class when destructive=true', () => {
            svc().showConfirmDialog({
                title: 'Delete?',
                message: 'This is permanent.',
                confirmText: 'Delete',
                destructive: true,
                onConfirm: vi.fn(),
            });
            // Check that one of the created elements has destructive class
            const hasDestructive = mockElements.some(el =>
                el.className && el.className.includes('btn-destructive')
            );
            expect(hasDestructive).toBe(true);
        });
    });

    describe('showConfirmDialogAsync', () => {
        it('returns a promise', () => {
            const promise = svc().showConfirmDialogAsync({
                title: 'Test?',
                message: 'Sure?',
                confirmText: 'Yes',
            });
            expect(promise).toBeInstanceOf(Promise);
        });
    });

    describe('predefined confirmations', () => {
        it('confirmSendAngebot creates dialog', () => {
            const spy = vi.spyOn(svc(), 'showConfirmDialog');
            svc().confirmSendAngebot('ANG-001', 5000, 'Meier', vi.fn());
            expect(spy).toHaveBeenCalledWith(expect.objectContaining({
                title: 'Angebot absenden?',
            }));
        });

        it('confirmAcceptAngebot creates dialog', () => {
            const spy = vi.spyOn(svc(), 'showConfirmDialog');
            svc().confirmAcceptAngebot('ANG-001', 'Meier', vi.fn());
            expect(spy).toHaveBeenCalledWith(expect.objectContaining({
                title: 'Angebot annehmen?',
            }));
        });

        it('confirmCompleteAuftrag creates dialog', () => {
            const spy = vi.spyOn(svc(), 'showConfirmDialog');
            svc().confirmCompleteAuftrag('AUF-001', 'Meier', vi.fn());
            expect(spy).toHaveBeenCalledWith(expect.objectContaining({
                title: expect.stringContaining('abschließen'),
            }));
        });

        it('confirmMarkAsPaid creates dialog', () => {
            const spy = vi.spyOn(svc(), 'showConfirmDialog');
            svc().confirmMarkAsPaid('RE-001', 1190, vi.fn());
            expect(spy).toHaveBeenCalledWith(expect.objectContaining({
                title: expect.stringContaining('bezahlt'),
            }));
        });

        it('confirmCancelRechnung is destructive', () => {
            const spy = vi.spyOn(svc(), 'showConfirmDialog');
            svc().confirmCancelRechnung('RE-001', 1190, vi.fn());
            expect(spy).toHaveBeenCalledWith(expect.objectContaining({
                destructive: true,
            }));
        });

        it('confirmDelete is destructive', () => {
            const spy = vi.spyOn(svc(), 'showConfirmDialog');
            svc().confirmDelete('Kunde', 'Max Meier', vi.fn());
            expect(spy).toHaveBeenCalledWith(expect.objectContaining({
                destructive: true,
            }));
        });

        it('confirmSendMahnung creates dialog', () => {
            const spy = vi.spyOn(svc(), 'showConfirmDialog');
            svc().confirmSendMahnung('1. Mahnung', 'Meier', 'RE-001', 1190, vi.fn());
            expect(spy).toHaveBeenCalledWith(expect.objectContaining({
                title: 'Zahlungserinnerung senden?',
            }));
        });

        it('confirmSendMessage creates dialog', () => {
            const spy = vi.spyOn(svc(), 'showConfirmDialog');
            svc().confirmSendMessage('E-Mail', 'meier@test.de', vi.fn());
            expect(spy).toHaveBeenCalledWith(expect.objectContaining({
                title: 'Nachricht senden?',
            }));
        });
    });
});
