/**
 * kpi-hero-generic.ts : DEFINITION UNIQUE de « KPI generique ou comptable »
 * pour le choix du hero (7 oct 2026).
 *
 * Avant : trois selections de hero (kpis-haut max pv_score, company-view,
 * overrides Supabase) avaient chacune leur idee du generique. isGenericKpi ne
 * connait que la bibliotheque (29 libelles), isTotalRevenueLabel que les CA
 * totaux, isAccountingKpi que les lignes comptables : REV, REV_TOT, rev_q,
 * ca_total, GROUP_REVENUE, CA_SEM, core_eps, eps_diluted_q, net_inc_q, NI_COM
 * passaient entre les trois (48 societes avec un hero banal, mesure du 7 oct).
 *
 * Cette fonction reunit les trois detecteurs et ajoute :
 *  - une detection par NOM (name_fr / name_en normalises : accents, marqueurs
 *    de periode et de perimetre retires) ;
 *  - une detection par SHORT compact (sans underscore ni suffixe de periode).
 * Importee par le chargeur (load-company), company-view et les scripts de
 * controle. Ne jamais redupliquer cette liste ailleurs.
 */
import { isGenericKpi } from "@/lib/kpi-generic";
import { isTotalRevenueLabel } from "@/lib/kpi-total-revenue";
import { isAccountingKpi } from "@/lib/kpi-accounting";

export type KpiNommable = {
  short?: unknown;
  name_fr?: unknown;
  name_en?: unknown;
};

