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
 *   tierLabel     : libellé court du tier traduit selon la locale
 *   gaugePct      : 0..100 pour la jauge UI
 *   inputs        : liste des KPIs sources utilisés (transparence)
 *   formula       : formule lisible (traduite)
 *   interpretation: phrase d'interprétation contextualisée (traduite)
 *
 * i18n : toutes les fonctions exposées acceptent un `locale` optionnel.
 *   - Si absent → fallback "en" (règle Yann 17 mai 2026 : EN canonical).
 *   - Les strings narratives utilisent un mini-dictionnaire local
 *     `SUPER_KPI_STRINGS` (FR + EN obligatoires, DE quand pertinent).
 */

import type { Company, KPI } from "@/lib/data";
import type { Locale } from "@/lib/i18n/types";

export type SuperKpiTier = "premium" | "solid" | "average" | "below" | "na";

/**
 * Catégorie d'un super-KPI, identifiée par une clé stable EN
 * (les anciennes valeurs FR "Croissance"/"Profitabilité"/etc. sont
 * conservées comme clés de mapping i18n côté UI).
 */
export type SuperKpiCategory = "Croissance" | "Profitabilité" | "Risque" | "Stratégie" | "Composite";

export type SuperKpi = {
  id: string;
  name: string;
  category: SuperKpiCategory;
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

/* ═════════════════════════════════════════════════════════════════════
 *  i18n strings — mini-dictionnaire local au module super-kpi.
 *  Règle Yann 17 mai 2026 : EN = canonical, FR = traduction conservée.
 *  Pour chaque clé, EN est OBLIGATOIRE.
 * ═════════════════════════════════════════════════════════════════════ */

type LocalizedString = { en: string; fr: string; de?: string };

function pickLoc(s: LocalizedString, locale: Locale): string {
  // Priorité : locale exacte → base (de-CH→de, en-GB→en) → en → fr
  const rec = s as Record<string, string | undefined>;
  if (rec[locale]) return rec[locale]!;
  const base = locale.split("-")[0];
  if (rec[base]) return rec[base]!;
  return s.en;
}

const TIER_LABEL: Record<SuperKpiTier, LocalizedString> = {
  premium: { en: "Premium", fr: "Premium", de: "Premium" },
  solid:   { en: "Solid",   fr: "Solide",  de: "Solide" },
  average: { en: "Average", fr: "Moyen",   de: "Mittel" },
  below:   { en: "Below",   fr: "Faible",  de: "Schwach" },
  na:      { en: "N/A",     fr: "Non applicable", de: "Nicht anwendbar" },
};

const STR = {
  // Generic
  na_data: {
    en: "Required data not available for this company.",
    fr: "Données nécessaires non disponibles pour cette société.",
    de: "Erforderliche Daten für dieses Unternehmen nicht verfügbar.",
  },
  ppi_na_missing_prefix: {
    en: "Cannot compute. Missing inputs: ",
    fr: "Calcul impossible. KPIs manquants : ",
    de: "Berechnung nicht möglich. Fehlende Daten: ",
  },

  // Rule of 40
  r40_formula_na: {
    en: "Revenue growth (% YoY) + Operating margin (%)",
    fr: "Croissance Revenue (% YoY) + Marge opérationnelle (%)",
  },
  r40_formula: {
    en: "Revenue growth (% YoY) + Op. margin (%)",
    fr: "Croissance Revenue (% YoY) + Marge op. (%)",
  },
  r40_benchmark: {
    en: "≥ 40 = premium · 30-40 = solid · < 30 = below",
    fr: "≥ 40 = premium · 30-40 = solide · < 30 = en deçà",
  },
  r40_interp_top: {
    en: "The company combines growth and financial discipline at a premium level. SaaS standard adopted across the tech industry: a single number to assess the quality of both the growth engine and profitability.",
    fr: "La société conjugue croissance et discipline financière à un niveau premium. Standard SaaS adopté par toute la tech : un chiffre unique pour évaluer la qualité à la fois du moteur de croissance et de la rentabilité.",
  },
  r40_interp_low: {
    en: "The growth/margin pair does not reach the reference threshold. Either growth is slowing, or margins are under pressure, or both.",
    fr: "Le couple croissance / marge n'atteint pas le seuil de référence. Soit la croissance ralentit, soit les marges sont sous pression, ou les deux.",
  },

  // Quality of Compounding
  qoc_formula_na: {
    en: "5-year Revenue CAGR (%) × Op. margin (%) / 100",
    fr: "CAGR Revenue 5 ans (%) × Marge op. (%) / 100",
  },
  qoc_formula: {
    en: "(5y Revenue CAGR × Op. margin) / 100",
    fr: "(CAGR Revenue 5y × Marge op.) / 100",
  },
  qoc_benchmark: {
    en: "≥ 8 = exceptional · 4-8 = good · < 4 = poor compounder",
    fr: "≥ 8 = exceptionnel · 4-8 = bon · < 4 = poor compounder",
  },
  qoc_interp_top: {
    en: "Premium Buffett-style compounding engine: growth is not bought at the cost of low margins. Capital efficient and durable.",
    fr: "Moteur de compounding premium type Buffett : la croissance n'est pas achetée au prix d'une marge faible. Capital efficient et durable.",
  },
  qoc_interp_mid: {
    en: "Solid compounder. The company grows with a respectable margin, but not in the league of the very top compounders.",
    fr: "Compounder solide. La société grandit avec une marge respectable, mais pas dans la cour des très grands compounders.",
  },
  qoc_interp_low: {
    en: "Growth and margin do not compound enough to qualify as premium compounding. Often sector-specific (cyclical industry, mature ad-tech).",
    fr: "Croissance et marge ne se cumulent pas suffisamment pour parler de compounding premium. Souvent sectoriel (industrie cyclique, ad-tech mature).",
  },

  // Concentration Risk
  conc_formula: {
    en: "Largest segment / Total revenue (%)",
    fr: "Plus gros segment / Revenue total (%)",
  },
  conc_benchmark: {
    en: "< 35 % = well diversified · 35-60 % = concentrated · > 60 % = monoculture",
    fr: "< 35 % = bien diversifié · 35-60 % = concentré · > 60 % = monoculture",
  },
  conc_interp_low: {
    en: "Healthy diversification. No single segment weighs more than a third of revenue, so an isolated downturn won't push the company into recession.",
    fr: "Diversification saine. Aucun segment ne pèse plus du tiers du Revenue, donc un retournement isolé n'enverra pas la sté en récession.",
  },
  // Templated narratives (used with replace())
  conc_interp_mid: {
    en: "Significant concentration on {seg} ({pct} %). To watch: a sector shock on this segment would impact the whole.",
    fr: "Concentration significative sur {seg} ({pct} %). À surveiller : un choc sectoriel sur ce segment impacterait la totalité.",
  },
  conc_interp_high: {
    en: "Monoculture on {seg} ({pct} %). The company is exposed to the cycle of this single segment. Binary structural risk.",
    fr: "Monoculture sur {seg} ({pct} %). La sté est exposée au cycle de ce segment unique. Risque structurel binaire.",
  },

  // Capital Intensity
  cap_formula: {
    en: "Capex / Revenue (%)",
    fr: "Capex / Revenue (%)",
  },
  cap_benchmark_na: {
    en: "Asset-light < 8 % · normal 8-20 % · heavy investment > 20 %",
    fr: "Asset-light < 8 % · normal 8-20 % · investissement lourd > 20 %",
  },
  cap_benchmark: {
    en: "< 8 % asset-light · 8-20 % standard · > 20 % heavy investment · > 35 % strategic bet",
    fr: "< 8 % asset-light · 8-20 % standard · > 20 % investissement lourd · > 35 % pari stratégique",
  },
  cap_label_asset_light: { en: "Asset-light", fr: "Asset-light" },
  cap_label_standard:    { en: "Standard",    fr: "Standard" },
  cap_label_heavy:       { en: "Heavy investment", fr: "Investissement lourd" },
  cap_label_over:        { en: "Over-investment",  fr: "Sur-investissement" },
  cap_interp_low: {
    en: "Asset-light model: growth doesn't require heavy physical investment. Structurally higher ROIC.",
    fr: "Modèle asset-light : la croissance ne demande pas d'investissement physique lourd. ROIC structurellement plus élevé.",
  },
  cap_interp_mid: {
    en: "Normalized capex for the sector. The company invests to maintain and grow its asset base without excessive pressure on margins.",
    fr: "Capex normalisé pour le secteur. La sté investit pour maintenir et développer son outil sans peser excessivement sur les marges.",
  },
  cap_interp_high: {
    en: "Major infrastructure investment. Often justified by a strategic pivot (AI, cloud, industrial capacity). To evaluate based on future ROIC.",
    fr: "Investissement infrastructure majeur. Souvent justifié par une bascule stratégique (IA, cloud, capacité industrielle). À évaluer selon le ROIC futur.",
  },
  cap_interp_over: {
    en: "Extraordinary capex: the company is funding a structural bet (generative AI, datacenters, capacity). Real near-term risk on free cash flow.",
    fr: "Capex extraordinaire : la sté finance un pari structurel (IA générative, datacenters, capacités). Risque réel sur le free cash flow à court terme.",
  },

  // Profit Power Index
  ppi_formula_na: {
    en: "0.4 × min(Rule of 40 / 60, 1) + 0.3 × min(Margin / 50, 1) + 0.2 × max(0, 1 − Concentration / 100) + 0.1 × margin trend",
    fr: "0,4 × min(Rule of 40 / 60, 1) + 0,3 × min(Marge / 50, 1) + 0,2 × max(0, 1 − Concentration / 100) + 0,1 × tendance marge",
  },
  ppi_formula: {
    en: "0.4 × R40_norm + 0.3 × Margin_norm + 0.2 × (1 − Conc_norm) + 0.1 × Trend_norm",
    fr: "0,4 × R40_norm + 0,3 × Marge_norm + 0,2 × (1 − Conc_norm) + 0,1 × Tendance_norm",
  },
  ppi_benchmark: {
    en: "≥ 75 = world-class · 55-75 = premium · 35-55 = solid · < 35 = below",
    fr: "≥ 75 = world-class · 55-75 = premium · 35-55 = solide · < 35 = en deçà",
  },
  ppi_interp_top: {
    en: "World-class score. The company combines growth, profitability, diversification and margin expansion. Very few S&P 500 companies exceed 75.",
    fr: "Note world-class. La société conjugue croissance, profitabilité, diversification et expansion de marges. Très peu de stés du S&P 500 dépassent 75.",
  },
  ppi_interp_high: {
    en: "Premium profile. At least 3 of the 4 dimensions are at the top. One axis of improvement remains (often concentration or margin trend).",
    fr: "Profil premium. Au moins 3 des 4 dimensions sont au top. Reste un axe d'amélioration (souvent concentration ou tendance marge).",
  },
  ppi_interp_mid: {
    en: "Solid profile, but one dimension is dragging the score down. Identifying which one is the main issue for valuation.",
    fr: "Profil solide mais une dimension tire la note vers le bas. Identifier laquelle est l'enjeu principal pour la valorisation.",
  },
  ppi_interp_low: {
    en: "Several dimensions are below the threshold. Defensive or transformative profile, to analyze with a sector lens.",
    fr: "Plusieurs dimensions sont sous le seuil. Profil défensif ou en transformation, à analyser avec un regard sectoriel.",
  },
  ppi_input_r40:    { en: "Rule of 40", fr: "Rule of 40" },
  ppi_input_margin: { en: "Margin",     fr: "Marge" },
  ppi_input_conc:   { en: "Concentration", fr: "Concentration" },
  ppi_input_trend:  { en: "Margin trend", fr: "Tendance marge" },

  // Names
  name_rule40: { en: "Rule of 40", fr: "Rule of 40" },
  name_qoc: { en: "Quality of Compounding", fr: "Quality of Compounding" },
  name_conc: { en: "Concentration Risk", fr: "Concentration Risk" },
  name_capint: { en: "Capital Intensity", fr: "Capital Intensity" },
  name_ppi: { en: "Mettrik Profit Power Index", fr: "Mettrik Profit Power Index" },

  // Sector KPIs — names & narratives
  name_tac: { en: "TAC Ratio (distribution)", fr: "Ratio TAC (distribution)" },
  name_tac_na: { en: "TAC Distribution Ratio", fr: "Ratio TAC distribution" },
  tac_formula: { en: "TAC / Revenue (%)", fr: "TAC / Revenue (%)" },
  tac_formula_long: {
    en: "TAC (Traffic Acquisition Cost) / Revenue (%)",
    fr: "TAC (Traffic Acquisition Cost) / Revenue (%)",
  },
  tac_benchmark_na: {
    en: "< 12 % = autonomy · 12-18 % = standard · > 18 % = strong dependency",
    fr: "< 12 % = autonomie · 12-18 % = standard · > 18 % = dépendance forte",
  },
  tac_benchmark: {
    en: "< 12 % = autonomy · 12-18 % = standard · > 18 % = dependency",
    fr: "< 12 % = autonomie · 12-18 % = standard · > 18 % = dépendance",
  },
  tac_interp: {
    en: "Share of revenue paid to distribution partners (Apple Safari, Mozilla, third-party Android carriers). Structural topic followed by all internet sell-side, especially since the DOJ vs Google antitrust trial threatens the Apple deal.",
    fr: "Part du Revenue versée aux partenaires de distribution (Apple Safari, Mozilla, opérateurs Android tiers). Sujet structurant suivi par toute la sell-side internet, surtout depuis le procès antitrust DOJ vs Google qui menace l'accord Apple.",
  },

  name_cloud_capex: { en: "Cloud per Capex Dollar", fr: "Cloud per Capex Dollar" },
  cloud_formula: { en: "Cloud Revenue / Capex (×)", fr: "Cloud Revenue / Capex (×)" },
  cloud_benchmark_na: {
    en: "> 1 = harvest · 0.5-1 = transition · < 0.5 = massive bet",
    fr: "> 1 = harvest · 0,5-1 = transition · < 0,5 = pari massif",
  },
  cloud_benchmark: {
    en: "> 1 = cloud harvest · 0.5-1 = transition · < 0.5 = massive infra bet (often AI)",
    fr: "> 1 = harvest cloud · 0,5-1 = transition · < 0,5 = pari infra massif (souvent IA)",
  },
  cloud_label_harvest:    { en: "Harvest", fr: "Harvest" },
  cloud_label_transition: { en: "Transition", fr: "Transition" },
  cloud_label_massive:    { en: "Massive bet", fr: "Pari massif" },
  cloud_interp: {
    en: "Measures the return on AI/cloud capex. A ratio < 0.5 signals that the company is investing much more in infrastructure than it currently harvests in cloud revenue: a bet on generative AI.",
    fr: "Mesure la rentabilisation du Capex IA / cloud. Un ratio < 0,5 signale que la sté investit beaucoup plus dans l'infrastructure qu'elle n'en récolte encore en revenus cloud : pari sur l'IA générative.",
  },

  name_ad_sat: { en: "Ad Engine Saturation", fr: "Ad Engine Saturation" },
  ad_formula: { en: "(ARPP × 4 × DAP) / Revenue (%)", fr: "(ARPP × 4 × DAP) / Revenue (%)" },
  ad_formula_long: {
    en: "(ARPP × 4 quarters × DAP) / Revenue (%)",
    fr: "(ARPP × 4 trim × DAP) / Revenue (%)",
  },
  ad_benchmark_na: {
    en: "< 90 % = upsell room · 90-110 % = mature · > 110 % = saturated",
    fr: "< 90 % = upsell room · 90-110 % = mature · > 110 % = saturé",
  },
  ad_benchmark: {
    en: "< 90 % = upsell room · 90-110 % = mature · > 110 % = saturated monetization",
    fr: "< 90 % = upsell room · 90-110 % = mature · > 110 % = monétisation saturée",
  },
  ad_label_upsell:    { en: "Upsell room", fr: "Upsell room" },
  ad_label_mature:    { en: "Mature",      fr: "Mature" },
  ad_label_saturated: { en: "Saturated",   fr: "Saturé" },
  ad_interp: {
    en: "Measures the proportion of revenue already captured by the ARPP × users combination. If > 110 %, future growth depends on new pricing levers (Reels, WhatsApp Business) rather than the existing ad load.",
    fr: "Mesure dans quelle proportion le Revenue est déjà capté par la combinaison ARPP × utilisateurs. Si > 110 %, la croissance future repose sur de nouveaux pricing levers (Reels, WhatsApp Business) plutôt que sur l'ad load existant.",
  },

  name_rl_burn: { en: "Reality Labs Burn Rate", fr: "Reality Labs Burn Rate" },
  rl_formula: { en: "|RL Loss| / Revenue (%)", fr: "|RL Loss| / Revenue (%)" },
  rl_formula_long: {
    en: "|Reality Labs Losses| / Revenue (%)",
    fr: "|Pertes Reality Labs| / Revenue (%)",
  },
  rl_benchmark_na: {
    en: "< 5 % = contained bet · 5-10 % = major bet · > 10 % = existential bet",
    fr: "< 5 % = bet contenu · 5-10 % = bet majeur · > 10 % = bet existentiel",
  },
  rl_benchmark: {
    en: "< 5 % contained bet · 5-10 % major bet · > 10 % existential bet",
    fr: "< 5 % bet contenu · 5-10 % bet majeur · > 10 % bet existentiel",
  },
  rl_label_contained:   { en: "Contained bet",   fr: "Bet contenu" },
  rl_label_major:       { en: "Major bet",       fr: "Bet majeur" },
  rl_label_existential: { en: "Existential bet", fr: "Bet existentiel" },
  rl_interp: {
    en: "Measures the aggressiveness of the metaverse bet vs the profitable ad-tech base. To compare to historical trajectory: if the ratio shrinks, Reality Labs is starting to monetize; otherwise it's a structural drain on consolidated margin.",
    fr: "Mesure l'agressivité du pari métaverse vs la base ad-tech rentable. À comparer à la trajectoire historique : si le ratio se réduit, cela signifie que Reality Labs commence à monétiser ; sinon c'est un drain structurel sur la marge consolidée.",
  },

  name_sub_q: { en: "Subscription Quality", fr: "Subscription Quality" },
  sub_formula: { en: "(Sub RR / Total RR) × Retention (%)", fr: "(Sub RR / Total RR) × Retention (%)" },
  sub_benchmark_na: {
    en: "> 70 = premium · 60-70 = solid · < 60 = under pressure",
    fr: "> 70 = premium · 60-70 = solide · < 60 = sous pression",
  },
  sub_benchmark: {
    en: "> 70 premium · 60-70 solid · < 60 under pressure",
    fr: "> 70 premium · 60-70 solide · < 60 sous pression",
  },
  sub_interp: {
    en: "Combines the recurring share of revenue (subscription vs market-dependent Asset-Based Fees) with retention. Measures the structural quality of the subscriber base: high = predictable and defensive revenue.",
    fr: "Compose la part récurrente du revenu (subscription vs Asset-Based Fees marché-dépendantes) avec la rétention. Mesure la qualité structurelle de la base d'abonnés : élevée = revenu prévisible et défensif.",
  },
  sub_input_share: { en: "Subscription share", fr: "Part subscription" },
  sub_input_retention: { en: "Retention", fr: "Rétention" },

  name_nn_vel: { en: "Net New Velocity", fr: "Net New Velocity" },
  nn_formula: {
    en: "(Net New × 4) / Sub RR (% annualized)",
    fr: "(Net New × 4) / Sub RR (% annualisé)",
  },
  nn_formula_long: {
    en: "(Q4 Net New × 4) / Sub RR (% annualized)",
    fr: "(Net New Q4 × 4) / Sub RR (% annualisé)",
  },
  nn_benchmark: {
    en: "> 12 % premium · 8-12 % solid · < 8 % below",
    fr: "> 12 % premium · 8-12 % solide · < 8 % en deçà",
  },
  nn_interp: {
    en: "Organic velocity of the subscription book. Combines the latest quarter's commercial effort annualized with the installed base. Standard metric for pure SaaS (Salesforce, ServiceNow) and extended to index providers.",
    fr: "Vélocité organique du subscription book. Combine l'effort commercial du dernier trimestre annualisé et la base installée. Métrique standard chez les SaaS pures (Salesforce, ServiceNow) et étendue aux index providers.",
  },

  name_mix_prem: { en: "Mix Premium (ex-Ratings)", fr: "Mix Premium (hors Ratings)" },
  mix_formula: {
    en: "(MI + Indices + Mobility) / Revenue (%)",
    fr: "(MI + Indices + Mobility) / Revenue (%)",
  },
  mix_benchmark_na: {
    en: "> 60 = very diversified · 50-60 = balanced · < 50 = ratings-dependent",
    fr: "> 60 = très diversifié · 50-60 = équilibré · < 50 = ratings-dépendant",
  },
  mix_benchmark: {
    en: "> 60 very diversified · 50-60 balanced · < 50 ratings-dependent",
    fr: "> 60 très diversifié · 50-60 équilibré · < 50 ratings-dépendant",
  },
  mix_interp: {
    en: "Share of revenue from recurring subscription activities (excluding Ratings, a cyclical segment exposed to bond issuance volume). Indicates post-merger IHS Markit resilience.",
    fr: "Part du revenu provenant des activités subscription récurrentes (hors Ratings, segment cyclique exposé au volume d'émissions obligataires). Indique la résilience post-fusion IHS Markit.",
  },

  name_vitality: { en: "Vitality Innovation Index", fr: "Vitality Innovation Index" },
  vit_formula: { en: "Vitality / Revenue (%)", fr: "Vitality / Revenue (%)" },
  vit_formula_long: {
    en: "Vitality (revenue from products < 3 years old) / Revenue (%)",
    fr: "Vitality (revenu produits < 3 ans) / Revenue (%)",
  },
  vit_benchmark: {
    en: "> 12 % premium · 8-12 % solid · < 8 % below",
    fr: "> 12 % premium · 8-12 % solide · < 8 % en deçà",
  },
  vit_interp: {
    en: "SPGI proprietary metric: share of revenue from products launched in the last 3 years. Measures the company's innovation machine, tracked at investor day as a management commitment.",
    fr: "Métrique propriétaire SPGI : part du revenu venant de produits lancés dans les 3 dernières années. Mesure la machine d'innovation de la sté, suivi en investor day comme un commitment du management.",
  },

  name_backlog: { en: "Backlog Coverage", fr: "Backlog Coverage" },
  bl_formula: { en: "Backlog / Revenue × 12 (months)", fr: "Backlog / Revenue × 12 (mois)" },
  bl_benchmark_na: {
    en: "> 12 months premium · 6-12 solid · < 6 vulnerable",
    fr: "> 12 mois premium · 6-12 solide · < 6 vulnérable",
  },
  bl_benchmark: {
    en: "> 12 months premium · 6-12 solid · < 6 cycle-vulnerable",
    fr: "> 12 mois premium · 6-12 solide · < 6 vulnérable au cycle",
  },
  bl_unit_months: { en: "months", fr: "mois" },
  bl_interp: {
    en: "Order book visibility in months of revenue. Standard for heavy industrials (CAT, Boeing, Siemens): a thick backlog is the main insulator against near-term demand shocks.",
    fr: "Visibilité du carnet de commandes en mois de Revenue. Standard des industriels lourds (CAT, Boeing, Siemens) : un backlog épais est l'isolant principal contre les chocs de demande à court terme.",
  },

  name_cash_q: { en: "Cash Quality", fr: "Cash Quality" },
  cq_formula: { en: "FCF / Net Income (×)", fr: "FCF / Net Income (×)" },
  cq_formula_long: { en: "Free Cash Flow / Net Income (×)", fr: "Free Cash Flow / Net Income (×)" },
  cq_benchmark_na: {
    en: "> 1 excellent · 0.8-1 healthy · < 0.8 questionable",
    fr: "> 1 excellent · 0,8-1 sain · < 0,8 douteux",
  },
  cq_benchmark: {
    en: "> 1 excellent (cash > accounting) · 0.8-1 healthy · < 0.8 high accruals",
    fr: "> 1 excellent (cash > comptable) · 0,8-1 sain · < 0,8 accruals élevés",
  },
  cq_label_excellent: { en: "Excellent", fr: "Excellent" },
  cq_label_healthy:   { en: "Healthy",   fr: "Sain" },
  cq_label_standard:  { en: "Standard",  fr: "Standard" },
  cq_label_questionable: { en: "Questionable", fr: "Douteux" },
  cq_interp: {
    en: "Classic earnings quality. A ratio above 1 indicates that the cash actually generated exceeds accounting net income, a sign of conservative accounting. Closely watched by value investors and short-sellers.",
    fr: "Earnings quality classique. Un ratio supérieur à 1 indique que le cash réellement généré dépasse le bénéfice comptable, signal de comptabilité conservatrice. Très suivi par les value investors et les short-sellers.",
  },

  // Inputs labels
  in_top_segment: { en: "Top segment", fr: "Top segment" },
  in_total_revenue: { en: "Total revenue", fr: "Revenue total" },
  in_revenue_yoy: { en: "Revenue YoY", fr: "Revenue YoY" },
  in_margin: { en: "Margin", fr: "Marge" },
  in_cagr_5y: { en: "5y CAGR", fr: "CAGR 5y" },
  in_loss: { en: "RL Losses", fr: "Pertes RL" },
} as const;

function tr(key: keyof typeof STR, locale: Locale, vars?: Record<string, string | number>): string {
  let s = pickLoc(STR[key], locale);
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      s = s.replace(`{${k}}`, String(v));
    }
  }
  return s;
}

