-- Add DSGVO consent tracking to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS privacy_accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ;

COMMENT ON COLUMN profiles.privacy_accepted_at IS 'Timestamp when user accepted privacy policy (DSGVO Art. 7)';
COMMENT ON COLUMN profiles.terms_accepted_at IS 'Timestamp when user accepted terms of service';
