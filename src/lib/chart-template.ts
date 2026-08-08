/**
 * chart-template.ts — recette canonique pour construire un ChartSpec
 *
 * SOURCE DE VÉRITÉ UNIQUE pour la construction des graphs hero. Toute
 * la logique éparpillée (aggregation flow/stock, fiscal year décalé,
 * TTM dynamique, labels axe X, filtres events, dédup) est consolidée
 * ici. À utiliser via `buildChartSpec()` depuis company-view.tsx et
 * tout futur composant chart.
 *
 * Documentation humaine : docs/CHART-RECIPE.md
 * Vérification + auto-fix : src/lib/chart-spec-verify.ts
 *
 * Yann 16 mai 2026 — extraction depuis company-view.tsx pour permettre :
 *   1. Tests unitaires
 *   2. Réutilisation Stories / Compare / Lab
 *   3. Versioning via flags `options.preset = "v1" | "v2"`
 *   4. Audit auto via IDs stables (cf. quality-tree.ts)
 */
import type { KPI } from "@/lib/data";
import {
  aggregateQuarterlyToAnnual,
  getKpiAggregationKind,
  type KpiAggregationKind,
} from "@/lib/kpi-aggregation";
import { getFiscalAudit, fiscalQuarterToCalendar } from "@/lib/fiscal-calendar";
import { autoRescaleSmallUnit } from "@/lib/format-hero";

export type GraphPeriod = "year" | "quarter" | "semester";

export type ChartWarning = {
  id: string; // ex "chart.history_linear_synthetic"
  level: "info" | "warn" | "error";
  message: string;
};

export type ChartSpec = {
  /** Valeurs plottées (already aggregated par period). */
  values: number[];
  /** Labels axe X (1 par value). Inclut "TTM" si ttm visible. */
  labels: string[];
  /** Valeur du point TTM (pointillé), null si masqué (ex équivalent à dernière FY). */
  ttm: number | null;
  /** Label du point TTM (par défaut "TTM"). */
  ttmLabel: string;
  /** Unité finale après éventuel rescale (M → unités si <1, etc.). */
  unit: string;
  /** Factor de rescale appliqué (1 = pas de rescale). */
  scaleFactor: number;
  /** Métadonnées + diagnostics. */
  meta: {
    ticker: string;
    period: GraphPeriod;
    kind: KpiAggregationKind;
    fiscalYearEndMonth: number;
    isFiscalShifted: boolean;
    lastDataDate: string | null;
    /** "xbrl-only" | "pipeline-only" | "merged" | "unknown" */
    sourceMix: string;
  };
  /** Anti-patterns détectés + auto-fixes appliqués pendant le build. */
  warnings: ChartWarning[];
};

export type BuildOptions = {
  /** Version du preset. Permet de reverter à l'ancienne logique sans déploiement. */
  preset?: "v1-legacy" | "v2-canonical";
  /** Si false, désactive la dédup TTM == dernière FY (garde le TTM visible). */
  dedupTtmWithLastFy?: boolean;
  /** Si true, ne crée PAS de point TTM même si flow + ≥4 Q (utile en mode semester). */
  disableTtm?: boolean;
};

const DEFAULT_OPTIONS: Required<BuildOptions> = {
  preset: "v2-canonical",
  dedupTtmWithLastFy: true,
  disableTtm: false,
};

/**
 * Construit un ChartSpec canonique à partir d'un KPI et d'un mode d'affichage.
 *
 * Ingrédients requis (data) :
 *   - kpi.history : array of numbers, oldest first
 *   - kpi.period_type : "quarter" | "semester" | "year" | undefined
 *   - kpi.last_data_date : ISO date (YYYY-MM-DD), période de fin du dernier point
 *   - kpi.unit : string (ex "Mds $", "%", "M unités")
 *   - kpi.type / kpi.short / kpi.name_fr : pour classification flow/stock
 *
 * Étapes (recette) :
 *   1. Détecte fiscal year (via getFiscalAudit)
 *   2. Classe le KPI flow vs stock
 *   3. Slice history selon period demandé
 *   4. Pour vue annuelle sur KPI quarterly : aggregateQuarterlyToAnnual
 *   5. Calcule TTM (somme 4 derniers Q pour flow, last Q pour stock)
 *   6. Génère labels axe X (fiscal-aware)
 *   7. Détecte anti-patterns → warnings (vérification + fix dans chart-spec-verify)
 *
 * @example
 * const spec = buildChartSpec(googlCloudKpi, "GOOGL", "year");
 * // → { values: [19.2, 26.3, 33.1, 43.2, 58.7], ttm: 66.4, labels: ["2021"…"2025","TTM"] }
 */
