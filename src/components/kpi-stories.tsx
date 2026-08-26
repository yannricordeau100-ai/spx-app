"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import type { Company } from "@/lib/data";
import { brand } from "@/lib/brand";
import { buildStories, hasStories } from "@/lib/kpi-stories-ordering";
import { KpiStoryCard } from "@/components/kpi-story-card";
import { useT } from "@/lib/i18n/provider";
import { useSwipeStories } from "@/lib/hooks/use-swipe-stories";
import { storyFamily, orderedFamilies, type StoryFamilyKey } from "@/lib/story-family";
import { isStoriesPilot } from "@/lib/stories-pilot";

/**
 * Bloc Stories — KPIs short-history + MarketPositions présentés en
 * carrousel auto-play 5s, avec :
 *  - 2 ou 3 écrans de stories CÔTE À CÔTE (desktop), 2 (tablette), 1 (mobile)
 *  - Flèches gauche/droite cliquables (font défiler le GROUPE entier)
 *  - Barre de progression en haut de chaque frame
 *  - Boucle infinie (après dernier groupe → premier, sans blocage, 2 sens)
 *  - Pause de l'auto-play au hover
 *
 * Position dans la page : sous le bloc "Indicateurs clés", au-dessus de
 * Position marché (qu'on a supprimé sous sa forme actuelle, intégré ici).
 *
 * Yann 8 juin 2026 : refonte multi-frames. Avant = 1 seul phone-frame
 * centré. Maintenant = jusqu'à 3 frames côte à côte, chacune une story
 * différente, le carrousel avance le groupe de N frames à la fois.
 */
