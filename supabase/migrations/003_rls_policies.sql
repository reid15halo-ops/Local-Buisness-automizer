-- ============================================================
-- FreyAI Visions 95/5 Architecture — Zone 1
-- Migration 003: Comprehensive RLS Policies
-- ============================================================
-- Pattern rules:
--   1. Authenticated users: auth.uid() = user_id — full CRUD on own rows
--   2. Service role (n8n / Edge Functions): auth.role() = 'service_role' bypass
--   3. Separate policies per operation (SELECT / INSERT / UPDATE / DELETE)
--      for clarity and auditability
-- ============================================================

-- ============================================================
-- Helper: service_role bypass check
-- Used in every policy to allow n8n workers to write on behalf
-- of users without impersonating them.
-- ============================================================
-- NOTE: We use auth.role() = 'service_role' as the bypass
-- because Supabase sets this automatically when service_role
-- JWT is presented. The current_setting('app.bypass_rls') pattern
-- is also supported as a secondary check for custom GUC-based bypass.
-- ============================================================

-- ============================================================
-- CUSTOMERS
-- ============================================================
DROP POLICY IF EXISTS "customers_select_own"   ON customers;
DROP POLICY IF EXISTS "customers_insert_own"   ON customers;
DROP POLICY IF EXISTS "customers_update_own"   ON customers;
DROP POLICY IF EXISTS "customers_delete_own"   ON customers;
DROP POLICY IF EXISTS "customers_service_role" ON customers;

CREATE POLICY "customers_select_own"
    ON customers FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "customers_insert_own"
    ON customers FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "customers_update_own"
    ON customers FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "customers_delete_own"
    ON customers FOR DELETE
    USING (auth.uid() = user_id);

CREATE POLICY "customers_service_role"
    ON customers FOR ALL
    USING (
        auth.role() = 'service_role'
        OR (
            current_setting('app.bypass_rls', true) IS NOT NULL
            AND current_setting('app.bypass_rls', true)::boolean = true
        )
    )
    WITH CHECK (
        auth.role() = 'service_role'
        OR (
            current_setting('app.bypass_rls', true) IS NOT NULL
            AND current_setting('app.bypass_rls', true)::boolean = true
        )
    );

-- ============================================================
-- LEADS
-- ============================================================
DROP POLICY IF EXISTS "leads_select_own"   ON leads;
DROP POLICY IF EXISTS "leads_insert_own"   ON leads;
DROP POLICY IF EXISTS "leads_update_own"   ON leads;
DROP POLICY IF EXISTS "leads_delete_own"   ON leads;
DROP POLICY IF EXISTS "leads_service_role" ON leads;

CREATE POLICY "leads_select_own"
    ON leads FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "leads_insert_own"
    ON leads FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "leads_update_own"
    ON leads FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "leads_delete_own"
    ON leads FOR DELETE
    USING (auth.uid() = user_id);

CREATE POLICY "leads_service_role"
    ON leads FOR ALL
    USING (
        auth.role() = 'service_role'
        OR (
            current_setting('app.bypass_rls', true) IS NOT NULL
            AND current_setting('app.bypass_rls', true)::boolean = true
        )
    )
    WITH CHECK (
        auth.role() = 'service_role'
        OR (
            current_setting('app.bypass_rls', true) IS NOT NULL
            AND current_setting('app.bypass_rls', true)::boolean = true
        )
    );

-- ============================================================
-- QUOTES
-- ============================================================
DROP POLICY IF EXISTS "quotes_select_own"   ON quotes;
DROP POLICY IF EXISTS "quotes_insert_own"   ON quotes;
DROP POLICY IF EXISTS "quotes_update_own"   ON quotes;
DROP POLICY IF EXISTS "quotes_delete_own"   ON quotes;
DROP POLICY IF EXISTS "quotes_service_role" ON quotes;

CREATE POLICY "quotes_select_own"
    ON quotes FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "quotes_insert_own"
    ON quotes FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "quotes_update_own"
    ON quotes FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "quotes_delete_own"
    ON quotes FOR DELETE
    USING (auth.uid() = user_id);

CREATE POLICY "quotes_service_role"
    ON quotes FOR ALL
    USING (
        auth.role() = 'service_role'
        OR (
            current_setting('app.bypass_rls', true) IS NOT NULL
            AND current_setting('app.bypass_rls', true)::boolean = true
        )
    )
    WITH CHECK (
        auth.role() = 'service_role'
        OR (
            current_setting('app.bypass_rls', true) IS NOT NULL
            AND current_setting('app.bypass_rls', true)::boolean = true
        )
    );

