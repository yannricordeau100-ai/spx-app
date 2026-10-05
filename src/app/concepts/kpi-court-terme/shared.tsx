"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { SocieteCT, StoryCT } from "./data";

export { CONCEPTS } from "./liste";

/* ------------------------------ valeur ------------------------------ */

export function valeurAffichee(s: StoryCT): string {
  return s.approx === "min" ? `${s.valeur}+` : s.approx === "env" ? `≈${s.valeur}` : s.valeur;
}

export function Valeur({ s, accent, taille = 56 }: { s: StoryCT; accent: string; taille?: number }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2">
      <span
        className="font-display font-bold leading-none tracking-tight tabular-nums"
        style={{ fontSize: taille, background: `linear-gradient(135deg,#fff 0%,#d4d4d8 55%,${accent} 130%)`, WebkitBackgroundClip: "text", color: "transparent" }}
      >
        {valeurAffichee(s)}
      </span>
      {s.unite && <span className="font-medium text-zinc-400" style={{ fontSize: Math.max(13, taille * 0.34) }}>{s.unite}</span>}
    </div>
  );
}

export function PuceYoy({ s }: { s: StoryCT }) {
  if (!s.yoy) return null;
  const neg = /^\s*[-−–]/.test(s.yoy);
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[11px] tabular-nums ${neg ? "border-rose-500/30 bg-rose-500/10 text-rose-300" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"}`}>
      {s.yoy}
    </span>
  );
}

/* ------------------------------ graphique ------------------------------ */

/** Courbe interactive (survol d un point = valeur). Rien si moins de 2 points. */
export function Courbe({ serie, accent, hauteur = 150, unite = "" }: { serie: StoryCT["serie"]; accent: string; hauteur?: number; unite?: string }) {
  const [h, setH] = useState<number | null>(null);
  if (serie.length < 2) return null;
  const W = 600, H = hauteur, PL = 8, PR = 8, PT = 14, PB = 22;
  const vs = serie.map((p) => p.v);
  const lo = Math.min(...vs), hi = Math.max(...vs);
  const span = hi - lo || Math.abs(hi) || 1;
  const X = (i: number) => PL + (i / (serie.length - 1)) * (W - PL - PR);
  const Y = (v: number) => PT + (1 - (v - (lo - span * 0.1)) / (span * 1.2)) * (H - PT - PB);
  const d = serie.map((p, i) => `${i ? "L" : "M"}${X(i).toFixed(1)} ${Y(p.v).toFixed(1)}`).join(" ");
  const aire = `${d} L${X(serie.length - 1)} ${H - PB} L${X(0)} ${H - PB} Z`;
  const gid = `g${accent.replace(/\W/g, "")}${hauteur}`;
  const fmt = (v: number) => v.toLocaleString("fr-FR", { maximumFractionDigits: Math.abs(v) < 10 ? 2 : 1 });
  const pas = Math.max(1, Math.ceil(serie.length / 6));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" onMouseLeave={() => setH(null)}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={accent} stopOpacity="0.35" />
          <stop offset="100%" stopColor={accent} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={aire} fill={`url(#${gid})`} />
      <path d={d} fill="none" stroke={accent} strokeWidth="2.5" strokeLinejoin="round" />
      {serie.map((p, i) => (
        <g key={i} onMouseEnter={() => setH(i)}>
          <rect x={X(i) - 14} y={0} width={28} height={H} fill="transparent" />
          <circle cx={X(i)} cy={Y(p.v)} r={h === i ? 5.5 : 3.2} fill={accent} />
          {(i % pas === 0 || i === serie.length - 1) && (
            <text x={X(i)} y={H - 6} textAnchor="middle" fontSize="11" fill="#71717a" fontFamily="monospace">{p.q}</text>
          )}
        </g>
      ))}
      {h !== null && (
        <g>
          <rect x={Math.min(Math.max(X(h) - 46, 0), W - 92)} y={Math.max(Y(serie[h].v) - 34, 0)} width={92} height={22} rx={6} fill="#0b0b10" stroke="#ffffff22" />
          <text x={Math.min(Math.max(X(h), 46), W - 46)} y={Math.max(Y(serie[h].v) - 19, 15)} textAnchor="middle" fontSize="12" fill="#fff" fontFamily="monospace">
            {fmt(serie[h].v)}{unite ? ` ${unite}` : ""}
          </text>
        </g>
      )}
    </svg>
  );
}

