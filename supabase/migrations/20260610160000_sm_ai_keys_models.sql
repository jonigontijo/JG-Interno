-- ============================================================
-- MÓDULO 3 — vários modelos por token de IA
-- ------------------------------------------------------------
-- Cada token passa a ter uma LISTA de modelos disponíveis (manual ou
-- buscada da API do provedor). O chat deixa escolher qual usar.
-- A coluna "model" (singular) continua como modelo padrão/fallback.
-- ============================================================

ALTER TABLE sm_ai_api_keys ADD COLUMN IF NOT EXISTS models text[] NOT NULL DEFAULT '{}';
