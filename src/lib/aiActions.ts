// ============================================================================
// Registro de ações executáveis pela IA.
//
// A IA emite um bloco ```jg-action {"tipo":"...","dados":{...}}``` no chat.
// O FloatingAIChat extrai esse bloco (extractAction), mostra um card de
// confirmação (previewAction) e, ao confirmar, executa (executeAction).
//
// Para adicionar uma NOVA ação: crie um ActionDef e registre em ACTIONS.
// O system prompt (buildActionsSystemPrompt) é gerado automaticamente a partir
// daqui, então a IA "aprende" a nova ação sem mexer na edge function.
// ============================================================================
import type { LucideIcon } from "lucide-react";
import { CalendarPlus, CheckCircle2, Image, ListPlus, UserPlus, Inbox } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/store/useAppStore";
import type { Task, Lead, InternalRequest } from "@/store/types";

// ── tipos ───────────────────────────────────────────────────────────────────
export type ActionState = "pending" | "running" | "done" | "cancelled" | "error";
export interface PendingAction { tipo: string; dados: Record<string, any>; }
export interface PreviewRow { label: string; value: string; warn?: boolean; }
export interface ActionContext {
  clients: { id: string; name: string; company?: string }[];
  team: { id: string; name: string }[];
  currentUserName: string;
  currentUserId: string;
  currentUserAuthId?: string | null; // UUID de profiles (para colunas created_by uuid)
}
export interface ActionDef {
  tipo: string;
  label: string;
  icon: LucideIcon;
  hint: string;        // quando usar (vai no system prompt)
  schema: string;      // template JSON dos dados (vai no system prompt)
  preview: (d: Record<string, any>, ctx: ActionContext) => PreviewRow[];
  execute: (d: Record<string, any>, ctx: ActionContext) => Promise<{ ok: boolean; msg: string }>;
}

// ── helpers genéricos ────────────────────────────────────────────────────────
export const norm = (s: string) =>
  (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

const clientLabel = (c: { name?: string; company?: string; id: string }) => c.company || c.name || c.id;

export function resolveClient(
  clients: { id: string; name?: string; company?: string }[],
  query: string,
) {
  const q = norm(query);
  if (!q) return null;
  return (
    clients.find((c) => norm(c.company || "") === q || norm(c.name || "") === q) ||
    clients.find((c) => {
      const hay = norm(`${c.company || ""} ${c.name || ""}`);
      const label = norm(c.company || c.name || "");
      return hay.includes(q) || (label && q.includes(label));
    }) ||
    null
  );
}

export function resolveMember(team: { id: string; name: string }[], query: string) {
  const q = norm(query);
  if (!q) return null;
  return (
    team.find((m) => norm(m.name) === q) ||
    team.find((m) => norm(m.name).includes(q) || q.includes(norm(m.name))) ||
    null
  );
}

function isDate(s?: string) { return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s); }

export function fmtDateBR(iso?: string) {
  if (!isDate(iso)) return iso || "—";
  const [y, m, d] = iso!.split("-");
  return `${d}/${m}/${y}`;
}
function fmtDateTimeBR(iso?: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch { return iso; }
}
// "YYYY-MM-DD" ou "YYYY-MM-DDTHH:MM" → ISO com fuso de Brasília (-03:00)
function toIsoBrasilia(s?: string): string | null {
  if (!s) return null;
  let v = String(s).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) v += "T09:00";
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) v += ":00";
  if (/Z$|[+-]\d{2}:\d{2}$/.test(v)) return v;
  return `${v}-03:00`;
}
export function nowBrasilia() {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
      weekday: "long", hour: "2-digit", minute: "2-digit", hour12: false,
    }).formatToParts(new Date()).map((p) => [p.type, p.value]),
  ) as Record<string, string>;
  return { date: `${parts.year}-${parts.month}-${parts.day}`, weekday: parts.weekday, time: `${parts.hour}:${parts.minute}` };
}

// ── mapeamentos de enums (aceita sinônimos em pt-br) ─────────────────────────
const pick = (map: Record<string, string>, v: string, fallback = "") => map[norm(v)] ?? fallback;

const REC_STATUS: Record<string, string> = {
  agendado: "agendado", agendada: "agendado",
  "em gravacao": "em_gravacao", em_gravacao: "em_gravacao", gravando: "em_gravacao",
  gravado: "gravado", gravada: "gravado", concluido: "gravado", concluida: "gravado", finalizado: "gravado", feito: "gravado",
  cancelado: "cancelado", cancelada: "cancelado",
};
const REC_STATUS_LABEL: Record<string, string> = { agendado: "Agendado", em_gravacao: "Em Gravação", gravado: "Gravado", cancelado: "Cancelado" };

