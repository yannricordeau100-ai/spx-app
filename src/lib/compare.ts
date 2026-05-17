/**
 * Pure compute layer for two-company KPI comparison.
 * No UI, no opinions. Returns numbers + structured "reading" blocks
 * the UI can present. No investment advice — only descriptive analysis.
 */
import { formatUnit, type KPI } from "./data";

export type Stats = {
  /** First / last value of history. */
  first: number;
  last: number;
  /** CAGR over the full window (n−1 periods), in percent. Null when not meaningful. */
  cagr: number | null;
  /** YoY growth per step, % (length = history.length − 1). */
  yoyArr: number[];
  /** Mean YoY %. */
  yoyAvg: number;
  /** Population stdev of YoY %. */
  yoyStdev: number;
  /** Coefficient of variation (stdev / |avg|). Lower = more consistent. */
  consistency: "stable" | "modérée" | "volatile";
  /** Recent momentum = avg of last 2 YoY % minus avg of all 5 YoY %. */
  momentum: number;
  /** Direction of latest YoY (last in the array). */
  latestYoY: number;
};

function mean(xs: number[]): number {
  if (!xs.length) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}
function stdev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  const v = mean(xs.map((x) => (x - m) ** 2));
  return Math.sqrt(v);
}

export function computeStats(history: number[]): Stats {
  const first = history[0] ?? 0;
  const last = history[history.length - 1] ?? 0;
  const periods = history.length - 1;

  let cagr: number | null = null;
  if (periods > 0 && first > 0 && last > 0) {
    cagr = (Math.pow(last / first, 1 / periods) - 1) * 100;
  }

  const yoyArr: number[] = [];
  for (let i = 1; i < history.length; i++) {
    const prev = history[i - 1];
    if (prev === 0) {
      yoyArr.push(0);
      continue;
    }
    yoyArr.push(((history[i] - prev) / Math.abs(prev)) * 100);
  }
  const yoyAvg = mean(yoyArr);
  const yoyStdev = stdev(yoyArr);
  const cv = Math.abs(yoyAvg) > 0.5 ? yoyStdev / Math.abs(yoyAvg) : yoyStdev / 5;
  const consistency: Stats["consistency"] =
    cv < 0.4 ? "stable" : cv < 1.0 ? "modérée" : "volatile";

  const last2 = yoyArr.slice(-2);
  const momentum = (last2.length ? mean(last2) : 0) - yoyAvg;
  const latestYoY = yoyArr[yoyArr.length - 1] ?? 0;

  return {
    first,
    last,
    cagr,
    yoyArr,
    yoyAvg,
    yoyStdev,
    consistency,
    momentum,
    latestYoY,
  };
}

/* -------------------------------------------------------------------------- */
/*                          Comparison interpretation                         */
/* -------------------------------------------------------------------------- */

export type CompareReadingTone = "leader" | "challenger" | "neutral" | "watch";

export type CompareReading = {
  label: string;
  body: string; // HTML allowed
  tone: CompareReadingTone;
};

export type CompareAnalysis = {
  /** "Direct" if same compare_key, "Connexe" otherwise. */
  matchType: "direct" | "connexe";
  /** Headline summary (1 sentence, HTML). */
  headline: string;
  /** Side a: source company. */
  a: { ticker: string; name: string; kpiName: string; stats: Stats; unit: string };
  /** Side b: target company. */
  b: { ticker: string; name: string; kpiName: string; stats: Stats; unit: string };
  /** Reading bullets (4–6). */
  readings: CompareReading[];
  /** Risks / What to watch — distinct from readings to highlight uncertainty. */
  watch: string[];
  /** Reminder shown at the bottom. Required by design — never give investment advice. */
  disclaimer: string;
};

const fr = (n: number, d = 1) =>
  n.toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d });

function fmtPct(x: number, d = 1) {
  const sign = x > 0 ? "+" : "";
  return `${sign}${fr(x, d)} %`;
}

function ratio(a: number, b: number): number | null {
  if (b === 0) return null;
  return a / b;
}

