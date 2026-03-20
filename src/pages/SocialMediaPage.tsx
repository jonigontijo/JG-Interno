import { useState, useMemo } from "react";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import Modal from "@/components/Modal";
import { useAppStore } from "@/store/useAppStore";
import { useAuthStore } from "@/store/useAuthStore";
import { formatTime } from "@/data/mockData";
import { toast } from "sonner";
import {
  Plus, Calendar as CalendarIcon, Film, CheckCircle, AlertTriangle, FileText,
  ChevronLeft, ChevronRight, Bell, Users, BarChart3, HandHelping, Eye, Upload,
  MessageCircle, ExternalLink, X
} from "lucide-react";
import OperationTaskList from "@/components/OperationTaskList";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { cn } from "@/lib/utils";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths, startOfWeek, endOfWeek, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Task } from "@/data/mockData";

const postStatuses = ["Pauta", "Roteiro", "Gravação", "Edição", "Design", "Aprovação", "Aprovado", "Publicado"];

interface ClientPostTracking {
  clientId: string;
  clientName: string;
  totalPostsMonth: number; // contracted posts per month
  postsReady: number;
  postsAwaitingApproval: number;
  postsBeingMade: number;
  postsPublished: number;
  renewalDate: string; // day of month renewal
  responsibleDesigner: string;
  responsibleVideomaker: string;
}

interface Recording {
  id: string;
  clientId: string;
  clientName: string;
  date: string;
  time: string;
  videomaker: string;
  roteiroSent: boolean;
  roteiro: string;
  status: "scheduled" | "done" | "cancelled";
  notes: string;
}

