-- Add approval fields to client_posts
ALTER TABLE public.client_posts 
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS rejection_reason text DEFAULT '',
  ADD COLUMN IF NOT EXISTS approved_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS rejected_at timestamp with time zone;

-- Create approval tokens table for public links
CREATE TABLE IF NOT EXISTS public.approval_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  client_id text NOT NULL,
  client_name text NOT NULL,
  created_by text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '30 days'),
  active boolean NOT NULL DEFAULT true
);

ALTER TABLE public.approval_tokens ENABLE ROW LEVEL SECURITY;

-- Authenticated users can manage tokens
CREATE POLICY "approval_tokens_auth_access" ON public.approval_tokens
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Anonymous users can read tokens (for the public approval page)
CREATE POLICY "approval_tokens_anon_read" ON public.approval_tokens
  FOR SELECT TO anon USING (active = true AND expires_at > now());

-- Anonymous users can read posts linked to valid tokens
CREATE POLICY "client_posts_anon_read" ON public.client_posts
  FOR SELECT TO anon USING (
    EXISTS (
      SELECT 1 FROM public.approval_tokens 
      WHERE approval_tokens.client_id = client_posts.client_id 
      AND approval_tokens.active = true 
      AND approval_tokens.expires_at > now()
    )
  );

-- Anonymous users can update approval status on posts
CREATE POLICY "client_posts_anon_approve" ON public.client_posts
  FOR UPDATE TO anon USING (
    EXISTS (
      SELECT 1 FROM public.approval_tokens 
      WHERE approval_tokens.client_id = client_posts.client_id 
      AND approval_tokens.active = true 
      AND approval_tokens.expires_at > now()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.approval_tokens 
      WHERE approval_tokens.client_id = client_posts.client_id 
      AND approval_tokens.active = true 
      AND approval_tokens.expires_at > now()
    )
  );
