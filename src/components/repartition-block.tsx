"use client";

import { useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Globe2, LayoutGrid, ChevronLeft, ChevronRight } from "lucide-react";
import type { Company, RevenueBreakdown } from "@/lib/data";
import { brand } from "@/lib/brand";
import { RepartitionTreemap, RepartitionRadial } from "@/components/charts/repartition-variants";
import { RepartitionIsoDetachedWedges } from "@/components/charts/repartition-3d-variants";
import { useT } from "@/lib/i18n/provider";
import type { Locale } from "@/lib/i18n/types";

/**
 * RepartitionBlock — vue répartition CA par dimension (géographique
 * ou segment opérationnel). 3 styles de visualisation cyclables au
 * clic ou via scroll/swipe latéral : R3 Treemap, R4 Radial, R9 ISO 3D.
 *
 * Position : entre Risks et Governance dans la page société.
 */
type Style = "treemap" | "radial" | "iso";
const STYLES: Style[] = ["treemap", "radial", "iso"];

type Tab = "geo" | "segment";

function adaptForLocale(b: RevenueBreakdown | undefined | null, locale: Locale) {
  if (!b) return undefined;
  // Garde-fou : certaines stés ont `revenue_by_*` présent mais avec
  // `slices: null` (data partiellement extraite). On retourne undefined
  // pour que hasGeo/hasSegment soit false et que le bloc se masque.
  if (!Array.isArray(b.slices)) return undefined;
  return {
    ...b,
    slices: b.slices.map((s) => ({
      ...s,
      label: locale === "en" && s.label_en ? s.label_en : s.label,
    })),
  };
}

