-- ============================================================
-- FreyAI Core — Supabase Schema (Cloud-First)
--
-- Replaces the legacy IndexedDB data model.
-- Run this in Supabase Dashboard > SQL Editor > New Query.
--
-- Tables:
--   profiles  — User profile + business settings (1:1 with auth.users)
--   clients   — Customer / company records
--   products  — Product & service catalog
--   invoices  — Invoice headers with line-items as JSONB
--
-- All tables use UUID PKs and RLS scoped to auth.uid().
-- ============================================================

-- 0. Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. PROFILES
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
    id            UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    business_name TEXT        NOT NULL DEFAULT '',
    full_name     TEXT        NOT NULL DEFAULT '',
    phone         TEXT        DEFAULT '',
    address       TEXT        DEFAULT '',
    tax_id        TEXT        DEFAULT '',
    vat_id        TEXT        DEFAULT '',
    settings_json JSONB       NOT NULL DEFAULT '{}'::jsonb,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_own" ON profiles
    FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON profiles
    FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON profiles
    FOR UPDATE USING (auth.uid() = id);

-- Auto-create a profile row when a new user signs up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO profiles (id, business_name, full_name)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'business_name', ''),
        COALESCE(NEW.raw_user_meta_data->>'full_name', '')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- 2. CLIENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS clients (
    id             UUID        DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id        UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    company_name   TEXT        NOT NULL DEFAULT '',
    contact_person TEXT        DEFAULT '',
    address        TEXT        DEFAULT '',
    email          TEXT        DEFAULT '',
    phone          TEXT        DEFAULT '',
    vat_id         TEXT        DEFAULT '',
    notes          TEXT        DEFAULT '',
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clients_all_own" ON clients
    FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_clients_user_id ON clients(user_id);

-- ============================================================
-- 3. PRODUCTS
-- ============================================================
CREATE TABLE IF NOT EXISTS products (
    id          UUID           DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id     UUID           REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name        TEXT           NOT NULL,
    description TEXT           DEFAULT '',
    price_net   NUMERIC(12,2) NOT NULL DEFAULT 0,
    tax_rate    NUMERIC(5,2)  NOT NULL DEFAULT 19.00,
    unit        TEXT           DEFAULT 'Stk.',
    active      BOOLEAN        NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ    NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ    NOT NULL DEFAULT now()
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "products_all_own" ON products
    FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_products_user_id ON products(user_id);

-- ============================================================
-- 4. INVOICES
-- ============================================================
CREATE TABLE IF NOT EXISTS invoices (
    id             UUID           DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id        UUID           REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    client_id      UUID           REFERENCES clients(id) ON DELETE SET NULL,
    invoice_number TEXT           NOT NULL,
    date           DATE           NOT NULL DEFAULT CURRENT_DATE,
    due_date       DATE           NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '14 days'),
    status         TEXT           NOT NULL DEFAULT 'draft'
                                  CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'cancelled')),
    items_json     JSONB          NOT NULL DEFAULT '[]'::jsonb,
    total_net      NUMERIC(12,2) NOT NULL DEFAULT 0,
    total_gross    NUMERIC(12,2) NOT NULL DEFAULT 0,
    notes          TEXT           DEFAULT '',
    created_at     TIMESTAMPTZ    NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ    NOT NULL DEFAULT now()
);

COMMENT ON COLUMN invoices.items_json IS
    'Array of {description, quantity, unit, price_net, tax_rate, total}';

COMMENT ON COLUMN profiles.settings_json IS
    'User-level settings and preferences, e.g. {"locale":"de","currency":"EUR","invoice_prefix":"RE-"}';

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invoices_all_own" ON invoices
    FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);

-- ============================================================
-- 5. UPDATED_AT TRIGGER (reusable)
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_clients_updated_at
    BEFORE UPDATE ON clients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_invoices_updated_at
    BEFORE UPDATE ON invoices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
