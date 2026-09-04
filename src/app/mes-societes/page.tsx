/**
 * Mes sociétés enregistrées (Yann 4 sept 2026).
 *
 * Le bouton Enregistrer existait sans destination : rien ne permettait de
 * revoir ce qu on avait mis de côté. Cette page liste les sociétés du compte,
 * avec un lien direct vers chaque fiche.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Bookmark } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { tierDepuisAbonnement } from "@/lib/freemium/tier-serveur";
import { AuthNav } from "@/components/auth-nav";
import { DisclaimerFooter } from "@/components/legal/disclaimer-footer";
import { COMPANIES } from "@/lib/data";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Mes sociétés · Mettrik AI",
  robots: { index: false, follow: false },
};

export default async function MesSocietesPage() {
  const sb = await createSupabaseServerClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/?auth=signin&next=%2Fmes-societes");

  const tier = await tierDepuisAbonnement(user);
  const paye = tier === "premium" || tier === "max";

  const { data } = await sb
    .from("user_saved_companies")
    .select("ticker,created_at")
    .order("created_at", { ascending: false });
  const lignes = (data ?? []) as Array<{ ticker: string; created_at: string }>;

  return (
    <div className="min-h-screen bg-[#050505]">
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-4 py-6 sm:px-6">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-zinc-400 transition-colors hover:text-zinc-100">
          <ArrowLeft className="size-4" />
          Retour
        </Link>
        <AuthNav scope="home" />
      </nav>

      <main className="mx-auto max-w-5xl px-4 pb-20 sm:px-6">
        <h1 className="flex items-center gap-2.5 text-2xl font-semibold text-zinc-100">
          <Bookmark className="size-5 text-violet-300" />
          Mes sociétés
        </h1>

        {!paye ? (
          <div className="mt-6 rounded-2xl border border-violet-400/25 bg-violet-500/[0.07] p-5">
            <p className="text-[15px] font-semibold text-zinc-100">
              Enregistrer vos sociétés est réservé aux abonnés
            </p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-zinc-400">
              Retrouvez en un clic celles que vous suivez, sur tous vos appareils.
            </p>
            <Link
              href="/pricing"
              className="mt-3.5 inline-flex rounded-lg bg-violet-500 px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-violet-400"
            >
              Voir les offres
            </Link>
          </div>
        ) : lignes.length === 0 ? (
          <p className="mt-6 text-[14px] text-zinc-400">
            Aucune société enregistrée pour l&apos;instant. Sur une fiche, le bouton
            <span className="mx-1 rounded bg-white/[0.06] px-1.5 py-0.5 text-[12.5px] text-zinc-200">Enregistrer</span>
            l&apos;ajoute ici.
          </p>
        ) : (
          <>
            <p className="mt-2 text-[13px] text-zinc-500">
              {lignes.length} société{lignes.length > 1 ? "s" : ""} suivie{lignes.length > 1 ? "s" : ""}.
            </p>
            <ul className="mt-5 grid gap-2 sm:grid-cols-2">
              {lignes.map((l) => {
                const c = COMPANIES[l.ticker.toUpperCase()];
                return (
                  <li key={l.ticker}>
                    <Link
                      href={`/${l.ticker.toLowerCase()}`}
                      className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 transition-colors hover:border-violet-400/40 hover:bg-white/[0.04]"
                    >
                      <span className="font-mono text-[13px] font-semibold text-violet-200">
                        {l.ticker.toUpperCase()}
                      </span>
                      <span className="truncate text-[13.5px] text-zinc-200">
                        {c?.name ?? l.ticker.toUpperCase()}
                      </span>
                      <span className="ml-auto shrink-0 text-[11px] text-zinc-600">
                        {new Date(l.created_at).toLocaleDateString("fr-FR")}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </main>
      <DisclaimerFooter />
    </div>
  );
}
