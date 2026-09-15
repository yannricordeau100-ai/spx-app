import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DESK_OWNER_EMAIL } from "@/lib/desk/auth";
import { ReglagesKpiClient } from "./client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Réglages KPI · Mettrik AI", robots: { index: false, follow: false } };

/** Yann 16 sept 2026 : tous les réglages liés aux KPI sur une seule page, un onglet par outil.
 *  Chaque onglet charge la page existante telle quelle (aucune logique dupliquée). */
export default async function Page({ searchParams }: { searchParams: Promise<{ audit_token?: string; onglet?: string }> }) {
  const sp = await searchParams;
  const parJeton = !!sp.audit_token && !!process.env.VISUAL_AUDIT_TOKEN && sp.audit_token === process.env.VISUAL_AUDIT_TOKEN;
  if (!parJeton) {
    const sb = await createSupabaseServerClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user || user.email !== DESK_OWNER_EMAIL) redirect("/404");
  }
  return <ReglagesKpiClient jeton={parJeton ? sp.audit_token ?? null : null} ongletInitial={sp.onglet ?? "heros"} />;
}
