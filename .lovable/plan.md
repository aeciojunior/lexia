

# RF-052 — Revisão Jurídica com IA

## Summary

Add an AI-powered legal review system to the Drafts page. Follows the same architecture as `suggest-arguments`: edge function with tool calling, persistence table, and a UI panel.

## Database Migration

New `legal_reviews` table to persist review results:

```sql
CREATE TABLE public.legal_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  draft_id UUID NOT NULL REFERENCES public.drafts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  review_mode TEXT NOT NULL DEFAULT 'automatico', -- automatico, assistido, tecnico, linguistico, organizacional
  suggestions JSONB NOT NULL DEFAULT '[]',
  summary TEXT DEFAULT '',
  score INT DEFAULT 0, -- overall quality score 0-100
  status TEXT DEFAULT 'pending', -- pending, applied, dismissed
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.legal_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members manage legal_reviews"
  ON public.legal_reviews FOR ALL
  USING (public.is_org_member(auth.uid(), organization_id));
```

## Edge Function: `review-legal`

- Accepts: `organization_id`, `draft_id`, `review_mode`, `content` (the draft text)
- Uses tool calling to return structured JSON with an array of review suggestions, each containing:
  - `type`: linguistic, clarity, cohesion, technical
  - `severity`: info, warning, error
  - `original`: the problematic text
  - `suggestion`: the corrected text
  - `explanation`: why the change is recommended
  - `category`: grammar, terminology, structure, citation, inconsistency, redundancy
- Also returns `summary` (overall assessment) and `score` (0-100)
- Persists result to `legal_reviews` table
- Audit log: `legal_review_performed`
- Handles 429/402 errors

## UI: `LegalReviewPanel` component

- New component `src/components/drafts/LegalReviewPanel.tsx`
- Triggered by a new "Revisar" button (CheckCheck icon) in the Drafts toolbar
- Shows review mode selector (5 modes) and "Iniciar Revisão" button
- Displays results grouped by type (linguistic, clarity, cohesion, technical)
- Each suggestion card shows: original text highlighted, suggested fix, explanation, severity badge
- Actions: "Aplicar" (replaces text in draft content), "Ignorar"
- Overall quality score display at the top
- Summary text

## Changes to Existing Files

- **`Drafts.tsx`**: Add state for `showReview`, import `LegalReviewPanel`, add toolbar button with `CheckCheck` icon, render panel conditionally alongside the suggestions panel
- **`supabase/config.toml`**: Register `review-legal` function

## Technical Details

- The edge function aggregates draft content + process context (same pattern as suggest-arguments)
- Tool calling schema enforces structured output with the review items array
- "Aplicar" action does a string replace on the draft content and saves via supabase update
- Review modes change the system prompt emphasis (linguistic focus vs technical focus vs organizational style)

