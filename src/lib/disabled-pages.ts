/**
 * Helper centralisé pour la liste des pages désactivées du site.
 *
 * Pourquoi : Yann veut pouvoir désactiver une page (ex: parrainage) sans la
 * supprimer du code (réactivation rapide, code intact, navigation peut casser
 * mais on garde l'historique). La page concernée appelle `assertPageEnabled`
 * en haut de son rendu : si elle est dans la liste, elle déclenche notFound().
 *
 * Source de vérité : `src/data/disabled-pages.json`. Édité depuis
 * `/sandbox/v1-8/pages-toggle` (server action) ou à la main.
 */
import config from "@/data/disabled-pages.json";

export type DisabledPagesConfig = {
  disabled: string[];
  updated_at?: string;
};

export function loadDisabledPages(): DisabledPagesConfig {
  const c = config as { disabled?: unknown; updated_at?: unknown };
  const disabled = Array.isArray(c.disabled) ? c.disabled.filter((x): x is string => typeof x === "string") : [];
  const updated_at = typeof c.updated_at === "string" ? c.updated_at : undefined;
  return { disabled, updated_at };
}

export function isPageDisabled(pathname: string): boolean {
  const cfg = loadDisabledPages();
  // Match exact OU prefix : "/parrainage" disable aussi "/parrainage/abc"
  return cfg.disabled.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
