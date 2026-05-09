"use client";

import { Info } from "lucide-react";
import { useT } from "@/lib/i18n/provider";
import { InfoTooltip } from "@/components/info-tooltip";

/**
 * Avertissement IPO récente. Affichage selon 3 paliers (Yann 5 mai 2026,
 * étendu 9 mai 2026 sur 11 / 21 ans) :
 *
 *  - < 6 ans  → warning rouge/orange "IPO récente"
 *               cible : Rivian 2021, Coinbase 2021, Robinhood 2021, Lucid
 *  - < 11 ans → warning amber discret "Historique 10 ans incomplet"
 *               (le graph 10y commencera à l'IPO, pas à 10 ans plein)
 *  - < 21 ans → info grise "Historique 20 ans incomplet"
 *               (le graph 20y commencera à l'IPO)
 *  - ≥ 21 ans → rien affiché
 *
 * Le warning détermine aussi la borne de période max à afficher pour
 * éviter les zéros pré-IPO sur les graphs (cf `maxPeriodYears()` ci-dessous).
 */

type Severity = "young" | "mid" | "old" | "veteran";

function severityFor(yearsListed: number): Severity {
  if (yearsListed < 6) return "young";
  if (yearsListed < 11) return "mid";
  if (yearsListed < 21) return "old";
  return "veteran";
}

const SEVERITY_COLOR: Record<Exclude<Severity, "veteran">, string> = {
  young: "#f59e0b",       // amber strong
  mid: "#a78bfa",         // violet discreet
  old: "#71717a",         // zinc info
};

export function YoungIpoWarning({ ipo, accent }: { ipo: number | string | undefined; accent?: string }) {
  const { t } = useT();
  const ipoYear = typeof ipo === "number" ? ipo : Number(ipo);
  if (!Number.isFinite(ipoYear) || ipoYear < 1900) return null;

  const yearsListed = new Date().getUTCFullYear() - ipoYear;
  const severity = severityFor(yearsListed);
  if (severity === "veteran") return null;

  const color = accent ?? SEVERITY_COLOR[severity];
  // Clé i18n par sévérité. Fallback sur la version <6 ans pour rester
  // rétrocompatible avec dictionary.ts pendant la transition.
  const labelKey = severity === "young"
    ? "company.ipo_young.label"
    : severity === "mid"
      ? "company.ipo_mid.label"
      : "company.ipo_old.label";
  const titleKey = severity === "young"
    ? "company.ipo_young.tooltip_title"
    : severity === "mid"
      ? "company.ipo_mid.tooltip_title"
      : "company.ipo_old.tooltip_title";
  const bodyKey = severity === "young"
    ? "company.ipo_young.tooltip_body"
    : severity === "mid"
      ? "company.ipo_mid.tooltip_body"
      : "company.ipo_old.tooltip_body";
  const labelTpl = t(labelKey);
  const labelText = (labelTpl && labelTpl !== labelKey)
    ? labelTpl.replace("{years}", String(yearsListed)).replace("{year}", String(ipoYear))
    : t("company.ipo_young.label").replace("{years}", String(yearsListed)).replace("{year}", String(ipoYear));

  return (
    <div
      className="inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium"
      style={{ color, borderColor: `${color}40`, background: `${color}10` }}
    >
      <Info className="size-3" />
      <span>{labelText}</span>
      <InfoTooltip color={color}>
        <div className="mb-1 font-mono text-[10px] uppercase tracking-wider" style={{ color }}>
          {t(titleKey) || t("company.ipo_young.tooltip_title")}
        </div>
        <div className="text-zinc-200">{t(bodyKey) || t("company.ipo_young.tooltip_body")}</div>
      </InfoTooltip>
    </div>
  );
}

/**
 * Renvoie le nombre d'années écoulées depuis l'IPO. Renvoie null si IPO
 * inconnu / invalide.
 */
export function getYearsListed(ipo: number | string | undefined): number | null {
  const ipoYear = typeof ipo === "number" ? ipo : Number(ipo);
  if (!Number.isFinite(ipoYear) || ipoYear < 1900) return null;
  return new Date().getUTCFullYear() - ipoYear;
}

/**
 * Borne de période max pour le graph en fonction de l'IPO. Évite les
 * zéros pré-IPO. Renvoie 5, 10 ou 20 (en années) ou null si IPO inconnu.
 *
 * Utilisable côté `<PeriodToggle>` ou `<ChartCycle>` quand 10y/20y
 * seront déverrouillés.
 */
export function maxPeriodYears(ipo: number | string | undefined): number | null {
  const years = getYearsListed(ipo);
  if (years === null) return null;
  if (years < 6) return 5;
  if (years < 11) return 10;
  if (years < 21) return 20;
  return null;
}
