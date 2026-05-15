"use client";

import { useMemo, useState } from "react";
import { Calculator, TrendingUp, Info } from "lucide-react";
import { type Currency, CURRENCY_SYMBOL } from "@/lib/currency";
import { InfoTooltip } from "@/components/info-tooltip";
import { useT } from "@/lib/i18n/provider";

/**
 * Card 2 : "Calculateur de revenu dividendes" — interactif.
 *
 * Refonte 8 mai 2026 (Yann V3) :
 *  - Devise + cours désormais reçus en props (centralisés au parent
 *    DividendStories pour cohérence sur les 3 cards).
 *  - Titre changé : "Revenu net régulier 😎 / Combien d'actions {ticker} ?"
 *  - Badge "Simulateur" à droite (uniforme avec autres cards).
 *  - Tooltip "i" sur "imposition" (PFU France) et indication source du cours.
 *  - Indicateur "i" si cours non-live (date différente d'aujourd'hui).
 *  - Inputs manuels number en plus des sliders.
 *  - Densité augmentée, scroll vertical si overflow.
 */

type Frequency = "day" | "week" | "month" | "year";
const FREQ_LABEL_SHORT: Record<Frequency, string> = {
  day: "j",
  week: "s",
  month: "m",
  year: "a",
};
const FREQ_PER_YEAR: Record<Frequency, number> = {
  day: 365,
  week: 52,
  month: 12,
  year: 1,
};

