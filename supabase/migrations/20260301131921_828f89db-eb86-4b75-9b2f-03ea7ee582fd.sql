CREATE TABLE public.legal_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  draft_id UUID NOT NULL REFERENCES public.drafts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  review_mode TEXT NOT NULL DEFAULT 'automatico',
  suggestions JSONB NOT NULL DEFAULT '[]'::jsonb,
  summary TEXT DEFAULT '',
  score INT DEFAULT 0,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.legal_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members manage legal_reviews"
  ON public.legal_reviews FOR ALL
  USING (public.is_org_member(auth.uid(), organization_id));