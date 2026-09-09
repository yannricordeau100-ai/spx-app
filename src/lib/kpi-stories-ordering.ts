/**
 * Organisation du bloc "Stories" : groupage des KPIs short-history par
 * story_category, plus inclusion des MarketPositions comme story
 * particulière (catégorie "Marché").
 *
 * Le bloc Stories remplace le bloc "Position marché · TAM" en
 * l'intégrant comme un type de story parmi d'autres.
 */

import type { KPI, MarketPosition } from "./data";

/**
 * Yann 8 juin 2026 : generiques BASIQUES interdits en story (comptable banal).
 * Les generiques "speciaux" (Cap Return, Buybacks, DPS, Payout Ratio =
 * allocation du capital, narratif investisseur) NE sont PAS dans cette liste
 * et restent eligibles en story s'ils ont une vraie valeur non nulle.
 */
const BASIC_GENERIC_STORY_EXCLUDE = new Set<string>([
  "total revenue", "revenue", "net sales", "sales", "total sales", "net revenue",
  "chiffre d'affaires", "chiffre d'affaires net", "chiffre d'affaires total", "revenu total",
  "net income", "net profit", "net margin", "net margin %",
  "operating income", "op income", "operating profit", "ebit",
  "operating margin", "op margin", "operating margin %",
  "gross margin", "gross margin %",
  "ebitda", "ebitda margin",
  "free cash flow", "fcf", "operating cash flow", "ocf",
  "eps", "earnings per share", "eps diluted", "diluted eps",
  "total assets", "total debt", "net debt", "cash & equivalents", "cash and equivalents",
  "leverage ratio", "roe", "roic", "return on equity",
  "p/e ratio", "market cap", "market capitalization", "shares outstanding",
  "tax rate", "effective tax rate", "headcount", "capex", "r&d",
]);
function isBasicGenericKpi(short: string | null | undefined): boolean {
  if (!short) return false;
  return BASIC_GENERIC_STORY_EXCLUDE.has(short.toLowerCase().replace(/\s+/g, " ").trim());
}

/**
 * 9 sept 2026 (demande du proprietaire) : aucune story ne doit repeter un
 * indicateur deja present dans le tableau des indicateurs cles (chiffre
 * d affaires, marge, resultat, BPA, tresorerie, dette, effectifs...), ni sous
 * un autre libelle, ni sous une autre langue. Deux filtres :
 *  1. famille generique reconnue dans le libelle (FR ou EN), story refusee ;
 *  2. meme libelle (short, name_fr ou name_en normalises) qu un KPI du
 *     tableau, story refusee.
 */
const GENERIQUE_LIBELLE = new RegExp(
  [
    "^(total |net |group |consolidated |consolidé |quarterly |annual )?(chiffre d.affaires?|revenue|revenues|net sales|sales|ventes( nettes)?|produits d.exploitation|turnover)( total| net| nets| consolidé| trimestriel| annuel| growth| croissance)?$",
    "^(gross |operating |op |net |ebitda |ebit |fcf |adjusted |adj |core )?(marge|margin)( brute| opérationnelle| operationnelle| nette| d.exploitation| ebitda| ebit)?( %)?$",
    "^(net |operating |adjusted |adj )?(income|profit|earnings|bénéfice|benefice|résultat|resultat)( net| opérationnel| operationnel| d.exploitation| avant impôt)?$",
    "^(ebitda|ebit|eps|bpa)( ajusté| adjusted| dilué| diluted| basic)?$",
    "^(diluted |adjusted )?(eps|earnings per share|bénéfice par action|benefice par action|bpa)( dilué| diluted)?$",
    "^(free cash flow|fcf|operating cash flow|ocf|cash flow|flux de trésorerie( libre| d.exploitation)?|trésorerie|cash|cash & equivalents|cash and equivalents|cash position)$",
    "^(total |net |long.term |lt )?(debt|dette)( nette| totale| long terme)?$",
    "^(total assets|total liabilities|actif total|equity|capitaux propres|shares outstanding|diluted shares|actions en circulation)$",
    "^(capex|investissements|r&d|rd expense|dépenses de r&d|headcount|effectifs?|employees|employés|salariés|tax rate|effective tax rate|taux d.imposition)$",
    "^(dividend|dividende|dividend per share|dividende par action|dps|buybacks?|rachats? d.actions|share repurchases?)$",
  ].join("|"),
  "i",
);

