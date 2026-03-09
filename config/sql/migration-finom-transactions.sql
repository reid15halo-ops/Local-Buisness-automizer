-- Migration: Finom Transactions (via Zapier → n8n → Supabase)
-- Stores real bank transactions synced from Finom through Zapier integration
-- DSGVO: raw_data is stripped to essential fields only, retention policy via scheduled cleanup

-- ============================================
-- Finom transactions table
-- ============================================
CREATE TABLE IF NOT EXISTS finom_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Transaction core data (from Zapier/Finom)
    external_id TEXT NOT NULL,                     -- Finom transaction ID (generated if missing)
    transaction_date DATE NOT NULL,
    booking_date DATE,
    amount DECIMAL(12,2) NOT NULL,                 -- Positive = incoming, negative = outgoing
    currency TEXT DEFAULT 'EUR',

    -- Counterparty
    counterparty_name TEXT,
    counterparty_iban TEXT,
    counterparty_bic TEXT,

    -- Details
    reference TEXT,                                 -- Verwendungszweck
    category TEXT,                                  -- Finom category (if available)
    transaction_type TEXT,                          -- 'SEPA_TRANSFER', 'CARD_PAYMENT', 'DIRECT_DEBIT', etc.
    status TEXT DEFAULT 'booked',                   -- 'booked', 'pending'

    -- Matching (TEXT to match rechnungen/purchase_orders/buchungen PK types)
    matched_invoice_id TEXT,                        -- Linked to rechnungen or purchase_orders
    matched_entity_type TEXT,                       -- 'rechnung', 'purchase_order'
    matched_buchung_id TEXT,                        -- Linked to buchungen
    match_confidence DECIMAL(3,2),                  -- 0.00 - 1.00
    match_method TEXT,                              -- 'auto_reference', 'auto_amount', 'manual'
    matched_at TIMESTAMPTZ,

    -- Meta (DSGVO: no full payload — only essential audit fields)
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint: prevent duplicate transactions per tenant
CREATE UNIQUE INDEX IF NOT EXISTS idx_finom_tx_unique_external
    ON finom_transactions(tenant_id, external_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_finom_tx_tenant ON finom_transactions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_finom_tx_date ON finom_transactions(transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_finom_tx_counterparty ON finom_transactions(counterparty_name);
CREATE INDEX IF NOT EXISTS idx_finom_tx_unmatched ON finom_transactions(tenant_id)
    WHERE matched_invoice_id IS NULL AND matched_buchung_id IS NULL;

-- ============================================
-- RLS Policies
-- ============================================
ALTER TABLE finom_transactions ENABLE ROW LEVEL SECURITY;

-- SELECT: tenant-scoped
CREATE POLICY "finom_transactions_tenant_select" ON finom_transactions
    FOR SELECT USING (tenant_id IN (
        SELECT tenant_id FROM profiles WHERE id = auth.uid()
    ));

-- UPDATE: tenant-scoped with WITH CHECK to prevent tenant_id change
CREATE POLICY "finom_transactions_tenant_update" ON finom_transactions
    FOR UPDATE
    USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()))
    WITH CHECK (tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

-- DELETE: tenant-scoped (DSGVO Art. 17 — right to erasure)
CREATE POLICY "finom_transactions_tenant_delete" ON finom_transactions
    FOR DELETE USING (tenant_id IN (
        SELECT tenant_id FROM profiles WHERE id = auth.uid()
    ));

-- INSERT: NO open policy. n8n uses service_role key which bypasses RLS entirely.
-- Authenticated users cannot insert directly.

-- ============================================
-- Updated_at trigger
-- ============================================
CREATE OR REPLACE FUNCTION update_finom_transactions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER finom_transactions_updated_at
    BEFORE UPDATE ON finom_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_finom_transactions_updated_at();

-- ============================================
-- Finom sync log (tracks last sync per tenant)
-- ============================================
CREATE TABLE IF NOT EXISTS finom_sync_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    sync_type TEXT NOT NULL,                        -- 'zapier_webhook', 'manual'
    transactions_synced INTEGER DEFAULT 0,
    transactions_matched INTEGER DEFAULT 0,
    status TEXT DEFAULT 'success',                  -- 'success', 'error', 'partial'
    error_message TEXT,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_finom_sync_tenant ON finom_sync_log(tenant_id, started_at DESC);

ALTER TABLE finom_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "finom_sync_log_tenant_select" ON finom_sync_log
    FOR SELECT USING (tenant_id IN (
        SELECT tenant_id FROM profiles WHERE id = auth.uid()
    ));

-- DELETE for DSGVO Art. 17
CREATE POLICY "finom_sync_log_tenant_delete" ON finom_sync_log
    FOR DELETE USING (tenant_id IN (
        SELECT tenant_id FROM profiles WHERE id = auth.uid()
    ));

-- No INSERT policy — n8n uses service_role key (bypasses RLS)

-- ============================================
-- RPC Functions (parameterized — no SQL injection)
-- Called from n8n instead of raw executeQuery
-- ============================================

-- 1. Check if transaction exists (dedup)
CREATE OR REPLACE FUNCTION finom_check_duplicate(
    p_tenant_id UUID,
    p_external_id TEXT
) RETURNS TABLE(id UUID) AS $$
BEGIN
    RETURN QUERY
    SELECT ft.id FROM finom_transactions ft
    WHERE ft.external_id = p_external_id
      AND ft.tenant_id = p_tenant_id
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Insert transaction (with ON CONFLICT for race conditions)
CREATE OR REPLACE FUNCTION finom_insert_transaction(
    p_tenant_id UUID,
    p_external_id TEXT,
    p_transaction_date DATE,
    p_booking_date DATE,
    p_amount DECIMAL(12,2),
    p_currency TEXT,
    p_counterparty_name TEXT,
    p_counterparty_iban TEXT,
    p_reference TEXT,
    p_category TEXT,
    p_transaction_type TEXT,
    p_status TEXT
) RETURNS UUID AS $$
DECLARE
    new_id UUID;
BEGIN
    INSERT INTO finom_transactions (
        tenant_id, external_id, transaction_date, booking_date,
        amount, currency, counterparty_name, counterparty_iban,
        reference, category, transaction_type, status
    ) VALUES (
        p_tenant_id, p_external_id, p_transaction_date, p_booking_date,
        p_amount, p_currency, p_counterparty_name, p_counterparty_iban,
        p_reference, p_category, p_transaction_type, p_status
    )
    ON CONFLICT (tenant_id, external_id) DO NOTHING
    RETURNING id INTO new_id;

    RETURN new_id;  -- NULL if duplicate
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Auto-match transaction against invoices/buchungen
CREATE OR REPLACE FUNCTION finom_auto_match(
    p_tenant_id UUID,
    p_transaction_id UUID,
    p_reference TEXT,
    p_amount DECIMAL(12,2)
) RETURNS TABLE(
    matched_id TEXT,
    entity_type TEXT,
    method TEXT,
    confidence DECIMAL(3,2)
) AS $$
BEGIN
    -- Priority 1: Reference contains invoice number (rechnungen)
    RETURN QUERY
    SELECT r.id::TEXT, 'rechnung'::TEXT, 'auto_reference'::TEXT, 0.95::DECIMAL(3,2)
    FROM rechnungen r
    WHERE r.tenant_id = p_tenant_id
      AND r.status != 'bezahlt'
      AND p_reference ILIKE '%' || replace(replace(r.nummer, '%', ''), '_', '') || '%'
    LIMIT 1;

    IF FOUND THEN RETURN; END IF;

    -- Priority 2: Reference contains PO number
    RETURN QUERY
    SELECT po.id::TEXT, 'purchase_order'::TEXT, 'auto_reference'::TEXT, 0.90::DECIMAL(3,2)
    FROM purchase_orders po
    WHERE po.tenant_id = p_tenant_id
      AND po.status NOT IN ('bezahlt', 'storniert')
      AND p_reference ILIKE '%' || replace(replace(po.nummer, '%', ''), '_', '') || '%'
    LIMIT 1;

    IF FOUND THEN RETURN; END IF;

    -- Priority 3: Amount matches open buchung (within 60 days, 2 cent tolerance)
    RETURN QUERY
    SELECT b.id::TEXT, 'buchung'::TEXT, 'auto_amount'::TEXT, 0.70::DECIMAL(3,2)
    FROM buchungen b
    WHERE b.tenant_id = p_tenant_id
      AND b.bezahlt = false
      AND b.typ = 'ausgabe'
      AND ABS(ABS(b.betrag) - ABS(p_amount)) < 0.02
      AND b.datum > CURRENT_DATE - INTERVAL '60 days'
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Apply match result to transaction
CREATE OR REPLACE FUNCTION finom_apply_match(
    p_transaction_id UUID,
    p_tenant_id UUID,
    p_matched_id TEXT,
    p_entity_type TEXT,
    p_method TEXT,
    p_confidence DECIMAL(3,2)
) RETURNS VOID AS $$
BEGIN
    IF p_entity_type IN ('rechnung', 'purchase_order') THEN
        UPDATE finom_transactions SET
            matched_invoice_id = p_matched_id,
            matched_entity_type = p_entity_type,
            match_confidence = p_confidence,
            match_method = p_method,
            matched_at = NOW()
        WHERE id = p_transaction_id AND tenant_id = p_tenant_id;
    ELSIF p_entity_type = 'buchung' THEN
        UPDATE finom_transactions SET
            matched_buchung_id = p_matched_id,
            match_confidence = p_confidence,
            match_method = p_method,
            matched_at = NOW()
        WHERE id = p_transaction_id AND tenant_id = p_tenant_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Log sync event
CREATE OR REPLACE FUNCTION finom_log_sync(
    p_tenant_id UUID,
    p_sync_type TEXT,
    p_synced INTEGER,
    p_matched INTEGER,
    p_status TEXT
) RETURNS VOID AS $$
BEGIN
    INSERT INTO finom_sync_log (tenant_id, sync_type, transactions_synced, transactions_matched, status, completed_at)
    VALUES (p_tenant_id, p_sync_type, p_synced, p_matched, p_status, NOW());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- DSGVO: Data retention cleanup function
-- Call via scheduled n8n workflow or pg_cron
-- Retains transactions for 10 years (HGB §257), then anonymizes
-- ============================================
CREATE OR REPLACE FUNCTION finom_cleanup_old_data() RETURNS INTEGER AS $$
DECLARE
    rows_affected INTEGER;
BEGIN
    -- Anonymize transactions older than 10 years
    UPDATE finom_transactions SET
        counterparty_name = 'ANONYMISIERT',
        counterparty_iban = NULL,
        counterparty_bic = NULL,
        reference = 'ANONYMISIERT'
    WHERE transaction_date < CURRENT_DATE - INTERVAL '10 years'
      AND counterparty_name != 'ANONYMISIERT';

    GET DIAGNOSTICS rows_affected = ROW_COUNT;

    -- Delete sync logs older than 1 year (no legal retention requirement)
    DELETE FROM finom_sync_log WHERE started_at < NOW() - INTERVAL '1 year';

    RETURN rows_affected;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
