/**
 * Fiscal calendar — gère les sociétés à exercice fiscal décalé (FY end ≠ déc).
 *
 * Yann 13 mai 2026 : avant ce module, on étiquetait toujours le trimestre
 * en CALENDRIER ("Q1 2026" pour période finissant le 31 mars 2026). Pour
 * Microsoft (FY end juin), AAPL (FY end sept), NVDA (FY end janvier), etc.
 * c'était trompeur : Microsoft appelle son trimestre Jan-Mars 2026 = "FY26 Q3".
 *
 * Source canonique : `src/data/fiscal-audit.json` (généré par
 * `scripts/fiscal/audit-fiscal-top307.py` via SEC EDGAR submissions API).
 *
 * Le JSON contient pour chaque ticker US :
 *   - fiscalYearEndMonth (1-12)
 *   - fiscalYearEndDay
 *   - latestForm, latestFilingDate, latestPeriodEnd
 *
 * Côté UI : si `fiscalYearEndMonth !== 12`, on utilise `fiscalQuarter()`
 * pour générer "FYxx Qy" au lieu du libellé calendrier.
 */

import fiscalAuditRaw from "@/data/fiscal-audit.json";

export type FiscalAuditEntry = {
  ticker: string;
  cik?: string;
  fiscalYearEndMonth: number; // 1-12
  fiscalYearEndDay?: number; // 1-31
  latestForm?: string | null;
  latestFilingDate?: string | null; // ISO date
  latestPeriodEnd?: string | null; // ISO date
  /**
   * Yann 8 août 2026 : convention de nommage des labels FY de la sté.
   *  - "end" (défaut) : FY2026 = exercice qui se CLÔT en 2026 (AAPL, V, MSFT)
   *  - "start" : FY2026 = exercice qui COMMENCE en 2026 (HD, TGT, KR, DG...)
   * Calibrée par scripts/kpi-lag-detect.py contre la période réelle du dernier
   * filing. Sans elle, l'axe X des distributeurs affichait un an de retard
   * (HD "T2 2025" au lieu de "T2 2026").
   */
  fyLabelConvention?: "start" | "end";
};

const FISCAL_AUDIT: Record<string, FiscalAuditEntry> = fiscalAuditRaw as Record<
  string,
  FiscalAuditEntry
>;

export function getFiscalAudit(ticker: string): FiscalAuditEntry | undefined {
  const up = ticker.toUpperCase();
  return FISCAL_AUDIT[up];
}

/** True si la sté a une fin d'exercice ≠ décembre (= décalée). */
export function isFiscalShifted(ticker: string): boolean {
  const a = getFiscalAudit(ticker);
  return !!a && a.fiscalYearEndMonth !== 12;
}

/**
 * Calcule le trimestre fiscal et l'année fiscale pour une date de fin de
 * période donnée, sachant le mois de fin d'exercice de la société.
 *
 * Exemple : Microsoft FY end = juin (6).
 *   FY26 commence 1er juillet 2025, finit 30 juin 2026.
 *   FY26 Q1 = juil-sept 2025  (period_end ≈ 2025-09-30)
 *   FY26 Q2 = oct-déc 2025    (period_end ≈ 2025-12-31)
 *   FY26 Q3 = jan-mars 2026   (period_end ≈ 2026-03-31)
 *   FY26 Q4 = avr-juin 2026   (period_end ≈ 2026-06-30) = fin de FY
 *
 * Apple FY end = sept (9).
 *   FY26 commence 29 sept 2025, finit 26 sept 2026.
 *   FY26 Q1 = oct-déc 2025  (period_end ≈ 2025-12-31)
 *   FY26 Q2 = jan-mars 2026 (period_end ≈ 2026-03-31)
 *   etc.
 *
 * NVIDIA FY end = janvier (1).
 *   FY27 commence 27 janvier 2026, finit 25 janvier 2027.
 *   FY27 Q1 = fév-avr 2026 (period_end ≈ 2026-04-30)
 */
export function fiscalQuarter(
  periodEndISO: string,
  fyEndMonth: number,
): { fy: number; q: number; label: string } | null {
  const d = new Date(periodEndISO);
  if (isNaN(d.getTime())) return null;
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1; // 1-12

  if (fyEndMonth === 12) {
    // Calendrier : Q1 = jan-mars, etc.
    const q = Math.ceil(m / 3);
    return { fy: y, q, label: `Q${q} ${y}` };
  }

  // Pour FY non-calendrier : la FY se nomme par l'année où elle SE TERMINE.
  // Si on est dans un mois POST fy-end, on est dans la FY de l'année suivante.
  // Ex : MSFT fyEndMonth=6. Période = 2026-03-31 (mars 2026, AVANT juin 2026)
  //   → on est dans FY26 (qui finit en juin 2026). FY = 26.
  // Ex : MSFT période = 2026-09-30 (sept 2026, APRÈS juin 2026)
  //   → on est dans FY27. FY = 27.
  const fyShort = m > fyEndMonth ? (y + 1) % 100 : y % 100;

  // Calcul du trimestre dans la FY :
  // FY commence au mois (fyEndMonth + 1).
  // Mois dans la FY (1-12) = (m - fyEndMonth - 1 + 12) % 12 + 1
  const monthInFY = ((m - fyEndMonth - 1 + 12) % 12) + 1;
  const q = Math.ceil(monthInFY / 3);

  return { fy: fyShort, q, label: `FY${fyShort} Q${q}` };
}

/**
 * Donne le trimestre fiscal SUIVANT le dernier publié.
 * Ex : MSFT FY26 Q3 → FY26 Q4. FY26 Q4 → FY27 Q1.
 */
