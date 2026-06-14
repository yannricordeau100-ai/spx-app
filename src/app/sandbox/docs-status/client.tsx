"use client";

import { useState, useMemo } from "react";
import inventory from "@/data/docs-inventory.json";

type Row = {
  t: string; sp: boolean; v: boolean;
  er: number; es: number; kpiq: boolean; wow: boolean;
  c: Record<string, number>;
};
const INV = inventory as unknown as Row[];
const TYPES = ["10-K", "10-Q", "8-K", "20-F", "DEF14A", "supplement", "transcript", "investor-day", "ESG", "annual-report", "half-year", "autre"];

export function DocsStatusClient() {
  const [q, setQ] = useState("");
  const [eserOnly, setEserOnly] = useState(false);
  const [univ, setUniv] = useState<"all" | "sp" | "v">("all");
  const [sort, setSort] = useState<"eser" | "ticker" | "docs">("eser");

  const totalDocs = (x: Row) => Object.values(x.c).reduce((a, b) => a + b, 0);
  const rows = useMemo(() => {
    const r = INV.filter((x) =>
      (!q || x.t.toLowerCase().includes(q.toLowerCase())) &&
      (!eserOnly || x.er > 0 || x.es > 0) &&
      (univ === "all" || (univ === "sp" && x.sp) || (univ === "v" && x.v))
    );
    return [...r].sort((a, b) =>
      sort === "ticker" ? a.t.localeCompare(b.t)
        : sort === "docs" ? totalDocs(b) - totalDocs(a)
          : (b.er + b.es) - (a.er + a.es) || totalDocs(b) - totalDocs(a)
    );
  }, [q, eserOnly, univ, sort]);

  const spEser = INV.filter((x) => x.sp && (x.er > 0 || x.es > 0)).length;
  const eserAll = INV.filter((x) => x.er > 0 || x.es > 0).length;

  return (
    <div className="mx-auto max-w-6xl p-6 text-zinc-200">
      <h1 className="text-2xl font-bold text-zinc-50">Documents par société</h1>
      <p className="mt-1 text-sm text-zinc-400">
        SP500 avec ES ou ER : <b className="text-emerald-400">{spEser}/503</b>{" · "}
        toutes stés avec ES/ER : {eserAll}{" · "}total : {INV.length}{" · "}affichées : {rows.length}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Ticker…"
          className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm outline-none focus:border-zinc-500"
        />
        <button
          onClick={() => setEserOnly((v) => !v)}
          className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${eserOnly ? "border-emerald-500 bg-emerald-500/20 text-emerald-300" : "border-zinc-700 text-zinc-400 hover:text-zinc-200"}`}
        >
          ES/ER seulement
        </button>
        {(["all", "sp", "v"] as const).map((u) => (
          <button
            key={u}
            onClick={() => setUniv(u)}
            className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${univ === u ? "border-violet-500 bg-violet-500/20 text-violet-300" : "border-zinc-700 text-zinc-400 hover:text-zinc-200"}`}
          >
            {u === "all" ? "Toutes" : u === "sp" ? "SP500" : "V1.9.5"}
          </button>
        ))}
        <span className="ml-2 text-xs text-zinc-500">trier :</span>
        {(["eser", "docs", "ticker"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSort(s)}
            className={`rounded border px-2 py-1 text-xs transition-colors ${sort === s ? "border-zinc-400 text-zinc-100" : "border-zinc-700 text-zinc-500 hover:text-zinc-300"}`}
          >
            {s === "eser" ? "ES/ER" : s === "docs" ? "nb docs" : "ticker"}
          </button>
        ))}
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full whitespace-nowrap text-sm">
          <thead>
            <tr className="border-b border-zinc-700 text-left text-[11px] uppercase tracking-wide text-zinc-500">
              <th className="py-2 pr-3">Ticker</th>
              <th className="px-2 text-emerald-500">ER</th>
              <th className="px-2 text-sky-500">ES</th>
              {TYPES.map((t) => <th key={t} className="px-2">{t}</th>)}
              <th className="px-2">KPI</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((x) => (
              <tr key={x.t} className="border-b border-zinc-800/60 hover:bg-white/5">
                <td className="py-1.5 pr-3 font-mono font-semibold text-zinc-100">
                  {x.t}{x.sp && <span className="ml-1 text-[9px] text-zinc-500">SP</span>}
                </td>
                <td className={`px-2 ${x.er ? "font-bold text-emerald-400" : "text-zinc-700"}`}>{x.er || "-"}</td>
                <td className={`px-2 ${x.es ? "font-bold text-sky-400" : "text-zinc-700"}`}>{x.es || "-"}</td>
                {TYPES.map((t) => <td key={t} className={`px-2 ${x.c[t] ? "text-zinc-300" : "text-zinc-700"}`}>{x.c[t] || "-"}</td>)}
                <td className="px-2 text-xs">
                  {x.wow && <span className="font-semibold text-amber-400">wow </span>}
                  {x.kpiq && <span className="text-zinc-400">q</span>}
                  {!x.wow && !x.kpiq && <span className="text-zinc-700">-</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
