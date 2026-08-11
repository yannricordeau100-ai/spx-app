/**
 * kpi-accounting.ts — reconnait une LIGNE COMPTABLE pure.
 *
 * Une ligne comptable (resultat net, EBITDA, capex, dividende, poste de bilan,
 * rachat d'actions, delai de paiement) n'est jamais un bon hero : elle ne dit
 * rien de la DEMANDE adressee a la ste, et elle se ressemble d'une ste a
 * l'autre. Le hero doit etre une mesure d'activite : revenu de segment, volume,
 * unites, capacite, parc installe, comptes clients.
 *
 * Pourquoi ce fichier existe (constat 12 aout 2026) : le fallback
 * `bestQuarterlyKpiShort` de `company-view.tsx` promeut le KPI trimestriel le
 * plus profond des que le hero configure n'est pas trimestriel. Il n'excluait
 * que les generiques (`isGenericKpi`) et, depuis le 11 aout, les CA totaux
 * (`isTotalRevenueLabel`). Resultat mesure sur les 639 stes publiees : 30 stes
 * affichaient en hero une ligne comptable, et un hero annuel CORRECT pose a la
 * main se faisait systematiquement ecraser (HSIC "dso_days" battait un CA
 * Etats-Unis de 9,1 Mds $ sur 9 exercices ; AIG "NET_INCOME_COMMON" battait
 * 23,7 Mds $ de primes acquises ; DD affichait un dividende par action).
 *
 * Portee volontairement etroite : uniquement les libelles sans ambiguite. Ce
 * filtre ne s'applique QU'AU FALLBACK, jamais a un hero explicitement choisi,
 * exactement comme `isTotalRevenueLabel`.
 *
 * Source de verite unique, importee par le rendu ET par les outils
 * (`scripts/qualify-stes.ts`, `scripts/dump-hero-context.ts`).
 */
import { normalizeKpiShort, stripPeriodMarkers } from "@/lib/kpi-total-revenue";

/**
 * Fragments qui, presents dans le `short` normalise, designent une ligne
 * comptable. On raisonne par mot entier pour eviter les faux positifs du genre
 * "cash" dans "cashback" ou "da" dans "data".
 */
const ACCOUNTING_WORDS = new Set([
  // Compte de resultat
  "net income", "ni", "net profit", "profit", "earnings", "core earnings",
  "eps", "bpa", "gross profit", "op income", "opinc", "operating income",
  "ebit", "ebitda", "ebitdaal", "ebita", "pretax", "pbt", "ebt",
  "resultat net", "resultat", "benefice",
  // Couts et charges
  "cogs", "sga", "sgna", "opex", "sbc", "labor cost", "cout des ventes",
  "depreciation", "amortization", "da", "dna", "d and a", "d&a", "da expense",
  "rd", "rd exp", "rd expense", "r&d", "rd amort", "ad expense", "marketing",
  "advertising expense", "interest expense",
  "tax", "tax rate", "impots", "provision", "accrual",
  // Bilan
  "total assets", "assets", "equity", "goodwill", "inventory", "inventories",
  "receivables", "payables", "net debt", "debt", "lt debt",
  "book value", "bvps", "nav", "nav per share", "ppe", "ppe net",
  "total liabilities", "dette nette", "capitaux propres", "stocks",
  "stockholders equity", "shareholders equity", "total equity", "supplies inv",
  "long term debt", "st debt", "gas inventory", "actifs reglementaires",
  // Deux mots sont volontairement ABSENTS de cette liste, faux positifs mesures
  // le 12 aout 2026 : "cash" seul ("CASH_TRADING_REV" est un revenu de segment
  // courtage, pas un poste de tresorerie) et "div" seul (abreviation de
  // DIVISION chez L'Oreal : DIV_PGP, DIV_LUXE, DIV_DERMA sont des CA de
  // division). Ne pas les rajouter.
  // Tresorerie et retour a l'actionnaire
  "capex", "investissement", "ocf", "fcf", "cash flow", "operating cash flow",
  "buyback", "buybacks", "rachat", "dividend", "dividends", "dividends paid",
  "dps", "dividende", "payout", "div paid", "div share", "div per share",
  "share buybacks", "rachats", "acquisitions", "acq spend",
  // Gestion et titres
  "dso", "dso days", "dpo", "dio", "shares", "shares out", "diluted shares",
  "waso", "leverage", "net leverage", "working capital", "bfr",
]);

/**
 * MESURES D'ACTIVITE : si l'un de ces mots apparait dans le libelle, ce n'est
 * pas une ligne comptable, quoi que dise la liste ci-dessus. Garde-fou pose
 * apres un faux positif mesure le 12 aout 2026 : "DA_rev" (CA du segment
 * Discrete Automation d'Emerson) tombait sur l'abreviation comptable "DA"
 * (depreciation et amortissement), et "CASH_TRADING_REV" sur "cash".
 * Un CA TOTAL qui porterait ces mots est deja attrape par isTotalRevenueLabel.
 */
const ACTIVITY_WORDS = new Set([
  "rev", "revenue", "revenues", "sales", "ventes", "ca", "turnover",
  "volume", "vol", "volumes", "units", "unites", "unites vendues",
  "shipments", "livraisons", "expeditions", "deliveries",
  "subscribers", "abonnes", "customers", "clients", "comptes", "accounts",
  "users", "utilisateurs", "installations", "installs", "stores", "magasins",
  "homes", "logements", "chambres", "rooms", "beds", "lits", "admissions",
  "capacity", "capacite", "capa", "production", "prod", "output",
  "backlog", "rpo", "orders", "commandes", "bookings", "pipeline",
  "deposits", "depots", "premiums", "primes", "encours", "aum", "gav",
  "gallons", "tonnes", "tons", "barrels", "twh", "gwh", "mwh", "mw", "gw",
  "bcf", "boe", "passengers", "passagers", "trafic", "traffic", "abonnements",
]);

/** True si le `short` du KPI designe une ligne comptable pure. */
export function isAccountingKpi(short: unknown): boolean {
  const n = normalizeKpiShort(short);
  if (!n) return false;
  const stripped = stripPeriodMarkers(n) || n;
  const words = stripped.split(" ").filter(Boolean);

  // Une mesure d'activite n'est jamais une ligne comptable.
  if (words.some((w) => ACTIVITY_WORDS.has(w))) return false;

  if (ACCOUNTING_WORDS.has(n) || ACCOUNTING_WORDS.has(stripped)) return true;
  // Fenetre glissante de 1 a 3 mots : attrape "net income common",
  // "SRE OCF", "supplies inv" comme "capex distribution".
  for (let i = 0; i < words.length; i++) {
    for (let len = Math.min(3, words.length - i); len >= 1; len--) {
      if (ACCOUNTING_WORDS.has(words.slice(i, i + len).join(" "))) return true;
    }
  }
  return false;
}
