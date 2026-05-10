"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Sparkles } from "lucide-react";

import { COMPANIES, TICKERS, formatUnit, getHero } from "@/lib/data";
import { yoyTone } from "@/lib/utils";
import { brand, rate } from "@/lib/brand";
import { Spotlight } from "@/components/effects/spotlight";
import { FreshnessIndicator } from "@/components/freshness-indicator";
import { BackToTop } from "@/components/back-to-top";
import { StarButton } from "@/components/star-button";
import { CompanySearch } from "@/components/company-search";
import { HomeFAQ } from "@/components/home-faq";
import { SignupGateOverlay } from "@/components/signup-gate-overlay";
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
/**
 * Pill "Données à jour au X" avec date calculée selon timezone du visiteur.
 * Côté SSR : on rend l'écran sans date (juste "Données à jour") pour éviter
 * tout mismatch (le serveur utilise UTC, le visiteur peut être à Tokyo où
 * le jour calendaire est différent). Côté client : useEffect calcule la
 * date locale du visiteur et la rend.
 */
function DataFreshnessPill({ locale, freshnessKey }: { locale: string; freshnessKey: string }) {
  const [dateLocal, setDateLocal] = useState<string | null>(null);
  useEffect(() => {
    // Date "today" dans le timezone du navigateur du visiteur.
    // Yann 9 mai 2026 : sur les week-ends, on affiche la date du vendredi
    // précédent (samedi → vendredi -1 jour, dimanche → vendredi -2 jours).
    // Les marchés US/EU sont fermés samedi-dimanche, données pas rafraîchies.
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const fmt = new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : locale === "de" || locale === "de-CH" ? "de-DE" : locale === "nl" ? "nl-NL" : locale === "sv" ? "sv-SE" : locale === "da" ? "da-DK" : locale === "en-GB" ? "en-GB" : "en-US", {
      day: "numeric", month: "long", year: "numeric", timeZone: tz,
    });
    const now = new Date();
    const dow = now.getDay(); // 0 = dimanche, 6 = samedi
    let daysBack = 0;
    if (dow === 6) daysBack = 1; // samedi → vendredi
    if (dow === 0) daysBack = 2; // dimanche → vendredi
    const refDate = new Date(now.getTime() - daysBack * 86400_000);
    setDateLocal(fmt.format(refDate));
  }, [locale]);
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full border border-[#1f1f1f] bg-[#0a0a0a]/70 px-3 py-1.5 backdrop-blur">
      <Sparkles className="size-3 shrink-0 text-violet-400" aria-hidden />
      <span className="font-mono text-[10px] uppercase leading-none tracking-[0.18em] text-zinc-400">
        {freshnessKey}{" "}
        <em className="not-italic font-mono italic text-zinc-200">
          {dateLocal ?? "…"}
        </em>
      </span>
    </div>
  );
}

function BrandWordmark({ kpiUnderText }: { kpiUnderText?: string }) {
  const letters = "Mettrik AI".split("");
  return (
    <div className="mb-6 flex flex-col items-center sm:mb-8">
      <div
        className="relative inline-flex items-baseline leading-none"
        style={{
          fontFamily: "var(--font-instrument), 'Bricolage Grotesque', sans-serif",
          fontWeight: 800,
          fontStyle: "italic",
          fontSize: "clamp(56px, 9vw, 110px)",
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

      {/* Ligne sous-KPI INTELLIGENCE (catchphrase produit, FR uniquement) */}
      {kpiUnderText && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.25, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="mt-2 max-w-xl text-balance text-center text-[12px] italic text-zinc-400 sm:text-[13.5px]"
        >
          {kpiUnderText}
        </motion.div>
      )}
    </div>
  );
}

/**
 * Rendu d'une punchline avec :
 *   - Segments *italique* via Markdown-like (entre * *)
 *   - Emojis agrandis à 1.5em (50 % plus gros que le texte), centrés
 *     verticalement (overflow ~25 % au-dessus / en-dessous via `lineHeight: 1`
 *     + `verticalAlign: middle`).
 */
function renderPunchline(text: string): React.ReactNode {
  // 1. Split par italique *...*
  const italicSplit = text.split(/(\*[^*]+\*)/g);
  return italicSplit.map((seg, i) => {
    if (seg.startsWith("*") && seg.endsWith("*") && seg.length > 2) {
      return (
        <em key={i} className="not-italic font-semibold italic text-zinc-200">
          {wrapEmojis(seg.slice(1, -1))}
        </em>
      );
    }
    return <span key={i}>{wrapEmojis(seg)}</span>;
  });
}

/** Wrap chaque emoji dans un span agrandi à 1.5em, centré vertical. */
function wrapEmojis(text: string): React.ReactNode {
  // Match séquences emoji (avec modificateurs de teint + ZWJ).
  const re =
    /(\p{Extended_Pictographic}(?:\p{Emoji_Modifier}|‍\p{Extended_Pictographic})*)/gu;
  const parts: React.ReactNode[] = [];
  let lastIdx = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > lastIdx) parts.push(<span key={key++}>{text.slice(lastIdx, m.index)}</span>);
    parts.push(
      <span
        key={key++}
        style={{
          fontSize: "1.5em",
          lineHeight: 1,
          verticalAlign: "middle",
          display: "inline-block",
        }}
      >
        {m[0]}
      </span>
    );
    lastIdx = m.index + m[0].length;
  }
  if (lastIdx < text.length) parts.push(<span key={key++}>{text.slice(lastIdx)}</span>);
  return parts;
}

