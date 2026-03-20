import { useMemo } from "react";
import PageHeader from "@/components/PageHeader";
import MetricCard from "@/components/MetricCard";
import { useAppStore } from "@/store/useAppStore";
import { Zap, Users, AlertTriangle, Clock, CheckCircle2, Pause, ListTodo } from "lucide-react";

export default function WorkloadPage() {
  const { team, tasks, productivity } = useAppStore();

  const enrichedTeam = useMemo(() => {
    return team.map(member => {
      const memberTasks = tasks.filter(t => t.assignee === member.name);
      const activeTasks = memberTasks.filter(t => !["done"].includes(t.status));
      const inProgress = memberTasks.filter(t => t.status === "in_progress").length;
      const pending = memberTasks.filter(t => ["pending", "backlog"].includes(t.status)).length;
      const paused = memberTasks.filter(t => t.status === "paused").length;
      const completedTotal = memberTasks.filter(t => t.status === "done").length;

      const totalEstimatedHours = activeTasks.reduce((sum, t) => sum + (t.estimatedHours || 1), 0);
      const loadPercent = member.capacity > 0 ? Math.round((totalEstimatedHours / member.capacity) * 100) : 0;

      const prod = productivity.find(p => p.userName === member.name);

      return {
        ...member,
        activeTasks: activeTasks.length,
        inProgress,
        pending,
        paused,
        completedTotal,
        totalEstimatedHours,
        loadPercent: Math.min(loadPercent, 150),
        avgPerDay: prod?.avgTasksPerDay || 0,
        isOverloaded: activeTasks.length > 8,
      };
    }).sort((a, b) => b.loadPercent - a.loadPercent);
  }, [team, tasks, productivity]);

  const overloaded = enrichedTeam.filter(m => m.loadPercent > 85 || m.isOverloaded);
  const available = enrichedTeam.filter(m => m.loadPercent < 50 && !m.isOverloaded);
  const totalActive = enrichedTeam.reduce((s, m) => s + m.activeTasks, 0);

  return (
    <div>
      <PageHeader title="Workload" description="Capacidade e carga do time em tempo real" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <MetricCard label="Colaboradores" value={enrichedTeam.length} icon={<Users className="w-4 h-4" />} />
        <MetricCard label="Tarefas ativas" value={totalActive} icon={<ListTodo className="w-4 h-4" />} />
        <MetricCard label="Sobrecarregados" value={overloaded.length} changeType={overloaded.length > 0 ? "negative" : "positive"} icon={<AlertTriangle className="w-4 h-4" />} />
        <MetricCard label="Disponíveis" value={available.length} changeType="positive" icon={<Zap className="w-4 h-4" />} />
      </div>

      {enrichedTeam.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Adicione colaboradores na aba Administração</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {enrichedTeam.map(member => (
            <div key={member.id} className={`rounded-lg border bg-card p-4 transition-colors ${member.isOverloaded ? "border-destructive/50" : ""}`}>
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${member.isOverloaded ? "bg-destructive/20 text-destructive" : "bg-primary/20 text-primary"}`}>
                  {member.avatar || member.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground truncate">{member.name}</p>
                    {member.isOverloaded && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-destructive/15 text-destructive font-medium whitespace-nowrap">
                        +8 tarefas
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{member.role}</p>
                </div>
              </div>

              {/* Load bar */}
              <div className="mb-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground">Carga ({member.totalEstimatedHours}h / {member.capacity}h)</span>
                  <span className={`text-sm font-mono font-bold ${member.loadPercent > 85 ? "text-destructive" : member.loadPercent > 70 ? "text-warning" : "text-success"}`}>
                    {member.loadPercent}%
                  </span>
                </div>
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${member.loadPercent > 85 ? "bg-destructive" : member.loadPercent > 70 ? "bg-warning" : "bg-success"}`}
                    style={{ width: `${Math.min(member.loadPercent, 100)}%` }}
                  />
                </div>
              </div>

              {/* Task breakdown */}
              <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Clock className="w-3 h-3 text-primary" />
                  <span>{member.inProgress} fazendo</span>
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <ListTodo className="w-3 h-3 text-warning" />
                  <span>{member.pending} pendentes</span>
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Pause className="w-3 h-3 text-muted-foreground" />
                  <span>{member.paused} pausadas</span>
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <CheckCircle2 className="w-3 h-3 text-success" />
                  <span>{member.completedTotal} concluídas</span>
                </div>
              </div>

              {/* Productivity & capacity */}
              <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
                <span>{member.activeTasks} tarefas ativas</span>
                <span>Média: {member.avgPerDay}/dia</span>
              </div>

              {member.specialty.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {member.specialty.map(s => (
                    <span key={s} className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">{s}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}