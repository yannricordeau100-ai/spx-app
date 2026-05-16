/**
 * src/lib/ui-fix-templates.ts · CONV-MODULE-UI-AUDIT
 *
 * Helpers purs pour normaliser les chaînes affichées dans l'UI Mettrik.
 * Appliqués au RENDU (pas aux fichiers data sources) pour ne pas marcher
 * sur les pieds de CONV-DATA (`src/data/v2-pipeline/`) ni de CONV-SYSTEMS
 * (`src/lib/kpi-templates-by-gics.ts`).
 *
 * Convention typographique Mettrik (consolidée le 8 mai 2026) :
 *  - Milliards / millions : `Mds` / `M` (jamais `B` seul)
 *  - Devise : nombre + NBSP + unité quantité + NBSP + symbole devise
 *    Ex. attendu : `0,5 Mds $`  (rendu = "0,5 Mds $" insécable)
 *  - Pourcentage : nombre + NBSP + `%`     (`10 %`)
 *  - On utilise le NBSP standard ( ), pas le narrow ( ), pour
 *    compatibilité maximale (fonts/exports).
 *
 * Liste exhaustive des fix exposés :
 *   normalizeBToMds(text)         · "B$" / "B €" / "B" isolé → "Mds $" / "Mds €" / "Mds"
 *   normalizeUnitSpacing(text)    · "60M$" / "0.5 Mds$" → "60 M $" / "0,5 Mds $"
 *   addNbspBeforePct(text)        · "10%" → "10 %"
 *   normalizeNarrative(text)      · enchaîne les 3 ci-dessus (utilitaire global)
 *
 * Tests rapides via :
 *   npx tsx scripts/test-ui-fix-templates.ts
 *
 * Application proposée (voir `BROADCAST_INTEGRATION` en bas de fichier).
 */

const NBSP = " ";

/**
 * Remplace "B$" / "B €" / un "B" suivi d'un séparateur par "Mds<unité>".
 * On ne touche JAMAIS un "B" qui fait partie d'un nom propre (BVA, BAML…) :
 *  - On exige un chiffre suivi optionnellement d'espace + "B" + ($|€|fin de mot)
 *  - Pour le "B" isolé suivi d'un mot, on n'agit pas (laisser au correcteur humain)
 */
export function normalizeBToMds(text: string): string {
  if (!text) return text;
  // Cas 1 : "12B$" / "12 B$" / "12B €" → "12 Mds $" / "12 Mds €" (espace ASCII pour l'instant,
  // le NBSP est ajouté par normalizeUnitSpacing).
  let out = text.replace(/(\d[\d.,]*)\s?B\s?\$/g, "$1 Mds $");
  out = out.replace(/(\d[\d.,]*)\s?B\s?€/g, "$1 Mds €");
  // Cas 2 : "12B " (avec espace) suivi d'un mot français connu (« de », « d' », « en ») = unité
  // dollars/euros implicite via contexte → on ne change pas, ambigu.
  return out;
}

/**
 * Insère un NBSP entre <chiffre> ↔ <unité quantité> ↔ <devise>.
 * Cible : "60M$", "60 M$", "0.5Mds$", "0.5 Mds$", "12 Mds $", etc.
 * Sortie canonique : `12 Mds $`
 */
export function normalizeUnitSpacing(text: string): string {
  if (!text) return text;
  // Pattern : (nombre)(espace optionnel)(M|Mds)(espace optionnel)([$€])
  return text.replace(
    /(\d[\d.,]*)\s*(Mds|M)\s*([$€])/g,
    `$1${NBSP}$2${NBSP}$3`,
  );
}

/**
 * "10%" → "10 %". On ignore les "%" déjà précédés d'un NBSP/espace ASCII.
 * On ignore aussi les patterns CSS "100%" qui peuvent traîner dans HTML inline,
 * mais ces derniers sont dans des attributs et ne devraient pas être visibles.
 */
export function addNbspBeforePct(text: string): string {
  if (!text) return text;
  return text.replace(/(\d)(?=%)/g, `$1${NBSP}`);
}

/**
 * Pipeline complet pour les blocs narratifs (descriptions, stories,
 * interpretations). Idempotent : appliquer 2× ne change rien après la 1re.
 */
