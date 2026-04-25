"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, Search, Sparkles } from "lucide-react";

import { COMPANIES, TICKERS, formatUnit, getHero } from "@/lib/data";
import { yoyTone } from "@/lib/utils";
import { brand, rate } from "@/lib/brand";
import { Spotlight } from "@/components/effects/spotlight";

export function HomeView() {
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    if (!query.trim()) return TICKERS;
    const q = query.toLowerCase();
    return TICKERS.filter(
      (t) =>
        t.toLowerCase().includes(q) ||
        COMPANIES[t].name.toLowerCase().includes(q) ||
        COMPANIES[t].sector.toLowerCase().includes(q)
    );
  }, [query]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050505]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[700px] bg-radial-glow" />
      <div className="pointer-events-none absolute inset-0 bg-grid" />
      <Spotlight className="-top-40 left-0 md:-top-20 md:left-60" />

      <div className="relative mx-auto max-w-5xl px-4 pt-14 pb-16 sm:px-6 sm:pt-24">
        {/* Brand */}
        <div className="mb-8 flex items-center justify-center gap-2.5 sm:mb-10">
          <span className="inline-flex size-8 items-center justify-center rounded-lg border border-[#2a2a2a] bg-[#0a0a0a]">
            <span className="size-2 animate-pulse-dot rounded-full bg-violet-400" />
          </span>
          <span className="font-display text-3xl tracking-tight text-zinc-50">
            Mettrik
          </span>
          <span className="font-mono text-sm text-zinc-500">·</span>
          <span className="text-sm text-zinc-400">KPI Intelligence</span>
        </div>

        {/* Headline */}
        <div className="text-center animate-fade-up">
          <div className="mb-5 inline-flex items-center gap-1.5 rounded-full border border-[#1f1f1f] bg-[#0a0a0a]/70 px-3 py-1 backdrop-blur">
            <Sparkles className="size-3 text-violet-400" />
            <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-400">
              V1 · En direct
            </span>
          </div>
          <h1 className="mx-auto max-w-3xl text-balance font-display text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl md:text-7xl">
            <span className="gradient-text">Les chiffres qui</span>
            <br />
            <span className="gradient-text-violet">racontent une histoire.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-balance text-[15px] leading-relaxed text-zinc-400 sm:mt-6 sm:text-lg">
            Le moteur d'intelligence KPI du S&amp;P 500.
            Chaque indicateur classé, interprété, instantanément comparable.
          </p>
        </div>

        {/* Search */}
        <div className="mx-auto mt-10 max-w-2xl sm:mt-12">
          <div className="group relative">
            <div
              className="absolute -inset-px rounded-2xl opacity-50 blur-xl transition-opacity duration-500 group-focus-within:opacity-100"
              style={{
                background:
                  "linear-gradient(90deg, rgba(167,139,250,0.4), rgba(6,182,212,0.4))",
              }}
            />
            <div className="relative flex items-center rounded-2xl border border-[#2a2a2a] bg-[#0a0a0a] px-4 py-3.5 sm:px-5 sm:py-4 transition-colors focus-within:border-[#3a3a3a]">
              <Search className="size-5 text-zinc-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Rechercher Google, Meta, MSCI…"
                className="ml-3 flex-1 bg-transparent text-base text-zinc-100 placeholder:text-zinc-500 focus:outline-none"
              />
              <kbd className="hidden items-center gap-1 rounded-md border border-[#2a2a2a] bg-[#111] px-1.5 py-0.5 font-mono text-[10px] text-zinc-400 sm:inline-flex">
                ↵
              </kbd>
            </div>
          </div>
        </div>

        {/* Suggestions */}
        <div className="mx-auto mt-8 max-w-3xl sm:mt-10">
          <div className="mb-4 text-center font-mono text-[11px] uppercase tracking-[0.15em] text-zinc-500">
            {query ? "Résultats" : "Sociétés disponibles"}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((ticker) => {
              const c = COMPANIES[ticker];
              const hero = getHero(c);
              const tone = yoyTone(hero.yoy, hero.type);
              const yoyColor =
                tone === "pos" ? "#10b981" : tone === "neg" ? "#f43f5e" : "#a1a1aa";
              const accent = brand(ticker).primary;
              const r = rate(hero);
              return (
                <div key={ticker}>
                  <Link
                    href={`/${ticker.toLowerCase()}`}
                    className="conic-border group relative block overflow-hidden rounded-xl border border-[#1f1f1f] bg-[#0a0a0a] p-4 transition-colors hover:border-[#2a2a2a]"
                  >
                    <div
                      className="pointer-events-none absolute -right-10 -top-10 size-32 rounded-full blur-3xl opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                      style={{ background: `${accent}55` }}
                    />
                    <div className="relative flex items-start justify-between">
                      <div>
                        <div className="font-mono text-xs" style={{ color: accent }}>
                          {ticker}
                        </div>
                        <div className="mt-1 text-[15px] font-medium text-zinc-100">
                          {c.name}
                        </div>
                      </div>
                      <ArrowRight className="size-4 -translate-x-1 text-zinc-500 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:text-zinc-300 group-hover:opacity-100" />
                    </div>
                    <div className="mt-3 flex items-baseline gap-1.5">
                      <span className="font-mono text-2xl font-semibold tabular-nums text-zinc-100">
                        {hero.value}
                      </span>
                      {formatUnit(hero.unit) && (
                        <span className="text-xs text-zinc-400">{formatUnit(hero.unit)}</span>
                      )}
                      <span
                        className="ml-auto font-mono text-xs tabular-nums"
                        style={{ color: yoyColor }}
                      >
                        {hero.yoy}
                      </span>
                    </div>
                    <div className="mt-1.5 truncate text-[12px] text-zinc-400">
                      {hero.short} · {hero.name_fr}
                    </div>
                    <div className="mt-3 flex items-center gap-1.5">
                      <span
                        className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium"
                        style={{ background: `${r.color}18`, color: r.color }}
                      >
                        <span className="size-1.5 rounded-full" style={{ background: r.color }} />
                        {r.label}
                      </span>
                      <span className="font-mono text-[10px] text-zinc-400">
                        {r.percentile}
                      </span>
                    </div>
                  </Link>
                </div>
              );
            })}
          </div>
        </div>

        <footer className="mt-20 pb-8 text-center font-mono text-[11px] uppercase tracking-wider text-zinc-500 sm:mt-24">
          Mettrik · KPI Intelligence — V1
        </footer>
      </div>
    </div>
  );
}
