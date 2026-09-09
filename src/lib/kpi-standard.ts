/**
 * KPI standard ou avance (9 sept 2026, demande du proprietaire).
 *
 * Un KPI « standard » porte un intitule que l on retrouve chez la plupart des
 * societes : chiffre d affaires, marge, resultat, BPA, tresorerie, dette,
 * effectifs, dividende, rachats, capex... Un KPI « avance » est propre a la
 * societe ou a son metier (abonnes, procedures, base installee, taux de
 * charge, part d un segment...).
 *
 * Deux usages :
 *  - le tableau des indicateurs cles : les avances en clair, les standards
 *    dans une barre depliable separee ;
 *  - les stories : une story qui ne fait que repeter un standard du tableau
 *    est refusee (pas deux fois la meme information).
 *
 * Detection en trois temps :
 *  1. le short figure dans la bibliotheque des generiques (kpi-generic) ;
 *  2. le libelle entier est un intitule generique connu (FR ou EN) ;
 *  3. le libelle parle d une famille de base et, une fois la famille, les
 *     mots neutres, les nombres et les monnaies retires, il ne reste aucun
 *     mot specifique (« CA trimestriel record » est standard ; « Stelo revenue »
 *     ne l est pas : « Stelo » subsiste).
 */

import { isGenericKpi } from "./kpi-generic";

export type KpiLibelle = { short?: string | null; name_fr?: string | null; name_en?: string | null };