function findKpi(c: Company, short: string): KPI | undefined {
  return c.kpis.find((k) => k.short === short);
}

/**
 * Cherche un KPI Revenue (top-line, en valeur absolue $/€).
 * Élargit le matching au-delà de findKpi(c, "Revenue") qui ne couvrait
 * que ~50 stés. Couvre top-line "Total Revenue", "Net Sales", "Total Net Sales",
 * "Sales", + hero KPI Revenue-like si pas de générique trouvé.
 * Filtre les KPI en % (R&D as %, marges).
 */
function findRevenueKpi(c: Company): KPI | undefined {
  // Priorité 1 : shorts standards (couvre la grande majorité)
  const standardShorts = [
    "Revenue",
    "Total Revenue",
    "Total Revenues",
    "Net Sales",
    "Total Net Sales",
    "Sales",
    "Net Sales (Group)",
    "Net Revenue",
    "Total Net Revenue",
    "Revenues",
    "Net Revenues",
    "Group Revenue",
    "Group Sales",
    "Total fee revenue", // banques fee-based (STT)
    "Net interest income", // banques (NII = top line équivalent)
    "Operating revenue",
    "Operating revenues",
  ];
  for (const s of standardShorts) {
    const k = findKpi(c, s);
    if (k && k.unit !== "%" && k.history && k.history.length >= 2) {
      return k;
    }
  }
  // Priorité 2 : name_en / name_fr correspondants (banques, FR, EU)
  const candidate = c.kpis.find((k) => {
    if (k.unit === "%" || (k.unit || "").includes("YoY")) return false;
    if (!k.history || k.history.length < 2) return false;
    const en = (k.name_en || "").toLowerCase();
    const fr = (k.name_fr || "").toLowerCase();
    return (
      en === "total revenue" ||
      en === "total revenues" ||
      en === "net sales" ||
      en === "total net sales" ||
      en === "revenue" ||
      en === "net revenues" ||
      en === "group revenue" ||
      en === "operating revenue" ||
      en === "operating revenues" ||
      en === "net interest income" ||
      fr === "chiffre d'affaires" ||
      fr === "chiffre d'affaires total" ||
      fr === "revenu total" ||
      fr === "produit net bancaire" // banques FR
    );
  });
  if (candidate) return candidate;

  // Priorité 3 : si la sté a un hero_kpi qui matche un KPI Revenue-like
  // (NVDA: "Data Center Revenue" peut servir de proxy si Total Revenue absent)
  // SKIPPED pour rester honnête : un revenu de segment n'est pas un proxy
  // fiable pour Rule of 40 global. Mieux vaut N/A que faux signal.
  return undefined;
}

