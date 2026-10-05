"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { KpiCT, SocieteCT } from "./data";

export const VERT = "#22c55e";
export const ROUGE = "#f43f5e";
export const VIOLET = "#a78bfa";
export const AMBRE = "#f59e0b";

export { CONCEPTS } from "./liste";

/* ------------------------------ formats ------------------------------ */

export function fmtNum(v: number, unite: string): string {
  const abs = Math.abs(v);
  let d = 0;
  if (unite === "%") d = abs < 10 ? 1 : 0;
  else if (/^Mds/.test(unite)) d = abs < 10 ? 2 : 1;
  else d = abs >= 100 ? 0 : abs >= 10 ? 1 : 2;
  return v.toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d });
}
export function fmtVal(v: number, unite: string): string {
  return `${fmtNum(v, unite)}${unite === "%" ? " %" : unite ? ` ${unite}` : ""}`;
}
export function fmtPct(x: number | null | undefined, signe = true): string {
  if (x === null || x === undefined || !Number.isFinite(x)) return "n.d.";
  const s = Math.abs(x).toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return `${x > 0 && signe ? "+" : x < 0 ? "-" : ""}${s} %`;
}

/** Variation annuelle du point i (vs i-4). Taux en points si l'unité est %. */
export function yoyAt(k: KpiCT, i: number): number | null {
  if (i < 4) return null;
  const a = k.serie[i].v;
  const b = k.serie[i - 4].v;
  if (k.unite === "%") return a - b;
  if (b === 0) return null;
  return ((a - b) / Math.abs(b)) * 100;
}
export function yoyDernier(k: KpiCT): number | null {
  return yoyAt(k, k.serie.length - 1) ?? k.yoyNum;
}
export function fmtYoy(k: KpiCT, x: number | null): string {
  if (x === null) return "n.d.";
  if (k.unite === "%") return `${x > 0 ? "+" : x < 0 ? "-" : ""}${Math.abs(x).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} pts`;
  return fmtPct(x);
}
export function couleurYoy(x: number | null): string {
  if (x === null) return "#71717a";
  return x >= 0 ? VERT : ROUGE;
}
export function finTrimestre(p: string): Date {
  const m = p.match(/T([1-4]) (\d{2})/);
  if (!m) return new Date(NaN);
  return new Date(Date.UTC(2000 + Number(m[2]), Number(m[1]) * 3, 0));
}
export function moyenne(a: number[]): number {
  return a.reduce((s, x) => s + x, 0) / (a.length || 1);
}

/* ------------------------------ coquille ------------------------------ */

export function Coquille({
  titre,
  numero,
  explication,
  forts,
  limites,
  societes,
  sansChoix,
  children,
}: {
  titre: string;
  numero: number;
  explication: string;
  forts: string[];
  limites: string[];
  societes: SocieteCT[];
  sansChoix?: boolean;
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
            Tous les concepts KPI court terme
          </Link>
          <div className={`items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] p-1 ${sansChoix ? "hidden" : "flex"}`}>
            {societes.map((x) => (
              <button
                key={x.ticker}
                type="button"
                onClick={() => setT(x.ticker)}
                className={`rounded-full px-3.5 py-1 text-[12.5px] font-medium transition-colors ${
                  x.ticker === s.ticker ? "bg-violet-500/25 text-violet-100" : "text-zinc-400 hover:text-zinc-100"
                }`}
              >
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
          Version ordinateur uniquement. Données réelles de la fiche {s.nom} ({s.ticker}), séries trimestrielles lues par le chargeur de la fiche société.
        </p>

        <div className="mt-6">{children(s)}</div>

        <div className="mt-10 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] p-5">
            <div className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-emerald-300">Points forts</div>
            <ul className="space-y-1.5 text-[13px] leading-snug text-zinc-300">
              {forts.map((f) => (<li key={f}>+ {f}</li>))}
            </ul>
          </div>
          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/[0.04] p-5">
            <div className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-rose-300">Limites</div>
            <ul className="space-y-1.5 text-[13px] leading-snug text-zinc-300">
              {limites.map((f) => (<li key={f}>- {f}</li>))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Pastille({ k }: { k: KpiCT }) {
  return (
    <span className="rounded-full border px-2 py-0.5 text-[10.5px] font-semibold" style={{ color: k.couleurNote, borderColor: `${k.couleurNote}55`, background: `${k.couleurNote}18` }}>
      {k.note}
    </span>
  );
}
