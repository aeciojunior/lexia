-- Create public bucket for org logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('org-logos', 'org-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Anyone can view org logos (public bucket)
CREATE POLICY "Org logos are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'org-logos');

-- Org owners can upload logos (folder = org id)
CREATE POLICY "Org owners can upload logos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'org-logos'
  AND public.has_org_role(auth.uid(), (storage.foldername(name))[1]::uuid, 'owner')
);

-- Org owners can update logos
CREATE POLICY "Org owners can update logos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'org-logos'
  AND public.has_org_role(auth.uid(), (storage.foldername(name))[1]::uuid, 'owner')
);

-- Org owners can delete logos
CREATE POLICY "Org owners can delete logos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'org-logos'
  AND public.has_org_role(auth.uid(), (storage.foldername(name))[1]::uuid, 'owner')
);