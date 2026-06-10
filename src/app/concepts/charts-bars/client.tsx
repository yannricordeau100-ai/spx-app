"use client";

import { BarsIso3DStack } from "@/components/charts/bars-3d-variants";
import { BAR_STYLE_PROPOSALS, BarStyleChart } from "@/components/charts/bars-style-proposals";

const DEMO_DATA = [19.21, 26.28, 33.09, 43.23, 58.71];
const DEMO_LABELS = ["2021", "2022", "2023", "2024", "2025"];
const DEMO_TTM = 65.0;
const DEMO_UNIT = "$B";
const ACCENT = "#a78bfa";

const VARIANTS: Array<{
  id: string;
  title: string;
  description: string;
  body: React.ReactNode;
}> = [
  {
    id: "A",
    title: "A · Iso 3D (actuel sur l'app live)",
    description:
      "Barres en perspective isométrique avec 3 faces (avant + côté + dessus). Ombre portée sous chaque barre. Le style hérité du chart-lab. La barre TTM apparaît avec un contour pointillé et une opacité réduite (~60%).",
    body: (
      <BarsIso3DStack
        data={DEMO_DATA}
        labels={DEMO_LABELS}
        unit={DEMO_UNIT}
        color={ACCENT}
        ttm={DEMO_TTM}
        variant="iso3d"
      />
    ),
  },
  {
    id: "B",
    title: "B · Classique 2D plat",
    description:
      "Barres rectangulaires standard, fill plein semi-transparent + contour fin. Aucune perspective. Plus lisible, plus sobre. Adapté quand on veut comparer des nombres précisément. La barre TTM est plus claire (35% opacité) avec contour pointillé.",
    body: (
      <BarsIso3DStack
        data={DEMO_DATA}
        labels={DEMO_LABELS}
        unit={DEMO_UNIT}
        color={ACCENT}
        ttm={DEMO_TTM}
        variant="classic"
      />
    ),
  },
  {
    id: "C",
    title: "C · Recommandation : utilise le toggle 3D / Classique",
    description:
      "Plutôt que de choisir UNE seule variante, je recommande de garder les 2 disponibles via un toggle dans la barre d'outils du chart (déjà fait sur l'app live). Tu peux à tout moment switcher 3D <-> Classique selon ton humeur ou le contexte. Le réglage est par-utilisateur (mémorisé dans la session).",
    body: (
      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-6 text-center">
        <p className="font-display text-[18px] font-bold text-emerald-200">
          Déjà en place sur l&apos;app live ✓
        </p>
        <p className="mt-2 text-[13px] text-zinc-300">
          Va sur n&apos;importe quelle page société (ex : /googl), click le mode &quot;Barres&quot;,
          un toggle 3D / Classique apparaît à droite. Test, dis-moi si tu veux changer le défaut
          ou ajouter un 3e style.
        </p>
      </div>
    ),
  },
];

export function ChartsBarsConceptClient() {
  return (
    <div className="space-y-12">
      {/* Nouvelles propositions Yann 11 juin 2026 : 8 styles, 4 néon + 4 sobres */}
      <div className="rounded-xl border border-violet-500/25 bg-violet-500/[0.05] p-5">
        <h2 className="font-display text-[17px] font-bold text-violet-100">
          Nouvelles propositions barres — 8 styles (4 néon · 4 sobres, 2D + 3D)
        </h2>
        <p className="mt-1 text-[12.5px] text-zinc-400">
          Tu n&apos;aimes pas les barres actuelles : voici 8 alternatives. Dis-moi
          lesquelles tu veux (une pour le mode 2D, une pour le 3D, ou un toggle).
          Données démo = Google Cloud (Mds $).
        </p>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {BAR_STYLE_PROPOSALS.map((p) => (
          <div key={p.id} className="rounded-xl border border-white/8 bg-white/[0.02] p-5">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <h3 className="font-display text-[15px] font-bold text-zinc-50">{p.title}</h3>
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                  p.neon ? "bg-violet-500/20 text-violet-200" : "bg-zinc-600/30 text-zinc-300"
                }`}
              >
                {p.neon ? "NÉON" : "SOBRE"}
              </span>
              <span className="rounded bg-zinc-700/40 px-1.5 py-0.5 text-[10px] text-zinc-300">
                {p.dim}
              </span>
            </div>
            <p className="mb-3 text-[12px] leading-relaxed text-zinc-400">{p.description}</p>
            <BarStyleChart
              styleId={p.id}
              data={DEMO_DATA}
              labels={DEMO_LABELS}
              unit={DEMO_UNIT}
              color={ACCENT}
              ttm={DEMO_TTM}
            />
          </div>
        ))}
      </div>

      <div className="border-t border-white/10 pt-8">
        <h2 className="font-display text-[14px] font-bold uppercase tracking-wide text-zinc-400">
          Anciens styles (actuellement sur l&apos;app)
        </h2>
      </div>

      {VARIANTS.map((v) => (
        <div key={v.id} className="rounded-xl border border-white/8 bg-white/[0.02] p-5">
          <div className="mb-3">
            <h2 className="font-display text-[18px] font-bold text-zinc-50">{v.title}</h2>
            <p className="mt-1 max-w-3xl text-[12.5px] leading-relaxed text-zinc-400">
              {v.description}
            </p>
          </div>
          <div className="mt-4">{v.body}</div>
        </div>
      ))}

      <div className="rounded-xl border border-violet-500/20 bg-violet-500/[0.04] p-5 text-[13px]">
        <h3 className="mb-2 font-display text-[15px] font-bold text-violet-200">
          Que dois-je pousser en prod ?
        </h3>
        <p className="text-zinc-300">
          Réponse simple : <strong>les 2 styles sont déjà dispos en prod via le toggle</strong>{" "}
          (option C). Si tu veux qu&apos;UN seul style soit présent (sans toggle), dis-moi
          lequel : <em>3D</em> (A) ou <em>Classique</em> (B). Je supprime le toggle et je passe
          ce style en défaut unique.
        </p>
        <p className="mt-2 text-zinc-300">
          Le rendu de la barre <strong>TTM</strong> (12 derniers mois en pointillé) est
          identique dans les 3 cas : tu n&apos;as pas à choisir là-dessus.
        </p>
      </div>
    </div>
  );
}
