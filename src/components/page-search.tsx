"use client";

import { CompanySearch } from "@/components/company-search";
import { useT } from "@/lib/i18n/provider";

/**
 * PageSearch — wrapper léger autour de CompanySearch (variant compact).
 * Utilisé dans la top-nav des pages société pour permettre de sauter
 * d'une société à l'autre.
 */
export function PageSearch(_: { variant?: "default" } = {}) {
  const { t } = useT();
  return (
    <CompanySearch variant="compact" placeholder={t("search.placeholder_compact")} />
  );
}
