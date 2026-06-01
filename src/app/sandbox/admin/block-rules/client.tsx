"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { InfoTooltip } from "@/components/info-tooltip";
import {
  BLOCK_KEYS,
  BLOCK_LABELS,
  type BlockKey,
  type BlockRulesPayload,
} from "@/lib/block-rules";

type SaveStatus = "idle" | "saving" | "ok" | "error";

type RowState = {
  raw: string;
  horsTop1Raw: string;
  updatedAt: string | null;
  status: SaveStatus;
  errorMessage?: string;
  showHorsTop1: boolean;
  lastAppliedAt: string | null;
  lastApplyReport: BlockApplyReportClient | null;
};

type BlockApplyReportClient = {
  block_key: string;
  block_label: string;
  rules_count: number;
  ui_rules_count: number;
  data_rules_count: number;
  ambiguous_rules_count: number;
  needs_review: { line: string; reason: string }[];
  data_modifications: Record<string, number>;
  modified_tickers: string[];
};

type JobStatus = "pending" | "running" | "done" | "error";
type JobReportClient = {
  started_at: string;
  finished_at: string;
  total_companies_scanned: number;
  total_modifications: number;
  by_block: BlockApplyReportClient[];
};

const DEBOUNCE_MS = 1000;

function formatUpdatedAt(iso: string | null): string {
  if (!iso) return "jamais enregistré";
  try {
    const d = new Date(iso);
    return d.toLocaleString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function formatTimeAgo(iso: string | null): string | null {
  if (!iso) return null;
  try {
    const then = new Date(iso).getTime();
    const now = Date.now();
    const diffSec = Math.floor((now - then) / 1000);
    if (diffSec < 60) return "il y a quelques secondes";
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `il y a ${diffMin} min`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `il y a ${diffH} h`;
    const diffD = Math.floor(diffH / 24);
    return `il y a ${diffD} j`;
  } catch {
    return null;
  }
}

/**
 * UI admin orange : 12 cards (1 par bloc), 1 textarea principal "règles"
 * + 1 textarea secondaire optionnel "spécificités hors top 1".
 * Auto-save debounce 1s vers /api/desk-mtk9x4kp/block-rules (PATCH).
 */
export function BlockRulesClient({
  initial,
}: {
  initial: Record<BlockKey, BlockRulesPayload>;
}) {
  const [rows, setRows] = useState<Record<BlockKey, RowState>>(() => {
    const out: Record<string, RowState> = {};
    for (const k of BLOCK_KEYS) {
      const payload = initial[k];
      out[k] = {
        raw: payload?.raw ?? "",
        horsTop1Raw: payload?.hors_top1_raw ?? "",
        updatedAt: payload?.updated_at ?? null,
        status: "idle",
        showHorsTop1: !!(payload?.hors_top1_raw && payload.hors_top1_raw.length > 0),
        lastAppliedAt: payload?.last_applied_at ?? null,
        lastApplyReport:
          (payload?.last_apply_report as BlockApplyReportClient | null) ?? null,
      };
    }
    return out as Record<BlockKey, RowState>;
  });

  // État job "Appliquer maintenant".
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [jobError, setJobError] = useState<string | null>(null);
  const [jobReport, setJobReport] = useState<JobReportClient | null>(null);
  const isApplying = jobStatus === "pending" || jobStatus === "running";

  const launchApply = useCallback(async () => {
    setConfirmOpen(false);
    setJobError(null);
    setJobReport(null);
    setJobStatus("pending");
    try {
      const res = await fetch("/api/desk-mtk9x4kp/block-rules-apply", {
        method: "POST",
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        job_id?: string;
        error?: string;
      };
      if (!res.ok || !data.ok || !data.job_id) {
        setJobStatus("error");
        setJobError(data.error ?? `HTTP ${res.status}`);
        return;
      }
      setJobId(data.job_id);
    } catch (err) {
      setJobStatus("error");
      setJobError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  // Polling status job toutes les 2s.
  useEffect(() => {
    if (!jobId || !isApplying) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/desk-mtk9x4kp/block-rules-apply?job_id=${encodeURIComponent(jobId)}`,
        );
        const data = (await res.json().catch(() => ({}))) as {
          status?: JobStatus;
          report?: JobReportClient;
          error_message?: string;
        };
        if (data.status) setJobStatus(data.status);
        if (data.status === "done" && data.report) {
          setJobReport(data.report);
          // Met à jour les rows avec les nouveaux last_applied_at + report par bloc.
          setRows((prev) => {
            const next = { ...prev };
            for (const rep of data.report!.by_block) {
              const bk = rep.block_key as BlockKey;
              if (next[bk]) {
                next[bk] = {
                  ...next[bk],
                  lastAppliedAt: data.report!.finished_at,
                  lastApplyReport: rep,
                };
              }
            }
            return next;
          });
        }
        if (data.status === "error") {
          setJobError(data.error_message ?? "Erreur inconnue");
        }
      } catch {
        // ignore, retry au tour suivant
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [jobId, isApplying]);

  // Refs pour les timers de debounce (1 par bloc).
  const timersRef = useRef<Record<string, ReturnType<typeof setTimeout> | null>>(
    {},
  );

  const save = useCallback(
    async (blockKey: BlockKey, raw: string, horsTop1Raw: string) => {
      setRows((prev) => ({
        ...prev,
        [blockKey]: { ...prev[blockKey], status: "saving", errorMessage: undefined },
      }));
      try {
        const res = await fetch("/api/desk-mtk9x4kp/block-rules", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            block_key: blockKey,
            rules_raw: raw,
            rules_hors_top1_raw: horsTop1Raw,
          }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          error?: string;
        };
        if (!res.ok || !data.ok) {
          setRows((prev) => ({
            ...prev,
            [blockKey]: {
              ...prev[blockKey],
              status: "error",
              errorMessage: data.error ?? `HTTP ${res.status}`,
            },
          }));
          return;
        }
        setRows((prev) => ({
          ...prev,
          [blockKey]: {
            ...prev[blockKey],
            status: "ok",
            updatedAt: new Date().toISOString(),
            errorMessage: undefined,
          },
        }));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setRows((prev) => ({
          ...prev,
          [blockKey]: {
            ...prev[blockKey],
            status: "error",
            errorMessage: msg,
          },
        }));
      }
    },
    [],
  );

  const scheduleSave = useCallback(
    (blockKey: BlockKey, raw: string, horsTop1Raw: string) => {
      const existing = timersRef.current[blockKey];
      if (existing) clearTimeout(existing);
      timersRef.current[blockKey] = setTimeout(() => {
        void save(blockKey, raw, horsTop1Raw);
      }, DEBOUNCE_MS);
    },
    [save],
  );

  // Cleanup timers on unmount.
  useEffect(() => {
    return () => {
      for (const k of Object.keys(timersRef.current)) {
        const t = timersRef.current[k];
        if (t) clearTimeout(t);
      }
    };
  }, []);

  const handleRawChange = useCallback(
    (blockKey: BlockKey, value: string) => {
      setRows((prev) => {
        const next = { ...prev, [blockKey]: { ...prev[blockKey], raw: value, status: "idle" as SaveStatus } };
        scheduleSave(blockKey, value, next[blockKey].horsTop1Raw);
        return next;
      });
    },
    [scheduleSave],
  );

  const handleHorsTop1Change = useCallback(
    (blockKey: BlockKey, value: string) => {
      setRows((prev) => {
        const next = { ...prev, [blockKey]: { ...prev[blockKey], horsTop1Raw: value, status: "idle" as SaveStatus } };
        scheduleSave(blockKey, next[blockKey].raw, value);
        return next;
      });
    },
    [scheduleSave],
  );

  const toggleHorsTop1 = useCallback((blockKey: BlockKey) => {
    setRows((prev) => ({
      ...prev,
      [blockKey]: { ...prev[blockKey], showHorsTop1: !prev[blockKey].showHorsTop1 },
    }));
  }, []);

  const totalFilled = useMemo(() => {
    return BLOCK_KEYS.filter((k) => rows[k].raw.trim().length > 0).length;
  }, [rows]);

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      {/* Header orange dominante */}
      <div className="border-b border-orange-500/40 bg-gradient-to-b from-orange-950/40 to-transparent">
        <div className="mx-auto max-w-5xl px-6 py-8">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-orange-500/50 bg-orange-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-orange-300">
            <span className="h-2 w-2 rounded-full bg-orange-400" />
            Admin · règles par bloc
          </div>
          <h1 className="text-3xl font-bold text-orange-100">
            Règles d&apos;écriture par bloc page société
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-neutral-400">
            Écris librement les règles fond + forme par bloc. Les sub-agents
            futurs (extracteurs, ré-écritures) liront ces règles via{" "}
            <code className="rounded bg-neutral-800 px-1.5 py-0.5 text-orange-300">
              getBlockRules(blockKey)
            </code>{" "}
            AVANT chaque écriture sur le bloc concerné. Auto-save 1 seconde
            après chaque modification.
          </p>
          <div className="mt-4 flex items-center gap-4 text-xs text-neutral-500">
            <span>
              <span className="font-bold text-orange-300">{totalFilled}</span>/
              {BLOCK_KEYS.length} blocs renseignés
            </span>
            <span className="text-neutral-600">·</span>
            <span>Version-agnostic (s&apos;applique à toute version de l&apos;app)</span>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              disabled={isApplying}
              className="inline-flex items-center gap-2 rounded-lg border border-orange-400/50 bg-orange-500/20 px-4 py-2 text-sm font-semibold text-orange-100 transition hover:border-orange-400 hover:bg-orange-500/30 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isApplying ? (
                <>
                  <span className="h-2 w-2 animate-pulse rounded-full bg-orange-300" />
                  Application en cours…
                </>
              ) : (
                <>Appliquer maintenant à tout l&apos;univers</>
              )}
            </button>
            {jobStatus === "done" && jobReport && (
              <span className="text-xs text-emerald-300">
                Terminé : {jobReport.total_modifications} modifications sur{" "}
                {jobReport.total_companies_scanned} sociétés.
              </span>
            )}
            {jobStatus === "error" && (
              <span className="text-xs text-red-300">
                Erreur : {jobError ?? "inconnue"}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Modal confirmation */}
      {confirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setConfirmOpen(false)}
        >
          <div
            className="max-w-md rounded-xl border border-orange-500/40 bg-neutral-950 p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-3 text-lg font-bold text-orange-100">
              Es-tu sûr ?
            </h3>
            <p className="mb-5 text-sm text-neutral-300">
              Tu vas appliquer toutes les règles stockées aux 911 sociétés
              V1.9.5. Les règles UI seront signalées dans le report (modifs
              composants déjà faites par le team). Les règles data
              (em-dash, unités, etc.) seront appliquées aux datasets.
            </p>
            <p className="mb-5 text-xs text-neutral-500">
              Idempotent : appliquer 2 fois la même règle ne fait pas plus
              de modifs la 2e fois.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="rounded-lg border border-neutral-700 px-3 py-2 text-sm text-neutral-300 transition hover:border-neutral-500"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={launchApply}
                className="rounded-lg border border-orange-400 bg-orange-500/30 px-3 py-2 text-sm font-semibold text-orange-100 transition hover:bg-orange-500/40"
              >
                Oui, appliquer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Report global après application */}
      {jobReport && (
        <div className="mx-auto max-w-5xl px-6 pt-6">
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-4">
            <h3 className="mb-2 text-sm font-semibold text-emerald-200">
              Report de la dernière application
            </h3>
            <div className="grid grid-cols-2 gap-3 text-xs text-neutral-300 sm:grid-cols-4">
              <div>
                <div className="text-neutral-500">Sociétés scannées</div>
                <div className="text-lg font-bold text-emerald-100">
                  {jobReport.total_companies_scanned}
                </div>
              </div>
              <div>
                <div className="text-neutral-500">Modifications totales</div>
                <div className="text-lg font-bold text-emerald-100">
                  {jobReport.total_modifications}
                </div>
              </div>
              <div>
                <div className="text-neutral-500">Démarré</div>
                <div>{formatUpdatedAt(jobReport.started_at)}</div>
              </div>
              <div>
                <div className="text-neutral-500">Terminé</div>
                <div>{formatUpdatedAt(jobReport.finished_at)}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Grille blocs */}
      <div className="mx-auto max-w-5xl space-y-6 px-6 py-8">
        {BLOCK_KEYS.map((blockKey, idx) => {
          const row = rows[blockKey];
          const label = BLOCK_LABELS[blockKey];
          return (
            <section
              key={blockKey}
              className="rounded-xl border border-orange-500/20 bg-neutral-900/60 p-5 shadow-lg shadow-orange-950/20"
              data-block-key={blockKey}
            >
              <header className="mb-3 flex items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded bg-orange-500/15 px-2 py-0.5 text-xs font-mono text-orange-300">
                      {String(idx + 1).padStart(2, "0")}
                    </span>
                    <h2 className="text-lg font-semibold text-orange-100">
                      {label}
                    </h2>
                    {row.lastAppliedAt && (
                      <span
                        className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300"
                        title={`Appliquée le ${formatUpdatedAt(row.lastAppliedAt)}`}
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                        Appliquée {formatTimeAgo(row.lastAppliedAt)}
                      </span>
                    )}
                  </div>
                  <code className="mt-1 inline-block text-xs text-neutral-500">
                    block_key: {blockKey}
                  </code>
                </div>
                <SaveBadge row={row} />
              </header>

              {row.lastApplyReport && (
                <div className="mb-3 rounded-lg border border-emerald-500/20 bg-emerald-950/20 p-3 text-xs text-neutral-300">
                  <div className="mb-1.5 flex flex-wrap items-center gap-3 text-[11px]">
                    <span>
                      <span className="text-neutral-500">Règles UI :</span>{" "}
                      <span className="font-semibold text-cyan-300">
                        {row.lastApplyReport.ui_rules_count}
                      </span>
                    </span>
                    <span>
                      <span className="text-neutral-500">Règles data :</span>{" "}
                      <span className="font-semibold text-emerald-300">
                        {row.lastApplyReport.data_rules_count}
                      </span>
                    </span>
                    {row.lastApplyReport.ambiguous_rules_count > 0 && (
                      <span>
                        <span className="text-neutral-500">À revoir :</span>{" "}
                        <span className="font-semibold text-amber-300">
                          {row.lastApplyReport.ambiguous_rules_count}
                        </span>
                      </span>
                    )}
                    {row.lastApplyReport.modified_tickers.length > 0 && (
                      <span>
                        <span className="text-neutral-500">Sociétés modifiées :</span>{" "}
                        <span className="font-semibold text-orange-300">
                          {row.lastApplyReport.modified_tickers.length}
                        </span>
                      </span>
                    )}
                  </div>
                  {Object.keys(row.lastApplyReport.data_modifications).length > 0 && (
                    <div className="text-[11px] text-neutral-400">
                      Modifications :{" "}
                      {Object.entries(row.lastApplyReport.data_modifications)
                        .map(([k, v]) => `${k} (${v})`)
                        .join(" · ")}
                    </div>
                  )}
                  {row.lastApplyReport.needs_review.length > 0 && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-[11px] text-amber-300">
                        {row.lastApplyReport.needs_review.length} règle(s) à revoir
                      </summary>
                      <ul className="mt-1.5 space-y-1 pl-3">
                        {row.lastApplyReport.needs_review.map((r, i) => (
                          <li key={i} className="text-[10px] text-neutral-400">
                            <code className="text-amber-200">{r.line}</code> :{" "}
                            {r.reason}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              )}

              <label
                className="mb-1 block text-xs font-semibold uppercase tracking-wider text-neutral-400"
                htmlFor={`rules-${blockKey}`}
              >
                Règles (fond + forme)
              </label>
              <textarea
                id={`rules-${blockKey}`}
                value={row.raw}
                onChange={(e) => handleRawChange(blockKey, e.target.value)}
                placeholder="Écris une règle par ligne. Ex : « Toujours utiliser Mds $ et jamais B$. Aucun em-dash. »"
                rows={6}
                className="w-full resize-y rounded-lg border border-orange-500/20 bg-neutral-950 px-3 py-2 font-mono text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400/40"
                spellCheck={false}
              />

              <div className="mt-3 flex items-center justify-between text-xs text-neutral-500">
                <button
                  type="button"
                  onClick={() => toggleHorsTop1(blockKey)}
                  className="rounded border border-orange-500/30 px-2 py-1 text-orange-300 transition hover:border-orange-400 hover:text-orange-200"
                >
                  {row.showHorsTop1
                    ? "− Masquer spécificités hors top 1"
                    : "+ Ajouter spécificités hors top 1"}
                </button>
                <span>
                  Dernière maj : {formatUpdatedAt(row.updatedAt)}
                </span>
              </div>

              {row.showHorsTop1 && (
                <div className="mt-4 rounded-lg border border-orange-500/15 bg-orange-950/10 p-3">
                  <div className="mb-1 flex items-center gap-1.5">
                    <label
                      className="block text-xs font-semibold uppercase tracking-wider text-orange-400/80"
                      htmlFor={`hors-top1-${blockKey}`}
                    >
                      Spécificités hors top 1 (optionnel)
                    </label>
                    <InfoTooltip color="#fb923c" size="sm">
                      <div className="space-y-2">
                        <p className="font-semibold text-orange-300">
                          À quoi ça sert ?
                        </p>
                        <p>
                          Sert à définir des règles différentes pour
                          certaines stés. Par défaut, TOUTES les stés
                          appliquent les règles du champ principal
                          ci-dessus.
                        </p>
                        <p>
                          Ici, tu peux préciser des exceptions : règles
                          qui s&apos;appliquent uniquement aux stés en
                          dehors du top 1 (ex : banques régionales,
                          sub-secteur spécifique, cas particuliers).
                        </p>
                        <p className="text-neutral-400">
                          Si tu n&apos;as pas d&apos;exception à ajouter,
                          laisse vide.
                        </p>
                      </div>
                    </InfoTooltip>
                  </div>
                  <p className="mb-2 text-xs text-neutral-500">
                    Règles qui s&apos;appliquent uniquement aux stés en
                    dehors du top 1 (ex : banques, sub-secteur spécifique,
                    cas particuliers).
                  </p>
                  <textarea
                    id={`hors-top1-${blockKey}`}
                    value={row.horsTop1Raw}
                    onChange={(e) =>
                      handleHorsTop1Change(blockKey, e.target.value)
                    }
                    placeholder="Écris une règle par ligne."
                    rows={4}
                    className="w-full resize-y rounded-lg border border-orange-500/15 bg-neutral-950 px-3 py-2 font-mono text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400/40"
                    spellCheck={false}
                  />
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function SaveBadge({ row }: { row: RowState }) {
  if (row.status === "saving") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-500/15 px-2.5 py-1 text-xs font-medium text-orange-300">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-orange-400" />
        Sauvegarde…
      </span>
    );
  }
  if (row.status === "ok") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-300">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
        Enregistré
      </span>
    );
  }
  if (row.status === "error") {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full bg-red-500/15 px-2.5 py-1 text-xs font-medium text-red-300"
        title={row.errorMessage}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
        Erreur
      </span>
    );
  }
  return null;
}
