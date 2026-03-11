/**
 * Canva Integration Service — FreyAI Visions
 *
 * Clones and personalizes Canva master templates with customer branding.
 * All Canva Connect API calls are proxied through a Supabase Edge Function
 * to keep the API key server-side.
 *
 * @see https://www.canva.dev/docs/connect/
 */

/** Polling interval for async job status checks (ms) */
const JOB_POLL_INTERVAL = 3000;

/** Maximum number of status polls before giving up */
const JOB_POLL_MAX_RETRIES = 40; // ~2 minutes

class CanvaIntegrationService {
    constructor() {
        this._initialized = false;
        this._dbService = null;
    }

    /** @private */
    async _ensureInit() {
        if (this._initialized) return;

        const { dbService } = await import('./db-service.js');
        this._dbService = dbService;
        this._initialized = true;
    }

    /** @private */
    get _supabase() {
        return this._dbService?.supabase;
    }

    /**
     * Send a request to the Canva proxy Edge Function
     * @private
     * @param {string} action - Proxy action name
     * @param {Object} payload - Action-specific data
     * @returns {Promise<Object>} Response data
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

    // ── Template Operations ──────────────────────────────────

    /**
     * Clone a Canva design to create an editable copy.
     *
     * @param {string} masterTemplateId - Canva design ID
     * @param {string} campaignId - Campaign ID (metadata)
     * @returns {Promise<{design_id: string, title: string, edit_url: string, thumbnail_url: string}>}
     */
    async cloneTemplate(masterTemplateId, campaignId) {
        const result = await this._proxyRequest('clone', {
            template_id: masterTemplateId,
            campaign_id: campaignId
        });

        console.log(`[CanvaIntegration] Template cloned: ${result.design_id} for campaign ${campaignId}`);
        return result;
    }

    /**
     * Autofill a brand template with customer data.
     * Creates a new design from a brand template, replacing placeholders.
     *
     * @param {string} brandTemplateId - Canva brand template ID
     * @param {Object} brandData - Customer brand data
     * @param {string} [brandData.company_name]
     * @param {string} [brandData.trade]
     * @param {string} [brandData.city]
     * @param {string} [brandData.phone]
     * @param {string} [brandData.email]
     * @param {string} [brandData.website]
     * @param {string} [brandData.logo_url]
     * @param {string[]} [brandData.usps]
     * @param {string[]} [brandData.brand_colors]
     * @param {Array<{url: string}>} [brandData.photos]
     * @param {string} [title] - Design title
     * @returns {Promise<{job_id: string, status: string, design_id: string}>}
     */
    async autofillBrandTemplate(brandTemplateId, brandData, title) {
        const result = await this._proxyRequest('autofill', {
            brand_template_id: brandTemplateId,
            brand_data: brandData,
            title
        });

        // Autofill is async — poll if still in progress
        if (result.status === 'in_progress' && result.job_id) {
            return await this._waitForAutofill(result.job_id);
        }

        console.log(`[CanvaIntegration] Brand template autofilled: ${result.design_id}`);
        return result;
    }

    // ── Asset Operations ─────────────────────────────────────

    /**
     * Upload an image to Canva's asset library.
     *
     * @param {string} imageUrl - Public URL of the image to upload
     * @param {string} [name='upload'] - Asset name
     * @returns {Promise<{job_id: string, status: string, asset_id: string}>}
     */
    async uploadAsset(imageUrl, name = 'upload') {
        const result = await this._proxyRequest('upload-asset', {
            image_url: imageUrl,
            name
        });

        console.log(`[CanvaIntegration] Asset uploaded: ${result.asset_id || result.job_id}`);
        return result;
    }

    // ── Export Operations ─────────────────────────────────────

