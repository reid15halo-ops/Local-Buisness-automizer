/**
 * Marketing Campaign Service — FreyAI Visions
 *
 * Manages social media marketing packages for Handwerker customers.
 * Handles campaign CRUD, post scheduling, template assignment, and reposting.
 */

import { dbService } from './db-service.js';

const PACKAGE_CONFIG = {
    S: {
        name: 'Sichtbar werden',
        price_cents: 99000,
        posts_per_week: 3,
        total_posts: 36,
        platforms: ['instagram'],
        categories: ['vorher_nachher', 'team', 'tipps', 'kundenstimmen', 'saisonal', 'behind_scenes'],
        includes_stories: false,
        includes_reels: false,
        report_frequency: 'monthly'
    },
    M: {
        name: 'Lokal dominieren',
        price_cents: 179000,
        posts_per_week: 4,
        total_posts: 48,
        stories: 12,
        platforms: ['instagram', 'facebook'],
        categories: ['vorher_nachher', 'team', 'tipps', 'kundenstimmen', 'saisonal', 'behind_scenes', 'angebote', 'lokal'],
        includes_stories: true,
        includes_reels: false,
        report_frequency: 'monthly'
    },
    L: {
        name: 'Premium-Präsenz',
        price_cents: 299000,
        posts_per_week: 4,
        total_posts: 48,
        stories: 12,
        reel_covers: 4,
        platforms: ['instagram', 'facebook', 'linkedin'],
        categories: ['vorher_nachher', 'team', 'tipps', 'kundenstimmen', 'saisonal', 'behind_scenes', 'angebote', 'lokal', 'meilensteine', 'wissen'],
        includes_stories: true,
        includes_reels: true,
        report_frequency: 'weekly'
    }
};

// Best posting times for Handwerker audience (Germany)
const POSTING_TIMES = {
    weekday: ['07:00', '12:00', '17:30', '19:00'],
    weekend: ['09:00', '11:00', '17:00']
};

const CAMPAIGN_DURATION_WEEKS = 12;

class MarketingCampaignService {

    /**
     * Create a new marketing campaign
     */
    async createCampaign(data) {
        const pkg = PACKAGE_CONFIG[data.package] || PACKAGE_CONFIG.S;

        const startsAt = data.starts_at || this._nextMonday();
        const endsAt = new Date(startsAt);
        endsAt.setDate(endsAt.getDate() + CAMPAIGN_DURATION_WEEKS * 7);

        const campaign = {
            user_id: data.user_id,
            customer_id: data.customer_id || null,
            package: data.package || 'S',
            status: 'draft',
            company_name: data.company_name,
            trade: data.trade || null,
            city: data.city || null,
            region: data.region || null,
            logo_url: data.logo_url || null,
            brand_colors: data.brand_colors || [],
            usps: data.usps || [],
            photos: data.photos || [],
            phone: data.phone || null,
            website: data.website || null,
            social_handles: data.social_handles || {},
            posts_per_week: pkg.posts_per_week,
            platforms: pkg.platforms,
            hashtags: this._generateHashtags(data),
            posting_times: POSTING_TIMES,
            starts_at: startsAt.toISOString().split('T')[0],
            ends_at: endsAt.toISOString().split('T')[0],
            price_cents: data.promo_price_cents || pkg.price_cents
        };

        const result = await dbService.supabase
            .from('marketing_campaigns')
            .insert(campaign)
            .select()
            .single();

        if (result.error) throw result.error;
        return result.data;
    }

    /**
     * Get campaign by ID
     */
    async getCampaign(campaignId) {
        const result = await dbService.supabase
            .from('marketing_campaigns')
            .select('*')
            .eq('id', campaignId)
            .single();

        if (result.error) throw result.error;
        return result.data;
    }

    /**
     * List all campaigns for current user
     */
    async listCampaigns(filters = {}) {
        let query = dbService.supabase
            .from('marketing_campaigns')
            .select('*')
            .order('created_at', { ascending: false });

        if (filters.status) query = query.eq('status', filters.status);
        if (filters.customer_id) query = query.eq('customer_id', filters.customer_id);

        const result = await query;
        if (result.error) throw result.error;
        return result.data;
    }

    /**
     * Get campaign summary with analytics
     */
    async getCampaignSummary(campaignId) {
        const result = await dbService.supabase
            .from('marketing_campaign_summary')
            .select('*')
            .eq('campaign_id', campaignId)
            .single();

        if (result.error) throw result.error;
        return result.data;
    }

