
-- Table for organization-level predefined tags with custom colors
CREATE TABLE public.quick_task_tags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#3b82f6',
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Unique tag name per organization
CREATE UNIQUE INDEX idx_quick_task_tags_org_name ON public.quick_task_tags(organization_id, lower(name));

-- Enable RLS
ALTER TABLE public.quick_task_tags ENABLE ROW LEVEL SECURITY;

-- Org members can view tags
CREATE POLICY "Org members can view tags"
ON public.quick_task_tags FOR SELECT
USING (organization_id = get_active_org_id());

-- Non-client org members can create tags
CREATE POLICY "Non-client org members can create tags"
ON public.quick_task_tags FOR INSERT
WITH CHECK (
  organization_id = get_active_org_id()
  AND auth.uid() = created_by
  AND NOT has_org_role(auth.uid(), organization_id, 'client'::text)
);

-- Admins/owners can update tags
CREATE POLICY "Admins can update tags"
ON public.quick_task_tags FOR UPDATE
USING (
  organization_id = get_active_org_id()
  AND (has_org_role(auth.uid(), organization_id, 'owner'::text) OR has_org_role(auth.uid(), organization_id, 'admin'::text) OR auth.uid() = created_by)
);

-- Admins/owners can delete tags
CREATE POLICY "Admins can delete tags"
ON public.quick_task_tags FOR DELETE
USING (
  organization_id = get_active_org_id()
  AND (has_org_role(auth.uid(), organization_id, 'owner'::text) OR has_org_role(auth.uid(), organization_id, 'admin'::text) OR auth.uid() = created_by)
);
