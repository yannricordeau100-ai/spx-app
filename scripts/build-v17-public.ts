#!/usr/bin/env tsx
/**
 * Génère src/data/v1-7-public.json à partir de _merged.json.
 *
 * Filtre admission strict = `isStrictPass3` (cf.
 * src/lib/v1-7/strict-pass3.ts) — source unique de vérité partagée avec
 * la page ticker `/sandbox/v1-7/[ticker]`. Sans cet alignement, le hub
 * peut afficher des cartes qui mènent à des pages "Fiche en préparation".
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
import { isStrictPass3 } from "../src/lib/v1-7/strict-pass3";

const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "src/data/v2-pipeline/_merged.json");
const DST = path.join(ROOT, "src/data/v1-7-public.json");
const ENRICH_DIR = path.join(ROOT, "src/data/v2-pipeline-enrich");

/**
 * Yann 17 mai 2026 : injecte le flag `_adr_duplicate_of` depuis l'enrich
 * file dans la sté avant le check isStrictPass3. Ça permet de masquer
 * les ADR US doublons (ex BABA → 9988.HK) du hub sans toucher au merged
 * principal.
 */
function injectEnrichFlags(ticker: string, base: AnyCo): AnyCo {
  const enrichPath = path.join(ENRICH_DIR, `${ticker.toLowerCase()}.json`);
  if (!fs.existsSync(enrichPath)) return base;
  try {
    const e = JSON.parse(fs.readFileSync(enrichPath, "utf-8")) as Record<string, unknown>;
    if (typeof e._adr_duplicate_of === "string") {
      return { ...base, _adr_duplicate_of: e._adr_duplicate_of };
    }
  } catch {}
  return base;
}

type AnyKPI = Record<string, unknown>;
type AnyCo = Record<string, unknown> & {
  ticker?: string;
  name?: string;
  sector?: string;
  subsector?: string;
  hero_kpi?: string;
  next_earnings_date?: string;
  kpis?: AnyKPI[];
};

const merged = JSON.parse(fs.readFileSync(SRC, "utf-8")) as Record<string, AnyCo>;

const out: Record<string, unknown> = {};
let kept = 0;
let skipped = 0;

for (const [t, vRaw] of Object.entries(merged)) {
  const v = injectEnrichFlags(t, vRaw);
  if (!isStrictPass3(v)) {
    skipped++;
    continue;
  }
  const heroShort = v.hero_kpi;
  const hero =
    (Array.isArray(v.kpis) ? v.kpis.find((k) => k && (k as AnyKPI).short === heroShort) : undefined) ??
    (Array.isArray(v.kpis) ? v.kpis[0] : undefined);
  if (!hero) {
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
console.log(`✅ v1-7-public.json regénéré (Pass 3 strict) : ${kept} stés (${skipped} skip), ${sizeKB} KB`);
