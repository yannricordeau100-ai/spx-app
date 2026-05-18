/**
 * Labels personnalisables pour les 5 catégories de to-dos.
 *
 * IMPORTANT : ces labels sont uniquement de l'affichage. Les VALEURS en
 * BDD (champ `priority` de `desk_todos`) restent figées (`urgent`, `high`,
 * `normal`, `low`, `extra`) pour ne jamais casser les tâches existantes.
 * Le mapping label → valeur DB est figé. Seul le texte affiché est
 * customisable.
 *
 * Stockage v2 (Yann 18 mai 2026, bascule niveau 1) :
 *   - SOURCE DE VÉRITÉ : table Supabase `desk_user_preferences.todo_category_labels`
 *     (survit aux changements de domaine prod / niveau1 / niveau2)
 *   - CACHE local navigateur : `mettrik.todo.categories.v1` (lecture instantanée
 *     au mount avant que l'API renvoie). Synchronisé en arrière-plan.
 */

export type DbValue = "urgent" | "high" | "normal" | "low" | "extra";

export type CategoryLabels = Record<DbValue, string>;

// Defaults v3 (5 mai 2026) : Yann a re-signalé qu'il ne reconnaît pas
// "urgent/high/low" et veut son ancienne version. On restore celle d'avril
// (urgent/V2/V3/Idée à creuser/Bonus) qui était la version la plus à jour
// avant mon revert du 4 mai. Les tâches ne sont jamais perdues : seul
// l'AFFICHAGE des labels change, le mapping label → DB value est figé.
// Yann peut customiser via le crayon UI dans la barre filtres todos.
export const DEFAULT_CATEGORY_LABELS: CategoryLabels = {
  urgent: "urgent",
  high: "V2",
  normal: "V3",
  low: "Idée à creuser",
  extra: "Bonus",
};

const STORAGE_KEY = "mettrik.todo.categories.v1";

/** Merge un partial avec les défauts pour gérer les clés manquantes. */
function mergeWithDefaults(parsed: Partial<CategoryLabels>): CategoryLabels {
  return {
    urgent: parsed.urgent || DEFAULT_CATEGORY_LABELS.urgent,
    high: parsed.high || DEFAULT_CATEGORY_LABELS.high,
    normal: parsed.normal || DEFAULT_CATEGORY_LABELS.normal,
    low: parsed.low || DEFAULT_CATEGORY_LABELS.low,
    extra: parsed.extra || DEFAULT_CATEGORY_LABELS.extra,
  };
}

/**
 * Lit les labels depuis le cache localStorage (instantané). Si rien en cache,
 * retourne les défauts. La vraie source de vérité est en BDD via API ;
 * l'appelant doit aussi appeler `fetchCategoryLabels()` au mount pour
 * synchroniser et écraser le cache.
 */
export function readCategoryLabels(): CategoryLabels {
  if (typeof window === "undefined") return DEFAULT_CATEGORY_LABELS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CATEGORY_LABELS;
    const parsed = JSON.parse(raw) as Partial<CategoryLabels>;
    return mergeWithDefaults(parsed);
  } catch {
    return DEFAULT_CATEGORY_LABELS;
  }
}

/**
 * Fetch les labels depuis la BDD (source de vérité). Met à jour le cache
 * localStorage. À appeler au mount du composant todos.
 */
export async function fetchCategoryLabels(): Promise<CategoryLabels> {
  if (typeof window === "undefined") return DEFAULT_CATEGORY_LABELS;
  try {
    const res = await fetch("/api/desk/user-preferences", { credentials: "include" });
    if (!res.ok) return readCategoryLabels(); // fallback cache
    const data = (await res.json()) as { todo_category_labels?: Partial<CategoryLabels> };
    const labels = mergeWithDefaults(data.todo_category_labels ?? {});
    // Mise à jour du cache
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(labels));
    } catch {}
    return labels;
  } catch {
    return readCategoryLabels();
  }
}

/**
 * Persiste les labels en BDD + cache local. Retourne true si OK.
 */
export async function writeCategoryLabels(labels: CategoryLabels): Promise<boolean> {
  if (typeof window === "undefined") return false;
  // Optimistic local write
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(labels));
  } catch {}
  // Sync vers BDD (best-effort)
  try {
    const res = await fetch("/api/desk/user-preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ todo_category_labels: labels }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Reset les labels aux défauts (en BDD + cache local). */
export async function resetCategoryLabels(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {}
  try {
    await fetch("/api/desk/user-preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ todo_category_labels: {} }),
    });
  } catch {}
}
