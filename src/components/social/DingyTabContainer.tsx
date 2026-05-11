import { useState, useMemo, useEffect, useRef } from "react";
import {
  LayoutGrid, Calendar as CalendarIcon, FolderKanban, Users,
  BarChart3, Bell, Settings as SettingsIcon, Flame, ChevronLeft, ChevronRight,
  ChevronDown, HandHelping, Send, X, Flag, User as UserIcon, Calendar as CalIcon,
  Clock, FileText, CheckSquare, MessageSquare, Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useAppStore } from "@/store/useAppStore";
import { useAuthStore } from "@/store/useAuthStore";
import { isSocialTeamMember } from "@/lib/socialTeam";
import {
  listHelpRequests, createHelpRequest, acceptHelpRequest,
  markHelpDone, cancelHelpRequest, type DingyHelpRequest,
} from "@/lib/dingyHelp";
import {
  listChecklist, addChecklistItem, toggleChecklistItem, deleteChecklistItem,
  listComments, addComment,
  type DingyChecklistItem, type DingyTaskComment,
} from "@/lib/dingyTaskExtras";
import { supabase } from "@/integrations/supabase/client";
import RecordingsCalendar from "./RecordingsCalendar";

type SubTab = "board" | "calendar" | "projects" | "team" | "reports" | "notifications" | "settings";

const T = {
  bg: "#0A0A0A",
  panel: "#0F0F0F",
  panelAlt: "#111111",
  card: "#161616",
  cardHover: "#1A1A1A",
  border: "#1F1F1F",
  borderHover: "#2A2A2A",
  fg: "#FFFFFF",
  fgMuted: "#888888",
  fgDim: "#666666",
  primary: "#FBBF24",
  primaryDark: "#F59E0B",
  primaryFg: "#000000",
  danger: "#EF4444",
  warning: "#F59E0B",
  info: "#3B82F6",
  purple: "#A855F7",
} as const;

const URGENCY_COLOR: Record<string, string> = {
  normal: T.fgMuted,
  priority: T.warning,
  urgent: "#F97316",
  critical: T.danger,
};

const URGENCY_LABEL: Record<string, string> = {
  normal: "Normal",
  priority: "Média",
  urgent: "Alta",
  critical: "Crítica",
};

// Mapeia status do jg-interno -> coluna do board estilo dingy
function toDingyColumn(status: string): "todo" | "doing" | "approval" | "done" {
  const s = (status || "").toLowerCase();
  if (s === "in_progress" || s === "paused" || s === "doing") return "doing";
  if (s === "approval" || s === "waiting_client" || s === "review") return "approval";
  if (s === "done" || s === "completed") return "done";
  return "todo";
}

type DingyCol = "todo" | "doing" | "approval";

// Status canônico do jg-interno para cada coluna do board do Dingy.
// Se o status atual já mapeia para a mesma coluna, preservamos o status original
// (assim arrastar entre responsáveis dentro da mesma coluna não muda o status).
function statusForDingyColumn(col: DingyCol, currentStatus: string): string {
  if (toDingyColumn(currentStatus) === col) return currentStatus;
  if (col === "todo") return "backlog";
  if (col === "doing") return "in_progress";
  return "approval";
}

const DRAG_MIME = "application/x-dingy-task";

export default function DingyTabContainer() {
  const [sub, setSub] = useState<SubTab>("board");
  const [collapsed, setCollapsed] = useState(false);

  const tasks = useAppStore((s) => s.tasks);
  const team = useAppStore((s) => s.team);
  const clients = useAppStore((s) => s.clients);
  const currentUser = useAuthStore((s) => s.currentUser);

  const socialTasks = useMemo(() => tasks.filter((t) => t.module === "Social Media"), [tasks]);
  const socialTeam = useMemo(() => team.filter(isSocialTeamMember), [team]);

  // Pedidos de ajuda (carregados aqui pra alimentar o badge da sidebar e a view)
  const [helpItems, setHelpItems] = useState<DingyHelpRequest[]>([]);
  const [helpLoading, setHelpLoading] = useState(true);
  const openHelpCount = useMemo(
    () => helpItems.filter((i) => i.status === "open").length,
    [helpItems]
  );

  const reloadHelp = async () => {
    try {
      const data = await listHelpRequests();
      setHelpItems(data);
    } catch (err: any) {
      console.error("Erro ao carregar pedidos de ajuda:", err);
    } finally {
      setHelpLoading(false);
    }
  };

  useEffect(() => {
    reloadHelp();
    const channel = (supabase as any)
      .channel("dingy-help-requests")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "dingy_help_requests" },
        () => reloadHelp(),
      )
      .subscribe();
    return () => {
      try { (supabase as any).removeChannel(channel); } catch { /* noop */ }
    };
  }, []);

  const navItems: { key: SubTab; label: string; icon: typeof LayoutGrid; badge?: number }[] = [
    { key: "board", label: "Board", icon: LayoutGrid },
    { key: "calendar", label: "Calendário", icon: CalendarIcon },
    { key: "projects", label: "Projetos", icon: FolderKanban },
    { key: "team", label: "Equipe", icon: Users },
    { key: "reports", label: "Relatórios", icon: BarChart3 },
    { key: "notifications", label: "Notificações", icon: Bell, badge: openHelpCount },
    { key: "settings", label: "Configurações", icon: SettingsIcon },
  ];

  return (
    <div
      className="flex rounded-xl overflow-hidden border"
      style={{ background: T.bg, color: T.fg, borderColor: T.border, minHeight: 720 }}
    >
      {/* Sidebar */}
      <aside
        className="flex flex-col shrink-0 transition-all duration-200"
        style={{
          width: collapsed ? 64 : 220,
          background: T.panel,
          borderRight: `1px solid ${T.border}`,
        }}
      >
        <div
          className="flex items-center gap-2 px-4 h-16"
          style={{ borderBottom: `1px solid ${T.border}` }}
        >
          <div
            className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: T.primary }}
          >
            <Flame className="h-5 w-5" style={{ color: T.primaryFg }} />
          </div>
          {!collapsed && (
            <span className="font-semibold text-lg" style={{ color: T.primary }}>
              dingy
            </span>
          )}
        </div>

        <nav className="flex-1 p-2 space-y-1">
          {navItems.map((it) => {
            const Icon = it.icon;
            const active = sub === it.key;
            const showBadge = (it.badge ?? 0) > 0;
            return (
              <button
                key={it.key}
                onClick={() => setSub(it.key)}
                className="relative w-full flex items-center gap-3 h-10 px-3 rounded-lg text-sm transition-colors"
                style={{
                  background: active ? T.card : "transparent",
                  color: active ? T.primary : T.fgMuted,
                  border: `1px solid ${active ? T.border : "transparent"}`,
                }}
                title={showBadge ? `${it.label} (${it.badge} em aberto)` : it.label}
              >
                <span className="relative shrink-0">
                  <Icon className="h-4 w-4" />
                  {showBadge && collapsed && (
                    <span
                      className="absolute -top-1.5 -right-1.5 h-4 min-w-[1rem] px-1 rounded-full text-[9px] font-bold flex items-center justify-center"
                      style={{ background: T.primary, color: T.primaryFg, lineHeight: 1 }}
                    >
                      {it.badge! > 9 ? "9+" : it.badge}
                    </span>
                  )}
                </span>
                {!collapsed && (
                  <>
                    <span className="truncate flex-1 text-left">{it.label}</span>
                    {showBadge && (
                      <span
                        className="h-5 min-w-[1.25rem] px-1.5 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0"
                        style={{ background: T.primary, color: T.primaryFg }}
                      >
                        {it.badge! > 99 ? "99+" : it.badge}
                      </span>
                    )}
                  </>
                )}
              </button>
            );
          })}
        </nav>

        <button
          onClick={() => setCollapsed((c) => !c)}
          className="m-2 h-9 rounded-lg flex items-center justify-center text-xs gap-1 transition-colors"
          style={{ background: T.card, color: T.fgMuted, border: `1px solid ${T.border}` }}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : (
            <>
              <ChevronLeft className="h-4 w-4" />
              <span>Recolher</span>
            </>
          )}
        </button>

        <div
          className="p-3 flex items-center gap-2"
          style={{ borderTop: `1px solid ${T.border}` }}
        >
          <div
            className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0"
            style={{ background: T.primary, color: T.primaryFg }}
          >
            {(currentUser?.name || "?").slice(0, 2).toUpperCase()}
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-xs font-medium truncate" style={{ color: T.fg }}>
                {currentUser?.name || "Visitante"}
              </p>
              <p className="text-[10px] truncate" style={{ color: T.fgDim }}>
                {currentUser?.role || "—"}
              </p>
            </div>
          )}
        </div>
      </aside>

      {/* Conteúdo principal */}
      <main className="flex-1 min-w-0 flex flex-col">
        {sub === "board" && <BoardView tasks={socialTasks} team={socialTeam} currentUserName={currentUser?.name} />}
        {sub === "calendar" && <div className="p-2"><RecordingsCalendar /></div>}
        {sub === "projects" && <ProjectsView clients={clients} tasks={socialTasks} />}
        {sub === "team" && <TeamView tasks={socialTasks} team={socialTeam} />}
        {sub === "reports" && <ReportsView tasks={socialTasks} team={socialTeam} />}
        {sub === "notifications" && (
          <NotificationsView items={helpItems} loading={helpLoading} onChanged={reloadHelp} />
        )}
        {sub === "settings" && <SettingsView />}
      </main>
    </div>
  );
}

