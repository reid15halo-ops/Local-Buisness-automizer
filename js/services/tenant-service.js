/* ============================================
   Tenant Management Service
   Multi-tenant CRUD for platform admin (Developer role)
   Uses Supabase service_role for tenant operations
   ============================================ */

class TenantService {
    constructor() {
        this.CACHE_KEY = 'freyai_tenants_cache';
        this.CACHE_TTL = 5 * 60 * 1000; // 5 min
        this._cache = null;
        this._cacheTime = 0;
    }

    // ============================================
    // Supabase Client (service role) — DISABLED
    // Service role key must NEVER be stored client-side.
    // Tenant operations should go through Edge Functions or RLS-protected anon key.
    // ============================================
    _getClient() {
        // SECURITY: Remove any leftover service_role_key from localStorage
        localStorage.removeItem('supabase_service_role_key');

        // Use anon key via global supabase client instead
        const url = localStorage.getItem('supabase_url');
        const key = localStorage.getItem('supabase_anon_key');
        if (!url || !key) {return null;}

        return { url, key };
    }

    async _fetch(path, options = {}) {
        const client = this._getClient();
        if (!client) {throw new Error('Supabase nicht konfiguriert. Bitte Service Role Key im Developer-Panel setzen.');}

        const resp = await fetch(`${client.url}/rest/v1/${path}`, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                'apikey': client.key,
                'Authorization': `Bearer ${client.key}`,
                'Prefer': options.method === 'POST' ? 'return=representation' : 'return=minimal',
                ...(options.headers || {})
            }
        });

        if (!resp.ok) {
            const err = await resp.text().catch(() => resp.statusText);
            throw new Error(`Supabase Fehler (${resp.status}): ${err}`);
        }

        const text = await resp.text();
        return text ? JSON.parse(text) : null;
    }

    // ============================================
    // CRUD Operations
    // ============================================

    /**
     * List all tenants
     */
    async listTenants(forceRefresh = false) {
        if (!forceRefresh && this._cache && Date.now() - this._cacheTime < this.CACHE_TTL) {
            return this._cache;
        }

        const tenants = await this._fetch('tenants?select=*&order=created_at.desc');
        this._cache = tenants || [];
        this._cacheTime = Date.now();
        return this._cache;
    }

    /**
     * Get single tenant by ID
     */
    async getTenant(id) {
        const data = await this._fetch(`tenants?id=eq.${id}&select=*`, {
            headers: { 'Accept': 'application/vnd.pgrst.object+json' }
        });
        return data;
    }

    /**
     * Get tenant by domain
     */
    async getTenantByDomain(domain) {
        const data = await this._fetch(`tenants?domain=eq.${domain}&active=eq.true&select=*`);
        return data?.[0] || null;
    }

    /**
     * Create a new tenant
     */
    async createTenant(tenantData) {
        // Generate slug from name
        if (!tenantData.slug) {
            tenantData.slug = this._slugify(tenantData.name);
        }

        const result = await this._fetch('tenants', {
            method: 'POST',
            headers: { 'Prefer': 'return=representation' },
            body: JSON.stringify({
                name: tenantData.name,
                slug: tenantData.slug,
                domain: tenantData.domain || null,
                email_inbound: tenantData.email_inbound || (tenantData.domain ? `anfragen@${tenantData.domain}` : null),
                email_outbound: tenantData.email_outbound || (tenantData.domain ? `angebote@${tenantData.domain}` : null),
                inhaber: tenantData.inhaber || '',
                adresse: tenantData.adresse || '',
                plz: tenantData.plz || '',
                stadt: tenantData.stadt || '',
                telefon: tenantData.telefon || '',
                website: tenantData.website || '',
                steuernummer: tenantData.steuernummer || '',
                ust_id: tenantData.ust_id || '',
                iban: tenantData.iban || '',
                bic: tenantData.bic || '',
                bank: tenantData.bank || '',
                branche: tenantData.branche || 'metallbau',
                preisliste: tenantData.preisliste || {},
                ai_system_prompt: tenantData.ai_system_prompt || null,
                ai_enabled: tenantData.ai_enabled !== false,
                plan: tenantData.plan || 'free',
                max_users: tenantData.max_users || 3,
                max_emails_per_day: tenantData.max_emails_per_day || 50,
                active: true
            })
        });

        this._cache = null; // Invalidate cache
        return result?.[0] || result;
    }

    /**
     * Update a tenant
     */
    async updateTenant(id, updates) {
        await this._fetch(`tenants?id=eq.${id}`, {
            method: 'PATCH',
            body: JSON.stringify(updates)
        });
        this._cache = null;
    }

    /**
     * Deactivate a tenant (soft delete)
     */
    async deactivateTenant(id) {
        await this.updateTenant(id, { active: false });
    }

    /**
     * Reactivate a tenant
     */
    async reactivateTenant(id) {
        await this.updateTenant(id, { active: true });
    }

    // ============================================
    // Tenant Stats
    // ============================================

    /**
     * Get stats for a tenant
     */
    async getTenantStats(tenantId) {
        const client = this._getClient();
        if (!client) {return null;}

        const tables = ['kunden', 'anfragen', 'angebote', 'rechnungen'];
        const stats = {};

        for (const table of tables) {
            try {
                const resp = await fetch(
                    `${client.url}/rest/v1/${table}?tenant_id=eq.${tenantId}&select=id`,
                    {
                        method: 'HEAD',
                        headers: {
                            'apikey': client.key,
                            'Authorization': `Bearer ${client.key}`,
                            'Prefer': 'count=exact'
                        }
                    }
                );
                const count = resp.headers.get('content-range');
                stats[table] = count ? parseInt(count.split('/')[1]) || 0 : 0;
            } catch {
                stats[table] = 0;
            }
        }

        return stats;
    }

    // ============================================
    // Sync Setup Wizard → Tenant
    // ============================================

    /**
     * Create/update tenant from local setup wizard data
     * Called after user completes onboarding
     */
    async syncFromSetupWizard() {
        const profile = window.setupWizard?.getCompanyProfile();
        if (!profile?.company_name) {return null;}

        const settings = window.setupWizard?.getAdminSettings() || {};
        const bizSettings = window.adminPanelService?.getBusinessSettings() || {};

        const tenantData = {
            name: profile.company_name,
            inhaber: profile.owner_name,
            adresse: profile.address_street,
            plz: profile.address_postal,
            stadt: profile.address_city,
            steuernummer: profile.tax_number,
            telefon: bizSettings.company_phone || '',
            website: bizSettings.company_website || '',
            iban: bizSettings.bank_iban || '',
            bic: bizSettings.bank_bic || '',
            bank: bizSettings.bank_name || '',
            branche: localStorage.getItem('business_type') || 'metallbau',
            logo_url: profile.company_logo || null
        };

        // Check if tenant with this name already exists
        const existing = await this.listTenants(true);
        const match = existing.find(t => t.name === tenantData.name);

        if (match) {
            await this.updateTenant(match.id, tenantData);
            return match.id;
        } else {
            const created = await this.createTenant(tenantData);
            return created?.id;
        }
    }

    // ============================================
    // MX/DNS Instructions
    // ============================================

    /**
     * Get DNS setup instructions for a tenant domain
     */
    getDNSInstructions(domain, vpsIp = '72.61.187.24') {
        return {
            mx: {
                type: 'MX',
                host: domain,
                value: vpsIp,
                priority: 10,
                description: `MX Record: ${domain} → ${vpsIp} (Prio 10)`
            },
            spf: {
                type: 'TXT',
                host: domain,
                value: `v=spf1 ip4:${vpsIp} ~all`,
                description: 'SPF Record für E-Mail-Authentifizierung'
            },
            info: [
                `1. MX-Record setzen: ${domain} → ${vpsIp} (Priorität 10)`,
                `2. SPF-Record setzen: v=spf1 ip4:${vpsIp} ~all`,
                '3. DKIM wird automatisch konfiguriert nach Aktivierung',
                '4. DNS-Propagation kann bis zu 48h dauern'
            ]
        };
    }

    // ============================================
    // Utilities
    // ============================================

    _slugify(text) {
        return text
            .toLowerCase()
            .replace(/[äÄ]/g, 'ae')
            .replace(/[öÖ]/g, 'oe')
            .replace(/[üÜ]/g, 'ue')
            .replace(/ß/g, 'ss')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '')
            .slice(0, 50);
    }

    // ============================================
    // Admin Panel UI Renderer
    // ============================================

    /**
     * Render tenant management HTML for admin panel modal
     */
    renderTenantPanel() {
        return `
        <div class="tenant-panel" id="tenant-panel">
            <div class="tenant-panel-header" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
                <h3 style="margin:0">Mandanten-Verwaltung</h3>
                <button onclick="window.tenantService.showCreateDialog()" class="btn btn-primary" style="padding:8px 16px;border-radius:8px;border:none;background:#6366f1;color:#fff;cursor:pointer">
                    + Neuer Mandant
                </button>
            </div>

            <div id="tenant-list" style="display:flex;flex-direction:column;gap:12px">
                <p style="color:#888;text-align:center;padding:20px">Lade Mandanten...</p>
            </div>
        </div>`;
    }

    /**
     * Load and render tenant list
     */
    async loadTenantList() {
        const container = document.getElementById('tenant-list');
        if (!container) {return;}

        try {
            const tenants = await this.listTenants(true);

            if (tenants.length === 0) {
                container.innerHTML = '<p style="color:#888;text-align:center;padding:20px">Noch keine Mandanten. Klicken Sie auf "+ Neuer Mandant".</p>';
                return;
            }

            container.innerHTML = tenants.map(t => `
                <div class="tenant-card" style="background:${t.active ? '#1a1a2e' : '#2a1a1a'};border:1px solid ${t.active ? '#333' : '#633'};border-radius:12px;padding:16px">
                    <div style="display:flex;justify-content:space-between;align-items:start">
                        <div>
                            <strong style="font-size:1.1em">${this._esc(t.name)}</strong>
                            ${t.active ? '<span style="color:#4ade80;font-size:.8em;margin-left:8px">aktiv</span>' : '<span style="color:#f87171;font-size:.8em;margin-left:8px">inaktiv</span>'}
                            <div style="color:#888;font-size:.9em;margin-top:4px">
                                ${t.domain ? `<span>📧 ${this._esc(t.domain)}</span> · ` : ''}
                                <span>${this._esc(t.branche || 'k.A.')}</span> ·
                                <span>Plan: ${t.plan}</span>
                            </div>
                            ${t.inhaber ? `<div style="color:#aaa;font-size:.85em;margin-top:2px">Inhaber: ${this._esc(t.inhaber)}</div>` : ''}
                        </div>
                        <div style="display:flex;gap:8px">
                            <button onclick="window.tenantService.showEditDialog('${t.id}')" style="padding:6px 12px;border-radius:6px;border:1px solid #555;background:transparent;color:#fff;cursor:pointer;font-size:.85em">Bearbeiten</button>
                            ${t.active
                                ? `<button onclick="window.tenantService.toggleActive('${t.id}', false)" style="padding:6px 12px;border-radius:6px;border:1px solid #633;background:transparent;color:#f87171;cursor:pointer;font-size:.85em">Deaktivieren</button>`
                                : `<button onclick="window.tenantService.toggleActive('${t.id}', true)" style="padding:6px 12px;border-radius:6px;border:1px solid #363;background:transparent;color:#4ade80;cursor:pointer;font-size:.85em">Aktivieren</button>`
                            }
                        </div>
                    </div>
                    <div style="display:flex;gap:16px;margin-top:12px;font-size:.85em;color:#aaa">
                        <span>Emails heute: ${t.emails_sent_today || 0}/${t.max_emails_per_day || 50}</span>
                        <span>Max Users: ${t.max_users || 3}</span>
                        <span>AI: ${t.ai_enabled ? 'An' : 'Aus'}</span>
                    </div>
                </div>
            `).join('');
        } catch (err) {
            container.innerHTML = `<p style="color:#f87171;text-align:center;padding:20px">Fehler: ${this._esc(err.message)}</p>`;
        }
    }

    /**
     * Show create tenant dialog
     */
    showCreateDialog() {
        this._showFormDialog(null);
    }

    /**
     * Show edit tenant dialog
     */
    async showEditDialog(id) {
        const tenant = await this.getTenant(id);
        if (tenant) {this._showFormDialog(tenant);}
    }

    /**
     * Toggle tenant active status
     */
    async toggleActive(id, active) {
        try {
            if (active) {
                await this.reactivateTenant(id);
            } else {
                await this.deactivateTenant(id);
            }
            await this.loadTenantList();
            if (window.showToast) {window.showToast(`Mandant ${active ? 'aktiviert' : 'deaktiviert'}`, 'success');}
        } catch (err) {
            if (window.showToast) {window.showToast(`Fehler: ${err.message}`, 'error');}
        }
    }

    _showFormDialog(existing) {
        const isEdit = !!existing;
        const t = existing || {};

        const overlay = document.createElement('div');
        overlay.id = 'tenant-form-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:10001;display:flex;align-items:center;justify-content:center;padding:20px';
        overlay.innerHTML = `
        <div style="background:#1e1e2e;border-radius:16px;padding:24px;max-width:600px;width:100%;max-height:85vh;overflow-y:auto;color:#fff">
            <h3 style="margin-top:0">${isEdit ? 'Mandant bearbeiten' : 'Neuen Mandant anlegen'}</h3>
            <form id="tenant-form" style="display:flex;flex-direction:column;gap:12px">
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
                    ${this._field('name', 'Firmenname *', t.name || '', 'Metallbau Schmidt GmbH')}
                    ${this._field('inhaber', 'Inhaber', t.inhaber || '', 'Max Schmidt')}
                    ${this._field('domain', 'Domain', t.domain || '', 'metallbau-schmidt.de')}
                    ${this._field('branche', 'Branche', t.branche || 'metallbau', 'metallbau')}
                    ${this._field('adresse', 'Adresse', t.adresse || '', 'Hauptstr. 1')}
                    ${this._field('plz', 'PLZ', t.plz || '', '74523')}
                    ${this._field('stadt', 'Stadt', t.stadt || '', 'Schwäbisch Hall')}
                    ${this._field('telefon', 'Telefon', t.telefon || '', '+49 123 456789')}
                    ${this._field('steuernummer', 'Steuernummer', t.steuernummer || '', '75/123/45678')}
                    ${this._field('ust_id', 'USt-IdNr', t.ust_id || '', 'DE123456789')}
                    ${this._field('iban', 'IBAN', t.iban || '', 'DE89370400440532013000')}
                    ${this._field('bank', 'Bank', t.bank || '', 'Sparkasse')}
                </div>

                <div style="margin-top:8px">
                    <label style="font-size:.85em;color:#aaa;display:block;margin-bottom:4px">AI System-Prompt (optional)</label>
                    <textarea name="ai_system_prompt" rows="3" style="width:100%;padding:8px;border-radius:8px;border:1px solid #444;background:#111;color:#fff;font-family:inherit;resize:vertical"
                        placeholder="Du bist der KI-Assistent von...">${this._esc(t.ai_system_prompt || '')}</textarea>
                </div>

                <div style="display:flex;gap:12px;align-items:center;margin-top:4px">
                    <label style="display:flex;align-items:center;gap:6px;cursor:pointer">
                        <input type="checkbox" name="ai_enabled" ${t.ai_enabled !== false ? 'checked' : ''}>
                        <span style="font-size:.9em">AI-Antworten aktiv</span>
                    </label>
                    <div style="flex:1"></div>
                    <label style="font-size:.85em;color:#aaa">Max Emails/Tag:</label>
                    <input type="number" name="max_emails_per_day" value="${t.max_emails_per_day || 50}" min="0" max="500"
                        style="width:80px;padding:6px;border-radius:6px;border:1px solid #444;background:#111;color:#fff;text-align:center">
                </div>

                <div style="display:flex;gap:12px;justify-content:flex-end;margin-top:16px">
                    <button type="button" onclick="document.getElementById('tenant-form-overlay')?.remove()"
                        style="padding:10px 20px;border-radius:8px;border:1px solid #555;background:transparent;color:#fff;cursor:pointer">Abbrechen</button>
                    <button type="submit"
                        style="padding:10px 20px;border-radius:8px;border:none;background:#6366f1;color:#fff;cursor:pointer;font-weight:600">
                        ${isEdit ? 'Speichern' : 'Mandant anlegen'}
                    </button>
                </div>
            </form>

            ${isEdit && t.domain ? `
            <div style="margin-top:20px;padding:16px;background:#111;border-radius:8px;border:1px solid #333">
                <h4 style="margin:0 0 8px">DNS-Einrichtung für ${this._esc(t.domain)}</h4>
                <div style="font-size:.85em;color:#aaa;font-family:monospace;line-height:1.8">
                    ${this.getDNSInstructions(t.domain).info.map(i => `<div>${this._esc(i)}</div>`).join('')}
                </div>
            </div>` : ''}
        </div>`;

        document.body.appendChild(overlay);

        // Handle form submit
        document.getElementById('tenant-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const form = e.target;
            const data = {
                name: form.name.value,
                inhaber: form.inhaber.value,
                domain: form.domain.value || null,
                branche: form.branche.value,
                adresse: form.adresse.value,
                plz: form.plz.value,
                stadt: form.stadt.value,
                telefon: form.telefon.value,
                steuernummer: form.steuernummer.value,
                ust_id: form.ust_id.value,
                iban: form.iban.value,
                bank: form.bank.value,
                ai_system_prompt: form.ai_system_prompt.value || null,
                ai_enabled: form.ai_enabled.checked,
                max_emails_per_day: parseInt(form.max_emails_per_day.value) || 50
            };

            if (data.domain) {
                data.email_inbound = `anfragen@${data.domain}`;
                data.email_outbound = `angebote@${data.domain}`;
            }

            try {
                if (isEdit) {
                    await this.updateTenant(existing.id, data);
                    if (window.showToast) {window.showToast('Mandant aktualisiert', 'success');}
                } else {
                    if (!data.name) {
                        if (window.showToast) {window.showToast('Firmenname ist erforderlich', 'error');}
                        return;
                    }
                    await this.createTenant(data);
                    if (window.showToast) {window.showToast('Mandant angelegt', 'success');}
                }
                overlay.remove();
                await this.loadTenantList();

                // Refresh SMTP domain cache
                this._refreshSMTPDomains();
            } catch (err) {
                if (window.showToast) {window.showToast(`Fehler: ${err.message}`, 'error');}
            }
        });
    }

    /**
     * Tell VPS SMTP server to refresh its domain list
     */
    async _refreshSMTPDomains() {
        const relayUrl = localStorage.getItem('email_relay_url');
        if (!relayUrl) {return;}
        try {
            await fetch(`${relayUrl}/domains/refresh`, { method: 'POST' });
        } catch { /* VPS might not be reachable from browser */ }
    }

    _field(name, label, value, placeholder) {
        return `<div>
            <label style="font-size:.85em;color:#aaa;display:block;margin-bottom:4px">${label}</label>
            <input name="${name}" value="${this._esc(value)}" placeholder="${placeholder}"
                style="width:100%;padding:8px;border-radius:8px;border:1px solid #444;background:#111;color:#fff;font-family:inherit;box-sizing:border-box">
        </div>`;
    }

    _esc(s) {
        if (!s) {return '';}
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
}

// Global instance
window.tenantService = new TenantService();
