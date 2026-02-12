
-- Create automation execution logs table
CREATE TABLE public.automation_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  automation_id uuid NOT NULL REFERENCES public.automations(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  status text NOT NULL DEFAULT 'success',
  items_processed integer NOT NULL DEFAULT 0,
  items_matched integer NOT NULL DEFAULT 0,
  error_message text,
  details jsonb DEFAULT '[]'::jsonb,
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  finished_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.automation_logs ENABLE ROW LEVEL SECURITY;

-- Org admins can view logs
CREATE POLICY "Org admins can view automation logs"
ON public.automation_logs
FOR SELECT
USING (
  organization_id = get_active_org_id()
  AND (
    has_org_role(auth.uid(), organization_id, 'owner'::text)
    OR has_org_role(auth.uid(), organization_id, 'admin'::text)
  )
);

-- Index for performance
CREATE INDEX idx_automation_logs_automation_id ON public.automation_logs(automation_id);
CREATE INDEX idx_automation_logs_org_created ON public.automation_logs(organization_id, created_at DESC);
