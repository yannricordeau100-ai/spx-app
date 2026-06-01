/**
 * plans.ts — modèle de plans 3 tiers Mettrik AI (Yann 7 mai 2026).
 *
 * Catalogue centralisé des fonctionnalités par tier, utilisé à la fois par
 * la page tarifs (display marketing) et par le moteur de gating (access.ts).
 *
 * Une seule source de vérité : si on ajoute une feature, on la définit
 * ICI avec sa disponibilité par tier, et tout le reste suit (UI tarifs,
 * paywall, dashboard).
 */

export type PlanTier = "free" | "premium" | "max";

/** Métadonnées display d'un plan (pricing page). */
export type PlanDisplay = {
  tier: PlanTier;
  name: string;
  tagline: string;
  /** Prix mensuel en euros (annuel = month × 8 = -33 % vs ×12). */
  price_monthly_eur: number;
  /** Prix annuel facturé en une fois en euros. */
  price_annual_eur: number;
  /** Mention promo annuelle ("2 mois offerts", etc.). */
  annual_savings_label: string;
  /** Couleur d'accent (hex). */
  accent: string;
  /** Plan le plus populaire ? (badge "Recommandé"). */
  highlight: boolean;
  /** CTA bouton principal. */
  cta_label: string;
  /** Audience cible (1 phrase). */
  audience: string;
};

export const PLANS: PlanDisplay[] = [
  {
    tier: "free",
    name: "Gratuit",
    tagline: "Teste la profondeur de Mettrik sur les 2 GAFA les plus suivies.",
    price_monthly_eur: 0,
    price_annual_eur: 0,
    annual_savings_label: "À vie, sans carte bancaire",
    accent: "#71717a",
    highlight: false,
    cta_label: "Démarrer gratuitement",
    audience: "Particuliers curieux et étudiants en finance.",
  },
  {
    // Yann 15 mai 2026 : valeurs FALLBACK alignées sur les valeurs BDD
    // actuelles. Quand la BDD était inaccessible, le fallback montrait
    // 24,90 € au lieu de 29,90 € → confusion utilisateur.
    tier: "premium",
    name: "Premium",
    tagline: "L'essentiel pour suivre ton portefeuille au quotidien.",
    price_monthly_eur: 29.9,
    price_annual_eur: 238.8,
    annual_savings_label: "4 mois offerts (-33 %)",
    accent: "#a78bfa",
    highlight: true,
    cta_label: "Choisir Premium",
    audience: "Particuliers actifs avec 5 à 50 lignes en portefeuille.",
  },
  {
    tier: "max",
    name: "Max",
    tagline: "Outils avancés pour family offices, conseillers et fonds.",
    price_monthly_eur: 59.9,
    price_annual_eur: 478.8,
    annual_savings_label: "4 mois offerts (-33 %)",
    accent: "#22d3ee",
    highlight: false,
    cta_label: "Passer en Max",
    audience: "Pros de la finance, family offices, gestionnaires de patrimoine.",
  },
];

/** Catalogue des fonctionnalités, leur disponibilité par tier. */
export type FeatureRow = {
  id: string;
  /** Catégorie pour grouper visuellement la matrice. Yann (27 mai 2026) :
   *  désormais un string libre (sourcé de la BDD `pricing_features.category`).
   *  Chaîne vide "" = sans catégorie (affichée en haut de la matrice). */
  category: string;
  label: string;
  /** Aide tooltip (1 phrase). */
  help?: string;
  free: string | boolean;
  premium: string | boolean;
  max: string | boolean;
  /** Yann (25 mai 2026) : si true, la feature apparaît dans le bloc "forfait"
   *  (card publique). Sinon visible uniquement dans la matrice détaillée.
   *  Fallback côté pricing-cards : si AUCUNE feature n'a show_in_card=true,
   *  on retombe sur les 8 premières (comportement avant flag). */
  show_in_card?: boolean;
};

