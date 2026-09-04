"use client";

import { TrendingUp } from "lucide-react";
import type { KPI, MarketPosition } from "@/lib/data";
import { brand } from "@/lib/brand";
import type { StorySlide } from "@/lib/kpi-stories-ordering";
import { formatUnit, formatKpiValue, formatHeroValue } from "@/lib/data";
import dynamic from "next/dynamic";

const RechartLineChart = dynamic(() => import("./recharts-story-chart"), { ssr: false });

/** Yann 12 juil 2026 : valeur + unité STORY rescalées ensemble ([1,999] +
 *  décimales, règle CLAUDE.md §6). Avant : formatKpiValue seul laissait
 *  "1 036 M $" au lieu de "1,04 Mds $". */
export function storyFmt(value: string | number | null | undefined, unit?: string): { value: string; unit: string } {
  const f = formatHeroValue(value ?? null, unit ?? "");
  return { value: f.value, unit: f.unit };
}

import { InfoTooltip } from "@/components/info-tooltip";
import { normalizeNarrative } from "@/lib/ui-fix-templates";
import { useT } from "@/lib/i18n/provider";
import { useId, useLayoutEffect, useRef, useState } from "react";
import { kpiPeriodLabel } from "@/lib/period-label";
import { isFiscalShifted } from "@/lib/fiscal-calendar";

/**
 * Taille de police auto-adaptée du gros chiffre story selon sa longueur,
 * pour qu'un nombre long (ex "750 000") ne déborde pas ni ne se coupe au
 * milieu (Yann 11 juin 2026 : "750 0 00" cassé sur 2 lignes = non pro).
 */
/** Remplace les espaces fines des milliers par une espace insecable normale,
 *  qui accepte `word-spacing`. Sans cela "1 000 000" formait un bloc compact
 *  et on ne distinguait pas le million au premier coup d oeil. */
export function espacesLarges(s: string): string {
  return s.replace(/[\u202f\u2009\u00a0 ]/g, "\u00a0");
}


/**
 * Yann 4 sept 2026 : le gros chiffre des stories est desormais un SVG.
 *
 * Toutes les tentatives precedentes (taille par longueur, unites vw puis cqw,
 * reduction par transformation, mesure scrollWidth) jouaient sur la taille de
 * police d un texte HTML, avec a chaque fois un navigateur ou un ecran ou le
 * chiffre finissait coupe ("600 00" chez Coca-Cola). Un SVG avec une boite
 * mesuree sur le texte reel se met a l echelle de son conteneur par
 * construction : il ne peut pas deborder, quels que soient la police, la
 * langue ou l ecran. Le degrade est porte par le SVG lui-meme.
 */
function ValeurSvg({ texte, hauteurMax = 108 }: { texte: string; hauteurMax?: number }) {
  const ref = useRef<SVGTextElement | null>(null);
  const idDegrade = useId();
  const [boite, setBoite] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    let vivant = true;
    const mesure = () => {
      if (!vivant) return;
      try {
        const b = el.getBBox();
        if (b.width > 0 && b.height > 0) setBoite({ x: b.x, y: b.y, w: b.width, h: b.height });
      } catch {
        /* SVG pas encore attache */
      }
    };
    mesure();
    // La police d affichage peut arriver apres le premier rendu : on remesure.
    if (typeof document !== "undefined" && document.fonts?.ready) {
      document.fonts.ready.then(mesure).catch(() => {});
    }
    const minuteries = [120, 500, 1500].map((ms) => window.setTimeout(mesure, ms));
    return () => {
      vivant = false;
      minuteries.forEach((m) => window.clearTimeout(m));
    };
  }, [texte]);
  const marge = 6;
  const vb = boite
    ? `${boite.x - marge} ${boite.y - marge} ${boite.w + marge * 2} ${boite.h + marge * 2}`
    : "0 0 300 110";
  return (
    <svg
      viewBox={vb}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={texte}
      className="font-display block w-full"
      style={{ height: "auto", maxHeight: hauteurMax, visibility: boite ? "visible" : "hidden" }}
    >
      <defs>
        <linearGradient id={idDegrade} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="60%" stopColor="#d4d4d8" />
          <stop offset="100%" stopColor="#a78bfa" />
        </linearGradient>
      </defs>
      <text
        ref={ref}
        x="0"
        y="0"
        dominantBaseline="hanging"
        fontSize="100"
        fontWeight="700"
        letterSpacing="-2"
        fill={`url(#${idDegrade})`}
        style={{ whiteSpace: "pre" }}
      >
        {texte}
      </text>
    </svg>
  );
}

