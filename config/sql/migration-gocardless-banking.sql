-- Migration: GoCardless Open Banking Integration
-- Stores bank connections (requisitions) and transaction data from GoCardless Bank Account Data API
-- Extends the existing finom_transactions table pattern for multi-provider support
-- DSGVO: No raw API payloads stored, only essential business fields. 10-year retention (HGB 257).

-- ============================================
-- GoCardless bank connections (requisitions)
-- ============================================
CREATE TABLE IF NOT EXISTS gocardless_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- GoCardless requisition data
    requisition_id TEXT NOT NULL,            -- GoCardless requisition UUID
    institution_id TEXT NOT NULL,            -- e.g. 'SPARKASSE_FINTS_DE'
    institution_name TEXT,
    agreement_id TEXT,                       -- End-user agreement UUID

    -- Account data (populated after bank link completes)
    gc_account_id TEXT,                      -- GoCardless account UUID
    iban TEXT,
    bic TEXT,
    owner_name TEXT,
    currency TEXT DEFAULT 'EUR',

    -- Status tracking
    status TEXT DEFAULT 'pending',           -- 'pending', 'linked', 'expired', 'revoked'
    access_valid_until DATE,                 -- When the 90-day access expires
    last_sync_at TIMESTAMPTZ,
    last_sync_status TEXT,                   -- 'success', 'error'
    last_sync_error TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_gc_conn_requisition
    ON gocardless_connections(tenant_id, requisition_id);
CREATE INDEX IF NOT EXISTS idx_gc_conn_tenant ON gocardless_connections(tenant_id);
CREATE INDEX IF NOT EXISTS idx_gc_conn_account ON gocardless_connections(gc_account_id);

ALTER TABLE gocardless_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gc_connections_tenant_select" ON gocardless_connections
    FOR SELECT USING (tenant_id IN (
        SELECT tenant_id FROM profiles WHERE id = auth.uid()
    ));

