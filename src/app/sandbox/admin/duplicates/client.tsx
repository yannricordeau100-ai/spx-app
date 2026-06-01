"use client";

import { useCallback, useMemo, useState } from "react";
import { LATEST_VERSION_SLUG } from "@/lib/version-routing";

export type DuplicateStatus =
  | "pending"
  | "same"
  | "different"
  | "ignored";

export type DuplicateEntry = {
  id: number;
  kind: string;
  priority?: number;
  tickers: string[];
  names: string[];
  primary_suggestion: string;
  status: DuplicateStatus;
  canonical_ticker?: string;
  reviewed_at?: string;
};

type FilterValue = "all" | DuplicateStatus;

const KIND_LABELS: Record<string, string> = {
  "multi-listing": "Multi-listing",
  "class-shares": "Class A/B/C",
  "name-similarity": "Nom similaire",
};

const KIND_COLORS: Record<string, string> = {
  "multi-listing": "bg-orange-500/20 text-orange-300 border-orange-500/40",
  "class-shares": "bg-amber-500/20 text-amber-300 border-amber-500/40",
  "name-similarity": "bg-yellow-500/20 text-yellow-300 border-yellow-500/40",
};

function tickerHref(ticker: string): string {
  // lowercase for v1-9-5 ticker route convention
  return `/sandbox/${LATEST_VERSION_SLUG}/${encodeURIComponent(ticker.toLowerCase())}`;
}

