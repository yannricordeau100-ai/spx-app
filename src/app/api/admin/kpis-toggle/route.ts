import { NextResponse, type NextRequest } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DESK_OWNER_EMAIL } from "@/lib/desk/auth";

/**
 * POST /api/admin/kpis-toggle
 * Body : { ticker: string, kpi_short: string, disabled: boolean }
 *
 * Toggle ATOMIQUE d'un KPI précis pour une sté précise. Lit/écrit
 * `src/data/disabled-kpis-per-ste.json`. Auth-gate Yann uniquement
 * (DESK_OWNER_EMAIL).
 *
 * Si disabled=true → ajoute le short à overrides[ticker].
 * Si disabled=false → retire le short de overrides[ticker] (et purge
 * l'entrée si vide).
 *
 * Note : en prod Vercel le filesystem est read-only. Renvoie 503 sur
 * fail d'écriture, dans ce cas Yann commit le JSON à la main.
 */

const CONFIG_PATH = path.join(
  process.cwd(),
  "src/data/disabled-kpis-per-ste.json",
);

async function requireOwner() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.email !== DESK_OWNER_EMAIL) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "forbidden" }, { status: 403 }),
    };
  }
  return { ok: true as const };
}

export async function POST(req: NextRequest) {
  const r = await requireOwner();
  if (!r.ok) return r.response;

  let body: { ticker?: unknown; kpi_short?: unknown; disabled?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const ticker =
    typeof body.ticker === "string" ? body.ticker.trim().toUpperCase() : "";
  const kpiShort =
    typeof body.kpi_short === "string" ? body.kpi_short.trim() : "";
  const disabled = body.disabled === true;

  if (!ticker) {
    return NextResponse.json({ error: "ticker_required" }, { status: 400 });
  }
  if (!kpiShort) {
    return NextResponse.json({ error: "kpi_short_required" }, { status: 400 });
  }

  // Lire l'état courant
  let current: {
    _doc?: string;
    overrides?: Record<string, string[]>;
    updated_at?: string;
  } = {};
  try {
    const raw = await fs.readFile(CONFIG_PATH, "utf-8");
    current = JSON.parse(raw);
  } catch {
    current = { overrides: {} };
  }

  const overrides: Record<string, string[]> = { ...(current.overrides ?? {}) };
  const list = new Set(overrides[ticker] ?? []);

  if (disabled) {
    list.add(kpiShort);
  } else {
    list.delete(kpiShort);
  }

  if (list.size === 0) {
    delete overrides[ticker];
  } else {
    // Tri stable pour diff git lisible
    overrides[ticker] = Array.from(list).sort();
  }

  const payload = {
    _doc:
      current._doc ??
      "Liste des KPIs désactivés individuellement par société (granulaire, ticker -> [short...]). Géré via /admin/kpis-toggle. Différent de disabled-blocks-per-ste.json (qui désactive des BLOCS entiers de la page). Ici on cache au niveau KPI individuel (KPI principal, indicateurs clés, stories).",
    overrides,
    updated_at: new Date().toISOString(),
  };

  try {
    await fs.writeFile(
      CONFIG_PATH,
      JSON.stringify(payload, null, 2) + "\n",
      "utf-8",
    );
  } catch (err) {
    console.error("disabled-kpis write failed", err);
    return NextResponse.json(
      { error: "write_failed", detail: String(err) },
      { status: 503 },
    );
  }

  // Revalidate l'admin page + une sté (best-effort, layout-wide pour
  // toucher aussi /sandbox/v1-7-5/<ticker> et /sandbox/v1-8/<ticker>).
  try {
    revalidatePath("/admin/kpis-toggle");
    revalidatePath("/", "layout");
  } catch {
    // pas critique
  }

  return NextResponse.json({
    ok: true,
    ticker,
    kpi_short: kpiShort,
    disabled,
    overrides_count: Object.keys(overrides).length,
  });
}
