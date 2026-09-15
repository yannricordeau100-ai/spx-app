import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DESK_OWNER_EMAIL } from "@/lib/desk/auth";
import { kpisDeSociete, lireChoixAccueil } from "@/lib/accueil-kpis";
import ZONES_KPIS from "@/data/carte-pays-kpis.json";
import { AccueilKpisClient } from "./client";

export const dynamic = "force-dynamic";
export const metadata = { title: "KPI de l accueil · Mettrik AI", robots: { index: false, follow: false } };

const LIBELLES: Record<string, string> = { world: "Monde", en: "États-Unis", fr: "France", "en-GB": "Royaume-Uni", de: "Allemagne", nl: "Pays-Bas", "de-CH": "Suisse" };

export default async function Page({ searchParams }: { searchParams: Promise<{ audit_token?: string }> }) {
  const sp = await searchParams;
  const parJeton = !!sp.audit_token && !!process.env.VISUAL_AUDIT_TOKEN && sp.audit_token === process.env.VISUAL_AUDIT_TOKEN;
  if (!parJeton) {
    const sb = await createSupabaseServerClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user || user.email !== DESK_OWNER_EMAIL) redirect("/404");
  }
  const zones = (ZONES_KPIS as unknown as { zones: Record<string, { ticker: string; nom: string; kpis: { nom: string }[] }[]> }).zones;
  const parZone = Object.entries(zones).map(([cle, l]) => ({ cle, libelle: LIBELLES[cle] ?? cle, stes: l.slice(0, 10).map((s) => ({ ticker: s.ticker, nom: s.nom, defaut: s.kpis.map((k) => k.nom) })) }));
  const tickers = [...new Set(parZone.flatMap((z) => z.stes.map((s) => s.ticker)))];
  const listes = await Promise.all(tickers.map(async (t) => [t, await kpisDeSociete(t)] as const));
  return (
    <main className="mx-auto max-w-5xl px-4 py-6 text-zinc-100">
      <h1 className="font-display text-[22px] font-bold">KPI affichés sur l’accueil</h1>
      <p className="mt-1 text-[13px] text-zinc-400">Pour chacune des 10 premières sociétés de chaque zone, choisis 3 KPI parmi tous ses indicateurs clés et ses stories. Sans choix, les KPI calculés automatiquement restent affichés.</p>
      <AccueilKpisClient zones={parZone} kpis={Object.fromEntries(listes)} choixInitial={await lireChoixAccueil()} jeton={parJeton ? sp.audit_token ?? null : null} />
    </main>
  );
}
