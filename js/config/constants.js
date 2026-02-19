/* ============================================
   App-wide Constants
   Single source of truth for all magic numbers
   ============================================ */

const APP_CONSTANTS = {
    // VAT / MwSt
    VAT_RATE:        0.19,   // 19 % Umsatzsteuer
    VAT_MULTIPLIER:  1.19,   // Brutto = Netto × 1.19
    VAT_PERCENT:     19,     // Display: "MwSt. 19 %"
    VAT_REDUCED_RATE:    0.07,
    VAT_REDUCED_MULTIPLIER: 1.07,
    VAT_REDUCED_PERCENT: 7,

    // Time constants
    MS_PER_DAY:      86_400_000,   // 1000 * 60 * 60 * 24
    MS_PER_HOUR:      3_600_000,   // 1000 * 60 * 60

    // Payment defaults
    DEFAULT_PAYMENT_DAYS:  14,   // Default invoice due date offset
    DEFAULT_QUOTE_VALIDITY_DAYS: 30,   // Angebot validity period

    // Business defaults
    DEFAULT_HOURLY_RATE:   65,   // EUR / h default Stundensatz
    DEFAULT_SAFETY_BUFFER: 5_000,  // EUR cash buffer for cashflow
    MONTHLY_AVG_WINDOW:    6,    // Months of history for average
    EXPECTED_COLLECTION_RATE: 0.5, // 50% of pending invoices collected in month 1
    DEFAULT_TAX_ESTIMATE_RATE: 0.15, // Estimated income tax rate for cashflow forecast
    MAX_HISTORICAL_ENTRIES: 100,  // Max stored work estimation records

    // UI limits
    AUTOCOMPLETE_LIMIT:       5,
    ACTIVITY_FEED_LIMIT:     10,
    BOOKKEEPING_DISPLAY_LIMIT: 20,
    EMAIL_PREVIEW_CHARS:    100,
    DESCRIPTION_PREVIEW_CHARS: 50,

    // Timing (ms)
    TOAST_DURATION_MS:    3_000,
    BLUR_HIDE_DELAY_MS:    200,

    // External URLs (CDN / APIs)
    CHART_JS_URL: 'https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js',
    QR_SERVER_URL: 'https://api.qrserver.com/v1/create-qr-code/',
};

// Make available globally
window.APP_CONSTANTS = APP_CONSTANTS;