CREATE POLICY "gc_connections_tenant_update" ON gocardless_connections
    FOR UPDATE
    USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()))
    WITH CHECK (tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "gc_connections_tenant_delete" ON gocardless_connections
    FOR DELETE USING (tenant_id IN (
        SELECT tenant_id FROM profiles WHERE id = auth.uid()
    ));

-- No INSERT policy: n8n/backend uses service_role key (bypasses RLS)

-- ============================================
-- GoCardless transactions
-- Mirrors finom_transactions structure for consistency
-- ============================================
CREATE TABLE IF NOT EXISTS gocardless_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Transaction identifiers
    external_id TEXT NOT NULL,               -- GoCardless transactionId or internalTransactionId
    gc_account_id TEXT NOT NULL,             -- GoCardless account UUID

    -- Transaction core data
    transaction_date DATE NOT NULL,
    booking_date DATE,
    value_date DATE,
    amount DECIMAL(12,2) NOT NULL,           -- Positive = incoming, negative = outgoing
    currency TEXT DEFAULT 'EUR',

    -- Counterparty
    counterparty_name TEXT,
    counterparty_iban TEXT,

    -- Details
    reference TEXT,                          -- remittanceInformationUnstructured (Verwendungszweck)
    end_to_end_id TEXT,                      -- endToEndId from SEPA
    transaction_type TEXT,                   -- 'booked', 'pending'
    category TEXT,                           -- Auto-categorized

    -- Matching
    matched_invoice_id TEXT,
    matched_entity_type TEXT,                -- 'rechnung', 'purchase_order'
    matched_buchung_id TEXT,
    match_confidence DECIMAL(3,2),           -- 0.00 - 1.00
    match_method TEXT,                       -- 'reference_match', 'amount_and_name', 'amount_fuzzy', 'manual'
    matched_at TIMESTAMPTZ,

    -- Dismissal (non-invoice payments: tax refunds, personal transfers, etc.)
    dismissed BOOLEAN DEFAULT FALSE,
    dismiss_reason TEXT,
    dismissed_at TIMESTAMPTZ,

    -- Meta
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint: prevent duplicate transactions per tenant+account
CREATE UNIQUE INDEX IF NOT EXISTS idx_gc_tx_unique_external
    ON gocardless_transactions(tenant_id, gc_account_id, external_id);

CREATE INDEX IF NOT EXISTS idx_gc_tx_tenant ON gocardless_transactions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_gc_tx_date ON gocardless_transactions(transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_gc_tx_counterparty ON gocardless_transactions(counterparty_name);
CREATE INDEX IF NOT EXISTS idx_gc_tx_unmatched ON gocardless_transactions(tenant_id)
    WHERE matched_invoice_id IS NULL AND matched_buchung_id IS NULL AND (dismissed IS NULL OR dismissed = FALSE);
CREATE INDEX IF NOT EXISTS idx_gc_tx_account ON gocardless_transactions(gc_account_id, transaction_date DESC);

ALTER TABLE gocardless_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gc_transactions_tenant_select" ON gocardless_transactions
    FOR SELECT USING (tenant_id IN (
        SELECT tenant_id FROM profiles WHERE id = auth.uid()
    ));

CREATE POLICY "gc_transactions_tenant_update" ON gocardless_transactions
    FOR UPDATE
    USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()))
    WITH CHECK (tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

-- DSGVO Art. 17 -- right to erasure
CREATE POLICY "gc_transactions_tenant_delete" ON gocardless_transactions
    FOR DELETE USING (tenant_id IN (
        SELECT tenant_id FROM profiles WHERE id = auth.uid()
    ));

-- No INSERT policy: n8n/backend uses service_role key

-- ============================================
-- Updated_at triggers
-- ============================================
CREATE OR REPLACE FUNCTION update_gc_connections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER gc_connections_updated_at
    BEFORE UPDATE ON gocardless_connections
    FOR EACH ROW
    EXECUTE FUNCTION update_gc_connections_updated_at();

CREATE OR REPLACE FUNCTION update_gc_transactions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER gc_transactions_updated_at
    BEFORE UPDATE ON gocardless_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_gc_transactions_updated_at();

-- ============================================
-- RPC Functions (parameterized, no SQL injection)
-- ============================================

-- 1. Check if transaction already exists (dedup)
CREATE OR REPLACE FUNCTION gc_check_duplicate(
    p_tenant_id UUID,
    p_gc_account_id TEXT,
    p_external_id TEXT
) RETURNS TABLE(id UUID) AS $$
BEGIN
    RETURN QUERY
    SELECT gt.id FROM gocardless_transactions gt
    WHERE gt.external_id = p_external_id
      AND gt.gc_account_id = p_gc_account_id
      AND gt.tenant_id = p_tenant_id
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Insert transaction (with ON CONFLICT for race conditions)
CREATE OR REPLACE FUNCTION gc_insert_transaction(
    p_tenant_id UUID,
    p_gc_account_id TEXT,
    p_external_id TEXT,
    p_transaction_date DATE,
    p_booking_date DATE,
    p_value_date DATE,
    p_amount DECIMAL(12,2),
    p_currency TEXT,
    p_counterparty_name TEXT,
    p_counterparty_iban TEXT,
    p_reference TEXT,
    p_end_to_end_id TEXT,
    p_transaction_type TEXT,
    p_category TEXT
) RETURNS UUID AS $$
DECLARE
    new_id UUID;
BEGIN
    INSERT INTO gocardless_transactions (
        tenant_id, gc_account_id, external_id,
        transaction_date, booking_date, value_date,
        amount, currency,
        counterparty_name, counterparty_iban,
        reference, end_to_end_id,
        transaction_type, category
    ) VALUES (
        p_tenant_id, p_gc_account_id, p_external_id,
        p_transaction_date, p_booking_date, p_value_date,
        p_amount, p_currency,
        p_counterparty_name, p_counterparty_iban,
        p_reference, p_end_to_end_id,
        p_transaction_type, p_category
    )
    ON CONFLICT (tenant_id, gc_account_id, external_id) DO NOTHING
    RETURNING id INTO new_id;

    RETURN new_id;  -- NULL if duplicate
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Auto-match transaction against invoices (3-tier confidence)
CREATE OR REPLACE FUNCTION gc_auto_match(
    p_tenant_id UUID,
    p_transaction_id UUID,
    p_reference TEXT,
    p_amount DECIMAL(12,2),
    p_counterparty_name TEXT
) RETURNS TABLE(
    matched_id TEXT,
    entity_type TEXT,
    method TEXT,
    confidence DECIMAL(3,2)
) AS $$
BEGIN
    -- Tier 1: Reference contains invoice number (95% confidence)
    RETURN QUERY
    SELECT r.id::TEXT, 'rechnung'::TEXT, 'reference_match'::TEXT, 0.95::DECIMAL(3,2)
    FROM rechnungen r
    WHERE r.tenant_id = p_tenant_id
      AND r.status IN ('offen', 'versendet')
      AND p_reference ILIKE '%' || replace(replace(r.nummer, '%', ''), '_', '') || '%'
      AND ABS(ABS(r.brutto) - ABS(p_amount)) <= ABS(r.brutto) * 0.01
    LIMIT 1;

    IF FOUND THEN RETURN; END IF;

    -- Tier 2: Exact amount + customer name match (85% confidence)
    RETURN QUERY
    SELECT r.id::TEXT, 'rechnung'::TEXT, 'amount_and_name'::TEXT, 0.85::DECIMAL(3,2)
    FROM rechnungen r
    LEFT JOIN kunden k ON r.kunde_id = k.id
    WHERE r.tenant_id = p_tenant_id
      AND r.status IN ('offen', 'versendet')
      AND ABS(ABS(r.brutto) - ABS(p_amount)) < 0.01
      AND (
          k.name ILIKE '%' || split_part(p_counterparty_name, ' ', 1) || '%'
          OR k.firma ILIKE '%' || split_part(p_counterparty_name, ' ', 1) || '%'
      )
    LIMIT 1;

    IF FOUND THEN RETURN; END IF;

    -- Tier 3: Amount within +/-1% (70% confidence)
    RETURN QUERY
    SELECT r.id::TEXT, 'rechnung'::TEXT, 'amount_fuzzy'::TEXT, 0.70::DECIMAL(3,2)
    FROM rechnungen r
    WHERE r.tenant_id = p_tenant_id
      AND r.status IN ('offen', 'versendet')
      AND ABS(ABS(r.brutto) - ABS(p_amount)) <= ABS(r.brutto) * 0.01
      AND ABS(ABS(r.brutto) - ABS(p_amount)) >= 0.01
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Apply match result to transaction
CREATE OR REPLACE FUNCTION gc_apply_match(
    p_transaction_id UUID,
    p_tenant_id UUID,
    p_matched_id TEXT,
    p_entity_type TEXT,
    p_method TEXT,
    p_confidence DECIMAL(3,2)
) RETURNS VOID AS $$
BEGIN
    UPDATE gocardless_transactions SET
        matched_invoice_id = p_matched_id,
        matched_entity_type = p_entity_type,
        match_confidence = p_confidence,
        match_method = p_method,
        matched_at = NOW()
    WHERE id = p_transaction_id AND tenant_id = p_tenant_id;

    -- Update invoice status to bezahlt if confidence >= 0.85
    IF p_entity_type = 'rechnung' AND p_confidence >= 0.85 THEN
        UPDATE rechnungen SET
            status = 'bezahlt',
            paid_at = NOW()
        WHERE id = p_matched_id::UUID AND tenant_id = p_tenant_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Update connection sync status
CREATE OR REPLACE FUNCTION gc_update_sync_status(
    p_tenant_id UUID,
    p_requisition_id TEXT,
    p_status TEXT,
    p_error TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
    UPDATE gocardless_connections SET
        last_sync_at = NOW(),
        last_sync_status = p_status,
        last_sync_error = p_error
    WHERE tenant_id = p_tenant_id AND requisition_id = p_requisition_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- DSGVO: Data retention cleanup
-- 10 years retention (HGB 257), then anonymize
-- ============================================
CREATE OR REPLACE FUNCTION gc_cleanup_old_data() RETURNS INTEGER AS $$
DECLARE
    rows_affected INTEGER;
BEGIN
    -- Anonymize transactions older than 10 years
    UPDATE gocardless_transactions SET
        counterparty_name = 'ANONYMISIERT',
        counterparty_iban = NULL,
        reference = 'ANONYMISIERT',
        end_to_end_id = NULL
    WHERE transaction_date < CURRENT_DATE - INTERVAL '10 years'
      AND counterparty_name != 'ANONYMISIERT';

    GET DIAGNOSTICS rows_affected = ROW_COUNT;

    -- Delete expired/revoked connections older than 1 year
    DELETE FROM gocardless_connections
    WHERE status IN ('expired', 'revoked')
      AND updated_at < NOW() - INTERVAL '1 year';

    RETURN rows_affected;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
