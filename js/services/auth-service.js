/* ============================================
   Auth Service — FreyAI Core Authentication
   Login, Register, Password Reset, Session
   ============================================
   Thin facade over Supabase Auth that delegates
   login / logout to StoreService so session and
   in-memory store stay in sync automatically.
   ============================================ */

class AuthService {
    constructor() {
        /** @type {Function[]} Auth-change listeners registered via onAuthChange(). */
        this.listeners = [];

        /** @type {Function|null} Supabase subscription teardown handle. */
        this._unsubscribe = null;
    }

    /* ==========================================================
       Supabase client helpers
       ========================================================== */

    /**
     * Returns the global Supabase client, or null when not configured.
     * @returns {import('@supabase/supabase-js').SupabaseClient | null}
     */
    _sb() {
        return window.freyaiSupabase || null;
    }

    /**
     * Whether the Supabase client has been initialised and is ready.
     * @returns {boolean}
     */
    isConfigured() {
        return !!window.freyaiSupabase;
    }

    /* ==========================================================
       Registration
       ========================================================== */

    /**
     * Register a new user with Supabase Auth.
     *
     * Registration is intentionally NOT delegated to StoreService
     * because it requires sign-up metadata that StoreService.login()
     * does not accept.
     *
     * @param {string} email    - User email address.
     * @param {string} password - Chosen password.
     * @param {Object} [metadata={}] - Optional profile metadata.
     * @param {string} [metadata.companyName] - Business / company name.
     * @param {string} [metadata.fullName]    - Full name of the owner.
     * @param {string} [metadata.phone]       - Phone number.
     * @returns {Promise<{user: object, session: object}>} Supabase auth data.
     * @throws {Error} When Supabase is not configured or Supabase returns an error.
     */
    async register(email, password, metadata = {}) {
        const sb = this._sb();
        if (!sb) throw new Error('Supabase nicht konfiguriert');

        const { data, error } = await sb.auth.signUp({
            email,
            password,
            options: {
                data: {
                    company_name: metadata.companyName || '',
                    full_name: metadata.fullName || '',
                    phone: metadata.phone || '',
                    plan: 'starter'
                }
            }
        });

        if (error) throw error;

        console.log('[FreyAI] User registered:', email);
        this._notify(data.user, data.session);
        return data;
    }

    /* ==========================================================
       Login — delegated to StoreService
       ========================================================== */

    /**
     * Authenticate a user with email and password.
     *
     * Delegates to {@link StoreService#login} which performs the
     * Supabase sign-in **and** loads the user's data into the
     * in-memory store in a single call.
     *
     * @param {string} email    - User email address.
     * @param {string} password - User password.
     * @returns {Promise<{user: object|null, error: string|null}>}
     *   Result object from StoreService.login().
     */
    async login(email, password) {
        if (!this.isConfigured()) {
            console.warn('[FreyAI] Login aborted — Supabase not configured.');
            return { user: null, error: 'Supabase nicht konfiguriert' };
        }

        const result = await window.storeService.login(email, password);

        if (result.error) {
            console.error('[FreyAI] Login failed:', result.error);
        } else {
            console.log('[FreyAI] Login succeeded for', email);
            const session = await this._getCurrentSession();
            this._notify(result.user, session);
        }

        return result;
    }

    /* ==========================================================
       Logout — delegated to StoreService
       ========================================================== */

    /**
     * Sign out the current user.
     *
     * Delegates to {@link StoreService#logout} which signs out via
     * Supabase Auth and clears the in-memory store.
     *
     * @returns {Promise<void>}
     */
    async logout() {
        if (!this.isConfigured()) return;

        await window.storeService.logout();
        console.log('[FreyAI] User signed out.');
        this._notify(null, null);
    }

    /* ==========================================================
       Password management
       ========================================================== */

