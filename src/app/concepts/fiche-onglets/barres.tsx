"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { ChevronDown, LayoutGrid } from "lucide-react";
import type { Onglet } from "./contenu";

export type BarreProps = { onglets: Onglet[]; actif: string; onChoisir: (id: string) => void; accent: string };

/** Recentre l'onglet actif DANS son conteneur (sans faire defiler la page). */
export function useCentrer(actif: string) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    const cible = el?.querySelector<HTMLElement>('[data-actif="1"]');
    if (!el || !cible) return;
    el.scrollTo({ left: cible.offsetLeft - (el.clientWidth - cible.clientWidth) / 2, behavior: "smooth" });
  }, [actif]);
  return ref;
}

/* 1. Soulignes collants */
export function BarreSouligne({ onglets, actif, onChoisir, accent }: BarreProps) {
  const ref = useCentrer(actif);
  return (
    <div className="sticky top-0 z-30 -mx-4 mt-6 border-b border-white/10 bg-[#050505]/90 px-4 backdrop-blur-md sm:-mx-6 sm:px-6">
      <div className="relative">
        <div ref={ref} role="tablist" className="flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {onglets.map((o) => {
            const on = o.id === actif;
            return (
              <button key={o.id} role="tab" aria-selected={on} data-actif={on ? "1" : "0"} type="button" onClick={() => onChoisir(o.id)}
                className={`relative shrink-0 whitespace-nowrap px-3.5 py-3.5 text-[13.5px] font-medium transition-colors ${on ? "text-zinc-50" : "text-zinc-400 hover:text-zinc-200"}`}>
                {o.label}
                {on && <motion.span layoutId="soul" className="absolute inset-x-2 -bottom-px h-[2px] rounded-full" style={{ background: accent }} />}
              </button>
            );
          })}
        </div>
        <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-[#050505] to-transparent" />
      </div>
    </div>
  );
}

