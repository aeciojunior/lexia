
-- Add assigned_to column to quick_tasks
ALTER TABLE public.quick_tasks
  ADD COLUMN assigned_to UUID DEFAULT NULL;

-- Update SELECT policy to also allow assigned users to see tasks
DROP POLICY IF EXISTS "Users can view own quick_tasks in org" ON public.quick_tasks;
CREATE POLICY "Users can view own or assigned quick_tasks in org"
  ON public.quick_tasks FOR SELECT
  USING (
    organization_id = get_active_org_id()
    AND (auth.uid() = user_id OR auth.uid() = assigned_to)
  );

-- Allow assigned users to update tasks (e.g. mark as done)
DROP POLICY IF EXISTS "Users can update own quick_tasks" ON public.quick_tasks;
CREATE POLICY "Users can update own or assigned quick_tasks"
  ON public.quick_tasks FOR UPDATE
  USING (auth.uid() = user_id OR auth.uid() = assigned_to);
