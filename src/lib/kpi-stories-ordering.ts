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
  if (kpis.some((k) => k.is_short_history && isStoryKpiUsable(k))) return true;
  if (marketPositions && marketPositions.length > 0) return true;
  return false;
}
