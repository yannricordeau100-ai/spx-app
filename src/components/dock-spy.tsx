"use client";

import { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";

/**
 * 2 designs de dock-spy (sidebar récap des sections de la page) :
 *   N1 = DockSpyLeft  → barre verticale à gauche
 *   N2 = DockSpyRight → barre verticale à droite
 *
 * Comportement : effet "Mac Dock" sur la section active (le symbole grossit
 * dynamiquement en fonction du scroll). Click sur un symbole : smooth-scroll
 * vers la section.
 *
 * Drop-in : passer un tableau `sections` avec id (matching DOM id), label, icon.
 *
 *   <DockSpyLeft sections={[{ id: "hero", label: "Hero", Icon: HomeIcon }, ...]} />
 *
 * Recommandation pour Mettrik : N1 (gauche) — moins encombrant que la droite
 * où on a déjà des actions (Sauvegarder, scroll bar navigateur sur mobile).
 */

export type DockSpySection = {
  id: string;
  label: string;
  Icon: LucideIcon;
};

function useActiveSection(sections: DockSpySection[]) {
  const [active, setActive] = useState<string>(sections[0]?.id ?? "");
  const [progress, setProgress] = useState<Record<string, number>>({});

  useEffect(() => {
    const onScroll = () => {
      const viewport = window.innerHeight;
      const center = viewport * 0.35;
      const next: Record<string, number> = {};
      let bestId = sections[0]?.id ?? "";
      let bestDist = Infinity;
      for (const s of sections) {
        const el = document.getElementById(s.id);
        if (!el) continue;
        const r = el.getBoundingClientRect();
        const dist = Math.abs(r.top - center);
        // proximity score [0..1] — 1 = exactly at center, decays with distance
        const score = Math.max(0, 1 - dist / (viewport * 0.6));
        next[s.id] = score;
        if (dist < bestDist) {
          bestDist = dist;
          bestId = s.id;
        }
      }
      setProgress(next);
      setActive(bestId);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [sections]);

  return { active, progress };
}

function DockButton({
  s,
  isActive,
  scale,
  side,
  onClick,
  onHover,
  onLeave,
}: {
  s: DockSpySection;
  isActive: boolean;
  scale: number;
  side: "left" | "right";
  onClick: () => void;
  onHover: () => void;
  onLeave: () => void;
}) {
  const Icon = s.Icon;
  return (
    <button
      onClick={onClick}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      className={`group relative inline-flex size-7 items-center justify-center rounded-full transition-all duration-200 ease-out ${
        isActive
          ? "bg-violet-500/25 text-violet-100 shadow-[0_0_12px_rgba(167,139,250,0.45)]"
          : "text-zinc-500 hover:bg-[#1a1a1a] hover:text-zinc-200"
      }`}
      style={{ transform: `scale(${scale})`, transformOrigin: side === "left" ? "left center" : "right center" }}
      aria-label={s.label}
      title={s.label}
    >
      <Icon className="size-3.5" />
      <span
        className={`pointer-events-none absolute ${
          side === "left" ? "left-full ml-3" : "right-full mr-3"
        } whitespace-nowrap rounded-md border border-[#1f1f1f] bg-[#0a0a0a] px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-zinc-300 opacity-0 transition-opacity group-hover:opacity-100`}
      >
        {s.label}
      </span>
    </button>
  );
}

/**
 * Compute scale per item — Mac Dock magnify behavior:
 *  - active item gets a permanent boost (visible scroll position)
 *  - on hover : the hovered item magnifies AND its neighbors slightly
 *  - when ANY hover is active, the active item gets an EXTRA boost so it
 *    stays the biggest (rappel visuel "tu es ici")
 */
function scaleFor(i: number, hoverIdx: number | null, isActive: boolean): number {
  const dist = hoverIdx === null ? Infinity : Math.abs(i - hoverIdx);
  const hoverBoost = Math.max(0, 1 - dist / 2.5) * 0.45;
  const isAnyHover = hoverIdx !== null;
  const activeBoost = isActive ? (isAnyHover ? 0.85 : 0.5) : 0;
  return Math.min(2.0, 1 + hoverBoost + activeBoost);
}

function useDockNav(sections: DockSpySection[]) {
  const { active } = useActiveSection(sections);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const go = (id: string) =>
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  return { active, hoverIdx, setHoverIdx, go };
}

/* N1 — DOCK SPY LEFT */
export function DockSpyLeft({ sections }: { sections: DockSpySection[] }) {
  const { active, hoverIdx, setHoverIdx, go } = useDockNav(sections);

  return (
    <nav className="fixed left-3 top-1/2 z-40 -translate-y-1/2" onMouseLeave={() => setHoverIdx(null)}>
      <div className="flex flex-col items-center gap-2 rounded-full border border-[#1f1f1f] bg-[#0a0a0a]/85 px-2 py-3 backdrop-blur-md">
        {sections.map((s, i) => {
          const isActive = active === s.id;
          return (
            <DockButton
              key={s.id} s={s}
              isActive={isActive}
              scale={scaleFor(i, hoverIdx, isActive)}
              side="left"
              onClick={() => go(s.id)}
              onHover={() => setHoverIdx(i)}
              onLeave={() => { /* géré au niveau nav */ }}
            />
          );
        })}
      </div>
    </nav>
  );
}

/* N2 — DOCK SPY RIGHT */
export function DockSpyRight({ sections }: { sections: DockSpySection[] }) {
  const { active, hoverIdx, setHoverIdx, go } = useDockNav(sections);

  return (
    <nav className="fixed right-3 top-1/2 z-40 -translate-y-1/2" onMouseLeave={() => setHoverIdx(null)}>
      <div className="flex flex-col items-center gap-2 rounded-full border border-[#1f1f1f] bg-[#0a0a0a]/85 px-2 py-3 backdrop-blur-md">
        {sections.map((s, i) => {
          const isActive = active === s.id;
          return (
            <DockButton
              key={s.id} s={s}
              isActive={isActive}
              scale={scaleFor(i, hoverIdx, isActive)}
              side="right"
              onClick={() => go(s.id)}
              onHover={() => setHoverIdx(i)}
              onLeave={() => {}}
            />
          );
        })}
      </div>
    </nav>
  );
}
