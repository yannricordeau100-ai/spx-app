"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { COMPANIES, getCompany, getHero } from "@/lib/data";
import { brand } from "@/lib/brand";
import {
  BarsCrystal,
  BarsHologram,
  BarsMercury,
  BarsParticles,
  BarsFloating,
  BarsIsometricModern,
  BarsGlassTowers,
  BarsDeepPerspective,
  BarsGlassmorphism,
  BarsAurora,
  BarsNeonOutline,
  BarsSoftClay,
  BarsCinematic,
  BarsLayered,
} from "@/components/lab/bars-variants";
import {
  CurveRibbon,
  CurveTerrain,
  CurveLightBeam,
  CurveCosmic,
  CurveLiquid,
  CurveExtrudedRidge,
  CurveLiquidTube,
  CurveAuroraFill,
  CurveNeonWire,
  CurveLayeredMountains,
  CurveNeonWire3D,
  CurveNeonRibbon3D,
  CurveNeonTube3D,
} from "@/components/lab/curve-variants";
import {
  VariationRippleWaves,
  VariationGeyser,
  VariationTornado,
  VariationArrows,
  VariationDiscs,
  VariationIsoBlocks,
  VariationGlass,
  VariationSoftClay,
  VariationNeonOutline,
  VariationCinematic,
} from "@/components/lab/variation-variants";
import {
  StockPriceBlockA,
  StockPriceBlockB,
  StockPriceBlockC,
  StockPriceBlockD,
  StockPriceBlockE,
  StockPriceBlockF,
  StockPriceBlockG,
  StockPriceBlockH,
  StockPriceBlockI,
  StockPriceBlockJ,
  StockPriceBlockK,
  StockPriceBlockL,
  StockPriceBlockM,
  StockPriceBlockN,
} from "@/components/lab/stock-price-block-variants";
import {
  RepartitionDonut,
  RepartitionStackedBar,
  RepartitionTreemap,
  RepartitionRadial,
  RepartitionBubble,
  RepartitionPillarPie3D,
  RepartitionHoneycomb3D,
  type RepartitionSlice,
} from "@/components/charts/repartition-variants";
import {
  RepartitionExplodedPie3D,
  RepartitionIsoDetachedWedges,
  RepartitionConcentricRings3D,
  RepartitionWedgeCones,
  RepartitionLayerPyramid,
} from "@/components/charts/repartition-3d-variants";
import {
  CurveIsoMountain3D,
  CurveStackedWave3D,
} from "@/components/charts/curve-3d-variants";
import {
  BarsIso3DStack,
  BarsRibbonStairs3D,
} from "@/components/charts/bars-3d-variants";
import {
  VariationIsoSteps3D,
  VariationDiamondPrisms,
} from "@/components/charts/variation-3d-variants";
import {
  DashboardCardGrid,
  DashboardHeroSecondaries,
  DashboardRankedList,
  type DashKPI,
} from "@/components/charts/dashboard-variants";
import { NavChrome } from "./nav-chrome";

const YEARS = ["2021", "2022", "2023", "2024", "2025"];

const REPARTITION: Record<
  string,
  { geo: { unit: string; data: RepartitionSlice[] }; segments: { unit: string; data: RepartitionSlice[] } }
