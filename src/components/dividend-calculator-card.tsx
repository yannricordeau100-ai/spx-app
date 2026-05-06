"use client";

import { useMemo, useState } from "react";
import { Calculator, TrendingUp } from "lucide-react";

/**
 * Card 2 du bloc Stories Dividendes : "Calculateur de revenu".
 *
 * L'investisseur entre :
 *  - revenu cible Y (par jour / semaine / mois / an)
 *  - taux d'imposition Z (PFU 30 % par défaut, France)
 *  - cours W (slider, défaut figé fallback)
 *
 * Sortie :
 *  - nombre d'actions nécessaires
 *  - capital total à immobiliser
 *
 * Données dividende statiques (passées en props), pas de fetch live ici.
 */

type Frequency = "day" | "week" | "month" | "year";
const FREQ_LABEL: Record<Frequency, string> = {
  day: "/ jour",
  week: "/ semaine",
  month: "/ mois",
  year: "/ an",
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

  const result = useMemo(() => {
    const targetAnnual = target * FREQ_PER_YEAR[freq];
    const grossAnnualNeeded = targetAnnual / (1 - taxPct / 100);
    const sharesNeeded = dpsAnnual > 0 ? grossAnnualNeeded / dpsAnnual : 0;
    const capital = sharesNeeded * price;
    return {
      shares: Math.ceil(sharesNeeded),
      capital,
      grossAnnual: grossAnnualNeeded,
    };
  }, [target, freq, taxPct, price, dpsAnnual]);

  const fmtMoney = (n: number) =>
    n.toLocaleString("fr-FR", {
      maximumFractionDigits: n >= 100 ? 0 : 2,
      minimumFractionDigits: 0,
    });

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
        <div
          className="ml-auto inline-flex w-fit items-center gap-1 rounded-full border px-2 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.14em] opacity-80"
          style={{ background: `${accent}14`, color: accent, borderColor: `${accent}40` }}
        >
          <Calculator className="size-2.5" />
          Simulateur
        </div>

        <div className="mt-3 text-[18px] font-bold leading-tight text-zinc-50">
          Combien d&apos;actions {ticker} ?
        </div>
        <div className="text-[11px] italic text-zinc-400">
          Pour viser un revenu net réguier
        </div>

        {/* Sortie principale — gros chiffre nb actions */}
        <div className="mt-3 flex flex-col items-center">
          <div
            className="font-display font-bold leading-none tracking-tight gradient-text tabular-nums"
            style={{ fontSize: "clamp(40px, 14vw, 60px)" }}
          >
            {result.shares.toLocaleString("fr-FR")}
          </div>
          <div className="mt-1 text-[12.5px] font-medium text-zinc-200">
            actions à détenir
          </div>
          <div className="mt-2 inline-flex items-center gap-1 rounded-full border border-white/15 bg-black/45 px-2.5 py-0.5 text-[11px] font-mono tabular-nums text-zinc-200 backdrop-blur">
            capital ≈ {fmtMoney(result.capital)} $
          </div>
        </div>

        {/* Inputs — compacts pour tenir dans le frame mobile 9:16. */}
        <div className="mt-3 space-y-2 text-[11px]">
          {/* Revenu cible + fréquence */}
          <div className="rounded-lg border border-white/10 bg-black/30 p-2 backdrop-blur">
            <div className="mb-1 flex items-center justify-between">
              <span className="font-mono text-[9.5px] uppercase tracking-wider text-zinc-400">
                Revenu cible
              </span>
              <span className="font-mono tabular-nums text-zinc-100">
                {fmtMoney(target)} $ {FREQ_LABEL[freq]}
              </span>
            </div>
            <input
              type="number"
              min={1}
              step={target < 100 ? 1 : 10}
              value={target}
              onChange={(e) => setTarget(Math.max(1, Number(e.target.value) || 0))}
              className="w-full rounded border border-white/10 bg-black/50 px-1.5 py-1 font-mono text-[11px] tabular-nums text-zinc-100 outline-none focus:border-white/30"
            />
            <div className="mt-1.5 flex gap-1">
              {(["day", "week", "month", "year"] as Frequency[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFreq(f)}
                  className="flex-1 rounded border px-1 py-0.5 font-mono text-[9.5px] uppercase tracking-wider transition-colors"
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
                  {f === "day" ? "j" : f === "week" ? "s" : f === "month" ? "m" : "an"}
                </button>
              ))}
            </div>
          </div>

          {/* Tax + cours sur 1 ligne */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-white/10 bg-black/30 p-2 backdrop-blur">
              <div className="font-mono text-[9.5px] uppercase tracking-wider text-zinc-400">
                Imposition
              </div>
              <div className="mt-0.5 flex items-center gap-1.5">
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
                <span className="w-7 text-right font-mono tabular-nums text-[11px] text-zinc-100">
                  {taxPct}%
                </span>
              </div>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/30 p-2 backdrop-blur">
              <div className="font-mono text-[9.5px] uppercase tracking-wider text-zinc-400">
                Cours estimé
              </div>
              <div className="mt-0.5 flex items-center gap-1.5">
                <input
                  type="range"
                  min={Math.max(50, defaultPrice * 0.4)}
                  max={defaultPrice * 1.8}
                  step={5}
                  value={price}
                  onChange={(e) => setPrice(Number(e.target.value))}
                  className="h-1 flex-1 cursor-pointer accent-[var(--accent-color)]"
                  style={{ ["--accent-color" as string]: accent }}
                />
                <span className="w-12 text-right font-mono tabular-nums text-[11px] text-zinc-100">
                  {price.toFixed(0)} $
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Signal en bas */}
        <div className="mt-auto rounded-xl border border-white/10 bg-black/45 p-2.5 backdrop-blur">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-50">
            <TrendingUp className="size-3" style={{ color: accent }} />
            Brut nécessaire avant impôt :{" "}
            <span className="font-mono tabular-nums">
              {fmtMoney(result.grossAnnual)} $
            </span>{" "}
            / an
          </div>
          <div className="mt-0.5 text-[9.5px] italic leading-relaxed text-zinc-400">
            Calcul indicatif. Ne tient pas compte de la croissance future du
            dividende ni des frais de courtage.
          </div>
        </div>
      </div>
    </div>
  );
}
