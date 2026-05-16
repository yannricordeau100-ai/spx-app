import path from "node:path";
import fs from "node:fs";
import { CoverageClient } from "./client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Coverage Matrix · Mettrik AI",
  robots: { index: false, follow: false },
};

type AnyKPI = Record<string, unknown> & { short?: string; history?: number[]; value?: unknown; yoy?: unknown };
type AnyCo = Record<string, unknown> & {
  ticker?: string;
  name?: string;
  hero_kpi?: string;
  kpis?: AnyKPI[];
  risks?: unknown[];
  governance?: Record<string, unknown>;
  ai_positioning?: Record<string, unknown>;
  revenue_by_segment?: Record<string, unknown>;
  revenue_by_geography?: Record<string, unknown>;
  customer_type?: unknown;
  events?: unknown[];
  market_positions?: unknown[];
  company_description?: unknown;
  last_data_date?: unknown;
  ranks?: Record<string, unknown>;
  _fit_for_site?: boolean;
  _fit_reasons?: string[];
  transcript_summary?: unknown;
  _extracted_at?: string;
};

/**
 * Status par bloc :
 *  A = "juste" (data structurellement correcte et présente)
 *  B = "à jour" (data fraîche, last_data_date ou _extracted_at récent)
 *  C = "visible" (le composant React rendrait effectivement le bloc, càd
 *      n'a pas de return null à cause de données manquantes)
 *
 * Composite :
 *  "✓" = A+B+C tous OK
 *  "⚠" = A OK mais B ou C non OK
 *  "·" = A non OK (data manquante)
 */
export type BlockStatus = {
  a: boolean; // juste
  b: boolean; // à jour
  c: boolean; // visible (component would render)
};

export type Row = {
  ticker: string;
  name: string;
  in_top307: boolean;
  in_v17: boolean;
  blocks: Record<string, BlockStatus>;
  fit: boolean;
  missing_count: number;
  // Score visuel : combien de blocs ont A+B+C OK
  good_count: number;
  // Yann 17 mai 2026 : ADR duplicate flag. Si défini, la sté reste visible
  // dans la matrice mais barrée/grisée (= masquée du hub + page sté frontend).
  adr_duplicate_of?: string | null;
};

function readJson<T>(p: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(p, "utf-8")) as T;
  } catch {
    return null;
  }
}

function mergeEnrich(base: AnyCo, enrich: AnyCo | null, tam: { market_positions?: unknown } | null, ranksEnrich: { ranks?: unknown } | null): AnyCo {
  const out: AnyCo = { ...base };
  if (enrich) {
    for (const key of [
      "events", "revenue_by_segment", "revenue_by_geography",
      "customer_type", "profit_warning", "company_description",
      "financial_snapshot", "key_facts", "peers", "latest_filing",
    ] as const) {
      if (enrich[key] !== undefined && out[key] === undefined) {
        (out as Record<string, unknown>)[key] = enrich[key];
      }
    }
    for (const key of ["risks", "governance", "ai_positioning"] as const) {
      const existing = (out as Record<string, unknown>)[key];
      const empty = existing === undefined || existing === null
        || (Array.isArray(existing) && existing.length === 0);
      if (empty && enrich[key] !== undefined) {
        (out as Record<string, unknown>)[key] = enrich[key];
      }
    }
    // Append KPIs from enrich (CONV-DIV V1 patch)
    if (Array.isArray(enrich.kpis) && Array.isArray(out.kpis)) {
      const existingShorts = new Set(out.kpis.map((k) => k?.short));
      for (const k of enrich.kpis) {
        if (k?.short && !existingShorts.has(k.short)) out.kpis.push(k);
      }
    }
  }
  if (tam && Array.isArray(tam.market_positions) && tam.market_positions.length > 0) {
    if (!Array.isArray(out.market_positions)) {
      (out as Record<string, unknown>).market_positions = tam.market_positions;
    }
  }
  if (ranksEnrich && ranksEnrich.ranks) {
    const existing = (out as Record<string, unknown>).ranks as Record<string, unknown> | undefined;
    if (!existing || !existing.global_world) {
      (out as Record<string, unknown>).ranks = ranksEnrich.ranks;
    }
  }
  return out;
}

