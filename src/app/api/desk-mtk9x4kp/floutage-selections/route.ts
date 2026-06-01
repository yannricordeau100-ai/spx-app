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
  // Yann 2 juin 2026 : on agrège TOUTES les soumissions historiques pour
  // cette sté (auparavant `.limit(1)` ne renvoyait que la dernière session,
  // donc Yann perdait ses zones précédentes au reload). Chaque POST crée
  // une nouvelle ligne, donc on merge toutes les `selections` en
  // déduplicant par (dom_selector + label + rect).
  const { data, error } = await supa
    .from("desk_floutage_selections")
    .select("id, ticker, created_at, selections, signed_by")
    .eq("ticker", ticker)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = Array.isArray(data) ? data : [];
  if (rows.length === 0) {
    return NextResponse.json({ latest: null });
  }

  // Merge dédupliqué : on parcourt du plus récent au plus ancien, on
  // garde la première occurrence de chaque (dom_selector + label) ou,
  // si pas de dom_selector, du tuple rect+label. Garantit que les
  // dernières corrections Yann l'emportent et que rien n'est perdu.
  const seen = new Set<string>();
  const merged: Selection[] = [];
  for (const row of rows) {
    const sels = Array.isArray(row.selections)
      ? (row.selections as Selection[])
      : [];
    for (const sel of sels) {
      if (
        !sel ||
        typeof sel !== "object" ||
        !sel.rect ||
        typeof sel.dom_selector !== "string" ||
        typeof sel.label !== "string"
      ) {
        continue;
      }
      const key = sel.dom_selector
        ? `${sel.dom_selector}::${sel.label}`
        : `${sel.rect.x}x${sel.rect.y}x${sel.rect.w}x${sel.rect.h}::${sel.label}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(sel);
    }
  }

  // On renvoie sous le même format que l'ancienne API (champ `latest` avec
  // `selections` array) pour ne pas casser le client. `id` et `created_at`
  // sont ceux de la ligne la plus récente (la rangée n°0).
  return NextResponse.json({
    latest: {
      id: rows[0].id,
      ticker: rows[0].ticker,
      created_at: rows[0].created_at,
      signed_by: rows[0].signed_by,
      selections: merged,
      _merged_from_rows: rows.length,
    },
  });
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
    // Cas typique : table manquante en prod (migration jamais appliquée),
    // service_role mal configurée, ou colonne manquante. On renvoie le
    // détail brut pour debug Yann + le code Postgres.
    console.error("[floutage-selections POST] supabase insert error:", error);
    return NextResponse.json(
      {
        error: `BDD : ${error.message}`,
        code: error.code,
        details: error.details,
        hint: error.hint,
      },
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
