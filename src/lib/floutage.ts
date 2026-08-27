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

  const touched: {
    el: HTMLElement;
    prevFilter: string;
    prevBoxDecorationBreak: string;
    prevWebkitBoxDecorationBreak: string;
    prevDataset: string | undefined;
  }[] = [];

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
        prevBoxDecorationBreak: el.style.boxDecorationBreak,
        prevWebkitBoxDecorationBreak: (el.style as unknown as Record<string, string>)["webkitBoxDecorationBreak"] ?? "",
        prevDataset: el.dataset.floutageApplied,
      });
      if (rule.action === "hide") {
        el.style.visibility = "hidden";
      } else {
        el.style.filter = "blur(8px)";
        el.style.userSelect = "none";
        el.style.pointerEvents = "none";
        // Yann 2 juin 2026 : flou adaptatif multi-lignes.
        // box-decoration-break:clone permet au filter:blur de s'appliquer
        // ligne par ligne sur un span inline qui wrap. Sans ça, le blur
        // dessine un seul rectangle englobant qui mord sur le texte voisin.
        el.style.boxDecorationBreak = "clone";
        (el.style as unknown as Record<string, string>)["webkitBoxDecorationBreak"] = "clone";
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
      t.el.style.boxDecorationBreak = t.prevBoxDecorationBreak;
      (t.el.style as unknown as Record<string, string>)["webkitBoxDecorationBreak"] = t.prevWebkitBoxDecorationBreak;
      if (t.prevDataset === undefined) {
        delete t.el.dataset.floutageApplied;
      }
      delete t.el.dataset.floutageLabel;
    }
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   Zones nommées (Yann 27 aout 2026)

   Pourquoi ce second mecanisme : `dom_selector` ci dessus enregistre un chemin
   CSS du type `div.mt-9.rounded-2xl > section:nth-of-type(3)`. Ce chemin est
   fait de classes utilitaires et de rangs de freres, deux choses qui changent
   a chaque retouche de design et qui different d une societe a l autre selon
   les blocs reellement presents. D ou l ecart entre la zone montree dans
   l outil et la zone reellement floutee en production.

   La regle posee ici : une zone est designee par l identifiant STABLE du bloc
   (les memes que ceux du controle des blocs) et, si besoin, par une partie de
   ce bloc. L attribut `data-blur` est emis par les composants eux memes, donc
   il survit a toute refonte visuelle et vaut pour les 656 pages.
   ═══════════════════════════════════════════════════════════════════════════ */

import type { BlockId } from "@/lib/v1-9-blocks-control";
import { BLOCK_LABELS } from "@/lib/v1-9-blocks-control";

export type PartieDeBloc =
  | "tout"
  | "titre"
  | "valeur"
  | "variation"
  | "graphique"
  | "tableau"
  | "texte"
  | "source";

export const LIBELLES_PARTIES: Record<PartieDeBloc, string> = {
  tout: "le bloc entier",
  titre: "le titre",
  valeur: "la valeur chiffrée",
  variation: "la variation",
  graphique: "le graphique",
  tableau: "le tableau",
  texte: "le texte",
  source: "la source",
};

export type Zone = { bloc: BlockId; partie: PartieDeBloc };

/** Selecteur applique a l identique en apercu et en production. */
export function selecteurDeZone(z: Zone): string {
  const base = `[data-blur="${z.bloc}"]`;
  return z.partie === "tout" ? base : `${base} [data-blur-part="${z.partie}"]`;
}

/** Libelle lisible, affiche dans l outil et dans les recapitulatifs. */
export function libelleDeZone(z: Zone): string {
  const bloc = BLOCK_LABELS[z.bloc] ?? z.bloc;
  return z.partie === "tout" ? bloc : `${bloc} : ${LIBELLES_PARTIES[z.partie]}`;
}

/** Parties proposees par bloc dans l outil de selection. */
export const PARTIES_PAR_BLOC: Partial<Record<BlockId, PartieDeBloc[]>> = {
  hero: ["tout", "titre", "valeur", "variation", "graphique", "source"],
  kpis: ["tout", "titre", "tableau", "valeur", "variation"],
  stories: ["tout", "titre", "texte", "source"],
  repartition: ["tout", "titre", "graphique", "tableau"],
  governance: ["tout", "titre", "tableau", "texte"],
  risks: ["tout", "titre", "texte", "source"],
  events: ["tout", "titre", "tableau"],
  ai_positioning: ["tout", "titre", "texte", "source"],
  dividend: ["tout", "titre", "valeur", "graphique"],
  transcripts: ["tout", "titre", "texte", "source"],
  image_findings: ["tout", "titre", "graphique", "source"],
  ranks: ["tout", "titre", "tableau", "valeur"],
  interpretation: ["tout", "texte"],
  company_logo: ["tout"],
};

/** Transforme des zones nommees en regles, pour reutiliser applyFloutageRules. */
export function zonesEnRegles(zones: Zone[]): FloutageRule[] {
  return zones.map((z) => ({
    label: libelleDeZone(z),
    dom_selector: selecteurDeZone(z),
    sub_target: null,
    action: "blur" as const,
  }));
}