export function nextFiscalQuarter(
  currentFy: number,
  currentQ: number,
): { fy: number; q: number; label: string } {
  if (currentQ < 4) {
    return { fy: currentFy, q: currentQ + 1, label: `FY${currentFy} Q${currentQ + 1}` };
  }
  return { fy: currentFy + 1, q: 1, label: `FY${currentFy + 1} Q1` };
}

/** Date de fin de période estimée du prochain trimestre fiscal. */
export function estimateNextPeriodEnd(
  currentPeriodEndISO: string,
): string {
  const d = new Date(currentPeriodEndISO);
  if (isNaN(d.getTime())) return currentPeriodEndISO;
  // Ajout strict de 3 mois sur la date courante
  d.setUTCMonth(d.getUTCMonth() + 3);
  return d.toISOString().slice(0, 10);
}

/**
 * Helper "tout-en-un" pour FreshnessIndicator. Donne :
 *  - le libellé du DERNIER trimestre publié ("FY26 Q3" ou "Q1 2026" calendrier)
 *  - la date de publication (filed_date SEC)
 *  - le libellé du PROCHAIN trimestre attendu
 *  - la date estimée du prochain trimestre
 */
export function fiscalLabelsForTicker(
  ticker: string,
  fallbackLastDataDate?: string,
): {
  lastLabel: string;
  publicationDate: string | null;
  nextLabel: string;
  nextPeriodEnd: string;
  isFiscalShifted: boolean;
  fiscalYearEndMonth: number;
} | null {
  const a = getFiscalAudit(ticker);
  const periodEnd = a?.latestPeriodEnd ?? fallbackLastDataDate;
  if (!periodEnd) return null;

  // Mois de fin d'exercice : SEC si dispo, sinon 12 (calendrier).
  // Cas 52/53 semaines : une sté calendaire dont l'exercice se termine le
  // dimanche le plus proche du 31 déc peut déclarer une fin début janvier
  // (ex JNJ "01-03"). La traiter comme fiscale décalée faisait afficher
  // "Prochain earning T2 2027" au lieu de "T2 2026". Si fin ≤ 15 janvier,
  // on la traite comme calendaire.
  const fyEndMonthRaw = a?.fiscalYearEndMonth ?? 12;
  const fyEndDay = (a as { fiscalYearEndDay?: number } | undefined)?.fiscalYearEndDay ?? 31;
  const fyEndMonth = fyEndMonthRaw === 1 && fyEndDay <= 15 ? 12 : fyEndMonthRaw;

  const cur = fiscalQuarter(periodEnd, fyEndMonth);
  if (!cur) return null;
  // Pour les calendriers (fyEndMonth=12), `cur.fy` = année complète (2026) →
  // libellé prochain = "Q2 2026" pas "FY2026 Q2".
  const next =
    fyEndMonth === 12
      ? (() => {
          const nq = cur.q < 4 ? cur.q + 1 : 1;
          const ny = cur.q < 4 ? cur.fy : cur.fy + 1;
          return { fy: ny, q: nq, label: `Q${nq} ${ny}` };
        })()
      : nextFiscalQuarter(cur.fy, cur.q);
  const nextPeriodEnd = estimateNextPeriodEnd(periodEnd);

  // Yann 16 juil 2026 : plus de libellés fiscaux "FY26 Q3" côté utilisateur.
  // Les stés à exercice décalé sont converties en trimestre CALENDAIRE réel.
  const toCalendarLabel = (q: number, fy: number): string => {
    if (fyEndMonth === 12) return `Q${q} ${fy}`;
    const fullFy = fy < 100 ? 2000 + fy : fy;
    const cal = fiscalQuarterToCalendar(q, fullFy, fyEndMonth);
    return `Q${cal.q} ${cal.year}`;
  };
  return {
    lastLabel: toCalendarLabel(cur.q, cur.fy),
    publicationDate: a?.latestFilingDate ?? null,
    nextLabel: toCalendarLabel(next.q, next.fy),
    nextPeriodEnd,
    isFiscalShifted: fyEndMonth !== 12,
    fiscalYearEndMonth: fyEndMonth,
  };
}

/**
 * Convertit un trimestre FISCAL (q, fy) en trimestre CALENDAIRE réel.
 * Yann 16 juil 2026 : l'utilisateur doit savoir DE QUAND datent les chiffres,
 * sans connaître le calendrier fiscal de la sté. Ex AAPL (fyEnd=septembre) :
 * Q1 FY2026 = oct-déc 2025 → { q: 4, year: 2025 } → affiché "T4 2025".
 */
export function fiscalQuarterToCalendar(
  q: number,
  fy: number,
  fyEndMonth: number,
  convention: "start" | "end" = "end",
): { q: number; year: number } {
  if (fyEndMonth === 12 || !Number.isFinite(fyEndMonth)) return { q, year: fy };
  // Yann 8 août 2026 : convention "start" (HD, TGT, KR, DG...) = le label FY
  // porte l'année de DÉBUT d'exercice. On la ramène à l'année de clôture
  // avant d'appliquer la règle standard, sinon l'axe X recule d'un an.
  const fyClose = convention === "start" ? fy + 1 : fy;
  // Mois calendaire de FIN du trimestre fiscal q (1-12).
  const endMonth = ((fyEndMonth + 3 * q - 1) % 12) + 1;
  // La FY se nomme par son année de clôture : si le mois de fin du trimestre
  // est APRÈS le mois de clôture, on est encore dans l'année calendaire
  // précédant la clôture (ex AAPL Q1 FY2026 finit en décembre 2025).
  const year = endMonth > fyEndMonth ? fyClose - 1 : fyClose;
  return { q: Math.ceil(endMonth / 3), year };
}
