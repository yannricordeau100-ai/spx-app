/**
 * 8 oct 2026 (audit des fuites publiques, ligne 20) : donnees par societe qui
 * etaient importees EN ENTIER dans le JS des fiches (sources-externes.json :
 * 676 tickers ; fx-effet-change.json : 213 tickers). Elles sont desormais
 * jointes a la seule societe affichee, cote serveur.
 * Le detail des sources est reserve aux plans payants : un visiteur gratuit ou
 * anonyme ne recoit que des libelles neutres (meme nombre, liste floutee).
 * Module serveur : ne jamais l importer depuis un composant "use client".
 */
import SOURCES from "@/data/sources-externes.json";
import FX from "@/data/fx-effet-change.json";
import type { Company } from "@/lib/data";

// Yann 16 sept 2026 : Motley Fool et Wikipédia ne sont pas comptés comme sources.
// Yann 21 sept 2026 : MarketBeat puis StockAnalysis retirés de la liste affichée.
const ECARTEES = /motley fool|wikip|marketbeat|stockanalysis/i;

export function avecDonneesFiche<T extends Company>(company: T, payant: boolean): T {
  if (!company) return company;
  const t = String(company.ticker ?? "").toUpperCase();
  const sources = (((SOURCES as { par_ticker: Record<string, string[]> }).par_ticker ?? {})[t] ?? []).filter((x) => !ECARTEES.test(x));
  const fx = ((FX as unknown as { par_ticker: Record<string, Company["fx_effet_change"]> }).par_ticker ?? {})[t] ?? null;
  return {
    ...company,
    sources_externes: payant ? sources : sources.map((_, i) => `Source réservée aux abonnés ${i + 1}`),
    fx_effet_change: fx,
  };
}
