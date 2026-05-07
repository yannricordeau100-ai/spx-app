#!/usr/bin/env tsx
/**
 * audit-data-types.ts — vérifie l'intégrité des types de données pour
 * TOUTES les sés du pipeline `v2-pipeline/_merged.json`.
 *
 * Détecte les bugs silencieux qui cassent le rendu UI sans erreur claire :
 *   - `unit / type / short` du hero KPI à null (au lieu de string)
 *   - `value / yoy` du hero à null (au lieu de string ou number)
 *   - `history` du hero à null (au lieu de tableau)
 *   - `hero_kpi` qui pointe sur un short qui n'existe pas dans `kpis[]`
 *   - `governance.top_capital` à null (au lieu de [])
 *   - `ai_positioning` avec stance=null
 *   - `market_positions[].slices` à null
 *
 * Sortie :
 *   - stdout : compteurs par catégorie + sample tickers
 *   - fichier : `src/data/v2-pipeline-type-defects.json` { ticker → [codes] }
 *
 * Yann 7 mai 2026 : "ce genre d'erreur n'est vraiment pas professionnel".
 * On audite à chaque rebuild + on coerce défensivement dans load-company.ts
 * pour que l'utilisateur ne voie jamais une page cassée même si la donnée
 * est imparfaite.
 *
 * Usage :
 *   npx tsx scripts/audit-data-types.ts
 */
import { readFileSync, writeFileSync } from "fs";
import path from "path";

const ROOT = process.cwd();
const MERGED = path.join(ROOT, "src/data/v2-pipeline/_merged.json");
const OUT = path.join(ROOT, "src/data/v2-pipeline-type-defects.json");

type AnyRec = Record<string, unknown>;

const merged = JSON.parse(readFileSync(MERGED, "utf-8")) as Record<string, AnyRec>;
const defects: Record<string, string[]> = {};
const counters: Record<string, number> = {};

function flag(ticker: string, code: string) {
  if (!defects[ticker]) defects[ticker] = [];
  if (!defects[ticker].includes(code)) defects[ticker].push(code);
  counters[code] = (counters[code] ?? 0) + 1;
}

for (const [ticker, e] of Object.entries(merged)) {
  if (!e || typeof e !== "object") continue;

  // hero KPI checks
  const heroShort = e.hero_kpi as string | undefined;
  const kpis = (e.kpis as AnyRec[]) ?? [];
  const heroByShort = heroShort ? kpis.find((k) => k.short === heroShort) : undefined;
  const hero = heroByShort ?? kpis[0];

  if (!heroShort) flag(ticker, "NO_HERO_KPI");
  if (heroShort && !heroByShort) flag(ticker, "HERO_SHORT_NOT_FOUND");

  if (hero) {
    if (hero.value === null || hero.value === undefined) flag(ticker, "HERO_VALUE_NULL");
    else if (typeof hero.value !== "string" && typeof hero.value !== "number") flag(ticker, "HERO_VALUE_BAD_TYPE");

    if (hero.yoy !== undefined && hero.yoy !== null && typeof hero.yoy !== "string" && typeof hero.yoy !== "number") {
      flag(ticker, "HERO_YOY_BAD_TYPE");
    }
    if (hero.type !== undefined && hero.type !== null && typeof hero.type !== "string") flag(ticker, "HERO_TYPE_BAD");
    if (hero.unit !== undefined && hero.unit !== null && typeof hero.unit !== "string") flag(ticker, "HERO_UNIT_BAD");
    if (hero.unit === null) flag(ticker, "HERO_UNIT_NULL");
    if (hero.type === null) flag(ticker, "HERO_TYPE_NULL");
    if (hero.history !== undefined && hero.history !== null && !Array.isArray(hero.history)) {
      flag(ticker, "HERO_HISTORY_NOT_ARRAY");
    }
    if (hero.history === null) flag(ticker, "HERO_HISTORY_NULL");
  }

  // governance
  const gov = e.governance as AnyRec | undefined;
  if (gov) {
    if (gov.top_capital !== undefined && !Array.isArray(gov.top_capital)) flag(ticker, "GOV_TOP_CAPITAL_NOT_ARRAY");
    if (gov.top_voting !== undefined && !Array.isArray(gov.top_voting)) flag(ticker, "GOV_TOP_VOTING_NOT_ARRAY");
  }

  // ai_positioning
  const ai = e.ai_positioning as AnyRec | undefined;
  if (ai) {
    if (ai.stance === null) flag(ticker, "AI_STANCE_NULL");
    if (ai.evidence === null) flag(ticker, "AI_EVIDENCE_NULL");
    if (ai.evidence !== undefined && ai.evidence !== null && !Array.isArray(ai.evidence)) flag(ticker, "AI_EVIDENCE_NOT_ARRAY");
  }

  // market_positions
  if (Array.isArray(e.market_positions)) {
    for (const mp of e.market_positions as AnyRec[]) {
      if (mp.slices !== undefined && mp.slices !== null && !Array.isArray(mp.slices)) {
        flag(ticker, "MP_SLICES_NOT_ARRAY");
        break;
      }
    }
  }

  // ranks
  const ranks = e.ranks as AnyRec | undefined;
  if (ranks) {
    for (const k of ["global_world", "global_us", "sector", "subsector"]) {
      const v = ranks[k];
      if (v !== undefined && v !== null && typeof v !== "string") {
        flag(ticker, "RANKS_BAD_TYPE");
        break;
      }
    }
  }
}

writeFileSync(OUT, JSON.stringify(defects, null, 2));

const total = Object.keys(merged).length;
console.log(`📊 Type audit ${total} sés du pipeline\n`);
const sortedCounters = Object.entries(counters).sort((a, b) => b[1] - a[1]);
for (const [code, n] of sortedCounters) {
  const pct = Math.round((n * 100) / total);
  const samples = Object.entries(defects)
    .filter(([, codes]) => codes.includes(code))
    .slice(0, 3)
    .map(([t]) => t)
    .join(", ");
  console.log(`  ${code.padEnd(28)} ${String(n).padStart(4)} (${String(pct).padStart(3)} %)  ${samples}`);
}
console.log(`\n✅ Détail : ${OUT}`);
console.log(`📌 Sés affectées : ${Object.keys(defects).length} / ${total}`);