    /**
     * Generate post schedule for a campaign
     * Assigns templates and creates marketing_posts entries
     */
    async generatePostSchedule(campaignId) {
        const campaign = await this.getCampaign(campaignId);
        const pkg = PACKAGE_CONFIG[campaign.package];

        // Fetch available templates for this package
        const templates = await this._getTemplatesForPackage(campaign.package, campaign.platforms);

        // Build 12-week schedule
        const posts = [];
        const startDate = new Date(campaign.starts_at);

        for (let week = 0; week < CAMPAIGN_DURATION_WEEKS; week++) {
            const weekStart = new Date(startDate);
            weekStart.setDate(weekStart.getDate() + week * 7);

            // Distribute posts across the week
            const postDays = this._getPostDays(pkg.posts_per_week);

            for (let i = 0; i < postDays.length; i++) {
                const postDate = new Date(weekStart);
                postDate.setDate(postDate.getDate() + postDays[i]);

                const time = this._pickPostingTime(postDays[i]);
                const [hours, minutes] = time.split(':');
                postDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);

                // Rotate through categories
                const categoryIndex = (week * pkg.posts_per_week + i) % pkg.categories.length;
                const category = pkg.categories[categoryIndex];

                // Pick template from category
                const categoryTemplates = templates.filter(t => t.category === category && t.format === 'post');
                const template = categoryTemplates.length > 0
                    ? categoryTemplates[(week * pkg.posts_per_week + i) % categoryTemplates.length]
                    : null;

                // Create post for each platform
                for (const platform of campaign.platforms) {
                    posts.push({
                        campaign_id: campaignId,
                        template_id: template?.id || null,
                        user_id: campaign.user_id,
                        platform,
                        format: 'post',
                        caption: this._generateCaption(template, campaign),
                        hashtags: this._pickHashtags(campaign.hashtags, category),
                        scheduled_at: postDate.toISOString(),
                        status: 'draft'
                    });
                }
            }
        }

        // Add stories for M and L packages
        if (pkg.includes_stories) {
            const storyTemplates = templates.filter(t => t.format === 'story');
            for (let i = 0; i < (pkg.stories || 0); i++) {
                const weekIndex = Math.floor(i / 1); // 1 story per week
                const storyDate = new Date(startDate);
                storyDate.setDate(storyDate.getDate() + weekIndex * 7 + 3); // Wednesdays
                storyDate.setHours(12, 0, 0, 0);

                const template = storyTemplates.length > 0
                    ? storyTemplates[i % storyTemplates.length]
                    : null;

                posts.push({
                    campaign_id: campaignId,
                    template_id: template?.id || null,
                    user_id: campaign.user_id,
                    platform: 'instagram',
                    format: 'story',
                    caption: '',
                    hashtags: [],
                    scheduled_at: storyDate.toISOString(),
                    status: 'draft'
                });
            }
        }

        // Batch insert posts
        const result = await dbService.supabase
            .from('marketing_posts')
            .insert(posts)
            .select();

        if (result.error) throw result.error;

        // Update campaign status
        await this.updateCampaignStatus(campaignId, 'scheduled');

