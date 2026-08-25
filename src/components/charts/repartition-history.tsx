"use client";

/**
 * Historique de la répartition du CA — colonnes empilées à 100 %, une par
 * exercice (Yann 25 août 2026).
 *
 * Même principe que RepartitionBars : AUCUN texte n'est posé à l'intérieur
 * d'une forme dont la taille dépend des données. Les libellés vivent dans la
 * légende au-dessus, les années sous les colonnes. La mise en page ne peut
 * donc pas casser, quel que soit le nombre de tranches ou la longueur des
 * libellés.
 */

import { useState } from "react";
import type { RevenueHistoryEntry } from "@/lib/data";
import { geoLabel } from "@/lib/geo-label";

const PALETTE = [
  "#3b82f6", "#22d3ee", "#f472b6", "#facc15", "#a3e635",
  "#a78bfa", "#fb923c", "#34d399", "#f43f5e", "#60a5fa",
];
const OTHER_COLOR = "#52525b";

/** Nombre de tranches nommées ; le reste est agrégé en "Autres". */
const TOP_N = 6;
/** Nombre d'exercices affichés (les plus récents). */
const MAX_YEARS = 8;

export function RepartitionHistory({
  entries,
  locale = "fr",
  normalizeLabels = false,
  othersLabel = "Autres",
}: {
  entries: RevenueHistoryEntry[];
  locale?: string;
  normalizeLabels?: boolean;
  othersLabel?: string;
}) {
  // Yann 25 aout 2026 : au survol (ou au clic sur mobile) d une portion de
  // colonne, sa part est affichee en clair au-dessus du graphe. Le title HTML
  // seul ne suffisait pas : il n apparait pas au toucher.
  const [hover, setHover] = useState<{ year: string; name: string; share: number } | null>(null);

  const years = (entries ?? [])
    .filter((e) => Array.isArray(e.slices) && e.slices.length > 0)
    .slice(0, MAX_YEARS)
    .slice()
    .reverse();

  if (years.length < 2) return null;

  const label = (raw?: string | null) =>
    normalizeLabels ? geoLabel(raw, locale) : (raw || "—");

  // Les tranches nommées sont choisies sur le dernier exercice : elles restent
  // donc comparables d'une colonne à l'autre.
  const last = years[years.length - 1];
  const ranked = [...last.slices].sort((a, b) => b.value - a.value);
  const named = ranked.slice(0, TOP_N).map((s) => label(s.label ?? s.name));
  const colorOf = (name: string) => {
    const i = named.indexOf(name);
    return i >= 0 ? PALETTE[i % PALETTE.length] : OTHER_COLOR;
  };

  const columns = years.map((e) => {
    const total = e.slices.reduce((a, s) => a + Math.max(s.value, 0), 0) || 1;
    const buckets = new Map<string, number>();
    for (const s of e.slices) {
      const n = label(s.label ?? s.name);
      const key = named.includes(n) ? n : othersLabel;
      buckets.set(key, (buckets.get(key) ?? 0) + Math.max(s.value, 0));
    }
    const parts = [...named, othersLabel]
      .map((n) => ({ name: n, share: ((buckets.get(n) ?? 0) / total) * 100 }))
      .filter((p) => p.share > 0.05);
    return { year: e.fiscal_year ?? e.date?.slice(0, 4) ?? "", parts };
  });

  const legend = [...named];
  if (columns.some((c) => c.parts.some((p) => p.name === othersLabel))) {
    legend.push(othersLabel);
  }

  return (
    <div className="w-full">
      <ul className="mb-4 flex flex-wrap gap-x-4 gap-y-1.5">
        {legend.map((n) => (
          <li key={n} className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="size-2.5 shrink-0 rounded-[3px]"
              style={{ background: colorOf(n) }}
            />
            <span className="text-[12px] text-zinc-300">{n}</span>
          </li>
        ))}
      </ul>

      <div className="mb-2 h-5 text-[12px] text-zinc-300">
        {hover ? (
          <span>
            <span className="font-mono tabular-nums text-zinc-500">{hover.year}</span>
            {"  "}
            <span
              aria-hidden
              className="mr-1 inline-block size-2.5 translate-y-[1px] rounded-[3px]"
              style={{ background: colorOf(hover.name) }}
            />
            {hover.name}
            {" · "}
            <span className="font-mono font-semibold tabular-nums text-zinc-50">
              {hover.share.toLocaleString(locale.startsWith("fr") ? "fr-FR" : "en-US", {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1,
              })}
              {" %"}
            </span>
          </span>
        ) : (
          <span className="text-zinc-600">
            {locale.startsWith("fr")
              ? "Survolez une portion pour voir sa part."
              : "Hover a segment to see its share."}
          </span>
        )}
      </div>

      <div className="flex items-end justify-between gap-2 sm:gap-3">
        {columns.map((c, ci) => (
          <div key={`${c.year}-${ci}`} className="flex min-w-0 flex-1 flex-col items-center">
            <div className="flex h-[200px] w-full max-w-[56px] flex-col overflow-hidden rounded-md">
              {c.parts.map((p, i) => (
                <div
                  key={`${p.name}-${i}`}
                  title={`${p.name} · ${p.share.toLocaleString(locale.startsWith("fr") ? "fr-FR" : "en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`}
                  onMouseEnter={() => setHover({ year: String(c.year), name: p.name, share: p.share })}
                  onMouseLeave={() => setHover(null)}
                  onClick={() => setHover({ year: String(c.year), name: p.name, share: p.share })}
                  className="cursor-pointer transition-opacity hover:opacity-80"
                  style={{
                    height: `${p.share}%`,
                    background: colorOf(p.name),
                  }}
                />
              ))}
            </div>
            <span className="mt-2 font-mono text-[11px] tabular-nums text-zinc-400">
              {String(c.year)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
