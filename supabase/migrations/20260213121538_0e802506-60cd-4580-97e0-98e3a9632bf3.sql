
-- Table for storing extracted decision data
CREATE TABLE public.decision_extractions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  process_id UUID NOT NULL REFERENCES public.processes(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  event_id UUID REFERENCES public.process_events(id) ON DELETE SET NULL,
  decision_type TEXT NOT NULL DEFAULT 'sentenca',
  result TEXT,
  fundamentals JSONB DEFAULT '[]'::jsonb,
  deadlines_extracted JSONB DEFAULT '[]'::jsonb,
  dispositivo TEXT,
  confidence NUMERIC(3,2) DEFAULT 0,
  justification TEXT,
  origin TEXT NOT NULL DEFAULT 'automatica',
  extracted_by UUID REFERENCES auth.users(id),
  manual_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(process_id, event_id)
);

ALTER TABLE public.decision_extractions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view decision extractions"
  ON public.decision_extractions FOR SELECT
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members can insert decision extractions"
  ON public.decision_extractions FOR INSERT
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members can update decision extractions"
  ON public.decision_extractions FOR UPDATE
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE TRIGGER update_decision_extractions_updated_at
  BEFORE UPDATE ON public.decision_extractions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Logs table for extraction history
CREATE TABLE public.decision_extraction_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  process_id UUID NOT NULL REFERENCES public.processes(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  event_id UUID REFERENCES public.process_events(id) ON DELETE SET NULL,
  decision_type TEXT,
  result TEXT,
  fundamentals JSONB,
  deadlines_extracted JSONB,
  dispositivo TEXT,
  confidence NUMERIC(3,2),
  origin TEXT NOT NULL DEFAULT 'automatica',
  user_id UUID REFERENCES auth.users(id),
  manual_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.decision_extraction_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view extraction logs"
  ON public.decision_extraction_logs FOR SELECT
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members can insert extraction logs"
  ON public.decision_extraction_logs FOR INSERT
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));