export function KpiStories({ company, freeBlocked = false }: { company: Company; freeBlocked?: boolean }) {
  const { t, locale } = useT();
  const accent = brand(company.ticker).primary;

  // Build stories : aplatir toutes les slides de toutes les categories
  const categories = buildStories(company.kpis, []);
  const allSlides = categories.flatMap((c) => c.slides);

  /* ── Rangement des stories (pilote 10 stés, Yann 26 aout 2026) ──────────
     Certaines fiches cumulent 40 a 70 stories : sans tri, la decomposition
     du chiffre d affaires noie les faits marquants. Trois leviers :
       - onglets par FAMILLE (usage, clients, capacite, revenus, ...)
       - tri par FRAICHEUR, du plus recent ou du plus ancien
       - mode VEDETTE : une seule story par famille, la plus recente
     Hors pilote, le carrousel historique est inchange.                      */
  const pilot = isStoriesPilot(company.ticker);
  const [family, setFamily] = useState<StoryFamilyKey | "toutes">("toutes");
  const [order, setOrder] = useState<"recent" | "ancien">("recent");
  const [starOnly, setStarOnly] = useState(false);

  const slideDate = (sl: (typeof allSlides)[number]): number => {
    if (sl.kind !== "kpi") return 0;
    const d = (sl.data as { last_data_date?: string | null }).last_data_date;
    const ts = d ? Date.parse(String(d)) : NaN;
    return Number.isFinite(ts) ? ts : 0;
  };
  const slideFamily = (sl: (typeof allSlides)[number]): StoryFamilyKey =>
    sl.kind === "kpi" ? storyFamily(sl.data) : "marche";

  const familyKeys = new Set<StoryFamilyKey>(allSlides.map(slideFamily));
  const familyTabs = orderedFamilies(familyKeys);
  const familyCount = (k: StoryFamilyKey) =>
    allSlides.filter((sl) => slideFamily(sl) === k).length;

  const slides = (() => {
    if (!pilot) return allSlides;
    let list = [...allSlides];
    if (family !== "toutes") list = list.filter((sl) => slideFamily(sl) === family);
    list.sort((a, b) => (order === "recent" ? slideDate(b) - slideDate(a) : slideDate(a) - slideDate(b)));
    if (starOnly) {
      // Une vedette par famille : la premiere de chaque famille dans l ordre
      // de tri courant, les familles rangees comme les onglets.
      const seen = new Set<StoryFamilyKey>();
      const picked: typeof list = [];
      for (const sl of list) {
        const f = slideFamily(sl);
        if (seen.has(f)) continue;
        seen.add(f);
        picked.push(sl);
      }
      list = picked;
    }
    return list;
  })();

  // Hooks
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  // Nombre de frames visibles simultanément (responsive).
  // 1 mobile (<768px), 2 tablette (768-1023px), 3 desktop (>=1024px).
  const [slots, setSlots] = useState(1);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const total = slides.length;

  // Détection responsive du nombre de slots via matchMedia. Pas de SSR
  // mismatch : on démarre à 1 (mobile-first) puis on ajuste côté client.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mqMd = window.matchMedia("(min-width: 768px)");
    const mqLg = window.matchMedia("(min-width: 1024px)");
    const update = () => {
      if (mqLg.matches) setSlots(3);
      else if (mqMd.matches) setSlots(2);
      else setSlots(1);
    };
    update();
    mqMd.addEventListener("change", update);
    mqLg.addEventListener("change", update);
    return () => {
      mqMd.removeEventListener("change", update);
      mqLg.removeEventListener("change", update);
    };
  }, []);

  // Combien de frames on affiche réellement : min(slots, total). Si on a
  // moins de stories que de slots, on n'affiche que ce qu'on a (centré).
  const visible = Math.min(slots, total);

  // Avance / recule du GROUPE entier (N frames à la fois). On garde une
  // rotation continue modulo total : `active` = index de la 1re frame du
  // groupe. Wrap propre dans les 2 sens.
  const step = Math.max(1, visible);
  const goPrev = () => setActive((prev) => (((prev - step) % total) + total) % total);
  const goNext = () => setActive((prev) => (prev + step) % total);

  // Auto-play 10s : fait défiler le groupe. Désactivé si tout tient sur un
  // seul écran (visible >= total) ou si pause / hover.
  useEffect(() => {
    if (paused || hovered || total <= visible) return;
    timerRef.current = setTimeout(() => {
      setActive((prev) => (prev + step) % total);
    }, 10000);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [active, paused, hovered, total, visible, step]);

  // Si le nombre de slots change (resize) et que `active` dépasse, on
  // reclampe pour ne jamais pointer hors borne.
  useEffect(() => {
    if (active >= total) setActive(0);
  }, [active, total]);

  // Swipe drag souris/doigt : prev/next sur le groupe entier.
  const swipeRef = useRef<HTMLDivElement>(null);
  useSwipeStories(swipeRef, { onPrev: goPrev, onNext: goNext });

  if (!hasStories(company.kpis, []) || total === 0) {
    return null;
  }

  // Les `visible` slides à afficher, à partir de `active`, en boucle.
  const shown = Array.from({ length: visible }, (_, i) => (active + i) % total);

  // Catégorie de la 1re frame visible (pour le compteur en haut à droite).
  let counted = 0;
  let currentCategory = "";
  for (const c of categories) {
    if (active < counted + c.slides.length) {
      currentCategory = c.label;
      break;
    }
    counted += c.slides.length;
  }

  // Nombre de "pages" (groupes) pour les dots du bas. Chaque dot = un groupe
  // de `step` frames.
  const pageCount = Math.max(1, Math.ceil(total / step));
  const currentPage = Math.floor(active / step);

  // Largeur d'une frame : on partage l'espace entre les frames visibles, avec
  // un plafond pour ne pas avoir des téléphones géants quand visible=1.
  const frameMaxWidth = visible <= 1 ? 400 : 360;

  return (
    <section
      id="sec-stories"
      className="mt-9 scroll-mt-24 animate-fade-up-d2"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[22px] font-semibold text-zinc-50">{t("stories.title")}</h2>
        </div>
        <span className="font-mono text-[11px] uppercase tracking-wider text-zinc-400">
          {Math.min(active + visible, total)} / {total}
          {/* Catégorie hors dictionnaire : t() renverrait la clé brute
              ("stories.cat.X") ; on affiche la catégorie telle quelle. */}
          {currentCategory && (() => {
            const label = t(`stories.cat.${currentCategory}`);
            return <> · {label.startsWith("stories.cat.") ? currentCategory : label}</>;
          })()}
        </span>
      </div>

      {/* Barre de rangement (pilote) : familles, fraicheur, vedettes. */}
      {pilot && (
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap items-center gap-1 rounded-full border border-[#1f1f1f] bg-[#0a0a0a] p-1">
            <button
              type="button"
              onClick={() => { setFamily("toutes"); setActive(0); }}
              className={`rounded-full px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
                family === "toutes" ? "bg-white/[0.08] text-zinc-50" : "text-zinc-400 hover:text-zinc-100"
              }`}
            >
              {locale.startsWith("fr") ? "Toutes" : "All"}
              <span className="ml-1.5 font-mono text-[10.5px] text-zinc-500">{allSlides.length}</span>
            </button>
            {familyTabs.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => { setFamily(f.key); setActive(0); }}
                className={`rounded-full px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
                  family === f.key ? "bg-white/[0.08] text-zinc-50" : "text-zinc-400 hover:text-zinc-100"
                }`}
              >
                {locale.startsWith("fr") ? f.label_fr : f.label_en}
                <span className="ml-1.5 font-mono text-[10.5px] text-zinc-500">{familyCount(f.key)}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 rounded-full border border-[#1f1f1f] bg-[#0a0a0a] p-1">
            <button
              type="button"
              onClick={() => { setOrder("recent"); setActive(0); }}
              className={`rounded-full px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
                order === "recent" ? "bg-white/[0.08] text-zinc-50" : "text-zinc-400 hover:text-zinc-100"
              }`}
            >
              {locale.startsWith("fr") ? "Plus récentes" : "Newest first"}
            </button>
            <button
              type="button"
              onClick={() => { setOrder("ancien"); setActive(0); }}
              className={`rounded-full px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
                order === "ancien" ? "bg-white/[0.08] text-zinc-50" : "text-zinc-400 hover:text-zinc-100"
              }`}
            >
              {locale.startsWith("fr") ? "Plus anciennes" : "Oldest first"}
            </button>
          </div>

          <button
            type="button"
            onClick={() => { setStarOnly((v) => !v); setActive(0); }}
            className={`rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
              starOnly
                ? "border-violet-400/50 bg-violet-500/15 text-violet-100"
                : "border-[#1f1f1f] bg-[#0a0a0a] text-zinc-400 hover:text-zinc-100"
            }`}
            title={
              locale.startsWith("fr")
                ? "N'affiche que la story la plus marquante de chaque famille"
                : "Show only the leading story of each family"
            }
          >
            {locale.startsWith("fr") ? "Une vedette par famille" : "One highlight per family"}
          </button>
        </div>
      )}

      {/* Rangée de frames + flèches latérales. La rangée est centrée pour
          gérer proprement le cas "moins de frames que de slots". */}
      <div className="relative" ref={swipeRef}>
        {/* Bouton précédent — extérieur gauche (visible dès qu'il y a plus
            de stories que de slots affichés). */}
        {total > visible && (
          <button
            onClick={goPrev}
            className="absolute -left-3 top-1/2 z-20 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/60 text-zinc-200 backdrop-blur-md transition-all hover:scale-110 hover:border-white/30 hover:text-white lg:-left-14 sm:inline-flex"
            aria-label={t("stories.aria_prev")}
          >
            <ChevronLeft className="size-5" />
          </button>
        )}

        <div className="flex items-stretch justify-center gap-4 sm:gap-5">
          {shown.map((slideIdx, slot) => (
            <StoryFrame
              key={`${active}-${slot}`}
              slideIdx={slideIdx}
              slot={slot}
              company={company}
              accent={accent}
              freeBlocked={freeBlocked}
              paused={paused}
              hovered={hovered}
              autoplay={total > visible}
              maxWidth={frameMaxWidth}
              onTogglePause={() => setPaused((p) => !p)}
              onPrev={goPrev}
              onNext={goNext}
              showTapZones={total > visible}
              pauseLabel={paused ? t("stories.aria_resume") : t("stories.aria_pause")}
              prevLabel={t("stories.aria_prev")}
              nextLabel={t("stories.aria_next")}
            />
          ))}
        </div>

        {/* Bouton suivant : extérieur droit */}
        {total > visible && (
          <button
            onClick={goNext}
            className="absolute -right-3 top-1/2 z-20 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/60 text-zinc-200 backdrop-blur-md transition-all hover:scale-110 hover:border-white/30 hover:text-white lg:-right-14 sm:inline-flex"
            aria-label={t("stories.aria_next")}
          >
            <ChevronRight className="size-5" />
          </button>
        )}
      </div>

      {/* Dots dock sous les frames : 1 dot par GROUPE (cliquable pour sauter
          au groupe). */}
      {pageCount > 1 && (
        <div className="mt-5 flex justify-center gap-1.5">
          {Array.from({ length: pageCount }, (_, p) => (
            <button
              key={p}
              onClick={() => setActive((p * step) % total)}
              className={`h-1.5 rounded-full transition-all ${
                p === currentPage ? "w-6" : "w-1.5 bg-zinc-600 hover:bg-zinc-400"
              }`}
              style={p === currentPage ? { background: accent, boxShadow: `0 0 6px ${accent}` } : undefined}
              aria-label={`${t("stories.aria_jump")} ${p + 1}`}
            />
          ))}
        </div>
      )}
    </section>
  );
}

/**
 * Une frame "smartphone" 9:16 affichant UNE story.
 *
 * Yann 5 juin 2026 : background transparent pour éviter le coin noir.
 * Yann 8 juin 2026 (v2) : régression Safari sur coins haut-droit et
 * bas-gauche (angle 90° visible) malgré boxShadow→border.
 * FIX FINAL : wrapper double + clipPath natif. PRÉSERVÉ SUR CHAQUE FRAME
 * (sinon l'angle 90° revient sur les frames côte à côte).
 *   (1) OUTER div : border (ring smartphone) + drop-shadow accent +
 *       border-radius + transform GPU layer. PAS d'overflow.
 *   (2) INNER div : overflow-hidden + clipPath inset(0 round 36px) avec
 *       -webkit-clip-path (Safari respecte clipPath là où il bug sur
 *       overflow+border-radius). Force le clip rigoureux des 4 coins.
 *   (3) isolation: isolate + translateZ(0) sur OUTER = compositing layer
 *       GPU dédié = clipping pixel-perfect.
 */
function StoryFrame({
  slideIdx,
  slot,
  company,
  accent,
  freeBlocked,
  paused,
  hovered,
  autoplay,
  maxWidth,
  onTogglePause,
  onPrev,
  onNext,
  showTapZones,
  pauseLabel,
  prevLabel,
  nextLabel,
}: {
  slideIdx: number;
  slot: number;
  company: Company;
  accent: string;
  freeBlocked: boolean;
  paused: boolean;
  hovered: boolean;
  autoplay: boolean;
  maxWidth: number;
  onTogglePause: () => void;
  onPrev: () => void;
  onNext: () => void;
  showTapZones: boolean;
  pauseLabel: string;
  prevLabel: string;
  nextLabel: string;
}) {
  const categories = buildStories(company.kpis, []);
  const slides = categories.flatMap((c) => c.slides);
  const slide = slides[slideIdx];
  if (!slide) return null;

  return (
    <div className="relative w-full" style={{ maxWidth }}>
      <div
        className="relative rounded-[36px] border-[1px] border-[#1f1f1f]"
        style={{
          aspectRatio: "9 / 16",
          background: "transparent",
          boxShadow: `0 30px 80px -20px ${accent}55, 0 30px 80px -20px rgba(0,0,0,0.7)`,
          isolation: "isolate",
          transform: "translateZ(0)",
          WebkitTransform: "translateZ(0)",
          willChange: "transform",
        }}
      >
        <div
          className="absolute inset-0 rounded-[36px] overflow-hidden"
          style={{
            clipPath: "inset(0 round 36px)",
            WebkitClipPath: "inset(0 round 36px)",
            transform: "translateZ(0)",
            WebkitTransform: "translateZ(0)",
          }}
        >
          {/* Notch décorative en haut (vraie ambiance smartphone) */}
          <div
            aria-hidden
            className="absolute left-1/2 top-1.5 z-30 h-5 w-24 -translate-x-1/2 rounded-full bg-black"
          />

          {/* Barre de progression : anime 0% → 100% sur 5s linear, restart à
              chaque changement de groupe (key sur slideIdx). Paused au hover.
              Une seule barre par frame (pas de segments multi-slides : chaque
              frame = une story unique). */}
          {/* Yann 17 juil 2026 : nom du thème (catégorie de la story)
              déplacé du coin haut-droit de la carte vers ICI, juste
              au-dessus de la barre de temps. */}
          {(() => {
            // Yann 9 août 2026 : plus de fallback "Story" (doublon avec le
            // compteur "N/M · Story" du header). Sans catégorie → pas de chip.
            const cat = slide.kind === "kpi"
              ? ((slide.data.story_category && slide.data.story_category !== "Story") ? slide.data.story_category : "")
              : "Marché";
            if (!cat) return null;
            return (
              <div
                className="absolute left-3 top-[13px] z-20 inline-flex items-center rounded-full border px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.14em] opacity-80"
                style={{ background: `${accent}14`, color: accent, borderColor: `${accent}33` }}
              >
                {cat}
              </div>
            );
          })()}
          {autoplay && (
            <div className="absolute inset-x-3 top-9 z-20 h-[3px] overflow-hidden rounded-full bg-white/15">
              <div
                key={slideIdx}
                className="absolute inset-y-0 left-0 bg-white"
                style={{
                  width: "0%",
                  animation: "story-progress 5s linear forwards",
                  animationPlayState: paused || hovered ? "paused" : "running",
                }}
              />
            </div>
          )}

          {/* Pause/Play toggle — angle arrondi haut-droit. Un seul contrôle
              pour tout le bloc (toutes les frames partagent le même timer),
              affiché sur la 1re frame uniquement pour éviter la redondance. */}
          {autoplay && slot === 0 && (
            <button
              data-pause-position="corner"
              onClick={onTogglePause}
              className="absolute right-3 top-3 z-30 inline-flex size-7 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur transition-colors hover:bg-black/60"
              aria-label={pauseLabel}
            >
              {paused ? <Play className="size-3" /> : <Pause className="size-3" />}
            </button>
          )}

          {/* Story content (fill) — animation slide horizontale au switch */}
          <div className="absolute inset-0">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={slideIdx}
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                className="absolute inset-0"
              >
                <KpiStoryCard slide={slide} ticker={company.ticker} freeBlocked={freeBlocked} />
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Tap-zones invisibles : 80px sur chaque bord pour ne pas capturer
              les clics sur la zone centrale (tooltips "i" etc.). Font défiler
              le groupe entier. Affichées seulement si carrousel actif. */}
          {showTapZones && (
            <>
              <button
                onClick={onPrev}
                className="absolute inset-y-0 left-0 z-10 w-20"
                aria-label={prevLabel}
              />
              <button
                onClick={onNext}
                className="absolute inset-y-0 right-0 z-10 w-20"
                aria-label={nextLabel}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
