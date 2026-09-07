/**
 * /sandbox/clients : concentration clients de l univers (07 sept 2026).
 * Source : docs/cahier/clients/<TICKER>.json (mission en cours).
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
import { COMPANIES } from "@/lib/data";
import { ClientsAtelier, type ClientsEntree } from "@/components/sandbox/clients-atelier";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Concentration clients · Sandbox Mettrik",
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
  const dossier = path.join(process.cwd(), "docs/cahier/clients");
  const societes: Record<string, ClientsEntree> = {};
  for (const f of fs.readdirSync(dossier)) {
    if (!f.endsWith(".json") || f.startsWith("_")) continue;
    try {
      societes[f.slice(0, -5)] = JSON.parse(fs.readFileSync(path.join(dossier, f), "utf-8")) as ClientsEntree;
    } catch {
      // fichier en cours d ecriture par un agent : ignore
    }
  }
  const gics = JSON.parse(fs.readFileSync(path.join(process.cwd(), "docs/cahier/societes-gics.json"), "utf-8")) as {
    societes: Record<string, string>;
  };
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
        <span className="font-mono text-[11px] uppercase tracking-wider text-zinc-500">Cahier : docs/cahier/clients</span>
      </nav>
      <main className="mx-auto max-w-7xl px-4 pb-20 sm:px-6">
        <h1 className="font-display text-[28px] font-bold tracking-tight">Concentration clients</h1>
        <p className="mt-1 text-[14px] text-zinc-400">
          Part du chiffre d&apos;affaires des tout premiers clients (1 à 3) et des plus gros clients élargis (6 à 10), sources officielles uniquement. Mission en cours sur les 666.
        </p>
        <div className="mt-6">
          <ClientsAtelier societes={societes} gics={gics.societes} noms={noms} />
        </div>
      </main>
    </div>
  );
}
