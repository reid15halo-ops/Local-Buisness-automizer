-- ============================================================
-- FreyAI Visions 95/5 Architecture — Zone 1
-- Migration 004: Database Functions & Triggers
-- ============================================================

-- ============================================================
-- FUNCTION: get_dashboard_stats
-- Returns a JSON object with key business KPIs for the dashboard.
-- Runs SECURITY DEFINER so it can query across RLS with the
-- caller's user_id as filter — no bypass needed.
-- ============================================================
CREATE OR REPLACE FUNCTION get_dashboard_stats(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_result JSONB;

    -- Revenue (current month, paid invoices)
    v_revenue_current_month     NUMERIC(14,2);
    v_revenue_last_month        NUMERIC(14,2);
    v_revenue_ytd               NUMERIC(14,2);

    -- Invoice counts
    v_invoices_open_count       INTEGER;
    v_invoices_overdue_count    INTEGER;
    v_invoices_draft_count      INTEGER;
    v_invoices_pending_approval INTEGER;
    v_invoices_total_outstanding NUMERIC(14,2);

    -- Order counts
    v_orders_active_count       INTEGER;
    v_orders_pending_count      INTEGER;
    v_orders_completed_month    INTEGER;

    -- Quote stats
    v_quotes_open_count         INTEGER;
    v_quotes_conversion_rate    NUMERIC(5,2);

    -- Lead stats
    v_leads_new_count           INTEGER;
    v_leads_qualified_count     INTEGER;

    -- Job queue stats
    v_jobs_pending_count        INTEGER;
    v_jobs_failed_count         INTEGER;

BEGIN
    -- ---- Revenue ----
    SELECT COALESCE(SUM(total), 0)
    INTO v_revenue_current_month
    FROM invoices
    WHERE user_id = p_user_id
      AND status = 'paid'
      AND paid_date >= DATE_TRUNC('month', CURRENT_DATE)
      AND paid_date < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month';

    SELECT COALESCE(SUM(total), 0)
    INTO v_revenue_last_month
    FROM invoices
    WHERE user_id = p_user_id
      AND status = 'paid'
      AND paid_date >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month'
      AND paid_date < DATE_TRUNC('month', CURRENT_DATE);

    SELECT COALESCE(SUM(total), 0)
    INTO v_revenue_ytd
    FROM invoices
    WHERE user_id = p_user_id
      AND status = 'paid'
      AND paid_date >= DATE_TRUNC('year', CURRENT_DATE);

    -- ---- Invoice counts ----
    SELECT COUNT(*) INTO v_invoices_open_count
    FROM invoices
    WHERE user_id = p_user_id AND status = 'sent';

    SELECT COUNT(*) INTO v_invoices_overdue_count
    FROM invoices
    WHERE user_id = p_user_id
      AND status IN ('sent', 'overdue')
      AND due_date < CURRENT_DATE;

    SELECT COUNT(*) INTO v_invoices_draft_count
    FROM invoices
    WHERE user_id = p_user_id AND status = 'draft';

    SELECT COUNT(*) INTO v_invoices_pending_approval
    FROM invoices
    WHERE user_id = p_user_id AND status = 'pending_approval';

    SELECT COALESCE(SUM(total), 0) INTO v_invoices_total_outstanding
    FROM invoices
    WHERE user_id = p_user_id AND status IN ('sent', 'overdue');

    -- ---- Order counts ----
    SELECT COUNT(*) INTO v_orders_active_count
    FROM orders
    WHERE user_id = p_user_id AND status = 'in_progress';

    SELECT COUNT(*) INTO v_orders_pending_count
    FROM orders
    WHERE user_id = p_user_id AND status = 'pending';

    SELECT COUNT(*) INTO v_orders_completed_month
    FROM orders
    WHERE user_id = p_user_id
      AND status = 'completed'
      AND completed_date >= DATE_TRUNC('month', CURRENT_DATE);

    -- ---- Quote stats ----
    SELECT COUNT(*) INTO v_quotes_open_count
    FROM quotes
    WHERE user_id = p_user_id AND status IN ('draft', 'sent');

    SELECT
        CASE
            WHEN COUNT(*) = 0 THEN 0
            ELSE ROUND(
                COUNT(*) FILTER (WHERE status = 'accepted') * 100.0 / COUNT(*),
                1
            )
        END
    INTO v_quotes_conversion_rate
    FROM quotes
    WHERE user_id = p_user_id
      AND status IN ('accepted', 'rejected', 'expired')
      AND created_at >= CURRENT_DATE - INTERVAL '90 days';

    -- ---- Lead stats ----
    SELECT COUNT(*) INTO v_leads_new_count
    FROM leads
    WHERE user_id = p_user_id AND status = 'new';

    SELECT COUNT(*) INTO v_leads_qualified_count
    FROM leads
    WHERE user_id = p_user_id AND status = 'qualified';

    -- ---- Job queue stats ----
    SELECT COUNT(*) INTO v_jobs_pending_count
    FROM jobs_queue
    WHERE user_id = p_user_id AND status IN ('pending', 'processing');

    SELECT COUNT(*) INTO v_jobs_failed_count
    FROM jobs_queue
    WHERE user_id = p_user_id
      AND status = 'failed'
      AND created_at >= CURRENT_DATE - INTERVAL '24 hours';

    -- ---- Assemble result ----
    v_result := jsonb_build_object(
        'revenue', jsonb_build_object(
            'current_month',    v_revenue_current_month,
            'last_month',       v_revenue_last_month,
            'ytd',              v_revenue_ytd,
            'mom_change_pct',   CASE
                                    WHEN v_revenue_last_month = 0 THEN NULL
                                    ELSE ROUND((v_revenue_current_month - v_revenue_last_month)
                                         / v_revenue_last_month * 100, 1)
                                END
        ),
        'invoices', jsonb_build_object(
            'open_count',           v_invoices_open_count,
            'overdue_count',        v_invoices_overdue_count,
            'draft_count',          v_invoices_draft_count,
            'pending_approval',     v_invoices_pending_approval,
            'total_outstanding',    v_invoices_total_outstanding
        ),
        'orders', jsonb_build_object(
            'active_count',         v_orders_active_count,
            'pending_count',        v_orders_pending_count,
            'completed_this_month', v_orders_completed_month
        ),
        'quotes', jsonb_build_object(
            'open_count',           v_quotes_open_count,
            'conversion_rate_pct',  v_quotes_conversion_rate
        ),
        'leads', jsonb_build_object(
            'new_count',            v_leads_new_count,
            'qualified_count',      v_leads_qualified_count
        ),
        'jobs', jsonb_build_object(
            'pending_count',        v_jobs_pending_count,
            'failed_last_24h',      v_jobs_failed_count
        ),
        'generated_at', NOW()
    );

    RETURN v_result;
END;
$$;

COMMENT ON FUNCTION get_dashboard_stats IS
    'Returns a JSONB object with all key KPIs for the FreyAI dashboard. '
    'Call as: SELECT get_dashboard_stats(auth.uid());';

GRANT EXECUTE ON FUNCTION get_dashboard_stats TO authenticated;

-- ============================================================
-- FUNCTION: match_payment_to_invoice
-- Fuzzy-matches a bank transaction (amount + reference text)
-- to open invoices for a given user.
-- Returns matches ranked by confidence score (0.0–1.0).
-- ============================================================
CREATE OR REPLACE FUNCTION match_payment_to_invoice(
    p_user_id   UUID,
    p_amount    NUMERIC,
    p_reference TEXT
)
RETURNS TABLE (
    invoice_id          UUID,
    invoice_number      TEXT,
    customer_name       TEXT,
    invoice_total       NUMERIC,
    invoice_due_date    DATE,
    invoice_status      TEXT,
    amount_diff         NUMERIC,
    reference_similarity REAL,
    confidence_score    REAL
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_tolerance NUMERIC := 0.01; -- 1 cent tolerance for rounding
BEGIN
    RETURN QUERY
    SELECT
        i.id                                                AS invoice_id,
        i.invoice_number,
        COALESCE(c.company_name, c.contact_name)           AS customer_name,
        i.total                                            AS invoice_total,
        i.due_date                                         AS invoice_due_date,
        i.status::TEXT                                     AS invoice_status,
        ABS(i.total - p_amount)                            AS amount_diff,
        -- Trigram similarity between reference text and invoice number / customer name
        GREATEST(
            similarity(UPPER(p_reference), UPPER(i.invoice_number)),
            similarity(UPPER(p_reference), UPPER(COALESCE(c.company_name, c.contact_name, '')))
        )                                                  AS reference_similarity,
        -- Composite confidence: 60% weight on amount match, 40% on text similarity
        (
            CASE
                WHEN ABS(i.total - p_amount) <= v_tolerance THEN 0.60
                WHEN ABS(i.total - p_amount) <= 1.00        THEN 0.40
                WHEN ABS(i.total - p_amount) <= 10.00       THEN 0.20
                ELSE 0.0
            END
            +
            0.40 * GREATEST(
                similarity(UPPER(p_reference), UPPER(i.invoice_number)),
                similarity(UPPER(p_reference), UPPER(COALESCE(c.company_name, c.contact_name, '')))
            )
        )::REAL                                            AS confidence_score
    FROM invoices i
    JOIN customers c ON c.id = i.customer_id
    WHERE i.user_id = p_user_id
      AND i.status IN ('sent', 'overdue')
      -- Only consider invoices within 3x the amount (handles partial payments)
      AND i.total BETWEEN p_amount * 0.1 AND p_amount * 3.0
    ORDER BY confidence_score DESC, amount_diff ASC
    LIMIT 10;
END;
$$;

COMMENT ON FUNCTION match_payment_to_invoice IS
    'Fuzzy-match a bank transaction to open invoices. '
    'Requires pg_trgm extension for similarity(). '
    'Returns up to 10 candidates ranked by confidence_score (0.0–1.0).';

-- Enable pg_trgm for fuzzy matching (safe to run multiple times)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

GRANT EXECUTE ON FUNCTION match_payment_to_invoice TO authenticated;
GRANT EXECUTE ON FUNCTION match_payment_to_invoice TO service_role;

-- ============================================================
-- FUNCTION: check_overdue_invoices
-- Returns all invoices that are past their due_date and still
-- in 'sent' status. Also auto-updates their status to 'overdue'.
-- Called by dunning_check jobs and the check-overdue Edge Function.
-- ============================================================
CREATE OR REPLACE FUNCTION check_overdue_invoices(p_user_id UUID)
RETURNS TABLE (
    invoice_id      UUID,
    invoice_number  TEXT,
    customer_name   TEXT,
    customer_email  TEXT,
    total           NUMERIC,
    due_date        DATE,
    days_overdue    INTEGER,
    status          TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- First: update status to 'overdue' for any sent invoices past due
    UPDATE invoices
    SET status     = 'overdue',
        updated_at = NOW()
    WHERE user_id = p_user_id
      AND status  = 'sent'
      AND due_date < CURRENT_DATE;

    -- Then: return all overdue invoices with customer info
    RETURN QUERY
    SELECT
        i.id                                                 AS invoice_id,
        i.invoice_number,
        COALESCE(c.company_name, c.contact_name)            AS customer_name,
        c.email                                              AS customer_email,
        i.total,
        i.due_date,
        (CURRENT_DATE - i.due_date)::INTEGER                 AS days_overdue,
        i.status::TEXT
    FROM invoices i
    JOIN customers c ON c.id = i.customer_id
    WHERE i.user_id = p_user_id
      AND i.status  = 'overdue'
    ORDER BY i.due_date ASC;
END;
$$;

COMMENT ON FUNCTION check_overdue_invoices IS
    'Marks sent invoices as overdue if past due_date, '
    'then returns all overdue invoices with days_overdue for dunning workflow.';

GRANT EXECUTE ON FUNCTION check_overdue_invoices TO authenticated;
GRANT EXECUTE ON FUNCTION check_overdue_invoices TO service_role;

-- ============================================================
-- FUNCTION: get_stock_alerts
-- Returns materials below their reorder threshold.
-- Called by stock_alert job type.
-- ============================================================
CREATE OR REPLACE FUNCTION get_stock_alerts(p_user_id UUID)
RETURNS TABLE (
    material_id         UUID,
    material_name       TEXT,
    sku                 TEXT,
    stock_quantity      NUMERIC,
    reorder_threshold   NUMERIC,
    deficit             NUMERIC,
    unit                TEXT,
    supplier            TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        m.id                AS material_id,
        m.name              AS material_name,
        m.sku,
        m.stock_quantity,
        m.reorder_threshold,
        (m.reorder_threshold - m.stock_quantity) AS deficit,
        m.unit,
        m.supplier
    FROM materials m
    WHERE m.user_id = p_user_id
      AND m.stock_quantity <= m.reorder_threshold
    ORDER BY deficit DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_stock_alerts TO authenticated;
GRANT EXECUTE ON FUNCTION get_stock_alerts TO service_role;

-- ============================================================
-- FUNCTION: update_stock_on_warehouse_entry
-- Trigger function: when a warehouse_entry is inserted,
-- automatically increment material stock_quantity.
-- ============================================================
CREATE OR REPLACE FUNCTION update_stock_on_warehouse_entry()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE materials
    SET stock_quantity = stock_quantity + NEW.quantity,
        updated_at     = NOW()
    WHERE id = NEW.material_id;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_warehouse_entry_update_stock
    AFTER INSERT ON warehouse_entries
    FOR EACH ROW EXECUTE FUNCTION update_stock_on_warehouse_entry();

COMMENT ON TRIGGER trg_warehouse_entry_update_stock ON warehouse_entries IS
    'Auto-increments material.stock_quantity whenever a warehouse_entry is inserted.';

-- ============================================================
-- FUNCTION: auto_mark_invoice_overdue
-- Scheduled trigger placeholder — can be called by a cron job
-- or the check-overdue Edge Function on a schedule.
-- Marks all sent invoices with past due_date as overdue
-- across ALL users (for background maintenance).
-- Must be called by service_role.
-- ============================================================
CREATE OR REPLACE FUNCTION auto_mark_all_overdue_invoices()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_updated INTEGER;
BEGIN
    UPDATE invoices
    SET status     = 'overdue',
        updated_at = NOW()
    WHERE status   = 'sent'
      AND due_date < CURRENT_DATE;

    GET DIAGNOSTICS v_updated = ROW_COUNT;
    RETURN v_updated;
END;
$$;

COMMENT ON FUNCTION auto_mark_all_overdue_invoices IS
    'Maintenance function — marks all past-due sent invoices as overdue. '
    'Call from a scheduled Edge Function or pg_cron job. '
    'Returns count of updated rows.';

GRANT EXECUTE ON FUNCTION auto_mark_all_overdue_invoices TO service_role;

-- ============================================================
-- FUNCTION: get_revenue_by_month
-- Returns monthly revenue breakdown for charts.
-- ============================================================
CREATE OR REPLACE FUNCTION get_revenue_by_month(
    p_user_id UUID,
    p_months  INTEGER DEFAULT 12
)
RETURNS TABLE (
    month       DATE,
    revenue     NUMERIC,
    invoice_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        DATE_TRUNC('month', paid_date)::DATE AS month,
        SUM(total)::NUMERIC                  AS revenue,
        COUNT(*)::INTEGER                    AS invoice_count
    FROM invoices
    WHERE user_id = p_user_id
      AND status  = 'paid'
      AND paid_date >= (CURRENT_DATE - (p_months || ' months')::INTERVAL)
    GROUP BY DATE_TRUNC('month', paid_date)
    ORDER BY month ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_revenue_by_month TO authenticated;

-- ============================================================
-- ENSURE updated_at triggers exist on all relevant tables
-- (some may already exist from migration 001, CREATE OR REPLACE
-- handles idempotency at the function level; triggers are
-- created only if not already present)
-- ============================================================

-- Drop and recreate to ensure idempotency across re-runs
DO $$
DECLARE
    tbl  TEXT;
    trgs TEXT[];
BEGIN
    -- Tables that need updated_at triggers
    -- (leads and time_entries have no updated_at column — skip)
    trgs := ARRAY[
        'customers',
        'quotes',
        'orders',
        'invoices',
        'materials',
        'company_settings'
    ];

    FOREACH tbl IN ARRAY trgs LOOP
        -- Check trigger exists; if not, create it
        IF NOT EXISTS (
            SELECT 1 FROM pg_trigger t
            JOIN pg_class c ON c.oid = t.tgrelid
            WHERE c.relname = tbl
              AND t.tgname = 'trg_' || tbl || '_updated_at'
        ) THEN
            EXECUTE format(
                'CREATE TRIGGER trg_%I_updated_at
                 BEFORE UPDATE ON %I
                 FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()',
                tbl, tbl
            );
        END IF;
    END LOOP;
END;
$$;

-- jobs_queue trigger also needs to be guaranteed
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger t
        JOIN pg_class c ON c.oid = t.tgrelid
        WHERE c.relname = 'jobs_queue'
          AND t.tgname = 'trg_jobs_queue_updated_at'
    ) THEN
        CREATE TRIGGER trg_jobs_queue_updated_at
            BEFORE UPDATE ON jobs_queue
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END;
$$;
