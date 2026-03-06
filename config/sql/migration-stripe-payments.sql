-- ============================================
-- Stripe Payments Migration
-- Adds stripe_payments table and payment columns to rechnungen
-- ============================================

-- 1. Stripe payments log table
CREATE TABLE IF NOT EXISTS stripe_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    stripe_session_id TEXT UNIQUE NOT NULL,
    stripe_customer_id TEXT,
    invoice_id UUID,
    amount INTEGER NOT NULL,
    currency TEXT DEFAULT 'eur',
    payment_status TEXT NOT NULL DEFAULT 'pending',
    payment_method TEXT DEFAULT 'card',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stripe_payments_invoice ON stripe_payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_stripe_payments_session ON stripe_payments(stripe_session_id);

-- RLS
ALTER TABLE stripe_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages stripe_payments" ON stripe_payments
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Users view own tenant payments" ON stripe_payments
    FOR SELECT USING (tenant_id = get_my_tenant_id());

-- 2. Add Stripe-related columns to rechnungen (if not already present)
ALTER TABLE rechnungen ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
ALTER TABLE rechnungen ADD COLUMN IF NOT EXISTS stripe_payment_id TEXT;
ALTER TABLE rechnungen ADD COLUMN IF NOT EXISTS payment_method TEXT;

-- 3. Create a view alias for backwards compatibility with stripe-webhook
-- The webhook references "invoices" but the table is "rechnungen"
CREATE OR REPLACE VIEW invoices AS SELECT * FROM rechnungen;
