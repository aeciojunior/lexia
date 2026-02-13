
-- RF-050: Signature Requests
CREATE TABLE public.signature_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  document_id uuid REFERENCES public.documents(id) ON DELETE SET NULL,
  contract_id uuid REFERENCES public.contracts(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  provider text NOT NULL DEFAULT 'internal',
  status text NOT NULL DEFAULT 'pending',
  external_key text,
  signing_order boolean NOT NULL DEFAULT false,
  signers jsonb NOT NULL DEFAULT '[]'::jsonb,
  reminder_sent_at timestamptz,
  completed_at timestamptz,
  canceled_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.signature_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view signature requests" ON public.signature_requests
  FOR SELECT USING (organization_id = get_active_org_id());

CREATE POLICY "Non-client non-intern can create signature requests" ON public.signature_requests
  FOR INSERT WITH CHECK (
    organization_id = get_active_org_id()
    AND NOT has_org_role(auth.uid(), organization_id, 'client')
    AND NOT has_org_role(auth.uid(), organization_id, 'intern')
  );

CREATE POLICY "Non-client non-intern can update signature requests" ON public.signature_requests
  FOR UPDATE USING (
    organization_id = get_active_org_id()
    AND NOT has_org_role(auth.uid(), organization_id, 'client')
    AND NOT has_org_role(auth.uid(), organization_id, 'intern')
  );

CREATE POLICY "Admins can delete signature requests" ON public.signature_requests
  FOR DELETE USING (
    organization_id = get_active_org_id()
    AND (has_org_role(auth.uid(), organization_id, 'owner') OR has_org_role(auth.uid(), organization_id, 'admin'))
  );

-- RF-052: Communication Templates
CREATE TABLE public.communication_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title text NOT NULL,
  channel text NOT NULL DEFAULT 'email',
  content text NOT NULL DEFAULT '',
  variables text[] DEFAULT '{}'::text[],
  version integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.communication_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Non-client org members can view communication templates" ON public.communication_templates
  FOR SELECT USING (
    organization_id = get_active_org_id()
    AND NOT has_org_role(auth.uid(), organization_id, 'client')
  );

CREATE POLICY "Admins can create communication templates" ON public.communication_templates
  FOR INSERT WITH CHECK (
    organization_id = get_active_org_id()
    AND (has_org_role(auth.uid(), organization_id, 'owner') OR has_org_role(auth.uid(), organization_id, 'admin'))
  );

CREATE POLICY "Admins can update communication templates" ON public.communication_templates
  FOR UPDATE USING (
    organization_id = get_active_org_id()
    AND (has_org_role(auth.uid(), organization_id, 'owner') OR has_org_role(auth.uid(), organization_id, 'admin'))
  );

CREATE POLICY "Admins can delete communication templates" ON public.communication_templates
  FOR DELETE USING (
    organization_id = get_active_org_id()
    AND (has_org_role(auth.uid(), organization_id, 'owner') OR has_org_role(auth.uid(), organization_id, 'admin'))
  );
