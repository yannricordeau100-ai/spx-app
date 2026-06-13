"use client";

import { Hourglass } from "lucide-react";
import { InfoTooltip } from "@/components/info-tooltip";
import { useT } from "@/lib/i18n/provider";
import { fiscalLabelsForTicker } from "@/lib/fiscal-calendar";

/** Format complet d'une date ISO selon la locale ("29 avril 2026" / "April 29, 2026"). */
function formatFullDate(iso?: string | null, locale: string = "fr"): string | null {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleDateString(locale === "fr" ? "fr-FR" : "en-US", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return null;
  }
}

/** "Q1 2026" depuis une date ISO (fallback calendaire). */
function calendarQuarter(iso?: string): string | null {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return null;
    const q = Math.ceil((d.getUTCMonth() + 1) / 3);
    return `Q${q} ${d.getUTCFullYear()}`;
  } catch {
    return null;
  }
}

/** Trimestre calendaire SUIVANT un label "Q{n} YYYY" (fallback pur calendrier). */
function nextCalendarQuarter(qLabel: string | null): string | null {
  if (!qLabel) return null;
  const m = qLabel.match(/^Q([1-4])\s+(\d{4})$/);
  if (!m) return null;
  let q = parseInt(m[1], 10);
  let y = parseInt(m[2], 10);
  q += 1;
  if (q > 4) {
    q = 1;
    y += 1;
  }
  return `Q${q} ${y}`;
}

/** Ajoute N jours à une date ISO (YYYY-MM-DD), renvoie le nouvel ISO. */
function addDaysIso(iso?: string | null, days: number = 0): string | null {
  if (!iso) return null;
  try {
    const d = new Date(iso.split("T")[0]);
    if (Number.isNaN(d.getTime())) return null;
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().split("T")[0];
  } catch {
    return null;
  }
}

/** Parse une date ISO en timestamp (jour seul), ou null. */
function tsOf(iso?: string | null): number | null {
  if (!iso) return null;
  const t = new Date(iso.split("T")[0]).getTime();
  return Number.isNaN(t) ? null : t;
}

/**
 * "Q1 2026" / "FY26 Q3" → "T1 2026" (FR) ou "Q1 2026" (EN).
 * Le préfixe trimestre est localisé (T = trimestre FR, Q sinon). L'année
 * affichée est l'année calendaire de la période.
 */
function quarterLabel(label: string | null, isFr: boolean): string | null {
  if (!label) return null;
  const qPrefix = isFr ? "T" : "Q";
  let m = label.match(/^Q([1-4])\s+(\d{4})$/);
  if (m) return `${qPrefix}${m[1]} ${m[2]}`;
  m = label.match(/^FY(\d{2})\s+Q([1-4])$/);
  if (m) return `${qPrefix}${m[2]} 20${m[1]}`;
  return label;
}

/**
 * Chip "Prochain résultats" (Yann 13 juin 2026).
 *
 * Remplace l'ancien indicateur de fraîcheur (à jour / récent / earning attendu /
 * résultats publiés). La chip affiche DIRECTEMENT le compte à rebours du prochain
 * earning : « Prochain résultats T{n} {année}  J-{x} » (x = jours restants).
 *
 * RÈGLE STRICTE (Yann) : on n'affiche QUE si la date est précise ET sûre, c.-à-d.
 * `nextEarningsDate` (pipeline) cohérente avec le trimestre attendu ET dans le
 * futur. Sinon → on ne rend RIEN (espace complètement vide). Jamais d'estimation
 * "vers <mois>" sur la chip : si on ne connaît pas la date sûre, vide.
 *
 * Props :
 *   - lastDate : fin de période fiscale du dernier filing (ex 2025-12-31).
 *   - publicationDate : filed_date SEC du dernier filing (tooltip).
 *   - nextEarningsDate : date pipeline du prochain earning.
 *   - ticker : sert au fiscal calendar (FY décalé + dates SEC).
 */