export function RepartitionBlock({ company }: { company: Company }) {
  const { t, locale } = useT();
  const accent = brand(company.ticker).primary;

  const geo = adaptForLocale(company.revenue_by_geography, locale);
  const segment = adaptForLocale(company.revenue_by_segment, locale);

  const hasGeo = !!(geo && geo.slices.length > 0);
  const hasSegment = !!(segment && segment.slices.length > 0);
  if (!hasGeo && !hasSegment) return null;

  const [tab, setTab] = useState<Tab>(hasGeo ? "geo" : "segment");
  const [styleIdx, setStyleIdx] = useState(0);
  const style: Style = STYLES[styleIdx];

  const active = tab === "geo" ? geo : segment;
  // Cohérence des décimales : si toutes les valeurs sont entières, 0 décimale ;
  // sinon 1 décimale partout dans le bloc.
  const decimals = active && active.slices.every((s) => Number.isInteger(s.value)) ? 0 : 1;
  const wheelLock = useRef(false);

  function cycleStyle(dir: 1 | -1) {
    setStyleIdx((i) => (i + dir + STYLES.length) % STYLES.length);
  }

  function onWheel(e: React.WheelEvent) {
    // Glissement horizontal au trackpad ou shift+wheel = changer le style
    const horizontal = Math.abs(e.deltaX) > Math.abs(e.deltaY);
    if (!horizontal) return;
    if (wheelLock.current) return;
    wheelLock.current = true;
    setTimeout(() => (wheelLock.current = false), 350);
    cycleStyle(e.deltaX > 0 ? 1 : -1);
  }

  return (
    <section
      id="sec-repartition"
      className="mt-9 scroll-mt-24 animate-fade-up-d2 rounded-2xl border border-[#1f1f1f] bg-[#0a0a0a]/50 p-5 sm:p-6"
    >
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2.5 text-[22px] font-semibold text-zinc-50">
            <LayoutGrid className="size-5" style={{ color: accent }} />
            {t("repartition.title")}
          </h2>
          <p className="mt-0.5 max-w-2xl text-[13.5px] text-zinc-300">
            {t("repartition.subtitle")}
          </p>
        </div>

        {/* Tabs Géo / Segment */}
        <div role="tablist" className="inline-flex items-center gap-1 rounded-full border border-[#1f1f1f] bg-[#0a0a0a] p-1">
          {hasGeo && (
            <button
              role="tab"
              aria-selected={tab === "geo"}
              onClick={() => setTab("geo")}
              className={`relative inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
                tab === "geo" ? "text-zinc-50" : "text-zinc-400 hover:text-zinc-100"
              }`}
            >
              {tab === "geo" && (
                <motion.span
                  layoutId="repartition-tab-pill"
                  className="absolute inset-0 rounded-full"
                  style={{
                    background: `linear-gradient(135deg, ${accent}30, ${accent}18)`,
                    border: `1px solid ${accent}55`,
                  }}
                  transition={{ type: "spring", stiffness: 400, damping: 32 }}
                />
              )}
              <Globe2 className="relative size-3.5" />
              <span className="relative">{t("repartition.tab.geo")}</span>
            </button>
          )}
          {hasSegment && (
            <button
              role="tab"
              aria-selected={tab === "segment"}
              onClick={() => setTab("segment")}
              className={`relative inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
                tab === "segment" ? "text-zinc-50" : "text-zinc-400 hover:text-zinc-100"
              }`}
            >
              {tab === "segment" && (
                <motion.span
                  layoutId="repartition-tab-pill"
                  className="absolute inset-0 rounded-full"
                  style={{
                    background: `linear-gradient(135deg, ${accent}30, ${accent}18)`,
                    border: `1px solid ${accent}55`,
                  }}
                  transition={{ type: "spring", stiffness: 400, damping: 32 }}
                />
              )}
              <LayoutGrid className="relative size-3.5" />
              <span className="relative">{t("repartition.tab.segment")}</span>
            </button>
          )}
        </div>
      </div>

      {/* Chart area + flèches latérales. Chaque style rend à sa taille
          naturelle (chart + légende), comme dans /chart-lab. La hauteur
          du bloc s'adapte au chart courant. */}
      <div className="relative" onWheel={onWheel}>
        <button
          onClick={() => cycleStyle(-1)}
          aria-label={`${t("repartition.style." + STYLES[(styleIdx - 1 + STYLES.length) % STYLES.length])}`}
          className="absolute left-1 top-1/2 z-10 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-full border bg-black/70 text-zinc-100 backdrop-blur-md transition-all hover:scale-110"
          style={{ borderColor: `${accent}66`, boxShadow: `0 0 14px ${accent}33` }}
        >
          <ChevronLeft className="size-5" />
        </button>

        <AnimatePresence mode="wait">
          <motion.div
            key={`${tab}-${style}`}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="flex h-[560px] flex-col overflow-hidden rounded-xl border border-[#1a1a1a] bg-[#070707] p-4 sm:p-5"
          >
            {!active || active.slices.length === 0 ? (
              <div className="flex flex-1 items-center justify-center text-[13px] text-zinc-400">
                {t("repartition.no_data")}
              </div>
            ) : style === "treemap" ? (
              <RepartitionTreemap data={active.slices} unit={active.unit} total={active.total} accent={accent} decimals={decimals} />
            ) : style === "radial" ? (
              <RepartitionRadial data={active.slices} unit={active.unit} total={active.total} accent={accent} decimals={decimals} />
            ) : (
              <RepartitionIsoDetachedWedges data={active.slices} unit={active.unit} total={active.total} accent={accent} decimals={decimals} />
            )}
          </motion.div>
        </AnimatePresence>

        <button
          onClick={() => cycleStyle(1)}
          aria-label={`${t("repartition.style." + STYLES[(styleIdx + 1) % STYLES.length])}`}
          className="absolute right-1 top-1/2 z-10 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-full border bg-black/70 text-zinc-100 backdrop-blur-md transition-all hover:scale-110"
          style={{ borderColor: `${accent}66`, boxShadow: `0 0 14px ${accent}33` }}
        >
          <ChevronRight className="size-5" />
        </button>
      </div>

      {/* Style dots dock */}
      <div className="mt-3 flex items-center justify-center gap-2">
        {STYLES.map((s, i) => (
          <button
            key={s}
            onClick={() => setStyleIdx(i)}
            aria-label={t(`repartition.style.${s}`)}
            className={`flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-wider transition-colors ${
              i === styleIdx ? "text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <span
              className={`size-1.5 rounded-full transition-all ${
                i === styleIdx ? "" : "bg-zinc-600"
              }`}
              style={i === styleIdx ? { background: accent, boxShadow: `0 0 6px ${accent}` } : undefined}
            />
            {t(`repartition.style.${s}`)}
          </button>
        ))}
      </div>
    </section>
  );
}
