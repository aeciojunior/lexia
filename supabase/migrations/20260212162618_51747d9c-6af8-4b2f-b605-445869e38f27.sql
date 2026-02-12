
-- Add status column for Kanban (todo, in_progress, done)
ALTER TABLE public.quick_tasks ADD COLUMN status text NOT NULL DEFAULT 'todo';

-- Migrate existing data: done=true -> 'done', done=false -> 'todo'
UPDATE public.quick_tasks SET status = CASE WHEN done THEN 'done' ELSE 'todo' END;

-- Create comments table
CREATE TABLE public.quick_task_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.quick_tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  organization_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.quick_task_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view task comments"
  ON public.quick_task_comments FOR SELECT
  USING (organization_id = get_active_org_id());

CREATE POLICY "Org members can create task comments"
  ON public.quick_task_comments FOR INSERT
  WITH CHECK (organization_id = get_active_org_id() AND auth.uid() = user_id);

CREATE POLICY "Users can delete own comments"
  ON public.quick_task_comments FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX idx_quick_task_comments_task_id ON public.quick_task_comments(task_id);
