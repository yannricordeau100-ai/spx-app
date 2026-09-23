import { capacitesPourTickers } from "@/components/capacite/charger";
import { REGLAGE_INITIAL, type ReglageReference, type TypeReference } from "@/components/capacite/modele";
import { CapacitePerformanceClient } from "./client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Capacité à performer · Mettrik",
  robots: { index: false, follow: false },
};

/**
 * Six sociétés au moins, choisies pour couvrir tous les cas de lecture :
 *  - NVDA et AAPL : ratios au dessus de 100 pour cent, donc sous réserve
 *  - MCK : le retour sur capitaux propres n'existe pas dans la source
 *  - NEE : le retour sur capital investi n'existe pas dans la source
 *  - MC.PA : société européenne, quatre mesures confortables
 *  - TTE.PA : mesures qui encadrent le taux, le cas qui fait l'orange
 *  - ORA.PA : mesures sous le taux sans risque
 *  - F : exercice en perte, donc mesures négatives
 */
const ECHANTILLON = ["NVDA", "AAPL", "MC.PA", "TTE.PA", "ORA.PA", "MCK", "NEE", "F"];

/**
 * Paramètres d'audit, rendus côté serveur pour qu'un contrôle par curl voie
 * réellement le résultat : ticker, ref (sans_risque ou inflation) et taux.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ ticker?: string; ref?: string; taux?: string }>;
}) {
  const sp = await searchParams;
  const societes = capacitesPourTickers(ECHANTILLON);
  const taux = sp.taux !== undefined ? Number(sp.taux) : null;
  const type: TypeReference = sp.ref === "inflation" ? "inflation" : "sans_risque";
  const impose: ReglageReference | null =
    taux !== null && Number.isFinite(taux)
      ? {
          type,
          sansRisque: type === "sans_risque" ? taux : REGLAGE_INITIAL.sansRisque,
          inflation: type === "inflation" ? taux : REGLAGE_INITIAL.inflation,
        }
      : sp.ref
        ? { ...REGLAGE_INITIAL, type }
        : null;
  return (
    <CapacitePerformanceClient
      societes={societes}
      tickerInitial={sp.ticker ? sp.ticker.toUpperCase() : null}
      reglageImpose={impose}
    />
  );
}
