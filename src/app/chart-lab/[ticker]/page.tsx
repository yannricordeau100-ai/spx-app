import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { COMPANIES, TICKERS, getCompany, getHero } from "@/lib/data";
import { brand } from "@/lib/brand";
import {
  BarsCrystal,
  BarsHologram,
  BarsMercury,
  BarsParticles,
  BarsFloating,
} from "@/components/lab/bars-variants";
import {
  CurveRibbon,
  CurveTerrain,
  CurveLightBeam,
  CurveCosmic,
  CurveLiquid,
} from "@/components/lab/curve-variants";
import {
  VariationPulseWaves,
  VariationGeyser,
  VariationTornado,
  VariationArrows,
  VariationDiscs,
} from "@/components/lab/variation-variants";

export function generateStaticParams() {
  return TICKERS.map((t) => ({ ticker: t.toLowerCase() }));
}

export async function generateMetadata({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params;
  const c = COMPANIES[ticker.toUpperCase()];
  return { title: `Chart Lab · ${c?.name ?? ticker}` };
}

const YEARS = ["2021", "2022", "2023", "2024", "2025"];

function StyleCard({
  index,
  name,
  description,
  children,
}: {
  index: string;
  name: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-[#1f1f1f] bg-[#080808] p-4 transition-colors hover:border-[#3a3a3a]">
      <div className="mb-3 flex items-baseline justify-between">
        <div>
          <span className="font-mono text-[11px] uppercase tracking-wider text-zinc-500">
            Style {index}
          </span>
          <h3 className="mt-0.5 text-[16px] font-semibold text-zinc-50">{name}</h3>
          <p className="mt-0.5 text-[12px] text-zinc-400">{description}</p>
        </div>
      </div>
      <div className="rounded-xl border border-[#1a1a1a] bg-[#050505] p-2">
        {children}
      </div>
    </div>
  );
}

export default async function Page({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params;
  const company = getCompany(ticker);
  if (!company) notFound();
  const hero = getHero(company);
  const accent = brand(company.ticker).primary;
  const data = hero.history;
  const unit = hero.unit;

  const barsStyles = [
    { name: "Crystal", description: "Verre transparent + flux lumineux interne", Component: BarsCrystal },
    { name: "Hologram", description: "Wireframe néon + lignes scan", Component: BarsHologram },
    { name: "Mercury", description: "Chrome métallique réfléchissant", Component: BarsMercury },
    { name: "Particle Stream", description: "Particules verticales en streaming", Component: BarsParticles },
    { name: "Floating Panels", description: "Panneaux suspendus à différentes profondeurs", Component: BarsFloating },
  ];

  const curveStyles = [
    { name: "Energy Ribbon", description: "Ruban lumineux avec halo + nœuds", Component: CurveRibbon },
    { name: "Wireframe Terrain", description: "Maillage 3D, ligne = crête", Component: CurveTerrain },
    { name: "Light Beam", description: "Rayon laser + particules orbitantes", Component: CurveLightBeam },
    { name: "Cosmic Trail", description: "Comète à travers les étoiles", Component: CurveCosmic },
    { name: "Liquid Wave", description: "Vague organique + bulles", Component: CurveLiquid },
  ];

  const variationStyles = [
    { name: "Pulse Waves", description: "Ondes circulaires émises depuis chaque année", Component: VariationPulseWaves },
    { name: "Geyser", description: "Colonnes de lumière jaillissantes (haut/bas)", Component: VariationGeyser },
    { name: "Tornado", description: "Spirales tordues, sens = direction de variation", Component: VariationTornado },
    { name: "Diving Arrows", description: "Flèches 3D plongeantes / montantes", Component: VariationArrows },
    { name: "Stacked Discs", description: "Disques flottants empilés", Component: VariationDiscs },
  ];

  return (
    <div className="min-h-screen bg-[#050505]">
      <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6 sm:py-9">
        <nav className="mb-8 flex items-center gap-3">
          <Link
            href={`/${company.ticker.toLowerCase()}`}
            className="group inline-flex items-center gap-2 text-sm text-zinc-400 transition-colors hover:text-zinc-100"
          >
            <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-0.5" />
            Retour à {company.name}
          </Link>
          <span className="rounded-full bg-violet-500/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-violet-200">
            Chart Lab
          </span>
        </nav>

        <div className="mb-10">
          <h1 className="font-display text-4xl font-bold tracking-tight text-zinc-50 sm:text-5xl">
            Galerie de styles graphiques
          </h1>
          <p className="mt-2 text-[15px] text-zinc-400">
            Donnée test : <strong className="text-zinc-100">{hero.name_fr}</strong> de {company.name}.
            Pick les meilleurs styles pour Bars / Courbe / Variation et dis-moi les numéros.
          </p>
        </div>

        {/* BARS */}
        <section className="mt-2">
          <h2 className="mb-5 text-[24px] font-semibold text-zinc-50">
            <span className="font-mono text-zinc-500">01.</span> Bars — 5 styles
          </h2>
          <div className="grid gap-4 lg:grid-cols-2">
            {barsStyles.map((s, i) => (
              <StyleCard
                key={s.name}
                index={`B${i + 1}`}
                name={s.name}
                description={s.description}
              >
                <s.Component data={data} labels={YEARS} color={accent} unit={unit} />
              </StyleCard>
            ))}
          </div>
        </section>

        {/* CURVE */}
        <section className="mt-12">
          <h2 className="mb-5 text-[24px] font-semibold text-zinc-50">
            <span className="font-mono text-zinc-500">02.</span> Courbe — 5 styles
          </h2>
          <div className="grid gap-4 lg:grid-cols-2">
            {curveStyles.map((s, i) => (
              <StyleCard
                key={s.name}
                index={`C${i + 1}`}
                name={s.name}
                description={s.description}
              >
                <s.Component data={data} labels={YEARS} color={accent} unit={unit} />
              </StyleCard>
            ))}
          </div>
        </section>

        {/* VARIATION */}
        <section className="mt-12">
          <h2 className="mb-5 text-[24px] font-semibold text-zinc-50">
            <span className="font-mono text-zinc-500">03.</span> Variation — 5 styles
          </h2>
          <div className="grid gap-4 lg:grid-cols-2">
            {variationStyles.map((s, i) => (
              <StyleCard
                key={s.name}
                index={`V${i + 1}`}
                name={s.name}
                description={s.description}
              >
                <s.Component data={data} labels={YEARS} color={accent} />
              </StyleCard>
            ))}
          </div>
        </section>

        <footer className="mt-16 pb-10 text-center text-[12px] text-zinc-500">
          Quand tu as choisi : dis-moi <span className="font-mono text-zinc-300">B?</span>,
          <span className="font-mono text-zinc-300"> C?</span>,
          <span className="font-mono text-zinc-300"> V?</span> et je remplace les charts principaux.
        </footer>
      </div>
    </div>
  );
}
