-- ============================================
-- Multi-Tenant Migration Part 2
-- (tenants table already exists from Part 1)
-- Paste into: Supabase Dashboard > SQL Editor > New Query > Run
-- ============================================

-- 1. Add tenant_id to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';
CREATE INDEX IF NOT EXISTS idx_profiles_tenant ON profiles(tenant_id);

-- 2. Helper function
CREATE OR REPLACE FUNCTION get_my_tenant_id()
RETURNS UUID AS $$
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 3. Add tenant_id to ALL business tables
ALTER TABLE kunden ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE anfragen ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE angebote ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE auftraege ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE rechnungen ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE buchungen ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE materialien ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE aufgaben ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE termine ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE zeiteintraege ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE dokumente ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE material_reservations ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE communication_log ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE automation_log ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE inbound_emails ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_kunden_tenant ON kunden(tenant_id);
CREATE INDEX IF NOT EXISTS idx_anfragen_tenant ON anfragen(tenant_id);
CREATE INDEX IF NOT EXISTS idx_angebote_tenant ON angebote(tenant_id);
CREATE INDEX IF NOT EXISTS idx_auftraege_tenant ON auftraege(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rechnungen_tenant ON rechnungen(tenant_id);
CREATE INDEX IF NOT EXISTS idx_buchungen_tenant ON buchungen(tenant_id);
CREATE INDEX IF NOT EXISTS idx_materialien_tenant ON materialien(tenant_id);
CREATE INDEX IF NOT EXISTS idx_aufgaben_tenant ON aufgaben(tenant_id);
CREATE INDEX IF NOT EXISTS idx_termine_tenant ON termine(tenant_id);
CREATE INDEX IF NOT EXISTS idx_zeiteintraege_tenant ON zeiteintraege(tenant_id);
CREATE INDEX IF NOT EXISTS idx_dokumente_tenant ON dokumente(tenant_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_tenant ON purchase_orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_tenant ON stock_movements(tenant_id);
CREATE INDEX IF NOT EXISTS idx_material_reservations_tenant ON material_reservations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_tenant ON suppliers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_communication_log_tenant ON communication_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_automation_log_tenant ON automation_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_notifications_tenant ON notifications(tenant_id);
CREATE INDEX IF NOT EXISTS idx_inbound_emails_tenant ON inbound_emails(tenant_id);

-- 5. Tenant read policy
DROP POLICY IF EXISTS "Users can read own tenant" ON tenants;
CREATE POLICY "Users can read own tenant" ON tenants
    FOR SELECT USING (id IN (SELECT tenant_id FROM profiles WHERE profiles.id = auth.uid()));

-- 6. RLS policies (tenant-scoped)
DO $$
DECLARE tbl TEXT;
BEGIN
    FOR tbl IN SELECT unnest(ARRAY[
        'kunden', 'anfragen', 'angebote', 'auftraege', 'rechnungen',
        'buchungen', 'materialien', 'aufgaben', 'termine', 'zeiteintraege',
        'dokumente', 'purchase_orders', 'stock_movements', 'material_reservations',
        'suppliers', 'communication_log'
    ]) LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Users manage own %s" ON %I', tbl, tbl);
        EXECUTE format('DROP POLICY IF EXISTS "Tenant isolation %s" ON %I', tbl, tbl);
        EXECUTE format('CREATE POLICY "Tenant isolation %s" ON %I FOR ALL USING (tenant_id = get_my_tenant_id() OR auth.role() = ''service_role'')', tbl, tbl);
    END LOOP;
END $$;

-- 7. Special policies
DROP POLICY IF EXISTS "Users see own automation logs" ON automation_log;
DROP POLICY IF EXISTS "Edge functions can insert logs" ON automation_log;
DROP POLICY IF EXISTS "Tenant reads automation_log" ON automation_log;
DROP POLICY IF EXISTS "Edge functions insert automation_log" ON automation_log;
CREATE POLICY "Tenant reads automation_log" ON automation_log FOR SELECT USING (tenant_id = get_my_tenant_id() OR auth.role() = 'service_role');
CREATE POLICY "Edge functions insert automation_log" ON automation_log FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users see own notifications" ON notifications;
DROP POLICY IF EXISTS "Edge functions can insert notifications" ON notifications;
DROP POLICY IF EXISTS "Tenant reads notifications" ON notifications;
DROP POLICY IF EXISTS "Edge functions insert notifications" ON notifications;
CREATE POLICY "Tenant reads notifications" ON notifications FOR SELECT USING (tenant_id = get_my_tenant_id() OR auth.role() = 'service_role');
CREATE POLICY "Edge functions insert notifications" ON notifications FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Service role manages inbound_emails" ON inbound_emails;
DROP POLICY IF EXISTS "Tenant reads inbound_emails" ON inbound_emails;
CREATE POLICY "Service role manages inbound_emails" ON inbound_emails FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Tenant reads inbound_emails" ON inbound_emails FOR SELECT USING (tenant_id = get_my_tenant_id());

-- 8. Domain lookup functions
CREATE OR REPLACE FUNCTION get_tenant_by_domain(p_domain TEXT) RETURNS UUID AS $$
    SELECT id FROM tenants WHERE domain = p_domain AND active = TRUE LIMIT 1
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION get_tenant_by_email(p_email TEXT) RETURNS UUID AS $$
    SELECT id FROM tenants WHERE (email_inbound = p_email OR domain = split_part(p_email, '@', 2)) AND active = TRUE LIMIT 1
$$ LANGUAGE sql STABLE;

-- 9. Auto-assign tenant trigger
CREATE OR REPLACE FUNCTION auto_set_tenant_id() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.tenant_id IS NULL THEN NEW.tenant_id := get_my_tenant_id(); END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$
DECLARE tbl TEXT;
BEGIN
    FOR tbl IN SELECT unnest(ARRAY[
        'kunden', 'anfragen', 'angebote', 'auftraege', 'rechnungen',
        'buchungen', 'materialien', 'aufgaben', 'termine', 'zeiteintraege',
        'dokumente', 'purchase_orders', 'stock_movements', 'material_reservations',
        'suppliers', 'communication_log', 'automation_log', 'notifications'
    ]) LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS auto_tenant_%s ON %I', tbl, tbl);
        EXECUTE format('CREATE TRIGGER auto_tenant_%s BEFORE INSERT ON %I FOR EACH ROW EXECUTE FUNCTION auto_set_tenant_id()', tbl, tbl);
    END LOOP;
END $$;

-- 10. Tenants updated_at
DROP TRIGGER IF EXISTS update_tenants_updated_at ON tenants;
CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON tenants FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE FUNCTION reset_daily_email_counters() RETURNS void AS $$
    UPDATE tenants SET emails_sent_today = 0, emails_reset_date = CURRENT_DATE WHERE emails_reset_date < CURRENT_DATE;
$$ LANGUAGE sql;

-- 11. Seed default tenant
INSERT INTO tenants (id, name, slug, domain, email_inbound, email_outbound, inhaber, branche, plan)
VALUES ('a0000000-0000-0000-0000-000000000001', 'FreyAI Visions', 'freyavision', 'freyavision.de', 'anfragen@freyavision.de', 'angebote@freyavision.de', 'Jonas Glawion', 'metallbau', 'pro')
ON CONFLICT (slug) DO NOTHING;

-- 12. Assign existing data to default tenant
DO $$
DECLARE tbl TEXT;
BEGIN
    FOR tbl IN SELECT unnest(ARRAY[
        'kunden', 'anfragen', 'angebote', 'auftraege', 'rechnungen',
        'buchungen', 'materialien', 'aufgaben', 'termine', 'zeiteintraege',
        'dokumente', 'purchase_orders', 'stock_movements', 'material_reservations',
        'suppliers', 'communication_log', 'automation_log', 'notifications', 'inbound_emails'
    ]) LOOP
        EXECUTE format('UPDATE %I SET tenant_id = ''a0000000-0000-0000-0000-000000000001'' WHERE tenant_id IS NULL', tbl);
    END LOOP;
END $$;

UPDATE profiles SET tenant_id = 'a0000000-0000-0000-0000-000000000001', role = 'owner' WHERE tenant_id IS NULL;
