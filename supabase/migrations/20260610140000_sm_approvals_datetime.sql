-- ============================================================
-- MÓDULO 5 — datas da aprovação passam a guardar data + hora
-- ------------------------------------------------------------
-- O contrato do webhook (nova_aprovacao v1.0) envia datas em ISO 8601
-- com hora (ex: "2026-06-15T10:00:00Z"). Por isso convertemos as
-- colunas de date para timestamptz.
-- ============================================================

ALTER TABLE sm_approvals
  ALTER COLUMN data_publicacao_prevista TYPE timestamptz
    USING data_publicacao_prevista::timestamptz;

ALTER TABLE sm_approvals
  ALTER COLUMN prazo_resposta TYPE timestamptz
    USING prazo_resposta::timestamptz;
