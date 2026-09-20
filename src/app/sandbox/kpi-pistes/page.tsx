/**
 * /sandbox/kpi-pistes : « Trouver les bons KPI a ajouter » (Yann 21 sept 2026).
 *
 * Cinq sous-onglets, un par methode de recherche. Aucune recherche n est
 * lancable pour l instant : les boutons existent mais restent desactives
 * tant que Yann n a pas donne le feu vert.
 *
 * Reserve au proprietaire ; le jeton d audit ouvre la page pour les
 * verifications, comme sur /sandbox/gics.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { DESK_OWNER_EMAIL } from "@/lib/desk/auth";
import { lireAnnuaireGics } from "@/lib/cahier";
import { lireArbitragesGics } from "@/lib/desk/gics-arbitrage";
import { lirePistes, lireRegulateurs } from "@/lib/desk/kpi-pistes";
import V17_PUBLIC from "@/data/v1-7-public.json";
import { COMPANIES } from "@/lib/data";
import UNIVERS from "@/data/v1-9-5-clean-all-tickers.json";
import ETAT_KPI from "@/data/kpi-industries-etat.json";
import { KpiPistesClient, type LigneNonCouverte } from "./client";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Trouver les bons KPI à ajouter · Sandbox Mettrik",
  robots: { index: false, follow: false },
};

type EtatIndustries = {
  maj: string;
  industries: {
    code: string;
    industrie: string;
    secteur: string;
    secteur_code: string;
    stes: string[];
    kpis: { fr: string; en: string; stes_avec: string[]; sans_objet?: string[] }[];
  }[];
};

export default async function Page({ searchParams }: { searchParams: Promise<{ audit_token?: string }> }) {
  const sp = await searchParams;
  const parJeton = !!sp.audit_token && !!process.env.VISUAL_AUDIT_TOKEN && sp.audit_token === process.env.VISUAL_AUDIT_TOKEN;
  if (!parJeton) {
    const sb = await createSupabaseServerClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user || user.email !== DESK_OWNER_EMAIL) redirect("/404");
  }

  // Noms des sociétés, mêmes sources que l’atelier GICS.
  const noms: Record<string, string> = {};
  for (const [t, v] of Object.entries(V17_PUBLIC as Record<string, { name?: string }>)) if (v?.name) noms[t.toUpperCase()] = v.name;
  for (const [t, v] of Object.entries(COMPANIES)) noms[t.toUpperCase()] = v.name;

  const tickers = ((UNIVERS as { tickers?: string[] }).tickers ?? []).map((t) => t.toUpperCase());
  const univers = tickers
    .map((ticker) => ({ ticker, nom: noms[ticker] ?? ticker }))
    .sort((a, b) => a.nom.localeCompare(b.nom, "fr"));

  const arbitrages = await lireArbitragesGics();
  const [annuaire, pistes] = await Promise.all([lireAnnuaireGics(noms, arbitrages), lirePistes()]);
  const regulateurs = lireRegulateurs();

  // Graphiques moyen terme déjà produits, par société : un KPI couvert par un
  // graphique n’est plus « non couvert ». Le rapprochement se fait sur le nom
  // normalisé, le référentiel d’industrie ne portant pas de code court.
  const normaliser = (s: string) =>
    s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "");
  const graphiquesMt: Record<string, Set<string>> = {};
  try {
    const admin = createSupabaseAdminClient();
    const { data } = await admin
      .from("desk_image_findings")
      .select("industry_kpi_short,target_tickers,rejected")
      .not("industry_kpi_short", "is", null);
    for (const f of (data ?? []) as { industry_kpi_short: string; target_tickers: string[] | null; rejected: boolean }[]) {
      if (f.rejected) continue;
      for (const t of f.target_tickers ?? []) {
        const cle = String(t).toUpperCase();
        (graphiquesMt[cle] ??= new Set()).add(normaliser(String(f.industry_kpi_short)));
      }
    }
  } catch {
    /* base indisponible : le tableau reste lisible sans ce filtrage */
  }

  // Référentiel : ce qui reste sans donnée et sans graphique moyen terme.
  const etat = ETAT_KPI as EtatIndustries;
  const nonCouvert: LigneNonCouverte[] = [];
  for (const ind of etat.industries) {
    for (const k of ind.kpis) {
      const avec = new Set((k.stes_avec ?? []).map((t) => t.toUpperCase()));
      const horsPerimetre = new Set((k.sans_objet ?? []).map((t) => t.toUpperCase()));
      const manquantes: string[] = [];
      for (const brut of ind.stes ?? []) {
        const t = brut.toUpperCase();
        if (avec.has(t) || horsPerimetre.has(t)) continue;
        const couvertMt = graphiquesMt[t];
        if (couvertMt && (couvertMt.has(normaliser(k.en ?? "")) || couvertMt.has(normaliser(k.fr ?? "")))) continue;
        manquantes.push(t);
      }
      if (manquantes.length === 0) continue;
      nonCouvert.push({
        code: ind.code,
        industrie: ind.industrie,
        secteur: ind.secteur,
        kpi: k.fr,
        concernees: ind.stes.length - horsPerimetre.size,
        manquantes,
      });
    }
  }
  nonCouvert.sort((a, b) => b.manquantes.length - a.manquantes.length || a.industrie.localeCompare(b.industrie, "fr"));

  return (
    <div className="min-h-screen bg-[#050505] text-zinc-100">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5 sm:px-6">
        <Link href="/sandbox" className="inline-flex items-center gap-2 text-sm text-zinc-400 transition-colors hover:text-zinc-100">
          <ArrowLeft className="size-4" />
          Sandbox
        </Link>
        <span className="font-mono text-[11px] uppercase tracking-wider text-zinc-500">Table : desk_kpi_pistes</span>
      </nav>
      <main className="mx-auto max-w-7xl px-4 pb-20 sm:px-6">
        <KpiPistesClient
          univers={univers}
          pistes={pistes}
          regulateurs={regulateurs}
          parSousIndustrie={annuaire.parSousIndustrie}
          nonCouvert={nonCouvert}
          majReferentiel={etat.maj ?? ""}
          jeton={parJeton ? sp.audit_token ?? null : null}
        />
      </main>
    </div>
  );
}