-- ============================================================
-- ORDERS
-- ============================================================
DROP POLICY IF EXISTS "orders_select_own"   ON orders;
DROP POLICY IF EXISTS "orders_insert_own"   ON orders;
DROP POLICY IF EXISTS "orders_update_own"   ON orders;
DROP POLICY IF EXISTS "orders_delete_own"   ON orders;
DROP POLICY IF EXISTS "orders_service_role" ON orders;

CREATE POLICY "orders_select_own"
    ON orders FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "orders_insert_own"
    ON orders FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "orders_update_own"
    ON orders FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "orders_delete_own"
    ON orders FOR DELETE
    USING (auth.uid() = user_id);

CREATE POLICY "orders_service_role"
    ON orders FOR ALL
    USING (
        auth.role() = 'service_role'
        OR (
            current_setting('app.bypass_rls', true) IS NOT NULL
            AND current_setting('app.bypass_rls', true)::boolean = true
        )
    )
    WITH CHECK (
        auth.role() = 'service_role'
        OR (
            current_setting('app.bypass_rls', true) IS NOT NULL
            AND current_setting('app.bypass_rls', true)::boolean = true
        )
    );

-- ============================================================
-- INVOICES
-- ============================================================
DROP POLICY IF EXISTS "invoices_select_own"   ON invoices;
DROP POLICY IF EXISTS "invoices_insert_own"   ON invoices;
DROP POLICY IF EXISTS "invoices_update_own"   ON invoices;
DROP POLICY IF EXISTS "invoices_delete_own"   ON invoices;
DROP POLICY IF EXISTS "invoices_service_role" ON invoices;

CREATE POLICY "invoices_select_own"
    ON invoices FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "invoices_insert_own"
    ON invoices FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "invoices_update_own"
    ON invoices FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "invoices_delete_own"
    ON invoices FOR DELETE
    USING (auth.uid() = user_id);

CREATE POLICY "invoices_service_role"
    ON invoices FOR ALL
    USING (
        auth.role() = 'service_role'
        OR (
            current_setting('app.bypass_rls', true) IS NOT NULL
            AND current_setting('app.bypass_rls', true)::boolean = true
        )
    )
    WITH CHECK (
        auth.role() = 'service_role'
        OR (
            current_setting('app.bypass_rls', true) IS NOT NULL
            AND current_setting('app.bypass_rls', true)::boolean = true
        )
    );

-- ============================================================
-- COMMUNICATIONS
-- ============================================================
DROP POLICY IF EXISTS "communications_select_own"   ON communications;
DROP POLICY IF EXISTS "communications_insert_own"   ON communications;
DROP POLICY IF EXISTS "communications_update_own"   ON communications;
DROP POLICY IF EXISTS "communications_delete_own"   ON communications;
DROP POLICY IF EXISTS "communications_service_role" ON communications;

CREATE POLICY "communications_select_own"
    ON communications FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "communications_insert_own"
    ON communications FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "communications_update_own"
    ON communications FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "communications_delete_own"
    ON communications FOR DELETE
    USING (auth.uid() = user_id);

CREATE POLICY "communications_service_role"
    ON communications FOR ALL
    USING (
        auth.role() = 'service_role'
        OR (
            current_setting('app.bypass_rls', true) IS NOT NULL
            AND current_setting('app.bypass_rls', true)::boolean = true
        )
    )
    WITH CHECK (
        auth.role() = 'service_role'
        OR (
            current_setting('app.bypass_rls', true) IS NOT NULL
            AND current_setting('app.bypass_rls', true)::boolean = true
        )
    );

-- ============================================================
-- MATERIALS
-- ============================================================
DROP POLICY IF EXISTS "materials_select_own"   ON materials;
DROP POLICY IF EXISTS "materials_insert_own"   ON materials;
DROP POLICY IF EXISTS "materials_update_own"   ON materials;
DROP POLICY IF EXISTS "materials_delete_own"   ON materials;
DROP POLICY IF EXISTS "materials_service_role" ON materials;

CREATE POLICY "materials_select_own"
    ON materials FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "materials_insert_own"
    ON materials FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "materials_update_own"
    ON materials FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "materials_delete_own"
    ON materials FOR DELETE
    USING (auth.uid() = user_id);

CREATE POLICY "materials_service_role"
    ON materials FOR ALL
    USING (
        auth.role() = 'service_role'
        OR (
            current_setting('app.bypass_rls', true) IS NOT NULL
            AND current_setting('app.bypass_rls', true)::boolean = true
        )
    )
    WITH CHECK (
        auth.role() = 'service_role'
        OR (
            current_setting('app.bypass_rls', true) IS NOT NULL
            AND current_setting('app.bypass_rls', true)::boolean = true
        )
    );