export function DuplicatesClient({
  initial,
}: {
  initial: DuplicateEntry[];
}) {
  const [entries, setEntries] = useState<DuplicateEntry[]>(initial);
  const [filter, setFilter] = useState<FilterValue>("pending");
  const [savingId, setSavingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const counts = useMemo(() => {
    const c = {
      total: entries.length,
      pending: 0,
      same: 0,
      different: 0,
      ignored: 0,
    };
    for (const e of entries) {
      c[e.status] = (c[e.status] ?? 0) + 1;
    }
    return c;
  }, [entries]);

  const filtered = useMemo(() => {
    if (filter === "all") return entries;
    return entries.filter((e) => e.status === filter);
  }, [entries, filter]);

  const updateStatus = useCallback(
    async (id: number, status: DuplicateStatus) => {
      setSavingId(id);
      setError(null);
      try {
        const entry = entries.find((e) => e.id === id);
        const canonical =
          status === "same" ? entry?.primary_suggestion : undefined;
        const res = await fetch("/api/admin/duplicates/confirm", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            id,
            status,
            canonical_ticker: canonical,
          }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          error?: string;
          canonical_ticker?: string;
        };
        if (!res.ok || !data.ok) {
          setError(data.error ?? `HTTP ${res.status}`);
          return;
        }
        setEntries((prev) =>
          prev.map((e) =>
            e.id === id
              ? {
                  ...e,
                  status,
                  canonical_ticker: data.canonical_ticker,
                  reviewed_at: new Date().toISOString(),
                }
              : e,
          ),
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
      } finally {
        setSavingId(null);
      }
    },
    [entries],
  );

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      {/* Header orange dominante */}
      <div className="border-b border-orange-500/40 bg-gradient-to-b from-orange-950/40 to-transparent">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-orange-500/50 bg-orange-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-orange-300">
            <span className="h-2 w-2 rounded-full bg-orange-400" />
            Admin · doublons tickers
          </div>
          <h1 className="text-3xl font-bold text-orange-100">
            Audit des doublons potentiels
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-neutral-400">
            Valide visuellement chaque doublon détecté dans l&apos;univers
            V1.9.5 (~2280 fichiers). 3 types : multi-listing
            (BABA/9988.HK), class shares (GOOG/GOOGL, BRK-A/BRK-B), nom
            similaire. Clique sur les tickers pour ouvrir la fiche société.
          </p>

          {/* Compteurs */}
          <div className="mt-5 flex flex-wrap items-center gap-3 text-sm">
            <span className="rounded-lg border border-orange-500/30 bg-orange-500/10 px-3 py-1.5 text-orange-200">
              <span className="font-bold text-orange-100">{counts.total}</span>{" "}
              doublons détectés
            </span>
            <span className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-neutral-300">
              <span className="font-bold text-orange-300">
                {counts.pending}
              </span>{" "}
              à valider
            </span>
            <span className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-emerald-300">
              <span className="font-bold">{counts.same}</span> identiques
            </span>
            <span className="rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-1.5 text-sky-300">
              <span className="font-bold">{counts.different}</span>{" "}
              différents
            </span>
            <span className="rounded-lg border border-neutral-600 bg-neutral-800 px-3 py-1.5 text-neutral-400">
              <span className="font-bold">{counts.ignored}</span> ignorés
            </span>
          </div>

          {/* Filtres */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {(["pending", "all", "same", "different", "ignored"] as const).map(
              (f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                    filter === f
                      ? "border-orange-400 bg-orange-500/20 text-orange-100"
                      : "border-neutral-700 bg-neutral-900 text-neutral-400 hover:border-orange-500/50 hover:text-orange-300"
                  }`}
                >
                  {f === "all"
                    ? "Tous"
                    : f === "pending"
                      ? "À valider"
                      : f === "same"
                        ? "Identique"
                        : f === "different"
                          ? "Différent"
                          : "Ignoré"}
                </button>
              ),
            )}
          </div>

          {error && (
            <div className="mt-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              Erreur : {error}
            </div>
          )}
        </div>
      </div>

      {/* Tableau */}
      <div className="mx-auto max-w-7xl px-6 py-8">
        {filtered.length === 0 ? (
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-12 text-center text-neutral-500">
            Aucun doublon dans ce filtre.
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-orange-500/20 bg-neutral-900/60 shadow-lg shadow-orange-950/20">
            <table className="w-full text-sm">
              <thead className="border-b border-orange-500/20 bg-orange-500/[0.04] text-left text-xs uppercase tracking-wider text-orange-300">
                <tr>
                  <th className="px-4 py-3 font-semibold">#</th>
                  <th className="px-4 py-3 font-semibold">Type</th>
                  <th className="px-4 py-3 font-semibold">Tickers</th>
                  <th className="px-4 py-3 font-semibold">Noms</th>
                  <th className="px-4 py-3 font-semibold">Canonical</th>
                  <th className="px-4 py-3 font-semibold">Statut</th>
                  <th className="px-4 py-3 text-right font-semibold">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800">
                {filtered.map((entry) => {
                  const saving = savingId === entry.id;
                  return (
                    <tr
                      key={entry.id}
                      className="transition hover:bg-orange-500/[0.03]"
                    >
                      <td className="px-4 py-3 font-mono text-xs text-neutral-500">
                        {entry.id}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
                            KIND_COLORS[entry.kind] ??
                            "border-neutral-700 bg-neutral-800 text-neutral-300"
                          }`}
                        >
                          {KIND_LABELS[entry.kind] ?? entry.kind}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          {entry.tickers.map((t) => (
                            <a
                              key={t}
                              href={tickerHref(t)}
                              target="_blank"
                              rel="noreferrer noopener"
                              className="rounded border border-orange-500/30 bg-orange-500/5 px-2 py-0.5 font-mono text-xs text-orange-200 transition hover:border-orange-400 hover:bg-orange-500/15"
                            >
                              {t}
                            </a>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-neutral-400">
                        <div className="max-w-md">
                          {entry.names
                            .filter((n, i, arr) => n && arr.indexOf(n) === i)
                            .slice(0, 3)
                            .map((n, i) => (
                              <div
                                key={`${entry.id}-name-${i}`}
                                className="truncate"
                              >
                                {n}
                              </div>
                            ))}
                          {entry.names.length > 3 && (
                            <div className="text-neutral-600">
                              +{entry.names.length - 3} autres
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-orange-300">
                        {entry.canonical_ticker ?? entry.primary_suggestion}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={entry.status} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center justify-end gap-1.5">
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => updateStatus(entry.id, "same")}
                            className={`rounded border px-2 py-1 text-xs font-medium transition ${
                              entry.status === "same"
                                ? "border-emerald-400 bg-emerald-500/20 text-emerald-200"
                                : "border-emerald-500/30 bg-emerald-500/5 text-emerald-300 hover:border-emerald-400 hover:bg-emerald-500/15"
                            } disabled:opacity-40`}
                            title={`Marquer comme identique (canonical = ${entry.primary_suggestion})`}
                          >
                            Identique
                          </button>
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() =>
                              updateStatus(entry.id, "different")
                            }
                            className={`rounded border px-2 py-1 text-xs font-medium transition ${
                              entry.status === "different"
                                ? "border-sky-400 bg-sky-500/20 text-sky-200"
                                : "border-sky-500/30 bg-sky-500/5 text-sky-300 hover:border-sky-400 hover:bg-sky-500/15"
                            } disabled:opacity-40`}
                          >
                            Différent
                          </button>
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => updateStatus(entry.id, "ignored")}
                            className={`rounded border px-2 py-1 text-xs font-medium transition ${
                              entry.status === "ignored"
                                ? "border-neutral-500 bg-neutral-700 text-neutral-200"
                                : "border-neutral-700 bg-neutral-900 text-neutral-400 hover:border-neutral-500 hover:text-neutral-200"
                            } disabled:opacity-40`}
                          >
                            Ignorer
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: DuplicateStatus }) {
  if (status === "same") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-300">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
        Identique
      </span>
    );
  }
  if (status === "different") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/40 bg-sky-500/10 px-2 py-0.5 text-xs font-medium text-sky-300">
        <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
        Différent
      </span>
    );
  }
  if (status === "ignored") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-neutral-600 bg-neutral-800 px-2 py-0.5 text-xs font-medium text-neutral-400">
        <span className="h-1.5 w-1.5 rounded-full bg-neutral-500" />
        Ignoré
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-500/40 bg-orange-500/10 px-2 py-0.5 text-xs font-medium text-orange-300">
      <span className="h-1.5 w-1.5 rounded-full bg-orange-400" />À valider
    </span>
  );
}
