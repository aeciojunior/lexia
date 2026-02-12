
-- RF-012: Add status column to user_organizations
ALTER TABLE public.user_organizations
ADD COLUMN status TEXT NOT NULL DEFAULT 'active';

-- RF-013: Create user_preferences table
CREATE TABLE public.user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  theme TEXT NOT NULL DEFAULT 'system',
  notifications JSONB NOT NULL DEFAULT '{"email": true, "push": false, "in_app": true}'::jsonb,
  interface JSONB NOT NULL DEFAULT '{"compact": false, "date_format": "relative", "default_sort": "newest"}'::jsonb,
  accessibility JSONB NOT NULL DEFAULT '{"high_contrast": false, "large_fonts": false, "reduced_motion": false}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- RLS: Users can only manage their own preferences
CREATE POLICY "Users can view own preferences"
ON public.user_preferences FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences"
ON public.user_preferences FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences"
ON public.user_preferences FOR UPDATE
USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_user_preferences_updated_at
BEFORE UPDATE ON public.user_preferences
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

-- Update RLS on user_organizations to block disabled users from seeing org data
-- We need to update the get_active_org_id function to check status
CREATE OR REPLACE FUNCTION public.get_active_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT p.active_organization_id 
  FROM public.profiles p
  WHERE p.user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.user_organizations uo
    WHERE uo.user_id = auth.uid()
    AND uo.organization_id = p.active_organization_id
    AND uo.status = 'active'
  )
$$;
