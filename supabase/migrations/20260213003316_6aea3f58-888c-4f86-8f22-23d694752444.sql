-- ============================================
-- RF-032: Expand contracts table
-- ============================================
ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS payment_method text DEFAULT 'other',
  ADD COLUMN IF NOT EXISTS responsible_id uuid,
  ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS clauses text;

-- Update RLS: Allow 'user' role to create contracts
DROP POLICY IF EXISTS "Admins can create contracts" ON public.contracts;
CREATE POLICY "Non-client non-intern can create contracts"
ON public.contracts FOR INSERT
WITH CHECK (
  (organization_id = get_active_org_id())
  AND (NOT has_org_role(auth.uid(), organization_id, 'client'))
  AND (NOT has_org_role(auth.uid(), organization_id, 'intern'))
);

-- Allow 'user' role to update contracts
DROP POLICY IF EXISTS "Admins can update contracts" ON public.contracts;
CREATE POLICY "Non-client non-intern can update contracts"
ON public.contracts FOR UPDATE
USING (
  (organization_id = get_active_org_id())
  AND (NOT has_org_role(auth.uid(), organization_id, 'client'))
  AND (NOT has_org_role(auth.uid(), organization_id, 'intern'))
);

-- Allow all org members (non-client) to view contracts
DROP POLICY IF EXISTS "Financial access can view contracts" ON public.contracts;
CREATE POLICY "Org members can view contracts"
ON public.contracts FOR SELECT
USING (
  (organization_id = get_active_org_id())
  AND (NOT has_org_role(auth.uid(), organization_id, 'client'))
);

-- Keep existing client and owner delete policies

-- ============================================
-- RF-033: Teams and Team Members
-- ============================================
CREATE TABLE public.teams (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text,
  legal_area text,
  leader_id uuid,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  tags text[] DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

-- Non-client org members can view teams
CREATE POLICY "Org members can view teams"
ON public.teams FOR SELECT
USING (
  (organization_id = get_active_org_id())
  AND (NOT has_org_role(auth.uid(), organization_id, 'client'))
);

-- Owner/Admin can create teams
CREATE POLICY "Admins can create teams"
ON public.teams FOR INSERT
WITH CHECK (
  (organization_id = get_active_org_id())
  AND (has_org_role(auth.uid(), organization_id, 'owner') OR has_org_role(auth.uid(), organization_id, 'admin'))
);

-- Owner/Admin can update teams
CREATE POLICY "Admins can update teams"
ON public.teams FOR UPDATE
USING (
  (organization_id = get_active_org_id())
  AND (has_org_role(auth.uid(), organization_id, 'owner') OR has_org_role(auth.uid(), organization_id, 'admin'))
);

-- Owner/Admin can delete teams
CREATE POLICY "Admins can delete teams"
ON public.teams FOR DELETE
USING (
  (organization_id = get_active_org_id())
  AND (has_org_role(auth.uid(), organization_id, 'owner') OR has_org_role(auth.uid(), organization_id, 'admin'))
);

-- Team members table
CREATE TABLE public.team_members (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  role text NOT NULL DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(team_id, user_id)
);

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- Non-client org members can view team members
CREATE POLICY "Org members can view team members"
ON public.team_members FOR SELECT
USING (
  (organization_id = get_active_org_id())
  AND (NOT has_org_role(auth.uid(), organization_id, 'client'))
);

-- Owner/Admin can manage team members
CREATE POLICY "Admins can create team members"
ON public.team_members FOR INSERT
WITH CHECK (
  (organization_id = get_active_org_id())
  AND (has_org_role(auth.uid(), organization_id, 'owner') OR has_org_role(auth.uid(), organization_id, 'admin'))
);

CREATE POLICY "Admins can delete team members"
ON public.team_members FOR DELETE
USING (
  (organization_id = get_active_org_id())
  AND (has_org_role(auth.uid(), organization_id, 'owner') OR has_org_role(auth.uid(), organization_id, 'admin'))
);

-- Triggers for updated_at
CREATE TRIGGER update_teams_updated_at
  BEFORE UPDATE ON public.teams
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Indexes
CREATE INDEX idx_teams_org ON public.teams(organization_id);
CREATE INDEX idx_team_members_team ON public.team_members(team_id);
CREATE INDEX idx_team_members_user ON public.team_members(user_id);
CREATE INDEX idx_contracts_responsible ON public.contracts(responsible_id);