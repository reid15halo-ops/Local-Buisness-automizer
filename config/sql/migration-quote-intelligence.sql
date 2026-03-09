-- ============================================
-- Quote Intelligence Migration
-- Adds pricing analytics, portal view tracking,
-- and auto-refresh triggers for angebote.
--
-- Run AFTER: migration-multi-tenant.sql
-- ============================================

-- ============================================
-- 0. Prerequisites: Ensure angebote has updated_at
-- ============================================
ALTER TABLE angebote ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- ============================================
-- 1. Materialized View: angebot_price_stats
-- Aggregates pricing data from accepted/rejected
-- angebote, grouped by (tenant_id, leistungsart).
-- ============================================
DROP MATERIALIZED VIEW IF EXISTS angebot_price_stats;

CREATE MATERIALIZED VIEW angebot_price_stats AS
SELECT
    a.tenant_id,
    a.leistungsart,
    ROUND(AVG(a.netto), 2)                                         AS avg_netto,
    ROUND(MIN(a.netto), 2)                                         AS min_netto,
    ROUND(MAX(a.netto), 2)                                         AS max_netto,
    ROUND(
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY a.netto), 2
    )                                                               AS median_netto,
    COUNT(*)::INTEGER                                               AS total_angebote,
    COUNT(*) FILTER (WHERE a.status = 'angenommen')::INTEGER        AS angenommen_count,
    COUNT(*) FILTER (WHERE a.status = 'abgelehnt')::INTEGER         AS abgelehnt_count,
    ROUND(
        COUNT(*) FILTER (WHERE a.status = 'angenommen')::DECIMAL
        / NULLIF(COUNT(*), 0), 2
    )                                                               AS annahmequote,
    ROUND(AVG(
        COALESCE(jsonb_array_length(a.positionen), 0)
    ))::INTEGER                                                     AS avg_positionen,
    NOW()                                                           AS letzte_aktualisierung
FROM angebote a
WHERE a.status IN ('angenommen', 'abgelehnt')
  AND a.leistungsart IS NOT NULL
  AND a.tenant_id IS NOT NULL
GROUP BY a.tenant_id, a.leistungsart;

-- Unique index required for REFRESH MATERIALIZED VIEW CONCURRENTLY
CREATE UNIQUE INDEX IF NOT EXISTS idx_price_stats_tenant_leistung
    ON angebot_price_stats (tenant_id, leistungsart);

CREATE INDEX IF NOT EXISTS idx_price_stats_tenant
    ON angebot_price_stats (tenant_id);

