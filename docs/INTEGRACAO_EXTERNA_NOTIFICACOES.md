# Integração externa → Notificações no JG App

> **Para quem:** dev de qualquer sistema do ecossistema JG (ex.: o painel de **tráfego**)
> que precisa **disparar uma notificação/atualização para o app do cliente** (JG App).
>
> **Resumo:** você faz **1 POST HTTP** para um endpoint do JG App. Ele (1) grava o dado
> na tela do cliente e (2) dispara o push no celular (web push + nativo). Não precisa
> de login Supabase, nem do JG Interno no meio — chamada direta server-to-server.

---

## 1. Visão geral

```
Seu sistema (tráfego)  ──POST /eventos-receber──►  JG App (Supabase Edge Function)
   ação aconteceu                                    ├─ grava na tabela da tela ──realtime──► app atualiza ao vivo
   (ex: snapshot do mês)                             └─ insere notificação      ──trigger──► push 🔔 no celular
```

- **1 chamada = 2 efeitos:** dado de negócio + aviso (push). Você não controla as duas
  coisas separado — manda o evento e o JG App resolve.
- **Idempotente:** pode reenviar o mesmo evento sem duplicar (ver chaves por evento).
- **Fire-and-forget:** trate como side-effect; não bloqueie seu fluxo se falhar. Tem retry sugerido abaixo.

---

## 2. Endpoint

```
POST https://ieekdxxmhkbslskgxbdg.supabase.co/functions/v1/eventos-receber
```

| | |
|---|---|
| Método | `POST` |
| Content-Type | `application/json` |
| CORS | liberado (`*`) — mas o ideal é chamar **server-side** (o segredo não pode vazar no front) |

---

## 3. Autenticação (2 headers, ambos obrigatórios)

```http
Authorization: Bearer <EVENTOS_API_SECRET>
X-Client-ID: <identificador do cliente>
Content-Type: application/json
```

- **`Authorization: Bearer <EVENTOS_API_SECRET>`** — segredo compartilhado. **Será enviado
  por canal seguro** (não está neste documento, não suba pro git, guarde em variável de
  ambiente do seu backend). Errado/ausente → `401`.
- **`X-Client-ID`** — quem é o cliente. O receptor resolve assim:
  - Se for um **UUID** → casa com `clientes.id` do JG App (match exato — **preferido**).
  - Se **não** for UUID → busca por **nome** (`nome_fantasia ILIKE %valor%`, pega o 1º).
  - Não encontrou → `404 { "erro": "cliente não encontrado" }`.

> **Recomendado:** usar o **UUID** do cliente no JG App. No JG Interno esse valor fica em
> `clients.jg_app_cliente_id` (preenchido quando o cliente é "Ativado no app"). Se seu
> sistema de tráfego tem o cliente por nome, dá pra mandar o nome — mas UUID é à prova de
> ambiguidade. Combine com a equipe qual id seu sistema vai mandar.

---

## 4. Envelope (corpo da requisição)

```json
{
  "evento": "trafego.atualizado",
  "versao": "1.0",
  "data": { "...campos específicos do evento..." },
  "notificacao": {
    "titulo": "texto curto",
    "mensagem": "até 80 caracteres"
  }
}
```

- **`evento`** (obrigatório) — um dos nomes da tabela abaixo. Desconhecido → `422`.
- **`data`** (obrigatório p/ eventos que gravam) — payload do evento (campos na seção 6).
- **`notificacao`** (opcional) — sobrescreve título/mensagem padrão do push. Se omitir,
  usa o texto padrão do evento. Em eventos marcados **"Avisa? não"**, é ignorado (não toca o celular).
- **`versao`** — informe `"1.0"`. Hoje não é validado, mas mantém compatibilidade futura.

---

## 5. Respostas

| HTTP | Corpo | Quando |
|---|---|---|
| `200` | `{ "recebido": true, "evento": "...", "cliente_id": "<uuid>", "notificados": 2 }` | OK. `notificados` = quantos usuários do cliente receberam o aviso. |
| `400` | `{ "erro": "Header X-Client-ID obrigatório" }` / `{ "erro": "evento é obrigatório" }` / `{ "erro": "JSON inválido" }` | requisição malformada |
| `401` | `{ "erro": "Não autorizado" }` | secret errado/ausente |
| `404` | `{ "erro": "cliente não encontrado", "x_client_id": "..." }` | X-Client-ID não bateu com nenhum cliente |
| `422` | `{ "erro": "evento desconhecido: <x>" }` | nome de evento inválido |
| `500` | `{ "erro": "<mensagem>", "evento": "..." }` | falha ao gravar (ex: campo obrigatório faltando no `data`) |

> `notificados: 0` com `200` é **normal** se o cliente ainda não tem nenhum usuário/login
> no app (cliente não provisionado). O dado foi gravado mesmo assim.

