/**
 * /account/support : l’espace où le client retrouve ses demandes au support,
 * leur statut en clair et le fil de discussion, avec la possibilité de
 * répondre. Même garde que /account/favorites : il faut être connecté.
 *
 * Les données passent par /api/support/tickets et /api/support/tickets/[id].
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, LifeBuoy } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SupportEspace } from "@/components/account/support-espace";

export const dynamic = "force-dynamic";

export default async function SupportPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/?auth=signin&next=/account/support");

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#050505]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[700px] bg-radial-glow" />
      <div className="pointer-events-none absolute inset-0 bg-grid" />

      <div className="relative mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <Link
          href="/account"
          className="group inline-flex items-center gap-2 rounded text-[13px] text-zinc-400 transition-colors hover:text-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400"
        >
          <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-0.5" />
          Retour au compte
        </Link>

        <h1 className="mt-6 flex items-center gap-2.5 text-[28px] font-semibold text-zinc-50">
          <LifeBuoy className="size-6 text-violet-300" strokeWidth={1.5} />
          Mes demandes
        </h1>
        <p className="mt-1 text-[14px] text-zinc-400">
          Chaque message envoyé au support apparaît ici avec son statut. Ouvre une
          demande pour lire les réponses et poursuivre la conversation.
        </p>

        <div className="mt-8">
          <SupportEspace />
        </div>
      </div>
    </div>
  );
}
