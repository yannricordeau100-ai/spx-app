"use client";

import { useMemo, useState } from "react";
import type { PopularData, PopularRow } from "./page";

type Labels = {
  title: string;
  subtitle: string;
  your_country: string;
  world: string;
  other_langs: string;
  country: string;
  download_csv: string;
  back: string;
  powered: string;
  window: string;
};

const TOP_N = 20;

function TableBlock({
  title,
  subtitle,
  rows,
  accent,
}: {
  title: string;
  subtitle?: string;
  rows: PopularRow[];
  accent?: string;
}) {
  if (!rows || rows.length === 0) {
    return (
      <div className="mb-6 rounded-md border border-white/10 bg-[#080808] p-4">
        <h2 className="text-[18px] font-semibold text-zinc-100">{title}</h2>
        {subtitle ? <p className="mt-1 text-[12px] text-zinc-400">{subtitle}</p> : null}
        <p className="mt-3 text-[13px] text-zinc-500">Pas de données disponibles.</p>
      </div>
    );
  }
  return (
    <div className="mb-6 rounded-md border border-white/10 bg-[#080808] p-4" style={accent ? { borderColor: accent } : {}}>
      <h2 className="text-[18px] font-semibold text-zinc-100">{title}</h2>
      {subtitle ? <p className="mt-1 text-[12px] text-zinc-400">{subtitle}</p> : null}
      <table className="mt-3 w-full border-collapse text-[12.5px]">
        <thead className="bg-[#0c0c0c]">
          <tr>
            <th className="border-b border-white/10 px-2 py-2 text-left font-mono text-[10.5px] uppercase tracking-wider text-zinc-400">#</th>
            <th className="border-b border-white/10 px-2 py-2 text-left font-mono text-[10.5px] uppercase tracking-wider text-zinc-400">Ticker</th>
            <th className="border-b border-white/10 px-2 py-2 text-left font-mono text-[10.5px] uppercase tracking-wider text-zinc-400">Société</th>
            <th className="border-b border-white/10 px-2 py-2 text-right font-mono text-[10.5px] uppercase tracking-wider text-zinc-400">Pages vues</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, TOP_N).map((r) => {
            const views = r.views ?? r.total_views ?? 0;
            return (
              <tr key={r.ticker} className="hover:bg-white/[0.02]">
                <td className="border-b border-white/5 px-2 py-1 font-mono text-[10.5px] text-zinc-500">{r.rank}</td>
                <td className="border-b border-white/5 px-2 py-1">
                  <a href={`/sandbox/v1-8/${r.ticker.toLowerCase()}`} target="_blank" rel="noopener" className="font-mono font-semibold text-zinc-50 hover:text-violet-300">
                    {r.ticker}
                  </a>
                </td>
                <td className="border-b border-white/5 px-2 py-1 text-zinc-300">{r.name}</td>
                <td className="border-b border-white/5 px-2 py-1 text-right font-mono tabular-nums text-zinc-300">
                  {views.toLocaleString("fr-FR")}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function downloadCSV(data: PopularData) {
  const lines: string[] = ["lang,rank,ticker,name,views"];
  for (const [lang, rows] of Object.entries(data)) {
    if (lang.startsWith("_") || !Array.isArray(rows)) continue;
    for (const r of rows as PopularRow[]) {
      const views = r.views ?? r.total_views ?? 0;
      const name = String(r.name || "").replace(/"/g, '""');
      lines.push(`${lang},${r.rank},${r.ticker},"${name}",${views}`);
    }
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `popular-stocks-by-language.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function PopulaireClient({
  data,
  country,
  visitorLangs,
  siteLangs,
  langLabel,
  labels,
}: {
  data: PopularData;
  country: string;
  visitorLangs: string[];
  siteLangs: string[];
  langLabel: Record<string, string>;
  labels: Labels;
}) {
  const [showAll, setShowAll] = useState<Record<string, boolean>>({});

  const hasData = useMemo(() => {
    return Object.keys(data).some((k) => !k.startsWith("_") && Array.isArray(data[k]) && (data[k] as PopularRow[]).length > 0);
  }, [data]);

  // Order : visitor langs first, then world, then other site langs.
  const visitorBlocks = visitorLangs.length > 0 ? visitorLangs : [];
  const otherLangs = siteLangs.filter((l) => !visitorBlocks.includes(l));

  return (
    <div className="min-h-screen bg-[#050507] text-zinc-100">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-[30px] font-bold tracking-tight">{labels.title}</h1>
            <p className="text-[13.5px] text-zinc-400">{labels.subtitle}</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => downloadCSV(data)}
              className="rounded-md border border-violet-500/40 bg-violet-500/[0.06] px-3 py-1.5 text-[12px] text-violet-200 hover:bg-violet-500/15"
              disabled={!hasData}
            >
              ⤓ {labels.download_csv}
            </button>
          </div>
        </div>

        {!hasData ? (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/[0.05] p-4 text-[13px] text-amber-200">
            <p>📊 Collecte des données Wikipedia en cours…</p>
            <p className="mt-2 text-[12px] text-amber-300/70">
              Re-charge la page dans ~30 min. Le script `build-popular-stocks-wikipedia.py`
              alimente <code>src/data/popular-stocks-by-language.json</code>.
            </p>
          </div>
        ) : null}

        {/* PRIORITÉ 1 : pays du visiteur */}
        {visitorBlocks.length > 0 ? (
          <section className="mb-8">
            <h2 className="mb-2 text-[14px] font-semibold uppercase tracking-wider text-violet-300">
              {labels.your_country} ({labels.country})
            </h2>
            {visitorBlocks.map((lang) => (
              <TableBlock
                key={`visitor-${lang}`}
                title={langLabel[lang] || lang}
                subtitle={`Top ${TOP_N} sur Wikipedia ${lang}`}
                rows={(data[lang] as PopularRow[]) ?? []}
                accent="#8b5cf6"
              />
            ))}
          </section>
        ) : null}

        {/* PRIORITÉ 2 : Monde */}
        <section className="mb-8">
          <h2 className="mb-2 text-[14px] font-semibold uppercase tracking-wider text-zinc-300">
            {labels.world}
          </h2>
          <TableBlock
            title="Top mondial (somme pages vues toutes langues)"
            subtitle={`Top ${TOP_N} : popularité globale tous Wikipedia`}
            rows={(data.world as PopularRow[]) ?? []}
            accent="#06b6d4"
          />
        </section>

        {/* PRIORITÉ 3 : Autres langues du site */}
        <section className="mb-8">
          <h2 className="mb-2 text-[14px] font-semibold uppercase tracking-wider text-zinc-400">
            {labels.other_langs}
          </h2>
          {otherLangs.map((lang) => (
            <TableBlock
              key={`other-${lang}`}
              title={langLabel[lang] || lang}
              subtitle={`Top ${TOP_N} sur Wikipedia ${lang}`}
              rows={(data[lang] as PopularRow[]) ?? []}
            />
          ))}
        </section>

        <p className="mt-3 text-[11px] text-zinc-500">
          Source : <strong>{labels.powered}</strong> · Fenêtre : <strong>{labels.window}</strong> ·
          Pays détecté visiteur : <strong>{labels.country}</strong>.
          Univers : top 307 V1.8 ∪ SP500 (~673 stés). Pages vues = proxy popularité retail
          investors (objectif, multilingue, free). Pas le même que "actions les plus tradées
          sur les brokers". C'est une approximation honnête.
        </p>
      </div>
    </div>
  );
}
