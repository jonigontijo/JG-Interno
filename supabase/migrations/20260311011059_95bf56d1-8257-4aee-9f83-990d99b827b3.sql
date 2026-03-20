
-- Fix ALL RLS policies: change from RESTRICTIVE to PERMISSIVE
-- Drop all restrictive policies and recreate as permissive

-- ===== team_members =====
DROP POLICY IF EXISTS "Authenticated can read team" ON public.team_members;
DROP POLICY IF EXISTS "Authenticated can insert team" ON public.team_members;
DROP POLICY IF EXISTS "Authenticated can update team" ON public.team_members;
DROP POLICY IF EXISTS "Authenticated can delete team" ON public.team_members;

CREATE POLICY "Authenticated can read team" ON public.team_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert team" ON public.team_members FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update team" ON public.team_members FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete team" ON public.team_members FOR DELETE TO authenticated USING (true);

-- ===== clients =====
DROP POLICY IF EXISTS "Authenticated can read clients" ON public.clients;
DROP POLICY IF EXISTS "Authenticated can insert clients" ON public.clients;
DROP POLICY IF EXISTS "Authenticated can update clients" ON public.clients;
DROP POLICY IF EXISTS "Authenticated can delete clients" ON public.clients;

CREATE POLICY "Authenticated can read clients" ON public.clients FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert clients" ON public.clients FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update clients" ON public.clients FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete clients" ON public.clients FOR DELETE TO authenticated USING (true);

-- ===== tasks =====
DROP POLICY IF EXISTS "Authenticated can manage tasks" ON public.tasks;
CREATE POLICY "Authenticated can manage tasks" ON public.tasks FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ===== leads =====
DROP POLICY IF EXISTS "Authenticated can manage leads" ON public.leads;
CREATE POLICY "Authenticated can manage leads" ON public.leads FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ===== client_team_assignments =====
DROP POLICY IF EXISTS "Authenticated can manage client_team" ON public.client_team_assignments;
CREATE POLICY "Authenticated can manage client_team" ON public.client_team_assignments FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ===== client_recurring_services =====
DROP POLICY IF EXISTS "Authenticated can manage recurring_services" ON public.client_recurring_services;
CREATE POLICY "Authenticated can manage recurring_services" ON public.client_recurring_services FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ===== client_pipelines =====
DROP POLICY IF EXISTS "Authenticated can manage pipelines" ON public.client_pipelines;
CREATE POLICY "Authenticated can manage pipelines" ON public.client_pipelines FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ===== quote_requests =====
DROP POLICY IF EXISTS "Authenticated can manage quotes" ON public.quote_requests;
CREATE POLICY "Authenticated can manage quotes" ON public.quote_requests FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ===== internal_requests =====
DROP POLICY IF EXISTS "Authenticated can manage requests" ON public.internal_requests;
CREATE POLICY "Authenticated can manage requests" ON public.internal_requests FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ===== onboarding_data =====
DROP POLICY IF EXISTS "Authenticated can manage onboarding" ON public.onboarding_data;
CREATE POLICY "Authenticated can manage onboarding" ON public.onboarding_data FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ===== settings =====
DROP POLICY IF EXISTS "Authenticated can manage settings" ON public.settings;
DROP POLICY IF EXISTS "Authenticated can read settings" ON public.settings;
CREATE POLICY "Authenticated can manage settings" ON public.settings FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ===== productivity =====
DROP POLICY IF EXISTS "Authenticated can manage productivity" ON public.productivity;
CREATE POLICY "Authenticated can manage productivity" ON public.productivity FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ===== profiles (keep granular but make permissive) =====
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can read all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Authenticated users can read all profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Admins can manage all profiles" ON public.profiles FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

-- ===== Change history table =====
CREATE TABLE IF NOT EXISTS public.change_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  action text NOT NULL,
  changed_by text NOT NULL,
  changed_at timestamp with time zone NOT NULL DEFAULT now(),
  old_data jsonb,
  new_data jsonb,
  description text
);

ALTER TABLE public.change_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can manage change_log" ON public.change_log FOR ALL TO authenticated USING (true) WITH CHECK (true);
