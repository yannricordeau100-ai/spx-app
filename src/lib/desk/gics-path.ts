/**
 * Chemin GICS complet (4 niveaux) a partir du code a 8 chiffres.
 *
 * Yann 22 septembre 2026 : sur la fiche societe, les QUATRE niveaux de la
 * classification doivent toujours etre affiches, et toujours en francais.
 * La table `GICS` (src/lib/desk/gics.ts) porte deja les libelles francais
 * des 4 niveaux ; cet utilitaire se contente de les retrouver a partir du
 * code de l annuaire (docs/cahier/societes-gics.json), sans rien traduire.
 *
 * Les prefixes du code a 8 chiffres donnent la hierarchie :
 *   2 chiffres = secteur, 4 = groupe d industries, 6 = industrie,
 *   8 = sous-industrie.
 */
import { GICS } from "@/lib/desk/gics";

export type GicsPath = {
  code: string;
  secteur: string;
  groupe: string;
  industrie: string;
  sousIndustrie: string;
};

let index: Map<string, GicsPath> | null = null;

function construireIndex(): Map<string, GicsPath> {
  const m = new Map<string, GicsPath>();
  for (const secteur of GICS) {
    for (const groupe of secteur.groups) {
      for (const industrie of groupe.industries) {
        for (const sub of industrie.subs) {
          m.set(sub.code, {
            code: sub.code,
            secteur: secteur.name,
            groupe: groupe.name,
            industrie: industrie.name,
            sousIndustrie: sub.name,
          });
        }
      }
    }
  }
  return m;
}

/** Retourne les 4 niveaux francais, ou null si le code est absent ou invalide. */
export function gicsPath(code: string | undefined | null): GicsPath | null {
  if (typeof code !== "string" || !/^\d{8}$/.test(code)) return null;
  if (!index) index = construireIndex();
  return index.get(code) ?? null;
}

/** Les 4 libelles dans l ordre hierarchique, pratique pour le rendu. */
export function gicsNiveaux(code: string | undefined | null): string[] {
  const p = gicsPath(code);
  return p ? [p.secteur, p.groupe, p.industrie, p.sousIndustrie] : [];
}
