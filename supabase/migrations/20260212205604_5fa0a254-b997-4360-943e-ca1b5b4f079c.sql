-- Function to get the client_id linked to the current auth user via email match within an org
CREATE OR REPLACE FUNCTION public.get_client_id_for_user(_user_id uuid, _org_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id
  FROM public.clients c
  JOIN auth.users u ON lower(u.email) = lower(c.email)
  WHERE u.id = _user_id
    AND c.organization_id = _org_id
    AND c.status = 'active'
  LIMIT 1
$$;

-- Allow client-role users to view invoices linked to their client record
CREATE POLICY "Clients can view own invoices"
ON public.invoices
FOR SELECT
USING (
  has_org_role(auth.uid(), organization_id, 'client')
  AND client_id = get_client_id_for_user(auth.uid(), organization_id)
);

-- Allow client-role users to view payments linked to their invoices
CREATE POLICY "Clients can view own payments"
ON public.payments
FOR SELECT
USING (
  has_org_role(auth.uid(), organization_id, 'client')
  AND invoice_id IN (
    SELECT id FROM public.invoices
    WHERE client_id = get_client_id_for_user(auth.uid(), organization_id)
  )
);