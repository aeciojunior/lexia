
ALTER TABLE public.processes
  ADD COLUMN IF NOT EXISTS kanban_position INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_processes_org_fase_position
  ON public.processes (organization_id, fase, kanban_position)
  WHERE archived = false;

CREATE INDEX IF NOT EXISTS idx_processes_org_status_position
  ON public.processes (organization_id, status, kanban_position)
  WHERE archived = false;
