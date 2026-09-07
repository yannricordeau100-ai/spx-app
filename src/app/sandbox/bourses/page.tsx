/**
 * /sandbox/bourses : arborescence des bourses mondiales (07 sept 2026).
 * Source : docs/cahier/bourses/<CODE>.json (mission en cours).
 * Reserve au proprietaire ; le jeton d audit ouvre la page.
 */
import fs from "node:fs";
import path from "node:path";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DESK_OWNER_EMAIL } from "@/lib/desk/auth";
import { BoursesAtelier, type PaysBourse } from "@/components/sandbox/bourses-atelier";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Bourses mondiales · Sandbox Mettrik",
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
  const dossier = path.join(process.cwd(), "docs/cahier/bourses");
  const pays: PaysBourse[] = [];
  if (fs.existsSync(dossier)) {
    for (const f of fs.readdirSync(dossier)) {
      if (!f.endsWith(".json") || f.startsWith("_")) continue;
      try {
        pays.push(JSON.parse(fs.readFileSync(path.join(dossier, f), "utf-8")) as PaysBourse);
      } catch {
        // fichier en cours d ecriture par un agent : ignore
      }
    }
  }
  return (
    <div className="min-h-screen bg-[#050505] text-zinc-100">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5 sm:px-6">
        <Link href="/sandbox" className="inline-flex items-center gap-2 text-sm text-zinc-400 transition-colors hover:text-zinc-100">
          <ArrowLeft className="size-4" />
          Sandbox
        </Link>
        <span className="font-mono text-[11px] uppercase tracking-wider text-zinc-500">Cahier : docs/cahier/bourses</span>
      </nav>
      <main className="mx-auto max-w-7xl px-4 pb-20 sm:px-6">
        <h1 className="font-display text-[28px] font-bold tracking-tight">Bourses mondiales</h1>
        <p className="mt-1 text-[14px] text-zinc-400">
          Par pays : indice principal et indice secondaire de la bourse (compositions 2026), sociétés déjà en ligne cliquables. Mission en cours sur 18 pays.
        </p>
        <div className="mt-6">
          <BoursesAtelier pays={pays} />
        </div>
      </main>
    </div>
  );
}
