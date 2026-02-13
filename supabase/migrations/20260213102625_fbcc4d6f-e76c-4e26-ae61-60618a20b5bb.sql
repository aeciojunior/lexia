
-- RF-023: Enhanced notification and general settings
ALTER TABLE public.organization_settings
  ADD COLUMN IF NOT EXISTS notification_frequency text NOT NULL DEFAULT 'immediate',
  ADD COLUMN IF NOT EXISTS notification_events jsonb NOT NULL DEFAULT '{"deadlines":true,"movements":true,"hearings":true,"invoices":true,"contracts":true,"security":true,"invites":true}'::jsonb,
  ADD COLUMN IF NOT EXISTS sender_email text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS email_signature text DEFAULT NULL;
