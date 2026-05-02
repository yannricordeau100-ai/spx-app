"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import type { Company } from "@/lib/data";
import { brand } from "@/lib/brand";
import { buildStories, hasStories } from "@/lib/kpi-stories-ordering";
import { KpiStoryCard } from "@/components/kpi-story-card";
import { useT } from "@/lib/i18n/provider";

/**
 * Bloc Stories — KPIs short-history + MarketPositions présentés en
 * carrousel auto-play 5s par carte, avec :
 *  - Flèches gauche/droite cliquables
 *  - Timeline en haut (segments lumineux qui se remplissent)
 *  - Boucle infinie (après dernière → première, sans blocage, 2 sens)
 *  - Pause de l'auto-play au hover
 *
 * Position dans la page : sous le bloc "Indicateurs clés", au-dessus de
 * Position marché (qu'on a supprimé sous sa forme actuelle, intégré ici).
 */
export function KpiStories({ company }: { company: Company }) {
  const { t } = useT();
  const accent = brand(company.ticker).primary;

  // Build stories : aplatir toutes les slides de toutes les categories
  const categories = buildStories(company.kpis, company.market_positions);
  const slides = categories.flatMap((c) => c.slides);

  // Hooks
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const total = slides.length;

  // Auto-play 5s
  useEffect(() => {
    if (paused || hovered || total <= 1) return;
    timerRef.current = setTimeout(() => {
      setActive((prev) => (prev + 1) % total);
    }, 5000);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [active, paused, hovered, total]);

  if (!hasStories(company.kpis, company.market_positions) || total === 0) {
    return null;
  }

  const goPrev = () => setActive((prev) => (prev - 1 + total) % total);
  const goNext = () => setActive((prev) => (prev + 1) % total);

  // Pour montrer la catégorie en cours, retrouver dans quelle catégorie on est
  let counted = 0;
  let currentCategory = "";
  for (const c of categories) {
    if (active < counted + c.slides.length) {
      currentCategory = c.label;
      break;
    }
    counted += c.slides.length;
  }

  return (
    <section
      id="sec-stories"
      className="mt-9 scroll-mt-24 animate-fade-up-d2"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="mb-5 flex items-end justify-between">
        <div>
          <h2 className="text-[22px] font-semibold text-zinc-50">{t("stories.title")}</h2>
          <p className="mt-0.5 max-w-2xl text-[13.5px] text-zinc-300">
            {t("stories.subtitle")}
          </p>
        </div>
        <span className="font-mono text-[11px] uppercase tracking-wider text-zinc-400">
          {active + 1} / {total} {currentCategory && <>· {t(`stories.cat.${currentCategory}`)}</>}
        </span>
      </div>

      {/* "Phone frame" centré : aspect 9/16 portrait, max 400px de large.
          Les controls (pause/arrows) sont autour, pas dans la frame, pour
          que la story ressemble vraiment à un écran de mobile. */}
      <div className="relative mx-auto" style={{ width: "min(400px, 100%)" }}>
        {/* Bouton précédent — extérieur gauche */}
        {total > 1 && (
          <button
            onClick={goPrev}
            className="absolute -left-14 top-1/2 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/60 text-zinc-200 backdrop-blur-md transition-all hover:scale-110 hover:border-white/30 hover:text-white sm:inline-flex"
            aria-label={t("stories.aria_prev")}
          >
            <ChevronLeft className="size-5" />
          </button>
        )}

        {/* La frame mobile elle-même */}
        <div
          className="relative overflow-hidden rounded-[36px] border border-white/10 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)]"
          style={{
            aspectRatio: "9 / 16",
            background: "#000",
            boxShadow: `0 0 0 8px #0a0a0a, 0 0 0 9px #1f1f1f, 0 30px 80px -20px ${accent}55`,
          }}
        >
          {/* Notch décorative en haut (vraie ambiance smartphone) */}
          <div
            aria-hidden
            className="absolute left-1/2 top-2 z-30 h-5 w-24 -translate-x-1/2 rounded-full bg-black"
          />

          {/* Timeline segments collée tout en haut INSIDE la frame, sous la notch */}
          <div className="absolute inset-x-3 top-3 z-20 flex gap-1">
            {slides.map((_, i) => (
              <div
                key={i}
                className="relative h-[3px] flex-1 overflow-hidden rounded-full bg-white/15"
              >
                <div
                  className="absolute inset-y-0 left-0"
                  style={{
                    width:
                      i < active
                        ? "100%"
                        : i === active
                        ? paused || hovered
                          ? "50%"
                          : "100%"
                        : "0%",
                    background: "#fff",
                    transition: i === active && !paused && !hovered
                      ? "width 5s linear"
                      : "width 200ms",
                  }}
                />
              </div>
            ))}
          </div>

          {/* Pause/Play toggle (top-right inside) */}
          <button
            onClick={() => setPaused((p) => !p)}
            className="absolute right-3 top-7 z-30 inline-flex size-7 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur transition-colors hover:bg-black/60"
            aria-label={paused ? t("stories.aria_resume") : t("stories.aria_pause")}
          >
            {paused ? <Play className="size-3" /> : <Pause className="size-3" />}
          </button>

          {/* Story content (fill) */}
          <div className="absolute inset-0">
            <KpiStoryCard slide={slides[active]} ticker={company.ticker} />
          </div>

          {/* Tap-zones invisibles : moitié gauche = prev, moitié droite = next.
              Comme sur Instagram. */}
          {total > 1 && (
            <>
              <button
                onClick={goPrev}
                className="absolute inset-y-0 left-0 z-10 w-1/2"
                aria-label={t("stories.aria_prev")}
              />
              <button
                onClick={goNext}
                className="absolute inset-y-0 right-0 z-10 w-1/2"
                aria-label={t("stories.aria_next")}
              />
            </>
          )}
        </div>

        {/* Bouton suivant — extérieur droit */}
        {total > 1 && (
          <button
            onClick={goNext}
            className="absolute -right-14 top-1/2 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/60 text-zinc-200 backdrop-blur-md transition-all hover:scale-110 hover:border-white/30 hover:text-white sm:inline-flex"
            aria-label={t("stories.aria_next")}
          >
            <ChevronRight className="size-5" />
          </button>
        )}
      </div>

      {/* Dots dock sous la frame (cliquable pour sauter) */}
      <div className="mt-5 flex justify-center gap-1.5">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => setActive(i)}
            className={`h-1.5 rounded-full transition-all ${
              i === active ? "w-6" : "w-1.5 bg-zinc-600 hover:bg-zinc-400"
            }`}
            style={i === active ? { background: accent, boxShadow: `0 0 6px ${accent}` } : undefined}
            aria-label={`${t("stories.aria_jump")} ${i + 1}`}
          />
        ))}
      </div>
    </section>
  );
}
