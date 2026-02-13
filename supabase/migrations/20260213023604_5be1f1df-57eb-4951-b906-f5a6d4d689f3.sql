
-- =============================================================
-- RF-062: Assets / Inventory
-- =============================================================

CREATE TABLE public.assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  asset_type text NOT NULL DEFAULT 'digital',
  category text NOT NULL DEFAULT 'other',
  status text NOT NULL DEFAULT 'active',
  responsible_id uuid,
  description text,
  location text,
  acquired_at date,
  expires_at timestamptz,
  tags text[] DEFAULT '{}',
  metadata jsonb DEFAULT '{}',
  version integer NOT NULL DEFAULT 1,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_assets_updated_at BEFORE UPDATE ON public.assets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE INDEX idx_assets_org_status ON public.assets(organization_id, status);

CREATE POLICY "assets_select" ON public.assets FOR SELECT
  USING (organization_id = public.get_active_org_id() AND public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "assets_insert" ON public.assets FOR INSERT
  WITH CHECK (
    organization_id = public.get_active_org_id()
    AND (public.has_org_role(auth.uid(), organization_id, 'owner') OR public.has_org_role(auth.uid(), organization_id, 'admin'))
  );

CREATE POLICY "assets_update" ON public.assets FOR UPDATE
  USING (
    organization_id = public.get_active_org_id()
    AND (public.has_org_role(auth.uid(), organization_id, 'owner') OR public.has_org_role(auth.uid(), organization_id, 'admin'))
  );

CREATE POLICY "assets_delete" ON public.assets FOR DELETE
  USING (
    organization_id = public.get_active_org_id()
    AND public.has_org_role(auth.uid(), organization_id, 'owner')
  );

-- Asset usage history
CREATE TABLE public.asset_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  asset_id uuid NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  action text NOT NULL,
  user_id uuid NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.asset_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "asset_history_select" ON public.asset_history FOR SELECT
  USING (organization_id = public.get_active_org_id() AND public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "asset_history_insert" ON public.asset_history FOR INSERT
  WITH CHECK (organization_id = public.get_active_org_id());

-- =============================================================
-- RF-063: Vendors
-- =============================================================

CREATE TABLE public.vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  cnpj text,
  email text,
  phone text,
  business_area text,
  responsible_id uuid,
  status text NOT NULL DEFAULT 'active',
  sla_terms text,
  rating integer,
  notes text,
  tags text[] DEFAULT '{}',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_vendors_updated_at BEFORE UPDATE ON public.vendors FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE POLICY "vendors_select" ON public.vendors FOR SELECT
  USING (organization_id = public.get_active_org_id() AND public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "vendors_insert" ON public.vendors FOR INSERT
  WITH CHECK (
    organization_id = public.get_active_org_id()
    AND (public.has_org_role(auth.uid(), organization_id, 'owner') OR public.has_org_role(auth.uid(), organization_id, 'admin'))
  );

CREATE POLICY "vendors_update" ON public.vendors FOR UPDATE
  USING (
    organization_id = public.get_active_org_id()
    AND (public.has_org_role(auth.uid(), organization_id, 'owner') OR public.has_org_role(auth.uid(), organization_id, 'admin'))
  );

CREATE POLICY "vendors_delete" ON public.vendors FOR DELETE
  USING (
    organization_id = public.get_active_org_id()
    AND public.has_org_role(auth.uid(), organization_id, 'owner')
  );

-- Vendor contracts
CREATE TABLE public.vendor_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  amount_cents integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'BRL',
  start_date date,
  end_date date,
  renewal_date date,
  auto_renew boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active',
  file_url text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.vendor_contracts ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_vendor_contracts_updated_at BEFORE UPDATE ON public.vendor_contracts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE POLICY "vendor_contracts_select" ON public.vendor_contracts FOR SELECT
  USING (organization_id = public.get_active_org_id() AND public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "vendor_contracts_manage" ON public.vendor_contracts FOR ALL
  USING (
    organization_id = public.get_active_org_id()
    AND (public.has_org_role(auth.uid(), organization_id, 'owner') OR public.has_org_role(auth.uid(), organization_id, 'admin'))
  );

-- =============================================================
-- RF-064: Chatbot interactions
-- =============================================================

CREATE TABLE public.chatbot_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Assistente Jurídico',
  system_prompt text,
  tone text NOT NULL DEFAULT 'professional',
  legal_areas text[] DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  can_open_tickets boolean NOT NULL DEFAULT true,
  can_query_processes boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id)
);

ALTER TABLE public.chatbot_configs ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_chatbot_configs_updated_at BEFORE UPDATE ON public.chatbot_configs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE POLICY "chatbot_configs_select" ON public.chatbot_configs FOR SELECT
  USING (organization_id = public.get_active_org_id() AND public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "chatbot_configs_manage" ON public.chatbot_configs FOR ALL
  USING (
    organization_id = public.get_active_org_id()
    AND (public.has_org_role(auth.uid(), organization_id, 'owner') OR public.has_org_role(auth.uid(), organization_id, 'admin'))
  );

CREATE TABLE public.chatbot_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'active',
  summary text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.chatbot_conversations ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_chatbot_conversations_updated_at BEFORE UPDATE ON public.chatbot_conversations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE POLICY "chatbot_conversations_select" ON public.chatbot_conversations FOR SELECT
  USING (organization_id = public.get_active_org_id() AND public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "chatbot_conversations_insert" ON public.chatbot_conversations FOR INSERT
  WITH CHECK (organization_id = public.get_active_org_id() AND public.is_org_member(auth.uid(), organization_id));

CREATE TABLE public.chatbot_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.chatbot_conversations(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'user',
  content text NOT NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.chatbot_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chatbot_messages_select" ON public.chatbot_messages FOR SELECT
  USING (organization_id = public.get_active_org_id() AND public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "chatbot_messages_insert" ON public.chatbot_messages FOR INSERT
  WITH CHECK (organization_id = public.get_active_org_id() AND public.is_org_member(auth.uid(), organization_id));
