/**
 * Super-KPIs Mettrik — combinaisons de 2 ou plusieurs KPI bruts pour
 * révéler des dimensions composites que les pros de la finance regardent
 * en priorité.
 *
 * Chaque super-KPI retourne :
 *   value         : nombre brut calculé
 *   display       : valeur formatée pour l'UI
 *   tier          : "premium" | "solid" | "average" | "below" | "na"
 *   color         : code couleur du tier
 *   tierLabel     : libellé court du tier en FR
 *   gaugePct      : 0..100 pour la jauge UI
 *   inputs        : liste des KPIs sources utilisés (transparence)
 *   formula       : formule lisible
 *   interpretation: phrase d'interprétation contextualisée
 */

import type { Company, KPI } from "@/lib/data";

export type SuperKpiTier = "premium" | "solid" | "average" | "below" | "na";

export type SuperKpi = {
  id: string;
  name: string;
  category: "Croissance" | "Profitabilité" | "Risque" | "Stratégie" | "Composite";
  value: number | null;
  display: string;
  tier: SuperKpiTier;
  color: string;
  tierLabel: string;
  gaugePct: number;
  inputs: string[];
  formula: string;
  interpretation: string;
  benchmark: string;
};

const TIER_COLOR: Record<SuperKpiTier, string> = {
  premium: "#10b981",
  solid: "#84cc16",
  average: "#f59e0b",
  below: "#f43f5e",
  na: "#71717a",
};

const TIER_LABEL: Record<SuperKpiTier, string> = {
  premium: "Premium",
  solid: "Solide",
  average: "Moyen",
  below: "Faible",
  na: "Non applicable",
};

