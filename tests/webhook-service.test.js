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

// Mock crypto
Object.defineProperty(globalThis, 'crypto', {
    value: {
        getRandomValues: (arr) => { for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256); return arr; },
        subtle: {
            importKey: vi.fn(async () => 'mock-key'),
            sign: vi.fn(async () => new Uint8Array(32)),
        }
    },
    writable: true,
    configurable: true,
});

// Mock fetch
globalThis.fetch = vi.fn(async () => ({
    ok: true,
    status: 200,
    text: async () => 'OK',
}));

// Mock URL
globalThis.URL = globalThis.URL || URL;

await import('../js/services/webhook-service.js');

const svc = () => window.webhookService;

// ============================================
// Tests
// ============================================

describe('WebhookService', () => {
    beforeEach(() => {
        Object.keys(mockStorage).forEach(k => delete mockStorage[k]);
        vi.clearAllMocks();
        window.webhookService = new window.webhookService.constructor();
    });

    // ── Event Types ──

    describe('eventTypes', () => {
        it('has predefined event types', () => {
            expect(svc().eventTypes.length).toBeGreaterThan(0);
            expect(svc().eventTypes).toContain('invoice.created');
            expect(svc().eventTypes).toContain('customer.created');
            expect(svc().eventTypes).toContain('payment.received');
        });
    });

    // ── Register Webhook ──

    describe('registerWebhook', () => {
        it('registers a webhook', () => {
            const result = svc().registerWebhook({
                name: 'Test Webhook',
                url: 'https://example.com/webhook',
                events: ['invoice.created'],
            });
            expect(result.success).toBe(true);
            expect(result.webhook.id).toMatch(/^wh-/);
            expect(result.webhook.name).toBe('Test Webhook');
            expect(result.webhook.active).toBe(true);
        });

        it('generates secret if not provided', () => {
            const result = svc().registerWebhook({
                name: 'Test',
                url: 'https://example.com/hook',
                events: [],
            });
            expect(result.webhook.secret).toBeTruthy();
            expect(result.webhook.secret.length).toBeGreaterThan(0);
        });

        it('persists to localStorage', () => {
            svc().registerWebhook({ name: 'T', url: 'https://example.com', events: [] });
            expect(mockStorage['freyai_webhooks']).toBeTruthy();
        });
    });

    // ── Update Webhook ──

    describe('updateWebhook', () => {
        it('updates webhook properties', () => {
            const { webhook } = svc().registerWebhook({ name: 'Test', url: 'https://example.com', events: [] });
            const result = svc().updateWebhook(webhook.id, { name: 'Updated' });
            expect(result.success).toBe(true);
            expect(result.webhook.name).toBe('Updated');
        });

        it('returns error for unknown ID', () => {
            const result = svc().updateWebhook('wh-999', { name: 'X' });
            expect(result.success).toBe(false);
        });
    });

    // ── Delete Webhook ──

    describe('deleteWebhook', () => {
        it('removes webhook', () => {
            const { webhook } = svc().registerWebhook({ name: 'T', url: 'https://example.com', events: [] });
            svc().deleteWebhook(webhook.id);
            expect(svc().getWebhooks()).toHaveLength(0);
        });
    });

    // ── URL Safety ──

    describe('_isAllowedUrl', () => {
        it('blocks localhost', () => {
            expect(svc()._isAllowedUrl('http://localhost:3000/hook')).toBe(false);
        });

        it('blocks 127.0.0.1', () => {
            expect(svc()._isAllowedUrl('http://127.0.0.1/hook')).toBe(false);
        });

        it('blocks private networks', () => {
            expect(svc()._isAllowedUrl('http://192.168.1.1/hook')).toBe(false);
            expect(svc()._isAllowedUrl('http://10.0.0.1/hook')).toBe(false);
        });

        it('allows external URLs', () => {
            expect(svc()._isAllowedUrl('https://example.com/webhook')).toBe(true);
        });

        it('returns false for invalid URLs', () => {
            expect(svc()._isAllowedUrl('not-a-url')).toBe(false);
        });
    });

    // ── API Keys ──

    describe('createApiKey', () => {
        it('creates an API key', () => {
            const result = svc().createApiKey('My Key', ['read:invoices']);
            expect(result.success).toBe(true);
            expect(result.apiKey.key).toMatch(/^freyai_/);
            expect(result.apiKey.name).toBe('My Key');
            expect(result.apiKey.permissions).toContain('read:invoices');
        });
    });

    describe('validateApiKey', () => {
        it('validates a valid key', () => {
            const { apiKey } = svc().createApiKey('Test', ['read:invoices']);
            const result = svc().validateApiKey(apiKey.key);
            expect(result.valid).toBe(true);
            expect(result.permissions).toContain('read:invoices');
        });

        it('returns invalid for unknown key', () => {
            const result = svc().validateApiKey('fake_key_12345');
            expect(result.valid).toBe(false);
        });

        it('increments usage count', () => {
            const { apiKey } = svc().createApiKey('Test', []);
            svc().validateApiKey(apiKey.key);
            svc().validateApiKey(apiKey.key);
            const keys = svc().apiKeys.find(k => k.id === apiKey.id);
            expect(keys.usageCount).toBe(2);
        });
    });

    describe('revokeApiKey', () => {
        it('revokes an API key', () => {
            const { apiKey } = svc().createApiKey('Test', []);
            const result = svc().revokeApiKey(apiKey.id);
            expect(result.success).toBe(true);
            // Revoked key should not validate
            const validation = svc().validateApiKey(apiKey.key);
            expect(validation.valid).toBe(false);
        });

        it('returns failure for unknown key', () => {
            const result = svc().revokeApiKey('key-999');
            expect(result.success).toBe(false);
        });
    });

    // ── Get API Keys (masked) ──

    describe('getApiKeys', () => {
        it('masks API keys', () => {
            svc().createApiKey('Test', []);
            const keys = svc().getApiKeys();
            expect(keys[0].key).toContain('...');
            expect(keys[0].key.length).toBeLessThan(svc().apiKeys[0].key.length);
        });
    });

    // ── Statistics ──

    describe('getStatistics', () => {
        it('returns stats', () => {
            svc().registerWebhook({ name: 'A', url: 'https://a.com', events: [] });
            svc().registerWebhook({ name: 'B', url: 'https://b.com', events: [] });
            svc().createApiKey('K1', []);

            const stats = svc().getStatistics();
            expect(stats.totalWebhooks).toBe(2);
            expect(stats.activeWebhooks).toBe(2);
            expect(stats.apiKeys).toBe(1);
            expect(stats.activeApiKeys).toBe(1);
        });
    });

    // ── Get Webhook ──

    describe('getWebhook', () => {
        it('finds webhook by ID', () => {
            const { webhook } = svc().registerWebhook({ name: 'Test', url: 'https://example.com', events: [] });
            expect(svc().getWebhook(webhook.id)).toBeTruthy();
            expect(svc().getWebhook(webhook.id).name).toBe('Test');
        });

        it('returns undefined for unknown ID', () => {
            expect(svc().getWebhook('wh-999')).toBeUndefined();
        });
    });

    // ── Webhook Log ──

    describe('getWebhookLog', () => {
        it('returns empty log initially', () => {
            expect(svc().getWebhookLog()).toHaveLength(0);
        });

        it('respects limit', () => {
            svc().webhookLog = Array.from({ length: 10 }, (_, i) => ({
                id: `log-${i}`,
                timestamp: new Date(2024, 2, i + 1).toISOString(),
            }));
            const log = svc().getWebhookLog(null, 5);
            expect(log).toHaveLength(5);
        });

        it('filters by webhookId', () => {
            svc().webhookLog = [
                { id: 'l1', webhookId: 'wh-1', timestamp: new Date().toISOString() },
                { id: 'l2', webhookId: 'wh-2', timestamp: new Date().toISOString() },
            ];
            const log = svc().getWebhookLog('wh-1');
            expect(log).toHaveLength(1);
        });
    });

    // ── Trigger Event ──

    describe('triggerEvent', () => {
        it('triggers matching webhooks', async () => {
            svc().registerWebhook({ name: 'A', url: 'https://example.com/a', events: ['invoice.created'] });
            svc().registerWebhook({ name: 'B', url: 'https://example.com/b', events: ['customer.created'] });

            const results = await svc().triggerEvent('invoice.created', { id: 'inv-1' });
            expect(results).toHaveLength(1);
        });

        it('skips inactive webhooks', async () => {
            const { webhook } = svc().registerWebhook({ name: 'A', url: 'https://example.com/a', events: ['invoice.created'] });
            svc().updateWebhook(webhook.id, { active: false });

            const results = await svc().triggerEvent('invoice.created', {});
            expect(results).toHaveLength(0);
        });
    });
});
