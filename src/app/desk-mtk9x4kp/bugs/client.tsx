"use client";

import { useState } from "react";
import { Plus, Trash2, Save, AlertCircle, CheckCircle2, Clock, X } from "lucide-react";
import type { DeskBug, BugStatus } from "@/lib/desk/bugs";

const STATUS_LABEL: Record<BugStatus, string> = {
  open: "Ouvert",
  in_progress: "En cours",
  fixed: "Corrigé",
  wont_fix: "Won't fix",
  duplicate: "Doublon",
};

const STATUS_COLOR: Record<BugStatus, string> = {
  open: "#f43f5e",
  in_progress: "#a78bfa",
  fixed: "#10b981",
  wont_fix: "#71717a",
  duplicate: "#52525b",
};

export function BugsClient({ initialBugs }: { initialBugs: DeskBug[] }) {
  const [bugs, setBugs] = useState(initialBugs);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<BugStatus | "all">("all");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<DeskBug>>({});
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  async function api<T>(path: string, method: string, body?: unknown): Promise<T | null> {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch(path, {
        method,
        headers: { "content-type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({ error: r.statusText }));
        setMsg({ type: "err", text: `❌ ${err.error || r.statusText}` });
        return null;
      }
      const data = await r.json();
      if (method !== "GET") {
        setMsg({ type: "ok", text: "✅ Sauvegardé" });
        setTimeout(() => setMsg(null), 1500);
      }
      return data as T;
    } finally {
      setBusy(false);
    }
  }

  async function refresh() {
    const data = await api<DeskBug[]>("/api/desk/bugs", "GET");
    if (data) setBugs(data);
  }

  async function newBug() {
    const title = prompt("Titre du bug (1 ligne) :");
    if (!title) return;
    await api("/api/desk/bugs", "POST", {
      title,
      severity: 3,
      repair_difficulty: 3,
      status: "open",
      reported_by_conv: "CONV-SYSTEMS",
    });
    await refresh();
  }

  async function setStatus(b: DeskBug, status: BugStatus) {
    await api(`/api/desk/bugs/${b.id}`, "PATCH", { status });
    await refresh();
  }

  async function deleteBug(b: DeskBug) {
    if (!confirm(`Supprimer "${b.title}" ?`)) return;
    await api(`/api/desk/bugs/${b.id}`, "DELETE");
    await refresh();
  }

  async function saveEdit() {
    if (!editing) return;
    await api(`/api/desk/bugs/${editing}`, "PATCH", draft);
    await refresh();
    setEditing(null);
    setDraft({});
  }

  const filtered = filter === "all" ? bugs : bugs.filter((b) => b.status === filter);
  const counts = (Object.keys(STATUS_LABEL) as BugStatus[]).reduce<Record<string, number>>((acc, s) => {
    acc[s] = bugs.filter((b) => b.status === s).length;
    return acc;
  }, {});

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 text-zinc-100">
      <div className="mb-6 flex items-baseline justify-between">
        <h1 className="font-display text-[28px] font-bold tracking-tight">Bug tracker</h1>
        <div className="text-[10.5px] uppercase tracking-wider text-zinc-500">
          {bugs.length} bugs · {counts.open ?? 0} ouverts · {counts.fixed ?? 0} corrigés
        </div>
      </div>

      {msg && (
        <div className={`mb-3 rounded-lg border px-3 py-2 text-[12px] ${msg.type === "ok" ? "border-emerald-500/20 bg-emerald-500/[0.05] text-emerald-200" : "border-rose-500/30 bg-rose-500/[0.05] text-rose-200"}`}>
          {msg.text}
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setFilter("all")} className={`rounded-lg px-3 py-1.5 text-[12px] font-semibold ${filter === "all" ? "bg-violet-500/20 text-violet-100" : "border border-white/10 text-zinc-400 hover:bg-white/[0.04]"}`}>
          Tous ({bugs.length})
        </button>
        {(Object.keys(STATUS_LABEL) as BugStatus[]).map((s) => (
          <button key={s} type="button" onClick={() => setFilter(s)} className={`rounded-lg px-3 py-1.5 text-[12px] font-semibold ${filter === s ? "bg-violet-500/20 text-violet-100" : "border border-white/10 text-zinc-400 hover:bg-white/[0.04]"}`}>
            {STATUS_LABEL[s]} ({counts[s] ?? 0})
          </button>
        ))}
        <button type="button" onClick={newBug} disabled={busy} className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-violet-500/40 bg-violet-500/15 px-3 py-1.5 text-[12px] font-bold text-violet-100 hover:bg-violet-500/25 disabled:opacity-50">
          <Plus className="size-3.5" />Nouveau bug
        </button>
      </div>

      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 text-center text-[12.5px] text-zinc-500">
            Aucun bug dans cette catégorie.
          </div>
        )}
        {filtered.map((b) => (
          <BugRow
            key={b.id}
            bug={b}
            isEditing={editing === b.id}
            draft={draft}
            onStartEdit={() => { setEditing(b.id); setDraft({ ...b }); }}
            onCancelEdit={() => { setEditing(null); setDraft({}); }}
            onChangeDraft={(d) => setDraft((cur) => ({ ...cur, ...d }))}
            onSaveEdit={saveEdit}
            onSetStatus={(s) => setStatus(b, s)}
            onDelete={() => deleteBug(b)}
            busy={busy}
          />
        ))}
      </div>
    </main>
  );
}

