/**
 * /api/desk/hero — changement du hero KPI d'une sté depuis le back-office
 * /sandbox/kpi-quality-strategy (Yann 21 août 2026).
 *
 * Modelé sur /api/desk/att (gating DESK_OWNER_EMAIL) + bypass audit_token
 * (même pattern que /api/admin/duplicates/confirm) pour les vérifications
 * curl locales.
 *
 * PRÉCÉDENCE HERO AU RENDU (tracée dans load-company.ts) :
 *   1. v2-pipeline/<t>.json hero_kpi (base)
 *   2. v2-pipeline-enrich/<t>.json hero_kpi_override
 *   3. <t>.hero_name_fr.json hero_kpi_override (pivot)
 *   4. fallback disabled-kpis, special-kpis is_hero, kpis-haut bestHero
 *   5. Supabase `desk_hero_kpi_overrides` — appliqué TOUT À LA FIN de
 *      loadV17Company, GAGNE sur tout le reste (cf. commentaire
 *      "Appliqué TOUT À LA FIN pour gagner sur tous les autres mécanismes").
 *
 * → L'écriture qui prend effet réellement est le point 5 (Supabase, comme
 *   /api/admin/kpis-toggle/set-hero). En complément, on aligne les fichiers
 *   locaux (companies + v2-pipeline + overrides enrich SI présents) avec
 *   backup `.bak-hero-desk` avant première écriture, par remplacement
 *   textuel ciblé (les fichiers v2-pipeline ne sont PAS stables au
 *   round-trip JSON.stringify : réécrire tout le fichier créerait un diff
 *   massif, interdit par la règle data preservation).
 *
 * Endpoints :
 *   GET             → map des overrides Supabase { ticker: hero_kpi_short }
 *   GET ?ticker=X   → hero effectif + liste KPI réels (via loadV17Company)
 *   POST {ticker, hero_kpi} → applique le hero (validation serveur : le
 *                     hero_kpi doit exister dans company.kpis chargés)
 *   DELETE ?ticker=X → retire le pin Supabase (retour aux mécanismes locaux)
 */
import { promises as fs } from "fs";
import path from "path";
import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { DESK_OWNER_EMAIL } from "@/lib/desk/auth";
import { loadV17Company } from "@/lib/company-core/load-company";
import { invalidateHeroOverridesCache } from "@/lib/company-core/hero-kpi-overrides";

export const dynamic = "force-dynamic";

async function requireOwner(req: NextRequest) {
  // Bypass audit_token (cohérent avec /api/admin/duplicates/confirm).
  const auditToken = req.nextUrl.searchParams.get("audit_token") ?? "";
  const expected = process.env.VISUAL_AUDIT_TOKEN ?? "";
  if (auditToken && expected && auditToken === expected) {
    return { ok: true as const };
  }
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== DESK_OWNER_EMAIL) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "forbidden" }, { status: 403 }),
    };
  }
  return { ok: true as const };
}

type KpiOption = { short: string; name_fr: string };

async function loadEffective(ticker: string): Promise<
  | { ok: true; hero: string | null; kpis: KpiOption[] }
  | { ok: false; status: number; error: string }
> {
  const r = await loadV17Company(ticker, { mode: "v18" });
  if (r.kind !== "ready") {
    return { ok: false, status: 404, error: `ticker_not_ready (${r.kind})` };
  }
  const kpis: KpiOption[] = (r.company.kpis ?? [])
    .filter((k) => typeof k.short === "string" && k.short)
    .map((k) => ({
      short: k.short,
      name_fr: typeof k.name_fr === "string" ? k.name_fr : k.short,
    }));
  return { ok: true, hero: r.company.hero_kpi ?? null, kpis };
}

/**
 * Remplacement textuel ciblé de la valeur d'une clé string top-level dans
 * un fichier JSON, en préservant le reste du fichier octet pour octet.
 * Backup `.bak-hero-desk` créé UNE SEULE FOIS (si absent) = état d'origine.
 * Retourne true si le fichier a été modifié.
 */
async function patchJsonStringKey(
  filePath: string,
  key: string,
  newValue: string,
): Promise<boolean> {
  let raw: string;
  try {
    raw = await fs.readFile(filePath, "utf-8");
  } catch {
    return false; // fichier absent → rien à faire
  }
  const re = new RegExp(`("${key}"\\s*:\\s*)"(?:[^"\\\\]|\\\\.)*"`);
  if (!re.test(raw)) return false; // clé absente → on n'insère pas
  const next = raw.replace(re, `$1${JSON.stringify(newValue)}`);
  if (next === raw) return false;
  const bak = `${filePath}.bak-hero-desk`;
  try {
    await fs.access(bak);
  } catch {
    await fs.writeFile(bak, raw, "utf-8");
  }
  await fs.writeFile(filePath, next, "utf-8");
  return true;
}

