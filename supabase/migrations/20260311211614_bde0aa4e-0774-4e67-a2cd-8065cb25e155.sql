
-- Drop the restrictive anon policies and recreate as permissive
DROP POLICY IF EXISTS "approval_tokens_anon_read" ON public.approval_tokens;
DROP POLICY IF EXISTS "client_posts_anon_read" ON public.client_posts;
DROP POLICY IF EXISTS "client_posts_anon_approve" ON public.client_posts;

-- Recreate as PERMISSIVE policies for anon
CREATE POLICY "approval_tokens_anon_read"
ON public.approval_tokens
FOR SELECT
TO anon
USING ((active = true) AND (expires_at > now()));

CREATE POLICY "client_posts_anon_read"
ON public.client_posts
FOR SELECT
TO anon
USING (EXISTS (
  SELECT 1 FROM approval_tokens
  WHERE approval_tokens.client_id = client_posts.client_id
    AND approval_tokens.active = true
    AND approval_tokens.expires_at > now()
));

CREATE POLICY "client_posts_anon_approve"
ON public.client_posts
FOR UPDATE
TO anon
USING (EXISTS (
  SELECT 1 FROM approval_tokens
  WHERE approval_tokens.client_id = client_posts.client_id
    AND approval_tokens.active = true
    AND approval_tokens.expires_at > now()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM approval_tokens
  WHERE approval_tokens.client_id = client_posts.client_id
    AND approval_tokens.active = true
    AND approval_tokens.expires_at > now()
));
