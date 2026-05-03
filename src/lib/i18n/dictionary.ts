import type { Locale } from "./types";

/**
 * Dictionnaire i18n Mettrik.
 *
 * Structure plate `key → { fr, en }` pour rester lisible.
 * Chaque clé suit le pattern `domain.subdomain.label` (ex: `home.tagline`,
 * `auth.signin.title`).
 *
 * Règles d'écriture :
 *   - FR strict (vocabulaire Mettrik : « Mds » pas « B », pas d'em-dash, etc.)
 *   - EN naturel (anglais business clair, ton confiance investisseur)
 *   - Si une clé prend des paramètres, les markers `{name}` sont remplacés
 *     côté composant.
 */
export type DictEntry = {
  fr: string;
  en: string;
  de?: string;
  nl?: string;
  sv?: string;
  da?: string;
  "en-GB"?: string;
  "de-CH"?: string;
};
export type Dict = Record<string, DictEntry>;

export const DICTIONARY: Dict = {
  /* ──────────────────────── BRAND ──────────────────────── */
  "brand.subtitle": {
    fr: "KPI Intelligence",
    en: "KPI Intelligence",
  },
  "brand.tagline_main_1": {
    fr: "Les chiffres qui",
    en: "The numbers that",
  },
  "brand.tagline_main_2": {
    fr: "racontent l'histoire.",
    en: "tell the story.",
  },
  "brand.tagline_sub": {
    fr: "3 clics pour découvrir les KPI clés et Super KPI exclusifs des plus grandes sociétés américaines et européennes.",
    en: "3 clicks to the key KPIs and exclusive Super KPIs of the largest US and European companies.",
  },
  "brand.data_updated": {
    fr: "Données à jour au",
    en: "Data updated as of",
  },
  "brand.companies_available": {
    fr: "Sociétés disponibles",
    en: "Available companies",
  },
  "brand.footer_tagline": {
    fr: "Mettrik AI · KPI Intelligence pour investisseurs.",
    en: "Mettrik AI · KPI Intelligence for investors.",
  },

  /* ──────────────────────── AUTH ──────────────────────── */
  "auth.signin.title": { fr: "Connexion", en: "Sign in" },
  "auth.signup.title": { fr: "Créer un compte", en: "Create account" },
  "auth.reset.title": { fr: "Mot de passe oublié", en: "Forgot password" },
  "auth.signin.subtitle": {
    fr: "Accède aux KPI des plus grandes sociétés américaines et européennes.",
    en: "Access the KPIs of the biggest US and European companies.",
  },
  "auth.signup.subtitle": {
    fr: "Plus que 3 clics pour découvrir les KPI indispensables et Super KPI privées.",
    en: "3 clicks away from the essential KPIs and private Super KPIs.",
  },
  "auth.reset.subtitle": {
    fr: "Renseigne ton email, on t'envoie un lien pour choisir un nouveau mot de passe.",
    en: "Enter your email and we'll send you a link to choose a new password.",
  },
  "auth.tab.signin": { fr: "Se connecter", en: "Sign in" },
  "auth.tab.signup": { fr: "S'inscrire", en: "Sign up" },
  "auth.cta.signin": { fr: "Se connecter", en: "Sign in" },
  "auth.cta.signup": { fr: "Créer mon compte", en: "Create my account" },
  "auth.cta.google": { fr: "Continuer avec Google", en: "Continue with Google" },
  "auth.cta.send_reset": { fr: "Envoyer le lien", en: "Send the link" },
  "auth.cta.send_magic": { fr: "Envoyer", en: "Send" },
  "auth.field.email": { fr: "vous@exemple.com", en: "you@example.com" },
  "auth.field.password": { fr: "Mot de passe", en: "Password" },
  "auth.field.password_min": {
    fr: "Au moins 8 caractères",
    en: "At least 8 characters",
  },
  "auth.divider.or": { fr: "ou", en: "or" },
  "auth.divider.magic_link": { fr: "lien magique", en: "magic link" },
  "auth.field.magic_email": {
    fr: "Recevoir un lien par email",
    en: "Get a link by email",
  },
  "auth.forgot_password": { fr: "Mot de passe oublié ?", en: "Forgot password?" },
  "auth.no_account": { fr: "Pas encore de compte ?", en: "Don't have an account yet?" },
  "auth.has_account": { fr: "Déjà inscrit ?", en: "Already have an account?" },
  "auth.create_account": { fr: "Créer un compte", en: "Create an account" },
  "auth.back_to_signin": { fr: "Retour à la connexion", en: "Back to sign in" },

  /* Auth nav (header) */
  "authnav.signin": { fr: "Connexion", en: "Sign in" },
  "authnav.signup": { fr: "S'inscrire", en: "Sign up" },
  "authnav.account": { fr: "Mon Compte", en: "My Account" },

  /* ──────────────────────── SEARCH ──────────────────────── */
  "search.placeholder_hero": {
    fr: "Rechercher Apple, LVMH, SAP…",
    en: "Search Apple, LVMH, SAP…",
  },
  "search.placeholder_compact": {
    fr: "Rechercher une société…",
    en: "Search a company…",
  },
  "search.results_count_one": { fr: "société", en: "company" },
  "search.results_count_many": { fr: "sociétés", en: "companies" },
  "search.results_for": { fr: "pour «", en: "for \"" },
  "search.results_for_end": { fr: "»", en: "\"" },
  "search.no_results": {
    fr: "Aucune société trouvée pour «",
    en: "No company found for \"",
  },
  "search.no_results_hint": {
    fr: "Essaie un secteur (Finance, Industrie…) ou un ticker (GOOGL, META…).",
    en: "Try a sector (Finance, Industry…) or a ticker (GOOGL, META…).",
  },
  "search.enter_to_open": { fr: "↵ pour ouvrir", en: "↵ to open" },
  "search.close": { fr: "Fermer", en: "Close" },

  /* ──────────────────────── COMPANY PAGE ──────────────────────── */
  "company.kpi_principal": { fr: "KPI principal", en: "Lead KPI" },
  "company.up_to_date": { fr: "À jour", en: "Up to date" },
  "company.recent": { fr: "Récent", en: "Recent" },
  "company.stale": { fr: "Données vieillissantes", en: "Stale data" },
  "company.unknown_date": { fr: "Date inconnue", en: "Unknown date" },
  "company.next_results": { fr: "Prochains résultats", en: "Next earnings" },
  "company.last_quarter": { fr: "Dernier trimestre couvert", en: "Latest quarter covered" },
  "company.last_data": { fr: "Dernière donnée", en: "Latest data point" },
  "company.fresh_explainer": {
    fr: "Le dernier point de donnée a moins de 4 mois : exercice fiscal le plus récent.",
    en: "Latest data point is less than 4 months old: most recent fiscal year.",
  },
  "company.recent_explainer": {
    fr: "Le dernier point de donnée a entre 4 et 12 mois. Toujours valide mais le prochain exercice approche.",
    en: "Latest data point is 4 to 12 months old. Still valid but the next fiscal year is approaching.",
  },
  "company.stale_explainer": {
    fr: "Le dernier point de donnée a plus de 12 mois. La société a probablement publié un exercice plus récent : la donnée affichée n'est plus à jour.",
    en: "Latest data point is over 12 months old. The company has likely published a more recent fiscal year: data shown is outdated.",
  },
  "company.unknown_explainer": {
    fr: "Pas de date associée à ce point de donnée.",
    en: "No date associated with this data point.",
  },

  "company.rank_world": { fr: "Rang mondial", en: "Global rank" },
  "company.rank_us": { fr: "Rang USA", en: "US rank" },
  "company.sector": { fr: "Secteur", en: "Sector" },
  "company.subsector": { fr: "Sous-secteur", en: "Sub-sector" },
  "company.founded": { fr: "Fondée en", en: "Founded" },
  "company.ipo": { fr: "IPO", en: "IPO" },

  "company.provenance": {
    fr: "Tous les chiffres présentés proviennent directement ou indirectement de la société. Toute donnée tierce est sourcée à l'endroit où elle apparaît.",
    en: "All numbers shown come directly or indirectly from the company. Any third-party data is sourced where it appears.",
  },

  "company.chart.curve": { fr: "Courbe", en: "Curve" },
  "company.chart.bars": { fr: "Barres", en: "Bars" },
  "company.chart.variation": { fr: "Variation", en: "Variation" },
  "company.chart.dashboard": { fr: "Tableau de bord", en: "Dashboard" },
  "company.chart.curve.hint": { fr: "Trajectoire", en: "Trajectory" },
  "company.chart.bars.hint": { fr: "Année par année", en: "Year by year" },
  "company.chart.variation.hint": {
    fr: "Variation annuelle (year-over-year)",
    en: "Year-over-year change",
  },
  "company.chart.dashboard.hint": {
    fr: "6 indicateurs en un coup d'œil",
    en: "6 indicators at a glance",
  },

  "company.period.5y": { fr: "5 ans", en: "5y" },
  "company.period.10y": { fr: "10 ans", en: "10y" },
  "company.period.20y": { fr: "20 ans", en: "20y" },

  "company.compare.button": { fr: "Comparer", en: "Compare" },
  "company.compare.on": { fr: "Comparer sur", en: "Compare on" },
  "company.compare.empty": {
    fr: "Aucune société du panel ne publie un KPI comparable à",
    en: "No company in the panel publishes a KPI comparable to",
  },
  "company.compare.direct": { fr: "Direct", en: "Direct" },
  "company.compare.connex": { fr: "Connexe", en: "Related" },
  "company.save.button": { fr: "Enregistrer", en: "Save" },
  "company.kpi_table.show_more": { fr: "Voir tous les indicateurs", en: "Show all indicators" },
  "company.kpi_table.show_less": { fr: "Masquer", en: "Hide" },
  "company.kpi_table.collapse": { fr: "Réduire", en: "Collapse" },
  "company.kpi_table.see_more_one": {
    fr: "Voir 1 indicateur supplémentaire",
    en: "See 1 more indicator",
  },
  "company.kpi_table.see_more_many": {
    fr: "Voir {n} indicateurs supplémentaires",
    en: "See {n} more indicators",
  },

  /* Quality tier */
  "tier.excellent": { fr: "Excellent", en: "Excellent" },
  "tier.bon": { fr: "Bon", en: "Good" },
  "tier.moyen": { fr: "Moyen", en: "Average" },
  "tier.faible": { fr: "Faible", en: "Weak" },

  /* Stock price block */
  "stock.market_cap": { fr: "Capitalisation Boursière", en: "Market Cap" },

  /* Hero number */
  "hero.cagr_5y": { fr: "(CAGR 5 ans)", en: "(5y CAGR)" },
  "hero.yoy": { fr: "(YoY)", en: "(YoY)" },
  "hero.percentile_top": { fr: "Top", en: "Top" },
  "kpi.active": { fr: "Actif", en: "Active" },
  "kpi.definition": { fr: "Définition", en: "Definition" },

  /* Stories */
  "stories.aria_prev": { fr: "Story précédente", en: "Previous story" },
  "stories.aria_next": { fr: "Story suivante", en: "Next story" },
  "stories.aria_pause": { fr: "Mettre en pause", en: "Pause" },
  "stories.aria_resume": { fr: "Reprendre", en: "Resume" },
  "stories.aria_jump": { fr: "Aller à la story", en: "Go to story" },
  "stories.title": { fr: "Stories", en: "Stories" },
  "stories.subtitle": {
    fr: "KPIs ciblés (historique court ou unique) et positions marché. Format mobile : lecture auto 5 s par carte, flèches pour naviguer, survol pour mettre en pause.",
    en: "Focused KPIs (short or one-off history) and market positions. Mobile format: auto-play 5s per card, arrows to navigate, hover to pause.",
  },
  "stories.market_position": { fr: "Marché · TAM", en: "Market · TAM" },
  "stories.cat.Marché": { fr: "Marché", en: "Market" },
  "stories.cat.Innovation": { fr: "Innovation", en: "Innovation" },
  "stories.cat.Adoption": { fr: "Adoption", en: "Adoption" },
  "stories.cat.Capacité": { fr: "Capacité", en: "Capacity" },
  "stories.cat.Story": { fr: "Story", en: "Story" },
  "stories.market_share": { fr: "part de marché", en: "market share" },
  "stories.segment_revenue": { fr: "Revenu segment", en: "Segment revenue" },
  "stories.market_cagr": { fr: "CAGR marché attendu", en: "Expected market CAGR" },
  "stories.source": { fr: "Source", en: "Source" },

  /* Risks */
  "risks.title": { fr: "Facteurs de risque", en: "Risk factors" },
  "risks.severity": { fr: "Sévérité", en: "Severity" },
  "risks.subtitle": {
    fr: "Propos directs de la direction, notés selon 4 critères. Cliquez pour voir la citation intégrale ; survolez l'icône « i » pour comprendre la note.",
    en: "Direct quotes from management, scored on 4 criteria. Click for the full quote; hover the \"i\" icon to understand the score.",
  },
  "risks.count": { fr: "risques", en: "risks" },
  "risks.aggravated_one": { fr: "aggravé", en: "rising" },
  "risks.aggravated_many": { fr: "aggravés", en: "rising" },
  "risks.new_one": { fr: "nouveau en 2025", en: "new in 2025" },
  "risks.new_many": { fr: "nouveaux en 2025", en: "new in 2025" },
  "risks.management_quote": { fr: "Propos de la direction", en: "Management quote" },
  "risks.score_explainer_title": {
    fr: "Comment cette note a été calculée",
    en: "How this score was computed",
  },
  "risks.score_scale_title": { fr: "Barème", en: "Scale" },
  "risks.score_scale_1": {
    fr: "Position dans le 10-K (ordre officiel)",
    en: "Position in the 10-K (official order)",
  },
  "risks.score_scale_2": {
    fr: "Intensité du langage juridique",
    en: "Intensity of legal language",
  },
  "risks.score_scale_3": { fr: "Tendance vs 10-K N-1", en: "Trend vs prior-year 10-K" },
  "risks.score_scale_4": {
    fr: "Poids de catégorie (cyber, regulatory élevés)",
    en: "Category weight (cyber, regulatory weighted high)",
  },
  "risks.category.regulatory": { fr: "Réglementaire", en: "Regulatory" },
  "risks.category.competitive": { fr: "Concurrentiel", en: "Competitive" },
  "risks.category.cyber": { fr: "Cybersécurité", en: "Cybersecurity" },
  "risks.category.operational": { fr: "Opérationnel", en: "Operational" },
  "risks.category.financial": { fr: "Financier", en: "Financial" },
  "risks.category.macro": { fr: "Macro", en: "Macro" },
  "risks.category.technology": { fr: "Technologique", en: "Technology" },
  "risks.trend.new": { fr: "Nouveau 2025", en: "New 2025" },
  "risks.trend.up": { fr: "Aggravé", en: "Worsening" },
  "risks.trend.stable": { fr: "Stable", en: "Stable" },
  "risks.trend.down": { fr: "Atténué", en: "Easing" },
  "risks.trend.removed": { fr: "Retiré", en: "Removed" },
  "risks.score.critical": { fr: "Critique", en: "Critical" },
  "risks.score.high": { fr: "Élevé", en: "High" },
  "risks.score.moderate": { fr: "Modéré", en: "Moderate" },
  "risks.score.low": { fr: "Faible", en: "Low" },
  "risks.score.marginal": { fr: "Marginal", en: "Marginal" },
  "risks.pw.label": { fr: "Profit warning", en: "Profit warning" },
  "risks.pw.title_tooltip": {
    fr: "Avertissement sur les résultats",
    en: "Profit warning",
  },
  "risks.pw.explainer": {
    fr: "Annonce publique anticipée par la direction prévenant que les résultats à venir seront sensiblement en dessous du consensus analystes (perte de marge, retournement de marché, charge exceptionnelle). Effet typique sur le cours : -10 à -30 % en quelques heures.",
    en: "Public announcement made by management warning that upcoming results will materially miss analyst consensus (margin loss, market reversal, one-off charge). Typical impact on the stock: -10 to -30% within hours.",
  },
  "risks.pw.note_label": { fr: "Note calée sur :", en: "Score based on:" },
  "risks.pw.note_body": {
    fr: "(1) historique des avertissements + commentaires direction + dernier earnings call ; (2) tendance court / moyen terme (<3 mois) de réduction de marges au-delà des déclarations publiques précédentes.",
    en: "(1) warning history + management commentary + latest earnings call; (2) short to medium-term trend (<3 months) of margin compression beyond prior public statements.",
  },
  "risks.pw.headline": {
    fr: "Risque d'avertissement sur les résultats",
    en: "Profit warning risk",
  },
  "risks.pw.last_date": { fr: "Date du dernier profit warning :", en: "Last profit warning date:" },
  "risks.pw.never": { fr: "Jamais", en: "Never" },
  "risks.pw.margin_trend": { fr: "Tendance marges :", en: "Margin trend:" },
  "risks.pw.score.very_unlikely": { fr: "Très peu probable", en: "Very unlikely" },
  "risks.pw.score.unlikely": { fr: "Peu probable", en: "Unlikely" },
  "risks.pw.score.moderate": { fr: "Modéré", en: "Moderate" },
  "risks.pw.score.high": { fr: "Élevé", en: "High" },
  "risks.pw.score.imminent": { fr: "Imminent", en: "Imminent" },

  /* Répartition (geographic + segment) */
  "repartition.title": { fr: "Répartition du chiffre d'affaires", en: "Revenue breakdown" },
  "repartition.subtitle": {
    fr: "Bascule entre vue géographique et vue par segment opérationnel. Glisse latéralement (ou clique) pour changer le style de visualisation.",
    en: "Toggle between geographic view and operating segment view. Swipe left/right (or click) to change visualization style.",
  },
  "repartition.tab.geo": { fr: "Géographique", en: "Geographic" },
  "repartition.tab.segment": { fr: "Segment", en: "Segment" },
  "repartition.style.treemap": { fr: "Treemap", en: "Treemap" },
  "repartition.style.radial": { fr: "Radial", en: "Radial" },
  "repartition.style.iso": { fr: "ISO 3D", en: "ISO 3D" },
  "repartition.no_data": {
    fr: "Données non disponibles pour cette dimension.",
    en: "Data not available for this dimension.",
  },
  "repartition.source": { fr: "Source", en: "Source" },

  /* Governance */
  "governance.title": { fr: "Gouvernance & rémunération", en: "Governance & compensation" },
  "governance.subtitle_prefix": { fr: "À jour de l'assemblée générale du", en: "Updated as of the AGM on" },
  "governance.subtitle_suffix": { fr: "Chiffres relatifs à l'exercice", en: "Figures for fiscal year" },
  "governance.dual_class": { fr: "Dual-class", en: "Dual-class" },
  "governance.mono_class": {
    fr: "Mono-class (1 action = 1 vote)",
    en: "Mono-class (1 share = 1 vote)",
  },
  "governance.dual_class_tooltip": {
    fr: "Structure dual-class : actions Class A / Class B avec droits de vote différenciés. Les fondateurs / dirigeants gardent un poids démesuré au scrutin malgré une faible part de capital. Signal de contrôle long-terme + risque gouvernance.",
    en: "Dual-class structure: Class A / Class B shares with differentiated voting rights. Founders / managers retain disproportionate voting power despite a small share of capital. Signal of long-term control + governance risk.",
  },
  "governance.mono_class_tooltip": {
    fr: "Structure mono-class : 1 action = 1 vote. Top voting et top capital convergent.",
    en: "Mono-class structure: 1 share = 1 vote. Top voting and top capital converge.",
  },
  "governance.top_voting": { fr: "Droits de vote", en: "Voting rights" },
  "governance.top_capital": { fr: "Capital détenu", en: "Capital owned" },
  "governance.view_3d": { fr: "Vue 3D", en: "3D view" },
  "governance.voting_structure": { fr: "Structure de vote", en: "Voting structure" },
  "governance.notes": { fr: "À noter", en: "Worth noting" },
  "governance.pie_title.voting": {
    fr: "Détenteurs des droits de vote",
    en: "Voting rights holders",
  },
  "governance.pie_title.capital": {
    fr: "Détenteurs du capital détenu",
    en: "Capital holders",
  },
  "governance.metrics.ceo_comp_label": {
    fr: "Rémunération totale du CEO",
    en: "Total CEO compensation",
  },
  "governance.metrics.ceo_comp_tooltip": {
    fr: "Total comp = salaire + bonus annuel + stock awards + options + avantages, sur l'exercice",
    en: "Total comp = salary + annual bonus + stock awards + options + perks, for fiscal year",
  },
  "governance.metrics.pay_ratio_label": {
    fr: "Ratio rém. CEO / employé médian",
    en: "CEO / median employee pay ratio",
  },
  "governance.metrics.pay_ratio_tooltip": {
    fr: "Multiple entre la rémunération du CEO et celle de l'employé médian. Médiane S&P 500 ≈ 200×.",
    en: "Multiple between CEO compensation and median employee compensation. S&P 500 median ≈ 200×.",
  },
  "governance.metrics.exec_approval_label": {
    fr: "Approbation de la rémunération",
    en: "Compensation approval",
  },
  "governance.metrics.exec_approval_tooltip": {
    fr: "Vote consultatif annuel des actionnaires sur la rémunération des dirigeants (équivalent anglophone : say-on-pay). Sous 80 % = mécontentement notable.",
    en: "Annual advisory shareholder vote on executive compensation (say-on-pay). Below 80% = notable dissent.",
  },
  "governance.metrics.board_independence_label": {
    fr: "Indépendance du board",
    en: "Board independence",
  },
  "governance.metrics.board_independence_tooltip": {
    fr: "Part des administrateurs indépendants (sans lien dirigeant, familial ou commercial). Les bourses NYSE / Nasdaq exigent une majorité.",
    en: "Share of independent directors (no executive, family or commercial ties). NYSE / Nasdaq require a majority.",
  },
  "governance.metrics.board_size_label": { fr: "Taille du board", en: "Board size" },
  "governance.metrics.board_size_unit": { fr: "membres", en: "members" },
  "governance.metrics.board_size_tooltip_title": {
    fr: "Membres du conseil",
    en: "Board members",
  },
  "governance.metrics.tenure_label": { fr: "Ancienneté moyenne", en: "Average tenure" },
  "governance.metrics.tenure_unit": { fr: "ans", en: "years" },
  "governance.metrics.tenure_tooltip": {
    fr: "Ancienneté moyenne des administrateurs. Trop court = manque d'expérience ; trop long (>10 ans) = renouvellement insuffisant.",
    en: "Average director tenure. Too short = lack of experience; too long (>10 years) = insufficient renewal.",
  },
  "governance.metrics.women_label": { fr: "Diversité : femmes au board", en: "Diversity: women on board" },
  "governance.metrics.women_tooltip": {
    fr: "% de femmes au conseil. Médiane S&P 500 ≈ 32 %. Certains investisseurs institutionnels votent contre les boards sous 30 %.",
    en: "% of women on the board. S&P 500 median ≈ 32%. Some institutional investors vote against boards below 30%.",
  },
  "governance.metrics.age_label": { fr: "Âge moyen du board", en: "Average board age" },
  "governance.metrics.insider_label": {
    fr: "Détention insiders (dirigeants + board)",
    en: "Insider ownership (executives + board)",
  },
  "governance.metrics.insider_tooltip": {
    fr: "Part du capital détenue par les dirigeants et le board. Élevé = alignement fort avec actionnaires.",
    en: "Share of capital held by executives and board. High = strong alignment with shareholders.",
  },
  "governance.peer.bas": { fr: "Plus bas que la moyenne", en: "Below average" },
  "governance.peer.moyen": { fr: "Dans la moyenne", en: "Average" },
  "governance.peer.haut": { fr: "Plus haut que la moyenne", en: "Above average" },
  "governance.peer.extreme": { fr: "Bien au-dessus", en: "Well above" },
  "governance.holder.fondateur": { fr: "Fondateur", en: "Founder" },
  "governance.holder.insider": { fr: "Insider", en: "Insider" },
  "governance.holder.institutionnel": { fr: "Institutionnel", en: "Institutional" },
  "governance.holder.particulier": { fr: "Particulier", en: "Retail" },
  "governance.holder.fonds_souverain": { fr: "Fonds souverain", en: "Sovereign fund" },

  /* AI positioning */
  "ai.title_prefix": { fr: "Positionnement de", en: "AI positioning of" },
  "ai.title_suffix": { fr: "sur l'IA", en: "" },
  "ai.stance.leader.label": { fr: "Acteur majeur", en: "Major player" },
  "ai.stance.leader.desc": {
    fr: "L'IA est au cœur de la stratégie et des produits.",
    en: "AI is core to strategy and products.",
  },
  "ai.stance.integrator.label": { fr: "Intégrateur", en: "Integrator" },
  "ai.stance.integrator.desc": {
    fr: "L'IA est intégrée de façon significative aux opérations et à l'offre.",
    en: "AI is meaningfully integrated into operations and the product offering.",
  },
  "ai.stance.cautious.label": { fr: "Observateur prudent", en: "Cautious observer" },
  "ai.stance.cautious.desc": {
    fr: "L'IA est mentionnée mais l'intégration reste limitée ou émergente.",
    en: "AI is mentioned but integration remains limited or emerging.",
  },
  "ai.stance.absent.label": { fr: "Aucun positionnement", en: "No positioning" },
  "ai.stance.absent.desc": {
    fr: "Aucune mention significative de l'IA dans les communications officielles.",
    en: "No meaningful mention of AI in official communications.",
  },
  "ai.absent_summary": {
    fr: "n'a pas communiqué de positionnement explicite sur l'IA dans ses dépôts légaux ni ses conférences récentes. À reconsidérer dès qu'une position sera formulée.",
    en: "has not communicated an explicit AI positioning in its legal filings or recent conferences. To be reconsidered when a position is formulated.",
  },
  "ai.absent_source": { fr: "Non disclosé", en: "Not disclosed" },
  "ai.evidence_label": { fr: "Éléments concrets", en: "Concrete evidence" },
  "ai.source": { fr: "Source", en: "Source" },

  /* Senate trades */
  "senate.title_prefix": { fr: "Trades du Sénat US sur", en: "US Senate trades on" },
  "senate.bullish": { fr: "Bullish", en: "Bullish" },
  "senate.bearish": { fr: "Bearish", en: "Bearish" },
  "senate.neutral": { fr: "Neutre", en: "Neutral" },
  "senate.purchase": { fr: "Achat", en: "Purchase" },
  "senate.sale": { fr: "Vente", en: "Sale" },
  "senate.legal_delay": {
    fr: "Délai légal STOCK Act 2012 : les sénateurs ont 30 à 45 jours après une transaction pour la déclarer. Les transactions affichées sont par construction antérieures d'au moins ~30 jours.",
    en: "STOCK Act 2012 legal delay: senators have 30 to 45 days after a transaction to disclose it. Transactions shown are by design at least ~30 days old.",
  },
  "senate.tooltip_body": {
    fr: "Transactions déclarées par les sénateurs américains sous le STOCK Act 2012 (déclaration obligatoire sous 45 jours pour toute opération > 1 000 $).",
    en: "Transactions disclosed by US senators under the STOCK Act 2012 (mandatory disclosure within 45 days for any trade > $1,000).",
  },
  "senate.tooltip_alpha": {
    fr: "Signal investisseur historique : les achats sénatoriaux sur un ticker précèdent souvent un mouvement haussier (alpha de ~6-12 % vs S&P sur 12 mois selon plusieurs études).",
    en: "Historical investor signal: senatorial purchases on a ticker often precede an upward move (~6-12% alpha vs S&P over 12 months according to several studies).",
  },
  "senate.source_line": {
    fr: "Source : Senate Stock Watcher / Capitol Trades.",
    en: "Source: Senate Stock Watcher / Capitol Trades.",
  },
  "senate.subtitle": {
    fr: "Largeur de chaque carte = ordre de grandeur du montant. Couleur du bord = parti.",
    en: "Card width = order of magnitude of the amount. Border color = party.",
  },
  "senate.signal_label": { fr: "Signal", en: "Signal" },
  "senate.bullish_explainer": {
    fr: "Les sénateurs achètent nettement plus qu'ils ne vendent.",
    en: "Senators are buying significantly more than they are selling.",
  },
  "senate.bearish_explainer": {
    fr: "Les sénateurs vendent nettement plus qu'ils n'achètent.",
    en: "Senators are selling significantly more than they are buying.",
  },
  "senate.neutral_explainer": { fr: "Achats et ventes équilibrés.", en: "Buys and sells are balanced." },
  "senate.buy_one": { fr: "achat", en: "buy" },
  "senate.buy_many": { fr: "achats", en: "buys" },
  "senate.sell_one": { fr: "vente", en: "sell" },
  "senate.sell_many": { fr: "ventes", en: "sells" },
  "senate.tx_visible": { fr: "transactions visibles.", en: "visible transactions." },
  "senate.party.R": { fr: "Républicain", en: "Republican" },
  "senate.party.D": { fr: "Démocrate", en: "Democrat" },
  "senate.party.I": { fr: "Indépendant", en: "Independent" },
  "senate.relative.today": { fr: "aujourd'hui", en: "today" },
  "senate.relative.yesterday": { fr: "hier", en: "yesterday" },
  "senate.relative.days_ago": { fr: "il y a {n} jours", en: "{n} days ago" },
  "senate.relative.month_ago": { fr: "il y a 1 mois", en: "1 month ago" },
  "senate.relative.months_ago": { fr: "il y a {n} mois", en: "{n} months ago" },
  "senate.relative.year_ago": { fr: "il y a 1 an", en: "1 year ago" },
  "senate.relative.years_ago": { fr: "il y a {n} ans", en: "{n} years ago" },
  "senate.declared_within": { fr: "déclaré sous {n} j", en: "filed within {n}d" },
  "senate.late_filing": { fr: "late filing", en: "late filing" },

  // Page de maintenance / pré-lancement (page fixe, no action).
  // Ton positif "on se fait beau" : donne envie sans donner d'info.
  "maintenance.headline": {
    fr: "On se fait beaux.",
    en: "We're getting dressed up.",
  },
  "maintenance.subhead": {
    fr: "Quelque chose de précieux pour les investisseurs se prépare ici. À très vite.",
    en: "Something precious for investors is taking shape here. See you very soon.",
  },
  "maintenance.fun_caption": {
    fr: "Mettrik AI · KPI Intelligence",
    en: "Mettrik AI · KPI Intelligence",
  },

  // === TTM (Trailing Twelve Months) ============================
  "ttm.label": { fr: "TTM", en: "TTM" },
  "ttm.tooltip_title": {
    fr: "TTM, c'est quoi ?",
    en: "What is TTM?",
  },
  "ttm.tooltip_body": {
    fr: "TTM signifie Trailing Twelve Months : les 12 derniers mois publiés. C'est la somme des 4 derniers trimestres connus, peu importe quand l'année calendaire commence. Ça permet de voir la tendance la plus récente sans attendre la clôture annuelle. La barre TTM est en pointillé pour la distinguer des années calendaires.",
    en: "TTM means Trailing Twelve Months: the most recent 12 months published. It's the sum of the last 4 known quarters, regardless of when the calendar year begins. It shows the latest trend without waiting for the annual close. The TTM bar is dashed to distinguish it from calendar years.",
  },

  // === Time fraction toggle (sec/min/h/j/sem/mois/an) ===========
  "timefrac.label": { fr: "Voir la valeur par :", en: "Show value per:" },
  "timefrac.year": { fr: "an", en: "year" },
  "timefrac.month": { fr: "mois", en: "month" },
  "timefrac.week": { fr: "semaine", en: "week" },
  "timefrac.day": { fr: "jour", en: "day" },
  "timefrac.hour": { fr: "heure", en: "hour" },
  "timefrac.minute": { fr: "minute", en: "minute" },
  "timefrac.second": { fr: "seconde", en: "second" },
  "timefrac.tooltip": {
    fr: "Affiche la valeur divisée par fraction de temps. Utile pour voir « combien gagne cette société par seconde ? ». Calcul simple : valeur annuelle ÷ nombre de fractions dans une année (365 jours, 8 760 heures, etc.).",
    en: "Shows the value divided by time fraction. Useful to see 'how much does this company earn per second?'. Simple math: yearly value ÷ number of fractions in a year (365 days, 8,760 hours, etc.).",
  },

  // === Parrainage / Referral ====================================
  "referral.title": { fr: "Parrainez un proche", en: "Invite a friend" },
  "referral.subtitle": {
    fr: "Vous parrainez. Votre filleul s'abonne. Vous gagnez tous les deux 1 mois offert du plan Premium.",
    en: "You refer. Your friend subscribes. You both get 1 month free of the Premium plan.",
  },
  "referral.cta_generate": { fr: "Générer mon code de parrainage", en: "Generate my invite code" },
  "referral.cta_copy": { fr: "Copier le lien", en: "Copy the link" },
  "referral.cta_copied": { fr: "Lien copié ✓", en: "Link copied ✓" },
  "referral.your_code": { fr: "Votre code", en: "Your code" },
  "referral.your_link": { fr: "Votre lien à partager", en: "Your link to share" },
  "referral.signin_required": {
    fr: "Connectez-vous pour générer votre code de parrainage.",
    en: "Sign in to generate your invite code.",
  },
  "referral.paid_required": {
    fr: "Le parrainage est réservé aux abonnés Premium actifs. Souscrivez d'abord pour pouvoir parrainer.",
    en: "Referral is for active Premium subscribers only. Subscribe first to start referring.",
  },
  "referral.history_title": { fr: "Vos parrainages", en: "Your referrals" },
  "referral.history_empty": { fr: "Aucun parrainage pour l'instant.", en: "No referrals yet." },
  "referral.status_pending": { fr: "En attente", en: "Pending" },
  "referral.status_signed_up": { fr: "Filleul inscrit", en: "Friend signed up" },
  "referral.status_subscribed": { fr: "Filleul abonné", en: "Friend subscribed" },
  "referral.status_rewarded": { fr: "Récompense versée", en: "Reward applied" },
  "referral.status_expired": { fr: "Expiré", en: "Expired" },
  "referral.status_invalid": { fr: "Invalide", en: "Invalid" },
  "referral.expires_in": { fr: "Expire le", en: "Expires on" },
  "referral.how_it_works": { fr: "Comment ça marche", en: "How it works" },
  "referral.step1": {
    fr: "Inscrivez-vous et souscrivez à un plan Premium (mensuel ou annuel).",
    en: "Sign up and subscribe to any Premium plan (monthly or annual).",
  },
  "referral.step2": {
    fr: "Sur cette page, cliquez « Générer mon code » et partagez le lien obtenu à un proche.",
    en: "On this page, click \"Generate my code\" and share the link with a friend.",
  },
  "referral.step3": {
    fr: "Quand votre filleul s'abonne à un plan payant, vous recevez tous les deux 1 mois offert du plan Premium (peu importe le plan choisi).",
    en: "When your friend subscribes to any paid plan, you both receive 1 month free of the Premium plan (any plan they choose).",
  },
  "referral.code_invalid": { fr: "Code de parrainage invalide ou expiré.", en: "Invalid or expired invite code." },
  "referral.code_valid_invited_by": { fr: "Vous avez été invité par", en: "You were invited by" },
  "referral.disabled": {
    fr: "Le programme de parrainage est temporairement suspendu. Revenez bientôt.",
    en: "The referral program is temporarily on hold. Check back soon.",
  },

  // === Contact form ============================================
  "contact.title": { fr: "Une question ? On répond.", en: "A question? We answer." },
  "contact.subtitle": {
    fr: "Vous parlez à des humains, pas à un robot. Un email, une réponse sous 48h ouvrées.",
    en: "You're talking to humans, not bots. One email, one reply within 48 business hours.",
  },
  "contact.recipient_label": { fr: "Type de demande", en: "Request type" },
  "contact.recipient_contact": { fr: "Contact général (commercial, presse, partenariat)", en: "General contact (sales, press, partnership)" },
  "contact.recipient_support": { fr: "Support technique (bug, problème de compte)", en: "Technical support (bug, account issue)" },
  "contact.name_label": { fr: "Votre nom", en: "Your name" },
  "contact.name_placeholder": { fr: "Marie Dupont", en: "Jane Doe" },
  "contact.email_label": { fr: "Votre email", en: "Your email" },
  "contact.email_placeholder": { fr: "marie@exemple.com", en: "jane@example.com" },
  "contact.subject_label": { fr: "Sujet", en: "Subject" },
  "contact.subject_placeholder": { fr: "Quel est le sujet de votre message ?", en: "What's your message about?" },
  "contact.body_label": { fr: "Votre message", en: "Your message" },
  "contact.body_placeholder": { fr: "Écrivez ici. Soyez aussi clair que possible, on lira chaque mot.", en: "Write here. Be as clear as possible, we'll read every word." },
  "contact.submit": { fr: "Envoyer", en: "Send" },
  "contact.sending": { fr: "Envoi…", en: "Sending…" },
  "contact.success_title": { fr: "Message reçu ✓", en: "Message received ✓" },
  "contact.success_body": {
    fr: "On vous répond dans les 48h. Pour aller plus vite : précisez votre besoin dès le sujet.",
    en: "We'll get back within 48h. Pro tip: a clear subject = faster reply.",
  },
  "contact.error": { fr: "Une erreur est survenue. Réessayez ou écrivez à contact@mettrik.ai.", en: "Something went wrong. Try again or email contact@mettrik.ai." },
  "contact.privacy_note": {
    fr: "On garde votre email uniquement pour vous répondre. Aucun marketing, aucune revente.",
    en: "We keep your email only to reply. No marketing, no resale.",
  },
  "senate.demo_footer": {
    fr: "Données démo : branchement live API Senate Stock Watcher / Capitol Trades en V1.5",
    en: "Demo data: live wiring to Senate Stock Watcher / Capitol Trades API in V1.5",
  },

  /* ──────────────────────── ACCOUNT ──────────────────────── */
  "account.title": { fr: "Mon compte", en: "My account" },
  "account.subtitle": {
    fr: "Gère ton profil, ta sécurité et tes favoris.",
    en: "Manage your profile, security and favorites.",
  },
  "account.favorites": { fr: "Mes favoris", en: "My favorites" },
  "account.favorites_sub": { fr: "Sociétés & KPIs suivis", en: "Followed companies & KPIs" },
  "account.signout": { fr: "Déconnexion", en: "Sign out" },
  "account.signout_sub": { fr: "Fermer cette session", en: "End this session" },
  "account.password.title": { fr: "Mot de passe", en: "Password" },
  "account.password.current": { fr: "Mot de passe actuel", en: "Current password" },
  "account.password.new": { fr: "Nouveau mot de passe", en: "New password" },
  "account.password.confirm": { fr: "Confirme le nouveau mot de passe", en: "Confirm new password" },
  "account.password.update": { fr: "Mettre à jour le mot de passe", en: "Update password" },
  "account.email.title": { fr: "Adresse email", en: "Email address" },
  "account.email.send_link": { fr: "Envoyer le lien de confirmation", en: "Send confirmation link" },
  "account.delete.title": { fr: "Supprimer mon compte", en: "Delete my account" },
  "account.delete.warning": {
    fr: "Action irréversible. Toutes tes données (favoris compris) sont effacées immédiatement.",
    en: "Irreversible action. All your data (including favorites) is wiped immediately.",
  },
  "account.delete.confirm_label": {
    fr: "Tape SUPPRIMER pour confirmer",
    en: "Type DELETE to confirm",
  },
  "account.delete.button": { fr: "Supprimer définitivement", en: "Delete permanently" },
  "account.member_since_prefix": {
    fr: "Connexion",
    en: "Sign-in via",
  },
  "account.member_since_middle": {
    fr: "· membre depuis",
    en: "· member since",
  },
  "account.password.subtitle_oauth": {
    fr: "Tu te connectes via Google. Tu peux définir un mot de passe Mettrik en utilisant « Mot de passe oublié » sur la page de connexion.",
    en: "You sign in via Google. You can set a Mettrik password using \"Forgot password\" on the sign-in page.",
  },
  "account.password.subtitle": {
    fr: "Au moins 8 caractères. Choisis-en un que tu n'utilises nulle part ailleurs.",
    en: "At least 8 characters. Pick one you don't use anywhere else.",
  },
  "account.email.subtitle": {
    fr: "Un lien de confirmation est envoyé à la nouvelle adresse pour valider le changement.",
    en: "A confirmation link is sent to the new address to validate the change.",
  },
  "account.email.new_label": { fr: "Nouvelle adresse email", en: "New email address" },

  /* Section nav (dock spy) */
  "nav.kpi_principal": { fr: "KPI principal", en: "Lead KPI" },
  "nav.kpi_table": { fr: "Tableau des KPI", en: "KPI table" },
  "nav.market_position": { fr: "Position marché · TAM", en: "Market position · TAM" },
  "nav.risks": { fr: "Facteurs de risque", en: "Risk factors" },
  "nav.governance": { fr: "Gouvernance & rémunération", en: "Governance & comp" },
  "nav.ai": { fr: "Positionnement IA", en: "AI positioning" },
  "nav.senate": { fr: "Trades du Sénat US", en: "US Senate trades" },
  "nav.super_kpi": { fr: "Super-KPI Mettrik", en: "Mettrik Super-KPIs" },

  /* Common UI */
  "ui.more_info": { fr: "Plus d'info", en: "More info" },

  /* Cmd+F find on page */
  "cmdf.placeholder": {
    fr: "Rechercher dans la page…",
    en: "Find on page…",
  },
  "cmdf.next": { fr: "Suivant", en: "Next" },
  "cmdf.prev": { fr: "Précédent", en: "Previous" },
  "cmdf.close": { fr: "Fermer", en: "Close" },

  /* ──────────────────────── COMMON ──────────────────────── */
  "common.loading": { fr: "Chargement…", en: "Loading…" },
  "common.back": { fr: "Retour", en: "Back" },
  "nav.home": { fr: "Accueil", en: "Home" },
  "common.close": { fr: "Fermer", en: "Close" },
  "common.cancel": { fr: "Annuler", en: "Cancel" },
  "common.confirm": { fr: "Confirmer", en: "Confirm" },
  "common.copy": { fr: "Copier", en: "Copy" },
  "common.copied": { fr: "Copié", en: "Copied" },
  "common.error_generic": {
    fr: "Une erreur est survenue. Réessaie.",
    en: "Something went wrong. Try again.",
  },

  /* ──────────────────────── LANGUAGE SWITCHER ──────────────────────── */
  "lang.fr_label": { fr: "Français", en: "French" },
  "lang.en_label": { fr: "Anglais", en: "English" },
  "lang.switch_label": { fr: "Changer de langue", en: "Switch language" },
};

