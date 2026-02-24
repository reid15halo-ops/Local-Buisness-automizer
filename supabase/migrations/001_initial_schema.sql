-- ============================================================
-- FreyAI Visions 95/5 Architecture — Zone 1
-- Migration 001: Initial Business Entity Schema
-- ============================================================

-- ============================================================
-- UTILITY: updated_at trigger function
-- (defined here so all tables in this migration can use it)
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- TABLE: customers
-- ============================================================
CREATE TABLE IF NOT EXISTS customers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    company_name    TEXT,
    contact_name    TEXT NOT NULL,
    email           TEXT,
    phone           TEXT,
    address         TEXT,
    city            TEXT,
    zip             TEXT,
    country         TEXT DEFAULT 'DE',
    tax_id          TEXT,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_customers_user_id   ON customers(user_id);
CREATE INDEX IF NOT EXISTS idx_customers_email      ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_company    ON customers(company_name);

CREATE TRIGGER trg_customers_updated_at
    BEFORE UPDATE ON customers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- TABLE: leads
-- ============================================================
CREATE TYPE lead_status AS ENUM ('new', 'contacted', 'qualified', 'lost');

CREATE TABLE IF NOT EXISTS leads (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    email       TEXT,
    phone       TEXT,
    source      TEXT,
    status      lead_status NOT NULL DEFAULT 'new',
    notes       TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_leads_user_id ON leads(user_id);
CREATE INDEX IF NOT EXISTS idx_leads_status  ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_email   ON leads(email);

-- ============================================================
-- TABLE: quotes (Angebote)
-- ============================================================
CREATE TYPE quote_status AS ENUM ('draft', 'sent', 'accepted', 'rejected', 'expired');

CREATE TABLE IF NOT EXISTS quotes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    customer_id     UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    quote_number    TEXT NOT NULL,
    title           TEXT NOT NULL,
    description     TEXT,
    items           JSONB NOT NULL DEFAULT '[]',
    subtotal        NUMERIC(12, 2) NOT NULL DEFAULT 0,
    tax_rate        NUMERIC(5, 4) NOT NULL DEFAULT 0.19,
    tax_amount      NUMERIC(12, 2) NOT NULL DEFAULT 0,
    total           NUMERIC(12, 2) NOT NULL DEFAULT 0,
    status          quote_status NOT NULL DEFAULT 'draft',
    valid_until     DATE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS idx_quotes_number_user ON quotes(user_id, quote_number);
CREATE INDEX IF NOT EXISTS idx_quotes_user_id     ON quotes(user_id);
CREATE INDEX IF NOT EXISTS idx_quotes_customer_id ON quotes(customer_id);
CREATE INDEX IF NOT EXISTS idx_quotes_status      ON quotes(status);

CREATE TRIGGER trg_quotes_updated_at
    BEFORE UPDATE ON quotes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- TABLE: orders (Auftraege)
-- ============================================================
CREATE TYPE order_status AS ENUM ('pending', 'in_progress', 'completed', 'cancelled');

CREATE TABLE IF NOT EXISTS orders (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    customer_id     UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    quote_id        UUID REFERENCES quotes(id) ON DELETE SET NULL,
    order_number    TEXT NOT NULL,
    title           TEXT NOT NULL,
    description     TEXT,
    items           JSONB NOT NULL DEFAULT '[]',
    subtotal        NUMERIC(12, 2) NOT NULL DEFAULT 0,
    tax_amount      NUMERIC(12, 2) NOT NULL DEFAULT 0,
    total           NUMERIC(12, 2) NOT NULL DEFAULT 0,
    status          order_status NOT NULL DEFAULT 'pending',
    scheduled_date  DATE,
    completed_date  DATE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_number_user ON orders(user_id, order_number);
CREATE INDEX IF NOT EXISTS idx_orders_user_id     ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status      ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_quote_id    ON orders(quote_id);

CREATE TRIGGER trg_orders_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- TABLE: invoices (Rechnungen)
-- ============================================================
CREATE TYPE invoice_status AS ENUM (
    'draft',
    'pending_approval',
    'sent',
    'paid',
    'overdue',
    'cancelled'
);

CREATE TABLE IF NOT EXISTS invoices (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    customer_id     UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    order_id        UUID REFERENCES orders(id) ON DELETE SET NULL,
    invoice_number  TEXT NOT NULL,
    title           TEXT NOT NULL,
    items           JSONB NOT NULL DEFAULT '[]',
    subtotal        NUMERIC(12, 2) NOT NULL DEFAULT 0,
    tax_rate        NUMERIC(5, 4) NOT NULL DEFAULT 0.19,
    tax_amount      NUMERIC(12, 2) NOT NULL DEFAULT 0,
    total           NUMERIC(12, 2) NOT NULL DEFAULT 0,
    status          invoice_status NOT NULL DEFAULT 'draft',
    due_date        DATE,
    paid_date       DATE,
    math_confidence NUMERIC(4, 3) NOT NULL DEFAULT 0,
    ocr_raw         JSONB,
    pdf_url         TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_number_user ON invoices(user_id, invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_user_id     ON invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_customer_id ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status      ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_order_id    ON invoices(order_id);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date    ON invoices(due_date) WHERE status IN ('sent', 'overdue');

CREATE TRIGGER trg_invoices_updated_at
    BEFORE UPDATE ON invoices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- TABLE: communications
-- ============================================================
CREATE TYPE comm_channel   AS ENUM ('email', 'whatsapp', 'sms', 'phone');
CREATE TYPE comm_direction AS ENUM ('inbound', 'outbound');
CREATE TYPE comm_status    AS ENUM ('received', 'draft', 'sent', 'failed');

CREATE TABLE IF NOT EXISTS communications (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    channel     comm_channel    NOT NULL,
    direction   comm_direction  NOT NULL,
    subject     TEXT,
    body        TEXT,
    ai_draft    TEXT,
    status      comm_status     NOT NULL DEFAULT 'received',
    intent      TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE communications ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_communications_user_id     ON communications(user_id);
CREATE INDEX IF NOT EXISTS idx_communications_customer_id ON communications(customer_id);
CREATE INDEX IF NOT EXISTS idx_communications_status      ON communications(status);
CREATE INDEX IF NOT EXISTS idx_communications_channel     ON communications(channel);

-- ============================================================
-- TABLE: materials
-- ============================================================
CREATE TABLE IF NOT EXISTS materials (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name                TEXT NOT NULL,
    sku                 TEXT,
    description         TEXT,
    unit                TEXT NOT NULL DEFAULT 'piece',
    unit_price          NUMERIC(12, 4) NOT NULL DEFAULT 0,
    stock_quantity      NUMERIC(12, 3) NOT NULL DEFAULT 0,
    reorder_threshold   NUMERIC(12, 3) NOT NULL DEFAULT 0,
    supplier            TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE materials ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_materials_user_id ON materials(user_id);
CREATE INDEX IF NOT EXISTS idx_materials_sku     ON materials(sku);
CREATE INDEX IF NOT EXISTS idx_materials_name    ON materials(name);

CREATE TRIGGER trg_materials_updated_at
    BEFORE UPDATE ON materials
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- TABLE: warehouse_entries (Wareneingang)
-- ============================================================
CREATE TABLE IF NOT EXISTS warehouse_entries (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    material_id     UUID NOT NULL REFERENCES materials(id) ON DELETE RESTRICT,
    quantity        NUMERIC(12, 3) NOT NULL,
    unit_price      NUMERIC(12, 4) NOT NULL DEFAULT 0,
    supplier        TEXT,
    delivery_note   TEXT,
    received_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE warehouse_entries ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_warehouse_entries_user_id     ON warehouse_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_entries_material_id ON warehouse_entries(material_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_entries_received_at ON warehouse_entries(received_at DESC);

-- ============================================================
-- TABLE: time_entries
-- ============================================================
CREATE TABLE IF NOT EXISTS time_entries (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    order_id    UUID REFERENCES orders(id) ON DELETE SET NULL,
    description TEXT,
    hours       NUMERIC(6, 2) NOT NULL DEFAULT 0,
    hourly_rate NUMERIC(8, 2) NOT NULL DEFAULT 0,
    date        DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_time_entries_user_id  ON time_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_order_id ON time_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_date     ON time_entries(date DESC);

-- ============================================================
-- TABLE: company_settings
-- ============================================================
CREATE TABLE IF NOT EXISTS company_settings (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    company_name        TEXT NOT NULL DEFAULT '',
    company_address     TEXT,
    tax_id              TEXT,
    iban                TEXT,
    bic                 TEXT,
    bank_name           TEXT,
    logo_url            TEXT,
    invoice_prefix      TEXT NOT NULL DEFAULT 'INV-',
    quote_prefix        TEXT NOT NULL DEFAULT 'QUO-',
    default_tax_rate    NUMERIC(5, 4) NOT NULL DEFAULT 0.19,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_company_settings_user_id ON company_settings(user_id);

CREATE TRIGGER trg_company_settings_updated_at
    BEFORE UPDATE ON company_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- COMMENT annotations for documentation
-- ============================================================
COMMENT ON TABLE customers          IS 'Business customer directory — one record per client';
COMMENT ON TABLE leads              IS 'Sales pipeline — prospects not yet converted to customers';
COMMENT ON TABLE quotes             IS 'Angebote — price proposals sent to customers';
COMMENT ON TABLE orders             IS 'Auftraege — confirmed work orders';
COMMENT ON TABLE invoices           IS 'Rechnungen — billing documents with OCR/AI math validation';
COMMENT ON TABLE communications     IS 'Omni-channel message log (email/WhatsApp/SMS/phone)';
COMMENT ON TABLE materials          IS 'Inventory / Lager — materials and spare parts catalog';
COMMENT ON TABLE warehouse_entries  IS 'Wareneingang — stock-in receipts';
COMMENT ON TABLE time_entries       IS 'Zeiterfassung — billable hours tracked per order';
COMMENT ON TABLE company_settings   IS 'Per-user business configuration (one row per user)';
