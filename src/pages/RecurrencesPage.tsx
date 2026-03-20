import { useState, useCallback } from "react";
import PageHeader from "@/components/PageHeader";
import { useAppStore } from "@/store/useAppStore";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RefreshCw, Plus, Trash2, Users, CheckSquare, Pencil, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import TeamMemberSelector from "@/components/TeamMemberSelector";
import { toast } from "sonner";

const weekdays = [
  { key: "segunda", label: "Segunda-feira" },
  { key: "terca", label: "Terça-feira" },
  { key: "quarta", label: "Quarta-feira" },
  { key: "quinta", label: "Quinta-feira" },
  { key: "sexta", label: "Sexta-feira" },
  { key: "sabado", label: "Sábado" },
  { key: "domingo", label: "Domingo" },
];

const sectors = [
  "Tráfego", "Social Media", "Inside Sales", "Produção", "Comercial", "Operação", "Relatórios",
];

const frequencies = ["Diária", "Semanal", "Quinzenal", "Mensal", "2x/semana", "3x/semana", "A cada 15 dias"];

interface Recurrence {
  id: string;
  label: string;
  frequency: string;
  weekdays?: string[];
  sector: string;
  allClients: boolean;
  selectedClientIds: string[];
  clients: number;
  active: boolean;
  description?: string;
  allMembers: boolean;
  selectedMemberIds: string[];
}

const initialRecurrences: Recurrence[] = [
  { id: "1", label: "Otimização diária - Tráfego", frequency: "Diária", sector: "Tráfego", allClients: true, selectedClientIds: [], clients: 4, active: true, allMembers: true, selectedMemberIds: [] },
  { id: "2", label: "Gravação recorrente - Social", frequency: "A cada 15 dias", sector: "Social Media", allClients: false, selectedClientIds: [], clients: 3, active: true, allMembers: true, selectedMemberIds: [] },
  { id: "3", label: "Posts semanais - Social", frequency: "3x/semana", sector: "Social Media", allClients: false, selectedClientIds: [], clients: 3, active: true, allMembers: true, selectedMemberIds: [] },
  { id: "4", label: "Relatório mensal", frequency: "Mensal", sector: "Relatórios", allClients: true, selectedClientIds: [], clients: 6, active: true, allMembers: true, selectedMemberIds: [] },
  { id: "5", label: "Reunião semanal", frequency: "Semanal", sector: "Operação", allClients: true, selectedClientIds: [], clients: 2, active: false, allMembers: true, selectedMemberIds: [] },
];

const isWeeklyFrequency = (f: string) => ["Semanal", "2x/semana", "3x/semana"].includes(f);

