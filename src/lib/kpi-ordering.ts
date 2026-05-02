/**
 * Order des KPIs dans le bloc "Indicateurs clés".
 *
 * Règle (voir CLAUDE.md § ORDRE D'AFFICHAGE DES KPI) :
 *   - Position 1 : KPI wow
 *   - Position 2 : KPI wow
 *   - Position 3 : KPI generic
 *   - Position 4 : KPI wow
 *   - Position 5 : KPI generic
 *   - Position 6 : KPI wow
 *   - … alternance 1 generic / 1 wow jusqu'à épuisement des wow
 *   - Tous les generics restants en bas, dans leur ordre d'origine
 *
 * Le hero KPI lui-même est exclu (rendu en grand au-dessus du bloc).
 *
 * Les KPIs avec is_short_history = true sont aussi exclus (ils vont dans
 * le bloc Stories). orderKpis ne les inclut pas.
 *
 * Cette fonction est PURE et déterministe. Tagging décidé une fois pour
 * toutes côté JSON dataset → l'ordre ne change pas avec les nouvelles
 * data trimestrielles.
 */

import type { KPI } from "./data";

export function orderKpis(kpis: KPI[], heroShort?: string): KPI[] {
  const filtered = kpis.filter((k) => !k.is_short_history && k.short !== heroShort);

  // Préserver l'ordre original parmi les wow et generic séparés.
  const wow: KPI[] = [];
  const generic: KPI[] = [];
  for (const k of filtered) {
    if (k.is_wow) wow.push(k);
    else generic.push(k);
  }

  const ordered: KPI[] = [];
  // Positions 1-2 : 2 wow consécutifs
  if (wow.length > 0) ordered.push(wow.shift()!);
  if (wow.length > 0) ordered.push(wow.shift()!);
  // Positions 3+ : alternance generic, wow, generic, wow, …
  while (wow.length > 0 || generic.length > 0) {
    if (generic.length > 0) ordered.push(generic.shift()!);
    if (wow.length > 0) ordered.push(wow.shift()!);
  }
  return ordered;
}

/**
 * Sépare les KPIs en (mainKpis pour bloc "Indicateurs clés", storyKpis
 * pour bloc "Stories") selon is_short_history.
 *
 * Le hero est exclu des deux (il est rendu séparément).
 */
export function splitKpis(kpis: KPI[], heroShort?: string): {
  mainKpis: KPI[];
  storyKpis: KPI[];
} {
  const mainKpis = orderKpis(kpis, heroShort);
  const storyKpis = kpis.filter((k) => k.is_short_history && k.short !== heroShort);
  return { mainKpis, storyKpis };
}
