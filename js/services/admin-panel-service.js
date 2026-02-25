/* ============================================
   Admin Panel Service
   Two-tier access control: Admin & Developer
   Admin: Business settings (Firmendaten, Steuern, etc.)
   Developer: Technical settings (API Keys, DB, Webhooks)

   OPEN SOURCE SECURITY NOTE:
   This app is open source. Default credentials are only used
   for the very first login. Users MUST set their own credentials
   during the mandatory first-run setup. No default passwords
   are stored or accepted after initial setup is complete.
   ============================================ */

class AdminPanelService {
    constructor() {
        this.STORAGE_PREFIX = 'freyai_admin_panel_';
        this.SETUP_COMPLETE_KEY = 'freyai_admin_panel_setup_complete';
        this.ROLES = {
            ADMIN: 'admin',
            DEVELOPER: 'developer'
        };
        this.currentRole = null;
        this.sessionActive = false;
        this.sessionTimeout = null;
        this.SESSION_DURATION = 30 * 60 * 1000; // 30 minutes
    }

    // ============================================
    // First-Run Setup (Open Source Security)
    // ============================================

    /**
     * Check if initial credential setup has been completed.
     * On first run, users MUST set their own admin & developer passwords.
     * This prevents open source default credentials from being used in production.
     * @returns {boolean}
     */
    isFirstRunSetupComplete() {
        return localStorage.getItem(this.SETUP_COMPLETE_KEY) === 'true';
    }

    /**
     * Check if a specific role still uses default credentials
     * @param {string} role - 'admin' or 'developer'
     * @returns {boolean}
     */
    isUsingDefaultCredentials(role) {
        const storedUser = localStorage.getItem(`${this.STORAGE_PREFIX}${role}_username`);
        const storedPass = localStorage.getItem(`${this.STORAGE_PREFIX}${role}_password`);
        // If nothing stored, defaults would be used
        return !storedUser || !storedPass;
    }

    /**
     * Complete the first-run setup by saving custom credentials for both roles.
     * @param {Object} adminCreds - { username, password }
     * @param {Object} devCreds - { username, password }
     * @returns {{ success: boolean, errors: string[] }}
     */
    completeFirstRunSetup(adminCreds, devCreds) {
        const errors = [];

        // Validate admin credentials
        if (!adminCreds.username || adminCreds.username.trim().length < 3) {
            errors.push('Admin-Benutzername muss mindestens 3 Zeichen lang sein.');
        }
        if (!adminCreds.password || adminCreds.password.trim().length < 6) {
            errors.push('Admin-Passwort muss mindestens 6 Zeichen lang sein.');
        }

        // Validate developer credentials
        if (!devCreds.username || devCreds.username.trim().length < 3) {
            errors.push('Developer-Benutzername muss mindestens 3 Zeichen lang sein.');
        }
        if (!devCreds.password || devCreds.password.trim().length < 6) {
            errors.push('Developer-Passwort muss mindestens 6 Zeichen lang sein.');
        }

        // Check admin and developer usernames are different
        if (adminCreds.username && devCreds.username &&
            adminCreds.username.trim().toLowerCase() === devCreds.username.trim().toLowerCase()) {
            errors.push('Admin- und Developer-Benutzername müssen unterschiedlich sein.');
        }

        if (errors.length > 0) {
            return { success: false, errors };
        }

        // Save credentials
        localStorage.setItem(`${this.STORAGE_PREFIX}admin_username`, adminCreds.username.trim());
        localStorage.setItem(`${this.STORAGE_PREFIX}admin_password`, adminCreds.password.trim());
        localStorage.setItem(`${this.STORAGE_PREFIX}developer_username`, devCreds.username.trim());
        localStorage.setItem(`${this.STORAGE_PREFIX}developer_password`, devCreds.password.trim());

        // Mark setup as complete
        localStorage.setItem(this.SETUP_COMPLETE_KEY, 'true');

        return { success: true, errors: [] };
    }

    // ============================================
    // Authentication
    // ============================================

    /**
     * Get stored credentials for a role.
     * Returns null if setup is not complete (no defaults exposed).
     * @param {string} role - 'admin' or 'developer'
     * @returns {{ username: string, password: string }|null}
     */
    _getCredentials(role) {
        if (!this.isFirstRunSetupComplete()) {
            return null;
        }

        const storedUser = localStorage.getItem(`${this.STORAGE_PREFIX}${role}_username`);
        const storedPass = localStorage.getItem(`${this.STORAGE_PREFIX}${role}_password`);

        if (!storedUser || !storedPass) {
            return null;
        }

        return {
            username: storedUser,
            password: storedPass
        };
    }

