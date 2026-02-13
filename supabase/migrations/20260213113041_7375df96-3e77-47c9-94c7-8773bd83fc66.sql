
-- RF-032: Process timeline events table
CREATE TABLE public.process_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  process_id UUID NOT NULL REFERENCES public.processes(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL DEFAULT 'outro',
  event_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  title TEXT NOT NULL,
  description TEXT,
  origin TEXT NOT NULL DEFAULT 'manual',
  details JSONB DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_process_events_process ON public.process_events(process_id);
CREATE INDEX idx_process_events_type ON public.process_events(event_type);
CREATE INDEX idx_process_events_date ON public.process_events(event_date);

-- RLS
ALTER TABLE public.process_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view process events"
  ON public.process_events FOR SELECT
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members can insert process events"
  ON public.process_events FOR INSERT
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members can update process events"
  ON public.process_events FOR UPDATE
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members can delete process events"
  ON public.process_events FOR DELETE
  USING (public.is_org_member(auth.uid(), organization_id));

-- Updated_at trigger
CREATE TRIGGER update_process_events_updated_at
  BEFORE UPDATE ON public.process_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
