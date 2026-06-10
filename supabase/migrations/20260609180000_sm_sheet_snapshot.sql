-- ============================================================
-- Espelho genérico multi-aba do Google Sheets (POSTAGENS JG)
-- sm_sheet_tabs  = as abas da planilha (JANEIRO/26, JUNHO/26, CLIENTES...)
-- sm_sheet_data  = as linhas de cada aba (células como JSONB)
-- ============================================================

CREATE TABLE IF NOT EXISTS sm_sheet_tabs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gid             bigint,                 -- sheetId do Google
  title           text NOT NULL,          -- nome da aba
  position        integer NOT NULL DEFAULT 0,
  col_count       integer NOT NULL DEFAULT 0,
  row_count       integer NOT NULL DEFAULT 0,
  last_synced_at  timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (title)
);

CREATE TABLE IF NOT EXISTS sm_sheet_data (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tab_id            uuid NOT NULL REFERENCES sm_sheet_tabs(id) ON DELETE CASCADE,
  row_index         integer NOT NULL,     -- 0-based, posição da linha na aba (inclui cabeçalhos)
  cells             jsonb NOT NULL DEFAULT '[]',  -- array de strings (uma por coluna)
  source_hash       text,
  updated_in_app_at timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tab_id, row_index)
);

CREATE INDEX IF NOT EXISTS idx_sm_sheet_data_tab ON sm_sheet_data(tab_id, row_index);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_sm_sheet_tabs_updated_at') THEN
    CREATE TRIGGER trg_sm_sheet_tabs_updated_at BEFORE UPDATE ON sm_sheet_tabs
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_sm_sheet_data_updated_at') THEN
    CREATE TRIGGER trg_sm_sheet_data_updated_at BEFORE UPDATE ON sm_sheet_data
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END
$$;

ALTER TABLE sm_sheet_tabs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sm_sheet_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated sm_sheet_tabs"
  ON sm_sheet_tabs FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "All authenticated sm_sheet_data"
  ON sm_sheet_data FOR ALL TO authenticated USING (true) WITH CHECK (true);
