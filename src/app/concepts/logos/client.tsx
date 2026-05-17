"use client";

import { useState } from "react";
import Link from "next/link";
import {
  PulseSignalHorizontal,
  PulseSignalSquare,
  OrbitalMHorizontal,
  OrbitalMSquare,
  PrismHorizontal,
  PrismSquare,
  CubeStackHorizontal,
  CubeStackSquare,
  BicolorDropHorizontal,
  BicolorDropSquare,
  BarCompassHorizontal,
  BarCompassSquare,
  MonolithHorizontal,
  MonolithSquare,
  WordmarkV2Horizontal,
  WordmarkV2Square,
} from "./logo-protos";

/**
 * /concepts/logos — exploration logos alternatifs pour remplacer / affiner
 * le wordmark actuel "Mettrik AI" italique iridescent.
 *
 * 8 protos (7 directions + 1 raffinement) avec 2 versions chacun :
 *  - Horizontal : header app, wordmark + glyph, ratio ~5:1
 *  - Carré 1:1  : avatar X / LinkedIn, favicon, app icon iOS
 *
 * Chaque proto en swatch dark + light, sans saturer la page.
 */

type Proto = {
  id: string;
  name: string;
  tagline: string;
  rationale: string;
  Horizontal: React.ComponentType<{ theme: "dark" | "light" }>;
  Square: React.ComponentType<{ theme: "dark" | "light" }>;
};

const PROTOS: Proto[] = [
  {
    id: "pulse-signal",
    name: "Pulse Signal",
    tagline: "Wordmark + onde data",
    rationale:
      "Une onde fine en gradient passe sous le mot, suggère mesure et signal data sans tomber dans le cliché flèche fintech. Sobriété style Linear.",
    Horizontal: PulseSignalHorizontal,
    Square: PulseSignalSquare,
  },
  {
    id: "orbital-m",
    name: "Orbital M",
    tagline: "M géométrique + orbite",
    rationale:
      "Le M custom est ancré dans une orbite fine. Évoque mesure (cercle = unité) et intelligence (mouvement). Lisible en 16×16 favicon.",
    Horizontal: OrbitalMHorizontal,
    Square: OrbitalMSquare,
  },
  {
    id: "prism",
    name: "Iridescent Prism",
    tagline: "Cristal qui décompose la lumière",
    rationale:
      "Métaphore directe de Mettrik : KPI brut entre, signal clair sort. Conserve la palette holographique violet → cyan → magenta de la marque.",
    Horizontal: PrismHorizontal,
    Square: PrismSquare,
  },
  {
    id: "cube-stack",
    name: "Cube Stack",
    tagline: "Trois cubes isométriques",
    rationale:
      "Stacking évoque hiérarchie de données (KPI, ratios, contexte). Format carré naturel. Risque : un peu corporate, à équilibrer avec gradient iridescent.",
    Horizontal: CubeStackHorizontal,
    Square: CubeStackSquare,
  },
  {
    id: "bicolor-drop",
    name: "Bicolor Drop",
    tagline: "Goutte mi-violet mi-cyan",
    rationale:
      "Alliage data + IA en une forme. Très lisible en mini (favicon, app icon). Palette signature respectée, glyph autonome sans wordmark.",
    Horizontal: BicolorDropHorizontal,
    Square: BicolorDropSquare,
  },
  {
    id: "bar-compass",
    name: "Bar Compass",
    tagline: "Quatre barres en sparkline",
    rationale:
      "Sparkline 4 barres avec un cap iridescent au sommet. Évoque mesure + direction sans tomber dans graph + flèche. Glyph autonome pour favicon.",
    Horizontal: BarCompassHorizontal,
    Square: BarCompassSquare,
  },
  {
    id: "monolith",
    name: "Monolith M",
    tagline: "M épuré, geometric minimalism",
    rationale:
      "Approche Linear / Vercel : un M custom dessiné, sans gradient, juste un détail iridescent en accent. Identité forte, très scalable, premium.",
    Horizontal: MonolithHorizontal,
    Square: MonolithSquare,
  },
  {
    id: "wordmark-v2",
    name: "Wordmark V2",
    tagline: "Raffinement non-rupture",
    rationale:
      "Garde l'ADN du wordmark actuel mais avec dot iridescent retravaillé (anneau orbital) + tracking resserré. Voie sûre, alternative non-rupture.",
    Horizontal: WordmarkV2Horizontal,
    Square: WordmarkV2Square,
  },
];

