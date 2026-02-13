
-- RF-042: Document classifications
CREATE TABLE public.document_classifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL DEFAULT 'outro',
  confidence NUMERIC(3,2) DEFAULT 0,
  relevant_excerpts JSONB DEFAULT '[]',
  rules_activated JSONB DEFAULT '[]',
  model TEXT DEFAULT 'gemini-3-flash',
  justification TEXT,
  origin TEXT NOT NULL DEFAULT 'automatica',
  classified_by UUID,
  manual_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(document_id)
);

ALTER TABLE public.document_classifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view classifications"
  ON public.document_classifications FOR SELECT
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members can insert classifications"
  ON public.document_classifications FOR INSERT
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members can update classifications"
  ON public.document_classifications FOR UPDATE
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE INDEX idx_doc_classifications_doc ON public.document_classifications(document_id);
CREATE INDEX idx_doc_classifications_org ON public.document_classifications(organization_id);

-- Classification logs / history
CREATE TABLE public.document_classification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  document_type TEXT,
  confidence NUMERIC(3,2),
  origin TEXT NOT NULL DEFAULT 'automatica',
  user_id UUID,
  manual_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.document_classification_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view classification logs"
  ON public.document_classification_logs FOR SELECT
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members can insert classification logs"
  ON public.document_classification_logs FOR INSERT
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));

CREATE INDEX idx_doc_class_logs_doc ON public.document_classification_logs(document_id);

-- Trigger for updated_at
CREATE TRIGGER update_document_classifications_updated_at
  BEFORE UPDATE ON public.document_classifications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
