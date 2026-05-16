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
    fr: "À seulement 1 clic découvrir les KPI clés et Super KPI exclusifs des plus grandes sociétés américaines et européennes…",
    en: "3 clicks to the key KPIs and exclusive Super KPIs of the largest US and European companies.",
  },
  "brand.kpi_intelligence_under": {
    fr: "L'application de KPI de sociétés la plus puissante au monde, tout simplement.",
    en: "",
  },
  // Format strict (Yann 10 mai 2026, refacto Opus) : "part1 | part2".
  // Le composant RotatingPunchline split sur ' | ', rend part1 (question /
  // locuteur 1) en blanc-60 italique, et part2 (réponse / locuteur 2) en
  // gradient violet→cyan en gras pour la mettre en avant. Saut de ligne
  // logique avec une flèche cyan ↳ entre les deux parties.
  "home.punchline.1": {
    fr: "*Conseiller bancaire sérieux* 👨‍💼 : « Vous n'avez rien de plus que les autres pour battre le marché. » | *Moi confiant* : Moi seul non. *Moi + Mettrik AI*, si.",
    en: "",
  },
  "home.punchline.2": {
    fr: "*Conseiller bancaire sérieux* 👨‍💼 : « Vous n'arriverez pas à battre le marché. » | *Moi confiant* : Sans information, non. Avec *Mettrik AI*, si.",
    en: "",
  },
  "home.punchline.3": {
    fr: "📚 *Question* : Comment avoir un avantage compétitif sur vos collègues à la machine à café ? | *Réponse* : Utiliser *Mettrik AI*. 🤷🏼‍♂️",
    en: "",
  },
  "home.punchline.4": {
    fr: "👦 *Le fils* : Dis Papa, comment t'as eu et gardé un avantage compétitif par rapport aux autres ? | 👨 *Le père* : J'utilise *Mettrik AI* mon fils, tout simplement.",
    en: "",
  },
  "brand.data_updated": {
    fr: "Données à jour au",
    en: "Data updated as of",
  },
  "brand.companies_available": {
    fr: "KPI = INDICATEUR",
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
  "auth.divider.magic_link": {
    fr: "connexion sans mot de passe",
    en: "passwordless sign-in",
  },
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
  "company.earning_pending": { fr: "Earning attendu", en: "Earnings pending" },
  "company.earning_pending_explainer": {
    fr: "La date d'earning prévue est passée mais les nouveaux chiffres ne sont pas encore intégrés sur le graphique. Mise à jour automatique dès que le 10-Q/10-K est disponible.",
    en: "The expected earnings date has passed but the new numbers are not yet integrated into the chart. Automatic update as soon as the 10-Q/10-K is available.",
  },
  "company.next_results": { fr: "Prochains résultats", en: "Next earnings" },
  "company.last_quarter": { fr: "Dernier trimestre couvert", en: "Latest quarter covered" },
  "company.last_data": { fr: "Dernière donnée", en: "Latest data point" },
  "company.fresh_explainer": {
    fr: "Le dernier point de donnée a moins de 4 mois : exercice fiscal le plus récent.",
    en: "Latest data point is less than 4 months old: most recent fiscal year.",
  },
  "company.recent_explainer": {
    fr: "Le dernier point de donnée a entre 4 et 18 mois. Toujours valide : le dernier exercice fiscal complet reste pertinent.",
    en: "Latest data point is 4 to 18 months old. Still valid: the last full fiscal year remains relevant.",
  },
  "company.stale_explainer": {
    fr: "Le dernier point de donnée a plus de 18 mois. La société a probablement publié un exercice plus récent : la donnée affichée n'est plus à jour.",
    en: "Latest data point is over 18 months old. The company has likely published a more recent fiscal year: data shown is outdated.",
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
  "company.period.locked": { fr: "Disponible en V2", en: "Available in V2" },

  "company.ipo_young.label": {
    fr: "IPO récente : {years} ans en bourse ({year})",
    en: "Recent IPO: {years} years public ({year})",
    de: "Junges Börsenlisting: {years} Jahre ({year})",
  },
  "company.ipo_young.tooltip_title": {
    fr: "Historique court",
    en: "Short history",
    de: "Kurze Historie",
  },
  "company.ipo_young.tooltip_body": {
    fr: "Société introduite en bourse depuis moins de 6 ans. CAGR 5 ans, comparaisons de pic et signaux long terme à interpréter avec précaution.",
    en: "Company has been public for less than 6 years. 5-year CAGR, peak comparisons and long-term signals should be read with caution.",
    de: "Unternehmen ist seit weniger als 6 Jahren börsennotiert. 5-Jahres-CAGR, Spitzenvergleiche und Langzeitsignale mit Vorsicht interpretieren.",
  },
  "company.ipo_mid.label": {
    fr: "IPO {year} : historique 10 ans incomplet",
    en: "IPO {year}: 10y history incomplete",
    de: "Börsengang {year}: 10-Jahres-Historie unvollständig",
  },
  "company.ipo_mid.tooltip_title": {
    fr: "Graph 10 ans tronqué",
    en: "10y chart capped",
    de: "10-Jahres-Chart begrenzt",
  },
  "company.ipo_mid.tooltip_body": {
    fr: "Société introduite en bourse il y a 6 à 10 ans. Le graph 10 ans démarre à l'IPO, pas avant. Comparaisons décennales partielles.",
    en: "IPO between 6 and 10 years ago. The 10y chart starts at IPO, not before. Decade comparisons are partial.",
    de: "Börsengang vor 6 bis 10 Jahren. Der 10-Jahres-Chart beginnt mit dem IPO. Dekaden-Vergleiche unvollständig.",
  },
  "company.ipo_old.label": {
    fr: "IPO {year} : historique 20 ans incomplet",
    en: "IPO {year}: 20y history incomplete",
    de: "Börsengang {year}: 20-Jahres-Historie unvollständig",
  },
  "company.ipo_old.tooltip_title": {
    fr: "Graph 20 ans tronqué",
    en: "20y chart capped",
    de: "20-Jahres-Chart begrenzt",
  },
  "company.ipo_old.tooltip_body": {
    fr: "Société introduite en bourse il y a 11 à 20 ans. Le graph 20 ans démarre à l'IPO. Comparaisons longues partielles.",
    en: "IPO between 11 and 20 years ago. The 20y chart starts at IPO. Long-term comparisons are partial.",
    de: "Börsengang vor 11 bis 20 Jahren. Der 20-Jahres-Chart beginnt mit dem IPO. Langfristvergleiche unvollständig.",
  },

  // Toggle Trimestriel / Annuel sur le hero chart (6 mai 2026).
  "graph.period.quarter": { fr: "Trimestriel", en: "Quarterly" },
  "graph.period.semester": { fr: "Semestriel", en: "Semester" },
  "graph.period.year": { fr: "Annuel", en: "Annual" },
  "graph.period.semester.tooltip": {
    fr: "Vue semestrielle (les sociétés EU ne reportent que 2 fois par an)",
    en: "Semester view (EU companies only report twice a year)",
  },
  "graph.period.quarter.tooltip": {
    fr: "Vue trimestrielle (par défaut)",
    en: "Quarterly view (default)",
  },
  "graph.period.year.tooltip": {
    fr: "Vue annuelle (avec barre TTM)",
    en: "Annual view (with TTM bar)",
  },
  "graph.period.quarter.unavailable": {
    fr: "Données trimestrielles non disponibles pour ce KPI",
    en: "Quarterly data not available for this KPI",
  },
  "graph.bars.2d.tooltip": { fr: "Style classique 2D plat", en: "Classic flat 2D style" },
  "graph.bars.3d.tooltip": {
    fr: "Style 3D isométrique (par défaut)",
    en: "Isometric 3D style (default)",
  },

  "company.compare.button": { fr: "Comparer", en: "Compare" },
  "company.compare.on": { fr: "Comparer sur", en: "Compare on" },
  "company.compare.empty": {
    fr: "Aucune société du panel ne publie un KPI comparable à",
    en: "No company in the panel publishes a KPI comparable to",
  },
  "company.compare.direct": { fr: "Direct", en: "Direct" },
  "company.compare.connex": { fr: "Connexe", en: "Related" },
  "company.save.button": { fr: "Enregistrer", en: "Save" },
  "company.kpi_table.title": { fr: "Indicateurs clés", en: "Key indicators", de: "Schlüsselindikatoren" },
  "company.kpi_table.subtitle": {
    fr: "Cliquez sur un indicateur pour le promouvoir en KPI principal.",
    en: "Click an indicator to promote it to the main KPI.",
  
    de: "Klicken Sie auf einen Indikator, um ihn zum wichtigsten KPI hochzustufen.",
  },
  "company.kpi_table.count_label": { fr: "indicateurs", en: "indicators", de: "Indikatoren" },
  "company.kpi_table.col_indicator": { fr: "Indicateur", en: "Indicator", de: "Indikator" },
  "company.kpi_table.col_value": { fr: "Valeur", en: "Value", de: "Wert" },
  "company.kpi_table.col_trend": { fr: "Tendance", en: "Trend", de: "Trend" },
  "company.kpi_table.col_quality": { fr: "Qualité · Signal", en: "Quality · Signal", de: "Qualität · Signal" },
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
  "hero.yoy": { fr: "(vs N-1)", en: "(YoY)" },
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
  "senate.tx_one": { fr: "transaction", en: "transaction" },
  "senate.tx_many": { fr: "transactions", en: "transactions" },
  "senate.show_more_prefix": { fr: "Voir", en: "Show" },
  "senate.show_less": { fr: "Replier", en: "Show less" },
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

  // Note langue sur formulaire contact : FR / EN / DE supportés.
  "contact.lang_notice": {
    fr: "Discussions traitées en français, anglais ou allemand.",
    en: "Discussions handled in French, English or German.",
    de: "Diskussionen auf Französisch, Englisch oder Deutsch.",
  },

  /* ──────────────────────── FAQ HOME ──────────────────────── */
  // FAQ home : 12 questions standards investisseur. Wording 100% original
  // Mettrik, écrit from scratch (4 mai 2026). Disclaimers cohérents avec CG.
  "faq.title": {
    fr: "Questions fréquentes",
    en: "Frequently asked questions",
  },
  "faq.subtitle": {
    fr: "Tout ce qui est utile à savoir avant de t'inscrire ou de t'abonner.",
    en: "What's useful to know before signing up or subscribing.",
  },
  "faq.q.what": {
    fr: "Concrètement, à quoi sert Mettrik AI ?",
    en: "What does Mettrik AI actually do?",
  },
  "faq.a.what": {
    fr: "Mettrik AI agrège, structure et présente les KPIs les plus utiles des grandes sociétés cotées : indicateurs métier propres à chaque sous-secteur, scores de qualité, signaux comparatifs entre pairs, gouvernance, risques, positionnement IA. L'objectif : faire gagner du temps à un investisseur qui veut une lecture chiffrée et lisible d'une société, sans avoir à parcourir 200 pages de rapport annuel.",
    en: "Mettrik AI aggregates, structures and surfaces the most useful KPIs of large listed companies: industry-specific operational metrics, quality scores, peer comparison signals, governance, risks, AI positioning. The goal: save time for an investor who wants a quantitative, readable view of a company without going through 200 pages of annual report.",
  },
  "faq.q.data_sources": {
    fr: "D'où viennent les données ?",
    en: "Where does the data come from?",
  },
  "faq.a.data_sources": {
    fr: "Exclusivement de sources publiques officielles : 10-K, 10-Q, 8-K, DEF 14A déposés auprès de la SEC pour les sociétés US, 20-F et rapports équivalents pour les FPI étrangères, communiqués de résultats, transcripts d'earnings calls. Aucune source privée, aucun deal d'exclusivité avec une banque ou un broker. Tu peux toujours retrouver la source primaire toi-même via SEC EDGAR ou la page investisseurs de la société.",
    en: "Exclusively public official sources: 10-K, 10-Q, 8-K, DEF 14A filings with the SEC for US companies, 20-F and equivalent reports for foreign private issuers, earnings releases, earnings call transcripts. No private feeds, no exclusivity deals with banks or brokers. You can always trace any data point back to its primary source via SEC EDGAR or the company's investor relations page.",
  },
  "faq.q.freshness": {
    fr: "À quelle fréquence les KPIs sont-ils mis à jour ?",
    en: "How often are the KPIs updated?",
  },
  "faq.a.freshness": {
    fr: "À chaque publication officielle de la société : trimestriellement pour les 10-Q et résultats, annuellement pour les 10-K, ponctuellement pour les 8-K (événements matériels). Un indicateur de fraîcheur est affiché sur chaque KPI principal : vert si la donnée a moins de 4 mois, ambre entre 4 et 18 mois, rouge au-delà.",
    en: "On every official company filing: quarterly for 10-Qs and earnings, annually for 10-Ks, ad-hoc for 8-Ks (material events). A freshness indicator appears next to each lead KPI: green under 4 months, amber between 4 and 18 months, red beyond.",
  },
  "faq.q.advice": {
    fr: "Mettrik AI me dit quoi acheter ou vendre ?",
    en: "Does Mettrik AI tell me what to buy or sell?",
  },
  "faq.a.advice": {
    fr: "Non, jamais. Mettrik AI n'est pas un service de conseil en investissement au sens de l'article L. 541-1 du Code monétaire et financier. Tous les contenus présentés (KPIs, scores, classements, signaux comparatifs, interprétations, accroches marketing) sont publiés à titre purement informatif et n'ont pas vocation à orienter une décision d'achat, de vente ou de conservation d'un instrument financier. Toute décision d'investissement relève de ta seule responsabilité ou de celle de ton conseiller habilité.",
    en: "No, never. Mettrik AI is not an investment advisory service. All content shown (KPIs, scores, rankings, peer signals, interpretations, marketing copy) is published for informational purposes only and is not intended to guide a buy, sell or hold decision on any financial instrument. Every investment decision is your sole responsibility, or that of your licensed advisor.",
  },
  "faq.q.scores_trust": {
    fr: "Quel niveau de confiance accorder aux scores et classements ?",
    en: "How much should I trust the scores and rankings?",
  },
  "faq.a.scores_trust": {
    fr: "Les scores Mettrik AI sont des opinions éditoriales construites à partir d'une méthodologie quantitative documentée (poids des inputs, normalisation, fenêtres temporelles). Ils reflètent une analyse à un instant donné et peuvent évoluer à chaque nouvelle publication officielle. Ils ne sont jamais une note de crédit ni une recommandation, et ne remplacent pas la lecture de la documentation primaire pour une décision engageante.",
    en: "Mettrik AI scores are editorial opinions built from a documented quantitative methodology (input weights, normalization, time windows). They reflect an analysis at a given moment and may evolve with every new official filing. They are not a credit rating nor a recommendation, and do not replace reading primary documentation for any committing decision.",
  },
  "faq.q.coverage": {
    fr: "Quelles sociétés sont couvertes ?",
    en: "Which companies are covered?",
  },
  "faq.a.coverage": {
    fr: "À ce stade : les principales sociétés américaines cotées (S&P 500 + extension SP1500 en cours) et un échantillon européen et FPI étrangères. La couverture s'étend par vagues : nouvelles sociétés ajoutées dès que leur extraction et leur validation passent nos contrôles qualité (3 passes successives dont une revue par modèle premium).",
    en: "At this stage: the main listed US companies (S&P 500 plus an in-progress SP1500 extension) and a European and foreign private issuer sample. Coverage expands in waves: new companies are added once their extraction and validation pass our quality checks (three successive passes including a premium model review).",
  },
  "faq.q.free_or_paid": {
    fr: "Est-ce gratuit ou payant ?",
    en: "Is it free or paid?",
  },
  "faq.a.free_or_paid": {
    fr: "Une formule gratuite donne accès à un échantillon de sociétés de démonstration pour évaluer le service. Les formules payantes (Premium mensuel, Premium annuel, Enterprise/API) débloquent l'accès complet aux sociétés couvertes, la comparaison entre sociétés, les watchlists et les alertes. Les tarifs détaillés sont sur la page Tarifs.",
    en: "A free plan grants access to a demo company sample so you can evaluate the service. Paid plans (Premium monthly, Premium annual, Enterprise/API) unlock full access to covered companies, company comparison, watchlists and alerts. Detailed pricing is on the Pricing page.",
  },
  "faq.q.cancel": {
    fr: "Comment annuler mon abonnement ?",
    en: "How do I cancel my subscription?",
  },
  "faq.a.cancel": {
    fr: "Depuis ton espace personnel, en un clic. L'abonnement s'arrête à la fin de la période en cours déjà payée et ne se renouvelle pas. Aucune justification demandée, aucun délai imposé.",
    en: "From your account area, in one click. Your subscription stops at the end of the period already paid for and does not renew. No reason required, no waiting period imposed.",
  },
  "faq.q.delete": {
    fr: "Puis-je supprimer mon compte et mes données ?",
    en: "Can I delete my account and my data?",
  },
  "faq.a.delete": {
    fr: "Oui, à tout moment, depuis ton espace personnel. La suppression entraîne l'effacement de ton profil, de tes watchlists, de tes notes et de toute donnée personnelle associée, dans les délais prévus par le RGPD. Les factures émises sont conservées au titre des obligations comptables légales (10 ans).",
    en: "Yes, at any time, from your account area. Deletion erases your profile, watchlists, notes and any associated personal data within the time limits set by GDPR. Issued invoices are retained for legal accounting obligations (10 years).",
  },
  "faq.q.data_errors": {
    fr: "Que faire si je vois une erreur dans une donnée ?",
    en: "What if I spot an error in the data?",
  },
  "faq.a.data_errors": {
    fr: "Signale-le via le formulaire de contact. Les données affichées proviennent d'une chaîne d'extraction automatisée qui peut, malgré nos contrôles successifs, comporter des erreurs ponctuelles indépendantes de notre volonté (mauvaise lecture d'un PDF, ambiguïté d'un libellé, valeur manquante). Vérifie systématiquement toute donnée auprès de la source officielle citée avant de l'utiliser pour une décision engageante.",
    en: "Report it via the contact form. The data shown comes from an automated extraction chain that may, despite our successive controls, contain occasional errors beyond our control (PDF misread, label ambiguity, missing value). Always cross-check any data point against the cited official source before using it for a committing decision.",
  },
  "faq.q.personal_data": {
    fr: "Mes données personnelles sont-elles sécurisées ?",
    en: "Is my personal data secure?",
  },
  "faq.a.personal_data": {
    fr: "Oui. Authentification via Supabase, mots de passe stockés sous forme de hash, paiements traités exclusivement par Stripe (norme PCI-DSS, aucune donnée bancaire ne transite par nos serveurs), aucune revente de données à des tiers. Détail complet dans la politique de confidentialité.",
    en: "Yes. Authentication via Supabase, passwords stored as hashes, payments handled exclusively by Stripe (PCI-DSS compliant, no card data transits through our servers), no resale of data to third parties. Full details in the privacy policy.",
  },
  "faq.q.support": {
    fr: "Comment vous contacter ?",
    en: "How can I reach you?",
  },
  "faq.a.support": {
    fr: "Via le formulaire de la page contact. Les échanges sont traités en français ou en anglais uniquement. Délai de réponse moyen : 1 à 3 jours ouvrés.",
    en: "Via the form on the contact page. Exchanges are handled in French or English only. Average response time: 1 to 3 business days.",
  },
  "faq.disclaimer.title": {
    fr: "Rappel important :",
    en: "Important reminder:",
  },
  "faq.disclaimer.body": {
    fr: "Mettrik AI publie des analyses et des indicateurs à titre informatif uniquement. Aucun contenu du site (KPI, score, classement, signal, interprétation, accroche marketing, comparaison) ne constitue un conseil en investissement, une recommandation personnalisée ni une assertion de fait. Les données peuvent comporter des erreurs ou des décalages. Toute décision d'investissement engage uniquement son auteur.",
    en: "Mettrik AI publishes analyses and indicators for informational purposes only. No content on the site (KPI, score, ranking, signal, interpretation, marketing copy, comparison) constitutes investment advice, a personalized recommendation, or a statement of fact. Data may contain errors or delays. Any investment decision is the sole responsibility of its author.",
  },

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
  "timefrac.year": { fr: "A", en: "Y" },
  "timefrac.month": { fr: "M", en: "M" },
  "timefrac.week": { fr: "S", en: "W" },
  "timefrac.day": { fr: "J", en: "D" },
  "timefrac.hour": { fr: "H", en: "H" },
  "timefrac.minute": { fr: "m", en: "m" },
  "timefrac.second": { fr: "s", en: "S" },
  /* Transcript stories (last earning call) */
  "transcript.section_title": { fr: "Dernier earning call", en: "Last earnings call" },
  "transcript.section_subtitle": {
    fr: "Informations exclusives entre le top management et les investisseurs lors du dernier appel résultats.",
    en: "Exclusive insights from top management to investors during the latest earnings call.",
  },
  "transcript.quotes_title": { fr: "Citations management", en: "Management quotes" },
  "transcript.figures_title": { fr: "Chiffres & guidance", en: "Numbers & guidance" },
  "transcript.no_data": { fr: "Aucune citation extraite pour le moment.", en: "No quotes extracted yet." },
  "transcript.no_figures": { fr: "Aucun chiffre extrait pour le moment.", en: "No figures extracted yet." },
  "transcript.extraction_pending": {
    fr: "Extraction LLM en cours par le pipeline data.",
    en: "LLM extraction in progress via the data pipeline.",
  },
  "transcript.sentiment.bullish": { fr: "Confiant", en: "Bullish" },
  "transcript.sentiment.neutral": { fr: "Neutre", en: "Neutral" },
  "transcript.sentiment.cautious": { fr: "Prudent", en: "Cautious" },

  /* Transcript bullets block (Synthèse Earning Call) */
  "transcript.bullets.section_title": { fr: "Synthèse Earning Call", en: "Earnings Call Summary", de: "Zusammenfassung Earning Call" },
  "transcript.bullets.section_subtitle": {
    fr: "Points clés extraits du dernier transcript management × analystes",
    en: "Key takeaways extracted from the latest management × analysts transcript",
  
    de: "Wichtigste Punkte aus dem neuesten Management-Analysten-Transkript",
  },
  "transcript.bullets.comparison_title": {
    fr: "Suivi & comparaison vs trimestre précédent",
    en: "Tracking & comparison vs previous quarter",
  
    de: "Tracking & Vergleich ggü. vorherigem Quartal",
  },
  "transcript.bullets.comparison_subtitle": {
    fr: "Promesses tenues, écarts de guidance et changements de discours",
    en: "Promises kept, guidance gaps and discourse shifts",
  
    de: "Eingehaltene Versprechen, Guidance-Abweichungen und Diskurswechsel",
  },
  "transcript.bullets.earning_call_label": { fr: "Earning Call", en: "Earnings Call", de: "Earnings Call" },
  "transcript.bullets.earning_call_explainer": {
    fr: "Conférence téléphonique trimestrielle où la direction d'une société cotée commente ses résultats financiers face aux analystes. On y trouve : chiffres-clés, contexte, perspectives (guidance), réponses aux questions des analystes. C'est l'une des sources les plus riches pour anticiper la trajectoire de la sté.",
    en: "Quarterly conference call where the management of a listed company comments on its financial results to analysts. Includes: key figures, context, outlook (guidance), Q&A. One of the richest sources to anticipate the company's trajectory.",
  
    de: "Vierteljährliche Telefonkonferenz, bei der das Management eines börsennotierten Unternehmens seine Finanzergebnisse gegenüber Analysten erläutert. Sie enthält: Schlüsselzahlen, Kontext, Ausblick (Guidance), Antworten auf Fragen der Analysten. Sie ist eine der reichhaltigsten Quellen, um die Entwicklungsbahn des Unternehmens vorherzusehen.",
  },
  "transcript.bullets.earning_call_aria": { fr: "Qu'est-ce qu'un earning call ?", en: "What is an earnings call?", de: "Was ist ein Earnings Call?" },
  "transcript.bullets.compare.promise_kept": { fr: "Promesse tenue", en: "Promise kept", de: "Eingehaltenes Versprechen" },
  "transcript.bullets.compare.promise_broken": { fr: "Promesse non tenue", en: "Promise broken", de: "Uneingelöstes Versprechen" },
  "transcript.bullets.compare.guidance_up": { fr: "Guidance relevée", en: "Guidance raised", de: "Prognose angehoben" },
  "transcript.bullets.compare.guidance_down": { fr: "Guidance abaissée", en: "Guidance lowered", de: "Prognose gesenkt" },
  "transcript.bullets.compare.new_topic": { fr: "Nouveau sujet", en: "New topic", de: "Neues Thema" },
  "transcript.bullets.compare.sentiment_shift": { fr: "Changement de ton", en: "Tone shift", de: "Tonwechsel" },

  /* Suffix titre du graph "par X" en toutes lettres (fr/en) */
  "timefrac.suffix.year": { fr: "par an", en: "per year" },
  "timefrac.suffix.month": { fr: "par mois", en: "per month" },
  "timefrac.suffix.week": { fr: "par semaine", en: "per week" },
  "timefrac.suffix.day": { fr: "par jour", en: "per day" },
  "timefrac.suffix.hour": { fr: "par heure", en: "per hour" },
  "timefrac.suffix.minute": { fr: "par minute", en: "per minute" },
  "timefrac.suffix.second": { fr: "par seconde", en: "per second" },
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
  "contact.title": { fr: "Une question ? On répond.", en: "A question? We answer.", de: "Eine Frage? Wir antworten." },
  "contact.back_home": { fr: "Retour à l'accueil", en: "Back to home", de: "Zurück zur Startseite", nl: "Terug naar home", sv: "Tillbaka till start", da: "Tilbage til start", "en-GB": "Back to home", "de-CH": "Zurück zur Startseite" },
  "contact.subtitle": {
    fr: "Vous parlez à des humains, pas à un robot. Un email, une réponse sous 48h ouvrées.",
    en: "You're talking to humans, not bots. One email, one reply within 48 business hours.",
    de: "Du sprichst mit Menschen, nicht mit Bots. Eine E-Mail, eine Antwort innerhalb 48 Werktagsstunden.",
  },
  "contact.recipient_label": { fr: "Type de demande", en: "Request type", de: "Anfragetyp" },
  "contact.recipient_contact": { fr: "Contact général (commercial, presse, partenariat)", en: "General contact (sales, press, partnership)", de: "Allgemein (Vertrieb, Presse, Partnerschaft)" },
  "contact.recipient_support": { fr: "Support technique (bug, problème de compte)", en: "Technical support (bug, account issue)", de: "Technischer Support (Bug, Kontoproblem)" },
  "contact.name_label": { fr: "Votre nom", en: "Your name", de: "Dein Name" },
  "contact.name_placeholder": { fr: "Marie Dupont", en: "Jane Doe", de: "Max Mustermann" },
  "contact.email_label": { fr: "Votre email", en: "Your email", de: "Deine E-Mail" },
  "contact.email_placeholder": { fr: "marie@exemple.com", en: "jane@example.com", de: "max@beispiel.de" },
  "contact.subject_label": { fr: "Sujet", en: "Subject", de: "Betreff" },
  "contact.subject_placeholder": { fr: "Quel est le sujet de votre message ?", en: "What's your message about?", de: "Worum geht's in deiner Nachricht?" },
  "contact.body_label": { fr: "Votre message", en: "Your message", de: "Deine Nachricht" },
  "contact.body_placeholder": { fr: "Écrivez ici. Soyez aussi clair que possible, on lira chaque mot.", en: "Write here. Be as clear as possible, we'll read every word.", de: "Schreib hier. Sei so klar wie möglich, wir lesen jedes Wort." },
  "contact.submit": { fr: "Envoyer", en: "Send", de: "Senden" },
  "contact.sending": { fr: "Envoi…", en: "Sending…", de: "Senden…" },
  "contact.success_title": { fr: "Message reçu ✓", en: "Message received ✓", de: "Nachricht erhalten ✓" },
  "contact.success_body": {
    fr: "On vous répond dans les 48h. Pour aller plus vite : précisez votre besoin dès le sujet.",
    en: "We'll get back within 48h. Pro tip: a clear subject = faster reply.",
    de: "Antwort innerhalb 48 Std. Tipp: klarer Betreff = schnellere Antwort.",
  },
  "contact.error": { fr: "Une erreur est survenue. Réessayez ou écrivez à contact@mettrik.ai.", en: "Something went wrong. Try again or email contact@mettrik.ai.", de: "Ein Fehler ist aufgetreten. Versuche es erneut oder schreibe an contact@mettrik.ai." },
  "contact.privacy_note": {
    fr: "On garde votre email uniquement pour vous répondre. Aucune revente.",
    en: "We keep your email only to reply. No resale.",
    de: "Wir speichern deine E-Mail nur für die Antwort. Kein Weiterverkauf.",
  },
  "senate.demo_footer": {
    fr: "Données démo : branchement live API Senate Stock Watcher / Capitol Trades en V1.5",
    en: "Demo data: live wiring to Senate Stock Watcher / Capitol Trades API in V1.5",
  },

  /* ──────────────────────── PRICING ──────────────────────── */
  "pricing.eyebrow": {
    fr: "Tarifs simples, accès puissant",
    en: "Simple pricing, powerful access",
    de: "Einfache Tarife, starker Zugang",
  },
  "pricing.h1": {
    fr: "Le bon plan pour ta façon d'investir",
    en: "The right plan for the way you invest",
    de: "Der richtige Plan für deine Art zu investieren",
  },
  "pricing.intro": {
    fr: "Découvre Mettrik AI gratuitement avec des fonctionnalités et indicateurs jamais vu ailleurs, rien que ça.",
    en: "Discover Mettrik AI for free with features and indicators you won't find anywhere else.",
    de: "Entdecke Mettrik AI kostenlos mit Funktionen und Kennzahlen, die du nirgendwo sonst findest.",
  },
  "pricing.badge_refund": {
    fr: "30 jours satisfait ou remboursé",
    en: "30-day money-back guarantee",
    de: "30 Tage Geld-zurück-Garantie",
  },
  "pricing.badge_no_engagement": {
    fr: "Sans engagement, annulation en 1 clic",
    en: "No commitment, cancel in 1 click",
    de: "Keine Bindung, 1-Klick-Kündigung",
  },
  "pricing.badge_currencies": {
    fr: "Tarifs en 7 devises",
    en: "Pricing in 7 currencies",
    de: "Preise in 7 Währungen",
  },
  "pricing.compare_title": {
    fr: "Comparatif détaillé",
    en: "Detailed comparison",
    de: "Detaillierter Vergleich",
  },
  "pricing.compare_sub": {
    fr: "Toutes les fonctionnalités, en clair, pour décider sans surprise.",
    en: "Every feature, in plain words, so you decide with no surprises.",
    de: "Alle Funktionen, klar erklärt, damit du ohne Überraschungen entscheidest.",
  },
  "pricing.trust1_title": {
    fr: "Données vérifiées",
    en: "Verified data",
    de: "Geprüfte Daten",
  },
  "pricing.trust1_body": {
    fr: "Chaque chiffre vient des documents ou de communication officielles de la société, nous utilisons plus de 20 sources. Certains KPI majeurs n'étant plus communiqués publiquement par la société en 2026, utilisent des données externes sourcées permettant un calcul des données récentes du KPI. Les KPI non officiels calculés ayant un indice d'incertitude de plus de 5% ne sont pas visible sur mettrik.ai",
    en: "Every figure comes from official company documents or communications, we use more than 20 sources. Some major KPIs are no longer publicly disclosed by the company in 2026, so we rely on sourced external data to compute the most recent KPI values. Non-official computed KPIs with an uncertainty index above 5% are not displayed on mettrik.ai.",
    de: "Jede Zahl stammt aus offiziellen Dokumenten oder Mitteilungen des Unternehmens. Wir verwenden über 20 Quellen. Einige wichtige KPIs werden 2026 vom Unternehmen nicht mehr öffentlich kommuniziert. Wir nutzen daher gut belegte externe Daten zur Berechnung der aktuellen Werte. Berechnete nicht-offizielle KPIs mit einem Unsicherheitsindex über 5 % werden auf mettrik.ai nicht angezeigt.",
  },
  "pricing.trust2_title": {
    fr: "Pas de revente de tes données",
    en: "No selling of your data",
    de: "Kein Verkauf deiner Daten",
  },
  "pricing.trust2_body": {
    fr: "On ne vend ni ne loue tes données à des tiers. Pas de tracker publicitaire, pas de data broker.",
    en: "We do not sell or rent your data to third parties. No ad trackers, no data brokers.",
    de: "Wir verkaufen oder vermieten deine Daten nicht an Dritte. Keine Werbetracker, keine Datenhändler.",
  },
  "pricing.trust3_title": {
    fr: "Mises à jour automatiques après chaque earning",
    en: "Automatic updates after every earnings release",
    de: "Automatische Aktualisierungen nach jedem Earnings-Release",
  },
  "pricing.trust3_body": {
    fr: "Dès qu'une société publie ses résultats trimestriels, ses KPI sont rafraîchis sur Mettrik. Tu vois directement la nouvelle valeur, le YoY recalculé, et l'impact sur le score qualité. Aucune saisie manuelle de ta part.",
    en: "As soon as a company publishes its quarterly results, its KPIs are refreshed on Mettrik. You see the new value, the recalculated YoY, and the impact on the quality score. No manual entry on your end.",
    de: "Sobald ein Unternehmen seine Quartalszahlen veröffentlicht, werden die KPIs auf Mettrik aktualisiert. Du siehst direkt den neuen Wert, das neu berechnete YoY und die Auswirkung auf den Qualitätsscore. Keine manuelle Eingabe deinerseits.",
  },
  "pricing.faq_title": {
    fr: "Questions fréquentes",
    en: "Frequently asked questions",
    de: "Häufige Fragen",
  },
  "pricing.faq_q1": {
    fr: "Puis-je tester Mettrik AI sans payer ?",
    en: "Can I try Mettrik AI without paying?",
    de: "Kann ich Mettrik AI testen, ohne zu zahlen?",
  },
  "pricing.faq_a1": {
    fr: "Oui, le plan Découverte est gratuit à vie. Tu accèdes à l'intégralité de Google (GOOGL) et Meta (META) sans carte bancaire. C'est suffisant pour évaluer la profondeur de l'analyse avant de décider.",
    en: "Yes, the Discovery plan is free forever. You get full access to Google (GOOGL) and Meta (META) with no credit card. Enough to evaluate the depth before deciding.",
    de: "Ja, der Entdeckungs-Plan ist lebenslang kostenlos. Du bekommst vollen Zugang zu Google (GOOGL) und Meta (META) ohne Kreditkarte. Genug, um die Tiefe vor der Entscheidung zu prüfen.",
  },
  "pricing.faq_q2": {
    fr: "Comment annuler mon abonnement ?",
    en: "How do I cancel my subscription?",
    de: "Wie kündige ich mein Abonnement?",
  },
  "pricing.faq_a2": {
    fr: "Depuis ton compte (Mon profil > Facturation), un seul clic. Pas de pénalité, ton accès reste actif jusqu'à la fin de la période payée.",
    en: "From your account (My profile > Billing), one click. No penalty, your access stays active until the end of the paid period.",
    de: "Von deinem Konto (Mein Profil > Abrechnung), ein Klick. Keine Strafe, dein Zugang bleibt bis zum Ende der bezahlten Periode aktiv.",
  },
  "pricing.faq_q3": {
    fr: "Quelles sociétés sont couvertes en Premium et Max ?",
    en: "Which companies are covered in Premium and Max?",
    de: "Welche Unternehmen sind in Premium und Max abgedeckt?",
  },
  "pricing.faq_a3": {
    fr: "Bourses américaines : NYSE, NASDAQ (S&P 500, S&P MidCap 400, Nasdaq 100). Bourses européennes : Euronext Paris (CAC 40, SBF 120), Xetra (DAX), Bourse de Londres (FTSE 100), Borsa Italiana, BME Madrid, Euronext Amsterdam, SIX Suisse, Nasdaq Stockholm. Bourses asiatiques (en cours d'ajout) : Bourse de Tokyo (Japon), KRX (Corée), ASX (Australie), TWSE (Taïwan), SGX (Singapour). Le catalogue s'étoffe automatiquement chaque mois.",
    en: "US exchanges: NYSE, NASDAQ (S&P 500, S&P MidCap 400, Nasdaq 100). European exchanges: Euronext Paris (CAC 40, SBF 120), Xetra (DAX), London Stock Exchange (FTSE 100), Borsa Italiana, BME Madrid, Euronext Amsterdam, SIX Swiss, Nasdaq Stockholm. Asian exchanges (rolling out): Tokyo Stock Exchange (Japan), KRX (Korea), ASX (Australia), TWSE (Taiwan), SGX (Singapore). The catalog grows automatically every month.",
    de: "US-Börsen: NYSE, NASDAQ (S&P 500, S&P MidCap 400, Nasdaq 100). Europäische Börsen: Euronext Paris (CAC 40, SBF 120), Xetra (DAX), Londoner Börse (FTSE 100), Borsa Italiana, BME Madrid, Euronext Amsterdam, SIX Schweiz, Nasdaq Stockholm. Asiatische Börsen (im Aufbau): Tokioter Börse (Japan), KRX (Korea), ASX (Australien), TWSE (Taiwan), SGX (Singapur). Der Katalog wächst monatlich automatisch.",
  },
  "pricing.faq_q4": {
    fr: "Puis-je changer de plan plus tard ?",
    en: "Can I change my plan later?",
    de: "Kann ich später meinen Plan ändern?",
  },
  "pricing.faq_a4": {
    fr: "Oui, à tout moment. Si tu passes de Premium à Max, l'écart est facturé au prorata. Si tu downgrade, le changement prend effet à la prochaine échéance.",
    en: "Yes, anytime. Upgrading from Premium to Max is billed pro-rata. Downgrade takes effect at the next renewal.",
    de: "Ja, jederzeit. Beim Upgrade von Premium zu Max wird die Differenz anteilig berechnet. Downgrade greift zur nächsten Verlängerung.",
  },
  "pricing.cta_final_title": {
    fr: "Prêt à voir tes sociétés sous un autre angle ?",
    en: "Ready to see your companies from a new angle?",
    de: "Bereit, deine Unternehmen aus einer neuen Perspektive zu sehen?",
  },
  "pricing.cta_final_body": {
    fr: "Démarre en 30 secondes, sans carte bancaire. Tu pourras passer en Investisseur ou Pro+ quand tu seras prêt.",
    en: "Start in 30 seconds, no credit card. Upgrade to Investor or Pro+ whenever you're ready.",
    de: "Starte in 30 Sekunden, ohne Kreditkarte. Du kannst jederzeit zu Anleger oder Pro+ wechseln, wenn du bereit bist.",
  },
  "pricing.cta_final_btn": {
    fr: "Démarrer gratuitement",
    en: "Start for free",
    de: "Kostenlos starten",
  },
  "pricing.cta_final_email": {
    fr: "Une question ? On est là.",
    en: "Have a question? We're here.",
    de: "Eine Frage? Wir sind da.",
  },

  /* ──────── Pricing cards (strings hardcodés migrés 11 mai 2026) ──────── */
  "pricing.card.recommended": {
    fr: "Recommandé",
    en: "Recommended",
    de: "Empfohlen",
  },
  "pricing.unit.per_month": {
    fr: "/mois",
    en: "/month",
    de: "/Monat",
  },
  "pricing.unit.per_day": {
    fr: "/jour",
    en: "/day",
    de: "/Tag",
  },
  "pricing.card.billed_annually_prefix": {
    fr: "Soit",
    en: "i.e.",
    de: "Also",
  },
  "pricing.card.billed_annually_suffix": {
    fr: "facturés annuellement",
    en: "billed annually",
    de: "jährlich abgerechnet",
  },
  "pricing.card.no_engagement_short": {
    fr: "Sans engagement",
    en: "No commitment",
    de: "Keine Bindung",
  },
  "pricing.card.coffee_slogan_part1": {
    fr: "Soit moins que le prix d'un café,",
    en: "Less than the price of a coffee,",
    de: "Weniger als der Preis eines Kaffees,",
  },
  "pricing.card.coffee_slogan_part2": {
    fr: "mais bien mieux investi !",
    en: "but a much better investment!",
    de: "aber viel besser investiert!",
  },
  "pricing.card.currency_not_available": {
    fr: "Bientôt dispo dans cette devise",
    en: "Coming soon in this currency",
    de: "Bald in dieser Währung verfügbar",
  },
  "pricing.matrix.feature_col": {
    fr: "Fonctionnalité",
    en: "Feature",
    de: "Funktion",
  },
  "pricing.matrix.free": {
    fr: "Gratuit",
    en: "Free",
    de: "Kostenlos",
  },
  "pricing.matrix.billed_annually_short": {
    fr: "facturation annuelle",
    en: "annual billing",
    de: "jährliche Abrechnung",
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
  "nav.pricing": { fr: "Tarifs", en: "Pricing", de: "Preise", nl: "Tarieven", "en-GB": "Pricing", sv: "Priser", da: "Priser", "de-CH": "Tarife" },
  "nav.contact": { fr: "Contact", en: "Contact", de: "Kontakt", nl: "Contact", "en-GB": "Contact", sv: "Kontakt", da: "Kontakt", "de-CH": "Kontakt" },
  "nav.popular": { fr: "Populaires", en: "Popular", de: "Beliebt", nl: "Populair", "en-GB": "Popular", sv: "Populära", da: "Populære", "de-CH": "Beliebt" },
  // Bouton pagination home — ton léger multilingue (Yann 16 mai 2026 :
  // remplace "More ↓" jugé cheap, prefère phrase complète).
  "home.show_next_30": {
    fr: "Montre-moi les 30 suivantes",
    en: "Show me the next 30",
    de: "Zeig mir die nächsten 30",
    nl: "Toon me de volgende 30",
    "en-GB": "Show me the next 30",
    sv: "Visa mig nästa 30",
    da: "Vis mig de næste 30",
    "de-CH": "Zeig mir die nächsten 30",
  },
  // Section "actions populaires" intégrée sous le top 30 de la home.
  "home.popular.title": {
    fr: "Actions les plus populaires",
    en: "Most popular stocks",
    de: "Beliebteste Aktien",
    nl: "Populairste aandelen",
    "en-GB": "Most popular stocks",
    sv: "Populäraste aktier",
    da: "Mest populære aktier",
    "de-CH": "Beliebteste Aktien",
  },
  "home.popular.subtitle": {
    fr: "Top des actions les plus échangées par les investisseurs particuliers, par marché.",
    en: "Top stocks most actively traded by retail investors, by market.",
    de: "Top-Aktien, die von Privatanlegern am aktivsten gehandelt werden.",
    nl: "Top aandelen die door particuliere beleggers het meest worden verhandeld.",
    "en-GB": "Top stocks most actively traded by retail investors, by market.",
    sv: "Topp aktier som handlas mest aktivt av privatinvesterare.",
    da: "Top aktier mest aktivt handlet af private investorer.",
    "de-CH": "Top-Aktien, die von Privatanlegern am aktivsten gehandelt werden.",
  },
  "home.popular.see_all": {
    fr: "Voir tout le classement",
    en: "See full ranking",
    de: "Vollständige Rangliste",
    nl: "Volledige ranglijst",
    "en-GB": "See full ranking",
    sv: "Se hela rankingen",
    da: "Se hele rangeringen",
    "de-CH": "Vollständige Rangliste",
  },
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

  // Dividend block (Yann 15 mai 2026 — extraction via Task agent)
  "div.stories.title": {
    fr: "Politique de dividende",
    en: "Dividend policy",
    de: "Dividendenpolitik",
  },
  "div.stories.subtitle": {
    fr: "Trois angles pour visualiser le retour aux actionnaires : statut historique, simulateur de revenu, effet boule de neige sur la durée.",
    en: "Three angles to visualize shareholder returns: historical status, income simulator, long-run snowball effect.",
    de: "Drei Blickwinkel auf die Aktionärsrendite: historischer Status, Einkommensrechner, langfristiger Schneeballeffekt.",
  },
  "div.stories.prev": {
    fr: "Précédent",
    en: "Previous",
    de: "Zurück",
  },
  "div.stories.next": {
    fr: "Suivant",
    en: "Next",
    de: "Weiter",
  },
  "div.stories.pause": {
    fr: "Pause",
    en: "Pause",
    de: "Pause",
  },
  "div.stories.resume": {
    fr: "Reprendre",
    en: "Resume",
    de: "Fortsetzen",
  },
  "div.stories.go_to_slide": {
    fr: "Aller à la fenêtre {n}",
    en: "Go to slide {n}",
    de: "Zu Fenster {n} wechseln",
  },
  "div.aristocrat.badge": {
    fr: "Aristocrat",
    en: "Aristocrat",
    de: "Aristocrat",
  },
  "div.aristocrat.title": {
    fr: "Dividend Aristocrat",
    en: "Dividend Aristocrat",
    de: "Dividend Aristocrat",
  },
  "div.aristocrat.subtitle_since": {
    fr: "Hausse continue depuis {year}",
    en: "Uninterrupted increases since {year}",
    de: "Ununterbrochene Steigerungen seit {year}",
  },
  "div.aristocrat.streak_label": {
    fr: "années de hausse consécutive",
    en: "years of consecutive increases",
    de: "Jahre Dividendensteigerung in Folge",
  },
    "div.aristocrat.cagr_label": {
    fr: "CAGR du dividende",
    en: "Dividend CAGR",
    de: "CAGR der Dividende",
  },
  "div.aristocrat.cagr_per_year": {
    fr: "CAGR {value} % / an",
    en: "CAGR {value} % / year",
    de: "CAGR {value} % / Jahr",
  },
  "div.aristocrat.cagr_period": {
    fr: "(5 ans)",
    en: "(5 years)",
    de: "(5 Jahre)",
  },
  "div.aristocrat.dps_label": {
    fr: "DPS",
    en: "DPS",
    de: "DPS",
  },
  "div.aristocrat.cap_return_label": {
    fr: "Capital rendu",
    en: "Capital returned",
    de: "Zurückgeführtes Kapital",
  },
  "div.aristocrat.cap_return_detail": {
    fr: "div + rachats",
    en: "div + buybacks",
    de: "Dividende + Rückkäufe",
  },
  "div.aristocrat.payout_label": {
    fr: "Payout",
    en: "Payout",
    de: "Ausschüttung",
  },
  "div.aristocrat.payout_coverage": {
    fr: "couvert {value}×",
    en: "covered {value}×",
    de: "Deckung {value}×",
  },
  "div.aristocrat.signal_title": {
    fr: "Politique de retour aux actionnaires constante",
    en: "Consistent capital return policy",
    de: "Konstante Kapitalrückführungspolitik",
  },
  "div.aristocrat.signal_body": {
    fr: "Objectif management : plus de 50 % du free cash flow ME&T redistribué chaque année, marge de sécurité solide même en bas de cycle.",
    en: "Management target: more than 50 % of ME&T free cash flow returned every year, solid safety buffer even at cycle lows.",
    de: "Managementziel: mehr als 50 % des ME&T-Free-Cashflow werden jedes Jahr ausgeschüttet, robuste Sicherheitsmarge auch am Zyklustief.",
  },
  "div.calc.freq_day_long": {
    fr: "/ jour",
    en: "/ day",
    de: "/ Tag",
  },
  "div.calc.freq_week_long": {
    fr: "/ semaine",
    en: "/ week",
    de: "/ Woche",
  },
  "div.calc.freq_month_long": {
    fr: "/ mois",
    en: "/ month",
    de: "/ Monat",
  },
  "div.calc.freq_year_long": {
    fr: "/ an",
    en: "/ year",
    de: "/ Jahr",
  },
  "div.calc.freq_day_short": {
    fr: "j",
    en: "d",
    de: "T",
  },
  "div.calc.freq_week_short": {
    fr: "s",
    en: "w",
    de: "W",
  },
  "div.calc.freq_month_short": {
    fr: "m",
    en: "m",
    de: "M",
  },
  "div.calc.freq_year_short": {
    fr: "a",
    en: "y",
    de: "J",
  },
  "div.calc.badge_simulator": {
    fr: "Simulateur",
    en: "Simulator",
    de: "Simulator",
  },
  "div.calc.question_shares": {
    fr: "Combien d'actions {ticker} ?",
    en: "How many {ticker} shares?",
    de: "Wie viele {ticker}-Aktien?",
  },
  "div.calc.subtitle_regular_income": {
    fr: "Pour viser un revenu net régulier",
    en: "To target a regular net income",
    de: "Für ein regelmäßiges Nettoeinkommen",
  },
  "div.calc.currency_title": {
    fr: "Devise d'affichage (taux de change live)",
    en: "Display currency (live exchange rate)",
    de: "Anzeigewährung (Live-Wechselkurs)",
  },
  "div.calc.shares_to_hold": {
    fr: "actions à détenir",
    en: "shares to hold",
    de: "zu haltende Aktien",
  },
  "div.calc.capital_approx": {
    fr: "capital ≈",
    en: "capital ≈",
    de: "Kapital ≈",
  },
  "div.calc.target_income": {
    fr: "Revenu cible",
    en: "Target income",
    de: "Zieleinkommen",
  },
  "div.calc.taxation": {
    fr: "Imposition",
    en: "Taxation",
    de: "Besteuerung",
  },
  "div.calc.price_estimate": {
    fr: "Cours estimé ({sym})",
    en: "Estimated price ({sym})",
    de: "Geschätzter Kurs ({sym})",
  },
  "div.calc.gross_required": {
    fr: "Brut nécessaire :",
    en: "Gross required:",
    de: "Bruttobetrag nötig:",
  },
  "div.calc.per_year": {
    fr: "/ an",
    en: "/ year",
    de: "/ Jahr",
  },
  "div.calc.disclaimer": {
    fr: "Cours et dividende dans la devise affichée. Taux change ECB live. Calcul indicatif sans frais ni croissance future du dividende.",
    en: "Price and dividend in the displayed currency. Live ECB exchange rate. Indicative calculation, excluding fees and future dividend growth.",
    de: "Kurs und Dividende in der angezeigten Währung. Live-EZB-Wechselkurs. Richtwertberechnung, ohne Gebühren und ohne künftiges Dividendenwachstum.",
  },
  "div.snowball.badge": {
    fr: "Boule de neige",
    en: "Snowball",
    de: "Schneeball",
  },
  "div.snowball.title": {
    fr: "Réinvestir tes dividendes (DRIP)",
    en: "Reinvest your dividends (DRIP)",
    de: "Dividenden reinvestieren (DRIP)",
  },
  "div.snowball.subtitle_years": {
    fr: "Effet boule de neige sur {years} ans",
    en: "Snowball effect over {years} years",
    de: "Schneeballeffekt über {years} Jahre",
  },
  "div.snowball.income_term": {
    fr: "de revenu à terme",
    en: "of income at term",
    de: "Einkommen am Ende",
  },
  "div.snowball.initial_stake": {
    fr: "Mise initiale",
    en: "Initial stake",
    de: "Anfangseinsatz",
  },
  "div.snowball.duration": {
    fr: "Durée",
    en: "Duration",
    de: "Laufzeit",
  },
  "div.snowball.duration_years": {
    fr: "{years} ans",
    en: "{years} yrs",
    de: "{years} J.",
  },
  "div.snowball.return": {
    fr: "Rendement",
    en: "Return",
    de: "Rendite",
  },
  "div.snowball.return_per_year": {
    fr: "{value}% / an",
    en: "{value}% / year",
    de: "{value}% / Jahr",
  },
  "div.snowball.disclaimer": {
    fr: "Hypothèse : tu réinvestis chaque dividende reçu. Le rendement combine yield + appréciation du cours, supposé stable. Indicatif.",
    en: "Assumption: every dividend received is reinvested. Return combines yield and price appreciation, assumed stable. Indicative.",
    de: "Annahme: jede erhaltene Dividende wird reinvestiert. Die Rendite kombiniert Dividendenrendite und Kursanstieg, als konstant unterstellt. Richtwert.",
  },

  // i18n batch UI (Yann 15 mai 2026 — Phase A1 snapshot + super-KPI + profile)
  "company.profile.section_title": {
    fr: "Comprendre la société",
    en: "About the company",
    de: "Unternehmen verstehen",
  },
  "company.profile.source": {
    fr: "Source : Mettrik AI",
    en: "Source: Mettrik AI",
    de: "Quelle: Mettrik AI",
  },
  "company.profile.desc_title": {
    fr: "Description Mettrik",
    en: "Mettrik Description",
    de: "Mettrik Beschreibung",
  },
  "company.profile.toggle_simple": {
    fr: "Simple",
    en: "Simple",
    de: "Einfach",
  },
  "company.profile.toggle_advanced": {
    fr: "Avancée",
    en: "Advanced",
    de: "Erweitert",
  },
  "company.profile.news_title": {
    fr: "Dernière actualité",
    en: "Latest news",
    de: "Aktuelle Nachrichten",
  },
  "company.snapshot.title": {
    fr: "Snapshot boursier",
    en: "Market snapshot",
    de: "Börsen-Snapshot",
  },
  "company.snapshot.market_cap": {
    fr: "Capitalisation",
    en: "Market cap",
    de: "Marktkapitalisierung",
  },
  "company.snapshot.pe_ttm": {
    fr: "P / E (TTM)",
    en: "P / E (TTM)",
    de: "P / E (TTM)",
  },
  "company.snapshot.eps_ttm": {
    fr: "EPS (TTM)",
    en: "EPS (TTM)",
    de: "EPS (TTM)",
  },
  "company.snapshot.beta": {
    fr: "Beta",
    en: "Beta",
    de: "Beta",
  },
  "company.snapshot.dividend": {
    fr: "Dividende",
    en: "Dividend",
    de: "Dividende",
  },
  "company.snapshot.day_change": {
    fr: "Variation jour",
    en: "Day change",
    de: "Tagesveränderung",
  },
  "company.snapshot.high_52w": {
    fr: "Plus-haut 52 sem.",
    en: "52w high",
    de: "52W-Hoch",
  },
  "company.snapshot.low_52w": {
    fr: "Plus-bas 52 sem.",
    en: "52w low",
    de: "52W-Tief",
  },
  "superkpi.title": {
    fr: "Super-KPI Mettrik",
    en: "Mettrik Super KPI",
    de: "Mettrik Super-KPI",
  },
  "superkpi.subtitle": {
    fr: "Combinaisons d'au moins 2 indicateurs bruts pour révéler des dimensions composites qu'aucun KPI seul ne capture. La majorité sont des standards adoptés par les pros de la finance ; le Mettrik Profit Power Index est une signature Mettrik propriétaire (clairement marquée).",
    en: "Combinations of at least 2 raw indicators to reveal composite dimensions no single KPI captures. Most are standards adopted by finance pros; the Mettrik Profit Power Index is a proprietary Mettrik signature (clearly marked).",
    de: "Kombinationen aus mindestens 2 Rohindikatoren, um zusammengesetzte Dimensionen aufzuzeigen, die kein einzelner KPI erfasst. Die meisten sind von Finanzprofis übernommene Standards; der Mettrik Profit Power Index ist eine proprietäre Mettrik-Signatur (deutlich gekennzeichnet).",
  },
  "superkpi.composite_signature": {
    fr: "Composite signature Mettrik",
    en: "Mettrik composite signature",
    de: "Mettrik-Composite-Signatur",
  },
  "superkpi.profit_power_index": {
    fr: "Mettrik Profit Power Index",
    en: "Mettrik Profit Power Index",
    de: "Mettrik Profit Power Index",
  },
  "superkpi.data_unavailable": {
    fr: "Données nécessaires non disponibles pour cette société.",
    en: "Required data not available for this company.",
    de: "Erforderliche Daten für dieses Unternehmen nicht verfügbar.",
  },
  "superkpi.suffix_specific": {
    fr: "spécifiques",
    en: "specific",
    de: "spezifisch",
  },
  "superkpi.kpi_rule_of_40": {
    fr: "Rule of 40",
    en: "Rule of 40",
    de: "Rule of 40",
  },
  "superkpi.kpi_marge": {
    fr: "Marge",
    en: "Margin",
    de: "Marge",
  },
  "superkpi.kpi_concentration": {
    fr: "Concentration",
    en: "Concentration",
    de: "Konzentration",
  },
  "superkpi.kpi_margin_trend": {
    fr: "Tendance marge YoY",
    en: "Margin trend YoY",
    de: "Margen-Trend YoY",
  },
  "superkpi.kpi_growth": {
    fr: "Croissance",
    en: "Growth",
    de: "Wachstum",
  },
  "superkpi.kpi_composite": {
    fr: "Composite",
    en: "Composite",
    de: "Composite",
  },
  "superkpi.kpi_quality_compounding": {
    fr: "Quality of Compounding",
    en: "Quality of Compounding",
    de: "Qualität der Compoundierung",
  },
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
