
-- Add priority and position columns to quick_tasks
ALTER TABLE public.quick_tasks
  ADD COLUMN priority TEXT NOT NULL DEFAULT 'medium',
  ADD COLUMN position INTEGER NOT NULL DEFAULT 0;
