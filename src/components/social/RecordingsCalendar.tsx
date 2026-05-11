import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import { Loader2, MapPin, Plus, X, Pencil, Trash2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/store/useAuthStore";
import { useAppStore } from "@/store/useAppStore";
import { isSocialTeamMember } from "@/lib/socialTeam";

// ============================================================================
// Types & constants (portados do dingy, identidade name-based em vez de UUID)
// ============================================================================

export interface Recording {
  id: string;
  title: string;
  description: string;
  date: string;
  start_time: string;
  end_time: string | null;
  location: string;
  responsible_name: string | null;
  participants: string[];
  status: "agendado" | "em_gravacao" | "gravado" | "cancelado";
  color: string;
  client_id: string | null;
  client_name: string | null;
  roteiro: string;
  roteiro_sent: boolean;
  notes: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

const STATUS_COLORS: Record<Recording["status"], string> = {
  agendado: "#3B82F6",
  em_gravacao: "#F59E0B",
  gravado: "#FBBF24",
  cancelado: "#EF4444",
};

const STATUS_LABELS: Record<Recording["status"], string> = {
  agendado: "Agendado",
  em_gravacao: "Em Gravação",
  gravado: "Gravado",
  cancelado: "Cancelado",
};

const COLOR_PALETTE = ["#FBBF24", "#3B82F6", "#F59E0B", "#EF4444", "#A855F7", "#EC4899", "#06B6D4", "#FFFFFF"];

interface MemberLite { name: string }

// Karen (head do Social Media) tambem tem permissao admin nesta aba.
function checkDingyAdmin(user: { isAdmin?: boolean; name?: string } | null): boolean {
  if (!user) return false;
  if (user.isAdmin) return true;
  return (user.name || "").toLowerCase().includes("karen");
}

// ============================================================================
// Component principal: calendario de gravacoes para a aba Dingy
// ============================================================================

export default function RecordingsCalendar() {
  const currentUser = useAuthStore((s) => s.currentUser);
  const team = useAppStore((s) => s.team);
  const isAdmin = checkDingyAdmin(currentUser);
  const calRef = useRef<FullCalendar | null>(null);

  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<Recording> | null>(null);
  const [viewing, setViewing] = useState<Recording | null>(null);
  const [filterResponsible, setFilterResponsible] = useState("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  // Apenas membros do time de Social Media (Designer / Videomaker / Editor)
  // aparecem como Responsável e Participantes do calendário do Dingy.
  const members: MemberLite[] = useMemo(
    () =>
      team
        .filter(isSocialTeamMember)
        .map((m) => ({ name: m.name }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [team]
  );

  // Fetch inicial (paginado por seguranca, igual ao padrao do jg-interno)
  const fetchAll = useCallback(async () => {
    setLoading(true);
    const out: Recording[] = [];
    for (let from = 0; ; from += 1000) {
      const to = from + 999;
      const { data, error } = await supabase.from("recordings").select("*").order("date").range(from, to);
      if (error) {
        console.error("recordings fetch:", error);
        break;
      }
      const rows = (data || []) as Recording[];
      out.push(...rows);
      if (rows.length < 1000) break;
    }
    setRecordings(out);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Realtime: aplica INSERT/UPDATE/DELETE diretamente
  useEffect(() => {
    const suffix = Math.random().toString(36).slice(2);
    const ch = supabase
      .channel(`recordings_${suffix}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "recordings" }, (p) => {
        setRecordings((prev) => {
          const r = p.new as Recording;
          if (prev.some((x) => x.id === r.id)) return prev;
          return [...prev, r];
        });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "recordings" }, (p) => {
        setRecordings((prev) => prev.map((r) => (r.id === (p.new as Recording).id ? (p.new as Recording) : r)));
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "recordings" }, (p) => {
        const id = (p.old as { id: string }).id;
        setRecordings((prev) => prev.filter((r) => r.id !== id));
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  // Filtro de visibilidade: admin (incluindo Karen) ve tudo; outros so veem as proprias
  const visibleRecordings = useMemo(() => {
    const myName = currentUser?.name || "";
    return recordings.filter((r) => {
      if (!isAdmin) {
        const isParticipant = (r.participants || []).includes(myName);
        const isResponsible = r.responsible_name === myName;
        const isCreator = r.created_by === myName;
        if (!isParticipant && !isResponsible && !isCreator) return false;
      }
      if (filterResponsible !== "all" && r.responsible_name !== filterResponsible) return false;
      if (filterStatus !== "all" && r.status !== filterStatus) return false;
      return true;
    });
  }, [recordings, currentUser, isAdmin, filterResponsible, filterStatus]);

  const events = useMemo(
    () =>
      visibleRecordings.map((r) => ({
        id: r.id,
        title: r.title,
        start: `${r.date}T${r.start_time}`,
        end: r.end_time ? `${r.date}T${r.end_time}` : undefined,
        backgroundColor: STATUS_COLORS[r.status] || r.color,
        borderColor: "transparent",
        textColor: r.status === "cancelado" ? "#FFFFFF" : r.status === "gravado" ? "#000000" : "#FFFFFF",
        classNames: [
          r.status === "em_gravacao" ? "fc-recording-pulse" : "",
          r.status === "cancelado" ? "fc-recording-cancelled" : "",
        ].filter(Boolean),
        extendedProps: { recording: r },
      })),
    [visibleRecordings]
  );

  const upcoming = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return [...visibleRecordings]
      .filter((r) => r.date >= today && r.status !== "cancelado")
      .sort((a, b) => (a.date + a.start_time).localeCompare(b.date + b.start_time))
      .slice(0, 5);
  }, [visibleRecordings]);

  const thisWeekCount = useMemo(() => {
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay());
    const end = new Date(start);
    end.setDate(start.getDate() + 7);
    const startISO = start.toISOString().slice(0, 10);
    const endISO = end.toISOString().slice(0, 10);
    return visibleRecordings.filter((r) => r.date >= startISO && r.date < endISO).length;
  }, [visibleRecordings]);

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: "#0A0A0A", color: "#FFFFFF" }}>
      <style>{`
        .dingy-calendar .fc { --fc-border-color: #1A1A1A; --fc-today-bg-color: #111111; --fc-page-bg-color: #0A0A0A; --fc-event-border-color: transparent; color: #FFFFFF; }
        .dingy-calendar .fc .fc-toolbar-title { color: #FFFFFF; font-size: 1.25rem; font-weight: 600; text-transform: capitalize; }
        .dingy-calendar .fc .fc-col-header-cell-cushion { color: #888888; text-transform: uppercase; font-size: 11px; font-weight: 600; padding: 8px; }
        .dingy-calendar .fc .fc-daygrid-day-number, .dingy-calendar .fc .fc-timegrid-slot-label-cushion { color: #888888; font-size: 12px; }
        .dingy-calendar .fc .fc-day-today { border-top: 2px solid #FBBF24 !important; }
        .dingy-calendar .fc .fc-event { border-radius: 8px !important; padding: 2px 6px; font-size: 12px; cursor: pointer; }
        .dingy-calendar .fc .fc-button { background: #1A1A1A !important; border: 1px solid #2A2A2A !important; color: #FFFFFF !important; text-transform: capitalize; font-size: 12px; padding: 6px 12px; box-shadow: none !important; }
        .dingy-calendar .fc .fc-button:hover { background: #222222 !important; }
        .dingy-calendar .fc .fc-button-primary:not(:disabled).fc-button-active { background: #FBBF24 !important; color: #000 !important; border-color: #FBBF24 !important; }
        .fc-recording-pulse { animation: fc-pulse 1.8s ease-in-out infinite; }
        .fc-recording-cancelled { text-decoration: line-through; opacity: 0.7; }
        @keyframes fc-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.6; } }
        .dingy-calendar .fc-theme-standard td, .dingy-calendar .fc-theme-standard th, .dingy-calendar .fc-theme-standard .fc-scrollgrid { border-color: #1A1A1A; }
      `}</style>

      <div className="dingy-calendar flex flex-col lg:flex-row gap-4 p-4">
        {/* Coluna principal: calendario */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold" style={{ color: "#FFFFFF" }}>Calendário de Gravações</h2>
              <p className="text-xs" style={{ color: "#888" }}>
                {isAdmin ? "Visualização completa (admin)" : "Suas gravações"}
                {currentUser?.name === undefined ? "" : ` · ${currentUser.name}`}
              </p>
            </div>
            <button
              onClick={() =>
                setEditing({
                  date: new Date().toISOString().slice(0, 10),
                  start_time: "09:00",
                  end_time: "10:00",
                  status: "agendado",
                  color: "#FBBF24",
                  participants: [],
                })
              }
              className="inline-flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-semibold"
              style={{ background: "#FBBF24", color: "#000" }}
            >
              <Plus className="h-4 w-4" /> Nova Gravação
            </button>
          </div>

          {loading ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin" style={{ color: "#FBBF24" }} />
            </div>
          ) : (
            <FullCalendar
              ref={calRef as never}
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
              initialView="dayGridMonth"
              locale="pt-br"
              buttonText={{ today: "Hoje", month: "Mês", week: "Semana", day: "Dia" }}
              headerToolbar={{ left: "prev,next today", center: "title", right: "dayGridMonth,timeGridWeek,timeGridDay" }}
              events={events}
              height="auto"
              dateClick={(info) =>
                setEditing({
                  date: info.dateStr,
                  start_time: "09:00",
                  end_time: "10:00",
                  status: "agendado",
                  color: "#FBBF24",
                  participants: [],
                })
              }
              eventClick={(info) => {
                const rec = info.event.extendedProps.recording as Recording;
                setViewing(rec);
              }}
            />
          )}
        </div>

        {/* Painel direito: proximas + estatistica + filtros */}
        <aside
          className="lg:w-[280px] shrink-0 flex flex-col p-4 rounded-lg"
          style={{ background: "#0F0F0F", borderLeft: "1px solid #1A1A1A" }}
        >
          <h3 className="text-xs uppercase tracking-wider font-semibold mb-3" style={{ color: "#888" }}>
            Próximas gravações
          </h3>
          <div className="space-y-2 mb-6">
            {upcoming.length === 0 && <p className="text-xs" style={{ color: "#666" }}>Nenhuma agendada</p>}
            {upcoming.map((r) => (
              <button
                key={r.id}
                onClick={() => setViewing(r)}
                className="w-full text-left rounded-lg p-2 flex items-start gap-2 transition-colors"
                style={{ background: "#161616", border: "1px solid #1F1F1F" }}
              >
                <span className="h-2 w-2 rounded-full mt-1.5 shrink-0" style={{ background: STATUS_COLORS[r.status] }} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium truncate" style={{ color: "#FFFFFF" }}>{r.title}</p>
                  <p className="text-[10px]" style={{ color: "#888" }}>
                    {new Date(r.date + "T00:00:00").toLocaleDateString("pt-BR")} · {r.start_time.slice(0, 5)}
                  </p>
                </div>
              </button>
            ))}
          </div>

          <h3 className="text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: "#888" }}>
            Esta semana
          </h3>
          <p className="text-2xl font-bold mb-6" style={{ color: "#FBBF24" }}>
            {thisWeekCount} gravaç{thisWeekCount === 1 ? "ão" : "ões"}
          </p>

          <h3 className="text-xs uppercase tracking-wider font-semibold mb-3" style={{ color: "#888" }}>
            Filtros
          </h3>
          <label className="text-[10px] uppercase mb-1 block" style={{ color: "#888" }}>Responsável</label>
          <select
            value={filterResponsible}
            onChange={(e) => setFilterResponsible(e.target.value)}
            className="w-full h-9 px-3 rounded-lg text-xs mb-3"
            style={{ background: "#161616", border: "1px solid #1F1F1F", color: "#FFFFFF" }}
          >
            <option value="all">Todos</option>
            {members.map((m) => (
              <option key={m.name} value={m.name}>{m.name}</option>
            ))}
          </select>
          <label className="text-[10px] uppercase mb-1 block" style={{ color: "#888" }}>Status</label>
          <div className="flex flex-wrap gap-1">
            <Chip active={filterStatus === "all"} onClick={() => setFilterStatus("all")} color="#888">Todos</Chip>
            {(Object.keys(STATUS_COLORS) as Recording["status"][]).map((s) => (
              <Chip key={s} active={filterStatus === s} onClick={() => setFilterStatus(s)} color={STATUS_COLORS[s]}>
                {STATUS_LABELS[s]}
              </Chip>
            ))}
          </div>
        </aside>
      </div>

      {editing && (
        <RecordingEditModal
          recording={editing}
          members={members}
          currentUserName={currentUser?.name || ""}
          onClose={() => setEditing(null)}
          onSaved={(rec) => {
            setEditing(null);
            if (viewing) setViewing(rec);
          }}
        />
      )}
      {viewing && (
        <RecordingViewModal
          recording={viewing}
          members={members}
          currentUserName={currentUser?.name || ""}
          isAdmin={isAdmin}
          onClose={() => setViewing(null)}
          onEdit={() => {
            setEditing(viewing);
            setViewing(null);
          }}
          onChanged={(updated) => setViewing(updated)}
          onDeleted={() => setViewing(null)}
        />
      )}
    </div>
  );
}

// ============================================================================
// Chip helper (filtros de status)
// ============================================================================

function Chip({
  active,
  onClick,
  color,
  children,
}: {
  active: boolean;
  onClick: () => void;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="text-[10px] font-medium px-2 py-1 rounded-md border transition-colors"
      style={{
        background: active ? `${color}20` : "transparent",
        borderColor: active ? `${color}80` : "#2A2A2A",
        color: active ? color : "#888",
      }}
    >
      {children}
    </button>
  );
}

// ============================================================================
// Edit/Create modal
// ============================================================================

function RecordingEditModal({
  recording,
  members,
  currentUserName,
  onClose,
  onSaved,
}: {
  recording: Partial<Recording>;
  members: MemberLite[];
  currentUserName: string;
  onClose: () => void;
  onSaved: (rec: Recording) => void;
}) {
  const [form, setForm] = useState<Partial<Recording>>({
    title: "",
    description: "",
    date: "",
    start_time: "09:00",
    end_time: "10:00",
    location: "",
    responsible_name: null,
    participants: [],
    status: "agendado",
    color: "#FBBF24",
    ...recording,
  });
  const [saving, setSaving] = useState(false);
  const isEdit = !!recording.id;

  const save = async () => {
    if (!form.title || !form.date || !form.start_time) {
      toast.error("Título, data e horário são obrigatórios");
      return;
    }
    setSaving(true);
    const payload = {
      title: form.title,
      description: form.description || "",
      date: form.date,
      start_time: form.start_time,
      end_time: form.end_time || null,
      location: form.location || "",
      responsible_name: form.responsible_name || null,
      participants: form.participants || [],
      status: form.status || "agendado",
      color: form.color || "#FBBF24",
      notes: form.notes || "",
      roteiro: form.roteiro || "",
      roteiro_sent: !!form.roteiro_sent,
      client_id: form.client_id || null,
      client_name: form.client_name || null,
    };
    if (isEdit && recording.id) {
      const { data, error } = await supabase.from("recordings").update(payload).eq("id", recording.id).select().single();
      setSaving(false);
      if (error) {
        console.error("recording update:", error);
        toast.error("Falha ao salvar");
        return;
      }
      toast.success("Gravação atualizada");
      onSaved(data as Recording);
    } else {
      const { data, error } = await supabase
        .from("recordings")
        .insert({ ...payload, created_by: currentUserName || "Sistema" })
        .select()
        .single();
      setSaving(false);
      if (error) {
        console.error("recording insert:", error);
        toast.error("Falha ao criar");
        return;
      }
      toast.success("Gravação criada");
      onSaved(data as Recording);
    }
  };

  const toggleParticipant = (name: string) => {
    setForm((f) => {
      const list = f.participants || [];
      return { ...f, participants: list.includes(name) ? list.filter((x) => x !== name) : [...list, name] };
    });
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60]" onClick={onClose} />
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 pointer-events-none">
        <div
          className="rounded-xl max-w-lg w-full pointer-events-auto max-h-[90vh] overflow-y-auto"
          style={{ background: "#0F0F0F", border: "1px solid #1F1F1F", color: "#FFFFFF" }}
        >
          <div className="flex items-center justify-between p-5" style={{ borderBottom: "1px solid #1F1F1F" }}>
            <h3 className="text-base font-semibold">{isEdit ? "Editar Gravação" : "Nova Gravação"}</h3>
            <button onClick={onClose} style={{ color: "#888" }}>
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="p-5 space-y-4">
            <Field label="Título *">
              <DingyInput value={form.title || ""} onChange={(v) => setForm({ ...form, title: v })} />
            </Field>
            <Field label="Descrição">
              <DingyTextarea value={form.description || ""} onChange={(v) => setForm({ ...form, description: v })} rows={3} />
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Data *">
                <DingyInput type="date" value={form.date || ""} onChange={(v) => setForm({ ...form, date: v })} />
              </Field>
              <Field label="Início *">
                <DingyInput type="time" value={form.start_time || ""} onChange={(v) => setForm({ ...form, start_time: v })} />
              </Field>
              <Field label="Fim">
                <DingyInput type="time" value={form.end_time || ""} onChange={(v) => setForm({ ...form, end_time: v })} />
              </Field>
            </div>
            <Field label="Local">
              <DingyInput
                value={form.location || ""}
                onChange={(v) => setForm({ ...form, location: v })}
                placeholder="Estúdio A, Externo, Online..."
              />
            </Field>
            <Field label="Responsável">
              <DingySelect
                value={form.responsible_name || ""}
                onChange={(v) => setForm({ ...form, responsible_name: v || null })}
              >
                <option value="">—</option>
                {members.map((m) => (
                  <option key={m.name} value={m.name}>{m.name}</option>
                ))}
              </DingySelect>
            </Field>
            <Field label="Participantes">
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                {members.map((m) => {
                  const sel = (form.participants || []).includes(m.name);
                  return (
                    <button
                      key={m.name}
                      onClick={() => toggleParticipant(m.name)}
                      className="text-[11px] px-2 py-1 rounded-md border transition-colors"
                      style={{
                        background: sel ? "#FBBF2420" : "transparent",
                        borderColor: sel ? "#FBBF2480" : "#2A2A2A",
                        color: sel ? "#FBBF24" : "#FFF",
                      }}
                    >
                      {m.name}
                    </button>
                  );
                })}
              </div>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Cor">
                <div className="flex gap-1.5 flex-wrap">
                  {COLOR_PALETTE.map((c) => (
                    <button
                      key={c}
                      onClick={() => setForm({ ...form, color: c })}
                      className="h-7 w-7 rounded-md"
                      style={{
                        background: c,
                        border: `2px solid ${form.color === c ? "#FFFFFF" : "transparent"}`,
                      }}
                    />
                  ))}
                </div>
              </Field>
              <Field label="Status">
                <DingySelect
                  value={form.status || "agendado"}
                  onChange={(v) => setForm({ ...form, status: v as Recording["status"] })}
                >
                  {(Object.keys(STATUS_LABELS) as Recording["status"][]).map((s) => (
                    <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                  ))}
                </DingySelect>
              </Field>
            </div>
          </div>
          <div className="flex gap-2 p-5" style={{ borderTop: "1px solid #1F1F1F" }}>
            <button
              onClick={onClose}
              className="flex-1 h-9 rounded-lg text-sm font-medium"
              style={{ border: "1px solid #2A2A2A", color: "#888" }}
            >
              Cancelar
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="flex-1 h-9 rounded-lg text-sm font-semibold disabled:opacity-60"
              style={{ background: "#FBBF24", color: "#000" }}
            >
              {saving ? "Salvando..." : "Salvar Gravação"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ============================================================================
// View modal (visualizar / mudar status / excluir)
// ============================================================================

function RecordingViewModal({
  recording,
  members,
  currentUserName,
  isAdmin,
  onClose,
  onEdit,
  onChanged,
  onDeleted,
}: {
  recording: Recording;
  members: MemberLite[];
  currentUserName: string;
  isAdmin: boolean;
  onClose: () => void;
  onEdit: () => void;
  onChanged: (r: Recording) => void;
  onDeleted: () => void;
}) {
  const responsible = members.find((m) => m.name === recording.responsible_name);
  const participantMembers = (recording.participants || [])
    .map((name) => members.find((m) => m.name === name))
    .filter(Boolean) as MemberLite[];
  const canEdit = isAdmin || recording.created_by === currentUserName;
  const dateStr = new Date(recording.date + "T00:00:00").toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const timeStr = `${recording.start_time.slice(0, 5)}${recording.end_time ? ` às ${recording.end_time.slice(0, 5)}` : ""}`;

  const updateStatus = async (status: Recording["status"]) => {
    const { data, error } = await supabase
      .from("recordings")
      .update({ status })
      .eq("id", recording.id)
      .select()
      .single();
    if (error) {
      console.error("recording status update:", error);
      toast.error("Falha ao atualizar");
      return;
    }
    toast.success("Status atualizado");
    onChanged(data as Recording);
  };

  const remove = async () => {
    if (!confirm(`Excluir gravação "${recording.title}"?`)) return;
    const { error } = await supabase.from("recordings").delete().eq("id", recording.id);
    if (error) {
      console.error("recording delete:", error);
      toast.error("Falha ao excluir");
      return;
    }
    toast.success("Gravação excluída");
    onDeleted();
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60]" onClick={onClose} />
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 pointer-events-none">
        <div
          className="rounded-xl max-w-lg w-full pointer-events-auto"
          style={{ background: "#0F0F0F", border: "1px solid #1F1F1F", color: "#FFFFFF" }}
        >
          <div className="flex items-start justify-between p-5" style={{ borderBottom: "1px solid #1F1F1F" }}>
            <div className="min-w-0">
              <h3 className="text-lg font-semibold">{recording.title}</h3>
              <span
                className="inline-flex items-center gap-1.5 mt-1 text-[10px] font-bold uppercase tracking-wider rounded px-2 py-0.5"
                style={{
                  background: `${STATUS_COLORS[recording.status]}20`,
                  color: STATUS_COLORS[recording.status],
                }}
              >
                {STATUS_LABELS[recording.status]}
              </span>
            </div>
            <button onClick={onClose} style={{ color: "#888" }}>
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="p-5 space-y-4 text-sm">
            <p className="capitalize" style={{ color: "#888" }}>
              {dateStr} — {timeStr}
            </p>
            {recording.location && (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4" style={{ color: "#888" }} /> {recording.location}
              </div>
            )}
            {responsible && (
              <div>
                <p className="text-[10px] uppercase font-semibold mb-1" style={{ color: "#888" }}>
                  Responsável
                </p>
                <p>{responsible.name}</p>
              </div>
            )}
            {participantMembers.length > 0 && (
              <div>
                <p className="text-[10px] uppercase font-semibold mb-2" style={{ color: "#888" }}>
                  Participantes
                </p>
                <div className="flex -space-x-2">
                  {participantMembers.map((m) => (
                    <div
                      key={m.name}
                      title={m.name}
                      className="h-7 w-7 rounded-full flex items-center justify-center"
                      style={{ background: "#FBBF24", border: "2px solid #0F0F0F" }}
                    >
                      <span className="text-[9px] font-bold" style={{ color: "#000" }}>
                        {m.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .toUpperCase()
                          .slice(0, 2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {recording.description && (
              <div>
                <p className="text-[10px] uppercase font-semibold mb-1" style={{ color: "#888" }}>
                  Descrição
                </p>
                <p className="whitespace-pre-wrap">{recording.description}</p>
              </div>
            )}
            {recording.client_name && (
              <div>
                <p className="text-[10px] uppercase font-semibold mb-1" style={{ color: "#888" }}>
                  Cliente
                </p>
                <p>{recording.client_name}</p>
              </div>
            )}
            {recording.roteiro && (
              <div>
                <p className="text-[10px] uppercase font-semibold mb-1" style={{ color: "#888" }}>
                  Roteiro {recording.roteiro_sent ? "(enviado ao cliente)" : "(não enviado)"}
                </p>
                <p className="whitespace-pre-wrap">{recording.roteiro}</p>
              </div>
            )}
            {recording.notes && (
              <div>
                <p className="text-[10px] uppercase font-semibold mb-1" style={{ color: "#888" }}>
                  Notas
                </p>
                <p className="whitespace-pre-wrap">{recording.notes}</p>
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2 p-5" style={{ borderTop: "1px solid #1F1F1F" }}>
            {canEdit && (
              <button
                onClick={onEdit}
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-semibold"
                style={{ border: "1px solid #2A2A2A", color: "#FFF" }}
              >
                <Pencil className="h-3 w-3" /> Editar
              </button>
            )}
            {canEdit && (recording.status === "agendado" || recording.status === "em_gravacao") && (
              <button
                onClick={() => updateStatus("gravado")}
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-semibold"
                style={{ background: "#FBBF24", color: "#000" }}
              >
                <CheckCircle2 className="h-3 w-3" /> Marcar como Gravado
              </button>
            )}
            {canEdit && recording.status !== "cancelado" && (
              <button
                onClick={() => {
                  if (confirm("Cancelar gravação?")) updateStatus("cancelado");
                }}
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-semibold"
                style={{ border: "1px solid #EF444440", color: "#EF4444" }}
              >
                Cancelar gravação
              </button>
            )}
            {canEdit && (
              <button
                onClick={remove}
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-semibold ml-auto"
                style={{ background: "#EF44441A", color: "#EF4444" }}
              >
                <Trash2 className="h-3 w-3" /> Excluir
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ============================================================================
// Reusable form helpers (estilo dingy, isolados dos design tokens do jg-interno)
// ============================================================================

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-wider font-semibold mb-1 block" style={{ color: "#888" }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function DingyInput({
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
      style={{ background: "#161616", border: "1px solid #1F1F1F", color: "#FFFFFF" }}
    />
  );
}

function DingyTextarea({
  value,
  onChange,
  rows = 3,
}: {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={rows}
      className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none resize-none"
      style={{ background: "#161616", border: "1px solid #1F1F1F", color: "#FFFFFF" }}
    />
  );
}

function DingySelect({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full h-9 px-3 rounded-lg text-sm focus:outline-none"
      style={{ background: "#161616", border: "1px solid #1F1F1F", color: "#FFFFFF" }}
    >
      {children}
    </select>
  );
}
