import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DESK_ADMIN_EMAILS } from "@/lib/desk/auth";
import { lireJournal, lireReglages } from "@/lib/journal-emails";
import { EmailsAlertesClient } from "./client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Emails et alertes · Mettrik AI", robots: { index: false, follow: false } };

export default async function Page({ searchParams }: { searchParams: Promise<{ audit_token?: string; onglet?: string }> }) {
  const sp = await searchParams;
  const parJeton = !!sp.audit_token && !!process.env.VISUAL_AUDIT_TOKEN && sp.audit_token === process.env.VISUAL_AUDIT_TOKEN;
  if (!parJeton) {
    const sb = await createSupabaseServerClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user?.email || !DESK_ADMIN_EMAILS.includes(user.email.toLowerCase())) redirect("/404");
  }
  const [journal, reglages] = await Promise.all([lireJournal(), lireReglages()]);
  return <EmailsAlertesClient journal={journal} reglages={reglages} ongletInitial={sp.onglet ?? "alertes"} />;
}
