"use client";

import { AlertTriangle, CheckCircle2, Clock, HelpCircle, Hourglass } from "lucide-react";
import { getFreshness, type FreshnessTier } from "@/lib/data";
import { InfoTooltip } from "@/components/info-tooltip";
import { useT } from "@/lib/i18n/provider";
import { fiscalLabelsForTicker } from "@/lib/fiscal-calendar";

const META: Record<
  FreshnessTier,
  { color: string; Icon: typeof Clock; labelKey: string; explainerKey: string }
> = {
  fresh: {
    color: "#10b981",
    Icon: CheckCircle2,
    labelKey: "company.up_to_date",
    explainerKey: "company.fresh_explainer",
  },
  recent: {
    // Avant gris (#a1a1aa) — Yann demande couleur plus vive pour montrer
    // que la donnée est récente et utilisable, pas un signal négatif.
    color: "#06b6d4",
    Icon: Clock,
    labelKey: "company.recent",
    explainerKey: "company.recent_explainer",
  },
  stale: {
    color: "#f59e0b",
    Icon: AlertTriangle,
    labelKey: "company.stale",
    explainerKey: "company.stale_explainer",
  },
  unknown: {
    color: "#a1a1aa",
    Icon: HelpCircle,
    labelKey: "company.unknown_date",
    explainerKey: "company.unknown_explainer",
  },
};

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

/** Format "mois année" pour une date estimée ("mai 2026" / "May 2026"). */
function formatMonthYear(iso?: string | null, locale: string = "fr"): string | null {
  if (!iso) return null;
  try {
    const d = new Date(iso.split("T")[0]);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleDateString(locale === "fr" ? "fr-FR" : "en-US", {
      month: "long",
      year: "numeric",
    });
  } catch {
    return null;
  }
}

/** Convertit une date ISO en label trimestre calendaire ("Q4 2025").
 * Fallback utilisé UNIQUEMENT quand le calendrier fiscal n'est pas disponible
 * (sté hors fiscal-audit ET sans fallbackLastDataDate exploitable). */
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

/**
 * Trimestre calendaire SUIVANT un label "Q{n} YYYY" (fallback pur calendrier).
 * Q4 2025 → Q1 2026. Utilisé seulement quand fiscalInfo absent.
 */
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

/**
 * Ajoute N jours à une date ISO (YYYY-MM-DD), renvoie le nouvel ISO.
 * Renvoie null si entrée invalide.
 */
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
 * Compact freshness pill + tooltip "i".
 *
 * ──────────────────────── ARCHITECTURE TOOLTIP (Yann 8 juin 2026) ────────────
 * Refonte complète après bug META (label trimestre incohérent avec la date).
 *
 * Le tooltip affiche UNIQUEMENT :
 *   - Dernier earning : <trimestre> (publié le <date>)
 *   - Prochain earning : <trimestre> (prévu le <date> | vers <mois année>)
 *   - 1 phrase courte de fraîcheur selon le tier.
 *
 * RÈGLE TRIMESTRES COHÉRENTS :
 *   - `lastQuarter` est dérivé du CALENDRIER FISCAL (fiscalInfo.lastLabel via
 *     `fiscalLabelsForTicker`) à partir de `lastDate` (= fin de période du
 *     dernier filing). Donne "FY26 Q3" (exercice décalé) ou "Q1 2026"
 *     (calendaire). Fallback `calendarQuarter(lastDate)` si fiscalInfo absent.
 *   - `nextQuarter` = TOUJOURS lastQuarter + 1 (fiscalInfo.nextLabel, ou
 *     `nextCalendarQuarter(lastQuarter)` en fallback). On NE dérive JAMAIS le
 *     trimestre depuis `nextEarningsDate` (= source du bug META : la date
 *     pouvait pointer 2 trimestres plus loin que le label).
 *
 * RÈGLE DATE DU PROCHAIN EARNING :
 *   - Date attendue dérivée du calendrier = fin de période suivante
 *     (fiscalInfo.nextPeriodEnd ≈ lastDate + 3 mois) + ~5 semaines de délai de
 *     publication typique des 10-Q US.
 *   - On n'utilise `nextEarningsDate` (donnée pipeline) QUE si elle tombe dans
 *     la fenêtre du trimestre attendu : [nextPeriodEnd ; nextPeriodEnd + ~95j].
 *     Sinon elle est incohérente avec le label → on l'ignore et on affiche la
 *     date estimée "vers <mois année>".
 *
 * Props :
 *   - lastDate : fin de période fiscale du dernier filing (ex 2025-12-31).
 *   - publicationDate : filed_date SEC du dernier filing (prioritaire).
 *   - nextEarningsDate : date pipeline du prochain earning (peut être stale).
 *   - ticker : sert au fiscal calendar (FY décalé + dates SEC).
 */
