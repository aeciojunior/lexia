
-- Add event_id FK and origin column to documents table for RF-033
ALTER TABLE public.documents 
  ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES public.process_events(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS origin TEXT NOT NULL DEFAULT 'manual';

-- Index for event lookups
CREATE INDEX IF NOT EXISTS idx_documents_event_id ON public.documents(event_id);
CREATE INDEX IF NOT EXISTS idx_documents_process_id ON public.documents(process_id);
