-- Create the angebote storage bucket for quote/invoice PDFs
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'angebote',
  'angebote',
  false,
  52428800, -- 50MB limit
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- RLS policies: authenticated users can only access their own company's files
CREATE POLICY "Users can upload angebote PDFs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'angebote');

CREATE POLICY "Users can read angebote PDFs"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'angebote');

CREATE POLICY "Users can delete angebote PDFs"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'angebote');