-- ============================================
-- 2. RPC: refresh_price_stats
-- Refreshes the materialized view. Can be called
-- after quote status changes or on a schedule.
-- ============================================
CREATE OR REPLACE FUNCTION refresh_price_stats(p_tenant_id UUID DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Materialized views refresh globally; p_tenant_id is accepted
    -- for API consistency but the full view is always refreshed.
    -- CONCURRENTLY allows reads during refresh (requires unique index).
    REFRESH MATERIALIZED VIEW CONCURRENTLY angebot_price_stats;
END;
$$;

REVOKE EXECUTE ON FUNCTION refresh_price_stats FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION refresh_price_stats TO authenticated;

-- ============================================
-- 3. RPC: get_price_intelligence
-- Returns pricing benchmarks, similar quotes,
-- price band classification, and confidence score.
-- ============================================
CREATE OR REPLACE FUNCTION get_price_intelligence(
    p_tenant_id    UUID,
    p_leistungsart TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_stats       RECORD;
    v_similar     JSONB;
    v_price_band  TEXT;
    v_percentiles RECORD;
BEGIN
    -- 1. Fetch aggregated stats
    SELECT *
      INTO v_stats
      FROM angebot_price_stats
     WHERE tenant_id = p_tenant_id
       AND leistungsart = p_leistungsart;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'avg_price',       NULL,
            'min_price',       NULL,
            'max_price',       NULL,
            'acceptance_rate', NULL,
            'similar_quotes',  '[]'::JSONB,
            'price_band',      NULL,
            'confidence',      0
        );
    END IF;

    -- 2. Last 5 accepted angebote with same leistungsart
    SELECT COALESCE(jsonb_agg(sq), '[]'::JSONB)
      INTO v_similar
      FROM (
          SELECT
              a.id,
              a.netto,
              COALESCE(jsonb_array_length(a.positionen), 0) AS positionen_count,
              a.created_at
          FROM angebote a
          WHERE a.tenant_id = p_tenant_id
            AND a.leistungsart = p_leistungsart
            AND a.status = 'angenommen'
          ORDER BY a.created_at DESC
          LIMIT 5
      ) sq;

    -- 3. Price band based on percentiles (25th, 75th, 90th)
    SELECT
        PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY a.netto) AS p25,
        PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY a.netto) AS p75,
        PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY a.netto) AS p90
      INTO v_percentiles
      FROM angebote a
     WHERE a.tenant_id = p_tenant_id
       AND a.leistungsart = p_leistungsart
       AND a.status IN ('angenommen', 'abgelehnt');

    -- Classify: niedrig (<= p25), mittel (p25-p75), hoch (p75-p90), premium (> p90)
    -- Return the band thresholds; caller can classify their own price against these
    v_price_band := NULL; -- returned as thresholds in the response

    RETURN jsonb_build_object(
        'avg_price',        v_stats.avg_netto,
        'min_price',        v_stats.min_netto,
        'max_price',        v_stats.max_netto,
        'acceptance_rate',  v_stats.annahmequote,
        'similar_quotes',   v_similar,
        'price_band',       jsonb_build_object(
            'niedrig_bis',  ROUND(v_percentiles.p25, 2),
            'mittel_bis',   ROUND(v_percentiles.p75, 2),
            'hoch_bis',     ROUND(v_percentiles.p90, 2),
            'premium_ab',   ROUND(v_percentiles.p90, 2)
        ),
        'confidence',       v_stats.total_angebote
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION get_price_intelligence FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION get_price_intelligence TO authenticated;

-- ============================================
-- 4. RPC: get_quote_analytics
-- Dashboard analytics: conversion rates, revenue,
-- top categories, monthly trends.
-- ============================================
CREATE OR REPLACE FUNCTION get_quote_analytics(
    p_tenant_id UUID,
    p_days      INTEGER DEFAULT 90
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_cutoff            TIMESTAMPTZ := NOW() - (p_days || ' days')::INTERVAL;
    v_total             INTEGER;
    v_accepted          INTEGER;
    v_rejected          INTEGER;
    v_open              INTEGER;
    v_conversion_rate   DECIMAL;
    v_avg_response_days DECIMAL;
    v_revenue           DECIMAL;
    v_top_leistungen    JSONB;
    v_monthly_trend     JSONB;
BEGIN
    -- Counts
    SELECT
        COUNT(*)::INTEGER,
        COUNT(*) FILTER (WHERE status = 'angenommen')::INTEGER,
        COUNT(*) FILTER (WHERE status = 'abgelehnt')::INTEGER,
        COUNT(*) FILTER (WHERE status = 'offen')::INTEGER
      INTO v_total, v_accepted, v_rejected, v_open
      FROM angebote
     WHERE tenant_id = p_tenant_id
       AND created_at >= v_cutoff;

    -- Conversion rate
    v_conversion_rate := ROUND(
        v_accepted::DECIMAL / NULLIF(v_total, 0), 4
    );

    -- Average response time (created_at -> updated_at for accepted/rejected)
    SELECT ROUND(AVG(
        EXTRACT(EPOCH FROM (COALESCE(updated_at, created_at) - created_at)) / 86400.0
    ), 1)
      INTO v_avg_response_days
      FROM angebote
     WHERE tenant_id = p_tenant_id
       AND created_at >= v_cutoff
       AND status IN ('angenommen', 'abgelehnt')
       AND updated_at IS NOT NULL
       AND updated_at > created_at;

    -- Revenue from accepted quotes
    SELECT COALESCE(SUM(brutto), 0)
      INTO v_revenue
      FROM angebote
     WHERE tenant_id = p_tenant_id
       AND created_at >= v_cutoff
       AND status = 'angenommen';

    -- Top 5 leistungsarten by count
    SELECT COALESCE(jsonb_agg(tl), '[]'::JSONB)
      INTO v_top_leistungen
      FROM (
          SELECT
              leistungsart,
              COUNT(*)::INTEGER AS count,
              COUNT(*) FILTER (WHERE status = 'angenommen')::INTEGER AS accepted
          FROM angebote
          WHERE tenant_id = p_tenant_id
            AND created_at >= v_cutoff
            AND leistungsart IS NOT NULL
          GROUP BY leistungsart
          ORDER BY COUNT(*) DESC
          LIMIT 5
      ) tl;

    -- Monthly trend (last 6 months)
    SELECT COALESCE(jsonb_agg(mt ORDER BY mt.monat), '[]'::JSONB)
      INTO v_monthly_trend
      FROM (
          SELECT
              TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') AS monat,
              COUNT(*)::INTEGER                                     AS count,
              ROUND(
                  COUNT(*) FILTER (WHERE status = 'angenommen')::DECIMAL
                  / NULLIF(COUNT(*), 0), 4
              )                                                     AS conversion
          FROM angebote
          WHERE tenant_id = p_tenant_id
            AND created_at >= DATE_TRUNC('month', NOW()) - INTERVAL '5 months'
          GROUP BY DATE_TRUNC('month', created_at)
          ORDER BY DATE_TRUNC('month', created_at)
      ) mt;

    RETURN jsonb_build_object(
        'total_quotes',          v_total,
        'total_accepted',        v_accepted,
        'total_rejected',        v_rejected,
        'total_open',            v_open,
        'conversion_rate',       v_conversion_rate,
        'avg_response_time_days', v_avg_response_days,
        'revenue_from_quotes',   v_revenue,
        'top_leistungsarten',    v_top_leistungen,
        'monthly_trend',         v_monthly_trend
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION get_quote_analytics FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION get_quote_analytics TO authenticated;

-- ============================================
-- 5. Table: angebot_views (Portal tracking)
-- Tracks when customers view quotes in the portal.
-- DSGVO: IP is hashed, never stored raw.
-- ============================================
CREATE TABLE IF NOT EXISTS angebot_views (
    id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    angebot_id       TEXT NOT NULL,
    viewed_at        TIMESTAMPTZ DEFAULT NOW(),
    viewer_ip_hash   TEXT,
    duration_seconds INTEGER,
    device_type      TEXT CHECK (device_type IN ('mobile', 'desktop', 'tablet'))
);

ALTER TABLE angebot_views ENABLE ROW LEVEL SECURITY;

-- Tenant members can read their own views
CREATE POLICY "Tenant reads angebot_views" ON angebot_views
    FOR SELECT USING (
        tenant_id = get_my_tenant_id()
        OR auth.role() = 'service_role'
    );

-- Only service_role can insert (via Edge Function / portal-api)
CREATE POLICY "Service role inserts angebot_views" ON angebot_views
    FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- No UPDATE or DELETE policies: view logs are append-only

CREATE INDEX IF NOT EXISTS idx_angebot_views_tenant
    ON angebot_views (tenant_id);
CREATE INDEX IF NOT EXISTS idx_angebot_views_angebot
    ON angebot_views (angebot_id);
CREATE INDEX IF NOT EXISTS idx_angebot_views_viewed_at
    ON angebot_views (viewed_at DESC);

-- Auto-assign tenant_id trigger (reuses existing function)
DROP TRIGGER IF EXISTS auto_tenant_angebot_views ON angebot_views;
CREATE TRIGGER auto_tenant_angebot_views
    BEFORE INSERT ON angebot_views
    FOR EACH ROW EXECUTE FUNCTION auto_set_tenant_id();

-- ============================================
-- 6. Trigger: auto-refresh stats on status change
-- When angebote.status changes to 'angenommen' or
-- 'abgelehnt', queue a materialized view refresh.
-- ============================================
-- Trigger: set updated_at + notify for async refresh (NOT synchronous matview refresh)
-- The actual refresh is handled by a scheduled job (n8n/pg_cron), not in-transaction.
CREATE OR REPLACE FUNCTION trigger_angebote_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF (TG_OP = 'UPDATE'
        AND OLD.status IS DISTINCT FROM NEW.status
        AND NEW.status IN ('angenommen', 'abgelehnt'))
    THEN
        -- Set updated_at for response time tracking
        NEW.updated_at := NOW();

        -- Notify async listener to refresh matview (non-blocking)
        PERFORM pg_notify('price_stats_refresh', json_build_object(
            'tenant_id', NEW.tenant_id,
            'angebot_id', NEW.id,
            'new_status', NEW.status
        )::text);
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS angebote_status_refresh_stats ON angebote;
CREATE TRIGGER angebote_status_refresh_stats
    BEFORE UPDATE ON angebote
    FOR EACH ROW
    EXECUTE FUNCTION trigger_angebote_status_change();

-- NOTE: To process notifications, set up either:
-- 1. pg_cron job: SELECT refresh_price_stats(tenant_id) every 15 minutes
-- 2. n8n workflow listening on pg_notify channel 'price_stats_refresh'
-- 3. Supabase Realtime subscription on the channel

-- ============================================
-- 7. Initial refresh of the materialized view
-- ============================================
REFRESH MATERIALIZED VIEW angebot_price_stats;

-- ============================================
-- Summary
-- ============================================
-- Objects created:
--   Column:   angebote.updated_at (TIMESTAMPTZ)
--   MatView:  angebot_price_stats (tenant_id, leistungsart aggregations)
--   Function: refresh_price_stats(p_tenant_id UUID)
--   Function: get_price_intelligence(p_tenant_id UUID, p_leistungsart TEXT)
--   Function: get_quote_analytics(p_tenant_id UUID, p_days INTEGER)
--   Table:    angebot_views (portal view tracking, DSGVO-compliant)
--   Trigger:  angebote_status_refresh_stats (auto-refresh on status change)
--   Indexes:  6 indexes on angebot_price_stats and angebot_views
--   RLS:      Tenant-scoped on angebot_views, SECURITY DEFINER on all RPCs
