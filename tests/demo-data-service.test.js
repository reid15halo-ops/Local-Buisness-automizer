import { describe, it, expect, vi } from 'vitest';

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

await import('../js/services/demo-data-service.js');

const svc = () => window.demoDataService;

// ============================================
// Tests
// ============================================

describe('DemoDataService', () => {
    describe('getDemoData', () => {
        it('returns demo data object', () => {
            const data = svc().getDemoData();
            expect(data).toBeTruthy();
            expect(typeof data).toBe('object');
        });

        it('includes anfragen', () => {
            const data = svc().getDemoData();
            expect(Array.isArray(data.anfragen)).toBe(true);
            expect(data.anfragen.length).toBeGreaterThan(0);
            expect(data.anfragen[0].id).toMatch(/^ANF-DEMO/);
        });

        it('includes angebote', () => {
            const data = svc().getDemoData();
            expect(Array.isArray(data.angebote)).toBe(true);
            expect(data.angebote.length).toBeGreaterThan(0);
        });

        it('anfragen have required fields', () => {
            const data = svc().getDemoData();
            data.anfragen.forEach(a => {
                expect(a.id).toBeTruthy();
                expect(a.kunde).toBeTruthy();
                expect(a.kunde.name).toBeTruthy();
                expect(a.leistungsart).toBeTruthy();
                expect(a.status).toBeTruthy();
            });
        });

        it('angebote have positionen', () => {
            const data = svc().getDemoData();
            data.angebote.forEach(a => {
                expect(Array.isArray(a.positionen)).toBe(true);
                expect(a.netto).toBeGreaterThan(0);
                expect(a.brutto).toBeGreaterThan(0);
            });
        });

        it('uses recent dates', () => {
            const data = svc().getDemoData();
            const now = new Date();
            const tenDaysAgo = new Date(now.getTime() - 11 * 24 * 60 * 60 * 1000);
            data.anfragen.forEach(a => {
                const created = new Date(a.createdAt);
                expect(created >= tenDaysAgo).toBe(true);
            });
        });
    });
});
