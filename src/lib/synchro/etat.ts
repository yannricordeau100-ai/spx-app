import { promises as fs } from "node:fs";
import path from "node:path";
import { unstable_cache } from "next/cache";
import { VERSION } from "@/lib/version";

/**
 * Synchronisation quotidienne : etat REEL des pages (9 sept 2026, demande du
 * proprietaire). On ne lit aucun journal de cron : on compare ce que la fiche
 * porte (dernier point de KPI, derniere story, dernier transcript) a ce que
 * la societe a reellement publie (dernier depot SEC : date et fin de periode,
 * rafraichi chaque jour depuis EDGAR par scripts/fetch-filing-dates.py).
 *
 * Trois categories, chacune avec son interrupteur (Supabase) :
 *  - transcripts : transcript d earnings call (src/data/transcripts) ;
 *  - kpi_ic      : indicateurs cles (v2-pipeline + kpis-haut, series longues) ;
 *  - kpi_stories : stories (KPI a serie courte).
 */

export type CategorieSynchro = "transcripts" | "kpi_ic" | "kpi_stories";

export type LigneRetard = {
  ticker: string;
  /** Ce que la page porte (date du dernier point). */
  page: string | null;
  /** Ce que la societe a publie (fin de periode du dernier depot SEC). */
  reel: string;
  /** Date du depot SEC. */
  depose: string;
  joursRetard: number;
};

export type EtatCategorie = {
  aJour: number;
  enRetard: number;
  sansDonnee: number;
  horsSec: number;
  retards: LigneRetard[];
  /** Tickers hors SEC (pas de reference fiable), pour information. */
  horsSecListe: string[];
  /** Date du point le plus recent porte par les pages, toutes societes. */
  pointLePlusRecent: string | null;
};

export type EtatSynchro = {
  calculeLe: string;
  univers: number;
  categories: Record<CategorieSynchro, EtatCategorie>;
  fichiers: { depotsSecMisAJour: string | null; transcriptsMisAJour: string | null; kpisHautMisAJour: string | null };
};

const ROOT = process.cwd();

async function lireJson<T>(p: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(p, "utf-8")) as T;
  } catch {
    return null;
  }
}

function jours(a: string, b: string): number {
  return Math.round((Date.parse(a) - Date.parse(b)) / 86_400_000);
}

function maxDate(dates: (string | undefined | null)[]): string | null {
  let m: string | null = null;
  for (const d of dates) {
    if (typeof d === "string" && /^\d{4}-\d{2}-\d{2}/.test(d) && (!m || d > m)) m = d.slice(0, 10);
  }
  return m;
}

type Kpi = { short?: string; last_data_date?: string; is_short_history?: boolean; story_category?: string; history?: unknown[] };

async function calculer(): Promise<EtatSynchro> {
  const uni = await lireJson<{ tickers: string[] }>(path.join(ROOT, "src/data/v1-9-5-clean-all-tickers.json"));
  const tickers = uni?.tickers ?? [];
  const vide = (): EtatCategorie => ({ aJour: 0, enRetard: 0, sansDonnee: 0, horsSec: 0, retards: [], horsSecListe: [], pointLePlusRecent: null });
  const cats: Record<CategorieSynchro, EtatCategorie> = { transcripts: vide(), kpi_ic: vide(), kpi_stories: vide() };
  const plusRecent: Record<CategorieSynchro, string | null> = { transcripts: null, kpi_ic: null, kpi_stories: null };

  for (const t of tickers) {
    const low = t.toLowerCase();
    const [pipe, haut, enrich, tr] = await Promise.all([
      lireJson<{ kpis?: Kpi[] }>(path.join(ROOT, "src/data/v2-pipeline", `${low}.json`)),
      lireJson<{ kpis?: Kpi[] }>(path.join(ROOT, ".batches-drafts-safe/kpis-haut", `${t.toUpperCase()}.json`)),
      lireJson<{ latest_filing?: { date?: string; period_end?: string; form?: string } }>(path.join(ROOT, "src/data/v2-pipeline-enrich", `${low}.json`)),
      lireJson<{ latest?: { date?: string; quarter?: number; year?: number } }>(path.join(ROOT, "src/data/transcripts", `${low}.json`)),
    ]);
    const kpis: Kpi[] = [...(pipe?.kpis ?? []), ...(haut?.kpis ?? [])];
    const estStory = (k: Kpi) => !!k.is_short_history || (!!k.story_category && (Array.isArray(k.history) ? k.history.length : 0) <= 2);
    const pageIc = maxDate(kpis.filter((k) => !estStory(k)).map((k) => k.last_data_date));
    const pageStories = maxDate(kpis.filter(estStory).map((k) => k.last_data_date));
    const pageTr = maxDate([tr?.latest?.date]);
    const depot = enrich?.latest_filing;
    const reel = depot?.period_end && /^\d{4}-\d{2}-\d{2}/.test(depot.period_end) ? depot.period_end.slice(0, 10) : null;
    const depose = depot?.date && /^\d{4}-\d{2}-\d{2}/.test(depot.date) ? depot.date.slice(0, 10) : null;

    const juger = (cat: CategorieSynchro, page: string | null, tolerance: number) => {
      const c = cats[cat];
      if (page && (!plusRecent[cat] || page > plusRecent[cat]!)) plusRecent[cat] = page;
      if (!reel || !depose) {
        c.horsSec += 1;
        c.horsSecListe.push(t);
        return;
      }
      if (!page) {
        c.sansDonnee += 1;
        c.retards.push({ ticker: t, page: null, reel, depose, joursRetard: jours(new Date().toISOString(), depose) });
        return;
      }
      // A jour si le dernier point de la page couvre la fin de periode du
      // dernier depot (tolerance en jours pour les cloture decalees).
      if (jours(page, reel) >= -tolerance) c.aJour += 1;
      else {
        c.enRetard += 1;
        c.retards.push({ ticker: t, page, reel, depose, joursRetard: jours(new Date().toISOString(), depose) });
      }
    };
    juger("kpi_ic", pageIc, 10);
    juger("kpi_stories", pageStories, 10);
    // Un transcript est date du jour de la conference, quelques jours autour
    // du depot : on compare a la date du depot avec 45 jours de marge.
    juger("transcripts", pageTr, reel && depose ? Math.max(45, jours(depose, reel) + 10) : 45);
  }
  for (const cat of Object.keys(cats) as CategorieSynchro[]) {
    cats[cat].retards.sort((a, b) => b.joursRetard - a.joursRetard);
    cats[cat].pointLePlusRecent = plusRecent[cat];
  }
  const mtime = async (p: string) => {
    try {
      return (await fs.stat(path.join(ROOT, p))).mtime.toISOString();
    } catch {
      return null;
    }
  };
  return {
    calculeLe: new Date().toISOString(),
    univers: tickers.length,
    categories: cats,
    fichiers: {
      depotsSecMisAJour: await mtime("src/data/v2-pipeline-enrich/aapl.json"),
      transcriptsMisAJour: await mtime("src/data/transcripts"),
      kpisHautMisAJour: await mtime(".batches-drafts-safe/kpis-haut"),
    },
  };
}

export const etatSynchro = unstable_cache(calculer, ["etat-synchro", VERSION], { revalidate: 600 });
