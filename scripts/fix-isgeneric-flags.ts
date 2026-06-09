/**
 * fix-isgeneric-flags.ts — corrige les flags `is_generic=true` ERRONÉS posés
 * sur des KPIs SPÉCIFIQUES (ex AAPL "iPhone Revenue").
 *
 * Le flag `is_generic` n'est PAS lu par les pages publiques (company-view trie
 * les génériques via `isGenericKpi` PAR NOM). Il reste lu par l'admin
 * /admin/kpis-toggle (classement générique/spécifique) et le qualifieur. Le
 * flag est "mal posé" sur des KPIs spécifiques : on le remet à false là où le
 * KPI n'est PAS générique.
 *
 * "Générique" = isGenericKpi(short) (library EN) OU un générique FR/variante
 * connu (GENERIC_EXTRA, set exact). On NE dé-flague QUE les vrais spécifiques :
 * les sectoriels (NII, CET1, Occupancy, Comparable Sales...) restent dé-flagués
 * (= spécifiques, cf §0septies), les comptables FR/variantes (Marge brute,
 * SG&A, Adjusted EBITDA...) restent flagués.
 *
 * Scope : univers V195 ∪ online, fichiers canoniques
 * v2-pipeline/<t>.json + v2-pipeline-enrich/<t>.json uniquement.
 *
 * Usage : source .env.local && npx tsx scripts/fix-isgeneric-flags.ts        (audit)
 *         source .env.local && npx tsx scripts/fix-isgeneric-flags.ts --fix   (écrit)
 */
import { isGenericKpi } from "../src/lib/kpi-generic";
import { createClient } from "@supabase/supabase-js";
import V195FILE from "../src/data/v1-9-5-clean-all-tickers.json";
import fs from "fs";
import path from "path";

const FIX = process.argv.includes("--fix");

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

// Génériques comptables FR + variantes EN que isGenericKpi (library EN) rate.
// Match EXACT normalisé (pas de substring : "iPhone Revenue" ne doit pas matcher).
const GENERIC_EXTRA = new Set<string>([
  // FR
  "marge brute", "marge opérationnelle", "marge d'exploitation", "marge nette",
  "marge d'ebitda", "marge ebitda", "bénéfice net", "bénéfice net part du groupe",
  "bénéfice net actionnaires", "résultat net", "résultat net part du groupe",
  "résultat net on", "résultat opérationnel", "résultat d'exploitation",
  "revenu", "revenu total", "revenus", "revenu 2025", "chiffre d'affaires",
  "chiffre d'affaires net", "chiffre d'affaires total", "produits", "total des produits",
  "effectif", "effectifs", "effectif (employés)", "dépenses d'investissement",
  "investissements r&d (% revenu)", "trésorerie", "flux de trésorerie",
  "capitaux propres", "dette nette", "dette totale", "bénéfice par action",
  "bénéfice par action dilué", "dividende par action", "eps dilué", "eps (diluté)",
  "charges d'exploitation", "coût des ventes", "frais généraux", "résultat avant impôts",
  // EN variantes (générique comptable, hors library exacte)
  "adjusted ebitda", "gross profit", "gross profit margin", "net earnings",
  "net loss", "net profit", "net income", "total revenues", "net revenues",
  "net revenue", "operating revenue", "operating revenues", "operating expenses",
  "operating expense", "sg&a", "selling general and administrative",
  "selling, general and administrative", "interest expense", "stockholders equity",
  "shareholders equity", "total stockholders equity", "cash flow",
  "cash flow from operations", "cash flow from operating activities", "cash operating",
  "cash balance", "cash", "revenues", "sales", "net sales", "total net sales",
  "total net revenues", "basic eps", "eps (diluted)", "diluted eps",
  "diluted earnings per share", "earnings per share", "ebitda margin", "ebitda",
  "ebit", "operating income", "operating income margin", "operating margin",
  "operating margin %", "op margin", "operating cash flow", "op cash flow",
  "capital expenditures", "capital expenditure", "capex", "book value per share",
  "dividend", "dividends", "dividends per share", "cost of sales", "cost of revenue",
  "cost of revenues", "gross margin", "gross margin %", "r&d", "r&d %",
  "r&d expense", "r&d expenses", "r&d intensity", "adjusted operating margin",
  "recurring revenues", "cost-income", "pretax income", "income before taxes",
  "free cash flow", "fcf", "roic", "roce", "return on equity", "return on assets",
  "leverage ratio", "market cap", "net margin", "payout ratio", "dps", "cap return",
  "total assets", "total debt", "net debt", "cash & equivalents", "total liabilities",
  "total employees", "employees", "number of employees", "headcount",
  // colmatage variantes comptables génériques (2e passe audit)
  "employees (fte)", "adjusted eps", "adjusted diluted eps", "ebita", "ebita margin",
  "long-term debt", "long term debt", "short-term debt", "adjusted gross profit",
  "cash and cash equivalents", "flux de trésorerie disponible", "consolidated revenues",
  "consolidated revenue", "pre-tax operating margin", "pretax operating margin",
  "adjusted operating income", "invested capital", "adjusted net income",
  "adjusted net profit", "group revenue", "total income", "reported revenue",
]);

