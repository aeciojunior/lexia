
-- Avatars storage bucket (public)
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);

-- Avatars storage policies
CREATE POLICY "Avatar images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload their own avatar"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own avatar"
ON storage.objects FOR UPDATE
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own avatar"
ON storage.objects FOR DELETE
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Documents storage bucket (private)
INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', false);

-- Documents storage policies
CREATE POLICY "Users can view their own documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload their own documents"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own documents"
ON storage.objects FOR DELETE
USING (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Documents table
CREATE TABLE public.documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  process_id UUID REFERENCES public.processes(id) ON DELETE SET NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size BIGINT,
  file_type TEXT,
  category TEXT NOT NULL DEFAULT 'other',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own documents"
ON public.documents FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create documents"
ON public.documents FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own documents"
ON public.documents FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own documents"
ON public.documents FOR DELETE
USING (auth.uid() = user_id);

-- Updated_at trigger
CREATE TRIGGER update_documents_updated_at
BEFORE UPDATE ON public.documents
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
