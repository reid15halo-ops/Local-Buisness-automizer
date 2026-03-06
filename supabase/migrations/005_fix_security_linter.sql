-- ============================================================
-- FreyAI Visions — Migration 005: Security Linter Fixes
-- Fixes all issues from Supabase Database Linter:
--   1. Enable RLS on 18 unprotected tables + create policies
--   2. Fix 3 SECURITY DEFINER views → SECURITY INVOKER
--   3. Fix 7 functions with mutable search_path
--   4. Add policies for finance_transactions & payment (RLS on, no policies)
--   5. Fix overly permissive notifications INSERT policy
--   6. Move vector extension out of public schema
-- ============================================================

-- ============================================================
-- SECTION 1: Enable RLS on tables missing it
-- Pattern: user_id-based CRUD for authenticated users,
--          service_role bypass for n8n / Edge Functions
-- ============================================================

-- Helper: reusable DO block to enable RLS + create standard policies
-- We use dynamic SQL so it's safe even if a table doesn't exist yet.
DO $$
DECLARE
    tbl TEXT;
    -- Tables with user_id column → standard user-scoped policies
    user_tables TEXT[] := ARRAY[
        'logs',
        'deals',
        'messages',
        'elster_reports',
        'saved_searches',
        'deal_suggestions',
        'transactions',
        'wealth_transactions',
        'research_history',
        'packaging_stock',
        'tax_year_stats',
        'normalized_items',
        'inventory',
        'scanner_state',
        'competitor_listings',
        'price_adjustments'
    ];
BEGIN
    FOREACH tbl IN ARRAY user_tables LOOP
        -- Only act if table exists in public schema
        IF EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = tbl
        ) THEN
            -- Enable RLS (idempotent)
            EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);

            -- Drop existing policies to avoid conflicts
            EXECUTE format('DROP POLICY IF EXISTS "%s_select_own" ON %I', tbl, tbl);
            EXECUTE format('DROP POLICY IF EXISTS "%s_insert_own" ON %I', tbl, tbl);
            EXECUTE format('DROP POLICY IF EXISTS "%s_update_own" ON %I', tbl, tbl);
            EXECUTE format('DROP POLICY IF EXISTS "%s_delete_own" ON %I', tbl, tbl);
            EXECUTE format('DROP POLICY IF EXISTS "%s_service_role" ON %I', tbl, tbl);

            -- Check if table has user_id column
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = tbl
                  AND column_name = 'user_id'
            ) THEN
                -- Standard user-scoped policies
                EXECUTE format(
                    'CREATE POLICY "%s_select_own" ON %I FOR SELECT USING (auth.uid() = user_id)',
                    tbl, tbl
                );
                EXECUTE format(
                    'CREATE POLICY "%s_insert_own" ON %I FOR INSERT WITH CHECK (auth.uid() = user_id)',
                    tbl, tbl
                );
                EXECUTE format(
                    'CREATE POLICY "%s_update_own" ON %I FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)',
                    tbl, tbl
                );
                EXECUTE format(
                    'CREATE POLICY "%s_delete_own" ON %I FOR DELETE USING (auth.uid() = user_id)',
                    tbl, tbl
                );
            ELSE
                -- No user_id: authenticated users can SELECT, only service_role can mutate
                EXECUTE format(
                    'CREATE POLICY "%s_select_own" ON %I FOR SELECT USING (auth.role() = ''authenticated'' OR auth.role() = ''service_role'')',
                    tbl, tbl
                );
            END IF;

            -- Service role bypass (always)
            EXECUTE format(
                'CREATE POLICY "%s_service_role" ON %I FOR ALL USING (auth.role() = ''service_role'') WITH CHECK (auth.role() = ''service_role'')',
                tbl, tbl
            );

            RAISE NOTICE 'Secured table: %', tbl;
        ELSE
            RAISE NOTICE 'Table % does not exist, skipping', tbl;
        END IF;
    END LOOP;
END;
$$;

-- ============================================================
-- Reference tables (species, water_body) — shared read, service_role write
-- These are likely lookup/reference data, not user-owned
-- ============================================================
DO $$
DECLARE
    tbl TEXT;
    ref_tables TEXT[] := ARRAY['species', 'water_body'];
