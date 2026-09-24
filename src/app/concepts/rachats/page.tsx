import INDEX from "@/data/rachats-index.json";
import TOP from "@/data/rachats-top.json";
import { RachatsClient, type SocieteRachats } from "./client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Rachats · Mettrik",
  robots: { index: false, follow: false },
};

/**
 * Concept du 24 sept 2026 : sociétés rachetées par chaque société du site
 * depuis 2016. Données : scripts/rachats-collecte.py (balises XBRL des
 * rapports annuels, Wikidata en complément), sans modèle de langage.
 */
export default function Page() {
  const idx = INDEX as { maj: string; societes: Record<string, { nom: string; nb: number }> };
  const traitees = Object.keys(idx.societes).length;
  const avec = Object.values(idx.societes).filter((s) => s.nb > 0).length;
  return (
    <RachatsClient
      societes={TOP as unknown as SocieteRachats[]}
      maj={idx.maj}
      traitees={traitees}
      avecRachats={avec}
    />
  );
}
