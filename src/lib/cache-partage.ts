/**
 * Lecture d une table (ou d un reglage) EN UNE FOIS, mise en cache (13 oct 2026).
 *
 * Contexte : docs/rapports-session-2026-10/supabase-journaux.md. Les lectures
 * « une requete par societe » ou « une requete par page vue » remplissaient les
 * journaux Supabase (58 000 lignes par jour). Ici, une seule requete charge tout
 * le contenu utile, puis chaque appelant lit en memoire.
 *
 * Trois etages :
 *  1. memoire du processus (courte dans Next, 5 min dans un script) ;
 *  2. cache de donnees PARTAGE de Next (unstable_cache), avec une etiquette
 *     propre, vide a chaque ecriture depuis le back-office (invalider()) ;
 *  3. la base, en dernier recours.
 *
 * Hors de Next (scripts tsx), unstable_cache n existe pas : la memoire du
 * processus suffit. Dans un unstable_cache imbrique (construction d une fiche),
 * Next contourne le cache partage : la memoire, remplie juste avant par
 * prechauffer(), prend le relais.
 *
 * Le chargeur DOIT lever une exception en cas d erreur reseau ou base : une
 * erreur n est jamais mise en cache, l appelant applique son repli habituel.
 */
import { revalidateTag, unstable_cache } from "next/cache";

type Options = {
  /** Etiquette du cache partage (videe par invalider()). */
  etiquette: string;
  /** Duree du cache partage, en secondes. */
  dureeSec?: number;
  /** Fraicheur de la memoire du processus dans Next, en ms. */
  memoireNextMs?: number;
  /** Fraicheur de la memoire du processus hors Next (scripts), en ms. */
  memoireScriptMs?: number;
};

export type TableEnCache<T> = {
  /** Contenu, depuis la memoire si elle a moins de `fraicheurMs` (sinon defaut). */
  lire(fraicheurMs?: number): Promise<T>;
  /** Recharge la memoire depuis le cache partage (appel non imbrique). */
  prechauffer(): Promise<void>;
  /** Vide la memoire locale et le cache partage (apres une ecriture). */
  invalider(): void;
};

let horsNext = false;

function estAbsenceCacheNext(e: unknown): boolean {
  return /incrementalCache missing/i.test(String((e as Error)?.message ?? e));
}

export function tableEnCache<T>(nom: string, charge: () => Promise<T>, o: Options): TableEnCache<T> {
  const dureeSec = o.dureeSec ?? 300;
  const memoireNextMs = o.memoireNextMs ?? 60_000;
  const memoireScriptMs = o.memoireScriptMs ?? 300_000;
  const partage = unstable_cache(charge, ["table-en-cache", nom], { revalidate: dureeSec, tags: [o.etiquette] });
  let memoire: { at: number; v: T } | null = null;
  let enVol: Promise<T> | null = null;
  let generation = 0;

  async function viaPartage(): Promise<T> {
    if (horsNext) return charge();
    try {
      return await partage();
    } catch (e) {
      if (!estAbsenceCacheNext(e)) throw e;
      horsNext = true;
      return charge();
    }
  }

  function rafraichir(): Promise<T> {
    if (enVol) return enVol;
    const gen = generation;
    const p = viaPartage()
      .then((v) => {
        if (gen === generation) memoire = { at: Date.now(), v };
        return v;
      })
      .finally(() => {
        if (enVol === p) enVol = null;
      });
    enVol = p;
    return p;
  }

  async function lire(fraicheurMs?: number): Promise<T> {
    const max = fraicheurMs ?? (horsNext ? memoireScriptMs : memoireNextMs);
    if (memoire && Date.now() - memoire.at < max) return memoire.v;
    return rafraichir();
  }

  return {
    lire,
    async prechauffer(): Promise<void> {
      // Dans Next : relecture du cache partage (peu couteuse, sans Supabase)
      // pour que la memoire reflete toute ecriture faite depuis une autre
      // instance. Les rafales simultanees partagent la meme lecture (5 s).
      try {
        await lire(horsNext ? memoireScriptMs : 5_000);
      } catch {
        // l appelant retombera sur sa propre lecture
      }
    },
    invalider(): void {
      generation++;
      memoire = null;
      enVol = null;
      try {
        // { expire: 0 } : jamais de contenu perime servi apres une ecriture.
        revalidateTag(o.etiquette, { expire: 0 });
      } catch {
        // hors d une route ou d une action serveur (script) : memoire videe
      }
    },
  };
}
