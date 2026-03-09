-- ============================================================
-- FreyAI Visions — Marketing Automation
-- Migration: Marketing Campaign Tables
-- Created: 2026-03-09
-- ============================================================

-- ============================================================
-- ENUM: campaign package tiers
-- ============================================================
CREATE TYPE marketing_package AS ENUM ('S', 'M', 'L');
CREATE TYPE campaign_status AS ENUM ('draft', 'onboarding', 'generating', 'scheduled', 'active', 'paused', 'completed', 'reposting');
CREATE TYPE post_status AS ENUM ('draft', 'approved', 'scheduled', 'posted', 'failed', 'reposted');
CREATE TYPE post_platform AS ENUM ('instagram', 'facebook', 'google_business', 'linkedin');

-- ============================================================
-- TABLE: marketing_campaigns
-- One campaign per customer purchase
-- ============================================================
CREATE TABLE IF NOT EXISTS marketing_campaigns (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    customer_id     UUID REFERENCES customers(id) ON DELETE SET NULL,
    package         marketing_package NOT NULL DEFAULT 'S',
    status          campaign_status NOT NULL DEFAULT 'draft',

    -- Customer branding data (collected during onboarding)
    company_name    TEXT NOT NULL,
    trade           TEXT,                          -- e.g. 'Dachdecker', 'Elektriker', 'Sanitär'
    city            TEXT,
    region          TEXT,
    logo_url        TEXT,
    brand_colors    JSONB DEFAULT '[]'::jsonb,     -- array of hex colors
    brand_fonts     JSONB DEFAULT '{}'::jsonb,
    usps            TEXT[],                        -- unique selling propositions
    photos          TEXT[] DEFAULT '{}',           -- Supabase Storage paths
    phone           TEXT,
    website         TEXT,
    social_handles  JSONB DEFAULT '{}'::jsonb,     -- {"instagram": "@handle", "facebook": "page-id"}

    -- Campaign config
    posts_per_week  INT NOT NULL DEFAULT 3,
    platforms       post_platform[] NOT NULL DEFAULT '{instagram}',
    hashtags        TEXT[] DEFAULT '{}',
    posting_times   JSONB DEFAULT '["10:00", "17:00"]'::jsonb,  -- preferred posting times

    -- Timeline
    starts_at       DATE,
    ends_at         DATE,                          -- 12 weeks after starts_at
    repost_started  BOOLEAN DEFAULT FALSE,

    -- Canva
    canva_brand_kit_id  TEXT,
    canva_folder_id     TEXT,

    -- Billing
    price_cents     INT NOT NULL DEFAULT 49000,    -- 490 EUR default (Paket S)
    paid            BOOLEAN DEFAULT FALSE,
    stripe_payment_id TEXT,

    -- Metadata
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE marketing_campaigns ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_marketing_campaigns_user ON marketing_campaigns(user_id);
CREATE INDEX idx_marketing_campaigns_status ON marketing_campaigns(status);
CREATE INDEX idx_marketing_campaigns_customer ON marketing_campaigns(customer_id);

CREATE TRIGGER trg_marketing_campaigns_updated
    BEFORE UPDATE ON marketing_campaigns
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS: Users can only see their own campaigns
CREATE POLICY "Users manage own campaigns"
    ON marketing_campaigns FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- TABLE: marketing_templates
-- Master templates (Canva references) per content category
-- ============================================================
CREATE TABLE IF NOT EXISTS marketing_templates (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category        TEXT NOT NULL,                 -- 'vorher_nachher', 'team', 'tipps', etc.
    name            TEXT NOT NULL,
    description     TEXT,
    canva_template_id TEXT,                        -- Canva design ID (master)
    thumbnail_url   TEXT,
    platform        post_platform NOT NULL DEFAULT 'instagram',
    format          TEXT NOT NULL DEFAULT 'post',  -- 'post', 'story', 'reel_cover'
    min_package     marketing_package NOT NULL DEFAULT 'S',
    caption_template TEXT,                         -- Template with {{placeholders}}
    hashtag_groups  TEXT[] DEFAULT '{}',
    is_seasonal     BOOLEAN DEFAULT FALSE,
    season_months   INT[] DEFAULT '{}',            -- e.g. {10,11} for Oct/Nov
    sort_order      INT DEFAULT 0,
    active          BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE marketing_templates ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_marketing_templates_category ON marketing_templates(category);
CREATE INDEX idx_marketing_templates_platform ON marketing_templates(platform);
CREATE INDEX idx_marketing_templates_package ON marketing_templates(min_package);

CREATE TRIGGER trg_marketing_templates_updated
    BEFORE UPDATE ON marketing_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS: Templates are readable by all authenticated users (they're shared assets)
CREATE POLICY "Authenticated users can read templates"
    ON marketing_templates FOR SELECT
    USING (auth.role() = 'authenticated');

-- Only service role can modify templates
CREATE POLICY "Service role manages templates"
    ON marketing_templates FOR ALL
    USING (auth.role() = 'service_role');

-- ============================================================
-- TABLE: marketing_posts
-- Individual scheduled posts per campaign
-- ============================================================
CREATE TABLE IF NOT EXISTS marketing_posts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id     UUID NOT NULL REFERENCES marketing_campaigns(id) ON DELETE CASCADE,
    template_id     UUID REFERENCES marketing_templates(id) ON DELETE SET NULL,
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Content
    platform        post_platform NOT NULL,
    format          TEXT NOT NULL DEFAULT 'post',
    caption         TEXT,
    hashtags        TEXT[] DEFAULT '{}',
    image_url       TEXT,                          -- Supabase Storage path (personalized)
    canva_design_id TEXT,                          -- Personalized Canva design ID

    -- Scheduling
    scheduled_at    TIMESTAMPTZ NOT NULL,
    posted_at       TIMESTAMPTZ,
    status          post_status NOT NULL DEFAULT 'draft',

    -- Platform response
    platform_post_id TEXT,                         -- ID returned by platform API
    platform_url    TEXT,                          -- Direct link to posted content

    -- Reposting
    is_repost       BOOLEAN DEFAULT FALSE,
    original_post_id UUID REFERENCES marketing_posts(id),
    repost_count    INT DEFAULT 0,

    -- Error handling
    error_message   TEXT,
    retry_count     INT DEFAULT 0,
    max_retries     INT DEFAULT 3,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE marketing_posts ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_marketing_posts_campaign ON marketing_posts(campaign_id);
CREATE INDEX idx_marketing_posts_scheduled ON marketing_posts(scheduled_at);
CREATE INDEX idx_marketing_posts_status ON marketing_posts(status);
CREATE INDEX idx_marketing_posts_user ON marketing_posts(user_id);
CREATE INDEX idx_marketing_posts_platform ON marketing_posts(platform);

CREATE TRIGGER trg_marketing_posts_updated
    BEFORE UPDATE ON marketing_posts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS: Users manage their own posts
CREATE POLICY "Users manage own posts"
    ON marketing_posts FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- TABLE: marketing_analytics
-- Engagement data collected via platform APIs
-- ============================================================
CREATE TABLE IF NOT EXISTS marketing_analytics (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id         UUID NOT NULL REFERENCES marketing_posts(id) ON DELETE CASCADE,
    campaign_id     UUID NOT NULL REFERENCES marketing_campaigns(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Metrics
    impressions     INT DEFAULT 0,
    reach           INT DEFAULT 0,
    likes           INT DEFAULT 0,
    comments        INT DEFAULT 0,
    shares          INT DEFAULT 0,
    saves           INT DEFAULT 0,
    clicks          INT DEFAULT 0,
    engagement_rate NUMERIC(5,2) DEFAULT 0,        -- percentage

    -- Snapshot timestamp (we collect multiple times)
    collected_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE marketing_analytics ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_marketing_analytics_post ON marketing_analytics(post_id);
CREATE INDEX idx_marketing_analytics_campaign ON marketing_analytics(campaign_id);
CREATE INDEX idx_marketing_analytics_user ON marketing_analytics(user_id);
CREATE INDEX idx_marketing_analytics_collected ON marketing_analytics(collected_at);

-- RLS: Users see their own analytics
CREATE POLICY "Users read own analytics"
    ON marketing_analytics FOR SELECT
    USING (auth.uid() = user_id);

-- Service role writes analytics (from n8n workflow)
CREATE POLICY "Service role writes analytics"
    ON marketing_analytics FOR INSERT
    USING (auth.role() = 'service_role');

-- ============================================================
-- VIEW: campaign_summary
-- Quick overview of campaign performance
-- ============================================================
CREATE OR REPLACE VIEW marketing_campaign_summary AS
SELECT
    mc.id AS campaign_id,
    mc.user_id,
    mc.company_name,
    mc.package,
    mc.status,
    mc.starts_at,
    mc.ends_at,
    mc.platforms,
    COUNT(DISTINCT mp.id) AS total_posts,
    COUNT(DISTINCT mp.id) FILTER (WHERE mp.status = 'posted') AS posted_count,
    COUNT(DISTINCT mp.id) FILTER (WHERE mp.status = 'scheduled') AS scheduled_count,
    COUNT(DISTINCT mp.id) FILTER (WHERE mp.status = 'failed') AS failed_count,
    COALESCE(SUM(ma.impressions), 0) AS total_impressions,
    COALESCE(SUM(ma.reach), 0) AS total_reach,
    COALESCE(SUM(ma.likes), 0) AS total_likes,
    COALESCE(SUM(ma.comments), 0) AS total_comments,
    COALESCE(SUM(ma.clicks), 0) AS total_clicks,
    CASE
        WHEN SUM(ma.impressions) > 0
        THEN ROUND((SUM(ma.likes + ma.comments + ma.shares + ma.saves)::NUMERIC / SUM(ma.impressions)) * 100, 2)
        ELSE 0
    END AS avg_engagement_rate
FROM marketing_campaigns mc
LEFT JOIN marketing_posts mp ON mp.campaign_id = mc.id
LEFT JOIN marketing_analytics ma ON ma.post_id = mp.id
GROUP BY mc.id, mc.user_id, mc.company_name, mc.package, mc.status,
         mc.starts_at, mc.ends_at, mc.platforms;

-- ============================================================
-- FUNCTION: activate_reposting
-- Switches completed campaigns to repost mode
-- ============================================================
CREATE OR REPLACE FUNCTION activate_reposting(p_campaign_id UUID)
RETURNS VOID AS $$
DECLARE
    v_campaign marketing_campaigns%ROWTYPE;
    v_top_posts RECORD;
BEGIN
    SELECT * INTO v_campaign FROM marketing_campaigns WHERE id = p_campaign_id;

    IF v_campaign.status != 'completed' THEN
        RAISE EXCEPTION 'Campaign must be completed before reposting';
    END IF;

    -- Mark campaign as reposting
    UPDATE marketing_campaigns
    SET status = 'reposting', repost_started = TRUE, updated_at = NOW()
    WHERE id = p_campaign_id;

    -- Create repost entries from top 12 performing posts
    INSERT INTO marketing_posts (
        campaign_id, template_id, user_id, platform, format,
        caption, hashtags, image_url, canva_design_id,
        scheduled_at, status, is_repost, original_post_id
    )
    SELECT
        mp.campaign_id, mp.template_id, mp.user_id, mp.platform, mp.format,
        mp.caption, mp.hashtags, mp.image_url, mp.canva_design_id,
        -- Schedule reposts: 1 per week, starting next Monday
        (date_trunc('week', NOW()) + INTERVAL '7 days' + (ROW_NUMBER() OVER (ORDER BY COALESCE(ma.total_engagement, 0) DESC) - 1) * INTERVAL '7 days'),
        'scheduled', TRUE, mp.id
    FROM marketing_posts mp
    LEFT JOIN (
        SELECT post_id, SUM(likes + comments + shares + saves) AS total_engagement
        FROM marketing_analytics
        GROUP BY post_id
    ) ma ON ma.post_id = mp.id
    WHERE mp.campaign_id = p_campaign_id
      AND mp.status = 'posted'
      AND mp.is_repost = FALSE
    ORDER BY COALESCE(ma.total_engagement, 0) DESC
    LIMIT 12;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
