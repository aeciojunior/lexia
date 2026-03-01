
-- Create text_comparisons table
CREATE TABLE public.text_comparisons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  comparison_type TEXT NOT NULL DEFAULT 'general',
  text_a_label TEXT DEFAULT 'Texto A',
  text_b_label TEXT DEFAULT 'Texto B',
  text_a TEXT NOT NULL,
  text_b TEXT NOT NULL,
  literal_diff JSONB DEFAULT '[]'::jsonb,
  ai_analysis JSONB DEFAULT '{}'::jsonb,
  source_a_id UUID,
  source_b_id UUID,
  risk_level TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for performance
CREATE INDEX idx_text_comparisons_org ON public.text_comparisons(organization_id);
CREATE INDEX idx_text_comparisons_user ON public.text_comparisons(user_id);

-- RLS
ALTER TABLE public.text_comparisons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org comparisons"
  ON public.text_comparisons FOR SELECT
  TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Users can insert comparisons in own org"
  ON public.text_comparisons FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_org_member(auth.uid(), organization_id)
    AND user_id = auth.uid()
  );

CREATE POLICY "Users can delete own comparisons"
  ON public.text_comparisons FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());
