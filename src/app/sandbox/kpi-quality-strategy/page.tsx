import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { KpiQualityStrategyClient } from "./client";
import KPI_HISTORY_GEQ5 from "@/data/kpi-history-geq5.json";
import KPI_HISTORY_UNDER5 from "@/data/kpi-history-under5.json";
import KPI_GENERIC_LIBRARY from "@/data/kpi-generic-library.json";

export const dynamic = "force-static";
export const revalidate = 3600;
export const metadata = {
  title: "KPI Quality Strategy · Mettrik AI",
  robots: { index: false, follow: false },
};

/**
 * /sandbox/kpi-quality-strategy
 *
 * Bloc unifié pour piloter la stratégie KPI Mettrik (Yann 19 mai 2026) :
 *
 * 1. AUDIT HISTORIQUE — 2 listes de stés :
 *    - ≥ 5 ans d'historique hero KPI (451 stés, essentiellement US/SP500)
 *    - < 5 ans (1608 stés, EU + small/mid cap manuellement récupérées)
 *    Export CSV par liste pour audit + handoff CONV-DATA.
 *
 * 2. LIBRARY KPI GÉNÉRIQUES (bas/milieu de gamme) :
 *    - Revenue, Op Margin, EPS, Net Income, EBITDA, FCF, Headcount, etc.
 *    - Présents par défaut chez 95 % des stés
 *    - MASQUÉS dans l'affichage app par défaut
 *    - Activables par catégorie (sp500, top307, V1.9) via toggle
 *    - Liste FR + EN
 *
 * Le but final : ne montrer dans l'app QUE les KPI spécifiques sté/secteur.
 * Le générique reste en data, activable ponctuellement.
 */
export default function KpiQualityStrategyPage() {
  return (
    <div className="min-h-screen bg-[#050505] text-zinc-100">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <Link
          href="/sandbox"
          className="mb-6 inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-100"
        >
          <ArrowLeft className="size-4" /> Retour sandbox
        </Link>
        <h1 className="font-display text-[28px] font-bold tracking-tight">
          KPI Quality Strategy
        </h1>
        <p className="mt-2 max-w-3xl text-[13.5px] leading-relaxed text-zinc-400">
          Pilotage de la qualité KPI Mettrik (Yann 19 mai 2026) : audit
          historique hero KPI par profondeur + library KPI génériques avec
          toggle activation par catégorie. Le but : afficher dans l&apos;app{" "}
          <strong className="text-zinc-200">UNIQUEMENT les KPI spécifiques</strong>{" "}
          (sté ou secteur), garder le générique en data activable.
        </p>

        <KpiQualityStrategyClient
          geq5={KPI_HISTORY_GEQ5 as unknown as HistEntry[]}
          under5={KPI_HISTORY_UNDER5 as unknown as HistEntry[]}
          generic={KPI_GENERIC_LIBRARY as unknown as GenericKpiEntry[]}
        />
      </div>
    </div>
  );
}

export type HistEntry = {
  ticker: string;
  country: string;
  name: string;
  sector: string;
  hero_kpi: string;
  period_type: string;
  history_len: number;
  years_coverage: number;
  in_top307_v18: boolean;
  bucket?: string;
};

export type GenericKpiEntry = {
  short: string;
  name_fr: string;
  name_en: string;
  family: string;
  rationale_fr: string;
  rationale_en: string;
};
