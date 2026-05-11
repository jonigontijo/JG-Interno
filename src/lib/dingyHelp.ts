import { supabase } from "@/integrations/supabase/client";

export interface DingyHelpRequest {
  id: string;
  task_id: string;
  task_title: string;
  task_client: string | null;
  requester_name: string;
  helper_name: string | null;
  status: "open" | "accepted" | "done" | "cancelled";
  message: string | null;
  created_at: string;
  accepted_at: string | null;
  updated_at: string;
}

export async function listHelpRequests(): Promise<DingyHelpRequest[]> {
  const { data, error } = await (supabase as any)
    .from("dingy_help_requests")
    .select("*")
    .in("status", ["open", "accepted"])
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as DingyHelpRequest[]) || [];
}

export async function createHelpRequest(input: {
  taskId: string;
  taskTitle: string;
  taskClient?: string | null;
  requesterName: string;
  message?: string;
}): Promise<void> {
  const { error } = await (supabase as any).from("dingy_help_requests").insert({
    task_id: input.taskId,
    task_title: input.taskTitle,
    task_client: input.taskClient || "",
    requester_name: input.requesterName,
    message: input.message || "",
    status: "open",
  });
  if (error) throw error;
}

export async function acceptHelpRequest(id: string, helperName: string): Promise<void> {
  const { error } = await (supabase as any)
    .from("dingy_help_requests")
    .update({
      status: "accepted",
      helper_name: helperName,
      accepted_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw error;
}

export async function markHelpDone(id: string): Promise<void> {
  const { error } = await (supabase as any)
    .from("dingy_help_requests")
    .update({ status: "done" })
    .eq("id", id);
  if (error) throw error;
}

export async function cancelHelpRequest(id: string): Promise<void> {
  const { error } = await (supabase as any)
    .from("dingy_help_requests")
    .update({ status: "cancelled" })
    .eq("id", id);
  if (error) throw error;
}
