"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "motion/react";
import { Crown, TrendingUp } from "lucide-react";
import { InfoTooltip } from "@/components/info-tooltip";
import { formatUnit } from "@/lib/data";
import { useT } from "@/lib/i18n/provider";

/**
 * Card 1 : "Aristocrat Streak".
 *
 * Refonte 8 mai 2026 (V3) :
 *  - CAGR multi-périodes : 5 / 10 / 20 / 50 ans (selon historique dispo)
 *  - Affichage même si stagnation/baisse (juste signe différent)
 *  - Si versement coupé : indique 1ère année + coupures + raisons (champ
 *    optionnel `dividend_meta`)
 *  - Tooltip "i" sur Aristocrat, CAGR, Payout pour expliquer aux débutants
 *  - Mini-courbe DPS history animée
 *  - "31 ans" focal animé scale au mount
 *  - Halo dynamique au hover
 */

export type DividendMeta = {
  /** Année de premier versement de dividende (narratif 10-K). */
  first_year?: number;
  /** Année du premier point dans le flux XBRL SEC (≥ 2008 typiquement). */
  first_year_xbrl?: number;
  /** Liste des coupures (interruption ou suppression). */
  cuts?: Array<{ year: number; reason: string }>;
  /** Streak XBRL : nombre d'années consécutives strictement croissantes. */
  years_streak_increases?: number;
  /** Historique XBRL DPS année par année (clés string YYYY, valeurs USD/action). */
  dps_xbrl_history?: Record<string, number>;
};

