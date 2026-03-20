-- Registration requests: pending account requests that admins approve/reject
CREATE TABLE IF NOT EXISTS public.registration_requests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  username text NOT NULL,
  password_temp text NOT NULL,
  desired_roles text[] DEFAULT '{}',
  message text DEFAULT '',
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.registration_requests ENABLE ROW LEVEL SECURITY;

-- Table-level grants
GRANT INSERT ON public.registration_requests TO anon;
GRANT SELECT, UPDATE ON public.registration_requests TO authenticated;

-- Anonymous users can submit registration requests
CREATE POLICY "anon_insert_registration_requests"
  ON public.registration_requests
  FOR INSERT TO anon
  WITH CHECK (true);

-- Authenticated users (admins) can read all requests
CREATE POLICY "authenticated_select_registration_requests"
  ON public.registration_requests
  FOR SELECT TO authenticated
  USING (true);

-- Authenticated users (admins) can update requests (approve/reject)
CREATE POLICY "authenticated_update_registration_requests"
  ON public.registration_requests
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);
