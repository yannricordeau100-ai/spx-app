"use client";

import Link from "next/link";
import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Sparkles } from "lucide-react";

import { COMPANIES, TICKERS, getHero } from "@/lib/data";
import { displayTicker, buildTickerSet } from "@/lib/ticker-display";
import { prepareHeroDisplay } from "@/lib/format-hero";
import { yoyTone } from "@/lib/utils";
import { brand, rate } from "@/lib/brand";
import { Spotlight } from "@/components/effects/spotlight";
import { FreshnessIndicator } from "@/components/freshness-indicator";
import { getFreshnessReference } from "@/lib/freshness/compute-tier";
import { BackToTop } from "@/components/back-to-top";
import { StarButton } from "@/components/star-button";
import { CompanySearch } from "@/components/company-search";
import { HomeFAQ } from "@/components/home-faq";
import { HomePopularBlock } from "@/components/home-popular-block";
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
    const fmt = new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : locale === "de" || locale === "de-CH" ? "de-DE" : locale === "nl" ? "nl-NL" : locale === "en-GB" ? "en-GB" : "en-US", {
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
  // Yann 4 juin 2026 v3 : PNG transparent canonique (RGBA alpha=0 sur bords)
  // commun à toute l'app (BrandWordmark, MettrikWordmark, maintenance,
  // pricing, company-view). Animation d'entrée fade+blur préservée.
  return (
    <div className="mb-6 flex flex-col items-center sm:mb-8">
      <motion.div
        initial={{ opacity: 0, y: "12%", filter: "blur(8px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        className="inline-flex items-center justify-center"
      >
        <span
          className="wordmark-png-v2 relative inline-block"
          style={{
            height: "clamp(96px, 16vw, 220px)",
            lineHeight: 1,
            paddingBottom: "6px",
          }}
        >
          <img
            src="/brand/mettrik-ai-white-purple.png"
            alt="Mettrik AI"
            className="wordmark-png-dark block h-full w-auto select-none"
            draggable={false}
          />
          <img
            src="/brand/mettrik-ai-black-purple.png"
            alt=""
            aria-hidden
            className="wordmark-png-light absolute inset-0 hidden h-full w-auto select-none"
            draggable={false}
          />
          <style>{`
            html[data-theme="light"] .wordmark-png-dark { display: none; }
            html[data-theme="light"] .wordmark-png-light { display: block !important; position: static !important; }
          `}</style>
        </span>
      </motion.div>

      {/* Rail iridescent qui se trace de gauche à droite.
          Yann 8 juin 2026 : logo agrandi (clamp 96/16vw/220px) pour
          descendre jusqu'au rail séparateur. mt-1 = ~4px gap entre
          bas du logo et le rail (paddingBottom 6px du wrapper logo
          gère les descendants italiques Fraunces). */}
      <motion.div
        initial={{ scaleX: 0, opacity: 0 }}
        animate={{ scaleX: 1, opacity: 1 }}
        transition={{ delay: 0.55, duration: 1, ease: [0.22, 1, 0.36, 1] }}
        className="mt-1 h-[2px] w-[min(82%,520px)] origin-left rounded-full"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, #a855f7 25%, #22d3ee 55%, #f472b6 85%, transparent 100%)",
          boxShadow:
            "0 0 12px rgba(168,85,247,0.4), 0 0 24px rgba(34,211,238,0.25)",
        }}
      />

      {/* Yann (26 mai 2026) : nouvelle bio = "Surperformer le marché avec les
          meilleurs KPIs de chaque action". Affichée sous le wordmark + utilisée
          comme metadata SEO (layout.tsx description + OG + Twitter card).
          Visible visuellement sur la home ET dans les link previews. */}
      {kpiUnderText && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.05, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="mt-3 max-w-2xl text-balance text-center text-[12.5px] leading-relaxed text-zinc-400 sm:text-[14px]"
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
  // Yann 13 mai 2026 : le PREMIER segment italique = nom de l'interlocuteur,
  // souligné. Les italiques suivants (ex "Mettrik AI") restent juste italique
  // sans soulignement.
  let firstItalicSeen = false;
  return italicSplit.map((seg, i) => {
    if (seg.startsWith("*") && seg.endsWith("*") && seg.length > 2) {
      const isInterlocutorName = !firstItalicSeen;
      firstItalicSeen = true;
      return (
        <em
          key={i}
          className={
            isInterlocutorName
              ? "not-italic font-semibold italic text-zinc-200 underline decoration-violet-400/70 decoration-[1.5px] underline-offset-[5px]"
              : "not-italic font-semibold italic text-zinc-200"
          }
        >
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
/**
 * MettrikCitationCard (refonte Yann 26 mai 2026) :
 * - Plus de rotation. Une seule citation académique mise en avant.
 * - Source : Fang, Mohanram & Vyas (2020), Singapore Management University.
 * - Esprit : preuve scientifique → légitimise l'usage des KPI pour battre
 *   le marché. Style "papier de recherche encadré" + halo violet/cyan.
 */
// Yann 26 mai 2026 : citation Fang/Mohanram/Vyas 2020 traduite dans toutes
// les locales actives. FR + EN + DE fournis par Yann, autres traduits.
const CITATION_BY_LOCALE: Record<string, { quote: string; openQuote: string; closeQuote: string }> = {
  fr: {
    quote: "Les KPI sont positivement associés à la rentabilité future, à la croissance des ventes et aux performances boursières.",
    openQuote: "“",
    closeQuote: "”",
  },
  en: {
    quote: "KPIs are positively associated with future profitability, sales growth, and current stock returns.",
    openQuote: "“",
    closeQuote: "”",
  },
  "en-GB": {
    quote: "KPIs are positively associated with future profitability, sales growth, and current stock returns.",
    openQuote: "“",
    closeQuote: "”",
  },
  de: {
    quote: "KPIs stehen in einem positiven Zusammenhang mit zukünftiger Profitabilität, Umsatzwachstum und Aktienrenditen.",
    openQuote: "„",
    closeQuote: "“",
  },
  "de-CH": {
    quote: "KPIs stehen in einem positiven Zusammenhang mit zukünftiger Profitabilität, Umsatzwachstum und Aktienrenditen.",
    openQuote: "„",
    closeQuote: "“",
  },
  nl: {
    quote: "KPI's zijn positief geassocieerd met toekomstige winstgevendheid, omzetgroei en beursrendementen.",
    openQuote: "„",
    closeQuote: "”",
  },
  sv: {
    quote: "Nyckeltal är positivt förknippade med framtida lönsamhet, försäljningstillväxt och aktieavkastning.",
    openQuote: "”",
    closeQuote: "”",
  },
  da: {
    quote: "Nøgletal er positivt forbundet med fremtidig rentabilitet, omsætningsvækst og aktieafkast.",
    openQuote: "„",
    closeQuote: "”",
  },
};

function MettrikCitationCard({ locale = "fr" }: { locale?: string }) {
  const ease = [0.22, 1, 0.36, 1] as [number, number, number, number];
  const citation = CITATION_BY_LOCALE[locale] ?? CITATION_BY_LOCALE.en!;

  // Yann 12 mai 2026 v2 : effet 3D nettement plus marqué.
  // - perspective wrapper + léger tilt rotateX (cadre flotte au-dessus du fond)
  // - 3 couches d'ombre décalée (effet bloc épais, profondeur réelle)
  // - halo violet/cyan derrière (lumière émise par le cadre)
  // - bord supérieur en highlight clair (catch light, simule éclairage du haut)
  // - bord inférieur en ombre foncée (sol sous le bloc)
  // - hover : le bloc se redresse et la lumière s'intensifie
  return (
    <div className="mx-auto mt-14 flex max-w-3xl justify-center sm:mt-20" style={{ perspective: "1200px" }}>
      <motion.div
        className="group relative inline-block w-full"
        initial={{ rotateX: 0, y: 0 }}
        animate={{ rotateX: 6, y: 0 }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        whileHover={{ rotateX: 2, y: -3 }}
        style={{ transformStyle: "preserve-3d", transformOrigin: "center bottom" }}
      >
        {/* Halo violet/cyan derrière (lumière émise) */}
        <span
          aria-hidden
          className="pointer-events-none absolute -inset-6 rounded-2xl opacity-60 blur-2xl transition-opacity duration-500 group-hover:opacity-90"
          style={{
            background:
              "radial-gradient(60% 70% at 50% 50%, rgba(139, 92, 246, 0.35) 0%, rgba(34, 211, 238, 0.18) 45%, transparent 75%)",
          }}
        />
        {/* Ombres 3D décalées en stack (effet bloc épais).
            Yann 13 mai 2026 : contour de chaque rectangle décalé renforcé
            (style boutons Pricing/Contact) pour bien marquer la profondeur
            sur les zones de superposition visibles à droite et en bas. */}
        <span aria-hidden className="absolute inset-0 translate-x-[3px] translate-y-[3px] rounded-xl border border-white/35 bg-[#06060a]/55" />
        <span aria-hidden className="absolute inset-0 translate-x-[6px] translate-y-[6px] rounded-xl border border-white/25 bg-[#04040a]/40" />
        <span aria-hidden className="absolute inset-0 translate-x-[9px] translate-y-[9px] rounded-xl border border-white/18 bg-[#020208]/28" />
        {/* Badge "Pourquoi utiliser Mettrik AI ?" à cheval sur la bordure
            supérieure. Yann (25 mai 2026 v3) : RESTAURÉ — le retrait du
            25 mai 04h05 était une mauvaise interprétation, Yann avait
            demandé de CHANGER LES PHRASES du bloc, pas de retirer le badge. */}
        <span
          aria-hidden
          className="absolute left-1/2 top-0 z-30 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full bg-[#06060a] px-4 py-1.5 font-mono text-[12px] font-extrabold uppercase tracking-[0.22em] sm:px-5 sm:py-2 sm:text-[14.5px]"
          style={{
            border: "1.5px solid rgba(168, 85, 247, 0.7)",
            boxShadow:
              "0 0 28px rgba(168, 85, 247, 0.55), 0 0 14px rgba(34, 211, 238, 0.35), inset 0 1px 0 rgba(255,255,255,0.18)",
          }}
        >
          <span
            className="bg-gradient-to-r from-violet-200 via-cyan-200 to-violet-200 bg-clip-text text-transparent"
            style={{ WebkitBackgroundClip: "text", backgroundClip: "text" }}
          >
            Pourquoi utiliser Mettrik AI ?
          </span>
        </span>
        {/* Cadre principal — citation académique style "résultat de recherche" */}
        <div
          className="relative z-10 flex min-h-[240px] flex-col items-center justify-center overflow-hidden rounded-xl border border-white/40 bg-[#0a0a0e]/85 px-6 py-9 backdrop-blur-sm sm:min-h-[260px] sm:px-12 sm:py-11"
          style={{
            boxShadow:
              "inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -1px 0 rgba(0,0,0,0.5), 0 18px 40px -12px rgba(139, 92, 246, 0.35), 0 8px 18px -6px rgba(0,0,0,0.6)",
          }}
        >
          {/* Catch light en haut */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-px"
            style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent)" }}
          />

          {/* Badge "Étude académique" en haut, look paper journal */}
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease, delay: 0.1 }}
            className="mb-4 inline-flex items-center gap-2 rounded-full border border-violet-400/35 bg-violet-500/[0.08] px-3 py-1 sm:mb-5"
          >
            <svg
              aria-hidden
              viewBox="0 0 24 24"
              className="size-3 text-violet-300"
              fill="currentColor"
            >
              <path d="M12 2L2 7v2l10 5 10-5V7L12 2zm0 9l-7-3.5 7-3.5 7 3.5L12 11zm-6 1.27v3.86c0 .87.93 1.42 1.69 1.04L12 14.91l4.31 2.26c.76.38 1.69-.17 1.69-1.04v-3.86l-6 3.13-6-3.13z" />
            </svg>
            <span className="font-mono text-[9.5px] font-bold uppercase tracking-[0.22em] text-violet-200 sm:text-[10.5px]">
              {locale === "fr" ? "Étude académique" : locale === "de" || locale === "de-CH" ? "Akademische Studie" : locale === "nl" ? "Academisch onderzoek" : locale === "sv" ? "Akademisk studie" : locale === "da" ? "Akademisk studie" : "Academic Study"}
            </span>
          </motion.div>

          {/* Quote mark décoratif gros à gauche */}
          <motion.span
            aria-hidden
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 0.5, scale: 1 }}
            transition={{ duration: 0.9, ease }}
            className="pointer-events-none absolute top-2 left-2 select-none font-display text-[80px] leading-none sm:top-3 sm:left-6 sm:text-[110px]"
            style={{
              background: "linear-gradient(135deg, #a78bfa 0%, #22d3ee 100%)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
              fontFamily: "var(--font-fraunces), Georgia, serif",
            }}
          >
            {citation.openQuote}
          </motion.span>

          {/* Quote mark décoratif gros à droite (closing) */}
          <motion.span
            aria-hidden
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 0.5, scale: 1 }}
            transition={{ duration: 0.9, ease, delay: 0.15 }}
            className="pointer-events-none absolute -bottom-2 right-2 select-none font-display text-[90px] leading-none sm:-bottom-3 sm:right-6 sm:text-[130px]"
            style={{
              background: "linear-gradient(135deg, #22d3ee 0%, #a78bfa 100%)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
              fontFamily: "var(--font-fraunces), Georgia, serif",
            }}
          >
            {citation.closeQuote}
          </motion.span>

          {/* Citation principale — typo serif élégante (Fraunces) au lieu du sans-serif */}
          <motion.p
            initial={{ opacity: 0, y: 12, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 0.8, ease }}
            className="relative z-10 max-w-2xl text-balance text-center text-[19px] font-medium italic leading-[1.5] text-zinc-100 sm:text-[24px]"
            style={{ fontFamily: "var(--font-fraunces), Georgia, serif" }}
          >
            <span
              className="bg-gradient-to-r from-violet-100 via-white to-cyan-100 bg-clip-text text-transparent"
              style={{ WebkitBackgroundClip: "text", backgroundClip: "text" }}
            >
              {citation.quote}
            </span>
          </motion.p>

          {/* Séparateur subtil */}
          <motion.span
            aria-hidden
            initial={{ scaleX: 0, opacity: 0 }}
            animate={{ scaleX: 1, opacity: 0.7 }}
            transition={{ duration: 0.7, ease, delay: 0.3 }}
            className="my-5 block h-px w-20 origin-center sm:my-6 sm:w-24"
            style={{
              background: "linear-gradient(90deg, transparent, rgba(168, 85, 247, 0.9), rgba(34, 211, 238, 0.9), transparent)",
            }}
          />

          {/* Source : 3 lignes hiérarchisées + typo variée (plus monotone) */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease, delay: 0.45 }}
            className="relative z-10 flex flex-col items-center gap-1.5 text-center"
          >
            {/* Ligne 1 : auteurs en serif italic, marquage premium */}
            <div
              className="text-[15px] font-semibold text-zinc-100 sm:text-[16.5px]"
              style={{ fontFamily: "var(--font-fraunces), Georgia, serif" }}
            >
              Fang
              <span className="mx-1 text-zinc-500" aria-hidden>·</span>
              Mohanram
              <span className="mx-1 text-zinc-500" aria-hidden>·</span>
              Vyas
            </div>
            {/* Ligne 2 : année en chip violet + institution en sans-serif */}
            <div className="flex flex-wrap items-center justify-center gap-2">
              <span
                className="inline-flex items-center rounded-full border border-violet-400/40 bg-violet-500/[0.12] px-2 py-0.5 font-mono text-[10.5px] font-bold tracking-[0.12em] text-violet-200"
              >
                2020
              </span>
              <span className="text-[12.5px] font-medium text-zinc-300 sm:text-[13.5px]">
                Singapore Management University
              </span>
            </div>
          </motion.div>
        </div>
      </motion.div>
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
  contentOverrides,
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
  /** Yann 12 mai 2026 : textes editables via /desk-mtk9x4kp/page-content.
   *  Chaque clef de cette map override la valeur i18n correspondante. Clés
   *  reconnues : tagline_main_1, tagline_main_2, tagline_sub,
   *  kpi_intelligence_under, punchline_1, punchline_2, punchline_3,
   *  punchline_4. Si absent : fallback dictionary.ts. */
  contentOverrides?: Record<string, string>;
} = {}) {
  const { t, locale } = useT();
  const tt = (key: string, overrideKey: string) =>
    (contentOverrides && contentOverrides[overrideKey]?.trim()) || t(key);
  const COMPANIES_USED = companiesProp ?? COMPANIES;
  const results = tickersProp ?? TICKERS;
  const buildHref = (tk: string): string =>
    routePrefix ? `${routePrefix}/${tk.toLowerCase()}` : `/${tk.toLowerCase()}`;
  // Yann 4 juin 2026 : ticker affiché sur les cards = displayTicker (strip
  // suffixe place boursière .PA/.SW/.L/etc sauf si conflit avec un short
  // existant). URL conserve le ticker complet via `buildHref` ci-dessus.
  const allTickersSet = useMemo(() => buildTickerSet(results), [results]);

  // Pagination par paquet de 30 (Yann 16 mai 2026) : top 30 affiché, puis
  // flèche "Déployer 30 de plus" pour en révéler 30 supplémentaires, etc.
  // Activé uniquement si results.length > 30 (V1 demo 5 stés non concerné).
  const PAGE_SIZE = 30;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const visibleResults = results.length > PAGE_SIZE ? results.slice(0, visibleCount) : results;
  const hasMore = results.length > visibleCount;
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
            {topNavLinks.map((l) => {
              // Yann (5 juin 2026 v2) : Tarif accessible 100% anonyme
              // (pas de gate signup). Contact + autres restent gated.
              // Détection via href contenant "/pricing".
              const isPricingLink = l.href.includes("/pricing");
              const linkNode = (
                <a href={l.href} className="group relative inline-block">
                  <span
                    aria-hidden
                    className="absolute inset-0 translate-x-[2px] translate-y-[2px] rounded-md border border-white/25 transition-transform duration-200 ease-out group-hover:translate-x-[3px] group-hover:translate-y-[3px]"
                  />
                  <span className="relative z-10 inline-flex items-center gap-1.5 rounded-md border border-white/40 bg-[#0a0a0e]/85 px-3.5 py-1.5 font-semibold tracking-[0.02em] text-zinc-100 transition-transform duration-200 ease-out group-hover:-translate-x-[1px] group-hover:-translate-y-[1px]">
                    {l.label}
                  </span>
                </a>
              );
              if (isPricingLink) {
                return <span key={l.href}>{linkNode}</span>;
              }
              return (
                <SignupGateOverlay
                  key={l.href}
                  enabled={requireSignupGate}
                  gatePath={gatePath}
                  initialAuthed={!requireSignupGate}
                >
                  {linkNode}
                </SignupGateOverlay>
              );
            })}
          </nav>
        )}

        <BrandWordmark
          kpiUnderText={tt("brand.kpi_intelligence_under", "kpi_intelligence_under")}
        />

        {/* Headline réduite + nouvelle punchline */}
        <div className="text-center animate-fade-up">
          <h1 className="mx-auto max-w-3xl text-balance font-display text-2xl font-semibold leading-[1.1] tracking-tight sm:text-4xl md:text-5xl">
            <span className="gradient-text">{tt("brand.tagline_main_1", "tagline_main_1")}</span>{" "}
            <span className="gradient-text-violet">{tt("brand.tagline_main_2", "tagline_main_2")}</span>
          </h1>
          {/* Yann (25 mai 2026 v2) : la bio "KPI Intelligence pour
              investisseurs boursiers fournisseur d'indicateurs clés et risques
              tracés" est désormais visible sous le wordmark (kpiUnderText)
              ET dans les metadata SEO. Cohérent : ce que les visiteurs voient
              = ce que Google / link previews montrent. */}
          <MettrikCitationCard locale={locale} />
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
          <SignupGateOverlay enabled={requireSignupGate} gatePath={gatePath} initialAuthed={!requireSignupGate}>
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
            {visibleResults.map((ticker, idx) => {
              const c = COMPANIES_USED[ticker];
              if (!c) return null;
              try {
                // Idem : wrap chaque card société dans le gate signup.
                // Yann (12 mai 2026) : passer l'idx pour afficher médailles
                // 🥇🥈🥉 sur les 3 premières du classement.
                const card = renderCompanyCard(c, ticker, buildHref, locale, t, idx, allTickersSet);
                if (!card) return null;
                return (
                  <SignupGateOverlay key={ticker} enabled={requireSignupGate} gatePath={gatePath} initialAuthed={!requireSignupGate}>
                    {card}
                  </SignupGateOverlay>
                );
              } catch {
                return null;
              }
            })}
          </div>

          {/* Pagination par paquet de 30 (Yann 16 mai 2026).
              Label "Montre-moi les 30 suivantes ↓" multilingue, ton léger
              (Yann 16 mai 04h45 : "More" cheap, prefère phrase complète). */}
          {hasMore && (
            <div className="mt-6 flex justify-center">
              <button
                type="button"
                onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                aria-label={t("home.show_next_30")}
                className="group inline-flex items-center gap-2.5 rounded-xl border border-violet-500/30 bg-violet-500/[0.06] px-6 py-3 text-[14px] font-medium tracking-wide text-violet-100 transition-all hover:scale-[1.02] hover:border-violet-500/50 hover:bg-violet-500/[0.12]"
              >
                <span>{t("home.show_next_30")}</span>
                <span aria-hidden className="inline-block text-[16px] transition-transform group-hover:translate-y-0.5">
                  ↓
                </span>
              </button>
            </div>
          )}

          {/* Bloc "Actions les plus populaires" intégré sous le top 30
              (Yann 16 mai 2026 04h45 : remet la "partie populaire" + seules
              les 30 premières ont l'aperçu de base, le reste via bouton).
              Affiché uniquement si results.length > 30 (= sandbox V175/V18,
              pas la home V1 demo 5 stés). */}
          {results.length > PAGE_SIZE && (
            <HomePopularBlock
              locale={locale}
              routePrefix={routePrefix}
              t={t}
              requireSignupGate={requireSignupGate}
              gatePath={gatePath}
            />
          )}
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
  t: (k: string) => string,
  rankIdx?: number,
  allTickersSet?: ReadonlySet<string>,
): React.ReactNode {
  const tickersUniverse = allTickersSet ?? new Set<string>();
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
  // Yann 16 mai 2026 : pipeline hero unifié page sté ↔ home preview.
  // Couvre autoRescale (TSLA "0,4 M units" → "410 K unités"), normalisation
  // "B €" → "Mds €" (ASMLF), guard magnitude % aberrante (ASML 32 milliards %).
  const heroHistory = Array.isArray(hero.history)
    ? (hero.history.filter((x) => typeof x === "number") as number[])
    : [];
  const heroDisplay = prepareHeroDisplay(hero.value, hero.unit, heroHistory);
  if (heroDisplay.anomaly && typeof console !== "undefined") {
    console.warn(
      `[Mettrik] Hero KPI anomaly on ${ticker} / ${hero.short}:`,
      hero.value,
      hero.unit,
      "→",
      heroDisplay.anomalyReason,
    );
  }
              return (
                <div key={ticker}>
                  <Link
                    href={buildHref(ticker)}
                    className="conic-border group relative flex min-h-[230px] flex-col rounded-xl border border-[#1f1f1f] bg-[#0a0a0a] p-4 transition-colors hover:border-[#2a2a2a]"
                  >
                    <div
                      className="pointer-events-none absolute -right-10 -top-10 size-32 rounded-full blur-3xl opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                      style={{ background: `${accent}55` }}
                    />
                    {/* Yann (12 mai 2026 v2) : médaille 🥇🥈🥉 en absolute
                        top-RIGHT (initialement top-left). */}
                    {typeof rankIdx === "number" && rankIdx < 3 && (
                      <div
                        className="absolute -right-2 -top-2 z-10 flex size-9 items-center justify-center rounded-full text-[18px] shadow-[0_4px_14px_rgba(0,0,0,0.6)]"
                        style={{
                          background:
                            rankIdx === 0
                              ? "linear-gradient(135deg, #fde047, #ca8a04)"
                              : rankIdx === 1
                                ? "linear-gradient(135deg, #e5e5e5, #737373)"
                                : "linear-gradient(135deg, #fdba74, #9a3412)",
                          border: "2px solid rgba(0,0,0,0.6)",
                        }}
                        aria-label={`Rang ${rankIdx + 1}`}
                        title={`#${rankIdx + 1} par capitalisation`}
                      >
                        {rankIdx === 0 ? "🥇" : rankIdx === 1 ? "🥈" : "🥉"}
                      </div>
                    )}
                    <div className="relative flex items-start justify-between">
                      <div>
                        <div className="font-mono text-xs" style={{ color: accent }}>
                          {displayTicker(ticker, tickersUniverse)}
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
                    <div className="mt-3 flex items-baseline justify-between gap-1.5">
                      {/* Yann 14 mai 2026 : value + unité dans un span flex
                          unique avec whitespace-nowrap pour éviter cassure
                          "20.03 Mds" / "$" (visible quand yoy long type +63,4 %). */}
                      <span className="inline-flex items-baseline gap-1 whitespace-nowrap">
                        <span
                          className="font-mono text-2xl font-semibold tabular-nums text-zinc-100"
                          title={heroDisplay.anomaly ? heroDisplay.anomalyReason : undefined}
                        >
                          {heroDisplay.value}
                        </span>
                        {heroDisplay.unit && (
                          <span className="whitespace-nowrap text-sm font-medium text-zinc-300">
                            {heroDisplay.unit.replace(/ /g, " ")}
                          </span>
                        )}
                      </span>
                      <span
                        className="whitespace-nowrap font-mono text-xs tabular-nums"
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
                    {/* Yann 20 mai 16h40 : grid 2 colonnes fixes (tier+pct
                        gauche / freshness droite) avec hauteur min identique
                        sur toutes les cards. Plus de flex-wrap = pas de
                        chips qui descendent quand un texte est long. Truncate
                        au besoin pour préserver l'alignement vertical du
                        bloc dans toutes les cards de la grille. */}
                    {/* Yann (26 mai 2026) : chips empilées sur 2 lignes au lieu
                        d'une seule. Avant : grid 1 ligne forçait truncate sur
                        percentile (= "Top..." illisible) ET les chips étaient
                        masquées par FreshnessIndicator. Maintenant chaque chip
                        a sa propre ligne, tout est lisible sur toutes les stés. */}
                    <div className="mt-3 flex flex-col gap-1.5">
                      <div className="flex items-center gap-1.5 overflow-hidden">
                        <span
                          className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium"
                          style={{ background: `${r.color}18`, color: r.color }}
                        >
                          <span className="size-1.5 rounded-full" style={{ background: r.color }} />
                          {t(`tier.${r.tier}`)}
                        </span>
                        <span className="truncate font-mono text-[10px] text-zinc-400">
                          {r.percentile}
                        </span>
                      </div>
                      {/* Yann (V1.9.5, juin 2026) : helper unique
                          `getFreshnessReference` partagé avec la page sté
                          pour garantir que la chip est identique pour la
                          même sté entre les 2 vues. Voir
                          `src/lib/freshness/compute-tier.ts`. */}
                      <FreshnessIndicator
                        lastDate={getFreshnessReference(c).lastDate ?? "2025-12-31"}
                        publicationDate={getFreshnessReference(c).publicationDate}
                        nextEarningsDate={c.next_earnings_date}
                        ticker={ticker}
                        alwaysShow
                        size="sm"
                        tooltipAlign="left"
                      />
                    </div>
                  </Link>
                </div>
              );
}
