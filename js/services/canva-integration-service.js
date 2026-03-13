/**
 * Canva Integration Service — FreyAI Visions
 *
 * Clones and personalizes Canva master templates with customer branding.
 * All Canva Connect API calls are proxied through a Supabase Edge Function
 * to keep the API key server-side.
 *
 * @see https://www.canva.dev/docs/connect/
 */

/** Polling interval for async export status checks (ms) */
const EXPORT_POLL_INTERVAL = 3000;

/** Maximum number of status polls before giving up */
const EXPORT_POLL_MAX_RETRIES = 40; // ~2 minutes

class CanvaIntegrationService {
    constructor() {
        this._initialized = false;
        this._dbService = null;
    }

    /**
     * Lazy-init: dynamically imports db-service on first use
     * @private
     */
    async _ensureInit() {
        if (this._initialized) {return;}

        const { dbService } = await import('./db-service.js');
        this._dbService = dbService;
        this._initialized = true;
    }

    /**
     * Get the Supabase client reference
     * @private
     */
    get _supabase() {
        return this._dbService?.supabase;
    }

    /**
     * Send a request to the Canva proxy Edge Function
     * @private
     * @param {string} action - One of: clone, personalize, export, status
     * @param {Object} payload - Action-specific data
     * @returns {Promise<Object>} Response data from the proxy
     */
    async _proxyRequest(action, payload) {
        await this._ensureInit();

        const { data, error } = await this._supabase.functions.invoke('canva-proxy', {
            body: { action, ...payload }
        });

        if (error) {
            console.error(`[CanvaIntegration] Proxy error (${action}):`, error);
            throw new Error(`Canva-Proxy Fehler: ${error.message}`);
        }

        if (data?.error) {
            console.error(`[CanvaIntegration] Canva API error (${action}):`, data.error);
            throw new Error(`Canva API Fehler: ${data.error}`);
        }

        return data;
    }

    // ── Public Methods ──────────────────────────────────────

    /**
     * Clone a Canva master template for a customer campaign.
     * Creates a new editable design from the master template.
     *
     * @param {string} masterTemplateId - Canva design ID of the master template
     * @param {string} campaignId - Campaign ID (stored as metadata)
     * @returns {Promise<Object>} Cloned design with { design_id, title, edit_url }
     */
    async cloneTemplate(masterTemplateId, campaignId) {
        await this._ensureInit();

        try {
            const result = await this._proxyRequest('clone', {
                template_id: masterTemplateId,
                campaign_id: campaignId
            });

            console.log(`[CanvaIntegration] Template cloned: ${result.design_id} for campaign ${campaignId}`);
            return result;
        } catch (err) {
            console.error('[CanvaIntegration] cloneTemplate failed:', err);
            throw err;
        }
    }

    /**
     * Update a cloned design with customer branding (logo, colors, text).
     *
     * @param {string} designId - Canva design ID of the cloned design
     * @param {Object} brandData - Customer brand data
     * @param {string} [brandData.logo_url] - URL to the customer logo
     * @param {string[]} [brandData.brand_colors] - Array of hex color codes
     * @param {string} [brandData.company_name] - Company name for text replacement
     * @param {string} [brandData.trade] - Trade/Gewerk (e.g. "Dachdecker")
     * @param {string} [brandData.city] - City name
     * @param {string[]} [brandData.usps] - Unique selling points
     * @param {string} [brandData.phone] - Phone number
     * @param {string} [brandData.email] - Email address
     * @returns {Promise<Object>} Updated design data
     */
    async personalizeDesign(designId, brandData) {
        try {
            const result = await this._proxyRequest('personalize', {
                design_id: designId,
                brand_data: brandData
            });

            console.log(`[CanvaIntegration] Design personalized: ${designId}`);
            return result;
        } catch (err) {
            console.error('[CanvaIntegration] personalizeDesign failed:', err);
            throw err;
        }
    }

    /**
     * Export a finished design as an image file.
     * Canva exports are async — this method starts the export job.
     * Use getDesignStatus() to poll for completion, or use _waitForExport()
     * which handles polling automatically.
     *
     * @param {string} designId - Canva design ID
     * @param {string} [format='png'] - Export format: 'png', 'jpg', 'pdf'
     * @returns {Promise<Object>} Export job with { export_id, status, urls }
     */
    async exportDesign(designId, format = 'png') {
        try {
            const result = await this._proxyRequest('export', {
                design_id: designId,
                format
            });

            console.log(`[CanvaIntegration] Export started for ${designId}: job ${result.export_id}`);
            return result;
        } catch (err) {
            console.error('[CanvaIntegration] exportDesign failed:', err);
            throw err;
        }
    }

    /**
     * Check the status of an async design export.
     *
     * @param {string} designId - Canva design ID
     * @returns {Promise<Object>} Status with { status, urls } — status is 'in_progress' | 'completed' | 'failed'
     */
    async getDesignStatus(designId) {
        try {
            const result = await this._proxyRequest('status', {
                design_id: designId
            });

            return result;
        } catch (err) {
            console.error('[CanvaIntegration] getDesignStatus failed:', err);
            throw err;
        }
    }

