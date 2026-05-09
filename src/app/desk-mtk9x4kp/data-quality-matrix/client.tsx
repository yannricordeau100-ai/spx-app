"use client";

import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import {
  COLUMN_KEYS,
  COLUMN_LABEL,
  finalStatus,
  type ColumnKey,
  type CompanyRow,
  type Cell,
  type FinalStatus,
  type MatrixSection,
} from "@/lib/desk/data-quality-matrix-types";

// Glyphes distincts entre humain (✅/❌) et auto (🟢/🟡/🟠/🔴) pour
// éviter toute ambiguïté de lecture. Cf demande Yann 9 mai 2026.
const STATUS_GLYPH: Record<FinalStatus, string> = {
  verified_ok: "✅",
  verified_ko: "❌",
  na: "⚪",
  auto_ok: "🟢",
  auto_stale: "🟡",
  auto_partial: "🟠",
  auto_ko: "🔴",
};

const STATUS_LABEL: Record<FinalStatus, string> = {
  verified_ok: "Vérifié OK (humain)",
  verified_ko: "Vérifié KO (humain)",
  na: "Sans objet",
  auto_ok: "Auto · à jour",
  auto_stale: "Auto · en retard",
  auto_partial: "Auto · incomplet",
  auto_ko: "Auto · manquant",
};

type HistoryPoint = { at: string; ok: number; total: number; pctOk: number };
type HistoryByCol = Record<string, HistoryPoint[]>;

/**
 * Sparkline mini-SVG montrant l'évolution % OK sur les derniers snapshots.
 * Largeur 60 px, hauteur 18 px, 0-100 % sur l'axe Y.
 */
function Sparkline({ points }: { points: HistoryPoint[] }) {
  if (points.length < 2) return <span className="text-[9px] text-zinc-600">—</span>;
  const W = 60, H = 18;
  const pcts = points.map((p) => p.pctOk);
  const minY = Math.min(...pcts, 0);
  const maxY = Math.max(...pcts, 100);
  const range = Math.max(1, maxY - minY);
  const last = pcts[pcts.length - 1];
  const first = pcts[0];
  const trend = last - first;
  const color = trend > 0 ? "#10b981" : trend < 0 ? "#f43f5e" : "#a78bfa";
  const xs = points.map((_, i) => (i / (points.length - 1)) * W);
  const ys = pcts.map((p) => H - ((p - minY) / range) * H);
  const path = xs.map((x, i) => `${i === 0 ? "M" : "L"} ${x.toFixed(1)},${ys[i].toFixed(1)}`).join(" ");
  return (
    <svg width={W} height={H} className="inline-block align-middle" aria-label={`Tendance: ${trend > 0 ? "+" : ""}${trend} pts`}>
      <path d={path} fill="none" stroke={color} strokeWidth="1.4" strokeLinejoin="round" />
      <circle cx={xs[xs.length - 1]} cy={ys[ys.length - 1]} r="1.6" fill={color} />
    </svg>
  );
}

