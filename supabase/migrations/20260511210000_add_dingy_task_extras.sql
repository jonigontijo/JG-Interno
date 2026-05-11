-- Extras dos cards do Dingy: checklist e comentarios persistentes por tarefa.
-- task_id e text porque o id da task no jg-interno e string nao-uuid.

CREATE TABLE IF NOT EXISTS public.dingy_task_checklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id text NOT NULL,
  text text NOT NULL,
  done boolean NOT NULL DEFAULT false,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.dingy_task_checklist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dingy_task_checklist_full_access ON public.dingy_task_checklist;
CREATE POLICY dingy_task_checklist_full_access ON public.dingy_task_checklist
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS dingy_task_checklist_set_updated_at ON public.dingy_task_checklist;
CREATE TRIGGER dingy_task_checklist_set_updated_at
  BEFORE UPDATE ON public.dingy_task_checklist
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_column();

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='dingy_task_checklist'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.dingy_task_checklist;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_dingy_task_checklist_task_id
  ON public.dingy_task_checklist(task_id);

CREATE TABLE IF NOT EXISTS public.dingy_task_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id text NOT NULL,
  author_name text NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.dingy_task_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dingy_task_comments_full_access ON public.dingy_task_comments;
CREATE POLICY dingy_task_comments_full_access ON public.dingy_task_comments
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='dingy_task_comments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.dingy_task_comments;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_dingy_task_comments_task_id_created
  ON public.dingy_task_comments(task_id, created_at);
