import { useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface AuditLog {
  id: string;
  user_name: string;
  action: string;
  entity: string;
  entity_id: string | null;
  created_at: string;
}

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (supabase as any).from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200)
      .then(({ data, error }: any) => {
        if (error) {
          console.error('Error loading audit logs:', error);
        } else {
          setLogs(data || []);
        }
        setLoading(false);
      });
  }, []);

  return (
    <div>
      <PageHeader title="Auditoria" description="Log de atividades do sistema" />
      <div className="rounded-lg border bg-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="text-xs text-muted-foreground border-b bg-muted/30">
              <th className="text-left py-3 px-4 font-medium">Data/Hora</th>
              <th className="text-left py-3 px-4 font-medium">Usuário</th>
              <th className="text-left py-3 px-4 font-medium">Ação</th>
              <th className="text-left py-3 px-4 font-medium">Entidade</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="py-8 text-center text-sm text-muted-foreground">Carregando...</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan={4} className="py-8 text-center text-sm text-muted-foreground">Nenhum registro de auditoria</td></tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                  <td className="py-3 px-4 text-xs font-mono text-muted-foreground">
                    {format(new Date(log.created_at), "yyyy-MM-dd HH:mm", { locale: ptBR })}
                  </td>
                  <td className="py-3 px-4 text-sm text-foreground">{log.user_name}</td>
                  <td className="py-3 px-4 text-sm text-muted-foreground">{log.action}</td>
                  <td className="py-3 px-4 text-sm text-foreground">{log.entity}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