// ============================================================
// Sub-view: Board
// ============================================================
function BoardView({
  tasks,
  team,
  currentUserName,
}: {
  tasks: ReturnType<typeof useAppStore.getState>["tasks"];
  team: ReturnType<typeof useAppStore.getState>["team"];
  currentUserName?: string;
}) {
  const updateTask = useAppStore((s) => s.updateTask);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const selectedTask = useMemo(
    () => (selectedTaskId ? tasks.find((t) => t.id === selectedTaskId) || null : null),
    [tasks, selectedTaskId]
  );

  const onMoveTask = (
    taskId: string,
    toAssignee: string,
    toCol: DingyCol,
    from: { assignee: string; col: DingyCol; status: string }
  ) => {
    if (toAssignee === from.assignee && toCol === from.col) return;
    const newStatus = statusForDingyColumn(toCol, from.status);
    updateTask(taskId, { assignee: toAssignee, status: newStatus });
  };

  const grouped = useMemo(() => {
    const map = new Map<string, { todo: typeof tasks; doing: typeof tasks; approval: typeof tasks }>();
    // Pré-popula APENAS com membros do time de Social Media (mesmo sem tarefas).
    for (const m of team) map.set(m.name, { todo: [], doing: [], approval: [] });
    for (const t of tasks) {
      const col = toDingyColumn(t.status);
      if (col === "done") continue;
      const key = t.assignee || "";
      // Ignora tarefas cujo responsável não pertence ao time de Social Media.
      if (!map.has(key)) continue;
      map.get(key)![col].push(t);
    }
    return Array.from(map.entries()).sort((a, b) => {
      const totalA = a[1].todo.length + a[1].doing.length + a[1].approval.length;
      const totalB = b[1].todo.length + b[1].doing.length + b[1].approval.length;
      return totalB - totalA;
    });
  }, [tasks, team]);

  // Drag-to-pan horizontal: clicar em área vazia entre colunas/cards e arrastar pra rolar.
  const scrollRef = useRef<HTMLDivElement>(null);
  const panState = useRef<{ active: boolean; startX: number; startScrollLeft: number; moved: boolean }>(
    { active: false, startX: 0, startScrollLeft: 0, moved: false }
  );
  const [isPanning, setIsPanning] = useState(false);

  const INTERACTIVE_SEL =
    '[draggable="true"], button, input, select, textarea, a, [role="menu"], [data-no-pan]';

  const onPanStart = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest(INTERACTIVE_SEL)) return;
    const el = scrollRef.current;
    if (!el) return;
    panState.current = {
      active: true,
      startX: e.pageX,
      startScrollLeft: el.scrollLeft,
      moved: false,
    };
    setIsPanning(true);
  };

  const onPanMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!panState.current.active) return;
    const el = scrollRef.current;
    if (!el) return;
    const dx = e.pageX - panState.current.startX;
    if (Math.abs(dx) > 3) panState.current.moved = true;
    el.scrollLeft = panState.current.startScrollLeft - dx;
  };

  const onPanEnd = () => {
    if (!panState.current.active) return;
    panState.current.active = false;
    setIsPanning(false);
  };

  return (
    <div className="p-6 flex flex-col gap-4 h-full">
      <header className="flex items-center justify-between">
        <h2 className="text-xl font-semibold flex items-center gap-2" style={{ color: T.fg }}>
          <LayoutGrid className="h-5 w-5" style={{ color: T.primary }} />
          Board
        </h2>
        <button
          className="inline-flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-semibold"
          style={{ background: T.primary, color: T.primaryFg }}
          disabled
          title="Use a aba Tarefas para criar uma nova tarefa"
        >
          + Nova Tarefa
        </button>
      </header>

      <div
        ref={scrollRef}
        onMouseDown={onPanStart}
        onMouseMove={onPanMove}
        onMouseUp={onPanEnd}
        onMouseLeave={onPanEnd}
        className="flex gap-4 overflow-x-auto pb-4 -mx-2 px-2 select-none"
        style={{ cursor: isPanning ? "grabbing" : "grab" }}
      >
        {grouped.length === 0 && (
          <p className="text-sm" style={{ color: T.fgDim }}>
            Sem tarefas de Social Media ainda.
          </p>
        )}
        {grouped.map(([assignee, cols]) => (
          <UserColumn
            key={assignee}
            assignee={assignee}
            todo={cols.todo}
            doing={cols.doing}
            approval={cols.approval}
            isCurrent={assignee === currentUserName}
            onMoveTask={onMoveTask}
            onSelectTask={setSelectedTaskId}
          />
        ))}
      </div>

      {selectedTask && (
        <TaskDetailDrawer
          task={selectedTask}
          team={team}
          currentUserName={currentUserName || ""}
          onClose={() => setSelectedTaskId(null)}
        />
      )}
    </div>
  );
}

