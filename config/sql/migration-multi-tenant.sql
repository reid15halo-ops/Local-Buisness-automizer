-- ============================================
-- Multi-Tenant Migration
-- Adds tenant isolation to all tables
-- Run AFTER supabase-schema.sql
-- ============================================

-- ============================================
-- 1. Tenants Table (each business = 1 tenant)
-- ============================================
CREATE TABLE IF NOT EXISTS tenants (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,                          -- Firmenname
    slug TEXT UNIQUE NOT NULL,                   -- URL-safe identifier (z.B. "metallbau-schmidt")
    domain TEXT UNIQUE,                          -- E-Mail Domain (z.B. "metallbau-schmidt.de")
    email_inbound TEXT,                          -- Inbound E-Mail (z.B. "anfragen@metallbau-schmidt.de")
    email_outbound TEXT,                         -- Absender E-Mail (z.B. "angebote@metallbau-schmidt.de")

    -- Firmendaten
    inhaber TEXT,                                -- Geschäftsführer
    adresse TEXT,
    plz TEXT,
    stadt TEXT,
    telefon TEXT,
    website TEXT,
    steuernummer TEXT,
    ust_id TEXT,                                 -- USt-IdNr.
    iban TEXT,
    bic TEXT,
    bank TEXT,
    handelsregister TEXT,                        -- z.B. "HRB 12345, AG München"

    -- Logo (base64 or storage URL)
    logo_url TEXT,

    -- Branche & AI-Einstellungen
    branche TEXT DEFAULT 'metallbau',            -- metallbau, hydraulik, schlosserei, etc.
    preisliste JSONB DEFAULT '{}',               -- Standardpreise für AI-Angebote
    ai_system_prompt TEXT,                       -- Custom AI prompt für diese Firma
    ai_enabled BOOLEAN DEFAULT TRUE,

    -- Limits
    plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'pro')),
    max_users INTEGER DEFAULT 3,
    max_emails_per_day INTEGER DEFAULT 50,
    emails_sent_today INTEGER DEFAULT 0,
    emails_reset_date DATE DEFAULT CURRENT_DATE,

    -- Status
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Admin can manage all tenants
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages tenants" ON tenants
    FOR ALL USING (auth.role() = 'service_role');
-- Users can read their own tenant
CREATE POLICY "Users can read own tenant" ON tenants
    FOR SELECT USING (
        id IN (SELECT tenant_id FROM profiles WHERE profiles.id = auth.uid())
    );

CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_domain ON tenants(domain);

-- ============================================
-- 2. Add tenant_id to profiles
-- ============================================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user' CHECK (role IN ('owner', 'admin', 'user'));

CREATE INDEX IF NOT EXISTS idx_profiles_tenant ON profiles(tenant_id);

-- ============================================
-- 3. Helper: Get current user's tenant_id
-- ============================================
CREATE OR REPLACE FUNCTION get_my_tenant_id()
RETURNS UUID AS $$
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ============================================
-- 4. Add tenant_id to ALL business tables
-- ============================================

-- Kunden
ALTER TABLE kunden ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
CREATE INDEX IF NOT EXISTS idx_kunden_tenant ON kunden(tenant_id);

-- Anfragen
ALTER TABLE anfragen ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
CREATE INDEX IF NOT EXISTS idx_anfragen_tenant ON anfragen(tenant_id);

-- Angebote
ALTER TABLE angebote ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
CREATE INDEX IF NOT EXISTS idx_angebote_tenant ON angebote(tenant_id);

-- Aufträge
ALTER TABLE auftraege ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
CREATE INDEX IF NOT EXISTS idx_auftraege_tenant ON auftraege(tenant_id);

-- Rechnungen
ALTER TABLE rechnungen ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
CREATE INDEX IF NOT EXISTS idx_rechnungen_tenant ON rechnungen(tenant_id);

-- Buchungen
ALTER TABLE buchungen ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
CREATE INDEX IF NOT EXISTS idx_buchungen_tenant ON buchungen(tenant_id);

