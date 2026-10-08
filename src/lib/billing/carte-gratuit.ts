/**
 * carte-gratuit.ts : lignes de la carte du plan Gratuit sur /pricing.
 *
 * Yann 8 oct 2026 :
 *  1. Carte Gratuit : les fonctionnalités disponibles d abord, les barrées ensuite.
 *  2. Back-office (/desk-mtk9x4kp/pricing, onglet fonctionnalités) : Yann choisit
 *     les lignes valides et les lignes barrées de la carte Gratuit. Nombre total
 *     de lignes = celui de la carte actuelle (fonctionnalités cochées « Card »).
 *     Barrées proposées = fonctionnalités absentes du Gratuit mais incluses dans
 *     un autre plan (Premium, Max).
 *
 * Réglage en base : desk_page_content, page_key « pricing », section_key
 * « carte_gratuit », content_fr = JSON { inclus: string[], barres: string[] }
 * (codes de fonctionnalités). Absent = affichage par défaut (lignes « Card »).
 *
 * Module sans dépendance serveur : utilisé par la page publique et le back-office.
 */
import type { FeatureRow } from "./plans";

export type CarteGratuit = { inclus: string[]; barres: string[] };

export const CARTE_GRATUIT_PAGE_KEY = "pricing";
export const CARTE_GRATUIT_SECTION_KEY = "carte_gratuit";

/** Même règle que la carte publique : true ou texte non vide différent de « false ». */
export function valeurIncluse(v: string | boolean | null | undefined): boolean {
  if (v === true) return true;
  if (typeof v !== "string") return false;
  const s = v.trim();
  return s.length > 0 && s !== "false";
}

/** Lignes communes aux 3 cartes : cochées « Card », sinon les 8 premières. */
export function lignesCartes<T extends { show_in_card?: boolean }>(features: T[]): T[] {
  const cochees = features.filter((f) => f.show_in_card);
  return cochees.length > 0 ? cochees : features.slice(0, 8);
}

/** Lit le JSON stocké en base ; null si absent ou illisible. */
export function lireCarteGratuit(brut: string | null | undefined): CarteGratuit | null {
  if (!brut) return null;
  try {
    const j = JSON.parse(brut) as Partial<CarteGratuit>;
    const liste = (x: unknown) => (Array.isArray(x) ? x.filter((c): c is string => typeof c === "string") : []);
    const inclus = liste(j.inclus);
    const barres = liste(j.barres);
    if (inclus.length + barres.length === 0) return null;
    return { inclus, barres };
  } catch {
    return null;
  }
}

/**
 * Lignes de la carte Gratuit, dans l ordre public : valides d abord, barrées
 * ensuite (ordre des fonctionnalités conservé dans chaque groupe). Le réglage
 * du back-office est appliqué s il existe ; une ligne qui ne respecte plus la
 * règle (valide non incluse au Gratuit, barrée incluse au Gratuit ou absente
 * des autres plans) est ignorée. Nombre de lignes plafonné à celui des cartes.
 */
export function lignesCarteGratuit(features: FeatureRow[], reglage?: CarteGratuit | null): FeatureRow[] {
  const base = lignesCartes(features);
  const parDefaut = [
    ...base.filter((f) => valeurIncluse(f.free)),
    ...base.filter((f) => !valeurIncluse(f.free)),
  ];
  if (!reglage) return parDefaut;
  const inclus = new Set(reglage.inclus);
  const barres = new Set(reglage.barres);
  const valides = features.filter((f) => inclus.has(f.id) && valeurIncluse(f.free));
  const barrees = features.filter(
    (f) => barres.has(f.id) && !inclus.has(f.id) && !valeurIncluse(f.free) && (valeurIncluse(f.premium) || valeurIncluse(f.max)),
  );
  const lignes = [...valides, ...barrees].slice(0, base.length);
  return lignes.length > 0 ? lignes : parDefaut;
}
