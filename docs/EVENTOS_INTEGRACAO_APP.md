# Catálogo de Eventos — JG Interno → App do Cliente

> Contrato da integração HTTPS. **Objetivo:** toda ação relevante no JG Interno
> avisa o cliente no app (JG App). Fonte da verdade para os dois repos.
>
> - Emissor: **JG Interno** (`jonigontijo/JG-Interno`) — Supabase próprio.
> - Receptor: **JG App** (`johnatangontijo-stack/jg-app`) — Supabase `ieekdxxmhkbslskgxbdg`.
> - Topologia decidida: **direta** (sem n8n). Auth alinhada em `Bearer`.

## Arquitetura (3 camadas numa chamada)

1. **Transporte (HTTPS):** JG Interno faz POST → edge `eventos-receber` do JG App.
2. **Dado de negócio:** receptor grava na tabela da tela do cliente (realtime já
   atualiza a UI ao vivo).
3. **Aviso:** receptor insere linha em `notificacoes` → trigger dispara
   `enviar-push` (web push VAPID + Expo) → toca no celular mesmo com app fechado.
   Sino in-app + badge já funcionam via realtime.

```
JG Interno  --(sm-fire-event)-->  POST eventos-receber
   ação de domínio                  ├─ grava tabela negócio  ──realtime──► tela cliente
                                    └─ insert notificacoes   ──trigger──► enviar-push ►► 🔔 celular
```

## Auth (direta, decidida)

- Header `Authorization: Bearer <APROVACOES_API_SECRET>` (renomear conceito p/
  `EVENTOS_API_SECRET`; mesmo segredo serve).
- Header `X-Client-ID: <id externo do cliente no JG Interno>` → receptor resolve
  `clientes.id` no JG App.
- ⚠️ Hoje `sm-send-approval`/`sm-fire-event` mandam `x-jg-event-secret` (n8n
  traduzia). Na rota direta, ajustar o emissor p/ mandar `Authorization: Bearer`.

## Envelope padrão

```json
{
  "evento": "<dominio.acao>",
  "versao": "1.0",
  "timestamp": "2026-06-16T12:00:00Z",
  "cliente_id_externo": "<id no JG Interno>",
  "data": { /* payload específico do evento */ },
  "notificacao": {
    "titulo": "texto curto",
    "mensagem": "≤80 chars",
    "url": "/(cliente)/<tela>"
  }
}
```

`notificacao` é opcional por evento (ver coluna "Avisa?"). Quando ausente, só
grava o dado de negócio sem tocar o celular.

## Catálogo

Tabelas **todas confirmadas** via REST (2026-06-16). Colunas extraídas de
`jg-app/src/types/database.ts`.

| Evento | Gatilho no JG Interno | Tabela JG App (real) | Tela cliente | Avisa? |
|---|---|---|---|---|
| `aprovacao.criada` | ApprovalsPage / SocialMediaPage cria peça | `aprovacoes` | aprovacoes | ✅ |
| `producao.criada` | ProductionPage / SocialMedia publica produção | `producoes` | producoes | ✅ |
| `producao.status` | produção muda status (entregue/revisão) | `producoes` | producoes | ✅ |
| `trafego.atualizado` | TrafficPage atualiza snapshot mensal | `trafego_snapshots` | trafego | 🔸 não (só dado) |
| `trafego.criativo` | novo criativo ativo | `criativos` | trafego | 🔸 não (só dado) |
| `agenda.evento` | TasksPage / RequestsPage agenda gravação | `agenda_otimizacao` | agenda | ✅ |
| `meta.definida` | define meta do mês | `metas` | metas | ✅ |
| `meta.atingida` | meta batida | `metas` | metas | ✅ |
| `nps.solicitado` | dispara pesquisa NPS | `nps_pesquisas` (global/mês) | nps | ✅ |
| `marca.atualizada` | ClientDetail muda identidade/brand | `cliente_dna` | marca | 🔸 não (só dado) |
| `networking.novo` | nova oportunidade de networking | `networking_interesses` | networking | ✅ |
| `onboarding.etapa` | OnboardingPage avança etapa | (só notificação) | index | ✅ |
| `feedback.novo` | relatório/feedback publicado | `feedbacks` | feedback | ✅ |

