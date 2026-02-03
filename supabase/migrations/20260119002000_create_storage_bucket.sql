-- Create storage bucket for company assets
INSERT INTO storage.buckets (id, name, public)
VALUES ('company-assets', 'company-assets', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Allow authenticated users to upload/read their own files
DROP POLICY IF EXISTS "Authenticated can upload company assets" ON storage.objects;
CREATE POLICY "Authenticated can upload company assets"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'company-assets');

DROP POLICY IF EXISTS "Authenticated can read company assets" ON storage.objects;
CREATE POLICY "Authenticated can read company assets"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'company-assets');
