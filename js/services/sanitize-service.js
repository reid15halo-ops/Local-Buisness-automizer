/* ============================================
   Input Sanitization & XSS Protection
   ============================================ */

const SanitizeService = {
    // Escape HTML to prevent XSS when using innerHTML
    escapeHtml(str) {
        if (typeof str !== 'string') return String(str ?? '');
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
    },

    // Sanitize for use in HTML attributes
    escapeAttr(str) {
        if (typeof str !== 'string') return String(str ?? '');
        return str.replace(/[&<>"']/g, char => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        })[char]);
    },

    // Sanitize email
    sanitizeEmail(email) {
        if (typeof email !== 'string') return '';
        return email.trim().toLowerCase().replace(/[^a-z0-9@._+\-]/g, '');
    },

    // Sanitize phone number
    sanitizePhone(phone) {
        if (typeof phone !== 'string') return '';
        return phone.replace(/[^0-9+\-\s()]/g, '').trim();
    },

    // Sanitize general text input (no HTML)
    sanitizeText(text) {
        if (typeof text !== 'string') return '';
        return this.escapeHtml(text.trim());
    },

    // Sanitize number input
    sanitizeNumber(value, fallback = 0) {
        const num = parseFloat(value);
        return isNaN(num) ? fallback : num;
    },

    // Sanitize URL
    sanitizeUrl(url) {
        if (typeof url !== 'string') return '';
        try {
            const parsed = new URL(url);
            if (!['http:', 'https:'].includes(parsed.protocol)) return '';
            return parsed.href;
        } catch {
            return '';
        }
    },

    // Sanitize data for JSON.stringify in data attributes
    sanitizeForDataAttr(obj) {
        return this.escapeAttr(JSON.stringify(obj));
    },

    // Validate IBAN (basic German format check)
    isValidIBAN(iban) {
        if (typeof iban !== 'string') return false;
        const cleaned = iban.replace(/\s/g, '').toUpperCase();
        return /^DE\d{20}$/.test(cleaned);
    },

    // Validate German tax ID
    isValidSteuerId(id) {
        if (typeof id !== 'string') return false;
        return /^\d{10,11}$/.test(id.replace(/[\s\/]/g, ''));
    }
};

window.sanitize = SanitizeService;