> = {
  GOOGL: {
    geo: { unit: "Mds $", data: [
      { label: "États-Unis", value: 168 }, { label: "EMEA", value: 105 },
      { label: "APAC", value: 56 }, { label: "Autres Amériques", value: 21 }] },
    segments: { unit: "Mds $", data: [
      { label: "Google Services", value: 305 }, { label: "Google Cloud", value: 42 },
      { label: "Other Bets", value: 3 }] },
  },
  META: {
    geo: { unit: "Mds $", data: [
      { label: "États-Unis & Canada", value: 72.6 }, { label: "Europe", value: 38.0 },
      { label: "Asie-Pacifique", value: 34.7 }, { label: "Reste du monde", value: 19.7 }] },
    segments: { unit: "Mds $", data: [
      { label: "Family of Apps", value: 163.4 }, { label: "Reality Labs", value: 1.6 }] },
  },
  MSCI: {
    geo: { unit: "Mds $", data: [
      { label: "Amériques", value: 1.71 }, { label: "EMEA", value: 0.88 },
      { label: "Asie-Pacifique", value: 0.26 }] },
    segments: { unit: "Mds $", data: [
      { label: "Index", value: 1.71 }, { label: "Analytics", value: 0.68 },
      { label: "ESG & Climate", value: 0.34 }, { label: "All Other", value: 0.12 }] },
  },
  SPGI: {
    geo: { unit: "Mds $", data: [
      { label: "États-Unis", value: 9.51 }, { label: "Europe", value: 2.70 },
      { label: "Asie", value: 1.28 }, { label: "Reste du monde", value: 0.71 }] },
    segments: { unit: "Mds $", data: [
      { label: "Ratings", value: 4.54 }, { label: "Market Intelligence", value: 4.54 },
      { label: "Commodity Insights", value: 1.99 }, { label: "Mobility", value: 1.56 },
      { label: "Indices", value: 1.57 }] },
  },
  CAT: {
    geo: { unit: "Mds $", data: [
      { label: "Amérique du Nord", value: 33.7 }, { label: "EMEA", value: 14.3 },
      { label: "Asie-Pacifique", value: 11.0 }, { label: "Amérique latine", value: 5.8 }] },
    segments: { unit: "Mds $", data: [
      { label: "Construction Industries", value: 26.6 }, { label: "Energy & Transportation", value: 20.7 },
      { label: "Resource Industries", value: 14.3 }, { label: "Financial Products", value: 3.2 }] },
  },
};

