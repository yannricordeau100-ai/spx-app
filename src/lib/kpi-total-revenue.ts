/**
 * kpi-total-revenue.ts — reconnait un libelle de CHIFFRE D'AFFAIRES TOTAL.
 *
 * Un CA total n'est jamais un hero acceptable : c'est la mesure la moins
 * distinctive de la fiche, et elle sert de reference pour detecter les
 * contaminations (un KPI cense etre specifique dont la valeur colle au CA
 * total est un KPI mal extrait).
 *
 * Cette liste vivait en double dans `scripts/qualify-stes.ts` et nulle part
 * dans le rendu. Consequence (constat 11 aout 2026) : le fallback
 * `bestQuarterlyKpiShort` de `company-view.tsx` promouvait un CA total
 * trimestriel en hero des que le hero configure n'etait pas trimestriel, ce
 * qui annulait le hero choisi sur 8 stes europeennes publiant leurs segments
 * en semestriel ou en annuel (ROG.SW, INGA.AS, CCEP, AI.PA, BNP.PA, CFR.SW,
 * HEI.DE, HOLN.SW). Le filtre n'excluait que les generiques au sens de
 * `isGenericKpi`, or "REV_Q", "REV_FY" et "CA_T" n'y figurent pas.
 *
 * Source de verite unique, importee par le rendu ET par le qualifieur.
 */

const TOTAL_REVENUE_LABELS = new Set([
  "total revenue", "revenue", "revenues", "net sales", "total revenues",
  "total net sales", "operating revenue", "ca", "revenu", "revenus",
  "chiffre d affaires", "ca total", "revenu total", "total rev",
  "net revenue", "total sales", "sales",
  // Fiches canadiennes et francaises : le CA total y est libelle en francais.
  "revenu d exploitation", "revenus d exploitation", "produits d exploitation",
  "chiffre d affaires total", "ventes totales", "revenu net", "revenus totaux",
  // Variantes vues sur le 2e univers (TSX, LSE, Vienne, Milan, Amsterdam).
  "ca t", "rev fy", "rev y", "rev q", "group revenue", "group revenues",
  "consolidated revenue", "consolidated revenues", "consolidated net sales",
  "total group revenue", "revenue fy", "revenue total", "turnover",
  "group turnover", "total turnover", "ca annuel", "ca fy",
  // 15 aout 2026 : libelles de CA total sans marqueur de periode, atteints via
  // stripPeriodMarkers (voir isTotalRevenueLabel).
  "organic net sales", "organic revenue", "organic sales", "net turnover",
]);

/**
 * Normalise un `short` : minuscules, separateurs (_ - . ') remplaces par des
 * espaces, espaces compactes. Sans ca "TOTAL_REV" echappe au filtre.
 */
export function normalizeKpiShort(s: unknown): string {
  return String(s ?? "")
    .toLowerCase()
    .replace(/[_\-.'’]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Retire les marqueurs de periode d'un `short` normalise : "revenue_q",
 * "REV_FY", "CA_T_2025" doivent tous se ramener a leur mesure. Mesure du
 * 12 aout 2026 : sans ce nettoyage, "revenue_q" echappait au filtre CA total et
 * devenait hero sur KO, POOL et DG.
 */
export function stripPeriodMarkers(s: string): string {
  return s
    .replace(/\b(19|20)\d{2}\b/g, " ")
    .replace(/\b(q|t|fy|y|h|s|ttm|ytd|quarter|trim|annuel|annual|adj|adjusted|aj|pre|core|group|consolide|consolidated)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * True si le `short` du KPI est un libelle de chiffre d'affaires total.
 *
 * 15 aout 2026 : le test porte desormais AUSSI sur le libelle prive de ses
 * marqueurs de periode. C'est ce qui fait tomber les CA totaux deguises en
 * "REVENUE_Q", "SALES_Q", "CA_S", "net_sales_q" ou "organic_net_sales". Le
 * prealable annonce le 12 aout est fait : les heros concernes ont ete
 * repointes sur un KPI de demande avant l'elargissement, mesure des heros
 * effectifs des 639 publiees a l'appui (voir .conv-state/v195-n2-etat.md).
 */
export function isTotalRevenueLabel(short: unknown): boolean {
  const n = normalizeKpiShort(short);
  if (TOTAL_REVENUE_LABELS.has(n)) return true;
  const stripped = stripPeriodMarkers(n);
  return stripped.length > 0 && TOTAL_REVENUE_LABELS.has(stripped);
}
