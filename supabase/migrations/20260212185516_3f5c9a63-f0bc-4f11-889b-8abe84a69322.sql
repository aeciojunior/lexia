
-- RF-017: Add tags and responsible_id to processes
ALTER TABLE public.processes ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.processes ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}'::text[];
ALTER TABLE public.processes ADD COLUMN IF NOT EXISTS responsible_id uuid;

-- RF-019: Add process_id to quick_tasks for linking tasks to processes
ALTER TABLE public.quick_tasks ADD COLUMN IF NOT EXISTS process_id uuid REFERENCES public.processes(id) ON DELETE SET NULL;

-- Create index for quick_tasks process linking
CREATE INDEX IF NOT EXISTS idx_quick_tasks_process_id ON public.quick_tasks(process_id);

-- Create index for processes tags
CREATE INDEX IF NOT EXISTS idx_processes_tags ON public.processes USING GIN(tags);

-- Create index for processes responsible
CREATE INDEX IF NOT EXISTS idx_processes_responsible_id ON public.processes(responsible_id);
