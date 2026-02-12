
-- =============================================
-- RF-023: Hearings (Audiências)
-- =============================================
CREATE TABLE public.hearings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  process_id uuid NOT NULL REFERENCES public.processes(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  user_id uuid NOT NULL,
  responsible_id uuid,
  hearing_date timestamptz NOT NULL,
  location text NOT NULL,
  hearing_type text NOT NULL DEFAULT 'initial',
  status text NOT NULL DEFAULT 'scheduled',
  video_link text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER update_hearings_updated_at BEFORE UPDATE ON public.hearings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE INDEX idx_hearings_process ON public.hearings(process_id);
CREATE INDEX idx_hearings_org ON public.hearings(organization_id);
CREATE INDEX idx_hearings_date ON public.hearings(hearing_date);

ALTER TABLE public.hearings ENABLE ROW LEVEL SECURITY;

-- Org members can view hearings
CREATE POLICY "Org members can view hearings" ON public.hearings
FOR SELECT USING (organization_id = get_active_org_id());

-- Owner/Admin/User can create hearings
CREATE POLICY "Non-client non-intern can create hearings" ON public.hearings
FOR INSERT WITH CHECK (
  organization_id = get_active_org_id()
  AND NOT has_org_role(auth.uid(), organization_id, 'client')
  AND NOT has_org_role(auth.uid(), organization_id, 'intern')
);

-- Owner/Admin/User can update hearings (intern partial handled in app)
CREATE POLICY "Non-client can update hearings" ON public.hearings
FOR UPDATE USING (
  organization_id = get_active_org_id()
  AND NOT has_org_role(auth.uid(), organization_id, 'client')
);

-- Owner/Admin can delete hearings
CREATE POLICY "Admins can delete hearings" ON public.hearings
FOR DELETE USING (
  organization_id = get_active_org_id()
  AND (has_org_role(auth.uid(), organization_id, 'owner') OR has_org_role(auth.uid(), organization_id, 'admin'))
);

-- Client can view hearings of their process
CREATE POLICY "Clients can view own process hearings" ON public.hearings
FOR SELECT USING (
  has_org_role(auth.uid(), organization_id, 'client')
  AND process_id IN (
    SELECT p.id FROM public.processes p
    WHERE p.id = hearings.process_id
    AND EXISTS (
      SELECT 1 FROM public.clients c
      JOIN auth.users u ON lower(u.email) = lower(c.email)
      WHERE u.id = auth.uid()
      AND c.organization_id = hearings.organization_id
      AND lower(c.full_name) = lower(p.client_name)
    )
  )
);

-- =============================================
-- RF-026: Process Movements (Movimentações)
-- =============================================
CREATE TABLE public.process_movements (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  process_id uuid NOT NULL REFERENCES public.processes(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  user_id uuid NOT NULL,
  movement_date timestamptz NOT NULL DEFAULT now(),
  title text NOT NULL,
  description text,
  movement_type text NOT NULL DEFAULT 'despacho',
  origin text NOT NULL DEFAULT 'manual',
  responsible_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER update_process_movements_updated_at BEFORE UPDATE ON public.process_movements
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE INDEX idx_movements_process ON public.process_movements(process_id);
CREATE INDEX idx_movements_org ON public.process_movements(organization_id);

ALTER TABLE public.process_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view movements" ON public.process_movements
FOR SELECT USING (organization_id = get_active_org_id());

CREATE POLICY "Non-client can create movements" ON public.process_movements
FOR INSERT WITH CHECK (
  organization_id = get_active_org_id()
  AND NOT has_org_role(auth.uid(), organization_id, 'client')
);

CREATE POLICY "Non-client non-intern can update movements" ON public.process_movements
FOR UPDATE USING (
  organization_id = get_active_org_id()
  AND NOT has_org_role(auth.uid(), organization_id, 'client')
  AND NOT has_org_role(auth.uid(), organization_id, 'intern')
);

CREATE POLICY "Admins can delete movements" ON public.process_movements
FOR DELETE USING (
  organization_id = get_active_org_id()
  AND (has_org_role(auth.uid(), organization_id, 'owner') OR has_org_role(auth.uid(), organization_id, 'admin'))
);

-- =============================================
-- RF-027: Process Chat Messages
-- =============================================
CREATE TABLE public.process_chat_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  process_id uuid NOT NULL REFERENCES public.processes(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  user_id uuid NOT NULL,
  content text NOT NULL,
  attachment_url text,
  attachment_name text,
  parent_id uuid REFERENCES public.process_chat_messages(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_process_chat_process ON public.process_chat_messages(process_id);
CREATE INDEX idx_process_chat_org ON public.process_chat_messages(organization_id);

ALTER TABLE public.process_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view process chat" ON public.process_chat_messages
FOR SELECT USING (organization_id = get_active_org_id());

CREATE POLICY "Non-client can send process chat" ON public.process_chat_messages
FOR INSERT WITH CHECK (
  organization_id = get_active_org_id()
  AND auth.uid() = user_id
  AND NOT has_org_role(auth.uid(), organization_id, 'client')
);

CREATE POLICY "Users can delete own chat messages" ON public.process_chat_messages
FOR DELETE USING (auth.uid() = user_id);

-- =============================================
-- RF-028: Court Integrations
-- =============================================
CREATE TABLE public.court_integrations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  process_id uuid NOT NULL REFERENCES public.processes(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  court_system text NOT NULL DEFAULT 'pje',
  court_process_id text,
  status text NOT NULL DEFAULT 'active',
  last_sync_at timestamptz,
  sync_config jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER update_court_integrations_updated_at BEFORE UPDATE ON public.court_integrations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.court_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage court integrations" ON public.court_integrations
FOR ALL USING (
  organization_id = get_active_org_id()
  AND (has_org_role(auth.uid(), organization_id, 'owner') OR has_org_role(auth.uid(), organization_id, 'admin'))
);

CREATE POLICY "Org members can view court integrations" ON public.court_integrations
FOR SELECT USING (organization_id = get_active_org_id());

-- =============================================
-- RF-029: Document Templates
-- =============================================
CREATE TABLE public.document_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  title text NOT NULL,
  category text NOT NULL DEFAULT 'other',
  content text NOT NULL DEFAULT '',
  version integer NOT NULL DEFAULT 1,
  tags text[] DEFAULT '{}'::text[],
  created_by uuid NOT NULL,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.document_template_versions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id uuid NOT NULL REFERENCES public.document_templates(id) ON DELETE CASCADE,
  version integer NOT NULL,
  content text NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER update_document_templates_updated_at BEFORE UPDATE ON public.document_templates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.document_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_template_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view templates" ON public.document_templates
FOR SELECT USING (
  organization_id = get_active_org_id()
  AND NOT has_org_role(auth.uid(), organization_id, 'client')
);

CREATE POLICY "Non-client non-intern can create templates" ON public.document_templates
FOR INSERT WITH CHECK (
  organization_id = get_active_org_id()
  AND NOT has_org_role(auth.uid(), organization_id, 'client')
  AND NOT has_org_role(auth.uid(), organization_id, 'intern')
);

CREATE POLICY "Non-client non-intern can update templates" ON public.document_templates
FOR UPDATE USING (
  organization_id = get_active_org_id()
  AND NOT has_org_role(auth.uid(), organization_id, 'client')
  AND NOT has_org_role(auth.uid(), organization_id, 'intern')
);

CREATE POLICY "Admins can delete templates" ON public.document_templates
FOR DELETE USING (
  organization_id = get_active_org_id()
  AND (has_org_role(auth.uid(), organization_id, 'owner') OR has_org_role(auth.uid(), organization_id, 'admin'))
);

CREATE POLICY "Org members can view template versions" ON public.document_template_versions
FOR SELECT USING (
  template_id IN (SELECT id FROM public.document_templates WHERE organization_id = get_active_org_id())
);

CREATE POLICY "Non-client can create template versions" ON public.document_template_versions
FOR INSERT WITH CHECK (
  template_id IN (SELECT id FROM public.document_templates WHERE organization_id = get_active_org_id())
  AND auth.uid() = created_by
);

-- =============================================
-- RF-030: Legal References (Biblioteca Jurídica)
-- =============================================
CREATE TABLE public.legal_references (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  title text NOT NULL,
  content text,
  reference_type text NOT NULL DEFAULT 'jurisprudence',
  source text,
  court text,
  decision_date date,
  tags text[] DEFAULT '{}'::text[],
  category text,
  is_favorite boolean NOT NULL DEFAULT false,
  folder text,
  notes text,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER update_legal_references_updated_at BEFORE UPDATE ON public.legal_references
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE INDEX idx_legal_refs_org ON public.legal_references(organization_id);

ALTER TABLE public.legal_references ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Non-client non-intern can manage legal refs" ON public.legal_references
FOR ALL USING (
  organization_id = get_active_org_id()
  AND NOT has_org_role(auth.uid(), organization_id, 'client')
  AND NOT has_org_role(auth.uid(), organization_id, 'intern')
);

CREATE POLICY "Intern can view legal refs" ON public.legal_references
FOR SELECT USING (
  organization_id = get_active_org_id()
  AND has_org_role(auth.uid(), organization_id, 'intern')
);
