"use client";

import { useState } from "react";
import { Play, Loader2 } from "lucide-react";

/**
 * Bouton "Run now" pour déclencher manuellement le daily-doc-watcher.
 * POST /api/sandbox/daily-doc-watcher/run (admin-gated côté API).
 */
export function DailyDocWatcherRunButton() {
  const [state, setState] = useState<"idle" | "running" | "done" | "error">("idle");
  const [msg, setMsg] = useState<string>("");

  async function onClick() {
    setState("running");
    setMsg("");
    try {
      const res = await fetch("/api/sandbox/daily-doc-watcher/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok) {
        setState("error");
        setMsg(data.error ?? "Erreur inconnue.");
        return;
      }
      setState("done");
      setMsg(data.message ?? "Run lancé en arrière-plan. Recharge la page dans quelques minutes.");
    } catch (err) {
      setState("error");
      setMsg(err instanceof Error ? err.message : "Erreur réseau.");
    }
  }

  const isBusy = state === "running";
  const label =
    state === "running"
      ? "En cours…"
      : state === "done"
      ? "Run lancé"
      : state === "error"
      ? "Réessayer"
      : "Run now";

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={onClick}
        disabled={isBusy}
        className="inline-flex items-center gap-2 rounded-lg border border-violet-500/40 bg-violet-500/20 px-3 py-1.5 text-xs font-semibold text-violet-100 hover:bg-violet-500/30 disabled:opacity-50"
      >
        {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
        {label}
      </button>
      {msg ? (
        <p
          className={`text-xs max-w-md text-right ${
            state === "error" ? "text-rose-300" : "text-slate-400"
          }`}
        >
          {msg}
        </p>
      ) : null}
    </div>
  );
}
