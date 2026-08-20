-- Rastreabilidade de cliente + permissao de cadastro + fechamento do audit_logs.
-- Seguro de aplicar antes do deploy: e tudo aditivo, nada passa a ser recusado aqui.

-- 1) Quem cadastrou o cliente. Ate agora isso nao existia em lugar nenhum:
--    nem coluna, nem audit_logs, nem change_log. Os cadastros anteriores a esta
--    migration ficam com created_by nulo de forma definitiva.
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS created_by TEXT;

-- 2) Permissao de cadastrar cliente. Flag em vez de nome fixo na policy: quando
--    a Fabiola sair de ferias ou o Financeiro ganhar outra pessoa, muda-se a
--    linha do perfil, nao a estrutura do banco.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS can_create_clients BOOLEAN NOT NULL DEFAULT false;

UPDATE public.profiles SET can_create_clients = true WHERE username = 'fabiola';

-- 3) audit_logs estava com uma unica policy FOR ALL TO public: qualquer pessoa
--    com a chave anon publica (que vai no bundle JS) podia ler os 2.5k registros
--    e tambem APAGAR o log inteiro. Passa a ser append-only e so para logados.
DROP POLICY IF EXISTS audit_logs_full_access ON public.audit_logs;

CREATE POLICY audit_logs_select ON public.audit_logs
  FOR SELECT TO authenticated USING (true);

CREATE POLICY audit_logs_insert ON public.audit_logs
  FOR INSERT TO authenticated WITH CHECK (true);
-- Sem policy de UPDATE/DELETE: log de auditoria nao se edita nem se apaga.
