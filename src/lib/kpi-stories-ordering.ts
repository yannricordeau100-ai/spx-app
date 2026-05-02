/**
 * Organisation du bloc "Stories" : groupage des KPIs short-history par
 * story_category, plus inclusion des MarketPositions comme story
 * particulière (catégorie "Marché").
 *
 * Le bloc Stories remplace le bloc "Position marché · TAM" en
 * l'intégrant comme un type de story parmi d'autres.
 */

import type { KPI, MarketPosition } from "./data";

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

export function buildStories(
  kpis: KPI[],
  marketPositions?: MarketPosition[]
): StoryCategory[] {
  const buckets = new Map<string, StorySlide[]>();

  // 1. KPIs short-history → bouquet par story_category
  for (const k of kpis) {
    if (!k.is_short_history) continue;
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
  const categories: StoryCategory[] = [];
  for (const [label, slides] of buckets.entries()) {
    if (slides.length === 0) continue;
    categories.push({
      label,
      order: CATEGORY_ORDER[label] ?? 50,
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
  if (kpis.some((k) => k.is_short_history)) return true;
  if (marketPositions && marketPositions.length > 0) return true;
  return false;
}
