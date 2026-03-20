import { useState } from "react";
import PageHeader from "@/components/PageHeader";
import Modal from "@/components/Modal";
import { useAppStore, SettingItem } from "@/store/useAppStore";
import { toast } from "sonner";
import { Settings, Plus, Edit2, Trash2, Save, Building2, Clock, Megaphone, Target, Briefcase } from "lucide-react";

const categoryIcons: Record<string, React.ElementType> = {
  Empresa: Building2,
  SLAs: Clock,
  "Social Media": Megaphone,
  Tráfego: Target,
  Operação: Briefcase,
};

const categoryColors: Record<string, string> = {
  Empresa: "bg-primary/10 text-primary border-primary/20",
  SLAs: "bg-warning/10 text-warning border-warning/20",
  "Social Media": "bg-success/10 text-success border-success/20",
  Tráfego: "bg-info/10 text-info border-info/20",
  Operação: "bg-destructive/10 text-destructive border-destructive/20",
};

const defaultCategories = ["Empresa", "SLAs", "Social Media", "Tráfego", "Operação"];

export default function SettingsPage() {
  const { settings, updateSetting, addSetting, removeSetting } = useAppStore();
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [form, setForm] = useState({ label: "", value: "", category: "Empresa", customCategory: "" });

  const categories = [...new Set(settings.map(s => s.category))];
  // Ensure default categories show even if empty
  const allCategories = [...new Set([...defaultCategories, ...categories])];

  const handleEdit = (id: string, currentValue: string) => {
    setEditingId(id);
    setEditValue(currentValue);
  };

  const handleSaveEdit = (id: string) => {
    updateSetting(id, editValue);
    setEditingId(null);
    toast.success("Configuração atualizada!");
  };

  const handleAdd = () => {
    if (!form.label || !form.value) {
      toast.error("Preencha nome e valor");
      return;
    }
    const category = form.category === "__custom__" ? form.customCategory : form.category;
    if (!category) {
      toast.error("Selecione ou digite uma categoria");
      return;
    }
    addSetting({
      id: `s-${Date.now()}`,
      category,
      label: form.label,
      value: form.value,
      type: "text",
    });
    setShowModal(false);
    setForm({ label: "", value: "", category: "Empresa", customCategory: "" });
    toast.success("Configuração criada!");
  };

  const handleRemove = (id: string) => {
    removeSetting(id);
    toast.success("Configuração removida!");
  };

  return (
    <div>
      <PageHeader title="Configurações" description="Configurações gerais do sistema e parâmetros operacionais">
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
        >
          <Plus className="w-4 h-4" /> Nova Configuração
        </button>
      </PageHeader>

      <div className="space-y-6">
        {allCategories.map(cat => {
          const items = settings.filter(s => s.category === cat);
          if (items.length === 0) return null;
          const Icon = categoryIcons[cat] || Settings;
          const colorClass = categoryColors[cat] || "bg-muted text-muted-foreground border-border";

          return (
            <div key={cat} className="rounded-lg border bg-card overflow-hidden">
              <div className="px-4 py-3 border-b bg-muted/30 flex items-center gap-2">
                <div className={`w-7 h-7 rounded-md flex items-center justify-center border ${colorClass}`}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <h2 className="text-sm font-semibold text-foreground">{cat}</h2>
                <span className="text-[10px] text-muted-foreground ml-1">({items.length})</span>
              </div>
              <div className="divide-y divide-border/50">
                {items.map(item => (
                  <div key={item.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors group">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground">{item.label}</p>
                    </div>
                    {editingId === item.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="text-sm font-mono px-3 py-1.5 rounded-md border bg-background text-foreground w-64 focus:outline-none focus:ring-1 focus:ring-primary"
                          autoFocus
                          onKeyDown={(e) => e.key === "Enter" && handleSaveEdit(item.id)}
                        />
                        <button
                          onClick={() => handleSaveEdit(item.id)}
                          className="p-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
                        >
                          <Save className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="p-1.5 rounded-md hover:bg-muted text-muted-foreground"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className="text-sm font-mono text-muted-foreground">{item.value}</span>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleEdit(item.id, item.value)}
                            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleRemove(item.id)}
                            className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
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

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Nova Configuração">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-foreground block mb-1.5">Categoria</label>
            <select
              value={form.category}
              onChange={(e) => setForm(f => ({ ...f, category: e.target.value }))}
              className="w-full px-3 py-2 rounded-md border bg-background text-foreground text-sm"
            >
              {allCategories.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
              <option value="__custom__">+ Nova categoria</option>
            </select>
          </div>
          {form.category === "__custom__" && (
            <div>
              <label className="text-xs font-medium text-foreground block mb-1.5">Nome da categoria</label>
              <input
                value={form.customCategory}
                onChange={(e) => setForm(f => ({ ...f, customCategory: e.target.value }))}
                className="w-full px-3 py-2 rounded-md border bg-background text-foreground text-sm"
                placeholder="Ex: Marketing, RH..."
              />
            </div>
          )}
          <div>
            <label className="text-xs font-medium text-foreground block mb-1.5">Nome da configuração *</label>
            <input
              value={form.label}
              onChange={(e) => setForm(f => ({ ...f, label: e.target.value }))}
              className="w-full px-3 py-2 rounded-md border bg-background text-foreground text-sm"
              placeholder="Ex: Frequência de reuniões"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-foreground block mb-1.5">Valor *</label>
            <input
              value={form.value}
              onChange={(e) => setForm(f => ({ ...f, value: e.target.value }))}
              className="w-full px-3 py-2 rounded-md border bg-background text-foreground text-sm"
              placeholder="Ex: Semanal, 3x por semana..."
            />
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={() => setShowModal(false)} className="flex-1 py-2 rounded-md border text-sm text-foreground hover:bg-muted">
              Cancelar
            </button>
            <button onClick={handleAdd} className="flex-1 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90">
              Criar Configuração
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}