export const FEATURES: FeatureRow[] = [
  // ─── Sociétés ───────────────────────────────────────────────────────
  {
    id: "stes_count",
    category: "Sociétés",
    label: "Sociétés accessibles",
    help: "Nombre de fiches société consultables en intégralité.",
    free: "2 (Google + Meta)",
    premium: "1 000+ américaines & européennes",
    max: "1 000+ + ajouts mensuels",
  },
  {
    id: "logo_pages",
    category: "Sociétés",
    label: "Logos officiels + identité visuelle",
    free: true,
    premium: true,
    max: true,
  },
  {
    id: "ranks",
    category: "Sociétés",
    label: "Rangs mondial / USA / secteur",
    free: false,
    premium: true,
    max: true,
  },
  // ─── Analyse ────────────────────────────────────────────────────────
  {
    id: "kpis",
    category: "Analyse",
    label: "Indicateurs clés (KPI principaux + secondaires)",
    free: "Limité à Google + Meta",
    premium: true,
    max: true,
  },
  {
    id: "stories_kpis",
    category: "Analyse",
    label: "Histoires clés (carrousel KPI nouveaux)",
    help: "KPI émergents propres à chaque société (ex : adoption IA, expansion géo).",
    free: false,
    premium: true,
    max: true,
  },
  {
    id: "transcripts",
    category: "Analyse",
    label: "Citations dirigeants (dernier appel résultats)",
    free: false,
    premium: true,
    max: true,
  },
  {
    id: "risks",
    category: "Analyse",
    label: "Facteurs de risque scorés 1 à 5",
    free: false,
    premium: true,
    max: true,
  },
  {
    id: "governance",
    category: "Analyse",
    label: "Gouvernance + rémunération dirigeants",
    free: false,
    premium: true,
    max: true,
  },
  {
    id: "ai_positioning",
    category: "Analyse",
    label: "Positionnement IA (leader / intégrateur / prudent)",
    free: false,
    premium: true,
    max: true,
  },
  // ─── Suivi ──────────────────────────────────────────────────────────
  {
    id: "favorites",
    category: "Suivi",
    label: "Sociétés favorites",
    free: "2 max",
    premium: "50 max",
    max: "Illimité",
  },
  {
    id: "alerts_email",
    category: "Suivi",
    label: "Alertes par email sur seuils KPI",
    help: "Reçois un email quand un KPI franchit un seuil que tu as fixé.",
    free: false,
    premium: "5 alertes",
    max: "Illimité",
  },
  {
    id: "earnings_calendar",
    category: "Suivi",
    label: "Calendrier des résultats à venir",
    free: false,
    premium: true,
    max: true,
  },
  // ─── Comparaison ────────────────────────────────────────────────────
  {
    id: "compare_basic",
    category: "Comparaison",
    label: "Comparaison 2 sociétés",
    free: "Google ↔ Meta",
    premium: true,
    max: true,
  },
  {
    id: "compare_basket",
    category: "Comparaison",
    label: "Panier de comparaison (3+ sociétés)",
    free: false,
    premium: "3 sociétés",
    max: "Jusqu'à 10",
  },
  {
    id: "sector_compare",
    category: "Comparaison",
    label: "Comparaison sectorielle (vs pairs)",
    free: false,
    premium: true,
    max: true,
  },
  // ─── Données ────────────────────────────────────────────────────────
  {
    id: "tam",
    category: "Données",
    label: "Taille de marché (TAM) déclarée par la société",
    free: false,
    premium: true,
    max: true,
  },
  {
    id: "segments",
    category: "Données",
    label: "Répartition CA par segment & géographie",
    free: false,
    premium: true,
    max: true,
  },
  {
    id: "history_5y",
    category: "Données",
    label: "Historique 5 ans",
    free: "Sur Google + Meta",
    premium: true,
    max: true,
  },
  {
    id: "history_10y",
    category: "Données",
    label: "Historique 10 ans",
    free: false,
    premium: false,
    max: true,
  },
  {
    id: "history_20y",
    category: "Données",
    label: "Historique 20 ans",
    free: false,
    premium: false,
    max: true,
  },
  // ─── Pro ────────────────────────────────────────────────────────────
  {
    id: "export_pdf",
    category: "Pro",
    label: "Export PDF des fiches société",
    free: false,
    premium: false,
    max: true,
  },
  {
    id: "export_csv",
    category: "Pro",
    label: "Export CSV des données",
    free: false,
    premium: false,
    max: true,
  },
  {
    id: "api_access",
    category: "Pro",
    label: "Accès API (lecture)",
    help: "Endpoints REST pour intégrer les données Mettrik dans tes outils.",
    free: false,
    premium: false,
    max: true,
  },
  {
    id: "priority_support",
    category: "Pro",
    label: "Support prioritaire (réponse < 24 h)",
    free: false,
    premium: "Email",
    max: "Email + appel mensuel",
  },
  {
    id: "early_access",
    category: "Pro",
    label: "Accès anticipé aux nouvelles fonctions",
    free: false,
    premium: false,
    max: true,
  },
];

/** Helper : prix mensuel équivalent quand facturé annuellement. */
export function monthlyEquivalent(plan: PlanDisplay): number {
  if (plan.price_annual_eur === 0) return 0;
  return Math.round((plan.price_annual_eur / 12) * 10) / 10;
}

/** Helper : "à partir de X €/mois" quand on hésite entre tier. */
export function startingPriceLabel(currency: string = "€"): string {
  const cheapest = PLANS.find((p) => p.price_monthly_eur > 0);
  if (!cheapest) return "Gratuit";
  return `À partir de ${cheapest.price_monthly_eur.toFixed(2).replace(".", ",")} ${currency}/mois`;
}
