"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

/**
 * TimeFraction = "afficher la valeur par seconde / minute / heure / jour /
 * semaine / mois / an". Permet aux investisseurs de visualiser une métrique
 * annuelle sous un autre angle (ex : "Alphabet génère $1859 / seconde").
 *
 * IMPORTANT : la valeur de base reste annuelle (history[i] = année i).
 * On divise juste pour l'affichage. Les YoY% restent identiques peu importe
 * la fraction de temps choisie (c'est un ratio, pas affecté par l'unité).
 */

export type TimeFraction = "year" | "month" | "week" | "day" | "hour" | "minute" | "second";

const FRACTIONS: { id: TimeFraction; divisor: number; key: string }[] = [
  { id: "year",   divisor: 1,            key: "timefrac.year" },
  { id: "month",  divisor: 12,           key: "timefrac.month" },
  { id: "week",   divisor: 52,           key: "timefrac.week" },
  { id: "day",    divisor: 365,          key: "timefrac.day" },
  { id: "hour",   divisor: 365 * 24,     key: "timefrac.hour" },
  { id: "minute", divisor: 365 * 24 * 60,           key: "timefrac.minute" },
  { id: "second", divisor: 365 * 24 * 60 * 60,      key: "timefrac.second" },
];

/** Diviseur pour transformer une valeur annuelle en valeur par fraction. */
export function timeFractionDivisor(f: TimeFraction): number {
  return FRACTIONS.find((x) => x.id === f)?.divisor ?? 1;
}

/** Toggle UI compact (segments cliquables). */
export function TimeFractionToggle({
  value,
  onChange,
  accent = "#a78bfa",
  align = "right",
}: {
  value: TimeFraction;
  onChange: (next: TimeFraction) => void;
  accent?: string;
  align?: "left" | "right";
}) {
  const { t } = useT();
  const [showInfo, setShowInfo] = useState(false);

  return (
    <div className="inline-flex flex-wrap items-center gap-1.5">
      <span className="inline-flex items-center gap-1 font-mono text-[10.5px] uppercase tracking-wider text-zinc-500">
        {t("timefrac.label")}
        <button
          type="button"
          onClick={() => setShowInfo((v) => !v)}
          aria-label="info"
          className="inline-flex size-3.5 items-center justify-center rounded-full border border-zinc-700 text-zinc-500 transition-colors hover:border-zinc-500 hover:text-zinc-300"
          title={t("timefrac.tooltip")}
        >
          <Info className="size-2.5" />
        </button>
      </span>
      <div
        role="tablist"
        className="inline-flex items-center gap-0.5 rounded-full border border-white/10 bg-white/[0.02] p-0.5"
      >
        {FRACTIONS.map((f) => {
          const active = value === f.id;
          return (
            <button
              key={f.id}
              role="tab"
              aria-selected={active}
              onClick={() => onChange(f.id)}
              className={cn(
                "rounded-full px-2 py-0.5 text-[10.5px] font-medium transition-colors",
                active ? "text-zinc-100" : "text-zinc-500 hover:text-zinc-200"
              )}
              style={active ? { background: `${accent}25`, border: `1px solid ${accent}55` } : undefined}
            >
              {t(f.key)}
            </button>
          );
        })}
      </div>
      {showInfo && (
        <div
          className={cn(
            "absolute z-50 mt-7 max-w-xs rounded-lg border border-white/15 bg-[#0c0c10] p-3 text-[11.5px] leading-relaxed text-zinc-200 shadow-2xl",
            align === "right" ? "right-0" : "left-0"
          )}
          style={{ position: "absolute" }}
        >
          {t("timefrac.tooltip")}
        </div>
      )}
    </div>
  );
}

/** Format human-friendly d'une valeur sous une fraction de temps donnée.
 *  Ex : 58.71 (Mds $) / an, "second" → 1.86 ; (avec 2 décimales).
 *  Pour des valeurs très petites (< 1), on monte à 4 décimales. */
export function formatTimeFracValue(annualValue: number, fraction: TimeFraction): string {
  const v = annualValue / timeFractionDivisor(fraction);
  if (Math.abs(v) >= 100) return v.toLocaleString("fr-FR", { maximumFractionDigits: 0 });
  if (Math.abs(v) >= 1) return v.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
  return v.toLocaleString("fr-FR", { maximumFractionDigits: 4 });
}
