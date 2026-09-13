import DONNEES from "@/data/valeurs-approximatives.json";
import { lireDecisionsApprox } from "@/lib/valeurs-approx";
import { ValeursApproxView, type CasApprox } from "./view";

export const dynamic = "force-dynamic";

/** Yann 13 sept 2026 : valeurs non exactes a la source, decision par cas. */
export default async function Page({ searchParams }: { searchParams: Promise<{ audit_token?: string }> }) {
  const sp = await searchParams;
  const ok = !!sp.audit_token && sp.audit_token === process.env.VISUAL_AUDIT_TOKEN;
  const d = DONNEES as { maj: string; regle: string; cas: CasApprox[] };
  return <ValeursApproxView cas={d.cas} maj={d.maj} regle={d.regle} decisionsInitiales={await lireDecisionsApprox()} jeton={ok ? sp.audit_token ?? null : null} />;
}
