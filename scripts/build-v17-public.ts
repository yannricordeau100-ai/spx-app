#!/usr/bin/env tsx
/**
 * Génère src/data/v1-7-public.json (~300KB) à partir de _merged.json (16MB).
 *
 * Garde uniquement :
 *   - stés validées par Sonnet (_validation OU _validation_global)
 *   - kpis non vide
 *   - hero KPI dont les champs string requis (value/yoy/type/unit/short)
 *     sont bien présents (sinon rate(), parsePct(), formatUnit() crashent
 *     côté HomeView et la home plante en 500)
 *
 * Strip les champs non-utilisés par la home (KPI table, risks, gov, etc.)
 * pour minimiser le bundle. Les pages détail /sandbox/v1-7/[ticker] lisent
 * directement _merged.json (route distincte, pas de bundling de tout).
 *
 * Lancer après chaque rebuild de _merged.json par CONV-DATA :
 *   $ npx tsx scripts/build-v17-public.ts
 */
import * as fs from "node:fs";
import * as path from "node:path";

const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "src/data/v2-pipeline/_merged.json");
const DST = path.join(ROOT, "src/data/v1-7-public.json");

type AnyKPI = {
  short?: unknown;
  value?: unknown;
  yoy?: unknown;
  type?: unknown;
  unit?: unknown;
  name_fr?: unknown;
  name_en?: unknown;
  last_data_date?: unknown;
};

type AnyCo = {
  ticker?: string;
  name?: string;
  sector?: string;
  subsector?: string;
  hero_kpi?: string;
  next_earnings_date?: string;
  kpis?: AnyKPI[];
  _validation?: unknown;
  _validation_global?: unknown;
};

const merged = JSON.parse(fs.readFileSync(SRC, "utf-8")) as Record<string, AnyCo>;

const out: Record<string, unknown> = {};
let kept = 0;
let skipped = 0;

for (const [t, v] of Object.entries(merged)) {
  if (!v || typeof v !== "object") {
    skipped++;
    continue;
  }
  if (!v._validation && !v._validation_global) {
    skipped++;
    continue;
  }
  if (!Array.isArray(v.kpis) || v.kpis.length === 0) {
    skipped++;
    continue;
  }
  const hero =
    v.kpis.find((k) => k && typeof k === "object" && (k as AnyKPI).short === v.hero_kpi) ??
    v.kpis[0];
  if (
    !hero ||
    typeof (hero as AnyKPI).value !== "string" ||
    typeof (hero as AnyKPI).yoy !== "string" ||
    typeof (hero as AnyKPI).type !== "string" ||
    typeof (hero as AnyKPI).unit !== "string" ||
    typeof (hero as AnyKPI).short !== "string"
  ) {
    skipped++;
    continue;
  }
  out[t] = {
    ticker: v.ticker,
    name: v.name,
    sector: v.sector,
    subsector: v.subsector,
    hero_kpi: v.hero_kpi,
    next_earnings_date: v.next_earnings_date,
    kpis: [hero],
  };
  kept++;
}

fs.writeFileSync(DST, JSON.stringify(out));
const sizeKB = Math.round(fs.statSync(DST).size / 1024);
console.log(`✅ v1-7-public.json regénéré : ${kept} stés (${skipped} skip), ${sizeKB} KB`);
