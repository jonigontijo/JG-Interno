-- Tabela para pedidos de ajuda do Dingy (aba dentro do Social Media).
-- Qualquer membro do time de Social Media pode criar um pedido a partir de um
-- card no Board, e qualquer outro membro pode aceitar e assumir a tarefa.

CREATE TABLE IF NOT EXISTS public.dingy_help_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id text NOT NULL,
  task_title text NOT NULL,
  task_client text DEFAULT '',
  requester_name text NOT NULL,
  helper_name text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','accepted','done','cancelled')),
  message text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.dingy_help_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dingy_help_requests_full_access ON public.dingy_help_requests;
CREATE POLICY dingy_help_requests_full_access ON public.dingy_help_requests
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS dingy_help_requests_set_updated_at ON public.dingy_help_requests;
CREATE TRIGGER dingy_help_requests_set_updated_at
  BEFORE UPDATE ON public.dingy_help_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_column();

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime'
      AND schemaname='public'
      AND tablename='dingy_help_requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.dingy_help_requests;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_dingy_help_requests_status
  ON public.dingy_help_requests(status);
CREATE INDEX IF NOT EXISTS idx_dingy_help_requests_created_at
  ON public.dingy_help_requests(created_at DESC);
