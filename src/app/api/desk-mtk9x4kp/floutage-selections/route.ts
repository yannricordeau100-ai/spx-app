/**
 * /api/desk-mtk9x4kp/floutage-selections
 *
 * POST { ticker, selections: [{rect:{x,y,w,h}, dom_selector, dom_text, label}] }
 *      → INSERT desk_floutage_selections
 *      → Aussi écrit src/data/floutage-selections-pending.json (pour relecture
 *        agent dev) + src/data/floutage-rules.json (rules réutilisables).
 *
 * GET  → dernière sélection (par ticker), pour pré-remplissage UI au reload.
 *
 * Auth : requireDeskOwner() (email Yann uniquement).
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { NextResponse, type NextRequest } from "next/server";
import { requireDeskOwner } from "@/lib/desk/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Selection = {
  rect: { x: number; y: number; w: number; h: number };
  dom_selector: string;
  dom_text: string;
  label: string;
};

export async function GET(req: NextRequest) {
  await requireDeskOwner();

  const ticker = (req.nextUrl.searchParams.get("ticker") ?? "GOOGL").toUpperCase();
  const supa = createSupabaseAdminClient();
  const { data, error } = await supa
    .from("desk_floutage_selections")
    .select("id, ticker, created_at, selections, signed_by")
    .eq("ticker", ticker)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ latest: data ?? null });
}

export async function POST(req: NextRequest) {
  const { email } = await requireDeskOwner();

  const body = (await req.json().catch(() => ({}))) as {
    ticker?: string;
    selections?: Selection[];
  };

  const ticker = (body.ticker ?? "GOOGL").trim().toUpperCase();
  const selections = Array.isArray(body.selections) ? body.selections : [];

  if (!ticker) {
    return NextResponse.json({ error: "ticker manquant" }, { status: 400 });
  }

  // Validation rapide.
  const cleaned: Selection[] = selections
    .filter(
      (s) =>
        s &&
        typeof s.dom_selector === "string" &&
        typeof s.label === "string" &&
        s.rect &&
        typeof s.rect.x === "number" &&
        typeof s.rect.y === "number" &&
        typeof s.rect.w === "number" &&
        typeof s.rect.h === "number",
    )
    .map((s) => ({
      rect: {
        x: Math.round(s.rect.x),
        y: Math.round(s.rect.y),
        w: Math.round(s.rect.w),
        h: Math.round(s.rect.h),
      },
      dom_selector: s.dom_selector.slice(0, 500),
      dom_text: (s.dom_text ?? "").slice(0, 500),
      label: s.label.slice(0, 200),
    }));

  // INSERT Supabase.
  const supa = createSupabaseAdminClient();
  const { data, error } = await supa
    .from("desk_floutage_selections")
    .insert({
      ticker,
      selections: cleaned,
      signed_by: email,
    })
    .select("id, created_at")
    .single();

  if (error) {
    return NextResponse.json(
      { error: `BDD : ${error.message}` },
      { status: 500 },
    );
  }

  // Écrit fichier pending pour relecture dev (best-effort, non bloquant).
  try {
    const projectRoot = process.cwd();
    const pendingPath = path.join(
      projectRoot,
      "src",
      "data",
      "floutage-selections-pending.json",
    );
    await fs.writeFile(
      pendingPath,
      JSON.stringify(
        {
          ticker,
          submission_id: data?.id,
          created_at: data?.created_at,
          signed_by: email,
          selections: cleaned,
        },
        null,
        2,
      ),
      "utf-8",
    );

    // Génère aussi floutage-rules.json (règles applicables sur autres stés).
    const rulesPath = path.join(
      projectRoot,
      "src",
      "data",
      "floutage-rules.json",
    );
    const rules = cleaned.map((s) => ({
      label: s.label,
      dom_selector: s.dom_selector,
      sub_target: null,
      action: "blur" as const,
    }));
    await fs.writeFile(
      rulesPath,
      JSON.stringify(
        {
          rules,
          generated_at: new Date().toISOString(),
          signed_by: email,
        },
        null,
        2,
      ),
      "utf-8",
    );
  } catch {
    // Vercel filesystem = read-only en prod : non bloquant, BDD reste source.
  }

  return NextResponse.json({
    ok: true,
    submission_id: data?.id,
    count: cleaned.length,
  });
}