type MoveHandler = (
  taskId: string,
  toAssignee: string,
  toCol: DingyCol,
  from: { assignee: string; col: DingyCol; status: string }
) => void;

function UserColumn({
  assignee,
  todo,
  doing,
  approval,
  isCurrent,
  onMoveTask,
  onSelectTask,
}: {
  assignee: string;
  todo: any[];
  doing: any[];
  approval: any[];
  isCurrent: boolean;
  onMoveTask: MoveHandler;
  onSelectTask: (id: string) => void;
}) {
  const total = todo.length + doing.length + approval.length;
  return (
    <section
      className="shrink-0 w-[300px] rounded-xl flex flex-col"
      style={{
        background: T.panelAlt,
        border: `1px solid ${isCurrent ? T.primary : T.border}`,
      }}
    >
      <header
        className="flex items-center gap-3 p-3"
        style={{ borderBottom: `1px solid ${T.border}` }}
      >
        <div
          className="h-9 w-9 rounded-full flex items-center justify-center text-xs font-semibold shrink-0"
          style={{ background: T.primary, color: T.primaryFg }}
        >
          {assignee.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate" style={{ color: T.fg }}>{assignee}</p>
          <p className="text-[11px]" style={{ color: T.fgDim }}>
            {total} tarefa{total === 1 ? "" : "s"}
          </p>
        </div>
      </header>

      <div className="flex-1 p-3 space-y-4 overflow-y-auto" style={{ maxHeight: 560 }}>
        <ColumnSection label="A FAZER" col="todo" count={todo.length} dotColor={T.fgMuted} tasks={todo} assignee={assignee} onMoveTask={onMoveTask} onSelectTask={onSelectTask} />
        <ColumnSection label="EM ANDAMENTO" col="doing" count={doing.length} dotColor={T.info} tasks={doing} assignee={assignee} onMoveTask={onMoveTask} onSelectTask={onSelectTask} />
        <ColumnSection label="APROVAÇÃO" col="approval" count={approval.length} dotColor={T.purple} tasks={approval} assignee={assignee} onMoveTask={onMoveTask} onSelectTask={onSelectTask} />
      </div>
    </section>
  );
}

function ColumnSection({
  label,
  col,
  count,
  dotColor,
  tasks,
  assignee,
  onMoveTask,
  onSelectTask,
}: {
  label: string;
  col: DingyCol;
  count: number;
  dotColor: string;
  tasks: any[];
  assignee: string;
  onMoveTask: MoveHandler;
  onSelectTask: (id: string) => void;
}) {
  const [hover, setHover] = useState(false);

  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (e.dataTransfer.types.includes(DRAG_MIME)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (!hover) setHover(true);
    }
  };
  const onDragLeave = () => setHover(false);
  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setHover(false);
    const raw = e.dataTransfer.getData(DRAG_MIME);
    if (!raw) return;
    try {
      const payload = JSON.parse(raw) as { id: string; assignee: string; col: DingyCol; status: string };
      onMoveTask(payload.id, assignee, col, { assignee: payload.assignee, col: payload.col, status: payload.status });
    } catch { /* ignore malformed */ }
  };

  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className="rounded-lg p-2 -m-2 transition-colors"
      style={{
        background: hover ? T.card : "transparent",
        outline: hover ? `1px dashed ${T.primary}` : "1px dashed transparent",
        outlineOffset: -1,
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="h-2 w-2 rounded-full" style={{ background: dotColor }} />
        <span className="text-[10px] font-semibold tracking-wider" style={{ color: T.fgMuted }}>
          {label}
        </span>
        <span className="text-[10px]" style={{ color: T.fgDim }}>{count}</span>
      </div>
      {tasks.length === 0 && (
        <p className="text-[11px] italic" style={{ color: T.fgDim }}>—</p>
      )}
      <div className="space-y-2">
        {tasks.map((t) => (
          <TaskCard key={t.id} task={t} fromCol={col} fromAssignee={assignee} onSelect={onSelectTask} />
        ))}
      </div>
    </div>
  );
}

const COL_LABEL: Record<DingyCol, string> = {
  todo: "A Fazer",
  doing: "Em Andamento",
  approval: "Aprovação",
};

