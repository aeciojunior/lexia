

# RF-057 — Comparacao de Textos

## Summary

Create a dedicated Text Comparison module with a new page, edge function for AI-powered semantic/legal analysis, and database table for audit trail. Builds on the existing `DiffView` component for literal diffs and adds AI-driven semantic, legal, and risk analysis layers.

## Database Migration

New `text_comparisons` table to store comparison results and audit trail:

```sql
CREATE TABLE public.text_comparisons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  comparison_type TEXT NOT NULL DEFAULT 'general', -- general, contract, legal_piece, pdf
  text_a_label TEXT DEFAULT 'Texto A',
  text_b_label TEXT DEFAULT 'Texto B',
  text_a TEXT NOT NULL,
  text_b TEXT NOT NULL,
  literal_diff JSONB DEFAULT '[]',
  ai_analysis JSONB DEFAULT '{}',
  source_a_id UUID, -- optional ref to document/draft
  source_b_id UUID,
  risk_level TEXT, -- alto, medio, baixo
  created_at TIMESTAMPTZ DEFAULT now()
);
-- RLS + index on organization_id
```

## Edge Function: `compare-texts`

New function that:
1. Accepts `textA`, `textB`, `comparisonType` (general/contract/legal_piece), optional `processId`
2. Validates auth + org membership + RBAC (USE_IA_ADVANCED permission)
3. Calls Lovable AI Gateway with a specialized system prompt that instructs the model to return structured analysis:
   - Summary of differences
   - Critical changes list
   - Semantic changes
   - Legal impact assessment
   - Risk classification (alto/medio/baixo) for each change
   - Harmonization suggestions
4. Persists result to `text_comparisons`
5. Writes audit logs (`text_comparison_performed`, `text_comparison_legal_change_detected`, etc.)
6. Returns both the literal diff stats and the AI analysis

## New Page: `TextComparison.tsx`

Standalone comparison tool at `/text-comparison` with:

1. **Input mode selector**: Paste text directly OR select from existing drafts/documents
2. **Two text areas** side by side for input
3. **Comparison type selector**: General, Contract (clause-by-clause), Legal Piece (arguments/requests/facts)
4. **Compare button** triggers edge function
5. **Results view** with tabs:
   - **Diff literal** — reuses existing `DiffView` component
   - **AI Analysis** — rendered markdown with semantic changes, legal impacts, risk badges
   - **Risk panel** — colored badges (red/yellow/green) for detected risks
6. **Export** — PDF export of comparison report
7. **History** — list of previous comparisons from `text_comparisons` table

## Routing & Navigation

- Add route `/text-comparison` in `App.tsx`
- Add sidebar entry under AI/Documents section in `AppSidebar.tsx`

## Files Changed

| File | Change |
|------|--------|
| Migration SQL | Create `text_comparisons` table with RLS |
| `supabase/functions/compare-texts/index.ts` | New edge function for AI comparison |
| `supabase/config.toml` | Add `compare-texts` function config |
| `src/pages/TextComparison.tsx` | New comparison page |
| `src/App.tsx` | Add route |
| `src/components/AppSidebar.tsx` | Add nav link |

## Technical Details

- The AI prompt varies by `comparisonType`: contract mode instructs clause-by-clause analysis; legal_piece mode focuses on arguments, requests, and legal foundations
- Literal diff reuses the existing LCS algorithm from `DiffView`
- AI analysis is non-streaming (uses `supabase.functions.invoke`) since the full text needs to be analyzed at once
- Max text size: ~50,000 chars per side (truncated with warning if exceeded)
- Vault documents require ACL check before text extraction

