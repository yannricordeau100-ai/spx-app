"use client";

import { useState } from "react";
import {
  WORDMARK_VARIANTS,
  WORDMARK_VARIANT_META,
} from "@/components/wordmark-variants";

type ApplyState =
  | { status: "idle" }
  | { status: "loading"; id: string }
  | { status: "ok"; id: string }
  | { status: "error"; id: string; message: string };

export function LogoLabClient({ initialActiveId }: { initialActiveId: string }) {
  const [activeId, setActiveId] = useState(initialActiveId);
  const [apply, setApply] = useState<ApplyState>({ status: "idle" });

  async function handleApply(id: string) {
    setApply({ status: "loading", id });
    try {
      const res = await fetch("/api/sandbox/active-wordmark", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; detail?: string; hint?: string };
      if (!res.ok || !data.ok) {
        const msg = [data.error, data.detail, data.hint].filter(Boolean).join(" : ");
        setApply({ status: "error", id, message: msg || `HTTP ${res.status}` });
        return;
      }
      setActiveId(id);
      setApply({ status: "ok", id });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setApply({ status: "error", id, message });
    }
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 text-zinc-100">
      <header className="mb-8">
        <h1 className="font-display text-[28px] font-bold tracking-tight">Logo Lab</h1>
        <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-zinc-400">
          {WORDMARK_VARIANT_META.length} variantes du wordmark Mettrik. Clique
          sur «&nbsp;Appliquer&nbsp;» pour propager la variante choisie partout
          dans l&apos;app (home, top-nav, maintenance, pricing, etc).
        </p>
        <div className="mt-3 inline-flex items-center gap-2 rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-1.5 text-[12px] text-violet-100">
          <span className="font-mono text-[11px] uppercase tracking-wider text-violet-300">
            Actif
          </span>
          <span className="font-mono font-semibold">{activeId}</span>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {WORDMARK_VARIANT_META.map((meta) => {
          const Variant = WORDMARK_VARIANTS[meta.id];
          const isActive = meta.id === activeId;
          const isLoading = apply.status === "loading" && apply.id === meta.id;
          const isOk = apply.status === "ok" && apply.id === meta.id;
          const isError = apply.status === "error" && apply.id === meta.id;

          return (
            <article
              key={meta.id}
              className={`relative flex flex-col gap-4 rounded-2xl border bg-white/[0.02] p-5 transition-colors ${
                isActive
                  ? "border-violet-400/60 bg-violet-500/[0.06]"
                  : "border-white/[0.06] hover:border-white/[0.12]"
              }`}
            >
              {isActive && (
                <div className="absolute right-3 top-3 rounded-full bg-violet-500/20 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-violet-200">
                  Actif
                </div>
              )}

              <div className="flex flex-col gap-1">
                <div className="font-mono text-[10.5px] uppercase tracking-wider text-zinc-500">
                  {meta.id}
                </div>
                <div className="text-[13.5px] font-semibold text-zinc-100">
                  {meta.label}
                </div>
                <div className="text-[11.5px] text-zinc-400">{meta.family}</div>
              </div>

              {/* Aperçu petit (~80px wide) */}
              <div className="flex items-center justify-center rounded-lg border border-white/[0.04] bg-black/40 p-3">
                <div style={{ transform: "scale(0.4)", transformOrigin: "center" }}>
                  <Variant size="md" animated={false} showRail showSubtitle={false} />
                </div>
              </div>

              {/* Aperçu grand (~280px wide) */}
              <div className="flex min-h-[160px] items-center justify-center rounded-lg border border-white/[0.04] bg-black/40 p-4">
                <div style={{ transform: "scale(0.55)", transformOrigin: "center" }}>
                  <Variant size="lg" animated showRail showSubtitle />
                </div>
              </div>

              <div className="mt-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleApply(meta.id)}
                  disabled={isLoading || isActive}
                  className={`flex-1 rounded-lg px-3 py-2 text-[12.5px] font-semibold transition-colors ${
                    isActive
                      ? "cursor-default bg-violet-500/20 text-violet-200"
                      : isLoading
                      ? "cursor-wait bg-white/10 text-zinc-300"
                      : "bg-violet-500/80 text-white hover:bg-violet-500"
                  }`}
                >
                  {isActive
                    ? "Variante active"
                    : isLoading
                    ? "Application en cours..."
                    : isOk
                    ? "Appliqué"
                    : "Appliquer"}
                </button>
                <a
                  href="/"
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg border border-white/[0.08] px-3 py-2 text-[12.5px] text-zinc-300 hover:border-white/[0.2] hover:text-zinc-100"
                >
                  Aperçu prod
                </a>
              </div>

              {isError && (
                <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-[11px] text-red-200">
                  {apply.status === "error" ? apply.message : ""}
                </div>
              )}
            </article>
          );
        })}
      </div>

      <footer className="mt-12 pb-8 text-center font-mono text-[10px] uppercase tracking-wider text-zinc-600">
        Mettrik AI · Logo Lab · {WORDMARK_VARIANT_META.length} variantes
      </footer>
    </main>
  );
}