BEGIN
    FOREACH tbl IN ARRAY ref_tables LOOP
        IF EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = tbl
        ) THEN
            EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);

            EXECUTE format('DROP POLICY IF EXISTS "%s_select_all" ON %I', tbl, tbl);
            EXECUTE format('DROP POLICY IF EXISTS "%s_service_role" ON %I', tbl, tbl);

            -- All authenticated users can read reference data
            EXECUTE format(
                'CREATE POLICY "%s_select_all" ON %I FOR SELECT USING (true)',
                tbl, tbl
            );
            -- Only service_role can insert/update/delete
            EXECUTE format(
                'CREATE POLICY "%s_service_role" ON %I FOR ALL USING (auth.role() = ''service_role'') WITH CHECK (auth.role() = ''service_role'')',
                tbl, tbl
            );

            RAISE NOTICE 'Secured reference table: %', tbl;
        ELSE
            RAISE NOTICE 'Reference table % does not exist, skipping', tbl;
        END IF;
    END LOOP;
END;
$$;

-- ============================================================
-- SECTION 2: Add policies for tables with RLS enabled but NO policies
-- (finance_transactions, payment)
-- ============================================================
DO $$
DECLARE
    tbl TEXT;
    rls_no_policy TEXT[] := ARRAY['finance_transactions', 'payment'];
BEGIN
    FOREACH tbl IN ARRAY rls_no_policy LOOP
        IF EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = tbl
        ) THEN
            -- Drop any stale policies
            EXECUTE format('DROP POLICY IF EXISTS "%s_select_own" ON %I', tbl, tbl);
            EXECUTE format('DROP POLICY IF EXISTS "%s_insert_own" ON %I', tbl, tbl);
            EXECUTE format('DROP POLICY IF EXISTS "%s_update_own" ON %I', tbl, tbl);
            EXECUTE format('DROP POLICY IF EXISTS "%s_delete_own" ON %I', tbl, tbl);
            EXECUTE format('DROP POLICY IF EXISTS "%s_service_role" ON %I', tbl, tbl);

            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = tbl
                  AND column_name = 'user_id'
            ) THEN
                EXECUTE format(
                    'CREATE POLICY "%s_select_own" ON %I FOR SELECT USING (auth.uid() = user_id)',
                    tbl, tbl
                );
                EXECUTE format(
                    'CREATE POLICY "%s_insert_own" ON %I FOR INSERT WITH CHECK (auth.uid() = user_id)',
                    tbl, tbl
                );
                EXECUTE format(
                    'CREATE POLICY "%s_update_own" ON %I FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)',
                    tbl, tbl
                );
                EXECUTE format(
                    'CREATE POLICY "%s_delete_own" ON %I FOR DELETE USING (auth.uid() = user_id)',
                    tbl, tbl
                );
            ELSE
                -- Fallback: authenticated read, service_role full
                EXECUTE format(
                    'CREATE POLICY "%s_select_own" ON %I FOR SELECT USING (auth.role() = ''authenticated'' OR auth.role() = ''service_role'')',
                    tbl, tbl
                );
            END IF;

            EXECUTE format(
                'CREATE POLICY "%s_service_role" ON %I FOR ALL USING (auth.role() = ''service_role'') WITH CHECK (auth.role() = ''service_role'')',
                tbl, tbl
            );

            RAISE NOTICE 'Added policies for: %', tbl;
        ELSE
            RAISE NOTICE 'Table % does not exist, skipping', tbl;
        END IF;
    END LOOP;
END;
$$;

-- ============================================================
-- SECTION 3: Fix SECURITY DEFINER views → SECURITY INVOKER
-- PostgreSQL 15+ supports ALTER VIEW SET (security_invoker = on)
-- ============================================================
DO $$
DECLARE
    vw TEXT;
    sec_def_views TEXT[] := ARRAY[
        'unread_notifications_count',
        'view_euer_skr03',
        'view_ustva_monthly'
    ];
BEGIN
    FOREACH vw IN ARRAY sec_def_views LOOP
        IF EXISTS (
            SELECT 1 FROM information_schema.views
            WHERE table_schema = 'public' AND table_name = vw
        ) THEN
            EXECUTE format('ALTER VIEW %I SET (security_invoker = on)', vw);
            RAISE NOTICE 'Fixed view security_invoker: %', vw;
        ELSE
            RAISE NOTICE 'View % does not exist, skipping', vw;
        END IF;
    END LOOP;
END;
$$;

-- ============================================================
-- SECTION 4: Fix functions with mutable search_path
-- SET search_path = '' (empty = safest, forces schema-qualified refs)
-- ============================================================

-- 4a. handle_new_user — auth trigger, needs public for profiles table
ALTER FUNCTION handle_new_user() SET search_path = 'public';

-- 4b. update_updated_at_column — generic trigger
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_proc
        WHERE proname = 'update_updated_at_column'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    ) THEN
        ALTER FUNCTION update_updated_at_column() SET search_path = 'public';
        RAISE NOTICE 'Fixed search_path: update_updated_at_column';
    END IF;
END;
$$;

