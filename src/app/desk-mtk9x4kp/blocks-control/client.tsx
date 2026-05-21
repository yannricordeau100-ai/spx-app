"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { BLOCK_LABELS, type BlockId } from "@/lib/v1-9-blocks-control";

type Globals = Record<BlockId, boolean>;
type PerTicker = Record<string, Partial<Record<BlockId, boolean>>>;

const BLOCK_IDS = Object.keys(BLOCK_LABELS) as BlockId[];

export function BlocksControlClient({
  initialGlobals,
  initialPerTicker,
}: {
  initialGlobals: Globals;
  initialPerTicker: PerTicker;
}) {
  const [globals, setGlobals] = useState<Globals>(initialGlobals);
  const [perTicker, setPerTicker] = useState<PerTicker>(initialPerTicker);
  const [tickerInput, setTickerInput] = useState("");
  const [saving, startSaving] = useTransition();
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const save = (next: { globals?: Globals; per_ticker_overrides?: PerTicker }) => {
    startSaving(async () => {
      try {
        const payload = {
          global: next.globals ?? globals,
          per_ticker_overrides: next.per_ticker_overrides ?? perTicker,
        };
        const res = await fetch("/api/desk-mtk9x4kp/blocks-control", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const msg = await res.text();
          throw new Error(msg);
        }
        setSavedAt(new Date().toLocaleTimeString("fr-FR"));
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur");
      }
    });
  };

  const toggleGlobal = (blockId: BlockId) => {
    const next = { ...globals, [blockId]: !globals[blockId] };
    setGlobals(next);
    save({ globals: next });
  };

  const setAllGlobals = (value: boolean) => {
    const next = BLOCK_IDS.reduce<Globals>((acc, id) => {
      acc[id] = value;
      return acc;
    }, {} as Globals);
    setGlobals(next);
    save({ globals: next });
  };

  const togglePerTicker = (ticker: string, blockId: BlockId) => {
    const tk = ticker.toUpperCase();
    const currentOverride = perTicker[tk]?.[blockId];
    const currentEffective = typeof currentOverride === "boolean" ? currentOverride : globals[blockId];
    const next: PerTicker = { ...perTicker };
    next[tk] = { ...(next[tk] ?? {}), [blockId]: !currentEffective };
    setPerTicker(next);
    save({ per_ticker_overrides: next });
  };

  const removeTicker = (ticker: string) => {
    const tk = ticker.toUpperCase();
    const next = { ...perTicker };
    delete next[tk];
    setPerTicker(next);
    save({ per_ticker_overrides: next });
  };

  const addTicker = () => {
    const tk = tickerInput.trim().toUpperCase();
    if (!tk) return;
    if (perTicker[tk]) return;
    const next = { ...perTicker, [tk]: {} };
    setPerTicker(next);
    setTickerInput("");
    save({ per_ticker_overrides: next });
  };

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
      <header className="mb-8 max-w-5xl">
        <div className="flex items-center gap-3 mb-2">
          <Link
            href="/desk-mtk9x4kp"
            className="text-xs text-zinc-500 hover:text-emerald-400 transition"
          >
            ← Desk
          </Link>
          <span className="text-zinc-700">/</span>
          <h1 className="text-2xl font-bold tracking-tight">Blocks Control</h1>
          <span className="rounded-md border border-emerald-500/25 bg-emerald-500/[0.08] px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-emerald-300/90">
            V1.9.5
          </span>
        </div>
        <p className="text-sm text-zinc-400">
          Active ou désactive chaque bloc globalement, ou par sté en exception. Désactivé = placeholder &laquo; Bientôt disponible &raquo; affiché à la place du bloc.
        </p>
        <div className="mt-3 flex items-center gap-3 text-xs">
          {saving && <span className="text-emerald-400 animate-pulse">Sauvegarde…</span>}
          {savedAt && !saving && <span className="text-zinc-500">Sauvegardé à {savedAt}</span>}
          {error && <span className="text-rose-400">⚠ {error}</span>}
        </div>
      </header>

      {/* Global toggles */}
      <section className="max-w-5xl mb-10 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
        <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
          <div>
            <h2 className="text-lg font-semibold">Toggles globaux</h2>
            <p className="text-xs text-zinc-500 mt-1">
              S'appliquent à toutes les stés. Désactiver ici masque le bloc partout (les overrides par sté ne peuvent pas le rouvrir).
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setAllGlobals(true)}
              className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-500/20 transition"
            >
              Tout activer
            </button>
            <button
              onClick={() => setAllGlobals(false)}
              className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-300 hover:bg-rose-500/20 transition"
            >
              Tout désactiver
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {BLOCK_IDS.map((blockId) => (
            <label
              key={blockId}
              className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-950/60 px-4 py-3 hover:border-zinc-700 transition cursor-pointer"
            >
              <span className="text-sm font-medium text-zinc-200">
                {BLOCK_LABELS[blockId]}
              </span>
              <input
                type="checkbox"
                checked={globals[blockId] ?? true}
                onChange={() => toggleGlobal(blockId)}
                className="size-5 accent-emerald-500"
              />
            </label>
          ))}
        </div>
      </section>

      {/* Per ticker overrides */}
      <section className="max-w-5xl rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
        <h2 className="text-lg font-semibold mb-1">Exceptions par sté</h2>
        <p className="text-xs text-zinc-500 mb-5">
          Définit un override par sté. N'a effet QUE si le toggle global du bloc est activé.
        </p>

        <div className="flex gap-2 mb-6">
          <input
            type="text"
            value={tickerInput}
            onChange={(e) => setTickerInput(e.target.value)}
            placeholder="Ex: AAPL, NESN.SW, OR.PA…"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTicker();
              }
            }}
            className="flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
          />
          <button
            onClick={addTicker}
            className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-300 hover:bg-emerald-500/20 transition"
          >
            + Ajouter
          </button>
        </div>

        {Object.keys(perTicker).length === 0 ? (
          <p className="text-sm text-zinc-500 italic">
            Aucune exception. Tous les blocs suivent les toggles globaux.
          </p>
        ) : (
          <div className="space-y-3">
            {Object.entries(perTicker)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([ticker, overrides]) => (
                <div
                  key={ticker}
                  className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-mono text-sm font-bold text-emerald-300">{ticker}</span>
                    <button
                      onClick={() => removeTicker(ticker)}
                      className="text-xs text-zinc-500 hover:text-rose-400 transition"
                    >
                      Retirer
                    </button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                    {BLOCK_IDS.map((blockId) => {
                      const ov = overrides[blockId];
                      const effective = typeof ov === "boolean" ? ov : (globals[blockId] ?? true);
                      const isOverride = typeof ov === "boolean";
                      const globalOff = !globals[blockId];
                      return (
                        <button
                          key={blockId}
                          onClick={() => togglePerTicker(ticker, blockId)}
                          disabled={globalOff}
                          className={`flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-[11px] transition ${
                            globalOff
                              ? "border-zinc-800 bg-zinc-900/40 text-zinc-600 cursor-not-allowed"
                              : effective
                                ? isOverride
                                  ? "border-emerald-500/40 bg-emerald-500/[0.08] text-emerald-200"
                                  : "border-zinc-700 bg-zinc-900 text-zinc-300"
                                : isOverride
                                  ? "border-rose-500/40 bg-rose-500/[0.08] text-rose-200"
                                  : "border-zinc-700 bg-zinc-900 text-zinc-500"
                          }`}
                          title={globalOff ? "Global désactivé" : isOverride ? "Override actif" : "Hérite global"}
                        >
                          <span className="truncate">{BLOCK_LABELS[blockId]}</span>
                          <span className="font-mono text-[10px]">
                            {globalOff ? "—" : effective ? "ON" : "OFF"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
          </div>
        )}
      </section>
    </main>
  );
}
