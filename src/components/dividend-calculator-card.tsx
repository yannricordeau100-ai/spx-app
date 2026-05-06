"use client";

import { useEffect, useMemo, useState } from "react";
import { Calculator, TrendingUp } from "lucide-react";
import {
  CURRENCY_SYMBOL,
  SUPPORTED_CURRENCIES,
  type Currency,
  getExchangeRate,
  getTickerCurrency,
  getUserCurrency,
} from "@/lib/currency";

/**
 * Card 2 : "Calculateur de revenu dividendes" — interactif.
 *
 * Refonte 7 mai 2026 (Yann) :
 *  - Inputs manuels (input number) en plus des sliders pour taux d'imposition
 *    et cours estimé.
 *  - Menu déroulant devise : default = devise native de l'action ; 2e item =
 *    devise de l'utilisateur (via navigator.language) si supportée.
 *    Tous les chiffres rebasculent automatiquement via le taux de change
 *    (frankfurter.app, gratuit, basé ECB).
 *  - Fréquence "An" → "A" (1 lettre, comme j/s/m).
 *  - Densité augmentée pour ne plus laisser de vide dans le frame story.
 */

type Frequency = "day" | "week" | "month" | "year";
const FREQ_LABEL_LONG: Record<Frequency, string> = {
  day: "/ jour",
  week: "/ semaine",
  month: "/ mois",
  year: "/ an",
};
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
  defaultPrice,
  ticker,
}: {
  accent: string;
  glow: string;
  dpsAnnual: number;
  defaultPrice: number;
  ticker: string;
}) {
  const [target, setTarget] = useState<number>(100);
  const [freq, setFreq] = useState<Frequency>("month");
  const [taxPct, setTaxPct] = useState<number>(30);
  const [price, setPrice] = useState<number>(defaultPrice);

  // Devises : native = devise du ticker. user = devise du locale browser.
  const nativeCurrency: Currency = getTickerCurrency(ticker);
  const [userCurrency, setUserCurrency] = useState<Currency>(nativeCurrency);
  // Lookup user currency côté client (navigator non-dispo en SSR).
  useEffect(() => {
    const detected = getUserCurrency();
    if (detected !== nativeCurrency) {
      setUserCurrency(detected);
    }
  }, [nativeCurrency]);

  const [currency, setCurrency] = useState<Currency>(nativeCurrency);
  const [rate, setRate] = useState<number>(1); // native → currency
  // Fetch rate quand currency change.
  useEffect(() => {
    let cancelled = false;
    getExchangeRate(nativeCurrency, currency).then((r) => {
      if (!cancelled) setRate(r);
    });
    return () => {
      cancelled = true;
    };
  }, [currency, nativeCurrency]);

  // Liste devises menu : native en 1er, user en 2nd (si différent), reste après.
  const currencyOptions: Currency[] = useMemo(() => {
    const list: Currency[] = [nativeCurrency];
    if (userCurrency !== nativeCurrency) list.push(userCurrency);
    for (const c of SUPPORTED_CURRENCIES) {
      if (!list.includes(c)) list.push(c);
    }
    return list;
  }, [nativeCurrency, userCurrency]);

  const result = useMemo(() => {
    // Le revenu cible est dans la devise affichée (currency) mais le DPS est
    // dans la devise native. Conversion target → native pour comparer au DPS.
    const targetAnnualDisplayed = target * FREQ_PER_YEAR[freq];
    const targetAnnualNative = rate > 0 ? targetAnnualDisplayed / rate : targetAnnualDisplayed;
    const grossAnnualNative = targetAnnualNative / (1 - taxPct / 100);
    const sharesNeeded = dpsAnnual > 0 ? grossAnnualNative / dpsAnnual : 0;
    // Cours est en devise affichée (l'utilisateur l'a entré ainsi) → capital direct.
    const capitalDisplayed = sharesNeeded * price;
    return {
      shares: Math.ceil(sharesNeeded),
      capital: capitalDisplayed,
      grossAnnualNative,
      grossAnnualDisplayed: grossAnnualNative * rate,
    };
  }, [target, freq, taxPct, price, dpsAnnual, rate]);

  const sym = CURRENCY_SYMBOL[currency];
  const fmtMoney = (n: number) =>
    n.toLocaleString("fr-FR", {
      maximumFractionDigits: n >= 100 ? 0 : 2,
      minimumFractionDigits: 0,
    });

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

      <div className="relative flex h-full flex-col">
        {/* Onglet "Simulateur" en HAUT À GAUCHE (Yann 7 mai 2026). */}
        <div
          className="mr-auto inline-flex w-fit items-center gap-1 rounded-full border px-2 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.14em] opacity-90"
          style={{ background: `${accent}14`, color: accent, borderColor: `${accent}40` }}
        >
          <Calculator className="size-2.5" />
          Simulateur
        </div>

        {/* Titre + sélecteur devise sur la même ligne (gain de vide). */}
        <div className="mt-2 flex items-end justify-between gap-2">
          <div>
            <div className="text-[16px] font-bold leading-tight text-zinc-50">
              Combien d&apos;actions {ticker} ?
            </div>
            <div className="text-[10.5px] italic text-zinc-400">
              Pour viser un revenu net régulier
            </div>
          </div>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value as Currency)}
            className="rounded-md border border-white/15 bg-black/60 px-1.5 py-1 font-mono text-[10.5px] tabular-nums text-zinc-100 outline-none transition-colors hover:border-white/30 focus:border-white/50"
            title="Devise d'affichage (taux de change live)"
          >
            {currencyOptions.map((c) => (
              <option key={c} value={c} className="bg-black">
                {c} {CURRENCY_SYMBOL[c]}
              </option>
            ))}
          </select>
        </div>

        {/* Sortie principale — gros chiffre nb actions + capital */}
        <div className="mt-2 flex flex-col items-center">
          <div
            className="font-display font-bold leading-none tracking-tight gradient-text tabular-nums"
            style={{ fontSize: "clamp(36px, 12vw, 54px)" }}
          >
            {result.shares.toLocaleString("fr-FR")}
          </div>
          <div className="mt-0.5 text-[12px] font-medium text-zinc-200">
            actions à détenir
          </div>
          <div className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-white/15 bg-black/45 px-2.5 py-0.5 text-[11px] font-mono tabular-nums text-zinc-200 backdrop-blur">
            capital ≈ {fmtMoney(result.capital)} {sym}
          </div>
        </div>

        {/* Inputs : revenu cible + fréquence (1 bloc dense) */}
        <div className="mt-2.5 space-y-2 text-[11px]">
          <div className="rounded-lg border border-white/10 bg-black/30 p-2 backdrop-blur">
            <div className="mb-1 flex items-center justify-between">
              <span className="font-mono text-[9.5px] uppercase tracking-wider text-zinc-400">
                Revenu cible
              </span>
              <span className="font-mono tabular-nums text-zinc-100">
                {fmtMoney(target)} {sym} {FREQ_LABEL_LONG[freq]}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min={1}
                step={target < 100 ? 1 : 10}
                value={target}
                onChange={(e) => setTarget(Math.max(1, Number(e.target.value) || 0))}
                className="flex-1 rounded border border-white/10 bg-black/50 px-1.5 py-1 font-mono text-[11px] tabular-nums text-zinc-100 outline-none focus:border-white/30"
              />
              <div className="flex gap-0.5">
                {(["day", "week", "month", "year"] as Frequency[]).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFreq(f)}
                    className="rounded border px-1.5 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors"
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
          </div>

          {/* Tax + cours : input number + slider chacun, sur 2 lignes denses. */}
          <div className="rounded-lg border border-white/10 bg-black/30 p-2 backdrop-blur">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[9.5px] uppercase tracking-wider text-zinc-400">
                Imposition
              </span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={0}
                  max={70}
                  step={1}
                  value={taxPct}
                  onChange={(e) =>
                    setTaxPct(Math.max(0, Math.min(70, Number(e.target.value) || 0)))
                  }
                  className="w-12 rounded border border-white/10 bg-black/50 px-1 py-0.5 text-right font-mono text-[10.5px] tabular-nums text-zinc-100 outline-none focus:border-white/30"
                />
                <span className="font-mono text-[10.5px] text-zinc-400">%</span>
              </div>
            </div>
            <input
              type="range"
              min={0}
              max={50}
              step={1}
              value={taxPct}
              onChange={(e) => setTaxPct(Number(e.target.value))}
              className="mt-1 h-1 w-full cursor-pointer accent-[var(--accent-color)]"
              style={{ ["--accent-color" as string]: accent }}
            />
          </div>

          <div className="rounded-lg border border-white/10 bg-black/30 p-2 backdrop-blur">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[9.5px] uppercase tracking-wider text-zinc-400">
                Cours estimé ({sym})
              </span>
              <input
                type="number"
                min={1}
                step={1}
                value={price.toFixed(0)}
                onChange={(e) => setPrice(Math.max(1, Number(e.target.value) || 0))}
                className="w-16 rounded border border-white/10 bg-black/50 px-1 py-0.5 text-right font-mono text-[10.5px] tabular-nums text-zinc-100 outline-none focus:border-white/30"
              />
            </div>
            <input
              type="range"
              min={Math.max(10, defaultPrice * 0.4)}
              max={defaultPrice * 1.8}
              step={5}
              value={price}
              onChange={(e) => setPrice(Number(e.target.value))}
              className="mt-1 h-1 w-full cursor-pointer accent-[var(--accent-color)]"
              style={{ ["--accent-color" as string]: accent }}
            />
          </div>
        </div>

        {/* Signal en bas — densifié */}
        <div className="mt-auto rounded-xl border border-white/10 bg-black/45 p-2.5 backdrop-blur">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-50">
            <TrendingUp className="size-3" style={{ color: accent }} />
            Brut nécessaire :{" "}
            <span className="font-mono tabular-nums">
              {fmtMoney(result.grossAnnualDisplayed)} {sym}
            </span>{" "}
            / an
          </div>
          <div className="mt-0.5 text-[9.5px] italic leading-relaxed text-zinc-400">
            Cours et dividende dans la devise affichée. Taux change ECB live.
            Calcul indicatif sans frais ni croissance future du dividende.
          </div>
        </div>
      </div>
    </div>
  );
}
