-- ============================================================
-- Libera acesso ao módulo Social Media para TODOS os usuários
-- logados (não apenas admin / social_media).
-- Substitui as políticas restritivas por políticas abertas a
-- qualquer usuário autenticado.
-- ============================================================

-- Remove políticas antigas (restritas a admin / social_media)
DROP POLICY IF EXISTS "SM team full access sm_posts"                  ON sm_posts;
DROP POLICY IF EXISTS "SM team full access sm_approvals"              ON sm_approvals;
DROP POLICY IF EXISTS "SM team full access sm_client_configs"         ON sm_client_configs;
DROP POLICY IF EXISTS "SM team full access sm_ai_logs"                ON sm_ai_logs;
DROP POLICY IF EXISTS "SM team full access sm_calendar_events"        ON sm_calendar_events;
DROP POLICY IF EXISTS "SM team full access sm_monthly_reports"        ON sm_monthly_reports;
DROP POLICY IF EXISTS "SM team full access sm_approval_notifications" ON sm_approval_notifications;
DROP POLICY IF EXISTS "Admin manage sm_ai_api_keys"                   ON sm_ai_api_keys;
DROP POLICY IF EXISTS "Admin manage sm_integration_settings"          ON sm_integration_settings;

-- Políticas abertas: qualquer usuário autenticado tem acesso total
CREATE POLICY "All authenticated sm_posts"
  ON sm_posts FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "All authenticated sm_approvals"
  ON sm_approvals FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "All authenticated sm_client_configs"
  ON sm_client_configs FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "All authenticated sm_ai_logs"
  ON sm_ai_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "All authenticated sm_calendar_events"
  ON sm_calendar_events FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "All authenticated sm_monthly_reports"
  ON sm_monthly_reports FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "All authenticated sm_approval_notifications"
  ON sm_approval_notifications FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "All authenticated sm_ai_api_keys"
  ON sm_ai_api_keys FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "All authenticated sm_integration_settings"
  ON sm_integration_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);
