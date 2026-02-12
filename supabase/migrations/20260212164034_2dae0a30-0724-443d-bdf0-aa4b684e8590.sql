
-- Subtasks table for quick_tasks
CREATE TABLE public.quick_task_subtasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.quick_tasks(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  done BOOLEAN NOT NULL DEFAULT false,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.quick_task_subtasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view subtasks"
  ON public.quick_task_subtasks FOR SELECT
  USING (organization_id = get_active_org_id());

CREATE POLICY "Org members can create subtasks"
  ON public.quick_task_subtasks FOR INSERT
  WITH CHECK (organization_id = get_active_org_id() AND auth.uid() = user_id);

CREATE POLICY "Org members can update subtasks"
  ON public.quick_task_subtasks FOR UPDATE
  USING (organization_id = get_active_org_id());

CREATE POLICY "Users can delete own subtasks"
  ON public.quick_task_subtasks FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX idx_subtasks_task_id ON public.quick_task_subtasks(task_id);
