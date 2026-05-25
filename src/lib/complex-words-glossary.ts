/**
 * Auto-generated from scripts/build-complex-words-glossary.py
 * Source de données : src/data/complex-words-glossary.json
 *
 * NE PAS éditer ce fichier à la main.
 * Pour ajouter / corriger un terme :
 *   1. Ajouter le terme dans la liste TERMS du script Python.
 *   2. Relancer `python3 scripts/build-complex-words-glossary.py --resume`.
 *   3. Le JSON est re-généré, puis ce module le réexporte tel quel.
 */
import raw from "@/data/complex-words-glossary.json";

export type ComplexWordLevel = "basic" | "intermediate" | "advanced";

export type ComplexWordEntry = {
  /** Explication FR pour adolescent 16 ans sans formation financière */
  explanation_fr: string;
  /** Catégorie générale (comptable / marche / tech / gouvernance / finance / risque / banque / composite) */
  category: string;
  /** Niveau de difficulté */
  level: ComplexWordLevel;
  /** True si Cerebras n'a pas fourni d'explication (à compléter à la main) */
  _pending_explanation?: boolean;
};

/**
 * Glossaire FR des mots compliqués détectables automatiquement dans la prose
 * de l'app (interpretations, AI positioning, risks, governance, KPI rationale).
 *
 * Utilisé par <AutoTooltipText> pour wrapper chaque occurrence d'un terme
 * connu avec un <InfoTooltip> dont le contenu est l'explication FR.
 */
export const COMPLEX_WORDS_FR: Record<string, ComplexWordEntry> = raw as Record<
  string,
  ComplexWordEntry
>;

/**
 * Liste triée par longueur descendante des termes connus.
 * Trier par longueur d'abord = permet à un terme composé ("Free Cash Flow")
 * d'être matché avant un terme court qui en serait un sous-élément ("Cash Flow").
 */
export const COMPLEX_WORDS_KEYS: string[] = Object.keys(COMPLEX_WORDS_FR).sort(
  (a, b) => b.length - a.length
);

/**
 * Regex unique qui matche n'importe quel terme du glossaire, avec word-boundary
 * tolérante (le terme peut contenir des espaces, des "/" et "&"). Capture
 * insensible à la casse.
 *
 * On échappe les caractères spéciaux regex présents dans les clés (ex : "&", "/").
 */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const ALTERNATION = COMPLEX_WORDS_KEYS.map(escapeRegex).join("|");

// Word-boundary tolérante : avant = début ou non-mot ; après = idem.
// Acronymes type "P/E" et "M&A" contiennent des caractères non-word, donc on
// utilise des lookarounds Unicode plutôt que \b strict.
export const COMPLEX_WORDS_REGEX = new RegExp(
  `(?<![\\p{L}\\p{N}_])(${ALTERNATION})(?![\\p{L}\\p{N}_])`,
  "giu"
);

/**
 * Retourne la clé canonique (avec casse d'origine) d'un terme matché.
 * Ex: "goodwill" → "Goodwill", "ebitda" → "EBITDA", "p/e" → "P/E".
 */
export function canonicalKey(match: string): string | undefined {
  const lower = match.toLowerCase();
  for (const key of COMPLEX_WORDS_KEYS) {
    if (key.toLowerCase() === lower) return key;
  }
  return undefined;
}

/**
 * Stats utiles (pour log / debug).
 */
export const COMPLEX_WORDS_STATS = {
  total: COMPLEX_WORDS_KEYS.length,
  pending: Object.values(COMPLEX_WORDS_FR).filter(
    (e) => e._pending_explanation
  ).length,
};
