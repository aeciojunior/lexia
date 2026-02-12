
-- Tighten the INSERT policy: only authenticated users can insert, and only for themselves or org members
DROP POLICY "Authenticated users can insert notifications" ON public.notifications;

CREATE POLICY "Org members can insert notifications"
ON public.notifications FOR INSERT
WITH CHECK (
  organization_id IS NULL
  OR organization_id = get_active_org_id()
);
