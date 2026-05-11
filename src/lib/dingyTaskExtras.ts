import { supabase } from "@/integrations/supabase/client";

export interface DingyChecklistItem {
  id: string;
  task_id: string;
  text: string;
  done: boolean;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface DingyTaskComment {
  id: string;
  task_id: string;
  author_name: string;
  body: string;
  created_at: string;
}

// ============================================================
// Checklist
// ============================================================
export async function listChecklist(taskId: string): Promise<DingyChecklistItem[]> {
  const { data, error } = await (supabase as any)
    .from("dingy_task_checklist")
    .select("*")
    .eq("task_id", taskId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data as DingyChecklistItem[]) || [];
}

export async function addChecklistItem(taskId: string, text: string, position: number): Promise<void> {
  const { error } = await (supabase as any)
    .from("dingy_task_checklist")
    .insert({ task_id: taskId, text, position, done: false });
  if (error) throw error;
}

export async function toggleChecklistItem(id: string, done: boolean): Promise<void> {
  const { error } = await (supabase as any)
    .from("dingy_task_checklist")
    .update({ done })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteChecklistItem(id: string): Promise<void> {
  const { error } = await (supabase as any)
    .from("dingy_task_checklist")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// ============================================================
// Comments
// ============================================================
export async function listComments(taskId: string): Promise<DingyTaskComment[]> {
  const { data, error } = await (supabase as any)
    .from("dingy_task_comments")
    .select("*")
    .eq("task_id", taskId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data as DingyTaskComment[]) || [];
}

export async function addComment(taskId: string, authorName: string, body: string): Promise<void> {
  const { error } = await (supabase as any)
    .from("dingy_task_comments")
    .insert({ task_id: taskId, author_name: authorName, body });
  if (error) throw error;
}
