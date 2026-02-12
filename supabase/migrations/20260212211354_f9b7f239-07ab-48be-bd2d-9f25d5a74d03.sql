-- Table to store contract digital signatures
CREATE TABLE public.contract_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  signature_url text NOT NULL,
  ip_address text,
  user_agent text,
  accepted_terms boolean NOT NULL DEFAULT false,
  signed_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.contract_signatures ENABLE ROW LEVEL SECURITY;

-- Clients can view signatures on their own contracts
CREATE POLICY "Clients can view own contract signatures"
ON public.contract_signatures
FOR SELECT
USING (
  has_org_role(auth.uid(), organization_id, 'client')
  AND contract_id IN (
    SELECT id FROM public.contracts
    WHERE client_id = get_client_id_for_user(auth.uid(), organization_id)
  )
);

-- Clients can insert signatures on their own contracts
CREATE POLICY "Clients can sign own contracts"
ON public.contract_signatures
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND has_org_role(auth.uid(), organization_id, 'client')
  AND contract_id IN (
    SELECT id FROM public.contracts
    WHERE client_id = get_client_id_for_user(auth.uid(), organization_id)
  )
);

-- Org admins/owners can view all signatures
CREATE POLICY "Admins can view contract signatures"
ON public.contract_signatures
FOR SELECT
USING (
  organization_id = get_active_org_id()
  AND (has_org_role(auth.uid(), organization_id, 'owner') OR has_org_role(auth.uid(), organization_id, 'admin'))
);

-- Storage bucket for signature images
INSERT INTO storage.buckets (id, name, public) VALUES ('signatures', 'signatures', false);

-- Storage policies for signatures bucket
CREATE POLICY "Clients can upload own signatures"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'signatures'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view own signatures"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'signatures'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Admins can view all signatures"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'signatures'
  AND EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'
  )
);