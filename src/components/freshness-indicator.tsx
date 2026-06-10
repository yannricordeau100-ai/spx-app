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

/** Format approximatif d'une date ISO selon la locale ("~ 29 avril 2026" ou "April 29, 2026"). */
function formatApproxDate(iso?: string, locale: string = "fr"): string | null {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(locale === "fr" ? "fr-FR" : "en-US", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

/** Convertit une date ISO en label trimestre ("Q4 2025").
 * Utilisé sur la FIN de période fiscale (ex : 2026-03-31 → Q1 2026). */
function quarterFromIso(iso?: string): string | null {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return null;
    const q = Math.ceil((d.getMonth() + 1) / 3);
    return `Q${q} ${d.getFullYear()}`;
  } catch {
    return null;
  }
}

/**
 * Retourne le trimestre suivant un label "Q{n} YYYY".
 * Q1 2026 → Q2 2026, Q4 2025 → Q1 2026.
 *
 * Yann 11 mai 2026 : règle obligatoire pour le tooltip "À jour".
 * Le PROCHAIN earning report publiera le trimestre N+1 du DERNIER publié.
 * Avant ce fix, on calculait le quarter depuis la date de publication
 * future (ex : juillet → Q3) ce qui sautait un trimestre (Q1 → Q3 au
 * lieu de Q1 → Q2).
 *
 * Source de vérité = dernier 10-Q / 10-K SEC (lastDate = fin de période
 * fiscale du dernier filing publié). Le prochain = +1 trimestre avec
 * wrap d'année.
 */
function nextQuarterAfter(qLabel: string | null, increments: number = 1): string | null {
  if (!qLabel) return null;
  const m = qLabel.match(/^Q([1-4])\s+(\d{4})$/);
  if (!m) return null;
  let q = parseInt(m[1], 10);
  let y = parseInt(m[2], 10);
  for (let i = 0; i < increments; i++) {
    q += 1;
    if (q > 4) {
      q = 1;
      y += 1;
    }
  }
  return `Q${q} ${y}`;
}

/**
 * Estime le nombre de trimestres entre lastDate et nextDate.
 * Utilisé quand un dataset est en retard : si NFLX a last Q4 2025 mais
 * une nextEarningsDate au 16 juillet 2026, ça veut dire Q+2 (≈ 197 jours
 * = 2 trimestres), pas Q+1. Le retour est arrondi au trimestre le plus
 * proche, minimum 1.
 */
function quartersBetween(lastIso?: string, nextIso?: string): number {
  if (!lastIso || !nextIso) return 1;
  try {
    const a = new Date(lastIso.split("T")[0]).getTime();
    const b = new Date(nextIso.split("T")[0]).getTime();
    if (Number.isNaN(a) || Number.isNaN(b) || b <= a) return 1;
    const diffDays = (b - a) / (1000 * 60 * 60 * 24);
    return Math.max(1, Math.round(diffDays / 91));
  } catch {
    return 1;
  }
}

/**
 * Ajoute N jours à une date ISO (YYYY-MM-DD), renvoie le nouvel ISO.
 * Utilisé pour estimer publicationDate (= lastDate + 30j typique 10-Q
 * filing US) et nextEarningsDate (= lastDate + 91j = 1 trimestre).
 * Renvoie null si entrée invalide.
 */
function addDaysIso(iso?: string, days: number = 0): string | null {
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

/**
 * Ajoute N mois à une date ISO (gère le wrap d'année automatiquement).
 * Utilisé pour estimer la prochaine date d'earning quand le pipeline n'a
 * pas encore reçu la vraie nextEarningsDate : on assume +3 mois (= 1 Q).
 */
function addMonthsIso(iso?: string, months: number = 0): string | null {
  if (!iso) return null;
  try {
    const d = new Date(iso.split("T")[0]);
    if (Number.isNaN(d.getTime())) return null;
    d.setUTCMonth(d.getUTCMonth() + months);
    return d.toISOString().split("T")[0];
  } catch {
    return null;
  }
}

/**
 * Convertit une date ISO en libellé "début / milieu / fin de {mois}".
 * Règle Yann 12 mai 2026 : si on ne connait pas le jour exact du
 * prochain earning, on indique seulement la zone du mois.
 *   - jour 1-10  → "début {mois}"
 *   - jour 11-20 → "milieu {mois}"
 *   - jour 21-fin → "fin {mois}"
 */
function approximateMonthLabel(iso: string | null | undefined, locale: string): string | null {
  if (!iso) return null;
  try {
    const d = new Date(iso.split("T")[0]);
    if (Number.isNaN(d.getTime())) return null;
    const day = d.getUTCDate();
    let zone: "debut" | "milieu" | "fin";
    if (day <= 10) zone = "debut";
    else if (day <= 20) zone = "milieu";
    else zone = "fin";
    const monthName = new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-US", {
      month: "long",
      year: "numeric",
    }).format(d);
    const labels = {
      fr: { debut: "début", milieu: "milieu", fin: "fin" },
      en: { debut: "early", milieu: "mid", fin: "late" },
    };
    const dict = locale === "fr" ? labels.fr : labels.en;
    return locale === "fr"
      ? `${dict[zone]} ${monthName}`
      : `${dict[zone]} ${monthName}`;
  } catch {
    return null;
  }
}

