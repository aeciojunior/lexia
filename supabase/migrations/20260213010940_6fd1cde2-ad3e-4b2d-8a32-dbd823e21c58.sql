
-- RF-044: Workflows
CREATE TABLE public.workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'draft',
  version integer NOT NULL DEFAULT 1,
  trigger_type text NOT NULL DEFAULT 'manual',
  trigger_config jsonb DEFAULT '{}',
  nodes jsonb DEFAULT '[]',
  edges jsonb DEFAULT '[]',
  created_by uuid NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org owner/admin can manage workflows" ON public.workflows FOR ALL
  USING (organization_id = get_active_org_id() AND (has_org_role(auth.uid(), organization_id, 'owner') OR has_org_role(auth.uid(), organization_id, 'admin')));
CREATE POLICY "Non-client org members can view workflows" ON public.workflows FOR SELECT
  USING (organization_id = get_active_org_id() AND NOT has_org_role(auth.uid(), organization_id, 'client'));

CREATE TABLE public.workflow_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  triggered_by uuid NOT NULL,
  status text NOT NULL DEFAULT 'running',
  current_node text,
  context jsonb DEFAULT '{}',
  error_message text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.workflow_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org owner/admin can manage workflow runs" ON public.workflow_runs FOR ALL
  USING (organization_id = get_active_org_id() AND (has_org_role(auth.uid(), organization_id, 'owner') OR has_org_role(auth.uid(), organization_id, 'admin')));
CREATE POLICY "Non-client org members can view workflow runs" ON public.workflow_runs FOR SELECT
  USING (organization_id = get_active_org_id() AND NOT has_org_role(auth.uid(), organization_id, 'client'));

-- RF-045: Tickets
CREATE TABLE public.tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  title text NOT NULL,
  description text,
  client_id uuid REFERENCES public.clients(id),
  process_id uuid REFERENCES public.processes(id),
  priority text NOT NULL DEFAULT 'medium',
  status text NOT NULL DEFAULT 'open',
  assigned_to uuid,
  created_by uuid NOT NULL,
  closed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Non-client org members can manage tickets" ON public.tickets FOR ALL
  USING (organization_id = get_active_org_id() AND NOT has_org_role(auth.uid(), organization_id, 'client'));
CREATE POLICY "Clients can view own tickets" ON public.tickets FOR SELECT
  USING (has_org_role(auth.uid(), organization_id, 'client') AND created_by = auth.uid());
CREATE POLICY "Clients can create tickets" ON public.tickets FOR INSERT
  WITH CHECK (has_org_role(auth.uid(), organization_id, 'client') AND created_by = auth.uid());

CREATE TABLE public.ticket_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  sender_id uuid NOT NULL,
  content text NOT NULL,
  is_internal boolean NOT NULL DEFAULT false,
  attachments jsonb DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Non-client org members can manage ticket messages" ON public.ticket_messages FOR ALL
  USING (organization_id = get_active_org_id() AND NOT has_org_role(auth.uid(), organization_id, 'client'));
CREATE POLICY "Clients can view non-internal messages on own tickets" ON public.ticket_messages FOR SELECT
  USING (has_org_role(auth.uid(), organization_id, 'client') AND is_internal = false AND ticket_id IN (SELECT id FROM public.tickets WHERE created_by = auth.uid()));
CREATE POLICY "Clients can create messages on own tickets" ON public.ticket_messages FOR INSERT
  WITH CHECK (has_org_role(auth.uid(), organization_id, 'client') AND is_internal = false AND sender_id = auth.uid() AND ticket_id IN (SELECT id FROM public.tickets WHERE created_by = auth.uid()));

-- RF-046: Wiki
CREATE TABLE public.wiki_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  name text NOT NULL,
  parent_id uuid REFERENCES public.wiki_categories(id),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.wiki_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org owner/admin/user can manage wiki categories" ON public.wiki_categories FOR ALL
  USING (organization_id = get_active_org_id() AND (has_org_role(auth.uid(), organization_id, 'owner') OR has_org_role(auth.uid(), organization_id, 'admin') OR has_org_role(auth.uid(), organization_id, 'user')));
CREATE POLICY "Non-client org members can view wiki categories" ON public.wiki_categories FOR SELECT
  USING (organization_id = get_active_org_id() AND NOT has_org_role(auth.uid(), organization_id, 'client'));

CREATE TABLE public.wiki_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  category_id uuid REFERENCES public.wiki_categories(id),
  title text NOT NULL,
  content text NOT NULL DEFAULT '',
  tags text[] DEFAULT '{}',
  version integer NOT NULL DEFAULT 1,
  is_published boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.wiki_articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org owner/admin/user can manage wiki articles" ON public.wiki_articles FOR ALL
  USING (organization_id = get_active_org_id() AND (has_org_role(auth.uid(), organization_id, 'owner') OR has_org_role(auth.uid(), organization_id, 'admin') OR has_org_role(auth.uid(), organization_id, 'user')));
CREATE POLICY "Non-client org members can view wiki articles" ON public.wiki_articles FOR SELECT
  USING (organization_id = get_active_org_id() AND NOT has_org_role(auth.uid(), organization_id, 'client'));

CREATE TABLE public.wiki_article_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid NOT NULL REFERENCES public.wiki_articles(id) ON DELETE CASCADE,
  version integer NOT NULL,
  content text NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.wiki_article_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Non-client org members can view wiki article versions" ON public.wiki_article_versions FOR SELECT
  USING (article_id IN (SELECT id FROM public.wiki_articles WHERE organization_id = get_active_org_id()));
CREATE POLICY "Org owner/admin/user can create wiki article versions" ON public.wiki_article_versions FOR INSERT
  WITH CHECK (article_id IN (SELECT id FROM public.wiki_articles WHERE organization_id = get_active_org_id() AND (has_org_role(auth.uid(), organization_id, 'owner') OR has_org_role(auth.uid(), organization_id, 'admin') OR has_org_role(auth.uid(), organization_id, 'user'))));

-- Triggers for updated_at
CREATE TRIGGER update_workflows_updated_at BEFORE UPDATE ON public.workflows FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_workflow_runs_updated_at BEFORE UPDATE ON public.workflow_runs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_tickets_updated_at BEFORE UPDATE ON public.tickets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_wiki_categories_updated_at BEFORE UPDATE ON public.wiki_categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_wiki_articles_updated_at BEFORE UPDATE ON public.wiki_articles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
