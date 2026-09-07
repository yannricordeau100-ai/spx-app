/**
 * /sandbox/logos-arbitrage : choix des logos douteux (07 sept 2026).
 * 6 societes au logo bandeau illisible en carre (+ VMRK sans fichier) :
 * l actuel et le candidat officiel cote a cote sur fond noir, une case sur
 * chacun. Le choix est enregistre en base ; l application du logo choisi
 * est faite ensuite par la session.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DESK_OWNER_EMAIL } from "@/lib/desk/auth";
import { LogosArbitrage } from "@/components/sandbox/logos-arbitrage";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Arbitrage logos · Sandbox Mettrik",
  robots: { index: false, follow: false },
};

const PAIRES = [
  { ticker: "DSFIR.AS", nom: "DSM-Firmenich", raison: "bandeau 960x87 illisible en carré", sourceCandidat: "logo blanc officiel dsm-firmenich.com" },
  { ticker: "DTG.DE", nom: "Daimler Truck", raison: "bandeau 960x81", sourceCandidat: "icône carrée officielle daimlertruck.com" },
  { ticker: "MBG.DE", nom: "Mercedes-Benz Group", raison: "bandeau 960x93", sourceCandidat: "étoile officielle (Wikimedia Commons)" },
  { ticker: "ML.PA", nom: "Michelin", raison: "bandeau 960x98", sourceCandidat: "Bibendum officiel michelin.com" },
  { ticker: "SW", nom: "Smurfit Westrock", raison: "bandeau 960x95", sourceCandidat: "emblème officiel (Wikimedia Commons)" },
  { ticker: "VMRK", nom: "Vivmark Residential", raison: "aucun fichier (monogramme affiché)", sourceCandidat: "logo officiel Vivmark (Wikipedia)" },
];

export default async function Page({ searchParams }: { searchParams: Promise<{ audit_token?: string }> }) {
  const sp = await searchParams;
  const parJeton = !!sp.audit_token && !!process.env.VISUAL_AUDIT_TOKEN && sp.audit_token === process.env.VISUAL_AUDIT_TOKEN;
  if (!parJeton) {
    const sb = await createSupabaseServerClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user || user.email !== DESK_OWNER_EMAIL) redirect("/404");
  }

  return (
    <div className="min-h-screen bg-[#050505] text-zinc-100">
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-4 py-5 sm:px-6">
        <Link href="/sandbox" className="inline-flex items-center gap-2 text-sm text-zinc-400 transition-colors hover:text-zinc-100">
          <ArrowLeft className="size-4" />
          Sandbox
        </Link>
        <span className="font-mono text-[11px] uppercase tracking-wider text-zinc-500">public/logos-candidats</span>
      </nav>
      <main className="mx-auto max-w-5xl px-4 pb-20 sm:px-6">
        <h1 className="font-display text-[28px] font-bold tracking-tight">Arbitrage des logos douteux</h1>
        <p className="mt-1 text-[14px] text-zinc-400">
          Revue des 666 logos faite : seuls ces 6 cas hésitent. Coche le logo à garder ; j&apos;applique ensuite ton choix.
          EssilorLuxottica n&apos;a aucun emblème officiel compact : son bandeau actuel reste tel quel.
        </p>
        <div className="mt-6">
          <LogosArbitrage paires={PAIRES} jeton={parJeton ? sp.audit_token ?? null : null} />
        </div>
      </main>
    </div>
  );
}
