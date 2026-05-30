/**
 * src/lib/floutage.ts
 *
 * Helper côté UI free tier : applique les règles de floutage stockées dans
 * `src/data/floutage-rules.json` (générées depuis la sélection visuelle Yann
 * sur /sandbox/admin/floutage-selector).
 *
 * V1 (maintenant) : applique CSS `filter: blur(8px)` + classe utilitaire sur
 * les éléments matchant `dom_selector`.
 *
 * V2 (futur) : prise en compte `sub_target` (offset pixel intra-élément) pour
 * flouter une zone précise d'un bloc.
 */

export type FloutageRule = {
  label: string;
  dom_selector: string;
  sub_target?: { x: number; y: number; w: number; h: number } | null;
  action: "blur" | "hide";
};

export type FloutageRulesFile = {
  rules: FloutageRule[];
  generated_at?: string;
  signed_by?: string;
};

/**
 * Applique les règles côté DOM (à appeler dans un useEffect côté client).
 * Retourne un cleanup qui restaure l'état initial.
 */
export function applyFloutageRules(rules: FloutageRule[]): () => void {
  if (typeof document === "undefined" || rules.length === 0) {
    return () => {};
  }

  const touched: { el: HTMLElement; prevFilter: string; prevDataset: string | undefined }[] = [];

  for (const rule of rules) {
    let els: NodeListOf<Element> | null = null;
    try {
      els = document.querySelectorAll(rule.dom_selector);
    } catch {
      // sélecteur invalide → skip silencieux
      continue;
    }
    els.forEach((node) => {
      const el = node as HTMLElement;
      if (el.dataset.floutageApplied === "1") return;
      touched.push({
        el,
        prevFilter: el.style.filter,
        prevDataset: el.dataset.floutageApplied,
      });
      if (rule.action === "hide") {
        el.style.visibility = "hidden";
      } else {
        el.style.filter = "blur(8px)";
        el.style.userSelect = "none";
        el.style.pointerEvents = "none";
      }
      el.dataset.floutageApplied = "1";
      el.dataset.floutageLabel = rule.label;
    });
  }

  return () => {
    for (const t of touched) {
      t.el.style.filter = t.prevFilter;
      t.el.style.visibility = "";
      t.el.style.userSelect = "";
      t.el.style.pointerEvents = "";
      if (t.prevDataset === undefined) {
        delete t.el.dataset.floutageApplied;
      }
      delete t.el.dataset.floutageLabel;
    }
  };
}
