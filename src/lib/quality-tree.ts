/**
 * quality-tree.ts — Quality Registry UNIQUE de la page société Mettrik AI.
 *
 * Source de vérité unique consolidée pour :
 *  - /sandbox/quality-tree (vue humaine arbre dépliable)
 *  - /sandbox/coverage-matrix (vue data audit)
 *  - /sandbox/visual-audit (vue rendu Gemini)
 *  - scripts/visual-audit-gemini.py (template prompt enrichi des IDs)
 *  - scripts/fix-element.py (fix dispatcher futur)
 *
 * Structure arbre :
 *  - Niveau 0 : règles GLOBALES (theme, lang, formats, conventions)
 *  - Niveau 1 : BLOCS de page (Header, Hero, KPI table, Stories, Risks…)
 *  - Niveau 2 : SOUS-BLOCS (Hero = Sidebar + Chart + Interpretation)
 *  - Niveau 3 : ÉLÉMENTS contrôlables (anti-patterns + fixes)
 *
 * Chaque élément contrôlable a un ID stable utilisable comme tag de
 * communication ("corrige NVDA hero.chart.y_axis.no_overlap_with_tabs").
 *
 * Variantes : règles spéciales par fiscal year décalé, secteur, cat 1-4,
 * fréquence publication, dual-class, IPO récente, sté sans dividende.
 *
 * Yann 16 mai 2026 — Phase 2 du chantier Quality Registry.
 */

export type AuditorType =
  | "regex"           // Vérification regex sur le HTML rendu
  | "gemini-visual"   // Audit visuel Gemini 2.5 Flash (screenshot)
  | "data-structure"  // Vérification programmatique du dataset
  | "auto-test"       // Test unitaire ou e2e Playwright
  | "manual";         // Revue humaine uniquement

export type VariantSpec = {
  /** Règle spéciale si la sté a un fiscal year décalé (NVDA, AAPL, MSFT, Toyota, etc.) */
  fiscal_shifted?: string;
  /** Règle par catégorie source : 1=US 10-K, 2=FPI 20-F, 3=EU pure, 4=autres */
  cat?: { "1"?: string; "2"?: string; "3"?: string; "4"?: string };
  /** Règle par secteur (banques, utilities, biotech, etc.) */
  sector?: Record<string, string>;
  /** Règle pour sté sans wow KPI distinctif */
  no_wow?: string;
  /** Règle pour dual-class shares (GOOG/GOOGL, BRK.A/B) */
  dual_class?: string;
  /** Règle pour IPO récente (<6 ans) */
  young_ipo?: string;
  /** Règle pour sté non-payeuse de dividende */
  no_dividend?: string;
  /** Règle par fréquence de publication (quarterly US, semestrial EU, annual seul) */
  frequency?: { quarterly?: string; semestrial?: string; annual?: string };
};

export type QualityNode = {
  /** ID stable, dot-notation. Ex "hero.chart.y_axis.no_overlap_with_tabs". */
  id: string;
  /** Titre FR niveau ado 16 ans. */
  title: string;
  /** Description détaillée FR. */
  description: string;
  /** Profondeur dans l'arbre (0 = root, 4 = élément). */
  level: 0 | 1 | 2 | 3 | 4;
  /** Parent ID (null pour root). */
  parent: string | null;

  // Pour les éléments contrôlables (level 3-4) :
  /** Exemples concrets d'anti-patterns observés (screens Yann, audits passés). */
  anti_patterns?: string[];
  /** Règles spéciales par variante. */
  variants?: VariantSpec;
  /** Fichier:ligne où le code génère cet élément. */
  code_hooks?: string[];
  /** Mécanisme d'audit pour cet élément. */
  auditor?: AuditorType;
  /** Sévérité si fail (1 = mineur cosmétique, 5 = blocker démo). */
  severity_if_fail?: 1 | 2 | 3 | 4 | 5;
  /** ID auto-fix matchant chart-spec-verify ou fix-dispatcher (futur). */
  auto_fix?: string;
};