export function FreshnessIndicator({
  lastDate,
  publicationDate,
  nextEarningsDate,
  ticker,
  size = "sm",
  tooltipAlign = "left",
}: {
  lastDate?: string;
  /** Date de publication SEC (filed_date du 10-Q/10-K). */
  publicationDate?: string;
  /** Date approximative des prochains résultats. */
  nextEarningsDate?: string;
  /** Ticker de la sté courante. Sert au fiscal calendar (FY + dates SEC). */
  ticker?: string;
  /** Conservé pour compat des call sites — ignoré (la visibilité dépend de la date sûre). */
  alwaysShow?: boolean;
  size?: "sm" | "md";
  tooltipAlign?: "left" | "right" | "center";
}) {
  const { t, locale } = useT();
  const isFr = locale === "fr";

  // Calendrier fiscal : libellé du dernier trimestre + du prochain attendu.
  const fiscalInfo = ticker ? fiscalLabelsForTicker(ticker, lastDate) : null;
  const secPublication = fiscalInfo?.publicationDate ?? publicationDate;

  const lastQuarterRaw = fiscalInfo?.lastLabel ?? calendarQuarter(lastDate);
  const nextQuarterRaw = fiscalInfo?.nextLabel ?? nextCalendarQuarter(lastQuarterRaw);

  // Fin de période du trimestre suivant (≈ lastDate + 3 mois).
  const nextPeriodEnd = fiscalInfo?.nextPeriodEnd ?? addDaysIso(lastDate, 91);

  // On accepte nextEarningsDate UNIQUEMENT si elle tombe dans la fenêtre du
  // trimestre attendu : [nextPeriodEnd ; nextPeriodEnd + ~95 j]. Sinon → vide.
  const nextEarnTs = tsOf(nextEarningsDate);
  const periodEndTs = tsOf(nextPeriodEnd);
  const nextDateIsCoherent =
    nextEarnTs !== null &&
    periodEndTs !== null &&
    nextEarnTs >= periodEndTs &&
    nextEarnTs <= periodEndTs + 95 * 24 * 60 * 60 * 1000;

  // Jours restants avant les prochains résultats (date précise + sûre + future).
  const todayMid = (() => {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    return d.getTime();
  })();
  const daysUntil =
    nextDateIsCoherent && nextEarnTs !== null
      ? Math.round((nextEarnTs - todayMid) / 86_400_000)
      : null;

  const nextQuarter = quarterLabel(nextQuarterRaw, isFr);

  // RÈGLE : rien si pas de date précise + sûre + future.
  if (daysUntil === null || daysUntil < 0 || !nextQuarter) return null;

  const color = "#06b6d4";
  const isSm = size === "sm";
  const prefix = isFr ? "Prochain résultats" : "Next results";
  const dLabel = isFr ? `J-${daysUntil}` : `D-${daysUntil}`;

  // Tooltip : dernier earning (trimestre + publication) + date précise du prochain.
  const lastQ = quarterLabel(lastQuarterRaw, isFr);
  const pubEstimated = !secPublication ? addDaysIso(lastDate, 35) : null;
  const pubResolved = secPublication ?? pubEstimated;
  const pubFormatted = formatFullDate(pubResolved, locale);
  const isPubEstimated = !secPublication && !!pubEstimated;
  const nextPreciseDate = formatFullDate(nextEarningsDate, locale);

  return (
    <span
      className={`inline-flex max-w-full flex-wrap items-center gap-x-1 gap-y-0 rounded-md font-medium ${
        isSm ? "px-1.5 py-0.5 text-[10.5px]" : "px-2 py-1 text-[11.5px]"
      }`}
      style={{
        background: `${color}1a`,
        color,
        border: `1px solid ${color}40`,
      }}
    >
      <Hourglass className={`shrink-0 ${isSm ? "size-3" : "size-3.5"}`} />
      <span>{prefix}</span>
      <span className="whitespace-nowrap font-bold">{nextQuarter}</span>
      <span className="whitespace-nowrap opacity-90">{dLabel}</span>
      <InfoTooltip color={color} size="sm" align={tooltipAlign}>
        {lastQ && (
          <p className="font-mono text-[10.5px] text-zinc-300">
            {t("freshness.last_earning")} :{" "}
            <span className="font-bold text-zinc-100">{lastQ}</span>
            {pubFormatted && (
              <span className="text-zinc-400">
                {" "}
                {isPubEstimated
                  ? `(${t("freshness.published_around")} ${pubFormatted})`
                  : `(${t("freshness.published_on")} ${pubFormatted})`}
              </span>
            )}
          </p>
        )}
        <p
          className="mt-1 font-mono text-[10.5px] font-semibold"
          style={{ color: "#facc15" }}
        >
          {t("freshness.next_earning")} :{" "}
          <span className="font-bold">{nextQuarter}</span>
          {nextPreciseDate ? ` (${t("freshness.expected_on")} ${nextPreciseDate})` : ""}
        </p>
      </InfoTooltip>
    </span>
  );
}