export function buildChartSpec(
  kpi: KPI,
  ticker: string,
  period: GraphPeriod,
  options: BuildOptions = {},
): ChartSpec {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const warnings: ChartWarning[] = [];

  // 1. Fiscal year audit
  const audit = getFiscalAudit(ticker);
  const fiscalYearEndMonth = audit?.fiscalYearEndMonth ?? 12;
  const isFiscalShifted = fiscalYearEndMonth !== 12;

  // 2. Classification flow/stock
  const kind = getKpiAggregationKind(kpi);

  // 3. History brut (filtré numbers only)
  const rawHistory = Array.isArray(kpi.history)
    ? (kpi.history.filter((v): v is number => typeof v === "number"))
    : [];
  const pt = kpi.period_type;
  const lastDataDate = (kpi as KPI & { last_data_date?: string }).last_data_date ?? null;

  // Anti-pattern : history vide
  if (rawHistory.length === 0) {
    warnings.push({
      id: "chart.history_empty",
      level: "warn",
      message: "Aucune valeur historique disponible pour ce KPI.",
    });
    return emptySpec(ticker, period, kind, fiscalYearEndMonth, isFiscalShifted, lastDataDate, warnings, kpi);
  }

  // Anti-pattern : history "linéaire" suspect (signature LLM hallucination)
  if (rawHistory.length >= 5) {
    const diffs = rawHistory.slice(1).map((v, i) => v - rawHistory[i]);
    const firstDiff = diffs[0];
    const allEqual = diffs.every((d) => Math.abs(d - firstDiff) < 0.001);
    if (allEqual && Math.abs(firstDiff) > 0.01) {
      warnings.push({
        id: "chart.history_linear_synthetic",
        level: "error",
        message: `Suite linéaire parfaite détectée (delta constant ${firstDiff.toFixed(2)}/période) — signature LLM hallucination probable.`,
      });
    }
  }

  // Anti-pattern : direction history inverse (yoy positif mais history décroissante)
  const yoyStr = typeof kpi.yoy === "string" ? kpi.yoy : "";
  const yoyPos = yoyStr.includes("+") && !yoyStr.startsWith("-");
  const yoyNeg = yoyStr.startsWith("-");
  if (rawHistory.length >= 2 && (yoyPos || yoyNeg)) {
    const last = rawHistory[rawHistory.length - 1];
    const prev = rawHistory[rawHistory.length - 2];
    const histGoesUp = last > prev;
    if ((yoyPos && !histGoesUp) || (yoyNeg && histGoesUp)) {
      warnings.push({
        id: "chart.history_direction_mismatch_yoy",
        level: "warn",
        message: `Direction history contredit le yoy "${yoyStr}". History probablement inversée — l'appelant peut reverser.`,
      });
    }
  }

  // 4. Vue selon (period × period_type)
  let values: number[] = [];
  let labels: string[] = [];
  let ttm: number | null = null;

  if (period === "year" && pt === "quarter") {
    // Aggrégation annuelle : somme 4 Q (flow) ou Q4 (stock).
    // Si history_periods fourni (XBRL labelé) → utilisé en priorité pour
    // gérer history non-contigu (NVDA, etc.).
    const historyPeriods = (kpi as KPI & { history_periods?: string[] }).history_periods;
    const agg = aggregateQuarterlyToAnnual(rawHistory, lastDataDate, kind, fiscalYearEndMonth, historyPeriods);
    values = [...agg.values];
    labels = [...agg.years];
    if (!opts.disableTtm && agg.ttm != null && (opts.dedupTtmWithLastFy ? true : true)) {
      ttm = agg.ttm;
    }
    if (agg.values.length === 0) {
      warnings.push({
        id: "chart.no_complete_fy",
        level: "info",
        message: "Aucune FY complète disponible (history < 4 quarters consécutifs).",
      });
    }
  } else if (period === "year" && pt === "semester") {
    // Aggrégation semestrielle → annuel : somme 2 S (flow) ou S2 (stock)
    const n = rawHistory.length;
    const out: number[] = [];
    for (let i = n - 1; i >= 0; i -= 2) {
      if (kind === "flow" && i - 1 >= 0) out.unshift(rawHistory[i] + rawHistory[i - 1]);
      else out.unshift(rawHistory[i]);
    }
    values = out;
    labels = buildYearLabelsBackward(lastDataDate, out.length);
  } else if (period === "quarter" || pt === "quarter") {
    // Yann 15 juil 2026 (audit AAPL : axe décalé d'un an) : quand le KPI porte
    // des history_periods XBRL complets ("Q1 2026", ...), ce sont les VRAIES
    // périodes point par point : on étiquette avec, au lieu de reconstruire
    // à rebours depuis last_data_date (qui décale tout l'axe dès que la date
    // n'est plus alignée sur le dernier point de la série).
    const hp = (kpi as KPI & { history_periods?: unknown[] }).history_periods;
    const hpValid =
      Array.isArray(hp) &&
      hp.length === rawHistory.length &&
      hp.every((s) => typeof s === "string" && /^Q[1-4][\s-]+(?:FY)?\d{4}$/.test(s.trim()));
    if (hpValid) {
      values = rawHistory;
      labels = (hp as string[]).map((s) => {
        const m = s.trim().match(/^Q([1-4])[\s-]+(?:FY)?(\d{4})$/)!;
        // Yann 16 juil 2026 : conversion fiscal → calendaire à l'affichage.
        const cal = isFiscalShifted
          ? fiscalQuarterToCalendar(Number(m[1]), Number(m[2]), fiscalYearEndMonth, audit?.fyLabelConvention ?? "end")
          : { q: Number(m[1]), year: Number(m[2]) };
        return `T${cal.q} ${String(cal.year).slice(-2)}`;
      });
    } else {
      // Yann 11 juil 2026 : sans last_data_date, buildQuarterLabels fabriquait
      // des trimestres à partir de année-1, ce qui donnait un axe faux. On
      // renvoie emptySpec + warning audit à la place.
      if (!lastDataDate || (typeof lastDataDate === "string" && lastDataDate.trim().length === 0)) {
        const short = typeof kpi.short === "string" ? kpi.short : "?";
        console.warn(`chart.no_last_data_date for ${ticker}/${short}`);
        warnings.push({
          id: "chart.no_last_data_date",
          level: "warn",
          message: `Aucune last_data_date pour KPI quarterly ${short} — axe abandonné.`,
        });
        return emptySpec(ticker, period, kind, fiscalYearEndMonth, isFiscalShifted, lastDataDate, warnings, kpi);
      }
      values = rawHistory;
      labels = buildQuarterLabels(lastDataDate, rawHistory.length, fiscalYearEndMonth);
    }
  } else if (period === "semester" || pt === "semester") {
    values = rawHistory;
    labels = buildSemesterLabels(lastDataDate, rawHistory.length);
  } else {
    // Mode annuel natif (history déjà annuel)
    values = rawHistory;
    labels = buildYearLabelsBackward(lastDataDate, rawHistory.length);
  }

  // 5. Unit + rescale auto si toutes valeurs < 1
  const rawUnit = String(kpi.unit ?? "").trim();
  const allBelowOne = values.length > 0 && values.every((v) => Math.abs(v) < 1);
  const { unit: scaledUnit, factor: scaleFactor } = autoRescaleSmallUnit(rawUnit, allBelowOne);

  // 6. Anti-pattern : valeurs aberrantes (jump > 100× consécutif = mix d'unités)
  for (let i = 1; i < values.length; i++) {
    const prev = values[i - 1];
    const cur = values[i];
    if (prev !== 0 && Math.abs(cur / prev) > 100) {
      warnings.push({
        id: "chart.value_magnitude_jump",
        level: "warn",
        message: `Saut de magnitude ×${Math.abs(cur / prev).toFixed(0)} entre ${labels[i - 1]} et ${labels[i]} — mix d'unités probable.`,
      });
      break;
    }
  }

  return {
    values,
    labels,
    ttm,
    ttmLabel: "TTM",
    unit: scaledUnit,
    scaleFactor,
    meta: {
      ticker,
      period,
      kind,
      fiscalYearEndMonth,
      isFiscalShifted,
      lastDataDate,
      sourceMix: "unknown",
    },
    warnings,
  };
}

