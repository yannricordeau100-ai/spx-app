import { NextResponse, type NextRequest } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DESK_OWNER_EMAIL } from "@/lib/desk/auth";

/**
 * POST /api/admin/kpis-toggle/set-hero
 * Body : { ticker: string, kpi_short: string }
 *
 * Définit le KPI hero d'une société. Écrit DIRECT dans
 * `src/data/v2-pipeline/<ticker>.json` (Yann 4 juin 2026, "directement
 * dans le fichier data") :
 *   - hero_kpi = kpi_short
 *   - _hero_review_status = "validated"
 *   - _hero_last_set_at = ISO timestamp
 *   - _hero_last_set_by = "admin/kpis-toggle"
 *
 * Le KPI doit exister dans base.kpis ou enrich.kpis ou
 * enrich.kpis_supplementary. Sinon 400.
 *
 * En prod Vercel le filesystem est read-only → 503 si write fail. Dans
 * ce cas Yann commit le JSON à la main.
 */

const PIPELINE_DIR = path.join(process.cwd(), "src/data/v2-pipeline");
const ENRICH_DIR = path.join(process.cwd(), "src/data/v2-pipeline-enrich");

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

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function readShort(k: unknown): string {
  if (!k || typeof k !== "object") return "";
  const obj = k as Record<string, unknown>;
  return typeof obj.short === "string" ? obj.short : "";
}

export async function POST(req: NextRequest) {
  const r = await requireOwner();
  if (!r.ok) return r.response;

  let body: { ticker?: unknown; kpi_short?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const tickerRaw =
    typeof body.ticker === "string" ? body.ticker.trim() : "";
  const kpiShort =
    typeof body.kpi_short === "string" ? body.kpi_short.trim() : "";

  if (!tickerRaw) {
    return NextResponse.json({ error: "ticker_required" }, { status: 400 });
  }
  if (!kpiShort) {
    return NextResponse.json({ error: "kpi_short_required" }, { status: 400 });
  }

  const slug = tickerRaw.toLowerCase();
  const basePath = path.join(PIPELINE_DIR, `${slug}.json`);
  const enrichPath = path.join(ENRICH_DIR, `${slug}.json`);

  let baseJson: Record<string, unknown>;
  try {
    const raw = await fs.readFile(basePath, "utf-8");
    baseJson = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { error: "ticker_not_found", ticker: tickerRaw },
      { status: 404 },
    );
  }

  let enrichJson: Record<string, unknown> = {};
  try {
    const raw = await fs.readFile(enrichPath, "utf-8");
    enrichJson = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    // pas grave
  }

  // Vérifier que le KPI existe dans la merge baseKpis + enrich.kpis +
  // enrich.kpis_supplementary
  const allShorts = new Set<string>();
  for (const k of asArray(baseJson.kpis)) allShorts.add(readShort(k));
  for (const k of asArray(enrichJson.kpis)) allShorts.add(readShort(k));
  for (const k of asArray(enrichJson.kpis_supplementary))
    allShorts.add(readShort(k));

  if (!allShorts.has(kpiShort)) {
    return NextResponse.json(
      {
        error: "kpi_not_found",
        ticker: tickerRaw,
        kpi_short: kpiShort,
        available: Array.from(allShorts).slice(0, 30),
      },
      { status: 400 },
    );
  }

  // Patch + write
  baseJson.hero_kpi = kpiShort;
  baseJson._hero_review_status = "validated";
  baseJson._hero_last_set_at = new Date().toISOString();
  baseJson._hero_last_set_by = "admin/kpis-toggle";

  try {
    await fs.writeFile(
      basePath,
      JSON.stringify(baseJson, null, 2) + "\n",
      "utf-8",
    );
  } catch (err) {
    console.error("set-hero write failed", err);
    return NextResponse.json(
      { error: "write_failed", detail: String(err) },
      { status: 503 },
    );
  }

  // Revalidate
  try {
    revalidatePath("/admin/kpis-toggle");
    revalidatePath("/", "layout");
  } catch {
    // pas critique
  }

  return NextResponse.json({
    ok: true,
    ticker: tickerRaw,
    hero_kpi: kpiShort,
    status: "validated",
  });
}
