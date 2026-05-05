import type { Company } from "@/lib/data";

/**
 * Backfill `last_data_date` sur les KPIs : si un KPI n'a pas de date OU
 * une date plus ancienne que le max du dataset, on remonte à la date la
 * plus récente disponible. Évite de flagger "Données vieillissantes" un
 * hero KPI dont d'autres KPIs du même dataset sont plus frais (cas où
 * CONV-DATA a updaté certains champs mais pas tous). Yann 5 mai 2026.
 *
 * Ordre fallback :
 *   1. KPI's own last_data_date (si présent et plus récent que les autres)
 *   2. Max(last_data_date sur tous les KPIs de la sté)
 *   3. Top-level last_filing_date / _last_validation_date / _validation_date
 *   4. "2025-12-31" (dernière clôture US standard)
 *
 * Template uniforme : utilisé par /sandbox/v1-6/[ticker], /sandbox/v1-7/[ticker]
 * et toutes futures pages sté pipeline (2.0+). À chaque nouvelle sté ajoutée,
 * pas besoin de toucher à ses dates : la fonction backfill au render.
 */
export function enhanceFreshness<T extends Company & Record<string, unknown>>(data: T): T {
  const kpis = (data.kpis || []) as Array<{ last_data_date?: string }>;
  const allDates: string[] = kpis
    .map((k) => k.last_data_date)
    .filter((d): d is string => !!d && /^\d{4}-\d{2}-\d{2}$/.test(d));
  const topLevelCandidates = [
    data.last_filing_date,
    data._last_validation_date,
    data._validation_date,
  ].filter((d): d is string => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d));
  allDates.push(...topLevelCandidates);
  const maxDate = allDates.length > 0 ? allDates.sort().slice(-1)[0] : "2025-12-31";
  data.kpis = kpis.map((k) => {
    const own = k.last_data_date;
    if (!own || own < maxDate) return { ...k, last_data_date: maxDate };
    return k;
  }) as Company["kpis"];
  return data;
}