function StyleCard({ index, name, description, children }: {
  index: string; name: string; description: string; children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-[#1f1f1f] bg-[#080808] p-4 transition-colors hover:border-[#3a3a3a]">
      <div className="mb-3 flex items-baseline justify-between">
        <div>
          <span className="font-mono text-[11px] uppercase tracking-wider text-zinc-500">Style {index}</span>
          <h3 className="mt-0.5 text-[16px] font-semibold text-zinc-50">{name}</h3>
          <p className="mt-0.5 text-[12px] text-zinc-400">{description}</p>
        </div>
      </div>
      <div className="rounded-xl border border-[#1a1a1a] bg-[#050505] p-2">{children}</div>
    </div>
  );
}

/**
 * ChartLabContent — entire chart-lab page content as a reusable client component.
 *
 * Used by :
 *   - /chart-lab/[ticker] (with showHeader=true for the standalone page)
 *   - /concepts (Chart tab, with showHeader=false since concepts has its own header)
 */
export function ChartLabContent({ ticker, showHeader = true, showNavChrome = true }: {
  ticker: string;
  showHeader?: boolean;
  showNavChrome?: boolean;
}) {
  const company = getCompany(ticker);
  if (!company) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12 text-center text-zinc-400">
        Société introuvable : <span className="font-mono">{ticker}</span>
      </div>
    );
  }
  const hero = getHero(company);
  const accent = brand(company.ticker).primary;
  const data = hero.history;
  const unit = hero.unit;
  const rep = REPARTITION[company.ticker];

  const repStyles = [
    { id: "R1", name: "Donut + légende", description: "Anneau classique premium, total au centre, légende latérale avec %", Component: RepartitionDonut },
    { id: "R2", name: "Stacked Bar 100 %", description: "Barre horizontale segmentée, % sur chaque tronçon, légende sous la barre", Component: RepartitionStackedBar },
    { id: "R3", name: "Treemap", description: "Rectangles dimensionnés par poids, label + % à l'intérieur", Component: RepartitionTreemap },
    { id: "R4", name: "Radial concentrique", description: "Anneaux concentriques, arc rempli proportionnel à la part", Component: RepartitionRadial },
    { id: "R5", name: "Bubble pack", description: "Constellation : bulle dominante au centre + orbite", Component: RepartitionBubble },
    { id: "R6", name: "Pillar Pie 3D", description: "Camembert tilté + extrusion variable par slice (PRÉCÉDENT, jugé NUL)", Component: RepartitionPillarPie3D },
    { id: "R7", name: "Honeycomb 3D iso", description: "Cellules hexagonales en iso (PRÉCÉDENT, jugé NUL)", Component: RepartitionHoneycomb3D },
    { id: "R8", name: "Exploded 3D Pie Cylinder", description: "Camembert cylindrique extrudé, slices détachées (inspi freepik)", Component: RepartitionExplodedPie3D },
    { id: "R9", name: "Iso Detached Wedges", description: "Camembert plat iso, slices détachées + ombre projetée", Component: RepartitionIsoDetachedWedges },
    { id: "R10", name: "Concentric Rings 3D iso", description: "Anneaux concentriques extrudés", Component: RepartitionConcentricRings3D },
    { id: "R11", name: "Wedge Cones 3D", description: "1 cône 3D par segment, hauteur = part", Component: RepartitionWedgeCones },
    { id: "R12", name: "Layer Pyramid iso", description: "Pyramide stratifiée iso, chaque couche = un segment", Component: RepartitionLayerPyramid },
  ];

  const curveExtraStyles = [
    { id: "C14", name: "Iso Mountain Range 3D", description: "Aire courbe en relief iso, fond multi-couches en parallaxe", Component: CurveIsoMountain3D },
    { id: "C15", name: "Stacked Wave 3D iso", description: "3 vagues empilées en profondeur iso", Component: CurveStackedWave3D },
  ];

  const barsExtraStyles = [
    { id: "B26", name: "Iso 3D Stack", description: "Vrais parallépipèdes en iso, top face glossy", Component: BarsIso3DStack },
    { id: "B27", name: "Ribbon Stairs 3D", description: "Bars 3D avec top arrondi en ruban", Component: BarsRibbonStairs3D },
  ];

  const variationExtraStyles = [
    { id: "V11", name: "Iso Step Bars 3D", description: "Bars +/- en iso vrai, gradient front/side/top", Component: VariationIsoSteps3D },
    { id: "V12", name: "Diamond Prisms", description: "Losanges 3D pointe haut/bas selon signe", Component: VariationDiamondPrisms },
  ];

  const dashKPIs: DashKPI[] = [
    { label: hero.short || "Revenue", value: data[data.length - 1], unit, delta: data.length > 1 ? ((data[data.length - 1] - data[data.length - 2]) / Math.abs(data[data.length - 2] || 1)) * 100 : 0, history: data },
    { label: "Net Income", value: Math.round(data[data.length - 1] * 0.22 * 10) / 10, unit, delta: 8.4, history: data.map((v) => v * 0.22) },
    { label: "Op. Margin", value: 28.4, unit: "%", delta: 1.2, history: [25.1, 26.0, 26.9, 27.6, 28.4] },
    { label: "Free Cash Flow", value: Math.round(data[data.length - 1] * 0.18 * 10) / 10, unit, delta: 12.7, history: data.map((v) => v * 0.18) },
    { label: "ROE", value: 24.6, unit: "%", delta: 0.8, history: [21.2, 22.4, 23.0, 23.9, 24.6] },
    { label: "Net Debt / EBITDA", value: 0.7, unit: "x", delta: -15.2, history: [1.2, 1.0, 0.9, 0.85, 0.7] },
    { label: "R&D Spend", value: Math.round(data[data.length - 1] * 0.13 * 10) / 10, unit, delta: 9.3, history: data.map((v) => v * 0.13) },
    { label: "Employees", value: "183 k", delta: 4.5 },
  ];

  const barsStyles = [
    { name: "Isometric Modern", description: "3D isométrique propre", Component: BarsIsometricModern },
    { name: "Glass Towers", description: "Tours de verre translucide + halo", Component: BarsGlassTowers },
    { name: "Deep Perspective", description: "3D fort + spéculaire glossy", Component: BarsDeepPerspective },
    { name: "Glassmorphism", description: "Verre dépoli moderne, reflet diagonal", Component: BarsGlassmorphism },
    { name: "Aurora Gradient", description: "Dégradé fluide multi-stops + halo", Component: BarsAurora },
    { name: "Neon Outline", description: "Bars creuses, contour néon glow", Component: BarsNeonOutline },
    { name: "Soft Clay", description: "Surfaces molles, coins arrondis", Component: BarsSoftClay },
    { name: "Cinematic Rim Light", description: "3D dramatique, rim light blanc", Component: BarsCinematic },
    { name: "Layered Slices", description: "Tranches horizontales empilées", Component: BarsLayered },
    { name: "Crystal", description: "Verre transparent + flux interne", Component: BarsCrystal },
    { name: "Hologram", description: "Wireframe néon + lignes scan", Component: BarsHologram },
    { name: "Mercury", description: "Chrome métallique réfléchissant", Component: BarsMercury },
    { name: "Particle Stream", description: "Particules verticales en streaming", Component: BarsParticles },
    { name: "Floating Panels", description: "Panneaux suspendus à différentes profondeurs", Component: BarsFloating },
  ];

  const curveStyles = [
    { name: "Neon Wire 3D", description: "Neon Wire extrudé : front + back glow", Component: CurveNeonWire3D },
    { name: "Neon Ribbon 3D", description: "Ruban 3D plus large, top face glossy", Component: CurveNeonRibbon3D },
    { name: "Neon Tube 3D", description: "Tube cylindrique néon, vrai volume", Component: CurveNeonTube3D },
    { name: "Liquid Tube", description: "Tube glossy 3D extrudé en perspective", Component: CurveLiquidTube },
    { name: "Aurora Fill", description: "Aire remplie aurora multi-couleurs", Component: CurveAuroraFill },
    { name: "Neon Wire", description: "Fil néon ultra-fin avec halo + nodes", Component: CurveNeonWire },
    { name: "Layered Mountains", description: "Couches qui reculent en perspective", Component: CurveLayeredMountains },
    { name: "Extruded Ridge", description: "Crête 3D extrudée : top face glossy", Component: CurveExtrudedRidge },
    { name: "Energy Ribbon", description: "Ruban lumineux avec halo + nœuds", Component: CurveRibbon },
    { name: "Wireframe Terrain", description: "Maillage 3D, ligne = crête", Component: CurveTerrain },
    { name: "Light Beam", description: "Rayon laser + particules orbitantes", Component: CurveLightBeam },
    { name: "Cosmic Trail", description: "Comète à travers les étoiles", Component: CurveCosmic },
    { name: "Liquid Wave", description: "Vague organique + bulles", Component: CurveLiquid },
  ];

  const variationStyles = [
    { name: "Glass", description: "Tours de verre vert / rouge translucides", Component: VariationGlass },
    { name: "Soft Clay", description: "Claymorphism vert / rouge", Component: VariationSoftClay },
    { name: "Neon Outline", description: "Bars creuses vert / rouge, contour glow", Component: VariationNeonOutline },
    { name: "Cinematic", description: "3D dramatique vert / rouge, rim light", Component: VariationCinematic },
    { name: "Iso Blocks 3D", description: "Blocs isométriques 3D, vert / rouge", Component: VariationIsoBlocks },
    { name: "Ripple Waves", description: "Ondes circulaires émises depuis chaque année", Component: VariationRippleWaves },
    { name: "Geyser", description: "Colonnes de lumière jaillissantes", Component: VariationGeyser },
    { name: "Tornado", description: "Spirales tordues, sens = direction de variation", Component: VariationTornado },
    { name: "Diving Arrows", description: "Flèches 3D plongeantes / montantes", Component: VariationArrows },
    { name: "Stacked Discs", description: "Disques flottants empilés", Component: VariationDiscs },
  ];

  return (
    <div className="bg-[#050505]">
      <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6 sm:py-9">
        {showHeader && (
          <>
            <nav className="mb-8 flex items-center gap-3">
              <Link href={`/${company.ticker.toLowerCase()}`}
                className="group inline-flex items-center gap-2 text-sm text-zinc-400 transition-colors hover:text-zinc-100">
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
              </p>
            </div>
          </>
        )}

        {/* STOCK PRICE BLOCK */}
        <section id="sec-stock" className="mt-2 scroll-mt-24">
          <h2 className="mb-2 text-[24px] font-semibold text-zinc-50">
            <span className="font-mono text-zinc-500">01.</span> Cours de l'action — 14 propositions
            <span className="ml-2 text-[13px] font-normal text-violet-300">(S11-S14 = dégradés ultra étalés + variation % à 10 px)</span>
          </h2>
          <p className="mb-5 text-[13px] text-zinc-400">
            Chaque variante reprend le bloc société entier. Données stock simulées (à câbler V2).
          </p>
          <div className="grid gap-5">
            <StyleCard index="S1" name="Live Ticker Tape" description="Bandeau horizontal premium en tête : ticker + grand prix + delta + sparkline + range jour."><StockPriceBlockA company={company} /></StyleCard>
            <StyleCard index="S2" name="Floating Orb" description="Sphère lumineuse 3D à droite du nom : halo pulsant, gradient radial."><StockPriceBlockB company={company} /></StyleCard>
            <StyleCard index="S3" name="Embedded Stock Card" description="Carte premium 240 px en haut à droite façon Bloomberg épuré."><StockPriceBlockC company={company} /></StyleCard>
            <StyleCard index="S4" name="Gradient Bleed (soft)" description="Rectangle horizontal sans bord, dégradé doux fond app vers ton."><StockPriceBlockD company={company} /></StyleCard>
            <StyleCard index="S5" name="Gradient Bleed (sharp + stacked)" description="Transition plus marquée, prix XL stacké, libellé NASDAQ à gauche."><StockPriceBlockE company={company} /></StyleCard>
            <StyleCard index="S6" name="Gradient Bleed (inline + variation dominante)" description="Rectangle gradient aligné à droite du header. Variation % en grand, prix inline."><StockPriceBlockF company={company} /></StyleCard>
            <StyleCard index="S7" name="Gradient Ultra Smooth" description="Dégradé très étalé (transition depuis 30 %, jamais full tone à droite). Variation % réduite."><StockPriceBlockG company={company} /></StyleCard>
            <StyleCard index="S8" name="Gradient Sharp Cut" description="Reste neutre 50 % puis coupe nette vers le tone à droite. Variation % réduite."><StockPriceBlockH company={company} /></StyleCard>
            <StyleCard index="S9" name="Gradient Tri-tone Brand" description="Passage par accent (couleur de marque) puis tone (vert/rouge). Variation % réduite."><StockPriceBlockI company={company} /></StyleCard>
            <StyleCard index="S10" name="Gradient Diagonal 135°" description="Du coin haut-gauche sombre vers le coin bas-droit tone. Variation % réduite."><StockPriceBlockJ company={company} /></StyleCard>
            <StyleCard index="S11" name="Gradient Ultra Spread (5 stops, jamais full)" description="Démarre la teinte dès 10 %, 5 stops étalés, finit à ~88 % opacité. Variation % 10 px."><StockPriceBlockK company={company} /></StyleCard>
            <StyleCard index="S12" name="Gradient Whisper (très subtil)" description="Teinte ne dépasse jamais ~50 % opacité même à droite. Aspect très calme. Variation % 10 px."><StockPriceBlockL company={company} /></StyleCard>
            <StyleCard index="S13" name="Gradient Continuous Flow (7 stops)" description="7 stops pour transition la plus smooth possible, finit en plein tone. Variation % 10 px."><StockPriceBlockM company={company} /></StyleCard>
            <StyleCard index="S14" name="Gradient Slow Build (tone dès 0 %)" description="Teinte légère dès la gauche, montée régulière en pente, ~77 % à droite. Variation % 10 px."><StockPriceBlockN company={company} /></StyleCard>
          </div>
        </section>

        {/* RÉPARTITION */}
        <section id="sec-rep" className="mt-12 scroll-mt-24">
          <h2 className="mb-2 text-[24px] font-semibold text-zinc-50">
            <span className="font-mono text-zinc-500">02.</span> Répartition (géo + segments) — {repStyles.length} styles
          </h2>
          <p className="mb-5 text-[13px] text-zinc-400">
            Pour 2 KPI spéciaux : géographique + segments produits. Composants déjà placés dans <code className="font-mono text-zinc-300">src/components/charts/</code>.
          </p>
          <div className="space-y-5">
            {repStyles.map((s) => (
              <StyleCard key={s.id} index={s.id} name={s.name} description={s.description}>
                <div className="grid gap-5 lg:grid-cols-2">
                  <div className="rounded-lg border border-[#161616] bg-[#080808] p-4">
                    <div className="mb-3 font-mono text-[10.5px] uppercase tracking-[0.18em] text-zinc-500">Géographie</div>
                    <s.Component data={rep.geo.data} unit={rep.geo.unit} accent={accent} />
                  </div>
                  <div className="rounded-lg border border-[#161616] bg-[#080808] p-4">
                    <div className="mb-3 font-mono text-[10.5px] uppercase tracking-[0.18em] text-zinc-500">Segments produits</div>
                    <s.Component data={rep.segments.data} unit={rep.segments.unit} accent={accent} />
                  </div>
                </div>
              </StyleCard>
            ))}
          </div>
        </section>

        {/* BARS */}
        <section id="sec-bars" className="mt-12 scroll-mt-24">
          <h2 className="mb-5 text-[24px] font-semibold text-zinc-50">
            <span className="font-mono text-zinc-500">03.</span> Bars — {barsStyles.length + barsExtraStyles.length} styles
            <span className="ml-2 text-[13px] font-normal text-violet-300">(B26-B27 = nouveaux essais 3D iso freepik)</span>
          </h2>
          <div className="grid gap-4 lg:grid-cols-2">
            {barsStyles.map((s, i) => (
              <StyleCard key={s.name} index={`B${i + 1}`} name={s.name} description={s.description}>
                <s.Component data={data} labels={YEARS} color={accent} unit={unit} />
              </StyleCard>
            ))}
            {barsExtraStyles.map((s) => (
              <StyleCard key={s.id} index={s.id} name={s.name} description={s.description}>
                <s.Component data={data} labels={YEARS} color={accent} unit={unit} />
              </StyleCard>
            ))}
          </div>
        </section>

        {/* CURVE */}
        <section id="sec-curve" className="mt-12 scroll-mt-24">
          <h2 className="mb-5 text-[24px] font-semibold text-zinc-50">
            <span className="font-mono text-zinc-500">04.</span> Courbe — {curveStyles.length + curveExtraStyles.length} styles
            <span className="ml-2 text-[13px] font-normal text-violet-300">(C14-C15 = nouveaux essais iso freepik)</span>
          </h2>
          <div className="grid gap-4 lg:grid-cols-2">
            {curveStyles.map((s, i) => (
              <StyleCard key={s.name} index={`C${i + 1}`} name={s.name} description={s.description}>
                <s.Component data={data} labels={YEARS} color={accent} unit={unit} />
              </StyleCard>
            ))}
            {curveExtraStyles.map((s) => (
              <StyleCard key={s.id} index={s.id} name={s.name} description={s.description}>
                <s.Component data={data} labels={YEARS} color={accent} unit={unit} />
              </StyleCard>
            ))}
          </div>
        </section>

        {/* VARIATION */}
        <section id="sec-var" className="mt-12 scroll-mt-24">
          <h2 className="mb-5 text-[24px] font-semibold text-zinc-50">
            <span className="font-mono text-zinc-500">05.</span> Variation — {variationStyles.length + variationExtraStyles.length} styles
            <span className="ml-2 text-[13px] font-normal text-violet-300">(V11-V12 = nouveaux essais 3D iso)</span>
          </h2>
          <div className="grid gap-4 lg:grid-cols-2">
            {variationStyles.map((s, i) => (
              <StyleCard key={s.name} index={`V${i + 1}`} name={s.name} description={s.description}>
                <s.Component data={data} labels={YEARS} color={accent} />
              </StyleCard>
            ))}
            {variationExtraStyles.map((s) => (
              <StyleCard key={s.id} index={s.id} name={s.name} description={s.description}>
                <s.Component data={data} labels={YEARS} color={accent} />
              </StyleCard>
            ))}
          </div>
        </section>

        {/* TABLEAU DE BORD */}
        <section id="sec-dash" className="mt-12 scroll-mt-24">
          <h2 className="mb-2 text-[24px] font-semibold text-zinc-50">
            <span className="font-mono text-zinc-500">06.</span> Tableau de bord — 3 layouts
          </h2>
          <p className="mb-5 text-[13px] text-zinc-400">
            Vue panoramique multi-KPI pour le 4e onglet de ChartCycle. À câbler sur <code className="font-mono text-zinc-300">company.kpis</code>.
          </p>
          <div className="space-y-5">
            <StyleCard index="D1" name="Card Grid" description="Grille de mini-cartes KPI (3 colonnes), label + valeur XL + delta YoY + sparkline.">
              <DashboardCardGrid kpis={dashKPIs} accent={accent} />
            </StyleCard>
            <StyleCard index="D2" name="Hero + Secondaries" description="Hero KPI principal en grand, 4 KPIs secondaires en colonne sur la droite.">
              <DashboardHeroSecondaries kpis={dashKPIs} accent={accent} />
            </StyleCard>
            <StyleCard index="D3" name="Ranked List" description="Classement vertical avec barre horizontale par KPI, label + valeur + delta.">
              <DashboardRankedList kpis={dashKPIs} accent={accent} />
            </StyleCard>
          </div>
        </section>

        {/* NAVIGATION DEMO */}
        <section id="sec-nav" className="mt-12 scroll-mt-24">
          <h2 className="mb-2 text-[24px] font-semibold text-zinc-50">
            <span className="font-mono text-zinc-500">07.</span> Navigation — bouton remonter + dock-spy 2 designs
          </h2>
          <p className="mb-5 text-[13px] text-zinc-400">
            Le bouton "remonter" et les 2 dock-spy (N1 gauche, N2 droite) sont actifs sur cette page. Effet Mac Dock.
          </p>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-[#1f1f1f] bg-[#080808] p-4">
              <span className="font-mono text-[11px] uppercase tracking-wider text-zinc-500">Code</span>
              <h3 className="mt-0.5 text-[16px] font-semibold text-zinc-50">N1 · DockSpy gauche</h3>
              <p className="mt-0.5 text-[12px] text-zinc-400">Recommandé. La droite est souvent prise par scrollbar mobile / bouton Sauvegarder.</p>
              <div className="mt-3 rounded-lg border border-dashed border-[#1f1f1f] bg-[#0a0a0a] p-4 text-center text-[12px] text-zinc-500">← regarde sur la gauche</div>
            </div>
            <div className="rounded-2xl border border-[#1f1f1f] bg-[#080808] p-4">
              <span className="font-mono text-[11px] uppercase tracking-wider text-zinc-500">Code</span>
              <h3 className="mt-0.5 text-[16px] font-semibold text-zinc-50">N2 · DockSpy droite</h3>
              <p className="mt-0.5 text-[12px] text-zinc-400">Symétrique. Tooltip s'ouvre vers la gauche.</p>
              <div className="mt-3 rounded-lg border border-dashed border-[#1f1f1f] bg-[#0a0a0a] p-4 text-center text-[12px] text-zinc-500">regarde sur la droite →</div>
            </div>
          </div>
        </section>

        <footer className="mt-16 pb-10 text-center text-[12px] text-zinc-500">
          Codes stables : <span className="font-mono text-zinc-300">S?</span>, <span className="font-mono text-zinc-300">R?</span>, <span className="font-mono text-zinc-300">B?</span>, <span className="font-mono text-zinc-300">C?</span>, <span className="font-mono text-zinc-300">V?</span>, <span className="font-mono text-zinc-300">D?</span>, <span className="font-mono text-zinc-300">N?</span>
        </footer>
      </div>

      {showNavChrome && <NavChrome />}
    </div>
  );
}
