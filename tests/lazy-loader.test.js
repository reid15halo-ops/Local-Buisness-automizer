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
    querySelector: vi.fn(() => null),
    createElement: vi.fn(() => ({
        src: '', async: false, onload: null, onerror: null, remove: vi.fn(),
    })),
    body: { appendChild: vi.fn() },
};

globalThis.window = globalThis;
window.requestIdleCallback = null;
window.errorDisplayService = null;
window.showToast = vi.fn();

await import('../js/services/lazy-loader.js');

const svc = () => window.lazyLoader;

// ============================================
// Tests
// ============================================

describe('LazyLoader', () => {
    beforeEach(() => {
        window.lazyLoader = new window.lazyLoader.constructor();
        vi.clearAllMocks();
    });

    describe('constructor', () => {
        it('has service groups defined', () => {
            expect(Object.keys(svc().serviceGroups).length).toBeGreaterThan(5);
            expect(svc().serviceGroups.core).toBeDefined();
            expect(svc().serviceGroups.finance).toBeDefined();
            expect(svc().serviceGroups.crm).toBeDefined();
        });

        it('has view to groups mapping', () => {
            expect(svc().viewToGroups.dashboard).toBeDefined();
            expect(svc().viewToGroups.rechnungen).toBeDefined();
            expect(svc().viewToGroups.kunden).toBeDefined();
        });

        it('starts with empty loaded set', () => {
            expect(svc().loaded.size).toBe(0);
        });
    });

    describe('registerCriticalServices', () => {
        it('marks services as pre-loaded', () => {
            svc().registerCriticalServices(['auth-service', 'sanitize-service']);
            expect(svc().loaded.has('js/services/auth-service')).toBe(true);
            expect(svc().loaded.has('js/services/sanitize-service')).toBe(true);
        });
    });

    describe('getStats', () => {
        it('returns loading statistics', () => {
            const stats = svc().getStats();
            expect(stats.loaded).toBe(0);
            expect(stats.loading).toBe(0);
            expect(stats.total).toBeGreaterThan(0);
            expect(stats.serviceGroups).toContain('core');
        });

        it('reflects registered services', () => {
            svc().registerCriticalServices(['auth-service']);
            const stats = svc().getStats();
            expect(stats.loaded).toBe(1);
        });
    });

    describe('loadScript', () => {
        it('resolves immediately for already loaded scripts', async () => {
            svc().loaded.add('js/services/test-service');
            await expect(svc().loadScript('test-service')).resolves.toBeUndefined();
        });

        it('resolves if script already in DOM', async () => {
            document.querySelector.mockReturnValueOnce({ src: 'js/services/existing.js' });
            await svc().loadScript('existing');
            expect(svc().loaded.has('js/services/existing')).toBe(true);
        });
    });

    describe('loadGroup', () => {
        it('warns for unknown group', async () => {
            const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
            await svc().loadGroup('nonexistent');
            expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('nonexistent'));
            warnSpy.mockRestore();
        });
    });

    describe('_showLoadError', () => {
        it('uses showToast when available', () => {
            svc()._showLoadError('test-service');
            expect(window.showToast).toHaveBeenCalledWith(
                expect.stringContaining('test-service'),
                'error'
            );
        });

        it('uses errorDisplayService when available', () => {
            const showError = vi.fn();
            window.errorDisplayService = { showError };
            svc()._showLoadError('test-service');
            expect(showError).toHaveBeenCalled();
            window.errorDisplayService = null;
        });
    });
});
