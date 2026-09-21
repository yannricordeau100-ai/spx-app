import Link from "next/link";
import { LifeBuoy } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Raccourci « Mes demandes » de la page /account, bâti exactement comme la
 * carte des favoris juste à côté. Il compte les réponses du support que le
 * client n’a pas encore lues et pose une pastille quand il y en a.
 *
 * La lecture de la table est enveloppée : si elle n’existe pas encore ou si
 * elle est injoignable, la carte s’affiche sans pastille plutôt que de casser
 * la page du compte.
 */
export async function SupportShortcut() {
  let nonLus = 0;
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      // Même rattachement que l API du support : le compte ou l adresse.
      const adresse = (user.email ?? "").trim().toLowerCase();
      const filtre = adresse ? `user_id.eq.${user.id},email.eq.${adresse}` : `user_id.eq.${user.id}`;
      const { count } = await createSupabaseAdminClient()
        .from("support_tickets")
        .select("id", { count: "exact", head: true })
        .or(filtre)
        .eq("lu_par_client", false)
        .not("derniere_reponse_at", "is", null);
      nonLus = count ?? 0;
    }
  } catch {
    /* table absente ou base injoignable : la carte reste utile sans pastille */
  }

  return (
    <Link
      href="/account/support"
      className="group flex items-center gap-3 rounded-xl border border-[#1f1f1f] bg-[#0a0a0a] p-4 transition-colors hover:border-violet-400/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400"
    >
      <span className="relative inline-flex size-10 shrink-0 items-center justify-center rounded-lg border border-violet-400/30 bg-violet-500/10 text-violet-200">
        <LifeBuoy className="size-4" strokeWidth={1.5} />
        {nonLus > 0 && (
          <span className="absolute -right-1 -top-1 inline-flex min-w-[18px] items-center justify-center rounded-full bg-violet-400 px-1 text-[10.5px] font-bold leading-[18px] text-[#0a0a0a]">
            {nonLus}
          </span>
        )}
      </span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2 text-[14px] font-semibold text-zinc-50">
          Mes demandes
          {nonLus > 0 && (
            <span className="rounded-full border border-violet-400/40 bg-violet-500/10 px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-wider text-violet-200">
              {nonLus === 1 ? "1 réponse non lue" : `${nonLus} réponses non lues`}
            </span>
          )}
        </div>
        <div className="text-[11.5px] text-zinc-400">
          Suivre les messages envoyés au support et lire les réponses.
        </div>
      </div>
    </Link>
  );
}