const PLATFORM: Record<string, string> = {
  instagram: "instagram", insta: "instagram", ig: "instagram",
  facebook: "facebook", face: "facebook", fb: "facebook",
  linkedin: "linkedin", tiktok: "tiktok", "tik tok": "tiktok",
  youtube: "youtube", yt: "youtube", twitter: "twitter", x: "twitter",
  pinterest: "pinterest", outro: "outro",
};
const POST_TYPE: Record<string, string> = {
  feed: "feed_foto", foto: "feed_foto", feed_foto: "feed_foto", "feed foto": "feed_foto", imagem: "feed_foto", estatico: "feed_foto",
  video: "feed_video", feed_video: "feed_video", "feed video": "feed_video",
  reels: "reels", reel: "reels", stories: "stories", story: "stories", storie: "stories",
  carrossel: "carrossel", carousel: "carrossel", live: "live", shorts: "shorts", short: "shorts", outro: "outro",
};
const DEPT: Record<string, string> = {
  social_media: "social_media", social: "social_media", "social media": "social_media", marketing: "social_media",
  gestao_trafego: "gestao_trafego", trafego: "gestao_trafego", "trafego pago": "gestao_trafego", "gestao de trafego": "gestao_trafego", ads: "gestao_trafego", anuncios: "gestao_trafego",
  producao: "producao", financeiro: "financeiro", financas: "financeiro",
  operacional: "operacional", operacoes: "operacional", tech: "tech", tecnologia: "tech", ti: "tech", geral: "geral",
};
const DEPT_LABEL: Record<string, string> = {
  social_media: "Social Media", gestao_trafego: "Gestão de Tráfego", producao: "Produção",
  financeiro: "Financeiro", operacional: "Operacional", tech: "Tecnologia", geral: "Geral",
};
const PRIORITY: Record<string, string> = {
  baixa: "low", low: "low", normal: "normal", media: "normal", "média": "normal",
  alta: "high", high: "high", urgente: "urgent", urgent: "urgent",
};
const URGENCY: Record<string, string> = {
  normal: "normal", baixa: "normal", prioridade: "priority", priority: "priority", alta: "priority",
  urgente: "urgent", urgent: "urgent", critico: "critical", critica: "critical", "crítico": "critical", "crítica": "critical", critical: "critical",
};
const STAGE: Record<string, string> = {
  "reuniao agendada": "meeting_scheduled", agendada: "meeting_scheduled", meeting_scheduled: "meeting_scheduled",
  "reuniao realizada": "meeting_done", realizada: "meeting_done", meeting_done: "meeting_done",
  "proposta enviada": "proposal_sent", proposta: "proposal_sent", proposal_sent: "proposal_sent",
  negociacao: "negotiation", "negociação": "negotiation", negotiation: "negotiation",
  fechado: "closed", ganho: "closed", closed: "closed", perdido: "lost", lost: "lost",
};

