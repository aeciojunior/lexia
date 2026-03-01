

# RF-050 — Geração de Minutas (Draft Generation)

## Summary

Build a complete draft generation module that enhances the existing `AILegalDocs` page with persistent storage, version history, rewriting, and configurable styles. The system will use the existing Lovable AI Gateway (Gemini 3 Flash) via a new edge function that aggregates process context, documents, templates, and legal references.

## Scope (Pragmatic)

Given the frontend-only nature of Lovable, we will implement the core features that are achievable:
- **Database**: `drafts` table with version history, configuration, and audit fields
- **Edge Function**: `generate-draft` — aggregates process data, documents, templates, client info and generates complete legal pieces via Lovable AI Gateway
- **UI Page**: New `/drafts` page with draft list, generation wizard, markdown preview, rewrite capability, version history, and export (copy/PDF)
- **Permissions**: `MANAGE_DOCUMENTS` + `USE_IA_ADVANCED` (or `USE_IA_BASIC` for interns)
- **Sidebar**: Add "Minutas" nav item

**Out of scope** (would require real-time infra not available): collaborative editing (RF-050.6), automatic calculations with live index feeds (RF-050.7), OCR extraction. These are noted as future enhancements.

## Database Migration

```sql
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
```

## Edge Function: `generate-draft`

Located at `supabase/functions/generate-draft/index.ts`:
- Accepts: `process_id`, `piece_type`, `style`, `detail_level`, `instructions`, `template_content`, `rewrite_id` (for rewrites)
- Aggregates context from `processes`, `documents`, `process_events`, `clients`, `legal_references`, `document_templates`
- Calls Lovable AI Gateway with a detailed legal system prompt
- Supports rewrite mode (sends existing content + rewrite instructions)
- Returns generated content with metadata

## UI: `/drafts` page

New page `src/pages/Drafts.tsx`:
- **List view**: All drafts with filters by type, status, process
- **Generation dialog**: Select piece type, style, detail level, linked process, template, instructions
- **Preview**: Markdown rendering of generated content
- **Actions**: Rewrite (with instructions), save, copy, version history dialog
- **Version history**: List of previous versions with ability to view/restore

## Integration Points

- Add route `/drafts` in `App.tsx`
- Add "Minutas" nav item in `AppSidebar.tsx` with `FileText` icon and `USE_IA_ADVANCED` permission
- Register edge function in `supabase/config.toml`
- Audit logs on generation/rewrite/save

## Technical Details

- Model: `google/gemini-3-flash-preview` via Lovable AI Gateway
- Auth: `LOVABLE_API_KEY` (already configured)
- Piece types: petição inicial, contestação, recurso, manifestação, memorial, contrato, parecer, notificação extrajudicial, peça administrativa, personalizada
- Styles: jurídico formal, executivo, técnico, objetivo
- Detail levels: curto, médio, completo

