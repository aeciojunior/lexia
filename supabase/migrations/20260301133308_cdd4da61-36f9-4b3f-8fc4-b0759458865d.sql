CREATE TABLE public.nl_queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  conversation_id TEXT NOT NULL,
  question TEXT NOT NULL,
  answer TEXT DEFAULT '',
  sources_used JSONB DEFAULT '[]'::jsonb,
  query_type TEXT DEFAULT 'general',
  status TEXT DEFAULT 'answered',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.nl_queries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members manage nl_queries"
  ON public.nl_queries FOR ALL
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE INDEX idx_nl_queries_org ON public.nl_queries(organization_id);
CREATE INDEX idx_nl_queries_user ON public.nl_queries(user_id);
CREATE INDEX idx_nl_queries_conversation ON public.nl_queries(conversation_id);