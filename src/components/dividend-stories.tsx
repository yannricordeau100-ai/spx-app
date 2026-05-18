"use client";

import { useEffect, useMemo, useState } from "react";
import type { Company } from "@/lib/data";
import { brand } from "@/lib/brand";
import { useT } from "@/lib/i18n/provider";
import { DividendAristocratCard } from "@/components/dividend-aristocrat-card";
import { DividendCalculatorCard } from "@/components/dividend-calculator-card";
import { DividendSnowballCard } from "@/components/dividend-snowball-card";
import { useLivePrice } from "@/lib/hooks/use-live-price";
import {
  type Currency,
  SUPPORTED_CURRENCIES,
  getExchangeRate,
  getTickerCurrency,
  getUserCurrency,
  getCurrencyFromCookie,
  setCurrencyCookie,
} from "@/lib/currency";
import { CurrencyPicker } from "@/components/currency-picker";

/**
 * Bloc Stories Dividendes — 3 cards côte à côte, sans défilement
 * (refonte 9 mai 23h00 : carrousel/autoplay/swipe/dots supprimés).
 *
 *  1. Aristocrat Streak (statique : streak, DPS, Cap Return, Payout)
 *  2. Calculateur revenu (interactif : revenu cible → nb actions)
 *  3. Boule de neige composée DRIP (interactif : sliders → courbe)
 *
 * Activé uniquement pour les sociétés versant un dividende ET ayant le data
 * minimum (DPS + Cap Return + Payout). Pour la V1 démo : limité à CAT.
 */
export function DividendStories({
  company,
  showCurrencyPicker = false,
}: {
  company: Company;
  /**
   * Yann 18 mai 2026 : la devise picker doit être MASQUÉE par défaut sur
   * le front office public (page société). Le composant continue de
   * détecter la devise native + override via cookie (proxy geo-IP) mais
   * l'utilisateur final ne voit plus le menu déroulant. Yann le
   * rallumera explicitement si besoin (concepts/mockups peut passer
   * `showCurrencyPicker={true}` pour le test interne).
   */
  showCurrencyPicker?: boolean;
}) {
  const { t } = useT();
  const accent = brand(company.ticker).primary;
  const glow = brand(company.ticker).glow;

  // Récupération des KPIs dividendes nécessaires.
  const dpsKpi = company.kpis.find((k) => k.short === "DPS");
  const capRetKpi = company.kpis.find((k) => k.short === "Cap Return");
  const payoutKpi = company.kpis.find((k) => k.short === "Payout Ratio");
  // EPS optionnel (extrait par CONV-DIV via yfinance, 21 mai 2026).
  // Si présent : superposé à la mini-courbe DPS pour visualiser le gap.
  const epsKpi = company.kpis.find((k) => k.short === "EPS");

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
  // Yann 17 mai 2026 : fallback "Mds $" (FR formaté) au lieu de "$B" brut,
  // cohérent avec dataset 2026 majoritaire et évite bug rescale latent
  // côté DividendAristocratCard qui ne reconnaissait que "$B".
  const capReturnUnit = capRetKpi?.unit || (isCAT ? "Mds $" : "");
  const payoutRatio = Number(payoutKpi?.value) || (isCAT ? 32 : 0);

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
    // Initial : on lit d'abord le cookie posé par le proxy (détection IP
    // côté serveur). Si présent → c'est lui qui prime. Sinon fallback sur
    // navigator.language.
    const cookieCurrency = getCurrencyFromCookie();
    if (cookieCurrency) {
      setCurrency(cookieCurrency);
      setUserCurrency(cookieCurrency);
    } else {
      const detected = getUserCurrency();
      setUserCurrency(detected);
    }
  }, []);

  // Persistance : à chaque changement manuel de devise, on update le cookie
  // pour que la préférence survive aux refresh / autres pages.
  // Si user connecté : on push aussi vers Supabase user_metadata pour
  // multi-device (best-effort, silencieux si échec).
  useEffect(() => {
    setCurrencyCookie(currency);
    void import("@/lib/user-prefs").then((m) => m.pushUserPref("currency", currency));
  }, [currency]);

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

  // Garde tardive : si on n'est pas sur CAT et data manquante, ne pas afficher.
  if (!isCAT && (!dpsKpi || !capRetKpi || !payoutKpi)) return null;

  // Récupération de meta dividend_meta (extrait par CONV-DIV depuis 10-K).
  // Champ optionnel : si absent → la card calcule rien, n'affiche pas le focal
  // "X ans de hausse" (anti-fallback hardcodé sur stés inconnues).
  // CAT garde son fallback explicite yearsStreak=31 (V1 démo cas connu).
  type CompanyWithMeta = typeof company & {
    dividend_meta?: { first_year?: number; cuts?: Array<{ year: number; reason: string }> };
  };
  const dividendMeta = (company as CompanyWithMeta).dividend_meta;
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
      yearsStreak={isCAT ? 31 : undefined}
      meta={dividendMeta}
      epsHistory={
        Array.isArray(epsKpi?.history) &&
        epsKpi.history.length === dpsHistory.length
          ? (epsKpi.history as number[])
          : undefined
      }
      epsUnit={epsKpi?.unit || undefined}
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
    >
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[22px] font-semibold text-zinc-50">
            {t("div.stories.title")}
          </h2>
          <p className="mt-0.5 max-w-2xl text-[13.5px] text-zinc-300">
            {t("div.stories.subtitle")}
          </p>
        </div>
        {showCurrencyPicker && (
          <div className="flex items-center gap-3">
            {/* Devise centralisée : applique sur les 3 cards en même temps.
                Masquée par défaut sur front office (Yann 18 mai 2026) :
                la détection devise native + override geo-IP via cookie
                continue, mais le picker n'est plus visible publiquement. */}
            <CurrencyPicker
              value={currency}
              onChange={setCurrency}
              options={currencyOptions}
              accent={accent}
            />
          </div>
        )}
      </div>

      {/* Layout : 3 cards côte à côte sans défilement (Yann 9 mai 23h00).
          Suppression du carrousel/autoplay/swipe/dots/tap-zones. Sur mobile,
          stack en colonne unique. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {cards.map((card, i) => (
          <div
            key={i}
            className="relative overflow-hidden rounded-[28px] border border-white/10 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.7)]"
            style={{
              minHeight: 600,
              background: "#000",
              boxShadow: `0 0 0 1px #1f1f1f, 0 24px 60px -20px ${accent}40`,
            }}
          >
            {card}
          </div>
        ))}
      </div>
    </section>
  );
}
