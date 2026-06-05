/**
 * Helper unique pour calculer le tier de freshness (À jour / Récent / Périmé)
 * affiché sur la card aperçu home ET sur la page sté.
 *
 * Mission Yann (V1.9.5, juin 2026) : avant ce helper, la card home et la page
 * sté pouvaient diverger pour la MÊME sté car :
 *   - home utilisait `getHero(company).last_data_date` (KPI configuré comme hero)
 *   - page sté utilisait `active.last_data_date` (KPI courant, qui peut être
 *     swappé par `effectiveDefaultHero` quand le hero configuré est annuel)
 *
 * Règle commune : la chip freshness reflète TOUJOURS la fraîcheur du hero
 * KPI **tel que configuré dans le dataset** (`company.hero_kpi`), pas du KPI
 * actuellement affiché côté chart cycle. La date de référence est unique.
 */

import { getFreshness, getHero, type Company, type FreshnessTier } from "@/lib/data";

/**
 * Retourne la date de référence canonique utilisée pour la chip freshness.
 * Priorité : `publicationDate` (filed_date SEC) > `last_data_date` du hero KPI.
 *
 * @param company société source
 * @returns { lastDate, publicationDate } avec lastDate = hero.last_data_date
 */
export function getFreshnessReference(company: Company): {
  lastDate: string | undefined;
  publicationDate: string | undefined;
} {
  const hero = getHero(company);
  return {
    lastDate: hero?.last_data_date,
    publicationDate: company.latest_filing?.date,
  };
}

/**
 * Calcule le tier de freshness pour une sté, en utilisant la même source que
 * la page sté et la card home preview.
 *
 * @param company société source
 * @param now date courante (injectable pour tests)
 * @returns tier "fresh" | "recent" | "stale" | "unknown"
 */
export function computeFreshnessTier(
  company: Company,
  now: Date = new Date(),
): FreshnessTier {
  const { lastDate, publicationDate } = getFreshnessReference(company);
  const refDate = publicationDate ?? lastDate;
  return getFreshness(refDate, now);
}