function isGenericExtended(short: string): boolean {
  if (isGenericKpi(short)) return true;
  return GENERIC_EXTRA.has(normalize(short));
}

async function universe(): Promise<string[]> {
  const v195 = (V195FILE as { tickers: string[] }).tickers.map((t) => t.toLowerCase());
  let online: string[] = [];
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (url && key) {
    try {
      const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
      const { data } = await sb.from("desk_curated_companies").select("ticker, min_plan");
      online = (data ?? [])
        .filter((r: { min_plan?: string | null }) => r.min_plan && r.min_plan !== "hidden")
        .map((r: { ticker: string }) => String(r.ticker).toLowerCase());
    } catch { /* best effort */ }
  }
  return Array.from(new Set([...v195, ...online]));
}

let unflagged = 0;
let keptGeneric = 0;
let filesChanged = 0;
const unflaggedShorts: Record<string, number> = {};

function walkKpis(kpis: unknown[]): boolean {
  let changed = false;
  for (const k of kpis) {
    if (k && typeof k === "object") {
      const o = k as Record<string, unknown>;
      if (typeof o.short === "string" && o.is_generic === true) {
        if (isGenericExtended(o.short)) { keptGeneric++; }
        else {
          unflagged++;
          unflaggedShorts[o.short] = (unflaggedShorts[o.short] || 0) + 1;
          if (FIX) { o.is_generic = false; changed = true; }
        }
      }
    }
  }
  return changed;
}

(async () => {
  const uni = await universe();
  for (const dir of ["src/data/v2-pipeline", "src/data/v2-pipeline-enrich"]) {
    for (const t of uni) {
      const fp = path.join(process.cwd(), dir, `${t}.json`);
      if (!fs.existsSync(fp)) continue;
      let json: any;
      try { json = JSON.parse(fs.readFileSync(fp, "utf-8")); } catch { continue; }
      let changed = false;
      if (Array.isArray(json.kpis)) changed = walkKpis(json.kpis) || changed;
      if (Array.isArray(json.kpis_supplementary)) changed = walkKpis(json.kpis_supplementary) || changed;
      if (FIX && changed) { fs.writeFileSync(fp, JSON.stringify(json, null, 2) + "\n"); filesChanged++; }
    }
  }
  const top = Object.entries(unflaggedShorts).sort((a, b) => b[1] - a[1]);
  console.log(`Univers: ${uni.length} tickers`);
  console.log(`is_generic=true gardés (génériques EN+FR+variantes): ${keptGeneric}`);
  console.log(`is_generic=true → false (vrais spécifiques): ${unflagged}  (${Object.keys(unflaggedShorts).length} distinct)`);
  console.log(`\nDé-flagués (top 60) :\n` + top.slice(0, 60).map(([s, n]) => `  ${n}× ${s}`).join("\n"));
  if (FIX) console.log(`\n✅ ${filesChanged} fichiers réécrits.`);
  else console.log(`\n(audit — relancer avec --fix pour appliquer)`);
})();
