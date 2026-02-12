
-- Timesheet table for tracking hours worked
CREATE TABLE public.time_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  process_id UUID REFERENCES public.processes(id) ON DELETE SET NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  description TEXT,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  start_time TIME WITHOUT TIME ZONE,
  end_time TIME WITHOUT TIME ZONE,
  duration_minutes INTEGER NOT NULL DEFAULT 0,
  hourly_rate_cents BIGINT NOT NULL DEFAULT 0,
  billable BOOLEAN NOT NULL DEFAULT true,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Org members can view time entries"
  ON public.time_entries FOR SELECT
  USING (organization_id = get_active_org_id());

CREATE POLICY "Users can create own time entries"
  ON public.time_entries FOR INSERT
  WITH CHECK (
    organization_id = get_active_org_id()
    AND auth.uid() = user_id
    AND NOT has_org_role(auth.uid(), organization_id, 'client')
  );

CREATE POLICY "Users can update own time entries"
  ON public.time_entries FOR UPDATE
  USING (
    organization_id = get_active_org_id()
    AND (auth.uid() = user_id OR has_org_role(auth.uid(), organization_id, 'owner') OR has_org_role(auth.uid(), organization_id, 'admin'))
  );

CREATE POLICY "Admins can delete time entries"
  ON public.time_entries FOR DELETE
  USING (
    organization_id = get_active_org_id()
    AND (auth.uid() = user_id OR has_org_role(auth.uid(), organization_id, 'owner') OR has_org_role(auth.uid(), organization_id, 'admin'))
  );

-- Trigger for updated_at
CREATE TRIGGER update_time_entries_updated_at
  BEFORE UPDATE ON public.time_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();