    /**
     * Authenticate a user with username and password.
     * Requires first-run setup to be complete.
     * @param {string} username
     * @param {string} password
     * @returns {{ success: boolean, role: string|null, error: string|null }}
     */
    authenticate(username, password) {
        if (!this.isFirstRunSetupComplete()) {
            return { success: false, role: null, error: 'Ersteinrichtung erforderlich.' };
        }

        // Check developer credentials first (higher privilege)
        const devCreds = this._getCredentials(this.ROLES.DEVELOPER);
        if (devCreds && username === devCreds.username && password === devCreds.password) {
            this.currentRole = this.ROLES.DEVELOPER;
            this.sessionActive = true;
            this._startSessionTimer();
            return { success: true, role: this.ROLES.DEVELOPER, error: null };
        }

        // Check admin credentials
        const adminCreds = this._getCredentials(this.ROLES.ADMIN);
        if (adminCreds && username === adminCreds.username && password === adminCreds.password) {
            this.currentRole = this.ROLES.ADMIN;
            this.sessionActive = true;
            this._startSessionTimer();
            return { success: true, role: this.ROLES.ADMIN, error: null };
        }

        return { success: false, role: null, error: 'Benutzername oder Passwort falsch.' };
    }

    /**
     * Logout from admin panel
     */
    logout() {
        this.currentRole = null;
        this.sessionActive = false;
        if (this.sessionTimeout) {
            clearTimeout(this.sessionTimeout);
            this.sessionTimeout = null;
        }
    }

    /**
     * Start session expiry timer
     */
    _startSessionTimer() {
        if (this.sessionTimeout) {
            clearTimeout(this.sessionTimeout);
        }
        this.sessionTimeout = setTimeout(() => {
            this.logout();
            // Dispatch event so UI can react
            document.dispatchEvent(new CustomEvent('freyai:admin-session-expired'));
        }, this.SESSION_DURATION);
    }

    /**
     * Check if current session has a specific role
     * @param {string} role
     * @returns {boolean}
     */
    hasRole(role) {
        if (!this.sessionActive) {return false;}
        if (this.currentRole === this.ROLES.DEVELOPER) {return true;} // Developer has all access
        return this.currentRole === role;
    }

    /**
     * Check if user is authenticated
     * @returns {boolean}
     */
    isAuthenticated() {
        return this.sessionActive && this.currentRole !== null;
    }

    /**
     * Check if current user is developer
     * @returns {boolean}
     */
    isDeveloper() {
        return this.sessionActive && this.currentRole === this.ROLES.DEVELOPER;
    }

    /**
     * Check if current user is admin (or developer)
     * @returns {boolean}
     */
    isAdmin() {
        return this.sessionActive && (this.currentRole === this.ROLES.ADMIN || this.currentRole === this.ROLES.DEVELOPER);
    }

    /**
     * Get current role label for display
     * @returns {string}
     */
    getRoleLabel() {
        if (!this.currentRole) {return '';}
        return this.currentRole === this.ROLES.DEVELOPER ? 'Developer' : 'Administrator';
    }

    // ============================================
    // Admin Settings (Business Configuration)
    // ============================================

    /**
     * Get all admin-level business settings
     * @returns {Object}
     */
    getBusinessSettings() {
        return {
            company_name: localStorage.getItem('company_name') || '',
            owner_name: localStorage.getItem('owner_name') || '',
            address_street: localStorage.getItem('address_street') || '',
            address_postal: localStorage.getItem('address_postal') || '',
            address_city: localStorage.getItem('address_city') || '',
            tax_number: localStorage.getItem('tax_number') || '',
            company_logo: localStorage.getItem('company_logo') || null,
            bank_name: localStorage.getItem('freyai_bank_name') || '',
            bank_iban: localStorage.getItem('freyai_bank_iban') || '',
            bank_bic: localStorage.getItem('freyai_bank_bic') || '',
            default_vat_rate: localStorage.getItem('freyai_default_vat_rate') || '19',
            payment_terms_days: localStorage.getItem('freyai_payment_terms_days') || '14',
            kleinunternehmer: localStorage.getItem('kleinunternehmer') === 'true',
            company_email: localStorage.getItem('freyai_company_email') || '',
            company_phone: localStorage.getItem('freyai_company_phone') || '',
            company_website: localStorage.getItem('freyai_company_website') || ''
        };
    }

