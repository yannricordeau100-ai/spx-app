"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { TranscriptBulletsBlock, type TranscriptBulletsSummary } from "@/components/transcript-bullets-block";

/**
 * Navigation entre les quatre dernieres conferences de resultats (Yann,
 * 24 sept 2026). Les fleches changent la conference affichee ; le contenu
 * d une conference anterieure est charge a la demande par
 * /api/transcripts/<ticker>?date=..., reserve aux paliers Premium et Max.
 * Pour les autres paliers, les fleches restent visibles mais floutees et
 * inactives (partie de floutage « fleches »).
 *
 * En tete du bloc, deux sous blocs alimentes par les extractions Fable :
 *  - « Suivi des KPI » : indicateurs cites dans au moins deux conferences ;
 *  - « Cites une fois » : indicateurs importants mentionnes une seule fois.
 */

export type PointSuivi = { date: string; valeur: string; unite?: string | null; periode?: string | null; citation?: string };
export type GroupeSuivi = { cle: string; nom_fr: string; theme?: string | null; points: PointSuivi[]; rattache_fiche?: boolean };
export type SuiviKpi = { conferences: string[]; suivi: GroupeSuivi[]; cites_une_fois: GroupeSuivi[] };

type ConferenceChargee = { date: string; synthese: { quarter?: string | null; summary: TranscriptBulletsSummary["summary"] } | null; kpis: unknown[] };

function dateFr(iso: string): string {
  const [y, m, d] = iso.split("-");
  const MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
  return `${Number(d)} ${MOIS[Number(m) - 1]} ${y}`;
}

export function TranscriptNavigation({
  ticker,
  summary,
  dates,
  suivi,
  accesArchives,
}: {
  ticker: string;
  summary: TranscriptBulletsSummary | null;
  /** Dates des conferences disponibles, la plus recente d abord. */
  dates: string[];
  suivi: SuiviKpi | null;
  /** Vrai pour Premium, Max et comptes internes. */
  accesArchives: boolean;
}) {
  const [index, setIndex] = useState(0);
  const [cache, setCache] = useState<Record<string, ConferenceChargee>>({});
  const [chargement, setChargement] = useState(false);
  const date = dates[index];
  const derniere = index === 0;

  useEffect(() => {
    if (derniere || !date || cache[date] || !accesArchives) return;
    let vivant = true;
    setChargement(true);
    fetch(`/api/transcripts/${encodeURIComponent(ticker.toLowerCase())}?date=${date}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j: ConferenceChargee | null) => {
        if (vivant && j) setCache((c) => ({ ...c, [date]: j }));
      })
      .finally(() => vivant && setChargement(false));
    return () => {
      vivant = false;
    };
  }, [date, derniere, cache, ticker, accesArchives]);

  const conf = derniere ? null : cache[date];
  const summaryAffiche: TranscriptBulletsSummary | null = derniere
    ? summary
    : conf?.synthese
      ? { ticker, quarter: conf.synthese.quarter ?? undefined, summary: conf.synthese.summary }
      : null;

  const fleches = dates.length > 1 && (
    <div
      data-blur-part="fleches"
      className={`flex items-center gap-1.5 text-[12px] text-zinc-400 ${accesArchives ? "" : "pointer-events-none select-none blur-[3px]"}`}
      aria-hidden={!accesArchives}
    >
      <button
        type="button"
        disabled={!accesArchives || index >= dates.length - 1}
        onClick={() => setIndex((i) => Math.min(i + 1, dates.length - 1))}
        className="rounded-full border border-white/10 p-1 hover:border-violet-400/50 disabled:opacity-30"
        aria-label="Conférence précédente"
      >
        <ChevronLeft className="size-4" />
      </button>
      <span className="font-mono tabular-nums">
        Conférence du {date ? dateFr(date) : ""} ({dates.length - index} / {dates.length})
      </span>
      <button
        type="button"
        disabled={!accesArchives || index === 0}
        onClick={() => setIndex((i) => Math.max(i - 1, 0))}
        className="rounded-full border border-white/10 p-1 hover:border-violet-400/50 disabled:opacity-30"
        aria-label="Conférence suivante"
      >
        <ChevronRight className="size-4" />
      </button>
      {chargement && <span className="text-zinc-500">chargement…</span>}
    </div>
  );

  return (
    <div id="sec-resultats-nav">
      {suivi && (suivi.suivi.length > 0 || suivi.cites_une_fois.length > 0) && (
        <div className="mb-4 grid gap-3 lg:grid-cols-2">
          {suivi.suivi.length > 0 && (
            <div data-blur-part="suivi" className={`rounded-xl border border-[#1f1f1f] bg-[#0a0a0a] p-4${accesArchives ? "" : " pointer-events-none select-none blur-[5px]"}`}>
              <div className="mb-2 font-mono text-[11px] uppercase tracking-wider text-zinc-400">Suivi des KPI sur {suivi.conferences.length} conférences</div>
              <ul className="space-y-1.5">
                {suivi.suivi.slice(0, 12).map((g) => (
                  <li key={g.cle} data-blur-part="ligne" className="flex flex-wrap items-baseline justify-between gap-x-3 text-[13px]">
                    <span className="text-zinc-200">{g.nom_fr}</span>
                    <span className="font-mono text-[12px] tabular-nums text-zinc-300">
                      {[...g.points].sort((a, b) => a.date.localeCompare(b.date)).map((p) => `${p.valeur}${p.unite && !p.valeur.includes(p.unite) ? ` ${p.unite}` : ""} (${p.periode ?? dateFr(p.date)})`).join(" → ")}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {suivi.cites_une_fois.length > 0 && (
            <div data-blur-part="cites-une-fois" className={`rounded-xl border border-[#1f1f1f] bg-[#0a0a0a] p-4${accesArchives ? "" : " pointer-events-none select-none blur-[5px]"}`}>
              <div className="mb-2 font-mono text-[11px] uppercase tracking-wider text-zinc-400">Cités une fois</div>
              <ul className="space-y-1.5">
                {suivi.cites_une_fois.slice(0, 12).map((g) => (
                  <li key={g.cle} data-blur-part="ligne" className="flex flex-wrap items-baseline justify-between gap-x-3 text-[13px]">
                    <span className="text-zinc-200">{g.nom_fr}</span>
                    <span className="font-mono text-[12px] tabular-nums text-zinc-300">
                      {g.points[0]?.valeur}{g.points[0]?.unite && !g.points[0].valeur.includes(g.points[0].unite) ? ` ${g.points[0].unite}` : ""} ({g.points[0]?.periode ?? (g.points[0] ? dateFr(g.points[0].date) : "")})
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      {summaryAffiche ? (
        <TranscriptBulletsBlock ticker={ticker} summary={summaryAffiche} navigation={fleches || undefined} />
      ) : derniere ? null : (
        <div className="mt-9 flex flex-wrap items-center gap-3">
          {fleches}
          <p className="text-[13px] text-zinc-500">{chargement ? "Chargement de la conférence…" : "Synthèse de cette conférence en préparation."}</p>
        </div>
      )}
    </div>
  );
}
