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

const cssProps = {};
globalThis.document = {
    documentElement: {
        style: { setProperty: vi.fn((k, v) => { cssProps[k] = v; }) },
    },
    body: {
        classList: {
            add: vi.fn(),
            remove: vi.fn(),
        },
    },
    createElement: vi.fn(() => ({
        className: '', innerHTML: '', title: '', onclick: null,
    })),
};

globalThis.window = globalThis;
window.matchMedia = vi.fn(() => ({
    matches: false,
    addEventListener: vi.fn(),
}));

await import('../js/services/theme-service.js');

const svc = () => window.themeService;

// ============================================
// Tests
// ============================================

describe('ThemeService', () => {
    beforeEach(() => {
        Object.keys(mockStorage).forEach(k => delete mockStorage[k]);
        Object.keys(cssProps).forEach(k => delete cssProps[k]);
        window.themeService = new window.themeService.constructor();
    });

    // ── Theme Management ──

    describe('Theme Management', () => {
        it('defaults to dark theme', () => {
            expect(svc().getCurrentTheme()).toBe('dark');
        });

        it('sets theme to light', () => {
            svc().setTheme('light');
            expect(svc().getCurrentTheme()).toBe('light');
        });

        it('toggles theme', () => {
            expect(svc().toggleTheme()).toBe('light');
            expect(svc().toggleTheme()).toBe('dark');
        });

        it('persists theme setting', () => {
            svc().setTheme('light');
            expect(mockStorage['freyai_theme_settings']).toBeTruthy();
            const stored = JSON.parse(mockStorage['freyai_theme_settings']);
            expect(stored.theme).toBe('light');
        });
    });

    // ── Accent Color ──

    describe('Accent Color', () => {
        it('has default accent color', () => {
            expect(svc().settings.accentColor).toBe('#c8956c');
        });

        it('sets accent color', () => {
            svc().setAccentColor('#3b82f6');
            expect(svc().settings.accentColor).toBe('#3b82f6');
        });

        it('has preset colors', () => {
            const presets = svc().getAccentPresets();
            expect(presets.length).toBeGreaterThan(0);
            expect(presets[0]).toHaveProperty('name');
            expect(presets[0]).toHaveProperty('color');
        });
    });

    // ── Color Adjustment ──

    describe('adjustColor', () => {
        it('lightens a color', () => {
            const result = svc().adjustColor('#000000', 50);
            expect(result).toMatch(/^#/);
        });

        it('returns rgba when alpha specified', () => {
            const result = svc().adjustColor('#ff0000', 0, 0.5);
            expect(result).toContain('rgba');
            expect(result).toContain('0.5');
        });

        it('clamps to valid range', () => {
            const result = svc().adjustColor('#ffffff', 100);
            // Should not exceed #ffffff
            expect(result).toMatch(/^#[0-9a-f]{6}$/);
        });
    });

    // ── Settings ──

    describe('getSettings', () => {
        it('returns settings object', () => {
            const settings = svc().getSettings();
            expect(settings.theme).toBeTruthy();
            expect(settings.currentTheme).toBeTruthy();
            expect(settings.accentColor).toBeTruthy();
        });
    });

    // ── System Theme ──

    describe('getSystemTheme', () => {
        it('returns dark when no light preference', () => {
            expect(svc().getSystemTheme()).toBe('dark');
        });

        it('returns light when system prefers light', () => {
            window.matchMedia = vi.fn(() => ({ matches: true, addEventListener: vi.fn() }));
            expect(svc().getSystemTheme()).toBe('light');
            window.matchMedia = vi.fn(() => ({ matches: false, addEventListener: vi.fn() }));
        });
    });

    // ── Create Toggle Button ──

    describe('createToggleButton', () => {
        it('creates a button element', () => {
            const btn = svc().createToggleButton();
            expect(btn).toBeTruthy();
            expect(btn.className).toBe('theme-toggle-btn');
        });
    });
});
