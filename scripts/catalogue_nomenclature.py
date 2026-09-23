#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Nomenclature du catalogue de comparabilite (Yann, 23 septembre 2026).

REGLE DE NOMMAGE, ECRITE NOIR SUR BLANC. Elle prime sur toute autre source.

R1. La cle est TOUJOURS fabriquee par le script. Aucune chaine rendue par un
    moteur n est ecrite telle quelle dans le catalogue. Un moteur ne fait que
    proposer un RATTACHEMENT a un concept deja present dans la table LEXIQUE
    ci-dessous ; il repond par un numero, jamais par un nom.
R2. Forme : minuscules, francais, accents conserves en forme NFC, mots separes
    par un tiret bas, aucun article ni preposition, huit mots au plus. La
    limite est passee de six a huit le 23 septembre 2026 : une zone dont le nom
    francais compte trois mots (amerique du nord) plus un prefixe et un suffixe
    depasse six sans qu aucun mot ne soit superflu.
R3. La cle nomme la mesure, puis le perimetre quand il n est pas le total :
    chiffre_affaires, chiffre_affaires_services, chiffre_affaires_europe.
R4. La nature de la mesure est portee par un suffixe obligatoire des que ce n
    est pas un montant : _pourcentage, _par_action, _nombre, _ratio, _jours,
    _points_de_base. Un montant n a pas de suffixe. Les mesures physiques
    (volumes, capacites, prix unitaires) n en ont pas non plus : leur unite est
    portee par la fiche.
R5. Deux libelles ne partagent une cle que si leur famille d unite concorde.
    Le controle est mecanique et se fait AVANT le moteur : un montant et un
    pourcentage ne sont jamais proposes ensemble.
R5bis. GARDE DES MODIFICATEURS, ajoutee le 23 septembre 2026 apres mesure.
    Un premier lot de cent decisions relu a la main a montre onze rattachements
    faux sur vingt et un : un moteur modeste ignore les mots qui changent le
    perimetre, la nature ou la periode (« acquired loans » range avec l encours
    de credits, « 12 month backlog » avec le carnet de commandes, « 5 year
    total shareholder return » avec la rentabilite totale de l actionnaire).
    Regle : un libelle n est propose au moteur pour un concept QUE si ses mots
    et ceux d un libelle deja rattache a ce concept sont les memes, aux mots
    neutres pres (MOTS_NEUTRES ci-dessous). Tout mot en plus ou en moins qui n
    est pas neutre interdit le rapprochement, sans appel au moteur. Le moteur
    ne sert donc qu a trancher entre des candidats deja juges compatibles.

R6. Un libelle de VENTILATION (une repartition, pas une mesure : « revenue by
    segment », « segment revenue », « revenue split by geography ») n entre
    jamais au catalogue : deux societes ne decoupent pas leurs segments de la
    meme facon, la valeur n est donc pas comparable.
R7. Un libelle sans rattachement sur n a pas d entree. Il garde alors son
    propre libelle comme cle, ce qui revient a ne pas le regrouper. Ne pas
    regrouper est sans risque ; regrouper a tort rend deux societes faussement
    comparables.
R9. QUALIFICATIFS DE PERIODE. « annual », « full year », « quarterly »,
    « half year », « reported », « at year end », « period end » et un
    « total » final ne changent ni la mesure ni son perimetre : la periode est
    portee ailleurs sur la fiche (period_type et history_periods) et l API de
    comparaison aligne les periodes elle meme. Le script tente donc la
    correspondance sur le libelle entier D ABORD, puis une seule fois sur le
    libelle prive de ces qualificatifs. L ordre compte : « annual recurring
    revenue » trouve sa cle entiere avant qu on ne songe a retirer « annual ».

R8. Une cle, une fois publiee, ne change plus de nom. Un concept nouveau
    s ajoute a la table ; il ne renomme jamais un concept existant.

