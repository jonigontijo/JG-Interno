-- ============================================================
-- Integração Google Sheets — espelho da planilha de clientes
-- Sync bidirecional (planilha ⇄ JG Interno)
-- ============================================================

-- Conexão / tokens OAuth (linha única, espelha google_calendar_connection)
CREATE TABLE IF NOT EXISTS sm_sheets_connection (
  id                  integer PRIMARY KEY DEFAULT 1,
  google_email        text,
  access_token        text,
  refresh_token       text,
  expires_at          timestamptz,

  spreadsheet_id      text NOT NULL DEFAULT '1SELRHKbWugVSwDkHE3KwEeB8HJlMiKc7INPfpp98E7w',
  sheet_name          text,                 -- aba (gid/título); null = primeira aba
  sheet_range         text DEFAULT 'A:E',   -- intervalo sincronizado

  -- Google Drive push (files.watch) para realtime
  channel_id          text,
  resource_id         text,
  channel_expires_at  timestamptz,

  connected_by        uuid REFERENCES profiles(id) ON DELETE SET NULL,
  connected_at        timestamptz,
  last_synced_at      timestamptz,
  updated_at          timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT sm_sheets_connection_singleton CHECK (id = 1)
);

INSERT INTO sm_sheets_connection (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- Espelho das linhas da planilha
CREATE TABLE IF NOT EXISTS sm_sheet_clients (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  row_index           integer NOT NULL,         -- linha na planilha (1 = primeira linha de dados)

  cliente             text,
  quantidade_post     text,
  segmento            text,
  instagram           text,
  senhas              text,

  -- controle de sync
  source_hash         text,                     -- hash da linha vinda da planilha (detecta mudança)
  last_synced_at      timestamptz NOT NULL DEFAULT now(),
  updated_in_app_at   timestamptz,              -- quando editado no JG Interno (para push)

  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  UNIQUE (row_index)
);

CREATE INDEX IF NOT EXISTS idx_sm_sheet_clients_cliente ON sm_sheet_clients(cliente);

-- Triggers updated_at
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_sm_sheets_connection_updated_at') THEN
    CREATE TRIGGER trg_sm_sheets_connection_updated_at
      BEFORE UPDATE ON sm_sheets_connection
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_sm_sheet_clients_updated_at') THEN
    CREATE TRIGGER trg_sm_sheet_clients_updated_at
      BEFORE UPDATE ON sm_sheet_clients
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END
$$;

-- RLS aberta a todos autenticados (padrão do módulo)
ALTER TABLE sm_sheets_connection ENABLE ROW LEVEL SECURITY;
ALTER TABLE sm_sheet_clients     ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated sm_sheets_connection"
  ON sm_sheets_connection FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "All authenticated sm_sheet_clients"
  ON sm_sheet_clients FOR ALL TO authenticated USING (true) WITH CHECK (true);
