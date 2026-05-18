/**
 * curation-score.ts — calcule la "lumière" globale d'une société pour la
 * page sandbox /curated-companies.
 *
 * Yann 18 mai 2026 : combine deux sources fiables existantes :
 *   - coverage-matrix : data audit (blocs présents + à jour + visibles)
 *   - visual-audit : Gemini auto-audit (fails de rendu avec severity 1-5)
 *
 * Résultat : 4 couleurs avec critères PRÉCIS et reproductibles.
 */

/** État d'un bloc dans coverage-matrix : a=juste, b=à jour, c=visible. */
export type BlockStatus = {
  a: boolean;
  b: boolean;
  c: boolean;
};

/** Fail observé par Gemini : id + severity 1-5. */
export type VisualFail = {
  id: string;
  severity: number;
};

export type CurationInput = {
  /** Map des blocs principaux ↔ leur état (hero, risks, governance, etc.). */
  blocks: Record<string, BlockStatus>;
  /** Fails Gemini visuels (peut être vide si pas encore audité). */
  visualFails: VisualFail[];
  /** Si le ticker n'a JAMAIS été audité Gemini → ne pas pénaliser. */
  visualAuditMissing: boolean;
};

export type CurationScore = {
  color: "green" | "yellow" | "orange" | "red";
  /** Compteur "X/N verts" (blocs A+B+C OK). */
  blocksGood: number;
  blocksTotal: number;
  /** Liste des blocs en défaut (ceux qui ne sont pas A+B+C). */
  blocksInDefault: string[];
  /** Le hero KPI a-t-il sa data ? (= blocker principal) */
  heroOk: boolean;
  /** Nb de fails Gemini severity ≥ 3. */
  visualMajorFails: number;
  /** Nb de fails Gemini severity 5 (blocker). */
  visualBlockerFails: number;
  /** Phrase courte expliquant la couleur. */
  reason: string;
};

const HERO_BLOCK_KEYS = ["hero", "hero_kpi", "hero_history"]; // un des 3 doit être OK

/** Détermine si le bloc hero KPI est OK. */
function isHeroOk(blocks: Record<string, BlockStatus>): boolean {
  for (const k of HERO_BLOCK_KEYS) {
    const s = blocks[k];
    if (s && s.a && s.b && s.c) return true;
  }
  // fallback : si une clé contient "hero" et est OK
  for (const [key, s] of Object.entries(blocks)) {
    if (key.toLowerCase().includes("hero") && s.a && s.b && s.c) return true;
  }
  return false;
}

/**
 * Calcule la couleur de curation d'une sté.
 *
 * Règles (ordre d'évaluation) :
 *   ROUGE   : hero KPI manquant (data) OU ≥1 fail Gemini severity 5 (blocker)
 *   ORANGE  : <50% des blocs A+B+C OK
 *   JAUNE   : 50-94% blocs A+B+C OK, OU ≥1 fail Gemini severity ≥3 (mais 0 blocker)
 *   VERT    : ≥95% blocs A+B+C OK + 0 fail Gemini severity ≥3
 */
export function computeCurationScore(input: CurationInput): CurationScore {
  const { blocks, visualFails, visualAuditMissing } = input;
  const blockEntries = Object.entries(blocks);
  const blocksTotal = blockEntries.length;
  const goodEntries = blockEntries.filter(([, s]) => s.a && s.b && s.c);
  const blocksGood = goodEntries.length;
  const blocksInDefault = blockEntries
    .filter(([, s]) => !(s.a && s.b && s.c))
    .map(([k]) => k);
  const ratio = blocksTotal === 0 ? 0 : blocksGood / blocksTotal;
  const heroOk = isHeroOk(blocks);
  const visualBlockerFails = visualAuditMissing
    ? 0
    : visualFails.filter((f) => f.severity >= 5).length;
  const visualMajorFails = visualAuditMissing
    ? 0
    : visualFails.filter((f) => f.severity >= 3).length;

  // ROUGE
  if (!heroOk) {
    return {
      color: "red",
      blocksGood,
      blocksTotal,
      blocksInDefault,
      heroOk: false,
      visualMajorFails,
      visualBlockerFails,
      reason: "Hero KPI manquant",
    };
  }
  if (visualBlockerFails > 0) {
    return {
      color: "red",
      blocksGood,
      blocksTotal,
      blocksInDefault,
      heroOk,
      visualMajorFails,
      visualBlockerFails,
      reason: `${visualBlockerFails} fail(s) Gemini sévérité 5 (blocker)`,
    };
  }
  // ORANGE
  if (ratio < 0.5) {
    return {
      color: "orange",
      blocksGood,
      blocksTotal,
      blocksInDefault,
      heroOk,
      visualMajorFails,
      visualBlockerFails,
      reason: `Moins de 50% des blocs OK (${blocksGood}/${blocksTotal})`,
    };
  }
  // JAUNE
  if (ratio < 0.95 || visualMajorFails > 0) {
    return {
      color: "yellow",
      blocksGood,
      blocksTotal,
      blocksInDefault,
      heroOk,
      visualMajorFails,
      visualBlockerFails,
      reason:
        ratio < 0.95
          ? `${blocksGood}/${blocksTotal} blocs OK (sous 95%)`
          : `${visualMajorFails} fail(s) Gemini sévérité ≥3`,
    };
  }
  // VERT
  return {
    color: "green",
    blocksGood,
    blocksTotal,
    blocksInDefault,
    heroOk,
    visualMajorFails,
    visualBlockerFails,
    reason: "Tous les critères verts",
  };
}

/** Métadonnées d'affichage par couleur. */
export const COLOR_META: Record<
  CurationScore["color"],
  { label: string; bg: string; border: string; text: string; dot: string; emoji: string }
> = {
  green: {
    label: "Prêt prod",
    bg: "bg-emerald-500/15",
    border: "border-emerald-500/40",
    text: "text-emerald-200",
    dot: "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]",
    emoji: "🟢",
  },
  yellow: {
    label: "Quasi prêt",
    bg: "bg-yellow-500/15",
    border: "border-yellow-500/40",
    text: "text-yellow-200",
    dot: "bg-yellow-400 shadow-[0_0_6px_rgba(250,204,21,0.7)]",
    emoji: "🟡",
  },
  orange: {
    label: "Incomplet",
    bg: "bg-orange-500/15",
    border: "border-orange-500/40",
    text: "text-orange-200",
    dot: "bg-orange-400 shadow-[0_0_6px_rgba(251,146,60,0.7)]",
    emoji: "🟠",
  },
  red: {
    label: "Bloquant",
    bg: "bg-red-500/15",
    border: "border-red-500/40",
    text: "text-red-200",
    dot: "bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.7)]",
    emoji: "🔴",
  },
};

/** Critères affichables à l'utilisateur (légende). */
export const COLOR_CRITERIA: Record<CurationScore["color"], string> = {
  green:
    "≥95% des blocs (a+b+c) OK · 0 fail Gemini sévérité ≥3 · Hero KPI présent",
  yellow:
    "50-94% des blocs OK · OU 1+ fail Gemini sévérité ≥3 · Pas de blocker hero",
  orange: "Moins de 50% des blocs OK · Hero KPI présent",
  red: "Hero KPI manquant · OU 1+ fail Gemini sévérité 5 (blocker)",
};