Familles d unite (identiques a src/lib/compare-keys.ts) : money, pct,
per_share, count, ratio, days, bps, et « autre » pour les mesures physiques.
"""
import re
import unicodedata

SUFFIXES = {
    "pct": "_pourcentage",
    "per_share": "_par_action",
    "count": "_nombre",
    "ratio": "_ratio",
    "days": "_jours",
    "bps": "_points_de_base",
    "money": "",
    "autre": "",
}

# (motif sur le libelle normalise, cle canonique, famille d unite attendue)
# L ordre compte : le premier motif qui correspond gagne. Les motifs les plus
# precis sont donc places avant les plus generaux.
LEXIQUE = [
    # --- ventilations : jamais comparables (R6) -----------------------------
    (r"\bsegments?\b", "VENTILATION", None),
    (r"^(division|brand|reporting unit|product line|product category|business line|service line|sub segment) ", "VENTILATION", None),
    (r"\bby [a-z ]{0,24}\b(geography|geographic region|region|regions|country|countries|product|products|brand|brands|business|line|lines|market|markets|category|categories|class|classes|basin|basins|mine|mines|technology|type|types|channel|channels|payer|payer type|mode|division|divisions|customer|customers|franchise|activity|activities)$", "VENTILATION", None),
    (r"\b(by|per) (segment|segments|geography|geographic region|region|regions|country|countries|product|products|product line|product category|brand|brands|business|business line|business segment|business lines|end market|end markets|market|markets|service line|payer type|mode|division|channel|category|categories)\b", "VENTILATION", None),
    (r"\bsplit by\b|\bbreakdown\b|\bmix by\b|\bventilation\b", "VENTILATION", None),
    (r"^(revenue|revenues|sales|operating income|operating margin|gross margin|ebitda|adjusted ebitda|capital expenditures|net income|assets|backlog|depreciation and amortization|gross profit) and .* by \b", "VENTILATION", None),

    # --- compte de resultat, montants ---------------------------------------
    (r"^(net income attributable to (the )?(share ?holders|stock ?holders|parent|group)|net income group share|net (income|profit|earnings) attributable to the group)$", "résultat_net_part_du_groupe", "money"),
    (r"^adjusted net (income|profit|earnings)$", "résultat_net_ajusté", "money"),
    (r"^(net income|net profit|net earnings|net result|total net income)$", "résultat_net", "money"),
    (r"^(pre ?tax (income|profit|earnings)|income before (income )?taxes?|earnings before taxes?)$", "résultat_avant_impôt", "money"),
    (r"^adjusted (operating (income|profit)|ebit)$", "résultat_opérationnel_ajusté", "money"),
    (r"^(operating (income|profit|earnings)|ebit|income from operations)$", "résultat_opérationnel", "money"),
    (r"^adjusted ebitda$", "ebitda_ajusté", "money"),
    (r"^ebitda$", "ebitda", "money"),
    (r"^(gross profit|gross income)$", "bénéfice_brut", "money"),
    (r"^(quarterly |half year |annual |full year |total |net )*(revenues?|sales|net sales|total net sales|turnover|net revenues?)$", "chiffre_affaires", "money"),
    (r"^(other revenues?|other sales)$", "chiffre_affaires_autres", "money"),
    (r"^other income$", "autres_produits", "money"),

    # --- charges -------------------------------------------------------------
    (r"^(research and development|r and d)( expenses?| costs?)?$", "dépenses_recherche_développement", "money"),
    (r"^(selling general and administrative|sg and a)( expenses?| costs?)?$", "frais_commerciaux_administratifs", "money"),
    (r"^general and administrative( expenses?| costs?)?$", "frais_administratifs", "money"),
    (r"^(total )?operating (expenses?|costs?)$", "charges_exploitation", "money"),
    (r"^restructuring (charges?|costs?|expenses?)$", "charges_restructuration", "money"),
    (r"^(share|stock) based compensation$", "rémunération_en_actions", "money"),
    (r"^(depreciation and amortization|d and a)$", "dotations_amortissements", "money"),
    (r"^(income tax expense|tax expense|provision for income taxes)$", "charge_impôt", "money"),
    (r"^net interest expense$", "charges_intérêts_nettes", "money"),
    (r"^interest expense$", "charges_intérêts", "money"),
    (r"^(goodwill impairment|impairment of goodwill)$", "dépréciation_écarts_acquisition", "money"),
    (r"^asset impairment charges?$", "dépréciation_actifs", "money"),

    # --- flux de tresorerie et investissement --------------------------------
    (r"^(free cash flow|fcf)$", "flux_trésorerie_disponible", "money"),
    (r"^(operating cash flow|cash flow from operations|cash from operations|net cash (provided by|from) operating activities)$", "flux_trésorerie_exploitation", "money"),
    (r"^(funds from operations|ffo)$", "flux_trésorerie_opérationnels_foncière", "money"),
    (r"^(net (capital expenditures?|capex)|(capital expenditures?|capex) net)$", "investissements_nets", "money"),
    (r"^upstream (capital expenditures?|capex)$", "VENTILATION", None),
    (r"^(total )?(capital expenditures?|capex)$", "investissements", "money"),
    (r"^(acquisition (value|amount|price|purchase price|consideration)|cash paid for acquisitions)$", "montant_acquisitions", "money"),
    (r"^divestiture proceeds$", "produits_cessions", "money"),
    (r"^(bond issuance|senior notes issuance)$", "émissions_obligataires", "money"),
    (r"^revolving credit facility$", "ligne_crédit_renouvelable", "money"),

    # --- retour aux actionnaires ---------------------------------------------
    (r"^remaining (share repurchase|share buyback|stock repurchase)s? (authorization|program)$", "autorisation_rachat_actions_restante", "money"),
    (r"^cumulative (share repurchase|share buyback|stock repurchase)s? (authorization|program)$", "autorisation_rachat_actions_cumulée", "money"),
    (r"^(authorized )?(share repurchase|share buyback|stock repurchase)s? (authorization|program)$", "autorisation_rachat_actions", "money"),
    (r"^cumulative (share repurchases?|share buybacks?|stock repurchases?)$", "rachats_actions_cumulés", "money"),
    (r"^net (share repurchases?|share buybacks?|stock repurchases?)$", "rachats_actions_nets", "money"),
    (r"^(share repurchases?|share buybacks?|buybacks?|stock repurchases?)$", "rachats_actions", "money"),
    (r"^(total )?dividends? paid$", "dividendes_versés", "money"),
    (r"^capital returned to shareholders$", "capital_restitué_actionnaires", "money"),

    # --- bilan ---------------------------------------------------------------
    (r"^(total )?long ?term debt( net)?$", "dette_long_terme", "money"),
    (r"^net (financial )?debt$", "dette_nette", "money"),
    (r"^total debt$", "dette_totale", "money"),
    (r"^total assets$", "actif_total", "money"),
    (r"^(total )?(shareholders|stockholders) equity$", "capitaux_propres", "money"),
    (r"^total equity$", "capitaux_propres", "money"),
    (r"^(inventories|inventory)$", "stocks", "money"),
    (r"^goodwill$", "écarts_acquisition", "money"),
    (r"^cash and (cash )?equivalents$", "trésorerie", "money"),
    (r"^cash and short ?term investments$", "trésorerie_et_placements", "money"),
    (r"^net cash position$", "trésorerie_nette", "money"),
    (r"^accounts receivable( net)?$", "créances_clients", "money"),
    (r"^(net )?property plant and equipment( net)?$", "immobilisations_corporelles", "money"),
    (r"^deferred revenue$", "produits_constatés_avance", "money"),
    (r"^contract liabilities$", "passifs_contrat", "money"),
    (r"^contract assets$", "actifs_contrat", "money"),
    (r"^total investments$", "placements", "money"),

    # --- carnet, commandes, engagements --------------------------------------
    (r"^(order )?backlog$", "carnet_commandes", "money"),
    (r"^net new orders$", "prises_commandes_nettes", "money"),
    (r"^(order intake|orders|new orders)$", "prises_commandes", "money"),
    (r"^current (rpo|remaining performance obligations)$", "obligations_prestation_restantes_courantes", "money"),
    (r"^(remaining performance obligations|rpo)$", "obligations_prestation_restantes", "money"),
    (r"^(annual recurring revenue|arr)$", "revenus_récurrents_annuels", "money"),
    (r"^recurring revenue$", "revenus_récurrents", "money"),
    (r"^bookings$", "réservations", "money"),
    (r"^total addressable market$", "marché_adressable", "money"),

    # --- chiffre d affaires par nature ---------------------------------------
    (r"^aftermarket and services (revenues?|sales)$", "chiffre_affaires_après_vente_et_services", "money"),
    (r"^(services?|service and support) (revenues?|sales)$", "chiffre_affaires_services", "money"),
    (r"^professional services (revenues?|sales)$", "chiffre_affaires_services_professionnels", "money"),
    (r"^financial services (revenues?|sales)$", "chiffre_affaires_services_financiers", "money"),
    (r"^products? (revenues?|sales)$", "chiffre_affaires_produits", "money"),
    (r"^commercial product (revenues?|sales)$", "chiffre_affaires_produits_commerciaux", "money"),
    (r"^subscriptions? (revenues?|sales)$", "chiffre_affaires_abonnements", "money"),
    (r"^advertising (revenues?|sales)$", "chiffre_affaires_publicité", "money"),
    (r"^cloud (revenues?|sales)$", "chiffre_affaires_cloud", "money"),
    (r"^software (revenues?|sales)$", "chiffre_affaires_logiciels", "money"),
    (r"^equipment (revenues?|sales)$", "chiffre_affaires_équipements", "money"),
    (r"^consumables (revenues?|sales)$", "chiffre_affaires_consommables", "money"),
    (r"^rental (revenues?|income)$", "revenus_locatifs", "money"),
    (r"^trading markets? (revenues?|sales)$", "chiffre_affaires_activités_marché", "money"),

    # --- chiffre d affaires par zone -----------------------------------------
    (r"^(united states|u s|us) (revenues?|sales)$", "chiffre_affaires_états_unis", "money"),
    (r"^revenue in the united states$", "chiffre_affaires_états_unis", "money"),
    (r"^international (revenues?|sales)$", "chiffre_affaires_international", "money"),
    (r"^americas (revenues?|sales)$", "chiffre_affaires_amériques", "money"),
    (r"^north america (revenues?|sales)$", "chiffre_affaires_amérique_du_nord", "money"),
    (r"^latin america (revenues?|sales)$", "chiffre_affaires_amérique_latine", "money"),
    (r"^europe (revenues?|sales)$", "chiffre_affaires_europe", "money"),
    (r"^emea (revenues?|sales)$", "chiffre_affaires_emea", "money"),
    (r"^(asia pacific|apac) (revenues?|sales)$", "chiffre_affaires_asie_pacifique", "money"),
    (r"^asia (revenues?|sales)$", "chiffre_affaires_asie", "money"),
    (r"^china (revenues?|sales)$", "chiffre_affaires_chine", "money"),
    (r"^canada (revenues?|sales)$", "chiffre_affaires_canada", "money"),
    (r"^united kingdom (revenues?|sales)$", "chiffre_affaires_royaume_uni", "money"),
    (r"^other regions (revenues?|sales)$", "chiffre_affaires_autres_régions", "money"),
    (r"^rest of world (revenues?|sales)$", "chiffre_affaires_reste_du_monde", "money"),

    # --- banque ---------------------------------------------------------------
    (r"^net interest income$", "produit_net_intérêts", "money"),
    (r"^interest income$", "produits_intérêts", "money"),
    (r"^fee and commission income$", "produits_commissions", "money"),
    (r"^investment banking fees$", "commissions_banque_investissement", "money"),
    (r"^management fees$", "commissions_gestion", "money"),
    (r"^total deposits$", "dépôts", "money"),
    (r"^(total loans outstanding|loan receivables|total loans)$", "encours_crédits", "money"),
    (r"^provision for credit losses$", "provisions_pertes_crédit", "money"),
    (r"^cost of risk$", "coût_du_risque", "money"),
    (r"^net charge offs$", "pertes_nettes_crédit", "money"),
    (r"^(assets under management|aum)$", "actifs_sous_gestion", "money"),
    (r"^fee earning aum$", "actifs_sous_gestion_générateurs_commissions", "money"),
    (r"^client assets$", "actifs_clients", "money"),
    (r"^(net flows|net new assets)$", "collecte_nette", "money"),
    (r"^dry powder$", "capitaux_disponibles", "money"),
    (r"^credit card purchase volume$", "volume_achats_cartes", "money"),
    (r"^payment volume$", "volume_paiements", "money"),

    # --- assurance -----------------------------------------------------------
    (r"^net premiums written$", "primes_émises_nettes", "money"),
    (r"^gross premiums written$", "primes_émises_brutes", "money"),
    (r"^net premiums earned$", "primes_acquises_nettes", "money"),
    (r"^net investment income$", "produits_financiers_nets", "money"),
    (r"^underwriting income$", "résultat_technique", "money"),
    (r"^annualized premium equivalent$", "équivalent_primes_annualisé", "money"),
    (r"^prior year reserve development$", "boni_mali_réserves", "money"),

    # --- foncieres et services aux collectivites -----------------------------
    (r"^(net operating income|noi)$", "résultat_net_exploitation_immobilier", "money"),
    (r"^rate base$", "base_tarifaire", "money"),
    (r"^multi year capital( investment)? plan$", "plan_investissement_pluriannuel", "money"),

    # --- pourcentages --------------------------------------------------------
    (r"^(net margin|net profit margin)$", "marge_nette_pourcentage", "pct"),
    (r"^(adjusted|non gaap) operating margin$", "marge_opérationnelle_ajustée_pourcentage", "pct"),
    (r"^(operating margin|operating profit margin)$", "marge_opérationnelle_pourcentage", "pct"),
    (r"^adjusted gross margin$", "marge_brute_ajustée_pourcentage", "pct"),
    (r"^(total )?gross margin$", "marge_brute_pourcentage", "pct"),
    (r"^adjusted ebitda margin$", "marge_ebitda_ajustée_pourcentage", "pct"),
    (r"^ebitda margin$", "marge_ebitda_pourcentage", "pct"),
    (r"^pre ?tax margin$", "marge_avant_impôt_pourcentage", "pct"),
    (r"^free cash flow margin$", "marge_flux_trésorerie_disponible_pourcentage", "pct"),
    (r"^effective tax rate$", "taux_impôt_effectif_pourcentage", "pct"),
    (r"^organic (revenue |sales )?growth$", "croissance_organique_pourcentage", "pct"),
    (r"^(reported )?(revenue|sales) growth$", "croissance_chiffre_affaires_pourcentage", "pct"),
    (r"^volume growth$", "croissance_volumes_pourcentage", "pct"),
    (r"^(price growth|price mix|yield pricing)$", "effet_prix_pourcentage", "pct"),
    (r"^comparable (store |sales )?sales( growth)?$", "ventes_comparables_pourcentage", "pct"),
    (r"^same store sales( growth)?$", "ventes_comparables_pourcentage", "pct"),
    (r"^comparable restaurant sales( growth)?$", "ventes_comparables_restaurants_pourcentage", "pct"),
    (r"^same (store|property) noi growth$", "croissance_noi_périmètre_comparable_pourcentage", "pct"),
    (r"^same store revenue growth$", "croissance_chiffre_affaires_périmètre_comparable_pourcentage", "pct"),
    (r"^market share$", "part_de_marché_pourcentage", "pct"),
    (r"^physical occupancy( rate)?$", "taux_occupation_physique_pourcentage", "pct"),
    (r"^occupancy( rate)?$", "taux_occupation_pourcentage", "pct"),
    (r"^leased percentage$", "taux_location_pourcentage", "pct"),
    (r"^underlying combined ratio$", "ratio_combiné_sous_jacent_pourcentage", "pct"),
    (r"^combined ratio$", "ratio_combiné_pourcentage", "pct"),
    (r"^loss ratio$", "ratio_sinistralité_pourcentage", "pct"),
    (r"^medical loss ratio$", "ratio_sinistralité_santé_pourcentage", "pct"),
    (r"^expense ratio$", "ratio_frais_pourcentage", "pct"),
    (r"^cet1 ratio$", "ratio_cet1_pourcentage", "pct"),
    (r"^net interest margin$", "marge_intérêts_pourcentage", "pct"),
    (r"^efficiency ratio$", "coefficient_exploitation_pourcentage", "pct"),
    (r"^net charge off ratio$", "taux_pertes_crédit_pourcentage", "pct"),
    (r"^cost of deposits$", "coût_des_dépôts_pourcentage", "pct"),
    (r"^allowed roe$", "rentabilité_capitaux_propres_autorisée_pourcentage", "pct"),
    (r"^(return on equity|roe)$", "rentabilité_capitaux_propres_pourcentage", "pct"),
    (r"^return on tangible common equity$", "rentabilité_capitaux_propres_tangibles_pourcentage", "pct"),
    (r"^(return on invested capital|roic)$", "rentabilité_capitaux_investis_pourcentage", "pct"),
    (r"^return on capital employed$", "rentabilité_capitaux_employés_pourcentage", "pct"),
    (r"^dividend payout ratio$", "taux_distribution_pourcentage", "pct"),
    (r"^(r and d|research and development)( expense)? (as of|as a of|of) revenue$", "intensité_recherche_développement_pourcentage", "pct"),
    (r"^(r and d|research and development) intensity$", "intensité_recherche_développement_pourcentage", "pct"),
    (r"^(sg and a|selling general and administrative)( expenses?)? (as of|of) revenue$", "part_frais_commerciaux_administratifs_pourcentage", "pct"),
    (r"^international revenue share$", "part_chiffre_affaires_international_pourcentage", "pct"),
    (r"^recurring revenue (mix|share)$", "part_revenus_récurrents_pourcentage", "pct"),
    (r"^net revenue retention$", "rétention_nette_revenus_pourcentage", "pct"),
    (r"^capacity utilization$", "taux_utilisation_capacités_pourcentage", "pct"),
    (r"^reserve replacement ratio$", "taux_renouvellement_réserves_pourcentage", "pct"),
    (r"^persistency rate$", "taux_persistance_pourcentage", "pct"),
    (r"^arr growth$", "croissance_revenus_récurrents_annuels_pourcentage", "pct"),
    (r"^rate base growth$", "croissance_base_tarifaire_pourcentage", "pct"),
    (r"^customer growth$", "croissance_clients_pourcentage", "pct"),
    (r"^direct to consumer penetration$", "pénétration_vente_directe_pourcentage", "pct"),
    (r"^re leasing spread$", "écart_renouvellement_baux_pourcentage", "pct"),
    (r"^table win percentage$", "taux_gain_tables_pourcentage", "pct"),

    # --- par action ----------------------------------------------------------
    (r"^adjusted (diluted )?(eps|earnings per share)$", "résultat_ajusté_dilué_par_action", "per_share"),
    (r"^(diluted eps|eps diluted|diluted earnings per share|earnings per share diluted|eps|earnings per share)$", "résultat_dilué_par_action", "per_share"),
    (r"^quarterly dividends? per share$", "dividende_trimestriel_par_action", "per_share"),
    (r"^(dividends? per share|dps)$", "dividende_par_action", "per_share"),
    (r"^tangible book value per share$", "valeur_comptable_tangible_par_action", "per_share"),
    (r"^book value per share$", "valeur_comptable_par_action", "per_share"),
    (r"^ffo (per share|ps annuel)$", "ffo_par_action", "per_share"),
    (r"^affo per share$", "affo_par_action", "per_share"),

    # --- nombres -------------------------------------------------------------
    (r"^(r and d|research and development) headcount$", "effectifs_recherche_développement_nombre", "count"),
    (r"^full time employees$", "effectifs_temps_plein_nombre", "count"),
    (r"^(total |employee )*(employees|headcount|number of employees|workforce|staff)$", "effectifs_nombre", "count"),
    (r"^(store count|number of stores|stores)$", "magasins_nombre", "count"),
    (r"^net (new )?store openings$", "ouvertures_nettes_magasins_nombre", "count"),
    (r"^(restaurant count|number of restaurants)$", "restaurants_nombre", "count"),
    (r"^net new restaurant openings$", "ouvertures_nettes_restaurants_nombre", "count"),
    (r"^(customer count|number of customers|customers)$", "clients_nombre", "count"),
    (r"^active customers$", "clients_actifs_nombre", "count"),
    (r"^electric customers$", "clients_électricité_nombre", "count"),
    (r"^gas customers$", "clients_gaz_nombre", "count"),
    (r"^monthly active users$", "utilisateurs_actifs_mensuels_nombre", "count"),
    (r"^(weighted average )?diluted shares( outstanding)?$", "actions_diluées_nombre", "count"),
    (r"^shares outstanding$", "actions_en_circulation_nombre", "count"),
    (r"^shares repurchased$", "actions_rachetées_nombre", "count"),
    (r"^installed base$", "base_installée_nombre", "count"),
    (r"^installed fleet$", "flotte_installée_nombre", "count"),
    (r"^deliveries$", "livraisons_nombre", "count"),
    (r"^unit shipments$", "unités_expédiées_nombre", "count"),
    (r"^patent portfolio$", "brevets_nombre", "count"),
    (r"^tower site count$", "sites_tours_nombre", "count"),
    (r"^number of manufacturing sites$", "sites_production_nombre", "count"),
    (r"^policies in force$", "polices_en_vigueur_nombre", "count"),
    (r"^medical membership$", "adhérents_santé_nombre", "count"),
    (r"^loyalty program members$", "membres_programme_fidélité_nombre", "count"),
    (r"^paid digital subscribers$", "abonnés_numériques_payants_nombre", "count"),
    (r"^paid streaming subscribers$", "abonnés_streaming_payants_nombre", "count"),
    (r"^broadband subscribers$", "abonnés_haut_débit_nombre", "count"),
    (r"^video subscribers$", "abonnés_télévision_nombre", "count"),
    (r"^treated patients$", "patients_traités_nombre", "count"),
    (r"^passengers carried$", "passagers_transportés_nombre", "count"),
    (r"^home closings$", "livraisons_logements_nombre", "count"),
    (r"^backlog units$", "logements_carnet_nombre", "count"),
    (r"^unit count$", "logements_nombre", "count"),
    (r"^lots controlled$", "terrains_contrôlés_nombre", "count"),
    (r"^producing well count$", "puits_en_production_nombre", "count"),
    (r"^transactions processed$", "transactions_traitées_nombre", "count"),
    (r"^phase iii programs$", "programmes_phase_trois_nombre", "count"),
    (r"^number of acquisitions completed$", "acquisitions_réalisées_nombre", "count"),
    (r"^consecutive years of dividend increases$", "années_consécutives_hausse_dividende_nombre", "count"),

    # --- ratios et delais ----------------------------------------------------
    (r"^book to bill( ratio)?$", "commandes_sur_facturations_ratio", "ratio"),
    (r"^net debt (to )?ebitda$", "dette_nette_sur_ebitda_ratio", "ratio"),
    (r"^inventory turns$", "rotation_stocks_ratio", "ratio"),
    (r"^inventory days$", "stocks_jours", "days"),
    (r"^days sales outstanding$", "créances_clients_jours", "days"),

    # --- mesures physiques et prix unitaires ---------------------------------
    (r"^total production boe$", "production_totale", "autre"),
    (r"^oil production$", "production_pétrole", "autre"),
    (r"^natural gas production$", "production_gaz_naturel", "autre"),
    (r"^ngl production$", "production_liquides_gaz_naturel", "autre"),
    (r"^gas sales volume$", "volumes_gaz_vendus", "autre"),
    (r"^generation mwh$", "production_électricité", "autre"),
    (r"^retail electricity sales mwh$", "ventes_électricité_détail", "autre"),
    (r"^electricity sales mwh$", "ventes_électricité", "autre"),
    (r"^residential sales$", "ventes_résidentiel", "autre"),
    (r"^commercial sales$", "ventes_commercial", "autre"),
    (r"^industrial sales$", "ventes_industriel", "autre"),
    (r"^generation capacity mw$", "capacité_production_électrique", "autre"),
    (r"^refinery throughput$", "charge_raffinage", "autre"),
    (r"^transportation volumes$", "volumes_transportés", "autre"),
    (r"^processing volumes$", "volumes_traités", "autre"),
    (r"^proved reserves$", "réserves_prouvées", "autre"),
    (r"^steel shipments$", "expéditions_acier", "autre"),
    (r"^sales volume$", "volumes_vendus", "autre"),
    (r"^leasing volume$", "surfaces_louées", "autre"),
    (r"^exabytes shipped$", "capacité_expédiée", "autre"),
    (r"^packages per day$", "colis_par_jour", "autre"),
    (r"^average daily volume$", "volume_quotidien_moyen", "autre"),
    (r"^realized oil price$", "prix_réalisé_pétrole", "autre"),
    (r"^realized natural gas price$", "prix_réalisé_gaz_naturel", "autre"),
    (r"^realized ngl price$", "prix_réalisé_liquides_gaz_naturel", "autre"),
    (r"^average selling price$", "prix_moyen_vente", "autre"),
    (r"^average ticket$", "panier_moyen", "autre"),
    (r"^average daily rate$", "prix_moyen_chambre", "autre"),
    (r"^revpar$", "revpar", "autre"),
    (r"^sales per square (foot|meter|foot meter)$", "ventes_par_unité_surface", "autre"),
    (r"^lease operating expense per boe$", "coût_exploitation_par_bep", "autre"),
    (r"^(arpu|arpa|arpu arpa)$", "revenu_moyen_par_utilisateur", "autre"),

    # --- second lot, 23 sept 2026 : queue frequente du corpus ---------------
    (r"^cost of (revenue|sales|goods sold)$", "coût_des_ventes", "money"),
    (r"^amortization of intangibles?( assets?)?$", "amortissement_immobilisations_incorporelles", "money"),
    (r"^depreciation depletion and amortization$", "dotations_amortissements_épuisement", "money"),
    (r"^(sales and marketing|selling and marketing)( expenses?)?$", "frais_commerciaux_marketing", "money"),
    (r"^advertising expenses?$", "dépenses_publicitaires", "money"),
    (r"^non ?interest expense$", "charges_hors_intérêts", "money"),
    (r"^accounts payable$", "dettes_fournisseurs", "money"),
    (r"^operating lease liabilities$", "dettes_locatives", "money"),
    (r"^cash and (investments|marketable securities)$", "trésorerie_et_placements", "money"),
    (r"^net property and equipment$", "immobilisations_corporelles", "money"),
    (r"^risk weighted assets$", "actifs_pondérés_risques", "money"),
    (r"^invested assets$", "actifs_investis", "money"),
    (r"^customer deposits$", "dépôts_clients", "money"),
    (r"^catastrophe losses$", "sinistres_catastrophes", "money"),
    (r"^premiums earned$", "primes_acquises", "money"),
    (r"^net investment gains$", "plus_values_placements", "money"),
    (r"^fee related earnings$", "résultat_lié_aux_commissions", "money"),
    (r"^management fee revenue$", "commissions_gestion", "money"),
    (r"^assets under custody and administration$", "actifs_conservation_administration", "money"),
    (r"^average aum$", "actifs_sous_gestion_moyens", "money"),
    (r"^gross bookings$", "réservations_brutes", "money"),
    (r"^net bookings$", "réservations_nettes", "money"),
    (r"^billings$", "facturations", "money"),
    (r"^gross merchandise value$", "volume_affaires_marchandises", "money"),
    (r"^royalty (revenues?|income)$", "chiffre_affaires_redevances", "money"),
    (r"^licensing (revenues?|income)$", "chiffre_affaires_licences", "money"),
    (r"^consulting (revenues?|sales)$", "chiffre_affaires_conseil", "money"),
    (r"^hardware (revenues?|sales)$", "chiffre_affaires_matériel", "money"),
    (r"^membership fee revenues?$", "chiffre_affaires_cotisations", "money"),
    (r"^passenger ticket revenues?$", "chiffre_affaires_billetterie", "money"),
    (r"^gross gaming revenues?$", "chiffre_affaires_jeux_brut", "money"),
    (r"^system wide revenues?$", "chiffre_affaires_réseau", "money"),
    (r"^direct channel revenues?$", "chiffre_affaires_canal_direct", "money"),
    (r"^other services? revenues?$", "chiffre_affaires_services_autres", "money"),
    (r"^services and other revenues?$", "chiffre_affaires_services_et_autres", "money"),
    (r"^cloud infrastructure services revenues?$", "chiffre_affaires_infrastructure_cloud", "money"),
    (r"^accelerated share repurchase$", "rachats_actions_accélérés", "money"),
    (r"^remaining buyback authorization$", "autorisation_rachat_actions_restante", "money"),
    (r"^share repurchase program authorization$", "autorisation_rachat_actions", "money"),
    (r"^total capital returned to shareholders$", "capital_restitué_actionnaires", "money"),
    (r"^(cash dividends paid|total dividends?)$", "dividendes_versés", "money"),
    (r"^acquisition consideration paid$", "montant_acquisitions", "money"),
    (r"^acquisition (spend|spending)$", "montant_acquisitions", "money"),
    (r"^real estate acquisitions$", "acquisitions_immobilières", "money"),
    (r"^(asset divestiture proceeds|proceeds from asset disposals)$", "produits_cessions", "money"),
    (r"^business divestiture$", "montant_cessions", "money"),
    (r"^adjusted free cash flow$", "flux_trésorerie_disponible_ajusté", "money"),
    (r"^cash flow from operating activities$", "flux_trésorerie_exploitation", "money"),
    (r"^adjusted funds from operations$", "flux_trésorerie_opérationnels_foncière_ajustés", "money"),
    (r"^same store noi$", "résultat_exploitation_immobilier_périmètre_comparable", "money"),
    (r"^contracted revenue backlog$", "carnet_commandes_contractualisé", "money"),
    (r"^development pipeline$", "portefeuille_développement", "money"),
    (r"^equity in earnings of affiliates$", "quote_part_résultat_sociétés_équivalence", "money"),
    (r"^product warranty accrual$", "provisions_garanties", "money"),
    (r"^intangible asset impairment$", "dépréciation_immobilisations_incorporelles", "money"),
    (r"^quarterly net income$", "résultat_net", "money"),
    (r"^net income available to common shareholders$", "résultat_net_actionnaires_ordinaires", "money"),
    (r"^equity$", "capitaux_propres", "money"),
    (r"^multi year capex plan$", "plan_investissement_pluriannuel", "money"),
    (r"^recurring operating income$", "résultat_opérationnel_récurrent", "money"),
    (r"^international operating income$", "résultat_opérationnel_international", "money"),
    (r"^annualized recurring revenue$", "revenus_récurrents_annuels", "money"),
    (r"^adjusted property ebitda$", "ebitda_ajusté_immobilier", "money"),
    (r"^(japan) (revenues?|sales)$", "chiffre_affaires_japon", "money"),
    (r"^revenue (in )?(the )?united states$", "chiffre_affaires_états_unis", "money"),

    # par action
    (r"^basic eps$", "résultat_de_base_par_action", "per_share"),
    (r"^non gaap diluted eps$", "résultat_ajusté_dilué_par_action", "per_share"),
    (r"^dividends declared per share$", "dividende_déclaré_par_action", "per_share"),

    # nombres
    (r"^diluted weighted average shares( outstanding)?$", "actions_diluées_nombre", "count"),
    (r"^common shares outstanding$", "actions_en_circulation_nombre", "count"),
    (r"^room count$", "chambres_nombre", "count"),
    (r"^hotel count$", "hôtels_nombre", "count"),
    (r"^number of branches( locations)?$", "agences_nombre", "count"),
    (r"^number of properties$", "actifs_immobiliers_nombre", "count"),
    (r"^number of brands in portfolio$", "marques_nombre", "count"),
    (r"^patents held$", "brevets_nombre", "count"),
    (r"^active accounts$", "comptes_actifs_nombre", "count"),
    (r"^total customers$", "clients_nombre", "count"),
    (r"^large customer count$", "grands_clients_nombre", "count"),
    (r"^total subscribers connections$", "abonnés_nombre", "count"),
    (r"^fiber passings$", "prises_fibre_nombre", "count"),
    (r"^broadband net adds$", "recrutements_nets_haut_débit_nombre", "count"),
    (r"^natural gas customers$", "clients_gaz_nombre", "count"),
    (r"^medicaid membership$", "adhérents_medicaid_nombre", "count"),
    (r"^medicare membership$", "adhérents_medicare_nombre", "count"),
    (r"^cumulative patients treated$", "patients_traités_cumulés_nombre", "count"),
    (r"^average community count$", "programmes_immobiliers_nombre", "count"),
    (r"^vehicle deliveries$", "livraisons_véhicules_nombre", "count"),
    (r"^bev sales deliveries$", "livraisons_véhicules_électriques_nombre", "count"),
    (r"^wholesale vehicle sales$", "ventes_véhicules_gros_nombre", "count"),
    (r"^unit sales$", "unités_vendues_nombre", "count"),

    # pourcentages
    (r"^return on tangible equity$", "rentabilité_capitaux_propres_tangibles_pourcentage", "pct"),
    (r"^organic order growth$", "croissance_organique_commandes_pourcentage", "pct"),
    (r"^organic (revenue|sales|net sales|brokerage revenue|) ?growth$", "croissance_organique_pourcentage", "pct"),
    (r"^take rate$", "taux_de_prise_pourcentage", "pct"),
    (r"^(churn|churn rate|attrition rate)$", "taux_attrition_pourcentage", "pct"),
    (r"^(customer|client) retention rate$", "taux_rétention_clients_pourcentage", "pct"),
    (r"^cancellation rate$", "taux_annulation_pourcentage", "pct"),
    (r"^yield on earning assets$", "rendement_actifs_productifs_pourcentage", "pct"),
    (r"^investment portfolio yield$", "rendement_portefeuille_placements_pourcentage", "pct"),
    (r"^non interest bearing deposit mix$", "part_dépôts_non_rémunérés_pourcentage", "pct"),
    (r"^net charge off rate$", "taux_pertes_crédit_pourcentage", "pct"),
    (r"^(cet1|cet1 capital ratio)$", "ratio_cet1_pourcentage", "pct"),
    (r"^solvency risk based capital ratio$", "ratio_solvabilité_pourcentage", "pct"),
    (r"^operating ratio$", "ratio_exploitation_pourcentage", "pct"),
    (r"^operating expense ratio$", "ratio_charges_exploitation_pourcentage", "pct"),
    (r"^compensation ratio$", "ratio_rémunération_pourcentage", "pct"),
    (r"^(digital sales (penetration|mix)|e commerce penetration)$", "part_ventes_numériques_pourcentage", "pct"),
    (r"^international share of revenue$", "part_chiffre_affaires_international_pourcentage", "pct"),
    (r"^largest customer (share of revenue|revenue concentration)$", "part_plus_gros_client_pourcentage", "pct"),
    (r"^top product revenue concentration$", "part_principal_produit_pourcentage", "pct"),
    (r"^subscription gross margin$", "marge_brute_abonnements_pourcentage", "pct"),
    (r"^services gross margin$", "marge_brute_services_pourcentage", "pct"),
    (r"^adjusted ebit margin$", "marge_opérationnelle_ajustée_pourcentage", "pct"),
    (r"^gross margin rate$", "marge_brute_pourcentage", "pct"),
    (r"^noi margin$", "marge_noi_pourcentage", "pct"),
    (r"^free cash flow conversion$", "taux_conversion_flux_trésorerie_pourcentage", "pct"),
    (r"^payout ratio$", "taux_distribution_pourcentage", "pct"),
    (r"^ffo payout ratio$", "taux_distribution_ffo_pourcentage", "pct"),
    (r"^(revenue growth at constant currency|constant currency revenue growth)$", "croissance_chiffre_affaires_change_constant_pourcentage", "pct"),
    (r"^capacity factor$", "facteur_charge_pourcentage", "pct"),
    (r"^refinery utilization rate$", "taux_utilisation_raffineries_pourcentage", "pct"),
    (r"^utilization( rate)?$", "taux_utilisation_pourcentage", "pct"),
    (r"^total shareholder return$", "rentabilité_totale_actionnaire_pourcentage", "pct"),
    (r"^dividend growth$", "croissance_dividende_pourcentage", "pct"),
    (r"^net rooms growth$", "croissance_nombre_chambres_pourcentage", "pct"),
    (r"^blended rent growth$", "croissance_loyers_pourcentage", "pct"),
    (r"^renewal price change$", "variation_prix_renouvellement_pourcentage", "pct"),
    (r"^same store occupancy$", "taux_occupation_périmètre_comparable_pourcentage", "pct"),
    (r"^reinsurance combined ratio$", "ratio_combiné_réassurance_pourcentage", "pct"),
    (r"^gross to net discount$", "remise_brut_net_pourcentage", "pct"),

    # ratios et delais
    (r"^net leverage ratio$", "ratio_levier_net_ratio", "ratio"),
    (r"^leverage ratio$", "ratio_levier_ratio", "ratio"),
    (r"^cash conversion cycle$", "cycle_conversion_trésorerie_jours", "days"),
    (r"^days inventory outstanding$", "stocks_jours", "days"),
    (r"^average length of stay$", "durée_moyenne_séjour_jours", "days"),

    # mesures physiques et prix unitaires
    (r"^proved developed reserves$", "réserves_prouvées_développées", "autre"),
    (r"^proved undeveloped reserves$", "réserves_prouvées_non_développées", "autre"),
    (r"^aggregates volume$", "volumes_granulats", "autre"),
    (r"^aggregates price per ton$", "prix_granulats_par_tonne", "autre"),
    (r"^average selling price per ton$", "prix_moyen_vente_par_tonne", "autre"),
    (r"^fertilizer sales volume$", "volumes_engrais_vendus", "autre"),
    (r"^fertilizer realized price per ton$", "prix_réalisé_engrais", "autre"),
    (r"^crush volume$", "volumes_trituration", "autre"),
    (r"^processing volume$", "volumes_traités", "autre"),
    (r"^processing capacity$", "capacité_traitement", "autre"),
    (r"^production capacity$", "capacité_production", "autre"),
    (r"^development capacity mw$", "capacité_en_développement", "autre"),
    (r"^capacity under construction mw$", "capacité_en_construction", "autre"),
    (r"^fab capacity$", "capacité_fabrication", "autre"),
    (r"^wholesale electricity sales$", "ventes_électricité_gros", "autre"),
    (r"^gathering volumes$", "volumes_collectés", "autre"),
    (r"^shipment volume$", "volumes_expédiés", "autre"),
    (r"^shipments loads$", "chargements_expédiés", "autre"),
    (r"^containerboard tons produced$", "tonnage_carton_produit", "autre"),
    (r"^unit case volume$", "volumes_caisses_unitaires", "autre"),
    (r"^usage consumption volume$", "volumes_consommés", "autre"),
    (r"^cigarette shipment volume$", "volumes_cigarettes_expédiés", "autre"),
    (r"^selling area$", "surface_vente", "autre"),
    (r"^available seat miles$", "sièges_kilomètres_offerts", "autre"),
    (r"^refining margin per barrel$", "marge_raffinage_par_baril", "autre"),
    (r"^realized commodity price$", "prix_réalisé_matière_première", "autre"),
    (r"^revenue per carload$", "chiffre_affaires_par_wagon", "autre"),
    (r"^revenue per package$", "chiffre_affaires_par_colis", "autre"),
    (r"^revenue per employee$", "chiffre_affaires_par_salarié", "autre"),
    (r"^average revenue per user$", "revenu_moyen_par_utilisateur", "autre"),
    (r"^average rent per unit$", "loyer_moyen_par_logement", "autre"),
    (r"^base rent per square (foot|meter|foot meter)$", "loyer_de_base_par_unité_surface", "autre"),
    (r"^average closing price$", "prix_moyen_vente_logement", "autre"),
    (r"^daily average revenue trades$", "transactions_quotidiennes_moyennes", "autre"),
    (r"^net promoter score$", "score_recommandation_net", "autre"),
    (r"^average unit volume$", "chiffre_affaires_moyen_par_point_vente", "autre"),

    # --- troisieme lot, 23 sept 2026 : formulations retrouvees en comparant
    # --- l ancien catalogue au nouveau. Aucune ne change le perimetre.
    (r"^(adjusted earnings per diluted share|diluted adjusted eps|headline diluted eps)$", "résultat_ajusté_dilué_par_action", "per_share"),
    (r"^consolidated (net revenues?|net sales|revenues?|sales)$", "chiffre_affaires", "money"),
    (r"^(cash from operating activities|cash provided by operating activities|net cash flows? from operating activities|net cash from operations)$", "flux_trésorerie_exploitation", "money"),
    (r"^operating result$", "résultat_opérationnel", "money"),
    (r"^(annual|full year|quarterly) operating (income|profit)$", "résultat_opérationnel", "money"),
    (r"^(other revenue sources|other sales and revenues)$", "chiffre_affaires_autres", "money"),
    (r"^(associates|global headcount|headcount at period end|employees at end of period|workforce at year end)$", "effectifs_nombre", "count"),
    (r"^(attributable net profit|net income attributable|net (income|profit) attributable to (owners of the parent|the company|shareholders))$", "résultat_net_part_du_groupe", "money"),
    (r"^(dividend payments|dividends paid to shareholders|dividends and distributions paid)$", "dividendes_versés", "money"),
    (r"^cost of products sold$", "coût_des_ventes", "money"),
    (r"^(current inventories|inventories net|inventory net|inventory balance|total inventories)$", "stocks", "money"),
    (r"^(equity method income|equity affiliates income|income from equity affiliates|income from equity investments|equity method investment net earnings|equity in net income of unconsolidated investments)$", "quote_part_résultat_sociétés_équivalence", "money"),
    (r"^g and a expenses?$", "frais_administratifs", "money"),
    (r"^(gaap|group) operating margin$", "marge_opérationnelle_pourcentage", "pct"),
    (r"^operating margin (percentage|rate)$", "marge_opérationnelle_pourcentage", "pct"),
    (r"^international (revenue mix|sales share|share of net sales|net sales share)$", "part_chiffre_affaires_international_pourcentage", "pct"),
    (r"^largest (client|customer) (revenue concentration|revenue share|share of net sales)$", "part_plus_gros_client_pourcentage", "pct"),
    (r"^noncurrent debt$", "dette_long_terme", "money"),
    (r"^net debt at year end$", "dette_nette", "money"),

    # --- quatrieme lot : concepts generiques encore absents ------------------
    (r"^adjusted (operating (income|profit) margin)$", "marge_opérationnelle_ajustée_pourcentage", "pct"),
    (r"^(adjusted ebt|adjusted pre ?tax (income|earnings)|pre ?tax adjusted earnings)$", "résultat_avant_impôt_ajusté", "money"),
    (r"^basic earnings per (share|ordinary share)$", "résultat_de_base_par_action", "per_share"),
    (r"^average (headcount|employees|number of employees)$", "effectifs_moyens_nombre", "count"),
    (r"^(capex intensity|capex to (revenue|sales)|capital expenditure ratio)$", "intensité_investissements_pourcentage", "pct"),
    (r"^commissions?( revenue)?$", "chiffre_affaires_commissions", "money"),
    (r"^(common equity|common shareholders equity)$", "capitaux_propres_actionnaires_ordinaires", "money"),
    (r"^cost of (services|service revenue|services provided)$", "coût_des_services", "money"),
    (r"^customer (advances|prepayments|advances and deposits)$", "avances_clients", "money"),
    (r"^(deferred revenue balance|unearned revenue)$", "produits_constatés_avance", "money"),
    (r"^equity attributable to (the )?(parent|owners of the parent|shareholders)$", "capitaux_propres_part_du_groupe", "money"),
    (r"^other fee revenues?$", "chiffre_affaires_commissions_autres", "money"),
    (r"^fees and other (revenues?|income)$", "chiffre_affaires_commissions_et_autres", "money"),
    (r"^(currency (impact|effect) on (revenue growth|sales|sales growth)|currency growth contribution)$", "effet_change_pourcentage", "pct"),
    (r"^(fee income ratio|fee income share of revenue|fee revenue as of total revenue)$", "part_commissions_pourcentage", "pct"),
    (r"^cost of (natural gas|gas sold|natural gas purchased)$", "coût_du_gaz", "money"),
    (r"^advertising (expense )?(as )?(a )?of (revenue|net sales)$", "intensité_publicitaire_pourcentage", "pct"),
    (r"^advertising intensity$", "intensité_publicitaire_pourcentage", "pct"),
    (r"^(acquisitions? completed( in (the )?quarter)?|number of acquisitions)$", "acquisitions_réalisées_nombre", "count"),
]

# Mots sans effet sur le perimetre, la nature ni la periode d une mesure.
# Volontairement court : tout ce qui n est pas ici bloque le rapprochement.
# « net », « total », « gross », « adjusted » en sont exclus a dessein : ils
# distinguent des mesures differentes (dette nette contre dette totale).
MOTS_NEUTRES = {
    "amount", "amounts", "value", "the", "of", "and", "a", "an", "to",
    "for", "in", "on", "with", "as", "from", "by", "its", "our",
}


def _radical(mot):
    if mot.endswith("ies") and len(mot) > 4:
        return mot[:-3] + "y"
    if mot.endswith("s") and not mot.endswith("ss") and len(mot) > 3:
        return mot[:-1]
    return mot


def garde_modificateurs(libelle, alias):
    """R5bis. Vrai si `libelle` et `alias` ne different que par des mots
    neutres. Mecanique, sans moteur, sans reseau."""
    a = {_radical(m) for m in libelle.split()}
    b = {_radical(m) for m in alias.split()}
    for mot in (a ^ b):
        if mot not in MOTS_NEUTRES:
            return False
    return True


# Zones geographiques : meme mesure, meme perimetre, quel que soit l ordre des
# mots. Genere plutot qu ecrit a la main pour qu aucune formulation ne manque.
ZONES = [
    ("asia pacific|apac", "asie_pacifique"), ("north america", "amérique_du_nord"),
    ("latin america", "amérique_latine"), ("united states|u s|us", "états_unis"),
    ("united kingdom|uk", "royaume_uni"), ("rest of the world|rest of world|other regions", "reste_du_monde"),
    ("the americas|americas", "amériques"), ("international", "international"),
    ("europe", "europe"), ("emea", "emea"), ("asia", "asie"), ("china", "chine"),
    ("canada", "canada"), ("japan", "japon"), ("africa", "afrique"),
    ("france", "france"), ("germany", "allemagne"), ("india", "inde"),
    ("brazil", "brésil"), ("mexico", "mexique"), ("australia", "australie"),
    ("south korea|korea", "corée_du_sud"), ("taiwan", "taïwan"),
    ("middle east", "moyen_orient"), ("spain", "espagne"), ("italy", "italie"),
]
_MESURE = r"(net sales|net revenues?|sales|revenues?)"
for _z, _cle in ZONES:
    LEXIQUE.append((r"^(?:%s) %s$" % (_z, _MESURE), "chiffre_affaires_" + _cle, "money"))
    LEXIQUE.append((r"^%s (?:in |from |in the |for )?(?:%s)$" % (_MESURE, _z), "chiffre_affaires_" + _cle, "money"))
    # part du chiffre d affaires realisee dans la zone : meme mesure, en taux
    _p = "part_chiffre_affaires_" + _cle + "_pourcentage"
    LEXIQUE.append((r"^(?:%s) (?:revenue|sales|net sales) (?:share|mix)$" % _z, _p, "pct"))
    LEXIQUE.append((r"^(?:%s) share of (?:revenue|sales|net sales|total revenue)$" % _z, _p, "pct"))
    LEXIQUE.append((r"^share of (?:revenue|sales) (?:from|in) (?:%s)$" % _z, _p, "pct"))
    LEXIQUE.append((r"^(?:%s) revenue as (?:a )?of total(?: revenue)?$" % _z, _p, "pct"))

_GRAMMAIRE = re.compile(r"^[a-zà-öø-ÿ0-9]+(_[a-zà-öø-ÿ0-9]+){0,7}$")


def verifie_nomenclature():
    """Controle mecanique de la table (R2 et R4). Leve AssertionError au
    premier manquement : la table ne peut pas partir en production si une cle
    ne respecte pas la regle de nommage."""
    vus = {}
    for motif, cle, fam in LEXIQUE:
        re.compile(motif)
        if cle == "VENTILATION":
            continue
        assert cle == unicodedata.normalize("NFC", cle), "cle hors forme NFC : %s" % cle
        assert _GRAMMAIRE.match(cle), "cle hors grammaire (R2) : %s" % cle
        suf = SUFFIXES[fam]
        if suf:
            assert cle.endswith(suf), "suffixe %s manquant (R4) : %s" % (suf, cle)
        else:
            for autre in ("_pourcentage", "_par_action", "_nombre", "_ratio", "_jours", "_points_de_base"):
                assert not cle.endswith(autre), "suffixe %s interdit pour %s (R4) : %s" % (autre, fam, cle)
        if cle in vus:
            assert vus[cle] == fam, "cle %s rattachee a deux familles (%s, %s)" % (cle, vus[cle], fam)
        vus[cle] = fam
    return len(vus)


COMPILE = [(re.compile(m), c, f) for m, c, f in LEXIQUE]


_PERIODE = re.compile(
    r"^(annual|full year|fullyear|quarterly|half year|"
    r"reported|period end|at period end|at year end|year end)\s+")
_TOTAL_FINAL = re.compile(r"\s+total$")


def _essaie(libelle):
    for rx, cle, fam in COMPILE:
        if rx.search(libelle):
            return cle, fam
    return None, None


def concept(libelle):
    """Renvoie (cle, famille) ou (None, None). Deterministe, sans moteur.
    R9 : le libelle entier est essaye d abord ; un qualificatif de periode n
    est retire qu ensuite, une seule fois."""
    cle, fam = _essaie(libelle)
    if cle:
        return cle, fam
    nu = _TOTAL_FINAL.sub("", _PERIODE.sub("", libelle)).strip()
    if nu and nu != libelle:
        return _essaie(nu)
    return None, None


if __name__ == "__main__":
    n = verifie_nomenclature()
    print("nomenclature valide :", n, "concepts,", len(LEXIQUE), "motifs")