export function storyValueFont(s: string): string {
  const n = s.replace(/[\s  ]/g, "").length;
  if (n <= 4) return "clamp(44px, 17vw, 104px)";
  if (n <= 6) return "clamp(36px, 13vw, 80px)";
  if (n <= 8) return "clamp(28px, 10vw, 58px)";
  return "clamp(22px, 8vw, 44px)";
}

/**
 * Yann 20 mai 2026 : période sous chaque KPI Story.
 * - Année civile → "En 2025" / "In 2025" / "Im Jahr 2025"
 * - Année fiscale décalée → "Année fiscale 2025" / "Fiscal year 2025" / "Geschäftsjahr 2025"
 */
function formatStoryPeriod(kpi: KPI, ticker: string, locale: string): string | null {
  // Yann 25 aout 2026 : libelle de periode centralise dans kpiPeriodLabel
  // (src/lib/period-label.ts). Il donne la priorite au libelle de periode
  // reel de la donnee (history_periods / history[].q) sur last_data_date,
  // qui vaut souvent date de collecte, et n affiche jamais un trimestre
  // non termine. Corrige le "T3 2026" vu sur les stories NVDA.
  void isFiscalShifted; // conserve pour compat import
  return kpiPeriodLabel(kpi as unknown as { last_data_date?: string | null; history_periods?: unknown; history?: unknown }, ticker, locale);
}

/**
 * Une carte du bloc Stories : soit un KPI short-history, soit une
 * MarketPosition. Format vertical façon Instagram story.
 *
 * Refonte 6 mai 2026 (Yann) :
 *  - KPI name plus gros que la catégorie (catégorie = accessoire,
 *    nom du KPI = info principale après la valeur).
 *  - Espaces vides réduits (plus de vide = plus de présence des info).
 *  - Bottom blocs (Revenu segment / TAM) : valeurs et libellés agrandis.
 *  - Acronymes (TAM, CAGR, etc.) ont un tooltip "i" (un ado de 16 ans
 *    sait pas ce que c'est).
 *  - Sources externes longues (>4 mots) sont déplacées dans un tooltip
 *    "i" pour ne pas polluer l'écran story.
 */
/**
 * Yann 30 aout 2026 : le chiffre central pouvait deborder de la carte
 * ("600 000" coupe sur KO) car sa taille etait choisie par LONGUEUR avec des
 * unites vw (largeur de la FENETRE, pas de la carte). Ce hook mesure le
 * rendu reel et reduit par transform scale jusqu a tenir. Deterministe,
 * aucune classe cassee, marche pour toute valeur et toute largeur.
 */
function useAjusteLargeur(dep: string) {
  const ref = useRef<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Yann 4 sept 2026, cause enfin identifiee des recidives ("600 00…" sur
    // KO, "500 00(" sur Waymo) : l ancienne mesure comparait clientWidth a
    // scrollWidth. Or sur un bloc en `overflow: visible` avec du texte en
    // `nowrap`, Safari (donc tout iPhone) NE compte PAS le texte qui deborde
    // dans scrollWidth : la condition etait fausse, aucune reduction n etait
    // appliquee, et la carte parente coupait le chiffre. On mesure desormais
    // la largeur REELLE du texte via son rectangle, ce qui est identique dans
    // tous les navigateurs. Le texte est enveloppe dans un span en
    // inline-block, car une transformation n a aucun effet sur un element
    // inline.
    // Yann 4 sept 2026, deuxieme cause : le chiffre est peint par un degrade
    // decoupe sur les lettres (-webkit-text-fill-color: transparent). Poser la
    // reduction sur le span INTERIEUR lui donne son propre contexte de rendu :
    // ses lettres ne sont plus remplies par le degrade du parent et le chiffre
    // devient INVISIBLE (cas Coca-Cola "600 000"). On garde donc le span pour
    // MESURER (son rectangle donne la vraie largeur, ce que scrollWidth ne fait
    // pas sur Safari) mais on applique la reduction sur le PARENT, qui porte le
    // degrade.
    const ajuste = () => {
      const mesure = (el.firstElementChild as HTMLElement | null) ?? el;
      el.style.transform = "";
      const dispo = el.clientWidth;
      const reel = mesure.getBoundingClientRect().width;
      if (dispo > 0 && reel > dispo - 2) {
        const k = Math.max(0.3, (dispo - 4) / reel);
        el.style.transform = `scale(${k})`;
        el.style.transformOrigin = "center center";
      }
    };
    ajuste();
    // Yann 31 aout 2026 (screen KO "600 00…" coupe) : la mesure initiale se
    // faisait parfois AVANT le chargement de la police d affichage, sur une
    // police de repli plus etroite. Une fois la vraie police arrivee, le
    // nombre s elargissait et le dernier chiffre sortait de la carte. On
    // re-mesure a l arrivee des polices et au redimensionnement.
    // Yann 1er sept 2026 (recidive sur iPhone) : blindage complet — un
    // ResizeObserver suit la largeur reelle de la carte (le resize fenetre ne
    // couvre pas les animations du carrousel ni les reglages d accessibilite),
    // et trois re-mesures differees couvrent tout chargement tardif.
    let vivant = true;
    if (typeof document !== "undefined" && document.fonts?.ready) {
      document.fonts.ready.then(() => {
        if (vivant) ajuste();
      });
    }
    const minuteries = [150, 600, 1500].map((ms) =>
      window.setTimeout(() => {
        if (vivant) ajuste();
      }, ms),
    );
    let observateur: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      observateur = new ResizeObserver(() => {
        if (vivant) ajuste();
      });
      observateur.observe(el);
      if (el.parentElement) observateur.observe(el.parentElement);
    }
    window.addEventListener("resize", ajuste);
    return () => {
      vivant = false;
      minuteries.forEach((m) => window.clearTimeout(m));
      observateur?.disconnect();
      window.removeEventListener("resize", ajuste);
    };
  }, [dep]);
  return ref;
}

