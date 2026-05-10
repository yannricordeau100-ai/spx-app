import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ChartPulse, ChartRibbon, ChartQuartz } from "@/components/lab/news-charts-variants";

/**
 * /concepts/charts-news — galerie 3 styles charts × 2 profils sé.
 *
 * Yann (11 mai 2026) : "affiche moi 2-3 concepts pour une sté tech avec
 * bcp de changement, et idem pour une sté avec peu de changement. Met
 * un nom de style pour chaque."
 *
 * Profils :
 *   - NVDA : très volatile (×16 en 14 trimestres, momentum brutal)
 *   - CAT  : stable (croissance lente régulière sur 8 trimestres)
 *
 * 3 styles candidats avec caractères visuels distincts :
 *   1. Pulse  : courbe + halo pulsant sur dernier point. Dramatise les
 *               variations récentes.
 *   2. Ribbon : ruban dégradé violet→cyan, aire floutée. Premium, doux,
 *               efficace pour montrer une trajectoire.
 *   3. Quartz : barres cristallines translucides + courbe fine. Minéral,
 *               posé, lisible même si les variations sont petites.
 */
export const metadata = {
  title: "Charts concepts · Mettrik AI",
  robots: { index: false, follow: false },
};

const NVDA_HISTORY = [
  1.906, 2.051, 2.659, 2.935, 3.793, 3.837, 3.801, 3.766, 4.282, 11.04,
  14.51, 22.1, 26.56, 30.03,
];
const CAT_HISTORY = [13.659, 15.18, 14.182, 14.508, 15.271, 14.425, 14.54, 15.281];

const STYLES: Array<{
  id: string;
  name: string;
  pitch: string;
  Component: typeof ChartPulse;
}> = [
  {
    id: "pulse",
    name: "Pulse",
    pitch: "Halo pulsant sur le dernier point. Le pulse grossit avec l'amplitude du delta récent. Dramatise les variations.",
    Component: ChartPulse,
  },
  {
    id: "ribbon",
    name: "Ribbon",
    pitch: "Ruban dégradé violet→cyan, aire floutée. Premium et doux. Met l'accent sur la trajectoire globale.",
    Component: ChartRibbon,
  },
  {
    id: "quartz",
    name: "Quartz",
    pitch: "Barres cristallines translucides + courbe fine. Minéral posé. Lisible même avec petites variations.",
    Component: ChartQuartz,
  },
];

const PROFILES = [
  {
    ticker: "NVDA",
    label: "Volatile",
    sub: "Croissance ×16 en 14 trimestres. KPI HPC / Cloud (Mds $).",
    history: NVDA_HISTORY,
    accent: "#a78bfa",
  },
  {
    ticker: "CAT",
    label: "Stable",
    sub: "Croissance lente régulière sur 8 trimestres. KPI Revenue (Mds $).",
    history: CAT_HISTORY,
    accent: "#22d3ee",
  },
];

export default function ChartsNewsConceptPage() {
  return (
    <div className="min-h-screen bg-[#050505] text-zinc-100">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <Link
          href="/concepts"
          className="group mb-6 inline-flex items-center gap-2 text-[12px] text-zinc-500 transition-colors hover:text-zinc-200"
        >
          <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" />
          Retour aux concepts
        </Link>

        <h1 className="font-display text-[32px] font-bold tracking-tight">
          Charts concepts
        </h1>
        <p className="mt-2 max-w-2xl text-[14px] text-zinc-400">
          3 styles testés sur 2 profils : sté volatile (NVDA) et sté stable (CAT).
          Chaque style a un caractère visuel propre. Dis-moi celui que tu préfères
          et ce qu&apos;on peut améliorer.
        </p>

        {/* Légende des styles */}
        <div className="mt-8 grid grid-cols-1 gap-3 md:grid-cols-3">
          {STYLES.map((s) => (
            <div
              key={s.id}
              className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
            >
              <div className="font-display text-[16px] font-bold text-zinc-100">
                {s.name}
              </div>
              <p className="mt-1 text-[12.5px] leading-relaxed text-zinc-400">
                {s.pitch}
              </p>
            </div>
          ))}
        </div>

        {/* Grille 2 lignes (profiles) × 3 colonnes (styles) */}
        <div className="mt-10 space-y-10">
          {PROFILES.map((p) => (
            <section key={p.ticker}>
              <div className="mb-4 flex items-baseline justify-between border-b border-white/[0.06] pb-3">
                <div>
                  <h2 className="font-display text-[22px] font-bold tracking-tight">
                    {p.ticker} <span className="ml-2 text-[12px] font-mono uppercase tracking-wider text-zinc-500">{p.label}</span>
                  </h2>
                  <p className="mt-1 text-[12.5px] text-zinc-400">{p.sub}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                {STYLES.map((s) => {
                  const Component = s.Component;
                  return (
                    <div
                      key={`${p.ticker}-${s.id}`}
                      className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4"
                    >
                      <div className="mb-3 flex items-baseline justify-between">
                        <span className="font-display text-[13px] font-semibold text-zinc-200">
                          {s.name}
                        </span>
                        <span className="font-mono text-[10.5px] uppercase tracking-wider text-zinc-500">
                          {p.ticker}
                        </span>
                      </div>
                      <div className="aspect-[16/6.5] w-full">
                        <Component data={p.history} accent={p.accent} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        <p className="mt-10 text-center text-[11.5px] text-zinc-600">
          Aucun style choisi pour l&apos;instant. Le style validé remplacera le rendu actuel
          dans <code className="font-mono text-zinc-400">company-view.tsx</code> et les cartes home.
        </p>
      </div>
    </div>
  );
}
