/**
 * Variation affichee dans le tableau des indicateurs (13 oct 2026, verif n0).
 *
 * 1) Un KPI qui est lui-meme une variation, un solde ou un flux net (nom), ou
 *    dont la valeur N-1 est nulle ou negative (ou N negative), ne se compare pas en pourcentage : CAT
 *    « Variation stocks machines chez concessionnaires » 600 M $ affichait
 *    « +250,0 % ». On affiche l ecart en valeur avec l exercice ou le meme
 *    trimestre N-1 (« +1,0 Mds $ »), ou rien si l ecart n est pas calculable.
 * 2) Un zero s affiche « 0,0 % » sans signe (JPM « -0,0 % » en rouge).
 */
import { formatHeroValue } from "@/lib/data";

type KpiVar = {
  name_fr?: string;
  name_en?: string;
  unit?: string;
  period_type?: string;
  history?: unknown;
  history_periods?: unknown;
};

const RE_VARIATION_FR =
  /\b(variation|evolution|solde|flux net|flux nets|collecte nette|decollecte|entrees nettes|sorties nettes|ajouts nets|additions nettes|creations nettes|ouvertures nettes|croissance nette|souscriptions nettes|recrutements nets)\b/;
const RE_VARIATION_EN =
  /\b(change in|net change|net flows?|net inflows?|net outflows?|net adds?|net additions?|net new|net openings|net unit growth|net subscriber)\b/;

function sansAccent(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** KPI hors % dont le nom dit variation / solde / flux net. */
export function estKpiVariation(kpi: KpiVar): boolean {
  if (String(kpi.unit ?? "").trim() === "%") return false;
  return RE_VARIATION_FR.test(sansAccent(kpi.name_fr ?? "")) || RE_VARIATION_EN.test(sansAccent(kpi.name_en ?? ""));
}

/** Dernier point et point de comparaison N-1 (meme trimestre, ou exercice precedent). */
function pointsN1(kpi: KpiVar): { last: number; prev: number } | null {
  const h = Array.isArray(kpi.history) ? (kpi.history as unknown[]) : [];
  if (h.length < 2) return null;
  const last = h[h.length - 1];
  if (typeof last !== "number" || !Number.isFinite(last)) return null;
  let prev: unknown = undefined;
  if (kpi.period_type === "quarter") {
    const per = Array.isArray(kpi.history_periods) ? (kpi.history_periods as unknown[]) : [];
    const parse = (q: unknown) => {
      const m = String(q ?? "").match(/^Q([1-4])[\s-](?:FY)?(\d{4})$/i);
      return m ? { q: Number(m[1]), y: Number(m[2]) } : null;
    };
    const lp = per.length === h.length ? parse(per[per.length - 1]) : null;
    if (lp) {
      const i = per.findIndex((p) => {
        const x = parse(p);
        return !!x && x.q === lp.q && x.y === lp.y - 1;
      });
      prev = i >= 0 ? h[i] : undefined;
    } else if (h.length >= 5) {
      prev = h[h.length - 5];
    }
  } else {
    prev = h[h.length - 2];
  }
  return typeof prev === "number" && Number.isFinite(prev) ? { last, prev } : null;
}

/** Retire le signe d un zero affiche (« -0,0 % » -> « 0,0 % »). */
export function sansZeroSigne(s: string): string {
  return s.replace(/^([+\-−])\s*(0(?:[.,]0+)?)(?![.,]?\d)/, "$2");
}

/**
 * Variation finale du tableau a partir de la chaine deja calculee.
 * Retourne null quand rien ne doit etre affiche.
 */
export function variationAffichee(kpi: KpiVar, yoyStr: string): string | null {
  const pctUnit = String(kpi.unit ?? "").trim() === "%";
  const pts = pctUnit ? null : pointsN1(kpi);
  // Flux qui change de signe ou part de zero (N-1 <= 0, ou N < 0) : un % n a pas de sens.
  const signeInstable = !!pts && (pts.prev <= 0 || pts.last < 0);
  if (estKpiVariation(kpi) || signeInstable) {
    const p = pts ?? pointsN1(kpi);
    if (!p) return null;
    const d = p.last - p.prev;
    if (d === 0) return "0";
    const f = formatHeroValue(Math.abs(d), String(kpi.unit ?? ""));
    return `${d > 0 ? "+" : "-"}${f.value}${f.unit ? ` ${f.unit}` : ""}`;
  }
  return sansZeroSigne(yoyStr);
}
