
-- Fix ALL RLS policies to be PERMISSIVE (they were created as RESTRICTIVE)

-- Drop all existing restrictive policies and recreate as permissive
DO $$
DECLARE
  tbl TEXT;
  pol_name TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'change_log', 'client_pipelines', 'client_recurring_services', 
    'client_team_assignments', 'clients', 'internal_requests', 
    'leads', 'onboarding_data', 'productivity', 'profiles', 
    'quote_requests', 'settings', 'tasks', 'team_members'
  ]) LOOP
    pol_name := tbl || '_full_access';
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol_name, tbl);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)',
      pol_name, tbl
    );
  END LOOP;
END $$;
