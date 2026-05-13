"use client";

import Link from "next/link";
import type React from "react";
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
function RotatingPunchline({ items }: { items: string[] }) {
  const [idx, setIdx] = useState(() => Math.floor(Math.random() * items.length));

  // Yann 13 mai 2026 : délai 15s (était 10s) pour laisser le temps de lire.
  useEffect(() => {
    if (items.length <= 1) return;
    const t = setTimeout(() => {
      setIdx((prev) => {
        let next = Math.floor(Math.random() * items.length);
        let safety = 0;
        while (next === prev && safety++ < 8) next = Math.floor(Math.random() * items.length);
        return next;
      });
    }, 15000);
    return () => clearTimeout(t);
  }, [idx, items.length]);

  // Avance manuelle (clic chevron desktop ou swipe mobile).
  const advance = () => {
    if (items.length <= 1) return;
    setIdx((prev) => {
      let next = Math.floor(Math.random() * items.length);
      let safety = 0;
      while (next === prev && safety++ < 8) next = Math.floor(Math.random() * items.length);
      return next;
    });
  };

  // Swipe gauche → next (mobile + trackpad).
  const touchStartX = useRef<number | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const dx = (e.changedTouches[0]?.clientX ?? touchStartX.current) - touchStartX.current;
    if (dx < -40) advance(); // swipe left
    touchStartX.current = null;
  };

  const raw = items[idx] ?? "";
  const sepIdx = raw.indexOf(" | ");
  const part1 = sepIdx > 0 ? raw.slice(0, sepIdx).trim() : raw.trim();
  const part2 = sepIdx > 0 ? raw.slice(sepIdx + 3).trim() : "";

  const ease = [0.22, 1, 0.36, 1] as [number, number, number, number];

  // Yann 12 mai 2026 v2 : effet 3D nettement plus marqué.
  // - perspective wrapper + léger tilt rotateX (cadre flotte au-dessus du fond)
  // - 3 couches d'ombre décalée (effet bloc épais, profondeur réelle)
  // - halo violet/cyan derrière (lumière émise par le cadre)
  // - bord supérieur en highlight clair (catch light, simule éclairage du haut)
  // - bord inférieur en ombre foncée (sol sous le bloc)
  // - hover : le bloc se redresse et la lumière s'intensifie
  return (
    <div className="mx-auto mt-6 flex max-w-3xl justify-center sm:mt-7" style={{ perspective: "1200px" }}>
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
            supérieure (Yann 13 mai 2026). Style volontairement décalé du
            reste : police mono uppercase + couleur violet/cyan + bordure
            arrondie + fond sombre opaque pour casser la ligne de bordure.
            Positionné absolu, top: 0 + translate -50% = moitié au-dessus,
            moitié au-dessous de la ligne du cadre. Z-index 30 pour passer
            au-dessus du frame (z-10) et des shadows (z-0). */}
        <span
          aria-hidden
          className="absolute left-1/2 top-0 z-30 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full border border-violet-400/50 bg-[#06060a] px-3 py-1 font-mono text-[9.5px] font-bold uppercase tracking-[0.22em] sm:text-[10.5px]"
          style={{
            boxShadow:
              "0 0 18px rgba(168, 85, 247, 0.35), inset 0 1px 0 rgba(255,255,255,0.12)",
          }}
        >
          <span
            className="bg-gradient-to-r from-violet-300 via-cyan-200 to-violet-300 bg-clip-text text-transparent"
            style={{ WebkitBackgroundClip: "text", backgroundClip: "text" }}
          >
            Pourquoi utiliser Mettrik AI ?
          </span>
        </span>
        {/* Cadre principal */}
        <div
          className="relative z-10 flex min-h-[148px] items-center justify-center overflow-hidden rounded-xl border border-white/40 bg-[#0a0a0e]/85 px-5 py-4 pr-12 backdrop-blur-sm sm:min-h-[168px] sm:pr-14"
          style={{
            boxShadow:
              "inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -1px 0 rgba(0,0,0,0.5), 0 18px 40px -12px rgba(139, 92, 246, 0.35), 0 8px 18px -6px rgba(0,0,0,0.6)",
          }}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          {/* Catch light en haut (simule éclairage du haut) */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-px"
            style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent)" }}
          />
          {/* Hint à droite (Yann 13 mai 2026) : 3 barres équaliseur qui
              pulsent + label "swipe" vertical mini. Effet "data vivante" :
              fait sentir que l'app est en train de "respirer", inviter à
              avancer sans flèche bateau. Cliquable desktop, swipe gauche
              mobile (touchHandlers sur le parent). */}
          <button
            type="button"
            onClick={advance}
            aria-label="Punchline suivante"
            className="group/hint absolute inset-y-0 right-0 z-20 flex flex-col items-center justify-center gap-1.5 px-3 transition-opacity hover:opacity-100 sm:px-4"
            style={{
              background:
                "linear-gradient(270deg, rgba(139, 92, 246, 0.20) 0%, rgba(34, 211, 238, 0.08) 60%, transparent 100%)",
            }}
          >
            <span
              aria-hidden
              className="flex items-end gap-[3px]"
              style={{ filter: "drop-shadow(0 0 5px rgba(168,85,247,0.55))" }}
            >
              {[0, 0.18, 0.36].map((delay, i) => (
                <motion.span
                  key={i}
                  animate={{ scaleY: [0.4, 1, 0.4], opacity: [0.55, 1, 0.55] }}
                  transition={{ duration: 1.4, delay, repeat: Infinity, ease: "easeInOut" }}
                  style={{
                    transformOrigin: "bottom",
                    display: "inline-block",
                    width: "3px",
                    height: "14px",
                    borderRadius: "1.5px",
                    background:
                      "linear-gradient(180deg, #22d3ee 0%, #a78bfa 100%)",
                  }}
                />
              ))}
            </span>
            <span className="font-mono text-[8px] font-bold uppercase tracking-[0.22em] text-violet-300/85">
              suivant
            </span>
          </button>
          <AnimatePresence mode="wait">
            <motion.div
              key={idx}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5, ease }}
              className="w-full text-center"
            >
              {/* part1 — question / locuteur 1, retrait visuel */}
              <motion.p
                initial={{ opacity: 0, y: 12, filter: "blur(4px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -12, filter: "blur(4px)" }}
                transition={{ duration: 0.6, ease }}
                className="text-balance font-display text-[17px] italic leading-[1.4] text-zinc-300/80 sm:text-[20px]"
              >
                {renderPunchline(part1)}
              </motion.p>

              {part2 && (
                <motion.p
                  initial={{ opacity: 0, y: 12, filter: "blur(4px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, y: -12, filter: "blur(4px)" }}
                  transition={{ duration: 0.7, ease, delay: 0.12 }}
                  className="mt-2 text-balance font-display text-[18px] font-semibold italic leading-[1.35] sm:mt-2.5 sm:text-[22px]"
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
          kpiUnderText={locale === "fr" ? tt("brand.kpi_intelligence_under", "kpi_intelligence_under") : undefined}
        />

        {/* Headline réduite + nouvelle punchline */}
        <div className="text-center animate-fade-up">
          <h1 className="mx-auto max-w-3xl text-balance font-display text-2xl font-semibold leading-[1.1] tracking-tight sm:text-4xl md:text-5xl">
            <span className="gradient-text">{tt("brand.tagline_main_1", "tagline_main_1")}</span>{" "}
            <span className="gradient-text-violet">{tt("brand.tagline_main_2", "tagline_main_2")}</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-balance text-[13.5px] leading-relaxed text-zinc-400 sm:text-[15px]">
            {tt("brand.tagline_sub", "tagline_sub")}
          </p>
          {locale === "fr" && (
            <RotatingPunchline
              items={[
                tt("home.punchline.1", "punchline_1"),
                tt("home.punchline.2", "punchline_2"),
                tt("home.punchline.3", "punchline_3"),
                tt("home.punchline.4", "punchline_4"),
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
            {results.map((ticker, idx) => {
              const c = COMPANIES_USED[ticker];
              if (!c) return null;
              try {
                // Idem : wrap chaque card société dans le gate signup.
                // Yann (12 mai 2026) : passer l'idx pour afficher médailles
                // 🥇🥈🥉 sur les 3 premières du classement.
                const card = renderCompanyCard(c, ticker, buildHref, locale, t, idx);
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
                          publicationDate={c.latest_filing?.date}
                          nextEarningsDate={c.next_earnings_date}
                          ticker={ticker}
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
