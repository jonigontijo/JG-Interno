import { supabase } from "@/integrations/supabase/client";
import type { Publication } from "../../supabase/functions/_shared/social-contract";

// Narrow adapter until Supabase generated types are regenerated after deployment.
export interface SocialClient {
  client_id: string;
  name: string;
  reviewed: boolean;
  remote_id: string | null;
  issue: string | null;
  last_received_at: string | null;
  reconciled_at: string | null;
  version: number;
}
export interface SocialDelivery {
  id: string;
  client_id: string;
  version: number;
  event_type: string;
  status: string;
  attempts: number;
  last_error: string | null;
  created_at: string;
}
interface UntypedQuery extends PromiseLike<{ data: unknown; error: unknown }> {
  select(columns: string): UntypedQuery;
  eq(column: string, value: string): UntypedQuery;
  order(column: string, options: { ascending: boolean }): UntypedQuery;
  limit(n: number): UntypedQuery;
  range(from: number, to: number): UntypedQuery;
}
async function allRows<T>(query: () => UntypedQuery): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0;; offset += 500) {
    const { data, error } = await query().range(offset, offset + 499);
    if (error) throw error;
    const batch = data as T[];
    rows.push(...batch);
    if (batch.length < 500) return rows;
  }
}
const tables = supabase as unknown as {
  from(name: string): UntypedQuery;
  rpc(
    name: string,
    args: Record<string, unknown>,
  ): PromiseLike<{ data: unknown; error: unknown }>;
};
export async function completeGroups(clientId: string, minutes: number) {
  const { data, error } = await tables.rpc("jg_sm_complete_groups", {
    p_client: clientId,
    p_minutes: minutes,
  });
  if (error) throw error;
  return data === true;
}
export async function socialOverview(clientId?: string) {
  return allRows<SocialClient>(() => {
    let query = tables.from("jg_sm_clients").select(
      "client_id,name,reviewed,remote_id,issue,last_received_at,reconciled_at,version",
    ).order("client_id", { ascending: true });
    if (clientId) query = query.eq("client_id", clientId);
    return query;
  });
}
export async function socialPublications(clientId: string) {
  const rows = await allRows<{ data: Publication; first_due_date: string }>(
    () =>
      tables.from("jg_sm_publications").select("data,first_due_date").eq(
        "client_id",
        clientId,
      ).order("post_id", { ascending: true }),
  );
  return rows.map((r) => ({ ...r.data, previous_due_date: r.first_due_date }));
}
export async function socialRuns() {
  const { data, error } = await tables.from("jg_sm_runs").select(
    "id,client_id,success,detail,created_at",
  ).eq("kind", "reconcile").order("created_at", { ascending: false }).limit(
    100,
  );
  if (error) throw error;
  return data as {
    id: string;
    client_id: string;
    success: boolean;
    detail: string | null;
    created_at: string;
  }[];
}
export async function socialDeliveries() {
  const { data, error } = await tables.from("jg_sm_outbox").select(
    "id,client_id,version,event_type,status,attempts,last_error,created_at",
  ).order("created_at", { ascending: false }).limit(200);
  if (error) throw error;
  return data as SocialDelivery[];
}
export async function socialAction(
  body: Record<string, unknown>,
  endpoint = "jg-social-admin",
) {
  const { data, error } = await supabase.functions.invoke(endpoint, { body });
  if (error || data?.error) {
    throw new Error(data?.error || "Não foi possível executar a ação");
  }
  return data;
}
