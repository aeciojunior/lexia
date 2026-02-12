
-- 1. Add plan column to organizations
ALTER TABLE public.organizations
ADD COLUMN plan text NOT NULL DEFAULT 'free'
CONSTRAINT organizations_plan_check CHECK (plan IN ('free', 'pro', 'enterprise'));

-- 2. Create invoices table
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  user_id UUID NOT NULL,
  description text,
  amount_cents bigint NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'BRL',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'paid', 'overdue', 'cancelled')),
  due_date date,
  paid_at timestamptz,
  external_id text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members with financial access can view invoices"
ON public.invoices FOR SELECT
USING (
  organization_id = get_active_org_id()
  AND (
    has_org_role(auth.uid(), organization_id, 'owner')
    OR has_org_role(auth.uid(), organization_id, 'admin')
  )
);

CREATE POLICY "Org admins can create invoices"
ON public.invoices FOR INSERT
WITH CHECK (
  organization_id = get_active_org_id()
  AND (
    has_org_role(auth.uid(), organization_id, 'owner')
    OR has_org_role(auth.uid(), organization_id, 'admin')
  )
);

CREATE POLICY "Org admins can update invoices"
ON public.invoices FOR UPDATE
USING (
  organization_id = get_active_org_id()
  AND (
    has_org_role(auth.uid(), organization_id, 'owner')
    OR has_org_role(auth.uid(), organization_id, 'admin')
  )
);

CREATE POLICY "Org owners can delete invoices"
ON public.invoices FOR DELETE
USING (
  organization_id = get_active_org_id()
  AND has_org_role(auth.uid(), organization_id, 'owner')
);

CREATE TRIGGER update_invoices_updated_at
BEFORE UPDATE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 3. Create payments table
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  user_id UUID NOT NULL,
  amount_cents bigint NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'BRL',
  method text NOT NULL DEFAULT 'other' CHECK (method IN ('pix', 'boleto', 'credit_card', 'transfer', 'other')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'failed', 'refunded')),
  external_id text,
  metadata jsonb,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members with financial access can view payments"
ON public.payments FOR SELECT
USING (
  organization_id = get_active_org_id()
  AND (
    has_org_role(auth.uid(), organization_id, 'owner')
    OR has_org_role(auth.uid(), organization_id, 'admin')
  )
);

CREATE POLICY "Org admins can create payments"
ON public.payments FOR INSERT
WITH CHECK (
  organization_id = get_active_org_id()
  AND (
    has_org_role(auth.uid(), organization_id, 'owner')
    OR has_org_role(auth.uid(), organization_id, 'admin')
  )
);

CREATE POLICY "Org admins can update payments"
ON public.payments FOR UPDATE
USING (
  organization_id = get_active_org_id()
  AND (
    has_org_role(auth.uid(), organization_id, 'owner')
    OR has_org_role(auth.uid(), organization_id, 'admin')
  )
);

CREATE POLICY "Org owners can delete payments"
ON public.payments FOR DELETE
USING (
  organization_id = get_active_org_id()
  AND has_org_role(auth.uid(), organization_id, 'owner')
);

CREATE TRIGGER update_payments_updated_at
BEFORE UPDATE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Indexes for performance
CREATE INDEX idx_invoices_org ON public.invoices(organization_id);
CREATE INDEX idx_invoices_status ON public.invoices(status);
CREATE INDEX idx_payments_org ON public.payments(organization_id);
CREATE INDEX idx_payments_invoice ON public.payments(invoice_id);
