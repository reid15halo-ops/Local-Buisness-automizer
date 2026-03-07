-- ============================================
-- Scanned Documents Migration
-- Persist OCR-scanned documents to Supabase
-- Run AFTER migration-multi-tenant.sql
-- ============================================

CREATE TABLE IF NOT EXISTS scanned_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID,
    scan_type TEXT,
    extracted_data JSONB DEFAULT '{}'::jsonb,
    raw_text TEXT,
    image_data TEXT,
    file_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for tenant-scoped queries sorted by date
CREATE INDEX IF NOT EXISTS idx_scanned_documents_tenant_created
    ON scanned_documents(tenant_id, created_at DESC);

-- Index for filtering by scan type
CREATE INDEX IF NOT EXISTS idx_scanned_documents_type
    ON scanned_documents(tenant_id, scan_type);

-- RLS
ALTER TABLE scanned_documents ENABLE ROW LEVEL SECURITY;

-- Service role full access
CREATE POLICY "Service role manages scanned_documents" ON scanned_documents
    FOR ALL USING (auth.role() = 'service_role');

-- Authenticated users can manage documents for their tenant
CREATE POLICY "Users manage own tenant scanned_documents" ON scanned_documents
    FOR ALL USING (
        tenant_id = get_my_tenant_id()
    );
