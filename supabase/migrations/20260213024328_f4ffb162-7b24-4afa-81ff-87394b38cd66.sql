
-- RF-020: Enhanced organization management

-- Add fiscal and status fields to organizations
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS razao_social text,
  ADD COLUMN IF NOT EXISTS endereco text,
  ADD COLUMN IF NOT EXISTS responsavel_legal_nome text,
  ADD COLUMN IF NOT EXISTS responsavel_legal_cpf text,
  ADD COLUMN IF NOT EXISTS inscricao_estadual text,
  ADD COLUMN IF NOT EXISTS inscricao_municipal text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancellation_requested_at timestamptz;

-- CNPJ uniqueness (partial index: only non-null values)
CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_tax_id_unique
  ON public.organizations (tax_id)
  WHERE tax_id IS NOT NULL AND tax_id != '';

-- Organization settings table
CREATE TABLE IF NOT EXISTS public.organization_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  timezone text NOT NULL DEFAULT 'America/Sao_Paulo',
  locale text NOT NULL DEFAULT 'pt-BR',
  currency text NOT NULL DEFAULT 'BRL',
  date_format text NOT NULL DEFAULT 'DD/MM/YYYY',
  ai_style text DEFAULT 'professional',
  ai_instructions text,
  notifications_internal boolean NOT NULL DEFAULT true,
  notifications_external boolean NOT NULL DEFAULT false,
  onboarding_completed boolean NOT NULL DEFAULT false,
  onboarding_step integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id)
);

-- RLS for organization_settings
ALTER TABLE public.organization_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view own org settings"
  ON public.organization_settings FOR SELECT
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Owner/Admin can update org settings"
  ON public.organization_settings FOR UPDATE
  USING (
    public.has_org_role(auth.uid(), organization_id, 'owner')
    OR public.has_org_role(auth.uid(), organization_id, 'admin')
  );

CREATE POLICY "Owner/Admin can insert org settings"
  ON public.organization_settings FOR INSERT
  WITH CHECK (
    public.has_org_role(auth.uid(), organization_id, 'owner')
    OR public.has_org_role(auth.uid(), organization_id, 'admin')
  );

-- Trigger for updated_at
CREATE TRIGGER update_organization_settings_updated_at
  BEFORE UPDATE ON public.organization_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Ownership transfer requests table
CREATE TABLE IF NOT EXISTS public.ownership_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  from_user_id uuid NOT NULL,
  to_user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  CONSTRAINT valid_status CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled'))
);

ALTER TABLE public.ownership_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view own org transfers"
  ON public.ownership_transfers FOR SELECT
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Owner can create transfer"
  ON public.ownership_transfers FOR INSERT
  WITH CHECK (public.has_org_role(auth.uid(), organization_id, 'owner'));

CREATE POLICY "Target user can update transfer"
  ON public.ownership_transfers FOR UPDATE
  USING (to_user_id = auth.uid() OR from_user_id = auth.uid());
