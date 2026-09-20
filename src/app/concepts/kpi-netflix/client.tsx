"use client";

import { useMemo, useState } from "react";
import { ExternalLink, Quote } from "lucide-react";
import PROPOSITIONS from "@/data/concepts-nflx-kpi.json";

/**
 * Concept demande par Yann le 20 sept 2026 : indicateurs NON financiers utiles a
 * un investisseur qui etudie Netflix, hors de ce qui se lit dans les comptes et
 * hors des KPI deja presents sur la fiche. Chaque proposition porte sa source
 * publiee, sa citation verbatim et ses valeurs relevees. Rien n est pose sur la
 * fiche tant que Yann n a pas choisi.
 */

type Proposition = {
  nom: string;
  angle_libelle?: string;
  phrase?: string;
  unite?: string;
  frequence?: string;
  source_nom?: string;
  source_url?: string;
  source_date?: string;
  citation_verbatim?: string;
  valeurs?: (number | string)[][];
  fiabilite?: number;
  difficulte_maj?: string;
};

const LISTE = PROPOSITIONS as unknown as Proposition[];

function Etoiles({ n }: { n?: number }) {
  const v = Math.max(0, Math.min(5, Math.round(n ?? 0)));
  return (
    <span className="font-mono text-[11px] text-amber-200/80" title={`Fiabilité ${v} sur 5`}>
      {"●".repeat(v)}
      <span className="text-zinc-700">{"●".repeat(5 - v)}</span>
    </span>
  );
}

function Serie({ valeurs }: { valeurs?: (number | string)[][] }) {
  if (!valeurs || valeurs.length === 0) return null;
  const nombres = valeurs.map(([, v]) => (typeof v === "number" ? v : Number(String(v).replace(",", "."))));
  const valides = nombres.filter((n) => Number.isFinite(n));
  const max = valides.length > 0 ? Math.max(...valides) : 0;
  const min = valides.length > 0 ? Math.min(...valides) : 0;
  const etendue = max - min || 1;
  return (
    <div className="mt-3 flex flex-wrap items-end gap-3">
      {valeurs.map(([periode, v], i) => {
        const n = nombres[i];
        const hauteur = Number.isFinite(n) ? 8 + ((n - min) / etendue) * 34 : 8;
        return (
          <div key={`${periode}-${i}`} className="flex min-w-[54px] flex-col items-center gap-1">
            <span className="font-mono text-[11px] text-zinc-200">{String(v)}</span>
            <div className="w-full rounded-sm bg-violet-400/45" style={{ height: `${hauteur}px` }} />
            <span className="text-[10px] text-zinc-500">{periode}</span>
          </div>
        );
      })}
    </div>
  );
}

export function KpiNetflixClient() {
  const angles = useMemo(
    () => Array.from(new Set(LISTE.map((p) => p.angle_libelle ?? "Autres"))),
    [],
  );
  const [angle, setAngle] = useState<string>("tous");
  const visibles = angle === "tous" ? LISTE : LISTE.filter((p) => (p.angle_libelle ?? "Autres") === angle);

  return (
    <div className="min-h-screen bg-[#050505] text-zinc-100">
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <h1 className="font-display text-[26px] font-bold tracking-tight">
          Netflix : indicateurs non financiers à envisager
        </h1>
        <p className="mt-1 max-w-3xl text-[14px] text-zinc-400">
          {LISTE.length} propositions, toutes hors des comptes et hors des indicateurs déjà présents sur la fiche.
          Chacune porte sa source publiée, un extrait mot pour mot, les valeurs relevées et une note de fiabilité.
          Dites lesquelles vous voulez, je les pose sur la fiche.
        </p>

        <div className="mt-5 flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setAngle("tous")}
            className={`rounded-full border px-3 py-1 text-[12.5px] ${
              angle === "tous"
                ? "border-violet-400/60 bg-violet-500/20 text-violet-100"
                : "border-white/10 text-zinc-400 hover:border-white/25 hover:text-zinc-200"
            }`}
          >
            Tout ({LISTE.length})
          </button>
          {angles.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => setAngle(a)}
              className={`rounded-full border px-3 py-1 text-[12.5px] ${
                angle === a
                  ? "border-violet-400/60 bg-violet-500/20 text-violet-100"
                  : "border-white/10 text-zinc-400 hover:border-white/25 hover:text-zinc-200"
              }`}
            >
              {a} ({LISTE.filter((p) => (p.angle_libelle ?? "Autres") === a).length})
            </button>
          ))}
        </div>

        <ul className="mt-7 space-y-4">
          {visibles.map((p) => (
            <li key={p.nom} className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="font-display text-[16px] font-bold text-zinc-50">{p.nom}</span>
                <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10.5px] uppercase tracking-wider text-zinc-400">
                  {p.angle_libelle}
                </span>
                <span className="ml-auto">
                  <Etoiles n={p.fiabilite} />
                </span>
              </div>

              {p.phrase && <p className="mt-1.5 text-[13.5px] leading-relaxed text-zinc-300">{p.phrase}</p>}

              <p className="mt-1.5 font-mono text-[11.5px] text-zinc-500">
                {[p.unite, p.frequence].filter(Boolean).join(" · ")}
              </p>

              <Serie valeurs={p.valeurs} />

              {p.citation_verbatim && (
                <p className="mt-3 flex gap-2 text-[12px] italic text-zinc-400">
                  <Quote className="mt-0.5 size-3 shrink-0 text-zinc-600" />
                  {p.citation_verbatim}
                </p>
              )}

              <div className="mt-2 flex flex-wrap items-center gap-2 text-[11.5px] text-zinc-500">
                {p.source_url ? (
                  <a
                    href={p.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-zinc-400 underline decoration-white/20 underline-offset-2 hover:text-zinc-200"
                  >
                    {p.source_nom ?? p.source_url}
                    <ExternalLink className="size-3" />
                  </a>
                ) : (
                  <span>{p.source_nom}</span>
                )}
                {p.source_date && <span>· publiée le {p.source_date}</span>}
                {p.difficulte_maj && <span>· mise à jour : {p.difficulte_maj}</span>}
              </div>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
