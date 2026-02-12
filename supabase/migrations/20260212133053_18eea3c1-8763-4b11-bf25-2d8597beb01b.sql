
-- Add granular notification preference columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notify_deadlines BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_documents BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_in_app BOOLEAN NOT NULL DEFAULT true;
