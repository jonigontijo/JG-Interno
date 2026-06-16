-- Liga o client do JG Interno à conta do cliente no JG App.
-- email: usado para criar o login no app. jg_app_cliente_id: id retornado
-- pelo provisionamento (vira o X-Client-ID estável dos eventos).
alter table public.clients add column if not exists email text;
alter table public.clients add column if not exists jg_app_cliente_id uuid;

comment on column public.clients.jg_app_cliente_id is
  'clientes.id no JG App (Supabase ieekdxxmhkbslskgxbdg). Preenchido ao Ativar acesso ao app.';
