
-- Add CHECK constraint on user_organizations.role for the 5 RBAC roles
ALTER TABLE public.user_organizations
  DROP CONSTRAINT IF EXISTS user_organizations_role_check;

ALTER TABLE public.user_organizations
  ADD CONSTRAINT user_organizations_role_check
  CHECK (role IN ('owner', 'admin', 'user', 'intern', 'client'));

-- Update RLS on processes: intern can only view (not delete), client sees only their linked processes
-- First drop existing delete policy for processes to make it more restrictive
DROP POLICY IF EXISTS "Org members can delete processes" ON public.processes;

CREATE POLICY "Non-intern org members can delete processes"
ON public.processes
FOR DELETE
USING (
  organization_id = get_active_org_id()
  AND NOT has_org_role(auth.uid(), organization_id, 'intern')
  AND NOT has_org_role(auth.uid(), organization_id, 'client')
);

-- Update RLS on documents: intern cannot delete
DROP POLICY IF EXISTS "Org members can delete documents" ON public.documents;

CREATE POLICY "Non-intern org members can delete documents"
ON public.documents
FOR DELETE
USING (
  organization_id = get_active_org_id()
  AND NOT has_org_role(auth.uid(), organization_id, 'intern')
  AND NOT has_org_role(auth.uid(), organization_id, 'client')
);

-- Update RLS on deadlines: intern cannot delete
DROP POLICY IF EXISTS "Org members can delete deadlines" ON public.deadlines;

CREATE POLICY "Non-intern org members can delete deadlines"
ON public.deadlines
FOR DELETE
USING (
  organization_id = get_active_org_id()
  AND NOT has_org_role(auth.uid(), organization_id, 'intern')
  AND NOT has_org_role(auth.uid(), organization_id, 'client')
);

-- Prevent intern from updating processes (read-only for critical data)
DROP POLICY IF EXISTS "Org members can update processes" ON public.processes;

CREATE POLICY "Non-intern org members can update processes"
ON public.processes
FOR UPDATE
USING (
  organization_id = get_active_org_id()
  AND NOT has_org_role(auth.uid(), organization_id, 'intern')
  AND NOT has_org_role(auth.uid(), organization_id, 'client')
);

-- Prevent client from creating processes/documents/deadlines
DROP POLICY IF EXISTS "Org members can create processes" ON public.processes;

CREATE POLICY "Non-client org members can create processes"
ON public.processes
FOR INSERT
WITH CHECK (
  organization_id = get_active_org_id()
  AND NOT has_org_role(auth.uid(), organization_id, 'client')
);

DROP POLICY IF EXISTS "Org members can create documents" ON public.documents;

CREATE POLICY "Non-client org members can create documents"
ON public.documents
FOR INSERT
WITH CHECK (
  organization_id = get_active_org_id()
  AND NOT has_org_role(auth.uid(), organization_id, 'client')
);

DROP POLICY IF EXISTS "Org members can create deadlines" ON public.deadlines;

CREATE POLICY "Non-client org members can create deadlines"
ON public.deadlines
FOR INSERT
WITH CHECK (
  organization_id = get_active_org_id()
  AND NOT has_org_role(auth.uid(), organization_id, 'client')
);
