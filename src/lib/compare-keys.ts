/**
 * Comparer (Yann 11 sept 2026) : cle de comparabilite d un KPI entre deux
 * societes. Deux KPI sont comparables quand leur libelle anglais normalise
 * ET leur famille d unite concordent. Aucune valeur n est modifiee ici :
 * seules la cle et l echelle de l unite (M, Mds...) sont calculees.
 */

export type FamilleUnite = "money" | "per_share" | "pct" | "bps" | "ratio" | "days" | "count" | string;
export type UniteParsee = { fam: FamilleUnite; cur: string | null; scale: number };

const SYNONYMES: Array<[RegExp, string]> = [
  [/^(total )?(net )?(revenues?|sales)$/, "revenue"],
  [/^total net sales$/, "revenue"],
  [/^(diluted eps|eps diluted|diluted earnings per share|earnings per share diluted|eps)$/, "eps diluted"],
  [/^(capital expenditures?|capex)$/, "capex"],
  [/^(free cash flow|fcf)$/, "free cash flow"],
  [/^(operating cash flow|cash from operations|cash flow from operations|net cash (provided by|from) operating activities)$/, "operating cash flow"],
  [/^(employees|headcount|(total )?number of employees|total employees|workforce)$/, "employees"],
  [/^(share repurchases?|share buybacks?|buybacks?|stock repurchases?)$/, "share repurchases"],
  [/^(dividends? per share|dps)$/, "dividend per share"],
  [/^(long ?term debt)$/, "long term debt"],
  [/^(r and d|research and development)( expenses?)?$/, "research and development"],
  [/^(return on equity|roe)$/, "return on equity"],
  [/^(return on invested capital|roic)$/, "return on invested capital"],
  [/^(ebitda margin|adjusted ebitda margin)$/, "ebitda margin"],
  [/^(net margin|net profit margin)$/, "net margin"],
  [/^(operating margin|operating profit margin)$/, "operating margin"],
  [/^(gross margin|gross profit margin)$/, "gross margin"],
  [/^(net income|net profit|net earnings)$/, "net income"],
];

export function libelleCanonique(nameEn: string | undefined | null, short?: string | null): string {
  let s = String(nameEn || short || "").toLowerCase();
  s = s.replace(/&/g, " and ").replace(/\([^)]*\)/g, " ").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
  for (const [re, v] of SYNONYMES) if (re.test(s)) return v;
  return s;
}

const DEVISES: Array<[RegExp, string]> = [
  [/\$|\busd\b/i, "USD"], [/€|\beur\b/i, "EUR"], [/\bchf\b/i, "CHF"], [/£|\bgbp\b/i, "GBP"],
  [/\b(rmb|cny)\b/i, "CNY"], [/\btwd\b/i, "TWD"], [/¥|\bjpy\b/i, "JPY"], [/₩|\bkrw\b/i, "KRW"],
  [/\bsek\b/i, "SEK"], [/\bdkk\b/i, "DKK"], [/\bnok\b/i, "NOK"], [/\bhkd\b/i, "HKD"], [/\bcad\b/i, "CAD"],
];

const COMPTES = /(employ|salari|personne|etp|unit|client|magasin|store|site|centre|brevet|marque|pays|v[eé]hicule|agence|usine|logement|home|abonn|subscri|member|membre|restaurant|h[oô]tel|user|utilisat|compte|account|avion|aircraft|navire|ship|room|chambre|lit|bed|point de vente|outlet|location)/i;

export function parseUnite(raw: string | undefined | null): UniteParsee {
  const u = String(raw ?? "").trim();
  const l = u.toLowerCase();
  if (/points? de base|bps|pb\b/.test(l)) return { fam: "bps", cur: null, scale: 1 };
  if (l.includes("%")) return { fam: "pct", cur: null, scale: 1 };
  if (/points? de|ratio combin/.test(l)) return { fam: "autre:" + l, cur: null, scale: 1 };
  let cur: string | null = null;
  for (const [re, c] of DEVISES) if (re.test(u)) { cur = c; break; }
  let scale = 1;
  if (/\b(bln|tn)\b|\$t\b|^t\b/i.test(u)) scale = 1e12;
  else if (/^g\s?\$|^g\s?€|\bg(usd|eur)\b/i.test(u)) scale = 1e9;
  else if (/mds|md\b|mrd|milliard|billion|\bbn\b|\$b\b|^b\$|\bb\b|b \$/i.test(u) || /\$md/i.test(u)) scale = 1e9;
  else if (/(^|[^a-z])m($|[^a-z])|millions?|\$m\b|m\$|m€/i.test(u)) scale = 1e6;
  else if (/(^|[^a-z])k($|[^a-z])|milliers|thousands?|^000$|k\$|\$k/i.test(u)) scale = 1e3;
  if (cur && /\/|par action|per share/i.test(u)) return { fam: "per_share", cur, scale: 1 };
  if (cur) return { fam: "money", cur, scale };
  if (/^x$|ratio|fois/.test(l)) return { fam: "ratio", cur: null, scale: 1 };
  if (/jours?|days?/.test(l)) return { fam: "days", cur: null, scale: 1 };
  if (COMPTES.test(l) || /^(m|k|milliers|millions|000|)$/.test(l)) return { fam: "count", cur: null, scale };
  return { fam: "autre:" + l.replace(/^(m|k|mds|milliers|millions) /, ""), cur: null, scale };
}

export function cleComparaison(k: { name_en?: string | null; short?: string | null; unit?: string | null }): string | null {
  const lib = libelleCanonique(k.name_en, k.short);
  if (!lib || lib.length < 3) return null;
  return `${lib}|${parseUnite(k.unit).fam}`;
}

/** Periode normalisee : annuel -> "2024", trimestre -> "T1-2026" (exercice de la societe). */
export function periodeCle(label: string, type?: string): string | null {
  const s = String(label ?? "");
  const q = s.match(/[QT]([1-4])\D{0,4}(?:FY)?\s?'?(\d{2,4})/i);
  if (q && type !== "year") { const y = q[2].length === 2 ? "20" + q[2] : q[2]; return `T${q[1]}-${y}`; }
  const h = s.match(/[HS]([12])\D{0,4}(?:FY)?\s?(\d{4})/i);
  if (h && type === "semester") return `S${h[1]}-${h[2]}`;
  const y = s.match(/(19|20)\d{2}/);
  return y ? y[0] : null;
}
