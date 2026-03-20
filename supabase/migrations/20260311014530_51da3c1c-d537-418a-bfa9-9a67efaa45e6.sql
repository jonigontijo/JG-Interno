
-- Fix ALL RLS policies to be PERMISSIVE instead of RESTRICTIVE

-- change_log
DROP POLICY IF EXISTS "Authenticated can manage change_log" ON public.change_log;
CREATE POLICY "change_log_full_access" ON public.change_log FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- client_pipelines
DROP POLICY IF EXISTS "Authenticated can manage pipelines" ON public.client_pipelines;
CREATE POLICY "client_pipelines_full_access" ON public.client_pipelines FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- client_recurring_services
DROP POLICY IF EXISTS "Authenticated can manage recurring_services" ON public.client_recurring_services;
CREATE POLICY "client_recurring_services_full_access" ON public.client_recurring_services FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- client_team_assignments
DROP POLICY IF EXISTS "Authenticated can manage client_team" ON public.client_team_assignments;
CREATE POLICY "client_team_assignments_full_access" ON public.client_team_assignments FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- clients
DROP POLICY IF EXISTS "Authenticated full access clients" ON public.clients;
CREATE POLICY "clients_full_access" ON public.clients FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- internal_requests
DROP POLICY IF EXISTS "Authenticated can manage requests" ON public.internal_requests;
CREATE POLICY "internal_requests_full_access" ON public.internal_requests FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- leads
DROP POLICY IF EXISTS "Authenticated can manage leads" ON public.leads;
CREATE POLICY "leads_full_access" ON public.leads FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- onboarding_data
DROP POLICY IF EXISTS "Authenticated can manage onboarding" ON public.onboarding_data;
CREATE POLICY "onboarding_data_full_access" ON public.onboarding_data FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- productivity
DROP POLICY IF EXISTS "Authenticated can manage productivity" ON public.productivity;
CREATE POLICY "productivity_full_access" ON public.productivity FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- profiles
DROP POLICY IF EXISTS "Authenticated can read profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;
CREATE POLICY "profiles_full_access" ON public.profiles FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- quote_requests
DROP POLICY IF EXISTS "Authenticated can manage quotes" ON public.quote_requests;
CREATE POLICY "quote_requests_full_access" ON public.quote_requests FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- settings
DROP POLICY IF EXISTS "Authenticated can manage settings" ON public.settings;
CREATE POLICY "settings_full_access" ON public.settings FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- tasks
DROP POLICY IF EXISTS "Authenticated can manage tasks" ON public.tasks;
CREATE POLICY "tasks_full_access" ON public.tasks FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- team_members
DROP POLICY IF EXISTS "Authenticated full access team" ON public.team_members;
CREATE POLICY "team_members_full_access" ON public.team_members FOR ALL TO authenticated USING (true) WITH CHECK (true);
