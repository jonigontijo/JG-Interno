-- Bloqueia a criacao de clientes fora da aba Clientes do sistema interno.
--
-- Contexto: o app de relatorios (jg_relatorio) chamava create_report_client, que era
-- SECURITY DEFINER com EXECUTE liberado ao papel anon. Ela inseria direto em
-- public.clients passando por cima da RLS e sem exigir login. Foi a origem dos
-- cadastros duplicados de XP IMOVEIS e PL SOLUCOES FINANCEIRAS (ambos em 11/06/2026).
--
-- A funcao continua existindo para nao quebrar o build do app de relatorios, mas
-- recusa a chamada com uma mensagem explicita em vez de inserir.

CREATE OR REPLACE FUNCTION public.create_report_client(
  p_name text,
  p_company text,
  p_meta_ads_account_id text DEFAULT NULL::text,
  p_whatsapp text DEFAULT NULL::text
)
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
BEGIN
  RAISE EXCEPTION 'Cadastro de cliente desativado neste app. Cadastre o cliente na aba Clientes do sistema interno; ele aparecera aqui automaticamente.'
    USING ERRCODE = '42501';
END;
$function$;

-- CREATE OR REPLACE preserva a ACL antiga, entao os grants precisam ser refeitos.
-- anon perde o acesso por completo; authenticated mantem apenas para receber a
-- mensagem de erro acima em vez de um "permission denied" opaco.
REVOKE ALL ON FUNCTION public.create_report_client(text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_report_client(text, text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_report_client(text, text, text, text) TO authenticated;
