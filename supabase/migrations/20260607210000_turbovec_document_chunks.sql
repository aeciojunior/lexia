
-- Busca semântica com TurboVec: metadados dos chunks indexados por organização

CREATE TABLE IF NOT EXISTS public.document_chunks (
  vector_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE,
  process_id UUID REFERENCES public.processes(id) ON DELETE SET NULL,
  chunk_index INT NOT NULL DEFAULT 0,
  content TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'document',
  indexed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT document_chunks_document_chunk_unique UNIQUE (document_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_document_chunks_org ON public.document_chunks(organization_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_document ON public.document_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_process ON public.document_chunks(process_id);

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS vector_indexed_at TIMESTAMPTZ;

ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view document chunks"
  ON public.document_chunks FOR SELECT
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members can insert document chunks"
  ON public.document_chunks FOR INSERT
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members can delete own org chunks"
  ON public.document_chunks FOR DELETE
  USING (public.is_org_member(auth.uid(), organization_id));
