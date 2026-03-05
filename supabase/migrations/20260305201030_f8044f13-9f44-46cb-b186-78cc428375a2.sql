
-- RF-060/061/064: Court Monitoring
CREATE TABLE public.court_monitoring_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  name TEXT NOT NULL,
  themes TEXT[] DEFAULT '{}',
  keywords TEXT[] DEFAULT '{}',
  legal_areas TEXT[] DEFAULT '{}',
  courts TEXT[] DEFAULT '{}',
  chambers TEXT[] DEFAULT '{}',
  decision_types TEXT[] DEFAULT '{}',
  frequency TEXT NOT NULL DEFAULT 'daily',
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.court_monitoring_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  config_id UUID REFERENCES public.court_monitoring_configs(id) ON DELETE SET NULL,
  tribunal TEXT NOT NULL,
  chamber TEXT,
  decision_date TIMESTAMPTZ,
  decision_number TEXT,
  summary TEXT,
  thesis TEXT,
  full_text TEXT,
  relevance_level TEXT NOT NULL DEFAULT 'medium',
  impact_level TEXT NOT NULL DEFAULT 'medium',
  matched_themes TEXT[] DEFAULT '{}',
  matched_keywords TEXT[] DEFAULT '{}',
  related_process_id UUID REFERENCES public.processes(id) ON DELETE SET NULL,
  ai_recommendation TEXT,
  alert_sent BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'new',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RF-062: Legislative Updates
CREATE TABLE public.legislative_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  norm_type TEXT NOT NULL DEFAULT 'lei_federal',
  norm_identifier TEXT NOT NULL,
  norm_title TEXT NOT NULL,
  change_type TEXT NOT NULL DEFAULT 'creation',
  old_text TEXT,
  new_text TEXT,
  summary TEXT,
  impact_analysis JSONB DEFAULT '{}',
  affected_areas TEXT[] DEFAULT '{}',
  affected_client_ids UUID[] DEFAULT '{}',
  scenarios JSONB DEFAULT '[]',
  recommendations TEXT,
  urgency TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'new',
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RF-065: Regulatory Updates
CREATE TABLE public.regulatory_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  agency TEXT NOT NULL,
  norm_identifier TEXT NOT NULL,
  norm_title TEXT NOT NULL,
  change_type TEXT NOT NULL DEFAULT 'creation',
  summary TEXT,
  impact_analysis JSONB DEFAULT '{}',
  affected_sectors TEXT[] DEFAULT '{}',
  affected_client_ids UUID[] DEFAULT '{}',
  recommendations TEXT,
  urgency TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'new',
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- updated_at triggers
CREATE TRIGGER set_updated_at_court_monitoring_configs BEFORE UPDATE ON public.court_monitoring_configs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at_court_monitoring_decisions BEFORE UPDATE ON public.court_monitoring_decisions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at_legislative_updates BEFORE UPDATE ON public.legislative_updates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at_regulatory_updates BEFORE UPDATE ON public.regulatory_updates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- RLS policies
ALTER TABLE public.court_monitoring_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.court_monitoring_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legislative_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.regulatory_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_member_select_court_monitoring_configs" ON public.court_monitoring_configs FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "org_member_insert_court_monitoring_configs" ON public.court_monitoring_configs FOR INSERT TO authenticated WITH CHECK (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "org_member_update_court_monitoring_configs" ON public.court_monitoring_configs FOR UPDATE TO authenticated USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "org_member_delete_court_monitoring_configs" ON public.court_monitoring_configs FOR DELETE TO authenticated USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "org_member_select_court_monitoring_decisions" ON public.court_monitoring_decisions FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "org_member_insert_court_monitoring_decisions" ON public.court_monitoring_decisions FOR INSERT TO authenticated WITH CHECK (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "org_member_update_court_monitoring_decisions" ON public.court_monitoring_decisions FOR UPDATE TO authenticated USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "org_member_select_legislative_updates" ON public.legislative_updates FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "org_member_insert_legislative_updates" ON public.legislative_updates FOR INSERT TO authenticated WITH CHECK (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "org_member_update_legislative_updates" ON public.legislative_updates FOR UPDATE TO authenticated USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "org_member_select_regulatory_updates" ON public.regulatory_updates FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "org_member_insert_regulatory_updates" ON public.regulatory_updates FOR INSERT TO authenticated WITH CHECK (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "org_member_update_regulatory_updates" ON public.regulatory_updates FOR UPDATE TO authenticated USING (public.is_org_member(auth.uid(), organization_id));