export function normalizeNarrative(text: string): string {
  if (!text) return text;
  let out = normalizeBToMds(text);
  out = normalizeUnitSpacing(out);
  out = addNbspBeforePct(out);
  return out;
}

/**
 * Normalise un sub-sector GICS anglais en français Mettrik.
 * Source : `_meta/gics-163-master.md` (CONV-DATA). Liste partielle ici,
 * à étendre incrémentalement à mesure que l'audit remonte de nouveaux EN.
 */
const SUBSECTOR_FR_MAP: Record<string, string> = {
  "Compute & Networking": "Calcul & réseau",
  "Compute &amp; Networking": "Calcul & réseau",
  "Semiconductors & Semiconductor Equipment": "Semi & équipements",
  "Semiconductors &amp; Semiconductor Equipment": "Semi & équipements",
  "Internet & Direct Marketing Retail": "Internet & vente directe",
  "Internet &amp; Direct Marketing Retail": "Internet & vente directe",
  "Internet & Services": "Internet & services",
  "Software & Services": "Logiciels & services",
  "Software &amp; Services": "Logiciels & services",
  "Capital Goods": "Biens d'équipement",
  "Health Care Equipment": "Équipements de santé",
  "Aerospace & Defense": "Aérospatiale & défense",
  "Aerospace &amp; Defense": "Aérospatiale & défense",
  "Oil, Gas & Consumable Fuels": "Pétrole & gaz",
  "Oil, Gas &amp; Consumable Fuels": "Pétrole & gaz",
  "Pharmaceuticals": "Pharmaceutique",
  // Yann 16 mai 2026 (audit Gemini META / NVDA / AAPL) :
  "Communication Services": "Services de communication",
  "Social Media & Messaging": "Réseaux sociaux & messagerie",
  "Social Media &amp; Messaging": "Réseaux sociaux & messagerie",
  "Technology": "Technologie",
  "Technology Hardware & Equipment": "Matériel & équipements technologiques",
  "Technology Hardware &amp; Equipment": "Matériel & équipements technologiques",
  "Information Technology": "Technologies de l'information",
  "Consumer Discretionary": "Biens de consommation discrétionnaires",
  "Consumer Staples": "Biens de consommation de base",
  "Health Care": "Santé",
  "Financials": "Services financiers",
  "Industrials": "Industriels",
  "Energy": "Énergie",
  "Utilities": "Services aux collectivités",
  "Materials": "Matériaux",
  "Real Estate": "Immobilier",
};

export function translateSubsector(en: string): string {
  if (!en) return en;
  return SUBSECTOR_FR_MAP[en] ?? en;
}

/**
 * Labels des chips affichés dans `CompanyHeader` (sandbox V1.8 actuelle :
 * `Sector`, `Sub-sector`, `Founded`, `IPO`). Sur app FR ils doivent être en
 * français. Mapping découvert par audit `npx tsx scripts/audit-ui-pages.ts`
 * (codes UI_LABEL_EN, audit du 8 mai 2026 : 227/305 stés concernées).
 */
export const CHIP_LABEL_FR: Record<string, string> = {
  "Sector": "Secteur",
  "Sub-sector": "Sous-secteur",
  "Founded": "Fondée",
  "Headquarters": "Siège social",
  "Tagline": "Accroche",
  // "IPO" reste "IPO" (acronyme accepté tel quel + tooltip ACRONYM_GLOSSARY)
};

/**
 * Labels du composant `FreshnessIndicator` rendus en anglais actuellement.
 * Mapping ajouté suite à audit du 8 mai 2026 (code UI_FRESHNESS_LABEL_EN).
 * Utilisé via `translateFreshnessLabel(en)`.
 */
export const FRESHNESS_LABEL_FR: Record<string, string> = {
  "Recent": "Récent",
  "Fresh": "À jour",
  "Stale": "Périmé",
  "Unknown": "Inconnu",
};

export function translateFreshnessLabel(en: string): string {
  if (!en) return en;
  return FRESHNESS_LABEL_FR[en] ?? en;
}

