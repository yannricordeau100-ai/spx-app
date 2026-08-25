/**
 * Effectif d'une société, extrait de la section "Human Capital" (Item 1) du
 * dernier 10-K et contrôlé (cohérence vs 10-K N-1 + filtre de contexte pour
 * écarter les faux positifs type "20 000 employés bénévoles").
 *
 * Yann 25 août 2026. Sociétés US uniquement : les émetteurs européens cotés
 * hors US ne déposent pas de 10-K, la chip est alors masquée.
 */
import EMPLOYEES from "@/data/employees.json";

const TABLE = EMPLOYEES as Record<string, number>;

export function employeeCount(ticker: string): number | null {
  if (!ticker) return null;
  const v = TABLE[ticker.toUpperCase()];
  return typeof v === "number" && v > 0 ? v : null;
}

/** Libellé formaté ("166 000") ou null si aucun chiffre fiable. */
export function employeeCountLabel(ticker: string, locale: string): string | null {
  const v = employeeCount(ticker);
  if (v == null) return null;
  return v.toLocaleString(locale.startsWith("fr") ? "fr-FR" : "en-US");
}