function TaskCard({
  task,
  fromCol,
  fromAssignee,
  onSelect,
}: {
  task: any;
  fromCol: DingyCol;
  fromAssignee: string;
  onSelect: (id: string) => void;
}) {
  const urgencyColor = URGENCY_COLOR[task.urgency] || T.fgMuted;
  const dueDate = task.deadline ? new Date(task.deadline).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) : "—";
  const [dragging, setDragging] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const dragMoved = useRef(false);

  const updateTask = useAppStore((s) => s.updateTask);
  const currentUserName = useAuthStore((s) => s.currentUser?.name) || "Sistema";

  // Fecha o menu ao clicar fora
  useEffect(() => {
    if (!showStatusMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowStatusMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showStatusMenu]);

  const onDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    const payload = JSON.stringify({
      id: task.id,
      assignee: fromAssignee,
      col: fromCol,
      status: task.status,
    });
    e.dataTransfer.setData(DRAG_MIME, payload);
    e.dataTransfer.effectAllowed = "move";
    setDragging(true);
    dragMoved.current = true;
  };
  const onDragEnd = () => setDragging(false);

  const onCardClick = (e: React.MouseEvent<HTMLElement>) => {
    if (dragMoved.current) {
      dragMoved.current = false;
      return;
    }
    const target = e.target as HTMLElement;
    if (target.closest("button, select, [role='menu'], [data-no-select]")) return;
    onSelect(task.id);
  };

  const moveTo = (col: DingyCol) => {
    setShowStatusMenu(false);
    const newStatus = statusForDingyColumn(col, task.status);
    if (newStatus === task.status) return;
    updateTask(task.id, { status: newStatus });
  };

  const askForHelp = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await createHelpRequest({
        taskId: task.id,
        taskTitle: task.title || "(sem título)",
        taskClient: task.client || "",
        requesterName: currentUserName,
        message: "",
      });
      toast.success("Pedido de ajuda enviado para a equipe (aba Notificações).");
    } catch (err: any) {
      toast.error("Falha ao enviar pedido: " + (err?.message || err));
    }
  };

  const sendToApproval = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (toDingyColumn(task.status) === "approval") {
      toast.info("Tarefa já está em Aprovação");
      return;
    }
    updateTask(task.id, { status: "approval" });
    toast.success("Tarefa enviada para aprovação");
  };

  return (
    <article
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onCardClick}
      className="rounded-lg p-3 text-sm cursor-pointer select-none transition-colors"
      style={{
        background: T.card,
        border: `1px solid ${T.border}`,
        opacity: dragging ? 0.5 : 1,
      }}
    >
      <p className="font-medium truncate" style={{ color: T.fg }} title={task.title}>
        {task.title}
      </p>
      {task.client && (
        <p className="text-[11px] mt-0.5 truncate" style={{ color: T.fgDim }}>{task.client}</p>
      )}
      <div className="flex items-center gap-2 mt-2 flex-wrap">
        <span
          className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded uppercase"
          style={{ background: urgencyColor + "22", color: urgencyColor, border: `1px solid ${urgencyColor}44` }}
        >
          {URGENCY_LABEL[task.urgency] || task.urgency}
        </span>
        <span className="text-[10px]" style={{ color: T.fgDim }}>{dueDate}</span>
      </div>

      {/* Linha de ações estilo dingy: dropdown status + pedir ajuda + enviar pra aprovação */}
      <div className="flex items-center gap-1 mt-3" onMouseDown={(e) => e.stopPropagation()}>
        <div className="relative flex-1 min-w-0" ref={menuRef}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowStatusMenu((v) => !v);
            }}
            className="w-full flex items-center justify-between gap-1 h-7 px-2 rounded-md text-[11px]"
            style={{ background: T.bg, border: `1px solid ${T.border}`, color: T.fg }}
            title="Alterar status"
          >
            <span className="truncate">{COL_LABEL[fromCol]}</span>
            <ChevronDown className="h-3 w-3 shrink-0" style={{ color: T.fgMuted }} />
          </button>
          {showStatusMenu && (
            <div
              className="absolute left-0 right-0 mt-1 rounded-md overflow-hidden z-20"
              style={{ background: T.panel, border: `1px solid ${T.border}` }}
            >
              {(["todo", "doing", "approval"] as DingyCol[]).map((c) => {
                const isActive = c === fromCol;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      moveTo(c);
                    }}
                    className="w-full text-left px-2 py-1.5 text-[11px] transition-colors"
                    style={{
                      background: isActive ? T.info : "transparent",
                      color: isActive ? "#FFFFFF" : T.fg,
                    }}
                  >
                    {COL_LABEL[c]}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={askForHelp}
          className="h-7 w-7 rounded-md flex items-center justify-center transition-colors shrink-0"
          style={{ background: T.bg, border: `1px solid ${T.border}`, color: T.fgMuted }}
          title="Pedir ajuda"
          aria-label="Pedir ajuda"
        >
          <HandHelping className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          onClick={sendToApproval}
          className="h-7 w-7 rounded-md flex items-center justify-center transition-colors shrink-0"
          style={{ background: T.bg, border: `1px solid ${T.border}`, color: T.fgMuted }}
          title="Enviar para aprovação"
          aria-label="Enviar para aprovação"
        >
          <Send className="h-3.5 w-3.5" />
        </button>
      </div>
    </article>
  );
}

// ============================================================
// Sub-view: Equipe
// ============================================================
function TeamView({
  tasks,
  team,
}: {
  tasks: any[];
  team: any[];
}) {
  const stats = useMemo(() => {
    return team.map((m) => {
      const mine = tasks.filter((t) => t.assignee === m.name);
      return {
        member: m,
        todo: mine.filter((t) => toDingyColumn(t.status) === "todo").length,
        doing: mine.filter((t) => toDingyColumn(t.status) === "doing").length,
        approval: mine.filter((t) => toDingyColumn(t.status) === "approval").length,
      };
    });
  }, [tasks, team]);

  return (
    <div className="p-6 flex flex-col gap-4">
      <header className="flex items-center gap-2">
        <Users className="h-5 w-5" style={{ color: T.primary }} />
        <h2 className="text-xl font-semibold" style={{ color: T.fg }}>Equipe</h2>
        <span className="text-sm" style={{ color: T.fgDim }}>({team.length} membros)</span>
      </header>

      {team.length === 0 ? (
        <EmptyState message="Nenhum membro cadastrado." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {stats.map((s) => (
            <article
              key={s.member.id || s.member.name}
              className="rounded-xl p-4"
              style={{ background: T.panelAlt, border: `1px solid ${T.border}` }}
            >
              <header className="flex items-center gap-3 mb-3">
                <div
                  className="h-10 w-10 rounded-full flex items-center justify-center text-sm font-semibold shrink-0"
                  style={{ background: T.primary, color: T.primaryFg }}
                >
                  {(s.member.name || "?").slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold truncate" style={{ color: T.fg }}>{s.member.name}</p>
                  <p className="text-[11px]" style={{ color: T.fgDim }}>
                    {s.member.role || "Membro"}
                  </p>
                </div>
              </header>
              <div className="grid grid-cols-3 gap-2">
                <Stat label="A FAZER" value={s.todo} color={T.fgMuted} />
                <Stat label="ANDAMENTO" value={s.doing} color={T.info} />
                <Stat label="APROVAÇÃO" value={s.approval} color={T.purple} />
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div
      className="rounded-lg p-2 text-center"
      style={{ background: T.card, border: `1px solid ${T.border}` }}
    >
      <p className="text-lg font-bold" style={{ color }}>{value}</p>
      <p className="text-[9px] tracking-wider" style={{ color: T.fgDim }}>{label}</p>
    </div>
  );
}

// ============================================================
// Sub-view: Relatórios
// ============================================================
function ReportsView({
  tasks,
  team,
}: {
  tasks: any[];
  team: any[];
}) {
  // Considera somente tarefas atribuídas a membros do time de Social Media.
  const teamNames = useMemo(() => new Set(team.map((m) => m.name)), [team]);
  const teamTasks = useMemo(
    () => tasks.filter((t) => teamNames.has(t.assignee)),
    [tasks, teamNames]
  );

  const totals = useMemo(() => {
    const todo = teamTasks.filter((t) => toDingyColumn(t.status) === "todo").length;
    const doing = teamTasks.filter((t) => toDingyColumn(t.status) === "doing").length;
    const approval = teamTasks.filter((t) => toDingyColumn(t.status) === "approval").length;
    const high = teamTasks.filter((t) => t.urgency === "urgent" || t.urgency === "critical").length;
    const overdue = teamTasks.filter((t) => {
      if (!t.deadline || toDingyColumn(t.status) === "done") return false;
      return new Date(t.deadline).getTime() < Date.now();
    }).length;
    return {
      total: teamTasks.length,
      todo,
      doing,
      approval,
      high,
      overdue,
    };
  }, [teamTasks]);

  const perUser = useMemo(() => {
    const acc = new Map<string, { total: number; todo: number; doing: number; approval: number }>();
    for (const m of team) acc.set(m.name, { total: 0, todo: 0, doing: 0, approval: 0 });
    for (const t of teamTasks) {
      const k = t.assignee;
      if (!acc.has(k)) continue;
      const row = acc.get(k)!;
      row.total += 1;
      const c = toDingyColumn(t.status);
      if (c === "todo") row.todo += 1;
      else if (c === "doing") row.doing += 1;
      else if (c === "approval") row.approval += 1;
    }
    return Array.from(acc.entries()).sort((a, b) => b[1].total - a[1].total);
  }, [teamTasks, team]);

  return (
    <div className="p-6 flex flex-col gap-4">
      <header className="flex items-center gap-2">
        <BarChart3 className="h-5 w-5" style={{ color: T.primary }} />
        <h2 className="text-xl font-semibold" style={{ color: T.fg }}>Relatórios</h2>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <BigStat label="TOTAL" value={totals.total} color={T.fg} />
        <BigStat label="A FAZER" value={totals.todo} color={T.fgMuted} />
        <BigStat label="ANDAMENTO" value={totals.doing} color={T.info} />
        <BigStat label="APROVAÇÃO" value={totals.approval} color={T.purple} />
        <BigStat label="ALTA PRIOR." value={totals.high} color={T.warning} />
        <BigStat label="ATRASADAS" value={totals.overdue} color={T.danger} />
      </div>

      <section
        className="rounded-xl overflow-hidden"
        style={{ background: T.panelAlt, border: `1px solid ${T.border}` }}
      >
        <header className="px-4 py-3" style={{ borderBottom: `1px solid ${T.border}` }}>
          <h3 className="text-sm font-semibold" style={{ color: T.fg }}>Produtividade por Usuário</h3>
        </header>
        {perUser.length === 0 ? (
          <p className="p-4 text-sm" style={{ color: T.fgDim }}>Sem dados.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                <Th>USUÁRIO</Th>
                <Th align="right">TOTAL</Th>
                <Th align="right">A FAZER</Th>
                <Th align="right">ANDAMENTO</Th>
                <Th align="right">APROVAÇÃO</Th>
              </tr>
            </thead>
            <tbody>
              {perUser.map(([name, row]) => (
                <tr key={name} style={{ borderBottom: `1px solid ${T.border}` }}>
                  <td className="px-4 py-3 flex items-center gap-2">
                    <span
                      className="h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-semibold"
                      style={{ background: T.primary, color: T.primaryFg }}
                    >
                      {name.slice(0, 2).toUpperCase()}
                    </span>
                    <span style={{ color: T.fg }}>{name}</span>
                  </td>
                  <Td align="right" color={T.fg}>{row.total}</Td>
                  <Td align="right" color={T.fgMuted}>{row.todo}</Td>
                  <Td align="right" color={T.info}>{row.doing}</Td>
                  <Td align="right" color={T.purple}>{row.approval}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function BigStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div
      className="rounded-xl p-4 text-center"
      style={{ background: T.panelAlt, border: `1px solid ${T.border}` }}
    >
      <p className="text-2xl font-bold" style={{ color }}>{value}</p>
      <p className="text-[10px] tracking-wider mt-1" style={{ color: T.fgDim }}>{label}</p>
    </div>
  );
}

function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th
      className="px-4 py-3 text-[10px] font-semibold tracking-wider"
      style={{ color: T.fgDim, textAlign: align }}
    >
      {children}
    </th>
  );
}

function Td({ children, align = "left", color }: { children: React.ReactNode; align?: "left" | "right"; color: string }) {
  return (
    <td className="px-4 py-3" style={{ textAlign: align, color }}>{children}</td>
  );
}

// ============================================================
// Sub-view: Projetos
// ============================================================
function ProjectsView({ clients, tasks }: { clients: any[]; tasks: any[] }) {
  const projects = useMemo(() => {
    const socialClients = clients.filter((c) =>
      Array.isArray(c.services) && c.services.some((s: string) => (s || "").toLowerCase().includes("social media"))
    );
    return socialClients.map((c) => {
      const t = tasks.filter((tk) => tk.clientId === c.id || tk.client === c.company);
      const total = t.length;
      const done = t.filter((tk) => toDingyColumn(tk.status) === "done").length;
      const open = total - done;
      return { client: c, total, done, open };
    });
  }, [clients, tasks]);

  return (
    <div className="p-6 flex flex-col gap-4">
      <header className="flex items-center gap-2">
        <FolderKanban className="h-5 w-5" style={{ color: T.primary }} />
        <h2 className="text-xl font-semibold" style={{ color: T.fg }}>Projetos</h2>
        <span className="text-sm" style={{ color: T.fgDim }}>({projects.length})</span>
      </header>

      {projects.length === 0 ? (
        <EmptyState message="Nenhum cliente de Social Media cadastrado ainda." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => {
            const pct = p.total ? Math.round((p.done / p.total) * 100) : 0;
            return (
              <article
                key={p.client.id}
                className="rounded-xl p-4"
                style={{ background: T.panelAlt, border: `1px solid ${T.border}` }}
              >
                <h3 className="font-semibold truncate" style={{ color: T.fg }} title={p.client.company}>
                  {p.client.company}
                </h3>
                <p className="text-[11px] mt-0.5" style={{ color: T.fgDim }}>
                  {p.total} tarefas · {p.open} abertas
                </p>
                <div className="mt-3 h-1.5 rounded-full overflow-hidden" style={{ background: T.card }}>
                  <div className="h-full" style={{ width: `${pct}%`, background: T.primary }} />
                </div>
                <p className="text-[10px] mt-1 text-right" style={{ color: T.fgDim }}>{pct}% concluído</p>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Sub-view: Notificações (Pedidos de ajuda)
// ============================================================
function NotificationsView({
  items,
  loading,
  onChanged,
}: {
  items: DingyHelpRequest[];
  loading: boolean;
  onChanged: () => void | Promise<void>;
}) {
  const currentUserName = useAuthStore((s) => s.currentUser?.name) || "";
  const updateTask = useAppStore((s) => s.updateTask);

  const accept = async (req: DingyHelpRequest) => {
    if (!currentUserName) return toast.error("Faça login para aceitar.");
    if (req.requester_name === currentUserName) return toast.info("Você não pode aceitar seu próprio pedido.");
    try {
      await acceptHelpRequest(req.id, currentUserName);
      updateTask(req.task_id, { assignee: currentUserName });
      toast.success(`Você assumiu a tarefa "${req.task_title}".`);
      await onChanged();
    } catch (err: any) {
      toast.error("Erro: " + (err?.message || err));
    }
  };

  const done = async (req: DingyHelpRequest) => {
    try {
      await markHelpDone(req.id);
      toast.success("Pedido marcado como resolvido.");
      await onChanged();
    } catch (err: any) {
      toast.error("Erro: " + (err?.message || err));
    }
  };

  const cancel = async (req: DingyHelpRequest) => {
    try {
      await cancelHelpRequest(req.id);
      toast.success("Pedido cancelado.");
      await onChanged();
    } catch (err: any) {
      toast.error("Erro: " + (err?.message || err));
    }
  };

  const open = items.filter((i) => i.status === "open");
  const accepted = items.filter((i) => i.status === "accepted");

  return (
    <div className="p-6 flex flex-col gap-4">
      <header className="flex items-center gap-2">
        <Bell className="h-5 w-5" style={{ color: T.primary }} />
        <h2 className="text-xl font-semibold" style={{ color: T.fg }}>Notificações</h2>
        <span className="text-sm" style={{ color: T.fgDim }}>
          ({open.length} não respondida{open.length === 1 ? "" : "s"})
        </span>
      </header>

      {loading ? (
        <EmptyState message="Carregando..." />
      ) : items.length === 0 ? (
        <EmptyState message="Sem notificações no momento." />
      ) : (
        <div className="space-y-3">
          {open.length > 0 && (
            <Section title="Pedidos abertos">
              {open.map((req) => (
                <HelpRequestCard
                  key={req.id}
                  req={req}
                  currentUserName={currentUserName}
                  isMine={req.requester_name === currentUserName}
                  onAccept={() => accept(req)}
                  onCancel={() => cancel(req)}
                  onDone={() => done(req)}
                />
              ))}
            </Section>
          )}
          {accepted.length > 0 && (
            <Section title="Em andamento (alguém já está ajudando)">
              {accepted.map((req) => (
                <HelpRequestCard
                  key={req.id}
                  req={req}
                  currentUserName={currentUserName}
                  isMine={req.requester_name === currentUserName}
                  onAccept={() => accept(req)}
                  onCancel={() => cancel(req)}
                  onDone={() => done(req)}
                />
              ))}
            </Section>
          )}
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="text-[10px] font-semibold tracking-wider uppercase" style={{ color: T.fgMuted }}>
        {title}
      </h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function HelpRequestCard({
  req,
  currentUserName,
  isMine,
  onAccept,
  onCancel,
  onDone,
}: {
  req: DingyHelpRequest;
  currentUserName: string;
  isMine: boolean;
  onAccept: () => void;
  onCancel: () => void;
  onDone: () => void;
}) {
  const when = new Date(req.created_at).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
  });
  return (
    <article
      className="rounded-xl p-4 flex items-start gap-3"
      style={{ background: T.panelAlt, border: `1px solid ${T.border}` }}
    >
      <div
        className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: T.primary, color: T.primaryFg }}
      >
        <HandHelping className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-medium" style={{ color: T.fg }}>
            {isMine ? "Você pediu ajuda" : `${req.requester_name} pediu ajuda`}
          </p>
          <span className="text-[11px] shrink-0" style={{ color: T.fgDim }}>{when}</span>
        </div>
        <p className="text-sm mt-0.5" style={{ color: T.fgMuted }}>
          Tarefa: <span style={{ color: T.fg }}>{req.task_title}</span>
          {req.task_client ? <span style={{ color: T.fgDim }}> · {req.task_client}</span> : null}
        </p>
        {req.helper_name && (
          <p className="text-xs mt-1" style={{ color: T.info }}>
            {isMine
              ? `${req.helper_name} assumiu`
              : req.helper_name === currentUserName
                ? "Você assumiu"
                : `${req.helper_name} está ajudando`}
          </p>
        )}
        <div className="flex flex-wrap gap-2 mt-3">
          {req.status === "open" && !isMine && (
            <button
              onClick={onAccept}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-semibold transition-colors"
              style={{ background: T.primary, color: T.primaryFg }}
            >
              <HandHelping className="h-3.5 w-3.5" />
              Aceitar e ajudar
            </button>
          )}
          {req.status === "open" && isMine && (
            <button
              onClick={onCancel}
              className="inline-flex items-center h-8 px-3 rounded-md text-xs"
              style={{ background: T.card, color: T.fgMuted, border: `1px solid ${T.border}` }}
            >
              Cancelar pedido
            </button>
          )}
          {req.status === "accepted" && (
            <button
              onClick={onDone}
              className="inline-flex items-center h-8 px-3 rounded-md text-xs font-semibold"
              style={{ background: T.card, color: T.fg, border: `1px solid ${T.border}` }}
            >
              Marcar como resolvido
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

// ============================================================
// Sub-view: Configurações
// ============================================================
function SettingsView() {
  return (
    <div className="p-6 flex flex-col gap-4">
      <header className="flex items-center gap-2">
        <SettingsIcon className="h-5 w-5" style={{ color: T.primary }} />
        <h2 className="text-xl font-semibold" style={{ color: T.fg }}>Configurações</h2>
      </header>

      <section
        className="rounded-xl p-4"
        style={{ background: T.panelAlt, border: `1px solid ${T.border}` }}
      >
        <h3 className="text-sm font-semibold mb-2" style={{ color: T.fg }}>Tema</h3>
        <p className="text-xs mb-3" style={{ color: T.fgDim }}>
          O módulo Dingy segue o tema preto e amarelo do JG Interno.
        </p>
        <div className="flex gap-2">
          <Swatch color={T.bg} label="Fundo" />
          <Swatch color={T.panelAlt} label="Painel" />
          <Swatch color={T.primary} label="Primária" />
          <Swatch color={T.fg} label="Texto" />
        </div>
      </section>

      <section
        className="rounded-xl p-4"
        style={{ background: T.panelAlt, border: `1px solid ${T.border}` }}
      >
        <h3 className="text-sm font-semibold mb-1" style={{ color: T.fg }}>Sobre</h3>
        <p className="text-xs" style={{ color: T.fgDim }}>
          Dingy integrado ao JG Interno — board, agenda de gravações, equipe e relatórios em um só lugar.
        </p>
      </section>
    </div>
  );
}

function Swatch({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="h-10 w-10 rounded-lg" style={{ background: color, border: `1px solid ${T.border}` }} />
      <span className="text-[10px]" style={{ color: T.fgDim }}>{label}</span>
    </div>
  );
}

// ============================================================
// Task Detail Drawer (painel lateral ao clicar num card do Board)
// ============================================================
function TaskDetailDrawer({
  task,
  team,
  currentUserName,
  onClose,
}: {
  task: any;
  team: any[];
  currentUserName: string;
  onClose: () => void;
}) {
  const updateTask = useAppStore((s) => s.updateTask);
  const [desc, setDesc] = useState<string>(task.description || "");
  const [items, setItems] = useState<DingyChecklistItem[]>([]);
  const [comments, setComments] = useState<DingyTaskComment[]>([]);
  const [newItem, setNewItem] = useState("");
  const [newComment, setNewComment] = useState("");
  const [helpSending, setHelpSending] = useState(false);

  // Reset description quando troca de task
  useEffect(() => {
    setDesc(task.description || "");
  }, [task.id]);

  // Persistência da descrição com debounce
  useEffect(() => {
    if (desc === (task.description || "")) return;
    const t = setTimeout(() => {
      updateTask(task.id, { description: desc });
    }, 600);
    return () => clearTimeout(t);
  }, [desc, task.id]);

  // Carga e realtime de checklist + comentários
  const reloadChecklist = async () => {
    try { setItems(await listChecklist(task.id)); } catch { /* noop */ }
  };
  const reloadComments = async () => {
    try { setComments(await listComments(task.id)); } catch { /* noop */ }
  };

  useEffect(() => {
    reloadChecklist();
    reloadComments();
    const ch = (supabase as any)
      .channel(`dingy-task-${task.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "dingy_task_checklist", filter: `task_id=eq.${task.id}` },
        () => reloadChecklist(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "dingy_task_comments", filter: `task_id=eq.${task.id}` },
        () => reloadComments(),
      )
      .subscribe();
    return () => {
      try { (supabase as any).removeChannel(ch); } catch { /* noop */ }
    };
  }, [task.id]);

  // Fecha com ESC
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const urgencyColor = URGENCY_COLOR[task.urgency] || T.fgMuted;
  const dingyCol = toDingyColumn(task.status);

  const addItem = async () => {
    const text = newItem.trim();
    if (!text) return;
    try {
      await addChecklistItem(task.id, text, items.length);
      setNewItem("");
    } catch (err: any) {
      toast.error("Erro ao adicionar item: " + (err?.message || err));
    }
  };
  const submitComment = async () => {
    const body = newComment.trim();
    if (!body) return;
    try {
      await addComment(task.id, currentUserName || "Anônimo", body);
      setNewComment("");
    } catch (err: any) {
      toast.error("Erro ao comentar: " + (err?.message || err));
    }
  };
  const helpWithTask = async () => {
    if (helpSending) return;
    setHelpSending(true);
    try {
      await createHelpRequest({
        taskId: task.id,
        taskTitle: task.title || "(sem título)",
        taskClient: task.client || "",
        requesterName: currentUserName || "Anônimo",
        message: "",
      });
      toast.success("Pedido de ajuda enviado para a equipe.");
    } catch (err: any) {
      toast.error("Falha ao enviar pedido: " + (err?.message || err));
    } finally {
      setHelpSending(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-40 flex justify-end"
      onClick={onClose}
      style={{ background: "rgba(0,0,0,0.55)" }}
    >
      <aside
        onClick={(e) => e.stopPropagation()}
        className="h-full w-full max-w-[540px] flex flex-col"
        style={{ background: T.bg, color: T.fg, borderLeft: `1px solid ${T.border}` }}
      >
        {/* Header */}
        <header
          className="flex items-center justify-between px-5 py-3 sticky top-0"
          style={{ background: T.bg, borderBottom: `1px solid ${T.border}` }}
        >
          <div className="flex items-center gap-2">
            <span
              className="inline-flex items-center text-[10px] font-semibold px-2 py-1 rounded uppercase"
              style={{
                background: urgencyColor + "22",
                color: urgencyColor,
                border: `1px solid ${urgencyColor}44`,
              }}
            >
              {URGENCY_LABEL[task.urgency] || task.urgency || "—"}
            </span>
            <select
              value={dingyCol}
              onChange={(e) => {
                const next = e.target.value as DingyCol;
                const newStatus = statusForDingyColumn(next, task.status);
                if (newStatus !== task.status) updateTask(task.id, { status: newStatus });
              }}
              className="h-8 px-2 rounded-md text-xs"
              style={{ background: T.card, color: T.fg, border: `1px solid ${T.border}` }}
            >
              <option value="todo">A Fazer</option>
              <option value="doing">Em Andamento</option>
              <option value="approval">Aprovação</option>
            </select>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-md flex items-center justify-center"
            style={{ color: T.fgMuted }}
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {/* Conteúdo */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Título */}
          <h2 className="text-2xl font-semibold" style={{ color: T.fg }}>{task.title}</h2>
          {task.client && (
            <p className="text-xs" style={{ color: T.fgDim }}>{task.client}</p>
          )}

          {/* Grid de metadados */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            <Field icon={<UserIcon className="h-3.5 w-3.5" />} label="Responsável">
              <select
                value={task.assignee || ""}
                onChange={(e) => updateTask(task.id, { assignee: e.target.value })}
                className="w-full h-8 px-2 rounded-md text-sm"
                style={{ background: T.card, color: T.fg, border: `1px solid ${T.border}` }}
              >
                <option value="">— sem responsável —</option>
                {team.map((m) => (
                  <option key={m.id || m.name} value={m.name}>{m.name}</option>
                ))}
              </select>
            </Field>

            <Field icon={<Flag className="h-3.5 w-3.5" />} label="Prioridade">
              <select
                value={task.urgency || "normal"}
                onChange={(e) => updateTask(task.id, { urgency: e.target.value as any })}
                className="w-full h-8 px-2 rounded-md text-sm"
                style={{ background: T.card, color: T.fg, border: `1px solid ${T.border}` }}
              >
                <option value="normal">Normal</option>
                <option value="priority">Média</option>
                <option value="urgent">Alta</option>
                <option value="critical">Crítica</option>
              </select>
            </Field>

            <Field icon={<CalIcon className="h-3.5 w-3.5" />} label="Início">
              <p className="text-sm h-8 flex items-center" style={{ color: T.fg }}>
                {task.startedAt
                  ? new Date(task.startedAt).toLocaleDateString("pt-BR")
                  : task.createdAt
                    ? new Date(task.createdAt).toLocaleDateString("pt-BR")
                    : "—"}
              </p>
            </Field>

            <Field icon={<Clock className="h-3.5 w-3.5" />} label="Prazo">
              <input
                type="date"
                value={task.deadline ? task.deadline.slice(0, 10) : ""}
                onChange={(e) => updateTask(task.id, { deadline: e.target.value })}
                className="w-full h-8 px-2 rounded-md text-sm"
                style={{ background: T.card, color: T.fg, border: `1px solid ${T.border}` }}
              />
            </Field>
          </div>

          {/* Descrição */}
          <section>
            <SectionLabel icon={<FileText className="h-3.5 w-3.5" />}>Descrição</SectionLabel>
            <textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Clique para adicionar uma descrição..."
              rows={4}
              className="w-full p-3 rounded-md text-sm resize-y"
              style={{
                background: T.card,
                color: T.fg,
                border: `1px solid ${T.border}`,
                outline: "none",
              }}
            />
          </section>

          {/* Checklist */}
          <section>
            <SectionLabel icon={<CheckSquare className="h-3.5 w-3.5" />}>
              Checklist {items.length > 0 && (
                <span style={{ color: T.fgDim }}>
                  ({items.filter((i) => i.done).length}/{items.length})
                </span>
              )}
            </SectionLabel>
            <div className="space-y-1.5">
              {items.map((it) => (
                <div
                  key={it.id}
                  className="flex items-center gap-2 group rounded-md px-2 py-1.5"
                  style={{ background: T.card, border: `1px solid ${T.border}` }}
                >
                  <input
                    type="checkbox"
                    checked={it.done}
                    onChange={(e) => toggleChecklistItem(it.id, e.target.checked).catch(() => {})}
                    className="h-4 w-4 cursor-pointer shrink-0"
                    style={{ accentColor: T.primary }}
                  />
                  <span
                    className="flex-1 text-sm break-words"
                    style={{
                      color: it.done ? T.fgDim : T.fg,
                      textDecoration: it.done ? "line-through" : "none",
                    }}
                  >
                    {it.text}
                  </span>
                  <button
                    onClick={() => deleteChecklistItem(it.id).catch(() => {})}
                    className="opacity-0 group-hover:opacity-100 h-6 w-6 flex items-center justify-center rounded transition-opacity"
                    style={{ color: T.fgDim }}
                    aria-label="Remover"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <div
                className="flex items-center gap-2 rounded-md px-2 py-1.5"
                style={{ background: T.card, border: `1px solid ${T.border}` }}
              >
                <input
                  value={newItem}
                  onChange={(e) => setNewItem(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addItem();
                    }
                  }}
                  placeholder="Adicionar item..."
                  className="flex-1 bg-transparent text-sm outline-none"
                  style={{ color: T.fg }}
                />
                <button
                  onClick={addItem}
                  className="h-7 w-7 flex items-center justify-center rounded-md text-xs font-bold"
                  style={{ background: T.primary, color: T.primaryFg }}
                  aria-label="Adicionar"
                >
                  +
                </button>
              </div>
            </div>
          </section>

          {/* Comentários */}
          <section>
            <SectionLabel icon={<MessageSquare className="h-3.5 w-3.5" />}>
              Comentários ({comments.length})
            </SectionLabel>
            <div className="space-y-2">
              {comments.map((c) => (
                <article
                  key={c.id}
                  className="rounded-md p-3"
                  style={{ background: T.card, border: `1px solid ${T.border}` }}
                >
                  <div className="flex items-baseline justify-between gap-2 mb-1">
                    <span className="text-xs font-semibold" style={{ color: T.fg }}>{c.author_name}</span>
                    <span className="text-[10px]" style={{ color: T.fgDim }}>
                      {new Date(c.created_at).toLocaleString("pt-BR", {
                        day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap" style={{ color: T.fg }}>{c.body}</p>
                </article>
              ))}
              <div
                className="flex items-center gap-2 rounded-md px-2 py-1.5"
                style={{ background: T.card, border: `1px solid ${T.border}` }}
              >
                <input
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      submitComment();
                    }
                  }}
                  placeholder="Escrever comentário..."
                  className="flex-1 bg-transparent text-sm outline-none"
                  style={{ color: T.fg }}
                />
                <button
                  onClick={submitComment}
                  className="h-7 w-7 flex items-center justify-center rounded-md"
                  style={{ background: T.primary, color: T.primaryFg }}
                  aria-label="Enviar"
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </section>
        </div>

        {/* Footer: Ajudar com esta tarefa */}
        <footer
          className="px-5 py-3 sticky bottom-0"
          style={{ background: T.bg, borderTop: `1px solid ${T.border}` }}
        >
          <button
            onClick={helpWithTask}
            disabled={helpSending}
            className="w-full inline-flex items-center justify-center gap-2 h-11 rounded-lg text-sm font-semibold transition-colors"
            style={{
              background: helpSending ? T.card : T.primary,
              color: helpSending ? T.fgMuted : T.primaryFg,
            }}
          >
            <HandHelping className="h-4 w-4" />
            {helpSending ? "Enviando..." : "Pedir ajuda com esta tarefa"}
          </button>
        </footer>
      </aside>
    </div>
  );
}

function Field({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1" style={{ color: T.fgMuted }}>
        {icon}
        <span className="text-[10px] font-semibold uppercase tracking-wider">{label}</span>
      </div>
      {children}
    </div>
  );
}

function SectionLabel({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 mb-2" style={{ color: T.fgMuted }}>
      {icon}
      <span className="text-[10px] font-semibold uppercase tracking-wider">{children}</span>
    </div>
  );
}

// ============================================================
// Empty state
// ============================================================
function EmptyState({ message }: { message: string }) {
  return (
    <div
      className="rounded-xl p-10 text-center"
      style={{ background: T.panelAlt, border: `1px dashed ${T.border}` }}
    >
      <p className="text-sm" style={{ color: T.fgDim }}>{message}</p>
    </div>
  );
}
