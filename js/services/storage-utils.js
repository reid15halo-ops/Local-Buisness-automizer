/* ============================================
   Storage Utilities — Safe localStorage Wrappers
   FreyAI Visions — Centralized storage access

   Replaces raw JSON.parse(localStorage.getItem())
   with logged, crash-proof, GoBD-aware wrappers.

   Dependencies: window.errorHandler (optional)
   ============================================ */

const StorageUtils = (() => {
    'use strict';

    // ==========================================
    // Fallback Constants (German CRM defaults)
    // ==========================================
    const FALLBACKS = Object.freeze({
        CUSTOMER_NAME_DISPLAY: 'Unbekannt',       // UI display only
        CUSTOMER_NAME_FINANCIAL: null,             // DATEV/GoBD paths must NOT use placeholder
        CUSTOMER_NAME_DUNNING: null,               // Legal dunning must have real name
        EMPTY_ARRAY: '[]',
        EMPTY_OBJECT: '{}',
    });

    // Track if localStorage is available
    let _storageAvailable = null;

    /**
     * Check if localStorage is available (fails in Safari Private Browsing,
     * some iframe sandboxes, and when storage quota is exceeded).
     */
    function isStorageAvailable() {
        if (_storageAvailable !== null) {return _storageAvailable;}
        try {
            const testKey = '__freyai_storage_test__';
            localStorage.setItem(testKey, '1');
            localStorage.removeItem(testKey);
            _storageAvailable = true;
        } catch {
            _storageAvailable = false;
            _logError('localStorage', 'localStorage is not available (private browsing or quota exceeded)');
        }
        return _storageAvailable;
    }

    /**
     * Log a storage error with context. Uses errorHandler if available,
     * always logs to console for debugging.
     */
    function _logError(storageKey, message, error) {
        const ctx = `[Storage:${storageKey}]`;
        const errorMsg = error ? `${message}: ${error.message}` : message;
        console.error(ctx, errorMsg);

        if (window.errorHandler) {
            window.errorHandler.history.push({
                timestamp: new Date().toISOString(),
                context: `Storage:${storageKey}`,
                message: errorMsg,
                stack: error?.stack
            });
        }
    }

    /**
     * Safely read and parse JSON from localStorage.
     * Logs errors instead of silently swallowing them.
     *
     * @param {string} key - localStorage key
     * @param {*} fallback - default value if read/parse fails
     * @param {Object} [options]
     * @param {boolean} [options.financial=false] - if true, logs at error level (GoBD)
     * @param {string} [options.service=''] - service name for log context
     * @returns {*} parsed value or fallback
     */
    function getJSON(key, fallback = null, options = {}) {
        const { financial = false, service = '' } = options;
        const logPrefix = service ? `${service}:${key}` : key;

        if (!isStorageAvailable()) {
            _logError(logPrefix, 'localStorage unavailable, using fallback');
            return fallback;
        }

        let raw;
        try {
            raw = localStorage.getItem(key);
        } catch (e) {
            _logError(logPrefix, 'localStorage.getItem failed', e);
            return fallback;
        }

        if (raw === null || raw === undefined) {
            return fallback;
        }

        try {
            return JSON.parse(raw);
        } catch (e) {
            if (financial) {
                _logError(logPrefix, `CRITICAL: Financial data corrupted in localStorage. Raw length=${raw.length}. Falling back to default. DATA MAY BE LOST.`, e);
            } else {
                _logError(logPrefix, `JSON parse failed (raw length=${raw.length}), using fallback`, e);
            }
            return fallback;
        }
    }

    /**
     * Safely write JSON to localStorage.
     *
     * @param {string} key - localStorage key
     * @param {*} value - value to serialize
     * @param {Object} [options]
     * @param {string} [options.service=''] - service name for log context
     * @returns {boolean} true if write succeeded
     */
    function setJSON(key, value, options = {}) {
        const { service = '' } = options;
        const logPrefix = service ? `${service}:${key}` : key;

        if (!isStorageAvailable()) {
            _logError(logPrefix, 'localStorage unavailable, cannot save');
            return false;
        }

        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (e) {
            _logError(logPrefix, 'localStorage.setItem failed (quota exceeded?)', e);
            return false;
        }
    }

    /**
     * Safe string read from localStorage (non-JSON).
     */
    function getString(key, fallback = '') {
        if (!isStorageAvailable()) {return fallback;}
        try {
            return localStorage.getItem(key) || fallback;
        } catch {
            return fallback;
        }
    }

    /**
     * Safely parse a Date string — returns null for invalid dates.
     *
     * @param {*} value - date string or timestamp
     * @returns {Date|null}
     */
    function safeDate(value) {
        if (!value) {return null;}
        const d = new Date(value);
        return isNaN(d.getTime()) ? null : d;
    }

    /**
     * Safe numeric value for reduce chains — prevents NaN propagation.
     *
     * @param {*} value - potentially undefined/null number
     * @param {number} fallback - default (0)
     * @returns {number}
     */
    function safeNumber(value, fallback = 0) {
        const n = Number(value);
        return isNaN(n) || !isFinite(n) ? fallback : n;
    }

    /**
     * Safe division — returns fallback if divisor is 0.
     *
     * @param {number} numerator
     * @param {number} divisor
     * @param {number} fallback - default (0)
     * @returns {number}
     */
    function safeDivide(numerator, divisor, fallback = 0) {
        return divisor !== 0 ? numerator / divisor : fallback;
    }

    /**
     * Get customer display name with context-aware fallbacks.
     * Financial/legal contexts return null to force caller to handle missing data.
     *
     * @param {Object} entity - object with .kunde property
     * @param {'display'|'financial'|'dunning'} context
     * @returns {string|null}
     */
    function getCustomerName(entity, context = 'display') {
        const name = entity?.kunde?.name || entity?.kunde?.firma || null;
        if (name) {return name;}

        switch (context) {
            case 'financial':
                return FALLBACKS.CUSTOMER_NAME_FINANCIAL; // null — caller MUST handle
            case 'dunning':
                return FALLBACKS.CUSTOMER_NAME_DUNNING;   // null — caller MUST handle
            case 'display':
            default:
                return FALLBACKS.CUSTOMER_NAME_DISPLAY;   // 'Unbekannt' — safe for UI
        }
    }

    // Public API
    return Object.freeze({
        FALLBACKS,
        isStorageAvailable,
        getJSON,
        setJSON,
        getString,
        safeDate,
        safeNumber,
        safeDivide,
        getCustomerName,
    });
})();

window.StorageUtils = StorageUtils;
