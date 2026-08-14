"use client";

/**
 * Desk ATT — back-office Anti-thèse d'investissement (Yann 14 août 2026).
 *
 * Tableau des 651 stés V1.9.5 : ticker, intensité, rédigée le, figée,
 * présent/absent + provenance (local / Supabase). Recherche par ticker.
 * Clic sur une ligne → éditeur JSON (textarea) qui sauvegarde dans la table
 * Supabase `desk_att` via /api/desk/att (l'override REMPLACE le JSON local
 * au chargement de la page sté). Bouton "Figer" pose `_fige: true`.
 */

import { useEffect, useMemo, useState } from "react";
import { Search, Save, Snowflake, Trash2, X, RefreshCw } from "lucide-react";

type AttListRow = {
  ticker: string;
  present: boolean;
  source: "supabase" | "local" | null;
  intensite: string | null;
  redigee_le: string | null;
  fige: boolean;
};

const INTENSITE_COLOR: Record<string, string> = {
  faible: "#10b981",
  moderee: "#f59e0b",
  elevee: "#f43f5e",
};

const INTENSITE_LABEL: Record<string, string> = {
  faible: "Faible",
  moderee: "Modérée",
  elevee: "Élevée",
};

export function AttDeskClient() {
  const [rows, setRows] = useState<AttListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [onlyPresent, setOnlyPresent] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  // Éditeur
  const [editing, setEditing] = useState<string | null>(null);
  const [editorSource, setEditorSource] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  async function refresh() {
    setLoading(true);
    try {
      const r = await fetch("/api/desk/att");
      if (r.ok) setRows((await r.json()) as AttListRow[]);
      else setMsg({ type: "err", text: `Erreur liste (${r.status})` });
    } catch {
      setMsg({ type: "err", text: "Erreur réseau sur la liste" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toUpperCase();
    return rows.filter((r) => {
      if (onlyPresent && !r.present) return false;
      if (q && !r.ticker.includes(q)) return false;
      return true;
    });
  }, [rows, search, onlyPresent]);

  const presentCount = rows.filter((r) => r.present).length;

  async function openEditor(ticker: string) {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch(`/api/desk/att?ticker=${encodeURIComponent(ticker)}`);
      if (!r.ok) {
        setMsg({ type: "err", text: `Erreur chargement ${ticker} (${r.status})` });
        return;
      }
      const data = (await r.json()) as { source: string | null; payload: unknown };
      setEditing(ticker);
      setEditorSource(data.source);
      setDraft(
        data.payload
          ? JSON.stringify(data.payload, null, 2)
          : JSON.stringify(
              {
                ticker,
                redigee_le: new Date().toISOString().slice(0, 10),
                donnees_arretees_au: "",
                intensite: "moderee",
                hook: "",
                resume: "",
                fondamental_interne: [],
                fondamental_externe: [],
                quantitatif: [],
                ce_qui_affaiblirait: [],
                glossaire: {},
                _redige_par: "desk",
                _fige: false,
              },
              null,
              2,
            ),
      );
    } catch {
      setMsg({ type: "err", text: `Erreur réseau sur ${ticker}` });
    } finally {
      setBusy(false);
    }
  }

  async function save(figer?: boolean) {
    if (!editing) return;
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(draft) as Record<string, unknown>;
    } catch {
      setMsg({ type: "err", text: "JSON invalide : corriger avant de sauvegarder" });
      return;
    }
    if (figer) payload._fige = true;
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/desk/att", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ticker: editing, payload }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({ error: r.statusText }));
        setMsg({ type: "err", text: String((err as { error?: string }).error ?? r.statusText) });
        return;
      }
      setDraft(JSON.stringify(payload, null, 2));
      setEditorSource("supabase");
      setMsg({ type: "ok", text: figer ? `${editing} sauvegardée et figée` : `${editing} sauvegardée (override Supabase)` });
      await refresh();
    } catch {
      setMsg({ type: "err", text: "Erreur réseau à la sauvegarde" });
    } finally {
      setBusy(false);
    }
  }

  async function removeOverride() {
    if (!editing) return;
    if (!confirm(`Supprimer l'override Supabase de ${editing} ? (retour au JSON local s'il existe)`)) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/desk/att?ticker=${encodeURIComponent(editing)}`, {
        method: "DELETE",
      });
      if (r.ok) {
        setMsg({ type: "ok", text: `Override ${editing} supprimé` });
        await openEditor(editing);
        await refresh();
      } else {
        setMsg({ type: "err", text: `Erreur suppression (${r.status})` });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 text-zinc-200">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold text-zinc-50">
            ATT : Anti-thèse d&apos;investissement
          </h1>
          <p className="mt-0.5 text-[13px] text-zinc-400">
            {presentCount} / {rows.length} stés couvertes. Un override Supabase remplace le JSON local.
          </p>
        </div>
        <button
          onClick={() => void refresh()}
          disabled={loading || busy}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#2a2a2a] bg-[#0d0d0d] px-3 py-1.5 text-[12.5px] text-zinc-300 transition-colors hover:border-[#3a3a3a] disabled:opacity-50"
        >
          <RefreshCw className="size-3.5" /> Rafraîchir
        </button>
      </div>

      {msg && (
        <div
          className="mb-4 rounded-lg border px-3 py-2 text-[13px]"
          style={{
            borderColor: msg.type === "ok" ? "#10b98155" : "#f43f5e55",
            background: msg.type === "ok" ? "#10b9811a" : "#f43f5e1a",
            color: msg.type === "ok" ? "#34d399" : "#fb7185",
          }}
        >
          {msg.text}
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-zinc-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un ticker"
            className="w-56 rounded-lg border border-[#2a2a2a] bg-[#0d0d0d] py-1.5 pl-8 pr-3 text-[13px] text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-violet-500/60"
          />
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-[12.5px] text-zinc-400">
          <input
            type="checkbox"
            checked={onlyPresent}
            onChange={(e) => setOnlyPresent(e.target.checked)}
            className="accent-violet-500"
          />
          Présentes uniquement
        </label>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[#1a1a1a]">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-[#1a1a1a] bg-[#0a0a0a] text-left font-mono text-[11px] uppercase tracking-wider text-zinc-500">
              <th className="px-3 py-2.5">Ticker</th>
              <th className="px-3 py-2.5">Statut</th>
              <th className="px-3 py-2.5">Source</th>
              <th className="px-3 py-2.5">Intensité</th>
              <th className="px-3 py-2.5">Rédigée le</th>
              <th className="px-3 py-2.5">Figée</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-zinc-500">
                  Chargement...
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr
                  key={r.ticker}
                  onClick={() => void openEditor(r.ticker)}
                  className="cursor-pointer border-b border-[#141414] transition-colors hover:bg-[#101010]"
                >
                  <td className="px-3 py-2 font-mono font-semibold text-zinc-100">{r.ticker}</td>
                  <td className="px-3 py-2">
                    {r.present ? (
                      <span className="text-emerald-400">Présente</span>
                    ) : (
                      <span className="text-zinc-600">Absente</span>
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono text-[11.5px] text-zinc-400">
                    {r.present ? (r.source === "supabase" ? "Supabase" : "Local") : ""}
                  </td>
                  <td className="px-3 py-2">
                    {r.intensite ? (
                      <span
                        className="rounded-md px-1.5 py-0.5 font-mono text-[10.5px] font-semibold uppercase tracking-wider"
                        style={{
                          color: INTENSITE_COLOR[r.intensite] ?? "#a1a1aa",
                          background: `${INTENSITE_COLOR[r.intensite] ?? "#a1a1aa"}1a`,
                        }}
                      >
                        {INTENSITE_LABEL[r.intensite] ?? r.intensite}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 font-mono text-[12px] text-zinc-400">{r.redigee_le ?? ""}</td>
                  <td className="px-3 py-2">{r.fige ? <Snowflake className="size-3.5 text-cyan-300" /> : null}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Éditeur */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-xl border border-[#2a2a2a] bg-[#0a0a0a] p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="font-mono text-[15px] font-semibold text-zinc-50">{editing}</span>
                <span className="font-mono text-[11px] uppercase tracking-wider text-zinc-500">
                  {editorSource === "supabase"
                    ? "Override Supabase actif"
                    : editorSource === "local"
                      ? "JSON local (pas d'override)"
                      : "Nouvelle ATT"}
                </span>
              </div>
              <button
                onClick={() => setEditing(null)}
                className="rounded-md p-1 text-zinc-400 transition-colors hover:bg-[#1a1a1a] hover:text-zinc-100"
              >
                <X className="size-4" />
              </button>
            </div>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              spellCheck={false}
              className="min-h-[50vh] flex-1 resize-y rounded-lg border border-[#2a2a2a] bg-[#070707] p-3 font-mono text-[12px] leading-relaxed text-zinc-200 outline-none focus:border-violet-500/60"
            />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <button
                onClick={() => void removeOverride()}
                disabled={busy || editorSource !== "supabase"}
                className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 text-[12.5px] text-rose-300 transition-colors hover:border-rose-400 disabled:opacity-40"
              >
                <Trash2 className="size-3.5" /> Supprimer l&apos;override
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => void save(true)}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-[12.5px] text-cyan-300 transition-colors hover:border-cyan-400 disabled:opacity-50"
                >
                  <Snowflake className="size-3.5" /> Figer
                </button>
                <button
                  onClick={() => void save(false)}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-violet-500/50 bg-violet-500/15 px-4 py-1.5 text-[12.5px] font-semibold text-violet-200 transition-colors hover:border-violet-400 disabled:opacity-50"
                >
                  <Save className="size-3.5" /> Sauvegarder
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