function findKpi(c: Company, short: string): KPI | undefined {
  return c.kpis.find((k) => k.short === short);
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = parseFloat(v.replace(/,/g, "").replace(/\s/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** CAGR sur n ans depuis history (n+1 points) — retourne une fraction (0.124 = 12.4%) */
function cagr(history: number[]): number | null {
  if (!history || history.length < 2) return null;
  const first = history[0];
  const last = history[history.length - 1];
  if (first <= 0 || last <= 0) return null;
  const n = history.length - 1;
  return Math.pow(last / first, 1 / n) - 1;
}

/** YoY % depuis history */
function yoyFromHistory(history: number[]): number | null {
  if (!history || history.length < 2) return null;
  const prev = history[history.length - 2];
  const last = history[history.length - 1];
  if (!prev) return null;
  return ((last - prev) / Math.abs(prev)) * 100;
}

/** Trouve le segment de revenu le plus important parmi une liste de KPI shorts. */
function topSegment(c: Company, shorts: string[]): { name: string; value: number } | null {
  let best: { name: string; value: number } | null = null;
  for (const short of shorts) {
    const k = findKpi(c, short);
    if (!k) continue;
    const v = num(k.value);
    if (v === null) continue;
    if (!best || v > best.value) {
      best = { name: k.name_fr, value: v };
    }
  }
  return best;
}

/** Map ticker → segments candidats. */
const SEGMENT_MAP: Record<string, string[]> = {
  GOOGL: ["Search", "Cloud", "YT Ads", "Subs"],
  META: ["FoA Op"],
  MSCI: ["Index", "Sub RR", "ABF", "Analytics"],
  SPGI: ["MI", "Ratings", "Indices", "Energy", "Mobility"],
  CAT: ["Energy", "Construction", "Resource"],
};

/* ═══════════════════════════════════════════════════════════════════════
 *  Super-KPI 1 — RULE OF 40
 *  ═══════════════════════════════════════════════════════════════════════ */
function ruleOf40(c: Company): SuperKpi {
  const rev = findKpi(c, "Revenue");
  const margin = findKpi(c, "Op Margin") ?? findKpi(c, "EBITDA Mgn");
  const revYoY = rev ? yoyFromHistory(rev.history) : null;
  const marginV = margin ? num(margin.value) : null;

  if (revYoY === null || marginV === null) {
    return naResult({
      id: "rule40",
      name: "Rule of 40",
      category: "Croissance",
      formula: "Croissance Revenue (% YoY) + Marge opérationnelle (%)",
      benchmark: "≥ 40 = premium · 30-40 = solide · < 30 = en deçà",
      inputs: ["Revenue", "Op Margin"],
    });
  }

  const score = revYoY + marginV;
  const tier: SuperKpiTier = score >= 50 ? "premium" : score >= 40 ? "solid" : score >= 25 ? "average" : "below";
  const gauge = Math.max(0, Math.min(100, (score / 70) * 100));

  return {
    id: "rule40",
    name: "Rule of 40",
    category: "Croissance",
    value: score,
    display: `${score.toFixed(1)}`,
    tier,
    color: TIER_COLOR[tier],
    tierLabel: TIER_LABEL[tier],
    gaugePct: gauge,
    inputs: [`Revenue YoY ${revYoY.toFixed(1)} %`, `Marge ${marginV.toFixed(1)} %`],
    formula: "Croissance Revenue (% YoY) + Marge op. (%)",
    benchmark: "≥ 40 = premium · 30-40 = solide · < 30 = en deçà",
    interpretation:
      score >= 40
        ? "La société conjugue croissance et discipline financière à un niveau premium. Standard SaaS adopté par toute la tech : un chiffre unique pour évaluer la qualité à la fois du moteur de croissance et de la rentabilité."
        : "Le couple croissance / marge n'atteint pas le seuil de référence. Soit la croissance ralentit, soit les marges sont sous pression, ou les deux.",
  };
}

/* ═══════════════════════════════════════════════════════════════════════
 *  Super-KPI 2 — QUALITY OF COMPOUNDING (CAGR × Marge)
 *  ═══════════════════════════════════════════════════════════════════════ */
function qualityOfCompounding(c: Company): SuperKpi {
  const rev = findKpi(c, "Revenue");
  const margin = findKpi(c, "Op Margin") ?? findKpi(c, "EBITDA Mgn");
  const cagr5y = rev ? cagr(rev.history) : null;
  const marginV = margin ? num(margin.value) : null;

  if (cagr5y === null || marginV === null) {
    return naResult({
      id: "qoc",
      name: "Quality of Compounding",
      category: "Composite",
      formula: "CAGR Revenue 5 ans (%) × Marge op. (%) / 100",
      benchmark: "≥ 8 = exceptionnel · 4-8 = bon · < 4 = poor compounder",
      inputs: ["Revenue (5y history)", "Op Margin"],
    });
  }

  const cagrPct = cagr5y * 100;
  const score = (cagrPct * marginV) / 100;
  const tier: SuperKpiTier = score >= 8 ? "premium" : score >= 4 ? "solid" : score >= 1.5 ? "average" : "below";
  const gauge = Math.max(0, Math.min(100, (score / 12) * 100));

  return {
    id: "qoc",
    name: "Quality of Compounding",
    category: "Composite",
    value: score,
    display: `${score.toFixed(2)}`,
    tier,
    color: TIER_COLOR[tier],
    tierLabel: TIER_LABEL[tier],
    gaugePct: gauge,
    inputs: [`CAGR 5y ${cagrPct.toFixed(1)} %`, `Marge ${marginV.toFixed(1)} %`],
    formula: "(CAGR Revenue 5y × Marge op.) / 100",
    benchmark: "≥ 8 = exceptionnel · 4-8 = bon · < 4 = poor compounder",
    interpretation:
      score >= 8
        ? "Moteur de compounding premium type Buffett : la croissance n'est pas achetée au prix d'une marge faible. Capital efficient et durable."
        : score >= 4
        ? "Compounder solide. La société grandit avec une marge respectable, mais pas dans la cour des très grands compounders."
        : "Croissance et marge ne se cumulent pas suffisamment pour parler de compounding premium. Souvent sectoriel (industrie cyclique, ad-tech mature).",
  };
}

/* ═══════════════════════════════════════════════════════════════════════
 *  Super-KPI 3 — CONCENTRATION RISK (Top segment / Revenue)
 *  ═══════════════════════════════════════════════════════════════════════ */
function concentrationRisk(c: Company): SuperKpi {
  const rev = findKpi(c, "Revenue");
  const revV = rev ? num(rev.value) : null;
  const segs = SEGMENT_MAP[c.ticker];
  if (!revV || !segs) {
    return naResult({
      id: "conc",
      name: "Concentration Risk",
      category: "Risque",
      formula: "Plus gros segment / Revenue total (%)",
      benchmark: "< 35 % = bien diversifié · 35-60 % = concentré · > 60 % = monoculture",
      inputs: ["Revenue", "KPIs segments"],
    });
  }
  const top = topSegment(c, segs);
  if (!top) return naResult({
    id: "conc",
    name: "Concentration Risk",
    category: "Risque",
    formula: "Plus gros segment / Revenue total (%)",
    benchmark: "< 35 % = bien diversifié · 35-60 % = concentré · > 60 % = monoculture",
    inputs: ["Revenue", "KPIs segments"],
  });

  const pct = (top.value / revV) * 100;
  // Inversé : plus le pct est élevé, plus le tier est mauvais
  const tier: SuperKpiTier = pct < 35 ? "premium" : pct < 50 ? "solid" : pct < 65 ? "average" : "below";
  const gauge = Math.min(100, pct);

  return {
    id: "conc",
    name: "Concentration Risk",
    category: "Risque",
    value: pct,
    display: `${pct.toFixed(1)} %`,
    tier,
    color: TIER_COLOR[tier],
    tierLabel: TIER_LABEL[tier],
    gaugePct: gauge,
    inputs: [`Top segment : ${top.name}`, `Revenue total : ${revV.toFixed(1)}`],
    formula: "Plus gros segment / Revenue total (%)",
    benchmark: "< 35 % = bien diversifié · 35-60 % = concentré · > 60 % = monoculture",
    interpretation:
      pct < 35
        ? `Diversification saine. Aucun segment ne pèse plus du tiers du Revenue, donc un retournement isolé n'enverra pas la sté en récession.`
        : pct < 60
        ? `Concentration significative sur ${top.name} (${pct.toFixed(0)} %). À surveiller : un choc sectoriel sur ce segment impacterait la totalité.`
        : `Monoculture sur ${top.name} (${pct.toFixed(0)} %). La sté est exposée au cycle de ce segment unique. Risque structurel binaire.`,
  };
}

/* ═══════════════════════════════════════════════════════════════════════
 *  Super-KPI 4 — CAPITAL INTENSITY (Capex / Revenue)
 *  ═══════════════════════════════════════════════════════════════════════ */
function capitalIntensity(c: Company): SuperKpi {
  const capex = findKpi(c, "Capex");
  const rev = findKpi(c, "Revenue");
  const capexV = capex ? num(capex.value) : null;
  const revV = rev ? num(rev.value) : null;
  if (capexV === null || revV === null || revV === 0) {
    return naResult({
      id: "capint",
      name: "Capital Intensity",
      category: "Stratégie",
      formula: "Capex / Revenue (%)",
      benchmark: "Asset-light < 8 % · normal 8-20 % · investissement lourd > 20 %",
      inputs: ["Capex", "Revenue"],
    });
  }
  const pct = (capexV / revV) * 100;
  // Pas de "bon" ou "mauvais" intrinsèque : Capex élevé peut signaler IA / infra (offensive) ou industrie lourde
  let tier: SuperKpiTier;
  let label: string;
  let interp: string;
  if (pct < 8) {
    tier = "premium";
    label = "Asset-light";
    interp = "Modèle asset-light : la croissance ne demande pas d'investissement physique lourd. ROIC structurellement plus élevé.";
  } else if (pct < 20) {
    tier = "solid";
    label = "Standard";
    interp = "Capex normalisé pour le secteur. La sté investit pour maintenir et développer son outil sans peser excessivement sur les marges.";
  } else if (pct < 35) {
    tier = "average";
    label = "Investissement lourd";
    interp = "Investissement infrastructure majeur. Souvent justifié par une bascule stratégique (IA, cloud, capacité industrielle). À évaluer selon le ROIC futur.";
  } else {
    tier = "below";
    label = "Sur-investissement";
    interp = "Capex extraordinaire : la sté finance un pari structurel (IA générative, datacenters, capacités). Risque réel sur le free cash flow à court terme.";
  }
  const gauge = Math.min(100, (pct / 50) * 100);

  return {
    id: "capint",
    name: "Capital Intensity",
    category: "Stratégie",
    value: pct,
    display: `${pct.toFixed(1)} %`,
    tier,
    color: TIER_COLOR[tier],
    tierLabel: label,
    gaugePct: gauge,
    inputs: [`Capex ${capexV.toFixed(1)}`, `Revenue ${revV.toFixed(1)}`],
    formula: "Capex / Revenue (%)",
    benchmark: "< 8 % asset-light · 8-20 % standard · > 20 % investissement lourd · > 35 % pari stratégique",
    interpretation: interp,
  };
}

/* ═══════════════════════════════════════════════════════════════════════
 *  Super-KPI 5 — METTRIK PROFIT POWER INDEX (composite signature)
 *  ═══════════════════════════════════════════════════════════════════════ */
function profitPowerIndex(c: Company): SuperKpi {
  const r40 = ruleOf40(c);
  const conc = concentrationRisk(c);
  const margin = findKpi(c, "Op Margin") ?? findKpi(c, "EBITDA Mgn");
  const marginV = margin ? num(margin.value) : null;
  const marginTrend = margin ? yoyFromHistory(margin.history) : null;

  if (r40.value === null || marginV === null || conc.value === null || marginTrend === null) {
    return naResult({
      id: "ppi",
      name: "Mettrik Profit Power Index",
      category: "Composite",
      formula: "0,4 × min(Rule of 40 / 60, 1) + 0,3 × min(Marge / 50, 1) + 0,2 × max(0, 1 − Concentration / 100) + 0,1 × tendance marge",
      benchmark: "≥ 75 = world-class · 55-75 = premium · 35-55 = solide · < 35 = en deçà",
      inputs: ["Rule of 40", "Marge", "Concentration", "Tendance marge YoY"],
    });
  }

  const r40Norm = Math.max(0, Math.min(1, r40.value / 60));
  const marginNorm = Math.max(0, Math.min(1, marginV / 50));
  const concNorm = Math.max(0, 1 - conc.value / 100);
  const trendNorm = Math.max(0, Math.min(1, (marginTrend + 5) / 10));
  const score100 = (0.4 * r40Norm + 0.3 * marginNorm + 0.2 * concNorm + 0.1 * trendNorm) * 100;
  const tier: SuperKpiTier = score100 >= 75 ? "premium" : score100 >= 55 ? "solid" : score100 >= 35 ? "average" : "below";

  return {
    id: "ppi",
    name: "Mettrik Profit Power Index",
    category: "Composite",
    value: score100,
    display: `${score100.toFixed(0)} / 100`,
    tier,
    color: TIER_COLOR[tier],
    tierLabel: TIER_LABEL[tier],
    gaugePct: score100,
    inputs: [
      `Rule of 40 : ${r40.value.toFixed(1)}`,
      `Marge : ${marginV.toFixed(1)} %`,
      `Concentration : ${conc.value.toFixed(1)} %`,
      `Tendance marge : ${marginTrend >= 0 ? "+" : ""}${marginTrend.toFixed(1)} bps YoY`,
    ],
    formula: "0,4 × R40_norm + 0,3 × Marge_norm + 0,2 × (1 − Conc_norm) + 0,1 × Tendance_norm",
    benchmark: "≥ 75 = world-class · 55-75 = premium · 35-55 = solide · < 35 = en deçà",
    interpretation:
      score100 >= 75
        ? "Note world-class. La société conjugue croissance, profitabilité, diversification et expansion de marges. Très peu de stés du S&P 500 dépassent 75."
        : score100 >= 55
        ? "Profil premium. Au moins 3 des 4 dimensions sont au top. Reste un axe d'amélioration (souvent concentration ou tendance marge)."
        : score100 >= 35
        ? "Profil solide mais une dimension tire la note vers le bas. Identifier laquelle est l'enjeu principal pour la valorisation."
        : "Plusieurs dimensions sont sous le seuil. Profil défensif ou en transformation, à analyser avec un regard sectoriel.",
  };
}

function naResult(base: { id: string; name: string; category: SuperKpi["category"]; formula: string; benchmark: string; inputs: string[] }): SuperKpi {
  return {
    ...base,
    value: null,
    display: "N/A",
    tier: "na",
    color: TIER_COLOR.na,
    tierLabel: TIER_LABEL.na,
    gaugePct: 0,
    interpretation: "Données nécessaires non disponibles pour cette société.",
  };
}

/** Calcule tous les super-KPIs génériques pour une société. */
export function computeSuperKpis(c: Company): SuperKpi[] {
  return [
    profitPowerIndex(c), // signature en premier
    ruleOf40(c),
    qualityOfCompounding(c),
    concentrationRisk(c),
    capitalIntensity(c),
  ];
}

/* ═══════════════════════════════════════════════════════════════════════
 *  Super-KPI sector-specific — 2 par sté, calibrés sur le business model
 *  ═══════════════════════════════════════════════════════════════════════ */

function tacRatio(c: Company): SuperKpi {
  const tac = findKpi(c, "TAC");
  const rev = findKpi(c, "Revenue");
  const t = tac ? num(tac.value) : null;
  const r = rev ? num(rev.value) : null;
  if (t === null || r === null) return naResult({ id: "tac", name: "Ratio TAC distribution", category: "Stratégie", formula: "TAC / Revenue (%)", benchmark: "< 12 % = autonomie · 12-18 % = standard · > 18 % = dépendance forte", inputs: ["TAC", "Revenue"] });
  const pct = (t / r) * 100;
  const tier: SuperKpiTier = pct < 12 ? "premium" : pct < 18 ? "solid" : pct < 22 ? "average" : "below";
  return {
    id: "tac",
    name: "Ratio TAC (distribution)",
    category: "Stratégie",
    value: pct,
    display: `${pct.toFixed(1)} %`,
    tier,
    color: TIER_COLOR[tier],
    tierLabel: TIER_LABEL[tier],
    gaugePct: Math.min(100, (pct / 30) * 100),
    inputs: [`TAC ${t.toFixed(1)}`, `Revenue ${r.toFixed(1)}`],
    formula: "TAC (Traffic Acquisition Cost) / Revenue (%)",
    benchmark: "< 12 % = autonomie · 12-18 % = standard · > 18 % = dépendance",
    interpretation: "Part du Revenue versée aux partenaires de distribution (Apple Safari, Mozilla, opérateurs Android tiers). Sujet structurant suivi par toute la sell-side internet, surtout depuis le procès antitrust DOJ vs Google qui menace l'accord Apple.",
  };
}

function cloudPerCapex(c: Company): SuperKpi {
  const cloud = findKpi(c, "Cloud");
  const capex = findKpi(c, "Capex");
  const cl = cloud ? num(cloud.value) : null;
  const cx = capex ? num(capex.value) : null;
  if (cl === null || cx === null || cx === 0) return naResult({ id: "cloud-capex", name: "Cloud per Capex Dollar", category: "Stratégie", formula: "Cloud Revenue / Capex (×)", benchmark: "> 1 = harvest · 0,5-1 = transition · < 0,5 = pari massif", inputs: ["Cloud", "Capex"] });
  const ratio = cl / cx;
  const tier: SuperKpiTier = ratio >= 1 ? "premium" : ratio >= 0.6 ? "solid" : ratio >= 0.3 ? "average" : "below";
  return {
    id: "cloud-capex",
    name: "Cloud per Capex Dollar",
    category: "Stratégie",
    value: ratio,
    display: `${ratio.toFixed(2)} ×`,
    tier,
    color: TIER_COLOR[tier],
    tierLabel: ratio >= 1 ? "Harvest" : ratio >= 0.6 ? "Transition" : "Pari massif",
    gaugePct: Math.min(100, ratio * 50),
    inputs: [`Cloud ${cl.toFixed(1)} Mds`, `Capex ${cx.toFixed(1)} Mds`],
    formula: "Cloud Revenue / Capex (×)",
    benchmark: "> 1 = harvest cloud · 0,5-1 = transition · < 0,5 = pari infra massif (souvent IA)",
    interpretation: "Mesure la rentabilisation du Capex IA / cloud. Un ratio < 0,5 signale que la sté investit beaucoup plus dans l'infrastructure qu'elle n'en récolte encore en revenus cloud : pari sur l'IA générative.",
  };
}

function adEngineSaturation(c: Company): SuperKpi {
  const arpp = findKpi(c, "ARPP");
  const dap = findKpi(c, "DAP");
  const rev = findKpi(c, "Revenue");
  const a = arpp ? num(arpp.value) : null;
  const d = dap ? num(dap.value) : null;
  const r = rev ? num(rev.value) : null;
  if (a === null || d === null || r === null) return naResult({ id: "ad-sat", name: "Ad Engine Saturation", category: "Stratégie", formula: "(ARPP × 4 × DAP) / Revenue (%)", benchmark: "< 90 % = upsell room · 90-110 % = mature · > 110 % = saturé", inputs: ["ARPP", "DAP", "Revenue"] });
  const annualized = a * 4 * d;
  const pct = (annualized / r) * 100;
  const tier: SuperKpiTier = pct < 90 ? "premium" : pct < 110 ? "solid" : pct < 130 ? "average" : "below";
  return {
    id: "ad-sat",
    name: "Ad Engine Saturation",
    category: "Stratégie",
    value: pct,
    display: `${pct.toFixed(0)} %`,
    tier,
    color: TIER_COLOR[tier],
    tierLabel: pct < 90 ? "Upsell room" : pct < 110 ? "Mature" : "Saturé",
    gaugePct: Math.min(100, (pct / 130) * 100),
    inputs: [`ARPP ${a}`, `DAP ${d} Mds`, `Revenue ${r.toFixed(1)} Mds`],
    formula: "(ARPP × 4 trim × DAP) / Revenue (%)",
    benchmark: "< 90 % = upsell room · 90-110 % = mature · > 110 % = monétisation saturée",
    interpretation: "Mesure dans quelle proportion le Revenue est déjà capté par la combinaison ARPP × utilisateurs. Si > 110 %, la croissance future repose sur de nouveaux pricing levers (Reels, WhatsApp Business) plutôt que sur l'ad load existant.",
  };
}

function realityLabsBurn(c: Company): SuperKpi {
  const rl = findKpi(c, "RL Loss");
  const rev = findKpi(c, "Revenue");
  const lossV = rl ? Math.abs(num(rl.value) ?? 0) : null;
  const r = rev ? num(rev.value) : null;
  if (lossV === null || r === null) return naResult({ id: "rl-burn", name: "Reality Labs Burn Rate", category: "Risque", formula: "|RL Loss| / Revenue (%)", benchmark: "< 5 % = bet contenu · 5-10 % = bet majeur · > 10 % = bet existentiel", inputs: ["RL Loss", "Revenue"] });
  const pct = (lossV / r) * 100;
  const tier: SuperKpiTier = pct < 5 ? "premium" : pct < 10 ? "solid" : pct < 15 ? "average" : "below";
  return {
    id: "rl-burn",
    name: "Reality Labs Burn Rate",
    category: "Risque",
    value: pct,
    display: `${pct.toFixed(1)} %`,
    tier,
    color: TIER_COLOR[tier],
    tierLabel: pct < 5 ? "Bet contenu" : pct < 10 ? "Bet majeur" : "Bet existentiel",
    gaugePct: Math.min(100, (pct / 20) * 100),
    inputs: [`Pertes RL ${lossV.toFixed(1)} Mds`, `Revenue ${r.toFixed(1)} Mds`],
    formula: "|Pertes Reality Labs| / Revenue (%)",
    benchmark: "< 5 % bet contenu · 5-10 % bet majeur · > 10 % bet existentiel",
    interpretation: "Mesure l'agressivité du pari métaverse vs la base ad-tech rentable. À comparer à la trajectoire historique : si le ratio se réduit, cela signifie que Reality Labs commence à monétiser ; sinon c'est un drain structurel sur la marge consolidée.",
  };
}

function subscriptionQuality(c: Company): SuperKpi {
  const subRR = findKpi(c, "Sub RR");
  const totalRR = findKpi(c, "Total RR");
  const ret = findKpi(c, "Retention");
  const sR = subRR ? num(subRR.value) : null;
  const tR = totalRR ? num(totalRR.value) : null;
  const re = ret ? num(ret.value) : null;
  if (sR === null || tR === null || re === null || tR === 0) return naResult({ id: "sub-q", name: "Subscription Quality", category: "Composite", formula: "(Sub RR / Total RR) × Retention (%)", benchmark: "> 70 = premium · 60-70 = solide · < 60 = sous pression", inputs: ["Sub RR", "Total RR", "Retention"] });
  const score = (sR / tR) * re;
  const tier: SuperKpiTier = score >= 70 ? "premium" : score >= 60 ? "solid" : score >= 50 ? "average" : "below";
  return {
    id: "sub-q",
    name: "Subscription Quality",
    category: "Composite",
    value: score,
    display: `${score.toFixed(1)}`,
    tier,
    color: TIER_COLOR[tier],
    tierLabel: TIER_LABEL[tier],
    gaugePct: Math.min(100, score),
    inputs: [`Part subscription ${((sR / tR) * 100).toFixed(0)} %`, `Rétention ${re} %`],
    formula: "(Sub RR / Total RR) × Retention (%)",
    benchmark: "> 70 premium · 60-70 solide · < 60 sous pression",
    interpretation: "Compose la part récurrente du revenu (subscription vs Asset-Based Fees marché-dépendantes) avec la rétention. Mesure la qualité structurelle de la base d'abonnés : élevée = revenu prévisible et défensif.",
  };
}

function netNewVelocity(c: Company): SuperKpi {
  const netNew = findKpi(c, "Net New");
  const subRR = findKpi(c, "Sub RR");
  const nn = netNew ? num(netNew.value) : null;
  const sR = subRR ? num(subRR.value) : null;
  if (nn === null || sR === null || sR === 0) return naResult({ id: "nn-vel", name: "Net New Velocity", category: "Croissance", formula: "(Net New × 4) / Sub RR (% annualisé)", benchmark: "> 12 % premium · 8-12 % solide · < 8 % en deçà", inputs: ["Net New", "Sub RR"] });
  const pct = ((nn * 4) / sR) * 100;
  const tier: SuperKpiTier = pct >= 12 ? "premium" : pct >= 8 ? "solid" : pct >= 4 ? "average" : "below";
  return {
    id: "nn-vel",
    name: "Net New Velocity",
    category: "Croissance",
    value: pct,
    display: `${pct.toFixed(1)} %`,
    tier,
    color: TIER_COLOR[tier],
    tierLabel: TIER_LABEL[tier],
    gaugePct: Math.min(100, (pct / 18) * 100),
    inputs: [`Net New ${nn} M$ (Q4)`, `Sub RR ${sR} M$`],
    formula: "(Net New Q4 × 4) / Sub RR (% annualisé)",
    benchmark: "> 12 % premium · 8-12 % solide · < 8 % en deçà",
    interpretation: "Vélocité organique du subscription book. Combine l'effort commercial du dernier trimestre annualisé et la base installée. Métrique standard chez les SaaS pures (Salesforce, ServiceNow) et étendue aux index providers.",
  };
}

function spgiMixPremium(c: Company): SuperKpi {
  const mi = findKpi(c, "MI");
  const idx = findKpi(c, "Indices");
  const mob = findKpi(c, "Mobility");
  const rev = findKpi(c, "Revenue");
  const m = mi ? num(mi.value) : null;
  const i = idx ? num(idx.value) : null;
  const mb = mob ? num(mob.value) : null;
  const r = rev ? num(rev.value) : null;
  if (m === null || i === null || mb === null || r === null || r === 0) return naResult({ id: "mix-prem", name: "Mix Premium (hors Ratings)", category: "Risque", formula: "(MI + Indices + Mobility) / Revenue (%)", benchmark: "> 60 = très diversifié · 50-60 = équilibré · < 50 = ratings-dépendant", inputs: ["MI", "Indices", "Mobility", "Revenue"] });
  const pct = ((m + i + mb) / r) * 100;
  const tier: SuperKpiTier = pct >= 60 ? "premium" : pct >= 50 ? "solid" : pct >= 40 ? "average" : "below";
  return {
    id: "mix-prem",
    name: "Mix Premium (hors Ratings)",
    category: "Risque",
    value: pct,
    display: `${pct.toFixed(1)} %`,
    tier,
    color: TIER_COLOR[tier],
    tierLabel: TIER_LABEL[tier],
    gaugePct: Math.min(100, pct),
    inputs: [`MI + Indices + Mobility ${(m + i + mb).toFixed(0)} M$`, `Revenue ${r.toFixed(0)} M$`],
    formula: "(MI + Indices + Mobility) / Revenue (%)",
    benchmark: "> 60 très diversifié · 50-60 équilibré · < 50 ratings-dépendant",
    interpretation: "Part du revenu provenant des activités subscription récurrentes (hors Ratings, segment cyclique exposé au volume d'émissions obligataires). Indique la résilience post-fusion IHS Markit.",
  };
}

function vitalityIndex(c: Company): SuperKpi {
  const vit = findKpi(c, "Vitality");
  const rev = findKpi(c, "Revenue");
  const v = vit ? num(vit.value) : null;
  const r = rev ? num(rev.value) : null;
  if (v === null || r === null || r === 0) return naResult({ id: "vitality", name: "Vitality Innovation Index", category: "Composite", formula: "Vitality / Revenue (%)", benchmark: "> 12 % premium · 8-12 % solide · < 8 % en deçà", inputs: ["Vitality", "Revenue"] });
  const pct = (v / r) * 100;
  const tier: SuperKpiTier = pct >= 12 ? "premium" : pct >= 8 ? "solid" : pct >= 5 ? "average" : "below";
  return {
    id: "vitality",
    name: "Vitality Innovation Index",
    category: "Composite",
    value: pct,
    display: `${pct.toFixed(1)} %`,
    tier,
    color: TIER_COLOR[tier],
    tierLabel: TIER_LABEL[tier],
    gaugePct: Math.min(100, (pct / 18) * 100),
    inputs: [`Vitality ${v.toFixed(0)} M$`, `Revenue ${r.toFixed(0)} M$`],
    formula: "Vitality (revenu produits < 3 ans) / Revenue (%)",
    benchmark: "> 12 % premium · 8-12 % solide · < 8 % en deçà",
    interpretation: "Métrique propriétaire SPGI : part du revenu venant de produits lancés dans les 3 dernières années. Mesure la machine d'innovation de la sté, suivi en investor day comme un commitment du management.",
  };
}

function backlogCoverage(c: Company): SuperKpi {
  const bl = findKpi(c, "Backlog");
  const rev = findKpi(c, "Revenue");
  const b = bl ? num(bl.value) : null;
  const r = rev ? num(rev.value) : null;
  if (b === null || r === null || r === 0) return naResult({ id: "backlog", name: "Backlog Coverage", category: "Croissance", formula: "Backlog / Revenue × 12 (mois)", benchmark: "> 12 mois premium · 6-12 solide · < 6 vulnérable", inputs: ["Backlog", "Revenue"] });
  const months = (b / r) * 12;
  const tier: SuperKpiTier = months >= 12 ? "premium" : months >= 9 ? "solid" : months >= 6 ? "average" : "below";
  return {
    id: "backlog",
    name: "Backlog Coverage",
    category: "Croissance",
    value: months,
    display: `${months.toFixed(1)} mois`,
    tier,
    color: TIER_COLOR[tier],
    tierLabel: TIER_LABEL[tier],
    gaugePct: Math.min(100, (months / 18) * 100),
    inputs: [`Backlog ${b.toFixed(1)} Mds`, `Revenue ${r.toFixed(1)} Mds`],
    formula: "Backlog / Revenue × 12 (mois)",
    benchmark: "> 12 mois premium · 6-12 solide · < 6 vulnérable au cycle",
    interpretation: "Visibilité du carnet de commandes en mois de Revenue. Standard des industriels lourds (CAT, Boeing, Siemens) : un backlog épais est l'isolant principal contre les chocs de demande à court terme.",
  };
}

function cashQuality(c: Company): SuperKpi {
  const fcf = findKpi(c, "FCF MP&E") ?? findKpi(c, "FCF");
  const ni = findKpi(c, "Net Income");
  const f = fcf ? num(fcf.value) : null;
  const n = ni ? num(ni.value) : null;
  if (f === null || n === null || n === 0) return naResult({ id: "cash-q", name: "Cash Quality", category: "Composite", formula: "FCF / Net Income (×)", benchmark: "> 1 excellent · 0,8-1 sain · < 0,8 douteux", inputs: ["FCF", "Net Income"] });
  const ratio = f / n;
  const tier: SuperKpiTier = ratio >= 1 ? "premium" : ratio >= 0.8 ? "solid" : ratio >= 0.5 ? "average" : "below";
  return {
    id: "cash-q",
    name: "Cash Quality",
    category: "Composite",
    value: ratio,
    display: `${ratio.toFixed(2)} ×`,
    tier,
    color: TIER_COLOR[tier],
    tierLabel: ratio >= 1 ? "Excellent" : ratio >= 0.8 ? "Sain" : ratio >= 0.5 ? "Standard" : "Douteux",
    gaugePct: Math.min(100, ratio * 60),
    inputs: [`FCF ${f.toFixed(1)} Mds`, `Net Income ${n.toFixed(1)} Mds`],
    formula: "Free Cash Flow / Net Income (×)",
    benchmark: "> 1 excellent (cash > comptable) · 0,8-1 sain · < 0,8 accruals élevés",
    interpretation: "Earnings quality classique. Un ratio supérieur à 1 indique que le cash réellement généré dépasse le bénéfice comptable, signal de comptabilité conservatrice. Très suivi par les value investors et les short-sellers.",
  };
}

/** Calcule les 2 super-KPIs sector-specific d'une société. */
export function computeSectorSuperKpis(c: Company): SuperKpi[] {
  switch (c.ticker) {
    case "GOOGL":
      return [tacRatio(c), cloudPerCapex(c)];
    case "META":
      return [adEngineSaturation(c), realityLabsBurn(c)];
    case "MSCI":
      return [subscriptionQuality(c), netNewVelocity(c)];
    case "SPGI":
      return [spgiMixPremium(c), vitalityIndex(c)];
    case "CAT":
      return [backlogCoverage(c), cashQuality(c)];
    default:
      return [];
  }
}
