import { useState } from "react";
import { Copy, Check, ExternalLink, FileSpreadsheet, Calendar, HardDrive, FileText } from "lucide-react";
import Modal from "@/components/Modal";
import { toast } from "sonner";

interface GoogleIntegrationSetupModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: IntegrationFormData) => void;
}

export interface IntegrationFormData {
  clientId: string;
  clientSecret: string;
  resourceUrl: string;
  resourceType: "sheets" | "drive" | "docs" | "calendar" | "other";
  label: string;
}

const RESOURCE_TYPES = [
  { value: "sheets", label: "Google Sheets", icon: FileSpreadsheet },
  { value: "drive", label: "Google Drive", icon: HardDrive },
  { value: "docs", label: "Google Docs", icon: FileText },
  { value: "calendar", label: "Google Calendar", icon: Calendar },
  { value: "other", label: "Outro", icon: ExternalLink },
] as const;

export default function GoogleIntegrationSetupModal({ open, onClose, onSave }: GoogleIntegrationSetupModalProps) {
  const callbackUrl = `${window.location.origin}/auth/callback/google`;
  const [copied, setCopied] = useState(false);
  const [form, setForm] = useState<IntegrationFormData>({
    clientId: "",
    clientSecret: "",
    resourceUrl: "",
    resourceType: "sheets",
    label: "",
  });

  const handleCopy = () => {
    navigator.clipboard.writeText(callbackUrl);
    setCopied(true);
    toast.success("URL copiada!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = () => {
    if (!form.clientId.trim()) {
      toast.error("Informe o Client ID");
      return;
    }
    if (!form.clientSecret.trim()) {
      toast.error("Informe o Client Secret");
      return;
    }
    if (!form.resourceUrl.trim()) {
      toast.error("Informe a URL do documento");
      return;
    }
    onSave(form);
    setForm({ clientId: "", clientSecret: "", resourceUrl: "", resourceType: "sheets", label: "" });
    onClose();
  };

  const handleClose = () => {
    setForm({ clientId: "", clientSecret: "", resourceUrl: "", resourceType: "sheets", label: "" });
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose} title="Adicionar Integração Google">
      <div className="space-y-5">

        {/* Step 1: Callback URL */}
        <div className="rounded-md border bg-muted/30 p-3 space-y-2">
          <div className="flex items-center gap-1.5">
            <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center shrink-0">1</span>
            <p className="text-xs font-semibold text-foreground">Configure no Google Console</p>
          </div>
          <p className="text-xs text-muted-foreground pl-6">
            No{" "}
            <a
              href="https://console.cloud.google.com/apis/credentials"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline inline-flex items-center gap-0.5"
            >
              Google Cloud Console <ExternalLink className="w-3 h-3" />
            </a>
            , crie um OAuth 2.0 Client ID e adicione a URL abaixo como "URI de redirecionamento autorizado":
          </p>
          <div className="flex items-center gap-2 pl-6">
            <code className="flex-1 text-[11px] bg-background border rounded px-2 py-1.5 font-mono text-foreground break-all">
              {callbackUrl}
            </code>
            <button
              onClick={handleCopy}
              className="shrink-0 p-1.5 rounded border hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              title="Copiar URL"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Step 2: Credentials */}
        <div className="space-y-3">
          <div className="flex items-center gap-1.5">
            <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center shrink-0">2</span>
            <p className="text-xs font-semibold text-foreground">Credenciais OAuth</p>
          </div>
          <div className="pl-6 space-y-3">
            <div>
              <label className="text-xs font-medium text-foreground block mb-1">Client ID *</label>
              <input
                type="text"
                value={form.clientId}
                onChange={(e) => setForm(f => ({ ...f, clientId: e.target.value }))}
                placeholder="Ex: 123456789-abc.apps.googleusercontent.com"
                className="w-full px-3 py-2 rounded-md border bg-background text-sm text-foreground placeholder:text-muted-foreground font-mono"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-foreground block mb-1">Client Secret *</label>
              <input
                type="password"
                value={form.clientSecret}
                onChange={(e) => setForm(f => ({ ...f, clientSecret: e.target.value }))}
                placeholder="GOCSPX-..."
                className="w-full px-3 py-2 rounded-md border bg-background text-sm text-foreground placeholder:text-muted-foreground font-mono"
              />
            </div>
          </div>
        </div>

        {/* Step 3: Resource */}
        <div className="space-y-3">
          <div className="flex items-center gap-1.5">
            <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center shrink-0">3</span>
            <p className="text-xs font-semibold text-foreground">Documento ou recurso Google</p>
          </div>
          <div className="pl-6 space-y-3">
            <div>
              <label className="text-xs font-medium text-foreground block mb-1">Tipo de recurso</label>
              <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
                {RESOURCE_TYPES.map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, resourceType: value as IntegrationFormData["resourceType"] }))}
                    className={`flex flex-col items-center gap-1 p-2 rounded-md border text-[10px] font-medium transition-colors ${
                      form.resourceType === value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:border-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-foreground block mb-1">URL do documento *</label>
              <input
                type="url"
                value={form.resourceUrl}
                onChange={(e) => setForm(f => ({ ...f, resourceUrl: e.target.value }))}
                placeholder="https://docs.google.com/spreadsheets/d/..."
                className="w-full px-3 py-2 rounded-md border bg-background text-sm text-foreground placeholder:text-muted-foreground"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Cole a URL do documento que deseja integrar (Planilha, Drive, Agenda, Docs, etc.)
              </p>
            </div>
            <div>
              <label className="text-xs font-medium text-foreground block mb-1">Nome da integração</label>
              <input
                type="text"
                value={form.label}
                onChange={(e) => setForm(f => ({ ...f, label: e.target.value }))}
                placeholder="Ex: Planilha de Clientes, Calendário de Gravações..."
                className="w-full px-3 py-2 rounded-md border bg-background text-sm text-foreground placeholder:text-muted-foreground"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-2 justify-end pt-1 border-t">
          <button
            onClick={handleClose}
            className="px-4 py-2 rounded-md border text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Salvar Integração
          </button>
        </div>
      </div>
    </Modal>
  );
}
