-- Create storage bucket for social media posts
INSERT INTO storage.buckets (id, name, public) VALUES ('social-posts', 'social-posts', true)
ON CONFLICT (id) DO NOTHING;

-- Create table to track uploaded posts per client
CREATE TABLE IF NOT EXISTS public.client_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text NOT NULL,
  client_name text NOT NULL,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_type text NOT NULL DEFAULT 'image',
  status text NOT NULL DEFAULT 'ready',
  uploaded_by text NOT NULL,
  uploaded_at timestamp with time zone NOT NULL DEFAULT now(),
  notes text DEFAULT ''
);

ALTER TABLE public.client_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "client_posts_full_access" ON public.client_posts
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Storage policies for social-posts bucket
CREATE POLICY "social_posts_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'social-posts');

CREATE POLICY "social_posts_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'social-posts');

CREATE POLICY "social_posts_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'social-posts');
