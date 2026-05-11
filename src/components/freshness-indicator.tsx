"use client";

import { AlertTriangle, CheckCircle2, Clock, HelpCircle } from "lucide-react";
import { getFreshness, type FreshnessTier } from "@/lib/data";
import { InfoTooltip } from "@/components/info-tooltip";
import { useT } from "@/lib/i18n/provider";

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
function nextQuarterAfter(qLabel: string | null): string | null {
  if (!qLabel) return null;
  const m = qLabel.match(/^Q([1-4])\s+(\d{4})$/);
  if (!m) return null;
  let q = parseInt(m[1], 10) + 1;
  let y = parseInt(m[2], 10);
  if (q > 4) {
    q = 1;
    y += 1;
  }
  return `Q${q} ${y}`;
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
  alwaysShow = false,
  size = "sm",
  tooltipAlign = "left",
}: {
  lastDate?: string;
  /** Date de publication SEC (filed_date du 10-Q/10-K). Prioritaire. */
  publicationDate?: string;
  /** Date approximative des prochains résultats / prochaine donnée. */
  nextEarningsDate?: string;
  alwaysShow?: boolean;
  size?: "sm" | "md";
  tooltipAlign?: "left" | "right" | "center";
}) {
  const { t, locale } = useT();
  // Freshness tier basé sur la date de publication si dispo, sinon lastDate.
  const refDate = publicationDate ?? lastDate;
  const tier = getFreshness(refDate);
  if (tier === "fresh" && !alwaysShow) return null;

  const meta = META[tier];
  const Icon = meta.Icon;
  const isSm = size === "sm";
  const pubFormatted = formatApproxDate(publicationDate, locale);
  const lastFormatted = formatApproxDate(lastDate, locale);
  const lastQuarter = quarterFromIso(lastDate);
  const nextFormatted = formatApproxDate(nextEarningsDate, locale);
  // Le prochain trimestre est TOUJOURS celui qui suit le dernier publié,
  // PAS le trimestre dans lequel tombe la date de publication future
  // (sinon Q1 publié en avril → next earning en juillet calculait Q3 au
  // lieu de Q2). Fallback sur quarterFromIso seulement si lastQuarter
  // est absent (très rare). Yann 11 mai 2026.
  const nextQuarter = nextQuarterAfter(lastQuarter) ?? quarterFromIso(nextEarningsDate);

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md font-medium ${
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
        <p className="text-[12px] leading-relaxed text-zinc-200">{t(meta.explainerKey)}</p>
        {/* Dernier earning publié : trimestre + date de publication */}
        {(lastQuarter || pubFormatted) && (
          <p className="mt-2 font-mono text-[10.5px] text-zinc-300">
            Dernier earning publié :{" "}
            <span className="font-bold text-zinc-100">
              {lastQuarter ?? "—"}
              {pubFormatted ? ` (publié le ${pubFormatted})` : ""}
            </span>
          </p>
        )}
        {/* Si seulement lastDate (pas de publicationDate), on l'affiche en repli */}
        {!pubFormatted && lastFormatted && (
          <p className="mt-1 font-mono text-[10.5px] text-zinc-400">
            Fin de période : {lastFormatted}
          </p>
        )}
        {/* Prochain earning attendu : trimestre + date prévue */}
        {nextFormatted && (
          <p
            className="mt-1 font-mono text-[10.5px] font-semibold"
            style={{ color: "#facc15" }}
          >
            Prochain earning : {nextQuarter ? `${nextQuarter} (` : ""}
            {nextFormatted}
            {nextQuarter ? ")" : ""}
          </p>
        )}
      </InfoTooltip>
    </span>
  );
}
