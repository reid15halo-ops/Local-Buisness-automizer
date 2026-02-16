/* ============================================
   Security Service
   Centralized security utilities: validation, sanitization, rate limiting, CSRF
   ============================================ */

class SecurityService {
    constructor() {
        this.rateLimiters = new Map();
        this.csrfToken = this.initCSRFToken();
    }

    /* ============================================
       INPUT VALIDATION
       ============================================ */

    /**
     * Validate email address
     * @param {string} email - Email to validate
     * @returns {{valid: boolean, sanitized: string}}
     */
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

    /**
     * Validate phone number (international format support)
     * @param {string} phone - Phone to validate
     * @returns {{valid: boolean, formatted: string}}
     */
    validatePhone(phone) {
        if (typeof phone !== 'string') {
            return { valid: false, formatted: '' };
        }

        const cleaned = phone.replace(/[^0-9+\-\s()]/g, '').trim();
        // Basic validation: at least 7 digits
        const digitsOnly = cleaned.replace(/\D/g, '');
        const phoneRegex = /^[\d\s+\-()]{7,}$/;

        // Format for display (German format as fallback)
        let formatted = cleaned;
        if (digitsOnly.length >= 7) {
            // Try German format: +49 XXX XXXXXXXXX or 0XXX XXXXXXXX
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

    /**
     * Validate numeric amount
     * @param {string|number} amount - Amount to validate
     * @returns {{valid: boolean, parsed: number}}
     */
    validateAmount(amount) {
        const parsed = parseFloat(String(amount).replace(',', '.'));

        return {
            valid: !isNaN(parsed) && parsed >= 0,
            parsed: isNaN(parsed) ? 0 : parsed
        };
    }

    /**
     * Validate German IBAN format
     * @param {string} iban - IBAN to validate
     * @returns {boolean}
     */
    validateIBAN(iban) {
        if (typeof iban !== 'string') {return false;}

        const cleaned = iban.replace(/\s/g, '').toUpperCase();

        // German IBAN: DE + 2 check digits + 18 digits (20 total after country code)
        if (!/^DE\d{20}$/.test(cleaned)) {
            return false;
        }

        // IBAN checksum validation (mod-97 algorithm)
        const rearranged = cleaned.slice(4) + cleaned.slice(0, 4);
        const numeric = rearranged.replace(/[A-Z]/g, (char) => {
            return String(char.charCodeAt(0) - 55); // A=10, B=11, etc.
        });

        // Calculate mod 97
        let remainder = 0;
        for (let i = 0; i < numeric.length; i++) {
            remainder = (remainder * 10 + parseInt(numeric[i], 10)) % 97;
        }

        return remainder === 1;
    }

    /**
     * Validate German Tax ID (Steuernummer or USt-IdNr)
     * @param {string} id - Tax ID to validate
     * @returns {boolean}
     */
    validateTaxId(id) {
        if (typeof id !== 'string') {return false;}

        const cleaned = id.replace(/[\s\/\-]/g, '');

        // Steuernummer: 10-11 digits (format: XX XXX XXXXXX XX)
        if (/^\d{10,11}$/.test(cleaned)) {
            return true;
        }

        // USt-IdNr: DE + 9 digits
        if (/^DE\d{9}$/.test(cleaned.toUpperCase())) {
            return true;
        }

        return false;
    }

    /**
     * Sanitize input - strip HTML/script tags
     * @param {string} str - String to sanitize
     * @returns {string}
     */
    sanitizeInput(str) {
        if (typeof str !== 'string') {return String(str ?? '');}

        // Remove HTML tags and script tags
        let sanitized = str.replace(/<[^>]*>/g, '');

        // Remove JavaScript protocol
        sanitized = sanitized.replace(/javascript:/gi, '');

        // Trim whitespace
        return sanitized.trim();
    }

    /**
     * Validate required fields
     * @param {Array<{value: any, name: string}>} fields - Fields to validate
     * @returns {{valid: boolean, errors: string[]}}
     */
    validateRequired(fields) {
        const errors = [];

        if (!Array.isArray(fields)) {
            return { valid: false, errors: ['Invalid fields array'] };
        }

        fields.forEach(field => {
            if (!field.name) {
                return;
            }

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

    /* ============================================
       RATE LIMITING
       ============================================ */

    /**
     * Create a rate limiter for an action
     * @param {string} key - Unique key for rate limiter
     * @param {number} maxCalls - Max calls allowed
     * @param {number} windowMs - Time window in milliseconds
     * @returns {{allowed: boolean, retryAfter: number}}
     */
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

        // Remove old calls outside the window
        limiter.calls = limiter.calls.filter(timestamp => now - timestamp < limiter.windowMs);

        if (limiter.calls.length < limiter.maxCalls) {
            limiter.calls.push(now);
            return {
                allowed: true,
                retryAfter: 0
            };
        }

        // Calculate when the oldest call will expire
        const oldestCall = limiter.calls[0];
        const retryAfter = limiter.windowMs - (now - oldestCall);

        return {
            allowed: false,
            retryAfter: Math.ceil(retryAfter / 1000) // Return seconds
        };
    }

    /**
     * Reset rate limiter for a specific key
     * @param {string} key - Rate limiter key
     */
    resetRateLimit(key) {
        this.rateLimiters.delete(key);
    }

    /**
     * Clear all rate limiters
     */
    clearRateLimits() {
        this.rateLimiters.clear();
    }

    /* ============================================
       CSRF TOKEN MANAGEMENT
       ============================================ */

    /**
     * Initialize or retrieve CSRF token
     * @returns {string}
     */
    initCSRFToken() {
        let token = sessionStorage.getItem('csrf_token');

        if (!token) {
            token = this.generateRandomToken();
            sessionStorage.setItem('csrf_token', token);
        }

        return token;
    }

    /**
     * Get current CSRF token
     * @returns {string}
     */
    getCSRFToken() {
        return this.csrfToken;
    }

    /**
     * Validate CSRF token
     * @param {string} token - Token to validate
     * @returns {boolean}
     */
    validateCSRFToken(token) {
        return token === this.csrfToken;
    }

    /**
     * Refresh CSRF token
     * @returns {string}
     */
    refreshCSRFToken() {
        this.csrfToken = this.generateRandomToken();
        sessionStorage.setItem('csrf_token', this.csrfToken);
        return this.csrfToken;
    }

    /**
     * Generate random token
     * @returns {string}
     */
    generateRandomToken() {
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    }

    /* ============================================
       UTILITY METHODS
       ============================================ */

    /**
     * Escape HTML for safe rendering
     * @param {string} str - String to escape
     * @returns {string}
     */
    escapeHtml(str) {
        if (typeof str !== 'string') {return String(str ?? '');}

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

    /**
     * Validate URL safety
     * @param {string} url - URL to validate
     * @returns {boolean}
     */
    isValidURL(url) {
        if (typeof url !== 'string') {return false;}

        try {
            const parsed = new URL(url);
            return ['http:', 'https:'].includes(parsed.protocol);
        } catch {
            return false;
        }
    }

    /**
     * Log security event
     * @param {string} event - Event type
     * @param {object} details - Event details
     */
    logSecurityEvent(event, details = {}) {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            event,
            userAgent: navigator.userAgent,
            ...details
        };

        // Log to console in development
        if (process.env.NODE_ENV !== 'production') {
            console.log('[Security Event]', logEntry);
        }

        // In production, you might send to a logging service
        // e.g., this.sendToLoggingService(logEntry);
    }
}

// Create global instance
window.securityService = new SecurityService();
