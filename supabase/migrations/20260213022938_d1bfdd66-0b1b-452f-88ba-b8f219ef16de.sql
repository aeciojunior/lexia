
-- =============================================================
-- RF-056: Secret Manager
-- =============================================================

CREATE TABLE public.org_secrets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  secret_type text NOT NULL DEFAULT 'api_token',
  encrypted_value text NOT NULL,
  metadata jsonb DEFAULT '{}',
  version integer NOT NULL DEFAULT 1,
  expires_at timestamptz,
  rotated_at timestamptz,
  allowed_users uuid[] DEFAULT '{}',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.org_secrets ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_org_secrets_updated_at BEFORE UPDATE ON public.org_secrets
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE UNIQUE INDEX idx_org_secrets_name_org ON public.org_secrets(organization_id, name);

-- Owner/Admin full access
CREATE POLICY "org_secrets_select" ON public.org_secrets FOR SELECT
  USING (
    organization_id = public.get_active_org_id()
    AND (
      public.has_org_role(auth.uid(), organization_id, 'owner')
      OR public.has_org_role(auth.uid(), organization_id, 'admin')
      OR auth.uid() = ANY(allowed_users)
    )
  );

CREATE POLICY "org_secrets_insert" ON public.org_secrets FOR INSERT
  WITH CHECK (
    organization_id = public.get_active_org_id()
    AND (
      public.has_org_role(auth.uid(), organization_id, 'owner')
      OR public.has_org_role(auth.uid(), organization_id, 'admin')
    )
  );

CREATE POLICY "org_secrets_update" ON public.org_secrets FOR UPDATE
  USING (
    organization_id = public.get_active_org_id()
    AND (
      public.has_org_role(auth.uid(), organization_id, 'owner')
      OR public.has_org_role(auth.uid(), organization_id, 'admin')
    )
  );

CREATE POLICY "org_secrets_delete" ON public.org_secrets FOR DELETE
  USING (
    organization_id = public.get_active_org_id()
    AND public.has_org_role(auth.uid(), organization_id, 'owner')
  );

-- Secret access logs (immutable)
CREATE TABLE public.secret_access_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  secret_id uuid NOT NULL REFERENCES public.org_secrets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  action text NOT NULL,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.secret_access_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "secret_access_logs_select" ON public.secret_access_logs FOR SELECT
  USING (
    organization_id = public.get_active_org_id()
    AND (
      public.has_org_role(auth.uid(), organization_id, 'owner')
      OR public.has_org_role(auth.uid(), organization_id, 'admin')
    )
  );

CREATE POLICY "secret_access_logs_insert" ON public.secret_access_logs FOR INSERT
  WITH CHECK (organization_id = public.get_active_org_id());

-- =============================================================
-- RF-057: AI Reports
-- =============================================================

CREATE TABLE public.ai_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title text NOT NULL,
  report_type text NOT NULL DEFAULT 'operational',
  content text,
  summary text,
  data_snapshot jsonb DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending',
  generated_at timestamptz,
  scheduled_cron text,
  is_scheduled boolean NOT NULL DEFAULT false,
  recipients text[] DEFAULT '{}',
  delivery_channel text DEFAULT 'in_app',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_reports ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_ai_reports_updated_at BEFORE UPDATE ON public.ai_reports
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE INDEX idx_ai_reports_org_type ON public.ai_reports(organization_id, report_type);

CREATE POLICY "ai_reports_select" ON public.ai_reports FOR SELECT
  USING (
    organization_id = public.get_active_org_id()
    AND public.is_org_member(auth.uid(), organization_id)
  );

CREATE POLICY "ai_reports_insert" ON public.ai_reports FOR INSERT
  WITH CHECK (
    organization_id = public.get_active_org_id()
    AND (
      public.has_org_role(auth.uid(), organization_id, 'owner')
      OR public.has_org_role(auth.uid(), organization_id, 'admin')
      OR public.has_org_role(auth.uid(), organization_id, 'user')
    )
  );

CREATE POLICY "ai_reports_update" ON public.ai_reports FOR UPDATE
  USING (
    organization_id = public.get_active_org_id()
    AND (
      public.has_org_role(auth.uid(), organization_id, 'owner')
      OR public.has_org_role(auth.uid(), organization_id, 'admin')
    )
  );

CREATE POLICY "ai_reports_delete" ON public.ai_reports FOR DELETE
  USING (
    organization_id = public.get_active_org_id()
    AND (
      public.has_org_role(auth.uid(), organization_id, 'owner')
      OR public.has_org_role(auth.uid(), organization_id, 'admin')
    )
  );

-- AI Report templates
CREATE TABLE public.ai_report_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title text NOT NULL,
  report_type text NOT NULL DEFAULT 'operational',
  prompt_template text NOT NULL,
  sections jsonb DEFAULT '[]',
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_report_templates ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_ai_report_templates_updated_at BEFORE UPDATE ON public.ai_report_templates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE POLICY "ai_report_templates_select" ON public.ai_report_templates FOR SELECT
  USING (
    organization_id = public.get_active_org_id()
    AND public.is_org_member(auth.uid(), organization_id)
  );

CREATE POLICY "ai_report_templates_manage" ON public.ai_report_templates FOR ALL
  USING (
    organization_id = public.get_active_org_id()
    AND (
      public.has_org_role(auth.uid(), organization_id, 'owner')
      OR public.has_org_role(auth.uid(), organization_id, 'admin')
    )
  );

-- =============================================================
-- RF-058: Security Logs (SIEM)
-- =============================================================

CREATE TABLE public.security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  severity text NOT NULL DEFAULT 'info',
  source text NOT NULL DEFAULT 'system',
  user_id uuid,
  ip_address text,
  user_agent text,
  resource_type text,
  resource_id text,
  description text,
  metadata jsonb DEFAULT '{}',
  is_anomaly boolean NOT NULL DEFAULT false,
  resolved_at timestamptz,
  resolved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_security_events_org_type ON public.security_events(organization_id, event_type);
CREATE INDEX idx_security_events_severity ON public.security_events(organization_id, severity);
CREATE INDEX idx_security_events_created ON public.security_events(organization_id, created_at DESC);

CREATE POLICY "security_events_select" ON public.security_events FOR SELECT
  USING (
    organization_id = public.get_active_org_id()
    AND (
      public.has_org_role(auth.uid(), organization_id, 'owner')
      OR public.has_org_role(auth.uid(), organization_id, 'admin')
    )
  );

CREATE POLICY "security_events_insert" ON public.security_events FOR INSERT
  WITH CHECK (organization_id = public.get_active_org_id());

-- Security alerts
CREATE TABLE public.security_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  event_id uuid REFERENCES public.security_events(id) ON DELETE SET NULL,
  alert_type text NOT NULL,
  severity text NOT NULL DEFAULT 'warning',
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'open',
  acknowledged_by uuid,
  acknowledged_at timestamptz,
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.security_alerts ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_security_alerts_updated_at BEFORE UPDATE ON public.security_alerts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE POLICY "security_alerts_select" ON public.security_alerts FOR SELECT
  USING (
    organization_id = public.get_active_org_id()
    AND (
      public.has_org_role(auth.uid(), organization_id, 'owner')
      OR public.has_org_role(auth.uid(), organization_id, 'admin')
    )
  );

CREATE POLICY "security_alerts_manage" ON public.security_alerts FOR ALL
  USING (
    organization_id = public.get_active_org_id()
    AND (
      public.has_org_role(auth.uid(), organization_id, 'owner')
      OR public.has_org_role(auth.uid(), organization_id, 'admin')
    )
  );
