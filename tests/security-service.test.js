import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock browser globals needed by SecurityService
const sessionStorageMock = (() => {
    let store = {};
    return {
        getItem: (key) => store[key] !== undefined ? store[key] : null,
        setItem: (key, value) => { store[key] = String(value); },
        removeItem: (key) => { delete store[key]; },
        clear: () => { store = {}; }
    };
})();

global.sessionStorage = sessionStorageMock;

// Mock crypto.getRandomValues (available in vitest/jsdom but adding for safety)
if (!global.crypto) {
    global.crypto = {
        getRandomValues: (arr) => {
            for (let i = 0; i < arr.length; i++) {
                arr[i] = Math.floor(Math.random() * 256);
            }
            return arr;
        }
    };
}

// Self-contained SecurityService (extracted from js/services/security-service.js)
class SecurityService {
    constructor() {
        this.rateLimiters = new Map();
        this.csrfToken = this.initCSRFToken();
    }

    validateEmail(email) {
        if (typeof email !== 'string') {
            return { valid: false, sanitized: '' };
        }

        const sanitized = email.trim().toLowerCase().replace(/[^a-z0-9@._+\-]/g, '');
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        return {
            valid: emailRegex.test(sanitized),
            sanitized: sanitized
        };
    }

    validatePhone(phone) {
        if (typeof phone !== 'string') {
            return { valid: false, formatted: '' };
        }

        const cleaned = phone.replace(/[^0-9+\-\s()]/g, '').trim();
        const digitsOnly = cleaned.replace(/\D/g, '');
        const phoneRegex = /^[\d\s+\-()]{7,}$/;

        let formatted = cleaned;
        if (digitsOnly.length >= 7) {
            if (digitsOnly.startsWith('49')) {
                formatted = '+49 ' + digitsOnly.slice(2, 5) + ' ' + digitsOnly.slice(5);
            } else if (cleaned.startsWith('0')) {
                formatted = cleaned.slice(0, 4) + ' ' + cleaned.slice(4);
            }
        }

        return {
            valid: phoneRegex.test(cleaned) && digitsOnly.length >= 7,
            formatted: formatted
        };
    }

    validateAmount(amount) {
        const parsed = parseFloat(String(amount).replace(',', '.'));
        return {
            valid: !isNaN(parsed) && parsed >= 0,
            parsed: isNaN(parsed) ? 0 : parsed
        };
    }

    validateIBAN(iban) {
        if (typeof iban !== 'string') { return false; }

        const cleaned = iban.replace(/\s/g, '').toUpperCase();

        if (!/^DE\d{20}$/.test(cleaned)) {
            return false;
        }

        // IBAN checksum validation (mod-97 algorithm)
        const rearranged = cleaned.slice(4) + cleaned.slice(0, 4);
        const numeric = rearranged.replace(/[A-Z]/g, (char) => {
            return String(char.charCodeAt(0) - 55);
        });

        let remainder = 0;
        for (let i = 0; i < numeric.length; i++) {
            remainder = (remainder * 10 + parseInt(numeric[i], 10)) % 97;
        }

        return remainder === 1;
    }

    validateTaxId(id) {
        if (typeof id !== 'string') { return false; }

        const cleaned = id.replace(/[\s\/\-]/g, '');

        if (/^\d{10,11}$/.test(cleaned)) {
            return true;
        }

        if (/^DE\d{9}$/.test(cleaned.toUpperCase())) {
            return true;
        }

        return false;
    }

    sanitizeInput(str) {
        if (typeof str !== 'string') { return String(str ?? ''); }

        let sanitized = str.replace(/<[^>]*>/g, '');
        sanitized = sanitized.replace(/javascript:/gi, '');
        return sanitized.trim();
    }

    validateRequired(fields) {
        const errors = [];

        if (!Array.isArray(fields)) {
            return { valid: false, errors: ['Invalid fields array'] };
        }

        fields.forEach(field => {
            if (!field.name) { return; }

            const value = field.value;
            const isEmpty = value === null || value === undefined ||
                (typeof value === 'string' && value.trim() === '');

            if (isEmpty) {
                errors.push(`${field.name} is required`);
            }
        });

        return {
            valid: errors.length === 0,
            errors: errors
        };
    }

