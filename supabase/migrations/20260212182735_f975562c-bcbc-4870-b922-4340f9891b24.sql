
-- Add language and timezone columns to profiles
ALTER TABLE public.profiles
ADD COLUMN language TEXT NOT NULL DEFAULT 'pt-BR',
ADD COLUMN timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo';
