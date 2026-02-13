
-- =====================================================
-- RF-038: Relatórios Jurídicos
-- =====================================================

CREATE TABLE public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  title text NOT NULL,
  report_type text NOT NULL DEFAULT 'process_status',
  config jsonb DEFAULT '{}'::jsonb,
  result_data jsonb DEFAULT NULL,
  ai_summary text DEFAULT NULL,
  format text NOT NULL DEFAULT 'pdf',
  status text NOT NULL DEFAULT 'pending',
  generated_at timestamptz DEFAULT NULL,
  file_url text DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org admins can manage reports" ON public.reports
  FOR ALL USING (
    organization_id = get_active_org_id()
    AND (has_org_role(auth.uid(), organization_id, 'owner') OR has_org_role(auth.uid(), organization_id, 'admin'))
  );

CREATE POLICY "Users can view own reports" ON public.reports
  FOR SELECT USING (
    organization_id = get_active_org_id()
    AND auth.uid() = user_id
  );

CREATE POLICY "Non-client non-intern can create reports" ON public.reports
  FOR INSERT WITH CHECK (
    organization_id = get_active_org_id()
    AND auth.uid() = user_id
    AND NOT has_org_role(auth.uid(), organization_id, 'client')
    AND NOT has_org_role(auth.uid(), organization_id, 'intern')
  );

CREATE TRIGGER update_reports_updated_at BEFORE UPDATE ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Report schedules
CREATE TABLE public.report_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  title text NOT NULL,
  report_type text NOT NULL DEFAULT 'process_status',
  config jsonb DEFAULT '{}'::jsonb,
  frequency text NOT NULL DEFAULT 'weekly',
  next_run_at timestamptz,
  last_run_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.report_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org admins can manage report schedules" ON public.report_schedules
  FOR ALL USING (
    organization_id = get_active_org_id()
    AND (has_org_role(auth.uid(), organization_id, 'owner') OR has_org_role(auth.uid(), organization_id, 'admin'))
  );

CREATE TRIGGER update_report_schedules_updated_at BEFORE UPDATE ON public.report_schedules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- =====================================================
-- RF-039: ACL Granular
-- =====================================================

CREATE TABLE public.acl_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  target_user_id uuid DEFAULT NULL,
  target_team_id uuid DEFAULT NULL,
  resource_type text NOT NULL,
  resource_id uuid DEFAULT NULL,
  action text NOT NULL DEFAULT 'view',
  effect text NOT NULL DEFAULT 'allow',
  conditions jsonb DEFAULT '{}'::jsonb,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.acl_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org owner/admin can manage ACL" ON public.acl_rules
  FOR ALL USING (
    organization_id = get_active_org_id()
    AND (has_org_role(auth.uid(), organization_id, 'owner') OR has_org_role(auth.uid(), organization_id, 'admin'))
  );

CREATE TRIGGER update_acl_rules_updated_at BEFORE UPDATE ON public.acl_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- =====================================================
-- RF-040: Compliance / LGPD
-- =====================================================

-- Policies
CREATE TABLE public.compliance_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title text NOT NULL,
  policy_type text NOT NULL DEFAULT 'privacy',
  content text NOT NULL DEFAULT '',
  version integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  updated_by uuid DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.compliance_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org owner/admin can manage compliance policies" ON public.compliance_policies
  FOR ALL USING (
    organization_id = get_active_org_id()
    AND (has_org_role(auth.uid(), organization_id, 'owner') OR has_org_role(auth.uid(), organization_id, 'admin'))
  );

CREATE POLICY "Org members can view compliance policies" ON public.compliance_policies
  FOR SELECT USING (organization_id = get_active_org_id());

CREATE TRIGGER update_compliance_policies_updated_at BEFORE UPDATE ON public.compliance_policies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Consents
CREATE TABLE public.compliance_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  consent_type text NOT NULL DEFAULT 'data_processing',
  description text DEFAULT NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz DEFAULT NULL,
  status text NOT NULL DEFAULT 'active',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.compliance_consents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org owner/admin can manage consents" ON public.compliance_consents
  FOR ALL USING (
    organization_id = get_active_org_id()
    AND (has_org_role(auth.uid(), organization_id, 'owner') OR has_org_role(auth.uid(), organization_id, 'admin'))
  );

CREATE POLICY "Org members can view consents" ON public.compliance_consents
  FOR SELECT USING (organization_id = get_active_org_id());

CREATE TRIGGER update_compliance_consents_updated_at BEFORE UPDATE ON public.compliance_consents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- DSAR Requests
CREATE TABLE public.dsar_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  requester_name text NOT NULL,
  requester_email text NOT NULL,
  request_type text NOT NULL DEFAULT 'access',
  description text DEFAULT NULL,
  status text NOT NULL DEFAULT 'pending',
  response text DEFAULT NULL,
  responded_at timestamptz DEFAULT NULL,
  responded_by uuid DEFAULT NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.dsar_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org owner/admin can manage DSAR" ON public.dsar_requests
  FOR ALL USING (
    organization_id = get_active_org_id()
    AND (has_org_role(auth.uid(), organization_id, 'owner') OR has_org_role(auth.uid(), organization_id, 'admin'))
  );

CREATE TRIGGER update_dsar_requests_updated_at BEFORE UPDATE ON public.dsar_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Incidents
CREATE TABLE public.compliance_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text DEFAULT NULL,
  severity text NOT NULL DEFAULT 'medium',
  category text NOT NULL DEFAULT 'data_breach',
  impact text DEFAULT NULL,
  measures_taken text DEFAULT NULL,
  status text NOT NULL DEFAULT 'open',
  reported_by uuid NOT NULL,
  resolved_at timestamptz DEFAULT NULL,
  resolved_by uuid DEFAULT NULL,
  notified_authority boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.compliance_incidents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org owner/admin can manage incidents" ON public.compliance_incidents
  FOR ALL USING (
    organization_id = get_active_org_id()
    AND (has_org_role(auth.uid(), organization_id, 'owner') OR has_org_role(auth.uid(), organization_id, 'admin'))
  );

CREATE POLICY "Org members can view incidents" ON public.compliance_incidents
  FOR SELECT USING (organization_id = get_active_org_id());

CREATE TRIGGER update_compliance_incidents_updated_at BEFORE UPDATE ON public.compliance_incidents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
