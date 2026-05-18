/**
 * /api/desk/curated-companies
 *
 * GET : lit la liste complète des rows (admin only)
 * PATCH : upsert d'1 row { ticker, min_plan, notes? }
 * PUT : bulk replace (envoie un array, c'est upsert massif)
 *
 * Le modèle est CUMULATIF : min_plan='free' = visible Free/Premium/Max,
 * min_plan='premium' = visible Premium/Max, etc.
 *
 * Yann 18 mai 2026, bascule niveau 1.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DESK_OWNER_EMAIL } from "@/lib/desk/auth";

type MinPlan = "free" | "premium" | "max" | "hidden";

const VALID_PLANS: ReadonlySet<MinPlan> = new Set(["free", "premium", "max", "hidden"]);

async function requireOwner() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== DESK_OWNER_EMAIL) {
    return { ok: false as const, response: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  }
  return { ok: true as const, supabase, email: user.email! };
}

export async function GET() {
  const r = await requireOwner();
  if (!r.ok) return r.response;
  const { data, error } = await r.supabase
    .from("desk_curated_companies")
    .select("ticker, min_plan, notes, updated_at")
    .order("ticker", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

type PatchBody = { ticker?: string; min_plan?: MinPlan; notes?: string | null };

export async function PATCH(req: NextRequest) {
  const r = await requireOwner();
  if (!r.ok) return r.response;
  const body = (await req.json().catch(() => ({}))) as PatchBody;

  const ticker = (body.ticker ?? "").trim().toUpperCase();
  if (!ticker) return NextResponse.json({ error: "ticker required" }, { status: 400 });
  if (body.min_plan && !VALID_PLANS.has(body.min_plan)) {
    return NextResponse.json({ error: "invalid min_plan" }, { status: 400 });
  }

  const row: Record<string, unknown> = { ticker };
  if (body.min_plan !== undefined) row.min_plan = body.min_plan;
  if (body.notes !== undefined) row.notes = body.notes;

  const { error } = await r.supabase
    .from("desk_curated_companies")
    .upsert(row, { onConflict: "ticker" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

type PutBody = { rows: Array<{ ticker: string; min_plan: MinPlan; notes?: string | null }> };

/** Bulk replace : utile pour update plusieurs sés à la fois. */
export async function PUT(req: NextRequest) {
  const r = await requireOwner();
  if (!r.ok) return r.response;
  const body = (await req.json().catch(() => ({ rows: [] }))) as PutBody;
  if (!Array.isArray(body.rows)) {
    return NextResponse.json({ error: "rows must be array" }, { status: 400 });
  }
  const cleaned = body.rows
    .filter((rw) => rw.ticker && VALID_PLANS.has(rw.min_plan))
    .map((rw) => ({
      ticker: rw.ticker.trim().toUpperCase(),
      min_plan: rw.min_plan,
      notes: rw.notes ?? null,
    }));
  if (cleaned.length === 0) {
    return NextResponse.json({ ok: true, count: 0 });
  }
  const { error } = await r.supabase
    .from("desk_curated_companies")
    .upsert(cleaned, { onConflict: "ticker" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, count: cleaned.length });
}
