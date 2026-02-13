
-- ============================================================
-- RF-053: OKRs & KPIs
-- ============================================================

-- OKRs table
CREATE TABLE public.okrs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  title text NOT NULL,
  description text,
  owner_id uuid NOT NULL,
  team_id uuid,
  period_start date NOT NULL,
  period_end date NOT NULL,
  status text NOT NULL DEFAULT 'active',
  progress numeric(5,2) NOT NULL DEFAULT 0,
  parent_id uuid REFERENCES public.okrs(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.okrs ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_okrs_updated_at BEFORE UPDATE ON public.okrs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- OKR Key Results
CREATE TABLE public.okr_key_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  okr_id uuid NOT NULL REFERENCES public.okrs(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  title text NOT NULL,
  metric_type text NOT NULL DEFAULT 'percentage',
  target_value numeric NOT NULL DEFAULT 100,
  current_value numeric NOT NULL DEFAULT 0,
  unit text DEFAULT '%',
  responsible_id uuid,
  status text NOT NULL DEFAULT 'on_track',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.okr_key_results ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_okr_kr_updated_at BEFORE UPDATE ON public.okr_key_results
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- KPIs table
CREATE TABLE public.kpis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  name text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'operational',
  metric_type text NOT NULL DEFAULT 'number',
  target_value numeric,
  current_value numeric NOT NULL DEFAULT 0,
  unit text,
  frequency text NOT NULL DEFAULT 'monthly',
  owner_id uuid,
  team_id uuid,
  data_source text,
  status text NOT NULL DEFAULT 'active',
  alert_threshold_warning numeric,
  alert_threshold_critical numeric,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.kpis ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_kpis_updated_at BEFORE UPDATE ON public.kpis
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- KPI History for tracking over time
CREATE TABLE public.kpi_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kpi_id uuid NOT NULL REFERENCES public.kpis(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  value numeric NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  recorded_by uuid,
  notes text
);

ALTER TABLE public.kpi_history ENABLE ROW LEVEL SECURITY;

-- RLS for OKRs
CREATE POLICY "Org members can view okrs" ON public.okrs
FOR SELECT USING (organization_id = get_active_org_id());

CREATE POLICY "Admins can create okrs" ON public.okrs
FOR INSERT WITH CHECK (
  organization_id = get_active_org_id()
  AND (has_org_role(auth.uid(), organization_id, 'owner') OR has_org_role(auth.uid(), organization_id, 'admin'))
);

CREATE POLICY "Admins can update okrs" ON public.okrs
FOR UPDATE USING (
  organization_id = get_active_org_id()
  AND (has_org_role(auth.uid(), organization_id, 'owner') OR has_org_role(auth.uid(), organization_id, 'admin'))
);

CREATE POLICY "Admins can delete okrs" ON public.okrs
FOR DELETE USING (
  organization_id = get_active_org_id()
  AND (has_org_role(auth.uid(), organization_id, 'owner') OR has_org_role(auth.uid(), organization_id, 'admin'))
);

-- RLS for Key Results
CREATE POLICY "Org members can view key results" ON public.okr_key_results
FOR SELECT USING (organization_id = get_active_org_id());

CREATE POLICY "Admins can manage key results" ON public.okr_key_results
FOR ALL USING (
  organization_id = get_active_org_id()
  AND (has_org_role(auth.uid(), organization_id, 'owner') OR has_org_role(auth.uid(), organization_id, 'admin'))
);

-- RLS for KPIs
CREATE POLICY "Org members can view kpis" ON public.kpis
FOR SELECT USING (organization_id = get_active_org_id());

CREATE POLICY "Admins can create kpis" ON public.kpis
FOR INSERT WITH CHECK (
  organization_id = get_active_org_id()
  AND (has_org_role(auth.uid(), organization_id, 'owner') OR has_org_role(auth.uid(), organization_id, 'admin'))
);

CREATE POLICY "Admins can update kpis" ON public.kpis
FOR UPDATE USING (
  organization_id = get_active_org_id()
  AND (has_org_role(auth.uid(), organization_id, 'owner') OR has_org_role(auth.uid(), organization_id, 'admin'))
);

CREATE POLICY "Admins can delete kpis" ON public.kpis
FOR DELETE USING (
  organization_id = get_active_org_id()
  AND (has_org_role(auth.uid(), organization_id, 'owner') OR has_org_role(auth.uid(), organization_id, 'admin'))
);

-- RLS for KPI History
CREATE POLICY "Org members can view kpi history" ON public.kpi_history
FOR SELECT USING (organization_id = get_active_org_id());

CREATE POLICY "Admins can manage kpi history" ON public.kpi_history
FOR ALL USING (
  organization_id = get_active_org_id()
  AND (has_org_role(auth.uid(), organization_id, 'owner') OR has_org_role(auth.uid(), organization_id, 'admin'))
);

-- ============================================================
-- RF-054: Governance
-- ============================================================

-- Governance Committees
CREATE TABLE public.governance_committees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  name text NOT NULL,
  description text,
  purpose text,
  chair_id uuid,
  members uuid[] DEFAULT '{}'::uuid[],
  status text NOT NULL DEFAULT 'active',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.governance_committees ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_gov_committees_updated_at BEFORE UPDATE ON public.governance_committees
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Governance Meetings
CREATE TABLE public.governance_meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  committee_id uuid REFERENCES public.governance_committees(id),
  title text NOT NULL,
  description text,
  meeting_date timestamptz NOT NULL,
  location text,
  video_link text,
  attendees uuid[] DEFAULT '{}'::uuid[],
  minutes text,
  attachments jsonb DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'scheduled',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.governance_meetings ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_gov_meetings_updated_at BEFORE UPDATE ON public.governance_meetings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Governance Decisions
CREATE TABLE public.governance_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  meeting_id uuid REFERENCES public.governance_meetings(id),
  committee_id uuid REFERENCES public.governance_committees(id),
  title text NOT NULL,
  description text,
  decision_type text NOT NULL DEFAULT 'resolution',
  responsible_ids uuid[] DEFAULT '{}'::uuid[],
  deadline date,
  status text NOT NULL DEFAULT 'pending',
  priority text NOT NULL DEFAULT 'medium',
  implementation_notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.governance_decisions ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_gov_decisions_updated_at BEFORE UPDATE ON public.governance_decisions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- RLS for Governance Committees
CREATE POLICY "Non-client org members can view committees" ON public.governance_committees
FOR SELECT USING (
  organization_id = get_active_org_id()
  AND NOT has_org_role(auth.uid(), organization_id, 'client')
);

CREATE POLICY "Admins can manage committees" ON public.governance_committees
FOR ALL USING (
  organization_id = get_active_org_id()
  AND (has_org_role(auth.uid(), organization_id, 'owner') OR has_org_role(auth.uid(), organization_id, 'admin'))
);

-- RLS for Governance Meetings
CREATE POLICY "Non-client org members can view meetings" ON public.governance_meetings
FOR SELECT USING (
  organization_id = get_active_org_id()
  AND NOT has_org_role(auth.uid(), organization_id, 'client')
);

CREATE POLICY "Admins can manage meetings" ON public.governance_meetings
FOR ALL USING (
  organization_id = get_active_org_id()
  AND (has_org_role(auth.uid(), organization_id, 'owner') OR has_org_role(auth.uid(), organization_id, 'admin'))
);

-- RLS for Governance Decisions
CREATE POLICY "Non-client org members can view decisions" ON public.governance_decisions
FOR SELECT USING (
  organization_id = get_active_org_id()
  AND NOT has_org_role(auth.uid(), organization_id, 'client')
);

CREATE POLICY "Admins can manage decisions" ON public.governance_decisions
FOR ALL USING (
  organization_id = get_active_org_id()
  AND (has_org_role(auth.uid(), organization_id, 'owner') OR has_org_role(auth.uid(), organization_id, 'admin'))
);

-- ============================================================
-- RF-055: Vault (Secure Document Storage)
-- ============================================================

CREATE TABLE public.vault_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  title text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'confidential',
  classification text NOT NULL DEFAULT 'restricted',
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_type text,
  file_size bigint,
  uploaded_by uuid NOT NULL,
  access_level text NOT NULL DEFAULT 'restricted',
  allowed_users uuid[] DEFAULT '{}'::uuid[],
  allowed_teams uuid[] DEFAULT '{}'::uuid[],
  view_only boolean NOT NULL DEFAULT true,
  version integer NOT NULL DEFAULT 1,
  tags text[] DEFAULT '{}'::text[],
  metadata jsonb DEFAULT '{}'::jsonb,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.vault_documents ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_vault_docs_updated_at BEFORE UPDATE ON public.vault_documents
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Vault Access Log (immutable)
CREATE TABLE public.vault_access_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  document_id uuid NOT NULL REFERENCES public.vault_documents(id),
  user_id uuid NOT NULL,
  action text NOT NULL,
  ip_address text,
  user_agent text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.vault_access_logs ENABLE ROW LEVEL SECURITY;

-- RLS for Vault Documents
CREATE POLICY "Admins can view all vault docs" ON public.vault_documents
FOR SELECT USING (
  organization_id = get_active_org_id()
  AND (has_org_role(auth.uid(), organization_id, 'owner') OR has_org_role(auth.uid(), organization_id, 'admin'))
);

CREATE POLICY "Authorized users can view vault docs" ON public.vault_documents
FOR SELECT USING (
  organization_id = get_active_org_id()
  AND auth.uid() = ANY(allowed_users)
);

CREATE POLICY "Admins can create vault docs" ON public.vault_documents
FOR INSERT WITH CHECK (
  organization_id = get_active_org_id()
  AND (has_org_role(auth.uid(), organization_id, 'owner') OR has_org_role(auth.uid(), organization_id, 'admin'))
);

CREATE POLICY "Admins can update vault docs" ON public.vault_documents
FOR UPDATE USING (
  organization_id = get_active_org_id()
  AND (has_org_role(auth.uid(), organization_id, 'owner') OR has_org_role(auth.uid(), organization_id, 'admin'))
);

CREATE POLICY "Owner can delete vault docs" ON public.vault_documents
FOR DELETE USING (
  organization_id = get_active_org_id()
  AND has_org_role(auth.uid(), organization_id, 'owner')
);

-- RLS for Vault Access Logs
CREATE POLICY "Admins can view vault access logs" ON public.vault_access_logs
FOR SELECT USING (
  organization_id = get_active_org_id()
  AND (has_org_role(auth.uid(), organization_id, 'owner') OR has_org_role(auth.uid(), organization_id, 'admin'))
);

CREATE POLICY "Authenticated can insert vault access logs" ON public.vault_access_logs
FOR INSERT WITH CHECK (
  organization_id = get_active_org_id()
  AND auth.uid() = user_id
);

-- ============================================================
-- Storage bucket for vault
-- ============================================================
INSERT INTO storage.buckets (id, name, public) VALUES ('vault', 'vault', false);

CREATE POLICY "Admins can upload vault files" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'vault'
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Admins can view vault files" ON storage.objects
FOR SELECT USING (
  bucket_id = 'vault'
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Admins can delete vault files" ON storage.objects
FOR DELETE USING (
  bucket_id = 'vault'
  AND auth.uid() IS NOT NULL
);
