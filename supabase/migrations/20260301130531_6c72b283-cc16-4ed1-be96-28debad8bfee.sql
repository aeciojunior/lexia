
CREATE TABLE public.argument_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  draft_id UUID REFERENCES public.drafts(id) ON DELETE CASCADE,
  process_id UUID REFERENCES public.processes(id) ON DELETE SET NULL,
  user_id UUID NOT NULL,
  suggestion_type TEXT NOT NULL DEFAULT 'argument',
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  legal_basis TEXT DEFAULT '',
  jurisprudence TEXT DEFAULT '',
  risk_level TEXT DEFAULT 'medium',
  strength_score INT DEFAULT 50,
  category TEXT DEFAULT 'merito',
  sources JSONB DEFAULT '[]',
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.argument_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members manage argument_suggestions"
  ON public.argument_suggestions
  FOR ALL
  USING (public.is_org_member(auth.uid(), organization_id));
