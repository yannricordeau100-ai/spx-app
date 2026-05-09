"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  COLUMN_KEYS,
  COLUMN_LABEL,
  finalStatus,
  type ColumnKey,
  type CompanyRow,
  type Cell,
  type FinalStatus,
} from "@/lib/desk/data-quality-matrix";

const STATUS_GLYPH: Record<FinalStatus, string> = {
  verified_ok: "🟢",
  verified_ko: "🔴",
  na: "⚪",
  auto_ok: "🟡",
  auto_ko: "🟠",
};

const STATUS_LABEL: Record<FinalStatus, string> = {
  verified_ok: "Vérifié OK",
  verified_ko: "Vérifié KO",
  na: "Sans objet",
  auto_ok: "Auto OK (à vérifier)",
  auto_ko: "Auto KO (manquant)",
};

export function MatrixClient({
  initialRows,
  initialLimit,
}: {
  initialRows: CompanyRow[];
  initialLimit: number;
}) {
  const [rows, setRows] = useState(initialRows);
  const [limit] = useState(initialLimit);
  const [filterCol, setFilterCol] = useState<ColumnKey | "all">("all");
  const [filterStatus, setFilterStatus] = useState<FinalStatus | "all">("all");
  const [verifier, setVerifier] = useState("YANN");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [editingCell, setEditingCell] = useState<{ ticker: string; col: ColumnKey } | null>(null);
  const [draftNote, setDraftNote] = useState("");

  // Stats globales par colonne (% verified vs ko vs auto).
  const colStats = useMemo(() => {
    const stats: Record<ColumnKey, { verified: number; auto_ok: number; ko: number; na: number }> = {} as never;
    for (const col of COLUMN_KEYS) {
      stats[col] = { verified: 0, auto_ok: 0, ko: 0, na: 0 };
    }
    for (const row of rows) {
      for (const col of COLUMN_KEYS) {
        const fs = finalStatus(row.cells[col]);
        if (fs === "verified_ok") stats[col].verified++;
        else if (fs === "auto_ok") stats[col].auto_ok++;
        else if (fs === "verified_ko" || fs === "auto_ko") stats[col].ko++;
        else if (fs === "na") stats[col].na++;
      }
    }
    return stats;
  }, [rows]);

  // Filtrage des lignes selon (col, status).
  const filtered = useMemo(() => {
    if (filterCol === "all" && filterStatus === "all") return rows;
    return rows.filter((row) => {
      if (filterCol !== "all") {
        const fs = finalStatus(row.cells[filterCol]);
        if (filterStatus !== "all" && fs !== filterStatus) return false;
        if (filterStatus === "all") return true;
        return true;
      }
      return COLUMN_KEYS.some((c) => finalStatus(row.cells[c]) === filterStatus);
    });
  }, [rows, filterCol, filterStatus]);

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
      // Update locale optimiste
      setRows((cur) =>
        cur.map((row) =>
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
          <option value="verified_ko">🔴 Vérifié KO</option>
          <option value="auto_ok">🟡 Auto OK</option>
          <option value="auto_ko">🟠 Auto KO</option>
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
              <th className="sticky left-0 z-20 bg-zinc-900/95 px-3 py-2 text-left font-bold text-zinc-300">Sté</th>
              {COLUMN_KEYS.map((col) => (
                <th key={col} className="px-2 py-2 text-center font-bold text-zinc-300" title={COLUMN_LABEL[col]}>
                  <div className="text-[10.5px]">{COLUMN_LABEL[col]}</div>
                  <div className="mt-0.5 text-[9px] font-normal text-emerald-400/70">
                    🟢{colStats[col].verified} 🟡{colStats[col].auto_ok} 🟠{colStats[col].ko}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
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
                        {cell.hint && fs === "auto_ok" && (
                          <span className="text-[8px] text-emerald-400/70">{cell.hint.slice(0, 12)}</span>
                        )}
                      </button>

                      {isEditing && <CellEditor cell={cell} verifier={verifier} busy={busy} onSet={(s, notes) => setStatus(row.ticker, col, s, notes)} onCancel={() => { setEditingCell(null); setDraftNote(""); }} draftNote={draftNote} setDraftNote={setDraftNote} />}
                    </td>
                  );
                })}
              </tr>
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
        <div><strong>Auto :</strong> {cell.status === "auto_ok" ? "🟡 OK" : cell.status === "auto_ko" ? "🟠 KO" : "⚪"}</div>
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
