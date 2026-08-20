-- Cadastro de cliente: estritamente manual, e so por quem tem permissao.
--
-- Por que trigger e nao so RLS: o papel service_role tem rolbypassrls = true.
-- Qualquer integracao com essa chave (edge function, n8n, script) ignora
-- qualquer policy e insere a vontade. Trigger dispara para todo mundo.
--
-- Fecha tres portas de uma vez:
--   1. integracao/service_role inserindo cliente
--   2. anon inserindo cliente
--   3. insercao em massa (mais de uma linha por comando), mesmo autorizada

CREATE OR REPLACE FUNCTION public.can_create_clients(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _user_id AND can_create_clients = true
  )
$function$;

-- ------------------------------------------------ 1) quem pode criar
CREATE OR REPLACE FUNCTION public.fn_clients_guard_insert()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid;
BEGIN
  -- Escotilha explicita para manutencao deliberada (carga/migracao de dados):
  --   set local app.bypass_client_guard = 'on';
  -- Nao enfraquece nada: quem tem acesso SQL tambem poderia dropar o trigger.
  IF coalesce(current_setting('app.bypass_client_guard', true), '') = 'on' THEN
    RETURN NEW;
  END IF;

  -- Linha que ja existe = upsert virando UPDATE. Deixa passar, senao o app
  -- atual (que grava com .upsert()) quebraria antes do deploy do codigo novo.
  IF EXISTS (SELECT 1 FROM public.clients c WHERE c.id = NEW.id) THEN
    RETURN NEW;
  END IF;

  BEGIN v_uid := auth.uid(); EXCEPTION WHEN OTHERS THEN v_uid := NULL; END;

  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Cliente so pode ser cadastrado por um usuario logado, pela aba Clientes do sistema interno. Integracao, chave de servico e acesso anonimo nao podem criar cliente.'
      USING ERRCODE = '42501';
  END IF;

  IF NOT (public.is_admin(v_uid) OR public.can_create_clients(v_uid)) THEN
    RAISE EXCEPTION 'Seu usuario nao tem permissao para cadastrar clientes. Fale com o Financeiro ou com um administrador.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_clients_guard_insert ON public.clients;
CREATE TRIGGER trg_clients_guard_insert
  BEFORE INSERT ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.fn_clients_guard_insert();

-- --------------------------------------------- 2) nada de massa
CREATE OR REPLACE FUNCTION public.fn_clients_bloqueia_massa()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_qtd integer;
BEGIN
  IF coalesce(current_setting('app.bypass_client_guard', true), '') = 'on' THEN
    RETURN NULL;
  END IF;

  SELECT count(*) INTO v_qtd FROM novos;
  IF v_qtd > 1 THEN
    RAISE EXCEPTION 'Tentativa de cadastrar % clientes de uma vez. O cadastro e manual, um cliente por vez, pela aba Clientes.', v_qtd
      USING ERRCODE = '42501';
  END IF;
  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS trg_clients_bloqueia_massa ON public.clients;
CREATE TRIGGER trg_clients_bloqueia_massa
  AFTER INSERT ON public.clients
  REFERENCING NEW TABLE AS novos
  FOR EACH STATEMENT EXECUTE FUNCTION public.fn_clients_bloqueia_massa();
