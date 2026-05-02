"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { Search, X, ArrowRight, ArrowUpRight, ArrowDownRight } from "lucide-react";
import {
  COMPANIES,
  TICKERS,
  TICKER_ALIASES,
  getHero,
  formatUnit,
} from "@/lib/data";
import { brand } from "@/lib/brand";
import { yoyTone } from "@/lib/utils";
import { CompanyLogo, logoNeedsLightBg } from "@/components/logos";
import { AcronymHover } from "@/components/acronym-hover";
import { useT } from "@/lib/i18n/provider";

/**
 * CompanySearch — barre de recherche unifiée, utilisée :
 *   - Sur la home (var. "hero", grande, hint ⌘K)
 *   - Dans le top-nav des pages société (var. "compact", icône + placeholder court)
 *
 * Fermée : pill arrondie (rounded-full).
 * Ouverte : overlay plein écran, modal centrée qui zoom depuis la pill via
 * `layoutId` (motion). Les résultats s'affichent en cartes riches : logo,
 * nom, ticker, secteur, valeur hero KPI + variation YoY colorée.
 *
 * Raccourcis : ⌘K / Ctrl+K pour ouvrir, ESC pour fermer.
 */

type Variant = "hero" | "compact";

export function CompanySearch({
  variant = "hero",
  placeholder,
}: {
  variant?: Variant;
  placeholder?: string;
}) {
  const { t } = useT();
  const ph =
    placeholder ??
    (variant === "hero"
      ? t("search.placeholder_hero")
      : t("search.placeholder_compact"));
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // ⌘K / Ctrl+K pour ouvrir, ESC pour fermer
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Focus input à l'ouverture + lock du scroll
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.focus(), 60);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      clearTimeout(t);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const results = useMemo(() => {
    if (!query.trim()) return TICKERS;
    const q = query.toLowerCase();
    return TICKERS.filter((t) => {
      // L'alias est consultable mais résout vers le canonique : taper
      // "goog" matche GOOGL aussi. On n'affiche pas l'alias comme entrée
      // séparée pour éviter les doublons visuels.
      const aliases = Object.entries(TICKER_ALIASES)
        .filter(([, target]) => target === t)
        .map(([alias]) => alias.toLowerCase());
      return (
        t.toLowerCase().includes(q) ||
        aliases.some((a) => a.includes(q)) ||
        COMPANIES[t].name.toLowerCase().includes(q) ||
        COMPANIES[t].sector.toLowerCase().includes(q) ||
        COMPANIES[t].subsector.toLowerCase().includes(q)
      );
    });
  }, [query]);

  const close = () => {
    setOpen(false);
    setQuery("");
  };

  return (
    <>
      {/* PILL FERMÉ — bords ultra-arrondis, halo subtil violet/cyan au hover */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("search.placeholder_compact")}
        className={
          variant === "hero"
            ? "group relative inline-flex w-full max-w-2xl items-center gap-3 overflow-hidden rounded-full border border-white/10 bg-[#0a0a0e]/80 px-5 py-3.5 text-left text-zinc-400 backdrop-blur-md transition-all hover:border-white/25 hover:text-zinc-200 hover:shadow-[0_0_40px_-10px_rgba(167,139,250,0.45)]"
            : "group relative inline-flex w-full max-w-xs items-center gap-2 overflow-hidden rounded-full border border-white/10 bg-[#0a0a0e]/80 px-3.5 py-2 text-left text-zinc-400 backdrop-blur transition-all hover:border-white/25 hover:text-zinc-200"
        }
      >
        <span
          aria-hidden
          className="pointer-events-none absolute -inset-px rounded-full opacity-0 transition-opacity duration-500 group-hover:opacity-100"
          style={{
            background:
              "linear-gradient(90deg, rgba(167,139,250,0.18), rgba(34,211,238,0.18))",
            filter: "blur(14px)",
          }}
        />
        <Search
          className={
            variant === "hero"
              ? "relative size-5 text-zinc-500 transition-colors group-hover:text-violet-300"
              : "relative size-4 text-zinc-500 transition-colors group-hover:text-violet-300"
          }
        />
        <span
          className={
            variant === "hero"
              ? "relative flex-1 text-[15px]"
              : "relative flex-1 truncate text-[12.5px]"
          }
        >
          {ph}
        </span>
        <kbd
          className={
            variant === "hero"
              ? "relative inline-flex items-center gap-0.5 rounded-md border border-white/15 bg-white/5 px-1.5 py-0.5 font-mono text-[10.5px] font-semibold text-zinc-400"
              : "relative hidden items-center gap-0.5 rounded-md border border-white/15 bg-white/5 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-zinc-400 sm:inline-flex"
          }
        >
          ⌘K
        </kbd>
      </button>

      {/* OVERLAY OUVERT — full-screen, modal centrée qui zoom depuis la pill */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-[150] flex items-start justify-center px-4 pt-[6vh] sm:pt-[10vh]"
          >
            {/* Backdrop */}
            <button
              type="button"
              aria-label={t("common.close")}
              onClick={close}
              className="absolute inset-0 bg-black/75 backdrop-blur-xl"
            />

            {/* Modal */}
            <motion.div
              initial={{ scale: 0.92, y: -16, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.96, y: -8, opacity: 0 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="relative z-10 flex w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#0a0a0e]/95 shadow-[0_40px_120px_-20px_rgba(139,92,246,0.45)] backdrop-blur-xl"
            >
              {/* Halo violet/cyan en arrière-plan */}
              <div
                aria-hidden
                className="pointer-events-none absolute -top-24 right-0 h-56 w-56 rounded-full bg-violet-500/30 blur-3xl"
              />
              <div
                aria-hidden
                className="pointer-events-none absolute -bottom-24 left-0 h-56 w-56 rounded-full bg-cyan-400/20 blur-3xl"
              />

              {/* Champ de recherche */}
              <div className="relative flex items-center gap-3 border-b border-white/8 px-5 py-4">
                <Search className="size-5 text-violet-300" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={ph}
                  className="flex-1 bg-transparent text-[16px] text-zinc-100 outline-none placeholder:text-zinc-500"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    className="inline-flex size-7 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-200"
                    aria-label={t("common.close")}
                  >
                    <X className="size-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={close}
                  className="hidden items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 font-mono text-[10.5px] font-semibold uppercase tracking-wider text-zinc-400 transition-colors hover:bg-white/10 sm:inline-flex"
                  aria-label={t("common.close")}
                >
                  ESC
                </button>
              </div>

              {/* Compteur résultats */}
              <div className="relative flex items-center justify-between px-5 py-2.5 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                <span>
                  {results.length}{" "}
                  {results.length > 1
                    ? t("search.results_count_many")
                    : t("search.results_count_one")}
                  {query
                    ? ` ${t("search.results_for")}${query}${t("search.results_for_end")}`
                    : ""}
                </span>
                <span className="text-zinc-600">{t("search.enter_to_open")}</span>
              </div>

              {/* Résultats */}
              <div className="relative max-h-[60vh] overflow-y-auto px-3 pb-4 pt-1">
                {results.length === 0 ? (
                  <div className="px-5 py-12 text-center text-[13.5px] text-zinc-500">
                    {t("search.no_results")}
                    {query}
                    {t("search.results_for_end")}
                    <div className="mt-2 text-[12px] text-zinc-600">
                      {t("search.no_results_hint")}
                    </div>
                  </div>
                ) : (
                  <ul className="grid grid-cols-1 gap-2">
                    {results.map((tk) => (
                      <li key={tk}>
                        <ResultCard ticker={tk} onSelect={close} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/* ─── Carte résultat ───────────────────────────────────────────────── */
function ResultCard({
  ticker,
  onSelect,
}: {
  ticker: string;
  onSelect: () => void;
}) {
  const c = COMPANIES[ticker];
  const hero = getHero(c);
  const tone = yoyTone(hero.yoy, hero.type);
  const yoyColor =
    tone === "pos" ? "#22c55e" : tone === "neg" ? "#ef4444" : "#a1a1aa";
  const accent = brand(ticker).primary;
  const heroUnit = formatUnit(hero.unit);

  return (
    <Link
      href={`/${ticker.toLowerCase()}`}
      onClick={onSelect}
      className="group relative flex items-center gap-4 overflow-hidden rounded-2xl border border-white/8 bg-white/[0.02] p-3 transition-all hover:border-white/20 hover:bg-white/[0.05]"
    >
      {/* Accent bar à gauche, pulsée au hover */}
      <span
        aria-hidden
        className="absolute left-0 top-0 h-full w-[3px] origin-bottom scale-y-0 transition-transform duration-300 group-hover:scale-y-100"
        style={{ background: accent }}
      />

      {/* Logo */}
      <div
        className={`size-12 shrink-0 rounded-xl border p-1.5 transition-transform duration-300 group-hover:scale-105 ${
          logoNeedsLightBg(ticker)
            ? "border-[#e5e5e5] bg-[#fafafa]"
            : "border-[#1f1f1f] bg-[#0a0a0a]"
        }`}
      >
        <CompanyLogo ticker={ticker} />
      </div>

      {/* Identité */}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="truncate text-[14.5px] font-semibold text-zinc-50">
            {c.name}
          </span>
          <span
            className="font-mono text-[11px] font-bold tracking-wider"
            style={{ color: accent }}
          >
            {ticker}
          </span>
        </div>
        <div className="mt-0.5 truncate text-[11.5px] text-zinc-400">
          {c.sector} <span className="text-zinc-600">·</span> {c.subsector}
        </div>
      </div>

      {/* Hero KPI + delta */}
      <div className="hidden text-right sm:block">
        <AcronymHover
          align="right"
          label={`${hero.name_fr}${
            hero.name_en && hero.name_en !== hero.name_fr ? ` (${hero.name_en})` : ""
          }`}
        >
          <div className="cursor-help font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">
            {hero.short}
          </div>
        </AcronymHover>
        <div className="mt-0.5 font-mono text-[15px] font-semibold tabular-nums text-zinc-50">
          {hero.value}
          {heroUnit && (
            <span className="ml-1 text-[10.5px] font-normal text-zinc-400">
              {heroUnit}
            </span>
          )}
        </div>
        <div
          className="mt-0.5 inline-flex items-center justify-end gap-0.5 font-mono text-[11px] tabular-nums"
          style={{ color: yoyColor }}
        >
          {tone === "pos" && <ArrowUpRight className="size-3" />}
          {tone === "neg" && <ArrowDownRight className="size-3" />}
          {hero.yoy}
        </div>
      </div>

      {/* Chevron */}
      <ArrowRight className="size-4 shrink-0 -translate-x-1 text-zinc-600 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:text-zinc-300 group-hover:opacity-100" />
    </Link>
  );
}
