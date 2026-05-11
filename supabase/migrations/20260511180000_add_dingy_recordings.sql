-- Dingy app integration: tabela de gravacoes (calendario)
-- Schema adaptado do dingy original (auth.users uuids -> nomes de team_member)
-- para integrar com o sistema de auth name-based do jg-interno.

-- Funcao helper updated_at (reuso entre tabelas)
CREATE OR REPLACE FUNCTION public.set_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Tabela principal de gravacoes
CREATE TABLE IF NOT EXISTS public.recordings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text DEFAULT '',
  date date NOT NULL,
  start_time time NOT NULL,
  end_time time,
  location text DEFAULT '',
  -- Identidade name-based (igual ao resto do jg-interno)
  responsible_name text,
  participants text[] DEFAULT '{}',
  status text NOT NULL DEFAULT 'agendado',
  color text NOT NULL DEFAULT '#00FF41',
  -- Campos extras herdados do agendamento que ja existia no SocialMediaPage
  client_id text,
  client_name text,
  roteiro text DEFAULT '',
  roteiro_sent boolean NOT NULL DEFAULT false,
  notes text DEFAULT '',
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.recordings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS recordings_full_access ON public.recordings;
CREATE POLICY recordings_full_access ON public.recordings
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS recordings_set_updated_at ON public.recordings;
CREATE TRIGGER recordings_set_updated_at
  BEFORE UPDATE ON public.recordings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_column();

-- Habilita realtime (igual ao dingy)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime'
      AND schemaname='public'
      AND tablename='recordings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.recordings;
  END IF;
END $$;

-- Indices uteis pra filtros do calendario
CREATE INDEX IF NOT EXISTS idx_recordings_date ON public.recordings(date);
CREATE INDEX IF NOT EXISTS idx_recordings_status ON public.recordings(status);
CREATE INDEX IF NOT EXISTS idx_recordings_responsible ON public.recordings(responsible_name);

-- Migracao das 3 gravacoes hardcoded que existiam em SocialMediaPage.tsx
INSERT INTO public.recordings (title, date, start_time, end_time, location, responsible_name, participants, status, color, client_id, client_name, roteiro, roteiro_sent, notes, created_by)
VALUES
  ('Gravação Clínica Almeida', '2026-03-15', '10:00', '11:00', '', 'Riosh', '{}', 'agendado', '#00FF41', '1', 'Clínica Almeida', E'1. Abertura com apresentação\n2. Depoimento paciente\n3. Bastidores procedimento', true, 'Depoimentos + bastidores', 'Sistema'),
  ('Gravação Lima Tech',      '2026-03-18', '14:00', '15:00', '', 'Riosh', '{}', 'agendado', '#3B82F6', '6', 'Lima Tech',       '', false, 'Vídeos para feed', 'Sistema'),
  ('Gravação Bella Estética', '2026-03-20', '09:00', '10:00', '', NULL,    '{}', 'agendado', '#F59E0B', '3', 'Bella Estética',  '', false, 'Conteúdo mensal',  'Sistema')
ON CONFLICT DO NOTHING;