// ============================================================================
// REGISTRO DE AÇÕES
// ============================================================================
const ACTIONS: Record<string, ActionDef> = {
  // ── Gravação: criar ────────────────────────────────────────────────────────
  criar_gravacao: {
    tipo: "criar_gravacao",
    label: "Agendar gravação",
    icon: CalendarPlus,
    hint: "agendar/marcar/criar uma gravação no calendário de gravações",
    schema: `{"tipo":"criar_gravacao","dados":{"titulo":"","cliente_nome":"","data":"YYYY-MM-DD","inicio":"HH:MM","fim":"HH:MM","local":"","descricao":"","responsavel":""}}`,
    preview: (d, ctx) => {
      const client = resolveClient(ctx.clients, d.cliente_nome || "");
      return [
        { label: "Título", value: d.titulo || "Gravação" },
        { label: "Cliente", value: client ? clientLabel(client) : (d.cliente_nome ? `${d.cliente_nome} (não cadastrado)` : "—"), warn: !!d.cliente_nome && !client },
        { label: "Data", value: fmtDateBR(d.data) },
        { label: "Horário", value: d.inicio ? `${d.inicio}${d.fim ? ` – ${d.fim}` : ""}` : "—" },
        { label: "Local", value: d.local || "" },
        { label: "Resp.", value: d.responsavel || "" },
      ];
    },
    execute: async (d, ctx) => {
      if (!isDate(d.data)) return { ok: false, msg: "Data inválida ou ausente (use AAAA-MM-DD)." };
      const client = resolveClient(ctx.clients, d.cliente_nome || "");
      const member = d.responsavel ? resolveMember(ctx.team, d.responsavel) : null;
      const payload = {
        title: d.titulo || "Gravação", description: d.descricao || "", date: d.data,
        start_time: d.inicio || "09:00", end_time: d.fim || null, location: d.local || "",
        responsible_name: member?.name || null, participants: [] as string[], status: "agendado",
        color: "#FBBF24", notes: "", roteiro: "", roteiro_sent: false,
        client_id: client?.id || null, client_name: client ? clientLabel(client) : (d.cliente_nome || null),
        created_by: ctx.currentUserName || "IA",
      };
      const { data: rec, error } = await supabase.from("recordings").insert(payload).select().single();
      if (error) return { ok: false, msg: error.message };
      try { await supabase.functions.invoke("google-calendar-push", { body: { action: "upsert", recording_id: (rec as { id: string }).id } }); } catch { /* ignore */ }
      return { ok: true, msg: `Gravação "${payload.title}" agendada para ${fmtDateBR(payload.date)} às ${payload.start_time}.` };
    },
  },

  // ── Gravação: atualizar status ───────────────────────────────────────────────
  atualizar_status_gravacao: {
    tipo: "atualizar_status_gravacao",
    label: "Atualizar status da gravação",
    icon: CheckCircle2,
    hint: "mudar o status de uma gravação (gravado, cancelado, em gravação) localizada pelo título",
    schema: `{"tipo":"atualizar_status_gravacao","dados":{"titulo":"","data":"YYYY-MM-DD","novo_status":"agendado|em_gravacao|gravado|cancelado"}}`,
    preview: (d) => [
      { label: "Gravação", value: d.titulo || "—" },
      { label: "Data", value: d.data ? fmtDateBR(d.data) : "(qualquer)" },
      { label: "Novo status", value: REC_STATUS_LABEL[pick(REC_STATUS, d.novo_status)] || d.novo_status || "—" },
    ],
    execute: async (d) => {
      const status = pick(REC_STATUS, d.novo_status || "");
      if (!status) return { ok: false, msg: "Status inválido (use: agendado, em_gravacao, gravado ou cancelado)." };
      if (!d.titulo) return { ok: false, msg: "Informe o título da gravação." };
      let q = supabase.from("recordings").select("id,title,date").ilike("title", `%${d.titulo}%`);
      if (isDate(d.data)) q = q.eq("date", d.data);
      const { data: rows, error } = await q.limit(6);
      if (error) return { ok: false, msg: error.message };
      const list = (rows || []) as { id: string; title: string; date: string }[];
      if (list.length === 0) return { ok: false, msg: `Nenhuma gravação encontrada com "${d.titulo}".` };
      if (list.length > 1) return { ok: false, msg: `Encontrei ${list.length} gravações com "${d.titulo}". Especifique a data.` };
      const { error: upErr } = await supabase.from("recordings").update({ status }).eq("id", list[0].id);
      if (upErr) return { ok: false, msg: upErr.message };
      try { await supabase.functions.invoke("google-calendar-push", { body: { action: "upsert", recording_id: list[0].id } }); } catch { /* ignore */ }
      return { ok: true, msg: `Gravação "${list[0].title}" agora está: ${REC_STATUS_LABEL[status]}.` };
    },
  },

  // ── Post de social media: criar ──────────────────────────────────────────────
  criar_post: {
    tipo: "criar_post",
    label: "Agendar post",
    icon: Image,
    hint: "criar/agendar um post no calendário de social media (precisa de cliente)",
    schema: `{"tipo":"criar_post","dados":{"cliente_nome":"","titulo":"","plataforma":"instagram|facebook|linkedin|tiktok|youtube|twitter|pinterest","tipo_post":"feed_foto|feed_video|reels|stories|carrossel|live|shorts","data_agendada":"YYYY-MM-DDTHH:MM","legenda":"","descricao":""}}`,
    preview: (d, ctx) => {
      const client = resolveClient(ctx.clients, d.cliente_nome || "");
      return [
        { label: "Cliente", value: client ? clientLabel(client) : (d.cliente_nome ? `${d.cliente_nome} (não cadastrado)` : "—"), warn: !client },
        { label: "Título", value: d.titulo || "Post" },
        { label: "Plataforma", value: pick(PLATFORM, d.plataforma, "instagram") },
        { label: "Tipo", value: pick(POST_TYPE, d.tipo_post, "feed_foto") },
        { label: "Quando", value: d.data_agendada ? fmtDateTimeBR(toIsoBrasilia(d.data_agendada)) : "—" },
        { label: "Legenda", value: d.legenda || "" },
      ];
    },
    execute: async (d, ctx) => {
      const client = resolveClient(ctx.clients, d.cliente_nome || "");
      if (!client) return { ok: false, msg: `Cliente "${d.cliente_nome || ""}" não encontrado (obrigatório para criar post).` };
      const platform = pick(PLATFORM, d.plataforma, "instagram");
      const post_type = pick(POST_TYPE, d.tipo_post, "feed_foto");
      const scheduled_at = toIsoBrasilia(d.data_agendada);
      const payload = {
        client_id: client.id, title: d.titulo || "Post", platform, post_type,
        status: "agendado", scheduled_at, caption: d.legenda || null, description: d.descricao || null,
        created_by: ctx.currentUserAuthId || null, // coluna uuid (profiles.id)
      };
      const { error } = await supabase.from("sm_posts").insert(payload as never).select().single();
      if (error) return { ok: false, msg: error.message };
      return { ok: true, msg: `Post "${payload.title}" (${platform}) agendado${scheduled_at ? ` para ${fmtDateTimeBR(scheduled_at)}` : ""} para ${clientLabel(client)}.` };
    },
  },

  // ── Tarefa: criar ──────────────────────────────────────────────────────────
  criar_tarefa: {
    tipo: "criar_tarefa",
    label: "Criar tarefa",
    icon: ListPlus,
    hint: "criar uma tarefa/demanda avulsa para alguém da equipe",
    schema: `{"tipo":"criar_tarefa","dados":{"titulo":"","cliente_nome":"","responsavel":"","prazo":"YYYY-MM-DD","urgencia":"normal|prioridade|urgente|critico","descricao":""}}`,
    preview: (d, ctx) => {
      const client = d.cliente_nome ? resolveClient(ctx.clients, d.cliente_nome) : null;
      const member = d.responsavel ? resolveMember(ctx.team, d.responsavel) : null;
      return [
        { label: "Título", value: d.titulo || "—" },
        { label: "Resp.", value: member?.name || (d.responsavel ? `${d.responsavel} (?)` : ctx.currentUserName), warn: !!d.responsavel && !member },
        { label: "Cliente", value: client ? clientLabel(client) : (d.cliente_nome || "Interno") },
        { label: "Prazo", value: isDate(d.prazo) ? fmtDateBR(d.prazo) : "hoje" },
        { label: "Urgência", value: pick(URGENCY, d.urgencia, "normal") },
      ];
    },
    execute: async (d, ctx) => {
      if (!d.titulo) return { ok: false, msg: "Título é obrigatório." };
      const client = d.cliente_nome ? resolveClient(ctx.clients, d.cliente_nome) : null;
      const member = d.responsavel ? resolveMember(ctx.team, d.responsavel) : null;
      const task: Task = {
        id: `t-ia-${Date.now()}`, title: d.titulo,
        client: client ? clientLabel(client) : "Interno", clientId: client?.id || "",
        module: "Demandas Avulsas", sector: "Avulso", type: d.tipo || "Tarefa",
        assignee: member?.name || ctx.currentUserName || "",
        deadline: isDate(d.prazo) ? d.prazo : new Date().toISOString().slice(0, 10),
        urgency: pick(URGENCY, d.urgencia, "normal") as Task["urgency"],
        status: "backlog", weight: 1, estimatedHours: 1, hasRework: false,
        createdAt: new Date().toISOString().slice(0, 10),
        description: d.descricao || undefined, createdBy: ctx.currentUserName || undefined,
      };
      useAppStore.getState().addTask(task);
      return { ok: true, msg: `Tarefa "${task.title}" criada para ${task.assignee || "—"} (prazo ${fmtDateBR(task.deadline)}).` };
    },
  },

  // ── Lead: criar ──────────────────────────────────────────────────────────────
  criar_lead: {
    tipo: "criar_lead",
    label: "Criar lead",
    icon: UserPlus,
    hint: "adicionar um lead no funil de prospecção",
    schema: `{"tipo":"criar_lead","dados":{"nome":"","empresa":"","responsavel":"","origem":"","valor_potencial":0,"data_reuniao":"YYYY-MM-DD","etapa":"reuniao agendada|reuniao realizada|proposta enviada|negociacao|fechado|perdido","observacoes":""}}`,
    preview: (d, ctx) => {
      const member = d.responsavel ? resolveMember(ctx.team, d.responsavel) : null;
      return [
        { label: "Nome", value: d.nome || "—" },
        { label: "Empresa", value: d.empresa || "—" },
        { label: "Resp.", value: member?.name || d.responsavel || ctx.currentUserName },
        { label: "Origem", value: d.origem || "IA" },
        { label: "Reunião", value: isDate(d.data_reuniao) ? fmtDateBR(d.data_reuniao) : "—" },
        { label: "Valor", value: d.valor_potencial ? `R$ ${Number(d.valor_potencial).toLocaleString("pt-BR")}` : "—" },
      ];
    },
    execute: async (d, ctx) => {
      if (!d.nome || !d.empresa) return { ok: false, msg: "Nome e empresa são obrigatórios." };
      const member = d.responsavel ? resolveMember(ctx.team, d.responsavel) : null;
      const meetingDate = isDate((d.data_reuniao || "").slice(0, 10)) ? d.data_reuniao.slice(0, 10) : "";
      const lead: Lead = {
        id: `l-ia-${Date.now()}`, name: d.nome, company: d.empresa,
        responsible: member?.name || d.responsavel || ctx.currentUserName || "",
        meetingDate, origin: d.origem || "IA", stage: pick(STAGE, d.etapa, "meeting_scheduled"),
        potentialValue: Number(d.valor_potencial) || 0, nextFollowUp: meetingDate, notes: d.observacoes || "",
      };
      useAppStore.getState().addLead(lead);
      return { ok: true, msg: `Lead "${lead.name}" (${lead.company}) adicionado ao funil.` };
    },
  },

  // ── Solicitação interna: criar ────────────────────────────────────────────────
  criar_solicitacao: {
    tipo: "criar_solicitacao",
    label: "Criar solicitação interna",
    icon: Inbox,
    hint: "abrir uma requisição/solicitação interna para um departamento (gera tarefa para o responsável)",
    schema: `{"tipo":"criar_solicitacao","dados":{"titulo":"","descricao":"","departamento":"social_media|gestao_trafego|producao|financeiro|operacional|tech|geral","responsavel":"","prioridade":"baixa|normal|alta|urgente","cliente_nome":"","prazo":"YYYY-MM-DD"}}`,
    preview: (d, ctx) => {
      const member = resolveMember(ctx.team, d.responsavel || "");
      const client = d.cliente_nome ? resolveClient(ctx.clients, d.cliente_nome) : null;
      return [
        { label: "Título", value: d.titulo || "—" },
        { label: "Depto", value: DEPT_LABEL[pick(DEPT, d.departamento)] || d.departamento || "—", warn: !pick(DEPT, d.departamento || "") },
        { label: "Resp.", value: member?.name || (d.responsavel ? `${d.responsavel} (não encontrado)` : "—"), warn: !member },
        { label: "Prioridade", value: pick(PRIORITY, d.prioridade, "normal") },
        { label: "Cliente", value: client ? clientLabel(client) : (d.cliente_nome || "—") },
        { label: "Prazo", value: isDate(d.prazo) ? fmtDateBR(d.prazo) : "—" },
      ];
    },
    execute: async (d, ctx) => {
      if (!d.titulo) return { ok: false, msg: "Título é obrigatório." };
      const dept = pick(DEPT, d.departamento || "");
      if (!dept) return { ok: false, msg: `Departamento inválido. Use um de: ${Object.keys(DEPT_LABEL).join(", ")}.` };
      const member = resolveMember(ctx.team, d.responsavel || "");
      if (!member) return { ok: false, msg: `Responsável "${d.responsavel || ""}" não encontrado na equipe.` };
      const client = d.cliente_nome ? resolveClient(ctx.clients, d.cliente_nome) : null;
      const req: InternalRequest = {
        id: `req-ia-${Date.now()}`, title: d.titulo, description: d.descricao || "",
        requesterId: ctx.currentUserId || "", requesterName: ctx.currentUserName || "",
        assignedToName: member.name, assignedToId: member.id,
        clientId: client?.id || undefined, clientName: client ? clientLabel(client) : undefined,
        department: dept, priority: pick(PRIORITY, d.prioridade, "normal") as InternalRequest["priority"],
        status: "pending", createdAt: new Date().toISOString(),
        dueDate: isDate((d.prazo || "").slice(0, 10)) ? d.prazo : undefined,
      };
      useAppStore.getState().addRequest(req);
      return { ok: true, msg: `Solicitação "${req.title}" enviada para ${member.name} (${DEPT_LABEL[dept]}).` };
    },
  },
};

