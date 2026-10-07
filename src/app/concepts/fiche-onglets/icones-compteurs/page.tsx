import { chargeFiches } from "../data";
import { FicheOngletsClient } from "../page-client";
import { styleParSlug } from "../liste";

export const dynamic = "force-dynamic";
export const metadata = {
  title: `Fiche en onglets : ${styleParSlug("icones-compteurs").nom} · Mettrik`,
  robots: { index: false, follow: false },
};

export default async function Page() {
  const fiches = await chargeFiches();
  return <FicheOngletsClient style="icones-compteurs" fiches={fiches} />;
}
