-- ============================================================
-- Sync bidirecional em tempo real (polling inteligente)
-- Guarda o modifiedTime do arquivo no Drive para detectar mudanças
-- sem rodar o mirror pesado a cada minuto.
-- ============================================================

ALTER TABLE sm_sheets_connection
  ADD COLUMN IF NOT EXISTS last_modified_time text;
