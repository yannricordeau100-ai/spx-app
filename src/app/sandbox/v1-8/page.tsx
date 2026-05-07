import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { HomeView } from "@/components/home-view";
import type { Company } from "@/lib/data";
import V17_PUBLIC from "@/data/v1-7-public.json";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "1.8 · Mettrik AI",
  robots: { index: false, follow: false },
};

/**
 * /sandbox/v1-8 = hub similaire à V1.7 mais utilisant le filtre relaxé
 * (Pass 3 Sonnet + hero usable suffisent). Permet à Yann de naviguer
 * sur les stés à 1 critère manquant et de voir les blocs à compléter
 * (rendus en placeholder rouge dans la fiche détail via `v18Mode`).
 *
 * Yann 7 mai 2026 : "je ne veux que les sociétés qui sont tout OK
 * (j'accepte qu'il manque le logo)" → V1.8 montre les "presque OK"
 * pour qu'il décide quoi prioriser, V1.7 reste le strict.
 */
function loadDatasets(): Record<string, Company> {
  // V1.8 utilise le même fichier source que V1.7 pour l'instant. Le
  // filtre relaxé s'applique côté page détail (`/sandbox/v1-8/[ticker]`).
  // Quand on aura un build dédié V1.8 (plus permissif), on switchera ici.
  return V17_PUBLIC as unknown as Record<string, Company>;
}

// Doublons multi-classes : cache la classe NON-canonique pour ne pas
// montrer 2 fois la même société dans le hub.
const HIDDEN_DUPLICATES = new Set(["GOOG", "BRK-A", "BRK.A", "BRK.B", "FOX", "NWSA", "UAA"]);

export default async function SandboxV18HubPage() {
  const datasets = loadDatasets();
  const tickers = Object.keys(datasets)
    .filter((t) => !HIDDEN_DUPLICATES.has(t.toUpperCase()))
    .sort();

  return (
    <>
      {/* Bandeau pricing en tête du hub V1.8 (Yann 7 mai 2026 : onglet
          price intégré). Clique → page tarifs sales-optimized 3 plans. */}
      <div className="border-b border-violet-500/15 bg-gradient-to-r from-violet-500/[0.05] to-cyan-500/[0.03] backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-2.5 sm:px-6">
          <div className="flex items-center gap-2 text-[12.5px]">
            <Sparkles className="size-3.5 shrink-0 text-violet-300" />
            <span className="text-zinc-300">
              <strong className="text-zinc-100">Premium 24,90 €/mois</strong>
              <span className="hidden sm:inline"> — débloque les 1 000+ sociétés, alertes email, comparaisons illimitées</span>
            </span>
          </div>
          <Link
            href="/sandbox/v1-8/pricing"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-violet-500/40 bg-violet-500/15 px-3 py-1.5 text-[12px] font-bold text-violet-100 transition-colors hover:bg-violet-500/25"
            data-pricing-cta="v18_hub_topbanner"
          >
            Voir les plans
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </div>
      <HomeView
        companies={datasets}
        tickers={tickers}
        showFAQ={false}
        routePrefix="/sandbox/v1-8"
      />
    </>
  );
}
