"use client";

import { Plus, X } from "lucide-react";

/**
 * MOCKUP — Comparaison N-vs-N (3-5 sociétés en simultané).
 * Aujourd'hui l'app fait 1-vs-1. Cible V2 : tableau comparatif jusqu'à 5.
 */

const COMPANIES = [
  { ticker: "GOOGL", name: "Alphabet", color: "#a78bfa" },
  { ticker: "META", name: "Meta", color: "#22d3ee" },
  { ticker: "MSFT", name: "Microsoft", color: "#fb7185" },
  { ticker: "AMZN", name: "Amazon", color: "#facc15" },
];

const KPIS = [
  { label: "Revenue 2024", values: ["350,2", "164,5", "245,1", "574,8"], unit: "Mds $" },
  { label: "Croissance YoY", values: ["+13,8 %", "+22,0 %", "+15,7 %", "+11,1 %"], colors: ["#10b981", "#10b981", "#10b981", "#10b981"] },
  { label: "Marge opérationnelle", values: ["32,1 %", "38,4 %", "44,6 %", "11,3 %"] },
  { label: "ROE", values: ["28,9 %", "37,2 %", "33,5 %", "21,8 %"] },
  { label: "Free Cash Flow", values: ["72,8", "52,1", "73,9", "32,9"], unit: "Mds $" },
  { label: "Net Debt / EBITDA", values: ["-1,2x", "-0,8x", "-0,4x", "1,1x"] },
  { label: "P/E ratio", values: ["28,4x", "26,1x", "37,2x", "53,8x"] },
  { label: "Score qualité KPI", values: ["9,1 / 10", "8,7 / 10", "9,4 / 10", "7,8 / 10"], colors: ["#10b981", "#10b981", "#10b981", "#facc15"] },
  { label: "Score risque global", values: ["2,1 / 5", "2,8 / 5", "1,9 / 5", "3,4 / 5"], colors: ["#10b981", "#facc15", "#10b981", "#f43f5e"] },
];

export function MockupCompareN() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <div className="mb-4 rounded-lg border border-amber-500/20 bg-amber-500/[0.04] p-3 text-[12px] text-amber-200">
        ⚠️ <strong>Mockup statique</strong> : comparaison 4 sociétés, vue table. Aujourd'hui l'app compare 1-vs-1, cible V2 = jusqu'à 5.
      </div>

      <h2 className="mb-4 font-display text-[24px] font-bold tracking-tight text-zinc-50">
        Comparaison N-vs-N
      </h2>

      <div className="overflow-hidden rounded-2xl border border-white/8 bg-white/[0.02]">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-white/8 bg-white/[0.02]">
              <th className="px-4 py-3 text-left font-mono text-[10.5px] uppercase tracking-wider text-zinc-400">KPI</th>
              {COMPANIES.map((c) => (
                <th key={c.ticker} className="px-4 py-3 text-right">
                  <div className="inline-flex items-center gap-2">
                    <span className="font-mono text-[11px] font-bold uppercase tracking-wider" style={{ color: c.color }}>{c.ticker}</span>
                    <span className="text-[12px] font-medium text-zinc-100">{c.name}</span>
                    <button className="text-zinc-600 hover:text-rose-400"><X className="size-3" /></button>
                  </div>
                </th>
              ))}
              <th className="px-4 py-3">
                <button className="inline-flex items-center gap-1 rounded-md border border-violet-500/40 bg-violet-500/15 px-2 py-1 text-[11px] text-violet-100">
                  <Plus className="size-3" />Ajouter
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {KPIS.map((k, i) => (
              <tr key={k.label} className={i % 2 === 0 ? "bg-white/[0.01]" : ""}>
                <td className="px-4 py-2.5 text-zinc-400">{k.label}</td>
                {k.values.map((v, j) => (
                  <td key={j} className="px-4 py-2.5 text-right font-mono tabular-nums" style={{ color: k.colors?.[j] ?? "#fafafa" }}>
                    {v}{k.unit && <span className="ml-1 text-[10px] text-zinc-500">{k.unit}</span>}
                  </td>
                ))}
                <td />
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 rounded-2xl border border-white/8 bg-white/[0.02] p-5">
        <h3 className="mb-3 text-[14px] font-semibold text-zinc-100">Vue spider (radar) : alternative</h3>
        <div className="flex h-64 items-center justify-center text-[11px] text-zinc-500">
          [ radar chart : 6 axes (Croissance, Marge, ROE, FCF, Risque, Qualité) × 4 polygones colorés ]
        </div>
      </div>
    </div>
  );
}
