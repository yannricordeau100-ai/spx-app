"use client";

/**
 * Bloc « Sociétés rachetées » de la fiche (Yann 25 sept 2026), sous la
 * gouvernance. Trois versions, parcourues avec des flèches horizontales
 * comme les KPI moyen terme :
 *  A. la frise par année
 *  B. la liste, années les plus anciennes en haut, repliée
 *  C. les 5 plus gros acheteurs du site, États-Unis et Europe
 * Floutage par zones (data-blur="rachats") ; le texte sous le flou est
 * crypté côté serveur (caviardeRachatsPourGratuit).
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronLeft, ChevronRight, GitMerge } from "lucide-react";

export type RachatFiche = { nom: string; annee: number | null; montant: string | null };
export type RachatsFiche = {
  depuis: number;
  societe: { nb: number; rachats: RachatFiche[]; couverte: boolean } | null;
  classement: { us: { ticker: string; nom: string; nb: number }[]; eu: { ticker: string; nom: string; nb: number }[] };
};

const VERSIONS = ["La frise", "La liste", "Les plus gros acheteurs"] as const;
const PLIE = 5;

function milliards(m: string | null): number {
  if (!m) return 0;
  const x = parseFloat(m.replace(",", "."));
  if (!Number.isFinite(x)) return 0;
  return m.includes("Mds") ? x : x / 1000;
}

function total(r: RachatFiche[]): string | null {
  const t = r.reduce((a, x) => a + milliards(x.montant), 0);
  if (!t) return null;
  return t >= 1 ? `${t.toFixed(1).replace(".", ",")} Mds $` : `${Math.round(t * 1000)} M$`;
}

function Vide({ couverte }: { couverte: boolean }) {
  return (
    <p className="py-6 text-center text-[13px] text-zinc-400">
      {couverte ? "Aucun rachat significatif publié depuis 2016." : "Disponible bientôt."}
    </p>
  );
}

function VersionA({ d, accent }: { d: RachatsFiche; accent: string }) {
  const s = d.societe;
  const parAn = useMemo(() => {
    const m = new Map<string, RachatFiche[]>();
    for (const r of s?.rachats ?? []) {
      const k = r.annee ? String(r.annee) : "Année n.c.";
      m.set(k, [...(m.get(k) ?? []), r]);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [s]);
  if (!s || s.nb === 0) return <Vide couverte={!!s?.couverte} />;
  const t = total(s.rachats);
  return (
    <div data-blur-part="frise">
      <div className="flex items-baseline gap-3">
        <span className="font-mono text-[34px] font-bold leading-none text-zinc-50">{s.nb}</span>
        <span className="text-[13.5px] text-zinc-300">sociétés rachetées depuis {d.depuis}</span>
        {t && <span className="ml-auto font-mono text-[12px]" style={{ color: accent }}>{t}</span>}
      </div>
      <div className="mt-4 flex gap-3 overflow-x-auto pb-1">
        {parAn.map(([an, liste]) => (
          <div key={an} className="min-w-[130px] flex-1">
            <div className="mb-1.5 flex items-center gap-2">
              <span className="font-mono text-[11px] font-semibold text-violet-200">{an}</span>
              <span className="h-px flex-1 bg-violet-400/30" />
            </div>
            <ul className="space-y-1.5">
              {liste.map((r, i) => (
                <li key={`${r.nom}-${i}`} className={`rounded-lg border px-2 py-1.5 text-[12px] ${milliards(r.montant) >= 5 ? "border-cyan-400/40 bg-cyan-500/10 text-cyan-50" : "border-white/[0.08] bg-white/[0.02] text-zinc-200"}`}>
                  <div className="font-medium leading-tight">{r.nom}</div>
                  {r.montant && <div className="mt-0.5 font-mono text-[10.5px] text-zinc-400">{r.montant}</div>}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function VersionB({ d }: { d: RachatsFiche }) {
  const [ouvert, setOuvert] = useState(false);
  const s = d.societe;
  if (!s || s.nb === 0) return <Vide couverte={!!s?.couverte} />;
  // Années les plus anciennes en haut, pour garder le bloc bas : on n affiche
  // que les premières lignes, le reste se déplie.
  const tri = [...s.rachats].sort((a, b) => (a.annee ?? 9999) - (b.annee ?? 9999));
  const visibles = ouvert ? tri : tri.slice(0, PLIE);
  const t = total(s.rachats);
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <h3 className="text-[14.5px] font-semibold text-zinc-100">Sociétés rachetées <span className="font-normal text-zinc-400">depuis {d.depuis}</span></h3>
        <span data-blur-part="valeur" className="font-mono text-[12px] text-zinc-400">
          {s.nb}{t ? ` · ${t}` : ""}
        </span>
      </div>
      <ul data-blur-part="liste" className="mt-2 divide-y divide-white/[0.05]">
        {visibles.map((r, i) => (
          <li key={`${r.nom}-${i}`} className="flex items-center gap-3 py-1.5 text-[13px]">
            <span className="w-11 font-mono text-[11px] text-violet-300">{r.annee ?? "n.c."}</span>
            <span className="flex-1 text-zinc-100">{r.nom}</span>
            <span className="font-mono text-[12px] text-zinc-300">{r.montant ?? ""}</span>
          </li>
        ))}
      </ul>
      {tri.length > PLIE && (
        <button type="button" onClick={() => setOuvert(!ouvert)} className="mt-2 inline-flex items-center gap-1.5 text-[12.5px] text-violet-300 hover:text-violet-200">
          <ChevronDown className={`size-3.5 transition-transform ${ouvert ? "rotate-180" : ""}`} />
          {ouvert ? "Replier la liste" : "Découvrir les autres sociétés rachetées, années suivantes"}
        </button>
      )}
    </div>
  );
}

function VersionC({ d }: { d: RachatsFiche }) {
  const colonne = (titre: string, l: RachatsFiche["classement"]["us"]) => {
    const max = Math.max(1, ...l.map((x) => x.nb));
    return (
      <div>
        <h3 className="mb-1.5 font-mono text-[10.5px] uppercase tracking-[0.14em] text-zinc-400">{titre}</h3>
        <ol className="space-y-1">
          {l.map((x, i) => (
            <li key={i} data-blur-part="ligne" className="flex items-center gap-2.5 text-[13px]">
              <span className="w-4 font-mono text-[11px] text-zinc-500">{i + 1}</span>
              {x.ticker ? (
                <Link href={`/${x.ticker.toLowerCase()}`} className="w-40 truncate text-zinc-200 hover:text-violet-200">{x.nom}</Link>
              ) : (
                <span className="w-40 truncate text-zinc-200">{x.nom}</span>
              )}
              <span className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.05]">
                <span className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-violet-500 to-cyan-400" style={{ width: `${(x.nb / max) * 100}%` }} />
              </span>
              <span className="w-7 text-right font-mono text-[12.5px] font-semibold text-zinc-50">{x.nb}</span>
            </li>
          ))}
        </ol>
      </div>
    );
  };
  return (
    <div>
      <h3 className="mb-3 text-[14.5px] font-semibold text-zinc-100">Les plus gros acheteurs <span className="font-normal text-zinc-400">depuis {d.depuis}</span></h3>
      <div className="grid gap-5 sm:grid-cols-2">
        {colonne("Sociétés américaines", d.classement.us)}
        {colonne("Sociétés européennes", d.classement.eu)}
      </div>
    </div>
  );
}

export function RachatsBlock({ data, accent = "#a78bfa" }: { data: RachatsFiche; accent?: string }) {
  const [v, setV] = useState(0);
  const n = VERSIONS.length;
  return (
    <section id="sec-rachats" data-blur="rachats" className="mt-9 scroll-mt-24">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div className="flex items-center gap-2">
          <GitMerge className="size-5" style={{ color: accent }} />
          <h2 className="text-[22px] font-semibold leading-tight text-zinc-50">Sociétés rachetées</h2>
          <span className="text-[13px] text-zinc-400">depuis {data.depuis}</span>
        </div>
        <div data-blur-part="fleches" className="flex items-center gap-1.5">
          <span className="mr-1 text-[12px] text-zinc-500">{VERSIONS[v]} ({v + 1}/{n})</span>
          <button type="button" onClick={() => setV((i) => (i - 1 + n) % n)} className="rounded-md border border-white/[0.08] p-1.5 text-zinc-300 hover:bg-white/5" aria-label="Version précédente">
            <ChevronLeft className="size-4" />
          </button>
          <button type="button" onClick={() => setV((i) => (i + 1) % n)} className="rounded-md border border-white/[0.08] p-1.5 text-zinc-300 hover:bg-white/5" aria-label="Version suivante">
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>
      <div className="rounded-2xl border border-white/[0.08] bg-[#0a0a0a] p-4">
        {v === 0 ? <VersionA d={data} accent={accent} /> : v === 1 ? <VersionB d={data} /> : <VersionC d={data} />}
        <p className="mt-3 border-t border-white/[0.06] pt-2 font-mono text-[10px] text-zinc-500">
          Rachats finalisés depuis {data.depuis}. Les petites acquisitions non nommées par la société n&apos;apparaissent pas.
        </p>
      </div>
      <div className="mt-2 flex justify-center gap-1.5">
        {VERSIONS.map((_, i) => (
          <button key={i} type="button" onClick={() => setV(i)} className="size-1.5 rounded-full transition-all" style={{ background: i === v ? accent : "#3f3f46", transform: i === v ? "scaleX(2)" : "scaleX(1)" }} aria-label={`Version ${i + 1}`} />
        ))}
      </div>
    </section>
  );
}