/**
 * Convertit un nombre format US ("6.9%", "1,234.56") en format FR
 * ("6,9 %", "1 234,56"). Utile pour les nombres déjà sérialisés en string
 * dans les datasets ou hardcodés dans les templates.
 *
 * Si tu pars d'un Number JS, préfère `n.toLocaleString("fr-FR")` directement.
 */
export function normalizeNumberToFr(text: string): string {
  if (!text) return text;
  // Cas 1 : "1,234.56" (US complet) → "1 234,56"
  let out = text.replace(
    /(\d{1,3}(?:,\d{3})+)(\.\d+)?/g,
    (full, intPart: string, dec: string | undefined) => {
      const intFr = intPart.replace(/,/g, NBSP);
      return dec ? `${intFr},${dec.slice(1)}` : intFr;
    },
  );
  // Cas 2 : "6.9%" / "6.9 €" (décimal POINT, sans virgule milliers) → "6,9 %"
  // ATTENTION : ne pas matcher des mots type "1.5" qui peuvent être versions
  // (ex : "v1.5"). On exige un suffix devise/% ou rien après.
  out = out.replace(/(\d+)\.(\d+)(?=\s?(?:%|\$|€|Mds|<|$))/g, "$1,$2");
  return out;
}

export function translateChipLabel(en: string): string {
  if (!en) return en;
  return CHIP_LABEL_FR[en] ?? en;
}

/**
 * Glossaire pour acronymes Mettrik. Chaque acronyme a une explication
 * courte FR (1 phrase) à afficher dans le tooltip "i". Liste vivante ;
 * étendue par CONV-MODULE-UI-AUDIT au fil des audits.
 */
