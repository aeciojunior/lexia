

# RF-051/052/053/054/055 — Assistente Jurídico Inteligente

## Summary

All these RFs (argument suggestion, request suggestion, legal basis suggestion, evidence suggestion, secure vault) share a common pattern: AI-powered contextual suggestions for legal drafts. Rather than creating separate pages/functions for each, the pragmatic approach is to:

1. **Create a new edge function `suggest-arguments`** that handles all suggestion types (arguments, requests, legal basis, evidence, counter-arguments) via a `suggestion_type` parameter
2. **Create a new `argument_suggestions` table** to persist suggestions with metadata (type, strength, risk, sources)
3. **Build a reusable `ArgumentSuggestionsPanel` component** that integrates into the existing Drafts page as a collapsible side panel
4. **RF-055 (Vault)** is already implemented in `VaultDocuments.tsx` — no changes needed

## Database Migration

```sql
CREATE TABLE public.argument_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  draft_id UUID REFERENCES public.drafts(id) ON DELETE CASCADE,
  process_id UUID REFERENCES public.processes(id) ON DELETE SET NULL,
  user_id UUID NOT NULL,
  suggestion_type TEXT NOT NULL DEFAULT 'argument',
  -- types: argument, counter_argument, request, legal_basis, evidence
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  legal_basis TEXT DEFAULT '',
  jurisprudence TEXT DEFAULT '',
  risk_level TEXT DEFAULT 'medium',
  strength_score INT DEFAULT 50,
  category TEXT DEFAULT 'merito',
  sources JSONB DEFAULT '[]',
  status TEXT DEFAULT 'pending',
  -- pending, inserted, rejected
  created_at TIMESTAMPTZ DEFAULT now()
);
-- RLS + policy using is_org_member
```

## Edge Function: `suggest-arguments`

- Accepts: `process_id`, `draft_id`, `suggestion_type`, `piece_type`, `context` (optional extra text)
- Aggregates process data, documents, events (same pattern as `generate-draft`)
- Uses tool calling to return structured JSON array of suggestions with title, content, legal_basis, jurisprudence, risk_level, strength_score, category
- Handles all suggestion types via system prompt variation per type
- Audit logs: `argument_suggestion_generated`, `counter_argument_generated`, etc.

## UI: `ArgumentSuggestionsPanel` Component

- Collapsible right panel in the Drafts page, toggled by a "Sugestões IA" button
- Tabs for: Argumentos, Contra-Argumentos, Pedidos, Fundamentos, Provas
- Each suggestion card shows: title, risk badge, strength indicator, content preview
- Actions: "Inserir na minuta" (appends to draft content), "Rejeitar", "Expandir"
- Generation button per tab that calls the edge function
- Persists suggestions to `argument_suggestions` table

## Changes to Existing Files

- **`Drafts.tsx`**: Add the panel toggle button in the header area, import and render `ArgumentSuggestionsPanel` conditionally on the right side
- **`App.tsx`**: No new route needed (panel is inside Drafts)
- **`supabase/config.toml`**: Register `suggest-arguments` function
- **`types.ts`**: Auto-updated after migration

## RF-055 (Vault)

Already implemented in `VaultDocuments.tsx` with upload, download via signed URLs, categories, and audit logging. No additional work needed.