-- Materialien
ALTER TABLE materialien ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
CREATE INDEX IF NOT EXISTS idx_materialien_tenant ON materialien(tenant_id);

-- Aufgaben
ALTER TABLE aufgaben ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
CREATE INDEX IF NOT EXISTS idx_aufgaben_tenant ON aufgaben(tenant_id);

-- Termine
ALTER TABLE termine ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
CREATE INDEX IF NOT EXISTS idx_termine_tenant ON termine(tenant_id);

-- Zeiteinträge
ALTER TABLE zeiteintraege ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
CREATE INDEX IF NOT EXISTS idx_zeiteintraege_tenant ON zeiteintraege(tenant_id);

-- Dokumente
ALTER TABLE dokumente ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
CREATE INDEX IF NOT EXISTS idx_dokumente_tenant ON dokumente(tenant_id);

-- Purchase Orders
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_tenant ON purchase_orders(tenant_id);

-- Stock Movements
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_tenant ON stock_movements(tenant_id);

-- Material Reservations
ALTER TABLE material_reservations ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
CREATE INDEX IF NOT EXISTS idx_material_reservations_tenant ON material_reservations(tenant_id);

-- Suppliers
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
CREATE INDEX IF NOT EXISTS idx_suppliers_tenant ON suppliers(tenant_id);

-- Communication Log
ALTER TABLE communication_log ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
CREATE INDEX IF NOT EXISTS idx_communication_log_tenant ON communication_log(tenant_id);

-- Automation Log
ALTER TABLE automation_log ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
CREATE INDEX IF NOT EXISTS idx_automation_log_tenant ON automation_log(tenant_id);

-- Notifications
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
CREATE INDEX IF NOT EXISTS idx_notifications_tenant ON notifications(tenant_id);

-- Inbound Emails
ALTER TABLE inbound_emails ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
CREATE INDEX IF NOT EXISTS idx_inbound_emails_tenant ON inbound_emails(tenant_id);

-- ============================================
-- 5. Update RLS Policies (tenant-scoped)
-- ============================================

-- Drop old user-only policies, replace with tenant-scoped
-- Pattern: user must belong to same tenant as the row

-- Helper macro for all business tables:
DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOR tbl IN SELECT unnest(ARRAY[
        'kunden', 'anfragen', 'angebote', 'auftraege', 'rechnungen',
        'buchungen', 'materialien', 'aufgaben', 'termine', 'zeiteintraege',
        'dokumente', 'purchase_orders', 'stock_movements', 'material_reservations',
        'suppliers', 'communication_log'
    ]) LOOP
        -- Drop old policy
        EXECUTE format('DROP POLICY IF EXISTS "Users manage own %s" ON %I', tbl, tbl);

        -- New tenant-scoped policy: user can access rows in their tenant
        EXECUTE format(
            'CREATE POLICY "Tenant isolation %s" ON %I FOR ALL USING (
                tenant_id = get_my_tenant_id()
                OR auth.role() = ''service_role''
            )',
            tbl, tbl
        );
    END LOOP;
END $$;

-- Automation log: read own tenant, insert allowed for edge functions
DROP POLICY IF EXISTS "Users see own automation logs" ON automation_log;
DROP POLICY IF EXISTS "Edge functions can insert logs" ON automation_log;
CREATE POLICY "Tenant reads automation_log" ON automation_log
    FOR SELECT USING (tenant_id = get_my_tenant_id() OR auth.role() = 'service_role');
CREATE POLICY "Edge functions insert automation_log" ON automation_log
    FOR INSERT WITH CHECK (true);

-- Notifications: tenant-scoped
DROP POLICY IF EXISTS "Users see own notifications" ON notifications;
DROP POLICY IF EXISTS "Edge functions can insert notifications" ON notifications;
CREATE POLICY "Tenant reads notifications" ON notifications
    FOR SELECT USING (tenant_id = get_my_tenant_id() OR auth.role() = 'service_role');
CREATE POLICY "Edge functions insert notifications" ON notifications
    FOR INSERT WITH CHECK (true);

