-- ============================================
-- Client Error Logging Table
-- Stores frontend errors for debugging
-- ============================================

CREATE TABLE IF NOT EXISTS client_errors (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id uuid REFERENCES tenants(id),
    user_id uuid,
    error_message text NOT NULL,
    error_stack text,
    url text,
    user_agent text,
    metadata jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT now()
);

ALTER TABLE client_errors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own errors" ON client_errors
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND (user_id IS NULL OR auth.uid() = user_id));

CREATE POLICY "Users can read own errors" ON client_errors
    FOR SELECT USING (auth.uid() = user_id);

CREATE INDEX idx_client_errors_created ON client_errors(created_at DESC);
