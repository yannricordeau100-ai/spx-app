"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import type { Company } from "@/lib/data";
import { brand } from "@/lib/brand";
import { DividendAristocratCard } from "@/components/dividend-aristocrat-card";
import { DividendCalculatorCard } from "@/components/dividend-calculator-card";
import { DividendSnowballCard } from "@/components/dividend-snowball-card";
import { useSwipeStories } from "@/lib/hooks/use-swipe-stories";
import { useLivePrice } from "@/lib/hooks/use-live-price";
import {
  type Currency,
  CURRENCY_SYMBOL,
  SUPPORTED_CURRENCIES,
  getExchangeRate,
  getTickerCurrency,
  getUserCurrency,
} from "@/lib/currency";
import { CurrencyPicker } from "@/components/currency-picker";

/**
 * Bloc Stories Dividendes — séparé du bloc KPI Stories existant.
 *
 * 3 fenêtres en carrousel auto-play 5s, format identique au bloc KPI Stories
 * (phone frame 9:16, timeline en haut, dots en bas, tap-zones latérales,
 * pause au hover, boucle infinie 2 sens) :
 *  1. Aristocrat Streak (statique : 31 ans, DPS, Cap Return, Payout)
 *  2. Calculateur revenu (interactif : revenu cible → nb actions)
 *  3. Boule de neige composée DRIP (interactif : sliders → courbe)
 *
 * Activé uniquement pour les sociétés versant un dividende ET ayant le data
 * minimum (DPS + Cap Return + Payout). Pour la V1 démo : limité à CAT.
 */
