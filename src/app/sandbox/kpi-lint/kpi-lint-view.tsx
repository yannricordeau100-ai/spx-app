"use client";

import { useMemo, useState } from "react";

type Issue = {
  ticker: string;
  kpi: string;
  rule: string;
  severity: "rouge" | "orange";
  detail: string;
};

type Report = {
  generated_at: string;
  universe: number;
  stes_avec_issues: number;
  total_issues: number;
  rouges: number;
  oranges: number;
  by_rule: Record<string, number>;
  rules: Record<string, { label: string; desc: string }>;
  issues: Issue[];
};

export function KpiLintView({ report }: { report: Report }) {
  const [ruleFilter, setRuleFilter] = useState<string>("");
  const [sevFilter, setSevFilter] = useState<string>("");
  const [tickerFilter, setTickerFilter] = useState<string>("");

  const byTicker = useMemo(() => {
    const m: Record<string, { rouges: number; oranges: number }> = {};
    for (const i of report.issues) {
      m[i.ticker] = m[i.ticker] || { rouges: 0, oranges: 0 };
      if (i.severity === "rouge") m[i.ticker].rouges++;
      else m[i.ticker].oranges++;
    }
    return Object.entries(m).sort((a, b) => b[1].rouges - a[1].rouges || b[1].oranges - a[1].oranges);
  }, [report.issues]);

  const filtered = useMemo(
    () =>
      report.issues.filter(
        (i) =>
          (!ruleFilter || i.rule === ruleFilter) &&
          (!sevFilter || i.severity === sevFilter) &&
          (!tickerFilter || i.ticker === tickerFilter),
      ),
    [report.issues, ruleFilter, sevFilter, tickerFilter],
  );

  const cleanStes = report.universe - report.stes_avec_issues;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 text-zinc-100">
      <h1 className="text-2xl font-bold">KPI Lint : conformité de tous les KPI</h1>
      <p className="mt-1 text-sm text-zinc-400">
        Vérification programmatique de chaque KPI de chaque sté ({report.universe} stés) via le loader et les
        fonctions de rendu réels. Généré le {new Date(report.generated_at).toLocaleString("fr-FR")}. Relance :
        <code className="ml-1 rounded bg-white/10 px-1">npx tsx scripts/kpi-lint.ts</code>
      </p>

      {/* Compteurs */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
          <div className="text-2xl font-bold text-emerald-400">{cleanStes}</div>
          <div className="text-xs text-zinc-400">stés 100 % conformes</div>
        </div>
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3">
          <div className="text-2xl font-bold text-rose-400">{report.rouges}</div>
          <div className="text-xs text-zinc-400">anomalies rouges (bloquantes)</div>
        </div>
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
          <div className="text-2xl font-bold text-amber-400">{report.oranges}</div>
          <div className="text-xs text-zinc-400">anomalies oranges (à traiter)</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <div className="text-2xl font-bold">{report.stes_avec_issues}</div>
          <div className="text-xs text-zinc-400">stés avec au moins 1 anomalie</div>
        </div>
      </div>

      {/* Règles */}
      <h2 className="mt-8 text-lg font-semibold">Les règles vérifiées</h2>
      <div className="mt-3 overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/5 text-xs uppercase text-zinc-400">
            <tr>
              <th className="px-3 py-2">Règle</th>
              <th className="px-3 py-2">Définition</th>
              <th className="px-3 py-2 text-right">Anomalies</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(report.rules).map(([id, r]) => (
              <tr
                key={id}
                className={`cursor-pointer border-t border-white/5 hover:bg-white/5 ${ruleFilter === id ? "bg-white/10" : ""}`}
                onClick={() => setRuleFilter(ruleFilter === id ? "" : id)}
              >
                <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">{r.label}</td>
                <td className="px-3 py-2 text-zinc-400">{r.desc}</td>
                <td className={`px-3 py-2 text-right font-mono ${report.by_rule[id] ? "text-rose-400" : "text-emerald-400"}`}>
                  {report.by_rule[id] ?? 0}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Stés les plus touchées */}
      <h2 className="mt-8 text-lg font-semibold">Par sté</h2>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {byTicker.slice(0, 60).map(([t, c]) => (
          <button
            key={t}
            onClick={() => setTickerFilter(tickerFilter === t ? "" : t)}
            className={`rounded-md border px-2 py-0.5 font-mono text-xs ${
              tickerFilter === t
                ? "border-white/40 bg-white/15"
                : c.rouges
                  ? "border-rose-500/40 bg-rose-500/10 text-rose-300"
                  : "border-amber-500/30 bg-amber-500/5 text-amber-300"
            }`}
          >
            {t} {c.rouges > 0 ? `${c.rouges}R` : ""}
            {c.oranges > 0 ? ` ${c.oranges}O` : ""}
          </button>
        ))}
        {byTicker.length > 60 && (
          <span className="px-2 py-0.5 text-xs text-zinc-500">+{byTicker.length - 60} autres</span>
        )}
      </div>

      {/* Détail */}
      <div className="mt-8 flex items-center gap-3">
        <h2 className="text-lg font-semibold">Détail ({filtered.length})</h2>
        <button
          onClick={() => setSevFilter(sevFilter === "rouge" ? "" : "rouge")}
          className={`rounded-md border px-2 py-0.5 text-xs ${sevFilter === "rouge" ? "border-rose-400 bg-rose-500/20" : "border-white/10"}`}
        >
          rouges
        </button>
        <button
          onClick={() => setSevFilter(sevFilter === "orange" ? "" : "orange")}
          className={`rounded-md border px-2 py-0.5 text-xs ${sevFilter === "orange" ? "border-amber-400 bg-amber-500/20" : "border-white/10"}`}
        >
          oranges
        </button>
        {(ruleFilter || tickerFilter || sevFilter) && (
          <button
            onClick={() => {
              setRuleFilter("");
              setTickerFilter("");
              setSevFilter("");
            }}
            className="rounded-md border border-white/10 px-2 py-0.5 text-xs text-zinc-400"
          >
            réinitialiser
          </button>
        )}
      </div>
      <div className="mt-3 overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/5 text-xs uppercase text-zinc-400">
            <tr>
              <th className="px-3 py-2">Sté</th>
              <th className="px-3 py-2">KPI</th>
              <th className="px-3 py-2">Règle</th>
              <th className="px-3 py-2">Détail</th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 400).map((i, n) => (
              <tr key={n} className="border-t border-white/5">
                <td className="px-3 py-1.5 font-mono text-xs">{i.ticker}</td>
                <td className="max-w-[220px] truncate px-3 py-1.5 text-xs">{i.kpi || "(sté)"}</td>
                <td className="whitespace-nowrap px-3 py-1.5">
                  <span
                    className={`rounded px-1.5 py-0.5 font-mono text-[10px] ${
                      i.severity === "rouge" ? "bg-rose-500/15 text-rose-300" : "bg-amber-500/15 text-amber-300"
                    }`}
                  >
                    {report.rules[i.rule]?.label ?? i.rule}
                  </span>
                </td>
                <td className="px-3 py-1.5 text-xs text-zinc-400">{i.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length > 400 && (
          <div className="px-3 py-2 text-xs text-zinc-500">Affichage limité aux 400 premières lignes ; filtre par sté ou règle pour affiner.</div>
        )}
      </div>
    </div>
  );
}
