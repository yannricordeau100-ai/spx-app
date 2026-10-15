/**
 * Cartes de KPI de l accueil (Yann 15 oct 2026) : le filtre « societes
 * gratuites » du 13 oct est retire. Chaque zone montre ses 10 societes avec
 * leurs 3 KPI (src/data/carte-pays-kpis.json, genere par scripts/build-home-wow.py).
 * Le clic est gere cote composant : anonyme = inscription, connecte = fiche.
 */
import ZONES from "@/data/carte-pays-kpis.json";

export type CarteVitrine = {
  ticker: string;
  nom: string;
  kpis: { nom: string; valeur: string; unite?: string | null; yoy?: string | null; periode?: string | null }[];
};

export async function zonesVitrineGratuite(): Promise<Record<string, CarteVitrine[]>> {
  const z = (ZONES as unknown as { zones: Record<string, CarteVitrine[]> }).zones;
  return Object.fromEntries(Object.entries(z).map(([k, l]) => [k, l.slice(0, 10)]));
}
