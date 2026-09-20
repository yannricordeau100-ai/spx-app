import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DESK_OWNER_EMAIL } from "@/lib/desk/auth";
import { ReglagesKpiClient } from "./client";
import { ONGLETS } from "./onglets";

export const dynamic = "force-dynamic";
export const metadata = { title: "Création KPI et données · Mettrik AI", robots: { index: false, follow: false } };

/** Yann 16 sept 2026 : tous les réglages liés aux KPI sur une seule page, un onglet par outil.
 *  17 sept (soir) : scindé en deux toggles, celui-ci = création ; « Voir les KPI » = /sandbox/voir-kpi.
 *  Chaque onglet charge la page existante telle quelle (aucune logique dupliquée). */
export default async function Page({ searchParams }: { searchParams: Promise<{ audit_token?: string; onglet?: string }> }) {
  const sp = await searchParams;
  const parJeton = !!sp.audit_token && !!process.env.VISUAL_AUDIT_TOKEN && sp.audit_token === process.env.VISUAL_AUDIT_TOKEN;
  if (!parJeton) {
    const sb = await createSupabaseServerClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user || user.email !== DESK_OWNER_EMAIL) redirect("/404");
  }
  // Anciens liens : un onglet du toggle « voir » ouvert ici est renvoyé vers le bon toggle.
  if (sp.onglet && ONGLETS.some((o) => o.id === sp.onglet && o.toggle === "voir")) {
    redirect(`/sandbox/voir-kpi?onglet=${sp.onglet}${parJeton ? `&audit_token=${encodeURIComponent(sp.audit_token ?? "")}` : ""}`);
  }
  return <ReglagesKpiClient toggle="creer" jeton={parJeton ? sp.audit_token ?? null : null} ongletInitial={sp.onglet ?? "speciaux"} />;
}
