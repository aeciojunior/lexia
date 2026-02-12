-- Allow owners to delete their organization (RF-014.3)
CREATE POLICY "Owners can delete their organization"
ON public.organizations
FOR DELETE
USING (has_org_role(auth.uid(), id, 'owner'::text));