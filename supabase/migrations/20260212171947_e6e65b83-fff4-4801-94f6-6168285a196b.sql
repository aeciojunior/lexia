
-- 1. Create app_users table
CREATE TABLE public.app_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID NOT NULL UNIQUE,
  name TEXT,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. RLS
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own app_user record"
  ON public.app_users FOR SELECT
  USING (auth.uid() = auth_user_id);

CREATE POLICY "Users can update own app_user record"
  ON public.app_users FOR UPDATE
  USING (auth.uid() = auth_user_id);

-- 3. Backfill from existing profiles + auth.users
INSERT INTO public.app_users (auth_user_id, name, email, created_at)
SELECT p.user_id, p.full_name, u.email, p.created_at
FROM public.profiles p
JOIN auth.users u ON u.id = p.user_id
ON CONFLICT DO NOTHING;

-- 4. Update handle_new_user: NO org creation, add app_users + audit log
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Create app_users record
  INSERT INTO public.app_users (auth_user_id, name, email)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'full_name', NEW.email);

  -- Create profile (for extended settings)
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'full_name');

  -- Default system role
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');

  -- Audit log for registration
  INSERT INTO public.audit_logs (action, user_id, resource_type, metadata)
  VALUES ('user_registered', NEW.id, 'user', jsonb_build_object('email', NEW.email));

  RETURN NEW;
END;
$$;
