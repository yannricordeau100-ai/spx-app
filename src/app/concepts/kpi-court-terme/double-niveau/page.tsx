import { chargeSociete } from "../data";
import { DoubleNiveauClient } from "./client";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Concept KPI court terme : double-niveau · Mettrik",
  robots: { index: false, follow: false },
};

export default async function Page() {
  const liste = await Promise.all(["NFLX", "MC.PA"].map((t) => chargeSociete(t)));
  const societes = liste.filter((s): s is NonNullable<typeof s> => s !== null);
  return <DoubleNiveauClient societes={societes} />;
}