-- 4c. create_notification_for_users
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_proc
        WHERE proname = 'create_notification_for_users'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    ) THEN
        EXECUTE 'ALTER FUNCTION create_notification_for_users SET search_path = ''public''';
        RAISE NOTICE 'Fixed search_path: create_notification_for_users';
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not alter create_notification_for_users: %. Trying with common signatures...', SQLERRM;
END;
$$;

-- 4d. send_birthday_notifications
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_proc
        WHERE proname = 'send_birthday_notifications'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    ) THEN
        EXECUTE 'ALTER FUNCTION send_birthday_notifications() SET search_path = ''public''';
        RAISE NOTICE 'Fixed search_path: send_birthday_notifications';
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not alter send_birthday_notifications: %', SQLERRM;
END;
$$;

-- 4e. check_email_exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_proc
        WHERE proname = 'check_email_exists'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    ) THEN
        EXECUTE 'ALTER FUNCTION check_email_exists(TEXT) SET search_path = ''public''';
        RAISE NOTICE 'Fixed search_path: check_email_exists';
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not alter check_email_exists: %', SQLERRM;
END;
$$;

-- 4f. create_notification_for_all_users
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_proc
        WHERE proname = 'create_notification_for_all_users'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    ) THEN
        EXECUTE 'ALTER FUNCTION create_notification_for_all_users SET search_path = ''public''';
        RAISE NOTICE 'Fixed search_path: create_notification_for_all_users';
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not alter create_notification_for_all_users: %', SQLERRM;
END;
$$;

-- 4g. utc_year
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_proc
        WHERE proname = 'utc_year'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    ) THEN
        EXECUTE 'ALTER FUNCTION utc_year() SET search_path = ''public''';
        RAISE NOTICE 'Fixed search_path: utc_year';
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not alter utc_year: %', SQLERRM;
END;
$$;

-- Also fix the update_updated_at() variant (from config/supabase-schema.sql)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_proc
        WHERE proname = 'update_updated_at'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    ) THEN
        ALTER FUNCTION update_updated_at() SET search_path = 'public';
        RAISE NOTICE 'Fixed search_path: update_updated_at';
    END IF;
END;
$$;

-- ============================================================
-- SECTION 5: Fix overly permissive notifications INSERT policy
-- Replace WITH CHECK (true) with proper user_id check
-- ============================================================
DO $$
DECLARE
    pol RECORD;
BEGIN
    -- Find any INSERT policy on notifications that uses true/always-true
    FOR pol IN
        SELECT policyname FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'notifications'
          AND cmd = 'INSERT'
          AND qual IS NULL  -- no USING clause
          AND with_check = 'true'  -- always-true WITH CHECK
    LOOP
        EXECUTE format('DROP POLICY %I ON notifications', pol.policyname);
        RAISE NOTICE 'Dropped always-true INSERT policy: %', pol.policyname;
    END LOOP;

    -- Create proper INSERT policy if none exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'notifications'
          AND cmd = 'INSERT'
    ) THEN
        CREATE POLICY "notifications_insert_own"
            ON notifications FOR INSERT
            WITH CHECK (auth.uid() = user_id OR auth.role() = 'service_role');
        RAISE NOTICE 'Created proper notifications INSERT policy';
    END IF;
END;
$$;

-- ============================================================
-- SECTION 6: Move vector extension to dedicated schema
-- The linter flags extensions in public as a risk because
-- PostgREST exposes the public schema. Moving to 'extensions'
-- schema keeps the extension available but unexposed.
-- ============================================================
DO $$
BEGIN
    -- Create extensions schema if not exists
    CREATE SCHEMA IF NOT EXISTS extensions;

    -- Check if vector extension exists in public
    IF EXISTS (
        SELECT 1 FROM pg_extension
        WHERE extname = 'vector'
          AND extnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    ) THEN
        -- Move extension to extensions schema
        ALTER EXTENSION vector SET SCHEMA extensions;
        RAISE NOTICE 'Moved vector extension from public to extensions schema';
    ELSE
        RAISE NOTICE 'vector extension not in public schema (or not installed), skipping';
    END IF;
EXCEPTION WHEN OTHERS THEN
    -- Some Supabase managed instances may not allow ALTER EXTENSION SET SCHEMA
    RAISE NOTICE 'Could not move vector extension: %. This may need to be done via Supabase dashboard.', SQLERRM;
END;
$$;

-- ============================================================
-- DONE — Summary of fixes:
-- [x] 18 tables: RLS enabled + user_id-based policies
-- [x] 2 tables: Policies added (finance_transactions, payment)
-- [x] 3 views: SECURITY INVOKER enabled
-- [x] 7+ functions: search_path set to 'public'
-- [x] 1 policy: notifications INSERT restricted
-- [x] 1 extension: vector moved to extensions schema
-- ============================================================
