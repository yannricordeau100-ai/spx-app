/**
 * Page test pour vérifier visuellement les changements chart de la session
 * du 13 mai 2026 :
 *   - axis Y "$ en Milliards" / "$ en Millions" (mot complet)
 *   - Y-axis adaptive zoom : range < 40 % de dataMax → zoom
 *   - Photons lumineux qui glissent sur la courbe
 *   - Trait gradient violet → couleur → cyan
 *
 * URL : /concepts/chart-test
 */
"use client";

import { CurveChart } from "@/components/charts/curve-chart";
import { BarsIso3DStack } from "@/components/charts/bars-3d-variants";

export default function ChartTestPage() {
  // Cas 1 : data avec petite range (zoom adaptif attendu)
  // Cas 2 : data avec grande range (axe à partir de 0 attendu)
  // Cas 3 : data avec TTM (heuristique sur data seul, pas allData)

  return (
    <div className="min-h-screen bg-[#06060a] p-8 text-zinc-100">
      <div className="mx-auto max-w-5xl space-y-12">
        <h1 className="font-display text-3xl font-semibold">
          Chart Test — vérification visuelle 13 mai 2026
        </h1>
        <p className="text-sm text-zinc-400">
          Si tu vois <strong className="text-violet-300">"$ en Milliards"</strong> ou
          <strong className="text-violet-300"> "$ en Millions"</strong> en haut de
          l'axe Y, c'est que mon dernier deploy a bien shippé les changements.
          Si tu vois encore <strong className="text-red-400">"Mds $" / "M $"</strong>,
          le bundle est stale (Vercel build cache).
        </p>

        <section>
          <h2 className="mb-3 font-display text-lg font-semibold text-violet-200">
            Cas 1 : AAPL Services Revenue (range étroite 19-24 → zoom attendu)
          </h2>
          <p className="mb-2 text-xs text-zinc-500">
            unit="Mds $" → axis devrait afficher "$ en Milliards"
          </p>
          <CurveChart
            data={[19.51, 19.82, 19.2, 20.8, 20.98, 21.21, 21.79, 22.87, 23.39, 23.9]}
            labels={["T2 24", "T3 24", "T4 24", "T1 25", "T2 25", "T3 25", "T4 25", "T1 26", "T2 26", "T3 26"]}
            unit="Mds $"
            color="#22d3ee"
          />
        </section>

        <section>
          <h2 className="mb-3 font-display text-lg font-semibold text-violet-200">
            Cas 2 : GOOGL Cloud (range large 9-20 → axe peut partir de 0)
          </h2>
          <p className="mb-2 text-xs text-zinc-500">
            unit="Mds $" → axis "$ en Milliards"
          </p>
          <CurveChart
            data={[9.57, 10.35, 11.35, 11.96, 12.26, 13.62, 15.16, 17.66, 20.03]}
            labels={["T1 24", "T2 24", "T3 24", "T4 24", "T1 25", "T2 25", "T3 25", "T4 25", "T1 26"]}
            unit="Mds $"
            color="#a78bfa"
          />
        </section>

        <section>
          <h2 className="mb-3 font-display text-lg font-semibold text-violet-200">
            Cas 3 : Format raw $B (axis "$ en Milliards" attendu)
          </h2>
          <p className="mb-2 text-xs text-zinc-500">unit="$B"</p>
          <CurveChart
            data={[100, 105, 110, 112, 115, 118, 120]}
            labels={["2020", "2021", "2022", "2023", "2024", "2025", "2026"]}
            unit="$B"
            color="#f472b6"
          />
        </section>

        <section>
          <h2 className="mb-3 font-display text-lg font-semibold text-violet-200">
            Cas 4 : Bars chart (même test sur 3D)
          </h2>
          <BarsIso3DStack
            data={[19.51, 19.82, 19.2, 20.8, 20.98, 21.21, 21.79, 22.87, 23.39, 23.9]}
            labels={["T2 24", "T3 24", "T4 24", "T1 25", "T2 25", "T3 25", "T4 25", "T1 26", "T2 26", "T3 26"]}
            unit="Mds $"
            color="#22d3ee"
          />
        </section>
      </div>
    </div>
  );
}
