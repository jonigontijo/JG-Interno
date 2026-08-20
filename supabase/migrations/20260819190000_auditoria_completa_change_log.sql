-- Auditoria completa via trigger, gravando em public.change_log.
--
-- Por que no banco e nao no front: logAudit() so roda quando alguem clica na
-- interface. Edge function, RPC, n8n, service_role e SQL Editor passavam batido
-- -- foi exatamente assim que a criacao de cliente ficou fora da auditoria por
-- cinco meses. Um trigger dispara para qualquer origem, sem excecao.
--
-- change_log foi criada em marco/2026 para isto e nunca foi ligada (0 linhas).

-- ---------------------------------------------------------------- ator
-- Resolve quem fez a escrita. Quando nao ha JWT, identifica a origem
-- automatica em vez de gravar "desconhecido".
CREATE OR REPLACE FUNCTION public.audit_actor()
RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid;
  v_nome text;
  v_role text;
BEGIN
  BEGIN v_uid := auth.uid(); EXCEPTION WHEN OTHERS THEN v_uid := NULL; END;

  IF v_uid IS NOT NULL THEN
    SELECT coalesce(nullif(trim(p.name), ''), p.username, v_uid::text)
      INTO v_nome FROM public.profiles p WHERE p.id = v_uid;
    RETURN coalesce(v_nome, 'usuario ' || v_uid::text);
  END IF;

  BEGIN
    v_role := (current_setting('request.jwt.claims', true)::jsonb) ->> 'role';
  EXCEPTION WHEN OTHERS THEN v_role := NULL;
  END;

  RETURN CASE
    WHEN v_role = 'service_role' THEN 'sistema (service_role)'
    WHEN v_role = 'anon'         THEN 'anonimo (chave publica)'
    ELSE 'sistema (' || current_user || ')'
  END;
END;
$$;

-- ------------------------------------------------------------- trigger
CREATE OR REPLACE FUNCTION public.fn_audit_row()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_pk   text := coalesce(TG_ARGV[0], 'id');
  v_old  jsonb;
  v_new  jsonb;
  v_id   text;
  v_desc text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_old := to_jsonb(OLD); v_id := v_old ->> v_pk;
  ELSIF TG_OP = 'INSERT' THEN
    v_new := to_jsonb(NEW); v_id := v_new ->> v_pk;
  ELSE
    v_old := to_jsonb(OLD); v_new := to_jsonb(NEW); v_id := v_new ->> v_pk;
    -- O app reescreve a linha inteira a cada salvamento. Sem esta saida o log
    -- encheria de UPDATEs que nao mudaram um unico campo.
    IF v_old = v_new THEN RETURN NULL; END IF;
    SELECT string_agg(key, ', ' ORDER BY key) INTO v_desc
      FROM jsonb_each(v_new)
      WHERE v_old -> key IS DISTINCT FROM v_new -> key;
  END IF;

  INSERT INTO public.change_log (
    entity_type, entity_id, action, changed_by, old_data, new_data, description
  ) VALUES (
    TG_TABLE_NAME, coalesce(v_id, '(sem id)'), TG_OP,
    public.audit_actor(), v_old, v_new, v_desc
  );
  RETURN NULL;
END;
$$;

-- ------------------------------------------------------- ligar nas tabelas
-- Ficam de fora, de proposito: sm_sheet_data (53k escritas de sincronismo do
-- Sheets), recordings (15k), google_calendar_connection e sm_sheets_connection
-- (renovacao de token na mesma linha), report_dispatches (fila de envio) e as
-- proprias audit_logs/change_log -- auditar a auditoria criaria recursao.
DO $$
DECLARE
  alvo   text;
  pk     text;
  alvos  text[][] := ARRAY[
    ['clients','id'], ['tasks','id'], ['profiles','id'], ['team_members','id'],
    ['leads','id'], ['quote_requests','id'], ['internal_requests','id'],
    ['client_team_assignments','id'], ['client_recurring_services','id'],
    ['payment_history','id'], ['settings','id'], ['app_settings','id'],
    ['registration_requests','id'], ['client_briefings','id'],
    ['weekly_reports','id'], ['client_dna','client_id'],
    ['client_pipelines','client_id'], ['onboarding_data','client_id'],
    ['salary_projections','member_id']
  ];
BEGIN
  FOR i IN 1 .. array_length(alvos, 1) LOOP
    alvo := alvos[i][1];
    pk   := alvos[i][2];
    IF to_regclass('public.' || alvo) IS NULL THEN CONTINUE; END IF;
    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%1$s ON public.%1$I', alvo);
    EXECUTE format(
      'CREATE TRIGGER trg_audit_%1$s AFTER INSERT OR UPDATE OR DELETE ON public.%1$I
         FOR EACH ROW EXECUTE FUNCTION public.fn_audit_row(%2$L)', alvo, pk);
  END LOOP;
END $$;

-- ------------------------------------------------------------- consulta
CREATE INDEX IF NOT EXISTS change_log_changed_at_idx
  ON public.change_log (changed_at DESC);
CREATE INDEX IF NOT EXISTS change_log_entidade_idx
  ON public.change_log (entity_type, entity_id, changed_at DESC);

-- ------------------------------------------------------------------ RLS
-- change_log guarda a linha inteira em old_data/new_data, o que inclui salario
-- (team_members, salary_projections) e permissoes (profiles). A policy antiga
-- liberava tudo para qualquer usuario logado; passa a ser leitura so de admin.
-- Ninguem escreve direto: quem grava e o trigger, que roda como SECURITY DEFINER.
DROP POLICY IF EXISTS change_log_full_access ON public.change_log;

CREATE POLICY change_log_select_admin ON public.change_log
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));
