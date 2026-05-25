/**
 * Helper pour la liste des locales masquées du picker langue.
 *
 * Pourquoi : Yann veut pouvoir masquer une langue (ex: NL) du dropdown
 * langue, SANS supprimer les dictionnaires i18n (ils restent intacts en
 * code, juste l'option disparaît visuellement). Réactivation rapide via
 * /sandbox/v1-8/languages-toggle.
 *
 * Source de vérité : `src/data/disabled-locales.json`.
 */
import config from "@/data/disabled-locales.json";
import type { Locale } from "@/lib/i18n/types";

export type DisabledLocalesConfig = {
  disabled: string[];
  updated_at?: string;
};

export function loadDisabledLocales(): DisabledLocalesConfig {
  const c = config as { disabled?: unknown; updated_at?: unknown };
  const disabled = Array.isArray(c.disabled)
    ? c.disabled.filter((x): x is string => typeof x === "string")
    : [];
  const updated_at = typeof c.updated_at === "string" ? c.updated_at : undefined;
  return { disabled, updated_at };
}

export function isLocaleDisabled(locale: Locale | string): boolean {
  const cfg = loadDisabledLocales();
  return cfg.disabled.includes(locale);
}

export function getDisabledLocaleSet(): Set<string> {
  return new Set(loadDisabledLocales().disabled);
}
