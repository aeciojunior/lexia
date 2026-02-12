
-- Organization invites table
CREATE TABLE public.organization_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  invited_by UUID NOT NULL,
  token UUID NOT NULL DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at TIMESTAMPTZ,
  UNIQUE(organization_id, email, status)
);

ALTER TABLE public.organization_invites ENABLE ROW LEVEL SECURITY;

-- Org admins/owners can view invites for their org
CREATE POLICY "Org admins can view invites"
ON public.organization_invites FOR SELECT
USING (
  public.has_org_role(auth.uid(), organization_id, 'admin')
  OR public.has_org_role(auth.uid(), organization_id, 'owner')
);

-- Org admins/owners can create invites
CREATE POLICY "Org admins can create invites"
ON public.organization_invites FOR INSERT
WITH CHECK (
  public.has_org_role(auth.uid(), organization_id, 'admin')
  OR public.has_org_role(auth.uid(), organization_id, 'owner')
);

-- Org admins/owners can delete invites
CREATE POLICY "Org admins can delete invites"
ON public.organization_invites FOR DELETE
USING (
  public.has_org_role(auth.uid(), organization_id, 'admin')
  OR public.has_org_role(auth.uid(), organization_id, 'owner')
);

-- Org admins/owners can update invites (for canceling)
CREATE POLICY "Org admins can update invites"
ON public.organization_invites FOR UPDATE
USING (
  public.has_org_role(auth.uid(), organization_id, 'admin')
  OR public.has_org_role(auth.uid(), organization_id, 'owner')
);

-- Allow INSERT for organizations (so owners can create new orgs)
CREATE POLICY "Authenticated users can create organizations"
ON public.organizations FOR INSERT
TO authenticated
WITH CHECK (true);
