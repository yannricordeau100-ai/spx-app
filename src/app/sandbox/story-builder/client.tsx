"use client";

/**
 * Atelier de création de KPI "story" à partir d'un lien (Yann 26 août 2026).
 *
 * Trois champs seulement : le ticker, l'URL (article ou post X) et une
 * consigne facultative. Le serveur lit la page, en extrait un chiffre et
 * garde la citation exacte, qui reste affichée ici pour contrôle avant
 * publication.
 */

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  Play,
  Trash2,
  Link2,
  Loader2,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { STORY_FAMILIES, type StoryKpi } from "@/lib/desk/story-kpis";

export function StoryBuilderClient({ initialRows }: { initialRows: StoryKpi[] }) {
  const [rows, setRows] = useState<StoryKpi[]>(initialRows);
  const [ticker, setTicker] = useState("");
  const [url, setUrl] = useState("");
  const [hint, setHint] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const isX = /^https?:\/\/(www\.)?(x\.com|twitter\.com)\//i.test(url.trim());

  async function create() {
    if (!ticker.trim() || !url.trim()) {
      setMsg("Ticker et lien obligatoires.");
      return;
    }
    setBusy("create");
    setMsg(null);
    try {
      const res = await fetch("/api/desk/story-kpis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker: ticker.trim(), source_url: url.trim(), hint: hint.trim() || null }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "création impossible");
      setRows((r) => [j.item, ...r]);
      setUrl("");
      setHint("");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  async function extract(id: string) {
    setBusy(id);
    setMsg(null);
    try {
      const res = await fetch("/api/desk/story-kpis/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const j = await res.json();
      if (j.item) setRows((r) => r.map((x) => (x.id === id ? j.item : x)));
      if (!res.ok) throw new Error(j.error ?? "extraction impossible");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  async function remove(id: string) {
    setBusy(id);
    try {
      await fetch(`/api/desk/story-kpis?id=${id}`, { method: "DELETE" });
      setRows((r) => r.filter((x) => x.id !== id));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="min-h-screen bg-[#050507] text-zinc-100">
      <div className="mx-auto max-w-5xl px-6 py-12">
        <Link
          href="/sandbox"
          className="mb-6 inline-flex items-center gap-2 text-[13px] text-zinc-400 hover:text-zinc-100"
        >
          <ArrowLeft className="size-4" />
          Sandbox
        </Link>

        <h1 className="font-display text-[28px] font-bold tracking-tight">KPI story depuis un lien</h1>
        <p className="mt-1 max-w-2xl text-[14px] text-zinc-400">
          Colle l&apos;adresse d&apos;un article ou d&apos;un post X. Le chiffre est extrait avec
          sa phrase source, qui reste affichée pour contrôle. Rien n&apos;est calculé.
        </p>

        <div className="mt-8 rounded-2xl border border-[#1f1f1f] bg-[#0a0a0a] p-5">
          <div className="grid gap-3 sm:grid-cols-[140px_1fr]">
            <input
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              placeholder="GOOGL"
              className="rounded-lg border border-[#262626] bg-[#0c0c0c] px-3 py-2 font-mono text-[13px] uppercase outline-none focus:border-violet-500/60"
            />
            <div className="relative">
              <Link2 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://... ou https://x.com/.../status/..."
                className="w-full rounded-lg border border-[#262626] bg-[#0c0c0c] py-2 pl-9 pr-3 text-[13px] outline-none focus:border-violet-500/60"
              />
            </div>
          </div>
          <input
            value={hint}
            onChange={(e) => setHint(e.target.value)}
            placeholder="Consigne facultative : quel chiffre retenir"
            className="mt-3 w-full rounded-lg border border-[#262626] bg-[#0c0c0c] px-3 py-2 text-[13px] outline-none focus:border-violet-500/60"
          />
          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={create}
              disabled={busy === "create"}
              className="inline-flex items-center gap-2 rounded-lg border border-violet-500/40 bg-violet-500/15 px-4 py-2 text-[13px] font-medium text-violet-100 hover:bg-violet-500/25 disabled:opacity-50"
            >
              {busy === "create" ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              Ajouter
            </button>
            {url.trim() && (
              <span className="font-mono text-[11px] uppercase tracking-wider text-zinc-500">
                source détectée : {isX ? "post X" : "page web"}
              </span>
            )}
          </div>
          {msg && (
            <div className="mt-3 flex items-start gap-2 text-[12.5px] text-amber-300">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              {msg}
            </div>
          )}
        </div>

        <div className="mt-8 flex flex-col gap-3">
          {rows.length === 0 && (
            <p className="text-[13px] text-zinc-500">Aucune story pour le moment.</p>
          )}
          {rows.map((r) => (
            <div key={r.id} className="rounded-xl border border-[#1f1f1f] bg-[#080808] p-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-md border border-[#262626] px-2 py-0.5 font-mono text-[11px] text-zinc-300">
                  {r.ticker}
                </span>
                <span className="font-mono text-[10.5px] uppercase tracking-wider text-zinc-500">
                  {r.source_kind === "x" ? "post X" : "web"}
                </span>
                {r.family && (
                  <span className="rounded-md border border-[#262626] px-2 py-0.5 text-[11px] text-zinc-400">
                    {STORY_FAMILIES.find((f) => f.key === r.family)?.label_fr ?? r.family}
                  </span>
                )}
                <span
                  className={`inline-flex items-center gap-1 text-[11.5px] ${
                    r.status === "done"
                      ? "text-emerald-400"
                      : r.status === "error"
                        ? "text-rose-400"
                        : "text-zinc-400"
                  }`}
                >
                  {r.status === "done" ? (
                    <CheckCircle2 className="size-3.5" />
                  ) : r.status === "error" ? (
                    <AlertTriangle className="size-3.5" />
                  ) : null}
                  {r.status}
                </span>
                <div className="ml-auto flex items-center gap-2">
                  <button
                    onClick={() => extract(r.id)}
                    disabled={busy === r.id}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#262626] px-3 py-1.5 text-[12px] text-zinc-200 hover:bg-white/5 disabled:opacity-50"
                  >
                    {busy === r.id ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
                    Extraire
                  </button>
                  <button
                    onClick={() => remove(r.id)}
                    className="inline-flex items-center rounded-lg border border-[#262626] p-1.5 text-zinc-400 hover:text-rose-300"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>

              {r.kpi_value != null && (
                <div className="mt-3 flex flex-wrap items-baseline gap-x-3">
                  <span className="font-mono text-[22px] font-semibold tabular-nums text-zinc-50">
                    {r.kpi_value.toLocaleString("fr-FR")}
                  </span>
                  <span className="text-[13px] text-zinc-400">{r.kpi_unit}</span>
                  <span className="text-[13.5px] text-zinc-200">{r.kpi_name_fr}</span>
                  {r.kpi_period && (
                    <span className="font-mono text-[11px] text-zinc-500">{r.kpi_period}</span>
                  )}
                </div>
              )}
              {r.signal_fr && <p className="mt-1 text-[13px] text-zinc-300">{r.signal_fr}</p>}
              {r.evidence && (
                <p className="mt-2 border-l-2 border-[#262626] pl-3 text-[12.5px] italic text-zinc-400">
                  {r.evidence}
                </p>
              )}
              {r.error_msg && <p className="mt-2 text-[12.5px] text-rose-300">{r.error_msg}</p>}
              <a
                href={r.source_url}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-block max-w-full truncate text-[11.5px] text-zinc-500 underline decoration-dotted underline-offset-4 hover:text-zinc-300"
              >
                {r.source_url}
              </a>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
