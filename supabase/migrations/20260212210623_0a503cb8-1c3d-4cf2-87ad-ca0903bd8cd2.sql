-- Allow clients to view their own contracts
CREATE POLICY "Clients can view own contracts"
ON public.contracts
FOR SELECT
USING (
  has_org_role(auth.uid(), organization_id, 'client')
  AND client_id = get_client_id_for_user(auth.uid(), organization_id)
);