import { chargeFiches } from "../data";
import { chargeAdminBlocs } from "../admin";
import { FicheOngletsClient } from "../page-client";
import { styleParSlug } from "../liste";

export const dynamic = "force-dynamic";
export const metadata = {
  title: `Fiche en onglets : ${styleParSlug("cartes-compactes").nom} · Mettrik`,
  robots: { index: false, follow: false },
};

export default async function Page() {
  const fiches = await chargeFiches();
  const adminBlocs = await chargeAdminBlocs(fiches);
  return <FicheOngletsClient style="cartes-compactes" fiches={fiches} adminBlocs={adminBlocs} />;
}