    /**
     * Send a password-reset email via Supabase Auth.
     *
     * @param {string} email - The email address to send the reset link to.
     * @returns {Promise<void>}
     * @throws {Error} When Supabase is not configured or the request fails.
     */
    async resetPassword(email) {
        const sb = this._sb();
        if (!sb) throw new Error('Supabase nicht konfiguriert');

        const { error } = await sb.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin + '/index.html'
        });

        if (error) throw error;
        console.log('[FreyAI] Password reset email sent to', email);
    }

    /**
     * Update the password for the currently signed-in user.
     *
     * @param {string} newPassword - The new password.
     * @returns {Promise<void>}
     * @throws {Error} When Supabase is not configured or the update fails.
     */
    async updatePassword(newPassword) {
        const sb = this._sb();
        if (!sb) throw new Error('Supabase nicht konfiguriert');

        const { error } = await sb.auth.updateUser({
            password: newPassword
        });

        if (error) throw error;
        console.log('[FreyAI] Password updated successfully.');
    }

    /* ==========================================================
       Session / user helpers
       ========================================================== */

    /**
     * Retrieve the current Supabase session (if any).
     *
     * @returns {Promise<object|null>} The session object, or null.
     */
    async getSession() {
        return this._getCurrentSession();
    }

    /**
     * Return the currently authenticated user, or null.
     *
     * Delegates to {@link StoreService#getUser} so there is a single
     * source of truth for the user object.
     *
     * @returns {Promise<object|null>} Supabase user object.
     */
    async getUser() {
        if (!this.isConfigured()) return null;
        return window.storeService.getUser();
    }

    /**
     * Synchronous check whether a user is currently logged in.
     *
     * Uses the StoreService's currentUserId which is set on login
     * and cleared on logout.
     *
     * @returns {boolean}
     */
    isLoggedIn() {
        return !!window.storeService?.currentUserId;
    }

    /**
     * Return the subscription plan stored in the user's metadata.
     *
     * @returns {Promise<string>} Plan identifier (defaults to 'starter').
     */
    async getPlan() {
        const user = await this.getUser();
        return user?.user_metadata?.plan || 'starter';
    }

    /* ==========================================================
       Auth-change listener
       ========================================================== */

    /**
     * Subscribe to authentication state changes.
     *
     * The callback receives `(user, session)` whenever the auth
     * state changes (login, logout, token refresh, etc.).
     *
     * @param {Function} callback - `(user: object|null, session: object|null) => void`
     * @returns {Function} Unsubscribe function — call it to remove the listener.
     */
    onAuthChange(callback) {
        this.listeners.push(callback);

        // Set up the Supabase onAuthStateChange listener once
        if (!this._unsubscribe) {
            const sb = this._sb();
            if (sb) {
                const { data } = sb.auth.onAuthStateChange((event, session) => {
                    const user = session?.user || null;
                    console.log('[FreyAI] Auth state changed:', event);
                    this._notify(user, session);
                });
                this._unsubscribe = data?.subscription?.unsubscribe || null;
            }
        }

        return () => {
            this.listeners = this.listeners.filter(l => l !== callback);
        };
    }

    /* ==========================================================
       Internal helpers
       ========================================================== */

    /**
     * Notify all registered auth-change listeners.
     *
     * @param {object|null} user    - Current user object.
     * @param {object|null} session - Current session object.
     * @private
     */
    _notify(user, session) {
        this.listeners.forEach(cb => {
            try {
                cb(user, session);
            } catch (err) {
                console.error('[FreyAI] Auth listener threw:', err);
            }
        });
    }

    /**
     * Fetch the current session from Supabase Auth.
     *
     * @returns {Promise<object|null>}
     * @private
     */
    async _getCurrentSession() {
        const sb = this._sb();
        if (!sb) return null;

        try {
            const { data: { session } } = await sb.auth.getSession();
            return session;
        } catch (err) {
            console.error('[FreyAI] Failed to retrieve session:', err);
            return null;
        }
    }
}

window.authService = new AuthService();
