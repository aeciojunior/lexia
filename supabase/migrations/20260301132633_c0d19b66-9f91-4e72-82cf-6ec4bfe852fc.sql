CREATE TABLE public.legal_glossary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  term TEXT NOT NULL,
  preferred_term TEXT NOT NULL,
  definition TEXT DEFAULT '',
  category TEXT DEFAULT 'geral',
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, term)
);

ALTER TABLE public.legal_glossary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members manage legal_glossary"
  ON public.legal_glossary FOR ALL
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE TRIGGER update_legal_glossary_updated_at
  BEFORE UPDATE ON public.legal_glossary
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();