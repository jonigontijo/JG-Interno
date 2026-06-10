-- ============================================================
-- Habilita Realtime (replicação) para as tabelas do espelho da planilha,
-- para a grade no app atualizar ao vivo quando o banco muda (Sheets → App).
-- ============================================================

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE sm_sheet_data;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE sm_sheet_tabs;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END
$$;
