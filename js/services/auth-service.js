/* ============================================
   Auth Service - Supabase Authentication
   Login, Register, Password Reset, Session

   Uses window.supabaseConfig.get() which delegates
   to SupabaseClientService when available.
   ============================================ */

class AuthService {
    constructor() {
        this.user = null;
        this.session = null;
        this.listeners = [];
        this._authSubscription = null;
    }

    getClient() {
        return window.supabaseConfig?.get();
    }

    isConfigured() {
        return window.supabaseConfig?.isConfigured() || false;
    }

    // Register new user
    async register(email, password, metadata = {}) {
        const client = this.getClient();
        if (!client) {throw new Error('Supabase nicht konfiguriert');}

        const { data, error } = await client.auth.signUp({
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

        if (error) {throw error;}

        this.user = data.user;
        this.session = data.session;
        this._notify();
        return data;
    }

    // Login
    async login(email, password) {
        const client = this.getClient();
        if (!client) {throw new Error('Supabase nicht konfiguriert');}

        const { data, error } = await client.auth.signInWithPassword({
            email,
            password
        });

        if (error) {throw error;}

        this.user = data.user;
        this.session = data.session;
        this._notify();
        return data;
    }

    // Logout
    async logout() {
        const client = this.getClient();
        if (!client) {return;}

        await client.auth.signOut();
        this.user = null;
        this.session = null;

        // M2 fix: Clear IndexedDB on logout to prevent data leakage
        if (window.dbService && typeof window.dbService.clear === 'function') {
            try {
                await window.dbService.clear();
            } catch (e) {
                console.warn('[Auth] Failed to clear local data on logout:', e);
            }
        }

        // Clear SyncService localStorage data (DSGVO compliance)
        const syncKeys = [
            'hwf_purchase_orders', 'hwf_stock_movements', 'hwf_material_reservations',
            'hwf_suppliers', 'hwf_communication_log', 'hwf_sync_queue', 'hwf_last_sync_times'
        ];
        syncKeys.forEach(key => localStorage.removeItem(key));

        // Clear storeService cached state
        if (window.storeService && typeof window.storeService.clear === 'function') {
            try { window.storeService.clear(); } catch(e) { console.warn('[Auth] storeService clear failed:', e); }
        }

        this._notify();
    }

    // Password reset
    async resetPassword(email) {
        const client = this.getClient();
        if (!client) {throw new Error('Supabase nicht konfiguriert');}

        const { error } = await client.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin + '/index.html'
        });

        if (error) {throw error;}
    }

    // Update password
    async updatePassword(newPassword) {
        const client = this.getClient();
        if (!client) {throw new Error('Supabase nicht konfiguriert');}

        const { error } = await client.auth.updateUser({
            password: newPassword
        });

        if (error) {throw error;}
    }

    // Get current session
    async getSession() {
        const client = this.getClient();
        if (!client) {return null;}

        const { data: { session } } = await client.auth.getSession();
        this.session = session;
        this.user = session?.user || null;
        return session;
    }

    // Get current user
    getUser() {
        return this.user;
    }

    // Check if logged in
    isLoggedIn() {
        return !!this.user;
    }

    // Get user's plan
    getPlan() {
        return this.user?.user_metadata?.plan || 'starter';
    }

    // Subscribe to auth changes.
    // Only creates one Supabase onAuthStateChange subscription (singleton).
    onAuthChange(callback) {
        this.listeners.push(callback);

        // Only subscribe once to Supabase auth state changes
        if (!this._authSubscription) {
            const client = this.getClient();
            if (client) {
                const { data } = client.auth.onAuthStateChange((_event, session) => {
                    this.session = session;
                    this.user = session?.user || null;
                    this._notify();
                });
                this._authSubscription = data?.subscription;
            }
        }

        return () => {
            this.listeners = this.listeners.filter(l => l !== callback);
        };
    }

    _notify() {
        this.listeners.forEach(cb => cb(this.user, this.session));
    }
}

window.authService = new AuthService();
