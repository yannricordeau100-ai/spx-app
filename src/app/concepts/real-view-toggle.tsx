"use client";

import { useState } from "react";
import { Sun, Moon } from "lucide-react";
import { CompanyView } from "@/components/company-view";
import type { Company } from "@/lib/data";

/**
 * Embed le VRAI <CompanyView /> de l'app (design réel, pas un mirror).
 *
 * SÉPARATION D'ARCHITECTURE : `<PreviewShell>` intercepte tous les clics
 * sur les liens et les form submits, pour empêcher la navigation hors de
 * /concepts. La page concepts reste un environnement isolé : ne contamine
 * pas la vraie app, n'est pas contaminée par sa navigation.
 *
 * Pour changer de société dans Concepts : utiliser le bouton "Rechercher"
 * dans le header de /concepts (pas les liens internes du CompanyView).
 *
 * Toggle Sun/Moon : CSS filter `invert(1) hue-rotate(180deg)` pour basculer
 * en mode clair sans toucher au DOM. Garantie de superposition pixel-perfect.
 *
 *   - invert(1)         flippe noir <-> blanc et toutes les nuances entre
 *   - hue-rotate(180)   compense le shift d'hue introduit par invert
 *                       (les couleurs de marque restent reconnaissables)
 *
 * Limite connue : logos SVG colorés (Google G, etc.) subissent aussi le
 * filter et leurs couleurs sont décalées. À raffiner via re-inversion
 * ciblée si l'un de ces 3 designs est retenu pour l'app.
 */

/**
 * PreviewShell — capture-phase click handler qui bloque toute navigation
 * (anchors et boutons type="submit") sortant du contexte concepts.
 * Les anchors internes (#section) sont autorisés pour le scroll-to.
 */
function PreviewShell({ children }: { children: React.ReactNode }) {
  const blockNav = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const link = target.closest("a");
    if (link) {
      const href = link.getAttribute("href");
      if (href && !href.startsWith("#")) {
        e.preventDefault();
        e.stopPropagation();
      }
    }
  };
  return (
    <div onClickCapture={blockNav} onSubmitCapture={(e) => e.preventDefault()}>
      {children}
    </div>
  );
}
export function RealViewWithToggle({
  company,
  lightFilter,
  description,
}: {
  company: Company;
  /** CSS filter appliqué quand mode = "light". */
  lightFilter: string;
  /** Libellé montré à côté du toggle pour identifier la variante. */
  description: string;
}) {
  const [mode, setMode] = useState<"light" | "dark">("dark");

  return (
    <div className="relative">
      {/* Toggle flottant — au-dessus du CompanyView pour ne pas être affecté par le filter */}
      <div className="sticky top-[60px] z-40 mx-auto mb-[-56px] flex max-w-6xl items-center justify-end gap-2 px-4 pt-3 sm:px-6">
        <span className="rounded-full border border-white/10 bg-[#0a0a0a]/85 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-zinc-300 backdrop-blur-md">
          {description}
        </span>
        <div className="inline-flex gap-0.5 rounded-lg border border-white/10 bg-[#0a0a0a]/85 p-0.5 backdrop-blur-md">
          <button
            onClick={() => setMode("light")}
            aria-label="Mode clair"
            className={`inline-flex items-center justify-center rounded-md px-2 py-1 transition-colors ${
              mode === "light" ? "bg-violet-500 text-white shadow-[0_0_12px_rgba(167,139,250,0.5)]" : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Sun className="size-4" />
          </button>
          <button
            onClick={() => setMode("dark")}
            aria-label="Mode sombre"
            className={`inline-flex items-center justify-center rounded-md px-2 py-1 transition-colors ${
              mode === "dark" ? "bg-violet-500 text-white shadow-[0_0_12px_rgba(167,139,250,0.5)]" : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Moon className="size-4" />
          </button>
        </div>
      </div>

      {/* Le vrai CompanyView, isolé via PreviewShell + filter conditionnel */}
      <div
        style={mode === "light" ? { filter: lightFilter } : undefined}
        className="origin-top transition-[filter] duration-300"
      >
        <PreviewShell>
          <CompanyView company={company} />
        </PreviewShell>
      </div>
    </div>
  );
}