/* ------------------------------ filtres ------------------------------ */

export type Ordre = "recent" | "ancien";

export function useStories(stories: StoryCT[]) {
  const [famille, setFamille] = useState<string>("toutes");
  const [ordre, setOrdre] = useState<Ordre>("recent");
  const [vedette, setVedette] = useState(false);
  const familles = useMemo(() => {
    const m = new Map<string, { key: string; label: string; n: number }>();
    for (const s of stories) {
      const e = m.get(s.famille) ?? { key: s.famille, label: s.familleLabel, n: 0 };
      e.n += 1;
      m.set(s.famille, e);
    }
    return [...m.values()];
  }, [stories]);
  const liste = useMemo(() => {
    let l = famille === "toutes" ? [...stories] : stories.filter((s) => s.famille === famille);
    l.sort((a, b) => (ordre === "recent" ? b.date - a.date : a.date - b.date));
    if (vedette) {
      const vu = new Set<string>();
      l = l.filter((s) => (vu.has(s.famille) ? false : (vu.add(s.famille), true)));
    }
    return l;
  }, [stories, famille, ordre, vedette]);
  return { famille, setFamille, ordre, setOrdre, vedette, setVedette, familles, liste };
}

export type Filtres = ReturnType<typeof useStories>;

const puce = (actif: boolean) =>
  `whitespace-nowrap rounded-full px-3 py-1.5 text-[12.5px] font-medium transition-colors ${actif ? "bg-white/[0.09] text-zinc-50" : "text-zinc-400 hover:text-zinc-100"}`;

/** Filtres en puces, a l horizontale (identiques au bloc actuel) ou a la verticale. */
export function Filtres({ f, total, vertical = false }: { f: Filtres; total: number; vertical?: boolean }) {
  const boite = "rounded-2xl border border-[#1f1f1f] bg-[#0a0a0a] p-1";
  return (
    <div className={vertical ? "space-y-4" : "flex flex-wrap items-center gap-2"}>
      <div className={`${boite} ${vertical ? "flex flex-col gap-0.5" : "flex flex-wrap items-center gap-1"}`}>
        <button type="button" onClick={() => f.setFamille("toutes")} className={`${puce(f.famille === "toutes")} ${vertical ? "flex justify-between text-left" : ""}`}>
          Toutes<span className="ml-1.5 font-mono text-[10.5px] text-zinc-500">{total}</span>
        </button>
        {f.familles.map((x) => (
          <button key={x.key} type="button" onClick={() => f.setFamille(x.key)} className={`${puce(f.famille === x.key)} ${vertical ? "flex justify-between text-left" : ""}`}>
            {x.label}<span className="ml-1.5 font-mono text-[10.5px] text-zinc-500">{x.n}</span>
          </button>
        ))}
      </div>
      <div className={`${boite} flex items-center gap-1 ${vertical ? "" : "rounded-full"}`}>
        <button type="button" onClick={() => f.setOrdre("recent")} className={puce(f.ordre === "recent")}>Plus récentes</button>
        <button type="button" onClick={() => f.setOrdre("ancien")} className={puce(f.ordre === "ancien")}>Plus anciennes</button>
      </div>
      <button
        type="button"
        onClick={() => f.setVedette(!f.vedette)}
        className={`rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition-colors ${f.vedette ? "border-violet-400/50 bg-violet-500/15 text-violet-100" : "border-[#1f1f1f] bg-[#0a0a0a] text-zinc-400 hover:text-zinc-100"}`}
      >
        Une vedette par famille
      </button>
    </div>
  );
}

/* ------------------------------ coquille ------------------------------ */

