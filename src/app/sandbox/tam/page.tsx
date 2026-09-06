/**
 * /sandbox/tam : atelier des marches adressables (TAM), 7 sept 2026.
 * Candidats du Cahier (docs/cahier/tam) par societe, arbitrage du
 * proprietaire (2 candidats au plus), enregistre en base. Reserve au
 * proprietaire ; le jeton d audit ouvre la page pour les verifications.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DESK_OWNER_EMAIL } from "@/lib/desk/auth";
import { lireAnnuaireGics, lireTam } from "@/lib/cahier";
import V17_PUBLIC from "@/data/v1-7-public.json";
import { COMPANIES } from "@/lib/data";
import { TamAtelier } from "@/components/sandbox/tam-atelier";
import { lireArbitragesGics } from "@/lib/desk/gics-arbitrage";
import { lireArbitragesTam } from "@/lib/desk/tam-arbitrage";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Atelier TAM · Sandbox Mettrik",
  robots: { index: false, follow: false },
};

export default async function Page({ searchParams }: { searchParams: Promise<{ audit_token?: string }> }) {
  const sp = await searchParams;
  const parJeton = !!sp.audit_token && !!process.env.VISUAL_AUDIT_TOKEN && sp.audit_token === process.env.VISUAL_AUDIT_TOKEN;
  if (!parJeton) {
    const sb = await createSupabaseServerClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user || user.email !== DESK_OWNER_EMAIL) redirect("/404");
  }
  const noms: Record<string, string> = {};
  for (const [t, v] of Object.entries(V17_PUBLIC as Record<string, { name?: string }>)) if (v?.name) noms[t.toUpperCase()] = v.name;
  for (const [t, v] of Object.entries(COMPANIES)) noms[t.toUpperCase()] = v.name;
  const [tam, annuaire, choix] = await Promise.all([lireTam(), lireArbitragesGics().then((a) => lireAnnuaireGics(noms, a)), lireArbitragesTam()]);
  const nb = Object.keys(tam).length;
  const nbArb = Object.keys(choix).filter((t) => tam[t]).length;

  return (
    <div className="min-h-screen bg-[#050505] text-zinc-100">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5 sm:px-6">
        <Link href="/sandbox" className="inline-flex items-center gap-2 text-sm text-zinc-400 transition-colors hover:text-zinc-100">
          <ArrowLeft className="size-4" />
          Sandbox
        </Link>
        <span className="font-mono text-[11px] uppercase tracking-wider text-zinc-500">Cahier : docs/cahier/tam</span>
      </nav>
      <main className="mx-auto max-w-7xl px-4 pb-20 sm:px-6">
        <h1 className="font-display text-[28px] font-bold tracking-tight">Marchés adressables (TAM)</h1>
        <p className="mt-1 text-[14px] text-zinc-400">
          {nb} société{nb > 1 ? "s" : ""} avec candidats, {nbArb} arbitrée{nbArb > 1 ? "s" : ""}. Coche jusqu’à deux candidats par société : le bloc « Position marché » de la fiche affichera ces choix. Aucune case cochée après arbitrage = bloc masqué.
        </p>
        <div className="mt-6">
          <TamAtelier tam={tam} annuaire={annuaire} noms={noms} choixInitial={choix} jeton={parJeton ? sp.audit_token ?? null : null} />
        </div>
      </main>
    </div>
  );
}
