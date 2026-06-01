/**
 * /api/desk-mtk9x4kp/block-rules-apply
 *
 * POST  → crée un job, lance le worker en arrière-plan, retourne { job_id }
 * GET ?job_id=X → renvoie l'état du job (status + report si done)
 *
 * Auth : requireDeskOwner() (Yann uniquement).
 */

import { NextResponse, type NextRequest } from "next/server";
import { requireDeskOwner } from "@/lib/desk/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { runBlockRulesApply } from "@/lib/apply-block-rules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 min

export async function POST() {
  await requireDeskOwner();
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("desk_block_rules_jobs")
    .insert({ status: "pending" })
    .select("id")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: `Création job : ${error?.message ?? "inconnu"}` },
      { status: 500 },
    );
  }

  const jobId = data.id as string;

  // Lance le worker en arrière-plan (fire-and-forget).
  // Le client polle GET ?job_id=X pour suivre.
  void runBlockRulesApply(jobId).catch(async (err) => {
    const msg = err instanceof Error ? err.message : String(err);
    await supabase
      .from("desk_block_rules_jobs")
      .update({
        status: "error",
        finished_at: new Date().toISOString(),
        error_message: msg,
      })
      .eq("id", jobId);
  });

  return NextResponse.json({ ok: true, job_id: jobId });
}

export async function GET(req: NextRequest) {
  await requireDeskOwner();
  const jobId = req.nextUrl.searchParams.get("job_id");
  if (!jobId) {
    return NextResponse.json({ error: "job_id manquant" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("desk_block_rules_jobs")
    .select("id, status, started_at, finished_at, report, error_message")
    .eq("id", jobId)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: `Lecture job : ${error.message}` },
      { status: 500 },
    );
  }
  if (!data) {
    return NextResponse.json({ error: "Job introuvable" }, { status: 404 });
  }

  return NextResponse.json(data);
}
