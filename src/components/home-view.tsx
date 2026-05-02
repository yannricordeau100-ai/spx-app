"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight, Sparkles } from "lucide-react";

import { COMPANIES, TICKERS, formatUnit, getHero } from "@/lib/data";
import { yoyTone } from "@/lib/utils";
import { brand, rate } from "@/lib/brand";
import { Spotlight } from "@/components/effects/spotlight";
import { FreshnessIndicator } from "@/components/freshness-indicator";
import { BackToTop } from "@/components/back-to-top";
import { StarButton } from "@/components/star-button";
import { CompanySearch } from "@/components/company-search";
import { useT } from "@/lib/i18n/provider";

/**
 * BrandWordmark — wordmark "Mettrik" XL en Fraunces 800 italic, gradient
 * holographique violet/cyan/rose, entrée lettre-par-lettre staggered,
 * pulse-dot intégré comme point du « i », rail iridescent qui se trace
 * sous le mot pour relier vers le sous-titre KPI INTELLIGENCE.
 *
 * Original sans être tape-à-l'œil : 1 typeface différente (serif italic
 * vs sans-serif partout ailleurs), gradient mesh, animation in 1 fois.
 */
function BrandWordmark() {
  const letters = "Mettrik AI".split("");
  return (
    <div className="mb-10 flex flex-col items-center sm:mb-14">
      <div
        className="relative inline-flex items-baseline leading-none"
        style={{
          fontFamily: "var(--font-fraunces), Georgia, serif",
          fontWeight: 800,
          fontStyle: "italic",
          fontSize: "clamp(72px, 13vw, 156px)",
          letterSpacing: "-0.04em",
        }}
      >
        {letters.map((ch, i) => {
          const isI = ch === "i";
          return (
            <motion.span
              key={i}
              initial={{ opacity: 0, y: "30%", filter: "blur(8px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{
                duration: 0.7,
                delay: 0.06 * i,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="relative inline-block"
              style={{
                background:
                  "linear-gradient(135deg, #ffffff 0%, #d8d8e4 30%, #a855f7 55%, #22d3ee 78%, #f472b6 100%)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                WebkitTextFillColor: "transparent",
                color: "transparent",
              }}
            >
              {isI ? (
                <>
                  <span aria-hidden style={{ visibility: "hidden" }}>i</span>
                  {/* Le « i » est repeint sans le point (visibility hidden)
                      et on le rejoue ici en retirant le point natif via
                      stylisation. Faisable proprement uniquement avec un
                      trait personnalisé : on dessine le i au-dessus. */}
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0 flex items-end justify-center"
                  >
                    <span
                      style={{
                        display: "inline-block",
                        width: "0.12em",
                        height: "0.62em",
                        background:
                          "linear-gradient(180deg, #a855f7 0%, #22d3ee 100%)",
                        borderRadius: "0.06em",
                        transform: "translateY(-0.04em)",
                      }}
                    />
                  </span>
                  {/* Le point du i = pulse violet (signature Mettrik) */}
                  <motion.span
                    aria-hidden
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{
                      delay: 0.06 * i + 0.45,
                      duration: 0.4,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                    className="absolute"
                    style={{
                      left: "50%",
                      top: "0.05em",
                      width: "0.18em",
                      height: "0.18em",
                      borderRadius: "50%",
                      background: "#a855f7",
                      transform: "translateX(-50%)",
                      boxShadow:
                        "0 0 12px #a855f7, 0 0 24px #a855f7aa, 0 0 36px #a855f755",
                    }}
                  >
                    <motion.span
                      animate={{ opacity: [1, 0.55, 1], scale: [1, 1.3, 1] }}
                      transition={{
                        duration: 2.6,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                      className="absolute inset-0 rounded-full"
                      style={{ background: "#a855f7" }}
                    />
                  </motion.span>
                </>
              ) : (
                ch
              )}
            </motion.span>
          );
        })}
      </div>

      {/* Rail iridescent qui se trace de gauche à droite */}
      <motion.div
        initial={{ scaleX: 0, opacity: 0 }}
        animate={{ scaleX: 1, opacity: 1 }}
        transition={{ delay: 0.55, duration: 1, ease: [0.22, 1, 0.36, 1] }}
        className="mt-4 h-[2px] w-[min(82%,520px)] origin-left rounded-full"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, #a855f7 25%, #22d3ee 55%, #f472b6 85%, transparent 100%)",
          boxShadow:
            "0 0 12px rgba(168,85,247,0.4), 0 0 24px rgba(34,211,238,0.25)",
        }}
      />

      {/* Sous-titre KPI INTELLIGENCE en mono uppercase, tracking very wide,
          fade-in après le tracé du rail */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.05, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="mt-3 font-mono text-[11px] font-semibold uppercase text-zinc-300 sm:text-[13px]"
        style={{ letterSpacing: "0.42em" }}
      >
        KPI Intelligence
      </motion.div>
    </div>
  );
}

export function HomeView() {
  const { t, locale } = useT();
  // La recherche est désormais entièrement gérée par <CompanySearch />
  // (pill arrondie qui zoome en modal centrée). On garde la grille de
  // sociétés en dessous pour le browse direct.
  const results = TICKERS;
  // Format de date locale-aware : 27 avril 2026 (FR) / April 27, 2026 (EN)
  const dateFmt = new Date().toLocaleDateString(
    locale === "fr" ? "fr-FR" : "en-US",
    { day: "numeric", month: "long", year: "numeric" }
  );

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050505]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[700px] bg-radial-glow" />
      <div className="pointer-events-none absolute inset-0 bg-grid" />
      <Spotlight className="-top-40 left-0 md:-top-20 md:left-60" />

      <div className="relative mx-auto max-w-5xl px-4 pt-14 pb-16 sm:px-6 sm:pt-24">
        {/* Brand — wordmark Mettrik massif avec entrée lettre-par-lettre,
            gradient holographique, pulse-dot intégré sur le i, et rail
            iridescent qui se trace pour relier au sous-titre.
            Police Fraunces 800 italic (serif éditorial premium) en
            contraste sur le reste de l'app qui est sans-serif. */}
        <BrandWordmark />

        {/* Headline */}
        <div className="text-center animate-fade-up">
          <div className="mb-5 inline-flex items-center gap-1.5 rounded-full border border-[#1f1f1f] bg-[#0a0a0a]/70 px-3 py-1 backdrop-blur">
            <Sparkles className="size-3 text-violet-400" />
            <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-400">
              {t("brand.data_updated")}{" "}
              <em className="not-italic font-mono italic text-zinc-200">
                {dateFmt}
              </em>
            </span>
          </div>
          <h1 className="mx-auto max-w-3xl text-balance font-display text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl md:text-7xl">
            <span className="gradient-text">{t("brand.tagline_main_1")}</span>
            <br />
            <span className="gradient-text-violet">{t("brand.tagline_main_2")}</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-balance text-[15px] leading-relaxed text-zinc-400 sm:mt-6 sm:text-lg">
            {t("brand.tagline_sub")}
          </p>
        </div>

        {/* Search — pill arrondie qui zoome en modal centrée au clic */}
        <div className="mx-auto mt-10 flex max-w-2xl justify-center sm:mt-12">
          <CompanySearch variant="hero" />
        </div>

        {/* Suggestions */}
        <div className="mx-auto mt-8 max-w-3xl sm:mt-10">
          <div className="mb-4 text-center font-mono text-[11px] uppercase tracking-[0.15em] text-zinc-500">
            {t("brand.companies_available")}
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
                    className="conic-border group relative block rounded-xl border border-[#1f1f1f] bg-[#0a0a0a] p-4 transition-colors hover:border-[#2a2a2a]"
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
                      <div className="flex items-center gap-1">
                        <StarButton mode="company" ticker={ticker} size="sm" stopPropagation />
                        <ArrowRight className="size-4 -translate-x-1 text-zinc-500 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:text-zinc-300 group-hover:opacity-100" />
                      </div>
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
                      {hero.short} · {locale === "en" && hero.name_en ? hero.name_en : hero.name_fr}
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-1.5">
                      <span
                        className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium"
                        style={{ background: `${r.color}18`, color: r.color }}
                      >
                        <span className="size-1.5 rounded-full" style={{ background: r.color }} />
                        {t(`tier.${r.tier}`)}
                      </span>
                      <span className="font-mono text-[10px] text-zinc-400">
                        {r.percentile}
                      </span>
                      <span className="ml-auto">
                        <FreshnessIndicator
                          lastDate={hero.last_data_date ?? "2025-12-31"}
                          nextEarningsDate={c.next_earnings_date}
                          alwaysShow
                          size="sm"
                          tooltipAlign="right"
                        />
                      </span>
                    </div>
                  </Link>
                </div>
              );
            })}
          </div>
        </div>

        <footer className="mt-20 pb-8 text-center font-mono text-[11px] uppercase tracking-wider text-zinc-500 sm:mt-24">
          Mettrik AI · {t("brand.subtitle")}
        </footer>
      </div>
      <BackToTop />
    </div>
  );
}
