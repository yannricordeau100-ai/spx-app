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
      };
    }
    return out as Record<BlockKey, RowState>;
  });

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
        </div>
      </div>

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
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-orange-500/15 px-2 py-0.5 text-xs font-mono text-orange-300">
                      {String(idx + 1).padStart(2, "0")}
                    </span>
                    <h2 className="text-lg font-semibold text-orange-100">
                      {label}
                    </h2>
                  </div>
                  <code className="mt-1 inline-block text-xs text-neutral-500">
                    block_key: {blockKey}
                  </code>
                </div>
                <SaveBadge row={row} />
              </header>

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
