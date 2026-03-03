/* ============================================
   Invoice Numbering Service
   GoBD-compliant invoice number generation
   ============================================ */

class InvoiceNumberingService {
    constructor() {
        this.dbService = window.dbService;
        this.currentUserId = null;
    }

    /**
     * Initialize service with current user
     * @param {string} userId - Current user ID
     */
    setUser(userId) {
        this.currentUserId = userId;
    }

    /**
     * Generate next invoice number (GoBD-compliant)
     * @param {string} userId - User ID (optional, uses current if not provided)
     * @param {Object} options - Configuration options
     * @returns {Promise<string>} Formatted invoice number
     */
    async generateNumber(userId = null, options = {}) {
        userId = userId || this.currentUserId || 'default';

        const defaults = {
            format: '{PREFIX}-{YEAR}-{NUMBER:4}',
            prefix: 'RE',
            resetYearly: true
        };

        const config = { ...defaults, ...options };

        // Load current sequence from IndexedDB
        const sequenceKey = 'invoice_sequence';
        let sequence = await this.dbService.getUserData(userId, sequenceKey);

        if (!sequence) {
            sequence = {
                currentYear: new Date().getFullYear(),
                currentNumber: 0,
                prefix: config.prefix,
                format: config.format,
                resetYearly: config.resetYearly
            };
        }

        const currentYear = new Date().getFullYear();

        // Check if year changed and reset is enabled
        if (config.resetYearly && sequence.currentYear !== currentYear) {
            sequence.currentYear = currentYear;
            sequence.currentNumber = 0;
        }

        // Increment number (GoBD: lückenlos!)
        sequence.currentNumber++;

        // Save updated sequence
        await this.dbService.setUserData(userId, sequenceKey, sequence);

        // Format the number
        const formattedNumber = this.formatNumber(
            sequence.currentNumber,
            sequence.currentYear,
            config.prefix,
            config.format
        );

        return formattedNumber;
    }

    /**
     * Format invoice number based on template
     * @param {number} number - Sequential number
     * @param {number} year - Year
     * @param {string} prefix - Prefix (e.g., 'RE')
     * @param {string} format - Format template
     * @returns {string} Formatted number
     */
    formatNumber(number, year, prefix, format) {
        let result = format;

        // Replace placeholders
        result = result.replace('{PREFIX}', prefix);
        result = result.replace('{YEAR}', year.toString());
        result = result.replace('{YEAR:2}', year.toString().slice(-2));

        // Replace {NUMBER:X} with padded number
        const numberMatch = result.match(/\{NUMBER:(\d+)\}/);
        if (numberMatch) {
            const padding = parseInt(numberMatch[1]);
            const paddedNumber = number.toString().padStart(padding, '0');
            result = result.replace(numberMatch[0], paddedNumber);
        } else {
            result = result.replace('{NUMBER}', number.toString());
        }

        return result;
    }

    /**
     * Get current sequence info
     * @param {string} userId - User ID
     * @returns {Promise<Object>} Sequence data
     */
    async getCurrentSequence(userId = null) {
        userId = userId || this.currentUserId || 'default';
        const sequence = await this.dbService.getUserData(userId, 'invoice_sequence');

        if (!sequence) {
            return {
                currentYear: new Date().getFullYear(),
                currentNumber: 0,
                prefix: 'RE',
                format: '{PREFIX}-{YEAR}-{NUMBER:4}',
                resetYearly: true
            };
        }

        return sequence;
    }

    /**
     * Update sequence configuration
     * @param {string} userId - User ID
     * @param {Object} config - New configuration
     */
    async updateConfig(userId = null, config = {}) {
        userId = userId || this.currentUserId || 'default';
        const sequence = await this.getCurrentSequence(userId);

        Object.assign(sequence, config);

        await this.dbService.setUserData(userId, 'invoice_sequence', sequence);

        return sequence;
    }

    /**
     * Preview next number without incrementing
     * @param {string} userId - User ID
     * @returns {Promise<string>} Preview of next number
     */
    async previewNext(userId = null) {
        userId = userId || this.currentUserId || 'default';
        const sequence = await this.getCurrentSequence(userId);

        const currentYear = new Date().getFullYear();
        let nextNumber = sequence.currentNumber + 1;
        let year = sequence.currentYear;

        if (sequence.resetYearly && sequence.currentYear !== currentYear) {
            nextNumber = 1;
            year = currentYear;
        }

        return this.formatNumber(
            nextNumber,
            year,
            sequence.prefix,
            sequence.format
        );
    }

    /**
     * Reset sequence (use with caution - GoBD!)
     * @param {string} userId - User ID
     * @param {number} startNumber - Starting number (default: 0)
     */
    async resetSequence(userId = null, startNumber = 0) {
        userId = userId || this.currentUserId || 'default';
        const sequence = await this.getCurrentSequence(userId);

        sequence.currentNumber = startNumber;
        sequence.currentYear = new Date().getFullYear();

        await this.dbService.setUserData(userId, 'invoice_sequence', sequence);

        console.warn('⚠️ Invoice sequence reset - ensure GoBD compliance!');

        return sequence;
    }
}

window.invoiceNumberingService = new InvoiceNumberingService();
