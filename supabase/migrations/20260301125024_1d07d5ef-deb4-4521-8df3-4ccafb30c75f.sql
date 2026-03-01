
-- Drafts table for RF-050 (Geração de Minutas)
CREATE TABLE public.drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  process_id UUID REFERENCES public.processes(id) ON DELETE SET NULL,
  user_id UUID NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  piece_type TEXT NOT NULL DEFAULT 'peticao_inicial',
  style TEXT NOT NULL DEFAULT 'juridico_formal',
  detail_level TEXT NOT NULL DEFAULT 'completo',
  template_id UUID,
  instructions TEXT DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  version INT NOT NULL DEFAULT 1,
  parent_version_id UUID REFERENCES public.drafts(id) ON DELETE SET NULL,
  config JSONB DEFAULT '{}',
  ai_model TEXT DEFAULT '',
  confidence NUMERIC(3,2) DEFAULT 0,
  relevant_excerpts JSONB DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE public.drafts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members manage drafts" ON public.drafts
  FOR ALL USING (public.is_org_member(auth.uid(), organization_id));

-- Updated_at trigger
CREATE TRIGGER set_drafts_updated_at BEFORE UPDATE ON public.drafts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
