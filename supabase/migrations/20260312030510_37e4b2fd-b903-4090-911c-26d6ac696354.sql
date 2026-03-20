CREATE TABLE public.salary_projections (
  member_id TEXT NOT NULL PRIMARY KEY,
  projected_salary NUMERIC NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.salary_projections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "salary_projections_full_access" ON public.salary_projections
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
