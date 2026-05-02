/**
 * KPI Overrides — surcharges user-defined.
 *
 * Liste de demandes user qui surchargent ou complètent les templates GICS.
 * Lue par le pipeline LLM en priorité absolue.
 *
 * Format des entrées :
 *
 *   { scope: "ticker:NFLX",            // une sté précise
 *     action: "add_kpi",
 *     kpi: { ... } }
 *
 *   { scope: "sector:Information Technology",   // tout un secteur
 *     action: "add_kpi",
 *     kpi: { ... } }
 *
 *   { scope: "industry:Software",      // un industry group GICS
 *     action: "add_kpi",
 *     kpi: { ... } }
 *
 *   { scope: "ticker:NFLX",
 *     action: "request",                // demande, à compléter par toi via doc
 *     note: "Calcule les Subscribers depuis ER 2024 si plus publié dans 10-K" }
 *
 *   { scope: "ticker:NFLX",
 *     action: "set_hero",
 *     value: "Subscribers" }            // force un Hero KPI précis
 *
 *   { scope: "ticker:NFLX",
 *     action: "manual_data",
 *     kpi_short: "Subscribers",
 *     history: [220, 235, 247, 260, 275] }   // toi remplaces le pipeline
 *
 * Exemples bootstrap :
 */

import type { KpiTemplate } from "@/lib/kpi-templates-by-gics";

export type KpiOverride =
  | {
      scope: string; // "ticker:XXX" | "sector:XXX" | "industry:XXX"
      action: "add_kpi";
      kpi: KpiTemplate;
      kind: "hero" | "standard" | "story" | "super";
    }
  | { scope: string; action: "set_hero"; value: string }
  | {
      scope: string;
      action: "manual_data";
      kpi_short: string;
      history: number[];
      value: string;
      yoy: string;
      unit: string;
      last_data_date: string;
    }
  | { scope: string; action: "remove_kpi"; kpi_short: string }
  | { scope: string; action: "request"; note: string };

export const KPI_OVERRIDES: KpiOverride[] = [
  // ══════════════════════════════════════════════════════════════
  // EXEMPLE — quand Yann te dira : "Pour Netflix, ajoute Subscribers"
  // ══════════════════════════════════════════════════════════════
  // {
  //   scope: "ticker:NFLX",
  //   action: "set_hero",
  //   value: "Subscribers",
  // },
  // {
  //   scope: "ticker:NFLX",
  //   action: "manual_data",
  //   kpi_short: "Subscribers",
  //   history: [222, 230, 247, 269, 285],
  //   value: "285",
  //   yoy: "+5.9%",
  //   unit: "M",
  //   last_data_date: "2025-12-31",
  // },
  //
  // ══════════════════════════════════════════════════════════════
  // EXEMPLE — KPI sectoriel à ajouter sur un secteur entier
  // ══════════════════════════════════════════════════════════════
  // {
  //   scope: "sector:Information Technology",
  //   action: "add_kpi",
  //   kind: "standard",
  //   kpi: {
  //     short: "ARR",
  //     name_fr: "Revenu récurrent annualisé",
  //     name_en: "Annual Recurring Revenue",
  //     explanation: "Revenu d'abonnement annualisé sur la base du dernier mois.",
  //     why_pv: "Indicateur clé software / SaaS, plus prédictif que le revenu GAAP.",
  //     unit: "$B",
  //     type: "Recurring",
  //     wow_or_generic: "wow",
  //   },
  // },
];

/**
 * Helper : récupère les overrides applicables à une sté donnée.
 */
export function getOverridesForTicker(
  ticker: string,
  sector?: string,
  industry?: string,
): KpiOverride[] {
  const t = ticker.toUpperCase();
  return KPI_OVERRIDES.filter((o) => {
    if (o.scope === `ticker:${t}`) return true;
    if (sector && o.scope === `sector:${sector}`) return true;
    if (industry && o.scope === `industry:${industry}`) return true;
    return false;
  });
}
