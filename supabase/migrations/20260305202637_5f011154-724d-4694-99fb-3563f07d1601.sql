
-- RF-068: Internal Precedents table
CREATE TABLE public.internal_precedents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  precedent_type TEXT NOT NULL DEFAULT 'piece',
  legal_area TEXT,
  tribunal TEXT,
  result_obtained TEXT,
  context TEXT,
  relevant_excerpts TEXT,
  recommendations TEXT,
  limitations TEXT,
  tags TEXT[] DEFAULT '{}',
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.internal_precedents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view precedents"
  ON public.internal_precedents FOR SELECT
  TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members can insert precedents"
  ON public.internal_precedents FOR INSERT
  TO authenticated
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members can update precedents"
  ON public.internal_precedents FOR UPDATE
  TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members can delete precedents"
  ON public.internal_precedents FOR DELETE
  TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));

-- Updated_at trigger
CREATE TRIGGER update_internal_precedents_updated_at
  BEFORE UPDATE ON public.internal_precedents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
