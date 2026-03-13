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

globalThis.document = {
    dispatchEvent: vi.fn(),
};

globalThis.CustomEvent = class CustomEvent {
    constructor(type, options) {
        this.type = type;
        this.detail = options?.detail;
        this.bubbles = options?.bubbles;
    }
};

globalThis.window = globalThis;

await import('../js/services/user-mode-service.js');

const svc = () => window.userModeService;

// ============================================
// Tests
// ============================================

describe('UserModeService', () => {
    beforeEach(() => {
        Object.keys(mockStorage).forEach(k => delete mockStorage[k]);
        window.userModeService = new window.userModeService.constructor();
    });

    // ── Mode Management ──

    describe('Mode Management', () => {
        it('defaults to simple mode', () => {
            expect(svc().getCurrentMode()).toBe('simple');
            expect(svc().isSimpleMode()).toBe(true);
            expect(svc().isProMode()).toBe(false);
        });

        it('loads saved mode from localStorage', () => {
            mockStorage['freyai_user_mode'] = 'pro';
            window.userModeService = new window.userModeService.constructor();
            expect(svc().isProMode()).toBe(true);
        });

        it('sets mode to pro', () => {
            svc().setMode('pro');
            expect(svc().isProMode()).toBe(true);
            expect(mockStorage['freyai_user_mode']).toBe('pro');
        });

        it('rejects invalid mode', () => {
            svc().setMode('invalid');
            expect(svc().isSimpleMode()).toBe(true);
        });

        it('does not fire event for same mode', () => {
            document.dispatchEvent.mockClear();
            svc().setMode('simple'); // already simple
            expect(document.dispatchEvent).not.toHaveBeenCalled();
        });

        it('fires event on mode change', () => {
            document.dispatchEvent.mockClear();
            svc().setMode('pro');
            expect(document.dispatchEvent).toHaveBeenCalled();
        });
    });

    // ── Toggle ──

    describe('toggleMode', () => {
        it('toggles from simple to pro', () => {
            const result = svc().toggleMode();
            expect(result).toBe('pro');
            expect(svc().isProMode()).toBe(true);
        });

        it('toggles from pro to simple', () => {
            svc().setMode('pro');
            const result = svc().toggleMode();
            expect(result).toBe('simple');
            expect(svc().isSimpleMode()).toBe(true);
        });
    });

    // ── Visibility Rules ──

    describe('Visibility Rules', () => {
        it('simple mode has core features', () => {
            const rules = svc().getVisibilityRules();
            expect(rules.simple).toContain('anfragen');
            expect(rules.simple).toContain('angebote');
            expect(rules.simple).toContain('rechnungen');
            expect(rules.simple).toContain('kunden');
        });

        it('pro mode has all features', () => {
            const rules = svc().getVisibilityRules();
            expect(rules.pro).toContain('dashboard');
            expect(rules.pro).toContain('zeiterfassung');
            expect(rules.pro).toContain('buchhaltung');
            expect(rules.pro).toContain('workflows');
        });

        it('pro mode has more items than simple', () => {
            const rules = svc().getVisibilityRules();
            expect(rules.pro.length).toBeGreaterThan(rules.simple.length);
        });
    });

    // ── View Visibility ──

    describe('isViewVisible', () => {
        it('shows rechnungen in simple mode', () => {
            expect(svc().isViewVisible('rechnungen')).toBe(true);
        });

        it('hides dashboard in simple mode', () => {
            expect(svc().isViewVisible('dashboard')).toBe(false);
        });

        it('shows dashboard in pro mode', () => {
            svc().setMode('pro');
            expect(svc().isViewVisible('dashboard')).toBe(true);
        });

        it('shows workflows in pro mode', () => {
            svc().setMode('pro');
            expect(svc().isViewVisible('workflows')).toBe(true);
        });
    });
});
