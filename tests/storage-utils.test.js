import { describe, it, expect, beforeEach, vi } from 'vitest';

// ============================================
// Mocks
// ============================================

const mockStorage = {};
globalThis.localStorage = {
    getItem: vi.fn(k => mockStorage[k] !== undefined ? mockStorage[k] : null),
    setItem: vi.fn((k, v) => { mockStorage[k] = v; }),
    removeItem: vi.fn(k => { delete mockStorage[k]; }),
};

globalThis.window = globalThis;
window.errorHandler = null;

await import('../js/services/storage-utils.js');

const svc = () => window.StorageUtils;

// ============================================
// Tests
// ============================================

describe('StorageUtils', () => {
    beforeEach(() => {
        Object.keys(mockStorage).forEach(k => delete mockStorage[k]);
        localStorage.getItem.mockClear();
        localStorage.setItem.mockClear();
    });

    // ── getJSON ──

    describe('getJSON', () => {
        it('returns parsed JSON from localStorage', () => {
            mockStorage['test-key'] = JSON.stringify({ name: 'Test' });
            expect(svc().getJSON('test-key')).toEqual({ name: 'Test' });
        });

        it('returns fallback when key not found', () => {
            expect(svc().getJSON('missing', 'default')).toBe('default');
        });

        it('returns fallback for corrupt JSON', () => {
            mockStorage['bad'] = 'not-json{';
            expect(svc().getJSON('bad', [])).toEqual([]);
        });

        it('returns null as default fallback', () => {
            expect(svc().getJSON('missing')).toBeNull();
        });

        it('reads arrays correctly', () => {
            mockStorage['arr'] = JSON.stringify([1, 2, 3]);
            expect(svc().getJSON('arr')).toEqual([1, 2, 3]);
        });
    });

    // ── setJSON ──

    describe('setJSON', () => {
        it('writes JSON to localStorage', () => {
            const result = svc().setJSON('key', { a: 1 });
            expect(result).toBe(true);
            expect(mockStorage['key']).toBe('{"a":1}');
        });

        it('writes arrays', () => {
            svc().setJSON('arr', [1, 2]);
            expect(JSON.parse(mockStorage['arr'])).toEqual([1, 2]);
        });

        it('returns false when setItem throws', () => {
            localStorage.setItem.mockImplementationOnce(() => { throw new Error('quota'); });
            const result = svc().setJSON('fail', { x: 1 });
            expect(result).toBe(false);
        });
    });

    // ── getString ──

    describe('getString', () => {
        it('reads string value', () => {
            mockStorage['str'] = 'hello';
            expect(svc().getString('str')).toBe('hello');
        });

        it('returns fallback for missing key', () => {
            expect(svc().getString('missing', 'fallback')).toBe('fallback');
        });

        it('returns empty string as default fallback', () => {
            expect(svc().getString('missing')).toBe('');
        });
    });

    // ── safeDate ──

    describe('safeDate', () => {
        it('parses valid ISO date', () => {
            const d = svc().safeDate('2024-03-15');
            expect(d).toBeInstanceOf(Date);
            expect(d.getFullYear()).toBe(2024);
        });

        it('returns null for empty value', () => {
            expect(svc().safeDate(null)).toBeNull();
            expect(svc().safeDate('')).toBeNull();
            expect(svc().safeDate(undefined)).toBeNull();
        });

        it('returns null for invalid date string', () => {
            expect(svc().safeDate('not-a-date')).toBeNull();
        });
    });

    // ── safeNumber ──

    describe('safeNumber', () => {
        it('returns number for valid input', () => {
            expect(svc().safeNumber(42)).toBe(42);
            expect(svc().safeNumber('3.14')).toBe(3.14);
        });

        it('returns fallback for NaN', () => {
            expect(svc().safeNumber('abc', 0)).toBe(0);
            expect(svc().safeNumber(undefined, 0)).toBe(0);
        });

        it('returns fallback for Infinity', () => {
            expect(svc().safeNumber(Infinity, 0)).toBe(0);
        });

        it('uses 0 as default fallback', () => {
            expect(svc().safeNumber(null)).toBe(0);
        });
    });

    // ── safeDivide ──

    describe('safeDivide', () => {
        it('divides normally', () => {
            expect(svc().safeDivide(10, 2)).toBe(5);
        });

        it('returns fallback for division by zero', () => {
            expect(svc().safeDivide(10, 0)).toBe(0);
            expect(svc().safeDivide(10, 0, -1)).toBe(-1);
        });
    });

    // ── getCustomerName ──

    describe('getCustomerName', () => {
        it('returns customer name from entity', () => {
            const entity = { kunde: { name: 'Max Mustermann' } };
            expect(svc().getCustomerName(entity)).toBe('Max Mustermann');
        });

        it('falls back to firma', () => {
            const entity = { kunde: { firma: 'Test GmbH' } };
            expect(svc().getCustomerName(entity)).toBe('Test GmbH');
        });

        it('returns Unbekannt for display context', () => {
            expect(svc().getCustomerName({}, 'display')).toBe('Unbekannt');
        });

        it('returns null for financial context', () => {
            expect(svc().getCustomerName({}, 'financial')).toBeNull();
        });

        it('returns null for dunning context', () => {
            expect(svc().getCustomerName({}, 'dunning')).toBeNull();
        });

        it('returns Unbekannt as default context', () => {
            expect(svc().getCustomerName({})).toBe('Unbekannt');
        });
    });

    // ── FALLBACKS ──

    describe('FALLBACKS', () => {
        it('has expected constants', () => {
            expect(svc().FALLBACKS.CUSTOMER_NAME_DISPLAY).toBe('Unbekannt');
            expect(svc().FALLBACKS.CUSTOMER_NAME_FINANCIAL).toBeNull();
            expect(svc().FALLBACKS.CUSTOMER_NAME_DUNNING).toBeNull();
            expect(svc().FALLBACKS.EMPTY_ARRAY).toBe('[]');
            expect(svc().FALLBACKS.EMPTY_OBJECT).toBe('{}');
        });

        it('FALLBACKS is frozen', () => {
            expect(Object.isFrozen(svc().FALLBACKS)).toBe(true);
        });
    });

    // ── isStorageAvailable ──

    describe('isStorageAvailable', () => {
        it('returns true when localStorage works', () => {
            expect(svc().isStorageAvailable()).toBe(true);
        });
    });
});
