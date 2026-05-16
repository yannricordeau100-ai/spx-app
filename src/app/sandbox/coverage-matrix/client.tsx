"use client";

import { useMemo, useState } from "react";
import type { Row, BlockStatus } from "./page";

const COLUMNS: Array<{ key: string; label: string; short: string }> = [
  { key: "hero_kpi", label: "Hero KPI", short: "Hero" },
  { key: "hero_history", label: "Hero history ≥4", short: "Hist" },
  { key: "kpis_count", label: "KPIs ≥5", short: "KPIs" },
  { key: "risks", label: "Risks ≥3", short: "Risks" },
  { key: "governance", label: "Governance CEO", short: "Gov" },
  { key: "ai_pos", label: "AI stance", short: "AI" },
  { key: "segment", label: "Revenue segment", short: "Seg" },
  { key: "geography", label: "Revenue geo", short: "Geo" },
  { key: "customer_type", label: "Customer type", short: "Cust" },
  { key: "events", label: "Events ≥2", short: "Evts" },
  { key: "tam", label: "TAM (honesty)", short: "TAM" },
  { key: "description", label: "Company desc.", short: "Desc" },
  { key: "freshness", label: "Last data date", short: "Fresh" },
  { key: "ranks", label: "Ranks", short: "Rank" },
  { key: "logo", label: "Logo PNG", short: "Logo" },
  { key: "transcript", label: "Transcript summ.", short: "Trans" },
  { key: "dividend", label: "Bloc Dividende", short: "Div" },
];

function cellColor(s: BlockStatus | undefined) {
  if (!s) return { bg: "#0a0a0a", fg: "#52525b", char: "·", title: "missing" };
  const { a, b, c } = s;
  if (a && b && c) return { bg: "#10b98122", fg: "#10b981", char: "✓", title: "A juste · B à jour · C visible" };
  if (a && c && !b) return { bg: "#84cc1622", fg: "#84cc16", char: "✓", title: "A juste · ⚠ B stale · C visible" };
  if (a && !c) return { bg: "#f59e0b22", fg: "#f59e0b", char: "⚠", title: "A juste mais composant cache (C non visible)" };
  if (!a && c) return { bg: "#fb718522", fg: "#fb7185", char: "⚠", title: "C visible mais A non valide (data douteuse)" };
  return { bg: "#0a0a0a", fg: "#52525b", char: "·", title: "missing" };
}

