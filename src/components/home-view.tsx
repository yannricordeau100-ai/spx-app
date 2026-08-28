"use client";

import Link from "next/link";
import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import KPI_COUNTS from "@/data/_kpi-counts.json";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Sparkles } from "lucide-react";

import { COMPANIES, TICKERS } from "@/lib/data";
import { displayTicker, buildTickerSet } from "@/lib/ticker-display";
import { Spotlight } from "@/components/effects/spotlight";
import { BackToTop } from "@/components/back-to-top";
import { CompanySearch } from "@/components/company-search";
import { HomeFAQ } from "@/components/home-faq";
import { HomePopularBlock } from "@/components/home-popular-block";
import { HomeWowGrid } from "@/components/home-wow-grid";
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
          className="wordmark-png-v2 relative block"
          style={{
            height: "clamp(96px, 16vw, 220px)",
            lineHeight: 0,
            fontSize: 0,
          }}
        >
          {/* BUG FIX (8 juin 2026) : .preserve-colors évite que le filtre
              global invert() du light theme ne re-inverse le PNG swappé.
              Sans ça, le PNG black devenait blanc → invisible sur fond
              clair (lui-même fond sombre inversé). */}
          <img
            src="/brand/mettrik-ai-white-purple.png"
            alt="Mettrik AI"
            className="wordmark-png-dark preserve-colors block h-full w-auto select-none"
            draggable={false}
          />
          <img
            src="/brand/mettrik-ai-black-purple.png"
            alt=""
            aria-hidden
            className="wordmark-png-light preserve-colors absolute inset-0 hidden h-full w-auto select-none"
            draggable={false}
          />
          <style>{`
            html[data-theme="light"] .wordmark-png-dark { display: none; }
            html[data-theme="light"] .wordmark-png-light { display: block !important; position: static !important; }
          `}</style>
        </span>
      </motion.div>

      {/* Rail iridescent qui se trace de gauche à droite.
          Yann 8 juin 2026 (FIX RÉEL) : wrapper PNG passe en block +
          lineHeight 0 + fontSize 0 (annule espace fantôme inline-block
          des descendants typo). paddingBottom 6px supprimé (vestige
          Fraunces, le contenu est un PNG sans descendants). Séparateur
          en mt-0 = collé au pixel près au bas du PNG. */}
      <motion.div
        initial={{ scaleX: 0, opacity: 0 }}
        animate={{ scaleX: 1, opacity: 1 }}
        transition={{ delay: 0.55, duration: 1, ease: [0.22, 1, 0.36, 1] }}
        className="h-[2px] w-[min(82%,520px)] origin-left rounded-full"
        style={{
          // Yann 10 juin 2026 : le PNG du wordmark a ~36,5% de whitespace
          // transparent en bas. On remonte le trait de 90% de ce vide (marge
          // negative responsive = 0,9 x 36,5% x hauteur clamp(96..220px)) pour
          // le coller quasiment sous le texte du logo.
          marginTop: "clamp(-72px, -5.26vw, -31.5px)",
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
type CitationEntry = {
  quote: string;
  openQuote: string;
  closeQuote: string;
  author: string;
  affiliation: string;
  year: string;
  badge: string;
};

/**
 * Yann 26 aout 2026 : DEUX citations, plus une seule.
 * La premiere (Buffett) est celle vue par defaut ; la seconde (Holmstrom)
 * la remplace quand le bloc monte dans la moitie haute de l ecran, et
 * inversement en remontant. Voir useCitationIndex plus bas.
 */
const CITATIONS_BY_LOCALE: Record<string, CitationEntry[]> = {
  fr: [
    {
      quote:
        "Nous utilisons des KPI non conventionnels. La comptabilité conventionnelle révèle peu de choses sur la véritable performance économique d'une entreprise.",
      openQuote: "«",
      closeQuote: "»",
      author: "Warren Buffett",
      affiliation: "Berkshire Hathaway · An Owner's Manual",
      year: "1996",
      badge: "Lettre aux actionnaires",
    },
    {
      quote:
        "L'intégration d'indicateurs de performance clés est essentielle pour aligner les décisions opérationnelles et garantir la rentabilité future.",
      openQuote: "«",
      closeQuote: "»",
      author: "Bengt Holmström",
      affiliation: "MIT",
      year: "Prix Nobel d'Économie 2016",
      badge: "Recherche académique",
    },
  ],
  en: [
    {
      quote:
        "We use unconventional KPIs. Conventional accounting reveals little about the true economic performance of a business.",
      openQuote: "\u201c",
      closeQuote: "\u201d",
      author: "Warren Buffett",
      affiliation: "Berkshire Hathaway · An Owner's Manual",
      year: "1996",
      badge: "Shareholder letter",
    },
    {
      quote:
        "Embedding key performance indicators is essential to align operating decisions and secure future profitability.",
      openQuote: "\u201c",
      closeQuote: "\u201d",
      author: "Bengt Holmström",
      affiliation: "MIT",
      year: "Nobel Prize in Economics 2016",
      badge: "Academic research",
    },
  ],
  de: [
    {
      quote:
        "Wir verwenden unkonventionelle Kennzahlen. Die konventionelle Rechnungslegung sagt wenig über die tatsächliche wirtschaftliche Leistung eines Unternehmens aus.",
      openQuote: "\u201e",
      closeQuote: "\u201d",
      author: "Warren Buffett",
      affiliation: "Berkshire Hathaway · An Owner's Manual",
      year: "1996",
      badge: "Aktionärsbrief",
    },
    {
      quote:
        "Die Verankerung von Leistungskennzahlen ist entscheidend, um operative Entscheidungen auszurichten und künftige Rentabilität zu sichern.",
      openQuote: "\u201e",
      closeQuote: "\u201d",
      author: "Bengt Holmström",
      affiliation: "MIT",
      year: "Wirtschaftsnobelpreis 2016",
      badge: "Akademische Forschung",
    },
  ],
  nl: [
    {
      quote:
        "Wij gebruiken onconventionele KPI's. Conventionele boekhouding zegt weinig over de werkelijke economische prestaties van een bedrijf.",
      openQuote: "\u201e",
      closeQuote: "\u201d",
      author: "Warren Buffett",
      affiliation: "Berkshire Hathaway · An Owner's Manual",
      year: "1996",
      badge: "Aandeelhoudersbrief",
    },
    {
      quote:
        "Het verankeren van kernprestatie-indicatoren is essentieel om operationele beslissingen af te stemmen en toekomstige winstgevendheid te waarborgen.",
      openQuote: "\u201e",
      closeQuote: "\u201d",
      author: "Bengt Holmström",
      affiliation: "MIT",
      year: "Nobelprijs Economie 2016",
      badge: "Academisch onderzoek",
    },
  ],
};
CITATIONS_BY_LOCALE["en-GB"] = CITATIONS_BY_LOCALE.en!;
CITATIONS_BY_LOCALE["de-CH"] = CITATIONS_BY_LOCALE.de!;

/**
 * Index de la citation a afficher, pilote par la position du bloc a l ecran.
 *
 * Regle (Yann 26 aout 2026) : tant que le bloc occupe majoritairement la
 * moitie BASSE de la fenetre (ou se trouve plus bas), on montre Buffett.
 * Des que sa surface bascule majoritairement dans la moitie HAUTE (ou
 * au-dessus), on montre Holmstrom. Le test porte sur le CENTRE du bloc
 * compare a la mi-hauteur de la fenetre, ce qui revient au meme et reste
 * stable pendant un scroll rapide dans les deux sens.
 */
function useCitationIndex(ref: React.RefObject<HTMLDivElement | null>): number {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    let last = 0;
    // Mesure directe, sans requestAnimationFrame : rAF est suspendu quand
    // l onglet passe en arriere-plan, et la citation restait alors figee sur
    // la premiere. Un getBoundingClientRect limite a 50 ms est negligeable.
    const measure = () => {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const middleOfBlock = r.top + r.height / 2;
      setIndex(middleOfBlock <= window.innerHeight / 2 ? 1 : 0);
    };
    const onScroll = () => {
      const now = Date.now();
      if (now - last < 50) return;
      last = now;
      measure();
    };
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [ref]);
  return index;
}


/**
 * Compteur des KPI publies (Yann 26 aout 2026).
 *
 * Trois familles, dans l ordre demande : indicateurs cles (le KPI principal
 * de chaque societe est compte dedans), blocs graphiques dedies, stories.
 * Les nombres viennent de src/data/_kpi-counts.json, regenere par
 * `node scripts/build-kpi-counts.mjs` a chaque mise a jour des donnees, et
 * le nombre de blocs graphiques est complete a l affichage si l app le
 * fournit. Le comptage applique le meme filtre que les fiches : les KPI
 * generiques masques ne sont pas comptes.
 */
function KpiCountersRow({ locale = "fr" }: { locale?: string }) {
  const fr = locale.startsWith("fr");
  const nf = (n: number) => n.toLocaleString(fr ? "fr-FR" : "en-US");
  const items = [
    {
      value: KPI_COUNTS.key_indicators,
      label: fr ? "indicateurs clés" : "key indicators",
      hint: fr
        ? `dont ${nf(KPI_COUNTS.heroes)} indicateurs principaux`
        : `including ${nf(KPI_COUNTS.heroes)} headline metrics`,
    },
    {
      value: KPI_COUNTS.special_blocks,
      label: fr ? "blocs graphiques" : "dedicated charts",
      hint: fr ? "graphiques sur mesure" : "custom-built charts",
    },
    {
      value: KPI_COUNTS.stories,
      label: fr ? "stories" : "stories",
      hint: fr ? "cartes de contexte" : "context cards",
    },
  ].filter((i) => i.value > 0);

  if (items.length === 0) return null;

  return (
    <div className="mx-auto mt-8 flex max-w-3xl flex-wrap items-stretch justify-center gap-3 sm:mt-10 sm:gap-4">
      {items.map((i) => (
        <div
          key={i.label}
          className="flex min-w-[150px] flex-1 flex-col items-center rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 backdrop-blur-sm sm:min-w-[180px]"
        >
          <span className="font-mono text-[22px] font-bold tabular-nums text-zinc-50 sm:text-[26px]">
            {nf(i.value)}
          </span>
          <span className="mt-0.5 text-[12.5px] font-medium text-zinc-200 sm:text-[13.5px]">
            {i.label}
          </span>
          <span className="mt-0.5 text-center text-[11px] text-zinc-500">{i.hint}</span>
        </div>
      ))}
    </div>
  );
}

function MettrikCitationCard({ locale = "fr" }: { locale?: string }) {
  const ease = [0.22, 1, 0.36, 1] as [number, number, number, number];
  const blockRef = useRef<HTMLDivElement | null>(null);
  const list = CITATIONS_BY_LOCALE[locale] ?? CITATIONS_BY_LOCALE.en!;
  const index = useCitationIndex(blockRef);
  const citation = list[Math.min(index, list.length - 1)]!;

  // Yann 12 mai 2026 v2 : effet 3D nettement plus marqué.
  // - perspective wrapper + léger tilt rotateX (cadre flotte au-dessus du fond)
  // - 3 couches d'ombre décalée (effet bloc épais, profondeur réelle)
  // - halo violet/cyan derrière (lumière émise par le cadre)
  // - bord supérieur en highlight clair (catch light, simule éclairage du haut)
  // - bord inférieur en ombre foncée (sol sous le bloc)
  // - hover : le bloc se redresse et la lumière s'intensifie
  return (
    <div
      ref={blockRef}
      className="mx-auto mt-14 flex max-w-3xl justify-center sm:mt-20"
      style={{ perspective: "1200px" }}
    >
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
            key={`badge-${index}`}
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
              {citation.badge}
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

          {/* Citation principale — typo serif élégante (Fraunces).
              La cle = index : changer de citation rejoue le fondu. */}
          <motion.p
            key={`quote-${index}`}
            initial={{ opacity: 0, y: 8, filter: "blur(5px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 0.45, ease }}
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
            transition={{ duration: 0.4, ease, delay: 0.05 }}
            key={`source-${index}`}
            className="relative z-10 flex flex-col items-center gap-1.5 text-center"
          >
            {/* Ligne 1 : auteur */}
            <div
              className="text-[15px] font-semibold text-zinc-100 sm:text-[16.5px]"
              style={{ fontFamily: "var(--font-fraunces), Georgia, serif" }}
            >
              {citation.author}
            </div>
            {/* Ligne 2 : annee (ou distinction) en chip violet + institution */}
            <div className="flex flex-wrap items-center justify-center gap-2">
              <span className="inline-flex items-center rounded-full border border-violet-400/40 bg-violet-500/[0.12] px-2 py-0.5 font-mono text-[10.5px] font-bold tracking-[0.12em] text-violet-200">
                {citation.year}
              </span>
              <span className="text-[12.5px] font-medium text-zinc-300 sm:text-[13.5px]">
                {citation.affiliation}
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
  // Yann 28 aout 2026 : la pagination interne vit dans HomeWowGrid.
  const PAGE_SIZE = 30;
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
          <KpiCountersRow locale={locale} />
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
          {/* Yann 28 aout 2026 : la grille de cartes hero (medailles, etoile,
              "i", KPI principal) laisse place a la grille des societes
              populaires aupres des investisseurs francais : 2 par ligne,
              3 KPI wow chacune, 20 visibles, 40 au maximum. */}
          <HomeWowGrid
            universe={results}
            buildHref={buildHref}
            requireSignupGate={requireSignupGate}
            gatePath={gatePath}
            labelVoirPlus={t("home.show_next_30")}
          />


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

          {/* Yann 28 aout 2026 : section "Plus grandes capitalisations" supprimee. */}
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
