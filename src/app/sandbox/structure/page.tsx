/**
 * /sandbox/structure : carte visuelle de toute l application, avec feux de
 * sante (Yann 3 sept 2026). Reservee au proprietaire ; le jeton d audit visuel
 * ouvre aussi la page pour les verifications automatiques.
 */
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DESK_OWNER_EMAIL } from "@/lib/desk/auth";
import carte from "@/data/_structure-map.json";
import { StructureClient, type Carte } from "./client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Panneau de contrôle Front / Back End · Sandbox Mettrik", robots: { index: false, follow: false } };

export default async function Page({ searchParams }: { searchParams: Promise<{ audit_token?: string }> }) {
  const sp = await searchParams;
  const parJeton = !!sp.audit_token && !!process.env.VISUAL_AUDIT_TOKEN && sp.audit_token === process.env.VISUAL_AUDIT_TOKEN;
  if (!parJeton) {
    const sb = await createSupabaseServerClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user || user.email !== DESK_OWNER_EMAIL) redirect("/404");
  }
  return <StructureClient carte={carte as unknown as Carte} jeton={parJeton ? sp.audit_token ?? null : null} />;
}
