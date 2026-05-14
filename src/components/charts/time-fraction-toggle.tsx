"use client";

import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";
import { InfoTooltip } from "@/components/info-tooltip";

/**
 * TimeFraction = "afficher la valeur par seconde / minute / heure / jour /
 * semaine / mois / an". Permet aux investisseurs de visualiser une métrique
 * annuelle sous un autre angle (ex : "Alphabet génère X $ par seconde").
 *
 * Le diviseur est appliqué aux valeurs (data + ttm). YoY% inchangés.
 * L'unité est automatiquement rescalée (Md$ -> $ -> ¢) pour garder valeur >= 1.
 */

// Yann 13 mai 2026 v2 : retrait des fractions "exotiques" (S/J/H/m/s).
// Garde A (année) + M (mois) uniquement. Raison : un investisseur sérieux
// ne raisonne pas en revenu "par seconde" — ce n'est ni le standard de
// l'industrie (Bloomberg/FT/WSJ), ni utile pour la décision.
// Type encore "year" | "month" + valeurs legacy gardées pour rétro-compat
// (datasets qui pourraient référencer "week", "day", etc.).
export type TimeFraction = "year" | "month" | "week" | "day" | "hour" | "minute" | "second";

// Yann 15 mai 2026 : restaurer S/J/H/m/s. Le toggle n'est affiché que pour
// les chartes Courbe/Barres avec KPI de type FLUX (isTimeFractionApplicableKpi
// dans company-view.tsx), donc pas de risque d'afficher "Margin par seconde".
const FRACTIONS: { id: TimeFraction; divisor: number; key: string }[] = [
  { id: "year",   divisor: 1,                          key: "timefrac.year" },
  { id: "month",  divisor: 12,                         key: "timefrac.month" },
  { id: "week",   divisor: 52,                         key: "timefrac.week" },
  { id: "day",    divisor: 365,                        key: "timefrac.day" },
  { id: "hour",   divisor: 365 * 24,                   key: "timefrac.hour" },
  { id: "minute", divisor: 365 * 24 * 60,              key: "timefrac.minute" },
  { id: "second", divisor: 365 * 24 * 60 * 60,         key: "timefrac.second" },
];

/** Diviseurs legacy (rétro-compat avec datasets/state qui mentionnent
 *  encore week/day/hour/minute/second). Internalisé, plus exposé en UI. */
const _LEGACY_DIVISORS: Record<TimeFraction, number> = {
  year: 1,
  month: 12,
  week: 52,
  day: 365,
  hour: 365 * 24,
  minute: 365 * 24 * 60,
  second: 365 * 24 * 60 * 60,
};

/** Diviseur pour transformer une valeur annuelle en valeur par fraction.
 *  Utilise la map legacy pour rester compatible avec d'éventuels états
 *  utilisateurs (cookie, user_metadata) qui contiendraient "week"/"day"/etc. */
export function timeFractionDivisor(f: TimeFraction): number {
  return _LEGACY_DIVISORS[f] ?? 1;
}

/** Toggle UI compact (segments cliquables) avec InfoTooltip rich style. */
export function TimeFractionToggle({
  value,
  onChange,
  accent = "#a78bfa",
}: {
  value: TimeFraction;
  onChange: (next: TimeFraction) => void;
  accent?: string;
}) {
  const { t } = useT();

  return (
    <div className="inline-flex flex-wrap items-center gap-1.5">
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
      {/* Tooltip "i" placé à droite des onglets (au lieu de gauche). Le
          libellé "Voir la valeur par" est désormais uniquement dans le
          tooltip, plus en dehors. */}
      <InfoTooltip color={accent} align="right" size="sm">
        <div className="mb-1 font-mono text-[10px] uppercase tracking-wider" style={{ color: accent }}>
          {t("timefrac.label")}
        </div>
        <div className="text-[12px] leading-relaxed text-zinc-200">
          {t("timefrac.tooltip")}
        </div>
      </InfoTooltip>
    </div>
  );
}
