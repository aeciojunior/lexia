
-- Table: process_classifications (current AI classification for each process)
CREATE TABLE public.process_classifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  process_id UUID NOT NULL REFERENCES public.processes(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  process_type TEXT,
  legal_area TEXT,
  risk_level TEXT NOT NULL DEFAULT 'medio',
  urgency TEXT NOT NULL DEFAULT 'nenhuma',
  confidence NUMERIC(3,2) DEFAULT 0,
  justification TEXT,
  origin TEXT NOT NULL DEFAULT 'automatica',
  classified_by UUID,
  manual_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(process_id)
);

ALTER TABLE public.process_classifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view classifications"
  ON public.process_classifications FOR SELECT
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members can insert classifications"
  ON public.process_classifications FOR INSERT
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members can update classifications"
  ON public.process_classifications FOR UPDATE
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE INDEX idx_process_classifications_process ON public.process_classifications(process_id);
CREATE INDEX idx_process_classifications_org ON public.process_classifications(organization_id);

CREATE TRIGGER update_process_classifications_updated_at
  BEFORE UPDATE ON public.process_classifications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Table: process_classification_logs (history of all classifications)
CREATE TABLE public.process_classification_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  process_id UUID NOT NULL REFERENCES public.processes(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  process_type TEXT,
  legal_area TEXT,
  risk_level TEXT,
  urgency TEXT,
  confidence NUMERIC(3,2) DEFAULT 0,
  justification TEXT,
  origin TEXT NOT NULL DEFAULT 'automatica',
  user_id UUID,
  manual_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.process_classification_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view classification logs"
  ON public.process_classification_logs FOR SELECT
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members can insert classification logs"
  ON public.process_classification_logs FOR INSERT
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));

CREATE INDEX idx_classification_logs_process ON public.process_classification_logs(process_id);
CREATE INDEX idx_classification_logs_org ON public.process_classification_logs(organization_id);
