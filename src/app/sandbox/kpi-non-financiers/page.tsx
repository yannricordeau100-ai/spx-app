/**
 * /sandbox/kpi-non-financiers : indicateurs non financiers a envisager
 * (Yann, 21 sept 2026).
 *
 * Yann saisit un ou plusieurs tickers, coche ses criteres, et obtient des
 * propositions d indicateurs non financiers presentees comme sur
 * /concepts/kpi-netflix. Aucune recherche n est lancable pour l instant : le
 * bouton cree seulement la ligne en base au statut a traiter.
 *
 * Reserve au proprietaire ; le jeton d audit ouvre la page pour les
 * verifications, exactement comme /sandbox/gics.
 */
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DESK_OWNER_EMAIL } from "@/lib/desk/auth";
import { listerDemandes, type LigneKpiNonFinancier } from "@/lib/desk/kpi-non-financiers";
import { KpiNonFinanciersClient } from "./client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Indicateurs non financiers a envisager · Sandbox Mettrik",
  robots: { index: false, follow: false },
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ audit_token?: string }>;
}) {
  const sp = await searchParams;
  const parJeton =
    !!sp.audit_token &&
    !!process.env.VISUAL_AUDIT_TOKEN &&
    sp.audit_token === process.env.VISUAL_AUDIT_TOKEN;
  if (!parJeton) {
    const sb = await createSupabaseServerClient();
    const {
      data: { user },
    } = await sb.auth.getUser();
    if (!user || user.email !== DESK_OWNER_EMAIL) redirect("/404");
  }

  let demandes: LigneKpiNonFinancier[] = [];
  let erreurBase: string | null = null;
  try {
    demandes = await listerDemandes();
  } catch (e) {
    erreurBase = (e as Error).message;
  }

  return <KpiNonFinanciersClient demandes={demandes} erreurBase={erreurBase} />;
}
