-- ============================================
-- Portal Tokens Migration
-- Token-based customer portal access
-- Run AFTER migration-multi-tenant.sql
-- ============================================

CREATE TABLE IF NOT EXISTS portal_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    kunde_id UUID NOT NULL,
    token TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '90 days'),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast token lookup
CREATE INDEX IF NOT EXISTS idx_portal_tokens_token ON portal_tokens(token);
CREATE INDEX IF NOT EXISTS idx_portal_tokens_kunde ON portal_tokens(tenant_id, kunde_id);

-- RLS
ALTER TABLE portal_tokens ENABLE ROW LEVEL SECURITY;

-- Service role full access (used by edge functions)
CREATE POLICY "Service role manages portal_tokens" ON portal_tokens
    FOR ALL USING (auth.role() = 'service_role');

-- Authenticated users can manage tokens for their tenant
CREATE POLICY "Users manage own tenant tokens" ON portal_tokens
    FOR ALL USING (
        tenant_id = get_my_tenant_id()
    );
