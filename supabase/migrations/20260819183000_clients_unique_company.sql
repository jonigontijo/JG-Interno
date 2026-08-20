-- Indice unico por nome de empresa normalizado (sem acento, sem caixa, sem
-- espaco duplicado). Ultima barreira: mesmo que uma rota nova apareca, o banco
-- recusa a segunda "XP IMOVEIS".
--
-- ATENCAO: so aplicar DEPOIS de consolidar os 3 pares duplicados existentes.
-- Com eles no lugar a criacao do indice FALHA (nao destroi nada, apenas aborta).
-- Conferir antes com:
--   select lower(regexp_replace(unaccent(trim(company)),'\s+',' ','g')) emp, count(*)
--   from clients group by 1 having count(*) > 1;
-- Em 19/08/2026 os pendentes eram: ALPHA HOUSE, PL SOLUCOES FINANCEIRAS, XP IMOVEIS.

CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE UNIQUE INDEX IF NOT EXISTS clients_company_normalizado_uniq
  ON public.clients (
    lower(regexp_replace(unaccent(trim(company)), '\s+', ' ', 'g'))
  );