export const ACRONYM_GLOSSARY: Record<string, string> = {
  HPC: "High Performance Computing : calcul haute performance, puces et serveurs très puissants pour IA et simulation scientifique.",
  CAGR: "Compound Annual Growth Rate : taux de croissance annuel moyen sur plusieurs années (lissé). Ex : 100 → 150 sur 5 ans = +8,4 % / an.",
  TAM: "Total Addressable Market : taille totale du marché potentiel si la société captait 100 % de la demande. Sert à mesurer la marge de progression.",
  EBITDA: "Bénéfice avant intérêts, impôts, amortissements. Mesure la rentabilité brute du métier, hors choix de financement et de comptabilité.",
  ARPP: "Average Revenue Per Payer : revenu moyen généré par client payant (sert pour les modèles freemium / abonnements).",
  TAC: "Traffic Acquisition Cost : ce que la société paie pour attirer du trafic (typiquement Google qui paie Apple / Samsung pour rester moteur par défaut).",
  ABF: "Assets Based Fees : commissions calculées en % des actifs gérés (modèle des asset managers).",
  ARR: "Annual Recurring Revenue : revenu annualisé récurrent des abonnements en cours. Lisible et prévisible pour le SaaS.",
  MRR: "Monthly Recurring Revenue : revenu mensuel récurrent des abonnements en cours.",
  GAAP: "Generally Accepted Accounting Principles : normes comptables américaines obligatoires pour publier des comptes.",
  FCF: "Free Cash Flow : cash réellement disponible une fois tous les coûts ET investissements payés. C'est ce qui peut servir aux dividendes ou rachats d'actions.",
  ROIC: "Return On Invested Capital : combien la société gagne par euro investi dans son métier. Au-dessus du coût du capital (≈ 8 %) = création de valeur.",
  ROE: "Return On Equity : combien la société gagne par euro mis par les actionnaires. Au-dessus de 15 % = très bonne rentabilité.",
  NPS: "Net Promoter Score : note de 0 à 100 qui mesure si les clients recommanderaient la société. > 50 = excellent, < 0 = en danger.",
  ADR: "American Depositary Receipt : certificat coté aux États-Unis qui représente une action étrangère. Permet d'investir en société non-US via la bourse de New York.",
  IPO: "Initial Public Offering : introduction en bourse, première vente d'actions au grand public.",
  GICS: "Global Industry Classification Standard : norme mondiale qui range les sociétés par secteur (Tech, Finance, Santé…) et sous-secteur.",
  GMV: "Gross Merchandise Value : valeur totale des biens vendus sur une plateforme (Amazon, Shopify…). La société garde une commission, pas le montant total.",
  TTM: "Trailing Twelve Months : 12 derniers mois (4 trimestres glissants). Donne une vision actuelle plutôt que d'attendre la fin d'année.",
  YoY: "Year-over-Year : comparaison avec la même période l'an dernier (ex : Q3 2026 vs Q3 2025). Neutralise les effets saisonniers.",
  QoQ: "Quarter-over-Quarter : comparaison avec le trimestre précédent. Mesure l'accélération ou le ralentissement à court terme.",
  CapEx: "Capital Expenditure : dépenses d'investissement long-terme (machines, usines, data-centers). Réduit le cash dispo mais bâtit l'outil de production futur.",
  OpEx: "Operating Expenses : dépenses opérationnelles courantes (salaires, marketing, loyers). Doivent rester sous contrôle pour préserver la marge.",
  P_E: "Price/Earnings : combien d'années de bénéfices il faudrait pour rembourser le prix de l'action. Plus c'est haut, plus le marché anticipe de la croissance.",
  // Banques + transcripts (Yann 11 mai 2026, re-relus 16 mai 2026)
  "G-SIB": "Global Systemically Important Bank : banque dont la faillite menacerait toute la finance mondiale (JPM, HSBC, BNP…). Doit détenir plus de capital que les autres.",
  NIM: "Net Interest Margin : écart entre ce que la banque gagne sur les prêts et ce qu'elle paie sur les dépôts. Cœur du métier bancaire.",
  CET1: "Common Equity Tier 1 : ratio de capital de la banque (fonds propres / actifs pondérés par le risque). Minimum réglementaire ≈ 10 %. Au-dessus = solide.",
  ROTE: "Return on Tangible Equity : version stricte du ROE qui exclut le goodwill. Plus représentatif de la vraie rentabilité bancaire. > 12 % = bon.",
  ROTCE: "Return on Tangible Common Equity : ROTE limité aux actionnaires ordinaires (hors préférentiels). Métrique reine pour les banques US.",
  NII: "Net Interest Income : revenus d'intérêt nets (intérêts perçus moins intérêts payés). Première ligne de revenus d'une banque commerciale.",
  LCR: "Liquidity Coverage Ratio : ratio Bâle III. Mesure si la banque tient 30 jours de retraits massifs avec ses actifs liquides. Minimum 100 %.",
  NSFR: "Net Stable Funding Ratio : ratio Bâle III. Mesure si la banque a assez de financement stable pour tenir 1 an. Minimum 100 %.",
  RWA: "Risk-Weighted Assets : actifs pondérés par leur risque. Un prêt risqué pèse plus qu'une obligation d'État. Base de calcul du ratio de capital.",
  CIB: "Corporate & Investment Banking : la « banque d'affaires » : fusions-acquisitions, levées de fonds, marchés. Plus rentable mais plus volatil que la banque de détail.",
  AUM: "Assets Under Management : montant total des actifs confiés à un gérant. Le revenu vient en commission % de l'AUM (typiquement 0,5 à 1 %).",
  AUC: "Assets Under Custody : actifs détenus en conservation par une banque dépositaire pour le compte de clients. Pas de risque marché pour la banque.",
  SG_A: "Selling, General & Administrative : frais commerciaux, généraux, administratifs (marketing, RH, juridique). Doit baisser en % du CA quand la sté grandit.",
  bp: "Basis Points (point de base) : unité = 0,01 %. \"+25 bp\" = +0,25 %. Très utilisé pour les taux d'intérêt et écarts de crédit.",
  bps: "Basis Points (point de base) : unité = 0,01 %. \"+25 bps\" = +0,25 %. Très utilisé pour les taux d'intérêt et écarts de crédit.",
  EPS: "Earnings Per Share : bénéfice net divisé par le nombre d'actions. Comparable entre sociétés et dans le temps. Référence pour calculer le P/E.",
  DAU: "Daily Active Users : nombre d'utilisateurs uniques actifs sur 24h. Mesure l'engagement quotidien d'une app (Meta, TikTok…).",
  MAU: "Monthly Active Users : utilisateurs actifs mensuels.",
  DAP: "Daily Active People : personnes actives quotidiennes (audience effective cross-apps).",
  // Dividendes & retour aux actionnaires (Yann 16 mai 2026)
  DPS: "Dividend Per Share : dividende par action. Montant que reçoit chaque actionnaire pour 1 action détenue sur l'année.",
  DRIP: "Dividend Reinvestment Plan : plan où les dividendes sont automatiquement réinvestis pour racheter plus d'actions (effet boule de neige).",
  // Marges & profits (acronymes fréquents)
  OCF: "Operating Cash Flow : flux de trésorerie d'exploitation, cash généré par l'activité courante avant investissements.",
  FCFF: "Free Cash Flow to Firm : flux de trésorerie libre disponible pour tous les financeurs (actionnaires + créanciers).",
  FCFE: "Free Cash Flow to Equity : flux de trésorerie libre disponible pour les actionnaires uniquement (après remboursement de dette).",
  PEG: "Price/Earnings to Growth : ratio P/E divisé par la croissance des bénéfices, sert à comparer valorisation et croissance.",
  EV: "Enterprise Value : valeur d'entreprise = capitalisation boursière + dette nette. Mesure le coût réel d'acquisition d'une société.",
  // Métriques SaaS / tech
  LTV: "Lifetime Value : valeur totale qu'un client génère sur toute la durée de la relation commerciale.",
  CAC: "Customer Acquisition Cost : coût moyen pour acquérir un nouveau client.",
  ARPU: "Average Revenue Per User : revenu moyen par utilisateur.",
  COGS: "Cost of Goods Sold : coût des biens vendus, coûts directs de production.",
  // Comptable
  NRR: "Net Revenue Retention : rétention nette du revenu, indique si les clients existants rapportent plus ou moins d'une année sur l'autre.",
  GRR: "Gross Revenue Retention : rétention brute du revenu hors upsell, indique le taux de fidélité pure des clients.",
  // Stratégie / M&A
  "M&A": "Mergers & Acquisitions : fusions et acquisitions, opérations de rachat ou rapprochement entre sociétés.",
  ESG: "Environmental, Social & Governance : critères environnementaux, sociaux et de gouvernance utilisés pour évaluer la responsabilité d'une société.",
  RPO: "Remaining Performance Obligations : engagements contractuels restant à honorer, équivalent du backlog pour les éditeurs logiciels et SaaS.",
};

