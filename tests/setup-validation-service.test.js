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
window.supabaseConfig = null;
window.authService = null;

await import('../js/services/setup-validation-service.js');

const svc = () => window.setupValidationService;

// ============================================
// Tests
// ============================================

describe('SetupValidationService', () => {
    beforeEach(() => {
        window.setupValidationService = new window.setupValidationService.constructor();
        window.supabaseConfig = null;
        window.authService = null;
    });

    describe('_checkConfig', () => {
        it('returns not ok when supabase not configured', () => {
            const result = svc()._checkConfig();
            expect(result.ok).toBe(false);
            expect(result.name).toBe('Supabase konfiguriert');
        });

        it('returns ok when supabase configured', () => {
            window.supabaseConfig = { isConfigured: () => true };
            const result = svc()._checkConfig();
            expect(result.ok).toBe(true);
        });
    });

    describe('_checkConnection', () => {
        it('returns not ok when not configured', async () => {
            const result = await svc()._checkConnection();
            expect(result.ok).toBe(false);
        });

        it('returns ok when connection works', async () => {
            window.supabaseConfig = {
                isConfigured: () => true,
                get: () => ({
                    auth: {
                        getSession: vi.fn(async () => ({ data: { session: null } })),
                    }
                })
            };
            const result = await svc()._checkConnection();
            expect(result.ok).toBe(true);
            expect(result.detail).toContain('nicht eingeloggt');
        });

        it('returns ok with session info when logged in', async () => {
            window.supabaseConfig = {
                isConfigured: () => true,
                get: () => ({
                    auth: {
                        getSession: vi.fn(async () => ({
                            data: { session: { user: { email: 'test@test.de' } } }
                        })),
                    }
                })
            };
            const result = await svc()._checkConnection();
            expect(result.ok).toBe(true);
            expect(result.detail).toContain('eingeloggt');
        });
    });

    describe('_checkAuth', () => {
        it('returns not ok without auth service', async () => {
            const result = await svc()._checkAuth();
            expect(result.ok).toBe(false);
        });

        it('returns ok when session exists', async () => {
            window.authService = {
                isConfigured: () => true,
                getSession: vi.fn(async () => ({ user: { email: 'admin@test.de' } })),
            };
            const result = await svc()._checkAuth();
            expect(result.ok).toBe(true);
            expect(result.detail).toContain('admin@test.de');
        });

        it('returns not ok without session', async () => {
            window.authService = {
                isConfigured: () => true,
                getSession: vi.fn(async () => null),
            };
            const result = await svc()._checkAuth();
            expect(result.ok).toBe(false);
            expect(result.detail).toContain('anmelden');
        });
    });

    describe('validate', () => {
        it('runs all checks and fails when unconfigured', async () => {
            const result = await svc().validate();
            expect(result.ok).toBe(false);
            expect(result.checks.length).toBe(4);
        });

        it('stores last result', async () => {
            await svc().validate();
            expect(svc().getLastResult()).toBeTruthy();
        });
    });

    describe('getLastResult', () => {
        it('returns null before validation', () => {
            expect(svc().getLastResult()).toBeNull();
        });
    });

    describe('renderHTML', () => {
        it('returns no-validation message when null', () => {
            const html = svc().renderHTML(null);
            expect(html).toContain('Keine Validierung');
        });

        it('renders results HTML', async () => {
            const result = await svc().validate();
            const html = svc().renderHTML(result);
            expect(html).toContain('table');
            expect(html).toContain('fehlgeschlagen');
        });

        it('shows success for passing results', () => {
            const result = {
                ok: true,
                checks: [{ name: 'Test', ok: true, detail: 'OK' }],
            };
            const html = svc().renderHTML(result);
            expect(html).toContain('bestanden');
        });
    });
});
