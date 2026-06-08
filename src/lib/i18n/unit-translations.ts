/**
 * unit-translations (Yann 8 juin 2026, Point 4)
 *
 * Traduction FR -> EN des unités NON monétaires affichées sur l'axe Y
 * d'un chart, utilisée UNIQUEMENT quand l'utilisateur a basculé le titre
 * du KPI en anglais via KpiSwapTitle (clic sur le titre du graph hero
 * ou d'une ligne du tableau Indicateurs cles).
 *
 * Regle stricte (CLAUDE.md, scope Mettrik) :
 *  - Les SYMBOLES MONETAIRES ne sont JAMAIS traduits (les codes ISO et
 *    symboles $/EUR/USD/GBP/CHF/JPY/etc. restent identiques en FR et EN).
 *    La forme "Mds $" devient "Bn $" UNIQUEMENT via le helper
 *    `chartAxisHeader(unit, locale)` qui traite deja le cas monetaire
 *    via le SCALE_WORDS locale-aware (Mds -> Bn en en).
 *  - Le signe % n'est jamais traduit.
 *  - Les valeurs numeriques ne sont jamais traduites.
 *
 * Ce helper se contente de mapper les UNITES TEXTUELLES FR pures
 * (Mds, Millions, Milliers, unites, abonnes, clients, employes, tonnes,
 * points) vers leur equivalent EN, et seulement si l'unite n'est pas
 * deja une unite monetaire connue (cf. isCurrencyLikeUnit).
 */

import { isCurrencyLikeUnit } from "@/lib/chart-axis-header";

/**
 * Mapping FR -> EN pour les unites non monetaires. Cle = forme FR
 * canonique attendue (case-insensitive a la lecture mais case preserve
 * a l'ecriture). Valeur = forme EN equivalente.
 *
 * Note Mettrik : "tonnes" reste "tonnes" en EN (meme orthographe pour
 * tonne metrique). "points" reste "points".
 */
const FR_TO_EN_UNIT: Record<string, string> = {
  "Mds": "Bn",
  "Millions": "Millions",
  "Milliers": "Thousands",
  "unites": "units",
  "abonnes": "subscribers",
  "clients": "customers",
  "employes": "employees",
  "tonnes": "tonnes",
  "points": "points",
};

/**
 * Variantes avec accents pour matcher les datasets FR reels
 * (unites/unités, abonnes/abonnés, employes/employés).
 */
const FR_TO_EN_UNIT_ACCENTED: Record<string, string> = {
  "unités": "units",
  "abonnés": "subscribers",
  "employés": "employees",
};

/**
 * Strip accents pour matcher de maniere case+accent insensitive.
 */
function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/**
 * Traduit une unite FR vers EN si elle est non monetaire ET dans la
 * liste blanche. Sinon retourne l'unite telle quelle.
 *
 * Cette fonction est appelee SEULEMENT quand titleLocale === 'en' et
 * que la locale globale est 'fr'. Si la locale globale est deja EN,
 * la traduction est inutile (chartAxisHeader gere deja l'axe Y EN).
 */
export function translateUnitFrToEn(unit: string): string {
  if (!unit) return unit;
  const trimmed = unit.trim();

  // Garde-fou : unite monetaire = ne JAMAIS traduire. chartAxisHeader
  // s'en occupe via locale param.
  if (isCurrencyLikeUnit(trimmed)) return unit;

  // Garde-fou : pourcentage / ratio = pas de traduction.
  if (trimmed === "%" || trimmed === "% YoY") return unit;

  // Match exact accentue
  if (FR_TO_EN_UNIT_ACCENTED[trimmed]) return FR_TO_EN_UNIT_ACCENTED[trimmed];

  // Match exact non accentue
  if (FR_TO_EN_UNIT[trimmed]) return FR_TO_EN_UNIT[trimmed];

  // Match case+accent insensitive sur la table non accentuee
  const norm = stripAccents(trimmed).toLowerCase();
  for (const [fr, en] of Object.entries(FR_TO_EN_UNIT)) {
    if (stripAccents(fr).toLowerCase() === norm) return en;
  }

  // Match case+accent insensitive sur la table accentuee
  for (const [fr, en] of Object.entries(FR_TO_EN_UNIT_ACCENTED)) {
    if (stripAccents(fr).toLowerCase() === norm) return en;
  }

  // Cas composite type "Mds tonnes" ou "M unites" : on tente la traduction
  // sur la partie textuelle apres le prefixe scale (Mds/M/K).
  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2) {
    const head = parts[0];
    const tail = parts.slice(1).join(" ");
    const translatedTail = translateUnitFrToEn(tail);
    if (translatedTail !== tail) {
      // Le tail a ete traduit => on traduit aussi le scale si possible
      const scaleMap: Record<string, string> = { "Mds": "Bn", "M": "M", "K": "K" };
      const translatedHead = scaleMap[head] ?? head;
      return `${translatedHead} ${translatedTail}`;
    }
  }

  return unit;
}
