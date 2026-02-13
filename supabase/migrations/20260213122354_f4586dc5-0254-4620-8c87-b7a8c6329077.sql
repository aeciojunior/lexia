
-- Add extraction_id to deadlines to link auto-created deadlines to decision extractions
ALTER TABLE public.deadlines
  ADD COLUMN extraction_id UUID REFERENCES public.decision_extractions(id) ON DELETE SET NULL;

CREATE INDEX idx_deadlines_extraction_id ON public.deadlines(extraction_id);