**Status:** edge `eventos-receber` IMPLEMENTADO (`jg-app/supabase/functions/eventos-receber/index.ts`)
com os 13 handlers. `notificacoes.tipo` é ENUM fixo → mapeado por evento
(aprovacao→`aprovacao`, producao→`producao_status`, meta→`meta_update`,
trafego→`campanha_alerta`, feedback→`feedback_novo`, resto→`geral`).
`notificacoes` **não tem coluna `url`** (deep-link vem do payload web push, não da linha).

⚠️ **Pré-requisito de deploy:** upserts exigem unique constraints —
migration `jg-app/supabase/migrations/20260616000000_eventos_unique_constraints.sql`
(aprovacoes.aprovacao_id, trafego_snapshots[cli,plat,mes], metas[cli,mes],
nps_pesquisas.mes, cliente_dna.cliente_id). `producoes.id` já é PK. Aplicar antes
de testar. Deploy da função: `supabase functions deploy eventos-receber --no-verify-jwt`.

## Status de implementação (2026-06-16)

- ✅ **Etapa 1 — receptor** `jg-app/supabase/functions/eventos-receber/index.ts` (13 handlers).
- ✅ **Etapa 2 — push dois canais**: `jg-app/.../enviar-push` agora envia Expo **+**
  web push VAPID (`web_push_subscriptions`). Trigger `trg_notificacoes_push` no
  INSERT de `notificacoes` **já existia** → dispara automático. Deep-link derivado
  de `tipo`→rota (notificacoes não tem coluna url). Secrets a setar:
  `VAPID_PUBLIC`, `VAPID_PRIVATE`, `VAPID_SUBJECT`.
- ✅ **Etapa 3 — emissão direta** (sem n8n): JG Interno
  `supabase/functions/notify-app/index.ts` (server-side, guarda segredo do JG App,
  retry 3x) + helper front `src/lib/notifyApp.ts`. Secrets a setar:
  `JG_APP_EVENTS_URL`, `JG_APP_EVENTS_SECRET`. config.toml: `notify-app verify_jwt=true`.
- ⏳ **Falta**: aplicar migration unique + deploy das 3 funções + setar secrets +
  smoke test (precisa PAT/login). Wiring dos call sites (abaixo).

### Wiring — onde chamar `notifyApp(...)` no JG Interno

Chamar **após** a mutação de domínio (fire-and-forget). Call sites a fazer:

| Evento | Tela/arquivo provável | Ação |
|---|---|---|
| `producao.criada` / `.status` | ProductionPage / SocialMediaPage | ao criar/mudar status de produção |
| `agenda.evento` | RecordingsCalendar / TasksPage | ao agendar gravação/otimização |
| `meta.definida` / `.atingida` | ClientDetailPage / DashboardPage | ao salvar/bater meta |
| `nps.solicitado` | SocialDashboardPage / Admin | ao abrir pesquisa do mês |
| `marca.atualizada` | ClientDetailPage (DNA) | ao salvar DNA/identidade |
| `networking.novo` | (módulo networking) | ao criar interesse |
| `feedback.novo` | RequestsPage / relatórios | ao publicar feedback/relatório |
| `aprovacao.criada` | AprovacoesPanel.tsx:189 | hoje via `sm-send-approval`+n8n → migrar p/ direto |

Ex.: `notifyApp.producaoCriada(cliente.id, { id: prod.id, titulo: prod.titulo, tipo: prod.tipo });`

## Plano de build (ordem)

1. **JG App — receptor genérico `eventos-receber`**: Bearer + X-Client-ID,
   `switch(evento)` → grava tabela + insere `notificacoes`. Aprovação migra p/
   um `case` (mantém `aprovacoes-receber` como alias durante transição).
2. **JG App — trigger no INSERT de `notificacoes` → `enviar-push`** (VAPID + Expo
   juntos). Peça que faz tocar o celular. *(memory: migration push_trigger já existe — validar)*
3. **JG Interno — emissão**: registrar endpoint do JG App em `sm_webhooks` e
   chamar `sm-fire-event` em cada ação de domínio do catálogo (ajustar auth p/
   Bearer na rota direta + retry usando `last_status`/`fire_count`).

## Pendências de decisão

- Confirmar tabelas ⚠️ existem no JG App com `cliente_id` (introspecção REST).
- Definir quais eventos 🔸 opcionais viram push agora vs resumo agendado.
- Rotacionar `APROVACOES_API_SECRET` (exposto em chat anterior) ao migrar.