export function KpiStoryCard({ slide, ticker, freeBlocked = false }: { slide: StorySlide; ticker: string; freeBlocked?: boolean }) {
  const accent = brand(ticker).primary;
  const glow = brand(ticker).glow;

  if (slide.kind === "kpi") {
    return <KpiCard kpi={slide.data} accent={accent} glow={glow} ticker={ticker} freeBlocked={freeBlocked} />;
  }
  return <MarketPositionStoryCard mp={slide.data} accent={accent} glow={glow} ticker={ticker} freeBlocked={freeBlocked} />;
}

/* -------- KPI card (short-history) — format portrait mobile 9:16 -------- */
function KpiCard({ kpi, accent, glow, ticker, freeBlocked = false }: { kpi: KPI; accent: string; glow: string; ticker: string; freeBlocked?: boolean }) {
  const { t, locale } = useT();
  const periodLabel = formatStoryPeriod(kpi, ticker, locale);
  return (
    <div
      className="relative flex h-full flex-col overflow-hidden rounded-[36px] bg-gradient-to-br from-[#101015] via-[#0a0a0e] to-[#060608] px-5 pb-4 pt-11"
      style={{ boxShadow: `inset 0 0 120px ${glow}` }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-20 -right-16 size-64 rounded-full blur-3xl"
        style={{ background: `${accent}55` }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-20 -left-16 size-64 rounded-full blur-3xl"
        style={{ background: `${accent}33` }}
      />

      <div className="relative flex h-full flex-col">
        {/* Header row : nom KPI à gauche (gros), badge catégorie discret à
            droite. Plus compact que avant : 1 ligne au lieu de 2 niveaux. */}
        <div data-blur-part="titre" className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            {/* Yann 12 juil 2026 : le short technique anglais ("BACKLOG
                (UNITS)", etc.) au-dessus du titre FR est supprimé. Le titre
                FR suffit ; le tooltip explication reste, collé au titre. */}
            {/* Yann 17 juil 2026 : titre en justifié. */}
            <div className="flex items-start gap-1.5 text-[22px] font-bold leading-tight text-zinc-50">
              {/* Yann 1er sept 2026 : titre jaune pour les stories du lot
                  kpi-sept-2026 (revue META/GOOGL), temporaire. */}
              <span className="min-w-0 text-left">{kpi.name_fr}</span>
              {kpi.explanation && (
                <InfoTooltip color={accent} size="sm">
                  <div className="mb-1 font-mono text-[10px] uppercase tracking-wider" style={{ color: accent }}>
                    {kpi.short}
                  </div>
                  <div className="text-zinc-200">
                    {kpi.explanation}
                  </div>
                </InfoTooltip>
              )}
            </div>
            {/* Yann 21 mai 2026 : période d'analyse JUSTE SOUS le titre du
                KPI (et non plus sous le chip CAGR/YoY). Format "En 2025" /
                "Fiscal year 2025" selon calendrier fiscal. */}
            {periodLabel && (
              <div className="mt-1 text-[12.5px] font-medium text-zinc-400">
                {periodLabel}
              </div>
            )}
          </div>
          {/* Yann 17 juil 2026 : badge catégorie déplacé au-dessus de la
              barre de temps (rendu dans StoryFrame), retiré du header. */}
        </div>

        {/* Chiffre principal : occupe le centre, beaucoup plus grand qu'avant
            (Yann 7 mai 2026 : "informations essentielles trop petites"). */}
        <div
          className="my-auto flex w-full flex-col items-center px-4 text-center"
          // Yann 4 sept 2026 : c est CE bloc qui sert de reference aux unites
          // `cqw` du chiffre. Le poser sur le chiffre lui-meme ne servait a
          // rien : un element ne peut pas se mesurer par rapport a soi, la
          // taille retombait alors sur la valeur minimale et "600 000" restait
          // coupe.
          style={{ containerType: "inline-size" }}
        >
          {/* Mini graph pour séries multi-données (story <3 ans avec >1 point).
              Chargé client-only (recharts SSR-unsafe). */}
          {!freeBlocked && Array.isArray(kpi.history) && kpi.history.length > 1 && typeof kpi.history[0] === "object" && (
            <div className="mb-3 w-full" style={{ height: "110px" }}>
              <RechartLineChart data={kpi.history as never} accent={accent} />
            </div>
          )}

          {/* Spec floutage 29 aout 2026 : le chiffre central reste visible
              meme au palier gratuit (avant : BlurredFreeValue le masquait).
              Seuls titre et texte sont floutes, via les zones nommees. */}
          {(
            <>
              {/* Règle desk_block_rules.stories_kpi (Yann 31 mai 2026) :
                  les chiffres ne doivent pas dépasser de l'écran sur la
                  gauche et la droite → auto-shrink + overflow-hidden +
                  wordBreak pour matcher la branche freeBlocked au-dessus. */}
              <div className="w-full max-w-full px-1">
                <ValeurSvg texte={espacesLarges(storyFmt(kpi.value, kpi.unit).value)} />
              </div>
              {storyFmt(kpi.value, kpi.unit).unit && (
                /* Yann 30 aout 2026 : une unite longue ("bouteilles/canettes")
                   coupait un mot en deux. On reduit la police selon la
                   longueur et on ne casse plus qu aux espaces ou au slash. */
                <div
                  className={`mt-2 max-w-full overflow-hidden font-bold text-zinc-100 ${
                    storyFmt(kpi.value, kpi.unit).unit.length > 14 ? "text-[22px]" : "text-[32px]"
                  }`}
                  style={{ wordBreak: "normal", overflowWrap: "normal" }}
                >
                  {storyFmt(kpi.value, kpi.unit).unit.replace(/\//g, " / ")}
                </div>
              )}
              {!freeBlocked && kpi.yoy && typeof kpi.yoy === "string" && kpi.yoy.toLowerCase() !== "n/a" && (
                <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-3.5 py-1.5 text-[16px] font-bold text-emerald-200">
                  <TrendingUp className="size-4" />
                  <span className="font-mono tabular-nums">{kpi.yoy.replace(/(\d)\.(\d)/g, "$1,$2").replace(/(\d)%/g, "$1\u00a0%")}</span>
                  <span className="text-[12px] font-medium italic text-zinc-400" title="Year-on-Year">{t("story.vs_n1")}</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Signal en bas (clé du business). Plus compact, taille augmentée
            quand même. La description longue est cachée derrière "i" pour
            ne pas écraser visuellement le chiffre principal.
            Yann 9 juin 2026 (BUG B) : relative z-30 pour que le "i" en bas
            passe AU-DESSUS des tap-zones du carrousel (z-10, w-20 sur les
            bords gauche/droit) qui sinon captaient le clic sur l'icone et
            faisaient defiler la story au lieu d'ouvrir le tooltip. */}
        {kpi.signal && (
          <div data-blur-part="texte" className="relative z-30 rounded-xl border border-white/10 bg-black/55 p-3 backdrop-blur">
            <div className="flex items-start gap-1.5">
              <div className="flex-1 text-[15px] font-semibold leading-snug text-zinc-50">
                {normalizeNarrative(kpi.signal)}
              </div>
              {kpi.description && (
                <InfoTooltip color={accent} size="sm" align="right">
                  <div className="mb-1 font-mono text-[10px] uppercase tracking-wider" style={{ color: accent }}>
                    {t("story.detail")}
                  </div>
                  <div className="text-[12.5px] leading-relaxed text-zinc-200">
                    {normalizeNarrative(kpi.description)}
                  </div>
                </InfoTooltip>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* -------- MarketPosition story card -------- */

/** Compte le nombre de mots utiles d'une chaîne (split sur espaces / · / +). */
function wordCount(s: string | null | undefined): number {
  if (!s) return 0;
  return s
    .split(/[\s·+,]+/)
    .map((w) => w.trim())
    .filter(Boolean).length;
}

function MarketPositionStoryCard({
  mp,
  accent,
  glow,
  ticker,
  freeBlocked = false,
}: {
  mp: MarketPosition;
  accent: string;
  glow: string;
  ticker: string;
  freeBlocked?: boolean;
}) {
  const { t } = useT();
  // Yann 8 mai 2026 : si TAM=null (honesty rule, sté n'a pas publié),
  // segment_revenue/null = NaN/Infinity. On affiche un placeholder propre
  // au lieu d'un chiffre absurde (ex : "Infinity %" sur Apple Services).
  const tamUsable = typeof mp.tam === "number" && Number.isFinite(mp.tam) && mp.tam > 0;
  const sharePct = tamUsable ? (mp.segment_revenue / (mp.tam as number)) * 100 : null;
  // Source >4 mots = trop long pour l'écran story → on cache derrière un "i".
  // Sinon affichage direct en bas (cas court type "Rapport interne 2024").
  const sourceFull = `${mp.source}${mp.source_note ? " · " + mp.source_note : ""}`;
  const sourceIsLong = wordCount(sourceFull) > 4;
  // Meme blindage que la carte KPI : le gros chiffre ne doit jamais sortir de
  // la carte, quelle que soit la police ou la largeur d ecran.
  const refPart = useAjusteLargeur(String(sharePct ?? ""));
  const refSegment = useAjusteLargeur(String(mp.segment_revenue ?? ""));

  return (
    <div
      className="relative flex h-full flex-col overflow-hidden rounded-[36px] bg-gradient-to-br from-[#101015] via-[#0a0a0e] to-[#060608] px-5 pb-5 pt-12"
      style={{ boxShadow: `inset 0 0 120px ${glow}` }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-20 -right-16 size-64 rounded-full blur-3xl"
        style={{ background: `${accent}55` }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-20 -left-16 size-64 rounded-full blur-3xl"
        style={{ background: `${accent}33` }}
      />

      <div className="relative flex h-full flex-col">
        {/* Yann 17 juil 2026 : titre justifié, badge catégorie déplacé
            au-dessus de la barre de temps (rendu dans StoryFrame). */}
        <div data-blur-part="titre" className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1 text-left text-[22px] font-bold leading-tight text-zinc-50">
            {mp.segment_name}
          </div>
        </div>

        {/* Part de marché : domine l'écran. Si TAM null (honesty rule),
            on affiche le revenu du segment à la place + une note "TAM non
            publié par la société" pour rester transparent. */}
        <div className="my-auto flex flex-col items-center text-center">
          {sharePct !== null ? (
            <>
              <div
                ref={refPart}
                className="w-full max-w-full font-display font-bold leading-none tracking-tight gradient-text"
                style={{ fontSize: "clamp(72px, 25vw, 120px)", whiteSpace: "nowrap" }}
              >
                <span className="inline-block">{sharePct.toFixed(1).replace(".", ",")}&nbsp;%</span>
              </div>
              <div className="mt-2 text-[18px] font-semibold text-zinc-100">{t("story.market_share")}</div>
            </>
          ) : (
            <>
              <div
                ref={refSegment}
                className="w-full max-w-full font-display font-bold leading-none tracking-tight gradient-text"
                style={{ fontSize: "clamp(56px, 18vw, 88px)", whiteSpace: "nowrap" }}
              >
                <span className="inline-block">
                  {mp.segment_revenue} <span className="text-[0.5em] font-medium text-zinc-300">{formatUnit(mp.segment_unit)}</span>
                </span>
              </div>
              <div className="mt-2 text-[16px] font-semibold text-zinc-100">{t("story.segment_revenue_label")}</div>
              <div className="mt-2 text-[12px] italic text-zinc-400">
                {t("story.tam_not_disclosed")}
              </div>
            </>
          )}
        </div>

        {/* Mini-blocs Revenu segment / TAM : valeurs agrandies, libellés mieux
            mis en valeur. TAM porte un tooltip "i" parce que beaucoup
            d'investisseurs novices ne connaissent pas l'acronyme. */}
        <div data-blur-part="texte">
        <div className="grid grid-cols-2 gap-2.5">
          <div className="rounded-xl border border-white/12 bg-black/45 p-3 backdrop-blur">
            <div className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.12em] text-zinc-300">
              {t("story.segment_revenue")}
            </div>
            <div className="mt-1.5 font-display text-[20px] font-bold leading-none tabular-nums text-zinc-50">
              {mp.segment_revenue}
              <span className="ml-1 text-[12px] font-medium text-zinc-300">
                {formatUnit(mp.segment_unit)}
              </span>
            </div>
          </div>
          <div className="rounded-xl border border-white/12 bg-black/45 p-3 backdrop-blur">
            <div className="flex items-center gap-1">
              <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.12em] text-zinc-300">
                TAM
              </span>
              <InfoTooltip color={accent} size="sm">
                <div className="mb-1 font-mono text-[10px] uppercase tracking-wider" style={{ color: accent }}>
                  TAM
                </div>
                <div className="text-zinc-200">
                  <span className="font-semibold">Total Addressable Market</span> : taille
                  totale du marché que la société peut viser au maximum, en chiffre
                  d&apos;affaires annuel. C&apos;est le « plafond » théorique. La part de
                  marché ci-dessus = revenu actuel de la société dans ce segment ÷ TAM.
                </div>
              </InfoTooltip>
            </div>
            <div className="mt-1.5 font-display text-[20px] font-bold leading-none tabular-nums text-zinc-50">
              {tamUsable ? (
                <>
                  {mp.tam}
                  <span className="ml-1 text-[12px] font-medium text-zinc-300">
                    {formatUnit(mp.tam_unit)}
                  </span>
                </>
              ) : (
                <span className="text-[14px] font-medium italic text-zinc-400">
                  {t("story.not_published")}
                </span>
              )}
            </div>
          </div>
        </div>

        {mp.market_cagr != null && (
          <div className="relative z-30 mt-2.5 inline-flex items-center gap-1 text-[12px] text-zinc-300">
            <span>{t("story.expected_market_cagr")} :</span>
            <span className="font-mono font-bold text-zinc-50">
              +{mp.market_cagr.toFixed(1).replace(".", ",")} %{t("story.per_year")}
            </span>
            <InfoTooltip color={accent} size="sm">
              <div className="mb-1 font-mono text-[10px] uppercase tracking-wider" style={{ color: accent }}>
                CAGR
              </div>
              <div className="text-zinc-200">
                <span className="font-semibold">Compound Annual Growth Rate</span> : taux
                de croissance annuel moyen, calculé comme si la croissance était
                régulière chaque année. Permet de comparer la dynamique d&apos;un
                marché ou d&apos;un revenu sur plusieurs années.
              </div>
            </InfoTooltip>
          </div>
        )}

        {/* Source : si <=4 mots, affichée inline. Sinon mise dans tooltip "i"
            (règle template Yann 6 mai 2026 : aucune source externe longue ne
            doit polluer l'écran principal).
            Yann 9 juin 2026 (BUG B) : relative z-30 pour que le "i" source en
            bas passe au-dessus des tap-zones du carrousel (z-10). */}
        <div className="relative z-30 mt-auto pt-3">
          {sourceIsLong ? (
            <div className="inline-flex items-center gap-1 text-[10.5px] italic text-zinc-400">
              <span>{t("story.source")}</span>
              <InfoTooltip color={accent} size="sm">
                <div className="mb-1 font-mono text-[10px] uppercase tracking-wider" style={{ color: accent }}>
                  {t("story.source")}
                </div>
                <div className="not-italic text-zinc-200">{mp.source}</div>
                {mp.source_note && (
                  <div className="mt-1.5 border-t border-white/10 pt-1.5 text-[11.5px] leading-relaxed text-zinc-300">
                    {mp.source_note}
                  </div>
                )}
              </InfoTooltip>
            </div>
          ) : (
            <div className="text-[10.5px] italic leading-snug text-zinc-400">
              {t("story.source")} : {mp.source}
              {mp.source_note && <> · {mp.source_note}</>}
            </div>
          )}
        </div>
        </div>
      </div>
    </div>
  );
}
