"use client";

import { TranscriptBulletsBlock, type TranscriptBulletsSummary } from "@/components/transcript-bullets-block";

/**
 * Bloc des conferences de resultats : seule la derniere conference est
 * affichee, sans controle de navigation (Yann, 5 oct 2026).
 */

export type PointSuivi = { date: string; valeur: string; unite?: string | null; periode?: string | null; citation?: string };
export type GroupeSuivi = { cle: string; nom_fr: string; theme?: string | null; points: PointSuivi[]; rattache_fiche?: boolean };
export type SuiviKpi = { conferences: string[]; suivi: GroupeSuivi[]; cites_une_fois: GroupeSuivi[] };

export function TranscriptNavigation({
  ticker,
  summary,
}: {
  ticker: string;
  summary: TranscriptBulletsSummary | null;
  /** Props historiques passees par la fiche, ignorees : plus de navigation. */
  dates?: string[];
  suivi?: SuiviKpi | null;
  accesArchives?: boolean;
}) {
  if (!summary) return null;
  return (
    <div id="sec-resultats-nav">
      <TranscriptBulletsBlock ticker={ticker} summary={summary} />
    </div>
  );
}
