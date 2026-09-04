/**
 * /sandbox/gics : atelier de la classification GICS (Yann 5 sept 2026).
 * Classification a 4 niveaux, KPI souhaites par sous-industrie et registre
 * des prompts, tous lus dans le Cahier (docs/cahier). Reserve au
 * proprietaire ; le jeton d audit ouvre la page pour les verifications.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DESK_OWNER_EMAIL } from "@/lib/desk/auth";
import { lireKpiParSousIndustrie, lirePrompts } from "@/lib/cahier";
import { GicsAtelier } from "@/components/sandbox/gics-atelier";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Atelier GICS · Sandbox Mettrik",
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
  const [kpiParSousIndustrie, prompts] = await Promise.all([lireKpiParSousIndustrie(), lirePrompts()]);

  return (
    <div className="min-h-screen bg-[#050505] text-zinc-100">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5 sm:px-6">
        <Link href="/sandbox" className="inline-flex items-center gap-2 text-sm text-zinc-400 transition-colors hover:text-zinc-100">
          <ArrowLeft className="size-4" />
          Sandbox
        </Link>
        <span className="font-mono text-[11px] uppercase tracking-wider text-zinc-500">Cahier : docs/cahier</span>
      </nav>
      <main className="mx-auto max-w-7xl px-4 pb-20 sm:px-6">
        <h1 className="font-display text-[28px] font-bold tracking-tight">Classification GICS</h1>
        <p className="mt-1 text-[14px] text-zinc-400">
          11 secteurs, 25 groupes d’industries, 74 industries, 163 sous-industries. Puis, par sous-industrie, les KPI qu’un investisseur attend, et les prompts qui servent à les trouver.
        </p>
        <div className="mt-6">
          <GicsAtelier kpiParSousIndustrie={kpiParSousIndustrie} prompts={prompts} />
        </div>
      </main>
    </div>
  );
}
