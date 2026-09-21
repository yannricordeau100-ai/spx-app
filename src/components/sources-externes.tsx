"use client";

/**
 * Yann 15 sept 2026 : dépliant « Sources utilisées » sur chaque fiche.
 * Liste les sources AUTRES que les documents publiés par la société (logos,
 * transcriptions, avantage concurrentiel, recherches sur sources publiques).
 * Le détail est réservé aux plans payants : en gratuit et en anonyme, la
 * liste est floutée et inerte, seul le titre reste lisible.
 */
import { useEffect, useRef, useState } from "react";
import { ChevronRight, Lock } from "lucide-react";
import SOURCES from "@/data/sources-externes.json";

export function SourcesExternes({ ticker, paid }: { ticker: string; paid: boolean }) {
  // Yann 16 sept 2026 : Motley Fool et Wikipédia ne sont pas comptés comme sources.
  // Yann 21 sept 2026 : MarketBeat puis StockAnalysis retirés de la liste affichée.
  const ECARTEES = /motley fool|wikip|marketbeat|stockanalysis/i;
  const liste = (((SOURCES as { par_ticker: Record<string, string[]> }).par_ticker ?? {})[ticker.toUpperCase()] ?? []).filter((x) => !ECARTEES.test(x));
  const [ouvert, setOuvert] = useState(false);
  const boite = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!ouvert) return;
    const dehors = (e: MouseEvent) => {
      if (boite.current && !boite.current.contains(e.target as Node)) setOuvert(false);
    };
    document.addEventListener("mousedown", dehors);
    return () => document.removeEventListener("mousedown", dehors);
  }, [ouvert]);

  if (liste.length === 0) return null;

  return (
    <div ref={boite} data-blur="sources" className="mt-3 rounded-2xl border border-white/[0.08] bg-white/[0.015]">
      <button
        type="button"
        onClick={() => setOuvert((v) => !v)}
        className="flex w-full items-center gap-2.5 px-4 py-3 text-left hover:bg-white/[0.03]"
      >
        <ChevronRight className={`size-4 shrink-0 text-zinc-500 transition-transform ${ouvert ? "rotate-90" : ""}`} />
        <span className="text-[13.5px] font-semibold text-zinc-200">Sources utilisées</span>
        <span className="ml-auto inline-flex items-center gap-1.5 font-mono text-[11px] text-zinc-500">
          {!paid && <Lock className="size-3" />}
          {liste.length} source{liste.length > 1 ? "s" : ""}
        </span>
      </button>
      {ouvert && (
        <div className="relative border-t border-white/[0.05] px-4 py-3">
          <ul className={`grid gap-1 text-[12.5px] text-zinc-300 sm:grid-cols-2 ${paid ? "" : "pointer-events-none select-none blur-[6px]"}`} aria-hidden={!paid}>
            {liste.map((s) => (
              <li key={s} className="flex items-baseline gap-2">
                <span className="mt-[3px] size-1.5 shrink-0 rounded-full bg-violet-400/70" />
                {s}
              </li>
            ))}
          </ul>
          {!paid && (
            <div className="absolute inset-0 z-10 flex items-center justify-center px-4">
              <span className="rounded-full border border-violet-400/40 bg-[#0a0a0e]/90 px-4 py-2 text-[12.5px] font-semibold text-violet-100">
                Le détail des sources est inclus dès le plan Premium.
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