/* 2. Pilules segmentees */
export function BarrePilules({ onglets, actif, onChoisir, accent }: BarreProps) {
  const ref = useCentrer(actif);
  return (
    <div className="mt-6">
      <div ref={ref} role="tablist" className="flex max-w-full gap-1 overflow-x-auto rounded-full border border-white/10 bg-white/[0.03] p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:w-fit">
        {onglets.map((o) => {
          const on = o.id === actif;
          return (
            <button key={o.id} role="tab" aria-selected={on} data-actif={on ? "1" : "0"} type="button" onClick={() => onChoisir(o.id)}
              className={`relative shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-[13px] font-medium transition-colors ${on ? "text-white" : "text-zinc-400 hover:text-zinc-100"}`}>
              {on && <motion.span layoutId="pil" transition={{ type: "spring", stiffness: 420, damping: 34 }} className="absolute inset-0 rounded-full" style={{ background: `${accent}38`, boxShadow: `inset 0 0 0 1px ${accent}77` }} />}
              <span className="relative">{o.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* 3. Verticaux (colonne) : sur mobile, un bouton qui deroule la liste */
export function ColonneVerticale({ onglets, actif, onChoisir, accent }: BarreProps) {
  const [ouvert, setOuvert] = useState(false);
  const cur = onglets.find((o) => o.id === actif);
  return (
    <>
      <div className="md:hidden">
        <button type="button" onClick={() => setOuvert((o) => !o)} className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-[14px] font-medium text-zinc-100">
          <span className="flex items-center gap-2">{cur && <cur.Icon className="size-4" style={{ color: accent }} />}Section : {cur?.label}</span>
          <ChevronDown className={`size-4 transition-transform ${ouvert ? "rotate-180" : ""}`} />
        </button>
        {ouvert && (
          <div className="mt-2 overflow-hidden rounded-xl border border-white/10 bg-[#0a0a0a]">
            {onglets.map((o) => (
              <button key={o.id} type="button" onClick={() => { onChoisir(o.id); setOuvert(false); }}
                className={`flex w-full items-center gap-2.5 px-4 py-3 text-left text-[14px] ${o.id === actif ? "bg-white/[0.07] text-white" : "text-zinc-400"}`}>
                <o.Icon className="size-4" />{o.label}
              </button>
            ))}
          </div>
        )}
      </div>
      <nav role="tablist" aria-orientation="vertical" className="sticky top-4 hidden flex-col gap-0.5 self-start md:flex">
        {onglets.map((o) => {
          const on = o.id === actif;
          return (
            <button key={o.id} role="tab" aria-selected={on} type="button" onClick={() => onChoisir(o.id)}
              className={`relative flex items-center gap-2.5 rounded-lg py-2.5 pl-4 pr-3 text-left text-[13.5px] transition-colors ${on ? "bg-white/[0.06] font-semibold text-zinc-50" : "text-zinc-400 hover:bg-white/[0.03] hover:text-zinc-100"}`}>
              {on && <motion.span layoutId="vert" className="absolute inset-y-1.5 left-0 w-[3px] rounded-full" style={{ background: accent }} />}
              <o.Icon className="size-4 shrink-0" style={on ? { color: accent } : undefined} />
              {o.label}
            </button>
          );
        })}
      </nav>
    </>
  );
}

/* 4. Icones et compteurs */
export function BarreIcones({ onglets, actif, onChoisir, accent }: BarreProps) {
  const ref = useCentrer(actif);
  return (
    <div ref={ref} role="tablist" className="mt-6 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {onglets.map((o) => {
        const on = o.id === actif;
        return (
          <button key={o.id} role="tab" aria-selected={on} data-actif={on ? "1" : "0"} type="button" onClick={() => onChoisir(o.id)}
            className={`relative flex min-w-[92px] flex-1 shrink-0 flex-col items-center gap-1.5 rounded-xl border px-3 py-3 transition-colors ${on ? "border-white/25 bg-white/[0.07]" : "border-white/[0.07] bg-white/[0.02] hover:border-white/15"}`}
            style={on ? { boxShadow: `inset 0 -2px 0 ${accent}` } : undefined}>
            <o.Icon className="size-5" style={{ color: on ? accent : "#a1a1aa" }} />
            <span className={`text-center text-[12px] font-medium leading-tight ${on ? "text-zinc-50" : "text-zinc-400"}`}>{o.label}</span>
            {o.compteur !== null && (
              <span className="absolute right-1.5 top-1.5 min-w-[20px] rounded-full px-1.5 py-px text-center font-mono text-[10.5px] font-semibold tabular-nums" style={{ background: on ? accent : "#27272a", color: on ? "#050505" : "#d4d4d8" }}>{o.compteur}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* 5. Barre d'application, fixee en bas */
export function BarreApplication({ onglets, actif, onChoisir, accent }: BarreProps) {
  const ref = useCentrer(actif);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-0 pb-[env(safe-area-inset-bottom)] sm:px-4 sm:pb-4">
      <div ref={ref} role="tablist" className="pointer-events-auto flex w-full max-w-full gap-1 overflow-x-auto border-t border-white/10 bg-[#0a0a0c]/95 px-2 py-1.5 backdrop-blur-xl [scrollbar-width:none] sm:w-auto sm:max-w-3xl sm:rounded-2xl sm:border sm:shadow-[0_12px_40px_rgba(0,0,0,0.6)] [&::-webkit-scrollbar]:hidden">
        {onglets.map((o) => {
          const on = o.id === actif;
          return (
            <button key={o.id} role="tab" aria-selected={on} data-actif={on ? "1" : "0"} type="button" onClick={() => onChoisir(o.id)}
              className={`flex w-[76px] shrink-0 flex-col items-center gap-1 rounded-xl px-1 py-1.5 transition-colors ${on ? "bg-white/[0.08]" : "hover:bg-white/[0.04]"}`}>
              <o.Icon className="size-[22px]" style={{ color: on ? accent : "#71717a" }} />
              <span className={`w-full truncate text-center text-[10.5px] leading-tight ${on ? "font-semibold text-zinc-50" : "text-zinc-500"}`}>{o.label.split(" ")[0] === "Vue" ? "Vue" : o.label.replace(/ et .*/, "")}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* 6. Cartes-onglets en grille, repliables */
export function GrilleCartes({ onglets, actif, onChoisir, accent }: BarreProps) {
  const [ouverte, setOuverte] = useState(true);
  const cur = onglets.find((o) => o.id === actif);
  const ref = useCentrer(actif);
  const choisir = (id: string) => { onChoisir(id); setOuverte(false); };
  if (!ouverte) {
    return (
      <div className="mt-6 flex items-center gap-2">
        <button type="button" onClick={() => setOuverte(true)} className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.05] px-3.5 py-2 text-[12.5px] font-medium text-zinc-200 hover:bg-white/[0.09]">
          <LayoutGrid className="size-3.5" />Toutes les parties
        </button>
        <div ref={ref} className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {onglets.map((o) => {
            const on = o.id === actif;
            return (
              <button key={o.id} type="button" data-actif={on ? "1" : "0"} onClick={() => choisir(o.id)}
                className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-2 text-[12.5px] ${on ? "border-white/30 bg-white/[0.09] text-zinc-50" : "border-white/[0.07] text-zinc-500 hover:text-zinc-200"}`}>
                <o.Icon className="size-3.5" style={on ? { color: accent } : undefined} />{o.label}
              </button>
            );
          })}
        </div>
      </div>
    );
  }
  return (
    <div role="tablist" className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
      {onglets.map((o) => {
        const on = o.id === actif;
        return (
          <button key={o.id} role="tab" aria-selected={on} type="button" onClick={() => choisir(o.id)}
            className={`group rounded-2xl border p-4 text-left transition-all hover:-translate-y-0.5 ${on ? "border-white/30 bg-white/[0.07]" : "border-white/[0.07] bg-white/[0.02] hover:border-white/20"}`}
            style={on ? { boxShadow: `inset 0 0 40px ${accent}1f` } : undefined}>
            <div className="flex items-center justify-between">
              <o.Icon className="size-5" style={{ color: accent }} />
              {o.compteur !== null && <span className="font-mono text-[12px] tabular-nums text-zinc-400">{o.compteur}</span>}
            </div>
            <div className="mt-3 text-[14px] font-semibold leading-tight text-zinc-100">{o.label}</div>
            <div className="mt-1 text-[11.5px] leading-snug text-zinc-500">{o.apercu}</div>
          </button>
        );
      })}
      {cur && <span className="sr-only">Partie actuelle : {cur.label}</span>}
    </div>
  );
}
