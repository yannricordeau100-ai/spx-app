import { NextResponse, type NextRequest } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { invalidateHeroOverridesCache } from "@/lib/company-core/hero-kpi-overrides";
import { DESK_OWNER_EMAIL } from "@/lib/desk/auth";

/**
 * POST /api/admin/kpis-toggle/set-hero
 * Body : { ticker: string, kpi_short: string }
 *
 * Définit le KPI hero d'une société. Persiste dans la table Supabase
 * `desk_hero_kpi_overrides` (source de vérité). Remplace l'ancienne
 * écriture filesystem `fs.writeFile` dans
 * `src/data/v2-pipeline/<ticker>.json` qui était PERDUE à chaque deploy
 * Vercel (filesystem read-only en prod → EROFS → choix Yann perdus).
 *
 * Le KPI doit exister dans base.kpis ou enrich.kpis ou
 * enrich.kpis_supplementary. Sinon 400.
 *
 * Lecture côté SSR : `loadV17Company()` fetche les overrides via
 * `getHeroKpiOverride(ticker)` (cache 60 s) et remplace `data.hero_kpi`
 * si une override existe. Effet immédiat post-upsert grâce à
 * `invalidateHeroOverridesCache()`.
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
      email: null as string | null,
    };
  }
  return { ok: true as const, email: user.email ?? null };
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

  // 1) Lecture defensive du dataset pipeline pour valider que le KPI existe.
  //    On NE TOUCHE PAS au fichier (filesystem read-only en prod, et règle
  //    Mettrik : pas de touche aux datasets v2-pipeline/).
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

  // 2) Persistance Supabase (source de vérité). Upsert sur PK ticker.
  //    Utilise service role (bypass RLS).
  try {
    const supabaseAdmin = createSupabaseAdminClient();
    const { error } = await supabaseAdmin
      .from("desk_hero_kpi_overrides")
      .upsert(
        {
          ticker: tickerRaw.toUpperCase(),
          hero_kpi_short: kpiShort,
          updated_at: new Date().toISOString(),
          updated_by: r.email ?? "admin/kpis-toggle",
        },
        { onConflict: "ticker" },
      );
    if (error) {
      console.error("[set-hero] supabase upsert failed", error);
      return NextResponse.json(
        { error: "supabase_upsert_failed", detail: error.message },
        { status: 500 },
      );
    }
  } catch (err) {
    console.error("[set-hero] supabase admin client failed", err);
    return NextResponse.json(
      { error: "supabase_client_failed", detail: String(err) },
      { status: 500 },
    );
  }

  // Force le prochain fetch SSR à relire la table.
  invalidateHeroOverridesCache();

  // Revalidate routes admin + page société rendue (layout root pour matcher
  // toutes les routes versionnées /sandbox/v1-*).
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
    persisted: true,
  });
}