export async function GET(req: NextRequest) {
  const r = await requireOwner(req);
  if (!r.ok) return r.response;

  const ticker = req.nextUrl.searchParams.get("ticker")?.toUpperCase() ?? null;

  if (ticker) {
    const eff = await loadEffective(ticker);
    if (!eff.ok) {
      return NextResponse.json({ error: eff.error }, { status: eff.status });
    }
    return NextResponse.json({ ticker, hero_kpi: eff.hero, kpis: eff.kpis });
  }

  // Sans ticker : map des overrides Supabase (couche gagnante).
  const overrides: Record<string, string> = {};
  try {
    const admin = createSupabaseAdminClient();
    const { data } = await admin
      .from("desk_hero_kpi_overrides")
      .select("ticker, hero_kpi_short");
    for (const row of data ?? []) {
      const t = String((row as { ticker?: unknown }).ticker ?? "").toUpperCase();
      const s = String((row as { hero_kpi_short?: unknown }).hero_kpi_short ?? "");
      if (t && s) overrides[t] = s;
    }
  } catch {
    // Supabase down → map vide, le client garde le snapshot local.
  }
  return NextResponse.json({ overrides });
}

export async function POST(req: NextRequest) {
  const r = await requireOwner(req);
  if (!r.ok) return r.response;

  const body = await req.json().catch(() => null);
  const ticker = typeof body?.ticker === "string" ? body.ticker.toUpperCase().trim() : "";
  const heroKpi = typeof body?.hero_kpi === "string" ? body.hero_kpi.trim() : "";
  if (!ticker) return NextResponse.json({ error: "ticker requis" }, { status: 400 });
  if (!heroKpi) return NextResponse.json({ error: "hero_kpi requis" }, { status: 400 });

  // Validation serveur : le hero demandé doit exister dans les KPI
  // RÉELLEMENT chargés par la page sté (loadV17Company, pas les fichiers bruts).
  const eff = await loadEffective(ticker);
  if (!eff.ok) {
    return NextResponse.json({ error: eff.error }, { status: eff.status });
  }
  if (!eff.kpis.some((k) => k.short === heroKpi)) {
    return NextResponse.json(
      {
        error: "hero_kpi absent des KPI de la sté",
        ticker,
        hero_kpi: heroKpi,
        available: eff.kpis.map((k) => k.short).slice(0, 60),
      },
      { status: 400 },
    );
  }

  // 1) Écriture au point de plus haute précédence : Supabase
  //    desk_hero_kpi_overrides (appliqué tout à la fin de loadV17Company,
  //    gagne sur enrich overrides / kpis-haut / auto-promote).
  try {
    const admin = createSupabaseAdminClient();
    const { error } = await admin.from("desk_hero_kpi_overrides").upsert(
      {
        ticker,
        hero_kpi_short: heroKpi,
        updated_at: new Date().toISOString(),
        updated_by: "desk/hero (kpi-quality-strategy)",
      },
      { onConflict: "ticker" },
    );
    if (error) {
      return NextResponse.json(
        { error: "supabase_upsert_failed", detail: error.message },
        { status: 500 },
      );
    }
  } catch (err) {
    return NextResponse.json(
      { error: "supabase_client_failed", detail: String(err) },
      { status: 500 },
    );
  }
  invalidateHeroOverridesCache();

  // 2) Alignement des fichiers locaux (best effort : read-only en prod
  //    Vercel). Backup .bak-hero-desk avant première écriture. On ne touche
  //    que les clés DÉJÀ présentes (pas d'insertion).
  const slug = ticker.toLowerCase();
  const ROOT = process.cwd();
  const localWrites: string[] = [];
  const targets: Array<{ file: string; key: string }> = [
    { file: path.join(ROOT, "src/data/companies", `${slug}.json`), key: "hero_kpi" },
    { file: path.join(ROOT, "src/data/v2-pipeline", `${slug}.json`), key: "hero_kpi" },
    // Overrides enrich : c'est eux qui gagnent sur la base locale quand ils
    // existent (cf. load-company.ts hero_kpi_override + pivot hero_name_fr).
    { file: path.join(ROOT, "src/data/v2-pipeline-enrich", `${slug}.json`), key: "hero_kpi_override" },
    { file: path.join(ROOT, "src/data/v2-pipeline-enrich", `${slug}.hero_name_fr.json`), key: "hero_kpi_override" },
  ];
  for (const t of targets) {
    try {
      if (await patchJsonStringKey(t.file, t.key, heroKpi)) {
        localWrites.push(path.relative(ROOT, t.file));
      }
    } catch (err) {
      console.warn("[desk/hero] local write failed", t.file, err);
    }
  }

  try {
    revalidatePath("/", "layout");
  } catch {
    // pas critique
  }

  return NextResponse.json({
    ok: true,
    ticker,
    hero_kpi: heroKpi,
    persisted: "supabase:desk_hero_kpi_overrides",
    local_writes: localWrites,
  });
}

export async function DELETE(req: NextRequest) {
  const r = await requireOwner(req);
  if (!r.ok) return r.response;
  const ticker = req.nextUrl.searchParams.get("ticker")?.toUpperCase() ?? "";
  if (!ticker) return NextResponse.json({ error: "ticker requis" }, { status: 400 });
  try {
    const admin = createSupabaseAdminClient();
    const { error } = await admin
      .from("desk_hero_kpi_overrides")
      .delete()
      .eq("ticker", ticker);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
  invalidateHeroOverridesCache();
  try {
    revalidatePath("/", "layout");
  } catch {
    // pas critique
  }
  return NextResponse.json({ ok: true, ticker, removed: true });
}