---

## 6. Catálogo de eventos

Coluna **Avisa?** = se dispara push (🔔) ou só grava o dado (📊). **Idempotência** = chave
que evita duplicar quando você reenvia.

### Tráfego (provável foco do seu sistema)

#### `trafego.atualizado` — snapshot mensal de uma plataforma — 📊 (só dado, sem push)
```json
{
  "evento": "trafego.atualizado",
  "data": {
    "plataforma": "meta_ads",        // obrigatório (string livre: meta_ads, google_ads, tiktok...)
    "mes": "2026-06",                // obrigatório (chave de idempotência junto c/ plataforma)
    "investido": 1500.00,
    "alcance": 120000,
    "impressoes": 350000,
    "cliques": 4200,
    "leads": 180,
    "conversoes": 42,
    "roas": 3.8,
    "cpc": 0.35,
    "cpl": 8.33
  }
}
```
- **Idempotência:** `(cliente_id, plataforma, mes)` → reenvio **atualiza** o mesmo snapshot.
- Não toca o celular por padrão (é atualização de números). Para forçar push num marco,
  use outro evento (ex: `meta.atingida`) ou mande `notificacao` num evento que avisa.

#### `trafego.criativo` — novo criativo no ar — 📊 (só dado, sem push)
```json
{
  "evento": "trafego.criativo",
  "data": {
    "nome": "Criativo Junho - Vídeo 01",   // obrigatório
    "plataforma": "meta_ads",              // obrigatório
    "status": "ativo",                     // opcional (default "ativo")
    "thumbnail_url": "https://..."         // opcional
  }
}
```
- **Sem idempotência** (faz `insert`): reenviar **cria duplicado**. Mande uma vez por criativo.

### Metas

#### `meta.definida` — meta do mês — 🔔
```json
{
  "evento": "meta.definida",
  "data": {
    "mes": "2026-06",          // obrigatório (idempotência junto c/ cliente)
    "valor_meta": 200,         // obrigatório
    "valor_atual": 0,          // opcional
    "descricao": "200 leads qualificados"  // opcional
  }
}
```
- **Idempotência:** `(cliente_id, mes)` → reenvio atualiza a meta.

#### `meta.atingida` — meta batida — 🔔
```json
{ "evento": "meta.atingida", "data": { "mes": "2026-06", "valor_atual": 215 } }
```
- Atualiza `valor_atual` da meta `(cliente_id, mes)`. Se `valor_atual` vier `null`, só dispara o push.

### Produção / Aprovação / Agenda / NPS / Marca / Networking / Feedback / Onboarding

#### `aprovacao.criada` — nova peça p/ aprovar — 🔔
```json
{
  "evento": "aprovacao.criada",
  "data": {
    "id": "apr_123",                       // obrigatório (idempotência)
    "descricao_post": "Reels lançamento",
    "tipo_conteudo": "reels",
    "plataforma": "instagram",
    "data_publicacao_prevista": "2026-06-30",
    "conteudo": "https://.../arquivo",     // link da peça
    "legenda_sugerida": "...",
    "prazo_resposta": "2026-06-28",
    "callback": { "url_resposta": "https://.../sm-callback", "token": "<secret>" }
  }
}
```
- **Idempotência:** `id`. O `callback` é opcional — usado p/ devolver a resposta do cliente (aprovado/reprovado/revisão) ao sistema de origem.

#### `producao.criada` — 🔔 / `producao.status` — 🔔
```json
{ "evento": "producao.criada", "data": { "id": "prod_1", "titulo": "Vídeo institucional", "tipo": "video", "status": "aguardando_aprovacao", "preview_url": "https://...", "duracao_segundos": 45, "data_publicacao": "2026-07-01" } }
{ "evento": "producao.status",  "data": { "id": "prod_1", "titulo": "Vídeo institucional", "status": "publicado" } }
```
- **Idempotência:** `id`. `producao.status` faz `update` no `id` existente.

#### `agenda.evento` — novo agendamento — 🔔
```json
{ "evento": "agenda.evento", "data": { "funcionario_id": "Nome ou id", "data_hora": "2026-06-30T14:00:00Z", "descricao": "Gravação no estúdio", "plataformas": ["instagram"], "status": "agendado" } }
```
- Faz `insert` (sem idempotência) — mande uma vez por evento.

#### `nps.solicitado` — abre pesquisa do mês — 🔔
```json
{ "evento": "nps.solicitado", "data": { "mes": "2026-06" } }
```
- **Idempotência:** `mes` (pesquisa é global por mês). Avisa todos os usuários do cliente.