export default function SocialMediaPage() {
  const { tasks, clients, team, addTask, startTask, completeTask, requests, logAudit } = useAppStore();
  const currentUser = useAuthStore((s) => s.currentUser);
  const allUsers = useAuthStore((s) => s.users);
  const socialTasks = tasks.filter(t => t.module === "Social Media");
  const socialClients = clients
    .filter(c => c.services.some(s => s.toLowerCase().includes("social media")))
    .sort((a, b) => a.company.localeCompare(b.company));
  const [activeTab, setActiveTab] = useState<"tasks" | "calendar">("tasks");
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [helpRequest, setHelpRequest] = useState({ clientId: "", message: "" });
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadClientId, setUploadClientId] = useState<string | null>(null);

  // Karen (Social Media Coordinator) or admin sees all; others see only their clients
  const isCoordinator = currentUser?.role === "Social Media - Coordenação" || currentUser?.isAdmin;

  // Build post tracking per client
  const clientPostTracking = useMemo(() => {
    return socialClients.map(client => {
      const clientSocialTasks = socialTasks.filter(t => t.clientId === client.id);
      const postsReady = clientSocialTasks.filter(t => t.type === "Aprovado" || t.type === "Publicado" || t.status === "done").length;
      const postsAwaitingApproval = clientSocialTasks.filter(t => t.type === "Aprovação" || t.status === "approval" || t.status === "waiting_client").length;
      const postsBeingMade = clientSocialTasks.filter(t =>
        t.status === "in_progress" || t.status === "backlog" || t.status === "pending"
      ).length;
      const postsPublished = clientSocialTasks.filter(t => t.type === "Publicado").length;
      const totalPostsMonth = client.socialMediaPosts || 12;

      // Find assigned designer/videomaker from team assignments
      const designer = client.assignedTeam?.find(a => a.role.includes("Designer"))?.memberName || "—";
      const videomaker = client.assignedTeam?.find(a => a.role.includes("Videomaker"))?.memberName || "—";

      return {
        clientId: client.id,
        clientName: client.company,
        totalPostsMonth,
        postsReady,
        postsAwaitingApproval,
        postsBeingMade,
        postsPublished,
        renewalDate: client.paymentDueDay ? `Dia ${client.paymentDueDay}` : "—",
        responsibleDesigner: designer,
        responsibleVideomaker: videomaker,
        remaining: totalPostsMonth - postsReady - postsPublished - postsBeingMade - postsAwaitingApproval,
      };
    });
  }, [socialClients, socialTasks]);

  // Urgency alerts: clients where remaining posts are low
  const urgentClients = clientPostTracking.filter(c => {
    const done = c.postsReady + c.postsPublished;
    const remaining = c.totalPostsMonth - done - c.postsBeingMade - c.postsAwaitingApproval;
    return remaining > 0 && done < c.totalPostsMonth * 0.5; // less than 50% done
  });

  // Team workload for AI distribution suggestion
  const teamWorkload = useMemo(() => {
    const designerRoles = ["Social Media - Designer"];
    const videomakerRoles = ["Social Media - Videomaker", "Social Media - Editor"];
    const socialTeam = team.filter(m =>
      designerRoles.some(r => m.roles.includes(r)) || videomakerRoles.some(r => m.roles.includes(r))
    );
    return socialTeam.map(member => {
      const memberTasks = socialTasks.filter(t => t.assignee === member.name && t.status !== "done" && t.status !== "completed");
      return { ...member, activeSocialTasks: memberTasks.length };
    }).sort((a, b) => a.activeSocialTasks - b.activeSocialTasks);
  }, [team, socialTasks]);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showRecordingModal, setShowRecordingModal] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date(2026, 2, 1)); // March 2026
  const [recordings, setRecordings] = useState<Recording[]>([
    { id: "r1", clientId: "1", clientName: "Clínica Almeida", date: "2026-03-15", time: "10:00", videomaker: "Riosh", roteiroSent: true, roteiro: "1. Abertura com apresentação\n2. Depoimento paciente\n3. Bastidores procedimento", status: "scheduled", notes: "Depoimentos + bastidores" },
    { id: "r2", clientId: "6", clientName: "Lima Tech", date: "2026-03-18", time: "14:00", videomaker: "Riosh", roteiroSent: false, roteiro: "", status: "scheduled", notes: "Vídeos para feed" },
    { id: "r3", clientId: "3", clientName: "Bella Estética", date: "2026-03-20", time: "09:00", videomaker: "", roteiroSent: false, roteiro: "", status: "scheduled", notes: "Conteúdo mensal" },
  ]);
  const [newRecording, setNewRecording] = useState({ clientId: "", date: "", time: "", videomaker: "", notes: "", roteiroSent: false, roteiro: "" });

  const businessHours = [
    "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
    "12:00", "12:30", "13:00", "13:30", "14:00", "14:30",
    "15:00", "15:30", "16:00", "16:30", "17:00", "17:30", "18:00",
  ];
  const [newTask, setNewTask] = useState({ title: "", clientId: "", assignee: "", deadline: undefined as Date | undefined, urgency: "normal" as Task["urgency"], description: "", recurUntil: "" });
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  const handleCreateTask = () => {
    if (!newTask.title || !newTask.clientId || !newTask.assignee || !newTask.deadline) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    const client = clients.find(c => c.id === newTask.clientId);
    addTask({
      id: `t-${Date.now()}`,
      title: newTask.title,
      client: client?.company || "",
      clientId: newTask.clientId,
      module: "Social Media",
      sector: "Social Media",
      type: "Tarefa",
      assignee: newTask.assignee,
      deadline: format(newTask.deadline, "yyyy-MM-dd"),
      urgency: newTask.urgency,
      status: "backlog",
      weight: 2,
      estimatedHours: 2,
      hasRework: false,
      createdAt: new Date().toISOString().slice(0, 10),
      description: newTask.description || undefined,
      recurUntil: newTask.recurUntil || undefined,
    });
    logAudit(currentUser?.name || 'Desconhecido', 'Criou tarefa', newTask.title);
    toast.success("Tarefa criada!");
    setShowTaskModal(false);
    setNewTask({ title: "", clientId: "", assignee: "", deadline: undefined, urgency: "normal", description: "", recurUntil: "" });
  };

  const handleCreateRecording = () => {
    if (!newRecording.clientId || !newRecording.date) {
      toast.error("Preencha cliente e data");
      return;
    }
    if (!newRecording.roteiro.trim()) {
      toast.error("O roteiro é obrigatório para agendar a gravação!");
      return;
    }
    if (!newRecording.roteiroSent) {
      toast.error("Confirme que o roteiro foi enviado ao cliente!");
      return;
    }
    const client = clients.find(c => c.id === newRecording.clientId);
    setRecordings(prev => [...prev, {
      id: `r-${Date.now()}`,
      clientId: newRecording.clientId,
      clientName: client?.company || "",
      date: newRecording.date,
      time: newRecording.time,
      videomaker: newRecording.videomaker,
      roteiroSent: newRecording.roteiroSent,
      roteiro: newRecording.roteiro,
      status: "scheduled",
      notes: newRecording.notes,
    }]);
    toast.success("Gravação agendada!");
    setShowRecordingModal(false);
    setNewRecording({ clientId: "", date: "", time: "", videomaker: "", notes: "", roteiroSent: false, roteiro: "" });
  };

  const getElapsedTime = (task: Task): string | null => {
    if (!task.startedAt) return null;
    if (task.completedAt && task.timeSpentMinutes !== undefined) return formatTime(task.timeSpentMinutes);
    const elapsed = Math.round((Date.now() - new Date(task.startedAt).getTime()) / 60000);
    return formatTime(elapsed);
  };

  // Calendar grid
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(calendarMonth);
    const monthEnd = endOfMonth(calendarMonth);
    const gridStart = startOfWeek(monthStart, { locale: ptBR });
    const gridEnd = endOfWeek(monthEnd, { locale: ptBR });
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [calendarMonth]);

  const getRecordingsForDay = (day: Date) => {
    const dayStr = format(day, "yyyy-MM-dd");
    return recordings.filter(r => r.date === dayStr);
  };

  const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  const tabs = [
    { key: "tasks", label: "Tarefas", icon: FileText },
    { key: "calendar", label: "Calendário de Gravações", icon: CalendarIcon },
  ];

  return (
    <div>
      <PageHeader title="Social Media" description="Planejamento, produção e publicações">
        <div className="flex gap-2">
          <button onClick={() => setShowRecordingModal(true)} className="flex items-center gap-2 px-3 py-2 rounded-md border text-sm text-muted-foreground hover:text-foreground">
            <Film className="w-4 h-4" /> Agendar Gravação
          </button>
          <button onClick={() => setShowTaskModal(true)} className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90">
            <Plus className="w-4 h-4" /> Nova Tarefa
          </button>
        </div>
      </PageHeader>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b">
        {tabs.map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            <tab.icon className="w-3.5 h-3.5" /> {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "tasks" && (
        <OperationTaskList moduleName="Social Media" tasks={socialTasks} />
      )}

      {/* Calendar Tab - Google Agenda Style */}
      {activeTab === "calendar" && (
        <div className="rounded-lg border bg-card overflow-hidden">
          {/* Calendar header */}
          <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
            <button onClick={() => setCalendarMonth(subMonths(calendarMonth, 1))} className="p-1.5 rounded-md hover:bg-muted transition-colors">
              <ChevronLeft className="w-4 h-4 text-foreground" />
            </button>
            <h2 className="text-sm font-semibold text-foreground capitalize">
              {format(calendarMonth, "MMMM yyyy", { locale: ptBR })}
            </h2>
            <button onClick={() => setCalendarMonth(addMonths(calendarMonth, 1))} className="p-1.5 rounded-md hover:bg-muted transition-colors">
              <ChevronRight className="w-4 h-4 text-foreground" />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 border-b">
            {dayNames.map(d => (
              <div key={d} className="text-center py-2 text-xs font-medium text-muted-foreground border-r last:border-r-0">
                {d}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7">
            {calendarDays.map((day, i) => {
              const dayRecordings = getRecordingsForDay(day);
              const isCurrentMonth = isSameMonth(day, calendarMonth);
              const isToday = isSameDay(day, new Date());
              const isSelected = selectedDay && isSameDay(day, selectedDay);

              return (
                <div
                  key={i}
                  onClick={() => setSelectedDay(day)}
                  className={cn(
                    "min-h-[100px] border-r border-b last:border-r-0 p-1.5 cursor-pointer transition-colors",
                    !isCurrentMonth && "bg-muted/20",
                    isSelected && "bg-primary/5",
                    "hover:bg-muted/30"
                  )}
                >
                  <div className={cn(
                    "text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full",
                    isToday && "bg-primary text-primary-foreground",
                    !isCurrentMonth && "text-muted-foreground/50",
                    isCurrentMonth && !isToday && "text-foreground"
                  )}>
                    {format(day, "d")}
                  </div>
                  <div className="space-y-0.5">
                    {dayRecordings.map(rec => (
                      <div
                        key={rec.id}
                        className={cn(
                          "text-[10px] px-1.5 py-0.5 rounded truncate",
                          rec.roteiroSent
                            ? "bg-primary/15 text-primary border-l-2 border-primary"
                            : "bg-warning/15 text-warning border-l-2 border-warning"
                        )}
                        title={`${rec.clientName} - ${rec.time || "Horário TBD"} - ${rec.videomaker || "Sem videomaker"}`}
                      >
                        {rec.time && <span className="font-mono">{rec.time}</span>} {rec.clientName}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Selected day detail */}
          {selectedDay && (
            <div className="border-t p-4 bg-muted/10">
              <h3 className="text-sm font-semibold text-foreground mb-3">
                {format(selectedDay, "EEEE, dd 'de' MMMM", { locale: ptBR })}
              </h3>
              {getRecordingsForDay(selectedDay).length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhuma gravação agendada</p>
              ) : (
                <div className="space-y-2">
                  {getRecordingsForDay(selectedDay).map(rec => (
                    <div key={rec.id} className="flex items-center justify-between p-3 rounded-md bg-card border">
                      <div>
                        <p className="text-sm font-medium text-foreground">{rec.clientName}</p>
                        <p className="text-xs text-muted-foreground">
                          🕐 {rec.time || "A definir"} · 🎬 {rec.videomaker || "Sem videomaker"}
                        </p>
                        {rec.notes && <p className="text-xs text-muted-foreground italic mt-0.5">"{rec.notes}"</p>}
                        {rec.roteiro && (
                          <details className="mt-1">
                            <summary className="text-[10px] text-primary cursor-pointer hover:underline">📝 Ver roteiro</summary>
                            <pre className="text-[10px] text-muted-foreground mt-1 whitespace-pre-wrap bg-muted/30 p-2 rounded">{rec.roteiro}</pre>
                          </details>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {rec.roteiroSent ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-success/15 text-success flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" /> Roteiro OK
                          </span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-warning/15 text-warning flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> Roteiro pendente
                          </span>
                        )}
                        {!rec.videomaker && (
                          <select
                            onChange={(e) => {
                              setRecordings(prev => prev.map(r => r.id === rec.id ? { ...r, videomaker: e.target.value } : r));
                              toast.success("Videomaker designado!");
                            }}
                            className="text-xs px-2 py-1 rounded border bg-background text-foreground"
                            defaultValue=""
                          >
                            <option value="" disabled>Designar</option>
                            {team.filter(m => m.roles.includes("Social Media - Videomaker")).map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                          </select>
                        )}
                        {!rec.roteiroSent && (
                          <button
                            onClick={() => {
                              setRecordings(prev => prev.map(r => r.id === rec.id ? { ...r, roteiroSent: true } : r));
                              toast.success("Roteiro marcado como enviado!");
                            }}
                            className="text-[10px] px-2 py-1 rounded bg-primary/20 text-primary hover:bg-primary/30"
                          >
                            ✓ Marcar roteiro
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}


      {/* Client Detail Modal */}
      {selectedClientId && (() => {
        const client = clients.find(c => c.id === selectedClientId);
        const tracking = clientPostTracking.find(c => c.clientId === selectedClientId);
        const clientTasks = socialTasks.filter(t => t.clientId === selectedClientId);
        const clientRequests = requests.filter(r => r.clientId === selectedClientId && r.department === "social_media");
        if (!client || !tracking) return null;

        const assignedMembers = client.assignedTeam || [];
        const socialMembers = assignedMembers.filter(a =>
          a.role.includes("Designer") || a.role.includes("Videomaker") || a.role.includes("Editor") || a.role.includes("Social Media")
        );

        return (
          <Modal open={!!selectedClientId} onClose={() => setSelectedClientId(null)} title={`${client.company} - Painel Social`}>
            <div className="space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Summary Cards */}
              <div className="grid grid-cols-4 gap-2">
                <div className="p-3 rounded-md border bg-success/5 text-center">
                  <p className="text-lg font-bold text-success">{tracking.postsReady}</p>
                  <p className="text-[10px] text-muted-foreground">Prontos</p>
                </div>
                <div className="p-3 rounded-md border bg-warning/5 text-center">
                  <p className="text-lg font-bold text-warning">{tracking.postsAwaitingApproval}</p>
                  <p className="text-[10px] text-muted-foreground">Aguardando</p>
                </div>
                <div className="p-3 rounded-md border bg-primary/5 text-center">
                  <p className="text-lg font-bold text-primary">{tracking.postsBeingMade}</p>
                  <p className="text-[10px] text-muted-foreground">Em Produção</p>
                </div>
                <div className="p-3 rounded-md border text-center">
                  <p className="text-lg font-bold text-foreground">{tracking.remaining}</p>
                  <p className="text-[10px] text-muted-foreground">Faltam</p>
                </div>
              </div>

              {/* Team & Workload */}
              {socialMembers.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-foreground mb-2">Equipe Designada</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {socialMembers.map(member => {
                      const memberAllTasks = tasks.filter(t => t.assignee === member.memberName && t.status !== "done" && t.status !== "completed");
                      const capacity = team.find(m => m.id === member.memberId)?.capacity || 10;
                      const loadPercent = Math.round((memberAllTasks.length / capacity) * 100);
                      return (
                        <div key={member.memberId} className="p-2 rounded-md border bg-muted/30">
                          <p className="text-xs font-medium text-foreground">{member.memberName}</p>
                          <p className="text-[10px] text-muted-foreground">{member.role} · {member.designation}</p>
                          <div className="mt-1 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${loadPercent > 80 ? "bg-destructive" : loadPercent > 50 ? "bg-warning" : "bg-success"}`}
                              style={{ width: `${Math.min(loadPercent, 100)}%` }}
                            />
                          </div>
                          <p className="text-[9px] text-muted-foreground mt-0.5">{loadPercent}% ocupado · {memberAllTasks.length} tarefas</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Active Requests */}
              {clientRequests.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-foreground mb-2">Requisições Ativas</h4>
                  <div className="space-y-1">
                    {clientRequests.map(req => (
                      <div key={req.id} className="flex items-center justify-between p-2 rounded-md border text-xs">
                        <span className="text-foreground">{req.title}</span>
                        <StatusBadge status={req.status} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tasks List */}
              <div>
                <h4 className="text-xs font-semibold text-foreground mb-2">Tarefas ({clientTasks.length})</h4>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {clientTasks.map(t => (
                    <div key={t.id} className="flex items-center justify-between p-2 rounded-md border text-xs">
                      <div>
                        <p className="text-foreground font-medium">{t.title}</p>
                        <p className="text-muted-foreground">{t.assignee} · {t.deadline}</p>
                      </div>
                      <StatusBadge status={t.status} />
                    </div>
                  ))}
                  {clientTasks.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-4">Nenhuma tarefa</p>
                  )}
                </div>
              </div>

              {/* WhatsApp action for coordinator */}
              {isCoordinator && (
                <button
                  onClick={() => {
                    const text = encodeURIComponent(
                      `Olá! Seguem os posts para aprovação de ${client.company}.\n\n` +
                      `📊 Status:\n` +
                      `✅ Prontos: ${tracking.postsReady}\n` +
                      `⏳ Aguardando aprovação: ${tracking.postsAwaitingApproval}\n` +
                      `🔄 Em produção: ${tracking.postsBeingMade}\n` +
                      `📅 Renovação: ${tracking.renewalDate}\n\n` +
                      `Por favor, revisem e nos retornem! 🙏`
                    );
                    window.open(`https://wa.me/?text=${text}`, '_blank');
                    toast.success("Abrindo WhatsApp...");
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-md bg-success/10 text-success hover:bg-success/20 transition-colors text-sm font-medium"
                >
                  <MessageCircle className="w-4 h-4" /> Enviar para aprovação via WhatsApp
                </button>
              )}
            </div>
          </Modal>
        );
      })()}

      {/* Upload Post for Approval Modal */}
      <Modal open={showUploadModal} onClose={() => { setShowUploadModal(false); setUploadClientId(null); }} title="Enviar Post para Aprovação">
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Selecione o arquivo do post para enviar para aprovação do cliente.
          </p>
          <div>
            <label className="text-xs font-medium text-foreground block mb-1.5">Cliente</label>
            <select
              value={uploadClientId || ""}
              onChange={(e) => setUploadClientId(e.target.value)}
              className="w-full px-3 py-2 rounded-md border bg-background text-sm text-foreground"
            >
              <option value="">Selecione...</option>
              {socialClients.map(c => <option key={c.id} value={c.id}>{c.company}</option>)}
            </select>
          </div>
          <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/30 transition-colors">
            <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-foreground mb-1">Arraste o arquivo ou clique para selecionar</p>
            <p className="text-[10px] text-muted-foreground">PNG, JPG, MP4 ou PDF</p>
            <input
              type="file"
              accept="image/*,video/*,.pdf"
              onChange={() => {
                toast.success("Post enviado para aprovação!");
                setShowUploadModal(false);
                setUploadClientId(null);
              }}
              className="absolute inset-0 opacity-0 cursor-pointer"
              style={{ position: "relative" }}
            />
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <button onClick={() => { setShowUploadModal(false); setUploadClientId(null); }} className="px-4 py-2 rounded-md border text-sm text-muted-foreground hover:text-foreground">Cancelar</button>
          </div>
        </div>
      </Modal>

      {/* New Task Modal */}
      <Modal open={showTaskModal} onClose={() => setShowTaskModal(false)} title="Nova Tarefa Social Media">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-foreground block mb-1.5">Título *</label>
            <input type="text" value={newTask.title} onChange={(e) => setNewTask(t => ({ ...t, title: e.target.value }))} placeholder="Ex: Design feed semanal" className="w-full px-3 py-2 rounded-md border bg-background text-sm text-foreground placeholder:text-muted-foreground" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-foreground block mb-1.5">Cliente *</label>
              <select value={newTask.clientId} onChange={(e) => setNewTask(t => ({ ...t, clientId: e.target.value }))} className="w-full px-3 py-2 rounded-md border bg-background text-sm text-foreground">
                <option value="">Selecione...</option>
                {clients.filter(c => c.services.some(s => s.toLowerCase().includes("social media"))).sort((a, b) => a.company.localeCompare(b.company)).map(c => <option key={c.id} value={c.id}>{c.company}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-foreground block mb-1.5">Responsável *</label>
              <select value={newTask.assignee} onChange={(e) => setNewTask(t => ({ ...t, assignee: e.target.value }))} className="w-full px-3 py-2 rounded-md border bg-background text-sm text-foreground">
                <option value="">Selecione...</option>
                {allUsers.filter(u => u.active).map(u => (
                  <option key={u.id} value={u.name}>
                    {u.name}{u.role ? ` (${u.role})` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-foreground block mb-1.5">Prazo *</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal text-sm", !newTask.deadline && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {newTask.deadline ? format(newTask.deadline, "dd/MM/yyyy") : "Selecionar data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={newTask.deadline}
                    onSelect={(date) => setNewTask(t => ({ ...t, deadline: date || undefined }))}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <label className="text-xs font-medium text-foreground block mb-1.5">Urgência</label>
              <select value={newTask.urgency} onChange={(e) => setNewTask(t => ({ ...t, urgency: e.target.value as Task["urgency"] }))} className="w-full px-3 py-2 rounded-md border bg-background text-sm text-foreground">
                <option value="normal">Normal</option>
                <option value="priority">Prioridade</option>
                <option value="urgent">Urgente</option>
                <option value="critical">Crítico</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-foreground block mb-1.5">Descrição</label>
            <textarea value={newTask.description} onChange={(e) => setNewTask(t => ({ ...t, description: e.target.value }))} placeholder="Descreva a tarefa..." rows={2} className="w-full px-3 py-2 rounded-md border bg-background text-sm text-foreground placeholder:text-muted-foreground resize-none" />
          </div>
          <div>
            <label className="text-xs font-medium text-foreground block mb-1.5">Recorrência até</label>
            <DatePicker value={newTask.recurUntil} onChange={(v) => setNewTask(t => ({ ...t, recurUntil: v }))} placeholder="Selecionar data" />
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <button onClick={() => setShowTaskModal(false)} className="px-4 py-2 rounded-md border text-sm text-muted-foreground hover:text-foreground">Cancelar</button>
            <button onClick={handleCreateTask} className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90">Criar</button>
          </div>
        </div>
      </Modal>

      {/* Help Request Modal */}
      <Modal open={showHelpModal} onClose={() => setShowHelpModal(false)} title="Pedir Ajuda - Redistribuição">
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">Solicite ajuda para um cliente sobrecarregado. A coordenação receberá o pedido.</p>
          <div>
            <label className="text-xs font-medium text-foreground block mb-1.5">Cliente</label>
            <select value={helpRequest.clientId} onChange={(e) => setHelpRequest(r => ({ ...r, clientId: e.target.value }))} className="w-full px-3 py-2 rounded-md border bg-background text-sm text-foreground">
              <option value="">Selecione...</option>
              {socialClients.map(c => <option key={c.id} value={c.id}>{c.company}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-foreground block mb-1.5">Mensagem</label>
            <textarea value={helpRequest.message} onChange={(e) => setHelpRequest(r => ({ ...r, message: e.target.value }))} placeholder="Descreva o motivo do pedido de ajuda..." rows={3} className="w-full px-3 py-2 rounded-md border bg-background text-sm text-foreground placeholder:text-muted-foreground resize-none" />
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <button onClick={() => setShowHelpModal(false)} className="px-4 py-2 rounded-md border text-sm text-muted-foreground hover:text-foreground">Cancelar</button>
            <button onClick={() => {
              if (!helpRequest.clientId || !helpRequest.message.trim()) {
                toast.error("Preencha todos os campos");
                return;
              }
              toast.success("Pedido de ajuda enviado para a coordenação!");
              setShowHelpModal(false);
              setHelpRequest({ clientId: "", message: "" });
            }} className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90">Enviar Pedido</button>
          </div>
        </div>
      </Modal>

      {/* Recording Modal */}
      <Modal open={showRecordingModal} onClose={() => setShowRecordingModal(false)} title="Agendar Gravação">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-foreground block mb-1.5">Cliente *</label>
            <select value={newRecording.clientId} onChange={(e) => setNewRecording(r => ({ ...r, clientId: e.target.value }))} className="w-full px-3 py-2 rounded-md border bg-background text-sm text-foreground">
              <option value="">Selecione...</option>
              {[...clients].sort((a, b) => a.company.localeCompare(b.company)).map(c => <option key={c.id} value={c.id}>{c.company}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-foreground block mb-1.5">Data *</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal text-sm", !newRecording.date && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {newRecording.date ? format(parseISO(newRecording.date), "dd/MM/yyyy") : "Selecionar data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={newRecording.date ? parseISO(newRecording.date) : undefined}
                    onSelect={(date) => setNewRecording(r => ({ ...r, date: date ? format(date, "yyyy-MM-dd") : "" }))}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <label className="text-xs font-medium text-foreground block mb-1.5">Horário</label>
              <select value={newRecording.time} onChange={(e) => setNewRecording(r => ({ ...r, time: e.target.value }))} className="w-full px-3 py-2 rounded-md border bg-background text-sm text-foreground">
                <option value="">Selecione...</option>
                {businessHours.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-foreground block mb-1.5">Videomaker</label>
            {(() => {
              const videomakerRoles = ["Social Media - Videomaker"];
              const videomakers = team.filter(m => videomakerRoles.some(r => m.roles.includes(r)));
              const selectedDate = newRecording.date;
              const getRecordingsOnDate = (name: string) => recordings.filter(r => r.date === selectedDate && r.videomaker === name && r.status !== "cancelled").length;
              const MAX_RECORDINGS_DAY = 3;
              const selectedVideomaker = newRecording.videomaker;
              const selectedCount = selectedVideomaker && selectedDate ? getRecordingsOnDate(selectedVideomaker) : 0;
              const isOverloaded = selectedCount >= MAX_RECORDINGS_DAY;

              return (
                <>
                  <select value={newRecording.videomaker} onChange={(e) => setNewRecording(r => ({ ...r, videomaker: e.target.value }))} className="w-full px-3 py-2 rounded-md border bg-background text-sm text-foreground">
                    <option value="">Selecione...</option>
                    {videomakers.map(m => {
                      const count = selectedDate ? getRecordingsOnDate(m.name) : 0;
                      return <option key={m.id} value={m.name}>{m.name} {selectedDate ? `(${count} gravação${count !== 1 ? "ões" : ""} no dia)` : ""}</option>;
                    })}
                  </select>
                  {isOverloaded && (
                    <div className="mt-2 p-2.5 rounded-md border border-warning/50 bg-warning/10 text-xs text-warning flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>
                        <strong>{selectedVideomaker}</strong> já possui {selectedCount} gravação{selectedCount !== 1 ? "ões" : ""} neste dia. 
                        A solicitação será enviada para <strong>Karen</strong> aprovar antes de confirmar o agendamento.
                      </span>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
          <div>
            <label className="text-xs font-medium text-foreground block mb-1.5">Roteiro / Script *</label>
            <textarea
              value={newRecording.roteiro}
              onChange={(e) => setNewRecording(r => ({ ...r, roteiro: e.target.value }))}
              placeholder="Cole ou escreva o roteiro aqui...&#10;Ex:&#10;1. Abertura - Apresentação&#10;2. Conteúdo principal&#10;3. CTA / Encerramento"
              rows={5}
              className="w-full px-3 py-2 rounded-md border bg-background text-sm text-foreground placeholder:text-muted-foreground resize-none"
            />
            {!newRecording.roteiro && <p className="text-[10px] text-warning mt-1">O roteiro é obrigatório para agendar a gravação</p>}
          </div>
          <div>
            <label className="text-xs font-medium text-foreground block mb-1.5">Observações</label>
            <input type="text" value={newRecording.notes} onChange={(e) => setNewRecording(r => ({ ...r, notes: e.target.value }))} placeholder="Tipo de conteúdo..." className="w-full px-3 py-2 rounded-md border bg-background text-sm text-foreground placeholder:text-muted-foreground" />
          </div>
          <div className="flex items-center gap-2 p-3 rounded-md border bg-muted/30">
            <input
              type="checkbox"
              id="roteiro-check"
              checked={newRecording.roteiroSent}
              onChange={(e) => setNewRecording(r => ({ ...r, roteiroSent: e.target.checked }))}
              className="rounded"
            />
            <label htmlFor="roteiro-check" className="text-xs text-foreground cursor-pointer flex items-center gap-1">
              <FileText className="w-3 h-3" /> Roteiro enviado ao cliente
            </label>
            {!newRecording.roteiroSent && <span className="text-[10px] text-warning ml-auto">Obrigatório para agendar</span>}
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <button onClick={() => setShowRecordingModal(false)} className="px-4 py-2 rounded-md border text-sm text-muted-foreground hover:text-foreground">Cancelar</button>
            <button onClick={handleCreateRecording} className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90">Agendar</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
