// Botão "Ativar acesso ao app" para a tela de detalhe do cliente.
// Provisiona a conta do cliente no JG App (edge `ativar-app`) e mostra a senha
// temporária gerada. Idempotente: se já ativado, mostra estado e permite reenviar.
//
// Uso: <AtivarAppButton client={{ id, name, email, jg_app_cliente_id }} onAtivado={refetch} />
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Smartphone, Check, Copy } from "lucide-react";

interface Props {
  client: { id: string; name: string; email?: string | null; jg_app_cliente_id?: string | null };
  /** Só admin provisiona. Passe profile.is_admin do usuário logado. */
  isAdmin?: boolean;
  onAtivado?: () => void;
}

export function AtivarAppButton({ client, isAdmin, onAtivado }: Props) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(client.email ?? "");
  const [loading, setLoading] = useState(false);
  const [senha, setSenha] = useState<string | null>(null);

  const jaAtivo = Boolean(client.jg_app_cliente_id);

  // Gate de UI: esconde pra não-admin. Trava real é no servidor (ativar-app exige is_admin).
  if (!isAdmin) return null;

  async function ativar() {
    if (!email.includes("@")) { toast.error("Informe um email válido"); return; }
    setLoading(true);
    setSenha(null);
    try {
      const { data, error } = await supabase.functions.invoke("ativar-app", {
        body: { client_id: client.id, email },
      });
      if (error) throw new Error(error.message);
      if (!data?.ok) throw new Error(data?.erro ?? "falha ao ativar");

      if (data.criou_login && data.senha_temporaria) {
        setSenha(data.senha_temporaria);
        toast.success("Acesso criado! Anote a senha temporária.");
      } else {
        toast.success("Cliente já tinha acesso — vínculo confirmado.");
        setOpen(false);
      }
      onAtivado?.();
    } catch (e) {
      toast.error(`Erro: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={jaAtivo ? "outline" : "default"} size="sm" className="gap-2">
          {jaAtivo ? <Check className="h-4 w-4" /> : <Smartphone className="h-4 w-4" />}
          {jaAtivo ? "App ativado" : "Ativar acesso ao app"}
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Acesso ao app — {client.name}</DialogTitle>
          <DialogDescription>
            {jaAtivo
              ? "Cliente já tem conta no app. Reenviar apenas reconfirma o vínculo."
              : "Cria o login do cliente no app e o vincula a este cadastro."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="ativar-email">Email de login do cliente</Label>
          <Input
            id="ativar-email" type="email" placeholder="cliente@empresa.com"
            value={email} onChange={(e) => setEmail(e.target.value)} disabled={loading}
          />
        </div>

        {senha && (
          <div className="rounded-md border bg-muted p-3 text-sm">
            <p className="mb-1 font-medium">Senha temporária (mostrada só agora):</p>
            <div className="flex items-center gap-2">
              <code className="rounded bg-background px-2 py-1">{senha}</code>
              <Button variant="ghost" size="icon" onClick={() => {
                navigator.clipboard.writeText(senha); toast.success("Senha copiada");
              }}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="mt-2 text-muted-foreground">Repasse ao cliente. Ele pode trocar depois no app.</p>
          </div>
        )}

        <DialogFooter>
          <Button onClick={ativar} disabled={loading}>
            {loading ? "Ativando…" : jaAtivo ? "Reconfirmar vínculo" : "Ativar acesso"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
