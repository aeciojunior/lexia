
-- RF-031: Import logs table for court sync tracking
CREATE TABLE public.import_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  process_id UUID NOT NULL REFERENCES public.processes(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  court_system TEXT NOT NULL DEFAULT 'pje',
  tribunal TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- sucesso, falha, sem_novidades, pending
  message TEXT,
  movements_found INT DEFAULT 0,
  movements_created INT DEFAULT 0,
  source TEXT DEFAULT 'manual', -- manual, automatic, cron
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.import_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view org import logs"
  ON public.import_logs FOR SELECT
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Members can insert import logs"
  ON public.import_logs FOR INSERT
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));

CREATE INDEX idx_import_logs_process ON public.import_logs(process_id);
CREATE INDEX idx_import_logs_org ON public.import_logs(organization_id);
CREATE INDEX idx_import_logs_created ON public.import_logs(created_at DESC);
