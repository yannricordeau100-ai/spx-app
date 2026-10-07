"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { Menu, X } from "lucide-react";
import type { BarreProps } from "./barres";
import { useCentrer } from "./barres";
import type { Onglet } from "./contenu";
import { RAIL_PX } from "./liste";

/** Noms courts pour les rails etroits. */
const COURT: Record<string, string> = {
  apercu: "Aperçu", kpi: "KPI", stories: "Stories", moyen: "Moyen terme", marche: "Marché", risques: "Risques",
  gouv: "Gouv.", ia: "IA", resultats: "Résultats", these: "Thèse", sources: "Sources", admin: "Admin",
};
const court = (o: Onglet) => COURT[o.id] ?? o.label;

/** Familles du rail a groupes. */
const GROUPES: { titre: string; ids: string[] }[] = [
  { titre: "Analyse", ids: ["apercu", "these", "risques", "ia"] },
  { titre: "Données", ids: ["kpi", "stories", "moyen", "resultats", "sources"] },
  { titre: "Société", ids: ["marche", "gouv"] },
];

function useDefilement() {
  const [pct, setPct] = useState(0);
  useEffect(() => {
    const f = () => {
      const h = document.documentElement.scrollHeight - window.innerHeight;
      setPct(h > 0 ? Math.min(1, Math.max(0, window.scrollY / h)) : 0);
    };
    f();
    window.addEventListener("scroll", f, { passive: true });
    window.addEventListener("resize", f);
    return () => { window.removeEventListener("scroll", f); window.removeEventListener("resize", f); };
  }, []);
  return pct;
}

/** Info-bulle positionnee en fixe : le rail peut defiler sans la couper. */
function useInfobulle(largeur: number) {
  const [t, setT] = useState<{ label: string; y: number } | null>(null);
  const lier = (label: string) => ({
    onMouseEnter: (e: React.MouseEvent<HTMLElement>) => { const r = e.currentTarget.getBoundingClientRect(); setT({ label, y: r.top + r.height / 2 }); },
    onFocus: (e: React.FocusEvent<HTMLElement>) => { const r = e.currentTarget.getBoundingClientRect(); setT({ label, y: r.top + r.height / 2 }); },
    onMouseLeave: () => setT(null),
    onBlur: () => setT(null),
  });
  const rendu = t && (
    <div className="pointer-events-none fixed z-[60] hidden -translate-y-1/2 whitespace-nowrap rounded-md border border-white/15 bg-[#111114] px-2.5 py-1.5 text-[12px] font-medium text-zinc-100 shadow-xl md:block" style={{ left: largeur + 8, top: t.y }}>
      {t.label}
    </div>
  );
  return { lier, rendu };
}

type ModeBas = "icones" | "courts" | "actif-nom" | "progression";

