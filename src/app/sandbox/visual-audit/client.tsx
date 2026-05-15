"use client";

import { useMemo, useState } from "react";

type Fail = { id: string; severity: number; obs: string };
type Row = {
  ticker: string;
  url: string;
  ts?: string;
  n_fails?: number;
  blocker?: boolean;
  fails?: Fail[];
  error?: string;
};

const SEV_COLOR: Record<number, string> = {
  5: "bg-red-500/20 text-red-300 border-red-500/40",
  4: "bg-orange-500/20 text-orange-300 border-orange-500/40",
  3: "bg-amber-500/20 text-amber-300 border-amber-500/40",
  2: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
  1: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30",
};

export function VisualAuditClient({ rows, updatedAt }: { rows: Row[]; updatedAt: string }) {
  const [filter, setFilter] = useState<"all" | "blocker" | "any_fail" | "ok" | "error">("any_fail");
  const [sevFilter, setSevFilter] = useState<number>(0);
  const [expanded, setExpanded] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return rows
      .filter((r) => {
        if (filter === "blocker") return r.blocker;
        if (filter === "any_fail") return (r.n_fails ?? 0) > 0;
        if (filter === "ok") return !r.error && (r.n_fails ?? 0) === 0;
        if (filter === "error") return !!r.error;
        return true;
      })
      .filter((r) => {
        if (!sevFilter) return true;
        return (r.fails || []).some((f) => f.severity >= sevFilter);
      })
      .sort((a, b) => (b.n_fails ?? 0) - (a.n_fails ?? 0) || a.ticker.localeCompare(b.ticker));
  }, [rows, filter, sevFilter]);

  const stats = useMemo(() => {
    const n = rows.length;
    const blocker = rows.filter((r) => r.blocker).length;
    const any = rows.filter((r) => (r.n_fails ?? 0) > 0).length;
    const ok = rows.filter((r) => !r.error && (r.n_fails ?? 0) === 0).length;
    const err = rows.filter((r) => r.error).length;
    return { n, blocker, any, ok, err };
  }, [rows]);

  return (
    <div className="min-h-screen bg-[#050507] text-zinc-100">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <header className="mb-6">
          <h1 className="font-display text-[30px] font-bold tracking-tight">Visual Audit · Gemini 2.5 Flash</h1>
          <p className="mt-1 text-[13.5px] text-zinc-400">
            Audit visuel automatisé des fiches société. Template :
            <code className="ml-1 rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-[11px]">scripts/visual-audit-template.yaml</code>
            {" · "}Mis à jour : <strong>{updatedAt ? new Date(updatedAt).toLocaleString("fr-FR") : "—"}</strong>
          </p>
        </header>

        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Stat label="Auditées" value={stats.n} accent="text-zinc-100" />
          <Stat label="OK (0 fail)" value={stats.ok} accent="text-emerald-300" />
          <Stat label="≥ 1 fail" value={stats.any} accent="text-amber-300" />
          <Stat label="Blocker" value={stats.blocker} accent="text-red-300" />
          <Stat label="Erreurs audit" value={stats.err} accent="text-zinc-500" />
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <label className="text-[12px] uppercase tracking-wide text-zinc-500">Filtre :</label>
          {(["any_fail", "blocker", "ok", "all", "error"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={`rounded-md border px-2.5 py-1 text-[12px] ${filter === k ? "border-violet-500/60 bg-violet-500/[0.12] text-violet-100" : "border-white/10 bg-white/[0.04] text-zinc-300 hover:bg-white/[0.07]"}`}
            >
              {k === "any_fail" ? "≥1 fail" : k === "blocker" ? "blocker" : k === "ok" ? "OK" : k === "error" ? "erreurs" : "tout"}
            </button>
          ))}
          <span className="mx-2 text-zinc-700">|</span>
          <label className="text-[12px] uppercase tracking-wide text-zinc-500">Sev min :</label>
          {[0, 2, 3, 4, 5].map((s) => (
            <button
              key={s}
              onClick={() => setSevFilter(s)}
              className={`rounded-md border px-2 py-1 font-mono text-[11px] ${sevFilter === s ? "border-violet-500/60 bg-violet-500/[0.12] text-violet-100" : "border-white/10 bg-white/[0.04] text-zinc-300"}`}
            >
              {s === 0 ? "—" : `≥${s}`}
            </button>
          ))}
        </div>

        <div className="rounded-lg border border-white/10 bg-[#080808]">
          <table className="w-full border-collapse text-[12.5px]">
            <thead className="bg-[#0c0c0c]">
              <tr className="text-left">
                <th className="border-b border-white/10 px-3 py-2 font-mono text-[10.5px] uppercase tracking-wider text-zinc-400">Ticker</th>
                <th className="border-b border-white/10 px-3 py-2 font-mono text-[10.5px] uppercase tracking-wider text-zinc-400">Statut</th>
                <th className="border-b border-white/10 px-3 py-2 text-right font-mono text-[10.5px] uppercase tracking-wider text-zinc-400">Fails</th>
                <th className="border-b border-white/10 px-3 py-2 font-mono text-[10.5px] uppercase tracking-wider text-zinc-400">Top défauts</th>
                <th className="border-b border-white/10 px-3 py-2 font-mono text-[10.5px] uppercase tracking-wider text-zinc-400">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const isExpanded = expanded === r.ticker;
                return (
                  <FragmentRow
                    key={r.ticker}
                    row={r}
                    isExpanded={isExpanded}
                    onToggle={() => setExpanded(isExpanded ? null : r.ticker)}
                  />
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-[12.5px] text-zinc-500">
                    Aucune fiche ne matche ces filtres.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-[11.5px] text-zinc-500">
          Source : <strong>Gemini 2.5 Flash</strong> via Google AI Studio (free tier 1500 req/jour). Screenshot Chrome
          headless 1280×2400, full-page. Pour relancer un audit :
          <code className="mx-1 rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-[11px]">python3 scripts/visual-audit-gemini.py --tickers AAPL,MSFT</code>
          ou
          <code className="mx-1 rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-[11px]">--top307</code>
          (≈ 11 min, sleep 2s entre calls).
        </p>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-[#080808] px-3 py-2">
      <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">{label}</p>
      <p className={`mt-0.5 font-mono text-[20px] tabular-nums ${accent}`}>{value}</p>
    </div>
  );
}

function FragmentRow({ row, isExpanded, onToggle }: { row: Row; isExpanded: boolean; onToggle: () => void }) {
  const topFails = (row.fails || []).slice().sort((a, b) => b.severity - a.severity).slice(0, 3);
  const status = row.error ? "error" : row.blocker ? "blocker" : (row.n_fails ?? 0) > 0 ? "warn" : "ok";
  return (
    <>
      <tr className="hover:bg-white/[0.02]">
        <td className="border-b border-white/5 px-3 py-2 font-mono font-semibold text-zinc-100">{row.ticker}</td>
        <td className="border-b border-white/5 px-3 py-2">
          <StatusBadge status={status} />
        </td>
        <td className="border-b border-white/5 px-3 py-2 text-right font-mono tabular-nums text-zinc-300">
          {row.error ? "—" : row.n_fails ?? 0}
        </td>
        <td className="border-b border-white/5 px-3 py-2">
          {row.error ? (
            <span className="text-zinc-500">{row.error}</span>
          ) : topFails.length === 0 ? (
            <span className="text-emerald-400/80">aucun défaut</span>
          ) : (
            <div className="flex flex-wrap gap-1">
              {topFails.map((f, i) => (
                <span key={i} className={`rounded border px-1.5 py-0.5 font-mono text-[10px] ${SEV_COLOR[f.severity]}`} title={f.obs}>
                  {f.id}
                </span>
              ))}
              {(row.fails?.length ?? 0) > 3 && <span className="text-zinc-500">+{(row.fails!.length - 3)}</span>}
            </div>
          )}
        </td>
        <td className="border-b border-white/5 px-3 py-2">
          <div className="flex items-center gap-2">
            <a href={row.url} target="_blank" rel="noopener" className="text-violet-300 hover:text-violet-200 text-[11.5px]">
              ouvrir ↗
            </a>
            {(row.fails?.length ?? 0) > 0 && (
              <button onClick={onToggle} className="rounded border border-white/10 px-1.5 py-0.5 text-[11px] text-zinc-300 hover:bg-white/[0.06]">
                {isExpanded ? "−" : "+"}
              </button>
            )}
          </div>
        </td>
      </tr>
      {isExpanded && (row.fails?.length ?? 0) > 0 && (
        <tr>
          <td colSpan={5} className="border-b border-white/5 bg-black/40 px-3 py-3">
            <ul className="space-y-1">
              {row.fails!.slice().sort((a, b) => b.severity - a.severity).map((f, i) => (
                <li key={i} className="flex items-start gap-2 text-[12px]">
                  <span className={`mt-0.5 inline-block rounded border px-1.5 py-0.5 font-mono text-[10px] ${SEV_COLOR[f.severity]}`}>S{f.severity}</span>
                  <span className="font-mono text-zinc-400">{f.id}</span>
                  <span className="text-zinc-200">— {f.obs || "(pas d'observation)"}</span>
                </li>
              ))}
            </ul>
          </td>
        </tr>
      )}
    </>
  );
}

function StatusBadge({ status }: { status: "ok" | "warn" | "blocker" | "error" }) {
  const map = {
    ok: { label: "OK", c: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" },
    warn: { label: "à revoir", c: "bg-amber-500/20 text-amber-300 border-amber-500/40" },
    blocker: { label: "BLOCKER", c: "bg-red-500/20 text-red-300 border-red-500/40" },
    error: { label: "audit fail", c: "bg-zinc-500/20 text-zinc-300 border-zinc-500/40" },
  } as const;
  const { label, c } = map[status];
  return <span className={`rounded border px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-wider ${c}`}>{label}</span>;
}
