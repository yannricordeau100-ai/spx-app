import { promises as fs } from "node:fs";
import path from "node:path";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireDeskOwner } from "@/lib/desk/auth";
import { loadDisabledKpisPerSte } from "@/lib/disabled-kpis";
import { isGenericKpi } from "@/lib/kpi-generic";
import { autoPromoteHero } from "@/lib/hero-auto-promote";
import { getHeroKpiOverride } from "@/lib/company-core/hero-kpi-overrides";
import KpisToggleClient, {
  type SteRow,
  type KpiRow,
} from "./client";

/**
 * /admin/kpis-toggle — admin sandbox pour activer / désactiver
 * individuellement les KPIs par société (granulaire, différent du toggle
 * blocs).
 *
 * Source data : pour chaque sté publishable V1.9.5
 * (`src/data/v1-9-publishable.json`), lit `v2-pipeline/<t>.json` +
 * `v2-pipeline-enrich/<t>.json`, merge `kpis` + `kpis_supplementary`,
 * filtre `history.length >= 3`, affiche checkbox + métadonnées.
 *
 * Persistance : `src/data/disabled-kpis-per-ste.json` via API
 * `POST /api/admin/kpis-toggle`.
 *
 * Auth-gate Yann uniquement.
 */
export const metadata = {
  title: "KPIs : activer / désactiver par sté · admin · Mettrik AI",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const ROOT = process.cwd();

type AnyKPI = {
  short?: unknown;
  name_fr?: unknown;
  name_en?: unknown;
  type?: unknown;
  period_type?: unknown;
  history?: unknown;
  value?: unknown;
  unit?: unknown;
  pv_score?: unknown;
};

function readNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function readString(v: unknown): string {
  return typeof v === "string" ? v : "";
}

async function readJson<T>(p: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(p, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function historyLength(v: unknown): number {
  if (!Array.isArray(v)) return 0;
  let n = 0;
  for (const x of v) {
    if (typeof x === "number" && Number.isFinite(x)) n += 1;
    else if (x && typeof x === "object" && "value" in (x as object)) {
      const val = (x as { value: unknown }).value;
      if (typeof val === "number" && Number.isFinite(val)) n += 1;
    }
  }
  return n;
}

function lastValue(v: unknown): number | null {
  if (!Array.isArray(v) || v.length === 0) return null;
  for (let i = v.length - 1; i >= 0; i -= 1) {
    const x = v[i];
    if (typeof x === "number" && Number.isFinite(x)) return x;
    if (x && typeof x === "object" && "value" in (x as object)) {
      const val = (x as { value: unknown }).value;
      if (typeof val === "number" && Number.isFinite(val)) return val;
    }
  }
  return null;
}

function fmtValue(v: number | null, unit: string): string {
  if (v === null) return "-";
  const abs = Math.abs(v);
  let s: string;
  if (abs >= 1000) s = v.toLocaleString("fr-FR", { maximumFractionDigits: 0 });
  else if (abs >= 1) s = v.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
  else s = v.toLocaleString("fr-FR", { maximumFractionDigits: 3 });
  return unit ? `${s} ${unit}` : s;
}

/**
 * Appartenance aux indices (Yann 29 aout 2026) : sert au filtre de la page.
 * Meme regle que la reduction d univers du 28 aout.
 */
const SOX_MEMBRES = new Set([
  "NVDA", "AVGO", "AMD", "QCOM", "TXN", "INTC", "MU", "ADI", "AMAT", "LRCX",
  "KLAC", "NXPI", "MCHP", "ON", "MPWR", "SWKS", "TER", "COHR", "ALGM", "AMKR",
  "ASML", "ACLS", "ENTG", "LSCC", "QRVO", "RMBS", "TSM", "GFS", "MRVL", "ARM",
  "ALAB", "WOLF",
]);

function indicesDe(
  ticker: string,
  sp500: Set<string>,
  n100: Set<string>,
): string[] {
  const t = ticker.toUpperCase();
  const norm = t.replace(/\./g, "-");
  const out: string[] = [];
  if (sp500.has(norm) || t === "VMRK" || t === "SPCX") out.push("S&P 500");
  if (n100.has(norm)) out.push("Nasdaq 100");
  if (SOX_MEMBRES.has(t)) out.push("SOXX");
  if (t.endsWith(".PA")) out.push("CAC 40");
  if (t.endsWith(".SW")) out.push("SMI");
  if (t.endsWith(".AS")) out.push("AEX");
  if (t.endsWith(".DE")) out.push("DAX");
  return out;
}

async function loadStes(): Promise<SteRow[]> {
  // Yann 29 aout 2026 : la page couvrait 534 societes sur 666 parce qu elle
  // intersectait avec v1-9-publishable.json, un fichier fige. La source est
  // desormais l univers en ligne lui meme.
  const v195 = await readJson<{ tickers?: string[] }>(
    path.join(ROOT, "src/data/v1-9-5-clean-all-tickers.json"),
  );
  const tickers = Array.isArray(v195?.tickers) ? v195!.tickers! : [];

  const sp500Raw = await readJson<string[]>(
    path.join(ROOT, "src/data/sp500-tickers.json"),
  );
  const sp500 = new Set(
    (sp500Raw ?? []).map((t) => t.toUpperCase().replace(/\./g, "-")),
  );
  const n100Raw = await readJson<string[]>(
    path.join(ROOT, "src/data/nasdaq100-members.json"),
  );
  const n100 = new Set(
    (Array.isArray(n100Raw) ? n100Raw : []).map((t) =>
      t.toUpperCase().replace(/\./g, "-"),
    ),
  );

  const disabledCfg = loadDisabledKpisPerSte();

  // Lire chaque sté en parallèle (cap raisonnable pour le SSR)
  const rows: SteRow[] = await Promise.all(
    tickers.map(async (tickerRaw): Promise<SteRow | null> => {
      const ticker = tickerRaw.toUpperCase();
      const baseFp = path.join(
        ROOT,
        "src/data/v2-pipeline",
        `${ticker.toLowerCase()}.json`,
      );
      const enrichFp = path.join(
        ROOT,
        "src/data/v2-pipeline-enrich",
        `${ticker.toLowerCase()}.json`,
      );
      const base = await readJson<Record<string, unknown>>(baseFp);
      if (!base) return null;
      const enrich =
        (await readJson<Record<string, unknown>>(enrichFp)) ?? {};
      // Yann 29 aout 2026 : la page ignorait kpis-haut, la source PRIORITAIRE
      // de la fusion runtime (load-company). Elle montrait donc des KPI que la
      // page publique n affiche pas, et inversement. Meme priorite ici.
      const haut = await readJson<Record<string, unknown>>(
        path.join(ROOT, ".batches-drafts-safe/kpis-haut", `${ticker}.json`),
      );
      const hautKpis = asArray(haut?.kpis) as AnyKPI[];

      const heroShort =
        typeof (haut?.hero_kpi ?? base.hero_kpi) === "string"
          ? String(haut?.hero_kpi ?? base.hero_kpi)
          : "";
      const baseKpis = asArray(base.kpis) as AnyKPI[];
      // BUGFIX 2026-06-04 Yann : merger aussi enrich.kpis (les sub-agents
      // SA22-B/D/E + Cerebras quarterly y écrivent les KPIs sectoriels
      // récents). Avant : seulement kpis_supplementary → KPIs invisibles.
      const enrichKpis = asArray(enrich.kpis) as AnyKPI[];
      const enrichSupp = asArray(enrich.kpis_supplementary) as AnyKPI[];

      // Merge avec dedup par `short` (base prioritaire)
      // Yann 30 aout 2026 : dedup en MINUSCULES, comme la fusion runtime de
      // load-company. Sensible a la casse, le toggle listait des doublons que
      // la page publique ecarte (NVDA "NETWORKING" vs "Networking") : on
      // pouvait donc y voir des KPI inexistants en ligne.
      const seen = new Set<string>();
      const merged: AnyKPI[] = [];
      for (const k of [...hautKpis, ...baseKpis, ...enrichKpis, ...enrichSupp]) {
        if (!k || typeof k !== "object") continue;
        const short = typeof k.short === "string" ? k.short : "";
        if (!short || seen.has(short.toLowerCase())) continue;
        seen.add(short.toLowerCase());
        merged.push(k);
      }

      // Filtre history >= 3 + classification générique/spécifique
      const kpis: KpiRow[] = merged
        .filter((k) => historyLength(k.history) >= 3)
        .map((k) => {
          const short = typeof k.short === "string" ? k.short : "";
          const lv = lastValue(k.history);
          const unit = typeof k.unit === "string" ? k.unit : "";
          const histLen = historyLength(k.history);
          const pv = readNumber(k.pv_score);
          return {
            short,
            name_fr:
              typeof k.name_fr === "string" && k.name_fr
                ? k.name_fr
                : typeof k.name_en === "string"
                  ? k.name_en
                  : "",
            name_en: typeof k.name_en === "string" ? k.name_en : "",
            type: typeof k.type === "string" ? k.type : "",
            period_type:
              typeof k.period_type === "string" ? k.period_type : "year",
            history_length: histLen,
            last_value: lv,
            last_value_fmt: fmtValue(lv, unit),
            unit,
            is_hero: short === heroShort,
            is_generic: isGenericKpi(short),
            pv_score: pv,
          };
        })
        .sort((a, b) => {
          // Ordre : hero → spécifiques (history desc) → génériques en bas
          if (a.is_hero && !b.is_hero) return -1;
          if (!a.is_hero && b.is_hero) return 1;
          if (a.is_generic !== b.is_generic) {
            return a.is_generic ? 1 : -1;
          }
          // Au sein de chaque groupe : history desc puis alpha
          if (a.history_length !== b.history_length) {
            return b.history_length - a.history_length;
          }
          return a.short.localeCompare(b.short);
        });

      const name = typeof base.name === "string" ? base.name : ticker;
      const sector = readString(base.sector);
      const subsector = readString(base.subsector);

      // Market cap : peut être dans ranks ou champ direct
      const ranks = base.ranks as Record<string, unknown> | undefined;
      const marketCap =
        readNumber((base as Record<string, unknown>).market_cap) ??
        readNumber((base as Record<string, unknown>).marketCap) ??
        readNumber(ranks?.market_cap_usd) ??
        readNumber(ranks?.market_cap) ??
        0;

      // Hero review status
      const heroIsGeneric = heroShort ? isGenericKpi(heroShort) : true;
      const reviewStatusRaw =
        readString((base as Record<string, unknown>)._hero_review_status) ||
        readString((enrich as Record<string, unknown>)._hero_review_status);
      let hero_review_status: SteRow["hero_review_status"];
      if (reviewStatusRaw === "validated") hero_review_status = "validated";
      else if (reviewStatusRaw === "auto_proposed_uncertain")
        hero_review_status = "auto_proposed_uncertain";
      else if (heroIsGeneric || !heroShort) hero_review_status = "needs_review";
      else hero_review_status = "validated"; // hero spécifique pré-existant = ok

      // Yann 5 juin 2026 — Auto-promote hero refactor : point coloré à
      // gauche de chaque ligne sté.
      // 🟢 emerald : hero KPI configuré matche un KPI du dataset ET
      //              auto-promote confidence="high".
      // 🟡 amber   : auto-promote confidence="medium" (2 candidats ≥ similaires)
      //              OU validation Supabase OK mais auto-promote propose autre KPI.
      // 🔴 red     : hero_kpi_short configuré (Supabase ou dataset) ne matche
      //              AUCUN KPI dataset (KPI disparu après re-extraction).
      //
      // L'override Supabase gagne sur le hero du dataset (= Yann a déjà validé).
      const supabaseOverride = await getHeroKpiOverride(ticker).catch(
        () => null,
      );
      const allCandidates = kpis.map((k) => ({
        short: k.short,
        history_length: k.history_length,
        is_wow: false, // pas exposé dans KpiRow ; auto-promote tombera sur history_length
        period_type: k.period_type,
      }));
      const autoPromote = autoPromoteHero(allCandidates);
      const datasetShorts = new Set(kpis.map((k) => k.short));
      const effectiveHeroShort = supabaseOverride ?? heroShort;
      let dot_color: SteRow["dot_color"];
      if (!effectiveHeroShort || !datasetShorts.has(effectiveHeroShort)) {
        // Hero configuré n'existe plus dans le dataset (re-extraction, KPI
        // renommé ou supprimé) → rouge.
        dot_color = "red";
      } else if (autoPromote.confidence === "medium") {
        // Auto-promote hésite entre 2 candidats similaires → jaune.
        dot_color = "amber";
      } else if (
        supabaseOverride &&
        autoPromote.hero &&
        autoPromote.hero !== supabaseOverride
      ) {
        // Override Yann mais l'auto-promote aurait choisi autre chose → jaune
        // (à vérifier visuellement). Yann reste maître mais on signale.
        dot_color = "amber";
      } else {
        dot_color = "emerald";
      }

      return {
        ticker,
        name,
        sector,
        subsector,
        indices: indicesDe(ticker, sp500, n100),
        market_cap: marketCap,
        hero_kpi: heroShort,
        hero_review_status,
        dot_color,
        auto_promote_hero: autoPromote.hero,
        auto_promote_confidence: autoPromote.confidence,
        kpis,
        disabled_shorts: disabledCfg.overrides[ticker] ?? [],
      };
    }),
  ).then((list) =>
    (list.filter(Boolean) as SteRow[])
      .filter((s) => s.kpis.length > 0)
      // Ordre par défaut côté serveur : market_cap desc (le client peut
      // basculer en tri par secteur).
      .sort((a, b) => {
        if (a.market_cap !== b.market_cap) return b.market_cap - a.market_cap;
        return a.ticker.localeCompare(b.ticker);
      }),
  );

  return rows;
}

export default async function KpisTogglePage() {
  await requireDeskOwner();

  const stes = await loadStes();
  const totalKpis = stes.reduce((acc, s) => acc + s.kpis.length, 0);
  const totalDisabled = stes.reduce(
    (acc, s) => acc + (s.disabled_shorts ?? []).length,
    0,
  );

  return (
    <div className="min-h-screen bg-[#050505] text-zinc-100">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <Link
          href="/admin"
          className="group mb-6 inline-flex items-center gap-2 text-[12px] text-zinc-500 transition-colors hover:text-zinc-200"
        >
          <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" />
          Retour admin
        </Link>

        <h1 className="mb-2 font-display text-[28px] font-bold tracking-tight">
          KPIs : activer / désactiver par sté
        </h1>
        <p className="mb-2 max-w-2xl text-[13.5px] text-zinc-400">
          Cochez pour activer un KPI, décochez pour le cacher sur la fiche
          société (KPI principal, indicateurs clés, stories). Les KPIs
          affichés sont ceux qui ont au moins 3 ans d&apos;historique.
        </p>
        <p className="mb-6 max-w-2xl text-[12px] text-zinc-500">
          Source : {stes.length} stés en ligne (univers V1.9.5) ·{" "}
          {totalKpis} KPIs au total · {totalDisabled} KPIs désactivés.
          Persistance : <code className="font-mono">disabled-kpis-per-ste.json</code>.
        </p>

        <KpisToggleClient stes={stes} />
      </div>
    </div>
  );
}
