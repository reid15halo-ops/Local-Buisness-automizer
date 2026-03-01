/* ============================================
   Company Settings Service
   Loads per-user business configuration from Supabase company_settings table.
   Falls back to localStorage/defaults when Supabase is unavailable (offline mode).

   Replaces all hardcoded DEFAULT_TAX_RATE, stundensatz, noreply_email, etc.
   Use window.companySettings.<getter> throughout the app.
   ============================================ */

class CompanySettingsService {
    constructor() {
        this._cache = null;          // Loaded from Supabase or localStorage
        this._loaded = false;
        this._loadPromise = null;

        // Defaults — used when Supabase is unreachable and nothing is in localStorage
        this._defaults = {
            company_name: '',
            owner_name: '',
            company_email: '',
            company_phone: '',
            company_website: '',
            company_address: '',
            tax_id: '',
            noreply_email: 'noreply@handwerkflow.de',
            stundensatz: 65.00,
            default_tax_rate: 0.19,
            payment_terms_days: 14,
            kleinunternehmer: false,
            invoice_prefix: 'RE-',
            quote_prefix: 'AN-',
            logo_url: null,
            bank_name: '',
            bank_iban: '',
            bank_bic: '',
        };
    }

    // ============================================
    // Initialization
    // ============================================

    /**
     * Load settings. Safe to call multiple times – deduplicates in-flight requests.
     * @returns {Promise<Object>} Resolved settings object
     */
    async load() {
        if (this._loaded) { return this._cache; }
        if (this._loadPromise) { return this._loadPromise; }

        this._loadPromise = this._fetchSettings();
        try {
            this._cache = await this._loadPromise;
            this._loaded = true;
        } finally {
            this._loadPromise = null;
        }
        return this._cache;
    }

    async _fetchSettings() {
        // Try Supabase first
        if (window.supabaseClient && window.supabaseConfig?.isConfigured?.()) {
            try {
                const { data: { user } } = await window.supabaseClient.auth.getUser();
                if (user) {
                    const { data, error } = await window.supabaseClient
                        .from('company_settings')
                        .select('*')
                        .eq('user_id', user.id)
                        .single();

                    if (!error && data) {
                        // Merge with defaults so new columns are covered even on old rows
                        const merged = { ...this._defaults, ...data };
                        // Persist to localStorage as offline cache
                        this._persistToLocalStorage(merged);
                        return merged;
                    }
                }
            } catch (err) {
                console.warn('[CompanySettings] Supabase fetch failed, using localStorage cache:', err.message);
            }
        }

        // Fall back to localStorage cache (written by admin panel / setup wizard)
        return this._loadFromLocalStorage();
    }

    _loadFromLocalStorage() {
        const stored = (() => {
            try {
                return JSON.parse(localStorage.getItem('freyai_admin_settings') || '{}');
            } catch { return {}; }
        })();

        return {
            ...this._defaults,
            company_name:        stored.company_name          || localStorage.getItem('company_name')             || this._defaults.company_name,
            owner_name:          stored.owner_name            || localStorage.getItem('owner_name')               || this._defaults.owner_name,
            company_email:       stored.company_email         || localStorage.getItem('freyai_company_email')     || this._defaults.company_email,
            company_phone:       stored.company_phone         || localStorage.getItem('freyai_company_phone')     || this._defaults.company_phone,
            company_website:     stored.company_website       || localStorage.getItem('freyai_company_website')   || this._defaults.company_website,
            company_address:     stored.company_address       || localStorage.getItem('company_address')          || this._defaults.company_address,
            tax_id:              stored.tax_number            || localStorage.getItem('tax_number')               || this._defaults.tax_id,
            noreply_email:       stored.noreply_email         || localStorage.getItem('noreply_email')            || this._defaults.noreply_email,
            stundensatz:         parseFloat(stored.stundensatz         || localStorage.getItem('stundensatz')             || this._defaults.stundensatz),
            default_tax_rate:    parseFloat(stored.default_vat_rate    || localStorage.getItem('freyai_default_vat_rate') || (this._defaults.default_tax_rate * 100)) / 100,
            payment_terms_days:  parseInt(stored.payment_terms_days    || localStorage.getItem('freyai_payment_terms_days') || this._defaults.payment_terms_days, 10),
            kleinunternehmer:    stored.kleinunternehmer === true || localStorage.getItem('kleinunternehmer') === 'true',
            invoice_prefix:      stored.invoice_prefix        || localStorage.getItem('invoice_prefix')          || this._defaults.invoice_prefix,
            quote_prefix:        stored.quote_prefix          || localStorage.getItem('quote_prefix')            || this._defaults.quote_prefix,
            logo_url:            stored.company_logo          || localStorage.getItem('company_logo')            || null,
            bank_name:           stored.bank_name             || localStorage.getItem('freyai_bank_name')        || this._defaults.bank_name,
            bank_iban:           stored.bank_iban             || localStorage.getItem('freyai_bank_iban')        || this._defaults.bank_iban,
            bank_bic:            stored.bank_bic              || localStorage.getItem('freyai_bank_bic')         || this._defaults.bank_bic,
        };
    }