    checkRateLimit(key, maxCalls = 10, windowMs = 60000) {
        if (!this.rateLimiters.has(key)) {
            this.rateLimiters.set(key, {
                calls: [],
                maxCalls: maxCalls,
                windowMs: windowMs
            });
        }

        const limiter = this.rateLimiters.get(key);
        const now = Date.now();

        limiter.calls = limiter.calls.filter(timestamp => now - timestamp < limiter.windowMs);

        if (limiter.calls.length < limiter.maxCalls) {
            limiter.calls.push(now);
            return { allowed: true, retryAfter: 0 };
        }

        const oldestCall = limiter.calls[0];
        const retryAfter = limiter.windowMs - (now - oldestCall);

        return {
            allowed: false,
            retryAfter: Math.ceil(retryAfter / 1000)
        };
    }

    resetRateLimit(key) {
        this.rateLimiters.delete(key);
    }

    clearRateLimits() {
        this.rateLimiters.clear();
    }

    initCSRFToken() {
        let token = sessionStorage.getItem('csrf_token');
        if (!token) {
            token = this.generateRandomToken();
            sessionStorage.setItem('csrf_token', token);
        }
        return token;
    }

    getCSRFToken() {
        return this.csrfToken;
    }

    validateCSRFToken(token) {
        return token === this.csrfToken;
    }

    refreshCSRFToken() {
        this.csrfToken = this.generateRandomToken();
        sessionStorage.setItem('csrf_token', this.csrfToken);
        return this.csrfToken;
    }

    generateRandomToken() {
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    }

    escapeHtml(str) {
        if (typeof str !== 'string') { return String(str ?? ''); }

        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#x27;',
            '/': '&#x2F;',
            '`': '&#96;'
        };

