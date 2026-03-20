
-- ===== PROFILES (linked to auth.users) =====
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT '',
  roles TEXT[] NOT NULL DEFAULT '{}',
  is_admin BOOLEAN NOT NULL DEFAULT false,
  active BOOLEAN NOT NULL DEFAULT true,
  hire_date TEXT,
  module_access TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read all profiles"
  ON public.profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE POLICY "Admins can manage all profiles"
  ON public.profiles FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- ===== TEAM MEMBERS =====
CREATE TABLE public.team_members (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT '',
  roles TEXT[] NOT NULL DEFAULT '{}',
  avatar TEXT NOT NULL DEFAULT '',
  current_load INTEGER NOT NULL DEFAULT 0,
  capacity INTEGER NOT NULL DEFAULT 40,
  tasks_active INTEGER NOT NULL DEFAULT 0,
  specialty TEXT[] NOT NULL DEFAULT '{}',
  salary NUMERIC DEFAULT 0,
  company TEXT DEFAULT 'JG',
  hire_date TEXT,
  total_cost NUMERIC DEFAULT 0,
  salary_base NUMERIC DEFAULT 0,
  salary_bonus NUMERIC DEFAULT 0,
  salary_vt NUMERIC DEFAULT 0,
  salary_com_trafego NUMERIC DEFAULT 0,
  salary_com_google NUMERIC DEFAULT 0,
  salary_com_site NUMERIC DEFAULT 0,
  salary_com_id_vis NUMERIC DEFAULT 0,
  salary_mens_ia NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read team" ON public.team_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert team" ON public.team_members FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update team" ON public.team_members FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete team" ON public.team_members FOR DELETE TO authenticated USING (true);

-- ===== CLIENTS =====
CREATE TABLE public.clients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  company TEXT NOT NULL,
  services TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'Operação',
  substatus TEXT NOT NULL DEFAULT 'Ativo',
  monthly_value NUMERIC NOT NULL DEFAULT 0,
  setup_value NUMERIC NOT NULL DEFAULT 0,
  risk_level TEXT NOT NULL DEFAULT 'low',
  traffic_manager TEXT,
  social_manager TEXT,
  account_manager TEXT NOT NULL DEFAULT 'Joni',
  pending_tasks INTEGER NOT NULL DEFAULT 0,
  overdue_tasks INTEGER NOT NULL DEFAULT 0,
  last_approval TEXT,
  next_recording TEXT,
  payment_status TEXT DEFAULT 'em_dia',
  payment_due_date TEXT,
  payment_due_day INTEGER,
  social_media_posts INTEGER DEFAULT 0,
  posts_ready_this_week INTEGER DEFAULT 0,
  posts_ready_next_week INTEGER DEFAULT 0,
  is_paid BOOLEAN DEFAULT false,
  paid_date TEXT,
  days_overdue INTEGER DEFAULT 0,
  is_barter BOOLEAN DEFAULT false,
  barter_description TEXT,
  barter_agreed_value NUMERIC,
  barter_start_date TEXT,
  barter_end_date TEXT,
  barter_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read clients" ON public.clients FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert clients" ON public.clients FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update clients" ON public.clients FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete clients" ON public.clients FOR DELETE TO authenticated USING (true);

-- ===== CLIENT TEAM ASSIGNMENTS =====
CREATE TABLE public.client_team_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id TEXT NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  member_id TEXT NOT NULL,
  member_name TEXT NOT NULL,
  role TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.client_team_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can manage client_team" ON public.client_team_assignments FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ===== CLIENT RECURRING SERVICES =====
CREATE TABLE public.client_recurring_services (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  assignee_id TEXT NOT NULL,
  assignee_name TEXT NOT NULL,
  frequency TEXT NOT NULL DEFAULT 'mensal',
  quantity_per_cycle INTEGER,
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.client_recurring_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can manage recurring_services" ON public.client_recurring_services FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ===== TASKS =====
CREATE TABLE public.tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  client TEXT NOT NULL DEFAULT '',
  client_id TEXT NOT NULL DEFAULT '',
  module TEXT NOT NULL DEFAULT '',
  sector TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT '',
  assignee TEXT NOT NULL DEFAULT '',
  reviewer TEXT,
  deadline TEXT NOT NULL,
  urgency TEXT NOT NULL DEFAULT 'normal',
  status TEXT NOT NULL DEFAULT 'pending',
  weight INTEGER NOT NULL DEFAULT 1,
  estimated_hours NUMERIC NOT NULL DEFAULT 1,
  actual_hours NUMERIC,
  has_rework BOOLEAN NOT NULL DEFAULT false,
  created_at TEXT NOT NULL DEFAULT to_char(now(), 'YYYY-MM-DD'),
  started_at TEXT,
  completed_at TEXT,
  time_spent_minutes INTEGER DEFAULT 0
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can manage tasks" ON public.tasks FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ===== LEADS =====
CREATE TABLE public.leads (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  company TEXT NOT NULL,
  responsible TEXT NOT NULL DEFAULT '',
  meeting_date TEXT NOT NULL DEFAULT '',
  origin TEXT NOT NULL DEFAULT '',
  stage TEXT NOT NULL DEFAULT '',
  potential_value NUMERIC NOT NULL DEFAULT 0,
  next_follow_up TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  services TEXT[] DEFAULT '{}',
  discount NUMERIC,
  final_value NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can manage leads" ON public.leads FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ===== QUOTE REQUESTS =====
CREATE TABLE public.quote_requests (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  client_name TEXT NOT NULL,
  service TEXT NOT NULL,
  requested_by TEXT NOT NULL,
  requested_at TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  proposal_value NUMERIC,
  proposal_sent_at TEXT,
  approved_at TEXT,
  paid_at TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.quote_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can manage quotes" ON public.quote_requests FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ===== INTERNAL REQUESTS =====
CREATE TABLE public.internal_requests (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  requester_id TEXT NOT NULL,
  requester_name TEXT NOT NULL,
  assigned_to_name TEXT NOT NULL,
  assigned_to_id TEXT NOT NULL,
  client_id TEXT,
  client_name TEXT,
  department TEXT NOT NULL DEFAULT '',
  priority TEXT NOT NULL DEFAULT 'normal',
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT to_char(now(), 'YYYY-MM-DD'),
  due_date TEXT,
  task_id TEXT,
  redistributed_to TEXT,
  redistributed_by TEXT
);

ALTER TABLE public.internal_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can manage requests" ON public.internal_requests FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ===== CLIENT PIPELINES =====
CREATE TABLE public.client_pipelines (
  client_id TEXT PRIMARY KEY,
  current_step_order INTEGER NOT NULL DEFAULT 1,
  completed_steps INTEGER[] NOT NULL DEFAULT '{}',
  started_at TEXT NOT NULL,
  completed_at TEXT
);

ALTER TABLE public.client_pipelines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can manage pipelines" ON public.client_pipelines FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ===== ONBOARDING DATA =====
CREATE TABLE public.onboarding_data (
  client_id TEXT PRIMARY KEY,
  checklist JSONB NOT NULL DEFAULT '{}',
  access_data JSONB NOT NULL DEFAULT '{}'
);

ALTER TABLE public.onboarding_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can manage onboarding" ON public.onboarding_data FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ===== SETTINGS =====
CREATE TABLE public.settings (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  label TEXT NOT NULL,
  value TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT 'text',
  options TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read settings" ON public.settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can manage settings" ON public.settings FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ===== PRODUCTIVITY =====
CREATE TABLE public.productivity (
  user_id TEXT PRIMARY KEY,
  user_name TEXT NOT NULL,
  tasks_completed_today INTEGER NOT NULL DEFAULT 0,
  avg_tasks_per_day NUMERIC NOT NULL DEFAULT 0,
  total_tasks_completed INTEGER NOT NULL DEFAULT 0,
  total_days_worked INTEGER NOT NULL DEFAULT 0,
  last_updated TEXT NOT NULL DEFAULT to_char(now(), 'YYYY-MM-DD')
);

ALTER TABLE public.productivity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can manage productivity" ON public.productivity FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ===== TRIGGER: Auto-create profile on signup =====
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, username, name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'username', NEW.email), COALESCE(NEW.raw_user_meta_data->>'name', ''));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
