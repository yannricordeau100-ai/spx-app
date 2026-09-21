/**
 * /sandbox/support : la boîte de réception du support, réservée au propriétaire.
 *
 * Garde recopiée de /sandbox/gics : propriétaire connecté, ou jeton d’audit en
 * paramètre (le jeton sert aussi quand le site est fermé par la maintenance).
 *
 * Toutes les données passent par /api/desk-mtk9x4kp/support (écrit à part) :
 * la page ne lit jamais la base directement.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DESK_OWNER_EMAIL } from "@/lib/desk/auth";
import { SupportDesk } from "./desk-client";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Support · Sandbox Mettrik",
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

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#050505] text-zinc-100">
      <nav className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-5 sm:px-6">
        <Link
          href="/sandbox"
          className="inline-flex items-center gap-2 rounded text-sm text-zinc-400 transition-colors hover:text-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400"
        >
          <ArrowLeft className="size-4" />
          Sandbox
        </Link>
        <span className="font-mono text-[11px] uppercase tracking-wider text-zinc-500">
          Messages reçus par le formulaire de contact
        </span>
      </nav>
      <main className="mx-auto max-w-7xl px-4 pb-20 sm:px-6">
        <h1 className="font-display text-[28px] font-bold tracking-tight">Support</h1>
        <p className="mt-1 text-[14px] text-zinc-400">
          Les demandes des clients, les non vues en tête. Ouvrir un ticket affiche
          le fil complet, le champ de réponse et le changement de statut.
        </p>
        <div className="mt-6">
          <SupportDesk jeton={parJeton ? sp.audit_token ?? null : null} />
        </div>
      </main>
    </div>
  );
}