export function MatrixClient({
  initialSections,
  initialLimit,
  history = {},
}: {
  initialSections: MatrixSection[];
  initialLimit: number;
  history?: HistoryByCol;
}) {
  const [sections, setSections] = useState(initialSections);
  // rows aplatis (gardés pour les filtres/stats globaux indépendants des sections)
  const rows = useMemo(() => sections.flatMap((s) => s.rows), [sections]);
  const [limit] = useState(initialLimit);
  const [filterCol, setFilterCol] = useState<ColumnKey | "all">("all");
  const [filterStatus, setFilterStatus] = useState<FinalStatus | "all">("all");
  const [verifier, setVerifier] = useState("YANN");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [editingCell, setEditingCell] = useState<{ ticker: string; col: ColumnKey } | null>(null);
  const [draftNote, setDraftNote] = useState("");

  // Stats globales par colonne (% à jour / stale / partial / ko).
  const colStats = useMemo(() => {
    const stats: Record<ColumnKey, { ok: number; stale: number; partial: number; ko: number; na: number }> = {} as never;
    for (const col of COLUMN_KEYS) {
      stats[col] = { ok: 0, stale: 0, partial: 0, ko: 0, na: 0 };
    }
    for (const row of rows) {
      for (const col of COLUMN_KEYS) {
        const fs = finalStatus(row.cells[col]);
        if (fs === "verified_ok" || fs === "auto_ok") stats[col].ok++;
        else if (fs === "auto_stale") stats[col].stale++;
        else if (fs === "auto_partial") stats[col].partial++;
        else if (fs === "verified_ko" || fs === "auto_ko") stats[col].ko++;
        else if (fs === "na") stats[col].na++;
      }
    }
    return stats;
  }, [rows]);

  // Filtrage section par section (préserve la séparation top305 vs extra).
  const filteredSections = useMemo(() => {
    if (filterCol === "all" && filterStatus === "all") return sections;
    return sections.map((sec) => ({
      ...sec,
      rows: sec.rows.filter((row) => {
        if (filterCol !== "all") {
          const fs = finalStatus(row.cells[filterCol]);
          if (filterStatus !== "all" && fs !== filterStatus) return false;
          return true;
        }
        return COLUMN_KEYS.some((c) => finalStatus(row.cells[c]) === filterStatus);
      }),
    }));
  }, [sections, filterCol, filterStatus]);

  async function setStatus(ticker: string, col: ColumnKey, status: "verified_ok" | "verified_ko" | "na", notes?: string) {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/desk/data-quality-matrix", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ticker, column_key: col, status, verified_by: verifier, notes }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        setMsg(`❌ ${err.error || r.statusText}`);
        return;
      }
      // Update local optimiste (sur toutes les sections)
      setSections((cur) =>
        cur.map((sec) => ({
          ...sec,
          rows: sec.rows.map((row) =>
            row.ticker.toUpperCase() === ticker.toUpperCase()
              ? {
                  ...row,
                  cells: {
                    ...row.cells,
                    [col]: {
                      ...row.cells[col],
                      override: {
                        status,
                        verified_by: verifier,
                        verified_at: new Date().toISOString(),
                        notes: notes ?? null,
                      },
                    },
                  },
                }
              : row,
          ),
        })),
      );
      setMsg("✅ Sauvegardé");
      setTimeout(() => setMsg(null), 1500);
      setEditingCell(null);
      setDraftNote("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-8 text-zinc-100">
      <div className="mb-4 flex items-baseline justify-between">
        <h1 className="font-display text-[24px] font-bold tracking-tight">
          Matrice qualité données · {rows.length} sés
        </h1>
        <div className="flex items-center gap-3 text-[11px]">
          <Link href="/desk-mtk9x4kp" className="text-violet-300 hover:underline">
            ← Desk
          </Link>
          <span className="text-zinc-500">Top par market cap (V1.8)</span>
        </div>
      </div>

      {msg && (
        <div className="mb-3 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.05] px-3 py-2 text-[12px] text-emerald-200">
          {msg}
        </div>
      )}

      {/* Légende */}
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[11px] text-zinc-400">
        <span className="font-bold text-zinc-300">Légende :</span>
        {(Object.keys(STATUS_GLYPH) as FinalStatus[]).map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5">
            <span>{STATUS_GLYPH[s]}</span>
            <span>{STATUS_LABEL[s]}</span>
          </span>
        ))}
      </div>

      {/* Filtres + identité vérificateur */}
      <div className="mb-4 flex flex-wrap items-center gap-2 text-[12px]">
        <label className="text-zinc-400">Filtre colonne :</label>
        <select
          value={filterCol}
          onChange={(e) => setFilterCol(e.target.value as ColumnKey | "all")}
          className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-2 py-1 text-zinc-100"
        >
          <option value="all">Toutes</option>
          {COLUMN_KEYS.map((c) => (
            <option key={c} value={c}>
              {COLUMN_LABEL[c]}
            </option>
          ))}
        </select>
        <label className="ml-3 text-zinc-400">Statut :</label>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as FinalStatus | "all")}
          className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-2 py-1 text-zinc-100"
        >
          <option value="all">Tous</option>
          <option value="verified_ok">🟢 Vérifié OK</option>
          <option value="auto_ok">🟢 À jour</option>
          <option value="auto_stale">🟡 En retard</option>
          <option value="auto_partial">🟠 Incomplet</option>
          <option value="auto_ko">🔴 Manquant</option>
          <option value="verified_ko">🔴 Vérifié KO</option>
          <option value="na">⚪ N/A</option>
        </select>
        <span className="ml-auto inline-flex items-center gap-2 text-zinc-500">
          Vérificateur :
          <select
            value={verifier}
            onChange={(e) => setVerifier(e.target.value)}
            className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-2 py-1 text-zinc-100"
          >
            <option value="YANN">YANN</option>
            <option value="CONV-SYSTEMS">CONV-SYSTEMS</option>
            <option value="CONV-DATA">CONV-DATA</option>
            <option value="CONV-CONCEPTS">CONV-CONCEPTS</option>
            <option value="CONV-BRAND">CONV-BRAND</option>
          </select>
        </span>
        <span className="text-zinc-500">Limite : {limit}</span>
        <Link
          href={`/desk-mtk9x4kp/data-quality-matrix?limit=${limit + 50}`}
          className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-zinc-300 hover:bg-white/[0.08]"
        >
          +50
        </Link>
      </div>

      {/* Tableau matrice */}
      <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
        <table className="min-w-full text-[11.5px]">
          <thead className="sticky top-0 z-10 bg-zinc-900/95 backdrop-blur">
            <tr className="border-b border-white/[0.08]">
              <th className="sticky left-0 z-20 bg-zinc-900/95 px-3 py-2 text-left font-bold text-zinc-300">
                <div>Sté</div>
                <div className="text-[9px] font-normal text-zinc-500">↓ tendance % OK</div>
              </th>
              {COLUMN_KEYS.map((col) => {
                const points = history[col] ?? [];
                const lastPct = points.at(-1)?.pctOk;
                const firstPct = points[0]?.pctOk;
                const delta = lastPct !== undefined && firstPct !== undefined ? lastPct - firstPct : null;
                return (
                  <th key={col} className="px-2 py-2 text-center font-bold text-zinc-300" title={COLUMN_LABEL[col]}>
                    <div className="text-[10.5px]">{COLUMN_LABEL[col]}</div>
                    <div className="mt-0.5 text-[9px] font-normal text-emerald-400/70">
                      🟢{colStats[col].ok} 🟡{colStats[col].stale} 🟠{colStats[col].partial} 🔴{colStats[col].ko}
                    </div>
                    <div className="mt-0.5 flex items-center justify-center gap-1">
                      <Sparkline points={points} />
                      {delta !== null && (
                        <span className={`text-[8.5px] font-mono ${delta > 0 ? "text-emerald-400" : delta < 0 ? "text-rose-400" : "text-zinc-500"}`}>
                          {delta > 0 ? "+" : ""}{delta}
                        </span>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {filteredSections.map((sec) => (
              <Fragment key={sec.key}>
                {/* Ligne séparateur de section (visible top305 vs extra) */}
                <tr className="border-y-2 border-violet-500/40 bg-violet-500/[0.07]">
                  <td colSpan={COLUMN_KEYS.length + 1} className="sticky left-0 px-3 py-1.5 text-[10.5px] font-bold uppercase tracking-wider text-violet-200">
                    {sec.key === "v18_top" ? "▼" : "▶"} {sec.label} · {sec.rows.length} sés
                  </td>
                </tr>
                {sec.rows.map((row) => (
                  <tr key={row.ticker} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                    <td className="sticky left-0 z-10 bg-zinc-950/80 px-3 py-2 backdrop-blur">
                      <Link
                        href={`/sandbox/v1-8/${row.ticker.toLowerCase()}`}
                        target="_blank"
                        className="font-mono text-[12px] font-bold text-violet-200 hover:underline"
                      >
                        {row.ticker}
                      </Link>
                      <div className="text-[10px] text-zinc-500">{row.name.slice(0, 24)}</div>
                    </td>
                    {COLUMN_KEYS.map((col) => {
                      const cell = row.cells[col];
                      const fs = finalStatus(cell);
                      const isEditing = editingCell?.ticker === row.ticker && editingCell?.col === col;
                      return (
                        <td key={col} className="relative px-1.5 py-1.5 text-center align-top">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingCell({ ticker: row.ticker, col });
                              setDraftNote(cell.override?.notes ?? "");
                            }}
                            title={`${STATUS_LABEL[fs]}${cell.detail ? ` · ${cell.detail}` : cell.hint ? ` · ${cell.hint}` : ""}${cell.override?.notes ? ` · ${cell.override.notes}` : ""}`}
                            className="inline-flex flex-col items-center text-[14px] hover:scale-110"
                          >
                            <span>{STATUS_GLYPH[fs]}</span>
                            {cell.hint && (fs === "auto_ok" || fs === "auto_stale") && (
                              <span className={`text-[8px] ${fs === "auto_stale" ? "text-amber-400/70" : "text-emerald-400/70"}`}>{cell.hint.slice(0, 12)}</span>
                            )}
                          </button>

                          {isEditing && <CellEditor cell={cell} verifier={verifier} busy={busy} onSet={(s, notes) => setStatus(row.ticker, col, s, notes)} onCancel={() => { setEditingCell(null); setDraftNote(""); }} draftNote={draftNote} setDraftNote={setDraftNote} />}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}

function CellEditor({
  cell,
  verifier,
  busy,
  onSet,
  onCancel,
  draftNote,
  setDraftNote,
}: {
  cell: Cell;
  verifier: string;
  busy: boolean;
  onSet: (status: "verified_ok" | "verified_ko" | "na", notes?: string) => void;
  onCancel: () => void;
  draftNote: string;
  setDraftNote: (s: string) => void;
}) {
  return (
    <div className="absolute left-1/2 top-full z-50 mt-1 -translate-x-1/2 rounded-xl border border-white/10 bg-zinc-950/95 p-3 text-left text-[11px] shadow-2xl backdrop-blur">
      <div className="mb-2 text-zinc-300">
        <div><strong>Auto :</strong> {cell.status === "auto_ok" ? "🟢 À jour" : cell.status === "auto_stale" ? "🟡 En retard" : cell.status === "auto_partial" ? "🟠 Incomplet" : cell.status === "auto_ko" ? "🔴 Manquant" : "⚪ N/A"}</div>
        {cell.detail && <div className="text-zinc-500">{cell.detail}</div>}
        {cell.hint && <div className="text-emerald-400/70">{cell.hint}</div>}
        {cell.override && <div className="mt-1 text-violet-300">Vérifié {cell.override.status} par {cell.override.verified_by}</div>}
      </div>
      <textarea
        placeholder="Notes (optionnel)"
        value={draftNote}
        onChange={(e) => setDraftNote(e.target.value)}
        rows={2}
        className="mb-2 w-48 resize-none rounded-lg border border-white/[0.08] bg-white/[0.02] px-2 py-1 text-zinc-100"
      />
      <div className="flex flex-wrap gap-1.5">
        <button type="button" disabled={busy} onClick={() => onSet("verified_ok", draftNote)} className="rounded-lg bg-emerald-500/30 px-2 py-1 text-[10.5px] font-bold text-emerald-100 hover:bg-emerald-500/50">
          🟢 OK
        </button>
        <button type="button" disabled={busy} onClick={() => onSet("verified_ko", draftNote)} className="rounded-lg bg-rose-500/30 px-2 py-1 text-[10.5px] font-bold text-rose-100 hover:bg-rose-500/50">
          🔴 KO
        </button>
        <button type="button" disabled={busy} onClick={() => onSet("na", draftNote)} className="rounded-lg bg-zinc-500/20 px-2 py-1 text-[10.5px] text-zinc-300 hover:bg-zinc-500/40">
          ⚪ N/A
        </button>
        <button type="button" onClick={onCancel} className="rounded-lg px-2 py-1 text-[10.5px] text-zinc-500 hover:text-zinc-300">
          Annuler
        </button>
      </div>
      <div className="mt-1 text-[9px] text-zinc-600">Vérificateur : {verifier}</div>
    </div>
  );
}