function NumberTicker({
  value,
  decimals = 0,
  suffix = "",
  duration = 1100,
}: {
  value: number;
  decimals?: number;
  suffix?: string;
  duration?: number;
}) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10%" });
  useEffect(() => {
    if (!inView) return;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(value * eased);
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, value, duration]);
  return (
    <span ref={ref} className="tabular-nums">
      {display.toLocaleString("fr-FR", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
      {suffix}
    </span>
  );
}

/**
 * CAGR sur N ans depuis la fin de l'historique.
 * Retourne null si l'historique disponible est trop court pour cette période.
 */
function cagrPeriod(history: number[], periodYears: number): number | null {
  if (history.length < periodYears + 1) return null;
  const slice = history.slice(history.length - periodYears - 1);
  const start = slice[0];
  const end = slice[slice.length - 1];
  if (start <= 0) return null;
  return (Math.pow(end / start, 1 / periodYears) - 1) * 100;
}

export function DividendAristocratCard({
  accent,
  glow,
  dps,
  dpsYoy,
  dpsHistory,
  capReturn,
  capReturnUnit,
  payoutRatio,
  yearsStreak,
  meta,
  epsHistory,
  epsUnit,
}: {
  accent: string;
  glow: string;
  dps: number;
  dpsYoy: string;
  dpsHistory: number[];
  capReturn: number;
  capReturnUnit: string;
  payoutRatio: number;
  /** Si fourni → utilisé en valeur figée. Sinon calculé depuis meta.first_year. */
  yearsStreak?: number;
  /** Historique étendu : 1ère année + coupures éventuelles. */
  meta?: DividendMeta;
  /** Yann 21 mai 2026 : EPS Diluted history pour superposer à la mini-courbe DPS.
   *  Permet de visualiser le payout (gap DPS-EPS = bénéfice non distribué).
   *  Si absent : seule la courbe DPS est affichée. */
  epsHistory?: number[];
  /** Devise EPS (par défaut même que DPS unit). */
  epsUnit?: string;
}) {
  const { t } = useT();
  // yearsStreak dynamique : si non fourni en prop, calculer depuis
  // meta.first_year (si dispo). Si aucun des deux : null = ne pas afficher
  // la mention "X ans de hausse" (pas de fallback hardcodé sur des stés
  // dont on ne sait rien) — règle CONV-DIV 9 mai 2026.
  const computedStreak: number | null = (() => {
    if (typeof yearsStreak === "number" && yearsStreak > 0) return yearsStreak;
    const firstYear = meta?.first_year;
    if (typeof firstYear === "number" && firstYear > 1900) {
      const currentYear = new Date().getFullYear();
      const diff = currentYear - firstYear;
      return diff > 0 ? diff : null;
    }
    return null;
  })();
  const containerRef = useRef<HTMLDivElement>(null);
  const inView = useInView(containerRef, { once: true, margin: "-10%" });

  const n = dpsHistory.length;

  // ─────── CAGR multi-périodes (Yann 19 mai 2026) ───────
  // Étend le calcul au-delà des 5 ans de `dpsHistory` en utilisant l'historique
  // XBRL SEC stocké dans `meta.dps_xbrl_history` (jusqu'à ~18 ans pour stés US).
  // Périodes affichées : 5 / 10 / 20 ans + "depuis création" (= depuis
  // `meta.first_year` ou première année avec data XBRL).
  // Compute "extended history" : merge dpsHistory (5 ans) avec XBRL
  // (year→value) dict. Le dpsHistory récent reste la source de vérité pour les
  // 5 derniers points (le XBRL peut être partiel pour l'année en cours).
  const xbrlHist = meta?.dps_xbrl_history;
  const extendedByYear: Record<number, number> = {};
  if (xbrlHist) {
    for (const [k, v] of Object.entries(xbrlHist)) {
      const y = parseInt(k, 10);
      if (Number.isFinite(y) && typeof v === "number" && v > 0) {
        extendedByYear[y] = v;
      }
    }
  }
  // Le dernier point du dpsHistory représente l'année la plus récente. On
  // tente de retrouver l'année via meta ou via le max XBRL year + 1 si le
  // XBRL est en retard. Fallback : on prend l'année courante.
  const xbrlYears = Object.keys(extendedByYear).map(Number).sort((a, b) => a - b);
  const xbrlMaxYear = xbrlYears.length > 0 ? xbrlYears[xbrlYears.length - 1] : null;
  const currentYear = new Date().getFullYear();
  // Année du dernier point dpsHistory : on aligne sur xbrlMaxYear si proche,
  // sinon on prend currentYear - 1 (FY clos).
  const lastDpsYear =
    xbrlMaxYear !== null && xbrlMaxYear >= currentYear - 2
      ? xbrlMaxYear
      : currentYear - 1;
  // Inject les 5 ans dpsHistory dans extendedByYear (override XBRL si conflit).
  // L'alignement : dpsHistory[n-1] = lastDpsYear, dpsHistory[0] = lastDpsYear - (n-1).
  if (n >= 2) {
    for (let i = 0; i < n; i++) {
      const y = lastDpsYear - (n - 1 - i);
      const v = dpsHistory[i];
      if (typeof v === "number" && v > 0) extendedByYear[y] = v;
    }
  }
  const allYears = Object.keys(extendedByYear).map(Number).sort((a, b) => a - b);
  const lastYear = allYears.length > 0 ? allYears[allYears.length - 1] : lastDpsYear;
  const firstYearAvail = allYears.length > 0 ? allYears[0] : lastYear;

  /** Compute CAGR over N years ending at lastYear, using extendedByYear. */
  function cagrYears(periodYears: number): number | null {
    const startYear = lastYear - periodYears;
    const start = extendedByYear[startYear];
    const end = extendedByYear[lastYear];
    if (!start || !end || start <= 0) return null;
    return (Math.pow(end / start, 1 / periodYears) - 1) * 100;
  }
  /** CAGR "depuis création" : prend le premier point dispo dans extendedByYear. */
  function cagrSinceFirst(): { value: number | null; years: number; from: number } {
    const start = extendedByYear[firstYearAvail];
    const end = extendedByYear[lastYear];
    const years = lastYear - firstYearAvail;
    if (!start || !end || start <= 0 || years < 1) {
      return { value: null, years, from: firstYearAvail };
    }
    return {
      value: (Math.pow(end / start, 1 / years) - 1) * 100,
      years,
      from: firstYearAvail,
    };
  }

  const cagr5 = cagrYears(5);
  const cagr10 = cagrYears(10);
  const cagr20 = cagrYears(20);
  const cagrSince = cagrSinceFirst();

  // Fallback ancien comportement pour la "shoulder" en bas — utilisée par les
  // anciennes stés sans XBRL extended.
  const cagrFallback =
    n >= 2 && dpsHistory[0] > 0
      ? (Math.pow(dpsHistory[n - 1] / dpsHistory[0], 1 / (n - 1)) - 1) * 100
      : null;
  const cagrShown = cagr5 ?? cagrFallback;

  // Mini-courbe SVG
  const W = 280;
  const H = 56;
  const PAD = 6;
  // Si epsHistory fourni : on aligne le range Y sur le MAX(DPS, EPS) pour
  // garder les 2 courbes à l'échelle relative correcte (visu directe du gap
  // EPS - DPS = bénéfice non distribué = inverse du payout ratio).
  const hasEps =
    Array.isArray(epsHistory) &&
    epsHistory.length === dpsHistory.length &&
    epsHistory.every((v) => typeof v === "number" && Number.isFinite(v));
  const allValues = hasEps ? [...dpsHistory, ...epsHistory!] : dpsHistory;
  const minV = Math.min(...allValues);
  const maxV = Math.max(...allValues);
  const range = maxV - minV || 1;
  const points = dpsHistory.map((v, i) => {
    const x = PAD + (i / (n - 1 || 1)) * (W - 2 * PAD);
    const y = H - PAD - ((v - minV) / range) * (H - 2 * PAD);
    return { x, y, v };
  });
  const pathD = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");
  const epsPoints = hasEps
    ? epsHistory!.map((v, i) => {
        const x = PAD + (i / (n - 1 || 1)) * (W - 2 * PAD);
        const y = H - PAD - ((v - minV) / range) * (H - 2 * PAD);
        return { x, y, v };
      })
    : [];
  const epsPathD = epsPoints
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");

  const [halo, setHalo] = useState<{ x: number; y: number } | null>(null);

  // Affichage adaptatif des CAGR multi-périodes (Yann 19 mai 2026) :
  //  - 5 ans, 10 ans, 20 ans (depuis le pipeline XBRL SEC quand dispo)
  //  - "depuis création" du dividende (label "Depuis YYYY" basé sur
  //    meta.first_year si fourni, sinon firstYearAvail XBRL)
  // Une période sans valeur n'est pas grisée — elle est simplement omise.
  // Dédup : si "20 ans" et "depuis création" couvrent ≈ la même période,
  // on ne montre que la plus longue avec le label le plus parlant.
  const sinceLabel =
    meta?.first_year && meta.first_year < firstYearAvail
      ? `Depuis ${meta.first_year}`
      : `Depuis ${firstYearAvail}`;
  // Important : on récupère le firstYear "humain" (narratif 10-K) pour la
  // mention "Versement depuis YYYY" plus haut dans la card. Différent du
  // firstYearAvail qui est limité par la couverture XBRL.
  const firstYear = meta?.first_year ?? firstYearAvail;

  const rawCagrLines: Array<{ label: string; value: number | null; years?: number }> = [
    { label: "5 ans", value: cagr5, years: 5 },
    { label: "10 ans", value: cagr10, years: 10 },
    { label: "20 ans", value: cagr20, years: 20 },
    { label: sinceLabel, value: cagrSince.value, years: cagrSince.years },
  ];
  // Filter null + dédup si "X ans" et "Depuis YYYY" représentent le même delta.
  const cagrLines: Array<{ label: string; value: number | null }> = [];
  const seenYears = new Set<number>();
  for (const c of rawCagrLines) {
    if (c.value == null) continue;
    if (c.years && seenYears.has(c.years)) continue;
    if (c.years) seenYears.add(c.years);
    cagrLines.push({ label: c.label, value: c.value });
  }
  // Si AUCUNE CAGR n'est dispo (historique <2 ans), on garde au moins une
  // case "Total" avec le calcul disponible pour ne pas avoir un bloc vide.
  if (cagrLines.length === 0 && n >= 2) {
    cagrLines.push({ label: `${n - 1} ans`, value: cagrFallback });
  }

  const cuts = meta?.cuts ?? [];
  /** Détecte coupure : présent dans meta.cuts OU baisse stricte d'une année
   *  à l'autre dans l'historique XBRL. Source de vérité pour la mention au
   *  bas de la card. */
  function detectCut(): { cut: boolean; year?: number; reason?: string } {
    if (cuts && cuts.length > 0) {
      const last = cuts[cuts.length - 1];
      return { cut: true, year: last.year, reason: last.reason };
    }
    // Yann 27 mai 2026 : ignorer l'année courante incomplète + années null/0.
    // GOOGL DPS 2026 = null (année non finie) déclenchait un faux "cut".
    const currentYear = new Date().getFullYear();
    for (let i = 1; i < allYears.length; i++) {
      const curYear = allYears[i];
      if (curYear >= currentYear) continue; // skip année incomplète
      const cur = extendedByYear[curYear];
      const prev = extendedByYear[allYears[i - 1]];
      if (cur == null || prev == null || cur === 0 || prev === 0) continue;
      if (cur < prev * 0.95) {
        return { cut: true, year: curYear };
      }
    }
    return { cut: false };
  }
  const cutInfo = detectCut();

  return (
    <div
      ref={containerRef}
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setHalo({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      }}
      onMouseLeave={() => setHalo(null)}
      className="relative flex h-full flex-col overflow-hidden rounded-[28px] bg-gradient-to-br from-[#101015] via-[#0a0a0e] to-[#060608] px-5 pb-5 pt-12"
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
        {/* Badge "Aristocrat" — UNIFORME À DROITE */}
        <div
          className="ml-auto inline-flex w-fit items-center gap-1 rounded-full border px-2 py-0.5 text-[12px] font-semibold uppercase tracking-[0.14em] opacity-90"
          style={{ background: `${accent}14`, color: accent, borderColor: `${accent}40` }}
        >
          <Crown className="size-3.5" />
          Aristocrat
          <InfoTooltip color={accent} size="sm">
            <div className="text-zinc-200">
              <span className="font-semibold">Dividend Aristocrat</span> : société
              qui a augmenté son dividende chaque année pendant au moins 25 ans
              consécutifs. Statut rare qui prouve la solidité de la génération
              de cash sur le long terme et la discipline de retour aux
              actionnaires.
            </div>
          </InfoTooltip>
        </div>

        <div className="mt-3 text-[20px] font-bold leading-tight text-zinc-50">
          {computedStreak != null && computedStreak >= 25
            ? "Dividend Aristocrat"
            : t("div.aristocrat.title")}
        </div>
        <div className="text-[13.5px] italic text-zinc-400">
          {firstYear && computedStreak != null
            ? `Versement depuis ${firstYear} · ${computedStreak} ans de hausse`
            : firstYear
            ? `Versement depuis ${firstYear}`
            : computedStreak != null
            ? `Hausse continue depuis ${new Date().getFullYear() - computedStreak + 1}`
            : "Historique de hausse non documenté"}
        </div>

        {/* Focal central : "X ans" qui grossit, uniquement si on connaît
            le streak réel. Sinon on cache le focal et on saute aux KPIs. */}
        {computedStreak != null && (
        <div className="mt-3 mb-2 flex flex-col items-center">
          <motion.div
            initial={{ scale: 0.4, opacity: 0 }}
            animate={inView ? { scale: 1, opacity: 1 } : {}}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
            className="font-display font-bold leading-none tracking-tight gradient-text"
            style={{ fontSize: "clamp(60px, 18vw, 96px)" }}
          >
            <NumberTicker value={computedStreak} duration={1100} />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.6, duration: 0.5 }}
            className="mt-1 text-[15px] font-medium text-zinc-200"
          >
            {t("div.aristocrat.streak_label")}
          </motion.div>
        </div>
        )}

        {/* Mini-courbe DPS history (+ EPS superposé si dispo) */}
        <div className="rounded-xl border border-white/10 bg-black/40 p-2.5 backdrop-blur">
          <div className="mb-1 flex items-baseline justify-between gap-1">
            <div className="flex items-center gap-1">
              <span className="text-[12.5px] font-semibold uppercase tracking-[0.10em] text-zinc-300">
                {hasEps ? `DPS vs EPS · ${n} ans` : `DPS · ${n} dernières années`}
              </span>
              <InfoTooltip color={accent} size="sm">
                <div className="text-zinc-200">
                  <span className="font-semibold">DPS</span> = Dividend Per Share,
                  c&apos;est-à-dire le montant de dividende par action versé sur
                  une année.{hasEps ? (
                    <>
                      {" "}<span className="font-semibold">EPS</span> = Earnings
                      Per Share (bénéfice par action). L&apos;écart entre les
                      deux courbes correspond au bénéfice non distribué,
                      c&apos;est-à-dire ce qui reste dans l&apos;entreprise
                      pour réinvestir. Si DPS devient supérieur à EPS : danger
                      (dividende non couvert par les bénéfices).
                    </>
                  ) : (
                    " Si tu détiens 100 actions et le DPS est 5 €, tu reçois 500 € sur l'année."
                  )}
                </div>
              </InfoTooltip>
            </div>
            <span className="font-mono text-[12.5px] tabular-nums text-zinc-300">
              {dpsHistory[0].toFixed(2).replace(".", ",")} → {dpsHistory[n - 1].toFixed(2).replace(".", ",")}
            </span>
          </div>
          {hasEps && (
            <div className="mb-1 flex items-center gap-3 text-[11px] text-zinc-400">
              <span className="inline-flex items-center gap-1">
                <span className="inline-block h-[2px] w-3 rounded" style={{ background: accent }} />
                DPS
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="inline-block h-[2px] w-3 rounded border-t-2 border-dashed border-zinc-400" />
                EPS
              </span>
              <span className="ml-auto font-mono tabular-nums text-zinc-300">
                EPS {epsHistory![n - 1].toFixed(2).replace(".", ",")} {epsUnit ?? ""}
              </span>
            </div>
          )}
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
            <defs>
              <linearGradient id="dps-grad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={accent} stopOpacity="0.5" />
                <stop offset="100%" stopColor={accent} stopOpacity="1" />
              </linearGradient>
              <linearGradient id="dps-area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={accent} stopOpacity="0.35" />
                <stop offset="100%" stopColor={accent} stopOpacity="0" />
              </linearGradient>
            </defs>
            <motion.path
              d={`${pathD} L${W - PAD},${H - PAD} L${PAD},${H - PAD} Z`}
              fill="url(#dps-area)"
              initial={{ opacity: 0 }}
              animate={inView ? { opacity: 1 } : {}}
              transition={{ delay: 0.7, duration: 0.6 }}
            />
            <motion.path
              d={pathD}
              fill="none"
              stroke="url(#dps-grad)"
              strokeWidth={2.2}
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={inView ? { pathLength: 1 } : {}}
              transition={{ delay: 0.5, duration: 1.1, ease: "easeOut" }}
            />
            {points.map((p, i) => (
              <motion.circle
                key={i}
                cx={p.x}
                cy={p.y}
                r={2.5}
                fill={i === n - 1 ? "#fff" : accent}
                stroke={accent}
                strokeWidth={1}
                initial={{ scale: 0, opacity: 0 }}
                animate={inView ? { scale: 1, opacity: 1 } : {}}
                transition={{ delay: 0.7 + i * 0.12, duration: 0.3 }}
              />
            ))}
            {/* Courbe EPS superposée (pointillé, gris clair) si dispo */}
            {hasEps && (
              <>
                <motion.path
                  d={epsPathD}
                  fill="none"
                  stroke="rgba(228, 228, 231, 0.85)"
                  strokeWidth={1.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray="4 3"
                  initial={{ pathLength: 0 }}
                  animate={inView ? { pathLength: 1 } : {}}
                  transition={{ delay: 0.7, duration: 1.1, ease: "easeOut" }}
                />
                {epsPoints.map((p, i) => (
                  <motion.circle
                    key={`eps-${i}`}
                    cx={p.x}
                    cy={p.y}
                    r={2}
                    fill="#e4e4e7"
                    stroke="#a1a1aa"
                    strokeWidth={1}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={inView ? { scale: 1, opacity: 0.9 } : {}}
                    transition={{ delay: 0.9 + i * 0.12, duration: 0.3 }}
                  />
                ))}
              </>
            )}
          </svg>
        </div>

        {/* CAGR multi-périodes */}
        <div className="mt-2 rounded-xl border border-white/10 bg-black/40 p-2.5 backdrop-blur">
          <div className="mb-1.5 flex items-center gap-1">
            <span className="text-[12.5px] font-semibold uppercase tracking-[0.10em] text-zinc-300">
              {t("div.aristocrat.cagr_label")}
            </span>
            <InfoTooltip color={accent} size="sm">
              <div className="text-zinc-200">
                <span className="font-semibold">CAGR</span> = Compound Annual
                Growth Rate (taux de croissance annuel composé). Vitesse moyenne
                à laquelle le dividende a augmenté chaque année, comme si la
                hausse était régulière.
              </div>
            </InfoTooltip>
          </div>
          <div
            className="grid gap-1"
            style={{
              gridTemplateColumns: `repeat(${Math.max(1, cagrLines.length)}, minmax(0, 1fr))`,
            }}
          >
            {cagrLines.map((c) => {
              // Yann 19 mai 2026 : toutes les périodes sont maintenant
              // calculées avec données XBRL SEC réelles (plus de flou V2).
              return (
                <div
                  key={c.label}
                  className="relative rounded-md border border-white/10 bg-black/40 p-1.5 text-center"
                >
                  <div className="font-mono text-[11.5px] uppercase tracking-wider text-zinc-400">
                    {c.label}
                  </div>
                  <div
                    className={`mt-0.5 font-display text-[16px] font-bold leading-none tabular-nums ${
                      c.value == null
                        ? "text-zinc-600"
                        : c.value >= 0
                        ? "text-emerald-300"
                        : "text-rose-300"
                    }`}
                  >
                    {c.value == null ? "—" : `${c.value >= 0 ? "+" : ""}${c.value.toFixed(1).replace(".", ",")}`}
                  </div>
                  <div className="text-[11px] text-zinc-500">
                    {c.value == null ? "n.d." : "% / an"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Coupures de dividende (si présentes) */}
        {cuts.length > 0 && (
          <div className="mt-2 rounded-xl border border-amber-500/30 bg-amber-500/[0.06] p-2.5">
            <div className="text-[12.5px] font-semibold uppercase tracking-wider text-amber-300">
              Coupures historiques
            </div>
            <ul className="mt-1 space-y-0.5 text-[13px] text-amber-100/90">
              {cuts.map((c, i) => (
                <li key={i}>
                  <span className="font-mono">{c.year}</span> : {c.reason}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Mini-blocs Cap Return / Payout / DPS YoY */}
        <div className="mt-2 grid grid-cols-3 gap-2">
          <div className="rounded-xl border border-white/12 bg-black/45 p-2 backdrop-blur">
            <div className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-zinc-300">
              DPS
            </div>
            <div className="mt-0.5 font-display text-[16px] font-bold leading-none tabular-nums text-zinc-50">
              <NumberTicker value={dps} decimals={2} />
            </div>
            <div className="mt-0.5 text-[11.5px] text-emerald-300">{dpsYoy}</div>
          </div>
          <div className="rounded-xl border border-white/12 bg-black/45 p-2 backdrop-blur">
            <div className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-zinc-300">
              {t("div.aristocrat.cap_return_label")}
            </div>
            <div className="mt-0.5 font-display text-[16px] font-bold leading-none tabular-nums text-zinc-50">
              <NumberTicker value={capReturn} decimals={1} />
              <span className="ml-0.5 text-[12.5px] font-medium text-zinc-300">
                {formatUnit(capReturnUnit)}
              </span>
            </div>
            <div className="mt-0.5 text-[11px] italic text-zinc-400">{t("div.aristocrat.cap_return_detail")}</div>
          </div>
          <div className="rounded-xl border border-white/12 bg-black/45 p-2 backdrop-blur">
            <div className="flex items-center gap-1">
              <span className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-zinc-300">
                {t("div.aristocrat.payout_label")}
              </span>
              <InfoTooltip color={accent} size="sm">
                <div className="text-zinc-200">
                  <span className="font-semibold">Payout Ratio</span> = part du
                  bénéfice net qui est redistribué en dividendes (en %). Sain
                  entre 30 et 60 % pour une industrielle mature. Trop bas =
                  société peu généreuse. Trop haut = dividende fragile en cas
                  de baisse de bénéfice.
                </div>
              </InfoTooltip>
            </div>
            <div className="mt-0.5 font-display text-[16px] font-bold leading-none tabular-nums text-zinc-50">
              <NumberTicker value={payoutRatio} />
              <span className="ml-0.5 text-[12.5px] font-medium text-zinc-300">%</span>
            </div>
            {payoutRatio > 0 && Number.isFinite(payoutRatio) && (
              <div className="mt-0.5 text-[11px] italic text-zinc-400">
                couvert {(100 / payoutRatio).toFixed(1).replace(".", ",")}×
              </div>
            )}
          </div>
        </div>

        {/* Mention coupure du dividende (Yann 19 mai 2026), juste au-dessus du
            chip CAGR : "Dividende jamais coupé" ou "Dividende coupé en YYYY". */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.85, duration: 0.4 }}
          className={`mt-2.5 self-center text-[12px] font-medium ${
            cutInfo.cut ? "text-amber-300" : "text-emerald-300/90"
          }`}
        >
          {cutInfo.cut
            ? `⚠ Dividende coupé${cutInfo.year ? ` en ${cutInfo.year}` : ""}${
                cutInfo.reason ? ` : ${cutInfo.reason}` : ""
              }`
            : "✓ Dividende jamais coupé sur la période disponible"}
        </motion.div>

        {/* CAGR principal mis en avant en bas — masqué si pas calculable
            (ex AAPL dpsHistory[0]=0, ancien bug "+Infinity"). */}
        {cagrShown != null && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={inView ? { opacity: 1, scale: 1 } : {}}
            transition={{ delay: 0.9, duration: 0.4 }}
            className="mt-1.5 inline-flex items-center justify-center gap-1.5 self-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[14px] font-semibold text-emerald-200"
          >
            <TrendingUp className="size-4.5" />
            <span className="font-mono tabular-nums">
              CAGR <NumberTicker value={cagrShown} decimals={1} suffix=" % / an" duration={900} />
            </span>
            <span className="text-[12.5px] italic text-zinc-400">(sur {cagr5 != null ? "5" : n - 1} ans)</span>
          </motion.div>
        )}
      </div>
    </div>
  );
}
