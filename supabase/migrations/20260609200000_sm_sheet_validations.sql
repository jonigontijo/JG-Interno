-- ============================================================
-- Validações de dados (listas suspensas) por coluna de cada aba.
-- col_validations: { "7": ["OK","ACABOU",...], "6": ["3X","5X","2X",...] }
-- (chave = índice da coluna, 0-based)
-- ============================================================

ALTER TABLE sm_sheet_tabs
  ADD COLUMN IF NOT EXISTS col_validations jsonb NOT NULL DEFAULT '{}';