    /**
     * Export a design as an image.
     *
     * @param {string} designId - Canva design ID
     * @param {string} [format='png'] - Export format: 'png', 'jpg', 'pdf'
     * @returns {Promise<{export_id: string, status: string, urls: string[]}>}
     */
    async exportDesign(designId, format = 'png') {
        const result = await this._proxyRequest('export', {
            design_id: designId,
            format
        });

        console.log(`[CanvaIntegration] Export started for ${designId}: job ${result.export_id}`);
        return result;
    }

    /**
     * Check export job status.
     *
     * @param {string} exportId - Export job ID
     * @returns {Promise<{status: string, urls: string[]}>}
     */
    async getExportStatus(exportId) {
        return await this._proxyRequest('status', { export_id: exportId });
    }

    /**
     * Export a design and wait for completion.
     *
     * @param {string} designId
     * @param {string} [format='png']
     * @returns {Promise<{export_id: string, urls: string[]}>}
     */
    async exportDesignAndWait(designId, format = 'png') {
        const exportJob = await this.exportDesign(designId, format);

        if (exportJob.status === 'completed' && exportJob.urls?.length) {
            return exportJob;
        }

        return await this._waitForExport(exportJob.export_id);
    }

    /**
     * Export a design, download it, and persist to Supabase Storage.
     * Returns a permanent URL instead of an expiring Canva CDN URL.
     *
     * @param {string} designId
     * @param {string} campaignId
     * @param {string} postId
     * @param {string} [format='png']
     * @returns {Promise<{public_url: string, storage_path: string}>}
     */
    async exportAndPersist(designId, campaignId, postId, format = 'png') {
        const exported = await this.exportDesignAndWait(designId, format);

        if (!exported.urls?.length) {
            throw new Error('Export lieferte keine URLs');
        }

        const result = await this._proxyRequest('persist', {
            export_url: exported.urls[0],
            campaign_id: campaignId,
            post_id: postId,
            format
        });

        console.log(`[CanvaIntegration] Persisted to Supabase: ${result.public_url}`);
        return result;
    }

    // ── Discovery Operations ─────────────────────────────────

    /**
     * List designs from the connected Canva account.
     *
     * @param {Object} [options]
     * @param {string} [options.query] - Search query
     * @param {string} [options.continuation] - Pagination cursor
     * @param {string} [options.ownership] - 'owned' | 'shared' | 'any'
     * @returns {Promise<{designs: Object[], continuation: string}>}
     */
    async listDesigns(options = {}) {
        return await this._proxyRequest('list-designs', options);
    }

    /**
     * List brand templates.
     *
     * @param {Object} [options]
     * @param {string} [options.query] - Search query
     * @param {string} [options.continuation] - Pagination cursor
     * @returns {Promise<{templates: Object[], continuation: string}>}
     */
    async listBrandTemplates(options = {}) {
        return await this._proxyRequest('list-brand-templates', options);
    }

    // ── Batch Campaign Generation ────────────────────────────