/** Barre basse pour mobile (masquee des md). */
function BarreBasse({ onglets, actif, onChoisir, accent, mode, vus }: BarreProps & { mode: ModeBas; vus?: Set<string> }) {
  const ref = useCentrer(actif);
  const pct = useDefilement();
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#0a0a0c]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
      {mode === "progression" && <div className="absolute inset-x-0 top-0 h-[2px] bg-white/[0.06]"><div className="h-full" style={{ width: `${pct * 100}%`, background: accent }} /></div>}
      <div ref={ref} role="tablist" className="flex gap-1 overflow-x-auto px-2 py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {onglets.map((o) => {
          const on = o.id === actif;
          return (
            <button key={o.id} role="tab" aria-selected={on} aria-label={o.label} data-actif={on ? "1" : "0"} type="button" onClick={() => onChoisir(o.id)}
              className={`relative flex shrink-0 items-center rounded-xl transition-colors ${mode === "actif-nom" ? "gap-1.5 px-3 py-2.5" : mode === "icones" ? "px-3.5 py-2.5" : "w-[68px] flex-col gap-1 px-1 py-1.5"} ${on ? "bg-white/[0.09]" : "hover:bg-white/[0.04]"}`}>
              <o.Icon className="size-[22px]" style={{ color: on ? accent : "#71717a" }} />
              {mode === "actif-nom" && on && <span className="text-[12.5px] font-semibold text-zinc-50">{court(o)}</span>}
              {(mode === "courts" || mode === "progression") && <span className={`w-full truncate text-center text-[10.5px] leading-tight ${on ? "font-semibold text-zinc-50" : "text-zinc-500"}`}>{court(o)}</span>}
              {mode === "progression" && o.compteur !== null && (
                <span className="absolute right-0.5 top-0.5 min-w-[17px] rounded-full px-1 text-center font-mono text-[9.5px] font-semibold tabular-nums" style={{ background: on ? accent : "#27272a", color: on ? "#050505" : "#d4d4d8" }}>{o.compteur}</span>
              )}
              {mode === "progression" && !on && vus?.has(o.id) && <span className="absolute left-1.5 top-1.5 size-1.5 rounded-full bg-emerald-400/80" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const CADRE = "fixed left-0 top-0 z-40 hidden h-screen flex-col border-r border-white/10 bg-[#08080a] md:flex";
const FIL = "overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

/* 1. Rail d'icones seules + info-bulle */
export function RailIcones(p: BarreProps) {
  const L = RAIL_PX["rail-icones"] as number;
  const ib = useInfobulle(L);
  return (
    <>
      <nav role="tablist" aria-orientation="vertical" className={`${CADRE} ${FIL} items-center gap-1 py-3`} style={{ width: L }}>
        {p.onglets.map((o) => {
          const on = o.id === p.actif;
          return (
            <button key={o.id} role="tab" aria-selected={on} aria-label={o.label} type="button" onClick={() => p.onChoisir(o.id)} {...ib.lier(o.label)}
              className={`relative flex size-10 shrink-0 items-center justify-center rounded-xl transition-colors ${on ? "bg-white/[0.08]" : "hover:bg-white/[0.05]"}`}>
              {on && <motion.span layoutId="ri" className="absolute -left-[8px] inset-y-2 w-[3px] rounded-r-full" style={{ background: p.accent }} />}
              <o.Icon className="size-[20px]" style={{ color: on ? p.accent : "#8b8b94" }} />
            </button>
          );
        })}
      </nav>
      {ib.rendu}
      <BarreBasse {...p} mode="icones" />
    </>
  );
}

/* 2. Rail qui s'elargit au survol (superpose, ne decale pas le contenu) */
export function RailSurvol(p: BarreProps) {
  const L = RAIL_PX["rail-survol"] as number;
  const [ouvert, setOuvert] = useState(false);
  return (
    <>
      <div className="fixed left-0 top-0 z-40 hidden h-screen md:block" style={{ width: L }}>
        <nav role="tablist" aria-orientation="vertical" onMouseEnter={() => setOuvert(true)} onMouseLeave={() => setOuvert(false)} onFocus={() => setOuvert(true)} onBlur={() => setOuvert(false)}
          className={`absolute inset-y-0 left-0 flex flex-col gap-1 overflow-x-hidden border-r border-white/10 bg-[#08080a] py-3 transition-[width,box-shadow] duration-200 ${FIL} ${ouvert ? "shadow-[12px_0_40px_rgba(0,0,0,0.55)]" : ""}`}
          style={{ width: ouvert ? 232 : L }}>
          {p.onglets.map((o) => {
            const on = o.id === p.actif;
            return (
              <button key={o.id} role="tab" aria-selected={on} aria-label={o.label} type="button" onClick={() => p.onChoisir(o.id)}
                className={`relative mx-2 flex h-10 shrink-0 items-center gap-3 rounded-xl pl-[10px] pr-3 text-left transition-colors ${on ? "bg-white/[0.08]" : "hover:bg-white/[0.05]"}`}>
                {on && <motion.span layoutId="rs" className="absolute -left-2 inset-y-2 w-[3px] rounded-r-full" style={{ background: p.accent }} />}
                <o.Icon className="size-[20px] shrink-0" style={{ color: on ? p.accent : "#8b8b94" }} />
                <span className={`min-w-0 flex-1 truncate whitespace-nowrap text-[13.5px] transition-opacity duration-150 ${ouvert ? "opacity-100" : "opacity-0"} ${on ? "font-semibold text-zinc-50" : "text-zinc-400"}`}>{o.label}</span>
                {o.compteur !== null && <span className={`shrink-0 font-mono text-[11px] tabular-nums text-zinc-500 transition-opacity ${ouvert ? "opacity-100" : "opacity-0"}`}>{o.compteur}</span>}
              </button>
            );
          })}
        </nav>
      </div>
      <BarreBasse {...p} mode="actif-nom" />
    </>
  );
}

/* 3. Rail icone + nom court */
export function RailLegende(p: BarreProps) {
  const L = RAIL_PX["rail-legende"] as number;
  return (
    <>
      <nav role="tablist" aria-orientation="vertical" className={`${CADRE} ${FIL} items-center gap-0.5 py-2`} style={{ width: L }}>
        {p.onglets.map((o) => {
          const on = o.id === p.actif;
          return (
            <button key={o.id} role="tab" aria-selected={on} aria-label={o.label} title={o.label} type="button" onClick={() => p.onChoisir(o.id)}
              className={`relative flex w-[64px] shrink-0 flex-col items-center gap-1 rounded-xl px-1 py-2 transition-colors ${on ? "bg-white/[0.08]" : "hover:bg-white/[0.05]"}`}>
              {on && <motion.span layoutId="rl" className="absolute -left-[6px] inset-y-2.5 w-[3px] rounded-r-full" style={{ background: p.accent }} />}
              <o.Icon className="size-[21px]" style={{ color: on ? p.accent : "#8b8b94" }} />
              <span className={`w-full truncate text-center text-[10.5px] leading-tight ${on ? "font-semibold text-zinc-50" : "text-zinc-500"}`}>{court(o)}</span>
              {o.compteur !== null && <span className="absolute right-0.5 top-0.5 min-w-[17px] rounded-full bg-zinc-800 px-1 text-center font-mono text-[9.5px] tabular-nums text-zinc-300">{o.compteur}</span>}
            </button>
          );
        })}
      </nav>
      <BarreBasse {...p} mode="courts" />
    </>
  );
}

/* 4. Rail a groupes */
export function RailGroupes(p: BarreProps) {
  const L = RAIL_PX["rail-groupes"] as number;
  const ib = useInfobulle(L);
  const [tiroir, setTiroir] = useState(false);
  const par = (ids: string[]) => ids.map((id) => p.onglets.find((o) => o.id === id)).filter((o): o is Onglet => Boolean(o));
  const connus = new Set(GROUPES.flatMap((g) => g.ids));
  const outils = p.onglets.filter((o) => !connus.has(o.id));
  const groupes = GROUPES.map((g) => ({ titre: g.titre, liste: par(g.ids) })).filter((g) => g.liste.length > 0);
  if (outils.length > 0) groupes.push({ titre: "Outils", liste: outils });
  const bouton = (o: Onglet, layout: string) => {
    const on = o.id === p.actif;
    return (
      <button key={o.id} role="tab" aria-selected={on} aria-label={o.label} type="button" onClick={() => p.onChoisir(o.id)} {...ib.lier(o.label)}
        className={`relative flex size-10 shrink-0 items-center justify-center rounded-xl transition-colors ${on ? "bg-white/[0.08]" : "hover:bg-white/[0.05]"}`}>
        {on && <motion.span layoutId={layout} className="absolute -left-[12px] inset-y-2 w-[3px] rounded-r-full" style={{ background: p.accent }} />}
        <o.Icon className="size-[20px]" style={{ color: on ? p.accent : "#8b8b94" }} />
      </button>
    );
  };
  return (
    <>
      <nav role="tablist" aria-orientation="vertical" className={`${CADRE} ${FIL} items-center py-2`} style={{ width: L }}>
        {groupes.map((g, i) => (
          <div key={g.titre} className={`flex w-full flex-col items-center gap-1 ${g.titre === "Outils" ? "mt-auto" : ""} ${i > 0 ? "mt-1.5 border-t border-white/10 pt-2" : ""}`}>
            <div className="text-[8.5px] font-semibold uppercase tracking-[0.12em] text-zinc-600">{g.titre}</div>
            {g.liste.map((o) => bouton(o, "rg"))}
          </div>
        ))}
      </nav>
      {ib.rendu}
      <button type="button" onClick={() => setTiroir(true)} aria-label="Ouvrir les parties de la fiche"
        className="fixed bottom-4 right-4 z-40 flex size-12 items-center justify-center rounded-full border border-white/15 bg-[#0e0e12]/95 shadow-xl backdrop-blur md:hidden" style={{ color: p.accent }}>
        <Menu className="size-5" />
      </button>
      {tiroir && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button type="button" aria-label="Fermer" className="absolute inset-0 bg-black/60" onClick={() => setTiroir(false)} />
          <div className="absolute inset-x-0 bottom-0 max-h-[75vh] overflow-y-auto rounded-t-2xl border-t border-white/15 bg-[#0b0b0e] p-4 pb-8">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[13px] font-semibold text-zinc-200">Parties de la fiche</span>
              <button type="button" aria-label="Fermer" onClick={() => setTiroir(false)} className="text-zinc-400"><X className="size-5" /></button>
            </div>
            {groupes.map((g) => (
              <div key={g.titre} className="mt-3">
                <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-zinc-500">{g.titre}</div>
                {g.liste.map((o) => (
                  <button key={o.id} type="button" onClick={() => { p.onChoisir(o.id); setTiroir(false); }}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[14px] ${o.id === p.actif ? "bg-white/[0.08] text-zinc-50" : "text-zinc-400"}`}>
                    <o.Icon className="size-[18px]" style={o.id === p.actif ? { color: p.accent } : undefined} />{o.label}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

/* 5. Rail avec progression de lecture, compteurs et parties vues */
export function RailProgression(p: BarreProps) {
  const L = RAIL_PX["rail-progression"] as number;
  const pct = useDefilement();
  const [vus, setVus] = useState<Set<string>>(() => new Set([p.actif]));
  useEffect(() => { setVus((s) => (s.has(p.actif) ? s : new Set(s).add(p.actif))); }, [p.actif]);
  const idx = p.onglets.findIndex((o) => o.id === p.actif);
  return (
    <>
      <nav role="tablist" aria-orientation="vertical" className={`${CADRE} ${FIL} items-center gap-0.5 py-2`} style={{ width: L }}>
        <div className="mb-1 text-center font-mono text-[11px] tabular-nums text-zinc-400">{idx + 1}<span className="text-zinc-600">/{p.onglets.length}</span></div>
        {p.onglets.map((o) => {
          const on = o.id === p.actif;
          const vu = vus.has(o.id);
          return (
            <button key={o.id} role="tab" aria-selected={on} aria-label={o.label} title={o.label} type="button" onClick={() => p.onChoisir(o.id)}
              className={`relative flex w-[60px] shrink-0 flex-col items-center gap-0.5 rounded-xl px-1 py-1.5 transition-colors ${on ? "bg-white/[0.08]" : "hover:bg-white/[0.05]"}`}>
              <o.Icon className="size-[20px]" style={{ color: on ? p.accent : vu ? "#a1a1aa" : "#63636b" }} />
              <span className={`w-full truncate text-center text-[10px] leading-tight ${on ? "font-semibold text-zinc-50" : "text-zinc-500"}`}>{court(o)}</span>
              {o.compteur !== null && (
                <span className="absolute right-0 top-0 min-w-[18px] rounded-full px-1 text-center font-mono text-[9.5px] font-semibold tabular-nums" style={{ background: on ? p.accent : "#27272a", color: on ? "#050505" : "#d4d4d8" }}>{o.compteur}</span>
              )}
              {!on && vu && <span className="absolute left-1.5 top-1.5 size-1.5 rounded-full bg-emerald-400/80" />}
            </button>
          );
        })}
        <div className="mt-auto pt-2 text-center font-mono text-[10.5px] tabular-nums text-zinc-500">{Math.round(pct * 100)} %</div>
        <div className="absolute inset-y-0 right-0 w-[3px] bg-white/[0.05]"><div className="w-full" style={{ height: `${pct * 100}%`, background: p.accent }} /></div>
      </nav>
      <BarreBasse {...p} mode="progression" vus={vus} />
    </>
  );
}

/* 6. Rail flottant translucide */
export function RailFlottant(p: BarreProps) {
  const L = RAIL_PX["rail-flottant"] as number;
  const ib = useInfobulle(L);
  const ref = useCentrer(p.actif);
  return (
    <>
      <nav role="tablist" aria-orientation="vertical" className={`fixed left-2 top-2 z-40 hidden max-h-[calc(100vh-16px)] flex-col items-center gap-1 rounded-2xl border border-white/15 bg-white/[0.06] p-1.5 shadow-[0_8px_40px_rgba(0,0,0,0.5)] backdrop-blur-xl md:flex ${FIL}`} style={{ width: L - 16 }}>
        {p.onglets.map((o) => {
          const on = o.id === p.actif;
          return (
            <button key={o.id} role="tab" aria-selected={on} aria-label={o.label} type="button" onClick={() => p.onChoisir(o.id)} {...ib.lier(o.label)}
              className="relative flex size-10 shrink-0 items-center justify-center rounded-xl">
              {on && <motion.span layoutId="rf" transition={{ type: "spring", stiffness: 420, damping: 34 }} className="absolute inset-0 rounded-xl" style={{ background: `${p.accent}38`, boxShadow: `inset 0 0 0 1px ${p.accent}88` }} />}
              <o.Icon className="relative size-[20px]" style={{ color: on ? "#fff" : "#a1a1aa" }} />
            </button>
          );
        })}
      </nav>
      {ib.rendu}
      <div className="pointer-events-none fixed inset-x-0 bottom-3 z-40 flex justify-center px-3 pb-[env(safe-area-inset-bottom)] md:hidden">
        <div ref={ref} role="tablist" className="pointer-events-auto flex max-w-full gap-1 overflow-x-auto rounded-2xl border border-white/15 bg-white/[0.07] p-1.5 shadow-[0_8px_40px_rgba(0,0,0,0.55)] backdrop-blur-xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {p.onglets.map((o) => {
            const on = o.id === p.actif;
            return (
              <button key={o.id} role="tab" aria-selected={on} aria-label={o.label} data-actif={on ? "1" : "0"} type="button" onClick={() => p.onChoisir(o.id)}
                className="flex size-11 shrink-0 items-center justify-center rounded-xl" style={on ? { background: `${p.accent}38`, boxShadow: `inset 0 0 0 1px ${p.accent}88` } : undefined}>
                <o.Icon className="size-[20px]" style={{ color: on ? "#fff" : "#a1a1aa" }} />
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

export function CartesCompactes({ onglets, actif, onChoisir, accent }: BarreProps) {
  return (
    <div role="tablist" className="mt-6 grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
      {onglets.map((o) => {
        const on = o.id === actif;
        return (
          <button key={o.id} role="tab" aria-selected={on} type="button" title={o.apercu} onClick={() => onChoisir(o.id)}
            className={`flex h-10 min-w-0 items-center gap-2 rounded-xl border px-3 text-left transition-colors ${on ? "border-white/30 bg-white/[0.08]" : "border-white/[0.07] bg-white/[0.02] hover:border-white/20"}`}
            style={on ? { boxShadow: `inset 0 0 18px ${accent}26` } : undefined}>
            <o.Icon className="size-4 shrink-0" style={{ color: accent }} />
            <span className={`min-w-0 flex-1 truncate text-[13px] ${on ? "font-semibold text-zinc-50" : "font-medium text-zinc-300"}`}>{o.label}</span>
            {o.compteur !== null && <span className="shrink-0 font-mono text-[11px] tabular-nums text-zinc-500">{o.compteur}</span>}
          </button>
        );
      })}
    </div>
  );
}