export function DividendCalculatorCard({
  accent,
  glow,
  dpsAnnual,
  ticker,
  price,
  isPriceLive,
  priceFetchedAt,
  nativeCurrency,
  currency,
  rate,
}: {
  accent: string;
  glow: string;
  dpsAnnual: number;
  ticker: string;
  /** Cours réel via API live ou fallback figé. En devise native du ticker. */
  price: number;
  /** True = fetch live réussi récent, false = fallback statique. */
  isPriceLive: boolean;
  /** ISO timestamp de la dernière mise à jour API (ou null). */
  priceFetchedAt: string | null;
  /** Devise native du ticker (USD, EUR, GBP, ...). */
  nativeCurrency: Currency;
  /** Devise d'affichage choisie au parent. */
  currency: Currency;
  /** Taux nativeCurrency → currency. */
  rate: number;
}) {
  const { t } = useT();
  const [target, setTarget] = useState<number>(100);
  const [freq, setFreq] = useState<Frequency>("month");
  const [taxPct, setTaxPct] = useState<number>(0);

  const result = useMemo(() => {
    // Revenu cible saisi en devise affichée. Conversion → native pour comparer DPS.
    const targetAnnualDisplayed = target * FREQ_PER_YEAR[freq];
    const targetAnnualNative =
      rate > 0 ? targetAnnualDisplayed / rate : targetAnnualDisplayed;
    const grossAnnualNative = targetAnnualNative / (1 - taxPct / 100);
    const sharesNeeded = dpsAnnual > 0 ? grossAnnualNative / dpsAnnual : 0;
    // Cours en devise native → capital natif → re-converti en devise affichée
    const capitalNative = sharesNeeded * price;
    const capitalDisplayed = capitalNative * rate;
    return {
      shares: Math.ceil(sharesNeeded),
      capital: capitalDisplayed,
      grossAnnualNative,
    };
  }, [target, freq, taxPct, price, dpsAnnual, rate]);

  const sym = CURRENCY_SYMBOL[currency];
  const fmtMoney = (n: number) =>
    n.toLocaleString("fr-FR", {
      maximumFractionDigits: n >= 100 ? 0 : 2,
      minimumFractionDigits: 0,
    });

  // Affichage du cours dans la devise d'affichage user
  const priceDisplayed = price * rate;

  // Date du cours
  const priceDate = priceFetchedAt ? new Date(priceFetchedAt) : null;
  const priceDateLabel = priceDate
    ? priceDate.toLocaleString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

  return (
    <div
      className="relative flex h-full flex-col overflow-hidden rounded-[36px] bg-gradient-to-br from-[#101015] via-[#0a0a0e] to-[#060608] px-4 pb-4 pt-12"
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

      <div className="relative flex h-full flex-col overflow-y-auto pr-1">
        {/* Badge "Simulateur" — UNIFORME À DROITE pour cohérence avec les autres cards */}
        <div
          className="ml-auto inline-flex w-fit items-center gap-1 rounded-full border px-2 py-0.5 text-[12px] font-semibold uppercase tracking-[0.14em] opacity-90"
          style={{ background: `${accent}14`, color: accent, borderColor: `${accent}40` }}
        >
          <Calculator className="size-3.5" />
          {t("div.calc.badge_simulator")}
        </div>

        {/* Titre principal sur 2 lignes */}
        <div className="mt-3">
          <div className="flex items-center gap-1.5 text-[17px] font-bold leading-tight text-zinc-50">
            {t("div.calc.subtitle_regular_income")} <span aria-hidden>😎</span>
          </div>
          <div className="text-[14px] leading-snug text-zinc-300">
            {t("div.calc.question_shares").replace("{ticker}", ticker)}
          </div>
        </div>

        {/* Sortie principale : nb actions + capital */}
        <div className="mt-3 flex flex-col items-center">
          <div
            className="font-display font-bold leading-none tracking-tight gradient-text tabular-nums"
            style={{ fontSize: "clamp(36px, 12vw, 54px)" }}
          >
            {result.shares.toLocaleString("fr-FR")}
          </div>
          <div className="mt-0.5 text-[14px] font-medium text-zinc-200">
            {t("div.calc.shares_to_hold")}
          </div>
          <div className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-white/15 bg-black/45 px-2.5 py-0.5 text-[13px] font-mono tabular-nums text-zinc-200 backdrop-blur">
            {t("div.calc.capital_approx")} {fmtMoney(result.capital)} {sym}
          </div>
        </div>

        {/* Inputs : revenu cible + fréquence (1 bloc dense) */}
        <div className="mt-3 space-y-2 text-[13.5px]">
          <div className="rounded-lg border border-white/10 bg-black/30 p-2 backdrop-blur">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[12.5px] font-semibold uppercase tracking-wider text-zinc-300">
                Revenu cible
              </span>
              <span className="font-mono tabular-nums text-zinc-100">
                {fmtMoney(target)} {sym} / {FREQ_LABEL_SHORT[freq]}
              </span>
            </div>
            <input
              type="number"
              min={1}
              step={target < 100 ? 1 : 10}
              value={target}
              onChange={(e) => setTarget(Math.max(1, Number(e.target.value) || 0))}
              className="w-full rounded-md border border-white/10 bg-black/50 px-2 py-1 font-mono text-[14px] tabular-nums text-zinc-100 outline-none transition-colors focus:border-white/30"
            />
            <div className="mt-1.5 flex gap-1">
              {(["day", "week", "month", "year"] as Frequency[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFreq(f)}
                  className="flex-1 rounded border px-1 py-0.5 text-[12.5px] font-semibold uppercase tracking-wider transition-colors"
                  style={
                    freq === f
                      ? { background: accent, color: "#000", borderColor: accent }
                      : {
                          background: "transparent",
                          color: "#a1a1aa",
                          borderColor: "rgba(255,255,255,0.10)",
                        }
                  }
                >
                  {FREQ_LABEL_SHORT[f]}
                </button>
              ))}
            </div>
          </div>

          {/* Imposition */}
          <div className="rounded-lg border border-white/10 bg-black/30 p-2 backdrop-blur">
            <div className="mb-1 flex items-center gap-1">
              <span className="text-[12.5px] font-semibold uppercase tracking-wider text-zinc-300">
                Imposition
              </span>
              <InfoTooltip color={accent} size="sm">
                <div className="text-zinc-200">
                  <span className="font-semibold">Imposition</span> : pourcentage
                  prélevé sur tes dividendes par l&apos;État. En France, le PFU
                  (Prélèvement Forfaitaire Unique) est de <b>30 %</b> par défaut.
                  Aux USA, tax habituelle 15-20 % (qualified dividends). En Suisse,
                  35 % d&apos;impôt anticipé (récupérable).
                </div>
              </InfoTooltip>
              <span className="ml-auto font-mono tabular-nums text-[14px] text-zinc-100">
                {taxPct} %
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={0}
                max={50}
                step={1}
                value={taxPct}
                onChange={(e) => setTaxPct(Number(e.target.value))}
                className="h-1 flex-1 cursor-pointer accent-[var(--accent-color)]"
                style={{ ["--accent-color" as string]: accent }}
              />
              <input
                type="number"
                min={0}
                max={70}
                value={taxPct}
                onChange={(e) =>
                  setTaxPct(Math.max(0, Math.min(70, Number(e.target.value) || 0)))
                }
                className="w-14 rounded border border-white/10 bg-black/50 px-1.5 py-0.5 text-right font-mono text-[13px] tabular-nums text-zinc-100 outline-none focus:border-white/30"
              />
            </div>
          </div>

          {/* Cours actuel — fetch live API, indication date */}
          <div className="rounded-lg border border-white/10 bg-black/30 p-2 backdrop-blur">
            <div className="mb-0.5 flex items-center gap-1">
              <span className="text-[12.5px] font-semibold uppercase tracking-wider text-zinc-300">
                Cours {ticker}
              </span>
              {isPriceLive ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[11.5px] font-semibold text-emerald-300">
                  <span className="size-1.5 rounded-full bg-emerald-400" /> Live
                </span>
              ) : (
                <InfoTooltip color={accent} size="sm">
                  <div className="text-zinc-200">
                    Le cours en direct n&apos;est pas disponible pour le moment.
                    Valeur estimée affichée ({priceDateLabel}). Reviendra automatiquement
                    quand l&apos;API se rétablit.
                  </div>
                </InfoTooltip>
              )}
              <span className="ml-auto font-mono tabular-nums text-[14.5px] font-semibold text-zinc-50">
                {fmtMoney(priceDisplayed)} {sym}
              </span>
            </div>
            {nativeCurrency !== currency && (
              <div className="text-[11.5px] italic text-zinc-500">
                Source native : {fmtMoney(price)} {CURRENCY_SYMBOL[nativeCurrency]} ·
                taux ECB
              </div>
            )}
          </div>
        </div>

        {/* Brut nécessaire */}
        <div className="mt-2 rounded-xl border border-white/10 bg-black/45 p-2.5 backdrop-blur">
          <div className="flex items-center gap-1.5 text-[13.5px] font-semibold text-zinc-50">
            <TrendingUp className="size-4" style={{ color: accent }} />
            Brut nécessaire avant impôt :{" "}
            <span className="font-mono tabular-nums">
              {fmtMoney(result.grossAnnualNative * rate)} {sym}
            </span>{" "}
            / an
          </div>
          <div className="mt-0.5 text-[12px] italic leading-relaxed text-zinc-400">
            Calcul indicatif. Ne tient pas compte de la croissance future du
            dividende ni des frais de courtage.
          </div>
        </div>
      </div>
    </div>
  );
}