/**
 * Termes Mettrik composés (>1 mot) qui ont aussi besoin d'un tooltip pour
 * un FR de 16 ans non-tech. Séparé de ACRONYM_GLOSSARY car ils ne sont pas
 * détectables par regex acronymes (caractère espace au milieu).
 */
export const TERM_GLOSSARY: Record<string, string> = {
  "Run Rate": "Taux annualisé : on prend la performance d'un trimestre et on la projette sur 12 mois pour obtenir un chiffre d'affaires « comme si » le trimestre actuel se répétait toute l'année.",
  "Backlog": "Carnet de commandes : valeur des commandes déjà signées mais pas encore livrées. Donne de la visibilité sur les revenus futurs (6-18 mois).",
  "Hero KPI": "Indicateur principal d'une société : celui qui résume le mieux sa performance et que les investisseurs suivent en priorité.",
  "Free Cash Flow": "Trésorerie libre : cash dispo après dépenses d'investissement. Permet de payer dividendes / racheter actions / réduire dette.",
  // Dividendes (Yann 16 mai 2026)
  "Cap Return": "Capital retourné : total des dividendes versés + rachats d'actions effectués par la société sur la période. Indicateur clé du retour aux actionnaires.",
  "Capital Retourné": "Capital retourné : total des dividendes versés + rachats d'actions effectués par la société sur la période. Indicateur clé du retour aux actionnaires.",
  "Payout Ratio": "Taux de distribution : part du bénéfice net redistribuée en dividendes (en %). Entre 30 et 60 % est sain pour une industrielle mature.",
  "Dividend Aristocrat": "Société qui a augmenté son dividende chaque année pendant au moins 25 ans consécutifs. Statut rare qui prouve la solidité de la génération de cash sur le long terme.",
  // Marges & profits
  "Op Margin": "Marge opérationnelle : résultat opérationnel divisé par le chiffre d'affaires. Mesure la rentabilité du cœur de métier avant charges financières et impôts.",
  "Operating Margin": "Marge opérationnelle : résultat opérationnel divisé par le chiffre d'affaires. Mesure la rentabilité du cœur de métier avant charges financières et impôts.",
  "Gross Margin": "Marge brute : (revenu - coût des biens vendus) / revenu. Mesure ce qui reste après les coûts directs de production.",
  "Net Income": "Bénéfice net : profit final après tous les coûts, impôts et charges financières. C'est ce qui revient aux actionnaires.",
  "Operating Income": "Résultat opérationnel : bénéfice du cœur de métier, avant charges financières et impôts.",
  "Operating Cash Flow": "Flux de trésorerie d'exploitation : cash réellement généré par l'activité courante, avant investissements et financement.",
  // Super-KPI Mettrik
  "Rule of 40": "Règle des 40 : croissance du revenu + marge opérationnelle. Référence Saas/tech : si ≥ 40, la société combine bien croissance et rentabilité.",
  "Quality of Compounding": "Qualité de la composition : combien d'années consécutives la société compose ses revenus et marges sans accroc. Mesure la régularité de la performance.",
  "Profit Power Index": "Indice de puissance bénéficiaire Mettrik : composite propriétaire combinant Rule of 40, marge, concentration revenus, tendance marge. Signature Mettrik.",
  // Autres
  "Headcount": "Effectif : nombre total d'employés de la société. Indicateur de taille et d'évolution des coûts salariaux.",
  "Bookings": "Commandes prises : valeur des nouveaux contrats signés sur la période, avant facturation. Indicateur avancé du revenu futur.",
  "Total Revenue": "Chiffre d'affaires total : revenu total généré par la société sur la période (tous segments confondus).",
  // Super-KPI categories (Yann 16 mai 2026)
  "Croissance": "Catégorie Croissance : Super-KPI qui mesurent la vitesse d'expansion de la société (croissance du revenu, des utilisateurs, du marché).",
  "Profitabilité": "Catégorie Profitabilité : Super-KPI qui mesurent l'efficacité avec laquelle la société transforme son revenu en bénéfice.",
  "Risque": "Catégorie Risque : Super-KPI qui mesurent la solidité financière et les risques structurels (concentration clients, dette, dépendances).",
  "Stratégie": "Catégorie Stratégie : Super-KPI qui mesurent les choix d'allocation du capital (R&D, M&A, dividendes, rachats) et leur cohérence.",
  "Composite": "Catégorie Composite : Super-KPI qui combinent plusieurs indicateurs bruts pour donner une vision synthétique (ex : Profit Power Index).",
};

