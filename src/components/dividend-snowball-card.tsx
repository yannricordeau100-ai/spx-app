"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useInView } from "motion/react";
import { Snowflake } from "lucide-react";
import { type Currency, CURRENCY_SYMBOL } from "@/lib/currency";
import { InfoTooltip } from "@/components/info-tooltip";
import { useT } from "@/lib/i18n/provider";

/**
 * Card 3 du bloc Stories Dividendes : "Boule de neige composée" (DRIP).
 *
 * Refonte 8 mai 2026 (Yann) :
 *  - Comparaisons localisées vs alternatives par pays user (Livret A FR /
 *    Treasury 10Y USA / 3e pilier CH / Tagesgeldkonto DE / Bond 10Y monde
 *    par défaut). Inflation (~2.5 %) toujours en plus pour la PV réelle.
 *  - 3 courbes animées qui se dessinent en parallèle : action / alternative
 *    locale / inflation. Visualisation de la sur-performance.
 *  - NumberTicker sur les chiffres clés.
 *  - Halo dynamique au hover.
 *  - Dropdown "Comparer à" pour changer manuellement la référence.
 */

type CompareKey = "livret-a" | "treasury-10y" | "pilier-3a" | "tagesgeld" | "bond-10y-monde" | "sp500-avg";

type ComparePreset = {
  key: CompareKey;
  label: string;
  rate: number;
  countries?: string[];
};

const PRESETS: ComparePreset[] = [
  { key: "livret-a", label: "Livret A (FR)", rate: 2.5, countries: ["FR"] },
  { key: "treasury-10y", label: "Treasury 10 ans (US)", rate: 4.5, countries: ["US"] },
  { key: "pilier-3a", label: "3e pilier 3a (CH)", rate: 2.0, countries: ["CH"] },
  { key: "tagesgeld", label: "Tagesgeldkonto (DE)", rate: 3.0, countries: ["DE", "AT"] },
  { key: "bond-10y-monde", label: "Bond 10 ans monde", rate: 3.5 },
  { key: "sp500-avg", label: "S&P 500 (~7 %)", rate: 7.0 },
];

const INFLATION = 2.5; // moyenne 2026

function detectCountry(): string {
  if (typeof navigator === "undefined") return "FR";
  const lang = navigator.language || "fr-FR";
  const part = lang.split("-")[1];
  return (part || "FR").toUpperCase();
}

function pickDefaultPreset(country: string): CompareKey {
  for (const p of PRESETS) {
    if (p.countries && p.countries.includes(country)) return p.key;
  }
  return "bond-10y-monde";
}