        return str.replace(/[&<>"'\/`]/g, char => map[char]);
    }

    isValidURL(url) {
        if (typeof url !== 'string') { return false; }

        try {
            const parsed = new URL(url);
            return ['http:', 'https:'].includes(parsed.protocol);
        } catch {
            return false;
        }
    }
}

describe('SecurityService', () => {
    let service;

    beforeEach(() => {
        sessionStorageMock.clear();
        service = new SecurityService();
    });

    describe('Email Validation', () => {
        it('should validate a correct email address', () => {
            const result = service.validateEmail('test@example.de');
            expect(result.valid).toBe(true);
            expect(result.sanitized).toBe('test@example.de');
        });

        it('should validate email with subdomain', () => {
            const result = service.validateEmail('user@mail.example.com');
            expect(result.valid).toBe(true);
        });

        it('should validate email with plus sign', () => {
            const result = service.validateEmail('user+tag@example.de');
            expect(result.valid).toBe(true);
        });

        it('should reject email without @', () => {
            const result = service.validateEmail('notanemail');
            expect(result.valid).toBe(false);
        });

        it('should reject email without domain', () => {
            const result = service.validateEmail('user@');
            expect(result.valid).toBe(false);
        });

        it('should reject empty string', () => {
            const result = service.validateEmail('');
            expect(result.valid).toBe(false);
        });

        it('should convert email to lowercase', () => {
            const result = service.validateEmail('Test@EXAMPLE.DE');
            expect(result.sanitized).toBe('test@example.de');
        });

        it('should return false for non-string input', () => {
            const result = service.validateEmail(null);
            expect(result.valid).toBe(false);
        });
    });

    describe('Phone Validation', () => {
        it('should validate German phone number', () => {
            const result = service.validatePhone('+49 89 12345678');
            expect(result.valid).toBe(true);
        });

        it('should validate phone with area code format', () => {
            const result = service.validatePhone('0800 123 4567');
            expect(result.valid).toBe(true);
        });

        it('should validate 7+ digit number', () => {
            const result = service.validatePhone('1234567');
            expect(result.valid).toBe(true);
        });

        it('should reject phone with fewer than 7 digits', () => {
            const result = service.validatePhone('12345');
            expect(result.valid).toBe(false);
        });

        it('should return false for non-string input', () => {
            const result = service.validatePhone(null);
            expect(result.valid).toBe(false);
        });

        it('should format +49 number correctly', () => {
            const result = service.validatePhone('+4989123456789');
            expect(result.formatted).toContain('+49');
        });
    });

    describe('Amount Validation', () => {
        it('should validate positive number', () => {
            const result = service.validateAmount(100);
            expect(result.valid).toBe(true);
            expect(result.parsed).toBe(100);
        });

        it('should validate zero', () => {
            const result = service.validateAmount(0);
            expect(result.valid).toBe(true);
        });

        it('should reject negative number', () => {
            const result = service.validateAmount(-10);
            expect(result.valid).toBe(false);
        });

        it('should parse German comma-decimal format', () => {
            const result = service.validateAmount('1234,56');
            expect(result.valid).toBe(true);
            expect(result.parsed).toBeCloseTo(1234.56, 2);
        });

        it('should return parsed=0 for invalid input', () => {
            const result = service.validateAmount('nicht eine Zahl');
            expect(result.valid).toBe(false);
            expect(result.parsed).toBe(0);
        });
    });

    describe('IBAN Validation (German)', () => {
        it('should validate a valid German IBAN', () => {
            // Known valid German IBAN
            expect(service.validateIBAN('DE89370400440532013000')).toBe(true);
        });

        it('should validate IBAN with spaces', () => {
            expect(service.validateIBAN('DE89 3704 0044 0532 0130 00')).toBe(true);
        });

        it('should reject non-German IBAN', () => {
            expect(service.validateIBAN('GB82WEST12345698765432')).toBe(false);
        });

        it('should reject IBAN with wrong length', () => {
            expect(service.validateIBAN('DE123456')).toBe(false);
        });

        it('should reject invalid checksum', () => {
            expect(service.validateIBAN('DE00370400440532013000')).toBe(false);
        });

        it('should return false for non-string input', () => {
            expect(service.validateIBAN(null)).toBe(false);
        });

        it('should reject empty string', () => {
            expect(service.validateIBAN('')).toBe(false);
        });
    });

    describe('Tax ID Validation (German)', () => {
        it('should validate Steuernummer with 11 digits', () => {
            expect(service.validateTaxId('12345678901')).toBe(true);
        });

        it('should validate Steuernummer with 10 digits', () => {
            expect(service.validateTaxId('1234567890')).toBe(true);
        });

        it('should validate USt-IdNr format (DE + 9 digits)', () => {
            expect(service.validateTaxId('DE123456789')).toBe(true);
        });

        it('should validate USt-IdNr with spaces', () => {
            expect(service.validateTaxId('DE 123456789')).toBe(true);
        });

        it('should reject too short tax ID', () => {
            expect(service.validateTaxId('12345')).toBe(false);
        });

        it('should reject invalid format', () => {
            expect(service.validateTaxId('ABCDEFGHIJK')).toBe(false);
        });

        it('should return false for non-string input', () => {
            expect(service.validateTaxId(null)).toBe(false);
        });
    });

    describe('XSS Detection / Input Sanitization', () => {
        it('should strip HTML tags from input', () => {
            const result = service.sanitizeInput('<script>alert("xss")</script>Hello');
            expect(result).not.toContain('<script>');
            expect(result).toContain('Hello');
        });

        it('should remove javascript: protocol', () => {
            const result = service.sanitizeInput('javascript:alert(1)');
            expect(result).not.toContain('javascript:');
        });

        it('should remove HTML tags but keep text content', () => {
            const result = service.sanitizeInput('<b>Bold Text</b>');
            expect(result).toBe('Bold Text');
        });

        it('should handle nested tags', () => {
            const result = service.sanitizeInput('<div><p>Content</p></div>');
            expect(result).toBe('Content');
        });

        it('should trim whitespace', () => {
            const result = service.sanitizeInput('  hello world  ');
            expect(result).toBe('hello world');
        });

        it('should handle non-string input', () => {
            const result = service.sanitizeInput(123);
            expect(typeof result).toBe('string');
        });

        it('should escape HTML special characters', () => {
            const escaped = service.escapeHtml('<script>alert("xss")</script>');
            expect(escaped).toContain('&lt;script&gt;');
            expect(escaped).not.toContain('<script>');
        });

        it('should escape ampersand', () => {
            expect(service.escapeHtml('A & B')).toContain('&amp;');
        });

        it('should escape quotes', () => {
            expect(service.escapeHtml('"quoted"')).toContain('&quot;');
        });
    });

    describe('Auth Guard Checks - Required Fields', () => {
        it('should pass with all required fields present', () => {
            const result = service.validateRequired([
                { name: 'email', value: 'test@test.de' },
                { name: 'password', value: 'secret123' }
            ]);
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should fail with empty string value', () => {
            const result = service.validateRequired([
                { name: 'email', value: '' }
            ]);
            expect(result.valid).toBe(false);
            expect(result.errors[0]).toContain('email');
        });

        it('should fail with null value', () => {
            const result = service.validateRequired([
                { name: 'name', value: null }
            ]);
            expect(result.valid).toBe(false);
        });

        it('should fail with undefined value', () => {
            const result = service.validateRequired([
                { name: 'field', value: undefined }
            ]);
            expect(result.valid).toBe(false);
        });

        it('should collect multiple errors', () => {
            const result = service.validateRequired([
                { name: 'email', value: '' },
                { name: 'password', value: null },
                { name: 'name', value: 'Valid Name' }
            ]);
            expect(result.errors).toHaveLength(2);
        });

        it('should return error for non-array input', () => {
            const result = service.validateRequired('not an array');
            expect(result.valid).toBe(false);
        });
    });

    describe('Rate Limiting Logic', () => {
        it('should allow calls within limit', () => {
            const result = service.checkRateLimit('test-action', 5, 60000);
            expect(result.allowed).toBe(true);
            expect(result.retryAfter).toBe(0);
        });

        it('should block calls exceeding limit', () => {
            // Call 5 times
            for (let i = 0; i < 5; i++) {
                service.checkRateLimit('login', 5, 60000);
            }
            // 6th call should be blocked
            const result = service.checkRateLimit('login', 5, 60000);
            expect(result.allowed).toBe(false);
            expect(result.retryAfter).toBeGreaterThan(0);
        });

        it('should track different keys separately', () => {
            for (let i = 0; i < 5; i++) {
                service.checkRateLimit('key-a', 5, 60000);
            }
            // key-b should still be allowed
            const result = service.checkRateLimit('key-b', 5, 60000);
            expect(result.allowed).toBe(true);
        });

        it('should reset rate limit for a specific key', () => {
            for (let i = 0; i < 5; i++) {
                service.checkRateLimit('reset-test', 5, 60000);
            }
            service.resetRateLimit('reset-test');
            const result = service.checkRateLimit('reset-test', 5, 60000);
            expect(result.allowed).toBe(true);
        });

        it('should clear all rate limiters', () => {
            service.checkRateLimit('a', 1, 60000);
            service.checkRateLimit('b', 1, 60000);
            service.clearRateLimits();
            // Both should be allowed now
            expect(service.checkRateLimit('a', 1, 60000).allowed).toBe(true);
            expect(service.checkRateLimit('b', 1, 60000).allowed).toBe(true);
        });

        it('should return retryAfter in seconds', () => {
            for (let i = 0; i < 3; i++) {
                service.checkRateLimit('seconds-test', 3, 60000);
            }
            const result = service.checkRateLimit('seconds-test', 3, 60000);
            expect(result.retryAfter).toBeGreaterThan(0);
            expect(result.retryAfter).toBeLessThanOrEqual(60); // Max 60 seconds
        });
    });

    describe('CSRF Token Management', () => {
        it('should generate a CSRF token on construction', () => {
            expect(service.csrfToken).toBeDefined();
            expect(service.csrfToken.length).toBe(64); // 32 bytes hex = 64 chars
        });

        it('should validate a correct CSRF token', () => {
            const token = service.getCSRFToken();
            expect(service.validateCSRFToken(token)).toBe(true);
        });

        it('should reject an incorrect CSRF token', () => {
            expect(service.validateCSRFToken('invalid-token')).toBe(false);
        });

        it('should generate new token on refresh', () => {
            const original = service.getCSRFToken();
            const refreshed = service.refreshCSRFToken();
            expect(refreshed).not.toBe(original);
        });

        it('should persist CSRF token in sessionStorage', () => {
            const token = service.getCSRFToken();
            const stored = sessionStorage.getItem('csrf_token');
            expect(stored).toBe(token);
        });

        it('should reuse existing CSRF token from sessionStorage', () => {
            sessionStorageMock.clear();
            sessionStorage.setItem('csrf_token', 'existing-token-abc');
            const newService = new SecurityService();
            expect(newService.getCSRFToken()).toBe('existing-token-abc');
        });
    });

    describe('URL Validation', () => {
        it('should validate https URL', () => {
            expect(service.isValidURL('https://example.de')).toBe(true);
        });

        it('should validate http URL', () => {
            expect(service.isValidURL('http://example.de')).toBe(true);
        });

        it('should reject javascript: protocol URL', () => {
            expect(service.isValidURL('javascript:alert(1)')).toBe(false);
        });

        it('should reject ftp: URL', () => {
            expect(service.isValidURL('ftp://files.example.de')).toBe(false);
        });

        it('should reject non-URL string', () => {
            expect(service.isValidURL('not a url')).toBe(false);
        });

        it('should return false for non-string input', () => {
            expect(service.isValidURL(null)).toBe(false);
            expect(service.isValidURL(42)).toBe(false);
        });
    });
});
