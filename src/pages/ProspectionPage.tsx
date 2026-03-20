import { useState } from "react";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import { useAppStore } from "@/store/useAppStore";
import { formatCurrency } from "@/data/mockData";
import Modal from "@/components/Modal";
import { toast } from "sonner";
import { Plus, Calendar, Edit2, Save, X } from "lucide-react";
import type { Lead } from "@/data/mockData";
import { DatePicker } from "@/components/ui/date-picker";

const stages = [
  { key: "meeting_scheduled", label: "Reunião Agendada" },
  { key: "meeting_done", label: "Reunião Realizada" },
  { key: "proposal_sent", label: "Proposta Enviada" },
  { key: "negotiation", label: "Negociação" },
  { key: "closed", label: "Fechado" },
  { key: "lost", label: "Perdido" },
];

const allServices = ["Tráfego", "Social Media", "Inside Sales", "Landing Page", "Site Institucional", "Branding", "SEO"];

export default function ProspectionPage() {
  const { leads, addLead, updateLead } = useAppStore();
  const [showModal, setShowModal] = useState(false);
  const [editingLead, setEditingLead] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<Lead>>({});
  const [newLead, setNewLead] = useState({ name: "", company: "", responsible: "", meetingDate: "", origin: "Indicação", potentialValue: "", services: [] as string[] });

  const handleCreate = () => {
    if (!newLead.name || !newLead.company || !newLead.responsible) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }
    const lead: Lead = {
      id: `l-${Date.now()}`,
      name: newLead.name,
      company: newLead.company,
      responsible: newLead.responsible,
      meetingDate: newLead.meetingDate,
      origin: newLead.origin,
      stage: "meeting_scheduled",
      potentialValue: Number(newLead.potentialValue) || 0,
      nextFollowUp: newLead.meetingDate,
      notes: "",
      services: newLead.services,
    };
    addLead(lead);
    toast.success("Lead criado!");
    setShowModal(false);
    setNewLead({ name: "", company: "", responsible: "", meetingDate: "", origin: "Indicação", potentialValue: "", services: [] });
  };

  const handleStageChange = (leadId: string, stage: string) => {
    updateLead(leadId, { stage });
    toast.success("Estágio atualizado");
  };

  const startEditing = (lead: Lead) => {
    setEditingLead(lead.id);
    setEditData({ potentialValue: lead.potentialValue, services: lead.services || [], discount: lead.discount || 0, finalValue: lead.finalValue || lead.potentialValue, notes: lead.notes });
  };

  const saveEdit = (leadId: string) => {
    updateLead(leadId, editData);
    setEditingLead(null);
    toast.success("Dados atualizados!");
  };

  const toggleService = (service: string, current: string[]) => {
    return current.includes(service) ? current.filter(s => s !== service) : [...current, service];
  };

  return (
    <div>
      <PageHeader title="Prospecção" description="Pipeline comercial">
        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90">
          <Plus className="w-4 h-4" /> Novo Lead
        </button>
      </PageHeader>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {stages.map(stage => {
          const stageLeads = leads.filter(l => l.stage === stage.key);
          return (
            <div key={stage.key} className="kanban-column flex-shrink-0">
              <div className="flex items-center justify-between mb-3">
                <StatusBadge status={stage.key} />
                <span className="text-xs font-mono text-muted-foreground">{stageLeads.length}</span>
              </div>
              <div className="space-y-2 min-h-[100px]">
                {stageLeads.map(lead => (
                  <div key={lead.id} className="kanban-card group">
                    {editingLead === lead.id ? (
                      <div className="space-y-2">
                        <div>
                          <label className="text-[10px] text-muted-foreground">Valor (R$)</label>
                          <input type="number" value={editData.potentialValue || ""} onChange={(e) => setEditData(d => ({ ...d, potentialValue: Number(e.target.value) }))} className="w-full px-2 py-1 rounded border bg-background text-xs text-foreground" />
                        </div>
                        <div>
                          <label className="text-[10px] text-muted-foreground">Desconto (R$)</label>
                          <input type="number" value={editData.discount || ""} onChange={(e) => setEditData(d => ({ ...d, discount: Number(e.target.value), finalValue: (d.potentialValue || 0) - Number(e.target.value) }))} className="w-full px-2 py-1 rounded border bg-background text-xs text-foreground" />
                        </div>
                        {editData.discount ? (
                          <p className="text-[10px] text-success font-mono">Final: {formatCurrency((editData.potentialValue || 0) - (editData.discount || 0))}</p>
                        ) : null}
                        <div>
                          <label className="text-[10px] text-muted-foreground">Serviços</label>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {allServices.map(s => (
                              <button key={s} onClick={() => setEditData(d => ({ ...d, services: toggleService(s, d.services || []) }))}
                                className={`text-[9px] px-1.5 py-0.5 rounded ${(editData.services || []).includes(s) ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
                                {s}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label className="text-[10px] text-muted-foreground">Observações</label>
                          <textarea value={editData.notes || ""} onChange={(e) => setEditData(d => ({ ...d, notes: e.target.value }))} className="w-full px-2 py-1 rounded border bg-background text-xs text-foreground h-16 resize-none" />
                        </div>
                        <div className="flex gap-1">
                          <button onClick={() => saveEdit(lead.id)} className="text-[9px] px-2 py-0.5 rounded bg-success/20 text-success hover:bg-success/30 flex items-center gap-0.5"><Save className="w-2.5 h-2.5" /> Salvar</button>
                          <button onClick={() => setEditingLead(null)} className="text-[9px] px-2 py-0.5 rounded bg-muted text-muted-foreground"><X className="w-2.5 h-2.5" /></button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-start justify-between">
                          <h3 className="text-sm font-medium text-foreground mb-1">{lead.company}</h3>
                          <button onClick={() => startEditing(lead)} className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-muted transition-all">
                            <Edit2 className="w-3 h-3 text-muted-foreground" />
                          </button>
                        </div>
                        <p className="text-xs text-muted-foreground mb-2">{lead.name}</p>
                        {lead.services && lead.services.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-2">
                            {lead.services.map(s => (
                              <span key={s} className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">{s}</span>
                            ))}
                          </div>
                        )}
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-2">
                          <Calendar className="w-3 h-3" />
                          {lead.meetingDate}
                        </div>
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-xs font-mono text-primary">{formatCurrency(lead.potentialValue)}</span>
                            {lead.discount ? <span className="text-[9px] text-success ml-1">(-{formatCurrency(lead.discount)})</span> : null}
                          </div>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{lead.origin}</span>
                        </div>
                        {lead.notes && <p className="text-[10px] text-muted-foreground mt-2 line-clamp-2">{lead.notes}</p>}
                        <div className="hidden group-hover:flex gap-1 mt-2 flex-wrap">
                          {stage.key !== "closed" && (
                            <button onClick={() => handleStageChange(lead.id, "closed")} className="text-[9px] px-1.5 py-0.5 rounded bg-success/20 text-success hover:bg-success/30 transition-colors">✓ Fechar</button>
                          )}
                          {stage.key === "meeting_scheduled" && (
                            <button onClick={() => handleStageChange(lead.id, "meeting_done")} className="text-[9px] px-1.5 py-0.5 rounded bg-primary/20 text-primary hover:bg-primary/30 transition-colors">Realizada</button>
                          )}
                          {stage.key === "meeting_done" && (
                            <button onClick={() => handleStageChange(lead.id, "proposal_sent")} className="text-[9px] px-1.5 py-0.5 rounded bg-primary/20 text-primary hover:bg-primary/30 transition-colors">Proposta</button>
                          )}
                          {stage.key !== "lost" && (
                            <button onClick={() => handleStageChange(lead.id, "lost")} className="text-[9px] px-1.5 py-0.5 rounded bg-destructive/20 text-destructive hover:bg-destructive/30 transition-colors">✗ Perdido</button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Novo Lead">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-foreground block mb-1.5">Nome *</label>
              <input type="text" value={newLead.name} onChange={(e) => setNewLead(l => ({ ...l, name: e.target.value }))} placeholder="Nome do contato" className="w-full px-3 py-2 rounded-md border bg-background text-sm text-foreground placeholder:text-muted-foreground" />
            </div>
            <div>
              <label className="text-xs font-medium text-foreground block mb-1.5">Empresa *</label>
              <input type="text" value={newLead.company} onChange={(e) => setNewLead(l => ({ ...l, company: e.target.value }))} placeholder="Empresa" className="w-full px-3 py-2 rounded-md border bg-background text-sm text-foreground placeholder:text-muted-foreground" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-foreground block mb-1.5">Responsável *</label>
              <input type="text" value={newLead.responsible} onChange={(e) => setNewLead(l => ({ ...l, responsible: e.target.value }))} placeholder="Comercial" className="w-full px-3 py-2 rounded-md border bg-background text-sm text-foreground placeholder:text-muted-foreground" />
            </div>
            <div>
              <label className="text-xs font-medium text-foreground block mb-1.5">Data da reunião</label>
              <DatePicker value={newLead.meetingDate} onChange={(v) => setNewLead(l => ({ ...l, meetingDate: v }))} placeholder="Data da reunião" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-foreground block mb-1.5">Origem</label>
              <select value={newLead.origin} onChange={(e) => setNewLead(l => ({ ...l, origin: e.target.value }))} className="w-full px-3 py-2 rounded-md border bg-background text-sm text-foreground">
                {["Indicação", "Instagram", "Google", "Site", "LinkedIn", "Outro"].map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-foreground block mb-1.5">Valor potencial (R$)</label>
              <input type="number" value={newLead.potentialValue} onChange={(e) => setNewLead(l => ({ ...l, potentialValue: e.target.value }))} placeholder="5000" className="w-full px-3 py-2 rounded-md border bg-background text-sm text-foreground placeholder:text-muted-foreground" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-foreground block mb-1.5">Serviços</label>
            <div className="flex flex-wrap gap-2">
              {allServices.map(s => (
                <button key={s} type="button" onClick={() => setNewLead(l => ({ ...l, services: toggleService(s, l.services) }))}
                  className={`text-xs px-2.5 py-1 rounded-full transition-colors ${newLead.services.includes(s) ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <button onClick={() => setShowModal(false)} className="px-4 py-2 rounded-md border text-sm text-muted-foreground hover:text-foreground transition-colors">Cancelar</button>
            <button onClick={handleCreate} className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">Criar Lead</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