    _persistToLocalStorage(settings) {
        try {
            const existing = JSON.parse(localStorage.getItem('freyai_admin_settings') || '{}');
            localStorage.setItem('freyai_admin_settings', JSON.stringify({ ...existing, ...settings }));
            // Also keep flat keys used by legacy code
            if (settings.stundensatz)        {localStorage.setItem('stundensatz', String(settings.stundensatz));}
            if (settings.company_name)       {localStorage.setItem('company_name', settings.company_name);}
        } catch { /* ignore storage errors */ }
    }

    // ============================================
    // Synchronous getters (use after load() has resolved)
    // ============================================

    /** German VAT rate as decimal (e.g. 0.19 for 19%) */
    getTaxRate() {
        return this._cache?.default_tax_rate ?? this._defaults.default_tax_rate;
    }

    /** Default hourly rate in EUR */
    getStundensatz() {
        return this._cache?.stundensatz ?? this._defaults.stundensatz;
    }

    /** Default payment due days */
    getPaymentTermsDays() {
        return this._cache?.payment_terms_days ?? this._defaults.payment_terms_days;
    }

    /** No-reply sender email */
    getNoReplyEmail() {
        return this._cache?.noreply_email ?? this._defaults.noreply_email;
    }

    /** True if Kleinunternehmerregelung applies (no VAT on invoices) */
    isKleinunternehmer() {
        return this._cache?.kleinunternehmer ?? this._defaults.kleinunternehmer;
    }

    /** Company name */
    getCompanyName() {
        return this._cache?.company_name ?? this._defaults.company_name;
    }

    /** Get the full settings object */
    getAll() {
        return { ...(this._cache ?? this._defaults) };
    }

    // ============================================
    // Save settings back to Supabase
    // ============================================

    /**
     * Persist updated settings to Supabase and refresh local cache.
     * @param {Object} updates - Partial settings to update
     */
    async save(updates) {
        if (!window.supabaseClient || !window.supabaseConfig?.isConfigured?.()) {
            // Offline: persist to localStorage only
            this._cache = { ...(this._cache ?? this._defaults), ...updates };
            this._persistToLocalStorage(this._cache);
            return { success: true, offline: true };
        }

        try {
            const { data: { user } } = await window.supabaseClient.auth.getUser();
            if (!user) { throw new Error('Nicht angemeldet'); }

            const { data, error } = await window.supabaseClient
                .from('company_settings')
                .upsert({ user_id: user.id, ...updates }, { onConflict: 'user_id' })
                .select()
                .single();

            if (error) { throw error; }

            this._cache = { ...this._defaults, ...data };
            this._persistToLocalStorage(this._cache);
            return { success: true };
        } catch (err) {
            console.error('[CompanySettings] save failed:', err);
            return { success: false, error: err.message };
        }
    }

    /** Force reload from Supabase on next access */
    invalidate() {
        this._loaded = false;
        this._cache = null;
    }
}

window.companySettings = new CompanySettingsService();

// Global tax rate helper — single source of truth.
// All modules must call window._getTaxRate() instead of defining their own copy.
window._getTaxRate = () => window.companySettings?.getTaxRate?.() ?? 0.19;