function relativePosition(
  a: { stats: Stats; name: string },
  b: { stats: Stats; name: string }
): { leader: string; behind: string; gap: number; ratio: number | null } {
  const r = ratio(a.stats.last, b.stats.last);
  if (r === null) {
    return { leader: a.name, behind: b.name, gap: a.stats.last - b.stats.last, ratio: null };
  }
  if (r >= 1) return { leader: a.name, behind: b.name, gap: a.stats.last - b.stats.last, ratio: r };
  return { leader: b.name, behind: a.name, gap: b.stats.last - a.stats.last, ratio: 1 / r };
}

export function buildCompareAnalysis(
  source: { ticker: string; name: string; kpi: KPI },
  target: { ticker: string; name: string; kpi: KPI }
): CompareAnalysis {
  const a = {
    ticker: source.ticker,
    name: source.name,
    kpiName: source.kpi.name_fr,
    stats: computeStats(source.kpi.history),
    unit: source.kpi.unit,
  };
  const b = {
    ticker: target.ticker,
    name: target.name,
    kpiName: target.kpi.name_fr,
    stats: computeStats(target.kpi.history),
    unit: target.kpi.unit,
  };

  const matchType: CompareAnalysis["matchType"] =
    source.kpi.compare_key && source.kpi.compare_key === target.kpi.compare_key
      ? "direct"
      : "connexe";

  const pos = relativePosition(a, b);
  // Normalisation unit pour comparaison : "$B" et "Mds $" sont sémantiquement
  // identiques mais raw différents (CONV-DATA vs CONV-SYSTEMS enrich). formatUnit
  // canonical-ise vers la forme FR-formatée.
  const sameUnit = formatUnit(source.kpi.unit) === formatUnit(target.kpi.unit);

  // ---------- Headline ----------
  const headline =
    matchType === "direct"
      ? `Sur <strong>${source.kpi.name_fr}</strong>, <strong>${pos.leader}</strong> est en tête${
          pos.ratio
            ? ` (×${fr(pos.ratio, pos.ratio < 2 ? 2 : 1)} vs ${pos.behind})`
            : ""
        }.`
      : `Comparaison indirecte : <strong>${source.kpi.name_fr}</strong> chez ${a.name} vs <strong>${target.kpi.name_fr}</strong> chez ${b.name}.`;

  // ---------- Readings ----------
  const readings: CompareReading[] = [];

  // 1. Position relative
  if (sameUnit && pos.ratio !== null) {
    readings.push({
      label: "Position relative",
      body: `<strong>${pos.leader}</strong> est ${
        pos.ratio < 1.5
          ? "légèrement"
          : pos.ratio < 3
            ? "nettement"
            : "très largement"
      } devant <strong>${pos.behind}</strong> sur le dernier exercice : facteur ×${fr(
        pos.ratio,
        pos.ratio < 2 ? 2 : 1
      )}, soit un écart absolu de ${fr(Math.abs(pos.gap), 2)} ${formatUnit(source.kpi.unit)}.`,
      tone: "leader",
    });
  }

  // 2. CAGR
  if (a.stats.cagr !== null && b.stats.cagr !== null) {
    const cagrLeader = a.stats.cagr > b.stats.cagr ? a : b;
    const cagrLagger = a.stats.cagr > b.stats.cagr ? b : a;
    const diff = Math.abs(a.stats.cagr - b.stats.cagr);
    const verdict =
      diff < 2
        ? "trajectoires de croissance comparables"
        : diff < 6
          ? "écart de croissance significatif"
          : "écart de croissance majeur";
    readings.push({
      label: "Vitesse de croissance composée (CAGR 5 ans)",
      body: `<strong>${a.name}</strong> : ${fmtPct(a.stats.cagr)} par an. <strong>${b.name}</strong> : ${fmtPct(
        b.stats.cagr
      )} par an. ${verdict.charAt(0).toUpperCase() + verdict.slice(1)} ; sur la durée, <strong>${cagrLeader.name}</strong> élargit l'écart contre <strong>${cagrLagger.name}</strong>.`,
      tone: a.stats.cagr > b.stats.cagr ? "leader" : "challenger",
    });
  }

  // 3. Constance
  const consistencyLine = (s: Stats) =>
    s.consistency === "stable"
      ? "trajectoire régulière"
      : s.consistency === "modérée"
        ? "volatilité modérée"
        : "trajectoire volatile";
  readings.push({
    label: "Constance de la trajectoire",
    body: `<strong>${a.name}</strong> : ${consistencyLine(a.stats)} (écart-type des YoY : ${fr(
      a.stats.yoyStdev
    )} pts). <strong>${b.name}</strong> : ${consistencyLine(b.stats)} (écart-type : ${fr(
      b.stats.yoyStdev
    )} pts). Plus la trajectoire est stable, plus le KPI est prévisible et donc plus facile à modéliser pour les analystes.`,
    tone: "neutral",
  });

  // 4. Momentum récent
  const momLeader = a.stats.momentum > b.stats.momentum ? a : b;
  const momLagger = a.stats.momentum > b.stats.momentum ? b : a;
  const momDiff = Math.abs(a.stats.momentum - b.stats.momentum);
  readings.push({
    label: "Momentum récent (2 dernières années vs CAGR)",
    body: `<strong>${a.name}</strong> : ${
      a.stats.momentum >= 0 ? "accélération" : "ralentissement"
    } de ${fmtPct(a.stats.momentum)} vs sa propre tendance. <strong>${b.name}</strong> : ${
      b.stats.momentum >= 0 ? "accélération" : "ralentissement"
    } de ${fmtPct(b.stats.momentum)}. ${
      momDiff > 5
        ? `<strong>${momLeader.name}</strong> capte plus de momentum que <strong>${momLagger.name}</strong> sur la période la plus récente.`
        : "Les deux entreprises évoluent à un rythme proche."
    }`,
    tone: a.stats.momentum > b.stats.momentum ? "leader" : "challenger",
  });

  // 5. Convergence vs divergence
  if (sameUnit && pos.ratio !== null && a.stats.cagr !== null && b.stats.cagr !== null) {
    const leaderHasMomentum =
      (pos.leader === a.name && a.stats.cagr >= b.stats.cagr) ||
      (pos.leader === b.name && b.stats.cagr >= a.stats.cagr);
    readings.push({
      label: "Convergence vs divergence",
      body: leaderHasMomentum
        ? `Le leader (<strong>${pos.leader}</strong>) croît au moins aussi vite que le suiveur : <em>l'écart se creuse</em>. Pour qu'un rattrapage ait lieu, <strong>${pos.behind}</strong> devrait surperformer durablement.`
        : `Le leader (<strong>${pos.leader}</strong>) croît moins vite que <strong>${pos.behind}</strong> : <em>l'écart se réduit mécaniquement</em> chaque année si la tendance se maintient.`,
      tone: leaderHasMomentum ? "leader" : "watch",
    });
  }

  // ---------- Watch list ----------
  const watch: string[] = [];
  if (a.stats.consistency === "volatile") {
    watch.push(
      `<strong>${a.name}</strong> est volatile sur ce KPI ; toute extrapolation linéaire surestime la prévisibilité.`
    );
  }
  if (b.stats.consistency === "volatile") {
    watch.push(
      `<strong>${b.name}</strong> est volatile sur ce KPI ; même remarque côté modélisation.`
    );
  }
  if (matchType === "connexe") {
    watch.push(
      `Les deux KPIs comparés ne sont pas strictement identiques. L'analyse reste indicative et non normalisée par taille de marché.`
    );
  }
  if (Math.abs(a.stats.latestYoY) > 50 || Math.abs(b.stats.latestYoY) > 50) {
    watch.push(
      `Une variation supérieure à ±50 % sur la dernière année peut refléter un changement de périmètre (M&A, scission) plutôt qu'une dynamique opérationnelle pure.`
    );
  }
  if (!sameUnit) {
    watch.push(
      `Unités différentes (${formatUnit(source.kpi.unit)} vs ${formatUnit(target.kpi.unit)}) : la comparaison de valeurs absolues n'a pas de sens, seules les dynamiques sont comparables.`
    );
  }

  const disclaimer =
    "Cette analyse est purement descriptive et éducative. Elle n'est ni une recommandation d'investissement, ni une prise de position sur la valorisation de marché de ces sociétés.";

  return { matchType, headline, a, b, readings, watch, disclaimer };
}