    /**
     * Generate all design assets for a campaign.
     * For each post: clone template or autofill brand template → export → persist to Storage.
     *
     * @param {string} campaignId
     * @returns {Promise<{total: number, succeeded: number, failed: number, results: Object[]}>}
     */
    async batchGenerateCampaign(campaignId) {
        await this._ensureInit();

        const summary = { total: 0, succeeded: 0, failed: 0, results: [] };

        // 1. Fetch campaign
        const { data: campaign, error: campErr } = await this._supabase
            .from('marketing_campaigns')
            .select('*')
            .eq('id', campaignId)
            .single();

        if (campErr) throw campErr;

        const brandData = {
            logo_url: campaign.logo_url,
            brand_colors: campaign.brand_colors || [],
            company_name: campaign.company_name,
            trade: campaign.trade,
            city: campaign.city,
            usps: campaign.usps || [],
            phone: campaign.phone,
            email: campaign.email,
            website: campaign.website,
            photos: (campaign.photos || []).map(url => ({ url })),
        };

        // 2. Fetch draft posts with templates
        const { data: posts, error: postsErr } = await this._supabase
            .from('marketing_posts')
            .select(`
                id,
                template_id,
                template:marketing_templates(id, canva_template_id, name, category)
            `)
            .eq('campaign_id', campaignId)
            .eq('status', 'draft')
            .not('template_id', 'is', null);

        if (postsErr) throw postsErr;

        // 3. Deduplicate: group posts by template
        const templateMap = new Map();
        for (const post of posts || []) {
            const tmpl = post.template;
            if (!tmpl?.canva_template_id) continue;

            if (!templateMap.has(tmpl.id)) {
                templateMap.set(tmpl.id, {
                    templateId: tmpl.id,
                    canvaTemplateId: tmpl.canva_template_id,
                    name: tmpl.name,
                    category: tmpl.category,
                    postIds: []
                });
            }
            templateMap.get(tmpl.id).postIds.push(post.id);
        }

        summary.total = templateMap.size;

        // 4. Process: autofill → export → persist → update posts
        for (const [, entry] of templateMap) {
            try {
                // Try autofill first (for brand templates)
                let designId;
                try {
                    const autofilled = await this.autofillBrandTemplate(
                        entry.canvaTemplateId,
                        brandData,
                        `${campaign.company_name} — ${entry.name}`
                    );
                    designId = autofilled.design_id;
                } catch {
                    // Fallback: clone if autofill fails (template is not a brand template)
                    const cloned = await this.cloneTemplate(entry.canvaTemplateId, campaignId);
                    designId = cloned.design_id;
                }

                // Export and persist to Supabase Storage
                // Use first postId for storage path; all posts share the same image
                const persisted = await this.exportAndPersist(
                    designId,
                    campaignId,
                    entry.postIds[0],
                    'png'
                );

                // Update all posts with the permanent image URL
                const { error: updateErr } = await this._supabase
                    .from('marketing_posts')
                    .update({
                        image_url: persisted.public_url,
                        canva_design_id: designId,
                        status: 'scheduled'
                    })
                    .in('id', entry.postIds);

                if (updateErr) {
                    console.error('[CanvaIntegration] Post update failed:', updateErr);
                }

                summary.succeeded++;
                summary.results.push({
                    templateId: entry.templateId,
                    designId,
                    imageUrl: persisted.public_url,
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

        // 5. Update campaign status
        if (summary.succeeded > 0) {
            await this._supabase
                .from('marketing_campaigns')
                .update({ status: 'scheduled' })
                .eq('id', campaignId);
        }

        console.log(`[CanvaIntegration] Batch complete for campaign ${campaignId}:`, summary);
        return summary;
    }

    // ── Private helpers ──────────────────────────────────────

    /** @private */
    async _waitForExport(exportId) {
        for (let i = 0; i < JOB_POLL_MAX_RETRIES; i++) {
            await this._sleep(JOB_POLL_INTERVAL);
            const status = await this.getExportStatus(exportId);

            if (status.status === 'completed') return status;
            if (status.status === 'failed') {
                throw new Error(`Export fehlgeschlagen: ${exportId}`);
            }
        }
        throw new Error(`Export Timeout: ${exportId} nach ${JOB_POLL_MAX_RETRIES} Versuchen`);
    }

    /** @private */
    async _waitForAutofill(jobId) {
        for (let i = 0; i < JOB_POLL_MAX_RETRIES; i++) {
            await this._sleep(JOB_POLL_INTERVAL);
            const result = await this._proxyRequest('autofill-status', { job_id: jobId });

            if (result.status === 'completed') return result;
            if (result.status === 'failed') {
                throw new Error(`Autofill fehlgeschlagen: ${jobId}`);
            }
        }
        throw new Error(`Autofill Timeout: ${jobId} nach ${JOB_POLL_MAX_RETRIES} Versuchen`);
    }

    /** @private */
    _sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

export const canvaIntegrationService = new CanvaIntegrationService();
