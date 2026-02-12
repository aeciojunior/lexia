
-- =============================================
-- RF-001: Multi-tenant completo
-- =============================================

-- 1. Tabela de organizações
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  tax_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- 2. Tabela de vínculo usuário-organização
CREATE TABLE public.user_organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, organization_id)
);
ALTER TABLE public.user_organizations ENABLE ROW LEVEL SECURITY;

-- 3. Tabela de audit logs
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id),
  user_id UUID,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 4. Adicionar organization_id e active_organization_id às tabelas existentes
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS active_organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.processes ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.documents ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.deadlines ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.chat_messages ADD COLUMN organization_id UUID REFERENCES public.organizations(id);

-- 5. Trigger updated_at para organizations
CREATE TRIGGER update_organizations_updated_at
BEFORE UPDATE ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 6. Funções auxiliares SECURITY DEFINER

-- Retorna a organização ativa do usuário logado
CREATE OR REPLACE FUNCTION public.get_active_org_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT active_organization_id FROM public.profiles WHERE user_id = auth.uid()
$$;

-- Verifica se o usuário pertence a uma organização
CREATE OR REPLACE FUNCTION public.is_org_member(_user_id UUID, _org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_organizations
    WHERE user_id = _user_id AND organization_id = _org_id
  )
$$;

-- Verifica se o usuário tem um role específico na organização
CREATE OR REPLACE FUNCTION public.has_org_role(_user_id UUID, _org_id UUID, _role TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_organizations
    WHERE user_id = _user_id AND organization_id = _org_id AND role = _role
  )
$$;

-- 7. RLS para organizations
CREATE POLICY "Users can view their organizations"
ON public.organizations FOR SELECT
USING (public.is_org_member(auth.uid(), id));

CREATE POLICY "Owners can update their organization"
ON public.organizations FOR UPDATE
USING (public.has_org_role(auth.uid(), id, 'owner'));

-- 8. RLS para user_organizations
CREATE POLICY "Users can view org memberships"
ON public.user_organizations FOR SELECT
USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org admins can insert memberships"
ON public.user_organizations FOR INSERT
WITH CHECK (
  public.has_org_role(auth.uid(), organization_id, 'admin')
  OR public.has_org_role(auth.uid(), organization_id, 'owner')
);

CREATE POLICY "Org admins can update memberships"
ON public.user_organizations FOR UPDATE
USING (
  public.has_org_role(auth.uid(), organization_id, 'admin')
  OR public.has_org_role(auth.uid(), organization_id, 'owner')
);

CREATE POLICY "Org admins can delete memberships"
ON public.user_organizations FOR DELETE
USING (
  public.has_org_role(auth.uid(), organization_id, 'admin')
  OR public.has_org_role(auth.uid(), organization_id, 'owner')
);

-- 9. Atualizar RLS de processes (drop old + create new)
DROP POLICY IF EXISTS "Users can view own processes" ON public.processes;
DROP POLICY IF EXISTS "Admins can view all processes" ON public.processes;
DROP POLICY IF EXISTS "Users can create processes" ON public.processes;
DROP POLICY IF EXISTS "Users can update own processes" ON public.processes;
DROP POLICY IF EXISTS "Users can delete own processes" ON public.processes;

CREATE POLICY "Org members can view processes"
ON public.processes FOR SELECT
USING (organization_id = public.get_active_org_id());

CREATE POLICY "Org members can create processes"
ON public.processes FOR INSERT
WITH CHECK (organization_id = public.get_active_org_id());

CREATE POLICY "Org members can update processes"
ON public.processes FOR UPDATE
USING (organization_id = public.get_active_org_id());

CREATE POLICY "Org members can delete processes"
ON public.processes FOR DELETE
USING (organization_id = public.get_active_org_id());

-- 10. Atualizar RLS de documents
DROP POLICY IF EXISTS "Users can view own documents" ON public.documents;
DROP POLICY IF EXISTS "Users can create documents" ON public.documents;
DROP POLICY IF EXISTS "Users can update own documents" ON public.documents;
DROP POLICY IF EXISTS "Users can delete own documents" ON public.documents;

CREATE POLICY "Org members can view documents"
ON public.documents FOR SELECT
USING (organization_id = public.get_active_org_id());

CREATE POLICY "Org members can create documents"
ON public.documents FOR INSERT
WITH CHECK (organization_id = public.get_active_org_id());

CREATE POLICY "Org members can update documents"
ON public.documents FOR UPDATE
USING (organization_id = public.get_active_org_id());

CREATE POLICY "Org members can delete documents"
ON public.documents FOR DELETE
USING (organization_id = public.get_active_org_id());

-- 11. Atualizar RLS de deadlines
DROP POLICY IF EXISTS "Users can view own deadlines" ON public.deadlines;
DROP POLICY IF EXISTS "Users can create deadlines" ON public.deadlines;
DROP POLICY IF EXISTS "Users can update own deadlines" ON public.deadlines;
DROP POLICY IF EXISTS "Users can delete own deadlines" ON public.deadlines;

CREATE POLICY "Org members can view deadlines"
ON public.deadlines FOR SELECT
USING (organization_id = public.get_active_org_id());

CREATE POLICY "Org members can create deadlines"
ON public.deadlines FOR INSERT
WITH CHECK (organization_id = public.get_active_org_id());

CREATE POLICY "Org members can update deadlines"
ON public.deadlines FOR UPDATE
USING (organization_id = public.get_active_org_id());

CREATE POLICY "Org members can delete deadlines"
ON public.deadlines FOR DELETE
USING (organization_id = public.get_active_org_id());

-- 12. Atualizar RLS de chat_messages
DROP POLICY IF EXISTS "Users can view own messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can create messages" ON public.chat_messages;

CREATE POLICY "Org members can view chat messages"
ON public.chat_messages FOR SELECT
USING (organization_id = public.get_active_org_id() AND auth.uid() = user_id);

CREATE POLICY "Org members can create chat messages"
ON public.chat_messages FOR INSERT
WITH CHECK (organization_id = public.get_active_org_id() AND auth.uid() = user_id);

-- 13. RLS de audit_logs
CREATE POLICY "Org admins can view audit logs"
ON public.audit_logs FOR SELECT
USING (
  organization_id = public.get_active_org_id()
  AND (
    public.has_org_role(auth.uid(), organization_id, 'admin')
    OR public.has_org_role(auth.uid(), organization_id, 'owner')
  )
);

CREATE POLICY "System can insert audit logs"
ON public.audit_logs FOR INSERT
WITH CHECK (true);

-- 14. Atualizar handle_new_user para criar organização padrão
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_org_id UUID;
BEGIN
  -- Criar perfil
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'full_name');

  -- Role padrão do sistema
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');

  -- Criar organização padrão
  INSERT INTO public.organizations (name)
  VALUES (COALESCE(NEW.raw_user_meta_data ->> 'full_name', 'Meu Escritório'))
  RETURNING id INTO new_org_id;

  -- Vincular como owner
  INSERT INTO public.user_organizations (user_id, organization_id, role)
  VALUES (NEW.id, new_org_id, 'owner');

  -- Definir como organização ativa
  UPDATE public.profiles SET active_organization_id = new_org_id WHERE user_id = NEW.id;

  RETURN NEW;
END;
$$;
