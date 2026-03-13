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
window.supabaseClient = null;

await import('../js/services/call-summary-service.js');

const svc = () => window.callSummaryService;

// ============================================
// Tests
// ============================================

describe('CallSummaryService', () => {
    beforeEach(() => {
        window.callSummaryService = new window.callSummaryService.constructor();
        window.supabaseClient = null;
    });

    describe('_getSupabase', () => {
        it('returns null when not configured', () => {
            expect(svc()._getSupabase()).toBeNull();
        });

        it('returns client when configured', () => {
            const mockClient = { auth: { getUser: vi.fn() } };
            window.supabaseClient = {
                isConfigured: () => true,
                client: mockClient,
            };
            expect(svc()._getSupabase()).toBe(mockClient);
        });
    });

    describe('saveSummary', () => {
        it('returns null without supabase', async () => {
            const result = await svc().saveSummary({ summary: 'Test' });
            expect(result).toBeNull();
        });

        it('returns null without user', async () => {
            window.supabaseClient = {
                isConfigured: () => true,
                client: {
                    auth: { getUser: vi.fn(async () => ({ data: { user: null } })) },
                }
            };
            const result = await svc().saveSummary({ summary: 'Test' });
            expect(result).toBeNull();
        });

        it('saves summary via supabase', async () => {
            const mockResult = { id: 'cs-1', summary: 'Test call' };
            window.supabaseClient = {
                isConfigured: () => true,
                client: {
                    auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'user-1' } } })) },
                    from: vi.fn(() => ({
                        upsert: vi.fn(() => ({
                            select: vi.fn(() => ({
                                single: vi.fn(async () => ({ data: mockResult, error: null }))
                            }))
                        }))
                    }))
                }
            };

            const result = await svc().saveSummary({
                kundeId: 'k1',
                kundeName: 'Meier',
                phone: '+491234567',
                summary: 'Test call summary',
            });
            expect(result).toEqual(mockResult);
        });
    });

    describe('getSummariesForCustomer', () => {
        it('returns empty array without supabase', async () => {
            const result = await svc().getSummariesForCustomer('k1');
            expect(result).toEqual([]);
        });
    });

    describe('getRecentSummaries', () => {
        it('returns empty array without supabase', async () => {
            const result = await svc().getRecentSummaries();
            expect(result).toEqual([]);
        });
    });

    describe('deleteSummary', () => {
        it('returns false without supabase', async () => {
            const result = await svc().deleteSummary('cs-1');
            expect(result).toBe(false);
        });
    });

    describe('getSummariesByPhone', () => {
        it('returns empty array without supabase', async () => {
            const result = await svc().getSummariesByPhone('+491234567');
            expect(result).toEqual([]);
        });
    });
});
