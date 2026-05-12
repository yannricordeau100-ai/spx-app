"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink, Plus, Trash2, Save, AlertCircle, CheckCircle2, Clock, X, Search } from "lucide-react";
import type { IrSource, IrSourceStatus } from "@/lib/desk/ir-sources";

const STATUS_LABEL: Record<IrSourceStatus, string> = {
  todo: "À saisir",
  partial: "Partiel",
  complete: "Complet",
  verified: "Vérifié",
};

const STATUS_COLOR: Record<IrSourceStatus, string> = {
  todo: "#71717a",
  partial: "#f59e0b",
  complete: "#a78bfa",
  verified: "#10b981",
};

export function IrSourcesClient({
  initialRows,
  top307Tickers,
}: {
  initialRows: IrSource[];
  top307Tickers: string[];
}) {
  const [rows, setRows] = useState(initialRows);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [filter, setFilter] = useState<IrSourceStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<IrSource>>({});

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
    const data = await api<IrSource[]>("/api/desk/ir-sources", "GET");
    if (data) setRows(data);
  }

  async function seedTop307() {
    if (!confirm(`Pré-remplir la table avec les ${top307Tickers.length} stés du top 307 V1.8 ? (statut TODO)`)) return;
    const result = await api<{ inserted: number; skipped: number }>(
      "/api/desk/ir-sources",
      "POST",
      { action: "seed", tickers: top307Tickers },
    );
    if (result) {
      setMsg({ type: "ok", text: `✅ ${result.inserted} stés ajoutées, ${result.skipped} déjà présentes` });
      await refresh();
    }
  }

  async function saveEdit() {
    if (!editing) return;
    const payload = { ...draft, ticker: editing };
    // Parse additional URLs depuis le textarea (1 URL par ligne)
    if (typeof draft.ir_docs_additional_urls === "string") {
      payload.ir_docs_additional_urls = (draft.ir_docs_additional_urls as unknown as string)
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
    }
    await api(`/api/desk/ir-sources/${editing}`, "PATCH", payload);
    await refresh();
    setEditing(null);
    setDraft({});
  }

  async function deleteRow(ticker: string) {
    if (!confirm(`Supprimer la sté ${ticker} de la table IR ?`)) return;
    await api(`/api/desk/ir-sources/${ticker}`, "DELETE");
    await refresh();
  }

  async function newTicker() {
    const ticker = prompt("Ticker de la nouvelle sté :");
    if (!ticker) return;
    await api("/api/desk/ir-sources", "POST", { ticker: ticker.toUpperCase() });
    await refresh();
  }

  async function markVerified(ticker: string) {
    await api(`/api/desk/ir-sources/${ticker}`, "PATCH", { status: "verified" });
    await refresh();
  }

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (filter !== "all" && r.status !== filter) return false;
      if (search && !r.ticker.toUpperCase().includes(search.toUpperCase())) return false;
      return true;
    });
  }, [rows, filter, search]);

  const stats = useMemo(() => {
    const s: Record<IrSourceStatus, number> = { todo: 0, partial: 0, complete: 0, verified: 0 };
    for (const r of rows) s[r.status]++;
    return s;
  }, [rows]);

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-8 text-zinc-100">
      <div className="mb-4 flex items-baseline justify-between">
        <h1 className="font-display text-[24px] font-bold tracking-tight">
          Sources IR · {rows.length} sés
        </h1>
        <div className="flex items-center gap-3 text-[11px]">
          <Link href="/desk-mtk9x4kp" className="text-violet-300 hover:underline">← Desk</Link>
          <span className="text-zinc-500">
            ⚪ {stats.todo} · 🟡 {stats.partial} · 🟣 {stats.complete} · 🟢 {stats.verified}
          </span>
        </div>
      </div>

      {msg && (
        <div className={`mb-3 rounded-lg border px-3 py-2 text-[12px] ${msg.type === "ok" ? "border-emerald-500/20 bg-emerald-500/[0.05] text-emerald-200" : "border-rose-500/30 bg-rose-500/[0.05] text-rose-200"}`}>
          {msg.text}
        </div>
      )}

      {/* Bandeau action + filtres */}
      <div className="mb-4 flex flex-wrap items-center gap-2 text-[12px]">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as IrSourceStatus | "all")}
          className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-2 py-1 text-zinc-100"
        >
          <option value="all">Tous ({rows.length})</option>
          {(Object.keys(STATUS_LABEL) as IrSourceStatus[]).map((s) => (
            <option key={s} value={s}>{STATUS_LABEL[s]} ({stats[s]})</option>
          ))}
        </select>
        <div className="inline-flex items-center gap-1 rounded-lg border border-white/[0.08] bg-white/[0.02] px-2 py-1">
          <Search className="size-3 text-zinc-500" />
          <input
            type="text"
            placeholder="Filtrer par ticker"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-32 bg-transparent text-zinc-100 outline-none placeholder:text-zinc-600"
          />
        </div>
        <button
          type="button"
          onClick={seedTop307}
          disabled={busy}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-violet-500/40 bg-violet-500/15 px-3 py-1.5 font-bold text-violet-100 hover:bg-violet-500/25 disabled:opacity-50"
        >
          <Plus className="size-3.5" />Pré-remplir top 307 V1.8
        </button>
        <button
          type="button"
          onClick={newTicker}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 font-semibold text-zinc-100 hover:bg-white/[0.08] disabled:opacity-50"
        >
          <Plus className="size-3.5" />Ajouter sté
        </button>
      </div>

      <p className="mb-4 rounded-lg border border-violet-500/20 bg-violet-500/[0.05] px-3 py-2 text-[12px] text-zinc-300">
        Pour chaque sté, saisir <strong>jusqu'à 4 URLs</strong> : site corp (accueil), page d'accueil IR,
        page principale des docs IR, et 0-N pages additionnelles (si docs éclatés). Exemple NVDA :
        un seul lien (<code>investor.nvidia.com/financial-info/financial-reports/default.aspx</code>) car tout est regroupé.
        Le scraper Python (CONV-DATA) utilisera ces URLs pour télécharger les CFO commentary, press releases,
        transcripts, slides earning call qui ne sont PAS sur SEC EDGAR.
      </p>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.05] p-6 text-center text-[13px] text-amber-200">
          {rows.length === 0
            ? "Aucune sté. Clique « Pré-remplir top 307 V1.8 » pour seeder."
            : `Aucune sté correspondant au filtre (${filter}${search ? ` + recherche "${search}"` : ""}).`}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
          <table className="min-w-full text-[12px]">
            <thead className="bg-white/[0.03]">
              <tr>
                <th className="px-3 py-2 text-left font-bold text-zinc-300">Ticker</th>
                <th className="px-3 py-2 text-left font-bold text-zinc-300">Statut</th>
                <th className="px-3 py-2 text-left font-bold text-zinc-300">Site corp</th>
                <th className="px-3 py-2 text-left font-bold text-zinc-300">IR home</th>
                <th className="px-3 py-2 text-left font-bold text-zinc-300">IR docs (principal)</th>
                <th className="px-3 py-2 text-center font-bold text-zinc-300">Pages add.</th>
                <th className="px-3 py-2 text-right font-bold text-zinc-300">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => {
                const color = STATUS_COLOR[row.status];
                const isEditing = editing === row.ticker;
                return (
                  <tr key={row.ticker} className="border-t border-white/[0.04] hover:bg-white/[0.02]">
                    {isEditing ? (
                      <td colSpan={7} className="px-3 py-4">
                        <EditForm
                          row={row}
                          draft={draft}
                          onChange={(d) => setDraft((cur) => ({ ...cur, ...d }))}
                          onSave={saveEdit}
                          onCancel={() => { setEditing(null); setDraft({}); }}
                          busy={busy}
                        />
                      </td>
                    ) : (
                      <>
                        <td className="px-3 py-2 font-mono font-bold text-violet-200">{row.ticker}</td>
                        <td className="px-3 py-2">
                          <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10.5px] font-bold" style={{ background: `${color}20`, color }}>
                            {row.status === "complete" ? <CheckCircle2 className="size-2.5" /> : row.status === "partial" ? <Clock className="size-2.5" /> : row.status === "verified" ? <CheckCircle2 className="size-2.5" /> : <AlertCircle className="size-2.5" />}
                            {STATUS_LABEL[row.status]}
                          </span>
                        </td>
                        <td className="px-3 py-2"><UrlPreview url={row.home_url} /></td>
                        <td className="px-3 py-2"><UrlPreview url={row.ir_home_url} /></td>
                        <td className="px-3 py-2"><UrlPreview url={row.ir_docs_main_url} /></td>
                        <td className="px-3 py-2 text-center text-zinc-400">
                          {(row.ir_docs_additional_urls?.length ?? 0) > 0 ? `+${row.ir_docs_additional_urls.length}` : "—"}
                        </td>
                        <td className="px-2 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => { setEditing(row.ticker); setDraft({ ...row, ir_docs_additional_urls: (row.ir_docs_additional_urls ?? []).join("\n") as unknown as string[] }); }}
                            disabled={busy}
                            className="mr-1 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10.5px] text-zinc-300 hover:bg-white/[0.08]"
                          >
                            Éditer
                          </button>
                          {row.status === "complete" && (
                            <button
                              type="button"
                              onClick={() => markVerified(row.ticker)}
                              disabled={busy}
                              title="Marquer vérifié (gel)"
                              className="mr-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[10.5px] text-emerald-200 hover:bg-emerald-500/15"
                            >
                              ✓ Vérifié
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => deleteRow(row.ticker)}
                            disabled={busy}
                            className="rounded-lg p-1 text-rose-300 hover:bg-rose-500/10"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

function UrlPreview({ url }: { url: string | null }) {
  if (!url) return <span className="text-zinc-600">—</span>;
  let label = url;
  try {
    const u = new URL(url);
    label = u.host.replace("www.", "") + (u.pathname && u.pathname !== "/" ? u.pathname.slice(0, 30) + "…" : "");
  } catch {}
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 truncate text-[11px] text-violet-200 hover:underline"
      style={{ maxWidth: 200 }}
    >
      <span className="truncate">{label}</span>
      <ExternalLink className="size-3 shrink-0" />
    </a>
  );
}

function EditForm({
  row,
  draft,
  onChange,
  onSave,
  onCancel,
  busy,
}: {
  row: IrSource;
  draft: Partial<IrSource>;
  onChange: (d: Partial<IrSource>) => void;
  onSave: () => void;
  onCancel: () => void;
  busy: boolean;
}) {
  return (
    <div className="rounded-xl border border-violet-500/20 bg-violet-500/[0.04] p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="font-mono text-[14px] font-bold text-violet-200">{row.ticker}</h3>
        <div className="flex gap-1.5">
          <button type="button" onClick={onSave} disabled={busy} className="inline-flex items-center gap-1 rounded-lg bg-violet-500 px-3 py-1.5 text-[11px] font-bold text-zinc-50 hover:bg-violet-400">
            <Save className="size-3" />Enregistrer
          </button>
          <button type="button" onClick={onCancel} className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] text-zinc-300 hover:bg-white/[0.08]">
            <X className="size-3" />Annuler
          </button>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <UrlField label="Site corp (accueil)" placeholder="https://www.nvidia.com" value={draft.home_url ?? row.home_url ?? ""} onChange={(v) => onChange({ home_url: v })} />
        <UrlField label="IR home" placeholder="https://investor.nvidia.com" value={draft.ir_home_url ?? row.ir_home_url ?? ""} onChange={(v) => onChange({ ir_home_url: v })} />
        <UrlField label="IR docs (principal)" placeholder="https://investor.nvidia.com/financial-info/financial-reports/default.aspx" value={draft.ir_docs_main_url ?? row.ir_docs_main_url ?? ""} onChange={(v) => onChange({ ir_docs_main_url: v })} fullWidth />
        <div className="sm:col-span-2">
          <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-zinc-500">Pages additionnelles (1 URL par ligne)</label>
          <textarea
            value={(draft.ir_docs_additional_urls as unknown as string) ?? ""}
            onChange={(e) => onChange({ ir_docs_additional_urls: e.target.value as unknown as string[] })}
            rows={3}
            placeholder="Si docs éclatés sur plusieurs pages : 1 URL par ligne&#10;ex: /press-releases&#10;     /annual-reports"
            className="w-full resize-none rounded-lg border border-white/[0.08] bg-white/[0.02] px-2.5 py-1.5 font-mono text-[11px] text-zinc-100"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-zinc-500">Notes</label>
          <textarea
            value={draft.notes ?? row.notes ?? ""}
            onChange={(e) => onChange({ notes: e.target.value })}
            rows={2}
            placeholder="Notes (ex : site JS-heavy, scraper Playwright requis)"
            className="w-full resize-none rounded-lg border border-white/[0.08] bg-white/[0.02] px-2.5 py-1.5 text-[12px] text-zinc-100"
          />
        </div>
      </div>
    </div>
  );
}

function UrlField({ label, placeholder, value, onChange, fullWidth = false }: {
  label: string; placeholder?: string; value: string; onChange: (v: string) => void; fullWidth?: boolean;
}) {
  return (
    <div className={fullWidth ? "sm:col-span-2" : ""}>
      <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-zinc-500">{label}</label>
      <input
        type="url"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-white/[0.08] bg-white/[0.02] px-2.5 py-1.5 font-mono text-[11px] text-zinc-100"
      />
    </div>
  );
}
