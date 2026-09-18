import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DESK_OWNER_EMAIL } from "@/lib/desk/auth";
import { ReglagesKpiClient } from "../reglages-kpi/client";
import { ONGLETS } from "../reglages-kpi/onglets";

export const dynamic = "force-dynamic";
export const metadata = { title: "Voir les KPI · Mettrik AI", robots: { index: false, follow: false } };

/** Yann 17 sept 2026 (soir) : toggle de consultation des KPI (par société, par industrie,
 *  par secteur, référentiel). La création est dans /sandbox/reglages-kpi. */
export default async function Page({ searchParams }: { searchParams: Promise<{ audit_token?: string; onglet?: string }> }) {
  const sp = await searchParams;
  const parJeton = !!sp.audit_token && !!process.env.VISUAL_AUDIT_TOKEN && sp.audit_token === process.env.VISUAL_AUDIT_TOKEN;
  if (!parJeton) {
    const sb = await createSupabaseServerClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user || user.email !== DESK_OWNER_EMAIL) redirect("/404");
  }
  if (sp.onglet && ONGLETS.some((o) => o.id === sp.onglet && o.toggle === "creer")) {
    redirect(`/sandbox/reglages-kpi?onglet=${sp.onglet}${parJeton ? `&audit_token=${encodeURIComponent(sp.audit_token ?? "")}` : ""}`);
  }
  return <ReglagesKpiClient toggle="voir" jeton={parJeton ? sp.audit_token ?? null : null} ongletInitial={sp.onglet ?? "heros"} />;
}
