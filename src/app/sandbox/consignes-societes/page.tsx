/**
 * /sandbox/consignes-societes : consignes d ajout de nouvelles societes (Yann 9 oct 2026).
 * Source unique : docs/CONSIGNES-NOUVELLES-SOCIETES.md (lu a chaque requete, lisible
 * aussi par les agents). Les titres de niveau 1 deviennent des onglets ; un titre de
 * niveau 1 suivi du marqueur <!-- sous-onglets --> range ses titres de niveau 2 en
 * sous-onglets. Reserve au proprietaire ; le jeton d audit ouvre la page pour les verifications.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DESK_OWNER_EMAIL } from "@/lib/desk/auth";
import { ConsignesOnglets } from "./onglets";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Consignes nouvelles sociétés · Sandbox Mettrik",
  robots: { index: false, follow: false },
};

const FICHIER = "docs/CONSIGNES-NOUVELLES-SOCIETES.md";

export default async function Page({ searchParams }: { searchParams: Promise<{ audit_token?: string; onglet?: string }> }) {
  const sp = await searchParams;
  const parJeton = !!sp.audit_token && !!process.env.VISUAL_AUDIT_TOKEN && sp.audit_token === process.env.VISUAL_AUDIT_TOKEN;
  if (!parJeton) {
    const sb = await createSupabaseServerClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user || user.email !== DESK_OWNER_EMAIL) redirect("/404");
  }
  let brut = "";
  let modifie = "";
  try {
    const chemin = path.join(process.cwd(), FICHIER);
    brut = await fs.readFile(chemin, "utf8");
    modifie = (await fs.stat(chemin)).mtime.toLocaleString("fr-FR", { timeZone: "Europe/Paris", dateStyle: "short", timeStyle: "short" });
  } catch {
    brut = "# Fichier introuvable\n\nLe fichier " + FICHIER + " est absent de ce déploiement.";
  }
  return (
    <div className="min-h-screen bg-[#050505] text-zinc-100">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5 sm:px-6">
        <Link href="/sandbox" className="inline-flex items-center gap-2 text-sm text-zinc-400 transition-colors hover:text-zinc-100">
          <ArrowLeft className="size-4" />
          Sandbox
        </Link>
        <span className="font-mono text-[11px] uppercase tracking-wider text-zinc-500">Source : {FICHIER}{modifie ? ` · modifié le ${modifie}` : ""}</span>
      </nav>
      <main className="mx-auto max-w-7xl px-4 pb-20 sm:px-6">
        <h1 className="font-display text-[28px] font-bold tracking-tight">Consignes d’ajout de nouvelles sociétés</h1>
        <p className="mt-1 max-w-3xl text-[14px] text-zinc-400">
          Tout ce qu’il faut faire pour qu’une nouvelle société (d’un pays déjà couvert ou d’un nouveau pays) soit aussi complète et fonctionnelle que les meilleures fiches : blocs, données hors bloc, réglages, contrôles. Le même fichier sert de consigne aux agents.
        </p>
        <ConsignesOnglets source={brut} ongletInitial={sp.onglet ?? null} />
      </main>
    </div>
  );
}