/**
 * Récupère une string traduite. Si la clé n'existe pas → retourne la
 * clé elle-même (utile pour repérer les clés manquantes en dev).
 */
// Import des traductions complémentaires (DE/NL/SV/DA top ~50 clés).
// Marche en cascade : si la clé existe dans EXTRA_LOCALES pour la locale demandée,
// on l'utilise ; sinon fallback EN.
import { EXTRA_LOCALES } from "./dictionary-extra-locales";

export function translate(key: string, locale: Locale): string {
  const entry = DICTIONARY[key];
  if (!entry) return key;
  // Lookup avec fallback en cascade :
  //   1. EXTRA_LOCALES[key][locale] (DE/NL/SV/DA traductions ajoutées au runtime)
  //   2. locale exacte dans entry (fr, en, ou variante)
  //   3. base locale (de-CH -> de, en-GB -> en)
  //   4. en (default international)
  //   5. fr (legacy / dernière chance)
  const extra = EXTRA_LOCALES[key];
  if (extra && (extra as Record<string, string | undefined>)[locale]) {
    return (extra as Record<string, string>)[locale]!;
  }
  const e = entry as Record<string, string | undefined>;
  if (e[locale]) return e[locale]!;
  // base : "de-CH" -> "de"
  const base = locale.split("-")[0];
  if (extra && (extra as Record<string, string | undefined>)[base]) {
    return (extra as Record<string, string>)[base]!;
  }
  if (e[base]) return e[base]!;
  return e.en ?? e.fr ?? key;
}