// ── API pública ───────────────────────────────────────────────────────────────
export function getActionDef(tipo: string): ActionDef | undefined { return ACTIONS[tipo]; }

export function previewAction(action: PendingAction, ctx: ActionContext): PreviewRow[] {
  const def = ACTIONS[action.tipo];
  if (!def) {
    return Object.entries(action.dados || {}).map(([k, v]) => ({ label: k, value: String(v ?? "") }));
  }
  try { return def.preview(action.dados || {}, ctx); } catch { return []; }
}

export async function executeAction(action: PendingAction, ctx: ActionContext): Promise<{ ok: boolean; msg: string }> {
  const def = ACTIONS[action.tipo];
  if (!def) return { ok: false, msg: `Ação não suportada: ${action.tipo}` };
  return def.execute(action.dados || {}, ctx);
}

// extrai o primeiro objeto JSON balanceado que contenha "tipo" (mesmo cercado por ```)
function findJsonWithTipo(text: string): string | null {
  const idx = text.indexOf('"tipo"');
  if (idx < 0) return null;
  const start = text.lastIndexOf("{", idx);
  if (start < 0) return null;
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}") { depth--; if (depth === 0) return text.slice(start, i + 1); }
  }
  return null;
}

export function extractAction(text: string): { clean: string; action: PendingAction | null } {
  const raw = findJsonWithTipo(text);
  if (!raw) return { clean: text, action: null };
  let action: PendingAction | null = null;
  try { action = JSON.parse(raw); } catch { return { clean: text, action: null }; }
  if (!action || typeof action.tipo !== "string") return { clean: text, action: null };
  let clean = text.replace(raw, "").replace(/```(?:jg-action|json)?/gi, "").trim();
  return { clean, action };
}

// system prompt gerado a partir do registro — não exige redeploy da edge function
export function buildActionsSystemPrompt(): string {
  const n = nowBrasilia();
  const catalog = Object.values(ACTIONS)
    .map((a) => `- **${a.tipo}** — ${a.hint}\n  \`${a.schema}\``)
    .join("\n");
  return `Você é o assistente do sistema interno da JG (agência de marketing). Responda em português do Brasil, de forma objetiva e útil.

## Você executa ações no sistema
Você NÃO apenas responde: pode preparar ações reais (criar/agendar/atualizar registros). Quando o usuário pedir CLARAMENTE para fazer uma dessas ações, escreva uma frase curta confirmando o que entendeu e, no FINAL da resposta, inclua EXATAMENTE UM bloco cercado por três crases com a tag jg-action contendo o JSON da ação.

Exemplo de formato:
\`\`\`jg-action
{"tipo":"criar_gravacao","dados":{"titulo":"Gravação institucional","cliente_nome":"Anil Piscinas","data":"2026-06-11","inicio":"20:00","fim":"21:00","local":"","descricao":"","responsavel":""}}
\`\`\`

Ações disponíveis (escolha UMA por pedido):
${catalog}

Regras:
- Hoje é ${n.weekday}, ${n.date}, ${n.time} (horário de Brasília). Use para resolver "hoje", "amanhã", "semana que vem", etc.
- Datas: "YYYY-MM-DD". Datas com hora: "YYYY-MM-DDTHH:MM". Horas: "HH:MM" (24h). Se faltar o fim de uma gravação, use 1h após o início.
- Use o nome do cliente/responsável exatamente como o usuário falou — o sistema resolve o ID sozinho.
- Deixe vazio ("") todo campo que o usuário não informou. NUNCA invente dados (valores, nomes, datas).
- Só inclua o bloco em pedidos de CRIAÇÃO/ATUALIZAÇÃO. Para perguntas, consultas ou resumos, responda normalmente, SEM bloco.
- Não descreva o JSON em texto nem repita os campos fora do bloco; o card de confirmação já mostra tudo ao usuário, que ainda precisa confirmar antes de gravar.`;
}
