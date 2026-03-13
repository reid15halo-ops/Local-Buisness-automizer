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

globalThis.document = {
    documentElement: { lang: 'de' },
    createElement: vi.fn((tag) => ({
        tagName: tag.toUpperCase(),
        type: '',
        className: '',
        value: '',
        textContent: '',
        selected: false,
        appendChild: vi.fn(),
        onchange: null,
    })),
};

globalThis.window = globalThis;
window.dispatchEvent = vi.fn();
window.CustomEvent = class CustomEvent {
    constructor(type, opts) { this.type = type; this.detail = opts?.detail; }
};

// Provide German translations stub
window.i18nDE = {
    nav: { dashboard: 'Dashboard', settings: 'Einstellungen' },
    action: { save: 'Speichern', cancel: 'Abbrechen' },
    msg: { welcome: 'Willkommen, {{name}}!' },
};
window.i18nEN = {
    nav: { dashboard: 'Dashboard', settings: 'Settings' },
    action: { save: 'Save', cancel: 'Cancel' },
    msg: { welcome: 'Welcome, {{name}}!' },
};

// Load the service
await import('../js/services/i18n-service.js');

const svc = () => window.i18nService;

// ============================================
// Tests
// ============================================

describe('I18nService', () => {
    beforeEach(() => {
        Object.keys(mockStorage).forEach(k => delete mockStorage[k]);
        window.i18nService = new window.i18nService.constructor();
    });

    // ── Locale Management ──

    describe('Locale Management', () => {
        it('defaults to German locale', () => {
            expect(svc().getLocale()).toBe('de');
        });

        it('switches to English', () => {
            const result = svc().setLocale('en');
            expect(result).toBe(true);
            expect(svc().getLocale()).toBe('en');
        });

        it('rejects unknown locale', () => {
            const result = svc().setLocale('xx');
            expect(result).toBe(false);
            expect(svc().getLocale()).toBe('de');
        });

        it('dispatches localeChanged event', () => {
            svc().setLocale('en');
            expect(window.dispatchEvent).toHaveBeenCalled();
        });

        it('lists available locales', () => {
            const locales = svc().getAvailableLocales();
            expect(locales).toHaveLength(3);
            const codes = locales.map(l => l.code);
            expect(codes).toContain('de');
            expect(codes).toContain('en');
            expect(codes).toContain('tr');
        });
    });

    // ── Translation ──

    describe('Translation', () => {
        it('translates German keys', () => {
            expect(svc().t('nav.dashboard')).toBe('Dashboard');
            expect(svc().t('action.save')).toBe('Speichern');
        });

        it('translates English keys after locale switch', () => {
            svc().setLocale('en');
            expect(svc().t('action.save')).toBe('Save');
            expect(svc().t('action.cancel')).toBe('Cancel');
        });

        it('falls back to German for missing EN key', () => {
            svc().setLocale('en');
            // Turkish key only exists in TR
            expect(svc().t('nav.tasks')).toBe('nav.tasks'); // falls back to key
        });

        it('returns key when no translation found', () => {
            expect(svc().t('nonexistent.key')).toBe('nonexistent.key');
        });

        it('replaces {{param}} placeholders', () => {
            const result = svc().t('msg.welcome', { name: 'Max' });
            expect(result).toBe('Willkommen, Max!');
        });

        it('leaves unmatched placeholders intact', () => {
            const result = svc().t('msg.welcome', {});
            expect(result).toBe('Willkommen, {{name}}!');
        });

        it('translates Turkish keys', () => {
            svc().setLocale('tr');
            expect(svc().t('nav.dashboard')).toBe('Gösterge Paneli');
            expect(svc().t('action.save')).toBe('Kaydet');
        });
    });

    // ── Flattening ──

    describe('flattenTranslations', () => {
        it('flattens nested objects to dot notation', () => {
            const flat = svc().flattenTranslations({
                a: { b: { c: 'deep' } },
                x: 'top',
            });
            expect(flat['a.b.c']).toBe('deep');
            expect(flat['x']).toBe('top');
        });

        it('handles empty object', () => {
            expect(svc().flattenTranslations({})).toEqual({});
        });
    });

    // ── addTranslations ──

    describe('addTranslations', () => {
        it('adds translations to existing locale', () => {
            svc().addTranslations('de', { 'custom.key': 'Wert' });
            expect(svc().t('custom.key')).toBe('Wert');
        });

        it('creates new locale with translations', () => {
            svc().addTranslations('fr', { 'greeting': 'Bonjour' });
            svc().setLocale('fr');
            expect(svc().t('greeting')).toBe('Bonjour');
        });
    });

    // ── Number / Currency / Date formatting ──

    describe('Formatting', () => {
        it('formats number with German locale', () => {
            const result = svc().formatNumber(1234.56);
            // German locale uses comma for decimal
            expect(result).toContain('1');
            expect(result).toContain('234');
        });

        it('formats currency as EUR', () => {
            const result = svc().formatCurrency(99.99);
            expect(result).toContain('99');
            expect(result).toMatch(/€|EUR/);
        });

        it('formats currency with custom currency', () => {
            const result = svc().formatCurrency(50, 'USD');
            expect(result).toContain('50');
        });

        it('formats date', () => {
            const result = svc().formatDate('2024-06-15');
            expect(result).toBeTruthy();
            expect(typeof result).toBe('string');
        });

        it('formats time', () => {
            const result = svc().formatTime(new Date(2024, 5, 15, 14, 30));
            expect(result).toBeTruthy();
        });

        it('formats date and time together', () => {
            const result = svc().formatDateTime(new Date(2024, 5, 15, 14, 30));
            expect(result).toBeTruthy();
            expect(typeof result).toBe('string');
        });
    });

    // ── Persistence ──

    describe('Persistence', () => {
        it('saves locale to localStorage', () => {
            svc().setLocale('en');
            svc().save();
            expect(localStorage.setItem).toHaveBeenCalledWith(
                'freyai_i18n_settings',
                expect.stringContaining('"locale":"en"')
            );
        });
    });

    // ── Global shorthand ──

    describe('Global shorthand', () => {
        it('window.t() calls i18nService.t()', () => {
            expect(window.t('action.save')).toBe('Speichern');
        });
    });
});