/**
 * Compact freshness pill.
 *
 * Yann (10 mai 2026) : la pill doit afficher la **date de publication**
 * du dernier earning (filed_date SEC), pas la fin de période fiscale.
 * Le tooltip explicite séparément :
 *   - le trimestre couvert (ex : Q1 2026)
 *   - la date de publication (ex : 30 avril 2026)
 *   - le prochain earning attendu (ex : 23 juillet 2026 = Q2 2026)
 *
 * Props :
 *   - publicationDate : date filed SEC (priorité). Si absente, on retombe
 *     sur lastDate (fin période fiscale, comportement legacy).
 *   - lastDate : fin de période fiscale (ex : 2026-03-31 pour Q1 2026).
 *     Sert à calculer le trimestre couvert affiché dans le tooltip.
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
  /** Ticker de la sté courante. Sert au gate "earning attendu" par
   *  palier de déploiement. */
  ticker?: string;
  alwaysShow?: boolean;
  size?: "sm" | "md";
  tooltipAlign?: "left" | "right" | "center";
}) {
  const { t, locale } = useT();

  // Yann 13 mai 2026 : intégration fiscal calendar SEC EDGAR.
  // Si ticker présent et qu'on a un fiscal-audit pour lui :
  //   - on utilise la latestPeriodEnd SEC comme source de vérité (= au lieu
  //     de la valeur du dataset qui peut être stale)
  //   - on utilise la latestFilingDate SEC comme publicationDate
  //   - on étiquette le trimestre en nomenclature fiscale ("FY26 Q3") pour
  //     les sociétés à exercice décalé
  const fiscalInfo = ticker ? fiscalLabelsForTicker(ticker, lastDate) : null;
  const secLastDate = fiscalInfo?.publicationDate
    ? // si SEC connaît un filing, on prend sa latestPeriodEnd si plus récente
      // que celle du dataset (audit a écrit dans dataset, mais double secu)
      lastDate
    : lastDate;
  const secPublication = fiscalInfo?.publicationDate ?? publicationDate;

  // Freshness tier basé sur la date de publication si dispo, sinon lastDate.
  const refDate = secPublication ?? secLastDate;
  const tier = getFreshness(refDate);

  // ===== Statuts earning : détection automatique =====
  // Deux cas distincts (Yann 8 juin 2026) :
  //
  //   1. STALE "Résultats publiés" (earning passé NON intégré) :
  //      `nextEarningsDate` est DÉJÀ PASSÉE (< aujourd'hui) ET le dataset
  //      est antérieur à cette date (`lastDate` < nextEarningsDate, = la
  //      data n'a pas encore intégré ce trimestre). L'earning a EU LIEU
  //      mais n'est pas encore dans la data => ni "à jour" ni "attendu".
  //      → badge orange "Résultats publiés", OVERRIDE le vert "à jour".
  //      Appliqué à TOUTES les sociétés (pas de gate ticker) : chaque jour
  //      une société SP500 publie, le cas doit marcher partout.
  //
  //   2. UPCOMING "Earning attendu" (earning RÉELLEMENT à venir) :
  //      `nextEarningsDate` est dans le FUTUR (>= aujourd'hui) ET le dataset
  //      est antérieur à cette date (= prochain trimestre pas encore reçu).
  //      → badge ambre "Earning attendu". Ungate aussi pour cohérence.
  //
  // Les deux cas lisent la même date passée/future formatée localement
  // pour l'explainer.
  const earningStatus = (() => {
    if (!nextEarningsDate || !lastDate) return null;
    try {
      const nextD = new Date(nextEarningsDate.split("T")[0]);
      const lastD = new Date(lastDate.split("T")[0]);
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      if (Number.isNaN(nextD.getTime()) || Number.isNaN(lastD.getTime()))
        return null;
      // La data n'a pas encore intégré la date d'earning visée.
      if (lastD.getTime() >= nextD.getTime()) return null;
      if (nextD.getTime() < today.getTime()) return "stale" as const;
      return "upcoming" as const;
    } catch {
      return null;
    }
  })();

  const isEarningStale = earningStatus === "stale";
  const isEarningUpcoming = earningStatus === "upcoming";
  // Ce flag couvre stale OU upcoming : il laisse passer le early-return
  // "fresh" et déclenche l'override du tier.
  const showEarningStatus = isEarningStale || isEarningUpcoming;

  if (tier === "fresh" && !alwaysShow && !showEarningStatus) return null;

  // Priorité meta : stale > upcoming > tier.
  // - stale  : orange #fb923c + AlertTriangle + "Résultats publiés"
  //   (OVERRIDE le vert "à jour" : l'earning a eu lieu, data non intégrée).
  // - upcoming : ambre #fbbf24 + Hourglass + "Earning attendu".
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
  // Heuristiques de fallback si CONV-DATA n'a pas peuplé les champs :
  //   - publicationDate manquant → estimation = lastDate + 30 jours
  //     (fenêtre typique de publication des 10-Q SEC pour US large caps).
  //   - nextEarningsDate manquant → estimation = lastDate + 3 mois (= 1 Q).
  //     Affichée comme "début/milieu/fin de {mois}" au lieu d'une date
  //     précise (règle Yann 12 mai 2026 : ne pas inventer un jour exact
  //     qu'on ne connait pas).
  // Estimations gardées en fallback SI fiscalInfo absent (= sté hors top 307
   // ou foreign ADR sans CIK SEC). Pour les top 307 US, fiscalInfo fournit
   // les vraies dates SEC → plus jamais de "~est." pour ces stés.
  const pubEstimated = !secPublication && lastDate ? addDaysIso(lastDate, 30) : null;
  const nextEstimated = !nextEarningsDate && lastDate ? addMonthsIso(lastDate, 3) : null;
  const pubResolved = secPublication ?? pubEstimated ?? undefined;
  const nextResolved = nextEarningsDate ?? fiscalInfo?.nextPeriodEnd ?? nextEstimated ?? undefined;
  const pubFormatted = formatApproxDate(pubResolved, locale);
  const lastFormatted = formatApproxDate(lastDate, locale);
  // Libellé du dernier trimestre : fiscal (FY26 Q3) si décalé, sinon
  // calendrier (Q1 2026). fiscalInfo.lastLabel gère les deux cas.
  const lastQuarter = fiscalInfo?.lastLabel ?? quarterFromIso(lastDate);
  // nextFormatted : si la vraie date est connue → format date précis.
  // Si estimation (= jour inventé) → utiliser le format "début/milieu/fin
  // de {mois}" pour ne pas tromper l'utilisateur sur la précision.
  const nextFormatted = nextEarningsDate
    ? formatApproxDate(nextResolved, locale)
    : approximateMonthLabel(nextResolved, locale);
  // Le prochain trimestre est calculé depuis lastQuarter + N trimestres,
  // où N = nb de trimestres entre lastDate et nextResolved (typiquement 1,
  // mais 2-3 quand le dataset est en retard, ex NFLX last Q4 2025 + next
  // 16 juillet 2026 = Q2 2026 = Q+2). Fallback sur quarterFromIso si
  // lastQuarter est absent (très rare).
  const incrementCount = nextEarningsDate
    ? quartersBetween(lastDate, nextEarningsDate)
    : 1;
  // Libellé prochain trimestre : si fiscalInfo dispo, utiliser sa
  // nomenclature directement. Sinon fallback calendrier.
  const nextQuarter =
    fiscalInfo?.nextLabel ??
    nextQuarterAfter(lastQuarter, incrementCount) ??
    quarterFromIso(nextResolved);
  // Drapeaux d'estimation pour styler distinctement les valeurs estimées.
  // Si fiscalInfo a fourni les vraies dates SEC, plus rien d'estimé.
  const isPubEstimated = !secPublication && !!pubEstimated;
  const isNextEstimated = !nextEarningsDate && !fiscalInfo?.nextPeriodEnd && !!nextEstimated;

  // Texte de l'explainer. Pour le statut "stale" (Résultats publiés), on
  // injecte la date de l'earning DÉJÀ PASSÉ (= nextEarningsDate formatée
  // locale, disponible via nextFormatted) dans le placeholder {date}.
  // t() ne gère pas l'interpolation → on remplace manuellement.
  const rawExplainer = t(meta.explainerKey);
  const explainerText = isEarningStale
    ? rawExplainer.replace("{date}", nextFormatted ?? lastFormatted ?? "")
    : rawExplainer;

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
        <p className="text-[12px] leading-relaxed text-zinc-200">{explainerText}</p>
        {/* Dernier earning publié : trimestre + date de publication */}
        {(lastQuarter || pubFormatted) && (
          <p className="mt-2 font-mono text-[10.5px] text-zinc-300">
            {t("freshness.last_earning_published")} :{" "}
            <span className="font-bold text-zinc-100">
              {lastQuarter ?? "—"}
              {pubFormatted
                ? ` (${t("freshness.published_on")} ${pubFormatted}${isPubEstimated ? t("freshness.estimated_suffix") : ""})`
                : ""}
            </span>
          </p>
        )}
        {/* Si seulement lastDate (pas de publicationDate), on l'affiche en repli */}
        {!pubFormatted && lastFormatted && (
          <p className="mt-1 font-mono text-[10.5px] text-zinc-400">
            {t("freshness.period_end")} : {lastFormatted}
          </p>
        )}
        {/* Prochain earning attendu : trimestre + date prévue */}
        {nextFormatted && (
          <p
            className="mt-1 font-mono text-[10.5px] font-semibold"
            style={{ color: "#facc15" }}
          >
            {t("freshness.next_earning")} : {nextQuarter ? `${nextQuarter} (` : ""}
            {nextFormatted}
            {isNextEstimated ? t("freshness.estimated_suffix") : ""}
            {nextQuarter ? ")" : ""}
          </p>
        )}
        {/* Yann 13 mai 2026 : "~est. = estimation..." retiré. Avec le
            fiscal-audit SEC EDGAR pour les top 307, on connaît les vraies
            dates → plus besoin du disclaimer. Pour les rares stés sans
            fiscal info, on garde juste le suffixe "~est." sans paragraphe
            explicatif (auto-suffisant). */}
      </InfoTooltip>
    </span>
  );
}
