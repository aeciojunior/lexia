
-- RF-030: Add required fields for process registration
ALTER TABLE public.processes
  ADD COLUMN IF NOT EXISTS foro text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS vara text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS classe text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS assunto text[] DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS fase text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS valor_causa numeric(15,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS partes jsonb DEFAULT '{"autores":[],"reus":[]}'::jsonb;
