
-- 1. Create automations table
CREATE TABLE public.automations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  user_id UUID NOT NULL,
  name text NOT NULL,
  description text,
  type text NOT NULL DEFAULT 'workflow' CHECK (type IN ('workflow', 'trigger', 'scheduled', 'webhook')),
  status text NOT NULL DEFAULT 'inactive' CHECK (status IN ('active', 'inactive', 'error', 'paused')),
  external_flow_id text,
  config jsonb DEFAULT '{}'::jsonb,
  last_run_at timestamptz,
  run_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.automations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members with automation access can view automations"
ON public.automations FOR SELECT
USING (
  organization_id = get_active_org_id()
  AND (
    has_org_role(auth.uid(), organization_id, 'owner')
    OR has_org_role(auth.uid(), organization_id, 'admin')
    OR has_org_role(auth.uid(), organization_id, 'user')
  )
);

CREATE POLICY "Org admins can create automations"
ON public.automations FOR INSERT
WITH CHECK (
  organization_id = get_active_org_id()
  AND (
    has_org_role(auth.uid(), organization_id, 'owner')
    OR has_org_role(auth.uid(), organization_id, 'admin')
  )
);

CREATE POLICY "Org admins can update automations"
ON public.automations FOR UPDATE
USING (
  organization_id = get_active_org_id()
  AND (
    has_org_role(auth.uid(), organization_id, 'owner')
    OR has_org_role(auth.uid(), organization_id, 'admin')
  )
);

CREATE POLICY "Org admins can delete automations"
ON public.automations FOR DELETE
USING (
  organization_id = get_active_org_id()
  AND (
    has_org_role(auth.uid(), organization_id, 'owner')
    OR has_org_role(auth.uid(), organization_id, 'admin')
  )
);

CREATE TRIGGER update_automations_updated_at
BEFORE UPDATE ON public.automations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE INDEX idx_automations_org ON public.automations(organization_id);
CREATE INDEX idx_automations_status ON public.automations(status);

-- 2. Create agents table
CREATE TABLE public.agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  user_id UUID NOT NULL,
  name text NOT NULL,
  description text,
  type text NOT NULL DEFAULT 'assistant' CHECK (type IN ('assistant', 'researcher', 'reviewer', 'drafter', 'custom')),
  status text NOT NULL DEFAULT 'inactive' CHECK (status IN ('active', 'inactive', 'error')),
  model text DEFAULT 'gemini-3-flash',
  system_prompt text,
  config jsonb DEFAULT '{}'::jsonb,
  memory jsonb DEFAULT '[]'::jsonb,
  tools jsonb DEFAULT '[]'::jsonb,
  run_count integer NOT NULL DEFAULT 0,
  last_run_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view agents"
ON public.agents FOR SELECT
USING (
  organization_id = get_active_org_id()
  AND (
    has_org_role(auth.uid(), organization_id, 'owner')
    OR has_org_role(auth.uid(), organization_id, 'admin')
    OR has_org_role(auth.uid(), organization_id, 'user')
  )
);

CREATE POLICY "Org admins can create agents"
ON public.agents FOR INSERT
WITH CHECK (
  organization_id = get_active_org_id()
  AND (
    has_org_role(auth.uid(), organization_id, 'owner')
    OR has_org_role(auth.uid(), organization_id, 'admin')
  )
);

CREATE POLICY "Org admins can update agents"
ON public.agents FOR UPDATE
USING (
  organization_id = get_active_org_id()
  AND (
    has_org_role(auth.uid(), organization_id, 'owner')
    OR has_org_role(auth.uid(), organization_id, 'admin')
  )
);

CREATE POLICY "Org admins can delete agents"
ON public.agents FOR DELETE
USING (
  organization_id = get_active_org_id()
  AND (
    has_org_role(auth.uid(), organization_id, 'owner')
    OR has_org_role(auth.uid(), organization_id, 'admin')
  )
);

CREATE TRIGGER update_agents_updated_at
BEFORE UPDATE ON public.agents
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE INDEX idx_agents_org ON public.agents(organization_id);
CREATE INDEX idx_agents_type ON public.agents(type);
