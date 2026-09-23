import RATIOS from "@/data/ratios-rentabilite-stockanalysis.json";
import type { CapaciteSociete, CleRatio, RatioBrut } from "./modele";
import { ORDRE_RATIOS } from "./modele";

/**
 * Chargement des ratios, à n'appeler QUE depuis un composant serveur.
 * Le fichier source pèse près de 2 Mo : il ne doit jamais partir dans le
 * paquet envoyé au navigateur. On n'en extrait que les sociétés demandées,
 * et seulement la dernière valeur de chaque ratio.
 */

type EntreeBrute = {
  ticker: string;
  nom_page?: string;
  exercice?: string | null;
  cloture?: string | null;
  ratios?: Partial<Record<CleRatio, RatioBrut>>;
};

const SOURCE = RATIOS as unknown as { societes: EntreeBrute[] };

/** « Agilent Technologies (A) Financial Ratios » devient « Agilent Technologies ». */
function nomPropre(e: EntreeBrute): string {
  const brut = e.nom_page ?? e.ticker;
  const sansSuffixe = brut.replace(/\s*Financial Ratios\s*$/i, "");
  const sansTicker = sansSuffixe.replace(/\s*\([^()]*\)\s*$/, "");
  return (sansTicker || e.ticker).trim();
}

function convertir(e: EntreeBrute): CapaciteSociete {
  const ratios = {} as Record<CleRatio, number | null>;
  for (const cle of ORDRE_RATIOS) {
    const r = e.ratios?.[cle] ?? null;
    const v = r && typeof r.valeur === "number" && Number.isFinite(r.valeur) ? r.valeur : null;
    // Le fichier source stocke des fractions : 1.4539 vaut 145,39 pour cent.
    ratios[cle] = v === null ? null : v * 100;
  }
  return {
    ticker: e.ticker,
    nom: nomPropre(e),
    exercice: e.exercice ?? null,
    cloture: e.cloture ?? null,
    ratios,
  };
}

export function capacitePourTicker(ticker: string): CapaciteSociete | null {
  const cible = ticker.toUpperCase();
  const e = SOURCE.societes.find((s) => s.ticker?.toUpperCase() === cible);
  return e ? convertir(e) : null;
}

export function capacitesPourTickers(tickers: string[]): CapaciteSociete[] {
  return tickers
    .map((t) => capacitePourTicker(t))
    .filter((s): s is CapaciteSociete => s !== null);
}