-- ============================================================
-- WAREHOUSE_ENTRIES
-- ============================================================
DROP POLICY IF EXISTS "warehouse_entries_select_own"   ON warehouse_entries;
DROP POLICY IF EXISTS "warehouse_entries_insert_own"   ON warehouse_entries;
DROP POLICY IF EXISTS "warehouse_entries_update_own"   ON warehouse_entries;
DROP POLICY IF EXISTS "warehouse_entries_delete_own"   ON warehouse_entries;
DROP POLICY IF EXISTS "warehouse_entries_service_role" ON warehouse_entries;

CREATE POLICY "warehouse_entries_select_own"
    ON warehouse_entries FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "warehouse_entries_insert_own"
    ON warehouse_entries FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "warehouse_entries_update_own"
    ON warehouse_entries FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "warehouse_entries_delete_own"
    ON warehouse_entries FOR DELETE
    USING (auth.uid() = user_id);

CREATE POLICY "warehouse_entries_service_role"
    ON warehouse_entries FOR ALL
    USING (
        auth.role() = 'service_role'
        OR (
            current_setting('app.bypass_rls', true) IS NOT NULL
            AND current_setting('app.bypass_rls', true)::boolean = true
        )
    )
    WITH CHECK (
        auth.role() = 'service_role'
        OR (
            current_setting('app.bypass_rls', true) IS NOT NULL
            AND current_setting('app.bypass_rls', true)::boolean = true
        )
    );

-- ============================================================
-- TIME_ENTRIES
-- ============================================================
DROP POLICY IF EXISTS "time_entries_select_own"   ON time_entries;
DROP POLICY IF EXISTS "time_entries_insert_own"   ON time_entries;
DROP POLICY IF EXISTS "time_entries_update_own"   ON time_entries;
DROP POLICY IF EXISTS "time_entries_delete_own"   ON time_entries;
DROP POLICY IF EXISTS "time_entries_service_role" ON time_entries;

CREATE POLICY "time_entries_select_own"
    ON time_entries FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "time_entries_insert_own"
    ON time_entries FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "time_entries_update_own"
    ON time_entries FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "time_entries_delete_own"
    ON time_entries FOR DELETE
    USING (auth.uid() = user_id);

CREATE POLICY "time_entries_service_role"
    ON time_entries FOR ALL
    USING (
        auth.role() = 'service_role'
        OR (
            current_setting('app.bypass_rls', true) IS NOT NULL
            AND current_setting('app.bypass_rls', true)::boolean = true
        )
    )
    WITH CHECK (
        auth.role() = 'service_role'
        OR (
            current_setting('app.bypass_rls', true) IS NOT NULL
            AND current_setting('app.bypass_rls', true)::boolean = true
        )
    );

-- ============================================================
-- COMPANY_SETTINGS
-- ============================================================
DROP POLICY IF EXISTS "company_settings_select_own"   ON company_settings;
DROP POLICY IF EXISTS "company_settings_insert_own"   ON company_settings;
DROP POLICY IF EXISTS "company_settings_update_own"   ON company_settings;
DROP POLICY IF EXISTS "company_settings_delete_own"   ON company_settings;
DROP POLICY IF EXISTS "company_settings_service_role" ON company_settings;

CREATE POLICY "company_settings_select_own"
    ON company_settings FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "company_settings_insert_own"
    ON company_settings FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "company_settings_update_own"
    ON company_settings FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "company_settings_delete_own"
    ON company_settings FOR DELETE
    USING (auth.uid() = user_id);

CREATE POLICY "company_settings_service_role"
    ON company_settings FOR ALL
    USING (
        auth.role() = 'service_role'
        OR (
            current_setting('app.bypass_rls', true) IS NOT NULL
            AND current_setting('app.bypass_rls', true)::boolean = true
        )
    )
    WITH CHECK (
        auth.role() = 'service_role'
        OR (
            current_setting('app.bypass_rls', true) IS NOT NULL
            AND current_setting('app.bypass_rls', true)::boolean = true
        )
    );

-- ============================================================
-- REALTIME: enable all business tables
-- (jobs_queue and notifications already added in migration 002)
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE customers;
ALTER PUBLICATION supabase_realtime ADD TABLE leads;
ALTER PUBLICATION supabase_realtime ADD TABLE quotes;
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE invoices;
ALTER PUBLICATION supabase_realtime ADD TABLE communications;
ALTER PUBLICATION supabase_realtime ADD TABLE materials;
ALTER PUBLICATION supabase_realtime ADD TABLE warehouse_entries;
ALTER PUBLICATION supabase_realtime ADD TABLE time_entries;
ALTER PUBLICATION supabase_realtime ADD TABLE company_settings;