-- Inbound emails: service role + tenant read
DROP POLICY IF EXISTS "Service role manages inbound_emails" ON inbound_emails;
CREATE POLICY "Service role manages inbound_emails" ON inbound_emails
    FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Tenant reads inbound_emails" ON inbound_emails
    FOR SELECT USING (tenant_id = get_my_tenant_id());

-- ============================================
-- 6. Tenant domain lookup (for inbound email routing)
-- ============================================
CREATE OR REPLACE FUNCTION get_tenant_by_domain(p_domain TEXT)
RETURNS UUID AS $$
    SELECT id FROM tenants WHERE domain = p_domain AND active = TRUE LIMIT 1
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION get_tenant_by_email(p_email TEXT)
RETURNS UUID AS $$
    SELECT id FROM tenants
    WHERE (email_inbound = p_email OR domain = split_part(p_email, '@', 2))
    AND active = TRUE
    LIMIT 1
$$ LANGUAGE sql STABLE;

-- ============================================
-- 7. Auto-assign tenant_id on insert (via trigger)
-- ============================================
CREATE OR REPLACE FUNCTION auto_set_tenant_id()
RETURNS TRIGGER AS $$
BEGIN
    -- If tenant_id not explicitly set, use current user's tenant
    IF NEW.tenant_id IS NULL THEN
        NEW.tenant_id := get_my_tenant_id();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply auto-tenant trigger to all business tables
DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOR tbl IN SELECT unnest(ARRAY[
        'kunden', 'anfragen', 'angebote', 'auftraege', 'rechnungen',
        'buchungen', 'materialien', 'aufgaben', 'termine', 'zeiteintraege',
        'dokumente', 'purchase_orders', 'stock_movements', 'material_reservations',
        'suppliers', 'communication_log', 'automation_log', 'notifications'
    ]) LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS auto_tenant_%s ON %I', tbl, tbl);
        EXECUTE format(
            'CREATE TRIGGER auto_tenant_%s BEFORE INSERT ON %I
             FOR EACH ROW EXECUTE FUNCTION auto_set_tenant_id()',
            tbl, tbl
        );
    END LOOP;
END $$;

-- ============================================
-- 8. Updated_at trigger for tenants
-- ============================================
DROP TRIGGER IF EXISTS update_tenants_updated_at ON tenants;
CREATE TRIGGER update_tenants_updated_at
    BEFORE UPDATE ON tenants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- 9. Daily email counter reset
-- ============================================
CREATE OR REPLACE FUNCTION reset_daily_email_counters()
RETURNS void AS $$
    UPDATE tenants
    SET emails_sent_today = 0, emails_reset_date = CURRENT_DATE
    WHERE emails_reset_date < CURRENT_DATE;
$$ LANGUAGE sql;

-- ============================================
-- 10. Seed: Create default tenant for existing data
-- ============================================
INSERT INTO tenants (id, name, slug, domain, email_inbound, email_outbound, inhaber, branche, plan)
VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'FreyAI Visions',
    'freyavision',
    'freyavision.de',
    'anfragen@freyavision.de',
    'angebote@freyavision.de',
    'Jonas Glawion',
    'metallbau',
    'pro'
) ON CONFLICT (slug) DO NOTHING;

-- Assign existing data to default tenant
DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOR tbl IN SELECT unnest(ARRAY[
        'kunden', 'anfragen', 'angebote', 'auftraege', 'rechnungen',
        'buchungen', 'materialien', 'aufgaben', 'termine', 'zeiteintraege',
        'dokumente', 'purchase_orders', 'stock_movements', 'material_reservations',
        'suppliers', 'communication_log', 'automation_log', 'notifications', 'inbound_emails'
    ]) LOOP
        EXECUTE format(
            'UPDATE %I SET tenant_id = ''a0000000-0000-0000-0000-000000000001'' WHERE tenant_id IS NULL',
            tbl
        );
    END LOOP;
END $$;

-- Assign existing profiles to default tenant
UPDATE profiles
SET tenant_id = 'a0000000-0000-0000-0000-000000000001', role = 'owner'
WHERE tenant_id IS NULL;