export function DividendStories({ company }: { company: Company }) {
  const accent = brand(company.ticker).primary;
  const glow = brand(company.ticker).glow;

  // Récupération des KPIs dividendes nécessaires.
  const dpsKpi = company.kpis.find((k) => k.short === "DPS");
  const capRetKpi = company.kpis.find((k) => k.short === "Cap Return");
  const payoutKpi = company.kpis.find((k) => k.short === "Payout Ratio");

  // Hooks toujours appelés (pas dans un if), pour respecter les rules React.
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const total = 3;

  useEffect(() => {
    if (paused || hovered) return;
    timerRef.current = setTimeout(() => {
      setActive((prev) => (prev + 1) % total);
    }, 5000);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [active, paused, hovered]);

  // Fallback CAT hard-codé pour les routes V1.7 où le dataset
  // `src/data/v2-pipeline/cat.json` ne contient pas encore les KPIs dividendes
  // (DPS, Cap Return, Payout Ratio). Données figées 2025 (10-K + ER), à
  // remplacer dès que CONV-DATA aura enrichi le dataset pipeline.
  const isCAT = company.ticker === "CAT";
  const dpsAnnual = Number(dpsKpi?.value) || (isCAT ? 5.40 : 0);
  const dpsYoy = dpsKpi?.yoy || (isCAT ? "+7.1%" : "");
  const dpsHistory =
    (dpsKpi?.history as number[]) ||
    (isCAT ? [4.32, 4.5, 4.78, 5.04, 5.4] : []);
  const capReturn = Number(capRetKpi?.value) || (isCAT ? 7.9 : 0);
  const capReturnUnit = capRetKpi?.unit || (isCAT ? "$B" : "");
  const payoutRatio = Number(payoutKpi?.value) || (isCAT ? 32 : 0);

  // Garde tardive : si on n'est pas sur CAT et data manquante, ne pas afficher.
  if (!isCAT && (!dpsKpi || !capRetKpi || !payoutKpi)) return null;

  // === STATES PARTAGÉS pour les 3 cards (centralisés au parent) ===
  // 1. Cours réel via API live (utilisé par calculator + snowball)
  const livePrice = useLivePrice(company.ticker);
  // Fallback : cours figé si l'API n'a rien rendu (ex : CAT mai 2026 ≈ 390)
  const fallbackPrice = isCAT ? 390 : 100;
  const effectivePrice = livePrice.price ?? fallbackPrice;
  const isPriceLive = livePrice.price !== null && !livePrice.loading;

  // 2. Devise centralisée — s'applique à toutes les cards
  const nativeCurrency: Currency = getTickerCurrency(company.ticker);
  const [userCurrency, setUserCurrency] = useState<Currency>(nativeCurrency);
  const [currency, setCurrency] = useState<Currency>(nativeCurrency);
  const [rate, setRate] = useState<number>(1);

  useEffect(() => {
    const detected = getUserCurrency();
    setUserCurrency(detected);
  }, []);

  useEffect(() => {
    let cancelled = false;
    getExchangeRate(nativeCurrency, currency).then((r) => {
      if (!cancelled) setRate(r);
    });
    return () => {
      cancelled = true;
    };
  }, [currency, nativeCurrency]);

  const currencyOptions: Currency[] = useMemo(() => {
    const list: Currency[] = [nativeCurrency];
    if (userCurrency !== nativeCurrency) list.push(userCurrency);
    for (const c of SUPPORTED_CURRENCIES) {
      if (!list.includes(c)) list.push(c);
    }
    return list;
  }, [nativeCurrency, userCurrency]);

  // Yield basé sur cours live (ou fallback)
  const yieldPct = effectivePrice > 0 ? (dpsAnnual / effectivePrice) * 100 : 1.5;

  const goPrev = () => setActive((prev) => (prev - 1 + total) % total);
  const goNext = () => setActive((prev) => (prev + 1) % total);

  // Swipe : drag souris ou doigt sur la frame entière → prev/next.
  const swipeRef = useRef<HTMLDivElement>(null);
  useSwipeStories(swipeRef, { onPrev: goPrev, onNext: goNext });

  const cards = [
    <DividendAristocratCard
      key="aristocrat"
      accent={accent}
      glow={glow}
      dps={dpsAnnual}
      dpsYoy={dpsYoy}
      dpsHistory={dpsHistory}
      capReturn={capReturn}
      capReturnUnit={capReturnUnit}
      payoutRatio={payoutRatio}
      yearsStreak={31}
    />,
    <DividendCalculatorCard
      key="calc"
      accent={accent}
      glow={glow}
      dpsAnnual={dpsAnnual}
      ticker={company.ticker}
      price={effectivePrice}
      isPriceLive={isPriceLive}
      priceFetchedAt={livePrice.fetchedAt}
      nativeCurrency={nativeCurrency}
      currency={currency}
      rate={rate}
    />,
    <DividendSnowballCard
      key="snow"
      accent={accent}
      glow={glow}
      yieldPct={yieldPct}
      currency={currency}
      rate={rate}
    />,
  ];

  return (
    <section
      id="sec-dividend-stories"
      className="mt-9 scroll-mt-24 animate-fade-up-d2"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[22px] font-semibold text-zinc-50">
            Politique de dividende
          </h2>
          <p className="mt-0.5 max-w-2xl text-[13.5px] text-zinc-300">
            Trois angles pour visualiser le retour aux actionnaires : statut
            historique, simulateur de revenu, effet boule de neige sur la durée.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Devise centralisée : applique sur les 3 cards en même temps */}
          <CurrencyPicker
            value={currency}
            onChange={setCurrency}
            options={currencyOptions}
            accent={accent}
          />
          <span className="font-mono text-[11px] uppercase tracking-wider text-zinc-400">
            {active + 1} / {total}
          </span>
        </div>
      </div>

      <div className="relative mx-auto" style={{ width: "min(400px, 100%)" }} ref={swipeRef}>
        {total > 1 && (
          <button
            onClick={goPrev}
            className="absolute -left-14 top-1/2 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/60 text-zinc-200 backdrop-blur-md transition-all hover:scale-110 hover:border-white/30 hover:text-white sm:inline-flex"
            aria-label="Précédent"
          >
            <ChevronLeft className="size-5" />
          </button>
        )}

        <div
          className="relative overflow-hidden rounded-[36px] border border-white/10 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)]"
          style={{
            aspectRatio: "9 / 16",
            background: "#000",
            boxShadow: `0 0 0 8px #0a0a0a, 0 0 0 9px #1f1f1f, 0 30px 80px -20px ${accent}55`,
          }}
        >
          <div
            aria-hidden
            className="absolute left-1/2 top-2 z-30 h-5 w-24 -translate-x-1/2 rounded-full bg-black"
          />

          <div className="absolute inset-x-3 top-3 z-20 flex gap-1">
            {Array.from({ length: total }).map((_, i) => (
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
                    transition:
                      i === active && !paused && !hovered
                        ? "width 5s linear"
                        : "width 200ms",
                  }}
                />
              </div>
            ))}
          </div>

          <button
            onClick={() => setPaused((p) => !p)}
            className="absolute right-3 top-7 z-30 inline-flex size-7 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur transition-colors hover:bg-black/60"
            aria-label={paused ? "Reprendre" : "Pause"}
          >
            {paused ? <Play className="size-3" /> : <Pause className="size-3" />}
          </button>

          <div className="absolute inset-0">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={active}
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                className="absolute inset-0"
              >
                {cards[active]}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Tap-zones uniquement en haut + bas pour ne pas bloquer les
              sliders/inputs des cards interactives au centre.
              25 % top = prev, 25 % bottom = next. */}
          {total > 1 && (
            <>
              <button
                onClick={goPrev}
                className="absolute inset-x-0 top-12 z-10 h-[15%]"
                aria-label="Précédent"
              />
              <button
                onClick={goNext}
                className="absolute inset-x-0 bottom-0 z-10 h-[10%]"
                aria-label="Suivant"
              />
            </>
          )}
        </div>

        {total > 1 && (
          <button
            onClick={goNext}
            className="absolute -right-14 top-1/2 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/60 text-zinc-200 backdrop-blur-md transition-all hover:scale-110 hover:border-white/30 hover:text-white sm:inline-flex"
            aria-label="Suivant"
          >
            <ChevronRight className="size-5" />
          </button>
        )}
      </div>

      <div className="mt-5 flex justify-center gap-1.5">
        {Array.from({ length: total }).map((_, i) => (
          <button
            key={i}
            onClick={() => setActive(i)}
            className={`h-1.5 rounded-full transition-all ${
              i === active ? "w-6" : "w-1.5 bg-zinc-600 hover:bg-zinc-400"
            }`}
            style={
              i === active
                ? { background: accent, boxShadow: `0 0 6px ${accent}` }
                : undefined
            }
            aria-label={`Aller à la fenêtre ${i + 1}`}
          />
        ))}
      </div>
    </section>
  );
}
