import path from "node:path";
import fs from "node:fs";
import { CuratedCompaniesClient } from "./client";
import {
  computeCurationScore,
  type BlockStatus,
  type VisualFail,
  type CurationScore,
} from "@/lib/desk/curation-score";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Curated Companies · Mettrik AI",
  robots: { index: false, follow: false },
};

type AnyKPI = Record<string, unknown> & { short?: string; history?: number[]; value?: unknown };
type AnyCo = Record<string, unknown> & {
  ticker?: string;
  name?: string;
  hero_kpi?: string;
  kpis?: AnyKPI[];
  risks?: unknown[];
  governance?: Record<string, unknown>;
  ai_positioning?: Record<string, unknown>;
  revenue_by_segment?: { slices?: unknown[] };
  revenue_by_geography?: { slices?: unknown[] };
  customer_type?: unknown;
  events?: unknown[];
  market_positions?: unknown[];
  company_description?: unknown;
  last_data_date?: unknown;
  ranks?: Record<string, unknown>;
  _extracted_at?: unknown;
  _fit_for_site?: boolean;
};

export type CurationRow = {
  ticker: string;
  name: string;
  in_top307: boolean;
  in_v17: boolean;
  score: CurationScore;
};

function readJson<T>(p: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(p, "utf-8")) as T;
  } catch {
    return null;
  }
}

function isFresh(iso: unknown, maxMonths = 12): boolean {
  if (!iso || typeof iso !== "string") return false;
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return false;
    return Date.now() - d.getTime() < maxMonths * 30 * 24 * 3600 * 1000;
  } catch {
    return false;
  }
}

