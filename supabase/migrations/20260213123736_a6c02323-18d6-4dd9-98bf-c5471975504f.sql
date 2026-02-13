
-- RF-043: Process summaries table
CREATE TABLE public.process_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  process_id UUID REFERENCES public.processes(id) ON DELETE CASCADE,
  document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  decision_id UUID REFERENCES public.decision_extractions(id) ON DELETE SET NULL,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  summary_type TEXT NOT NULL DEFAULT 'processo',
  config JSONB NOT NULL DEFAULT '{}',
  summary_text TEXT NOT NULL DEFAULT '',
  relevant_excerpts JSONB DEFAULT '[]',
  confidence NUMERIC(3,2) DEFAULT 0,
  origin TEXT NOT NULL DEFAULT 'automatica',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.process_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view org summaries"
  ON public.process_summaries FOR SELECT
  TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Members can insert org summaries"
  ON public.process_summaries FOR INSERT
  TO authenticated
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Members can update org summaries"
  ON public.process_summaries FOR UPDATE
  TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Members can delete org summaries"
  ON public.process_summaries FOR DELETE
  TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE TRIGGER update_process_summaries_updated_at
  BEFORE UPDATE ON public.process_summaries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE INDEX idx_process_summaries_process ON public.process_summaries(process_id);
CREATE INDEX idx_process_summaries_org ON public.process_summaries(organization_id);