/** Estime le nombre de lignes en mesurant la hauteur rendue vs line-height. */
function useLineCount(ref: React.RefObject<HTMLElement | null>, deps: unknown[]): 1 | 2 {
  const [lines, setLines] = useState<1 | 2>(2);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const computed = window.getComputedStyle(el);
    const lh = parseFloat(computed.lineHeight) || parseFloat(computed.fontSize) * 1.4;
    const h = el.getBoundingClientRect().height;
    setLines(h > lh * 1.4 ? 2 : 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return lines;
}

/**
 * RotatingPunchline (refacto Yann 10 mai 2026, specs Opus) :
 *
 * - Format strict : chaque punchline = "part1 | part2".
 * - part1 (question / locuteur 1) : zinc-400 italique
 * - part2 (réponse / locuteur 2) : gradient violet→cyan en gras pour
 *   se démarquer + flèche cyan ↳ devant pour saut de ligne logique
 * - Si la punchline ne contient pas " | " on la rend en bloc unique
 *   (rétro-compatibilité)
 * - Animation : opacity + y + blur avec easing expo-out doux
 *   (out 600 ms, in 800 ms, durée affichage 6,5 s)
 * - Part2 entre 120 ms après part1 (effet stagger premium)
 */
function RotatingPunchline({ items }: { items: string[] }) {
  const [idx, setIdx] = useState(() => Math.floor(Math.random() * items.length));

  useEffect(() => {
    if (items.length <= 1) return;
    const t = setTimeout(() => {
      setIdx((prev) => {
        let next = Math.floor(Math.random() * items.length);
        let safety = 0;
        while (next === prev && safety++ < 8) next = Math.floor(Math.random() * items.length);
        return next;
      });
    }, 6500);
    return () => clearTimeout(t);
  }, [idx, items.length]);

  const raw = items[idx] ?? "";
  const sepIdx = raw.indexOf(" | ");
  const part1 = sepIdx > 0 ? raw.slice(0, sepIdx).trim() : raw.trim();
  const part2 = sepIdx > 0 ? raw.slice(sepIdx + 3).trim() : "";

  const ease = [0.22, 1, 0.36, 1] as [number, number, number, number];

  return (
    <div className="relative mx-auto mt-5 min-h-[120px] max-w-3xl sm:mt-6 sm:min-h-[136px]">
      <AnimatePresence mode="wait">
        <motion.div
          key={idx}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease }}
          className="absolute inset-x-0 text-center"
        >
          {/* part1 — question / locuteur 1, retrait visuel */}
          <motion.p
            initial={{ opacity: 0, y: 12, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -12, filter: "blur(4px)" }}
            transition={{ duration: 0.6, ease }}
            className="text-balance font-display text-[18px] italic leading-[1.45] text-zinc-300/80 sm:text-[22px]"
          >
            {renderPunchline(part1)}
          </motion.p>

          {part2 && (
            <motion.p
              initial={{ opacity: 0, y: 12, filter: "blur(4px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -12, filter: "blur(4px)" }}
              transition={{ duration: 0.7, ease, delay: 0.12 }}
              className="mt-2 text-balance font-display text-[20px] font-semibold italic leading-[1.4] sm:mt-2.5 sm:text-[24px]"
            >
              <span className="mr-2 inline-block align-middle text-cyan-300/80" aria-hidden>
                ↳
              </span>
              <span
                className="bg-gradient-to-r from-violet-200 via-violet-100 to-cyan-200 bg-clip-text text-transparent"
                style={{ WebkitBackgroundClip: "text", backgroundClip: "text" }}
              >
                {renderPunchline(part2)}
              </span>
            </motion.p>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/**
 * HomeView accepte optionnellement une liste de sociétés custom + un builder
 * de href. Sert pour /sandbox/v1-X qui veulent la MÊME structure que la home
 * (wordmark + search + grille de cards) mais avec un dataset différent et
 * une route de navigation différente.
 *
 * Sans prop : comportement V1 historique (5 stés handcrafted, route /<ticker>).
 * Avec props :
 *   - companies : Record<ticker, Company>
 *   - tickers : string[] dans l'ordre d'affichage
 *   - hrefBuilder : (ticker) => string (ex: t => `/sandbox/v1-7/${t.toLowerCase()}`)
 *   - title (optionnel) : override le wordmark "Mettrik AI" (ex: "V1.7 · 421 stés")
 *   - subtitle (optionnel) : override la headline secondaire
 */
export function HomeView({
  companies: companiesProp,
  tickers: tickersProp,
  routePrefix,
  showFAQ = true,
  searchScope,
  topNavLinks,
  requireSignupGate = false,
  gatePath = "/",
}: {
  companies?: Record<string, import("@/lib/data").Company>;
  tickers?: string[];
  routePrefix?: string;
  showFAQ?: boolean;
  searchScope?: { tickers: string[]; total: number };
  /** Yann 10 mai 2026 : liens au-dessus du logo (ex Pricing / Contact). */
  topNavLinks?: { label: string; href: string }[];
  /** Si true, tout clic sur la search bar ou une card sté ouvre AuthModal (anonyme). */
  requireSignupGate?: boolean;
  /** Page qui monte <AuthModal /> (utilisée pour le redirect signup). */
  gatePath?: string;
} = {}) {
  const { t, locale } = useT();
  const COMPANIES_USED = companiesProp ?? COMPANIES;
  const results = tickersProp ?? TICKERS;
  const buildHref = (tk: string): string =>
    routePrefix ? `${routePrefix}/${tk.toLowerCase()}` : `/${tk.toLowerCase()}`;
  // Note : la date "Données à jour au X" est désormais rendue côté client
  // via <DataFreshnessPill /> pour utiliser le timezone du visiteur.

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050505]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[700px] bg-radial-glow" />
      <div className="pointer-events-none absolute inset-0 bg-grid" />
      <Spotlight className="-top-40 left-0 md:-top-20 md:left-60" />

      <div className="relative mx-auto max-w-5xl px-4 pt-6 pb-16 sm:px-6 sm:pt-8">
        {/* Yann 10 mai 2026 : liens top-nav (Pricing / Contact) AU-DESSUS
            du logo. Style 3D léger inspiré des boutons Connexion/S'inscrire :
            ombre décalée 2px + bordure blanche subtile + translation -1px
            au hover (effet "le bouton se rapproche de toi"). */}
        {topNavLinks && topNavLinks.length > 0 && (
          <nav className="mb-5 flex justify-center gap-3 text-[12.5px]">
            {topNavLinks.map((l) => (
              <a key={l.href} href={l.href} className="group relative inline-block">
                <span
                  aria-hidden
                  className="absolute inset-0 translate-x-[2px] translate-y-[2px] rounded-md border border-white/25 transition-transform duration-200 ease-out group-hover:translate-x-[3px] group-hover:translate-y-[3px]"
                />
                <span className="relative z-10 inline-flex items-center gap-1.5 rounded-md border border-white/40 bg-[#0a0a0e]/85 px-3.5 py-1.5 font-semibold tracking-[0.02em] text-zinc-100 transition-transform duration-200 ease-out group-hover:-translate-x-[1px] group-hover:-translate-y-[1px]">
                  {l.label}
                </span>
              </a>
            ))}
          </nav>
        )}

        <BrandWordmark
          kpiUnderText={locale === "fr" ? t("brand.kpi_intelligence_under") : undefined}
        />

        {/* Headline réduite + nouvelle punchline */}
        <div className="text-center animate-fade-up">
          <h1 className="mx-auto max-w-3xl text-balance font-display text-2xl font-semibold leading-[1.1] tracking-tight sm:text-4xl md:text-5xl">
            <span className="gradient-text">{t("brand.tagline_main_1")}</span>{" "}
            <span className="gradient-text-violet">{t("brand.tagline_main_2")}</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-balance text-[13.5px] leading-relaxed text-zinc-400 sm:text-[15px]">
            {t("brand.tagline_sub")}
          </p>
          {locale === "fr" && (
            <RotatingPunchline
              items={[
                t("home.punchline.1"),
                t("home.punchline.2"),
                t("home.punchline.3"),
                t("home.punchline.4"),
              ]}
            />
          )}
        </div>

        {/* Pill "Données à jour" : Yann 10 mai 2026 déplacée ici, entre
            le bloc texte au-dessus et la barre de recherche. */}
        <div className="mt-6 flex justify-center sm:mt-8">
          <DataFreshnessPill locale={locale} freshnessKey={t("brand.data_updated")} />
        </div>

        {/* Search — pill arrondie qui zoome en modal centrée au clic.
            Si requireSignupGate=true et user anonyme : tout clic redirige
            vers signup (intercepté par SignupGateOverlay). */}
        <div className="mx-auto mt-4 flex max-w-2xl justify-center sm:mt-5">
          <SignupGateOverlay enabled={requireSignupGate} gatePath={gatePath}>
            <CompanySearch
              variant="hero"
              searchableTickers={searchScope?.tickers}
              totalLabel={searchScope?.total}
            />
          </SignupGateOverlay>
        </div>

        {/* Suggestions */}
        <div className="mx-auto mt-8 max-w-3xl sm:mt-10">
          <div className="mb-4 text-center font-mono text-[11px] uppercase tracking-[0.15em] text-zinc-500">
            {t("brand.companies_available")}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((ticker) => {
              const c = COMPANIES_USED[ticker];
              if (!c) return null;
              try {
                // Idem : wrap chaque card société dans le gate signup.
                const card = renderCompanyCard(c, ticker, buildHref, locale, t);
                if (!card) return null;
                return (
                  <SignupGateOverlay key={ticker} enabled={requireSignupGate} gatePath={gatePath}>
                    {card}
                  </SignupGateOverlay>
                );
              } catch {
                return null;
              }
            })}
          </div>
        </div>

        {showFAQ && <HomeFAQ />}

        <footer className="mt-20 pb-8 text-center font-mono text-[11px] uppercase tracking-wider text-zinc-500 sm:mt-24">
          Mettrik AI · {t("brand.subtitle")}
        </footer>
      </div>
      <BackToTop />
    </div>
  );
}

/** Card sté de la home : extraite pour pouvoir try/catch autour. */
function renderCompanyCard(
  c: import("@/lib/data").Company,
  ticker: string,
  buildHref: (t: string) => string,
  locale: string,
  t: (k: string) => string
): React.ReactNode {
  if (!c.kpis || !Array.isArray(c.kpis) || c.kpis.length === 0) return null;
  const hero = getHero(c);
  // Coerce string fields (Yann 9 mai 2026 : NVDA/GOOGL/AAPL/MSFT avaient
  // hero.value en number après extraction LLM, le check strict 'typeof
  // === "string"' les filtrait silencieusement → 12/305 stés visibles
  // dans /sandbox/v1-8 au lieu de 305).
  if (!hero) return null;
  for (const f of ["value", "yoy", "type", "unit", "short"] as const) {
    const v = (hero as Record<string, unknown>)[f];
    if (v === null || v === undefined) return null;
    if (typeof v !== "string") {
      (hero as Record<string, unknown>)[f] = String(v);
    }
  }
  const tone = yoyTone(hero.yoy, hero.type);
  const yoyColor =
    tone === "pos" ? "#10b981" : tone === "neg" ? "#f43f5e" : "#a1a1aa";
  const accent = brand(ticker).primary;
  let r;
  try {
    r = rate(hero);
  } catch {
    r = { tier: "moyen" as const, label: "Moyen", percentile: "", color: "#a1a1aa" };
  }
              return (
                <div key={ticker}>
                  <Link
                    href={buildHref(ticker)}
                    className="conic-border group relative flex h-[200px] flex-col rounded-xl border border-[#1f1f1f] bg-[#0a0a0a] p-4 transition-colors hover:border-[#2a2a2a]"
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
                        <div className="mt-1 line-clamp-2 text-[15px] font-medium leading-snug text-zinc-100">
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
                      {/* Affichage localisé : en FR le nom français, en EN le nom anglais.
                          On supprime le préfixe technique `short` (= identifiant interne
                          souvent en EN) demandé par Yann le 4 mai 2026 : le user veut
                          voir un libellé naturel dans sa langue, pas un acronyme tech. */}
                      {locale === "fr"
                        ? (hero.name_fr || hero.name_en || hero.short)
                        : (hero.name_en || hero.name_fr || hero.short)}
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
}