function NumberTicker({
  value,
  decimals = 0,
  duration = 1100,
}: {
  value: number;
  decimals?: number;
  duration?: number;
}) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: false, margin: "-10%" });
  // Re-trigger when value changes (e.g. user moves slider)
  useEffect(() => {
    if (!inView) return;
    const start = performance.now();
    const from = display;
    let raf = 0;
    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(from + (value - from) * eased);
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, inView]);
  return (
    <span ref={ref} className="tabular-nums">
      {display.toLocaleString("fr-FR", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
    </span>
  );
}

export function DividendSnowballCard({
  accent,
  glow,
  yieldPct,
  currency = "USD",
  rate = 1,
}: {
  accent: string;
  glow: string;
  yieldPct: number;
  /** Devise d'affichage centralisée par le parent. */
  currency?: Currency;
  /** Taux nativeCurrency → currency (passé du parent). */
  rate?: number;
}) {
  const { t } = useT();
  const sym = CURRENCY_SYMBOL[currency];
  const [initial, setInitial] = useState<number>(1000);
  const [years, setYears] = useState<number>(20);
  const [totalReturn, setTotalReturn] = useState<number>(8); // % annuel total action

  const [country, setCountry] = useState<string>("FR");
  const [compareKey, setCompareKey] = useState<CompareKey>("livret-a");
  useEffect(() => {
    const c = detectCountry();
    setCountry(c);
    setCompareKey(pickDefaultPreset(c));
  }, []);

  const comparePreset = PRESETS.find((p) => p.key === compareKey) ?? PRESETS[0];
  const compareRate = comparePreset.rate;

  const containerRef = useRef<HTMLDivElement>(null);
  const inView = useInView(containerRef, { once: true, margin: "-10%" });

  // 3 séries : action, alternative locale, inflation (capital "réel")
  const series = useMemo(() => {
    const action: number[] = [];
    const alt: number[] = [];
    const inflation: number[] = [];
    const rA = totalReturn / 100;
    const rAlt = compareRate / 100;
    const rInf = INFLATION / 100;
    for (let i = 0; i <= years; i++) {
      action.push(initial * Math.pow(1 + rA, i));
      alt.push(initial * Math.pow(1 + rAlt, i));
      inflation.push(initial * Math.pow(1 + rInf, i));
    }
    return { action, alt, inflation };
  }, [initial, years, totalReturn, compareRate]);

  const finalAction = series.action[years];
  const finalAlt = series.alt[years];
  const finalIncome = (finalAction * yieldPct) / 100;
  const surplus = finalAction - finalAlt;

  // SVG chart
  const W = 320;
  const H = 90;
  const PAD_X = 4;
  const PAD_Y = 6;
  const max = Math.max(finalAction, finalAlt, series.inflation[years]);

  function makePath(arr: number[]): string {
    return arr
      .map((v, i) => {
        const x = PAD_X + (i / years) * (W - 2 * PAD_X);
        const y = H - PAD_Y - (v / max) * (H - 2 * PAD_Y);
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  }
  const pathAction = makePath(series.action);
  const pathAlt = makePath(series.alt);
  const pathInflation = makePath(series.inflation);
  const areaAction = `${pathAction} L${W - PAD_X},${H - PAD_Y} L${PAD_X},${H - PAD_Y} Z`;

  const fmtMoney = (n: number) =>
    n.toLocaleString("fr-FR", {
      maximumFractionDigits: n >= 1000 ? 0 : 1,
      minimumFractionDigits: 0,
    });

  // Halo qui suit la souris
  const [halo, setHalo] = useState<{ x: number; y: number } | null>(null);

  return (
    <div
      ref={containerRef}
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setHalo({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      }}
      onMouseLeave={() => setHalo(null)}
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
      {halo && (
        <div
          aria-hidden
          className="pointer-events-none absolute size-48 rounded-full blur-3xl transition-opacity"
          style={{
            left: halo.x - 96,
            top: halo.y - 96,
            background: `radial-gradient(circle, ${accent}40 0%, transparent 70%)`,
          }}
        />
      )}

      <div className="relative flex h-full flex-col overflow-y-auto pr-1">
        <div
          className="ml-auto inline-flex w-fit items-center gap-1 rounded-full border px-2 py-0.5 text-[12px] font-semibold uppercase tracking-[0.14em] opacity-90"
          style={{ background: `${accent}14`, color: accent, borderColor: `${accent}40` }}
        >
          <Snowflake className="size-3.5" />
          {t("div.snowball.badge")}
        </div>

        <div className="mt-3 flex items-center gap-1.5 text-[18px] font-bold leading-tight text-zinc-50">
          {t("div.snowball.title")}
          <span className="text-[14px] font-normal text-zinc-400">(DRIP)</span>
          <InfoTooltip color={accent} size="sm">
            <div className="text-zinc-200">
              <span className="font-semibold">DRIP</span> = Dividend Reinvestment
              Plan. Au lieu de prendre tes dividendes en cash, tu rachètes
              automatiquement plus d&apos;actions de la société. Tu touches
              alors plus de dividendes l&apos;année suivante, qui rachètent
              plus d&apos;actions, etc. C&apos;est l&apos;effet boule de neige.
            </div>
          </InfoTooltip>
        </div>
        <div className="text-[13px] italic text-zinc-400">
          Effet boule de neige sur {years} ans, vs {comparePreset.label}
        </div>

        {/* Sortie principale : multiplicateur + capital final */}
        <div className="mt-2 flex flex-col items-center">
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={inView ? { scale: 1, opacity: 1 } : {}}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="font-display font-bold leading-none tracking-tight gradient-text tabular-nums"
            style={{ fontSize: "clamp(36px, 13vw, 56px)" }}
          >
            ×<NumberTicker value={finalAction / initial} decimals={1} duration={1000} />
          </motion.div>
          <div className="mt-0.5 text-[14px] font-medium text-zinc-200">
            {fmtMoney(initial * rate)} {sym} → <NumberTicker value={finalAction * rate} decimals={0} /> {sym}
          </div>
          <div className="mt-1 inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[13px] font-semibold text-emerald-200">
            <span className="font-mono tabular-nums">
              + <NumberTicker value={finalIncome * rate} decimals={0} /> {sym} / an
            </span>
            <span className="text-[12px] italic text-zinc-400">de revenu à terme</span>
          </div>
        </div>

        {/* Comparaison : 3 courbes superposées avec légende */}
        <div className="mt-2 rounded-xl border border-white/10 bg-black/30 p-2 backdrop-blur">
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="font-mono text-[11.5px] uppercase tracking-[0.12em] text-zinc-400">
              Action vs alternatives
            </span>
            <select
              value={compareKey}
              onChange={(e) => setCompareKey(e.target.value as CompareKey)}
              className="rounded border border-white/10 bg-black/60 px-1.5 py-0.5 font-mono text-[11.5px] text-zinc-200 outline-none focus:border-white/30"
              title="Choisir la référence de comparaison"
            >
              {PRESETS.map((p) => (
                <option key={p.key} value={p.key} className="bg-black">
                  {p.label} · {p.rate.toString().replace(".", ",")} %
                </option>
              ))}
            </select>
          </div>
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
            <defs>
              <linearGradient id="snow-area-action" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={accent} stopOpacity="0.4" />
                <stop offset="100%" stopColor={accent} stopOpacity="0" />
              </linearGradient>
            </defs>
            {/* Aire sous courbe action */}
            <motion.path
              d={areaAction}
              fill="url(#snow-area-action)"
              initial={{ opacity: 0 }}
              animate={inView ? { opacity: 1 } : {}}
              transition={{ delay: 0.4, duration: 0.6 }}
            />
            {/* Inflation : trait pointillé gris */}
            <motion.path
              d={pathInflation}
              fill="none"
              stroke="#71717a"
              strokeWidth={1.4}
              strokeDasharray="3 3"
              initial={{ pathLength: 0 }}
              animate={inView ? { pathLength: 1 } : {}}
              transition={{ duration: 1.0, delay: 0.2 }}
            />
            {/* Alternative : trait fin émeraude */}
            <motion.path
              d={pathAlt}
              fill="none"
              stroke="#10b981"
              strokeWidth={1.6}
              initial={{ pathLength: 0 }}
              animate={inView ? { pathLength: 1 } : {}}
              transition={{ duration: 1.0, delay: 0.3 }}
            />
            {/* Action : trait épais accent */}
            <motion.path
              d={pathAction}
              fill="none"
              stroke={accent}
              strokeWidth={2.2}
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              animate={inView ? { pathLength: 1 } : {}}
              transition={{ duration: 1.2, delay: 0.5 }}
            />
            {/* Marqueur final action */}
            <motion.circle
              cx={W - PAD_X}
              cy={H - PAD_Y - (finalAction / max) * (H - 2 * PAD_Y)}
              r={3.5}
              fill={accent}
              stroke="#fff"
              strokeWidth={1.5}
              initial={{ scale: 0 }}
              animate={inView ? { scale: 1 } : {}}
              transition={{ delay: 1.5, duration: 0.4 }}
            />
          </svg>
          {/* Légende */}
          <div className="mt-1 flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 text-[12px] tabular-nums">
            <div className="flex items-center gap-1">
              <span className="inline-block h-[3px] w-3 rounded" style={{ background: accent }} />
              <span className="text-zinc-200">Action {totalReturn} %</span>
              <span className="text-zinc-300">{fmtMoney(finalAction * rate)} {sym}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="inline-block h-[2px] w-3 rounded bg-emerald-500" />
              <span className="text-zinc-300">{compareRate} %</span>
              <span className="text-zinc-400">{fmtMoney(finalAlt * rate)} {sym}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="inline-block h-[2px] w-3 rounded border-t border-dashed border-zinc-500" />
              <span className="text-zinc-400">Inflation {INFLATION} %</span>
            </div>
          </div>
          {/* Surplus mis en avant */}
          {surplus > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 1.7, duration: 0.4 }}
              className="mt-1.5 rounded-md bg-emerald-500/10 px-2 py-1 text-center text-[13px]"
            >
              <span className="text-emerald-200">
                +{fmtMoney(surplus * rate)} {sym} vs {comparePreset.label.split(" (")[0]}
              </span>
            </motion.div>
          )}
        </div>

        {/* Sliders : mise / durée / rendement */}
        <div className="mt-2 space-y-1.5 text-[13px]">
          <div className="rounded-lg border border-white/10 bg-black/30 p-1.5 backdrop-blur">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[12px] uppercase tracking-wider text-zinc-400">
                Mise initiale
              </span>
              <input
                type="number"
                min={100}
                step={100}
                value={initial}
                onChange={(e) => setInitial(Math.max(100, Number(e.target.value) || 100))}
                className="w-20 rounded border border-white/10 bg-black/50 px-1 py-0.5 font-mono text-[13px] tabular-nums text-zinc-100 outline-none focus:border-white/30"
              />
            </div>
            <input
              type="range"
              min={100}
              max={50000}
              step={100}
              value={initial}
              onChange={(e) => setInitial(Number(e.target.value))}
              className="mt-0.5 h-1 w-full cursor-pointer accent-[var(--accent-color)]"
              style={{ ["--accent-color" as string]: accent }}
            />
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <div className="rounded-lg border border-white/10 bg-black/30 p-1.5 backdrop-blur">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[12px] uppercase tracking-wider text-zinc-400">
                  Durée
                </span>
                <span className="font-mono tabular-nums text-zinc-100">{years} ans</span>
              </div>
              <input
                type="range"
                min={5}
                max={40}
                step={1}
                value={years}
                onChange={(e) => setYears(Number(e.target.value))}
                className="mt-0.5 h-1 w-full cursor-pointer accent-[var(--accent-color)]"
                style={{ ["--accent-color" as string]: accent }}
              />
            </div>
            <div className="rounded-lg border border-white/10 bg-black/30 p-1.5 backdrop-blur">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[12px] uppercase tracking-wider text-zinc-400">
                  Rendement
                </span>
                <span className="font-mono tabular-nums text-zinc-100">
                  {totalReturn}%
                </span>
              </div>
              <input
                type="range"
                min={2}
                max={15}
                step={0.5}
                value={totalReturn}
                onChange={(e) => setTotalReturn(Number(e.target.value))}
                className="mt-0.5 h-1 w-full cursor-pointer accent-[var(--accent-color)]"
                style={{ ["--accent-color" as string]: accent }}
              />
            </div>
          </div>
        </div>

        <div className="mt-1 text-[11.5px] italic leading-snug text-zinc-500">
          Hypothèses : réinvestissement intégral des dividendes, rendement
          stable. Indicatif. Pays détecté : {country}.
        </div>
      </div>
    </div>
  );
}