/** Spec vide cohérent (KPI sans history). */
function emptySpec(
  ticker: string,
  period: GraphPeriod,
  kind: KpiAggregationKind,
  fiscalYearEndMonth: number,
  isFiscalShifted: boolean,
  lastDataDate: string | null,
  warnings: ChartWarning[],
  kpi: KPI,
): ChartSpec {
  return {
    values: [],
    labels: [],
    ttm: null,
    ttmLabel: "TTM",
    unit: String(kpi.unit ?? ""),
    scaleFactor: 1,
    meta: { ticker, period, kind, fiscalYearEndMonth, isFiscalShifted, lastDataDate, sourceMix: "unknown" },
    warnings,
  };
}

/**
 * Génère labels axe X en mode annuel, en remontant `count` années depuis
 * la dernière FY publiée. Compatible fiscal-shifted.
 */
function buildYearLabelsBackward(lastDataDate: string | null, count: number): string[] {
  if (!lastDataDate) {
    const end = new Date().getUTCFullYear() - 1;
    return Array.from({ length: count }, (_, i) => String(end - count + 1 + i));
  }
  const d = new Date(lastDataDate);
  if (Number.isNaN(d.getTime())) return [];
  const endY = d.getUTCFullYear();
  const out: string[] = [];
  for (let i = 0; i < count; i++) out.unshift(String(endY - i));
  return out;
}

