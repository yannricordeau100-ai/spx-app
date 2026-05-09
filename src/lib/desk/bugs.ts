/**
 * bugs.ts — wrappers Supabase pour le module bug tracker desk.
 */
import { createClient } from "@supabase/supabase-js";

export type BugStatus = "open" | "in_progress" | "fixed" | "wont_fix" | "duplicate";

export type DeskBug = {
  id: string;
  title: string;
  description: string | null;
  severity: number;
  repair_difficulty: number;
  status: BugStatus;
  tags: string | null;
  area: string | null;
  repro_url: string | null;
  reported_by_conv: string | null;
  resolution_note: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
};

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase service role keys missing");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function listBugs(): Promise<DeskBug[]> {
  const { data, error } = await adminClient()
    .from("desk_bugs")
    .select("*")
    .order("status")
    .order("severity", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as DeskBug[];
}

export async function upsertBug(bug: Partial<DeskBug>): Promise<DeskBug> {
  const { data, error } = await adminClient()
    .from("desk_bugs")
    .upsert(bug, { onConflict: "id" })
    .select()
    .single();
  if (error) throw error;
  return data as DeskBug;
}

export async function updateBugById(id: string, partial: Partial<DeskBug>): Promise<DeskBug> {
  const { id: _ignored, ...rest } = partial as DeskBug;
  const { data, error } = await adminClient()
    .from("desk_bugs")
    .update(rest)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as DeskBug;
}

export async function deleteBug(id: string): Promise<void> {
  const { error } = await adminClient().from("desk_bugs").delete().eq("id", id);
  if (error) throw error;
}
