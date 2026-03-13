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

globalThis.window = globalThis;
window.storeService = null;
window.errorHandler = null;

globalThis.fetch = vi.fn(async () => ({ ok: true, status: 200 }));

await import('../js/services/webhook-event-service.js');

const svc = () => window.webhookEventService;

// ============================================
// Tests
// ============================================

describe('WebhookEventService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.webhookEventService = new window.webhookEventService.constructor();
    });

    describe('constructor', () => {
        it('has default webhook URL', () => {
            expect(svc().n8nWebhookUrl).toContain('freyai-events');
        });

        it('is enabled by default', () => {
            expect(svc()._enabled).toBe(true);
        });
    });

    describe('init', () => {
        it('overrides URL from storeService settings', async () => {
            window.storeService = { state: { settings: { n8nWebhookUrl: 'https://custom.example.com/hook' } } };
            await svc().init();
            expect(svc().n8nWebhookUrl).toBe('https://custom.example.com/hook');
            window.storeService = null;
        });
    });

    describe('emit', () => {
        it('sends event via fetch', async () => {
            await svc().emit('invoice.created', { id: 'inv-1' });
            expect(fetch).toHaveBeenCalledWith(
                svc().n8nWebhookUrl,
                expect.objectContaining({
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                })
            );
            const body = JSON.parse(fetch.mock.calls[0][1].body);
            expect(body.event).toBe('invoice.created');
            expect(body.data.id).toBe('inv-1');
            expect(body.source).toBe('freyai-app');
        });

        it('does not send when disabled', async () => {
            svc()._enabled = false;
            await svc().emit('test', {});
            expect(fetch).not.toHaveBeenCalled();
        });

        it('does not throw on fetch error', async () => {
            fetch.mockRejectedValueOnce(new Error('Network error'));
            await expect(svc().emit('test', {})).resolves.not.toThrow();
        });
    });

    describe('convenience methods', () => {
        it('invoiceCreated emits invoice.created', async () => {
            const spy = vi.spyOn(svc(), 'emit');
            await svc().invoiceCreated({ nummer: 'RE-001', kunde: { name: 'Meier' }, brutto: 1190 });
            expect(spy).toHaveBeenCalledWith('invoice.created', expect.objectContaining({
                nummer: 'RE-001',
                brutto: 1190,
            }));
        });
    });
});