    /**
     * Save a business setting
     * @param {string} key
     * @param {*} value
     */
    saveBusinessSetting(key, value) {
        if (!this.isAdmin()) {
            console.warn('Admin Panel: Keine Berechtigung zum Speichern.');
            return false;
        }

        const directKeys = ['company_name', 'owner_name', 'address_street', 'address_postal', 'address_city', 'tax_number', 'company_logo', 'kleinunternehmer'];
        const prefixedKeys = ['bank_name', 'bank_iban', 'bank_bic', 'default_vat_rate', 'payment_terms_days', 'company_email', 'company_phone', 'company_website'];

        if (key === 'kleinunternehmer') {
            localStorage.setItem(key, value === true ? 'true' : 'false');
        } else if (directKeys.includes(key)) {
            localStorage.setItem(key, typeof value === 'string' ? value.trim() : value);
        } else if (prefixedKeys.includes(key)) {
            localStorage.setItem(`freyai_${key}`, typeof value === 'string' ? value.trim() : value);
        }

        return true;
    }

    // ============================================
    // Developer Settings (Technical Configuration)
    // ============================================

    /**
     * Get all developer-level technical settings
     * @returns {Object}
     */
    getTechnicalSettings() {
        return {
            supabase_url: localStorage.getItem('supabase_url') || '',
            supabase_anon_key: localStorage.getItem('supabase_anon_key') || '',
            // gemini_api_key is stored server-side as Supabase env var GEMINI_API_KEY.
            // It is proxied through the ai-proxy edge function and never exposed to the client.
            resend_api_key: localStorage.getItem('resend_api_key') || '',
            stripe_publishable_key: localStorage.getItem('stripe_publishable_key') || '',
            n8n_webhook_url: localStorage.getItem('n8n_webhook_url') || '',
            email_relay_url: localStorage.getItem('email_relay_url') || '',
            email_relay_secret: localStorage.getItem('email_relay_secret') || ''
        };
    }

    /**
     * Save a technical setting (developer only)
     * @param {string} key
     * @param {string} value
     */
    saveTechnicalSetting(key, value) {
        if (!this.isDeveloper()) {
            console.warn('Admin Panel: Developer-Berechtigung erforderlich.');
            return false;
        }

        localStorage.setItem(key, value.trim());

        // Trigger service updates for live config changes
        if (key === 'supabase_url' || key === 'supabase_anon_key') {
            const url = localStorage.getItem('supabase_url');
            const anonKey = localStorage.getItem('supabase_anon_key');
            if (url && anonKey && window.supabaseConfig) {
                window.supabaseConfig.update(url, anonKey);
            }
        }

        if (key === 'stripe_publishable_key' && window.stripeService) {
            window.stripeService.publishableKey = value.trim();
            window.stripeService.init();
        }

        return true;
    }

    // ============================================
    // Credential Management
    // ============================================

    /**
     * Change credentials for a role (requires current role to match or be developer)
     * @param {string} role - 'admin' or 'developer'
     * @param {string} newUsername
     * @param {string} newPassword
     * @returns {{ success: boolean, error: string|null }}
     */
    changeCredentials(role, newUsername, newPassword) {
        // Only developer can change developer credentials
        if (role === this.ROLES.DEVELOPER && !this.isDeveloper()) {
            return { success: false, error: 'Nur Developer können Developer-Zugangsdaten ändern.' };
        }

        // Admin or developer can change admin credentials
        if (role === this.ROLES.ADMIN && !this.isAdmin()) {
            return { success: false, error: 'Keine Berechtigung.' };
        }

        if (!newUsername || newUsername.trim().length < 3) {
            return { success: false, error: 'Benutzername muss mindestens 3 Zeichen lang sein.' };
        }

        if (!newPassword || newPassword.trim().length < 6) {
            return { success: false, error: 'Passwort muss mindestens 6 Zeichen lang sein.' };
        }

        localStorage.setItem(`${this.STORAGE_PREFIX}${role}_username`, newUsername.trim());
        localStorage.setItem(`${this.STORAGE_PREFIX}${role}_password`, newPassword.trim());

        return { success: true, error: null };
    }
}

// Global instance
window.adminPanelService = new AdminPanelService();
