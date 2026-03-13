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
window.supabaseClient = null;
window.supabaseConfig = null;

await import('../js/services/company-settings-service.js');

const svc = () => window.companySettings;

// ============================================
// Tests
// ============================================

describe('CompanySettingsService', () => {
    beforeEach(() => {
        Object.keys(mockStorage).forEach(k => delete mockStorage[k]);
        window.companySettings = new window.companySettings.constructor();
        window.supabaseClient = null;
        window.supabaseConfig = null;
    });

    // ── Defaults ──

    describe('Defaults', () => {
        it('has sensible defaults', () => {
            const all = svc().getAll();
            expect(all.stundensatz).toBe(65.00);
            expect(all.default_tax_rate).toBe(0.19);
            expect(all.payment_terms_days).toBe(14);
            expect(all.kleinunternehmer).toBe(false);
            expect(all.invoice_prefix).toBe('RE-');
            expect(all.quote_prefix).toBe('AN-');
        });
    });

    // ── Getters ──

    describe('Getters', () => {
        it('getTaxRate returns 0.19 by default', () => {
            expect(svc().getTaxRate()).toBe(0.19);
        });

        it('getTaxRate returns 0 for Kleinunternehmer', () => {
            svc()._cache = { kleinunternehmer: true, default_tax_rate: 0.19 };
            svc()._loaded = true;
            expect(svc().getTaxRate()).toBe(0);
        });

        it('getStundensatz returns default', () => {
            expect(svc().getStundensatz()).toBe(65.00);
        });

        it('getPaymentTermsDays returns default', () => {
            expect(svc().getPaymentTermsDays()).toBe(14);
        });

        it('getNoReplyEmail returns default', () => {
            expect(svc().getNoReplyEmail()).toBe('noreply@freyaivisions.de');
        });

        it('isKleinunternehmer returns false by default', () => {
            expect(svc().isKleinunternehmer()).toBe(false);
        });

        it('getCompanyName returns empty by default', () => {
            expect(svc().getCompanyName()).toBe('');
        });
    });

    // ── Load from localStorage ──

    describe('load', () => {
        it('loads from localStorage when no Supabase', async () => {
            mockStorage['freyai_admin_settings'] = JSON.stringify({
                company_name: 'Test Metallbau GmbH',
                stundensatz: '85',
            });
            const settings = await svc().load();
            expect(settings.company_name).toBe('Test Metallbau GmbH');
            expect(settings.stundensatz).toBe(85);
        });

        it('deduplicates concurrent load calls', async () => {
            const p1 = svc().load();
            const p2 = svc().load();
            const [r1, r2] = await Promise.all([p1, p2]);
            expect(r1).toEqual(r2);
        });

        it('returns cached result on subsequent calls', async () => {
            await svc().load();
            const result = await svc().load();
            expect(result).toBeTruthy();
        });
    });

    // ── Save offline ──

    describe('save', () => {
        it('saves to localStorage when offline', async () => {
            await svc().load();
            const result = await svc().save({ stundensatz: 95 });
            expect(result.success).toBe(true);
            expect(result.offline).toBe(true);
            expect(svc().getStundensatz()).toBe(95);
        });
    });

    // ── Invalidate ──

    describe('invalidate', () => {
        it('clears cache', async () => {
            await svc().load();
            svc().invalidate();
            expect(svc()._loaded).toBe(false);
            expect(svc()._cache).toBeNull();
        });
    });

    // ── Global helpers ──

    describe('Global Helpers', () => {
        it('window._getTaxRate returns 0.19', () => {
            expect(window._getTaxRate()).toBe(0.19);
        });

        it('window._isKleinunternehmer returns false', () => {
            expect(window._isKleinunternehmer()).toBe(false);
        });
    });
});
