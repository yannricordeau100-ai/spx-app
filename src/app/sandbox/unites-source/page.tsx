import DONNEES from "@/data/unites-a-corriger.json";
import { lireDecisions } from "@/lib/unites-source";
import { UnitesSourceView, type Cas } from "./view";

export const dynamic = "force-dynamic";

/** Page temporaire (Yann 11 sept 2026) : KPI dont l unité est mal annotée à la source. */
export default async function Page({ searchParams }: { searchParams: Promise<{ audit_token?: string }> }) {
  const sp = await searchParams;
  const ok = !!sp.audit_token && sp.audit_token === process.env.VISUAL_AUDIT_TOKEN;
  const d = DONNEES as { maj: string; etat: string; cas: Cas[] };
  return <UnitesSourceView cas={d.cas} maj={d.maj} etat={d.etat} decisionsInitiales={await lireDecisions()} jeton={ok ? sp.audit_token ?? null : null} />;
}
