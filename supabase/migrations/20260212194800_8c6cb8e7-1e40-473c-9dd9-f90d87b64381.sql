
-- =============================================
-- RF-020: Tabela de Clientes
-- =============================================
CREATE TABLE public.clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  
  -- Dados pessoais
  full_name TEXT NOT NULL,
  document_type TEXT NOT NULL DEFAULT 'cpf' CHECK (document_type IN ('cpf', 'cnpj')),
  document_number TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  
  -- Dados jurídicos
  client_type TEXT NOT NULL DEFAULT 'individual' CHECK (client_type IN ('individual', 'company')),
  business_area TEXT,
  
  -- Dados internos
  responsible_id UUID,
  tags TEXT[] DEFAULT '{}',
  internal_notes TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger updated_at
CREATE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- RLS
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- SELECT: todos da org (exceto client role)
CREATE POLICY "Org members can view clients"
  ON public.clients FOR SELECT
  USING (
    organization_id = get_active_org_id()
    AND NOT has_org_role(auth.uid(), organization_id, 'client')
  );

-- INSERT: owner/admin/user
CREATE POLICY "Non-client non-intern can create clients"
  ON public.clients FOR INSERT
  WITH CHECK (
    organization_id = get_active_org_id()
    AND (
      has_org_role(auth.uid(), organization_id, 'owner')
      OR has_org_role(auth.uid(), organization_id, 'admin')
      OR has_org_role(auth.uid(), organization_id, 'user')
    )
  );

-- UPDATE: owner/admin/user (intern parcial handled in app)
CREATE POLICY "Non-client can update clients"
  ON public.clients FOR UPDATE
  USING (
    organization_id = get_active_org_id()
    AND NOT has_org_role(auth.uid(), organization_id, 'client')
  );

-- DELETE: owner/admin only
CREATE POLICY "Admins can delete clients"
  ON public.clients FOR DELETE
  USING (
    organization_id = get_active_org_id()
    AND (
      has_org_role(auth.uid(), organization_id, 'owner')
      OR has_org_role(auth.uid(), organization_id, 'admin')
    )
  );

-- Index
CREATE INDEX idx_clients_org ON public.clients(organization_id);
CREATE INDEX idx_clients_document ON public.clients(document_number);

-- =============================================
-- RF-021: Tabela de Contratos
-- =============================================
CREATE TABLE public.contracts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  process_id UUID REFERENCES public.processes(id) ON DELETE SET NULL,
  
  title TEXT NOT NULL,
  description TEXT,
  contract_type TEXT NOT NULL DEFAULT 'service' CHECK (contract_type IN ('service', 'contingency', 'fixed', 'hourly', 'other')),
  
  amount_cents BIGINT NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'BRL',
  periodicity TEXT DEFAULT 'monthly' CHECK (periodicity IN ('once', 'monthly', 'quarterly', 'yearly')),
  
  start_date DATE,
  end_date DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'suspended', 'completed', 'cancelled')),
  
  terms TEXT,
  metadata JSONB,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger updated_at
CREATE TRIGGER update_contracts_updated_at
  BEFORE UPDATE ON public.contracts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- RLS
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

-- SELECT: owner/admin only (financial access)
CREATE POLICY "Financial access can view contracts"
  ON public.contracts FOR SELECT
  USING (
    organization_id = get_active_org_id()
    AND (
      has_org_role(auth.uid(), organization_id, 'owner')
      OR has_org_role(auth.uid(), organization_id, 'admin')
    )
  );

-- INSERT: owner/admin
CREATE POLICY "Admins can create contracts"
  ON public.contracts FOR INSERT
  WITH CHECK (
    organization_id = get_active_org_id()
    AND (
      has_org_role(auth.uid(), organization_id, 'owner')
      OR has_org_role(auth.uid(), organization_id, 'admin')
    )
  );

-- UPDATE: owner/admin
CREATE POLICY "Admins can update contracts"
  ON public.contracts FOR UPDATE
  USING (
    organization_id = get_active_org_id()
    AND (
      has_org_role(auth.uid(), organization_id, 'owner')
      OR has_org_role(auth.uid(), organization_id, 'admin')
    )
  );

-- DELETE: owner only
CREATE POLICY "Owners can delete contracts"
  ON public.contracts FOR DELETE
  USING (
    organization_id = get_active_org_id()
    AND has_org_role(auth.uid(), organization_id, 'owner')
  );

-- Add client_id to existing tables for integration
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL;
ALTER TABLE public.quick_tasks ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL;

-- Index
CREATE INDEX idx_contracts_org ON public.contracts(organization_id);
CREATE INDEX idx_contracts_client ON public.contracts(client_id);
CREATE INDEX idx_invoices_client ON public.invoices(client_id);
