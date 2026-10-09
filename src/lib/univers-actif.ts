/**
 * Univers servi par CE deploiement (Yann, 9 oct 2026 : le Russell 1000 devient
 * un indice couvert ; ses 490 societes absentes de Mettrik, la vague
 * « sp5001000 », recoivent leurs fiches d abord sur le niveau 1 SEUL).
 *
 * Deux univers, choisis par la variable d execution UNIVERS :
 *  - sans variable (mettrik.ai, niveau 2, poste local, scripts) : univers
 *    principal = src/data/v1-9-5-clean-all-tickers.json. Comportement
 *    STRICTEMENT inchange pour toutes les societes existantes. Seule
 *    difference : une societe de la vague sp5001000 qui n est pas dans la
 *    liste d autorisation (`autorisees_univers_principal`) n est JAMAIS servie
 *    (fiche, chargeur, metadonnees), meme si un ancien jeu de donnees la
 *    contient (cas de /snow et /twlo, servies aux inscrits avant ce garde-fou).
 *  - UNIVERS=sp5001000 (pose uniquement sur le deploiement du niveau 1 par
 *    scripts/deploy-niveau1.sh, jamais dans les variables du projet Vercel) :
 *    seules les fiches pretes de src/data/univers-sp5001000.json (`tickers`)
 *    existent. Aucune societe de l univers principal n est servie, listee,
 *    cherchable ou comptee.
 *
 * Source de la liste : scripts/sp5001000-onboard.py (une societe n y entre que
 * si sa fiche est prete). Garde-fou permanent : scripts/verif-release.py.
 *
 * REGLE : module SERVEUR uniquement (proxy, pages serveur, routes API). Ne
 * jamais l importer depuis un composant "use client" (la vague complete
 * finirait dans le JS public : controle verif-fuites-publiques.mjs).
 */
import CLEAN_ALL from "../data/v1-9-5-clean-all-tickers.json";
import SP5001000 from "../data/univers-sp5001000.json";

export type UniversId = "principal" | "sp5001000";

export type HeroN1 = { s: string; v: string | number | null; u: string; y: string | number; t: string };
export type SocieteN1 = { nom: string; secteur: string; sous_secteur?: string; hero?: HeroN1 | null; capi_usd?: number | null };

type FichierN1 = {
  tickers: string[];
  societes: Record<string, SocieteN1>;
  vague_complete: string[];
  autorisees_univers_principal: string[];
};

const N1 = SP5001000 as unknown as FichierN1;

/** Univers du deploiement courant (lu a l execution ; pose aussi au build pour les pages statiques). */
export function universActif(): UniversId {
  return (process.env.UNIVERS ?? "").trim().toLowerCase() === "sp5001000" ? "sp5001000" : "principal";
}

export function estUniversN1(): boolean {
  return universActif() === "sp5001000";
}

/** Variantes de separateur (BRK.B / BRK-B), en majuscules. */
function variantes(t: string): string[] {
  const u = t.toUpperCase();
  return [u, u.replace(/\./g, "-"), u.replace(/-/g, ".")];
}

function ensemble(liste: readonly string[]): ReadonlySet<string> {
  const s = new Set<string>();
  for (const t of liste) for (const v of variantes(t)) s.add(v);
  return s;
}

const CLEAN_ALL_TICKERS: string[] = (CLEAN_ALL as { tickers: string[] }).tickers;
const SET_PRINCIPAL = ensemble(CLEAN_ALL_TICKERS);
// Controle LOCAL des fiches candidates avant leur entree dans la liste
// (scripts/sp5001000-verif-fiches.ts, appele par sp5001000-onboard.py) : jamais
// pris en compte sur Vercel (VERCEL est toujours pose par la plateforme).
const CANDIDATS_LOCAUX = process.env.VERCEL ? [] : (process.env.UNIVERS_N1_CANDIDATS ?? "").split(",").map((x) => x.trim()).filter(Boolean);
const SET_N1 = ensemble([...(N1.tickers ?? []), ...CANDIDATS_LOCAUX]);
const SET_AUTORISEES = ensemble(N1.autorisees_univers_principal ?? []);
/** Vague sp5001000 en attente du go de Yann (hors liste d autorisation). */
const SET_RESERVEES: ReadonlySet<string> = (() => {
  const s = new Set<string>();
  for (const t of N1.vague_complete ?? []) {
    if (variantes(t).some((v) => SET_AUTORISEES.has(v))) continue;
    // Une societe deja dans l univers principal n est jamais reservee (ex BF-B = BF.B).
    if (variantes(t).some((v) => SET_PRINCIPAL.has(v))) continue;
    for (const v of variantes(t)) s.add(v);
  }
  return s;
})();

/** Tickers de l univers du deploiement (meme ordre que la liste source). */
export function tickersUniversActif(): string[] {
  return estUniversN1() ? [...(N1.tickers ?? [])] : [...CLEAN_ALL_TICKERS];
}

/** Le ticker appartient-il a l univers du deploiement ? (tolere . et -) */
export function dansUniversActif(ticker: string): boolean {
  const u = ticker.toUpperCase();
  return estUniversN1() ? SET_N1.has(u) : SET_PRINCIPAL.has(u);
}

/** Societe de la vague sp5001000 non encore autorisee dans l univers principal. */
export function estReserveeN1(ticker: string): boolean {
  return SET_RESERVEES.has(ticker.toUpperCase());
}

/**
 * Une fiche peut-elle etre servie par ce deploiement ?
 *  - niveau 1 (UNIVERS=sp5001000) : uniquement les fiches pretes de la vague ;
 *  - univers principal : tout sauf la vague reservee (les autres regles de
 *    visibilite des appelants s appliquent en plus, inchangees).
 */
export function ficheServie(ticker: string): boolean {
  return estUniversN1() ? SET_N1.has(ticker.toUpperCase()) : !estReserveeN1(ticker);
}

/** Identite courte d une societe du niveau 1 (recherche, metadonnees). */
export function societeN1(ticker: string): SocieteN1 | null {
  const u = ticker.toUpperCase();
  for (const v of variantes(u)) {
    const s = N1.societes?.[v];
    if (s) return s;
  }
  return null;
}

/** Toutes les societes pretes du niveau 1 (recherche cote serveur). */
export function societesN1(): Array<{ ticker: string } & SocieteN1> {
  return (N1.tickers ?? []).map((t) => ({ ticker: t, ...(N1.societes?.[t] ?? { nom: t, secteur: "" }) }));
}

/**
 * Suffixe des cles de cache partage (unstable_cache). Vide pour l univers
 * principal : les cles existantes restent identiques. Sur le niveau 1, la cle
 * change pour ne jamais relire une fiche mise en cache par un autre deploiement.
 */
export function cleCacheUnivers(): string[] {
  return estUniversN1() ? ["univers-sp5001000"] : [];
}