export default function LogosClient() {
  const [activeTheme, setActiveTheme] = useState<"both" | "dark" | "light">(
    "both",
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-white/5 bg-zinc-950/90 backdrop-blur">
        <div className="mx-auto max-w-6xl px-6 py-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-[11px] uppercase tracking-[0.3em] text-zinc-500">
                Concepts · CONV-CONCEPTS
              </div>
              <h1 className="mt-1 font-display text-3xl font-semibold text-zinc-50">
                Logos · explorations
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
                8 protos pour remplacer ou affiner le wordmark actuel. Chaque
                proto en deux versions : horizontal (header app) et carré 1:1
                (avatar / favicon / app icon).
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/concepts"
                className="rounded-full border border-white/10 px-4 py-2 text-xs text-zinc-300 transition hover:border-white/20 hover:text-zinc-50"
              >
                ← Concepts
              </Link>
            </div>
          </div>

          <div className="mt-5 inline-flex rounded-full border border-white/10 bg-white/[0.02] p-1">
            {(["both", "dark", "light"] as const).map((theme) => (
              <button
                key={theme}
                onClick={() => setActiveTheme(theme)}
                className={`rounded-full px-4 py-1.5 text-xs font-medium transition ${
                  activeTheme === theme
                    ? "bg-white/10 text-zinc-50"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {theme === "both"
                  ? "Dark + Light"
                  : theme === "dark"
                  ? "Dark seul"
                  : "Light seul"}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="space-y-12">
          {PROTOS.map((proto, idx) => (
            <ProtoRow
              key={proto.id}
              proto={proto}
              index={idx + 1}
              activeTheme={activeTheme}
            />
          ))}
        </div>

        <footer className="mt-16 border-t border-white/5 pt-8 text-xs text-zinc-500">
          <p>
            Page exploratoire, aucune modification aux logos actuels en prod
            (<code className="text-zinc-400">mettrik-wordmark.tsx</code>,{" "}
            <code className="text-zinc-400">BrandWordmark</code>). À valider /
            écarter avant toute mise en œuvre.
          </p>
        </footer>
      </main>
    </div>
  );
}

function ProtoRow({
  proto,
  index,
  activeTheme,
}: {
  proto: Proto;
  index: number;
  activeTheme: "both" | "dark" | "light";
}) {
  const showDark = activeTheme === "both" || activeTheme === "dark";
  const showLight = activeTheme === "both" || activeTheme === "light";

  return (
    <section className="rounded-2xl border border-white/5 bg-white/[0.015] p-6">
      <div className="mb-5 flex items-start justify-between gap-6">
        <div>
          <div className="flex items-baseline gap-3">
            <span className="font-mono text-[11px] text-zinc-500">
              {String(index).padStart(2, "0")}
            </span>
            <h2 className="font-display text-xl font-semibold text-zinc-50">
              {proto.name}
            </h2>
            <span className="text-xs text-zinc-500">· {proto.tagline}</span>
          </div>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-400">
            {proto.rationale}
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Horizontal */}
        <div className="space-y-3">
          <div className="text-[10px] uppercase tracking-[0.25em] text-zinc-500">
            Horizontal · header / wordmark
          </div>
          {showDark && (
            <Swatch theme="dark">
              <proto.Horizontal theme="dark" />
            </Swatch>
          )}
          {showLight && (
            <Swatch theme="light">
              <proto.Horizontal theme="light" />
            </Swatch>
          )}
        </div>

        {/* Carré */}
        <div className="space-y-3">
          <div className="text-[10px] uppercase tracking-[0.25em] text-zinc-500">
            Carré 1:1 · avatar / favicon / app icon
          </div>
          <div className="grid grid-cols-2 gap-3">
            {showDark && (
              <SwatchSquare theme="dark">
                <proto.Square theme="dark" />
              </SwatchSquare>
            )}
            {showLight && (
              <SwatchSquare theme="light">
                <proto.Square theme="light" />
              </SwatchSquare>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function Swatch({
  theme,
  children,
}: {
  theme: "dark" | "light";
  children: React.ReactNode;
}) {
  return (
    <div
      className={`flex h-32 items-center justify-center rounded-xl border px-8 ${
        theme === "dark"
          ? "border-white/10 bg-zinc-950"
          : "border-zinc-200 bg-zinc-50"
      }`}
    >
      {children}
    </div>
  );
}

function SwatchSquare({
  theme,
  children,
}: {
  theme: "dark" | "light";
  children: React.ReactNode;
}) {
  return (
    <div
      className={`flex aspect-square items-center justify-center rounded-xl border p-4 ${
        theme === "dark"
          ? "border-white/10 bg-zinc-950"
          : "border-zinc-200 bg-zinc-50"
      }`}
    >
      <div className="aspect-square w-full max-w-[140px]">{children}</div>
    </div>
  );
}