/**
 * Cherche un KPI Op Margin / Operating Margin / EBITDA Margin.
 * Couvre les variations FR/EN/EU et banques (Cost-Income inversé).
 */
function findMarginKpi(c: Company): KPI | undefined {
  // Standards
  const standardShorts = [
    "Op Margin",
    "Operating Margin",
    "EBITDA Mgn",
    "EBITDA Margin",
    "Op. Margin",
    "Op Mgn",
    "Adjusted Operating Margin",
    "Adj Operating Margin",
    "Adj Op Margin",
    "Adjusted EBITDAC Margin",
    "Adjusted EBITDA Margin",
    "Adj EBITDA Margin",
    "EBIT Margin",
    "EBIT Margin before Special Items",
    "Pre-tax margin", // banques (STT)
  ];
  for (const s of standardShorts) {
    const k = findKpi(c, s);
    if (k && k.unit === "%") return k;
  }
  // Match par name_en / name_fr : élargi aux variantes "Adjusted"
  const candidate = c.kpis.find((k) => {
    if (k.unit !== "%") return false;
    const en = (k.name_en || "").toLowerCase();
    const fr = (k.name_fr || "").toLowerCase();
    return (
      en === "operating margin" ||
      en === "op margin" ||
      en === "ebitda margin" ||
      en === "ebit margin" ||
      en === "adjusted operating margin" ||
      en === "adj operating margin" ||
      en === "adjusted ebitda margin" ||
      en === "adjusted ebit margin" ||
      en === "pre-tax margin" ||
      fr === "marge opérationnelle" ||
      fr === "marge op." ||
      fr === "marge ebitda" ||
      fr === "marge ebit"
    );
  });
  return candidate;
}