        return result.data;
    }

    /**
     * Update campaign status
     */
    async updateCampaignStatus(campaignId, status) {
        const result = await dbService.supabase
            .from('marketing_campaigns')
            .update({ status })
            .eq('id', campaignId)
            .select()
            .single();

        if (result.error) throw result.error;
        return result.data;
    }

    /**
     * Get posts due for posting (called by n8n scheduler)
     */
    async getDuePosts() {
        const now = new Date().toISOString();
        const result = await dbService.supabase
            .from('marketing_posts')
            .select(`
                *,
                campaign:marketing_campaigns(*)
            `)
            .in('status', ['scheduled', 'approved'])
            .lte('scheduled_at', now)
            .order('scheduled_at', { ascending: true })
            .limit(20);

        if (result.error) throw result.error;
        return result.data;
    }

    /**
     * Mark post as posted
     */
    async markPostAsPosted(postId, platformData = {}) {
        const result = await dbService.supabase
            .from('marketing_posts')
            .update({
                status: 'posted',
                posted_at: new Date().toISOString(),
                platform_post_id: platformData.post_id || null,
                platform_url: platformData.url || null
            })
            .eq('id', postId)
            .select()
            .single();

        if (result.error) throw result.error;
        return result.data;
    }

    /**
     * Mark post as failed
     */
    async markPostAsFailed(postId, errorMessage) {
        const post = await dbService.supabase
            .from('marketing_posts')
            .select('retry_count, max_retries')
            .eq('id', postId)
            .single();

        const retryCount = (post.data?.retry_count || 0) + 1;
        const newStatus = retryCount >= (post.data?.max_retries || 3) ? 'failed' : 'scheduled';

        const result = await dbService.supabase
            .from('marketing_posts')
            .update({
                status: newStatus,
                error_message: errorMessage,
                retry_count: retryCount
            })
            .eq('id', postId)
            .select()
            .single();

        if (result.error) throw result.error;
        return result.data;
    }

    /**
     * Activate reposting for completed campaigns
     */
    async activateReposting(campaignId) {
        const result = await dbService.supabase.rpc('activate_reposting', {
            p_campaign_id: campaignId
        });

        if (result.error) throw result.error;
        return { success: true, campaign_id: campaignId };
    }

    /**
     * Check for campaigns that need reposting (called by n8n)
     */
    async getExpiredCampaigns() {
        const today = new Date().toISOString().split('T')[0];
        const result = await dbService.supabase
            .from('marketing_campaigns')
            .select('*')
            .eq('status', 'completed')
            .eq('repost_started', false)
            .lte('ends_at', today);

        if (result.error) throw result.error;
        return result.data;
    }

    /**
     * Save analytics data for a post
     */
    async saveAnalytics(postId, campaignId, userId, metrics) {
        const result = await dbService.supabase
            .from('marketing_analytics')
            .insert({
                post_id: postId,
                campaign_id: campaignId,
                user_id: userId,
                impressions: metrics.impressions || 0,
                reach: metrics.reach || 0,
                likes: metrics.likes || 0,
                comments: metrics.comments || 0,
                shares: metrics.shares || 0,
                saves: metrics.saves || 0,
                clicks: metrics.clicks || 0,
                engagement_rate: metrics.engagement_rate || 0
            })
            .select()
            .single();

        if (result.error) throw result.error;
        return result.data;
    }

    /**
     * Get package configuration
     */
    getPackageConfig(packageTier) {
        return PACKAGE_CONFIG[packageTier] || null;
    }

    /**
     * Get all package configs (for pricing display)
     */
    getAllPackages() {
        return Object.entries(PACKAGE_CONFIG).map(([key, config]) => ({
            tier: key,
            ...config,
            price_eur: (config.price_cents / 100).toFixed(2)
        }));
    }

    // ── Private helpers ──────────────────────────────────────

    _nextMonday() {
        const d = new Date();
        const day = d.getDay();
        const diff = day === 0 ? 1 : 8 - day;
        d.setDate(d.getDate() + diff);
        d.setHours(0, 0, 0, 0);
        return d;
    }

    _getPostDays(postsPerWeek) {
        // Spread posts evenly across the week (0=Mon, 6=Sun)
        const schedules = {
            1: [2],           // Wednesday
            2: [1, 4],        // Tuesday, Friday
            3: [0, 2, 4],     // Monday, Wednesday, Friday
            4: [0, 1, 3, 4],  // Monday, Tuesday, Thursday, Friday
            5: [0, 1, 2, 3, 4] // Mon-Fri
        };
        return schedules[postsPerWeek] || schedules[3];
    }

    _pickPostingTime(dayOfWeek) {
        const times = dayOfWeek >= 5 ? POSTING_TIMES.weekend : POSTING_TIMES.weekday;
        return times[Math.floor(Math.random() * times.length)];
    }

    _generateHashtags(data) {
        const base = ['#handwerk', '#handwerker', '#meisterbetrieb', '#qualität'];
        const trade = data.trade ? [`#${data.trade.toLowerCase()}`, `#${data.trade.toLowerCase()}meister`] : [];
        const local = data.city ? [`#${data.city.toLowerCase()}`, `#handwerker${data.city.toLowerCase()}`] : [];
        return [...base, ...trade, ...local];
    }

    _pickHashtags(campaignHashtags, category) {
        const categoryTags = {
            vorher_nachher: ['#vorherNachher', '#renovation', '#transformation'],
            team: ['#teamwork', '#meisterteam', '#handwerkerteam'],
            tipps: ['#handwerkertipps', '#diy', '#expertentipp'],
            kundenstimmen: ['#kundenmeinung', '#bewertung', '#zufriedeneKunden'],
            saisonal: ['#saisonaltipp'],
            behind_scenes: ['#behindthescenes', '#werkstatt', '#handwerkskunst'],
            angebote: ['#angebot', '#aktion', '#sonderangebot'],
            lokal: ['#regional', '#ausDerRegion', '#lokalerHandwerker'],
            meilensteine: ['#meilenstein', '#danke'],
            wissen: ['#wissenswertes', '#infografik', '#gutZuWissen']
        };

        const tags = [...(campaignHashtags || []).slice(0, 15)];
        const catTags = categoryTags[category] || [];
        for (const tag of catTags) {
            if (tags.length < 25) tags.push(tag);
        }
        return tags;
    }

    _generateCaption(template, campaign) {
        if (!template?.caption_template) return '';

        return template.caption_template
            .replace(/\{\{company_name\}\}/g, campaign.company_name || '')
            .replace(/\{\{city\}\}/g, campaign.city || '')
            .replace(/\{\{trade\}\}/g, campaign.trade || '')
            .replace(/\{\{phone\}\}/g, campaign.phone || '')
            .replace(/\{\{website\}\}/g, campaign.website || '');
    }

    async _getTemplatesForPackage(packageTier, platforms) {
        const result = await dbService.supabase
            .from('marketing_templates')
            .select('*')
            .eq('active', true)
            .lte('min_package', packageTier)
            .in('platform', platforms)
            .order('sort_order', { ascending: true });

        if (result.error) throw result.error;
        return result.data || [];
    }
}

export const marketingCampaignService = new MarketingCampaignService();
export { PACKAGE_CONFIG, POSTING_TIMES, CAMPAIGN_DURATION_WEEKS };
