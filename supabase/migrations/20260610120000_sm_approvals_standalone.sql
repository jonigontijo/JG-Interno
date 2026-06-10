-- ============================================================
-- MÓDULO 5 — Fluxo de Aprovação (UI) — ajustes para aprovações avulsas
-- ------------------------------------------------------------
-- Permite criar uma aprovação SEM um post vinculado (peça avulsa:
-- link/arquivo enviado direto para aprovação do cliente) e adiciona
-- campos de exibição usados pela tela de Aprovações.
-- Também habilita Realtime para refletir a resposta do cliente ao vivo.
-- ============================================================

-- 1) post_id passa a ser opcional (aprovação pode ser de peça avulsa)
ALTER TABLE sm_approvals ALTER COLUMN post_id DROP NOT NULL;

-- 2) Campos de exibição/conteúdo usados pela UI
ALTER TABLE sm_approvals ADD COLUMN IF NOT EXISTS title        text;
ALTER TABLE sm_approvals ADD COLUMN IF NOT EXISTS description  text;
ALTER TABLE sm_approvals ADD COLUMN IF NOT EXISTS client_name  text;

-- 3) Realtime — atualiza a tela quando o cliente responde via sm-callback
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'sm_approvals'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE sm_approvals;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'sm_approval_notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE sm_approval_notifications;
  END IF;
END $$;
