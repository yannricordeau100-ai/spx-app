import { etatSynchro } from "@/lib/synchro/etat";
import { lireInterrupteurs } from "@/lib/synchro/interrupteurs";
import { SynchroView } from "./synchro-view";

export const dynamic = "force-dynamic";

/**
 * Synchronisation quotidienne (9 sept 2026) : trois interrupteurs (transcripts,
 * KPI indicateurs cles, KPI stories) et, pour chacun, l etat REEL des pages
 * compare aux publications des societes (dernier depot SEC). Aucun journal
 * de cron n est lu : seule la donnee servie compte.
 */
export default async function SynchroPage() {
  const [etat, interrupteurs] = await Promise.all([etatSynchro(), lireInterrupteurs()]);
  return <SynchroView etat={etat} interrupteurs={interrupteurs} />;
}
