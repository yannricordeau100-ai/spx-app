/**
 * Cartes de KPI de l accueil (Yann 13 oct 2026).
 *
 * Decision : l accueil ne montre AUCUNE valeur de KPI d une societe hors de la
 * liste « visibles en gratuit » (desk_page_content floutage/visibles-gratuit,
 * modifiable sans redeploiement). Les cartes de toutes les societes sont
 * generees par scripts/build-home-wow.py (src/data/vitrine-kpis-par-ticker.json,
 * lu ici cote serveur seulement) ; seules celles de la liste partent au
 * navigateur, rangees par zone et par capitalisation decroissante.
 */
import CARTES from "@/data/vitrine-kpis-par-ticker.json";
import ORDRE from "@/data/market-cap-order.json";
import { chargeVisiblesGratuit } from "@/lib/desk/visibles-gratuit";

export type CarteVitrine = {
  ticker: string;
  nom: string;
  kpis: { nom: string; valeur: string; unite?: string | null; yoy?: string | null; periode?: string | null }[];
};

// Memes zones que scripts/build-home-wow.py (carte des pays).
const SUFFIXES: Record<string, string> = { fr: ".PA", "en-GB": ".L", de: ".DE", nl: ".AS", "de-CH": ".SW" };

function zoneDe(t: string): string | null {
  for (const [z, suf] of Object.entries(SUFFIXES)) if (t.endsWith(suf)) return z;
  return t.includes(".") ? null : "en";
}

export async function zonesVitrineGratuite(): Promise<Record<string, CarteVitrine[]>> {
  const cartes = (CARTES as unknown as { societes: Record<string, CarteVitrine> }).societes;
  const rang = new Map((ORDRE as { tickers: string[] }).tickers.map((t, i) => [t.toUpperCase(), i]));
  const liste = (await chargeVisiblesGratuit()).filter((t) => cartes[t]);
  liste.sort((a, b) => (rang.get(a) ?? 1e6) - (rang.get(b) ?? 1e6));
  const zones: Record<string, CarteVitrine[]> = { world: [] };
  const vus = new Set<string>();
  for (const t of liste) {
    const c = cartes[t];
    // GOOG / GOOGL : une seule carte par societe.
    if (vus.has(c.nom)) continue;
    vus.add(c.nom);
    zones.world.push(c);
    const z = zoneDe(t);
    if (z) (zones[z] ??= []).push(c);
  }
  return zones;
}
