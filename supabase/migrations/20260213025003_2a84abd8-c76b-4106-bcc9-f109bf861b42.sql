
-- RF-021.6: Add maintenance mode fields to organization_settings
ALTER TABLE public.organization_settings
  ADD COLUMN IF NOT EXISTS maintenance_mode boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS maintenance_message text DEFAULT 'Sistema em manutenção. Voltaremos em breve.',
  ADD COLUMN IF NOT EXISTS maintenance_admin_access boolean NOT NULL DEFAULT false;