/** Date freshness: <12 mois = ok */
function isFresh(iso: unknown, maxMonths = 12): boolean {
  if (!iso || typeof iso !== "string") return false;
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return false;
    const ageMs = Date.now() - d.getTime();
    return ageMs < maxMonths * 30 * 24 * 3600 * 1000;
  } catch {
    return false;
  }
}

/** Mimick component-rendering null-checks. Same logic as React components. */
function computeBlocks(d: AnyCo, ticker: string, logoSet: Set<string>, transcriptSet: Set<string>): Record<string, BlockStatus> {
  const kpis = Array.isArray(d.kpis) ? d.kpis : [];
  const heroShort = d.hero_kpi || "";
  const hero = kpis.find((k) => k && k.short === heroShort) ?? kpis[0];
  const heroHist = hero && Array.isArray(hero.history) ? hero.history.filter((v) => v != null) : [];
  const risks = Array.isArray(d.risks) ? d.risks : [];
  const events = Array.isArray(d.events) ? d.events : [];
  const gov = (d.governance as Record<string, unknown>) ?? {};
  const ai = (d.ai_positioning as Record<string, unknown>) ?? {};
  const ranksObj = (d.ranks as Record<string, unknown>) ?? {};
  const seg = (d.revenue_by_segment as { slices?: unknown[] }) ?? {};
  const geo = (d.revenue_by_geography as { slices?: unknown[] }) ?? {};
  const segOk = Array.isArray(seg.slices) && seg.slices.length >= 2;
  const geoOk = Array.isArray(geo.slices) && geo.slices.length >= 2;
  const mp = d.market_positions;
  const logoSafe = ticker.replace(/\./g, "-").replace(/\//g, "-").toUpperCase();
  const desc = String(d.company_description || "");

  // Dividend KPI shorts (CONV-DIV V1+V4 logic from dividend-stories.tsx:115)
  const shorts = new Set(kpis.map((k) => k?.short));
  const isCat = ticker === "CAT";
  const dividendVisible = isCat || (shorts.has("DPS") && shorts.has("Cap Return") && shorts.has("Payout Ratio"));

  // last_data_date est stocké sur le KPI hero (et chaque KPI), pas au niveau sté.
  // Cherche d'abord hero.last_data_date, sinon n'importe quel KPI valide.
  const heroLastDate = hero?.last_data_date as string | undefined;
  const anyKpiDate = kpis.find((k) => k?.last_data_date)?.last_data_date as string | undefined;
  const lastDate = heroLastDate || anyKpiDate || (d.last_data_date as string | undefined);
  const extractedAt = d._extracted_at as string | undefined;
  const dataFresh = isFresh(lastDate, 12) || isFresh(extractedAt, 6);

  const heroExtractedAt = hero?._hero_history_extracted_at as string | undefined;
  const heroFresh = isFresh(heroExtractedAt, 12) || isFresh(lastDate, 12);

  return {
    hero_kpi: { a: !!(heroShort && hero), b: dataFresh, c: !!(heroShort && hero && hero.value != null) },
    hero_history: { a: heroHist.length >= 4, b: heroFresh, c: heroHist.length >= 4 },
    kpis_count: { a: kpis.length >= 5, b: dataFresh, c: kpis.length >= 5 },
    risks: { a: risks.length >= 3, b: dataFresh, c: risks.length > 0 },
    governance: { a: !!gov.ceo_name, b: dataFresh, c: !!gov.ceo_name },
    ai_pos: { a: !!ai.stance, b: dataFresh, c: !!ai.stance },
    segment: { a: segOk, b: dataFresh, c: segOk || geoOk },
    geography: { a: geoOk, b: dataFresh, c: segOk || geoOk },
    customer_type: { a: !!d.customer_type, b: dataFresh, c: !!d.customer_type },
    events: { a: events.length >= 2, b: isFresh(extractedAt, 1) || dataFresh, c: events.length > 0 },
    tam: { a: Array.isArray(mp) && mp.length > 0, b: dataFresh, c: Array.isArray(mp) && mp.length > 0 },
    description: { a: desc.length >= 50, b: dataFresh, c: desc.length >= 50 },
    freshness: { a: !!lastDate, b: isFresh(lastDate, 3), c: !!lastDate },
    ranks: { a: !!ranksObj.global_world, b: isFresh(extractedAt, 6), c: !!ranksObj.global_world },
    logo: { a: logoSet.has(logoSafe), b: true, c: logoSet.has(logoSafe) },
    transcript: { a: transcriptSet.has(ticker.toUpperCase()), b: true, c: transcriptSet.has(ticker.toUpperCase()) },
    dividend: { a: dividendVisible, b: dataFresh, c: dividendVisible },
  };
}

function buildRows(): Row[] {
  const root = process.cwd();
  const merged = readJson<Record<string, AnyCo>>(path.join(root, "src/data/v2-pipeline/_merged.json")) ?? {};
  const v17 = readJson<Record<string, unknown>>(path.join(root, "src/data/v1-7-public.json")) ?? {};
  const top307Raw = readJson<unknown>(path.join(root, "src/data/v1-8-tickers-sorted.json"));
  const top307Arr: string[] = Array.isArray(top307Raw)
    ? (top307Raw as string[])
    : ((top307Raw as { tickers?: string[] })?.tickers ?? []);
  const top307 = new Set(top307Arr.slice(0, 307));
  const enrichDir = path.join(root, "src/data/v2-pipeline-enrich");

  const logoSet = new Set<string>();
  try {
    for (const f of fs.readdirSync(path.join(root, "public/logos"))) {
      logoSet.add(f.replace(/\.(png|svg)$/i, "").toUpperCase());
    }
  } catch {}

  const transcriptSet = new Set<string>();
  try {
    for (const f of fs.readdirSync(path.join(root, "src/data/transcript-summaries"))) {
      if (f.endsWith(".json")) transcriptSet.add(f.replace(/\.json$/i, "").toUpperCase());
    }
  } catch {}

  const rows: Row[] = [];
  for (const [tk, base] of Object.entries(merged)) {
    if (!base || typeof base !== "object") continue;
    const tkLower = tk.toLowerCase();
    const enrich = readJson<AnyCo>(path.join(enrichDir, `${tkLower}.json`));
    const tam = readJson<{ market_positions?: unknown }>(path.join(enrichDir, `${tkLower}.tam.json`));
    const ranksEnrich = readJson<{ ranks?: unknown }>(path.join(enrichDir, `${tkLower}.ranks.json`));
    const d = mergeEnrich(base, enrich, tam, ranksEnrich);
    const blocks = computeBlocks(d, tk, logoSet, transcriptSet);

    let missing = 0;
    let good = 0;
    for (const status of Object.values(blocks)) {
      if (!status.a) missing++;
      if (status.a && status.b && status.c) good++;
    }

    rows.push({
      ticker: tk,
      name: String(d.name || tk),
      in_top307: top307.has(tk),
      in_v17: tk in v17,
      blocks,
      fit: d._fit_for_site !== false,
      missing_count: missing,
      good_count: good,
      adr_duplicate_of: typeof (d as { _adr_duplicate_of?: unknown })._adr_duplicate_of === "string"
        ? ((d as { _adr_duplicate_of?: string })._adr_duplicate_of ?? null)
        : null,
    });
  }

  rows.sort((a, b) => {
    if (a.in_top307 !== b.in_top307) return a.in_top307 ? -1 : 1;
    return b.good_count - a.good_count;
  });
  return rows;
}

export default function CoverageMatrixPage() {
  const rows = buildRows();
  return <CoverageClient initialRows={rows} />;
}
