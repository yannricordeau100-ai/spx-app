import DONNEES from "@/data/valeurs-approximatives.json";
import { lireDecisionsApprox } from "@/lib/valeurs-approx";
import { ValeursApproxView, type CasApprox } from "./view";
import { estAdminSandbox } from "@/lib/desk/auth";

export const dynamic = "force-dynamic";

/** Yann 13 sept 2026 : valeurs non exactes a la source, decision par cas. */
export default async function Page({ searchParams }: { searchParams: Promise<{ audit_token?: string }> }) {
  const sp = await searchParams;
  const ok = !!sp.audit_token && sp.audit_token === process.env.VISUAL_AUDIT_TOKEN;
  const d = DONNEES as { maj: string; regle: string; cas: CasApprox[] };
  // 13 sept 2026 : sans jeton ni compte proprietaire connecte, les decisions
  // repondaient « echec (403) » sans explication. On previent avant.
  const admin = ok || (await estAdminSandbox(new Request("https://mettrik.ai/sandbox/valeurs-approximatives")));
  return <ValeursApproxView admin={admin} cas={d.cas} maj={d.maj} regle={d.regle} decisionsInitiales={await lireDecisionsApprox()} jeton={ok ? sp.audit_token ?? null : null} />;
}