function computeBlocks(d: AnyCo, ticker: string, logoSet: Set<string>): Record<string, BlockStatus> {
  const kpis = Array.isArray(d.kpis) ? d.kpis : [];
  const heroShort = d.hero_kpi || "";
  const hero = kpis.find((k) => k && k.short === heroShort) ?? kpis[0];
  const heroHist = hero && Array.isArray(hero.history) ? hero.history.filter((v) => v != null) : [];
  const risks = Array.isArray(d.risks) ? d.risks : [];
  const events = Array.isArray(d.events) ? d.events : [];
  const gov = d.governance ?? {};
  const ai = d.ai_positioning ?? {};
  const ranksObj = d.ranks ?? {};
  const seg = d.revenue_by_segment ?? {};
  const geo = d.revenue_by_geography ?? {};
  const segOk = Array.isArray(seg.slices) && seg.slices.length >= 2;
  const geoOk = Array.isArray(geo.slices) && geo.slices.length >= 2;
  const mp = d.market_positions;
  const logoSafe = ticker.replace(/\./g, "-").replace(/\//g, "-").toUpperCase();

  const heroLastDate = (hero as { last_data_date?: string })?.last_data_date;
  const anyKpiDate = (kpis.find((k) => (k as { last_data_date?: string })?.last_data_date) as { last_data_date?: string })?.last_data_date;
  const lastDate = heroLastDate || anyKpiDate || (d.last_data_date as string | undefined);
  const extractedAt = d._extracted_at as string | undefined;
  const dataFresh = isFresh(lastDate, 12) || isFresh(extractedAt, 6);
  const heroFresh = dataFresh;

  return {
    hero_kpi: { a: !!(heroShort && hero), b: dataFresh, c: !!(heroShort && hero && hero.value != null) },
    hero_history: { a: heroHist.length >= 4, b: heroFresh, c: heroHist.length >= 4 },
    kpis_count: { a: kpis.length >= 5, b: dataFresh, c: kpis.length >= 5 },
    risks: { a: risks.length >= 3, b: dataFresh, c: risks.length > 0 },
    governance: { a: !!(gov as { ceo_name?: string }).ceo_name, b: dataFresh, c: !!(gov as { ceo_name?: string }).ceo_name },
    ai_pos: { a: !!(ai as { stance?: string }).stance, b: dataFresh, c: !!(ai as { stance?: string }).stance },
    segment: { a: segOk, b: dataFresh, c: segOk || geoOk },
    geography: { a: geoOk, b: dataFresh, c: segOk || geoOk },
    events: { a: events.length >= 2, b: isFresh(extractedAt, 1) || dataFresh, c: events.length > 0 },
    tam: { a: Array.isArray(mp) && mp.length > 0, b: dataFresh, c: Array.isArray(mp) && mp.length > 0 },
    ranks: { a: !!(ranksObj as { global_world?: unknown }).global_world, b: isFresh(extractedAt, 6), c: !!(ranksObj as { global_world?: unknown }).global_world },
    logo: { a: logoSet.has(logoSafe), b: true, c: logoSet.has(logoSafe) },
  };
}

function mergeEnrich(base: AnyCo, enrich: AnyCo | null): AnyCo {
  const out: AnyCo = { ...base };
  if (!enrich) return out;
  for (const key of ["events", "revenue_by_segment", "revenue_by_geography", "customer_type", "market_positions", "company_description"] as const) {
    if ((enrich as Record<string, unknown>)[key] !== undefined && (out as Record<string, unknown>)[key] === undefined) {
      (out as Record<string, unknown>)[key] = (enrich as Record<string, unknown>)[key];
    }
  }
  for (const key of ["risks", "governance", "ai_positioning"] as const) {
    const existing = (out as Record<string, unknown>)[key];
    const empty = existing === undefined || existing === null
      || (Array.isArray(existing) && existing.length === 0);
    if (empty && (enrich as Record<string, unknown>)[key] !== undefined) {
      (out as Record<string, unknown>)[key] = (enrich as Record<string, unknown>)[key];
    }
  }
  return out;
}

function buildRows(): CurationRow[] {
  const root = process.cwd();
  const merged = readJson<Record<string, AnyCo>>(path.join(root, "src/data/v2-pipeline/_merged.json")) ?? {};
  const v17 = readJson<Record<string, unknown>>(path.join(root, "src/data/v1-7-public.json")) ?? {};
  const top307Raw = readJson<unknown>(path.join(root, "src/data/v1-8-tickers-sorted.json"));
  const top307Arr: string[] = Array.isArray(top307Raw)
    ? (top307Raw as string[])
    : ((top307Raw as { tickers?: string[] })?.tickers ?? []);
  const top307 = new Set(top307Arr.slice(0, 307));
  const enrichDir = path.join(root, "src/data/v2-pipeline-enrich");

  // Visual audit fails par ticker
  type VARaw = { ticker?: string; fails?: VisualFail[]; n_fails?: number };
  const va = readJson<{ results?: Record<string, VARaw> }>(path.join(root, "src/data/visual-audit.json"));
  const vaResults = va?.results ?? {};
  const visualAuditTickers = new Set(Object.keys(vaResults).map((k) => k.toUpperCase()));

  const logoSet = new Set<string>();
  try {
    for (const f of fs.readdirSync(path.join(root, "public/logos"))) {
      logoSet.add(f.replace(/\.(png|svg)$/i, "").toUpperCase());
    }
  } catch {}

  const rows: CurationRow[] = [];
  for (const [tk, base] of Object.entries(merged)) {
    if (!base || typeof base !== "object") continue;
    const tkLower = tk.toLowerCase();
    const tkUpper = tk.toUpperCase();
    const enrich = readJson<AnyCo>(path.join(enrichDir, `${tkLower}.json`));
    const d = mergeEnrich(base, enrich);
    const blocks = computeBlocks(d, tk, logoSet);

    const vaRow = vaResults[tkUpper] ?? vaResults[tk];
    const visualFails = (vaRow?.fails ?? []).filter((f) => typeof f.severity === "number");
    const visualAuditMissing = !visualAuditTickers.has(tkUpper);

    const score = computeCurationScore({ blocks, visualFails, visualAuditMissing });

    rows.push({
      ticker: tk,
      name: String(d.name || tk),
      in_top307: top307.has(tk),
      in_v17: tk in v17,
      score,
    });
  }

  // Tri : top 307 d'abord, puis par score (vert > jaune > orange > rouge)
  const COLOR_RANK: Record<CurationScore["color"], number> = { green: 0, yellow: 1, orange: 2, red: 3 };
  rows.sort((a, b) => {
    if (a.in_top307 !== b.in_top307) return a.in_top307 ? -1 : 1;
    const cr = COLOR_RANK[a.score.color] - COLOR_RANK[b.score.color];
    if (cr !== 0) return cr;
    return b.score.blocksGood - a.score.blocksGood;
  });
  return rows;
}

export default async function CuratedCompaniesPage() {
  const rows = buildRows();
  return <CuratedCompaniesClient rows={rows} />;
}