export function Coquille({
  titre,
  numero,
  explication,
  forts,
  limites,
  societes,
  children,
}: {
  titre: string;
  numero: number;
  explication: string;
  forts: string[];
  limites: string[];
  societes: SocieteCT[];
  children: (s: SocieteCT) => ReactNode;
}) {
  const [t, setT] = useState(societes[0]?.ticker ?? "");
  const s = societes.find((x) => x.ticker === t) ?? societes[0];
  return (
    <div className="min-h-screen bg-[#050507] text-zinc-100">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/concepts/kpi-court-terme" className="group inline-flex items-center gap-2 text-[12px] text-zinc-500 transition-colors hover:text-zinc-200">
            <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" />
            Tous les concepts du bloc story
          </Link>
          <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] p-1">
            {societes.map((x) => (
              <button key={x.ticker} type="button" onClick={() => setT(x.ticker)}
                className={`rounded-full px-3.5 py-1 text-[12.5px] font-medium transition-colors ${x.ticker === s.ticker ? "bg-violet-500/25 text-violet-100" : "text-zinc-400 hover:text-zinc-100"}`}>
                {x.nom}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-6 flex items-baseline gap-3">
          <span className="font-mono text-[12px] text-violet-300/80">Concept {numero}</span>
          <h1 className="font-display text-[30px] font-bold tracking-tight">{titre}</h1>
        </div>
        <p className="mt-2 max-w-3xl text-[14px] leading-relaxed text-zinc-400">{explication}</p>
        <p className="mt-1 text-[11.5px] text-zinc-600">
          Version ordinateur uniquement (le mobile garde les stories actuelles). Contenu réel des stories de la fiche {s.nom} ({s.ticker}) : {s.stories.length} stories.
        </p>
        <div className="mt-6">{s.stories.length ? children(s) : <p className="text-zinc-500">Aucune story disponible pour cette société.</p>}</div>
        <div className="mt-10 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] p-5">
            <div className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-emerald-300">Points forts</div>
            <ul className="space-y-1.5 text-[13px] leading-snug text-zinc-300">{forts.map((f) => (<li key={f}>+ {f}</li>))}</ul>
          </div>
          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/[0.04] p-5">
            <div className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-rose-300">Limites</div>
            <ul className="space-y-1.5 text-[13px] leading-snug text-zinc-300">{limites.map((f) => (<li key={f}>- {f}</li>))}</ul>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ detail et hooks ------------------------------ */

/** Contenu complet d une story : titre, periode, chiffre, variation, graphique, texte. */
export function Detail({ s, accent, grand = false }: { s: StoryCT; accent: string; grand?: boolean }) {
  const [plus, setPlus] = useState(false);
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-wider" style={{ color: accent }}>{s.familleLabel}</div>
      <h3 className={`mt-1 font-display font-bold leading-tight text-zinc-50 ${grand ? "text-[28px]" : "text-[20px]"}`}>{s.titre}</h3>
      {s.periode && <div className="mt-1 text-[13px] text-zinc-400">{s.periode}</div>}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Valeur s={s} accent={accent} taille={grand ? 76 : 52} />
        <PuceYoy s={s} />
      </div>
      {s.serie.length > 1 && (
        <div className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
          <Courbe serie={s.serie} accent={accent} hauteur={grand ? 190 : 150} unite={s.unite} />
        </div>
      )}
      {s.signal && <p className={`mt-4 leading-relaxed text-zinc-200 ${grand ? "text-[16px]" : "text-[14px]"}`}>{s.signal}</p>}
      {(s.description || s.explication) && (
        <div className="mt-2">
          <button type="button" onClick={() => setPlus(!plus)} className="text-[12.5px] font-medium text-violet-300 hover:text-violet-200">
            {plus ? "Masquer le détail" : "Lire le détail"}
          </button>
          {plus && (
            <div className="mt-2 space-y-2 text-[13.5px] leading-relaxed text-zinc-400">
              {s.description && <p>{s.description}</p>}
              {s.explication && <p className="text-zinc-500">{s.explication}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Defilement automatique avec pause : renvoie l etat et la bascule. */
export function useAuto(actif: boolean, cle: unknown, ms: number, avance: () => void) {
  const [pause, setPause] = useState(false);
  const [survol, setSurvol] = useState(false);
  useEffect(() => {
    if (!actif || pause || survol) return;
    const t = setTimeout(avance, ms);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actif, pause, survol, cle, ms]);
  return { pause, setPause, survol, setSurvol };
}

/** Fleches du clavier (gauche/droite ou haut/bas selon l axe). */
export function useFleches(prec: () => void, suiv: () => void, axe: "x" | "y" | "xy" = "x") {
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && /INPUT|TEXTAREA|SELECT/.test(t.tagName)) return;
      const p = (axe !== "y" && e.key === "ArrowLeft") || (axe !== "x" && e.key === "ArrowUp");
      const n = (axe !== "y" && e.key === "ArrowRight") || (axe !== "x" && e.key === "ArrowDown");
      if (p) { e.preventDefault(); prec(); }
      else if (n) { e.preventDefault(); suiv(); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });
}