#### `marca.atualizada` — DNA da marca — 📊 (só dado, sem push)
```json
{ "evento": "marca.atualizada", "data": { "descricao": "...", "diferencial": "...", "persona_descricao": "...", "persona_interesses": ["x"], "tom_de_voz": ["informal"], "exemplo_copy": "..." } }
```
- **Idempotência:** `cliente_id` (1 DNA por cliente).

#### `networking.novo` — oportunidade — 🔔
```json
{ "evento": "networking.novo", "data": { "setor": "varejo", "descricao": "Conexão com fornecedor X", "status": "pendente" } }
```
- Faz `insert` (sem idempotência).

#### `feedback.novo` — feedback/relatório publicado — 🔔
```json
{ "evento": "feedback.novo", "data": { "tipo": "relatorio", "mensagem": "Relatório de junho disponível", "designado_para_id": null } }
```
- Faz `insert` (sem idempotência).

#### `onboarding.etapa` — só notificação (sem tabela) — 🔔
```json
{ "evento": "onboarding.etapa", "data": { "etapa": "contrato_assinado", "mensagem": "Bem-vindo! Próximo passo: acessos." } }
```

---

## 7. Exemplo completo (curl) — o caso do tráfego

```bash
curl -X POST "https://ieekdxxmhkbslskgxbdg.supabase.co/functions/v1/eventos-receber" \
  -H "Authorization: Bearer $EVENTOS_API_SECRET" \
  -H "X-Client-ID: 732ed69f-1774-4e85-95e8-9665a17d6cd7" \
  -H "Content-Type: application/json" \
  -d '{
    "evento": "trafego.atualizado",
    "versao": "1.0",
    "data": {
      "plataforma": "meta_ads",
      "mes": "2026-06",
      "investido": 1500.00,
      "leads": 180,
      "roas": 3.8,
      "cpl": 8.33
    }
  }'
# → 200 { "recebido": true, "evento": "trafego.atualizado", "cliente_id": "732ed...", "notificados": 0 }
```

Forçando um push num marco de tráfego (opcional `notificacao`):

```bash
curl -X POST ".../eventos-receber" \
  -H "Authorization: Bearer $EVENTOS_API_SECRET" \
  -H "X-Client-ID: 732ed69f-..." -H "Content-Type: application/json" \
  -d '{
    "evento": "meta.atingida",
    "data": { "mes": "2026-06", "valor_atual": 215 },
    "notificacao": { "titulo": "🏆 Meta batida!", "mensagem": "200 leads alcançados em junho — bora comemorar!" }
  }'
```

---

## 8. Boas práticas de quem chama (do lado do tráfego)

1. **Server-side só.** O `EVENTOS_API_SECRET` nunca pode ir pro navegador. Chame do seu backend.
2. **Guarde o id do cliente.** Idealmente o UUID do JG App (`clients.jg_app_cliente_id`).
   Sem cliente provisionado no app → `404`. Trate como "cliente ainda não usa o app" e siga.
3. **Idempotência.** Para `trafego.atualizado`/`meta.*` pode reenviar à vontade (upsert por
   chave). Para os `insert` (criativo, agenda, networking, feedback) reenvio **duplica** —
   mande uma vez ou guarde um "já enviei" do seu lado.
4. **Retry.** Em `5x`/timeout, repita com backoff (ex: 3 tentativas, 1s/4s/10s). Em `4xx`
   **não** repita (é erro de payload/cliente — logue e investigue).
5. **Não bloqueie a UI.** Dispare o evento em background depois que sua ação principal já gravou.

---

## 9. Como obter o secret e o id do cliente

- **`EVENTOS_API_SECRET`** — peça à equipe JG (mesmo segredo da integração JG Interno↔App).
  Não está neste doc por segurança. Configure como env var no seu backend.
- **UUID do cliente** — vem do JG App. No JG Interno: `clients.jg_app_cliente_id` (depois de
  "Ativar acesso ao app"). Se seu sistema não tem esse vínculo, alinhar com a equipe para
  mapear seus clientes ↔ clientes do JG App (ou usar o nome via `X-Client-ID`, menos seguro).

---

## 10. Checklist de implementação (dev do tráfego)

- [ ] Receber `EVENTOS_API_SECRET` por canal seguro → env var no backend.
- [ ] Mapear cada cliente do seu sistema → `X-Client-ID` (UUID do JG App, de preferência).
- [ ] Implementar função `notificarApp(evento, clienteId, data, notificacao?)` que faz o POST.
- [ ] Fiar nos pontos de ação: fechamento de snapshot mensal (`trafego.atualizado`), novo
      criativo (`trafego.criativo`), definição/batida de meta (`meta.definida`/`meta.atingida`).
- [ ] Retry com backoff em 5xx; log em 4xx.
- [ ] Testar com um cliente real provisionado e confirmar push no celular + tela atualizando.
```
