-- ============================================================
-- MÓDULO 5 — Campos adicionais da Aprovação (contrato do webhook)
-- ------------------------------------------------------------
-- Campos extras solicitados para o payload do webhook de aprovação:
--   aprovacao.social_media_responsavel
--   aprovacao.plataforma
--   aprovacao.data_publicacao_prevista
--   aprovacao.legenda_sugerida
--   aprovacao.observacoes_internas
--   aprovacao.prazo_resposta
-- (cliente_name=client_name, tipo_conteudo=piece_type,
--  descricao_post=description, conteudo=piece_url já existem)
-- ============================================================

ALTER TABLE sm_approvals ADD COLUMN IF NOT EXISTS social_media_responsavel  text;
ALTER TABLE sm_approvals ADD COLUMN IF NOT EXISTS plataforma                text;
ALTER TABLE sm_approvals ADD COLUMN IF NOT EXISTS data_publicacao_prevista  date;
ALTER TABLE sm_approvals ADD COLUMN IF NOT EXISTS legenda_sugerida          text;
ALTER TABLE sm_approvals ADD COLUMN IF NOT EXISTS observacoes_internas      text;
ALTER TABLE sm_approvals ADD COLUMN IF NOT EXISTS prazo_resposta            date;