    /**
     * Main orchestrator: for each template in a campaign, clone → personalize → export → store URL.
     * Updates marketing_posts with the generated image URLs.
     *
     * @param {string} campaignId - Campaign ID to generate designs for
     * @returns {Promise<Object>} Summary with { total, succeeded, failed, results }
     */
    async batchGenerateCampaign(campaignId) {
        await this._ensureInit();

        const summary = { total: 0, succeeded: 0, failed: 0, results: [] };

        try {
            // 1. Fetch campaign data (brand info)
            const { data: campaign, error: campErr } = await this._supabase
                .from('marketing_campaigns')
                .select('*')
                .eq('id', campaignId)
                .single();

            if (campErr) {throw campErr;}

            const brandData = {
                logo_url: campaign.logo_url,
                brand_colors: campaign.brand_colors || [],
                company_name: campaign.company_name,
                trade: campaign.trade,
                city: campaign.city,
                usps: campaign.usps || [],
                phone: campaign.phone,
                email: campaign.email
            };

            // 2. Fetch posts that have a template with a canva_design_id
            const { data: posts, error: postsErr } = await this._supabase
                .from('marketing_posts')
                .select(`
                    id,
                    template_id,
                    template:marketing_templates(id, canva_design_id, name)
                `)
                .eq('campaign_id', campaignId)
                .eq('status', 'draft')
                .not('template_id', 'is', null);

            if (postsErr) {throw postsErr;}

            // Deduplicate templates (many posts may share the same template)
            const templateMap = new Map();
            for (const post of posts || []) {
                const tmpl = post.template;
                if (tmpl?.canva_design_id && !templateMap.has(tmpl.id)) {
                    templateMap.set(tmpl.id, {
                        templateId: tmpl.id,
                        canvaDesignId: tmpl.canva_design_id,
                        name: tmpl.name,
                        postIds: []
                    });
                }
                if (tmpl?.canva_design_id) {
                    templateMap.get(tmpl.id).postIds.push(post.id);
                }
            }

            summary.total = templateMap.size;

            // 3. Process each unique template: clone → personalize → export → store
            for (const [, entry] of templateMap) {
                try {
                    // Clone
                    const cloned = await this.cloneTemplate(entry.canvaDesignId, campaignId);

                    // Personalize
                    await this.personalizeDesign(cloned.design_id, brandData);

                    // Export
                    const exportJob = await this.exportDesign(cloned.design_id, 'png');

                    // Wait for export to finish
                    const exported = await this._waitForExport(cloned.design_id, exportJob.export_id);

                    if (!exported?.urls?.length) {
                        throw new Error('Export lieferte keine URLs');
                    }

                    const imageUrl = exported.urls[0];

                    // Update all posts that use this template
                    const { error: updateErr } = await this._supabase
                        .from('marketing_posts')
                        .update({ image_url: imageUrl, status: 'scheduled' })
                        .in('id', entry.postIds);

                    if (updateErr) {
                        console.error('[CanvaIntegration] Post update failed:', updateErr);
                    }

                    // Store cloned design ID on the template record
                    await this._supabase
                        .from('marketing_templates')
                        .update({ canva_cloned_id: cloned.design_id })
                        .eq('id', entry.templateId);

                    summary.succeeded++;
                    summary.results.push({
                        templateId: entry.templateId,
                        designId: cloned.design_id,
                        imageUrl,
                        postIds: entry.postIds,
                        status: 'ok'
                    });
                } catch (err) {
                    summary.failed++;
                    summary.results.push({
                        templateId: entry.templateId,
                        error: err.message,
                        postIds: entry.postIds,
                        status: 'error'
                    });
                    console.error(`[CanvaIntegration] Template ${entry.templateId} failed:`, err);
                }
            }

            console.log(`[CanvaIntegration] Batch complete for campaign ${campaignId}:`, summary);
            return summary;
        } catch (err) {
            console.error('[CanvaIntegration] batchGenerateCampaign failed:', err);
            throw err;
        }
    }

    // ── Private helpers ──────────────────────────────────────

    /**
     * Poll export status until completed or max retries exceeded
     * @private
     * @param {string} designId - Canva design ID
     * @param {string} _exportId - Export job ID (for logging)
     * @returns {Promise<Object>} Completed export data with urls
     */
    async _waitForExport(designId, _exportId) {
        for (let i = 0; i < EXPORT_POLL_MAX_RETRIES; i++) {
            await this._sleep(EXPORT_POLL_INTERVAL);

            const status = await this.getDesignStatus(designId);

            if (status.status === 'completed') {
                return status;
            }

            if (status.status === 'failed') {
                throw new Error(`Export fehlgeschlagen für Design ${designId}`);
            }

            // status === 'in_progress' → keep polling
        }

        throw new Error(`Export Timeout für Design ${designId} nach ${EXPORT_POLL_MAX_RETRIES} Versuchen`);
    }

    /**
     * @private
     * @param {number} ms
     * @returns {Promise<void>}
     */
    _sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

export const canvaIntegrationService = new CanvaIntegrationService();