/**
 * BROADCAST_INTEGRATION
 * ---------------------
 * Pour appliquer ces helpers, les conversations de scope correspondant
 * doivent les wrapper dans leurs composants de rendu :
 *
 *  - CONV-CONCEPTS dans `src/components/company-view.tsx` et tous les
 *    sous-composants qui rendent un `description` / `signal` / story_body :
 *    importer `normalizeNarrative` et l'appliquer à toute string narrative.
 *
 *  - CONV-CONCEPTS pour les sub-sectors : appliquer `translateSubsector(s)`
 *    dans `company-header.tsx` à l'affichage du chip sub-sector.
 *
 *  - CONV-SYSTEMS pour les acronymes : wrapper chaque `<span>{acronym}</span>`
 *    dans un `<InfoTooltip text={ACRONYM_GLOSSARY[acronym]} />` quand
 *    `ACRONYM_GLOSSARY[acronym]` existe.
 *
 *  - CONV-DATA peut OPTIONNELLEMENT pré-normaliser les datasets v2-pipeline
 *    en appliquant `normalizeNarrative` au build (pas obligatoire si le
 *    rendu côté UI applique déjà).
 *
 * Coordination : ping `🤝 @CONV-CONCEPTS @CONV-SYSTEMS @CONV-DATA` dans
 * SHARED-STATUS.md à la livraison de Phase 2.
 */
