-- Restringe INSERT em public.clients a admins e a quem tem can_create_clients.
--
-- ATENCAO A ORDEM: so aplicar DEPOIS que o deploy com a migration de codigo
-- estiver no ar. O app antigo grava cliente com .upsert(), e no Postgres um
-- INSERT ... ON CONFLICT DO UPDATE e avaliado pela policy de INSERT mesmo
-- quando a linha ja existe. Aplicar isto antes do deploy faria concluir tarefa,
-- avancar pipeline e marcar pagamento falharem com "violates row-level security"
-- para todos os usuarios. O deploy troca esses upsert por update().

CREATE OR REPLACE FUNCTION public.can_create_clients(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _user_id AND can_create_clients = true
  )
$function$;

-- A policy antiga era FOR ALL, o que juntava leitura, escrita e criacao numa
-- regra so. Separando, da para restringir a criacao sem mexer no resto.
DROP POLICY IF EXISTS clients_full_access ON public.clients;

CREATE POLICY clients_select ON public.clients
  FOR SELECT TO authenticated USING (true);

CREATE POLICY clients_update ON public.clients
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY clients_delete ON public.clients
  FOR DELETE TO authenticated USING (true);

CREATE POLICY clients_insert ON public.clients
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin(auth.uid())
    OR public.can_create_clients(auth.uid())
  );