/**
 * Génère labels trimestriels (T1 22, T2 22, ...). Compatible fiscal-shifted
 * (NVDA T2 25 = quarter ending June 2025 = calendrier T2 25, mais labellisé
 * en FY fiscale "FY26 T2" si fiscalYearEndMonth ≠ 12).
 */
function buildQuarterLabels(
  lastDataDate: string | null,
  n: number,
  fiscalYearEndMonth: number,
): string[] {
  if (!lastDataDate || n === 0) return [];
  const d = new Date(lastDataDate);
  if (Number.isNaN(d.getTime())) return [];
  const calY0 = d.getUTCFullYear();
  const calM0 = d.getUTCMonth() + 1;
  const isFiscalShifted = fiscalYearEndMonth !== 12;

  if (isFiscalShifted) {
    // Yann 16 juil 2026 : labels en trimestres CALENDAIRES réels (plus de
    // numérotation fiscale à l'écran).
    let calY = calY0;
    let calM = calM0;
    const out: string[] = [];
    for (let i = n - 1; i >= 0; i--) {
      const q = Math.ceil(calM / 3);
      out.unshift(`T${q} ${String(calY % 100).padStart(2, "0")}`);
      calM -= 3;
      if (calM <= 0) {
        calM += 12;
        calY -= 1;
      }
    }
    return out;
  }

  // Calendrier
  let endQ = Math.floor((calM0 - 1) / 3) + 1;
  let endY = calY0;
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    out.unshift(`T${endQ} ${String(endY).slice(-2)}`);
    endQ -= 1;
    if (endQ === 0) {
      endQ = 4;
      endY -= 1;
    }
  }
  return out;
}

/**
 * Génère labels semestriels (S1 22, S2 22, ...).
 */
function buildSemesterLabels(lastDataDate: string | null, n: number): string[] {
  if (!lastDataDate || n === 0) return [];
  const d = new Date(lastDataDate);
  if (Number.isNaN(d.getTime())) return [];
  const endM = d.getUTCMonth() + 1;
  let endSem = endM <= 6 ? 1 : 2;
  let endY = d.getUTCFullYear();
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    out.unshift(`S${endSem} ${String(endY).slice(-2)}`);
    endSem -= 1;
    if (endSem === 0) {
      endSem = 2;
      endY -= 1;
    }
  }
  return out;
}

// `autoRescaleSmallUnit` est importé depuis `@/lib/format-hero` (source de
// vérité unique, cf. extraction Yann 15 mai 2026). La copie locale a été
// supprimée le 17 mai 2026 (chantier D4 dédup) pour éviter le drift.
