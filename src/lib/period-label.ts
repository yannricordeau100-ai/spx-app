/**
 * Libellé de période UNIQUE pour toutes les pages sté (Yann 25 août 2026).
 *
 * Règle produit : partout où une période est affichée (hero, tableau
 * Indicateurs clés, Stories, earning call, bullets), on montre le
 * TRIMESTRE CALENDAIRE RÉEL, jamais un libellé fiscal ("Q3 FY2026") ni
 * "Année fiscale X". Les exercices décalés sont convertis en amont.
 *
 * Deux garde-fous, absents des implémentations précédentes :
 *  1. Un libellé de période explicite (history_periods, history[].q) prime
 *     TOUJOURS sur `last_data_date`, qui vaut souvent date de collecte
 *     (ex NVDA "Nombre d'applications optimisées CUDA" : last_data_date =
 *     5 août 2026 alors que la source dit septembre 2025 → affichait
 *     "T3 2026", un trimestre qui n'est même pas terminé).
 *  2. Un trimestre NON TERMINÉ n'est jamais affiché : si la date tombe
 *     dans le trimestre en cours, on rend null plutôt qu'un libellé faux.
 */

import { getFiscalAudit, fiscalQuarterToCalendar } from "@/lib/fiscal-calendar";

const MONTHS_FR: Record<string, number> = {
  janv: 1, jan: 1, fevr: 2, fev: 2, feb: 2, mars: 3, mar: 3, avr: 4, apr: 4,
  mai: 5, may: 5, juin: 6, jun: 6, juil: 7, jul: 7, aout: 8, aug: 8,
  sept: 9, sep: 9, oct: 10, nov: 11, dec: 12,
};

function quarterOfMonth(m: number): number {
  return Math.floor((m - 1) / 3) + 1;
}

/** Trimestre calendaire en cours (non terminé) — à ne jamais afficher. */
function currentQuarter(): { q: number; year: number } {
  const now = new Date();
  return {
    q: quarterOfMonth(now.getUTCMonth() + 1),
    year: now.getUTCFullYear(),
  };
}

function render(q: number, year: number, locale: string): string | null {
  const cur = currentQuarter();
  if (year > cur.year || (year === cur.year && q >= cur.q)) return null;
  return `${locale.startsWith("fr") ? "T" : "Q"}${q} ${year}`;
}

/**
 * Convertit un libellé de période brut en trimestre calendaire affichable.
 * Accepte "Q3 FY2026", "T2 2025", "2025-Q4", "sept 2025", "FY2025", "2025".
 * Retourne null si le libellé ne porte pas de trimestre exploitable ou si
 * le trimestre visé n'est pas encore terminé.
 */
export function periodLabelFromRaw(
  raw: string | null | undefined,
  ticker: string,
  locale: string,
): string | null {
  if (!raw) return null;
  const s = String(raw).trim();

  // "Q3 FY2026" / "Q3 2026" / "T3 2026" → conversion fiscale → calendaire
  let m = s.match(/^([TQ])\s*([1-4])[\s-]+(?:FY)?(\d{4})$/i);
  if (!m) m = s.match(/^(\d{4})[\s-]*([TQ])([1-4])$/i)
    ? [s, "Q", s.match(/([1-4])$/)![1], s.match(/^(\d{4})/)![1]] as unknown as RegExpMatchArray
    : null;
  if (m) {
    const fq = Number(m[2]);
    const fy = Number(m[3]);
    const fa = getFiscalAudit(ticker ?? "");
    const fyEnd = fa?.fiscalYearEndMonth ?? 12;
    const cal = fiscalQuarterToCalendar(fq, fy, fyEnd, fa?.fyLabelConvention ?? "end");
    return render(cal.q, cal.year, locale);
  }

  // "sept 2025" / "September 2025" → trimestre du mois
  const mm = s.match(/^([A-Za-zéûôà.]+)\s+(\d{4})$/);
  if (mm) {
    const key = mm[1]
      .toLowerCase()
      .replace(/\./g, "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .slice(0, 4);
    const month = MONTHS_FR[key] ?? MONTHS_FR[key.slice(0, 3)];
    if (month) return render(quarterOfMonth(month), Number(mm[2]), locale);
  }

  // "2025-09-30" → trimestre de la date
  const md = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (md) return render(quarterOfMonth(Number(md[2])), Number(md[1]), locale);

  return null;
}

/**
 * Libellé de période d'un KPI. Priorité :
 *   history_periods (dernier), puis history[].q (dernier), puis
 *   last_data_date. Rend null si rien n'est exploitable ou si le
 *   trimestre n'est pas terminé.
 */
export function kpiPeriodLabel(
  kpi: {
    last_data_date?: string | null;
    history_periods?: unknown;
    history?: unknown;
  },
  ticker: string,
  locale: string,
): string | null {
  const hp = kpi.history_periods;
  if (Array.isArray(hp) && hp.length > 0) {
    const out = periodLabelFromRaw(String(hp[hp.length - 1] ?? ""), ticker, locale);
    if (out) return out;
  }
  const h = kpi.history;
  if (Array.isArray(h) && h.length > 0) {
    const last = h[h.length - 1];
    if (last && typeof last === "object" && "q" in (last as Record<string, unknown>)) {
      const out = periodLabelFromRaw(
        String((last as { q?: unknown }).q ?? ""),
        ticker,
        locale,
      );
      if (out) return out;
    }
  }
  return periodLabelFromRaw(kpi.last_data_date, ticker, locale);
}