export const QUALITY_TREE: QualityNode[] = [
  // ════════════════════════════════════════════════════════════════════
  // NIVEAU 0 — RÈGLES GLOBALES
  // ════════════════════════════════════════════════════════════════════
  {
    id: "global",
    title: "Règles globales",
    description: "S'applique à toute la page sté, peu importe le bloc.",
    level: 0,
    parent: null,
  },
  {
    id: "global.lang",
    title: "Langue cohérente",
    description: "Page FR doit avoir <html lang=\"fr\">, aucun mot anglais user-facing (sauf taglines anglaises originales de la sté).",
    level: 1,
    parent: "global",
  },
  {
    id: "global.lang.html_attr",
    title: "Attribut lang HTML",
    description: "La balise <html> a l'attribut lang qui matche la locale active (fr / de / en / nl / sv / da / en-GB / de-CH).",
    level: 2,
    parent: "global.lang",
    anti_patterns: ["<html lang=\"en\"> sur page FR (228 stés flag par UI-AUDIT)"],
    code_hooks: ["src/app/layout.tsx"],
    auditor: "regex",
    severity_if_fail: 2,
    auto_fix: "global.lang.html_attr",
  },
  {
    id: "global.lang.no_english_leak",
    title: "Aucun mot anglais parasite",
    description: "Pages FR : tout texte user-facing en FR. Exceptions : taglines originales (italique) + noms de sociétés / produits.",
    level: 2,
    parent: "global.lang",
    anti_patterns: [
      "Chip 'Sector' / 'Sub-sector' / 'Founded' au lieu de 'Secteur' / 'Sous-secteur' / 'Fondée'",
      "Bouton 'Read more' au lieu de 'Voir plus'",
      "Label 'Recent' / 'Fresh' / 'Stale' au lieu de 'Récent' / 'À jour' / 'Périmé'",
    ],
    code_hooks: ["src/lib/ui-fix-templates.ts (translateChipLabel, translateFreshnessLabel)"],
    auditor: "regex",
    severity_if_fail: 2,
    variants: {
      cat: { "2": "Stés FPI ADR : tagline EN tolérée car officielle.", "3": "Stés EU : terminologie locale si pas de traduction FR officielle." },
    },
  },
  {
    id: "global.typography",
    title: "Typographie",
    description: "Conventions Mettrik : pas d'em-dash, pas de smart-quote agressif, espaces insécables FR.",
    level: 1,
    parent: "global",
  },
  {
    id: "global.typography.no_em_dash",
    title: "Aucun em-dash",
    description: "Le caractère '—' (em-dash) est BANNI dans tout texte user-facing. Remplacer par ':' ou phrase splittée.",
    level: 2,
    parent: "global.typography",
    anti_patterns: ["Signal contenant '—' (CONV-DATA 479 fixes en lot, ré-apparait si LLM remet)"],
    code_hooks: ["scripts/build-v2-pipeline-merged.ts (sanitize auto)"],
    auditor: "regex",
    severity_if_fail: 1,
  },
  {
    id: "global.typography.nbsp_before_pct",
    title: "Espace insécable avant %",
    description: "Format FR : '6,9 %' avec espace insécable (NBSP). Pas '6.9%' format US.",
    level: 2,
    parent: "global.typography",
    anti_patterns: ["'+5%' sans NBSP", "'6.9%' format US"],
    code_hooks: ["src/lib/ui-fix-templates.ts (addNbspBeforePct, normalizeNarrative)"],
    auditor: "regex",
    severity_if_fail: 2,
    auto_fix: "global.typography.nbsp_before_pct",
  },
  {
    id: "global.typography.fr_number_format",
    title: "Format nombre FR",
    description: "Nombres FR : '1 234,56' (espace milliers, virgule décimale). Pas '1,234.56' format US.",
    level: 2,
    parent: "global.typography",
    anti_patterns: ["'1,234.56'", "'167,139'"],
    code_hooks: ["src/lib/ui-fix-templates.ts (normalizeNumberToFr)"],
    auditor: "regex",
    severity_if_fail: 3,
    auto_fix: "global.typography.fr_number_format",
  },
  {
    id: "global.theme",
    title: "Theme dark / light",
    description: "Tous les composants doivent rester lisibles en thème clair ET sombre.",
    level: 1,
    parent: "global",
  },
  {
    id: "global.theme.contrast",
    title: "Contraste suffisant en theme clair",
    description: "Aucune couleur ne doit être peu visible en thème clair à cause de contraste faible (texte gris clair sur fond blanc, etc.).",
    level: 2,
    parent: "global.theme",
    anti_patterns: [
      "Labels axe Y en gris clair illisibles sur fond blanc",
      "Boutons period toggle invisibles en theme clair",
      "Watermark MettrikAI illisible si fond clair",
    ],
    code_hooks: ["src/components/charts/curve-chart.tsx", "src/app/globals.css"],
    auditor: "gemini-visual",
    severity_if_fail: 3,
  },
  {
    id: "global.theme.dark_default",
    title: "Theme sombre par défaut respecté",
    description: "Si user n'a pas changé, theme dark doit s'afficher (préférence Mettrik).",
    level: 2,
    parent: "global.theme",
    code_hooks: ["src/components/theme-toggle.tsx"],
    auditor: "auto-test",
    severity_if_fail: 1,
  },
  {
    id: "global.units",
    title: "Unités homogènes",
    description: "Conventions : 'Mds X' pas 'B X', 'M X' pas 'm X'. Idem entre tous les blocs de la fiche.",
    level: 1,
    parent: "global",
  },
  {
    id: "global.units.mds_not_b",
    title: "'Mds $' au lieu de 'B$' / '$B'",
    description: "Le format français des milliards est 'Mds $' (pas 'B$' ni 'Mds$' collé ni '$B').",
    level: 2,
    parent: "global.units",
    anti_patterns: ["'12B$'", "'$12B'", "'12Mds$' (sans espace)", "'60M$'"],
    code_hooks: ["src/lib/ui-fix-templates.ts (normalizeBToMds, normalizeUnitSpacing)"],
    auditor: "regex",
    severity_if_fail: 2,
    auto_fix: "global.units.mds_not_b",
  },
  {
    id: "global.units.consistent_across_blocs",
    title: "Unités cohérentes entre blocs",
    description: "Si hero KPI affiche 'Mds $', les KPIs liés dans la table affichent aussi 'Mds $', pas 'M$' ou 'B$'.",
    level: 2,
    parent: "global.units",
    anti_patterns: ["VICI history mélangeait M$ et Mds$ → scale faux"],
    code_hooks: ["scripts/normalize-units.ts"],
    auditor: "data-structure",
    severity_if_fail: 3,
  },

  // ════════════════════════════════════════════════════════════════════
  // NIVEAU 1 — BLOC HEADER
  // ════════════════════════════════════════════════════════════════════
  {
    id: "header",
    title: "Header de page sté",
    description: "Bloc en haut : logo + nom + ticker + tagline + 6 chips stats.",
    level: 1,
    parent: null,
  },
  {
    id: "header.logo",
    title: "Logo sté",
    description: "Le logo réel de la sté (pas un fallback monogramme).",
    level: 2,
    parent: "header",
  },
  {
    id: "header.logo.real_brand",
    title: "Logo réel (pas monogramme)",
    description: "Le logo affiché doit être l'image PNG/SVG réelle de la marque, pas un cercle gradient violet/cyan avec 1-3 lettres (= fallback LogoMonogram).",
    level: 3,
    parent: "header.logo",
    anti_patterns: ["LogoMonogram affiché alors que public/logos/<TICKER>.png existe", "PNG noir 1x1 considéré comme 'présent' mais vide"],
    code_hooks: ["src/components/logos.tsx", "public/logos/"],
    auditor: "gemini-visual",
    severity_if_fail: 3,
  },
  {
    id: "header.logo.readable_on_dark",
    title: "Logo lisible sur fond sombre",
    description: "Sur thème dark : le logo doit avoir un contraste suffisant. Logos blancs/transparents sur dark = invisible.",
    level: 3,
    parent: "header.logo",
    anti_patterns: ["Logo MSFT illisible et flou", "Logo Adobe transparent sur fond noir"],
    code_hooks: ["src/components/logos.tsx"],
    auditor: "gemini-visual",
    severity_if_fail: 2,
  },
  {
    id: "header.logo.ratio_correct",
    title: "Ratio logo non écrasé",
    description: "Le logo conserve son aspect ratio natif (pas étiré horizontalement / verticalement).",
    level: 3,
    parent: "header.logo",
    code_hooks: ["src/components/logos.tsx"],
    auditor: "gemini-visual",
    severity_if_fail: 1,
  },
  {
    id: "header.chips",
    title: "Chips stats (6 valeurs)",
    description: "6 chips horizontaux : Rang mondial / Rang USA / Secteur / Sous-secteur / Fondée / IPO.",
    level: 2,
    parent: "header",
  },
  {
    id: "header.chips.all_filled",
    title: "Les 6 chips sont remplis",
    description: "Aucun chip ne doit afficher '-' ou '?' ou être absent. Tous remplis avec valeurs réelles.",
    level: 3,
    parent: "header.chips",
    anti_patterns: ["Rang mondial vide", "IPO 'N/A'"],
    code_hooks: ["src/components/company-header.tsx"],
    auditor: "data-structure",
    severity_if_fail: 3,
    variants: {
      young_ipo: "IPO récente (<3 ans) : afficher l'année + badge 'IPO récente'.",
      cat: { "3": "Stés EU pures : Rang USA peut être '-' (pas listée NYSE), c'est OK." },
    },
  },
  {
    id: "header.chips.labels_fr",
    title: "Labels chips en FR",
    description: "Labels FR : 'Rang mondial', 'Rang USA', 'Secteur', 'Sous-secteur', 'Fondée en', 'IPO'.",
    level: 3,
    parent: "header.chips",
    anti_patterns: ["'Sector' / 'Sub-sector' / 'Founded' (EN sur page FR)"],
    code_hooks: ["src/lib/ui-fix-templates.ts CHIP_LABEL_FR", "src/components/company-header.tsx"],
    auditor: "regex",
    severity_if_fail: 2,
    auto_fix: "header.chips.labels_fr",
  },
  {
    id: "header.chips.rank_format_uniform",
    title: "Format rangs uniforme",
    description: "Un seul format de rang sur la fiche : tout en '#N' (absolu) OU tout en 'Top X %' (relatif). Pas un mix.",
    level: 3,
    parent: "header.chips",
    anti_patterns: ["AMAT affichait '≈ #300', 'Top 150', 'Top 5', 'Top 3' simultanément"],
    code_hooks: ["src/components/company-header.tsx"],
    auditor: "regex",
    severity_if_fail: 2,
  },
  {
    id: "header.chips.sector_fr",
    title: "Secteur / sub-sector traduits FR",
    description: "GICS officiel en EN. Le frontend traduit en FR via dictionnaire (Technology → Technologie, Health Care → Santé).",
    level: 3,
    parent: "header.chips",
    code_hooks: ["src/lib/ui-fix-templates.ts (translateSubsector)"],
    auditor: "regex",
    severity_if_fail: 2,
  },
  {
    id: "header.tagline",
    title: "Tagline sté",
    description: "Phrase de mission/positionnement (italique, sous le nom).",
    level: 2,
    parent: "header",
  },
  {
    id: "header.tagline.present",
    title: "Tagline présente",
    description: "Chaque sté a une tagline officielle (souvent EN, italique).",
    level: 3,
    parent: "header.tagline",
    code_hooks: ["src/data/v2-pipeline/*.json (tagline field)"],
    auditor: "data-structure",
    severity_if_fail: 1,
  },
  {
    id: "header.young_ipo_warning",
    title: "Badge 'IPO récente' si <6 ans",
    description: "Pour stés ayant IPO il y a <6 ans, afficher un badge orange 'IPO récente' avec tooltip.",
    level: 2,
    parent: "header",
    anti_patterns: ["RDDT (IPO 2024) sans badge → user pense que history complete"],
    code_hooks: ["src/components/young-ipo-warning.tsx"],
    auditor: "data-structure",
    severity_if_fail: 2,
    variants: {
      young_ipo: "Badge OBLIGATOIRE pour IPO < 6 ans, recommandé pour 6-11 ans.",
    },
  },

  // ════════════════════════════════════════════════════════════════════
  // NIVEAU 1 — BLOC HERO
  // ════════════════════════════════════════════════════════════════════
  {
    id: "hero",
    title: "Hero (KPI principal + chart)",
    description: "Le bloc le plus important : valeur du KPI principal + chart + interprétation.",
    level: 1,
    parent: null,
  },
  {
    id: "hero.sidebar",
    title: "Sidebar gauche (valeur + badges)",
    description: "Colonne gauche du Hero : label KPI, valeur principale, YoY, quality, CAGR, percentile.",
    level: 2,
    parent: "hero",
  },
  {
    id: "hero.sidebar.value_plausible",
    title: "Valeur hero plausible",
    description: "La grosse valeur affichée a une magnitude réaliste pour la sté et le KPI. Vérifier vs valeur réelle (rapport sté / Bloomberg).",
    level: 3,
    parent: "hero.sidebar",
    anti_patterns: [
      "NVDA hero stored = 30 alors que Data Center FY26 Q4 réel = 62 (kpi-v2 audit)",
      "BAC Loan Book = +5 Mds chaque Q × 8 = LLM hallucination",
    ],
    code_hooks: ["src/data/v2-pipeline/*.json (kpi.value)"],
    auditor: "gemini-visual",
    severity_if_fail: 5,
  },
  {
    id: "hero.sidebar.unit_visible",
    title: "Unité affichée à côté de la valeur",
    description: "L'unité (Mds $, %, M, ans) doit être visible directement à côté du gros chiffre.",
    level: 3,
    parent: "hero.sidebar",
    code_hooks: ["src/components/company-view.tsx (heroFormatted.unit)"],
    auditor: "gemini-visual",
    severity_if_fail: 4,
  },
  {
    id: "hero.sidebar.yoy_color_arrow",
    title: "Pill YoY couleur cohérente",
    description: "YoY positif = vert + flèche haut. YoY négatif = rouge + flèche bas. Couleur doit refléter le tone réel.",
    level: 3,
    parent: "hero.sidebar",
    anti_patterns: ["yoy='+5%' affiché en rouge", "yoy=-3% sans flèche"],
    code_hooks: ["src/components/company-view.tsx (yoyTone, yoyColor)"],
    auditor: "regex",
    severity_if_fail: 3,
  },
  {
    id: "hero.sidebar.cagr_no_infinity",
    title: "CAGR sans Infinity/NaN",
    description: "Le badge CAGR ne doit jamais afficher 'Infinity', 'NaN', '+∞ %'. Si history[0]=0 → masquer le badge.",
    level: 3,
    parent: "hero.sidebar",
    anti_patterns: ["AAPL CAGR '+Infinity %/an' (commit a1cb17f7 fix)"],
    code_hooks: ["src/components/dividend-aristocrat-card.tsx", "src/lib/data.ts (formatCAGR)"],
    auditor: "regex",
    severity_if_fail: 5,
    auto_fix: "chart.cagr_division_by_zero",
  },
  {
    id: "hero.sidebar.percentile_chip",
    title: "Chip Top X% sous-industrie",
    description: "Chip 'Top 5 % · Sous-secteur Internet & Search' affiché si rank percentile dispo, doré pour top tier.",
    level: 3,
    parent: "hero.sidebar",
    code_hooks: ["src/components/quality-badge.tsx (PercentileChipOnly)"],
    auditor: "data-structure",
    severity_if_fail: 1,
  },
  {
    id: "hero.chart",
    title: "Chart hero (courbe / barres / variation)",
    description: "Le graph principal au centre. Modes Courbe / Barres / Variation / Tableau de bord.",
    level: 2,
    parent: "hero",
    code_hooks: ["src/lib/chart-template.ts (buildChartSpec — recette canonique)", "docs/CHART-RECIPE.md"],
  },
  {
    id: "hero.chart.aggregation_correct",
    title: "Aggregation annuelle correcte",
    description: "Vue annuelle : flow = somme 4Q de la FY, stock = Q4 (snapshot). Jamais valeur d'un Q seul présentée comme année.",
    level: 3,
    parent: "hero.chart",
    anti_patterns: [
      "GOOGL Cloud annual 2025 affiché 17.7 (= Q4 2025 seul) au lieu de 58.7 (= sum FY 2025)",
    ],
    code_hooks: ["src/lib/chart-template.ts buildChartSpec", "src/lib/kpi-aggregation.ts"],
    auditor: "data-structure",
    severity_if_fail: 5,
    variants: {
      fiscal_shifted: "Pour NVDA/AAPL/MSFT, somme respecte la FY fiscale (Feb-Jan pour NVDA, Oct-Sept pour AAPL).",
    },
  },
  {
    id: "hero.chart.no_partial_year",
    title: "Aucune année partielle plottée",
    description: "Si seuls Q1-Q3 de la FY courante sont publiés, la FY ne doit PAS être plottée comme un point. Le TTM la remplace.",
    level: 3,
    parent: "hero.chart",
    anti_patterns: ["Point '2026' affiché = T2 2026 seul (LLM avait fabriqué projection)"],
    code_hooks: ["src/lib/kpi-aggregation.ts (filter completeFys)"],
    auditor: "data-structure",
    severity_if_fail: 5,
    auto_fix: "chart.no_complete_fy",
  },
  {
    id: "hero.chart.no_phantom_quarter",
    title: "Aucun trimestre futur plotté",
    description: "Vue trimestrielle : aucun Q dont la fin > today() ne doit être plotté. Filtre par last_data_date.",
    level: 3,
    parent: "hero.chart",
    anti_patterns: ["T2 2026 = 17.7 affiché alors que Q2 2026 finit le 30 juin et on est mi-mai"],
    code_hooks: ["src/lib/chart-template.ts"],
    auditor: "data-structure",
    severity_if_fail: 5,
  },
  {
    id: "hero.chart.ttm_visible",
    title: "TTM visible avec valeur",
    description: "Si TTM ≠ dernière FY, point pointillé à droite avec valeur affichée (italique gris).",
    level: 3,
    parent: "hero.chart",
    code_hooks: ["src/components/charts/curve-chart.tsx (isTTM section)"],
    auditor: "gemini-visual",
    severity_if_fail: 3,
  },
  {
    id: "hero.chart.ttm_position",
    title: "Position TTM pas à l'extrémité",
    description: "Le point TTM est à droite mais avec marge pour laisser place au Y-axis si switché à droite (PAD_RIGHT = 95).",
    level: 3,
    parent: "hero.chart",
    code_hooks: ["src/components/charts/curve-chart.tsx PAD_RIGHT"],
    auditor: "gemini-visual",
    severity_if_fail: 2,
  },
  {
    id: "hero.chart.no_linear_synthetic",
    title: "History pas linéaire synthétique",
    description: "Une suite avec delta constant entre tous les points = signature LLM hallucination. À détecter + flag.",
    level: 3,
    parent: "hero.chart",
    anti_patterns: ["BAC Loan Book history [1045, 1050, 1055, 1060, 1065, 1070, 1075, 1080] = +5 Mds/trim parfait"],
    code_hooks: ["src/lib/chart-template.ts (chart.history_linear_synthetic detect)"],
    auditor: "data-structure",
    severity_if_fail: 5,
    auto_fix: "chart.history_linear_synthetic",
  },
  {
    id: "hero.chart.y_axis",
    title: "Axe Y",
    description: "Axe vertical du chart.",
    level: 3,
    parent: "hero.chart",
  },
  {
    id: "hero.chart.y_axis.unit_label",
    title: "Label unité axe Y affiché",
    description: "L'axe Y doit avoir un header texte indiquant l'unité ('$ en Milliards', '% des revenus', 'Nombre').",
    level: 4,
    parent: "hero.chart.y_axis",
    anti_patterns: ["Y axis sans label, user ne sait pas si c'est M$ ou Mds$"],
    code_hooks: ["src/lib/chart-axis-header.ts"],
    auditor: "gemini-visual",
    severity_if_fail: 3,
  },
  {
    id: "hero.chart.y_axis.no_overlap_with_tabs",
    title: "Pas de superposition Y avec onglets perso",
    description: "Quand l'axe Y est switché à droite, il ne doit pas chevaucher les onglets de personnalisation du graph (sub-toggle 2D/3D, period toggle).",
    level: 4,
    parent: "hero.chart.y_axis",
    anti_patterns: ["Y-axis droit chevauche le bouton '5 ans / 10 ans / 20 ans'"],
    code_hooks: ["src/components/charts/curve-chart.tsx", "src/components/chart-cycle.tsx"],
    auditor: "gemini-visual",
    severity_if_fail: 3,
  },
  {
    id: "hero.chart.y_axis.integer_currency",
    title: "Ticks Y entiers pour devises",
    description: "Axe Y avec valeurs monétaires : ticks entiers (pas '32.5 Mds $' mais '30' / '40').",
    level: 4,
    parent: "hero.chart.y_axis",
    code_hooks: ["src/components/charts/curve-chart.tsx (niceTicks)"],
    auditor: "gemini-visual",
    severity_if_fail: 2,
  },
  {
    id: "hero.chart.y_axis.toggle_left_right",
    title: "Toggle Y axis gauche/droite cliquable",
    description: "Click sur la zone axe Y → switch position (gauche ↔ droite). Comportement persistant.",
    level: 4,
    parent: "hero.chart.y_axis",
    code_hooks: ["src/components/charts/curve-chart.tsx (yOnRight state)"],
    auditor: "auto-test",
    severity_if_fail: 1,
  },
  {
    id: "hero.chart.x_axis",
    title: "Axe X",
    description: "Axe horizontal du chart.",
    level: 3,
    parent: "hero.chart",
  },
  {
    id: "hero.chart.x_axis.labels_fiscal_aware",
    title: "Labels fiscal-aware",
    description: "Pour stés à FY décalé : labels Tx FY (ex 'T2 FY26' pour NVDA) au lieu de calendaire 'T2 25'.",
    level: 4,
    parent: "hero.chart.x_axis",
    code_hooks: ["src/lib/chart-template.ts buildQuarterLabels", "src/lib/fiscal-calendar.ts"],
    auditor: "data-structure",
    severity_if_fail: 3,
    variants: {
      fiscal_shifted: "OBLIGATOIRE pour NVDA (FY jan), AAPL (FY sept), MSFT (FY juin), Toyota (FY mar).",
    },
  },
  {
    id: "hero.chart.x_axis.no_overflow_right",
    title: "Pas de coupure à droite",
    description: "PAD_RIGHT = 95 garantit que le dernier label/point n'est pas coupé par le bord du chart.",
    level: 4,
    parent: "hero.chart.x_axis",
    code_hooks: ["src/components/charts/curve-chart.tsx PAD_RIGHT"],
    auditor: "gemini-visual",
    severity_if_fail: 3,
  },
  {
    id: "hero.chart.events_dots",
    title: "Event dots (timeline)",
    description: "Petits points violets sur l'axe X correspondant aux events clés (4 par sté). Cliquables.",
    level: 3,
    parent: "hero.chart",
  },
  {
    id: "hero.chart.events_dots.no_cluster_right",
    title: "Pas de grappe d'events à droite",
    description: "Si les events tombent hors zone plotted (= avant le 1er label ou après le dernier label hors TTM), ils sont skipped.",
    level: 4,
    parent: "hero.chart.events_dots",
    anti_patterns: ["3 dots en cluster bottom-right du chart (event-dots.tsx fix Yann 16 mai)"],
    code_hooks: ["src/components/charts/event-dots.tsx (lastIdxAllowed)"],
    auditor: "gemini-visual",
    severity_if_fail: 2,
  },
  {
    id: "hero.chart.watermark",
    title: "Watermark MettrikAI",
    description: "Mini-logo Mettrik AI inséré dans le SVG chart (en haut, opposé Y axis).",
    level: 3,
    parent: "hero.chart",
  },
  {
    id: "hero.chart.watermark.no_overlap_ttm_badge",
    title: "Pas de superposition avec TTM badge",
    description: "Si TTM est rendu comme chip (TTM cumul > 2× dataMax), il doit être positionné OPPOSÉ au watermark.",
    level: 4,
    parent: "hero.chart.watermark",
    anti_patterns: ["TTM badge 'TTM 49,3 Mds $' superposé avec watermark 'MettrikAI' top-right"],
    code_hooks: ["src/components/charts/curve-chart.tsx (chipX position)"],
    auditor: "gemini-visual",
    severity_if_fail: 3,
  },
  {
    id: "hero.chart.watermark.position_opposite_y_axis",
    title: "Watermark opposé à l'axe Y",
    description: "Si Y axis à gauche → watermark top-right. Si Y axis à droite → watermark top-left.",
    level: 4,
    parent: "hero.chart.watermark",
    code_hooks: ["src/components/charts/curve-chart.tsx (ChartMiniLogo x prop)"],
    auditor: "gemini-visual",
    severity_if_fail: 2,
  },
  {
    id: "hero.chart.modes",
    title: "Modes (Courbe / Barres / Variation / Dashboard)",
    description: "4 modes de visualisation togglables.",
    level: 3,
    parent: "hero.chart",
  },
  {
    id: "hero.chart.modes.period_toggle",
    title: "Toggle Annuel / Trimestriel / Semestriel",
    description: "Toggle visible si period_type natif = quarter ou semester. Annuel toujours dispo.",
    level: 4,
    parent: "hero.chart.modes",
    code_hooks: ["src/components/chart-cycle.tsx ChartCycleControls"],
    auditor: "auto-test",
    severity_if_fail: 2,
    variants: {
      frequency: {
        quarterly: "Stés US cat 1 : toggle trimestriel par défaut.",
        semestrial: "Stés EU cat 3 reportant 2x/an : toggle semestriel actif, trimestriel grisé.",
        annual: "Stés à reporting annuel seul : toggle annuel only, trimestriel grisé.",
      },
    },
  },
  {
    id: "hero.interpretation",
    title: "Bloc Interprétation (sous le chart)",
    description: "Lead + 3 bullets (Moteur / Vigilance / Cash) + 1 future-watch.",
    level: 2,
    parent: "hero",
  },
  {
    id: "hero.interpretation.lead_present",
    title: "Lead rédigé",
    description: "Phrase d'accroche FR résumant le state du KPI sur la période.",
    level: 3,
    parent: "hero.interpretation",
    code_hooks: ["src/components/interpretation-block.tsx", "src/data/v2-pipeline/*.json (kpi.interpretation)"],
    auditor: "data-structure",
    severity_if_fail: 3,
  },
  {
    id: "hero.interpretation.4_bullets",
    title: "4 bullets (Moteur / Vigilance / Cash / À surveiller)",
    description: "Couleur égale entre les 4. Aucun bullet vide ou template.",
    level: 3,
    parent: "hero.interpretation",
    code_hooks: ["src/components/interpretation-block.tsx"],
    auditor: "data-structure",
    severity_if_fail: 3,
  },

  // ════════════════════════════════════════════════════════════════════
  // NIVEAU 1 — BLOC KPI TABLE
  // ════════════════════════════════════════════════════════════════════
  {
    id: "kpis_table",
    title: "Tableau Indicateurs clés",
    description: "Liste des KPIs sous le Hero. Clic sur une ligne promote en hero.",
    level: 1,
    parent: null,
  },
  {
    id: "kpis_table.count_5plus",
    title: "≥ 5 KPIs affichés",
    description: "Au moins 5 indicateurs (hors hero) doivent être présents pour donner de la matière à analyser.",
    level: 2,
    parent: "kpis_table",
    code_hooks: ["src/components/company-view.tsx orderedKpis"],
    auditor: "data-structure",
    severity_if_fail: 4,
  },
  {
    id: "kpis_table.ordering_rule",
    title: "Ordre wow / generic",
    description: "Position 1=wow, 2=wow, 3=generic, 4=wow, 5=generic, 6+=alternance. Cf CLAUDE.md §4bis.",
    level: 2,
    parent: "kpis_table",
    code_hooks: ["src/lib/kpi-ordering.ts orderKpis"],
    auditor: "data-structure",
    severity_if_fail: 2,
  },
  {
    id: "kpis_table.acronyms_tooltip",
    title: "Acronymes avec tooltip 'i'",
    description: "Acronymes (DAP, EBITDA, ARR, CAGR, TAC, AUM, etc.) doivent avoir un tooltip 'i' explicatif.",
    level: 2,
    parent: "kpis_table",
    code_hooks: ["src/lib/ui-fix-templates.ts ACRONYM_GLOSSARY", "src/components/acronym-hover.tsx"],
    auditor: "regex",
    severity_if_fail: 2,
  },
  {
    id: "kpis_table.short_label_oneline",
    title: "Labels short tiennent sur 1 ligne",
    description: "Le label short de chaque KPI ≤ 30 chars, ne wrap pas, ne se tronque pas.",
    level: 2,
    parent: "kpis_table",
    code_hooks: ["src/components/kpi-row.tsx"],
    auditor: "gemini-visual",
    severity_if_fail: 2,
  },

  // ════════════════════════════════════════════════════════════════════
  // NIVEAU 1 — BLOC STORIES
  // ════════════════════════════════════════════════════════════════════
  {
    id: "stories",
    title: "Stories (carrousel autoplay)",
    description: "Carrousel phone-frame 9:16, autoplay 5s. KPIs short-history + market positions + transcript bullets.",
    level: 1,
    parent: null,
  },
  {
    id: "stories.visible_at_least_3",
    title: "≥ 3 cards stories",
    description: "Au moins 3 cards stories pour rendre le carrousel utile.",
    level: 2,
    parent: "stories",
    code_hooks: ["src/components/kpi-stories.tsx", "src/lib/kpi-stories-ordering.ts"],
    auditor: "data-structure",
    severity_if_fail: 3,
    variants: {
      no_wow: "Sté sans KPIs wow short-history : skip le bloc Stories (au lieu d'afficher 0-1 card).",
    },
  },
  {
    id: "stories.no_template_llm",
    title: "Pas de template LLM vide",
    description: "Aucune card ne doit afficher 'Voir ci-dessous' ou autre template non-rempli par le LLM.",
    level: 2,
    parent: "stories",
    code_hooks: ["src/components/kpi-story-card.tsx"],
    auditor: "regex",
    severity_if_fail: 3,
  },

  // ════════════════════════════════════════════════════════════════════
  // NIVEAU 1 — BLOC RISKS
  // ════════════════════════════════════════════════════════════════════
  {
    id: "risks",
    title: "Facteurs de risque",
    description: "5-8 cards risks avec category, severity 1-5, score_rationale, trend chip.",
    level: 1,
    parent: null,
  },
  {
    id: "risks.count_3plus",
    title: "≥ 3 cards risks",
    description: "Au moins 3 risks pour donner une vue crédible. Idéal 5-8.",
    level: 2,
    parent: "risks",
    code_hooks: ["src/components/risk-stack.tsx"],
    auditor: "data-structure",
    severity_if_fail: 3,
  },
  {
    id: "risks.severity_score",
    title: "Score severity 1-5",
    description: "Chaque risk a un score 1-5 visible (chip ou étoiles).",
    level: 2,
    parent: "risks",
    code_hooks: ["src/components/risk-stack.tsx"],
    auditor: "data-structure",
    severity_if_fail: 2,
  },
  {
    id: "risks.score_rationale",
    title: "score_rationale citant 4 critères",
    description: "Tooltip rationale qui cite (1) position 10-K, (2) intensité langage, (3) tendance vs N-1, (4) poids catégorie.",
    level: 2,
    parent: "risks",
    code_hooks: ["src/data/v2-pipeline/*.json (risks[].score_rationale)"],
    auditor: "data-structure",
    severity_if_fail: 1,
  },
  {
    id: "risks.trend_chip",
    title: "Chip de tendance",
    description: "Chaque risk a chip (Nouveau / En hausse / Stable / En baisse / Retiré) par rapport au 10-K N-1.",
    level: 2,
    parent: "risks",
    code_hooks: ["src/components/risk-stack.tsx"],
    auditor: "data-structure",
    severity_if_fail: 1,
  },

  // ════════════════════════════════════════════════════════════════════
  // NIVEAU 1 — BLOC GOVERNANCE
  // ════════════════════════════════════════════════════════════════════
  {
    id: "governance",
    title: "Gouvernance & rémunération",
    description: "9 métriques + voting structure + Top 3 droits de vote + Top 3 capital.",
    level: 1,
    parent: null,
  },
  {
    id: "governance.ceo_name_correct",
    title: "Nom CEO correct (cross-ref yfinance)",
    description: "Le nom du CEO affiché doit matcher yfinance.companyOfficers (anti cross-pollution LLM).",
    level: 2,
    parent: "governance",
    anti_patterns: [
      "BP CEO 'Meg O Neill' (faux, c'est Murray Auchincloss)",
      "DG.PA (Vinci) CEO 'Sébastien Huron' (faux, c'est CEO Virbac)",
      "SIE.DE (Siemens AG) CEO 'Sunil Mathur' (faux, c'est Siemens India)",
    ],
    code_hooks: ["scripts/enrich-governance-v18-safe.py (cross-ref validation)"],
    auditor: "data-structure",
    severity_if_fail: 4,
  },
  {
    id: "governance.peer_rank_simple_words",
    title: "Rangs vs pairs en mots simples",
    description: "'Plus bas que la moyenne' / 'Dans la moyenne' / 'Plus haut que la moyenne' / 'Bien au-dessus'. Jamais 'Bas vs pairs' ou jargon.",
    level: 2,
    parent: "governance",
    code_hooks: ["src/components/governance-card.tsx"],
    auditor: "regex",
    severity_if_fail: 1,
  },
  {
    id: "governance.voting_structure_fr",
    title: "Voting structure traduit FR",
    description: "Si voting structure mentionnée, traduite en FR (Class A super-voting → Action A à droit de vote multiple).",
    level: 2,
    parent: "governance",
    code_hooks: ["src/components/governance-card.tsx"],
    auditor: "regex",
    severity_if_fail: 1,
  },
  {
    id: "governance.top3_pie_holographic",
    title: "HolographicPie modal Top 3",
    description: "Click sur Top 3 Capital / Voting → modal pie 3D holographique.",
    level: 2,
    parent: "governance",
    code_hooks: ["src/components/holographic-pie.tsx"],
    auditor: "auto-test",
    severity_if_fail: 1,
  },

  // ════════════════════════════════════════════════════════════════════
  // NIVEAU 1 — BLOC AI POSITIONING
  // ════════════════════════════════════════════════════════════════════
  {
    id: "ai_positioning",
    title: "Positionnement IA",
    description: "Stance (leader/integrator/cautious/absent) + ≥3 evidence + source.",
    level: 1,
    parent: null,
  },
  {
    id: "ai_positioning.stance_present",
    title: "Stance définie",
    description: "Une des 4 valeurs : leader / integrator / cautious / absent.",
    level: 2,
    parent: "ai_positioning",
    code_hooks: ["src/components/ai-positioning-card.tsx"],
    auditor: "data-structure",
    severity_if_fail: 2,
  },
  {
    id: "ai_positioning.evidence_min_2",
    title: "≥ 2 evidence concrets",
    description: "Au moins 2 evidence avec source citée. Pas de placeholder.",
    level: 2,
    parent: "ai_positioning",
    code_hooks: ["src/components/ai-positioning-card.tsx"],
    auditor: "data-structure",
    severity_if_fail: 2,
  },

  // ════════════════════════════════════════════════════════════════════
  // NIVEAU 1 — BLOC REPARTITION
  // ════════════════════════════════════════════════════════════════════
  {
    id: "repartition",
    title: "Répartition revenu (segment / geo)",
    description: "2 pie charts : revenu par segment + par géographie.",
    level: 1,
    parent: null,
  },
  {
    id: "repartition.segment_slices_2plus",
    title: "≥ 2 slices segment",
    description: "Pie segment doit avoir au moins 2 slices nommées avec %.",
    level: 2,
    parent: "repartition",
    code_hooks: ["src/components/repartition-block.tsx"],
    auditor: "data-structure",
    severity_if_fail: 2,
  },
  {
    id: "repartition.geo_slices_2plus",
    title: "≥ 2 slices geography",
    description: "Pie geography doit avoir au moins 2 zones nommées.",
    level: 2,
    parent: "repartition",
    code_hooks: ["src/components/repartition-block.tsx"],
    auditor: "data-structure",
    severity_if_fail: 2,
    variants: {
      sector: { "Banks": "Banques US : geography souvent 'US only' → bloc geo peut être skipped." },
    },
  },
  {
    id: "repartition.pct_sums_100",
    title: "Pourcentages totalisent ~100 %",
    description: "Somme des % des slices = 100 ± 2 (tolérance arrondi). Sinon = bug aggregation.",
    level: 2,
    parent: "repartition",
    anti_patterns: ["GOOGL Cloud segment slice 30 % seul + 'Other' 5 % = manque 65 %"],
    code_hooks: ["src/components/repartition-block.tsx adaptForLocale"],
    auditor: "data-structure",
    severity_if_fail: 3,
  },
  {
    id: "repartition.no_null_slices",
    title: "Pas de crash null.map",
    description: "Si revenue_by_segment.slices est null, le bloc doit se masquer proprement (pas crash 500).",
    level: 2,
    parent: "repartition",
    anti_patterns: ["77 stés HTTP 500 sur sandbox V1.8 (commit 7397ac86 fix Array.isArray garde)"],
    code_hooks: ["src/components/repartition-block.tsx:36"],
    auditor: "auto-test",
    severity_if_fail: 5,
    auto_fix: "repartition.no_null_slices",
  },

  // ════════════════════════════════════════════════════════════════════
  // NIVEAU 1 — BLOC TRANSCRIPT
  // ════════════════════════════════════════════════════════════════════
  {
    id: "transcript",
    title: "Synthèse Earning Call",
    description: "Bullets PV-driven du dernier earning call. Sentiment chip.",
    level: 1,
    parent: null,
  },
  {
    id: "transcript.bullets_present",
    title: "Bullets résumé présents",
    description: "≥ 3 bullets propres extraits du transcript, pas de chunks bruts.",
    level: 2,
    parent: "transcript",
    code_hooks: ["src/components/transcript-bullets-block.tsx"],
    auditor: "data-structure",
    severity_if_fail: 3,
    variants: {
      cat: { "3": "Stés EU sans transcript public : skip bloc.", "1": "Stés US cat 1 : transcript obligatoire (8-K + IR scrape)." },
    },
  },
  {
    id: "transcript.fiscal_quarter_label",
    title: "Label Tx FY fiscal-aware",
    description: "Pour stés FY décalé, label = 'FY26 T4' au lieu de 'T4 2026'.",
    level: 2,
    parent: "transcript",
    code_hooks: ["src/components/transcript-stories.tsx (quarterLabel)"],
    auditor: "regex",
    severity_if_fail: 2,
    variants: {
      fiscal_shifted: "OBLIGATOIRE pour NVDA/AAPL/MSFT (commit a8a0883e fix).",
    },
  },
  {
    id: "transcript.tooltip_explainer",
    title: "Tooltip 'i' sur Synthèse Earning Call",
    description: "Tooltip explique ce qu'est un earning call (16 ans level).",
    level: 2,
    parent: "transcript",
    code_hooks: ["src/components/transcript-bullets-block.tsx"],
    auditor: "regex",
    severity_if_fail: 1,
  },

  // ════════════════════════════════════════════════════════════════════
  // NIVEAU 1 — BLOC DIVIDEND
  // ════════════════════════════════════════════════════════════════════
  {
    id: "dividend",
    title: "Stories dividendes",
    description: "3 cartes : Aristocrat / Calculator / Snowball. Visible si sté paie un dividende.",
    level: 1,
    parent: null,
  },
  {
    id: "dividend.visible_only_if_payer",
    title: "Visible UNIQUEMENT si sté payeuse",
    description: "Si la sté ne paie pas de dividende, le bloc entier est skip (pas de placeholder vide).",
    level: 2,
    parent: "dividend",
    code_hooks: ["src/components/dividend-stories.tsx (shorts check)"],
    auditor: "data-structure",
    severity_if_fail: 2,
    variants: {
      no_dividend: "Bloc absent. Confirmé par TSLA/AMZN/NVDA (qui paient ~0).",
    },
  },
  {
    id: "dividend.years_streak_dynamic",
    title: "yearsStreak calculé dynamiquement",
    description: "Ne plus hardcoder 31 (= CAT). Calculé depuis dividend_meta.first_year ou years_streak_increases XBRL.",
    level: 2,
    parent: "dividend",
    code_hooks: ["src/components/dividend-aristocrat-card.tsx"],
    auditor: "data-structure",
    severity_if_fail: 3,
  },
  {
    id: "dividend.aristocrat_badge_if_25plus",
    title: "Badge 'Aristocrat' si streak ≥ 25 ans",
    description: "Titre 'Dividend Aristocrat' affiché si années hausse consécutives ≥ 25.",
    level: 2,
    parent: "dividend",
    code_hooks: ["src/components/dividend-aristocrat-card.tsx"],
    auditor: "data-structure",
    severity_if_fail: 1,
  },

  // ════════════════════════════════════════════════════════════════════
  // NIVEAU 1 — FRESHNESS / FOOTER
  // ════════════════════════════════════════════════════════════════════
  {
    id: "freshness",
    title: "Indicateur de fraîcheur",
    description: "Pill 'À jour / Récent / Périmé' + tooltip 'i' avec date dernier earning + prochain attendu.",
    level: 1,
    parent: null,
  },
  {
    id: "freshness.label_fr",
    title: "Label FR",
    description: "'À jour' / 'Récent' / 'Périmé' / 'Inconnu'. Jamais 'Fresh' / 'Recent' / 'Stale' / 'Unknown'.",
    level: 2,
    parent: "freshness",
    anti_patterns: ["40 stés flag UI_FRESHNESS_LABEL_EN par module audit"],
    code_hooks: ["src/components/freshness-indicator.tsx", "src/lib/ui-fix-templates.ts (translateFreshnessLabel)"],
    auditor: "regex",
    severity_if_fail: 2,
    auto_fix: "freshness.label_fr",
  },
  {
    id: "freshness.next_earnings_in_tooltip",
    title: "Prochain earning dans le tooltip",
    description: "Tooltip 'i' indique prochain trimestre attendu + date estimée (last_data_date + 91j si pas dispo).",
    level: 2,
    parent: "freshness",
    code_hooks: ["src/components/freshness-indicator.tsx"],
    auditor: "data-structure",
    severity_if_fail: 1,
  },

  // ════════════════════════════════════════════════════════════════════
  // NIVEAU 1 — LAYOUT GLOBAL DE PAGE
  // ════════════════════════════════════════════════════════════════════
  {
    id: "layout",
    title: "Layout général",
    description: "Pas d'overflow, pas d'erreur 500, responsive mobile.",
    level: 1,
    parent: null,
  },
  {
    id: "layout.no_horizontal_scroll",
    title: "Pas de scroll horizontal",
    description: "La page ne doit jamais scroller horizontalement. Tous les blocs s'adaptent à la viewport.",
    level: 2,
    parent: "layout",
    code_hooks: ["src/components/company-view.tsx (max-w-* containers)"],
    auditor: "gemini-visual",
    severity_if_fail: 3,
  },
  {
    id: "layout.no_500_error",
    title: "Page sert HTTP 200",
    description: "Aucune page sté ne doit retourner 500. Si data manquante, bloc se masque, page reste 200.",
    level: 2,
    parent: "layout",
    anti_patterns: ["77 stés V1.8 en 500 avant fix Array.isArray (commit 7397ac86)"],
    code_hooks: ["proxy.ts", "src/app/sandbox/v1-8/[ticker]/page.tsx"],
    auditor: "auto-test",
    severity_if_fail: 5,
  },
  {
    id: "layout.no_broken_image",
    title: "Aucune image cassée",
    description: "Aucune icône broken-image, aucun fond gris vide là où devrait être un logo / chart.",
    level: 2,
    parent: "layout",
    auditor: "gemini-visual",
    severity_if_fail: 4,
  },
  {
    id: "layout.mobile_responsive",
    title: "Mobile < 640px ok",
    description: "Sous 640px, grids passent en 1 colonne, fonts ajustées, chart conserve sa lisibilité.",
    level: 2,
    parent: "layout",
    code_hooks: ["next.config.ts (allowedDevOrigins)", "src/components/company-view.tsx (responsive)"],
    auditor: "gemini-visual",
    severity_if_fail: 2,
  },
];

/** Index lookup par ID stable. */
export const QUALITY_INDEX = new Map<string, QualityNode>(
  QUALITY_TREE.map((n) => [n.id, n]),
);

/** Compteur d'éléments contrôlables (level 3+) par bloc. */
export function countLeavesPerBlock(): Record<string, number> {
  const blocks = QUALITY_TREE.filter((n) => n.level === 1);
  const out: Record<string, number> = {};
  for (const b of blocks) {
    out[b.id] = QUALITY_TREE.filter(
      (n) => n.id.startsWith(b.id + ".") && (n.level === 3 || n.level === 4),
    ).length;
  }
  return out;
}

/** Tous les enfants directs d'un node. */
export function getChildren(parentId: string | null): QualityNode[] {
  return QUALITY_TREE.filter((n) => n.parent === parentId);
}

/** Tous les descendants (récursif) d'un node. */
export function getDescendants(parentId: string): QualityNode[] {
  const direct = getChildren(parentId);
  return [...direct, ...direct.flatMap((d) => getDescendants(d.id))];
}