export function FreshnessIndicator({
  lastDate,
  publicationDate,
  nextEarningsDate,
  ticker,
  alwaysShow = false,
  size = "sm",
  tooltipAlign = "left",
}: {
  lastDate?: string;
  /** Date de publication SEC (filed_date du 10-Q/10-K). Prioritaire. */
  publicationDate?: string;
  /** Date approximative des prochains résultats / prochaine donnée. */
  nextEarningsDate?: string;
  /** Ticker de la sté courante. Sert au fiscal calendar (FY + dates SEC). */
  ticker?: string;
  alwaysShow?: boolean;
  size?: "sm" | "md";
  tooltipAlign?: "left" | "right" | "center";
}) {
  const { t, locale } = useT();

  // ===== Calendrier fiscal (SEC EDGAR) =====
  // Source de vérité pour :
  //   - le libellé du dernier trimestre (FY décalé "FY26 Q3" vs calendaire "Q1 2026")
  //   - la date de publication (filed_date SEC) si plus fiable que le pipeline
  //   - le libellé + la fin de période du PROCHAIN trimestre attendu
  const fiscalInfo = ticker ? fiscalLabelsForTicker(ticker, lastDate) : null;
  const secPublication = fiscalInfo?.publicationDate ?? publicationDate;

  // Freshness tier basé sur la date de publication si dispo, sinon lastDate.
  const refDate = secPublication ?? lastDate;
  const tier = getFreshness(refDate);

  // ===== Statuts earning : détection automatique =====
  // Deux cas distincts (Yann 8 juin 2026) :
  //
  //   1. STALE "Résultats publiés" (earning passé NON intégré) :
  //      `nextEarningsDate` est DÉJÀ PASSÉE (< aujourd'hui) ET le dataset est
  //      antérieur (`lastDate` < nextEarningsDate). L'earning a EU LIEU mais
  //      n'est pas encore dans la data => ni "à jour" ni "attendu".
  //      → badge orange "Résultats publiés", OVERRIDE le vert "à jour".
  //
  //   2. UPCOMING "Earning attendu" (earning RÉELLEMENT à venir) :
  //      `nextEarningsDate` est dans le FUTUR (>= aujourd'hui) ET le dataset
  //      est antérieur à cette date.
  //      → badge ambre "Earning attendu".
  const earningStatus = (() => {
    const nextTs = tsOf(nextEarningsDate);
    const lastTs = tsOf(lastDate);
    if (nextTs === null || lastTs === null) return null;
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    // La data n'a pas encore intégré la date d'earning visée.
    if (lastTs >= nextTs) return null;
    if (nextTs < today.getTime()) return "stale" as const;
    return "upcoming" as const;
  })();

  const isEarningStale = earningStatus === "stale";
  const isEarningUpcoming = earningStatus === "upcoming";
  // Ce flag couvre stale OU upcoming : il laisse passer le early-return
  // "fresh" et déclenche l'override du tier.
  const showEarningStatus = isEarningStale || isEarningUpcoming;

  if (tier === "fresh" && !alwaysShow && !showEarningStatus) return null;

  // Priorité meta : stale > upcoming > tier.
  const meta = isEarningStale
    ? {
        color: "#fb923c",
        Icon: AlertTriangle,
        labelKey: "company.earning_published",
        explainerKey: "company.earning_published_explainer",
      }
    : isEarningUpcoming
    ? {
        color: "#fbbf24",
        Icon: Hourglass,
        labelKey: "company.earning_pending",
        explainerKey: "company.earning_pending_explainer",
      }
    : META[tier];
  const Icon = meta.Icon;
  const isSm = size === "sm";

  // ===== DERNIER EARNING (trimestre + date de publication) =====
  // Libellé : fiscal (FY26 Q3) si dispo, sinon calendaire (Q1 2026).
  const lastQuarter = fiscalInfo?.lastLabel ?? calendarQuarter(lastDate);
  // Date de publication : SEC filed_date prioritaire. Si absente, estimation
  // lastDate + 35j (fenêtre typique de dépôt d'un 10-Q US large cap).
  const pubEstimated = !secPublication ? addDaysIso(lastDate, 35) : null;
  const pubResolved = secPublication ?? pubEstimated;
  const pubFormatted = formatFullDate(pubResolved, locale);
  const isPubEstimated = !secPublication && !!pubEstimated;

  // ===== PROCHAIN EARNING (trimestre + date attendue) =====
  // Libellé = TOUJOURS lastQuarter + 1 (jamais dérivé de nextEarningsDate).
  const nextQuarter =
    fiscalInfo?.nextLabel ?? nextCalendarQuarter(lastQuarter);

  // Fin de période du trimestre suivant (calendrier fiscal, ≈ lastDate + 3 mois).
  const nextPeriodEnd =
    fiscalInfo?.nextPeriodEnd ?? addDaysIso(lastDate, 91);
  // Date de publication attendue ≈ fin de période suivante + 5 semaines.
  const expectedNextPubIso = addDaysIso(nextPeriodEnd, 35);

  // On accepte `nextEarningsDate` UNIQUEMENT si elle tombe dans la fenêtre du
  // trimestre attendu : [nextPeriodEnd ; nextPeriodEnd + ~95 jours]. Sinon
  // elle est incohérente avec le label (cas META : label Q1 2026 mais date
  // 29 juillet = ~Q2 2026) et on la remplace par l'estimation calendaire.
  const nextEarnTs = tsOf(nextEarningsDate);
  const periodEndTs = tsOf(nextPeriodEnd);
  const nextDateIsCoherent =
    nextEarnTs !== null &&
    periodEndTs !== null &&
    nextEarnTs >= periodEndTs &&
    nextEarnTs <= periodEndTs + 95 * 24 * 60 * 60 * 1000;

  // Date précise connue (pipeline cohérent) → format jour complet.
  // Sinon → date estimée affichée en "vers <mois année>".
  const nextPreciseDate = nextDateIsCoherent
    ? formatFullDate(nextEarningsDate, locale)
    : null;
  const nextEstimatedMonth = !nextDateIsCoherent
    ? formatMonthYear(expectedNextPubIso, locale)
    : null;

  // ===== Texte de fraîcheur (court, juste selon le tier) =====
  // Pour le statut "stale" (Résultats publiés), on injecte le trimestre + la
  // date de l'earning DÉJÀ PASSÉ dans l'explainer : "Résultats du <trimestre>
  // publiés le <date>, intégration en cours" (jamais "attendu").
  const rawExplainer = t(meta.explainerKey);
  const explainerText = isEarningStale
    ? rawExplainer
        .replace("{quarter}", nextQuarter ?? lastQuarter ?? "")
        .replace("{date}", formatFullDate(nextEarningsDate, locale) ?? "")
    : rawExplainer;

  // Affiche la ligne "Prochain earning" sauf en statut "Résultats publiés"
  // (l'earning passé est déjà décrit dans la phrase de fraîcheur → pas de
  // ligne "prochain" redondante/contradictoire).
  const showNextLine =
    !isEarningStale && !!nextQuarter && (!!nextPreciseDate || !!nextEstimatedMonth);

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md font-medium ${
        isSm ? "px-1.5 py-0.5 text-[10.5px]" : "px-2 py-1 text-[11.5px]"
      }`}
      style={{
        background: `${meta.color}1a`,
        color: meta.color,
        border: `1px solid ${meta.color}40`,
      }}
    >
      <Icon className={isSm ? "size-3" : "size-3.5"} />
      {t(meta.labelKey)}
      <InfoTooltip color={meta.color} size="sm" align={tooltipAlign}>
        {/* Phrase courte de fraîcheur / statut */}
        <p className="text-[12px] leading-relaxed text-zinc-200">{explainerText}</p>

        {/* Dernier earning : trimestre + date de publication */}
        {lastQuarter && (
          <p className="mt-2 font-mono text-[10.5px] text-zinc-300">
            {t("freshness.last_earning")} :{" "}
            <span className="font-bold text-zinc-100">{lastQuarter}</span>
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

        {/* Prochain earning : trimestre + date attendue (précise ou estimée) */}
        {showNextLine && (
          <p
            className="mt-1 font-mono text-[10.5px] font-semibold"
            style={{ color: "#facc15" }}
          >
            {t("freshness.next_earning")} :{" "}
            <span className="font-bold">{nextQuarter}</span>{" "}
            {nextPreciseDate
              ? `(${t("freshness.expected_on")} ${nextPreciseDate})`
              : `(${t("freshness.expected_around")} ${nextEstimatedMonth})`}
          </p>
        )}
      </InfoTooltip>
    </span>
  );
}
