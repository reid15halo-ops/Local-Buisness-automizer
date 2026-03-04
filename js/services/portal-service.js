/* ============================================
   Portal Service
   Generates and manages customer portal tokens
   ============================================ */

class PortalService {
    constructor() {
        this.portalBaseUrl = window.location.origin + '/portal.html';
    }

    /**
     * Generate a portal token for a customer
     * @param {string} kundeId - Customer UUID
     * @returns {Promise<{token: string, url: string}>}
     */
    async generateToken(kundeId) {
        if (!kundeId) {throw new Error('Kunde ID erforderlich');}

        const supabase = window.supabaseClient || initSupabase();
        if (!supabase) {throw new Error('Supabase nicht konfiguriert');}

        // Get current user's tenant_id
        const tenantId = await this._getTenantId(supabase);

        // Generate secure random token
        const token = this._generateSecureToken();

        // Check if token already exists for this customer, if so update it
        const { data: existing } = await supabase
            .from('portal_tokens')
            .select('id')
            .eq('tenant_id', tenantId)
            .eq('kunde_id', kundeId)
            .single();

        if (existing) {
            // Update existing token
            const { error } = await supabase
                .from('portal_tokens')
                .update({
                    token,
                    expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
                })
                .eq('id', existing.id);

            if (error) {throw new Error('Fehler beim Erneuern des Portal-Tokens: ' + error.message);}
        } else {
            // Insert new token
            const { error } = await supabase
                .from('portal_tokens')
                .insert({
                    tenant_id: tenantId,
                    kunde_id: kundeId,
                    token,
                    expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
                });

            if (error) {throw new Error('Fehler beim Erstellen des Portal-Tokens: ' + error.message);}
        }

        const url = this.getPortalUrl(token);
        return { token, url };
    }

    /**
     * Get the full portal URL for a token
     * @param {string} token
     * @returns {string}
     */
    getPortalUrl(token) {
        return `${this.portalBaseUrl}?token=${encodeURIComponent(token)}`;
    }

    /**
     * Get existing portal URL for a customer (if token exists)
     * @param {string} kundeId
     * @returns {Promise<string|null>}
     */
    async getExistingPortalUrl(kundeId) {
        const supabase = window.supabaseClient || initSupabase();
        if (!supabase) {return null;}

        const tenantId = await this._getTenantId(supabase);

        const { data } = await supabase
            .from('portal_tokens')
            .select('token, expires_at')
            .eq('tenant_id', tenantId)
            .eq('kunde_id', kundeId)
            .single();

        if (!data) {return null;}

        // Check if expired
        if (new Date(data.expires_at) < new Date()) {return null;}

        return this.getPortalUrl(data.token);
    }

    /**
     * Send portal link to customer via email
     * @param {string} kundeId
     * @param {string} email
     * @returns {Promise<boolean>}
     */
    async sendPortalLink(kundeId, email) {
        if (!email) {throw new Error('E-Mail-Adresse erforderlich');}

        // Generate or refresh token
        const { url } = await this.generateToken(kundeId);

        // Get firma name
        const ap = (() => { try { return JSON.parse(localStorage.getItem('freyai_admin_settings') || '{}'); } catch { return {}; } })();
        const firmaName = ap.company_name || window.storeService?.state?.settings?.companyName || 'Ihr Dienstleister';

        // Send via email service (Supabase Edge Function)
        const supabase = window.supabaseClient || initSupabase();
        if (!supabase) {throw new Error('Supabase nicht konfiguriert');}

        const { data, error } = await supabase.functions.invoke('send-email', {
            body: {
                to: email,
                subject: `${firmaName} - Ihr Kunden-Portal`,
                body: `
                    <h2>Willkommen im Kunden-Portal</h2>
                    <p>Sie haben Zugang zu Ihrem pers\u00f6nlichen Kunden-Portal von <strong>${firmaName}</strong>.</p>
                    <p>Hier k\u00f6nnen Sie Ihre Angebote, Auftr\u00e4ge und Rechnungen einsehen.</p>
                    <p style="margin: 24px 0;">
                        <a href="${url}" style="background: #6366f1; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
                            Portal \u00f6ffnen
                        </a>
                    </p>
                    <p style="font-size: 12px; color: #666;">
                        Dieser Link ist 90 Tage g\u00fcltig. Falls er abgelaufen ist, kontaktieren Sie uns f\u00fcr einen neuen Zugang.
                    </p>
                `.trim(),
            }
        });

        if (error) {
            console.error('Portal-Link senden fehlgeschlagen:', error);
            throw new Error('E-Mail konnte nicht gesendet werden');
        }

        return true;
    }

    /**
     * Copy portal URL to clipboard
     * @param {string} kundeId
     */
    async copyPortalLink(kundeId) {
        const { url } = await this.generateToken(kundeId);
        await navigator.clipboard.writeText(url);
        if (window.showToast) {
            window.showToast('Portal-Link kopiert!', 'success');
        }
        return url;
    }

    // Private helpers

    async _getTenantId(supabase) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {throw new Error('Nicht eingeloggt');}

        const { data: profile } = await supabase
            .from('profiles')
            .select('tenant_id')
            .eq('id', user.id)
            .single();

        if (!profile?.tenant_id) {throw new Error('Kein Tenant zugewiesen');}
        return profile.tenant_id;
    }

    _generateSecureToken() {
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
    }
}

// Initialize and export
window.portalService = new PortalService();

// Global helper for use in onclick handlers
window.copyPortalLinkForKunde = async function(kundeId) {
    try {
        await window.portalService.copyPortalLink(kundeId);
    } catch (err) {
        console.error('Portal-Link Fehler:', err);
        if (window.showToast) {
            window.showToast('Portal-Link konnte nicht erstellt werden: ' + err.message, 'error');
        }
    }
};
