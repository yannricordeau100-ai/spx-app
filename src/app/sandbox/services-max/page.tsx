/**
 * /sandbox/services-max : proposition d offre Premium / Max + choix du
 * proprietaire par cases a cocher (07 sept 2026).
 * Reserve au proprietaire ; le jeton d audit ouvre la page.
 */
import fs from "node:fs";
import path from "node:path";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DESK_OWNER_EMAIL } from "@/lib/desk/auth";
import { ServicesMaxAtelier } from "@/components/sandbox/services-max-atelier";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Services Max · Sandbox Mettrik",
  robots: { index: false, follow: false },
};

/** Preuves marche du benchmark concurrents (08 sept 2026), tolerant si absent. */
function lirePreuves() {
  try {
    const p = path.join(process.cwd(), "docs/cahier/services-max-preuves.json");
    return JSON.parse(fs.readFileSync(p, "utf-8")).idees ?? null;
  } catch {
    return null;
  }
}

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
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <Link href="/sandbox" className="inline-flex items-center gap-2 text-sm text-zinc-400 transition-colors hover:text-zinc-100">
          <ArrowLeft className="size-4" />
          Sandbox
        </Link>
        <span className="font-mono text-[11px] uppercase tracking-wider text-zinc-500">Offre : Premium / Max</span>
      </nav>
      <main className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <h1 className="font-display text-[28px] font-bold tracking-tight">Services Premium et Max</h1>
        <p className="mt-1 text-[14px] text-zinc-400">
          Proposition calée sur le marché (TIKR, Fiscal.ai, Simply Wall St, Koyfin). Coche les services Max que tu retiens : tes choix sont enregistrés et je chiffre puis je construis.
        </p>
        <div className="mt-6">
          <ServicesMaxAtelier auditToken={parJeton ? sp.audit_token : undefined} preuves={lirePreuves()} />
        </div>
      </main>
    </div>
  );
}
