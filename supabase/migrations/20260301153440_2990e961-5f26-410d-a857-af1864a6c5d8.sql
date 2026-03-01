
ALTER TABLE public.text_comparisons
  ADD COLUMN IF NOT EXISTS similarity_percent NUMERIC,
  ADD COLUMN IF NOT EXISTS file_a_format TEXT,
  ADD COLUMN IF NOT EXISTS file_b_format TEXT,
  ADD COLUMN IF NOT EXISTS file_a_size_bytes INTEGER,
  ADD COLUMN IF NOT EXISTS file_b_size_bytes INTEGER,
  ADD COLUMN IF NOT EXISTS detected_languages JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS fraud_indicators JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS financial_analysis JSONB DEFAULT '{}'::jsonb;
