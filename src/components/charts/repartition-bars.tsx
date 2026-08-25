"use client";

/**
 * Répartition du CA — rendu DÉTERMINISTE (Yann 25 août 2026).
 *
 * Pourquoi ce composant remplace le treemap : dans un treemap, le texte est
 * posé À L'INTÉRIEUR de rectangles dont la taille dépend des données. Chaque
 * cas limite produit donc un défaut visuel (libellé tronqué "nal visua-
 * lization", montant fantôme au milieu d'une tuile, libellé pays brut qui
 * déborde). Aucun réglage ne rend ça sûr : le défaut est structurel.
 *
 * Ici, le texte n'est JAMAIS dans une forme :
 *   - une ligne par tranche, libellé dans sa propre colonne (2 lignes max),
 *   - barre proportionnelle au centre, largeur = part du total,
 *   - pourcentage et montant alignés à droite, en colonne fixe.
 * La mise en page ne peut donc pas casser, quelles que soient les données.
 */

import { useState } from "react";
import { geoLabel } from "@/lib/geo-label";

export type RepartitionSlice = {
  name?: string;
  label?: string;
  value: number;
  share_pct?: number;
  pct?: number;
  unit?: string;
};

/** Palette stable, indexée sur la position (la plus grosse tranche en 1er). */
const PALETTE = [
  "#3b82f6", "#22d3ee", "#f472b6", "#facc15", "#a3e635",
  "#a78bfa", "#fb923c", "#34d399", "#f43f5e", "#60a5fa",
];

/** Seuil sous lequel les tranches sont regroupées dans "Autres". */
const SMALL_PCT = 2;

function fmtPct(v: number, locale: string): string {
  return `${v.toLocaleString(locale.startsWith("fr") ? "fr-FR" : "en-US", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} %`;
}

function fmtValue(v: number, unit: string, locale: string): string {
  const loc = locale.startsWith("fr") ? "fr-FR" : "en-US";
  const digits = Math.abs(v) >= 100 ? 0 : Math.abs(v) >= 10 ? 1 : 2;
  return `${v.toLocaleString(loc, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}${unit ? ` ${unit}` : ""}`;
}

export function RepartitionBars({
  data,
  unit,
  total,
  locale = "fr",
  othersLabel = "Autres",
  normalizeLabels = false,
}: {
  data: RepartitionSlice[];
  unit: string;
  total?: number | null;
  locale?: string;
  othersLabel?: string;
  /** Vue géographique : normalise "TAIWAN, PROVINCE OF CHINA" -> "Taïwan". */
  normalizeLabels?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  // Yann 25 aout 2026 : les parts sont TOUJOURS recalculees a partir des
  // valeurs, jamais reprises telles quelles du dataset. Deux garanties :
  // la somme des pourcentages fait exactement 100 %, et le total affiche est
  // bien la somme des tranches (avant, `total` pouvait manquer ou diverger).
  const raw = (data ?? []).filter((s) => Number.isFinite(s.value) && s.value > 0);
  const sumValues = raw.reduce((a, s) => a + s.value, 0);
  const clean = raw
    .map((s) => ({ ...s, share: sumValues > 0 ? (s.value / sumValues) * 100 : 0 }))
    .sort((a, b) => b.value - a.value);

  if (clean.length === 0) return null;
  const effectiveTotal = total != null && Number.isFinite(total) ? total : sumValues;

  const big = clean.filter((s) => s.share >= SMALL_PCT);
  const small = clean.filter((s) => s.share < SMALL_PCT);
  const rows = expanded || small.length <= 1 ? clean : big;
  const othersValue = small.reduce((a, s) => a + s.value, 0);
  const othersShare = small.reduce((a, s) => a + s.share, 0);
  const showOthers = !expanded && small.length > 1;

  const max = Math.max(...clean.map((s) => s.share), 1);

  return (
    <div className="w-full">
      <div className="mb-4 flex items-baseline justify-between border-b border-[#1a1a1a] pb-3">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-zinc-500">
          {locale.startsWith("fr") ? "Chiffre d\u2019affaires total" : "Total revenue"}
        </span>
        <span className="font-mono text-[17px] font-semibold tabular-nums text-zinc-50">
          {fmtValue(effectiveTotal, unit, locale)}
        </span>
      </div>

      <ul className="flex flex-col gap-2.5">
        {rows.map((s, i) => (
          <li key={`${s.label ?? s.name ?? "s"}-${i}`} className="grid grid-cols-12 items-center gap-3">
            <div className="col-span-5 flex min-w-0 items-start gap-2 sm:col-span-4">
              <span
                aria-hidden
                className="mt-[5px] size-2.5 shrink-0 rounded-[3px]"
                style={{ background: PALETTE[i % PALETTE.length] }}
              />
              <span className="line-clamp-2 text-[13.5px] leading-snug text-zinc-100">
                {normalizeLabels ? geoLabel(s.label || s.name, locale) : (s.label || s.name || "—")}
              </span>
            </div>

            <div className="col-span-3 hidden h-2.5 overflow-hidden rounded-full bg-white/[0.05] sm:col-span-4 sm:block">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.max((s.share / max) * 100, 1.5)}%`,
                  background: PALETTE[i % PALETTE.length],
                }}
              />
            </div>

            <div className="col-span-4 text-right font-mono text-[13.5px] font-semibold tabular-nums text-zinc-50 sm:col-span-2">
              {fmtPct(s.share, locale)}
            </div>
            <div className="col-span-3 text-right font-mono text-[12px] tabular-nums text-zinc-400 sm:col-span-2">
              {fmtValue(s.value, unit, locale)}
            </div>
          </li>
        ))}

        {showOthers && (
          <li className="grid grid-cols-12 items-center gap-3">
            <div className="col-span-5 flex min-w-0 items-start gap-2 sm:col-span-4">
              <span aria-hidden className="mt-[5px] size-2.5 shrink-0 rounded-[3px] bg-zinc-600" />
              <button
                type="button"
                onClick={() => setExpanded(true)}
                className="text-left text-[13.5px] leading-snug text-zinc-300 underline decoration-dotted underline-offset-4 hover:text-zinc-100"
              >
                {othersLabel} ({small.length})
              </button>
            </div>
            <div className="col-span-3 hidden h-2.5 overflow-hidden rounded-full bg-white/[0.05] sm:col-span-4 sm:block">
              <div
                className="h-full rounded-full bg-zinc-600"
                style={{ width: `${Math.max((othersShare / max) * 100, 1.5)}%` }}
              />
            </div>
            <div className="col-span-4 text-right font-mono text-[13.5px] font-semibold tabular-nums text-zinc-50 sm:col-span-2">
              {fmtPct(othersShare, locale)}
            </div>
            <div className="col-span-3 text-right font-mono text-[12px] tabular-nums text-zinc-400 sm:col-span-2">
              {fmtValue(othersValue, unit, locale)}
            </div>
          </li>
        )}
      </ul>

      <div className="mt-4 flex items-baseline justify-between border-t border-[#1a1a1a] pt-3 font-mono text-[11px] tabular-nums text-zinc-500">
        <span className="uppercase tracking-[0.14em]">
          {locale.startsWith("fr") ? "Somme" : "Sum"}
        </span>
        <span>
          {fmtPct(clean.reduce((a, s2) => a + s2.share, 0), locale)}
          {" · "}
          {fmtValue(sumValues, unit, locale)}
        </span>
      </div>

      {expanded && small.length > 1 && (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="mt-3 font-mono text-[11px] uppercase tracking-wider text-zinc-500 hover:text-zinc-300"
        >
          Replier
        </button>
      )}
    </div>
  );
}
