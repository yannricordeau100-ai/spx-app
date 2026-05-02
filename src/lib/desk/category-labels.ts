/**
 * Labels personnalisables pour les 4 catégories de to-dos.
 *
 * IMPORTANT : ces labels sont uniquement de l'affichage. Les VALEURS en
 * BDD (champ `priority` de `desk_todos`) restent figées (`urgent`, `high`,
 * `normal`, `low`) pour ne jamais casser les tâches existantes. Le mapping
 * label → valeur DB est figé. Seul le texte affiché est customisable.
 *
 * Stockage : localStorage navigateur (clé `mettrik.todo.categories.v1`).
 * Fallback : labels par défaut si aucune customisation.
 */

export type DbValue = "urgent" | "high" | "normal" | "low";

export type CategoryLabels = Record<DbValue, string>;

export const DEFAULT_CATEGORY_LABELS: CategoryLabels = {
  urgent: "urgent",
  high: "V2",
  normal: "V3",
  low: "Idée à creuser",
};

const STORAGE_KEY = "mettrik.todo.categories.v1";

/** Lit les labels depuis localStorage. Retourne les défauts si absent ou corrompu. */
export function readCategoryLabels(): CategoryLabels {
  if (typeof window === "undefined") return DEFAULT_CATEGORY_LABELS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CATEGORY_LABELS;
    const parsed = JSON.parse(raw) as Partial<CategoryLabels>;
    // Toujours merge avec les défauts pour gérer les nouvelles clés
    return {
      urgent: parsed.urgent || DEFAULT_CATEGORY_LABELS.urgent,
      high: parsed.high || DEFAULT_CATEGORY_LABELS.high,
      normal: parsed.normal || DEFAULT_CATEGORY_LABELS.normal,
      low: parsed.low || DEFAULT_CATEGORY_LABELS.low,
    };
  } catch {
    return DEFAULT_CATEGORY_LABELS;
  }
}

/** Persiste les labels dans localStorage. Retourne true si OK, false si échec. */
export function writeCategoryLabels(labels: CategoryLabels): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(labels));
    return true;
  } catch {
    return false;
  }
}

/** Reset les labels aux défauts. */
export function resetCategoryLabels(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {}
}