/**
 * Computed margin from Operating Income / Revenue if both available with absolute units.
 * Useful when company doesn't publish "Op Margin" directly (AWK, PFE, etc).
 * Returns a synthetic KPI-like object compatible with downstream consumers.
 */
function computeOperatingMargin(c: Company): { value: number; history: number[] } | null {
  // Cherche Op Income (valeur absolue)
  const opIncomeShorts = [
    "Operating Income",
    "Op Income",
    "Adjusted Operating Income",
    "EBIT",
    "Adjusted EBIT",
  ];
  let opInc: KPI | undefined;
  for (const s of opIncomeShorts) {
    const k = findKpi(c, s);
    if (k && k.unit !== "%" && k.history && k.history.length >= 2) {
      opInc = k;
      break;
    }
  }
  if (!opInc) return null;
  const rev = findRevenueKpi(c);
  if (!rev) return null;
  const opV = num(opInc.value);
  const revV = num(rev.value);
  if (opV === null || revV === null || revV === 0) return null;
  // Unit normalization: convert to same base. Mds = 1000 M.
  const unitFactor = (u: string): number => {
    const s = (u || "").trim().toLowerCase();
    if (s.startsWith("mds") || s.startsWith("bn") || s.includes("billion") || s.startsWith("md €") || s.startsWith("md $")) return 1000;
    if (s.startsWith("m ") || s.startsWith("m$") || s.startsWith("m €") || s.includes("million")) return 1;
    return 1; // fallback : ignore (assume same)
  };
  const opFactor = unitFactor(opInc.unit || "");
  const revFactor = unitFactor(rev.unit || "");
  const opNorm = opV * opFactor;
  const revNorm = revV * revFactor;
  if (revNorm === 0) return null;
  const marginPct = (opNorm / revNorm) * 100;
  // Compute history-by-history when possible (using same scale factors)
  const hist: number[] = [];
  const minLen = Math.min(opInc.history.length, rev.history.length);
  for (let i = 0; i < minLen; i++) {
    const o = opInc.history[opInc.history.length - minLen + i];
    const r = rev.history[rev.history.length - minLen + i];
    if (typeof o === "number" && typeof r === "number" && r > 0) {
      hist.push(((o * opFactor) / (r * revFactor)) * 100);
    }
  }
  if (hist.length < 2) return null;
  // Sanity check : margin should be plausible (-50% to 80%)
  if (marginPct < -50 || marginPct > 80) return null;
  return { value: marginPct, history: hist };
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

/** Map ticker → segments candidats (legacy V1, fallback si pas de revenue_by_segment). */
const SEGMENT_MAP: Record<string, string[]> = {
  GOOGL: ["Search", "Cloud", "YT Ads", "Subs"],
  META: ["FoA Op"],
  MSCI: ["Index", "Sub RR", "ABF", "Analytics"],
  SPGI: ["MI", "Ratings", "Indices", "Energy", "Mobility"],
  CAT: ["Energy", "Construction", "Resource"],
};

/** Cherche un KPI Capex en testant plusieurs variations de nommage. */
function findCapexKpi(c: Company): KPI | undefined {
  const candidates = ["Capex", "CapEx", "Capex Total", "Capex total", "Capital Expenditure", "Capital Expenditures"];
  for (const s of candidates) {
    const k = findKpi(c, s);
    if (k) return k;
  }
  return c.kpis.find((k) => {
    const nameEn = (k.name_en || "").toLowerCase();
    const nameFr = (k.name_fr || "").toLowerCase();
    if (k.unit === "%") return false;
    return (
      nameEn.includes("capital expenditure") ||
      (nameEn.startsWith("capex") && !nameEn.includes("%")) ||
      (nameFr.includes("capex") && !nameFr.includes("%") && !nameFr.includes("ratio"))
    );
  });
}

/* Helper: format a number FR-style with comma decimal separator. */
function fmt(n: number, decimals: number): string {
  return n.toFixed(decimals).replace(".", ",");
}

/* ═══════════════════════════════════════════════════════════════════════
 *  Super-KPI 1 — RULE OF 40
 *  ═══════════════════════════════════════════════════════════════════════ */
function ruleOf40(c: Company, locale: Locale): SuperKpi {
  const rev = findRevenueKpi(c);
  const margin = findMarginKpi(c);
  const revYoY = rev ? yoyFromHistory(rev.history) : null;
  let marginV = margin ? num(margin.value) : null;
  // Fallback computed margin if no direct margin KPI
  if (marginV === null) {
    const computed = computeOperatingMargin(c);
    if (computed) marginV = computed.value;
  }

  if (revYoY === null || marginV === null) {
    return naResult(
      {
        id: "rule40",
        name: tr("name_rule40", locale),
        category: "Croissance",
        formula: tr("r40_formula_na", locale),
        benchmark: tr("r40_benchmark", locale),
        inputs: ["Revenue", "Op Margin"],
      },
      locale,
    );
  }

  const score = revYoY + marginV;
  const tier: SuperKpiTier = score >= 50 ? "premium" : score >= 40 ? "solid" : score >= 25 ? "average" : "below";
  const gauge = Math.max(0, Math.min(100, (score / 70) * 100));

  return {
    id: "rule40",
    name: tr("name_rule40", locale),
    category: "Croissance",
    value: score,
    display: `${fmt(score, 1)}`,
    tier,
    color: TIER_COLOR[tier],
    tierLabel: pickLoc(TIER_LABEL[tier], locale),
    gaugePct: gauge,
    inputs: [`${tr("in_revenue_yoy", locale)} ${fmt(revYoY, 1)} %`, `${tr("in_margin", locale)} ${fmt(marginV, 1)} %`],
    formula: tr("r40_formula", locale),
    benchmark: tr("r40_benchmark", locale),
    interpretation: score >= 40 ? tr("r40_interp_top", locale) : tr("r40_interp_low", locale),
  };
}

/* ═══════════════════════════════════════════════════════════════════════
 *  Super-KPI 2 — QUALITY OF COMPOUNDING (CAGR × Marge)
 *  ═══════════════════════════════════════════════════════════════════════ */
function qualityOfCompounding(c: Company, locale: Locale): SuperKpi {
  const rev = findRevenueKpi(c);
  const margin = findMarginKpi(c);
  const cagr5y = rev ? cagr(rev.history) : null;
  let marginV = margin ? num(margin.value) : null;
  if (marginV === null) {
    const computed = computeOperatingMargin(c);
    if (computed) marginV = computed.value;
  }

  if (cagr5y === null || marginV === null) {
    return naResult(
      {
        id: "qoc",
        name: tr("name_qoc", locale),
        category: "Composite",
        formula: tr("qoc_formula_na", locale),
        benchmark: tr("qoc_benchmark", locale),
        inputs: ["Revenue (5y history)", "Op Margin"],
      },
      locale,
    );
  }

  const cagrPct = cagr5y * 100;
  const score = (cagrPct * marginV) / 100;
  const tier: SuperKpiTier = score >= 8 ? "premium" : score >= 4 ? "solid" : score >= 1.5 ? "average" : "below";
  const gauge = Math.max(0, Math.min(100, (score / 12) * 100));

  return {
    id: "qoc",
    name: tr("name_qoc", locale),
    category: "Composite",
    value: score,
    display: `${fmt(score, 2)}`,
    tier,
    color: TIER_COLOR[tier],
    tierLabel: pickLoc(TIER_LABEL[tier], locale),
    gaugePct: gauge,
    inputs: [`${tr("in_cagr_5y", locale)} ${fmt(cagrPct, 1)} %`, `${tr("in_margin", locale)} ${fmt(marginV, 1)} %`],
    formula: tr("qoc_formula", locale),
    benchmark: tr("qoc_benchmark", locale),
    interpretation:
      score >= 8 ? tr("qoc_interp_top", locale)
      : score >= 4 ? tr("qoc_interp_mid", locale)
      : tr("qoc_interp_low", locale),
  };
}

/* ═══════════════════════════════════════════════════════════════════════
 *  Super-KPI 3 — CONCENTRATION RISK (Top segment / Revenue)
 *  ═══════════════════════════════════════════════════════════════════════ */
function concentrationRisk(c: Company, locale: Locale): SuperKpi {
  // Source 1 (prioritaire) : revenue_by_segment.slices avec share_pct calculé.
  // Couvre 1000+ stés au lieu des 5 du SEGMENT_MAP hardcodé.
  const rbs = c.revenue_by_segment;
  let topName: string | null = null;
  let topPct: number | null = null;

  if (rbs && Array.isArray(rbs.slices) && rbs.slices.length > 0) {
    let best: { name: string; pct: number } | null = null;
    for (const s of rbs.slices) {
      const sAny = s as unknown as { label?: string; name?: string; share_pct?: number; pct?: number; value?: number };
      const name = sAny.label || sAny.name || "";
      let pct = typeof sAny.share_pct === "number" ? sAny.share_pct
              : typeof sAny.pct === "number" ? sAny.pct
              : null;
      // Fallback : si pas de share_pct, calculer depuis value et total
      if (pct === null && typeof sAny.value === "number") {
        const total = rbs.total ?? rbs.slices.reduce((acc, x) => {
          const xAny = x as unknown as { value?: number };
          return acc + (typeof xAny.value === "number" ? xAny.value : 0);
        }, 0);
        if (total > 0) pct = (sAny.value / total) * 100;
      }
      if (pct !== null && (!best || pct > best.pct)) {
        best = { name, pct };
      }
    }
    if (best) {
      topName = best.name;
      topPct = best.pct;
    }
  }

  // Source 2 (fallback legacy) : SEGMENT_MAP pour les 5 stés V1.
  if (topPct === null) {
    const rev = findKpi(c, "Revenue");
    const revV = rev ? num(rev.value) : null;
    const segs = SEGMENT_MAP[c.ticker];
    if (revV && segs) {
      const top = topSegment(c, segs);
      if (top) {
        topName = top.name;
        topPct = (top.value / revV) * 100;
      }
    }
  }

  if (topPct === null || topName === null) {
    return naResult(
      {
        id: "conc",
        name: tr("name_conc", locale),
        category: "Risque",
        formula: tr("conc_formula", locale),
        benchmark: tr("conc_benchmark", locale),
        inputs: ["revenue_by_segment.slices", "KPIs segments"],
      },
      locale,
    );
  }

  const pct = topPct;
  const top = { name: topName, value: pct };
  // Inversé : plus le pct est élevé, plus le tier est mauvais
  const tier: SuperKpiTier = pct < 35 ? "premium" : pct < 50 ? "solid" : pct < 65 ? "average" : "below";
  const gauge = Math.min(100, pct);

  return {
    id: "conc",
    name: tr("name_conc", locale),
    category: "Risque",
    value: pct,
    display: `${fmt(pct, 1)} %`,
    tier,
    color: TIER_COLOR[tier],
    tierLabel: pickLoc(TIER_LABEL[tier], locale),
    gaugePct: gauge,
    inputs: [`${tr("in_top_segment", locale)} : ${top.name}`, `${fmt(pct, 1)} % du Revenue`],
    formula: tr("conc_formula", locale),
    benchmark: tr("conc_benchmark", locale),
    interpretation:
      pct < 35
        ? tr("conc_interp_low", locale)
        : pct < 60
        ? tr("conc_interp_mid", locale, { seg: top.name, pct: fmt(pct, 0) })
        : tr("conc_interp_high", locale, { seg: top.name, pct: fmt(pct, 0) }),
  };
}

/* ═══════════════════════════════════════════════════════════════════════
 *  Super-KPI 4 — CAPITAL INTENSITY (Capex / Revenue)
 *  ═══════════════════════════════════════════════════════════════════════ */
function capitalIntensity(c: Company, locale: Locale): SuperKpi {
  // Cherche Capex en testant plusieurs variations de nommage (Capex, CapEx,
  // Capex Total, Capital Expenditure, name_en/name_fr contenant "capex").
  // Couvre ~830 stés au lieu de la trentaine du strict "Capex" short match.
  const capex = findCapexKpi(c);
  const rev = findKpi(c, "Revenue");
  const capexV = capex ? num(capex.value) : null;
  const revV = rev ? num(rev.value) : null;
  if (capexV === null || revV === null || revV === 0) {
    return naResult(
      {
        id: "capint",
        name: tr("name_capint", locale),
        category: "Stratégie",
        formula: tr("cap_formula", locale),
        benchmark: tr("cap_benchmark_na", locale),
        inputs: ["Capex", "Revenue"],
      },
      locale,
    );
  }
  const pct = (capexV / revV) * 100;
  let tier: SuperKpiTier;
  let label: string;
  let interp: string;
  if (pct < 8) {
    tier = "premium";
    label = pickLoc(STR.cap_label_asset_light, locale);
    interp = tr("cap_interp_low", locale);
  } else if (pct < 20) {
    tier = "solid";
    label = pickLoc(STR.cap_label_standard, locale);
    interp = tr("cap_interp_mid", locale);
  } else if (pct < 35) {
    tier = "average";
    label = pickLoc(STR.cap_label_heavy, locale);
    interp = tr("cap_interp_high", locale);
  } else {
    tier = "below";
    label = pickLoc(STR.cap_label_over, locale);
    interp = tr("cap_interp_over", locale);
  }
  const gauge = Math.min(100, (pct / 50) * 100);

  return {
    id: "capint",
    name: tr("name_capint", locale),
    category: "Stratégie",
    value: pct,
    display: `${fmt(pct, 1)} %`,
    tier,
    color: TIER_COLOR[tier],
    tierLabel: label,
    gaugePct: gauge,
    inputs: [`Capex ${fmt(capexV, 1)}`, `Revenue ${fmt(revV, 1)}`],
    formula: tr("cap_formula", locale),
    benchmark: tr("cap_benchmark", locale),
    interpretation: interp,
  };
}

/* ═══════════════════════════════════════════════════════════════════════
 *  Super-KPI 5 — METTRIK PROFIT POWER INDEX (composite signature)
 *  ═══════════════════════════════════════════════════════════════════════ */
function profitPowerIndex(c: Company, locale: Locale): SuperKpi {
  const r40 = ruleOf40(c, locale);
  const conc = concentrationRisk(c, locale);
  const margin = findMarginKpi(c);
  let marginV = margin ? num(margin.value) : null;
  let marginTrend = margin ? yoyFromHistory(margin.history) : null;
  // Fallback : margin computed from Op Income / Revenue
  if (marginV === null || marginTrend === null) {
    const computed = computeOperatingMargin(c);
    if (computed) {
      if (marginV === null) marginV = computed.value;
      if (marginTrend === null) marginTrend = yoyFromHistory(computed.history);
    }
  }

  // Calcul partiel : on accepte de calculer dès qu'on a au moins MARGIN
  // (input central, présent sur ~95% des stés). Les autres inputs sont
  // pondérés dynamiquement en fonction de leur disponibilité.
  // Honesty rule : si seulement margin disponible, retourner N/A
  // (un score "Profit Power" basé uniquement sur la marge n'a aucun sens).
  const r40Available = r40.value !== null;
  const marginAvailable = marginV !== null;
  const concAvailable = conc.value !== null;
  const trendAvailable = marginTrend !== null;

  const availableCount =
    Number(r40Available) + Number(marginAvailable) + Number(concAvailable) + Number(trendAvailable);

  // Minimum requirement : margin OBLIGATOIRE + au moins 1 autre input.
  // Sinon N/A explicite avec liste des inputs manquants.
  if (!marginAvailable || availableCount < 2) {
    const missing: string[] = [];
    if (!r40Available) missing.push(tr("ppi_input_r40", locale));
    if (!marginAvailable) missing.push(tr("ppi_input_margin", locale));
    if (!concAvailable) missing.push(tr("ppi_input_conc", locale));
    if (!trendAvailable) missing.push(tr("ppi_input_trend", locale) + " YoY");

    const base = naResult(
      {
        id: "ppi",
        name: tr("name_ppi", locale),
        category: "Composite",
        formula: tr("ppi_formula_na", locale),
        benchmark: tr("ppi_benchmark", locale),
        inputs: [
          tr("ppi_input_r40", locale),
          tr("ppi_input_margin", locale),
          tr("ppi_input_conc", locale),
          tr("ppi_input_trend", locale) + " YoY",
        ],
      },
      locale,
    );
    return {
      ...base,
      interpretation: tr("ppi_na_missing_prefix", locale) + missing.join(", "),
    };
  }

  // Poids cibles : R40=40%, Margin=30%, Conc=20%, Trend=10%
  // Si un input manque, son poids est redistribué proportionnellement aux autres.
  const weightsRaw = {
    r40: r40Available ? 0.4 : 0,
    margin: marginAvailable ? 0.3 : 0,
    conc: concAvailable ? 0.2 : 0,
    trend: trendAvailable ? 0.1 : 0,
  };
  const totalWeight = weightsRaw.r40 + weightsRaw.margin + weightsRaw.conc + weightsRaw.trend;
  // Normalize so weights sum to 1
  const w = {
    r40: weightsRaw.r40 / totalWeight,
    margin: weightsRaw.margin / totalWeight,
    conc: weightsRaw.conc / totalWeight,
    trend: weightsRaw.trend / totalWeight,
  };

  const r40Norm = r40Available ? Math.max(0, Math.min(1, (r40.value as number) / 60)) : 0;
  const marginNorm = marginAvailable ? Math.max(0, Math.min(1, (marginV as number) / 50)) : 0;
  const concNorm = concAvailable ? Math.max(0, 1 - (conc.value as number) / 100) : 0;
  const trendNorm = trendAvailable
    ? Math.max(0, Math.min(1, ((marginTrend as number) + 5) / 10))
    : 0;

  const score100 =
    (w.r40 * r40Norm + w.margin * marginNorm + w.conc * concNorm + w.trend * trendNorm) * 100;

  const tier: SuperKpiTier =
    score100 >= 75 ? "premium" : score100 >= 55 ? "solid" : score100 >= 35 ? "average" : "below";

  // Confidence flag : si tous les inputs présents → high, 3/4 → medium, 2/4 → low
  const confidence: "high" | "medium" | "low" =
    availableCount === 4 ? "high" : availableCount === 3 ? "medium" : "low";

  // Construire la liste des inputs en n'affichant que ceux disponibles
  const inputsList: string[] = [];
  if (r40Available)
    inputsList.push(`${tr("ppi_input_r40", locale)} : ${fmt(r40.value as number, 1)}`);
  if (marginAvailable)
    inputsList.push(`${tr("ppi_input_margin", locale)} : ${fmt(marginV as number, 1)} %`);
  if (concAvailable)
    inputsList.push(`${tr("ppi_input_conc", locale)} : ${fmt(conc.value as number, 1)} %`);
  if (trendAvailable) {
    const t = marginTrend as number;
    inputsList.push(`${tr("ppi_input_trend", locale)} : ${t >= 0 ? "+" : ""}${fmt(t, 1)} bps YoY`);
  }
  // Note de confiance si calcul partiel
  if (confidence !== "high") {
    const noteEn = confidence === "medium" ? "Partial calculation (3/4 inputs)" : "Partial calculation (2/4 inputs)";
    const noteFr = confidence === "medium" ? "Calcul partiel (3/4 inputs)" : "Calcul partiel (2/4 inputs)";
    inputsList.push(locale.startsWith("fr") ? noteFr : noteEn);
  }

  const interp =
    score100 >= 75
      ? tr("ppi_interp_top", locale)
      : score100 >= 55
        ? tr("ppi_interp_high", locale)
        : score100 >= 35
          ? tr("ppi_interp_mid", locale)
          : tr("ppi_interp_low", locale);

  return {
    id: "ppi",
    name: tr("name_ppi", locale),
    category: "Composite",
    value: score100,
    display: `${fmt(score100, 0)} / 100`,
    tier,
    color: TIER_COLOR[tier],
    tierLabel: pickLoc(TIER_LABEL[tier], locale),
    gaugePct: score100,
    inputs: inputsList,
    formula: tr("ppi_formula", locale),
    benchmark: tr("ppi_benchmark", locale),
    interpretation: interp,
  };
}

function naResult(
  base: { id: string; name: string; category: SuperKpi["category"]; formula: string; benchmark: string; inputs: string[] },
  locale: Locale,
): SuperKpi {
  return {
    ...base,
    value: null,
    display: "N/A",
    tier: "na",
    color: TIER_COLOR.na,
    tierLabel: pickLoc(TIER_LABEL.na, locale),
    gaugePct: 0,
    interpretation: tr("na_data", locale),
  };
}

/** Calcule tous les super-KPIs génériques pour une société. */
export function computeSuperKpis(c: Company, locale: Locale = "en"): SuperKpi[] {
  return [
    profitPowerIndex(c, locale), // signature en premier
    ruleOf40(c, locale),
    qualityOfCompounding(c, locale),
    concentrationRisk(c, locale),
    capitalIntensity(c, locale),
  ];
}

/* ═══════════════════════════════════════════════════════════════════════
 *  Super-KPI sector-specific — 2 par sté, calibrés sur le business model
 *  ═══════════════════════════════════════════════════════════════════════ */

function tacRatio(c: Company, locale: Locale): SuperKpi {
  const tac = findKpi(c, "TAC");
  const rev = findKpi(c, "Revenue");
  const t = tac ? num(tac.value) : null;
  const r = rev ? num(rev.value) : null;
  if (t === null || r === null) return naResult({ id: "tac", name: tr("name_tac_na", locale), category: "Stratégie", formula: tr("tac_formula", locale), benchmark: tr("tac_benchmark_na", locale), inputs: ["TAC", "Revenue"] }, locale);
  const pct = (t / r) * 100;
  const tier: SuperKpiTier = pct < 12 ? "premium" : pct < 18 ? "solid" : pct < 22 ? "average" : "below";
  return {
    id: "tac",
    name: tr("name_tac", locale),
    category: "Stratégie",
    value: pct,
    display: `${fmt(pct, 1)} %`,
    tier,
    color: TIER_COLOR[tier],
    tierLabel: pickLoc(TIER_LABEL[tier], locale),
    gaugePct: Math.min(100, (pct / 30) * 100),
    inputs: [`TAC ${fmt(t, 1)}`, `Revenue ${fmt(r, 1)}`],
    formula: tr("tac_formula_long", locale),
    benchmark: tr("tac_benchmark", locale),
    interpretation: tr("tac_interp", locale),
  };
}

function cloudPerCapex(c: Company, locale: Locale): SuperKpi {
  const cloud = findKpi(c, "Cloud");
  const capex = findKpi(c, "Capex");
  const cl = cloud ? num(cloud.value) : null;
  const cx = capex ? num(capex.value) : null;
  if (cl === null || cx === null || cx === 0) return naResult({ id: "cloud-capex", name: tr("name_cloud_capex", locale), category: "Stratégie", formula: tr("cloud_formula", locale), benchmark: tr("cloud_benchmark_na", locale), inputs: ["Cloud", "Capex"] }, locale);
  const ratio = cl / cx;
  const tier: SuperKpiTier = ratio >= 1 ? "premium" : ratio >= 0.6 ? "solid" : ratio >= 0.3 ? "average" : "below";
  const labelKey: keyof typeof STR =
    ratio >= 1 ? "cloud_label_harvest"
    : ratio >= 0.6 ? "cloud_label_transition"
    : "cloud_label_massive";
  return {
    id: "cloud-capex",
    name: tr("name_cloud_capex", locale),
    category: "Stratégie",
    value: ratio,
    display: `${fmt(ratio, 2)} ×`,
    tier,
    color: TIER_COLOR[tier],
    tierLabel: tr(labelKey, locale),
    gaugePct: Math.min(100, ratio * 50),
    inputs: [`Cloud ${fmt(cl, 1)} Mds`, `Capex ${fmt(cx, 1)} Mds`],
    formula: tr("cloud_formula", locale),
    benchmark: tr("cloud_benchmark", locale),
    interpretation: tr("cloud_interp", locale),
  };
}

function adEngineSaturation(c: Company, locale: Locale): SuperKpi {
  const arpp = findKpi(c, "ARPP");
  const dap = findKpi(c, "DAP");
  const rev = findKpi(c, "Revenue");
  const a = arpp ? num(arpp.value) : null;
  const d = dap ? num(dap.value) : null;
  const r = rev ? num(rev.value) : null;
  if (a === null || d === null || r === null) return naResult({ id: "ad-sat", name: tr("name_ad_sat", locale), category: "Stratégie", formula: tr("ad_formula", locale), benchmark: tr("ad_benchmark_na", locale), inputs: ["ARPP", "DAP", "Revenue"] }, locale);
  const annualized = a * 4 * d;
  const pct = (annualized / r) * 100;
  const tier: SuperKpiTier = pct < 90 ? "premium" : pct < 110 ? "solid" : pct < 130 ? "average" : "below";
  const labelKey: keyof typeof STR =
    pct < 90 ? "ad_label_upsell"
    : pct < 110 ? "ad_label_mature"
    : "ad_label_saturated";
  return {
    id: "ad-sat",
    name: tr("name_ad_sat", locale),
    category: "Stratégie",
    value: pct,
    display: `${fmt(pct, 0)} %`,
    tier,
    color: TIER_COLOR[tier],
    tierLabel: tr(labelKey, locale),
    gaugePct: Math.min(100, (pct / 130) * 100),
    inputs: [`ARPP ${a}`, `DAP ${d} Mds`, `Revenue ${fmt(r, 1)} Mds`],
    formula: tr("ad_formula_long", locale),
    benchmark: tr("ad_benchmark", locale),
    interpretation: tr("ad_interp", locale),
  };
}

function realityLabsBurn(c: Company, locale: Locale): SuperKpi {
  const rl = findKpi(c, "RL Loss");
  const rev = findKpi(c, "Revenue");
  const lossV = rl ? Math.abs(num(rl.value) ?? 0) : null;
  const r = rev ? num(rev.value) : null;
  if (lossV === null || r === null) return naResult({ id: "rl-burn", name: tr("name_rl_burn", locale), category: "Risque", formula: tr("rl_formula", locale), benchmark: tr("rl_benchmark_na", locale), inputs: ["RL Loss", "Revenue"] }, locale);
  const pct = (lossV / r) * 100;
  const tier: SuperKpiTier = pct < 5 ? "premium" : pct < 10 ? "solid" : pct < 15 ? "average" : "below";
  const labelKey: keyof typeof STR =
    pct < 5 ? "rl_label_contained"
    : pct < 10 ? "rl_label_major"
    : "rl_label_existential";
  return {
    id: "rl-burn",
    name: tr("name_rl_burn", locale),
    category: "Risque",
    value: pct,
    display: `${fmt(pct, 1)} %`,
    tier,
    color: TIER_COLOR[tier],
    tierLabel: tr(labelKey, locale),
    gaugePct: Math.min(100, (pct / 20) * 100),
    inputs: [`${tr("in_loss", locale)} ${fmt(lossV, 1)} Mds`, `Revenue ${fmt(r, 1)} Mds`],
    formula: tr("rl_formula_long", locale),
    benchmark: tr("rl_benchmark", locale),
    interpretation: tr("rl_interp", locale),
  };
}

function subscriptionQuality(c: Company, locale: Locale): SuperKpi {
  const subRR = findKpi(c, "Sub RR");
  const totalRR = findKpi(c, "Total RR");
  const ret = findKpi(c, "Retention");
  const sR = subRR ? num(subRR.value) : null;
  const tR = totalRR ? num(totalRR.value) : null;
  const re = ret ? num(ret.value) : null;
  if (sR === null || tR === null || re === null || tR === 0) return naResult({ id: "sub-q", name: tr("name_sub_q", locale), category: "Composite", formula: tr("sub_formula", locale), benchmark: tr("sub_benchmark_na", locale), inputs: ["Sub RR", "Total RR", "Retention"] }, locale);
  const score = (sR / tR) * re;
  const tier: SuperKpiTier = score >= 70 ? "premium" : score >= 60 ? "solid" : score >= 50 ? "average" : "below";
  return {
    id: "sub-q",
    name: tr("name_sub_q", locale),
    category: "Composite",
    value: score,
    display: `${fmt(score, 1)}`,
    tier,
    color: TIER_COLOR[tier],
    tierLabel: pickLoc(TIER_LABEL[tier], locale),
    gaugePct: Math.min(100, score),
    inputs: [`${tr("sub_input_share", locale)} ${fmt((sR / tR) * 100, 0)} %`, `${tr("sub_input_retention", locale)} ${re} %`],
    formula: tr("sub_formula", locale),
    benchmark: tr("sub_benchmark", locale),
    interpretation: tr("sub_interp", locale),
  };
}

function netNewVelocity(c: Company, locale: Locale): SuperKpi {
  const netNew = findKpi(c, "Net New");
  const subRR = findKpi(c, "Sub RR");
  const nn = netNew ? num(netNew.value) : null;
  const sR = subRR ? num(subRR.value) : null;
  if (nn === null || sR === null || sR === 0) return naResult({ id: "nn-vel", name: tr("name_nn_vel", locale), category: "Croissance", formula: tr("nn_formula", locale), benchmark: tr("nn_benchmark", locale), inputs: ["Net New", "Sub RR"] }, locale);
  const pct = ((nn * 4) / sR) * 100;
  const tier: SuperKpiTier = pct >= 12 ? "premium" : pct >= 8 ? "solid" : pct >= 4 ? "average" : "below";
  return {
    id: "nn-vel",
    name: tr("name_nn_vel", locale),
    category: "Croissance",
    value: pct,
    display: `${fmt(pct, 1)} %`,
    tier,
    color: TIER_COLOR[tier],
    tierLabel: pickLoc(TIER_LABEL[tier], locale),
    gaugePct: Math.min(100, (pct / 18) * 100),
    inputs: [`Net New ${nn} M$ (Q4)`, `Sub RR ${sR} M$`],
    formula: tr("nn_formula_long", locale),
    benchmark: tr("nn_benchmark", locale),
    interpretation: tr("nn_interp", locale),
  };
}

function spgiMixPremium(c: Company, locale: Locale): SuperKpi {
  const mi = findKpi(c, "MI");
  const idx = findKpi(c, "Indices");
  const mob = findKpi(c, "Mobility");
  const rev = findKpi(c, "Revenue");
  const m = mi ? num(mi.value) : null;
  const i = idx ? num(idx.value) : null;
  const mb = mob ? num(mob.value) : null;
  const r = rev ? num(rev.value) : null;
  if (m === null || i === null || mb === null || r === null || r === 0) return naResult({ id: "mix-prem", name: tr("name_mix_prem", locale), category: "Risque", formula: tr("mix_formula", locale), benchmark: tr("mix_benchmark_na", locale), inputs: ["MI", "Indices", "Mobility", "Revenue"] }, locale);
  const pct = ((m + i + mb) / r) * 100;
  const tier: SuperKpiTier = pct >= 60 ? "premium" : pct >= 50 ? "solid" : pct >= 40 ? "average" : "below";
  return {
    id: "mix-prem",
    name: tr("name_mix_prem", locale),
    category: "Risque",
    value: pct,
    display: `${fmt(pct, 1)} %`,
    tier,
    color: TIER_COLOR[tier],
    tierLabel: pickLoc(TIER_LABEL[tier], locale),
    gaugePct: Math.min(100, pct),
    inputs: [`MI + Indices + Mobility ${fmt(m + i + mb, 0)} M$`, `Revenue ${fmt(r, 0)} M$`],
    formula: tr("mix_formula", locale),
    benchmark: tr("mix_benchmark", locale),
    interpretation: tr("mix_interp", locale),
  };
}

function vitalityIndex(c: Company, locale: Locale): SuperKpi {
  const vit = findKpi(c, "Vitality");
  const rev = findKpi(c, "Revenue");
  const v = vit ? num(vit.value) : null;
  const r = rev ? num(rev.value) : null;
  if (v === null || r === null || r === 0) return naResult({ id: "vitality", name: tr("name_vitality", locale), category: "Composite", formula: tr("vit_formula", locale), benchmark: tr("vit_benchmark", locale), inputs: ["Vitality", "Revenue"] }, locale);
  const pct = (v / r) * 100;
  const tier: SuperKpiTier = pct >= 12 ? "premium" : pct >= 8 ? "solid" : pct >= 5 ? "average" : "below";
  return {
    id: "vitality",
    name: tr("name_vitality", locale),
    category: "Composite",
    value: pct,
    display: `${fmt(pct, 1)} %`,
    tier,
    color: TIER_COLOR[tier],
    tierLabel: pickLoc(TIER_LABEL[tier], locale),
    gaugePct: Math.min(100, (pct / 18) * 100),
    inputs: [`Vitality ${fmt(v, 0)} M$`, `Revenue ${fmt(r, 0)} M$`],
    formula: tr("vit_formula_long", locale),
    benchmark: tr("vit_benchmark", locale),
    interpretation: tr("vit_interp", locale),
  };
}

function backlogCoverage(c: Company, locale: Locale): SuperKpi {
  const bl = findKpi(c, "Backlog");
  const rev = findKpi(c, "Revenue");
  const b = bl ? num(bl.value) : null;
  const r = rev ? num(rev.value) : null;
  if (b === null || r === null || r === 0) return naResult({ id: "backlog", name: tr("name_backlog", locale), category: "Croissance", formula: tr("bl_formula", locale), benchmark: tr("bl_benchmark_na", locale), inputs: ["Backlog", "Revenue"] }, locale);
  const months = (b / r) * 12;
  const tier: SuperKpiTier = months >= 12 ? "premium" : months >= 9 ? "solid" : months >= 6 ? "average" : "below";
  return {
    id: "backlog",
    name: tr("name_backlog", locale),
    category: "Croissance",
    value: months,
    display: `${fmt(months, 1)} ${tr("bl_unit_months", locale)}`,
    tier,
    color: TIER_COLOR[tier],
    tierLabel: pickLoc(TIER_LABEL[tier], locale),
    gaugePct: Math.min(100, (months / 18) * 100),
    inputs: [`Backlog ${fmt(b, 1)} Mds`, `Revenue ${fmt(r, 1)} Mds`],
    formula: tr("bl_formula", locale),
    benchmark: tr("bl_benchmark", locale),
    interpretation: tr("bl_interp", locale),
  };
}

function cashQuality(c: Company, locale: Locale): SuperKpi {
  const fcf = findKpi(c, "FCF MP&E") ?? findKpi(c, "FCF");
  const ni = findKpi(c, "Net Income");
  const f = fcf ? num(fcf.value) : null;
  const n = ni ? num(ni.value) : null;
  if (f === null || n === null || n === 0) return naResult({ id: "cash-q", name: tr("name_cash_q", locale), category: "Composite", formula: tr("cq_formula", locale), benchmark: tr("cq_benchmark_na", locale), inputs: ["FCF", "Net Income"] }, locale);
  const ratio = f / n;
  const tier: SuperKpiTier = ratio >= 1 ? "premium" : ratio >= 0.8 ? "solid" : ratio >= 0.5 ? "average" : "below";
  const labelKey: keyof typeof STR =
    ratio >= 1 ? "cq_label_excellent"
    : ratio >= 0.8 ? "cq_label_healthy"
    : ratio >= 0.5 ? "cq_label_standard"
    : "cq_label_questionable";
  return {
    id: "cash-q",
    name: tr("name_cash_q", locale),
    category: "Composite",
    value: ratio,
    display: `${fmt(ratio, 2)} ×`,
    tier,
    color: TIER_COLOR[tier],
    tierLabel: tr(labelKey, locale),
    gaugePct: Math.min(100, ratio * 60),
    inputs: [`FCF ${fmt(f, 1)} Mds`, `Net Income ${fmt(n, 1)} Mds`],
    formula: tr("cq_formula_long", locale),
    benchmark: tr("cq_benchmark", locale),
    interpretation: tr("cq_interp", locale),
  };
}

/** Calcule les 2 super-KPIs sector-specific d'une société. */
export function computeSectorSuperKpis(c: Company, locale: Locale = "en"): SuperKpi[] {
  switch (c.ticker) {
    case "GOOGL":
      return [tacRatio(c, locale), cloudPerCapex(c, locale)];
    case "META":
      return [adEngineSaturation(c, locale), realityLabsBurn(c, locale)];
    case "MSCI":
      return [subscriptionQuality(c, locale), netNewVelocity(c, locale)];
    case "SPGI":
      return [spgiMixPremium(c, locale), vitalityIndex(c, locale)];
    case "CAT":
      return [backlogCoverage(c, locale), cashQuality(c, locale)];
    default:
      return [];
  }
}
