import type { Company } from "@/lib/data";

/**
 * Backfill `last_data_date` sur les KPIs : si un KPI n'a pas de date OU
 * une date plus ancienne que le max du dataset, on remonte à la date la
 * plus récente disponible. Évite de flagger "Données vieillissantes" un
 * hero KPI dont d'autres KPIs du même dataset sont plus frais (cas où
 * CONV-DATA a updaté certains champs mais pas tous). Yann 5 mai 2026.
 *
 * Ordre fallback :
 *   1. KPI's own last_data_date (si présent et plus récent que les autres)
 *   2. Max(last_data_date sur tous les KPIs de la société)
 *   3. Top-level last_filing_date / _last_validation_date / _validation_date
 *   4. "2025-12-31" (dernière clôture US standard)
 *
 * Template uniforme : utilisé par /sandbox/v1-6/[ticker], /sandbox/v1-7/[ticker]
 * et toutes futures pages société pipeline (2.0+). À chaque nouvelle société ajoutée,
 * pas besoin de toucher à ses dates : la fonction backfill au render.
 */
export function enhanceFreshness<T extends Company & Record<string, unknown>>(data: T): T {
  const kpis = (data.kpis || []) as Array<{ last_data_date?: string; history_periods?: string[] }>;
  const allDates: string[] = kpis
    .map((k) => k.last_data_date)
    .filter((d): d is string => !!d && /^\d{4}-\d{2}-\d{2}$/.test(d));
  const topLevelCandidates = [
    data.last_filing_date,
    data._last_validation_date,
    data._validation_date,
  ].filter((d): d is string => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d));
  allDates.push(...topLevelCandidates);
  // 1er oct 2026 : une date future (plan ou valeur votee de l exercice en
  // cours, ex. ROE autorise FY2026 au 31/12/2026) ne doit pas servir de date
  // de repli aux KPI non dates (compteurs SRE affiches « au 31/12/2026 »).
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const datesPassees = allDates.filter((d) => d <= aujourdhui);
  const maxDate = datesPassees.length > 0 ? datesPassees.sort().slice(-1)[0] : "2025-12-31";
  // Yann 16 mai 2026 : NE PAS écraser le last_data_date propre d'un KPI
  // par la date max du dataset. Sinon l'aggrégation annuelle (cf.
  // aggregateQuarterlyToAnnual) calcule les FY à partir d'une mauvaise
  // borne (Headcount yfinance = aujourd'hui → décalait les sommes par
  // 1-2 trimestres). On backfill UNIQUEMENT les KPIs sans date.
  // Yann 9 août 2026 : le backfill par maxDate mentait dès qu'un KPI web
  // scrapé récemment tirait la date de toute la société vers le présent
  // (Effectifs annuels TTE.PA badgés "T3 2026"). Priorité au dernier label
  // de history_periods du KPI lui-même ("FY2025" → 2025-12-31,
  // "Q2 2026" → 2026-06-30, "H1 2025" → 2025-06-30) ; maxDate en dernier
  // recours seulement.
  const dateFromLastPeriod = (k: { history_periods?: unknown }): string | null => {
    const hp = (k as { history_periods?: string[] }).history_periods;
    if (!Array.isArray(hp) || hp.length === 0) return null;
    const lastRaw = hp[hp.length - 1];
    if (typeof lastRaw !== "string") return null;
    const s = lastRaw.trim();
    let m = s.match(/^(?:FY|)\s*(\d{4})$/i);
    if (m) return `${m[1]}-12-31`;
    m = s.match(/^Q([1-4])[\s-]*(?:FY)?(\d{4})$/i) ?? s.match(/^(?:FY)?(\d{4})[\s-]*Q([1-4])$/i)?.slice(0).reverse() as RegExpMatchArray | null;
    if (m) {
      const q = Number(m[1]);
      const y = m[2];
      const end = ["03-31", "06-30", "09-30", "12-31"][q - 1];
      return `${y}-${end}`;
    }
    m = s.match(/^[HS]([12])[\s-]*(\d{4})$/i);
    if (m) return `${m[2]}-${m[1] === "1" ? "06-30" : "12-31"}`;
    return null;
  };
  data.kpis = kpis.map((k) => {
    if (!k.last_data_date) {
      return { ...k, last_data_date: dateFromLastPeriod(k) ?? maxDate };
    }
    return k;
  }) as Company["kpis"];
  return data;
}