function BugRow({
  bug,
  isEditing,
  draft,
  onStartEdit,
  onCancelEdit,
  onChangeDraft,
  onSaveEdit,
  onSetStatus,
  onDelete,
  busy,
}: {
  bug: DeskBug;
  isEditing: boolean;
  draft: Partial<DeskBug>;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onChangeDraft: (d: Partial<DeskBug>) => void;
  onSaveEdit: () => void;
  onSetStatus: (s: BugStatus) => void;
  onDelete: () => void;
  busy: boolean;
}) {
  const color = STATUS_COLOR[bug.status];
  const sevColor = bug.severity >= 5 ? "#f43f5e" : bug.severity >= 4 ? "#f59e0b" : bug.severity >= 3 ? "#fbbf24" : "#71717a";

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {isEditing ? (
            <input
              type="text"
              value={draft.title ?? ""}
              onChange={(e) => onChangeDraft({ title: e.target.value })}
              className="w-full rounded-lg border border-white/[0.08] bg-white/[0.02] px-2.5 py-1.5 text-[13px] font-semibold text-zinc-100"
            />
          ) : (
            <div className="font-semibold text-zinc-100">{bug.title}</div>
          )}
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[10.5px] text-zinc-500">
            <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5" style={{ background: `${color}20`, color }}>
              {bug.status === "open" ? <AlertCircle className="size-3" /> : bug.status === "fixed" ? <CheckCircle2 className="size-3" /> : <Clock className="size-3" />}
              {STATUS_LABEL[bug.status]}
            </span>
            <span className="inline-flex rounded px-1.5 py-0.5 font-mono" style={{ background: `${sevColor}20`, color: sevColor }}>
              Sév {bug.severity}/5
            </span>
            <span className="font-mono">Diff {bug.repair_difficulty}/5</span>
            {bug.area && <span>📍 {bug.area}</span>}
            {bug.tags && <span>🏷 {bug.tags}</span>}
            <span className="ml-auto">{new Date(bug.created_at).toLocaleDateString("fr-FR")}</span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {isEditing ? (
            <>
              <button type="button" onClick={onSaveEdit} disabled={busy} className="inline-flex items-center gap-1 rounded-lg bg-violet-500 px-2.5 py-1.5 text-[11px] font-bold text-zinc-50 hover:bg-violet-400">
                <Save className="size-3" />Enr.
              </button>
              <button type="button" onClick={onCancelEdit} className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[11px] text-zinc-300 hover:bg-white/[0.08]">
                <X className="size-3" />
              </button>
            </>
          ) : (
            <>
              <select
                value={bug.status}
                onChange={(e) => onSetStatus(e.target.value as BugStatus)}
                disabled={busy}
                className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-2 py-1 text-[10.5px] text-zinc-200"
              >
                {(Object.keys(STATUS_LABEL) as BugStatus[]).map((s) => (
                  <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                ))}
              </select>
              <button type="button" onClick={onStartEdit} disabled={busy} className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[10.5px] text-zinc-300 hover:bg-white/[0.08]">Éditer</button>
              <button type="button" onClick={onDelete} disabled={busy} className="rounded-lg p-1.5 text-rose-300 hover:bg-rose-500/10">
                <Trash2 className="size-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      {isEditing && (
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Field label="Sévérité (1-5)" type="number" value={String(draft.severity ?? bug.severity)} onChange={(v) => onChangeDraft({ severity: parseInt(v) || 1 })} />
          <Field label="Difficulté répa (1-5)" type="number" value={String(draft.repair_difficulty ?? bug.repair_difficulty)} onChange={(v) => onChangeDraft({ repair_difficulty: parseInt(v) || 1 })} />
          <Field label="Zone (ex /sandbox/v1-8/aapl)" value={draft.area ?? bug.area ?? ""} onChange={(v) => onChangeDraft({ area: v })} />
          <Field label="Tags (séparés par virgule)" value={draft.tags ?? bug.tags ?? ""} onChange={(v) => onChangeDraft({ tags: v })} />
          <Field label="URL repro" value={draft.repro_url ?? bug.repro_url ?? ""} onChange={(v) => onChangeDraft({ repro_url: v })} />
          <Field label="Description" value={draft.description ?? bug.description ?? ""} onChange={(v) => onChangeDraft({ description: v })} multiline cols={3} />
          <Field label="Note de résolution" value={draft.resolution_note ?? bug.resolution_note ?? ""} onChange={(v) => onChangeDraft({ resolution_note: v })} multiline cols={3} />
        </div>
      )}

      {!isEditing && bug.description && (
        <p className="mt-2 text-[12px] text-zinc-400">{bug.description}</p>
      )}
    </div>
  );
}

function Field({ label, value, onChange, type = "text", multiline = false, cols = 1 }: { label: string; value: string; onChange: (v: string) => void; type?: string; multiline?: boolean; cols?: number }) {
  const span = cols === 3 ? "sm:col-span-3" : cols === 2 ? "sm:col-span-2" : "";
  return (
    <div className={span}>
      <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-zinc-500">{label}</label>
      {multiline ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={2} className="w-full resize-none rounded-lg border border-white/[0.08] bg-white/[0.02] px-2.5 py-1.5 text-[12px] text-zinc-100" />
      ) : (
        <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-lg border border-white/[0.08] bg-white/[0.02] px-2.5 py-1.5 text-[12px] text-zinc-100" />
      )}
    </div>
  );
}
