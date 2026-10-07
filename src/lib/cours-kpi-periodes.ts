/**
 * Intervalles reels des periodes d un KPI (bloc admin « KPI et cours de bourse »).
 * `debut` = premier jour de la periode (00:00 UTC), `fin` = dernier jour de la
 * periode (00:00 UTC), donc le bord droit d une barre se trace a `fin + JOUR`.
 * Le debut d une periode est toujours le lendemain de la fin de la precedente.
 */
export const JOUR = 86400000;

/** Societes a exercice de 52/53 semaines : fin d exercice = dernier jour de semaine donne d un mois. */
const SEMAINES_52_53: Record<string, { mois: number; jourSemaine: number }> = {
  AAPL: { mois: 9, jourSemaine: 6 }, // dernier samedi de septembre
  NVDA: { mois: 1, jourSemaine: 0 }, // dernier dimanche de janvier
};

function dernierJourSemaine(y: number, mois: number, jourSemaine: number): number {
  const fin = new Date(Date.UTC(y, mois, 0));
  const dec = (fin.getUTCDay() - jourSemaine + 7) % 7;
  return fin.getTime() - dec * JOUR;
}

/** Fins de trimestre fiscal (13 semaines depuis la fin d exercice precedente ; le T4 absorbe la 53e semaine). */
function finsTrimestres5253(ticker: string, annees: number[]): number[] {
  const r = SEMAINES_52_53[ticker.toUpperCase()];
  if (!r) return [];
  const out: number[] = [];
  for (const a of annees) {
    const prec = dernierJourSemaine(a - 1, r.mois, r.jourSemaine);
    for (let k = 1; k <= 3; k++) out.push(prec + k * 13 * 7 * JOUR);
    out.push(dernierJourSemaine(a, r.mois, r.jourSemaine));
  }
  return out.sort((a, b) => a - b);
}

function finDeMois(y: number, m: number): number {
  return Date.UTC(y, m, 0);
}

export type Intervalle = { debut: number; fin: number };

/** Etiquette d axe X (T1 25, S2 24, 2025) -> intervalle reel de la periode. */
export function intervallePeriode(
  label: string,
  fyEndMonth: number,
  convention: "start" | "end",
  ticker = "",
): Intervalle | null {
  const r = SEMAINES_52_53[ticker.toUpperCase()];
  let m = label.match(/^T([1-4])\s+(\d{2})$/);
  if (m) {
    const y = 2000 + Number(m[2]);
    const q = Number(m[1]);
    if (r) {
      // L etiquette est le trimestre CALENDAIRE contenant la fin du trimestre fiscal.
      const fins = finsTrimestres5253(ticker, [y - 1, y, y + 1]);
      const i = fins.findIndex((t) => {
        const d = new Date(t);
        return d.getUTCFullYear() === y && Math.ceil((d.getUTCMonth() + 1) / 3) === q;
      });
      if (i > 0) return { debut: fins[i - 1] + JOUR, fin: fins[i] };
    }
    return { debut: Date.UTC(y, (q - 1) * 3, 1), fin: finDeMois(y, q * 3) };
  }
  m = label.match(/^S([12])\s+(\d{2})$/);
  if (m) {
    const y = 2000 + Number(m[2]);
    const s = Number(m[1]);
    return { debut: Date.UTC(y, s === 1 ? 0 : 6, 1), fin: finDeMois(y, s === 1 ? 6 : 12) };
  }
  m = label.match(/^(?:FY)?(\d{4})$/);
  if (m) {
    let y = Number(m[1]);
    if (convention === "start" && fyEndMonth !== 12) y += 1;
    if (r) {
      return { debut: dernierJourSemaine(y - 1, r.mois, r.jourSemaine) + JOUR, fin: dernierJourSemaine(y, r.mois, r.jourSemaine) };
    }
    const fin = finDeMois(y, fyEndMonth);
    const debut = Date.UTC(fyEndMonth === 12 ? y : y - 1, fyEndMonth === 12 ? 0 : fyEndMonth, 1);
    return { debut, fin };
  }
  return null;
}

/** Bord gauche et bord droit (exclu) d une barre, en ms : [debut, fin + 1 jour). */
export function bordsBarre(iv: Intervalle): { gauche: number; droite: number } {
  return { gauche: iv.debut, droite: iv.fin + JOUR };
}
