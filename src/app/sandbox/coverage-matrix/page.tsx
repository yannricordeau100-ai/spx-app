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
};

export type Row = {
  ticker: string;
  name: string;
  in_top307: boolean;
  in_v17: boolean;
  hero_kpi: "ok" | "missing";
  hero_history: "complete" | "partial" | "missing";
  kpis_count: "ok" | "partial" | "missing";
  risks: "ok" | "partial" | "missing";
  governance: "ok" | "missing";
  ai_pos: "ok" | "missing";
  segment: "ok" | "missing";
  geography: "ok" | "missing";
  customer_type: "ok" | "missing";
  events: "ok" | "partial" | "missing";
  tam: "ok" | "missing";
  description: "ok" | "missing";
  freshness: "ok" | "missing";
  ranks: "ok" | "missing";
  logo: "ok" | "missing";
  transcript: "ok" | "missing";
  fit: boolean;
  missing_count: number;
};

function readJson<T>(p: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(p, "utf-8")) as T;
  } catch {
    return null;
  }
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

  const logoDir = path.join(root, "public/logos");
  const logoSet = new Set<string>();
  try {
    for (const f of fs.readdirSync(logoDir)) {
      logoSet.add(f.replace(/\.(png|svg)$/i, "").toUpperCase());
    }
  } catch {}

  const transcriptDir = path.join(root, "src/data/transcript-summaries");
  const transcriptSet = new Set<string>();
  try {
    for (const f of fs.readdirSync(transcriptDir)) {
      if (f.endsWith(".json")) transcriptSet.add(f.replace(/\.json$/i, "").toUpperCase());
    }
  } catch {}

  const rows: Row[] = [];
  for (const [tk, d] of Object.entries(merged)) {
    if (!d || typeof d !== "object") continue;
    const kpis = Array.isArray(d.kpis) ? d.kpis : [];
    const heroShort = d.hero_kpi || "";
    const hero = kpis.find((k) => k && k.short === heroShort) ?? kpis[0];
    const heroHist = hero && Array.isArray(hero.history) ? hero.history.filter((v) => v != null) : [];
    const risks = Array.isArray(d.risks) ? d.risks : [];
    const events = Array.isArray(d.events) ? d.events : [];
    const gov = (d.governance as Record<string, unknown>) ?? {};
    const ai = (d.ai_positioning as Record<string, unknown>) ?? {};
    const ranks = (d.ranks as Record<string, unknown>) ?? {};
    const seg = (d.revenue_by_segment as { slices?: unknown[] }) ?? {};
    const geo = (d.revenue_by_geography as { slices?: unknown[] }) ?? {};
    const logoSafe = tk.replace(/\./g, "-").replace(/\//g, "-").toUpperCase();

    const row: Row = {
      ticker: tk,
      name: String(d.name || tk),
      in_top307: top307.has(tk),
      in_v17: tk in v17,
      hero_kpi: heroShort && hero ? "ok" : "missing",
      hero_history: heroHist.length >= 4 ? "complete" : heroHist.length >= 1 ? "partial" : "missing",
      kpis_count: kpis.length >= 5 ? "ok" : kpis.length >= 1 ? "partial" : "missing",
      risks: risks.length >= 3 ? "ok" : risks.length >= 1 ? "partial" : "missing",
      governance: gov.ceo_name ? "ok" : "missing",
      ai_pos: ai.stance ? "ok" : "missing",
      segment: Array.isArray(seg.slices) && seg.slices.length >= 2 ? "ok" : "missing",
      geography: Array.isArray(geo.slices) && geo.slices.length >= 2 ? "ok" : "missing",
      customer_type: d.customer_type ? "ok" : "missing",
      events: events.length >= 2 ? "ok" : events.length >= 1 ? "partial" : "missing",
      tam: Array.isArray(d.market_positions) && d.market_positions.length > 0 ? "ok" : "missing",
      description: d.company_description && String(d.company_description).length >= 50 ? "ok" : "missing",
      freshness: d.last_data_date ? "ok" : "missing",
      ranks: ranks.global_world ? "ok" : "missing",
      logo: logoSet.has(logoSafe) ? "ok" : "missing",
      transcript: transcriptSet.has(tk.toUpperCase()) ? "ok" : "missing",
      fit: d._fit_for_site !== false,
      missing_count: 0,
    };

    const checks: Array<Row[keyof Row]> = [
      row.hero_kpi, row.hero_history, row.kpis_count, row.risks, row.governance,
      row.ai_pos, row.segment, row.geography, row.customer_type, row.events,
      row.tam, row.description, row.freshness, row.ranks, row.logo, row.transcript,
    ];
    row.missing_count = checks.filter((c) => c === "missing" || c === "partial").length;
    rows.push(row);
  }

  rows.sort((a, b) => {
    if (a.in_top307 !== b.in_top307) return a.in_top307 ? -1 : 1;
    return a.missing_count - b.missing_count;
  });
  return rows;
}

export default function CoverageMatrixPage() {
  const rows = buildRows();
  return <CoverageClient initialRows={rows} />;
}
