
-- =============================================
-- RF-035: Agenda Events
-- =============================================
CREATE TABLE public.agenda_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  event_type text NOT NULL DEFAULT 'meeting',
  start_at timestamptz NOT NULL,
  end_at timestamptz,
  all_day boolean NOT NULL DEFAULT false,
  location text,
  video_link text,
  priority text NOT NULL DEFAULT 'medium',
  status text NOT NULL DEFAULT 'scheduled',
  process_id uuid REFERENCES public.processes(id) ON DELETE SET NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  participants uuid[] DEFAULT '{}',
  reminders jsonb DEFAULT '["24h","1h"]',
  source text NOT NULL DEFAULT 'manual',
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.agenda_events ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_agenda_events_updated_at
  BEFORE UPDATE ON public.agenda_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- RLS: Org members can view
CREATE POLICY "Org members can view agenda events"
  ON public.agenda_events FOR SELECT
  USING (organization_id = get_active_org_id());

-- RLS: Owner/Admin/User can create
CREATE POLICY "Non-client non-intern can create agenda events"
  ON public.agenda_events FOR INSERT
  WITH CHECK (
    organization_id = get_active_org_id()
    AND NOT has_org_role(auth.uid(), organization_id, 'client')
    AND NOT has_org_role(auth.uid(), organization_id, 'intern')
  );

-- RLS: Owner/Admin/User can update (intern only own assigned)
CREATE POLICY "Non-client can update agenda events"
  ON public.agenda_events FOR UPDATE
  USING (
    organization_id = get_active_org_id()
    AND NOT has_org_role(auth.uid(), organization_id, 'client')
  );

-- RLS: Owner/Admin can delete
CREATE POLICY "Admins can delete agenda events"
  ON public.agenda_events FOR DELETE
  USING (
    organization_id = get_active_org_id()
    AND (has_org_role(auth.uid(), organization_id, 'owner') OR has_org_role(auth.uid(), organization_id, 'admin'))
  );

CREATE INDEX idx_agenda_events_org_date ON public.agenda_events(organization_id, start_at);

-- =============================================
-- RF-036: External Messages
-- =============================================
CREATE TABLE public.external_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  channel text NOT NULL DEFAULT 'email',
  direction text NOT NULL DEFAULT 'outbound',
  subject text,
  body text NOT NULL,
  recipient_email text,
  recipient_phone text,
  recipient_name text,
  attachments jsonb DEFAULT '[]',
  status text NOT NULL DEFAULT 'sent',
  process_id uuid REFERENCES public.processes(id) ON DELETE SET NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  template_id uuid,
  external_id text,
  metadata jsonb,
  sent_at timestamptz,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.external_messages ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_external_messages_updated_at
  BEFORE UPDATE ON public.external_messages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- RLS: Non-client org members can view
CREATE POLICY "Non-client org members can view external messages"
  ON public.external_messages FOR SELECT
  USING (
    organization_id = get_active_org_id()
    AND NOT has_org_role(auth.uid(), organization_id, 'client')
  );

-- RLS: Owner/Admin/User can create
CREATE POLICY "Non-client non-intern can create external messages"
  ON public.external_messages FOR INSERT
  WITH CHECK (
    organization_id = get_active_org_id()
    AND NOT has_org_role(auth.uid(), organization_id, 'client')
    AND NOT has_org_role(auth.uid(), organization_id, 'intern')
  );

-- RLS: Owner/Admin can update
CREATE POLICY "Admins can update external messages"
  ON public.external_messages FOR UPDATE
  USING (
    organization_id = get_active_org_id()
    AND (has_org_role(auth.uid(), organization_id, 'owner') OR has_org_role(auth.uid(), organization_id, 'admin'))
  );

CREATE INDEX idx_external_messages_org ON public.external_messages(organization_id, created_at DESC);
CREATE INDEX idx_external_messages_client ON public.external_messages(client_id);

-- =============================================
-- RF-037: AI Templates
-- =============================================
CREATE TABLE public.ai_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title text NOT NULL,
  template_type text NOT NULL DEFAULT 'general',
  content text NOT NULL DEFAULT '',
  description text,
  version integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  tags text[] DEFAULT '{}',
  created_by uuid NOT NULL,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_templates ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_ai_templates_updated_at
  BEFORE UPDATE ON public.ai_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Version history
CREATE TABLE public.ai_template_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.ai_templates(id) ON DELETE CASCADE,
  version integer NOT NULL,
  content text NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_template_versions ENABLE ROW LEVEL SECURITY;

-- RLS ai_templates: Non-client can view
CREATE POLICY "Non-client org members can view ai templates"
  ON public.ai_templates FOR SELECT
  USING (
    organization_id = get_active_org_id()
    AND NOT has_org_role(auth.uid(), organization_id, 'client')
  );

-- RLS: Owner/Admin can create
CREATE POLICY "Admins can create ai templates"
  ON public.ai_templates FOR INSERT
  WITH CHECK (
    organization_id = get_active_org_id()
    AND (has_org_role(auth.uid(), organization_id, 'owner') OR has_org_role(auth.uid(), organization_id, 'admin'))
  );

-- RLS: Owner/Admin can update
CREATE POLICY "Admins can update ai templates"
  ON public.ai_templates FOR UPDATE
  USING (
    organization_id = get_active_org_id()
    AND (has_org_role(auth.uid(), organization_id, 'owner') OR has_org_role(auth.uid(), organization_id, 'admin'))
  );

-- RLS: Owner/Admin can delete
CREATE POLICY "Admins can delete ai templates"
  ON public.ai_templates FOR DELETE
  USING (
    organization_id = get_active_org_id()
    AND (has_org_role(auth.uid(), organization_id, 'owner') OR has_org_role(auth.uid(), organization_id, 'admin'))
  );

-- RLS ai_template_versions: Non-client can view
CREATE POLICY "Non-client org members can view ai template versions"
  ON public.ai_template_versions FOR SELECT
  USING (
    template_id IN (
      SELECT id FROM public.ai_templates WHERE organization_id = get_active_org_id()
    )
  );

-- RLS: Admins can create versions
CREATE POLICY "Admins can create ai template versions"
  ON public.ai_template_versions FOR INSERT
  WITH CHECK (
    template_id IN (
      SELECT id FROM public.ai_templates 
      WHERE organization_id = get_active_org_id()
      AND (has_org_role(auth.uid(), organization_id, 'owner') OR has_org_role(auth.uid(), organization_id, 'admin'))
    )
  );

CREATE INDEX idx_ai_templates_org ON public.ai_templates(organization_id);
CREATE INDEX idx_ai_template_versions_template ON public.ai_template_versions(template_id, version DESC);