function normaliseLibelle(v: unknown): string {
  return String(v ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Familles d indicateurs de base. Une story qui parle d une de ces familles
 * avec un marqueur generique (record, total, annuel, trimestriel, par action,
 * annees consecutives...) repete le tableau des indicateurs cles quand celui-ci
 * porte deja la famille : elle est refusee. Exemple : « CA trimestriel record »,
 * « Bénéfice net record exercice 2025 », « Dividende par action versé »,
 * « Investissements (capex) annuels ».
 */
const FAMILLES: RegExp[] = [
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
 * Mots qui ne designent PAS un perimetre specifique : si, une fois la famille,
 * ces mots, les nombres et les monnaies retires, il ne reste rien du libelle,
 * la story ne dit rien de plus que le tableau (« CA trimestriel record »,
 * « Dividende par action versé », « Investissements (capex) annuels »). Si un
 * mot specifique subsiste (« Stelo », « Canada », « Sovereign AI »), la story
 * porte une information propre et reste.
 */
const MOTS_NEUTRES = new Set<string>([
  "record","records","total","totale","totaux","annual","annuel","annuelle","annuels","annuelles","quarterly","trimestriel","trimestrielle","trimestriels","quarter","trimestre",
  "full","year","fy","exercice","fiscal","consolidated","consolide","consolidee","group","groupe","paid","verse","versee","per","par","share","action","shares","actions",
  "consecutive","consecutives","years","ans","annees","annee","growth","croissance","increase","increases","hausse","augmentation","decrease","baisse","surpasses","surpass","exceeds","exceed","exceeding","depasse","depassant","above","au","dela","beyond",
  "first","premier","premiere","milestone","jalon","cumulative","cumul","cumule","cumules","cumulee","since","depuis","inception","origine","in","a","row","third","second","fourth","fifth",
  "net","nets","nette","gross","brute","brut","operating","operationnel","operationnelle","adjusted","adjusted","ajuste","ajustee","adj","diluted","dilue","basic","free","libre","disponible","cash","flow","flux","tresorerie",
  "of","the","and","or","de","du","des","la","le","les","l","d","en","et","on","to","for","with","from","at","by","vs","versus","y","yoy","qoq","ttm","ltm","n","n-1","1",
  "usd","eur","chf","gbp","dollars","euros","milliards","millions","md","mds","m","bn","b","k","%","pct","x",
  "ratio","rate","taux","level","niveau","amount","montant","value","valeur","figure","chiffre","reported","publie","published","expected","attendu","guidance","prevu","target","objectif","2026e","2027e",
]);

function residuSpecifique(libelles: unknown[]): boolean {
  let n = libelles.map(normaliseLibelle).join(" ");
  for (const re of FAMILLES) n = n.replace(new RegExp(re.source, "g"), " ");
  n = n.replace(/[()\[\],.:;!?'’"«»/+&_-]/g, " ").replace(/\$/g, " ");
  const tokens = n.split(/\s+/).filter(Boolean);
  for (const t of tokens) {
    if (MOTS_NEUTRES.has(t)) continue;
    if (/^\d+([.,]\d+)?[a-z%]*$/.test(t)) continue; // nombres, annees, "1b", "7.5b"
    if (/^(q|t|h|s)[1-4]$/.test(t)) continue; // Q1, T2, H1
    if (/^(fy)?\d{2,4}$/.test(t)) continue;
    return true; // un mot specifique subsiste
  }
  return false;
}

function famillesDe(libelles: unknown[]): number[] {
  const out: number[] = [];
  const n = libelles.map(normaliseLibelle).join(" | ");
  FAMILLES.forEach((re, i) => { if (re.test(n)) out.push(i); });
  return out;
}

function estFamilleGenerique(k: KPI): boolean {
  for (const v of [k.short, k.name_fr, k.name_en]) {
    const n = normaliseLibelle(v);
    if (n && GENERIQUE_LIBELLE.test(n)) return true;
  }
  return false;
}

/** Story d une famille de base, avec marqueur generique, alors que le tableau porte deja la famille. */
function estRepetitionDeFamille(k: KPI, famillesTableau: Set<number>): boolean {
  const libelles = [k.short, k.name_fr, k.name_en];
  const fams = famillesDe(libelles);
  if (fams.length === 0) return false;
  if (!fams.some((f) => famillesTableau.has(f))) return false;
  return !residuSpecifique(libelles);
}

function famillesDuTableau(kpis: KPI[]): Set<number> {
  const out = new Set<number>();
  for (const k of kpis) {
    const historique = Array.isArray(k.history) ? k.history.length : 0;
    const estStory = !!k.is_short_history || (!!(k as { story_category?: string }).story_category && historique <= 2);
    if (estStory) continue;
    for (const f of famillesDe([k.short, k.name_fr, k.name_en])) out.add(f);
  }
  return out;
}

/** Libelles normalises des KPI du tableau des indicateurs cles (hors stories). */
function libellesTableau(kpis: KPI[]): Set<string> {
  const out = new Set<string>();
  for (const k of kpis) {
    const historique = Array.isArray(k.history) ? k.history.length : 0;
    const estStory = !!k.is_short_history || (!!(k as { story_category?: string }).story_category && historique <= 2);
    if (estStory) continue;
    for (const v of [k.short, k.name_fr, k.name_en]) {
      const n = normaliseLibelle(v);
      if (n) out.add(n);
    }
  }
  return out;
}

function estDoublonDuTableau(k: KPI, tableau: Set<string>): boolean {
  for (const v of [k.short, k.name_fr, k.name_en]) {
    const n = normaliseLibelle(v);
    if (n && tableau.has(n)) return true;
  }
  return false;
}

export type StorySlide =
  | { kind: "kpi"; data: KPI }
  | { kind: "market_position"; data: MarketPosition };

export type StoryCategory = {
  /** Nom affiché ("Innovation", "Marché", "Adoption", "Capacité"). */
  label: string;
  /** Ordre d'affichage (catégories triées par ordre croissant). */
  order: number;
  slides: StorySlide[];
};

const DEFAULT_CATEGORY = "Story";

const CATEGORY_ORDER: Record<string, number> = {
  Marché: 1,
  Innovation: 2,
  Adoption: 3,
  Capacité: 4,
  Story: 99,
};

/**
 * Yann 4 juin 2026 : une story KPI n'est éligible que si elle dispose
 * d'un minimum d'info lisibles. Sinon la carte affichait juste un badge
 * "STORY" + signal en bas avec un centre VIDE / flou (cf bug "blocs à
 * moitié terminés" sur ~énormément de stés). Exigences minimales :
 *  - value numérique OU string courte non vide (sinon centre vide)
 *  - name_fr non vide (sinon plus de titre KPI lisible)
 * Si signal ET description manquent aussi → on garde pas la story (rien à dire).
 */
function isStoryKpiUsable(k: KPI): boolean {
  // Yann 8 juin 2026 : exclure SEULEMENT les generiques BASIQUES des stories
  // (CA, resultat net, EPS, marges, EBITDA, FCF, bilan, effectif...). Les
  // generiques "speciaux" d'allocation du capital (Cap Return, Buybacks, DPS)
  // SONT acceptes en story (vraie PV investisseur). Le "0,0 Mds \$" casse de
  // Cap Return reste filtre par le garde-fou valeur-nulle ci-dessous.
  if (isBasicGenericKpi(k.short)) return false;
  // Value usable : number fini NON nul OU string > 0 char non nulle. Une
  // story a "0,0" n'a aucun sens (et trahit souvent une extraction ratee).
  let hasValue = false;
  if (typeof k.value === "number") hasValue = Number.isFinite(k.value) && Math.abs(k.value) > 0;
  else if (typeof k.value === "string") {
    const s = k.value.trim();
    hasValue = s.length > 0 && s !== "—" && parseFloat(s.replace(/,/g, ".")) !== 0;
  }
  if (!hasValue) return false;
  // Titre obligatoire
  const name = (k.name_fr ?? "").trim();
  if (name.length === 0) return false;
  // Au moins UN texte explicatif (signal ou description) pour ne pas
  // avoir une story complètement muette.
  const hasNarrative =
    ((k.signal ?? "").trim().length > 0) || ((k.description ?? "").trim().length > 0);
  if (!hasNarrative) return false;
  return true;
}

export function buildStories(
  kpis: KPI[],
  marketPositions?: MarketPosition[]
): StoryCategory[] {
  const buckets = new Map<string, StorySlide[]>();
  const tableau = libellesTableau(kpis);
  const famillesTab = famillesDuTableau(kpis);

  // 1. KPIs short-history → bouquet par story_category
  for (const k of kpis) {
    // Yann 29 aout 2026 (cas AMZN, capacite electrique AWS, 1 point) : un KPI
    // qui porte une story_category mais dont le drapeau is_short_history n a
    // pas ete pose est une story quand sa serie est trop courte pour le
    // tableau des indicateurs cles. Sans cela il n apparaissait NULLE PART.
    const historique = Array.isArray(k.history) ? k.history.length : 0;
    const storySansDrapeau =
      !!(k as { story_category?: string }).story_category && historique <= 2;
    if (!k.is_short_history && !storySansDrapeau) continue;
    if (!isStoryKpiUsable(k)) continue;
    // 9 sept 2026 : pas de doublon des indicateurs cles.
    if (estFamilleGenerique(k) || estDoublonDuTableau(k, tableau) || estRepetitionDeFamille(k, famillesTab)) continue;
    const cat = k.story_category || DEFAULT_CATEGORY;
    if (!buckets.has(cat)) buckets.set(cat, []);
    buckets.get(cat)!.push({ kind: "kpi", data: k });
  }

  // 2. Market positions → catégorie "Marché"
  if (marketPositions && marketPositions.length > 0) {
    if (!buckets.has("Marché")) buckets.set("Marché", []);
    for (const mp of marketPositions) {
      buckets.get("Marché")!.push({ kind: "market_position", data: mp });
    }
  }

  // 3. Trier les catégories selon CATEGORY_ORDER
  // Yann 26 juil 2026 : les stories multi-données (série <3 ans, >1 point,
  // rendues avec mini graph) passent en tête : slides multi d'abord dans
  // leur catégorie, et catégorie contenant du multi affichée en premier.
  const isMulti = (s: StorySlide) =>
    s.kind === "kpi" && Array.isArray(s.data.history) && s.data.history.length > 1;
  const categories: StoryCategory[] = [];
  for (const [label, slides] of buckets.entries()) {
    if (slides.length === 0) continue;
    slides.sort((a, b) => (isMulti(a) ? 0 : 1) - (isMulti(b) ? 0 : 1));
    categories.push({
      label,
      order: slides.some(isMulti) ? 0 : (CATEGORY_ORDER[label] ?? 50),
      slides,
    });
  }
  categories.sort((a, b) => a.order - b.order);
  return categories;
}

/**
 * Vrai si la société a au moins 1 story à afficher.
 * Sinon, le bloc Stories est invisible (et MarketPosition aussi, par règle).
 */
export function hasStories(
  kpis: KPI[],
  marketPositions?: MarketPosition[]
): boolean {
  // Yann 4 juin 2026 : on n'affiche le bloc Stories que si on a au moins
  // UNE story usable (cf isStoryKpiUsable) ou une MarketPosition.
  // 9 sept 2026 : meme filtre que buildStories (doublons du tableau exclus).
  if (buildStories(kpis, undefined).some((c) => c.slides.length > 0)) return true;
  if (marketPositions && marketPositions.length > 0) return true;
  return false;
}

/** Audit interne (9 sept 2026) : stories candidates avant et apres le filtre anti-doublon. */
export function __auditStories(kpis: KPI[]): { avant: string[]; apres: string[] } {
  const tableau = libellesTableau(kpis);
  const famillesTab = famillesDuTableau(kpis);
  const avant: string[] = [];
  const apres: string[] = [];
  for (const k of kpis) {
    const historique = Array.isArray(k.history) ? k.history.length : 0;
    const storySansDrapeau = !!(k as { story_category?: string }).story_category && historique <= 2;
    if (!k.is_short_history && !storySansDrapeau) continue;
    if (!isStoryKpiUsable(k)) continue;
    const lib = `${k.short} | ${k.name_fr ?? ""}`;
    avant.push(lib);
    if (estFamilleGenerique(k) || estDoublonDuTableau(k, tableau) || estRepetitionDeFamille(k, famillesTab)) continue;
    apres.push(lib);
  }
  return { avant, apres };
}
