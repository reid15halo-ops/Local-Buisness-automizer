-- Create the marketing-assets storage bucket for onboarding file uploads (logos, photos)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'marketing-assets',
  'marketing-assets',
  false,
  10485760, -- 10MB limit
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- RLS policies: authenticated users can upload to their own folder (uid as prefix)
CREATE POLICY "Users can upload marketing assets to own folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'marketing-assets'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Authenticated users can read their own uploads
CREATE POLICY "Users can read own marketing assets"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'marketing-assets'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Authenticated users can delete their own uploads
CREATE POLICY "Users can delete own marketing assets"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'marketing-assets'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Service role can read all marketing assets (for n8n workflows)
CREATE POLICY "Service role can read all marketing assets"
ON storage.objects FOR SELECT
TO service_role
USING (bucket_id = 'marketing-assets');

-- Service role can write all marketing assets (for n8n workflows)
CREATE POLICY "Service role can manage all marketing assets"
ON storage.objects FOR ALL
TO service_role
USING (bucket_id = 'marketing-assets')
WITH CHECK (bucket_id = 'marketing-assets');
