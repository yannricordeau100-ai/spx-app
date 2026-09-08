/**
 * /sandbox/moat : notes Morningstar de l univers (07 sept 2026).
 * Source : docs/cahier/moat.json (664 notees, EA et JDEP.AS radiees).
 * Reserve au proprietaire ; le jeton d audit ouvre la page.
 */
import fs from "node:fs";
import path from "node:path";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DESK_OWNER_EMAIL } from "@/lib/desk/auth";
import V17_PUBLIC from "@/data/v1-7-public.json";
import type { MettrikTendance } from "@/components/sandbox/moat-atelier";
import { COMPANIES } from "@/lib/data";
import { MoatAtelier, type MoatEntree } from "@/components/sandbox/moat-atelier";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Moat Morningstar · Sandbox Mettrik",
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
  const moat = JSON.parse(fs.readFileSync(path.join(process.cwd(), "docs/cahier/moat.json"), "utf-8")) as {
    societes: Record<string, MoatEntree>;
  };
  const gics = JSON.parse(fs.readFileSync(path.join(process.cwd(), "docs/cahier/societes-gics.json"), "utf-8")) as {
    societes: Record<string, string>;
  };
  // 8 sept 2026 : evaluation METTRIK de la tendance du moat (pas Morningstar),
  // docs/cahier/moat-tendance-mettrik.json ; vide tant que la passe n a pas tourne.
  let mettrik: Record<string, MettrikTendance> = {};
  try {
    mettrik = JSON.parse(fs.readFileSync(path.join(process.cwd(), "docs/cahier/moat-tendance-mettrik.json"), "utf-8")) as Record<string, MettrikTendance>;
  } catch {
    mettrik = {};
  }
  const noms: Record<string, string> = {};
  for (const [t, v] of Object.entries(V17_PUBLIC as Record<string, { name?: string }>)) if (v?.name) noms[t.toUpperCase()] = v.name;
  for (const [t, v] of Object.entries(COMPANIES)) noms[t.toUpperCase()] = v.name;

  return (
    <div className="min-h-screen bg-[#050505] text-zinc-100">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5 sm:px-6">
        <Link href="/sandbox" className="inline-flex items-center gap-2 text-sm text-zinc-400 transition-colors hover:text-zinc-100">
          <ArrowLeft className="size-4" />
          Sandbox
        </Link>
        <span className="font-mono text-[11px] uppercase tracking-wider text-zinc-500">Cahier : docs/cahier/moat.json</span>
      </nav>
      <main className="mx-auto max-w-7xl px-4 pb-20 sm:px-6">
        <h1 className="font-display text-[28px] font-bold tracking-tight">Moat Morningstar</h1>
        <p className="mt-1 text-[14px] text-zinc-400">
          Avantage concurrentiel (Wide / Narrow / None), dernier changement de note, allocation du capital, incertitude et étoiles, pour tout l&apos;univers. La flèche « Mettrik » sur chaque ligne est l&apos;évaluation Mettrik de la tendance du moat (passé récent, présent, futur proche), pas une donnée Morningstar.
        </p>
        <div className="mt-6">
          <MoatAtelier societes={moat.societes} gics={gics.societes} noms={noms} mettrik={mettrik} />
        </div>
      </main>
    </div>
  );
}
