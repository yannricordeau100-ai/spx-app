import { promises as fs } from "node:fs";
import path from "node:path";
import COMP from "@/data/indices-composition.json";
import CLEAN from "@/data/v1-9-5-clean-all-tickers.json";
import RETIREES from "@/data/societes-retirees.json";
import { UniversIndicesClient, type Onglet, type Ligne } from "./client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Univers par indice · Mettrik (interne)",
  robots: { index: false, follow: false },
};

/**
 * Yann 9 oct 2026 : un onglet par indice (compositions de src/data/indices-composition.json,
 * relues sur Wikipedia et le portail Nasdaq par scripts/indices-wikipedia.py) plus l onglet
 * « sp5001000 » (Russell 1000 hors univers, data-lake/_sp5001000/liste.json, mission du 9 oct).
 * Les documents sont comptes sur disque dans data-lake/<T>/ : le lac n est pas deploye
 * (.vercelignore), la colonne est donc vide hors du Mac.
 */
const DOSSIERS_DOCS = ["10K", "10Q", "8K", "DEF14A", "ER", "ES", "EP", "20F", "40F", "6K", "S1", "S4", "xbrl", "transcripts", "ir"] as const;
const LAKE = path.join(process.cwd(), "data-lake");

type Indice = { nom: string; pays: string; total: number; membres: { ticker: string; nom: string }[]; en_ligne: string[] };
type ListeSp = {
  date_liste?: string;
  _source?: string;
  n_societes_iwb?: number;
  n_deja_univers?: number;
  societes: { ticker: string; nom: string; cik: string | null; secteur_gics: string | null; radiee?: boolean }[];
};

const norm = (t: string) => t.toUpperCase().replace(/\./g, "-");

async function lisJson<T>(p: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(p, "utf-8")) as T;
  } catch {
    return null;
  }
}

async function compteDocs(ticker: string): Promise<Record<string, number> | null> {
  const base = path.join(LAKE, ticker);
  try {
    await fs.access(base);
  } catch {
    return null;
  }
  const out: Record<string, number> = {};
  await Promise.all(
    DOSSIERS_DOCS.map(async (d) => {
      try {
        const n = (await fs.readdir(path.join(base, d))).filter((f) => !f.startsWith(".") && !f.endsWith(".part")).length;
        if (n > 0) out[d] = n;
      } catch {
        /* dossier absent */
      }
    }),
  );
  return out;
}

export default async function Page() {
  const c = COMP as unknown as { maj: string; source: string; indices: Record<string, Indice> };
  const clean = new Set((CLEAN as { tickers: string[] }).tickers.map(norm));
  const retirees = new Set(Object.keys((RETIREES as { tickers: Record<string, string> }).tickers).map(norm));
  const lacPresent = await fs.access(LAKE).then(() => true).catch(() => false);
  const cache = new Map<string, Promise<Record<string, number> | null>>();
  const docs = (t: string) => {
    if (!lacPresent) return Promise.resolve(null);
    if (!cache.has(t)) cache.set(t, compteDocs(t));
    return cache.get(t)!;
  };

  const onglets: Onglet[] = [];
  for (const [cle, i] of Object.entries(c.indices)) {
    const enLigne = new Map(i.en_ligne.map((t) => [norm(t), t]));
    const lignes: Ligne[] = await Promise.all(
      i.membres.map(async (m) => {
        const t = enLigne.get(norm(m.ticker)) ?? (clean.has(norm(m.ticker)) ? m.ticker : null);
        const enL = !!t && !retirees.has(norm(t));
        return { ticker: m.ticker, mettrik: t, nom: m.nom, enLigne: enL, docs: (await docs(t ?? m.ticker)) ?? (t ? null : await docs(m.ticker)) };
      }),
    );
    onglets.push({ cle, nom: i.nom, pays: i.pays, source: `Composition ${c.source} (relue le ${c.maj})`, lignes });
  }

  // sp5001000 : Russell 1000 hors univers
  const liste = await lisJson<ListeSp>(path.join(LAKE, "_sp5001000/liste.json"));
  const etat = await lisJson<{ societes: Record<string, { fini?: boolean }> }>(path.join(LAKE, "_sp5001000/etat.json"));
  if (liste) {
    const lignes: Ligne[] = await Promise.all(
      liste.societes.map(async (s) => ({
        ticker: s.ticker,
        mettrik: null,
        nom: s.nom,
        enLigne: clean.has(norm(s.ticker)),
        secteur: s.secteur_gics,
        radiee: !!s.radiee,
        edgarFini: !!etat?.societes?.[s.ticker]?.fini,
        docs: await docs(s.ticker),
      })),
    );
    onglets.push({
      cle: "sp5001000",
      nom: "sp5001000 (Russell 1000 hors Mettrik)",
      pays: "US",
      source: `${liste._source ?? ""} Russell 1000 : ${liste.n_societes_iwb ?? "?"} sociétés, dont ${liste.n_deja_univers ?? "?"} déjà sur Mettrik.`,
      lignes,
    });
  }

  return <UniversIndicesClient onglets={onglets} lacPresent={lacPresent} />;
}
