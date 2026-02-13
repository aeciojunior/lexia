
-- =====================================================
-- RF-041: Integrações Externas
-- =====================================================

CREATE TABLE public.integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  provider text NOT NULL,
  category text NOT NULL DEFAULT 'crm',
  status text NOT NULL DEFAULT 'inactive',
  config jsonb DEFAULT '{}'::jsonb,
  credentials_encrypted jsonb DEFAULT '{}'::jsonb,
  last_sync_at timestamptz DEFAULT NULL,
  sync_frequency text DEFAULT 'manual',
  field_mapping jsonb DEFAULT '{}'::jsonb,
  webhook_url text DEFAULT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org owner/admin can manage integrations" ON public.integrations
  FOR ALL USING (
    organization_id = get_active_org_id()
    AND (has_org_role(auth.uid(), organization_id, 'owner') OR has_org_role(auth.uid(), organization_id, 'admin'))
  );

CREATE TRIGGER update_integrations_updated_at BEFORE UPDATE ON public.integrations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Integration sync logs
CREATE TABLE public.integration_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  integration_id uuid NOT NULL REFERENCES public.integrations(id) ON DELETE CASCADE,
  action text NOT NULL DEFAULT 'sync',
  status text NOT NULL DEFAULT 'success',
  records_synced integer DEFAULT 0,
  error_message text DEFAULT NULL,
  details jsonb DEFAULT '{}'::jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.integration_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org owner/admin can view integration logs" ON public.integration_logs
  FOR ALL USING (
    organization_id = get_active_org_id()
    AND (has_org_role(auth.uid(), organization_id, 'owner') OR has_org_role(auth.uid(), organization_id, 'admin'))
  );

-- =====================================================
-- RF-042: Regras de Notificação Avançadas
-- =====================================================

CREATE TABLE public.notification_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text DEFAULT NULL,
  trigger_event text NOT NULL,
  conditions jsonb DEFAULT '{}'::jsonb,
  actions jsonb DEFAULT '[]'::jsonb,
  channels text[] DEFAULT '{email}'::text[],
  template text DEFAULT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org owner/admin can manage notification rules" ON public.notification_rules
  FOR ALL USING (
    organization_id = get_active_org_id()
    AND (has_org_role(auth.uid(), organization_id, 'owner') OR has_org_role(auth.uid(), organization_id, 'admin'))
  );

CREATE POLICY "Org members can view notification rules" ON public.notification_rules
  FOR SELECT USING (organization_id = get_active_org_id());

CREATE TRIGGER update_notification_rules_updated_at BEFORE UPDATE ON public.notification_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Notification rule execution logs
CREATE TABLE public.notification_rule_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  rule_id uuid NOT NULL REFERENCES public.notification_rules(id) ON DELETE CASCADE,
  trigger_data jsonb DEFAULT '{}'::jsonb,
  channels_used text[] DEFAULT '{}'::text[],
  status text NOT NULL DEFAULT 'sent',
  error_message text DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_rule_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org owner/admin can view notification rule logs" ON public.notification_rule_logs
  FOR SELECT USING (
    organization_id = get_active_org_id()
    AND (has_org_role(auth.uid(), organization_id, 'owner') OR has_org_role(auth.uid(), organization_id, 'admin'))
  );

-- =====================================================
-- RF-043: Inteligência Jurídica Preditiva
-- =====================================================

CREATE TABLE public.predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  prediction_type text NOT NULL DEFAULT 'risk_analysis',
  target_type text NOT NULL DEFAULT 'process',
  target_id uuid DEFAULT NULL,
  input_data jsonb DEFAULT '{}'::jsonb,
  result jsonb DEFAULT '{}'::jsonb,
  ai_explanation text DEFAULT NULL,
  confidence_score numeric(5,2) DEFAULT NULL,
  status text NOT NULL DEFAULT 'pending',
  generated_at timestamptz DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.predictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org admins can manage predictions" ON public.predictions
  FOR ALL USING (
    organization_id = get_active_org_id()
    AND (has_org_role(auth.uid(), organization_id, 'owner') OR has_org_role(auth.uid(), organization_id, 'admin'))
  );

CREATE POLICY "Users can view own predictions" ON public.predictions
  FOR SELECT USING (
    organization_id = get_active_org_id()
    AND auth.uid() = user_id
  );

CREATE POLICY "Non-client can create predictions" ON public.predictions
  FOR INSERT WITH CHECK (
    organization_id = get_active_org_id()
    AND auth.uid() = user_id
    AND NOT has_org_role(auth.uid(), organization_id, 'client')
  );

CREATE TRIGGER update_predictions_updated_at BEFORE UPDATE ON public.predictions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
