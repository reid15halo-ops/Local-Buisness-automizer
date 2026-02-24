-- Maps inbound email addresses to user accounts for multi-tenancy
CREATE TABLE IF NOT EXISTS email_routing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE email_routing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own email routing"
ON email_routing
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());
