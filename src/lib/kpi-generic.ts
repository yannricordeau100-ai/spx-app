/**
 * Helper isGenericKpi (Yann 19 mai 2026).
 *
 * Marque les KPIs bas/milieu de gamme communs à 95 % des sociétés
 * (Revenue, Op Margin, EPS, EBITDA, FCF, Headcount, etc.). Ils sont
 * conservés en data mais MASQUÉS du rendu app par défaut, car ils
 * n'apportent aucune PV différentiante vs un screener gratuit Yahoo /
 * Google Finance.
 *
 * Source de vérité : `src/data/kpi-generic-library.json` (29 KPIs FR + EN).
 *
 * Activation possible par catégorie (sp500, top307, V1.9, etc.) via le
 * bloc `/sandbox/kpi-quality-strategy` → écrit dans
 * `src/data/generic-kpi-activations.json` (à venir).
 */

import GENERIC_LIBRARY from "@/data/kpi-generic-library.json";

type GenericEntry = {
  short: string;
  name_fr: string;
  name_en: string;
  family: string;
};

const GENERIC_LIB = GENERIC_LIBRARY as unknown as GenericEntry[];

// Set de tous les `short` génériques, normalisés (lowercase + trim).
const GENERIC_SHORTS = new Set(GENERIC_LIB.map((g) => g.short.toLowerCase().trim()));

// Matching tolérant : certains datasets ont des variations de casse ou
// d'espaces. Ex "Total Revenue" / "total revenue" / " TotalRevenue".
function normalize(s: string | null | undefined): string {
  if (typeof s !== "string") return "";
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Retourne true si le KPI (par son `short`) est dans la library générique.
 * Le matching est tolérant : casse + espaces normalisés.
 */
export function isGenericKpi(short: string | null | undefined): boolean {
  if (!short) return false;
  const n = normalize(short);
  // 1. Match strict (normalisé)
  if (GENERIC_SHORTS.has(n)) return true;
  // 2. Match variant : "Revenue" matche "Total Revenue"
  for (const g of GENERIC_SHORTS) {
    if (n === g) return true;
    // Aliases simples : "Revenue" → "Total Revenue"
    if (g === "total revenue" && n === "revenue") return true;
    if (g === "operating income" && (n === "op income" || n === "operating profit" || n === "ebit" || n === "recurring oi" || n === "recurring operating income" || n === "recurring op income")) return true;
    if (g === "operating margin" && (n === "op margin" || n === "operating margin %")) return true;
    if (g === "net income" && n === "net profit") return true;
    if (g === "net margin" && n === "net margin %") return true;
    if (g === "gross margin" && n === "gross margin %") return true;
    if (g === "free cash flow" && (n === "fcf" || n === "free cashflow" || n === "adjusted fcf" || n === "adjusted free cash flow")) return true;
    if (g === "operating cash flow" && (n === "ocf" || n === "operating cashflow")) return true;
    if (g === "eps" && (n === "earnings per share" || n === "eps diluted" || n === "diluted eps")) return true;
    if (g === "dps" && (n === "dividend per share" || n === "dividende par action")) return true;
    if (g === "cap return" && (n === "capital return" || n === "capital returned")) return true;
    if (g === "buybacks" && (n === "share buybacks" || n === "stock buybacks")) return true;
    if (g === "r&d" && (n === "research and development" || n === "rd expense")) return true;
    if (g === "capex" && (n === "capital expenditure" || n === "capital expenditures")) return true;
    if (g === "headcount" && (n === "employees" || n === "employés" || n === "effectif")) return true;
    if (g === "total assets" && n === "assets") return true;
    if (g === "total debt" && n === "debt") return true;
    if (g === "net debt" && n === "netdebt") return true;
    if (g === "leverage ratio" && (n === "debt to ebitda" || n === "leverage")) return true;
    if (g === "cash & equivalents" && (n === "cash" || n === "cash and equivalents")) return true;
    if (g === "roe" && n === "return on equity") return true;
    if (g === "roic" && n === "return on invested capital") return true;
    if (g === "p/e ratio" && (n === "pe ratio" || n === "p/e")) return true;
    if (g === "market cap" && (n === "market capitalization" || n === "market cap usd")) return true;
    if (g === "shares outstanding" && n === "shares") return true;
    if (g === "tax rate" && (n === "effective tax rate" || n === "tax")) return true;
    if (g === "payout ratio" && n === "payout") return true;
  }
  return false;
}

/**
 * Retourne la library complète (utile pour l'UI sandbox).
 */
export function getGenericLibrary(): GenericEntry[] {
  return GENERIC_LIB;
}