export function CoverageClient({ initialRows }: { initialRows: Row[] }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "top307" | "v17" | "unfit">("all");
  const [view, setView] = useState<"composite" | "abc">("composite");

  const filtered = useMemo(() => {
    let out = initialRows;
    if (filter === "top307") out = out.filter((r) => r.in_top307);
    else if (filter === "v17") out = out.filter((r) => r.in_v17);
    else if (filter === "unfit") out = out.filter((r) => !r.fit);
    if (search.trim()) {
      const q = search.toLowerCase();
      out = out.filter((r) => r.ticker.toLowerCase().includes(q) || r.name.toLowerCase().includes(q));
    }
    return out;
  }, [initialRows, search, filter]);

  const counts = useMemo(() => ({
    total: initialRows.length,
    in_v17: initialRows.filter((r) => r.in_v17).length,
    in_top307: initialRows.filter((r) => r.in_top307).length,
    unfit: initialRows.filter((r) => !r.fit).length,
  }), [initialRows]);

  const colCoverage = useMemo(() => COLUMNS.map(({ key, label }) => {
    const ok = filtered.filter((r) => {
      const s = r.blocks[key];
      return s?.a && s?.b && s?.c;
    }).length;
    return { key, label, ok, total: filtered.length };
  }), [filtered]);

  return (
    <div className="min-h-screen bg-[#050507] text-zinc-100">
      <div className="mx-auto max-w-[1700px] px-4 py-6">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-[28px] font-bold tracking-tight">Coverage Matrix</h1>
            <p className="text-[13px] text-zinc-400">
              État temps réel par sté × bloc (lecture dynamique v2-pipeline + enrich).
              Légende cellule : <span className="font-mono text-emerald-400">✓ A+B+C OK</span>{" "}
              · <span className="font-mono text-lime-400">✓ A+C OK, B stale</span>{" "}
              · <span className="font-mono text-amber-400">⚠ A OK, composant cache (C ✗)</span>{" "}
              · <span className="font-mono text-rose-400">⚠ C visible mais A douteux</span>{" "}
              · <span className="font-mono text-zinc-500">· manquant</span>.
              <br />
              <span className="text-[12px]">
                A = data juste (présente, structure correcte) · B = à jour (≤12 mois) · C = visible (composant React rend bien le bloc, simulé)
              </span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
            <span className="rounded border border-white/10 bg-white/[0.03] px-2 py-1">Total <b className="text-zinc-50">{counts.total}</b></span>
            <span className="rounded border border-emerald-500/40 bg-emerald-500/[0.06] px-2 py-1">V1.7 <b className="text-emerald-300">{counts.in_v17}</b></span>
            <span className="rounded border border-violet-500/40 bg-violet-500/[0.06] px-2 py-1">Top 307 <b className="text-violet-300">{counts.in_top307}</b></span>
            <span className="rounded border border-red-500/40 bg-red-500/[0.06] px-2 py-1">Unfit <b className="text-red-300">{counts.unfit}</b></span>
          </div>
        </div>

        <div className="mb-3 flex flex-wrap gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filtrer (ticker, nom)…"
            className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[13px] outline-none focus:border-violet-500/50"
          />
          {([
            ["all", `Toutes (${initialRows.length})`],
            ["top307", `Top 307 (${counts.in_top307})`],
            ["v17", `V1.7 (${counts.in_v17})`],
            ["unfit", `Unfit (${counts.unfit})`],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={"rounded-md border px-3 py-1.5 text-[12px] transition-colors " + (filter === key ? "border-violet-500/60 bg-violet-500/15 text-violet-200" : "border-white/10 bg-white/[0.03] text-zinc-300 hover:bg-white/[0.06]")}
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setView(view === "composite" ? "abc" : "composite")}
            className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[12px] text-zinc-300 hover:bg-white/[0.06]"
            title="Bascule entre vue composite (1 icône) et vue ABC (3 sous-cellules)"
          >
            Vue : {view === "composite" ? "composite" : "A/B/C détail"}
          </button>
        </div>

        <div className="mb-2 grid auto-cols-max grid-flow-col gap-1 overflow-x-auto rounded-md border border-white/10 bg-[#080808] p-2 font-mono text-[10px]">
          {colCoverage.map((c) => {
            const pct = c.total > 0 ? Math.round((100 * c.ok) / c.total) : 0;
            const color = pct >= 80 ? "text-emerald-400" : pct >= 50 ? "text-amber-400" : "text-zinc-500";
            return (
              <div key={c.key} className="min-w-[80px] px-1.5 py-0.5 text-center">
                <div className="text-[9px] uppercase tracking-wider text-zinc-500">{c.label}</div>
                <div className={`text-[12px] font-bold ${color}`}>{pct}%</div>
                <div className="text-[9px] text-zinc-500">{c.ok}/{c.total}</div>
              </div>
            );
          })}
        </div>

        <div className="overflow-x-auto rounded-md border border-white/10 bg-[#080808]">
          <table className="w-full border-collapse text-[11px]">
            <thead className="sticky top-0 z-10 bg-[#0c0c0c]">
              <tr>
                <th className="border-b border-white/10 px-2 py-2 text-left font-mono uppercase tracking-wider text-zinc-400">#</th>
                <th className="sticky left-0 z-20 border-b border-white/10 bg-[#0c0c0c] px-2 py-2 text-left font-mono uppercase tracking-wider text-zinc-400">Ticker</th>
                <th className="border-b border-white/10 px-2 py-2 text-left font-mono uppercase tracking-wider text-zinc-400">Nom</th>
                <th className="border-b border-white/10 px-2 py-2 text-center font-mono uppercase tracking-wider text-zinc-400">V1.7</th>
                {COLUMNS.map((c) => (
                  <th
                    key={c.key}
                    title={c.label}
                    className="border-b border-l border-white/10 px-1 py-2 text-center font-mono text-[9.5px] uppercase tracking-wider text-zinc-400"
                  >
                    {c.short}
                  </th>
                ))}
                <th className="border-b border-l border-white/10 px-1 py-2 text-center font-mono text-[9.5px] uppercase tracking-wider text-emerald-300">Good</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 2500).map((r, i) => (
                <tr key={r.ticker} className={`hover:bg-white/[0.02] ${r.adr_duplicate_of ? "opacity-50" : ""}`}>
                  <td className="border-b border-white/5 px-2 py-1 font-mono text-[9.5px] text-zinc-500">{i + 1}</td>
                  <td className="sticky left-0 z-10 border-b border-white/5 bg-[#080808] px-2 py-1 font-mono text-[11px] font-semibold text-zinc-50">
                    <a
                      href={`/sandbox/v1-8/${r.ticker.toLowerCase()}`}
                      target="_blank"
                      rel="noopener"
                      className={`hover:text-violet-300 ${r.adr_duplicate_of ? "text-zinc-500 line-through" : ""}`}
                      title={r.adr_duplicate_of ? `ADR doublon de ${r.adr_duplicate_of} — masqué du frontend` : undefined}
                    >
                      {r.ticker}
                    </a>
                    {r.in_top307 ? <span className="ml-1 inline-block rounded bg-violet-500/20 px-1 text-[8px] text-violet-300">307</span> : null}
                    {r.adr_duplicate_of ? <span className="ml-1 inline-block rounded bg-zinc-700/40 px-1 text-[8px] text-zinc-400" title={`ADR doublon de ${r.adr_duplicate_of}`}>ADR→{r.adr_duplicate_of}</span> : null}
                  </td>
                  <td className={`max-w-[240px] truncate border-b border-white/5 px-2 py-1 ${r.adr_duplicate_of ? "text-zinc-600 line-through" : "text-zinc-300"}`}>{r.name}</td>
                  <td className="border-b border-white/5 px-2 py-1 text-center text-[12px]">
                    {r.in_v17 ? <span className="text-emerald-400">✓</span> : <span className="text-red-400">✗</span>}
                  </td>
                  {COLUMNS.map((c) => {
                    const s = r.blocks[c.key];
                    if (view === "abc" && s) {
                      return (
                        <td key={c.key} className="border-b border-l border-white/5 px-0.5 py-1 text-center" title={c.label}>
                          <div className="flex justify-center gap-0.5 font-mono text-[9px]">
                            <span className={s.a ? "text-emerald-400" : "text-zinc-600"}>A</span>
                            <span className={s.b ? "text-emerald-400" : "text-zinc-600"}>B</span>
                            <span className={s.c ? "text-emerald-400" : "text-zinc-600"}>C</span>
                          </div>
                        </td>
                      );
                    }
                    const cl = cellColor(s);
                    return (
                      <td
                        key={c.key}
                        title={`${c.label}: ${cl.title}`}
                        className="border-b border-l border-white/5 px-1 py-1 text-center"
                        style={{ background: cl.bg, color: cl.fg }}
                      >
                        <span className="font-mono text-[12px]">{cl.char}</span>
                      </td>
                    );
                  })}
                  <td className="border-b border-l border-white/5 px-1 py-1 text-center font-mono text-[10px] text-emerald-300">
                    {r.good_count}/{COLUMNS.length}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length > 2500 ? (
            <div className="border-t border-white/10 px-3 py-2 text-center font-mono text-[10px] text-zinc-500">
              Affichage limité à 2500 lignes sur {filtered.length}. Affinez le filtre.
            </div>
          ) : null}
        </div>

        <p className="mt-3 text-[11px] text-zinc-500">
          SSR <code>force-dynamic</code> : refresh navigateur = état réel actuel. Score « Good » = nombre de blocs ayant A+B+C OK simultanément.
        </p>
      </div>
    </div>
  );
}