export default function RecurrencesPage() {
  const { clients, team } = useAppStore();
  const activeClients = clients.filter(c => c.status === "Operação" && c.substatus === "Ativo");

  const [recurrences, setRecurrences] = useState<Recurrence[]>(initialRecurrences);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state (shared for add + edit)
  const [formLabel, setFormLabel] = useState("");
  const [formFrequency, setFormFrequency] = useState("");
  const [formWeekdays, setFormWeekdays] = useState<string[]>([]);
  const [formDescription, setFormDescription] = useState("");
  const [formSector, setFormSector] = useState("");
  const [formAllClients, setFormAllClients] = useState(true);
  const [formSelectedClientIds, setFormSelectedClientIds] = useState<string[]>([]);
  const [formAllMembers, setFormAllMembers] = useState(true);
  const [formSelectedMemberIds, setFormSelectedMemberIds] = useState<string[]>([]);

  const resetForm = useCallback(() => {
    setFormLabel("");
    setFormFrequency("");
    setFormWeekdays([]);
    setFormDescription("");
    setFormSector("");
    setFormAllClients(true);
    setFormSelectedClientIds([]);
    setFormAllMembers(true);
    setFormSelectedMemberIds([]);
  }, []);

  const openEdit = (r: Recurrence) => {
    setEditingId(r.id);
    setFormLabel(r.label);
    setFormFrequency(r.frequency);
    setFormWeekdays(r.weekdays || []);
    setFormDescription(r.description || "");
    setFormSector(r.sector);
    setFormAllClients(r.allClients);
    setFormSelectedClientIds(r.selectedClientIds);
    setFormAllMembers(r.allMembers);
    setFormSelectedMemberIds(r.selectedMemberIds);
  };

  const closeEdit = () => {
    setEditingId(null);
    resetForm();
  };

  const validateForm = (): boolean => {
    if (!formLabel.trim() || !formFrequency || !formSector) {
      toast.error("Preencha o nome, setor e frequência da recorrência.");
      return false;
    }
    if (isWeeklyFrequency(formFrequency) && formWeekdays.length === 0) {
      toast.error("Selecione ao menos um dia da semana.");
      return false;
    }
    if (!formAllClients && formSelectedClientIds.length === 0) {
      toast.error("Selecione ao menos um cliente.");
      return false;
    }
    if (!formAllMembers && formSelectedMemberIds.length === 0) {
      toast.error("Selecione ao menos um colaborador.");
      return false;
    }
    return true;
  };

  const buildRecurrence = (id: string): Recurrence => {
    const clientCount = formAllClients ? activeClients.length : formSelectedClientIds.length;
    return {
      id,
      label: formLabel.trim(),
      frequency: formFrequency,
      weekdays: isWeeklyFrequency(formFrequency) ? formWeekdays : undefined,
      sector: formSector,
      allClients: formAllClients,
      selectedClientIds: formAllClients ? [] : formSelectedClientIds,
      clients: clientCount,
      active: true,
      description: formDescription.trim() || undefined,
      allMembers: formAllMembers,
      selectedMemberIds: formAllMembers ? [] : formSelectedMemberIds,
    };
  };

  const handleAdd = () => {
    if (!validateForm()) return;
    setRecurrences(prev => [...prev, buildRecurrence(crypto.randomUUID())]);
    resetForm();
    toast.success("Recorrência adicionada com sucesso!");
  };

  const handleSaveEdit = () => {
    if (!editingId || !validateForm()) return;
    setRecurrences(prev => prev.map(r => r.id === editingId ? { ...buildRecurrence(editingId), active: r.active } : r));
    closeEdit();
    toast.success("Recorrência atualizada!");
  };

  const toggleActive = (id: string) => setRecurrences(prev => prev.map(r => r.id === id ? { ...r, active: !r.active } : r));
  const removeRecurrence = (id: string) => { setRecurrences(prev => prev.filter(r => r.id !== id)); toast.success("Recorrência removida."); };

  const toggleWeekday = (key: string) => setFormWeekdays(prev => prev.includes(key) ? prev.filter(d => d !== key) : [...prev, key]);
  const toggleClientSelection = (clientId: string) => setFormSelectedClientIds(prev => prev.includes(clientId) ? prev.filter(id => id !== clientId) : [...prev, clientId]);

  const getMemberNames = (ids: string[]) => ids.map(id => team.find(m => m.id === id)?.name || id).join(", ");

  // Shared form fields component
  const renderFormFields = () => (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Nome da recorrência</Label>
        <Input placeholder="Ex: Otimização diária de campanhas" value={formLabel} onChange={e => setFormLabel(e.target.value)} />
      </div>

      <div className="space-y-2">
        <Label>Setor responsável</Label>
        <Select value={formSector} onValueChange={setFormSector}>
          <SelectTrigger><SelectValue placeholder="Selecione o setor" /></SelectTrigger>
          <SelectContent>
            {sectors.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Frequência</Label>
        <Select value={formFrequency} onValueChange={setFormFrequency}>
          <SelectTrigger><SelectValue placeholder="Selecione a frequência" /></SelectTrigger>
          <SelectContent>
            {frequencies.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isWeeklyFrequency(formFrequency) && (
        <div className="space-y-2">
          <Label>Dias da semana</Label>
          <div className="grid grid-cols-2 gap-2">
            {weekdays.map(d => (
              <label
                key={d.key}
                className={`flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer transition-colors ${
                  formWeekdays.includes(d.key) ? "bg-primary/10 border-primary text-primary" : "bg-background border-border text-foreground hover:bg-muted"
                }`}
              >
                <input type="checkbox" checked={formWeekdays.includes(d.key)} onChange={() => toggleWeekday(d.key)} className="rounded" />
                <span className="text-sm">{d.label}</span>
              </label>
            ))}
          </div>
          {formFrequency === "2x/semana" && formWeekdays.length > 0 && formWeekdays.length !== 2 && (
            <p className="text-[10px] text-warning">Sugestão: selecione exatamente 2 dias para 2x/semana</p>
          )}
          {formFrequency === "3x/semana" && formWeekdays.length > 0 && formWeekdays.length !== 3 && (
            <p className="text-[10px] text-warning">Sugestão: selecione exatamente 3 dias para 3x/semana</p>
          )}
        </div>
      )}

      {/* Clientes */}
      <div className="space-y-3">
        <Label>Clientes</Label>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => { setFormAllClients(true); setFormSelectedClientIds([]); }}
            className={`flex-1 px-3 py-2 rounded-md border text-sm font-medium transition-colors ${formAllClients ? "bg-primary/10 border-primary text-primary" : "bg-background border-border text-foreground hover:bg-muted"}`}>
            <Users className="w-3.5 h-3.5 inline mr-1.5" />Todos os clientes
          </button>
          <button type="button" onClick={() => setFormAllClients(false)}
            className={`flex-1 px-3 py-2 rounded-md border text-sm font-medium transition-colors ${!formAllClients ? "bg-primary/10 border-primary text-primary" : "bg-background border-border text-foreground hover:bg-muted"}`}>
            <CheckSquare className="w-3.5 h-3.5 inline mr-1.5" />Selecionar clientes
          </button>
        </div>
        {!formAllClients && (
          <div className="border rounded-md max-h-48 overflow-y-auto">
            {activeClients.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">Nenhum cliente ativo encontrado.</p>
            ) : activeClients.map(client => (
              <label key={client.id} className="flex items-center gap-2 px-3 py-2 hover:bg-muted cursor-pointer border-b last:border-b-0 transition-colors">
                <Checkbox checked={formSelectedClientIds.includes(client.id)} onCheckedChange={() => toggleClientSelection(client.id)} />
                <span className="text-sm text-foreground">{client.company}</span>
              </label>
            ))}
            {formSelectedClientIds.length > 0 && (
              <div className="px-3 py-2 bg-muted/50 text-xs text-muted-foreground">{formSelectedClientIds.length} cliente(s) selecionado(s)</div>
            )}
          </div>
        )}
      </div>

      {/* Colaboradores */}
      <div className="space-y-3">
        <Label>Colaboradores responsáveis</Label>
        <TeamMemberSelector
          selectedIds={formSelectedMemberIds}
          onToggle={(id) => setFormSelectedMemberIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])}
          allSelected={formAllMembers}
          onToggleAll={() => { setFormAllMembers(prev => !prev); if (!formAllMembers) setFormSelectedMemberIds([]); }}
          showAllToggle
        />
      </div>

      <div className="space-y-2">
        <Label>Descrição (opcional)</Label>
        <Textarea placeholder="Descreva o que deve ser feito nessa recorrência..." value={formDescription} onChange={e => setFormDescription(e.target.value)} rows={3} />
      </div>
    </div>
  );

  return (
    <div>
      <PageHeader title="Recorrências" description="Tarefas automáticas e agendamentos recorrentes" />

      <Tabs defaultValue="list" className="mt-4">
        <TabsList>
          <TabsTrigger value="list">Recorrências ativas</TabsTrigger>
          <TabsTrigger value="add"><Plus className="w-3.5 h-3.5 mr-1" />Nova recorrência</TabsTrigger>
        </TabsList>

        <TabsContent value="list">
          <div className="grid gap-3 mt-2">
            {recurrences.map(r => (
              <div key={r.id} className="rounded-lg border bg-card p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <RefreshCw className={`w-4 h-4 ${r.active ? "text-primary" : "text-muted-foreground"}`} />
                  <div>
                    <p className="text-sm font-medium text-foreground">{r.label}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">{r.sector}</span>
                      <span className="text-xs text-muted-foreground">
                        {r.frequency}{r.weekdays?.length ? ` (${r.weekdays.map(d => weekdays.find(w => w.key === d)?.label?.slice(0, 3) || d).join(", ")})` : ""}
                      </span>
                      <span className="text-xs text-muted-foreground">·</span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {r.allClients ? "Todos os clientes" : `${r.clients} cliente(s)`}
                      </span>
                      <span className="text-xs text-muted-foreground">·</span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <UserCheck className="w-3 h-3" />
                        {r.allMembers ? "Toda a equipe" : `${r.selectedMemberIds.length} colaborador(es)`}
                      </span>
                    </div>
                    {!r.allMembers && r.selectedMemberIds.length > 0 && (
                      <p className="text-[10px] text-muted-foreground mt-0.5 truncate max-w-md">{getMemberNames(r.selectedMemberIds)}</p>
                    )}
                    {r.description && <p className="text-xs text-muted-foreground mt-1">{r.description}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => openEdit(r)}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Switch checked={r.active} onCheckedChange={() => toggleActive(r.id)} />
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => removeRecurrence(r.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
            {recurrences.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhuma recorrência cadastrada.</p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="add">
          <div className="rounded-lg border bg-card p-6 mt-2 max-w-lg">
            {renderFormFields()}
            <Button onClick={handleAdd} className="w-full mt-4">
              <Plus className="w-4 h-4 mr-1" />Adicionar recorrência
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={!!editingId} onOpenChange={(open) => { if (!open) closeEdit(); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar recorrência</DialogTitle>
          </DialogHeader>
          {renderFormFields()}
          <div className="flex gap-2 mt-4">
            <Button variant="outline" onClick={closeEdit} className="flex-1">Cancelar</Button>
            <Button onClick={handleSaveEdit} className="flex-1">Salvar alterações</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
