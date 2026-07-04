/**
 * Harnais E2E KPI (Yann 4 juillet 2026).
 *
 * Reproduit EXACTEMENT ce que l'UI affiche pour chaque KPI de chaque ticker
 * (vue Trimestriel = injection kpis-haut de load-company.ts ; vue Annuel =
 * aggregateQuarterlyToAnnual, la vraie fonction du site, pas un portage) et
 * verifie les invariants d'affichage. Detecte les bugs de pipeline de rendu
 * que la seule verification des JSON ne voit pas (ex: vue Annuel vide,
 * tri casse, doublons).
 *
 * Usage: npx tsx scripts/verify-ui-kpis.mts
 */
import { readFileSync, readdirSync } from "fs";
import path from "path";
import { aggregateQuarterlyToAnnual, getKpiAggregationKind } from "../src/lib/kpi-aggregation";

const ROOT = path.resolve(new URL(".", import.meta.url).pathname, "..");
const KPIS_DIR = path.join(ROOT, ".batches-drafts-safe/kpis-haut");
const fiscalAudit: Record<string, { fiscalYearEndMonth?: number }> = (() => {
  try {
    const raw = JSON.parse(readFileSync(path.join(ROOT, "src/data/fiscal-audit.json"), "utf-8"));
    // format possible: {audits:[{ticker, fiscalYearEndMonth}]} ou map directe
    if (Array.isArray(raw?.audits)) {
      const m: Record<string, { fiscalYearEndMonth?: number }> = {};
      for (const a of raw.audits) if (a?.ticker) m[String(a.ticker).toUpperCase()] = a;
      return m;
    }
    return raw;
  } catch {
    return {};
  }
})();

// === Reproduction fidele de l'injection kpis-haut (load-company.ts) ===
const periodKey = (q: string): number => {
  let m = q.match(/^Q([1-4])-(?:FY)?(\d{4})$/i);
  if (m) return Number(m[2]) * 10 + Number(m[1]);
  m = q.match(/^FY(\d{4})$/i);
  if (m) return Number(m[1]) * 10 + 5;
  return Number.MAX_SAFE_INTEGER;
};

type HistEntry = { q: string; v: number };
type Kpi = {
  short: string; name_fr?: string; name_en?: string; unit?: string;
  frequency?: string; history?: HistEntry[];
};

let tickersChecked = 0;
let kpisChecked = 0;
const problems: Array<{ ticker: string; kpi: string; issue: string }> = [];

const files = readdirSync(KPIS_DIR).filter((f) => f.endsWith(".json") && !f.endsWith("_updated.json"));
for (const f of files) {
  const ticker = f.replace(/\.json$/, "");
  let data: { kpis?: Kpi[] };
  try {
    data = JSON.parse(readFileSync(path.join(KPIS_DIR, f), "utf-8"));
  } catch (e) {
    problems.push({ ticker, kpi: "-", issue: `JSON illisible: ${e}` });
    continue;
  }
  if (!Array.isArray(data.kpis)) continue;
  tickersChecked++;
  const fyEnd = fiscalAudit[ticker.toUpperCase()]?.fiscalYearEndMonth ?? 12;

  for (const k of data.kpis) {
    if (!k?.short || !Array.isArray(k.history) || k.history.length === 0) continue;
    kpisChecked++;
    const isAnnualKpi = k.frequency === "annual";
    // === vue Trimestriel (ce que le chart recoit) ===
    const hist = k.history
      .filter((h) => h && typeof h.v === "number")
      .filter((h) => (isAnnualKpi ? /^FY\d{4}$/i.test(h.q) : /^Q[1-4]-/i.test(h.q)))
      .slice()
      .sort((a, b) => periodKey(a.q) - periodKey(b.q));

    if (hist.length === 0) {
      const labelShapes = [...new Set(k.history.map((h) => String(h?.q ?? "?").replace(/\d+/g, "#")))].join(",");
      problems.push({ ticker, kpi: k.short, issue: `serie affichee VIDE apres filtre frequency=${k.frequency} (labels source: ${labelShapes})` });
      continue;
    }
    // Invariant: labels reconnus (periodKey fini)
    const unknown = hist.filter((h) => periodKey(h.q) === Number.MAX_SAFE_INTEGER);
    if (unknown.length > 0) {
      problems.push({ ticker, kpi: k.short, issue: `${unknown.length} labels non reconnus (ex "${unknown[0].q}") -> tri/axe faux` });
    }
    // Invariant: pas de doublons de periode
    const seen = new Set<string>();
    for (const h of hist) {
      if (seen.has(h.q)) { problems.push({ ticker, kpi: k.short, issue: `doublon periode ${h.q}` }); break; }
      seen.add(h.q);
    }

    if (isAnnualKpi) continue;

    // === vue Annuel (la vraie fonction du site) ===
    const values = hist.map((h) => h.v);
    const periods = hist.map((h) => h.q);
    const kind = getKpiAggregationKind({ type: "Volume", unit: k.unit, short: k.short, name_fr: k.name_fr, name_en: k.name_en });
    const agg = aggregateQuarterlyToAnnual(values, null, kind, fyEnd, periods);

    // Y a-t-il au moins une FY complete (4 trimestres) dans la data ?
    const byFy = new Map<number, number[]>();
    for (const h of hist) {
      const m = h.q.match(/^Q([1-4])-(?:FY)?(\d{4})$/i);
      if (!m) continue;
      const fy = Number(m[2]);
      if (!byFy.has(fy)) byFy.set(fy, []);
      byFy.get(fy)!.push(h.v);
    }
    const completeFys = [...byFy.entries()].filter(([, qs]) => qs.length === 4);
    if (completeFys.length > 0 && agg.values.length === 0) {
      problems.push({ ticker, kpi: k.short, issue: `vue ANNUEL vide alors que ${completeFys.length} FY completes existent (bug parse/aggregation)` });
      continue;
    }
    // Invariant flow: valeur annuelle affichee = somme des 4 trimestres
    if (kind === "flow" && agg.values.length > 0) {
      for (const [fy, qs] of completeFys) {
        const idx = agg.years.indexOf(String(fy));
        if (idx === -1) continue;
        const sum = qs.reduce((a, b) => a + b, 0);
        const shown = agg.values[idx];
        if (Math.abs(sum) > 1e-9 && Math.abs(shown - sum) / Math.abs(sum) > 0.01) {
          problems.push({ ticker, kpi: k.short, issue: `Annuel FY${fy} affiche ${shown} != somme trimestres ${sum.toFixed(2)}` });
        }
      }
    }
  }
}

console.log(`Tickers: ${tickersChecked}, KPIs: ${kpisChecked}, Problemes: ${problems.length}`);
const byTicker = new Map<string, typeof problems>();
for (const p of problems) {
  if (!byTicker.has(p.ticker)) byTicker.set(p.ticker, []);
  byTicker.get(p.ticker)!.push(p);
}
console.log(`Tickers touches: ${byTicker.size}`);
for (const [t, ps] of [...byTicker.entries()].sort()) {
  console.log(`\n${t}:`);
  for (const p of ps.slice(0, 12)) console.log(`  ${p.kpi}: ${p.issue}`);
}
