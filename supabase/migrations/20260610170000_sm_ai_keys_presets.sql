-- ============================================================
-- MÓDULO 3 — presets de modelo (Rápido / Médio / Inteligente)
-- ------------------------------------------------------------
-- Cada token pode mapear 3 "modos" rápidos para modelos específicos.
-- Ex: { "rapido": "gpt-4o-mini", "medio": "gpt-4o", "inteligente": "o1" }
-- O chat mostra esses modos como botões de seleção rápida.
-- ============================================================

ALTER TABLE sm_ai_api_keys ADD COLUMN IF NOT EXISTS model_presets jsonb NOT NULL DEFAULT '{}';
