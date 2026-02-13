
-- RF-047: SLA Policies
CREATE TABLE public.sla_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  name text NOT NULL,
  description text,
  resource_type text NOT NULL DEFAULT 'ticket',
  max_response_hours integer,
  max_resolution_hours integer,
  priority_filter text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.sla_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org owner/admin can manage SLA policies" ON public.sla_policies FOR ALL
  USING (organization_id = get_active_org_id() AND (has_org_role(auth.uid(), organization_id, 'owner') OR has_org_role(auth.uid(), organization_id, 'admin')));
CREATE POLICY "Non-client org members can view SLA policies" ON public.sla_policies FOR SELECT
  USING (organization_id = get_active_org_id() AND NOT has_org_role(auth.uid(), organization_id, 'client'));

CREATE TABLE public.sla_violations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  sla_policy_id uuid NOT NULL REFERENCES public.sla_policies(id) ON DELETE CASCADE,
  resource_type text NOT NULL,
  resource_id uuid NOT NULL,
  violation_type text NOT NULL DEFAULT 'resolution',
  exceeded_by_hours numeric(10,2),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.sla_violations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org owner/admin can manage SLA violations" ON public.sla_violations FOR ALL
  USING (organization_id = get_active_org_id() AND (has_org_role(auth.uid(), organization_id, 'owner') OR has_org_role(auth.uid(), organization_id, 'admin')));
CREATE POLICY "Non-client org members can view SLA violations" ON public.sla_violations FOR SELECT
  USING (organization_id = get_active_org_id() AND NOT has_org_role(auth.uid(), organization_id, 'client'));

-- RF-049: Risks
CREATE TABLE public.risks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  title text NOT NULL,
  description text,
  risk_type text NOT NULL DEFAULT 'legal',
  probability text NOT NULL DEFAULT 'medium',
  impact text NOT NULL DEFAULT 'medium',
  risk_level text NOT NULL DEFAULT 'medium',
  status text NOT NULL DEFAULT 'open',
  mitigation_plan text,
  responsible_id uuid,
  process_id uuid REFERENCES public.processes(id),
  contract_id uuid REFERENCES public.contracts(id),
  created_by uuid NOT NULL,
  resolved_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.risks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org owner/admin can manage risks" ON public.risks FOR ALL
  USING (organization_id = get_active_org_id() AND (has_org_role(auth.uid(), organization_id, 'owner') OR has_org_role(auth.uid(), organization_id, 'admin')));
CREATE POLICY "Non-client org members can view risks" ON public.risks FOR SELECT
  USING (organization_id = get_active_org_id() AND NOT has_org_role(auth.uid(), organization_id, 'client'));

-- Triggers
CREATE TRIGGER update_sla_policies_updated_at BEFORE UPDATE ON public.sla_policies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_risks_updated_at BEFORE UPDATE ON public.risks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
