-- Update storage policies to allow admins too

DROP POLICY "Org owners can upload logos" ON storage.objects;
CREATE POLICY "Org owners and admins can upload logos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'org-logos'
  AND (
    public.has_org_role(auth.uid(), (storage.foldername(name))[1]::uuid, 'owner')
    OR public.has_org_role(auth.uid(), (storage.foldername(name))[1]::uuid, 'admin')
  )
);

DROP POLICY "Org owners can update logos" ON storage.objects;
CREATE POLICY "Org owners and admins can update logos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'org-logos'
  AND (
    public.has_org_role(auth.uid(), (storage.foldername(name))[1]::uuid, 'owner')
    OR public.has_org_role(auth.uid(), (storage.foldername(name))[1]::uuid, 'admin')
  )
);

DROP POLICY "Org owners can delete logos" ON storage.objects;
CREATE POLICY "Org owners and admins can delete logos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'org-logos'
  AND (
    public.has_org_role(auth.uid(), (storage.foldername(name))[1]::uuid, 'owner')
    OR public.has_org_role(auth.uid(), (storage.foldername(name))[1]::uuid, 'admin')
  )
);