export function normaliseLibelle(v: unknown): string {
  return String(v ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const GENERIQUE_LIBELLE = new RegExp(
  [
    "^(total |net |group |consolidated |consolide |quarterly |annual )?(chiffre d.affaires?|revenue|revenues|net sales|sales|ventes( nettes)?|produits d.exploitation|turnover)( total| net| nets| consolide| trimestriel| annuel| growth| croissance)?$",
    "^(gross |operating |op |net |ebitda |ebit |fcf |adjusted |adj |core )?(marge|margin)( brute| operationnelle| nette| d.exploitation| ebitda| ebit)?( %)?$",
    "^(net |operating |adjusted |adj )?(income|profit|earnings|benefice|resultat)( net| operationnel| d.exploitation| avant impot)?$",
    "^(ebitda|ebit|eps|bpa)( ajuste| adjusted| dilue| diluted| basic)?$",
    "^(diluted |adjusted )?(eps|earnings per share|benefice par action|bpa)( dilue| diluted)?$",
    "^(free cash flow|fcf|operating cash flow|ocf|cash flow|flux de tresorerie( libre| d.exploitation)?|tresorerie|cash|cash & equivalents|cash and equivalents|cash position)$",
    "^(total |net |long.term |lt )?(debt|dette)( nette| totale| long terme)?$",
    "^(total assets|total liabilities|actif total|equity|capitaux propres|shares outstanding|diluted shares|actions en circulation)$",
    "^(capex|investissements|r&d|rd expense|depenses de r&d|headcount|effectifs?|employees|employes|salaries|tax rate|effective tax rate|taux d.imposition)$",
    "^(dividend|dividende|dividend per share|dividende par action|dps|buybacks?|rachats? d.actions|share repurchases?)$",
  ].join("|"),
  "i",
);

/** Familles d indicateurs de base (index stable : sert a comparer story et tableau). */
export const FAMILLES: RegExp[] = [
  /\b(revenue|revenues|net sales|sales|chiffre d.affaires?|ventes|\bca\b|turnover)\b/,
  /\b(net income|net profit|benefice net|resultat net|net earnings)\b/,
  /\b(margin|marge)\b/,
  /\b(eps|bpa|earnings per share|benefice par action)\b/,
  /\b(free cash flow|fcf|operating cash flow|cash flow|flux de tresorerie)\b/,
  /\b(dividend|dividende|dividends|dividendes)\b/,
  /\b(capex|capital expenditures?|investissements?)\b/,
  /\b(debt|dette|endettement)\b/,
  /\b(employees|effectifs?|headcount|salaries|employes)\b/,
  /\b(buybacks?|rachats? d.actions|share repurchases?)\b/,
  /\b(ebitda|ebit|operating income|resultat operationnel|resultat d.exploitation)\b/,
];

/**
 * Mots qui ne designent PAS un perimetre specifique. Si, une fois la famille,
 * ces mots, les nombres et les monnaies retires, il ne reste rien, le libelle
 * ne dit rien de plus que la famille.
 */
const MOTS_NEUTRES = new Set<string>([
  "record","records","total","totale","totaux","annual","annuel","annuelle","annuels","annuelles","quarterly","trimestriel","trimestrielle","trimestriels","quarter","trimestre",
  "full","year","fy","exercice","fiscal","consolidated","consolide","consolidee","group","groupe","paid","verse","versee","per","par","share","action","shares","actions",
  "consecutive","consecutives","years","ans","annees","annee","growth","croissance","increase","increases","hausse","augmentation","decrease","baisse","surpasses","surpass","exceeds","exceed","exceeding","depasse","depassant","above","au","dela","beyond",
  "first","premier","premiere","milestone","jalon","cumulative","cumul","cumule","cumules","cumulee","since","depuis","inception","origine","in","a","row","third","second","fourth","fifth",
  "net","nets","nette","gross","brute","brut","operating","operationnel","operationnelle","adjusted","ajuste","ajustee","adj","diluted","dilue","basic","free","libre","disponible","cash","flow","flux","tresorerie",
  "of","the","and","or","de","du","des","la","le","les","l","d","en","et","on","to","for","with","from","at","by","vs","versus","y","yoy","qoq","ttm","ltm","n","n-1","1",
  "usd","eur","chf","gbp","dollars","euros","milliards","millions","md","mds","m","bn","b","k","%","pct","x",
  "ratio","rate","taux","level","niveau","amount","montant","value","valeur","figure","chiffre","reported","publie","published","expected","attendu","guidance","prevu","target","objectif","2026e","2027e",
  "dilue","diluee","non","gaap","ifrs","hors","exceptionnels","normalise","normalized","underlying","sous-jacent","comparable","organique","organic","reporte","reported",
]);

export function famillesDe(libelles: unknown[]): number[] {
  const out: number[] = [];
  const n = libelles.map(normaliseLibelle).join(" | ");
  FAMILLES.forEach((re, i) => {
    if (re.test(n)) out.push(i);
  });
  return out;
}

/** Vrai si un mot specifique subsiste une fois la famille et les mots neutres retires. */
export function residuSpecifique(libelles: unknown[]): boolean {
  let n = libelles.map(normaliseLibelle).join(" ");
  for (const re of FAMILLES) n = n.replace(new RegExp(re.source, "g"), " ");
  n = n.replace(/[()\[\],.:;!?'’"«»/+&_-]/g, " ").replace(/\$/g, " ");
  const tokens = n.split(/\s+/).filter(Boolean);
  for (const t of tokens) {
    if (MOTS_NEUTRES.has(t)) continue;
    if (/^\d+([.,]\d+)?[a-z%]*$/.test(t)) continue;
    if (/^(q|t|h|s)[1-4]$/.test(t)) continue;
    if (/^(fy)?\d{2,4}$/.test(t)) continue;
    return true;
  }
  return false;
}

export function estFamilleGenerique(k: KpiLibelle): boolean {
  for (const v of [k.short, k.name_fr, k.name_en]) {
    const n = normaliseLibelle(v);
    if (n && GENERIQUE_LIBELLE.test(n)) return true;
  }
  return false;
}

/** KPI standard : intitule retrouvable chez la plupart des societes. */
export function estKpiStandard(k: KpiLibelle): boolean {
  if (k.short && isGenericKpi(k.short)) return true;
  if (estFamilleGenerique(k)) return true;
  const libelles = [k.short, k.name_fr, k.name_en];
  return famillesDe(libelles).length > 0 && !residuSpecifique(libelles);
}
