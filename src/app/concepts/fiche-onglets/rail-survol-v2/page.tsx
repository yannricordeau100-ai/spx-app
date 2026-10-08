import { chargeFiches } from "../data";
import { chargeAdminBlocs } from "../admin";
import { FicheV2Client } from "../v2-client";
import { styleParSlug } from "../liste";

export const dynamic = "force-dynamic";
export const metadata = {
  title: `Fiche en onglets : ${styleParSlug("rail-survol-v2").nom} · Mettrik`,
  robots: { index: false, follow: false },
};

export default async function Page() {
  const fiches = await chargeFiches();
  const adminBlocs = await chargeAdminBlocs(fiches);
  return <FicheV2Client fiches={fiches} adminBlocs={adminBlocs} />;
}