function sansAccents(s: unknown): string {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

// Mots retires d'un NOM avant comparaison : periode, perimetre, forme.
const MOTS_NOM_IGNORES = new Set([
  "de", "du", "des", "la", "le", "les", "d", "l", "of", "the", "and", "et", "s",
  "trimestriel", "trimestrielle", "trimestre", "annuel", "annuelle", "semestriel",
  "semestrielle", "quarterly", "annual", "annualized", "semi", "yearly", "fy", "ttm",
  "ajuste", "ajustee", "adjusted", "adj", "dilue", "diluee", "diluted", "total", "totale",
  "totaux", "consolide", "consolidee", "consolidated", "group", "groupe", "part",
  "attributable", "common", "continuing", "continues", "continue", "activites",
  "operations", "reporte", "reported", "publie", "core",
]);

/** Cle d'un nom : accents et marqueurs retires, mots restants colles par espace. */
function cleNom(s: unknown): string {
  const mots = sansAccents(s)
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter(Boolean);
  const out = mots.filter((m) => !MOTS_NOM_IGNORES.has(m));
  return out.join(" ");
}

// Noms generiques ou comptables (formes FR et EN). Compares apres cleNom.
const NOMS_GENERIQUES = new Set(
  [
    // chiffre d'affaires total
    "cout du risque", "cost of risk",
    "ca", "ca net", "chiffre d'affaires services", "service revenue",
    "primes acquises", "primes acquises nettes", "primes acquises nettes totales", "net premiums earned",
    "chiffre d'affaires", "chiffre d'affaires net", "chiffre d'affaires total", "ventes",
    "ventes nettes", "revenu", "revenus", "revenue", "revenues", "net sales", "sales",
    "net revenue", "turnover", "produits d'exploitation", "revenus d'exploitation",
    "revenu d'exploitation", "operating revenue",
    // resultat
    "resultat net", "resultat net part du groupe", "benefice net", "net income", "net profit",
    "net earnings", "earnings", "resultat", "benefice",
    "resultat operationnel", "resultat d'exploitation", "resultat operationnel courant",
    "operating income", "operating profit", "ebit", "ebitda", "ebita", "ebitda ajuste",
    "benefice par action", "bpa", "eps", "earnings per share", "resultat par action",
    "profit brut", "benefice brut", "gross profit", "marge brute en valeur",
    // flux
    "cash flow libre", "flux de tresorerie disponible", "free cash flow", "fcf",
    "flux de tresorerie d'exploitation", "operating cash flow", "cash flow operationnel",
    "capex", "depenses d'investissement", "investissements",
    // bilan et titres
    "capitaux propres", "fonds propres", "stockholders equity", "shareholders equity",
    "total equity", "equity", "stocks", "inventory", "inventories", "dette nette", "net debt",
    "dette", "debt", "actif total", "total assets", "actifs", "assets",
    "nombre d'actions", "nombre d'actions en circulation", "shares outstanding", "shares",
    "dividende par action", "dividend per share", "dividende", "dividends",
    "valeur comptable par action", "book value per share", "tresorerie",
    "tresorerie et equivalents", "tresorerie et equivalents de tresorerie", "cash",
    "cash and equivalents", "cash equivalents", "cash and cash equivalents",
    "passifs sur contrats", "contract liabilities", "revenus differes", "deferred revenue",
    "creances clients", "creances", "accounts receivable", "receivables", "goodwill",
    "effectif", "effectif total", "headcount", "employees", "nombre d'employes",
    "nombre de salaries", "obligations locatives", "lease obligations", "dette locative",
    "lease liabilities", "capitalisation boursiere", "market cap",
  ].map(cleNom),
);

// Marqueurs de periode / perimetre retires d'un SHORT decoupe en mots.
const MARQUEURS_SHORT = new Set([
  "q", "t", "fy", "y", "h", "h1", "h2", "s", "sem", "a", "ann", "annual", "annuel", "quarter",
  "quarterly", "trim", "ttm", "ytd", "adj", "aj", "adjusted", "core", "group", "cons",
  "consolide", "consolidated", "tot", "total", "dil", "dilue", "diluted", "com", "common",
  "cont", "reported", "rep", "usd", "eur", "m", "b", "mm", "gaap", "ng", "nongaap",
  "q1", "q2", "q3", "q4", "ca t", "pct",
]);

// Formes compactes (sans espace) des mesures generiques, apres retrait des marqueurs.
const ALIAS_COMPACTS = new Set(
  [
    "rev", "revenue", "revenues", "ca", "sales", "net sales", "netsales", "net rev",
    "net revenue", "turnover", "total rev", "rev op", "ni", "net inc", "net income",
    "netincome", "net profit", "net earnings", "earnings", "eps", "bpa", "epsdil", "gp",
    "gross profit", "gross inc", "op inc", "op income", "operating income", "oi", "ebit",
    "ebitda", "ebita", "ebt", "pbt", "fcf", "ocf", "cfo", "capex", "bvps", "nav", "waso",
    "shares", "shares out", "equity", "stockholders equity", "shareholders equity",
    "inventory", "inventories", "stocks", "assets", "total assets", "debt", "net debt",
    "cash", "dps", "dividend", "dividends", "opex", "sga", "cogs", "rd", "da",
    "net sales usd", "revenue annuel", "headcount", "employees", "effectif", "tres", "treso",
    "cashequiv", "contractliab", "contractliabilities", "goodwill", "dso", "receivables",
    "aebitda", "marketcap", "mktcap",
  ].map((s) => s.replace(/\s+/g, "")),
);

/** Decoupe un short en mots (underscore, tirets, espaces, camelCase, chiffres d'annee retires). */
function motsDuShort(short: unknown): string[] {
  const brut = String(short ?? "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Za-z])(\d)/g, "$1 $2");
  return sansAccents(brut)
    .replace(/\b(19|20)\d{2}\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter(Boolean);
}

function shortCompact(short: unknown): string {
  const mots = motsDuShort(short).filter((m) => !MARQUEURS_SHORT.has(m) && !/^\d+$/.test(m));
  return mots.join("");
}

export type RaisonGenerique =
  | "bibliotheque"
  | "ca_total"
  | "comptable"
  | "short_compact"
  | "nom";

/** Raison pour laquelle le KPI est generique ou comptable, ou null s'il est specifique. */
export function raisonGenerique(k: KpiNommable | string | null | undefined): RaisonGenerique | null {
  if (k == null) return null;
  const o: KpiNommable = typeof k === "string" ? { short: k } : k;
  const short = o.short;
  if (short && isGenericKpi(String(short))) return "bibliotheque";
  if (short && isTotalRevenueLabel(short)) return "ca_total";
  if (short && isAccountingKpi(short)) return "comptable";
  if (short && ALIAS_COMPACTS.has(shortCompact(short))) return "short_compact";
  for (const nom of [o.name_fr, o.name_en]) {
    if (typeof nom !== "string" || !nom.trim()) continue;
    const c = cleNom(nom);
    if (c && NOMS_GENERIQUES.has(c)) return "nom";
  }
  return null;
}

/** True si le KPI est generique ou comptable (a ne pas retenir comme hero). */
export function isGenericHeroKpi(k: KpiNommable | string | null | undefined): boolean {
  return raisonGenerique(k) !== null;
}

/**
 * Hero en pourcentage / marge / ratio : interdit pour un hero AUTOMATIQUE
 * (regle du 9 juin 2026). Un hero pose a la main (override) y echappe.
 */
export function isPercentHeroKpi(k: { short?: unknown; unit?: unknown } | null | undefined): boolean {
  if (!k) return false;
  const s = String(k.short ?? "");
  return (
    String(k.unit ?? "").trim() === "%" ||
    /margin|marge|ratio|taux|growth|croissance|yield|rendement/i.test(s) ||
    ["GM", "ROE", "ROTE", "ROIC", "ROA", "ROCE", "NIM", "ROTCE"].includes(s)
  );
}
