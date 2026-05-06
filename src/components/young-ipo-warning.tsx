"use client";

import { Info } from "lucide-react";
import { useT } from "@/lib/i18n/provider";
import { InfoTooltip } from "@/components/info-tooltip";

/**
 * Affiche un avertissement quand la société est récemment introduite en
 * bourse (IPO datant de < 6 ans). L'historique est forcément court : les
 * comparaisons CAGR / pic 5 ans sont moins parlantes, et les graphiques
 * 10y / 20y ne montreraient que des zéros pré-IPO.
 *
 * Auto-applique pour TOUTES les stés du dataset : il suffit que `ipo`
 * (entier année) soit présent. Aucun toggle, aucun opt-in : si l'IPO < 6
 * ans, le warning s'affiche.
 *
 * Choix des seuils (Yann 5 mai 2026) :
 *  - < 6 ans  → warning visible (cible : Rivian 2021, Coinbase 2021,
 *               Robinhood 2021, Lucid 2021, etc.)
 *  - < 11 ans → graph 10y max (V2 quand 10y dispo)
 *  - < 21 ans → graph 20y max (V2 quand 20y dispo)
 *
 * Pour V1.7 actuel (5y unique période réelle) le warning < 6 ans est seul
 * pertinent. Les bornes 11 et 21 ans serviront automatiquement quand
 * PeriodToggle débloquera 10y / 20y en V2.
 */
export function YoungIpoWarning({ ipo, accent = "#f59e0b" }: { ipo: number | string | undefined; accent?: string }) {
  const { t } = useT();
  const ipoYear = typeof ipo === "number" ? ipo : Number(ipo);
  if (!Number.isFinite(ipoYear) || ipoYear < 1900) return null;

  const currentYear = new Date().getUTCFullYear();
  const yearsListed = currentYear - ipoYear;
  if (yearsListed >= 6) return null;

  return (
    <div
      className="inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium"
      style={{
        color: accent,
        borderColor: `${accent}40`,
        background: `${accent}10`,
      }}
    >
      <Info className="size-3" />
      <span>
        {t("company.ipo_young.label")
          .replace("{years}", String(yearsListed))
          .replace("{year}", String(ipoYear))}
      </span>
      <InfoTooltip color={accent}>
        <div className="mb-1 font-mono text-[10px] uppercase tracking-wider" style={{ color: accent }}>
          {t("company.ipo_young.tooltip_title")}
        </div>
        <div className="text-zinc-200">{t("company.ipo_young.tooltip_body")}</div>
      </InfoTooltip>
    </div>
  );
}

/**
 * Renvoie le nombre d'années écoulées depuis l'IPO. Renvoie null si IPO
 * inconnu / invalide. Utilisable côté chart pour clamper les périodes
 * 10y / 20y quand elles seront déverrouillées.
 */
export function getYearsListed(ipo: number | string | undefined): number | null {
  const ipoYear = typeof ipo === "number" ? ipo : Number(ipo);
  if (!Number.isFinite(ipoYear) || ipoYear < 1900) return null;
  return new Date().getUTCFullYear() - ipoYear;
}
