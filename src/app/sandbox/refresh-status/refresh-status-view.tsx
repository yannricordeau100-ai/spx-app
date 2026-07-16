"use client";

import { useMemo, useState } from "react";

export type RefreshRow = {
  ticker: string;
  name: string;
  lastUpdate: string | null;
  filings: string[];
  blocks: string[];
  status: "todo" | "ok";
};

type Filter = "all" | "todo" | "ok";

function formatDate(iso: string | null): string {
  if (!iso) return "n.d.";
  try {
    return new Date(iso).toLocaleDateString("fr-FR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return iso.slice(0, 10);
  }
}

export type RunHistoryEntry = {
  run_at: string;
  detectees: number;
  traitees: number;
  publiables: number;
  bloquees: number;
  stes: Record<string, {
    statut: string;
    raisons: string[];
    lock1?: { status?: string | null; ok?: number | null; checked?: number | null };
    lock2?: { status?: string | null; kpi_a_jour?: number | null; kpi_total?: number | null };
    audit_issues?: number;
  }>;
};

export function RefreshStatusView({
  rows,
  updatedAt,
  history = [],
}: {
  rows: RefreshRow[];
  history?: RunHistoryEntry[];
  updatedAt: string | null;
}) {
  const [filter, setFilter] = useState<Filter>("all");

  const totals = useMemo(() => {
    const todo = rows.filter((r) => r.status === "todo").length;
    const ok = rows.filter((r) => r.status === "ok").length;
    return { todo, ok };
  }, [rows]);

  const sorted = useMemo(() => {
    const filtered = rows.filter((r) => {
      if (filter === "todo") return r.status === "todo";
      if (filter === "ok") return r.status === "ok";
      return true;
    });
    return [...filtered].sort((a, b) => {
      if (b.filings.length !== a.filings.length) {
        return b.filings.length - a.filings.length;
      }
      return a.ticker.localeCompare(b.ticker);
    });
  }, [rows, filter]);

  function launch(ticker: string) {
    console.log("Lancer maj refresh SEC pour", ticker);
  }

  return (
    <main
      className="min-h-screen text-zinc-100"
      style={{ background: "#0a0a0a" }}
    >
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background:
            "radial-gradient(1200px 600px at 15% 10%, rgba(167,139,250,0.12), transparent 60%), radial-gradient(900px 500px at 85% 90%, rgba(34,211,238,0.10), transparent 60%)",
        }}
      />
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-2 flex items-baseline justify-between">
          <h1 className="font-display text-[28px] font-bold tracking-tight">
            Suivi des rafraîchissements SEC
          </h1>
          <div className="font-mono text-[11px] text-zinc-500">
            Détecté {formatDate(updatedAt)}
          </div>
        </div>
        <p className="mb-6 max-w-3xl text-[13.5px] leading-relaxed text-zinc-400">
          Nouveaux dépôts SEC (8-K / 10-Q / 10-K) détectés par le cron 7h30
          à intégrer dans les blocs sté (risks, stories, profit_warning,
          ai_positioning). Cliquer sur une ligne pour lancer la mise à jour.
        </p>

        <div className="mb-6 flex flex-wrap items-center gap-3">
          <div className="rounded-xl border border-orange-500/40 bg-orange-500/[0.08] px-3 py-2 text-[12.5px]">
            <span className="font-mono text-[15px] font-bold tabular-nums text-orange-200">
              {totals.todo}
            </span>
            <span className="ml-2 text-zinc-300">sociétés à traiter</span>
          </div>
          <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/[0.08] px-3 py-2 text-[12.5px]">
            <span className="font-mono text-[15px] font-bold tabular-nums text-emerald-200">
              {totals.ok}
            </span>
            <span className="ml-2 text-zinc-300">sociétés à jour</span>
          </div>
          <div className="ml-auto flex items-center gap-1 rounded-lg border border-white/[0.08] bg-white/[0.02] p-1 text-[12px]">
            {(["all", "todo", "ok"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={
                  "rounded-md px-3 py-1.5 font-medium transition " +
                  (filter === f
                    ? "bg-violet-500/25 text-violet-100"
                    : "text-zinc-400 hover:text-zinc-200")
                }
              >
                {f === "all" ? "Toutes" : f === "todo" ? "À traiter" : "À jour"}
              </button>
            ))}
          </div>
        </div>

        <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-[12.5px]">
              <thead>
                <tr className="border-b border-white/[0.08] text-left text-[11px] uppercase tracking-wider text-zinc-500">
                  <th className="px-3 py-3 font-semibold">Sté</th>
                  <th className="px-3 py-3 font-semibold">Nom</th>
                  <th className="px-3 py-3 font-semibold">Dernière MAJ blocs</th>
                  <th className="px-3 py-3 font-semibold">Nouveaux dépôts détectés</th>
                  <th className="px-3 py-3 font-semibold">Blocs à régénérer</th>
                  <th className="px-3 py-3 font-semibold">Statut</th>
                  <th className="px-3 py-3 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {sorted.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-3 py-8 text-center text-[12.5px] text-zinc-500"
                    >
                      Aucune sté ne correspond au filtre.
                    </td>
                  </tr>
                )}
                {sorted.map((r) => (
                  <tr
                    key={r.ticker}
                    onClick={() => launch(r.ticker)}
                    className="cursor-pointer border-b border-white/[0.04] transition hover:bg-white/[0.03]"
                  >
                    <td className="px-3 py-2.5 font-mono text-[12.5px] font-semibold tabular-nums text-violet-200">
                      {r.ticker}
                    </td>
                    <td className="px-3 py-2.5 text-zinc-200">{r.name}</td>
                    <td className="px-3 py-2.5 font-mono text-[11.5px] tabular-nums text-zinc-400">
                      {formatDate(r.lastUpdate)}
                    </td>
                    <td className="px-3 py-2.5 text-zinc-300">
                      {r.filings.length > 0 ? (
                        <span>
                          <span className="font-mono text-[12px] font-semibold tabular-nums text-cyan-300">
                            {r.filings.length}
                          </span>
                          <span className="ml-2 text-[11.5px] text-zinc-400">
                            ({r.filings.slice(0, 3).join(" · ")}
                            {r.filings.length > 3
                              ? ` · +${r.filings.length - 3}`
                              : ""}
                            )
                          </span>
                        </span>
                      ) : (
                        <span className="text-zinc-600">0</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      {r.blocks.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {r.blocks.map((b) => (
                            <span
                              key={b}
                              className="rounded-md border border-violet-500/30 bg-violet-500/[0.10] px-1.5 py-0.5 font-mono text-[10.5px] text-violet-200"
                            >
                              {b}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-zinc-600">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      {r.status === "todo" ? (
                        <span className="inline-flex items-center gap-1 rounded-md border border-orange-500/40 bg-orange-500/[0.10] px-2 py-0.5 text-[11px] font-semibold text-orange-200">
                          <span aria-hidden>⚠</span> à traiter
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/40 bg-emerald-500/[0.10] px-2 py-0.5 text-[11px] font-semibold text-emerald-200">
                          <span aria-hidden>✓</span> à jour
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          launch(r.ticker);
                        }}
                        className="rounded-md border border-violet-500/40 bg-violet-500/[0.12] px-2.5 py-1 text-[11.5px] font-semibold text-violet-100 transition hover:bg-violet-500/[0.22]"
                      >
                        Lancer maj
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <footer className="mt-10 pb-8 text-center font-mono text-[10px] uppercase tracking-wider text-zinc-600">
          Mettrik AI · Suivi rafraîchissements SEC · Cron 7h30
        </footer>
      </div>
          {/* VERROU 4 : historique des runs du cron (double extraction, complétude, audit) */}
      {history.length > 0 && (
        <section className="mt-10">
          <h2 className="text-[18px] font-semibold text-zinc-100">Historique des runs (verrous qualité)</h2>
          <p className="mt-1 text-[12.5px] text-zinc-400">
            Chaque run : verrou 1 = double extraction indépendante (API SEC vs document téléchargé),
            verrou 2 = 100 % des KPI mis à jour + blocs texte traités, verrou 3 = audit du rendu.
            Une sté n&apos;est PUBLIABLE que si les 3 sont verts.
          </p>
          <div className="mt-3 space-y-2">
            {history.map((h, i) => (
              <details key={i} className="rounded-lg border border-[#1f1f1f] bg-[#0a0a0a] p-3">
                <summary className="cursor-pointer text-[13px] text-zinc-200">
                  <span className="font-mono">{new Date(h.run_at).toLocaleString("fr-FR")}</span>
                  {" · "}{h.traitees} sté(s) traitée(s)
                  {" · "}<span className="text-emerald-400">{h.publiables} publiable(s)</span>
                  {" · "}<span className={h.bloquees > 0 ? "text-rose-400" : "text-zinc-500"}>{h.bloquees} bloquée(s)</span>
                </summary>
                <div className="mt-2 grid gap-1">
                  {Object.entries(h.stes).map(([t, st]) => (
                    <div key={t} className="flex flex-wrap items-center gap-2 text-[12px]">
                      <span className="w-14 font-mono text-zinc-300">{t}</span>
                      <span className={st.statut === "PUBLIABLE" ? "text-emerald-400" : "text-rose-400"}>{st.statut}</span>
                      {st.lock2 && <span className="text-zinc-500">KPI {st.lock2.kpi_a_jour}/{st.lock2.kpi_total}</span>}
                      {st.raisons.length > 0 && <span className="text-zinc-400">· {st.raisons.join(" ; ")}</span>}
                    </div>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </section>
      )}
</main>
  );
}
