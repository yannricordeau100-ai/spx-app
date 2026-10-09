# Fusion des stories de la base sous kpis-haut (7 oct 2026)

## 1. Mecanisme

- `src/lib/company-core/load-company.ts`, bloc kpis-haut : KEPT_SOURCES ligne 3110, remplacement ligne 3173 (avant correction : lignes 2984 et 3036) : quand `.batches-drafts-safe/kpis-haut/<TICKER>.json` existe, `data.kpis = [...converted, ...keptExtras]` remplace toute la liste. Seuls les KPI dont `_source` figure dans `KEPT_SOURCES` (ER+earnings-calls, calls-5y, stories-calls, stories-filings, sectoriel, kpis-haut 10-Q/10-K, stories-tiers, kpi-star, v2-pipeline-specific-kpis, kpis-supplementary) survivent.
- Les stories arrivent dans `data.kpis` par deux voies : `stories_kpis` de `src/data/v2-pipeline/<t>.json` (normalisation, ligne 772) et `stories_kpis` de `src/data/v2-pipeline-enrich/<t>.json` (ligne 1444). Leur `_source` est le plus souvent un texte libre (« Wikipedia, ... », « ER/ES », « Transcript ») ou absent : elles etaient donc effacees.

## 2. Correction

- Les stories des deux voies sont marquees `_story_origin` (et `_story_periode`, lue avant `normalizeHistory`).
- Nouvelle fonction `fusionStoriesBase(base, servis)` : apres le remplacement, les stories marquees et absentes de ce qui est servi sont ajoutees en fin de liste : `data.kpis = [...converted, ...keptExtras, ...storiesBase]`.
- Dedoublonnage, contre les KPI servis ET les stories deja retenues : (1) id normalise identique ; (2) titre normalise identique (fr/en croises) ou titre prolonge d au plus deux mots (titre court de 4 mots ou plus) a unite compatible ; (3) meme valeur, meme unite (premier element, t/tonnes et %/pct alignes), meme annee ou annee inconnue d un cote, ET au moins un mot porteur commun aux titres.
- Aucun KPI chiffre de base (hors stories) n est reintroduit.
- `REVISION_CHARGEUR` : "hero-select-2" -> "hero-select-3".

## 3. Resultat global

- Fichiers kpis-haut : 694 tickers charges (678 fiches pretes).
- **Stories ajoutees : 1831 sur 366 societes.** Verification croisee : difference brute avant/apres du chargeur = 1 831 identifiants nouveaux, 0 KPI disparu.
- Stories de la base non reintroduites : 407 : (b) doublons 354, (c) remplacees par la version kpis-haut de meme id 42, retirees en amont du remplacement (filtre des KPI desactives) 11.
- Stories deja servies avant correction (source dans KEPT_SOURCES) : 98.

Point de vigilance : parmi les stories reintroduites, 902 n ont aucun `_source` et 556 n ont pas de valeur (stories textuelles, filtrees ou non en aval par isStoryKpiUsable). Elles sont servies telles qu ecrites dans la base, sans controle de leur exactitude dans ce chantier.

## 4. Verification sur 5 societes (chargeur reel via npx tsx, stories = is_short_history)

| Societe | Stories avant | Stories apres | Ajoutees |
|---|---|---|---|
| SPCX | 91 | 99 | Lancements Falcon depuis le 1er janvier 2026; Lancements Falcon cumulés depuis l'origine; Satellites Starlink lancés depuis l'origine; Vols d'essai Starship réalisés; Effectifs; Marché adressable estimé du secteur Espace; Marché adressable estimé de la Connectivité; Marché adressable estimé du secteur IA |
| CAH | 24 | 47 | Taille du réseau pharmaceutique; Clients dans les solutions de santé; Capacité des centres de distribution pharmaceutiques; Taux de rétention des clients Healthcare Solutions; Couverture du réseau en oncologie; Nombre de centres hub oncologie; Clients santé numérique; Taux d'automatisation des centres de distribution pharmaceutiques; Croissance annuelle des hubs oncologiques; Couverture Pharmacies Spécialisées; Taux d'Utilisation des Centres Oncologie; Rev_Q2_2026; Guidance_Q2_2026; Rev_Q3_2026; GAAP_Earnings_Q3_2026; Acquisition_Q2_2026; Prévision de BPA 2027; Autorisation de rachats relevée; Part du marché des thérapies géniques; Risque Iran sur le profit GMPD; Taux de service à domicile; BPA doublé en quatre ans; Nouvelle ligne de crédit |
| GOOGL | 31 | 36 | Actifs en construction; Actifs longue duree hors US; Waymo dépasse 500 000 trajets autonomes par semaine; Lancement de Gemini 3; Premier trimestre à plus de 100 milliards de dollars de revenus |
| SPGI | 15 | 28 | Croissance clients EMEA; Taux d'attachement plateforme; Pénétration client en Asie-Pacifique; Taux d'intégration des plateformes; Encours des Indices Durables; Partenaires Données Automobile; Croissance de l'AUM des indices durables; Abonnés aux données sur la transition énergétique; RevGrowth2025; MarginImprovement2025; ShareholderReturn2025; LeadershipTransition2024; VitalityShare2024 |
| BRK.B | 2 | 8 | Operating Earnings; Cash Position; Book Value; Valeur de la participation dans Apple; Actifs régulés dans l'énergie; Rachats d'actions propres |

NB : BRK.B recoit 3 stories au format ancien (champ story_fr, sans name_fr ni value) ; leur affichage depend du filtre isStoryKpiUsable en aval.

## 5. Stories ajoutees, par societe

Pourquoi elles manquaient : pour toutes, `_source` hors KEPT_SOURCES (colonne Source) donc effacees par le remplacement kpis-haut, sans equivalent dans kpis-haut.

| Ticker | Story ajoutee (id) | Titre | Valeur | Origine | Source (_source) |
|---|---|---|---|---|---|
| A | 9500 ICP-MS | 9500 ICP-MS |   | v2-pipeline-enrich | ER/ES |
| A | Capacité de Production | Capacité de production | 1200 M unités | v2-pipeline-enrich | (aucun _source) |
| A | Cycle remplacement | Cycle remplacement |   | v2-pipeline-enrich | ER/ES |
| A | Ignite OS | Ignite OS |   | v2-pipeline-enrich | ER/ES |
| A | LDG accelere | LDG accéléré |   | v2-pipeline-enrich | ER/ES |
| A | Marché Asie-Pacifique | Part de marché Asie-Pacifique | 32.5 % | v2-pipeline-enrich | (aucun _source) |
| A | Part de Marché Diagnostics | Part de marché des diagnostics | 40 % | v2-pipeline-enrich | (aucun _source) |
| A | Pipeline R&D | Pipeline de recherche et développement | 15 projets | v2-pipeline-enrich | (aucun _source) |
| A | R&D Innovation Rate | Taux d'Innovation R&D | 38 % | v2-pipeline-enrich | (aucun _source) |
| A | Taux d'Adoption | Taux d'adoption des produits | 85 % | v2-pipeline-enrich | (aucun _source) |
| AAPL | India Production Share | Part de production en Inde | 28 % | v2-pipeline-enrich | (aucun _source) |
| AAPL | Vision Pro Attach Rate | Taux d'attachement Apple Vision Pro | 17 % | v2-pipeline-enrich | (aucun _source) |
| AAPL | double_digit_all_geos | double_digit_all_geos |   | v2-pipeline-enrich | ER/ES |
| AAPL | installed_base_record | installed_base_record |   | v2-pipeline-enrich | ER/ES |
| AAPL | iphone_17_demand | iphone_17_demand |   | v2-pipeline-enrich | ER/ES |
| AAPL | new_product_lineup | new_product_lineup |   | v2-pipeline-enrich | ER/ES |
| AAPL | services_all_time_record | services_all_time_record |   | v2-pipeline-enrich | ER/ES |
| ABBN.SW | Base orders up 5% | Base orders up 5% |   | v2-pipeline-enrich | ER/ES |
| ABBN.SW | Book-to-bill positive | Book-to-bill positive |   | v2-pipeline-enrich | ER/ES |
| ABBN.SW | Large orders doubled | Large orders doubled |   | v2-pipeline-enrich | ER/ES |
| ABBN.SW | Large orders up 50% | Large orders up 50% |   | v2-pipeline-enrich | ER/ES |
| ABBN.SW | Order growth Q1 2015 | Order growth Q1 2015 |   | v2-pipeline-enrich | ER/ES |
| ABBV | Autoimmune Launch Sites | Sites de lancement en auto-immune | 42 pays | v2-pipeline-enrich | (aucun _source) |
| ABBV | Biosim Launch Velocity | Vitesse de lancement des biosimilaires | 14 pays | v2-pipeline-enrich | (aucun _source) |
| ABBV | Capacité de production | Capacité de production des usines | 500 M unités | v2-pipeline-enrich | (aucun _source) |
| ABBV | China Autoimmune Share | Part de marché Chine auto-immune | 23 % | v2-pipeline-enrich | (aucun _source) |
| ABBV | Global Biosim Pen | Pénétration internationale des biosimilaires | 68 % | v2-pipeline-enrich | (aucun _source) |
| ABBV | Immuno +14% | Immuno +14% |   | v2-pipeline-enrich | ER/ES |
| ABBV | Manufacturing Capacity Add | Ajout de capacité de production | 125 M unités | v2-pipeline-enrich | (aucun _source) |
| ABBV | Neuro +26% | Neuro +26% |   | v2-pipeline-enrich | ER/ES |
| ABBV | Part de marché | Part de marché des médicaments biologiques | 12.5 % | v2-pipeline-enrich | (aucun _source) |
| ABBV | R&D Success Rate | Taux de succès R&D | 18.7 % | v2-pipeline-enrich | (aucun _source) |
| ABBV | Skyrizi moteur | Skyrizi moteur |   | v2-pipeline-enrich | ER/ES |
| ABBV | Skyscraper Molecules | Molécules en phase avancée | 7 molécules | v2-pipeline-enrich | (aucun _source) |
| ABBV | Vyalev lancement | Vyalev lancement |   | v2-pipeline-enrich | ER/ES |
| ABNB | ai_coauthored_code | ai_coauthored_code |   | v2-pipeline-enrich | ER/ES |
| ABNB | experiences_flywheel | experiences_flywheel |   | v2-pipeline-enrich | ER/ES |
| ABNB | hotel_cross_book | hotel_cross_book |   | v2-pipeline-enrich | ER/ES |
| ABNB | india_origin_growth | india_origin_growth |   | v2-pipeline-enrich | ER/ES |
| ABNB | rnpl_adoption | rnpl_adoption |   | v2-pipeline-enrich | ER/ES |
| ABNB | world_cup_supply | world_cup_supply |   | v2-pipeline-enrich | ER/ES |
| ABT | Capacité de Production | Capacité de production | 500 millions d'unités | v2-pipeline-enrich | (aucun _source) |
| ABT | Electrophysiology momentum | Electrophysiology momentum |   | v2-pipeline-enrich | ER/ES |
| ABT | Exact Sciences oncology | Exact Sciences oncology |   | v2-pipeline-enrich | ER/ES |
| ABT | Libre clinical outcomes | Libre clinical outcomes |   | v2-pipeline-enrich | ER/ES |
| ABT | Libre franchise scaling | Libre franchise scaling |   | v2-pipeline-enrich | ER/ES |
| ABT | Marché Émergent | Part de marché émergent | 12 % | v2-pipeline-enrich | (aucun _source) |
| ABT | Nouveaux Produits | Lancement de nouveaux produits | 5 produits | v2-pipeline-enrich | (aucun _source) |
| ABT | Partenariats Stratégiques | Nombre de partenariats stratégiques | 10 partenariats | v2-pipeline-enrich | (aucun _source) |
| ABT | TAM Élargi | Taille du marché adressable élargie | 50 Mds $ | v2-pipeline-enrich | (aucun _source) |
| ACGL | favorable_dev | favorable_dev |   | v2-pipeline-enrich | ER/ES |
| ACGL | mortgage_machine | mortgage_machine |   | v2-pipeline-enrich | ER/ES |
| ACGL | reins_turnaround | reins_turnaround |   | v2-pipeline-enrich | ER/ES |
| ACGL | roe_buybacks | roe_buybacks |   | v2-pipeline-enrich | ER/ES |
| ACLS | Gross Margin | Marge brute | 44.9 % | v2-pipeline | (aucun _source) |
| ACN | Cloud Migration Rate | Taux de migration cloud | 63 % | v2-pipeline-enrich | (aucun _source) |
| ACN | Digital Talent Hires | Recrutements en talents numériques | 18500 personnes | v2-pipeline-enrich | (aucun _source) |
| ACN | Security Deals Growth | Croissance des contrats cybersécurité | 29 % | v2-pipeline-enrich | (aucun _source) |
| AD.AS | Digital Shoppers | Nombre d'utilisateurs numériques actifs | 14.8 M utilisateurs | v2-pipeline-enrich | (aucun _source) |
| AD.AS | Plant-Based SKUs | Référence de produits végétaux lancés | 67 SKUs | v2-pipeline-enrich | (aucun _source) |
| AD.AS | Sustainable Stores | Nombre de magasins durables certifiés | 412 stores | v2-pipeline-enrich | (aucun _source) |
| ADBE | 20 000 grandes entreprises | Grandes entreprises clientes |   | v2-pipeline-enrich | Transcript |
| ADBE | 400 Mds de PDF par an | PDF ouverts avec Acrobat chaque année |   | v2-pipeline-enrich | Transcript |
| ADBE | AEM, GenStudio, AEP +20% | AEM, GenStudio et AEP à plus de 20% |   | v2-pipeline-enrich | Transcript |
| ADBE | AI-first ARR x3 | AI-first ARR x3 |   | v2-pipeline-enrich | ER/ES |
| ADBE | Acrobat AI Assistant MAU x2 | Assistant IA d'Acrobat : utilisateurs x2 |   | v2-pipeline-enrich | Transcript |
| ADBE | Arabie saoudite 27 M | Partenariat Arabie saoudite |   | v2-pipeline-enrich | Transcript |
| ADBE | Business Pros +16% | Business Pros +16% |   | v2-pipeline-enrich | ER/ES |
| ADBE | DX Subscription | Abonnements Digital Experience | 5.409 Mds $ | v2-pipeline | (aucun _source) |
| ADBE | Rachat d'actions soutenu | Rachat d'actions soutenu |   | v2-pipeline-enrich | ER/ES |
| ADBE | Rachat de Topaz Labs | Acquisition de Topaz Labs |   | v2-pipeline-enrich | Transcript |
| ADBE | Semrush integre | Semrush intégré |   | v2-pipeline-enrich | ER/ES |
| ADBE | Tresorerie 5,64 Mds $ | Trésorerie et placements à court terme |   | v2-pipeline-enrich | Transcript |
| ADBE | Visibilite de marque x2 | Visibilité de marque : clients payants x2 |   | v2-pipeline-enrich | Transcript |
| ADI | Carnet sain | Carnet sain |   | v2-pipeline-enrich | ER/ES |
| ADI | Comm +37% | Comm +37% |   | v2-pipeline-enrich | ER/ES |
| ADI | Indus +34% | Indus +34% |   | v2-pipeline-enrich | ER/ES |
| ADI | Reprise commandes | Reprise commandes |   | v2-pipeline-enrich | ER/ES |
| ADM | AS&O Ag Services +26% | AS&O Ag Services +26% |   | v2-pipeline-enrich | ER/ES |
| ADM | Carb Solutions +48% | Carb Solutions +48% |   | v2-pipeline-enrich | ER/ES |
| ADM | Nutrition T1 2026 +42% | Nutrition T1 2026 +42% |   | v2-pipeline-enrich | ER/ES |
| ADM | VCP rebond ethanol | VCP rebond éthanol |   | v2-pipeline-enrich | ER/ES |
| ADP | PEO Worksite Employees | Salariés en co-emploi PEO | 750 K | v2-pipeline | (aucun _source) |
| ADSK | Make Revenue | Revenu du segment Make (cloud) | 796 M $ | v2-pipeline | (aucun _source) |
| ADYEN.AS | Capacité de Traitement | Capacité de traitement des transactions | 5000 transactions par seconde | v2-pipeline-enrich | (aucun _source) |
| ADYEN.AS | Enterprise Merchant Count | Nombre de marchands enterprise | 540 clients | v2-pipeline-enrich | (aucun _source) |
| ADYEN.AS | In-House Processing Share | Part des transactions traitées en interne | 82 % | v2-pipeline-enrich | (aucun _source) |
| ADYEN.AS | Marché APAC | Part de marché en Asie-Pacifique | 12.5 % | v2-pipeline-enrich | (aucun _source) |
| ADYEN.AS | New Geo Launches | Nouveaux marchés lancés | 9 pays | v2-pipeline-enrich | (aucun _source) |
| ADYEN.AS | New Merchants | Nouveaux commerçants | 500 entreprises | v2-pipeline-enrich | (aucun _source) |
| ADYEN.AS | Platform Revenue Share | Part du chiffre d'affaires provenant des plateformes | 38.2 % | v2-pipeline-enrich | (aucun _source) |
| ADYEN.AS | Produits Financiers | Produits financiers | 8 produits | v2-pipeline-enrich | (aucun _source) |
| ADYEN.AS | Super App Integrations | Intégrations dans super apps | 7 partenariats | v2-pipeline-enrich | (aucun _source) |
| ADYEN.AS | Tokenization Rate | Taux de tokenisation des transactions | 67 % | v2-pipeline-enrich | (aucun _source) |
| AEE | Renewables Capacity Add | Ajout de capacité renouvelable | 325 MW | v2-pipeline-enrich | (aucun _source) |
| AEE | Renewables Share | Part des énergies renouvelables | 18.5 % | v2-pipeline-enrich | (aucun _source) |
| AEE | demand_growth | demand_growth |   | v2-pipeline-enrich | ER/ES |
| AEE | eps_cagr_68 | eps_cagr_68 |   | v2-pipeline-enrich | ER/ES |
| AEE | missouri_q1_jump | missouri_q1_jump |   | v2-pipeline-enrich | ER/ES |
| AEE | rate_base_106 | rate_base_106 |   | v2-pipeline-enrich | ER/ES |
| AEE | transmission_strength | transmission_strength |   | v2-pipeline-enrich | ER/ES |
| AEP | Abordabilite | Abordabilité |   | v2-pipeline-enrich | ER/ES |
| AEP | Capex 78 Md$ | Capex 78 Md$ |   | v2-pipeline-enrich | ER/ES |
| AEP | Charge x2 vers 63 GW | Charge x2 vers 63 GW |   | v2-pipeline-enrich | ER/ES |
| AEP | Renewable Energy Mix | Part d'Énergie Renouvelable | 42.3 % | v2-pipeline-enrich | (aucun _source) |
| AEP | Reseau 765 kV | Réseau 765 kV |   | v2-pipeline-enrich | ER/ES |
| AEP | Texas Load LoA | Demande data center signée (AEP Texas) | 36 GW | v2-pipeline | (aucun _source) |
| AEP | Texas SB6 | Texas SB6 |   | v2-pipeline-enrich | ER/ES |
| AES | LatAm Solar GW | Capacité Solaire Ajoutée en Amérique Latine | 1.4 GW | v2-pipeline-enrich | (aucun _source) |
| AES | Storage Capacity Add | Capacité de stockage ajoutée | 2.1 GW | v2-pipeline-enrich | (aucun _source) |
| AFL | 43 ans de dividendes | 43 ans de dividendes |   | v2-pipeline-enrich | ER/ES |
| AFL | Japan App Engagement | Engagement sur l'application Japon | 6.4 sessions/mois | v2-pipeline-enrich | (aucun _source) |
| AFL | Japan Digital Penetration | Pénétration numérique au Japon | 74 % | v2-pipeline-enrich | (aucun _source) |
| AFL | Marge Japon record Q3 | Marge Japon record Q3 |   | v2-pipeline-enrich | ER/ES |
| AFL | Trio produits Japon | Trio produits Japon |   | v2-pipeline-enrich | ER/ES |
| AFL | US Digital Enrollment | Inscriptions numériques aux États-Unis | 47 % | v2-pipeline-enrich | (aucun _source) |
| AFL | US Voluntary Benefits Share | Part de marché des avantages volontaires aux États-Unis | 18.5 % | v2-pipeline-enrich | (aucun _source) |
| AFL | Ventes US groupe | Ventes US groupe |   | v2-pipeline-enrich | ER/ES |
| AIG | Cyber Policies Issued | Polices Cybersécurité Émises | 12.4 k unités | v2-pipeline-enrich | (aucun _source) |
| AIG | Cyber Premium Growth | Croissance des Primes d'Assurance Cyber | 28 % | v2-pipeline-enrich | (aucun _source) |
| AIZ | Device Protection Attach Rate | Taux d'attachement protection appareils | 28.5 % | v2-pipeline-enrich | (aucun _source) |
| AIZ | Global Housing Tech Spend | Dépenses technologiques Global Housing | 115 Mds $ | v2-pipeline-enrich | (aucun _source) |
| AIZ | Renters Insurance Penetration | Pénétration assurance locataires | 14.3 % | v2-pipeline-enrich | (aucun _source) |
| AIZ | ai_platforms | ai_platforms |   | v2-pipeline-enrich | ER/ES |
| AIZ | connected_living_mobile | connected_living_mobile |   | v2-pipeline-enrich | ER/ES |
| AIZ | double_digit_streak | double_digit_streak |   | v2-pipeline-enrich | ER/ES |
| AIZ | home_warranty_launch | home_warranty_launch |   | v2-pipeline-enrich | ER/ES |
| AIZ | lender_placed_share | lender_placed_share |   | v2-pipeline-enrich | ER/ES |
| AIZ | record_q1 | record_q1 |   | v2-pipeline-enrich | ER/ES |
| AKAM | CIS +40% | CIS +40% |   | v2-pipeline-enrich | ER/ES |
| AKAM | Contrat IA 1.8Md | Contrat IA 1,8Md |   | v2-pipeline-enrich | ER/ES |
| AKAM | Guardicore +36% | Guardicore +36% |   | v2-pipeline-enrich | ER/ES |
| AKAM | Inference Cloud | Inférence Cloud |   | v2-pipeline-enrich | ER/ES |
| ALB | Capacity Additions | Ajouts de Capacité | 50 kt | v2-pipeline-enrich | (aucun _source) |
| ALB | Capacity Utilization Rate | Taux d'Utilisation des Capacités | 88.3 % | v2-pipeline-enrich | (aucun _source) |
| ALGN | Emerging Markets Fleet | Nombre de scanners iTero dans les marchés émergents | 24500 unités | v2-pipeline-enrich | (aucun _source) |
| ALGN | Emerging Markets Share | Part de marché dans les pays émergents | 18.3 % | v2-pipeline-enrich | (aucun _source) |
| ALGN | Exocad Integration Rate | Taux d'intégration exocad chez les dentistes | 34.7 % | v2-pipeline-enrich | (aucun _source) |
| ALGN | Invisalign Kids Growth | Croissance des traitements Invisalign pour enfants | 23.4 % | v2-pipeline-enrich | (aucun _source) |
| ALGN | Invisalign Kids Penetration | Pénétration d'Invisalign Kids chez les dentistes pédiatriques | 37.8 % | v2-pipeline-enrich | (aucun _source) |
| ALGN | Scanner Attach Rate | Taux d'attachement des scanners iTero aux nouveaux comptes Invisalign | 68.5 % | v2-pipeline-enrich | (aucun _source) |
| ALGN | Vivera Retention Rate | Taux de rétention Vivera | 41.6 % | v2-pipeline-enrich | (aucun _source) |
| ALGN | iTero Scanner Fleet | Parc mondial de scanners iTero | 185000 unités | v2-pipeline-enrich | (aucun _source) |
| ALL | NatGenRateImpactDec2023 | NatGenRateImpactDec2023 |   | v2-pipeline-enrich | ER/ES |
| ALL | RateIncreaseDec2023 | RateIncreaseDec2023 |   | v2-pipeline-enrich | ER/ES |
| ALL | RateIncreaseMar2024 | RateIncreaseMar2024 |   | v2-pipeline-enrich | ER/ES |
| ALLE | Award | Award |   | v2-pipeline-enrich | ER/ES |
| ALLE | Cash generation | Cash generation |   | v2-pipeline-enrich | ER/ES |
| ALLE | Margin decline | Margin decline |   | v2-pipeline-enrich | ER/ES |
| ALLE | Revenue growth | Revenue growth |   | v2-pipeline-enrich | ER/ES |
| ALLE | Smart Locks Growth | Croissance des serrures intelligentes | 23.4 % | v2-pipeline-enrich | (aucun _source) |
| AMAT | adv_packaging_growth_cy2026 | Croissance attendue du CA emballage avancé en 2026 | 70 % | v2-pipeline-enrich | transcript |
| AMAT | aix_connected_chambers | Chambres installées connectées au logiciel IA AIx | 37 milliers de chambres | v2-pipeline-enrich | transcript |
| AMAT | customer_forecast_visibility | Horizon des prévisions glissantes des grands clients | 8 trimestres | v2-pipeline-enrich | transcript |
| AMAT | dram_epi_cleanroom_saving | Gain de surface de salle blanche du nouveau système d'épitaxie DRAM | 20 % | v2-pipeline-enrich | transcript |
| AMAT | epic_engagements | Partenariats EPIC annoncés | 11 partenariats | v2-pipeline-enrich | transcript |
| AMAT | new_fab_projects_quarter | Nouveaux projets d'usines annoncés par les clients sur le trimestre | 10 projets | v2-pipeline-enrich | transcript |
| AMAT | new_products_quarter | Nouveaux produits annoncés sur le trimestre | 6 produits | v2-pipeline-enrich | transcript |
| AMAT | pdc_growth_cy2026 | Croissance attendue du CA métrologie et inspection (PDC) en 2026 | 50 % | v2-pipeline-enrich | transcript |
| AMAT | wfe_growth_ai_segments_share | Part de la croissance du marché WFE portée par logique de pointe, DRAM et emballage avancé | 80 % | v2-pipeline-enrich | transcript |
| AMCR | Acquisition Berry | Acquisition Berry |   | v2-pipeline-enrich | ER/ES |
| AMCR | Berry integration cash costs | Coûts d'intégration de Berry |   | v2-pipeline-enrich | Transcript |
| AMCR | Cash recovery target | Objectif de récupération de trésorerie |   | v2-pipeline-enrich | Transcript |
| AMCR | Core portfolio EBIT margin | Marge du portefeuille cœur |   | v2-pipeline-enrich | Transcript |
| AMCR | Middle East working capital hit | Impact du Moyen-Orient sur la trésorerie |   | v2-pipeline-enrich | Transcript |
| AMCR | Price pass-through | Répercussion de l'inflation |   | v2-pipeline-enrich | Transcript |
| AMCR | Protein and pet care weight | Poids des protéines et animaux |   | v2-pipeline-enrich | Transcript |
| AMCR | Safety incident rate | Taux d'accidents du travail |   | v2-pipeline-enrich | Transcript |
| AMCR | Transition period EPS guidance | Prévision de BPA sur six mois |   | v2-pipeline-enrich | Transcript |
| AMD | China MI308 export control | China MI308 export control |   | v2-pipeline-enrich | ER/ES |
| AMD | Data Center primary driver | Data Center primary driver |   | v2-pipeline-enrich | ER/ES |
| AMD | Gaming rebound | Gaming rebound |   | v2-pipeline-enrich | ER/ES |
| AMD | MI450 / Helios pipeline | MI450 / Helios pipeline |   | v2-pipeline-enrich | ER/ES |
| AMD | Meta 6 GW deal | Meta 6 GW deal |   | v2-pipeline-enrich | ER/ES |
| AME | Acquisition LKC | Acquisition LKC |   | v2-pipeline-enrich | ER/ES |
| AME | Diagnostic ocular | Diagnostic oculaire |   | v2-pipeline-enrich | ER/ES |
| AME | Growth objective | Growth objective |   | v2-pipeline-enrich | ER/ES |
| AME | Strategic fit | Strategic fit |   | v2-pipeline-enrich | ER/ES |
| AMGN | Biosimilar EU Launch | Nombre de pays européens avec lancement de biosimilaires | 14 pays | v2-pipeline-enrich | (aucun _source) |
| AMGN | Generative Biology Programs | Programmes de biologie générative actifs | 5 programmes | v2-pipeline-enrich | (aucun _source) |
| AMGN | Generative Biology Targets | Cibles découlant de la biologie générative | 15 cibles | v2-pipeline-enrich | (aucun _source) |
| AMGN | Tezspire Prescriptions | Ordonnances mensuelles de Tezspire | 18500 ordonnances | v2-pipeline-enrich | (aucun _source) |
| AMGN | Tezspire Scripts Growth | Évolution mensuelle des ordonnances Tezspire | 8.2 %/mois | v2-pipeline-enrich | (aucun _source) |
| AMGN | US Biosimilar Share | Part de marché des biosimilaires aux États-Unis | 38 % | v2-pipeline-enrich | (aucun _source) |
| AMZN | AWS Outposts | Commandes AWS Outposts | 3.2 Mds $ | v2-pipeline-enrich | (aucun _source) |
| AMZN | Alexa Devices | Expéditions d'appareils Alexa | 85 M unités | v2-pipeline-enrich | (aucun _source) |
| AMZN | FBA Penetration | Pénétration FBA chez les vendeurs | 57 % | v2-pipeline-enrich | (aucun _source) |
| AMZN | Marketplace GMV Share | Part de marché du GMV en ligne US | 39.5 % | v2-pipeline-enrich | (aucun _source) |
| AMZN | Prime Members | Nombre d'abonnés Prime | 230 M | v2-pipeline-enrich | (aucun _source) |
| AMZN | Robot Warehouses | Entrepôts automatisés | 420 entrepôts | v2-pipeline-enrich | (aucun _source) |
| ANET | Customer Sentiment | Customer Sentiment |   | v2-pipeline-enrich | ER/ES |
| ANET | Ports Shipping Milestone | Ports Shipping Milestone |   | v2-pipeline-enrich | ER/ES |
| ANET | Q1 2026 Revenue Growth | Q1 2026 Revenue Growth |   | v2-pipeline-enrich | ER/ES |
| ANET | Q4 2025 Revenue Milestone | Q4 2025 Revenue Milestone |   | v2-pipeline-enrich | ER/ES |
| ANET | XPO High‑Density Optics | XPO High‑Density Optics |   | v2-pipeline-enrich | ER/ES |
| AON | Client Retention | Taux de rétention des clients | 85 % | v2-pipeline-enrich | (aucun _source) |
| AON | Dividende x6 | Dividende x6 |   | v2-pipeline-enrich | ER/ES |
| AON | Global Health Share | Part de Marché Santé Global | 18.2 % | v2-pipeline-enrich | (aucun _source) |
| AON | Patrim. ralentit | Patrim. ralentit |   | v2-pipeline-enrich | ER/ES |
| AON | Plan 3x3 | Plan 3x3 |   | v2-pipeline-enrich | ER/ES |
| AON | Reass. +8% | Réass. +8% |   | v2-pipeline-enrich | ER/ES |
| AON | Risque +7% | Risque +7% |   | v2-pipeline-enrich | ER/ES |
| AOS | Capacité Prod | Capacité de production des usines | 1.2 M unités | v2-pipeline-enrich | (aucun _source) |
| AOS | Cash flow surge | Cash flow surge |   | v2-pipeline-enrich | ER/ES |
| AOS | EPS guidance lowered | EPS guidance lowered |   | v2-pipeline-enrich | ER/ES |
| AOS | Leonard Valve acquisition | Leonard Valve acquisition |   | v2-pipeline-enrich | ER/ES |
| AOS | North America sales up | North America sales up |   | v2-pipeline-enrich | ER/ES |
| AOS | Rest of World sales down | Rest of World sales down |   | v2-pipeline-enrich | ER/ES |
| AOS | Water Tech | Part de marché des solutions d'eau | 12.5 % | v2-pipeline-enrich | (aucun _source) |
| APA | Integration Callon | Intégration Callon |   | v2-pipeline-enrich | ER/ES |
| APD | Adjusted EPS exceeds guidance | Adjusted EPS exceeds guidance |   | v2-pipeline-enrich | ER/ES |
| APD | Electronics project wins | Projets gagnés dans l'électronique |   | v2-pipeline-enrich | Transcript |
| APD | FY26 EPS guidance raised | Prévision de BPA 2026 relevée |   | v2-pipeline-enrich | Transcript |
| APD | Full results scheduled | Full results scheduled |   | v2-pipeline-enrich | ER/ES |
| APD | Headcount reduction savings | Économies du plan de réduction des effectifs |   | v2-pipeline-enrich | Transcript |
| APD | Helium EPS headwind | Poids de l'hélium sur le BPA |   | v2-pipeline-enrich | Transcript |
| APD | Net debt to EBITDA | Endettement net rapporté à l'EBITDA |   | v2-pipeline-enrich | Transcript |
| APD | Preliminary EPS announced | Preliminary EPS announced |   | v2-pipeline-enrich | ER/ES |
| APD | Return on capital | Rendement du capital |   | v2-pipeline-enrich | Transcript |
| APD | Share buyback horizon | Horizon des rachats d'actions |   | v2-pipeline-enrich | Transcript |
| APD | Yara ammonia agreement | Accord avec Yara pour l'ammoniac de NEOM |   | v2-pipeline-enrich | Transcript |
| APH | Automotive E-Mobility Attach | Taux d'Attachement Électromobilité Automobile | 3.4 unités/VÉ | v2-pipeline-enrich | (aucun _source) |
| APH | Defense Win Rate | Taux de Succès aux Appels d'Offres Défense | 78 % | v2-pipeline-enrich | (aucun _source) |
| APH | Southeast Asia Capacity | Capacité en Asie du Sud-Est | 2.3 Mds unités | v2-pipeline-enrich | (aucun _source) |
| APH | Ventes +58% | Ventes +58% |   | v2-pipeline-enrich | ER/ES |
| APO | Cap 1000Md AUM | Cap 1000Md AUM |   | v2-pipeline-enrich | ER/ES |
| APO | Capacity Addition | Ajout de capacité | 500 M $ | v2-pipeline-enrich | (aucun _source) |
| APO | Client Retention | Rétention des clients | 85 % | v2-pipeline-enrich | (aucun _source) |
| APO | Credit IG | Crédit IG |   | v2-pipeline-enrich | ER/ES |
| APO | Digital Asset Growth | Croissance des actifs numériques | 10 Mds $ | v2-pipeline-enrich | (aucun _source) |
| APO | New Geography Expansion | Expansion dans de nouvelles géographies | 5 pays | v2-pipeline-enrich | (aucun _source) |
| APO | Origination 300Md | Origination 300Md |   | v2-pipeline-enrich | ER/ES |
| APO | Renaissance indus. | Renaissance indus. |   | v2-pipeline-enrich | ER/ES |
| APP | Marge EBITDA 85% | Marge EBITDA 85% |   | v2-pipeline-enrich | ER/ES |
| APTV | Adjusted Net Income Q1 2026 | Adjusted Net Income Q1 2026 |   | v2-pipeline-enrich | ER/ES |
| APTV | Cash from operations Q4 2025 | Cash from operations Q4 2025 |   | v2-pipeline-enrich | ER/ES |
| APTV | Record Q1 2026 revenue | Record Q1 2026 revenue |   | v2-pipeline-enrich | ER/ES |
| APTV | Record full‑year 2025 revenue | Record full‑year 2025 revenue |   | v2-pipeline-enrich | ER/ES |
| APTV | Spin‑off EDS | Spin‑off EDS |   | v2-pipeline-enrich | ER/ES |
| ARE | Construction Spending | Construction Spending |   | v2-pipeline-enrich | ER/ES |
| ARE | FFO per Share | FFO per Share |   | v2-pipeline-enrich | ER/ES |
| ARE | Guidance | Guidance |   | v2-pipeline-enrich | ER/ES |
| ARES | AUMCross600 | AUMCross600 |   | v2-pipeline-enrich | ER/ES |
| ARES | Asia AUM Share | Part de l'Asie dans l'AUM | 18.3 % | v2-pipeline-enrich | (aucun _source) |
| ARES | DividendIncrease | DividendIncrease |   | v2-pipeline-enrich | ER/ES |
| ARES | FeeEarningsQ4 | FeeEarningsQ4 |   | v2-pipeline-enrich | ER/ES |
| ARES | MgmtFeesGrowth | MgmtFeesGrowth |   | v2-pipeline-enrich | ER/ES |
| ARES | Real Estate Control Rate | Taux de contrôle immobilier | 72 % | v2-pipeline-enrich | (aucun _source) |
| ARES | RecordFundraisingQ1 | RecordFundraisingQ1 |   | v2-pipeline-enrich | ER/ES |
| ARM | Auto AI Wins | Victoires commerciales IA automobile | 17 contrats | v2-pipeline-enrich | (aucun _source) |
| ARM | Auto Platform Growth | Croissance des plateformes auto | 62 plateformes | v2-pipeline-enrich | (aucun _source) |
| ARM | China Tape-outs | Tape-outs en Chine | 154 unités | v2-pipeline-enrich | (aucun _source) |
| ARM | Edge AI Share | Part de marché IA en périphérie | 68 % | v2-pipeline-enrich | (aucun _source) |
| ARM | IoT Core Share | Part de marché des cœurs IoT | 78 % | v2-pipeline-enrich | (aucun _source) |
| ARM | Neoverse Clients | Clients Neoverse | 24 clients | v2-pipeline-enrich | (aucun _source) |
| ARM | Neoverse Deployments | Déploiements Neoverse | 19 déploiements | v2-pipeline-enrich | (aucun _source) |
| ARM | R&D Centers | Centres de R&D | 23 centres | v2-pipeline-enrich | (aucun _source) |
| ARM | R&D Labs | Laboratoires de R&D | 14 labos | v2-pipeline-enrich | (aucun _source) |
| ASML | EUV Fleet Growth | Croissance du parc de systèmes EUV | 215 unités | v2-pipeline-enrich | (aucun _source) |
| ASML | EUV Nanoimprint | Ventes de systèmes EUV Nanoimprint | 3 unités | v2-pipeline-enrich | (aucun _source) |
| ASML | Factory Capacity Add | Ajout de capacité d'usine | 75 unités | v2-pipeline-enrich | (aucun _source) |
| ASML | R&D Breakthroughs | Périmètre de R&D avancée | 5 projets | v2-pipeline-enrich | (aucun _source) |
| ATO | CapEx safety focus | CapEx safety focus |   | v2-pipeline-enrich | ER/ES |
| ATO | Dividend increase | Dividend increase |   | v2-pipeline-enrich | ER/ES |
| ATO | EPS guidance raised | EPS guidance raised |   | v2-pipeline-enrich | ER/ES |
| ATO | Regulatory outcomes | Regulatory outcomes |   | v2-pipeline-enrich | ER/ES |
| AVB | Capacité Exp | Capacité d'expansion | 5000 unités | v2-pipeline-enrich | (aucun _source) |
| AVB | Core FFO flat Q1 2026 | Core FFO flat Q1 2026 |   | v2-pipeline-enrich | ER/ES |
| AVB | Development Pipeline Yield | Rendement du pipeline de développement | 6.8 % | v2-pipeline-enrich | (aucun _source) |
| AVB | Dividend increase Q4 2025 | Dividend increase Q4 2025 |   | v2-pipeline-enrich | ER/ES |
| AVB | EPS down Q4 2025 | EPS down Q4 2025 |   | v2-pipeline-enrich | ER/ES |
| AVB | EPS up Q1 2026 | EPS up Q1 2026 |   | v2-pipeline-enrich | ER/ES |
| AVB | Expansion NOI Growth | Croissance du NOI des régions d'expansion | 14.2 % | v2-pipeline-enrich | (aucun _source) |
| AVB | Expansion Regions NOI | NOI des régions d'expansion | 185 Mds $ | v2-pipeline-enrich | (aucun _source) |
| AVB | Marché Part | Part de marché | 12.5 % | v2-pipeline-enrich | (aucun _source) |
| AVB | Resident Retention Rate | Taux de rétention des résidents | 61.5 % | v2-pipeline-enrich | (aucun _source) |
| AVGO | AI_REV_FY27_GUIDE | Prévision de chiffre d'affaires IA exercice 2027 | 115 Mds $ | v2-pipeline-enrich | transcript |
| AVGO | ANTHROPIC_GW_2027 | Déploiement prévu chez Anthropic en 2027 (TPU v8i) | 5 GW | v2-pipeline-enrich | transcript |
| AVGO | GW_PIPELINE_FY27_28 | Capacité de calcul visée chez les 6 clients XPU (exercices 2027-2028) | 30 GW | v2-pipeline-enrich | transcript |
| AVGO | RPO | Commandes fermes restant à livrer (obligations de performance restantes) | 179.2 Mds $ | v2-pipeline-enrich | 10-Q |
| AVGO | Software d'infrastructure | Revenu logiciel d'infrastructure (VMware) | 27.029 Mds $ | v2-pipeline | 10-K FY2025 (AVGO_2025-12-18), MD&A Net Revenue by Segment + 10-K FY2024 comparatif |
| AVGO | VMWARE_ARR_GROWTH | Croissance du revenu récurrent annuel (ARR) logiciels | 15 % | v2-pipeline-enrich | transcript |
| AVGO | XPU_SHARE_AI | Part des accélérateurs sur mesure (XPU) dans le CA IA | 73 % | v2-pipeline-enrich | transcript |
| AVGO | XPV_BACKSTOP_MAX | Garantie maximale sur la première tranche AI XPV | 29 Mds $ | v2-pipeline-enrich | 10-Q |
| AVGO | XPV_GW | Capacité de calcul financée par la plateforme AI XPV d'ici 2028 | 20 GW | v2-pipeline-enrich | transcript |
| AVY | Q2 Adjusted EPS | Q2 Adjusted EPS |   | v2-pipeline-enrich | ER/ES |
| AVY | Q2 EPS | Q2 EPS |   | v2-pipeline-enrich | ER/ES |
| AVY | Q3 Adjusted EPS | Q3 Adjusted EPS |   | v2-pipeline-enrich | ER/ES |
| AVY | Q3 EPS | Q3 EPS |   | v2-pipeline-enrich | ER/ES |
| AVY | Q3 Net sales | Q3 Net sales |   | v2-pipeline-enrich | ER/ES |
| AWK | CapitalInvest2025 | CapitalInvest2025 |   | v2-pipeline-enrich | ER/ES |
| AWK | DividendIncrease | DividendIncrease |   | v2-pipeline-enrich | ER/ES |
| AWK | MergerRegApproval | MergerRegApproval |   | v2-pipeline-enrich | ER/ES |
| AWK | ShareholderApproval | ShareholderApproval |   | v2-pipeline-enrich | ER/ES |
| AXON | 9 trim. >30% | 9 trim. >30% |   | v2-pipeline-enrich | ER/ES |
| AXON | AI x8 | AI x8 |   | v2-pipeline-enrich | ER/ES |
| AXON | Bookings +43% | Bookings +43% |   | v2-pipeline-enrich | ER/ES |
| AXON | Counter-drone x4 | Counter-drone x4 |   | v2-pipeline-enrich | ER/ES |
| AXON | NRR 125% | NRR 125% |   | v2-pipeline-enrich | ER/ES |
| AXON | Platform +95% | Platform +95% |   | v2-pipeline-enrich | ER/ES |
| AXP | AI developer kit | AI developer kit |   | v2-pipeline-enrich | ER/ES |
| AXP | Graphite Business Card launch | Graphite Business Card launch |   | v2-pipeline-enrich | ER/ES |
| AXP | NFL partnership | NFL partnership |   | v2-pipeline-enrich | ER/ES |
| AXP | Record Card Member spend growth | Record Card Member spend growth |   | v2-pipeline-enrich | ER/ES |
| AZO | Inventory Expansion | Inventory Expansion |   | v2-pipeline-enrich | ER/ES |
| AZO | Mega Hub Capacity | Capacité des Méga Hubs | 12.5 M unités | v2-pipeline-enrich | (aucun _source) |
| AZO | Mega Hub Expansion | Expansion des Méga Hubs | 18 stores | v2-pipeline-enrich | (aucun _source) |
| AZO | Mega Hub Utilization | Taux d'Utilisation des Méga Hubs | 85 % | v2-pipeline-enrich | (aucun _source) |
| AZO | Share Repurchase Activity | Share Repurchase Activity |   | v2-pipeline-enrich | ER/ES |
| AZO | Strong Same Store Growth | Strong Same Store Growth |   | v2-pipeline-enrich | ER/ES |
| BA | Acquisition Spirit | Acquisition Spirit |   | v2-pipeline-enrich | ER/ES |
| BA | Cash flow turnaround | Cash flow turnaround |   | v2-pipeline-enrich | ER/ES |
| BA | Digital Aviation gain | Digital Aviation gain |   | v2-pipeline-enrich | ER/ES |
| BA | Record backlog | Record backlog |   | v2-pipeline-enrich | ER/ES |
| BAC | Banque conso | Banque conso |   | v2-pipeline-enrich | ER/ES |
| BALL | EPS growth Q1 2026 | EPS growth Q1 2026 |   | v2-pipeline-enrich | ER/ES |
| BALL | Record free cash flow 2025 | Record free cash flow 2025 |   | v2-pipeline-enrich | ER/ES |
| BALL | Shareholder return target | Shareholder return target |   | v2-pipeline-enrich | ER/ES |
| BALL | Shipments increase Q1 2026 | Shipments increase Q1 2026 |   | v2-pipeline-enrich | ER/ES |
| BAX | Baisse organique Q1 2026 | Baisse organique Q1 2026 |   | v2-pipeline-enrich | ER/ES |
| BAX | Confiance du PDG | Confiance du PDG |   | v2-pipeline-enrich | ER/ES |
| BAX | Croissance déclarée Q1 2026 | Croissance déclarée Q1 2026 |   | v2-pipeline-enrich | ER/ES |
| BAX | Nouveau modèle opérationnel | Nouveau modèle opérationnel |   | v2-pipeline-enrich | ER/ES |
| BAYN.DE | Digital Installations | Installations numériques | 420 unités | v2-pipeline-enrich | (aucun _source) |
| BBY | AdsPartnerDoubling | AdsPartnerDoubling |   | v2-pipeline-enrich | ER/ES |
| BBY | CompSalesGrowth | CompSalesGrowth |   | v2-pipeline-enrich | ER/ES |
| BBY | MarketplaceLaunch | MarketplaceLaunch |   | v2-pipeline-enrich | ER/ES |
| BBY | OpsIncomeExpansion | OpsIncomeExpansion |   | v2-pipeline-enrich | ER/ES |
| BBY | Service Capacity Growth | Croissance de la capacité de service | 220 k interventions | v2-pipeline-enrich | (aucun _source) |
| BBY | Service Tech Capacity | Capacité des techniciens de service | 18.5 k techniciens | v2-pipeline-enrich | (aucun _source) |
| BDX | broad_based_execution | broad_based_execution |   | v2-pipeline-enrich | ER/ES |
| BDX | centrovena_launch | centrovena_launch |   | v2-pipeline-enrich | ER/ES |
| BDX | guidance_update | guidance_update |   | v2-pipeline-enrich | ER/ES |
| BDX | wellstar_partnership | wellstar_partnership |   | v2-pipeline-enrich | ER/ES |
| BEI.DE | Asia-Pacific Growth | Croissance organique en Asie-Pacifique | 11.4 % | v2-pipeline-enrich | (aucun _source) |
| BEI.DE | Eco-Friendly Packaging | Part du CA avec emballages durables | 67 % | v2-pipeline-enrich | (aucun _source) |
| BEI.DE | Green Factory Capacity | Capacité de production verte ajoutée | 120 M unités | v2-pipeline-enrich | (aucun _source) |
| BEI.DE | Nivea Skin Health | Chiffre d'affaires Nivea Skin Health | 1.8 Mds $ | v2-pipeline-enrich | (aucun _source) |
| BEN | AI agents in investment teams | Agents d'IA dans la gestion |   | v2-pipeline-enrich | Transcript |
| BEN | Canvas partners | Partenaires de la plateforme Canvas |   | v2-pipeline-enrich | Transcript |
| BEN | Digital assets AUM | Encours en actifs numériques |   | v2-pipeline-enrich | Transcript |
| BEN | FY26 private markets fundraising outlook | Objectif de levée en marchés privés 2026 |   | v2-pipeline-enrich | Transcript |
| BEN | Intelligence Hub sales uplift | Effet de l'Intelligence Hub sur les ventes |   | v2-pipeline-enrich | Transcript |
| BEN | Private markets fee profile | Rémunération des marchés privés |   | v2-pipeline-enrich | Transcript |
| BEN | Wealth channel private markets share | Part de la clientèle patrimoniale |   | v2-pipeline-enrich | Transcript |
| BEN | Western Asset SEC settlement | Règlement de l'enquête SEC sur Western Asset |   | v2-pipeline-enrich | Communiqué |
| BESI.AS | cpo_asic_use_cases | cpo_asic_use_cases |   | v2-pipeline-enrich | ER/ES |
| BESI.AS | hb_orders_q4_25 | hb_orders_q4_25 |   | v2-pipeline-enrich | ER/ES |
| BESI.AS | hb_prototype_50nm | hb_prototype_50nm |   | v2-pipeline-enrich | ER/ES |
| BESI.AS | hybrid_bonding_adoption | hybrid_bonding_adoption |   | v2-pipeline-enrich | ER/ES |
| BESI.AS | tc_next_5_customers | tc_next_5_customers |   | v2-pipeline-enrich | ER/ES |
| BF.B | Global Travel Retail Share | Part de marché en vente hors taxes | 14.3 % | v2-pipeline-enrich | (aucun _source) |
| BF.B | Herradura Organic Output | Production Biologique Herradura | 0.35 M unités | v2-pipeline-enrich | (aucun _source) |
| BF.B | Herradura Tequila Output | Production de Tequila Herradura | 4.2 M litres | v2-pipeline-enrich | (aucun _source) |
| BF.B | Jack Daniel's Cask Strength | Force de Caisse Jack Daniel's | 1.2 M unités | v2-pipeline-enrich | (aucun _source) |
| BF.B | Jack Daniel's Global Reach | Présence mondiale de Jack Daniel's | 170 pays | v2-pipeline-enrich | (aucun _source) |
| BF.B | Jack Daniel's NFT Sales | Ventes de NFT Jack Daniel's | 1.7 Mds $ | v2-pipeline-enrich | (aucun _source) |
| BF.B | New Whiskey Aging Warehouses | Nouveaux entrepôts de vieillissement | 6 entrepôts | v2-pipeline-enrich | (aucun _source) |
| BF.B | Operating Income |  |   | v2-pipeline | (aucun _source) |
| BF.B | Sustainable Distillery Count | Nombre de distilleries durables | 3 sites | v2-pipeline-enrich | (aucun _source) |
| BF.B | Sustainable Packaging Adoption | Adoption d'emballages durables | 42 % | v2-pipeline-enrich | (aucun _source) |
| BF.B | Tequila Herradura Expansion | Expansion de Tequila Herradura | 35 % | v2-pipeline-enrich | (aucun _source) |
| BF.B | Woodford Reserve Growth | Croissance de Woodford Reserve | 18.2 % | v2-pipeline-enrich | (aucun _source) |
| BF.B | Woodford Reserve MAU | Utilisateurs Mensuels Woodford Reserve | 850 k utilisateurs | v2-pipeline-enrich | (aucun _source) |
| BIIB | SKYCLARYS +30% | SKYCLARYS +30% |   | v2-pipeline-enrich | ER/ES |
| BKNG | Adjusted EBITDA up 12% | Adjusted EBITDA up 12% |   | v2-pipeline-enrich | ER/ES |
| BKNG | Asia-Pac Room Nights | Nuits réservées en Asie-Pacifique | 185 M unités | v2-pipeline-enrich | (aucun _source) |
| BKNG | Dividend declaration | Dividend declaration |   | v2-pipeline-enrich | ER/ES |
| BKNG | Italian tax accrual | Italian tax accrual |   | v2-pipeline-enrich | ER/ES |
| BKNG | Room nights growth exceeds expectations | Room nights growth exceeds expectations |   | v2-pipeline-enrich | ER/ES |
| BKR | Capacité Subsea | Capacité Subsea | 500 MW | v2-pipeline-enrich | (aucun _source) |
| BKR | Geothermal Customer Count | Nombre de clients géothermiques | 47 clients | v2-pipeline-enrich | (aucun _source) |
| BKR | Geothermal Fleet Size | Taille du parc géothermique | 18 unités | v2-pipeline-enrich | (aucun _source) |
| BKR | Geothermal Projects | Projets géothermiques | 14 projets | v2-pipeline-enrich | (aucun _source) |
| BKR | IET record | IET record |   | v2-pipeline-enrich | ER/ES |
| BKR | Parts de Marché | Parts de Marché | 12 % | v2-pipeline-enrich | (aucun _source) |
| BKR | Subsea Factory Capacity | Capacité usine sous-marine | 850 km | v2-pipeline-enrich | (aucun _source) |
| BKR | Subsea Orders | Commandes en sous-marin | 1.8 Mds $ | v2-pipeline-enrich | (aucun _source) |
| BKR | Subsea Project Wins | Projets gagnés en sous-marin | 7 projets | v2-pipeline-enrich | (aucun _source) |
| BLDR | AdjEBITDAQ1 | AdjEBITDAQ1 |   | v2-pipeline-enrich | ER/ES |
| BLDR | AdjEBITDAQ4 | AdjEBITDAQ4 |   | v2-pipeline-enrich | ER/ES |
| BLDR | SalesDeclineQ1 | SalesDeclineQ1 |   | v2-pipeline-enrich | ER/ES |
| BLDR | SalesDeclineQ4 | SalesDeclineQ4 |   | v2-pipeline-enrich | ER/ES |
| BLDR | ShareRepQ1 | ShareRepQ1 |   | v2-pipeline-enrich | ER/ES |
| BLK | Collecte record | Collecte record |   | v2-pipeline-enrich | ER/ES |
| BMY | Breyanzi CAR-T accelere | Breyanzi CAR-T accéléré |   | v2-pipeline-enrich | ER/ES |
| BMY | Camzyos x2 en un an | Camzyos x2 en un an |   | v2-pipeline-enrich | ER/ES |
| BMY | Cell Therapy Capacity | Capacité de production en thérapie cellulaire | 25 M unités | v2-pipeline-enrich | (aucun _source) |
| BMY | Cell Therapy Uptake Rate | Taux d'adoption des thérapies cellulaires | 340 traitements / 1k patients | v2-pipeline-enrich | (aucun _source) |
| BMY | Cell Therapy Utilization | Taux d'Utilisation des Thérapies Cellulaires | 68 % | v2-pipeline-enrich | (aucun _source) |
| BMY | Ex-U.S. Launch Pace | Lancements Hors États-Unis | 5 lancements | v2-pipeline-enrich | (aucun _source) |
| BMY | Ex-U.S. Launch Speed | Délai moyen de lancement hors États-Unis | 6.2 mois | v2-pipeline-enrich | (aucun _source) |
| BMY | Ex-U.S. Oncology Share | Part de marché en oncologie hors États-Unis | 23.4 % | v2-pipeline-enrich | (aucun _source) |
| BMY | Lancement Cobenfy | Lancement Cobenfy |   | v2-pipeline-enrich | ER/ES |
| BMY | Manufacturing Scale-Up | Extension des Capacités de Production | 35 % | v2-pipeline-enrich | (aucun _source) |
| BMY | Oncology Share | Part de Marché en Oncologie | 14.3 % | v2-pipeline-enrich | (aucun _source) |
| BMY | Pipeline Depth | Profondeur du Portefeuille de Recherche | 18 candidats | v2-pipeline-enrich | (aucun _source) |
| BMY | Portefeuille Croissance +12% | Portefeuille Croissance +12% |   | v2-pipeline-enrich | ER/ES |
| BMY | Resilience Eliquis | Résilience Eliquis |   | v2-pipeline-enrich | ER/ES |
| BNR.DE | Digital Active Customers | Clients actifs sur les plateformes digitales | 245000 clients | v2-pipeline-enrich | (aucun _source) |
| BNR.DE | Digital Orders | Commandes Digitales | 38.5 % | v2-pipeline-enrich | (aucun _source) |
| BNR.DE | Digital Platform Users | Utilisateurs actifs de la plateforme digitale | 125000 utilisateurs | v2-pipeline-enrich | (aucun _source) |
| BNR.DE | Digital Solution Attach Rate | Taux d'attachement des solutions numériques | 68 % | v2-pipeline-enrich | (aucun _source) |
| BNR.DE | New Application Labs | Labs d'application déployés | 7 labs | v2-pipeline-enrich | (aucun _source) |
| BNR.DE | Specialties EMEA Share | Part de marché Spécialités EMEA | 23.4 % | v2-pipeline-enrich | (aucun _source) |
| BNR.DE | Specialties Growth | Croissance organique des spécialités | 5.8 % | v2-pipeline-enrich | (aucun _source) |
| BNR.DE | Specialties Margin | Marge Spécialités | 24.1 % | v2-pipeline-enrich | (aucun _source) |
| BR | AI-Driven Client Growth | Croissance des Clients avec Solutions IA | 425 clients | v2-pipeline-enrich | (aucun _source) |
| BR | AI-Driven Client Solutions | Solutions clients pilotées par l'IA | 8 solutions | v2-pipeline-enrich | (aucun _source) |
| BR | Actifs numeriques GTO | Actifs numériques GTO |   | v2-pipeline-enrich | ER/ES |
| BR | Dividende 19e hausse | Dividende 19e hausse |   | v2-pipeline-enrich | ER/ES |
| BR | Outlook releve | Outlook relevé |   | v2-pipeline-enrich | ER/ES |
| BR | Positions actions +11% | Positions actions +11% |   | v2-pipeline-enrich | ER/ES |
| BR | Tokenisation & IA | Tokenisation & IA |   | v2-pipeline-enrich | ER/ES |
| BRK-B | Book Value |  |   | v2-pipeline | (aucun _source) |
| BRK-B | Cash Position |  |   | v2-pipeline | (aucun _source) |
| BRK.B | Apple Stake Value | Valeur de la participation dans Apple | 185.4 Mds $ | v2-pipeline-enrich | (aucun _source) |
| BRK.B | Book Value |  |   | v2-pipeline | (aucun _source) |
| BRK.B | Cash Position |  |   | v2-pipeline | (aucun _source) |
| BRK.B | Energy Regulated Assets | Actifs régulés dans l'énergie | 124.3 Mds $ | v2-pipeline-enrich | (aucun _source) |
| BRK.B | Operating Earnings |  |   | v2-pipeline | (aucun _source) |
| BRK.B | Share Buybacks | Rachats d'actions propres | 9.8 Mds $ | v2-pipeline-enrich | (aucun _source) |
| BRO | AI-Driven Placements | Placements pilotés par IA | 14.2 M contrats | v2-pipeline-enrich | (aucun _source) |
| BRO | Client Retention Rate | Taux de rétention client | 94.5 % | v2-pipeline-enrich | (aucun _source) |
| BRO | Contingents en hausse | Contingents en hausse |   | v2-pipeline-enrich | ER/ES |
| BRO | Croissance Clients Stratégiques | Croissance des Clients Stratégiques | 18 clients | v2-pipeline-enrich | (aucun _source) |
| BRO | Decelarion organique | Décélarion organique |   | v2-pipeline-enrich | ER/ES |
| BRO | Digital Placement Ratio | Ratio de Placements Digitaux | 41.5 % | v2-pipeline-enrich | (aucun _source) |
| BRO | Dividende releve | Dividende relevé |   | v2-pipeline-enrich | ER/ES |
| BRO | Europe M&A Integration | Taux d'Intégration M&A Europe | 78 % | v2-pipeline-enrich | (aucun _source) |
| BRO | Europe Revenue Penetration | Pénétration des Revenus en Europe | 22.4 % | v2-pipeline-enrich | (aucun _source) |
| BRO | International Expansion Rate | Taux d'expansion internationale | 7 marchés | v2-pipeline-enrich | (aucun _source) |
| BRO | RSC Topco / Accession | RSC Topco / Accession |   | v2-pipeline-enrich | ER/ES |
| BRO | Strategic Client Attach Rate | Taux d'Attachement Clients Stratégiques | 74 % | v2-pipeline-enrich | (aucun _source) |
| BWA | EPS increase | EPS increase |   | v2-pipeline-enrich | ER/ES |
| BWA | FCF boost | FCF boost |   | v2-pipeline-enrich | ER/ES |
| BWA | New awards | New awards |   | v2-pipeline-enrich | ER/ES |
| BWA | Operating margin up | Operating margin up |   | v2-pipeline-enrich | ER/ES |
| BWA | Shareholder return | Shareholder return |   | v2-pipeline-enrich | ER/ES |
| BX | DIV_Q1_2026 | DIV_Q1_2026 |   | v2-pipeline-enrich | ER/ES |
| BX | DIV_Q4_2025 | DIV_Q4_2025 |   | v2-pipeline-enrich | ER/ES |
| BX | INF_Q1_2026 | INF_Q1_2026 |   | v2-pipeline-enrich | ER/ES |
| BX | INF_Q4_2025 | INF_Q4_2025 |   | v2-pipeline-enrich | ER/ES |
| BX | STRAT_2025 | STRAT_2025 |   | v2-pipeline-enrich | ER/ES |
| BXP | Green Buildings | Immeubles verts certifiés | 78 immeubles | v2-pipeline-enrich | (aucun _source) |
| BXP | LEED Certifications | Certifications LEED | 42 bâtiments | v2-pipeline-enrich | (aucun _source) |
| BXP | Tech Tenant Mix | Part des locataires technologiques | 34 % | v2-pipeline-enrich | (aucun _source) |
| BXP | Urban Workspaces | Espaces de travail urbains lancés | 12 espaces | v2-pipeline-enrich | (aucun _source) |
| C | Demarrage 2026 | Démarrage 2026 |   | v2-pipeline-enrich | ER/ES |
| CAG | Frozen Capacity | Capacité de production surgelée | 4.7 M unités | v2-pipeline-enrich | (aucun _source) |
| CAG | Frozen Capacity Expansion | Expansion de la Capacité de Production Surgelée | 1.2 M tonnes | v2-pipeline-enrich | (aucun _source) |
| CAG | Innovation Launch Success Rate | Taux de réussite des lancements innovants | 65 % | v2-pipeline-enrich | (aucun _source) |
| CAG | Innovation Revenue | Revenus des innovations | 1.2 Mds $ | v2-pipeline-enrich | (aucun _source) |
| CAG | Organic Sales Growth | Croissance organique des ventes | 5.2 % | v2-pipeline-enrich | (aucun _source) |
| CAG | Plant-Based Innovation | Lancements de Produits Végétaux Innovants | 8 lancements | v2-pipeline-enrich | (aucun _source) |
| CAG | Plant-Based Penetration | Pénétration des Ventes en Produits à Base Végétale | 8.3 % | v2-pipeline-enrich | (aucun _source) |
| CAG | Plant-Based Sales | Ventes en produits à base végétale | 415 M $ | v2-pipeline-enrich | (aucun _source) |
| CAG | Plant-Based Share | Part de marché végétalienne | 18.3 % | v2-pipeline-enrich | (aucun _source) |
| CAG | Private Label Mix | Part des marques privées | 18.7 % | v2-pipeline-enrich | (aucun _source) |
| CAG | Private Label Penetration | Pénétration des Marques de Distributeur | 22.4 % | v2-pipeline-enrich | (aucun _source) |
| CAG | Retour a la croissance | Retour à la croissance |   | v2-pipeline-enrich | ER/ES |
| CAH | Acquisition_Q2_2026 | Acquisition_Q2_2026 |   | v2-pipeline-enrich | ER/ES |
| CAH | At-Home fill rate | Taux de service à domicile |   | v2-pipeline-enrich | Transcript |
| CAH | Buyback authorization increase | Autorisation de rachats relevée |   | v2-pipeline-enrich | Transcript |
| CAH | Cell and gene therapy share | Part du marché des thérapies géniques |   | v2-pipeline-enrich | Transcript |
| CAH | Digital Health Clients | Clients santé numérique | 1250 clients | v2-pipeline-enrich | (aucun _source) |
| CAH | FY27 EPS guidance | Prévision de BPA 2027 |   | v2-pipeline-enrich | Transcript |
| CAH | Four-year EPS track record | BPA doublé en quatre ans |   | v2-pipeline-enrich | Transcript |
| CAH | GAAP_Earnings_Q3_2026 | GAAP_Earnings_Q3_2026 |   | v2-pipeline-enrich | ER/ES |
| CAH | Guidance_Q2_2026 | Guidance_Q2_2026 |   | v2-pipeline-enrich | ER/ES |
| CAH | Healthcare Solutions Clients | Clients dans les solutions de santé | 4.8 k clients | v2-pipeline-enrich | (aucun _source) |
| CAH | Healthcare Solutions Retention | Taux de rétention des clients Healthcare Solutions | 94.7 % | v2-pipeline-enrich | (aucun _source) |
| CAH | Iran conflict GMPD risk | Risque Iran sur le profit GMPD |   | v2-pipeline-enrich | Transcript |
| CAH | New revolving credit facility | Nouvelle ligne de crédit |   | v2-pipeline-enrich | Transcript |
| CAH | Oncology Hub Growth | Croissance annuelle des hubs oncologiques | 15 sites | v2-pipeline-enrich | (aucun _source) |
| CAH | Oncology Hub Sites | Nombre de centres hub oncologie | 48 sites | v2-pipeline-enrich | (aucun _source) |
| CAH | Oncology Hub Utilization | Taux d'Utilisation des Centres Oncologie | 87.3 % | v2-pipeline-enrich | (aucun _source) |
| CAH | Oncology Network Reach | Couverture du réseau en oncologie | 1850 sites | v2-pipeline-enrich | (aucun _source) |
| CAH | Pharma DC Automation | Taux d'automatisation des centres de distribution pharmaceutiques | 68 % | v2-pipeline-enrich | (aucun _source) |
| CAH | Pharma DC Capacity | Capacité des centres de distribution pharmaceutiques | 25.3 M sq ft | v2-pipeline-enrich | (aucun _source) |
| CAH | Pharma Network Size | Taille du réseau pharmaceutique | 125 k pharmacies | v2-pipeline-enrich | (aucun _source) |
| CAH | Rev_Q2_2026 | Rev_Q2_2026 |   | v2-pipeline-enrich | ER/ES |
| CAH | Rev_Q3_2026 | Rev_Q3_2026 |   | v2-pipeline-enrich | ER/ES |
| CAH | Specialty Pharmacy Reach | Couverture Pharmacies Spécialisées | 1250 pharmacies | v2-pipeline-enrich | (aucun _source) |
| CARR | Adjusted EPS growth | Adjusted EPS growth |   | v2-pipeline-enrich | ER/ES |
| CARR | Debt reduction | Debt reduction |   | v2-pipeline-enrich | ER/ES |
| CARR | GAAP EPS surge | GAAP EPS surge |   | v2-pipeline-enrich | ER/ES |
| CARR | Operating margin expansion | Operating margin expansion |   | v2-pipeline-enrich | ER/ES |
| CARR | Shareholder returns | Shareholder returns |   | v2-pipeline-enrich | ER/ES |
| CASY | Midwest Store Density | Densité de magasins dans le Midwest | 187 stores | v2-pipeline-enrich | (aucun _source) |
| CASY | Pizza Order Growth | Croissance des commandes de pizza | 14.8 % | v2-pipeline-enrich | (aucun _source) |
| CASY | Pizza Sales Penetration | Pénétration des Ventes de Pizza | 38.2 % | v2-pipeline-enrich | (aucun _source) |
| CASY | Prepared Food Mix | Part des aliments préparés | 38.2 % | v2-pipeline-enrich | (aucun _source) |
| CASY | RecordFY2025 | RecordFY2025 |   | v2-pipeline-enrich | ER/ES |
| CASY | SP500Inclusion2026 | SP500Inclusion2026 |   | v2-pipeline-enrich | ER/ES |
| CASY | car_wash_stores | Magasins équipés d'une station de lavage | 240 magasins | v2-pipeline-enrich | 10-Q |
| CASY | cefco_remodel_lift | Hausse des ventes aliments préparés après conversion Cefco | 30 % | v2-pipeline-enrich | transcript |
| CASY | cefco_remodels_q | Magasins Cefco rénovés au trimestre | 24 magasins | v2-pipeline-enrich | transcript |
| CASY | nicotine_alt_growth | Croissance des alternatives nicotiniques | 47 % | v2-pipeline-enrich | transcript |
| CASY | opis_midcont_decline | Recul des volumes carburant région Mid-Continent (OPIS) | 6 % | v2-pipeline-enrich | transcript |
| CASY | private_chips_units | Croissance en unités des chips marque propre | 16 % | v2-pipeline-enrich | transcript |
| CASY | rewards_members | Membres du programme Casey's Rewards | 11 M membres | v2-pipeline-enrich | transcript |
| CASY | rtd_cocktails_growth | Croissance des cocktails prêts à boire | 30 % | v2-pipeline-enrich | transcript |
| CASY | wings_only_orders | Part des commandes uniquement ailes de poulet | 38 % | v2-pipeline-enrich | transcript |
| CAT | AI-Enabled Machines | Machines équipées d'IA | 65000 unités | v2-pipeline-enrich | (aucun _source) |
| CAT | Africa Revenue Share | Part Revenus Afrique | 9.3 % | v2-pipeline-enrich | (aucun _source) |
| CAT | Annee centenaire record | Année centenaire record |   | v2-pipeline-enrich | ER/ES |
| CAT | Autonomous Fleets | Flottes autonomes déployées | 48 unités | v2-pipeline-enrich | (aucun _source) |
| CAT | Autonomous Mine Deployments | Déploiements miniers autonomes | 17 sites | v2-pipeline-enrich | (aucun _source) |
| CAT | Electric Fleet Growth | Croissance du parc électrique | 1250 unités | v2-pipeline-enrich | (aucun _source) |
| CAT | Electric Machine Orders | Commandes de machines électriques | 1.8 Mds $ | v2-pipeline-enrich | (aucun _source) |
| CAT | Electric TAM Expansion | Expansion du TAM électrique | 18.2 Mds $ | v2-pipeline-enrich | (aucun _source) |
| CAT | Fleet Attach Rate | Taux d'attachement de flotte | 68 % | v2-pipeline-enrich | (aucun _source) |
| CAT | Fleet Uptime Rate | Taux de disponibilité de la flotte | 94.7 % | v2-pipeline-enrich | (aucun _source) |
| CAT | Latin America Share | Part de marché Amérique latine | 34.2 % | v2-pipeline-enrich | (aucun _source) |
| CB | Primes +10,7% | Primes +10,7% |   | v2-pipeline-enrich | ER/ES |
| CBK.DE | Digital Clients | Clients Digitaux Actifs | 6.8 M clients | v2-pipeline-enrich | (aucun _source) |
| CBOE | Derivatives revenue +38% Q4 2025 | Derivatives revenue +38% Q4 2025 |   | v2-pipeline-enrich | ER/ES |
| CBOE | Derivatives up 32% Q1 2026 | Derivatives up 32% Q1 2026 |   | v2-pipeline-enrich | ER/ES |
| CBOE | Record EPS Q1 2026 | Record EPS Q1 2026 |   | v2-pipeline-enrich | ER/ES |
| CBOE | Record EPS Q4 2025 | Record EPS Q4 2025 |   | v2-pipeline-enrich | ER/ES |
| CBOE | Record Net Revenue Q1 2026 | Record Net Revenue Q1 2026 |   | v2-pipeline-enrich | ER/ES |
| CBRE | Services +20% | Services +20% |   | v2-pipeline-enrich | ER/ES |
| CCEP | New Brand Revenue | Revenus des marques lancées récemment | 850 Mds $ | v2-pipeline-enrich | (aucun _source) |
| CCEP | Recycled PET Use | Utilisation de PET recyclé | 78 % | v2-pipeline-enrich | (aucun _source) |
| CCEP | Sustainable Packaging | Emballages durables | 78 % | v2-pipeline-enrich | (aucun _source) |
| CCEP | Zero Sugar Growth | Croissance des boissons zéro sucre | 8.7 % | v2-pipeline-enrich | (aucun _source) |
| CCEP | Zero Sugar Mix | Part des boissons zéro sucre | 42.3 % | v2-pipeline-enrich | (aucun _source) |
| CCEP | Zero Sugar Volume | Volume des boissons zéro sucre | 12.8 Mds unités | v2-pipeline-enrich | (aucun _source) |
| CCI | 5G Tower Share | Part des tours 5G | 68 % | v2-pipeline-enrich | (aucun _source) |
| CCI | Customer Attach Rate | Taux d'Attachement Client par Tour | 1.85 locataires | v2-pipeline-enrich | (aucun _source) |
| CCI | DISH default | DISH default |   | v2-pipeline-enrich | ER/ES |
| CCI | Edge Compute Nodes | Nœuds de calcul en périphérie | 1450 sites | v2-pipeline-enrich | (aucun _source) |
| CCI | Edge Data Centers | Centres de données périphériques déployés | 340 centres | v2-pipeline-enrich | (aucun _source) |
| CCI | Edge Site Rollout | Déploiement de Sites Edge | 4200 sites | v2-pipeline-enrich | (aucun _source) |
| CCI | Fiber Mileage | Kilométrage de Fibre Détenue | 95000 miles | v2-pipeline-enrich | (aucun _source) |
| CCI | Fiber Route Mileage | Kilométrage des itinéraires de fibre | 98000 miles | v2-pipeline-enrich | (aucun _source) |
| CCI | Small Cell Adds | Ajouts Annuels de Petites Cellules | 32500 unités | v2-pipeline-enrich | (aucun _source) |
| CCI | Small Cell Attach Rate | Taux d'attachement des petites cellules | 4.7 unités par client | v2-pipeline-enrich | (aucun _source) |
| CCI | Spectrum sale | Spectrum sale |   | v2-pipeline-enrich | ER/ES |
| CCI | Termination & recovery | Termination & recovery |   | v2-pipeline-enrich | ER/ES |
| CCI | Tower Density | Densité de Tours par Marché | 14.7 tours | v2-pipeline-enrich | (aucun _source) |
| CDNS | ai_product_demand_q4_2025 | ai_product_demand_q4_2025 |   | v2-pipeline-enrich | ER/ES |
| CDNS | ai_transformation_agentstack | ai_transformation_agentstack |   | v2-pipeline-enrich | ER/ES |
| CDNS | non_gaap_margin_q1_2026 | non_gaap_margin_q1_2026 |   | v2-pipeline-enrich | ER/ES |
| CDNS | record_backlog_q1_2026 | record_backlog_q1_2026 |   | v2-pipeline-enrich | ER/ES |
| CDNS | revenue_growth_fy2025 | revenue_growth_fy2025 |   | v2-pipeline-enrich | ER/ES |
| CDW | Edge AI Infrastructure Share | Part de marché en infrastructure IA Edge | 24 % | v2-pipeline-enrich | (aucun _source) |
| CDW | Public Sector AI Share | Part de marché IA secteur public | 31 % | v2-pipeline-enrich | (aucun _source) |
| CDW | Public Sector AI Wins | Victoires IA dans le secteur public | 47 contrats | v2-pipeline-enrich | (aucun _source) |
| CDW | Supply Chain Capacity | Capacité de la chaîne d'approvisionnement | 5000 unités | v2-pipeline-enrich | (aucun _source) |
| CEG | Barron's #1 sustainability | Barron's #1 sustainability |   | v2-pipeline-enrich | ER/ES |
| CEG | Calpine acquisition | Calpine acquisition |   | v2-pipeline-enrich | ER/ES |
| CEG | Pastoria Solar commissioned | Pastoria Solar commissioned |   | v2-pipeline-enrich | ER/ES |
| CEG | Pin Oak Creek operational | Pin Oak Creek operational |   | v2-pipeline-enrich | ER/ES |
| CF | Gain de litige Q1 2026 | Gain de litige Q1 2026 |   | v2-pipeline-enrich | ER/ES |
| CF | Performance opérationnelle Q1 2026 | Performance opérationnelle Q1 2026 |   | v2-pipeline-enrich | ER/ES |
| CF | Rachat d'actions 2025 | Rachat d'actions 2025 |   | v2-pipeline-enrich | ER/ES |
| CF | Taux d'incidents 2025 | Taux d'incidents 2025 |   | v2-pipeline-enrich | ER/ES |
| CFG | AI-Driven Cost Savings | Économies de Coûts Dérivées de l'IA | 85 M $ | v2-pipeline-enrich | (aucun _source) |
| CFG | AI-Driven Efficiency | Efficacité pilotée par l'IA | 18.7 % | v2-pipeline-enrich | (aucun _source) |
| CHD | AI-Powered Oral Care | Soins bucco-dentaires avec IA | 8.7 % | v2-pipeline-enrich | (aucun _source) |
| CHD | Asia-Pacific Revenue Share | Part des revenus en Asie-Pacifique | 18.2 % | v2-pipeline-enrich | (aucun _source) |
| CHD | Capacity Expansion Rate | Taux d'expansion de capacité | 8.5 % | v2-pipeline-enrich | (aucun _source) |
| CHD | E-commerce Sales Penetration | Pénétration des Ventes en Ligne | 19.4 % | v2-pipeline-enrich | (aucun _source) |
| CHD | Europe Revenue Share | Part des revenus en Europe | 19.4 % | v2-pipeline-enrich | (aucun _source) |
| CHD | Latin America Revenue Share | Part du Chiffre d'Affaires en Amérique Latine | 8.7 % | v2-pipeline-enrich | (aucun _source) |
| CHD | Oral Care AI Adoption | Taux d'adoption IA soins bucco-dentaires | 35 % | v2-pipeline-enrich | (aucun _source) |
| CHD | Q1 2026 Adjusted Gross Margin Expansion | Q1 2026 Adjusted Gross Margin Expansion |   | v2-pipeline-enrich | ER/ES |
| CHD | Q1 2026 Net Sales Beat Outlook | Q1 2026 Net Sales Beat Outlook |   | v2-pipeline-enrich | ER/ES |
| CHD | Q4 2025 Cash Flow Strength | Q4 2025 Cash Flow Strength |   | v2-pipeline-enrich | ER/ES |
| CHD | Q4 2025 Dividend Increase | Q4 2025 Dividend Increase |   | v2-pipeline-enrich | ER/ES |
| CHD | Q4 2025 Full‑Year Sales Growth | Q4 2025 Full‑Year Sales Growth |   | v2-pipeline-enrich | ER/ES |
| CHD | R&D Investment Rate | Taux d'Investissement en R&D | 2.1 % | v2-pipeline-enrich | (aucun _source) |
| CHD | Smart Appliance Attach Rate | Taux d'attachement aux appareils intelligents | 4.7 unités | v2-pipeline-enrich | (aucun _source) |
| CHRW | Parts de marche | Parts de marché |   | v2-pipeline-enrich | ER/ES |
| CHTR | AdjEBITDADeclineQ1_2026 | AdjEBITDADeclineQ1_2026 |   | v2-pipeline-enrich | ER/ES |
| CHTR | RevenueDeclineQ1_2026 | RevenueDeclineQ1_2026 |   | v2-pipeline-enrich | ER/ES |
| CHTR | RevenueDeclineQ4_2025 | RevenueDeclineQ4_2025 |   | v2-pipeline-enrich | ER/ES |
| CHTR | ShareBuybackQ1_2026 | ShareBuybackQ1_2026 |   | v2-pipeline-enrich | ER/ES |
| CHTR | ShareBuybackQ4_2025 | ShareBuybackQ4_2025 |   | v2-pipeline-enrich | ER/ES |
| CI | adjop_full2025 | adjop_full2025 |   | v2-pipeline-enrich | ER/ES |
| CI | adjop_q1_2026 | adjop_q1_2026 |   | v2-pipeline-enrich | ER/ES |
| CI | div_inc | div_inc |   | v2-pipeline-enrich | ER/ES |
| CI | netinc_q1_2026 | netinc_q1_2026 |   | v2-pipeline-enrich | ER/ES |
| CI | rev_q1_2026 | rev_q1_2026 |   | v2-pipeline-enrich | ER/ES |
| CIEN | Cloud MAU | Utilisateurs actifs mensuels Cloud | 2.4 M unités | v2-pipeline-enrich | (aucun _source) |
| CIEN | Reseau IA +40% | Réseau IA +40% |   | v2-pipeline-enrich | ER/ES |
| CINF | Agent Count Growth | Croissance du nombre d'agents | 3450 agents | v2-pipeline-enrich | (aucun _source) |
| CINF | Agent Growth in South | Croissance des agents dans le Sud | 142 agents | v2-pipeline-enrich | (aucun _source) |
| CINF | Commercial P&C Share | Part de marché en assurance pro | 8.7 % | v2-pipeline-enrich | (aucun _source) |
| CINF | Commercial Policy Attach Rate | Taux d'attachement des polices commerciales | 2.4 polices/agent | v2-pipeline-enrich | (aucun _source) |
| CINF | Digital Claims Capacity | Capacité de traitement numérique des sinistres | 125 k sinistres | v2-pipeline-enrich | (aucun _source) |
| CINF | Policyholder Retention Rate | Taux de rétention des assurés | 92.3 % | v2-pipeline-enrich | (aucun _source) |
| CINF | Tech-Enabled Claims Ratio | Ratio des sinistres gérés par IA | 38 % | v2-pipeline-enrich | (aucun _source) |
| CL | Q3CashFlow | Q3CashFlow |   | v2-pipeline-enrich | ER/ES |
| CL | Q3ToothpasteShare | Q3ToothpasteShare |   | v2-pipeline-enrich | ER/ES |
| CL | Q4AdSpend | Q4AdSpend |   | v2-pipeline-enrich | ER/ES |
| CL | Q4MarginExpansion | Q4MarginExpansion |   | v2-pipeline-enrich | ER/ES |
| CL | Q4SalesGrowth | Q4SalesGrowth |   | v2-pipeline-enrich | ER/ES |
| CLX | Adjusted EPS growth | Adjusted EPS growth |   | v2-pipeline-enrich | ER/ES |
| CLX | Cash flow decline | Cash flow decline |   | v2-pipeline-enrich | ER/ES |
| CLX | Flat net sales, slight organic decline | Flat net sales, slight organic decline |   | v2-pipeline-enrich | ER/ES |
| CLX | Margin pressure | Margin pressure |   | v2-pipeline-enrich | ER/ES |
| CLX | Partage Marché Nettoyants | Partage de marché - Nettoyants ménagers | 28.4 % | v2-pipeline-enrich | (aucun _source) |
| CLX | Sustainable Packaging Share | Part emballages durables | 68 % | v2-pipeline-enrich | (aucun _source) |
| CMCSA | BestWirelessYear | BestWirelessYear |   | v2-pipeline-enrich | ER/ES |
| CMCSA | BroadbandLosses | BroadbandLosses |   | v2-pipeline-enrich | ER/ES |
| CMCSA | FCFRecord | FCFRecord |   | v2-pipeline-enrich | ER/ES |
| CMCSA | FCFReturn | FCFReturn |   | v2-pipeline-enrich | ER/ES |
| CMCSA | WirelessRecord | WirelessRecord |   | v2-pipeline-enrich | ER/ES |
| CMG | Digital 38,6% | Digital 38,6 % |   | v2-pipeline-enrich | ER/ES |
| CMI | Power Systems record | Power Systems record |   | v2-pipeline-enrich | ER/ES |
| CMS | 2025 guidance raised | 2025 guidance raised |   | v2-pipeline-enrich | ER/ES |
| CMS | Clean Energy PPA | Capacité sous contrat PPA en énergies propres | 1.4 GW | v2-pipeline-enrich | (aucun _source) |
| CMS | Dividend increase | Dividend increase |   | v2-pipeline-enrich | ER/ES |
| CMS | Guidance reaffirmed | Guidance reaffirmed |   | v2-pipeline-enrich | ER/ES |
| CMS | NorthStar outperformance | NorthStar outperformance |   | v2-pipeline-enrich | ER/ES |
| CMS | Q1 2026 EPS beat | Q1 2026 EPS beat |   | v2-pipeline-enrich | ER/ES |
| CMS | Renewable PPA MW | Capacité renouvelable sous contrat PPA (MW) | 1450 MW | v2-pipeline-enrich | (aucun _source) |
| CNC | Commercial_HBR_Q4_2025 | Commercial_HBR_Q4_2025 |   | v2-pipeline-enrich | ER/ES |
| CNC | Consolidated_HBR_Q4_2025 | Consolidated_HBR_Q4_2025 |   | v2-pipeline-enrich | ER/ES |
| CNC | Debt_Reduction_Q1_2026 | Debt_Reduction_Q1_2026 |   | v2-pipeline-enrich | ER/ES |
| CNC | EPS_Q1_2026 | EPS_Q1_2026 |   | v2-pipeline-enrich | ER/ES |
| CNC | Medicaid_HBR_Q1_2026 | Medicaid_HBR_Q1_2026 |   | v2-pipeline-enrich | ER/ES |
| CNP | Data center load outlook | Data center load outlook | 8 GW | v2-pipeline | ER |
| CNP | Demand growth projection | Demand growth projection | 50 % | v2-pipeline | ER |
| CNP | Industrial load commitment | Industrial load commitment | 12.2 GW | v2-pipeline | ER |
| CNP | Non‑GAAP EPS increase | Non‑GAAP EPS increase | 25 % | v2-pipeline | ER |
| COF | Auto Loan Share | Part de marché des prêts auto | 19.3 % | v2-pipeline-enrich | (aucun _source) |
| COF | Digital Engagement | Taux d'engagement numérique | 68.4 % | v2-pipeline-enrich | (aucun _source) |
| COF | Rachat Discover | Rachat Discover | 5.15 Md $ | v2-pipeline | ER |
| COHR | CapInvestQ3 | CapInvestQ3 | 1 Fait | v2-pipeline | ER |
| COHR | EPSGrowthQ2 | EPSGrowthQ2 | 71 % | v2-pipeline | ER |
| COHR | EPSGrowthQ3 | EPSGrowthQ3 | 0.97 $ | v2-pipeline | ER |
| COHR | RevGrowthQ2 | RevGrowthQ2 | 17 % | v2-pipeline | ER |
| COHR | RevGrowthQ3 | RevGrowthQ3 | 21 % | v2-pipeline | ER |
| COIN | Acquisition Deribit | Acquisition Deribit | 1 Fait | v2-pipeline | data-lake |
| COIN | Adoption Stablecoin USDC | Adoption Stablecoin USDC | 74 Md $ | v2-pipeline | data-lake |
| COIN | Crypto Users | Utilisateurs de crypto-monnaies | 100 M | v2-pipeline-enrich | (aucun _source) |
| COIN | Everything Exchange | Everything Exchange | 90 % | v2-pipeline | data-lake |
| COIN | USDC Adoption Rate | Taux d'adoption de l'USDC | 9.8 M utilisateurs | v2-pipeline-enrich | (aucun _source) |
| COIN | USDC Utilisation Rate | Taux d'Utilisation de l'USDC | 68.3 % | v2-pipeline-enrich | (aucun _source) |
| COIN | USDC Yield Growth | Croissance du Rendement USDC | 8.2 % | v2-pipeline-enrich | (aucun _source) |
| COIN | USDC Yield Share | Part du rendement USDC | 68.2 % | v2-pipeline-enrich | (aucun _source) |
| COIN | USDC Yield Stability | Stabilité du Rendement USDC | 2.1 % | v2-pipeline-enrich | (aucun _source) |
| CON.DE | ADAS Design Wins | Projets Gagnés en Aide à la Conduite | 18 projets | v2-pipeline-enrich | (aucun _source) |
| CON.DE | EV Battery Systems | Systèmes de Batteries pour Véhicules Électriques | 2.3 M unités | v2-pipeline-enrich | (aucun _source) |
| COO | COO_Americas_Underlying | Croissance sous-jacente Amériques hors déstockage | 5 % | v2-pipeline-enrich | transcript |
| COO | COO_China_RevShare | Poids de la Chine dans le chiffre d'affaires (plafond) | 2 % du CA | v2-pipeline-enrich | transcript |
| COO | COO_Denmark_IVF_Cycles | Cycles de FIV remboursés au Danemark | 6 cycles | v2-pipeline-enrich | transcript |
| COO | COO_MedDevices_Growth | Croissance des dispositifs médicaux CooperSurgical | 4 % | v2-pipeline-enrich | transcript |
| COO | COO_MiSight_Growth | Croissance organique de MiSight (myopie de l'enfant) | 20 % | v2-pipeline-enrich | transcript |
| COO | COO_MyDayToric_Rx | Avance de gamme MyDay toric (options de prescription) | 30 % | v2-pipeline-enrich | transcript |
| COO | COO_SalesForce_Doors | Points de vente supplémentaires couverts par la force de vente US | 5000 points de vente | v2-pipeline-enrich | transcript |
| COP | Alaska LNG Progress | Avancement du projet Alaska LNG | 68 % | v2-pipeline-enrich | (aucun _source) |
| COP | Digital Drilling Uptime | Temps d'activité des forages numériques | 94.3 % | v2-pipeline-enrich | (aucun _source) |
| COP | Integration Marathon | Integration Marathon | 45 % | v2-pipeline | ER |
| COP | LNG Asia Spot Share | Part de marché Asie sur le spot GNL | 18.7 % | v2-pipeline-enrich | (aucun _source) |
| COP | LNG Export Ramps | Volumes d'export de GNL | 12.4 M tonnes | v2-pipeline-enrich | (aucun _source) |
| COP | Permian Capacity | Capacité de production dans le bassin de Permian | 520 M barils/jour | v2-pipeline-enrich | (aucun _source) |
| COP | Permian ROCE | ROCE du bassin Permien | 28.5 % | v2-pipeline-enrich | (aucun _source) |
| COR | Core operating income acceleration | Accélération du cœur de métier |   | v2-pipeline-enrich | Transcript |
| COR | EPSJump | EPSJump | 8.4 $ | v2-pipeline | ER |
| COR | GuidanceRaise | GuidanceRaise | 17.45 $ | v2-pipeline | ER |
| COR | List price headwind | Baisses de prix des laboratoires |   | v2-pipeline-enrich | Transcript |
| COR | MWI Covetrus merger impact | Impact de la fusion MWI |   | v2-pipeline-enrich | Transcript |
| COR | MWI underlying growth | Croissance de la santé animale |   | v2-pipeline-enrich | Transcript |
| COR | Operating income guidance | Prévision de résultat opérationnel |   | v2-pipeline-enrich | Transcript |
| COR | Opex excluding MSOs | Charges hors cabinets spécialisés |   | v2-pipeline-enrich | Transcript |
| COR | RCA term loan repaid | Prêt RCA remboursé |   | v2-pipeline-enrich | Transcript |
| COR | RevGrowth | RevGrowth | 78.4 Md $ | v2-pipeline | ER |
| COR | ShareRepurchase | ShareRepurchase | 1 $ | v2-pipeline | ER |
| COST | France Warehouse Ramp | Montée en puissance des entrepôts en France | 15.2 % | v2-pipeline-enrich | (aucun _source) |
| COST | Fresh Food Attach Rate | Taux d'attachement des produits frais | 68.4 % | v2-pipeline-enrich | (aucun _source) |
| COST | International Membership Penetration | Pénétration des membres internationaux par pays | 38.7 membres par million | v2-pipeline-enrich | (aucun _source) |
| COST | Mexico Member Growth | Croissance des membres au Mexique | 8.7 M membres | v2-pipeline-enrich | (aucun _source) |
| COST | Mexico Warehouse Growth | Ouvertures de nouveaux entrepôts au Mexique | 5 stores | v2-pipeline-enrich | (aucun _source) |
| COST | Ventes Q3 2026 | Ventes Q3 exercice 2026 | 69.15 Md $ | v2-pipeline | ER |
| CPAY | Acquisition d'AvidXchange | Acquisition d'AvidXchange | 500 M $ | v2-pipeline | ER |
| CPAY | Acquisitions majeures 2024 | Acquisitions majeures 2024 | 20 % | v2-pipeline | ER |
| CPAY | Croissance du segment Corporate Payments Q1 2025 | Croissance du segment Corporate Payments Q1 2025 | 19 % | v2-pipeline | ER |
| CPAY | Partenariat Mastercard | Partenariat Mastercard | 1 Fait | v2-pipeline | ER |
| CPAY | Record de revenus Q4 2024 | Record de revenus Q4 2024 | 1 Fait | v2-pipeline | ER |
| CPB | International Soup Growth | Croissance des Ventes de Soupe à l'International | 9.7 % | v2-pipeline-enrich | (aucun _source) |
| CPB | International Soup Share | Part de Marché Internationale en Soupe | 4.7 % | v2-pipeline-enrich | (aucun _source) |
| CPB | Plant-Based Growth | Croissance des Ventes en Produits à Base Végétale | 18.2 % | v2-pipeline-enrich | (aucun _source) |
| CPB | Plant-Based Penetration | Pénétration des Produits à Base Végétale | 8.3 % | v2-pipeline-enrich | (aucun _source) |
| CPB | Plant-Based Sales | Ventes en Produits Végétaux | 425 M $ | v2-pipeline-enrich | (aucun _source) |
| CPB | R&D Launch Velocity | Vélocité des Lancements issus de la R&D | 4.3 lancements/trimestre | v2-pipeline-enrich | (aucun _source) |
| CPB | R&D Pipeline Depth | Profondeur du Portefeuille R&D | 14 projets | v2-pipeline-enrich | (aucun _source) |
| CPB | Sustainable Sourcing | Ingrédients Durables Approvisionnés | 94 % | v2-pipeline-enrich | (aucun _source) |
| CPB | ebit_gain | ebit_gain | 239 M $ | v2-pipeline | ER |
| CPB | rao_milestone | rao_milestone | 1 Md $ | v2-pipeline | ER |
| CPB | sales_decline | sales_decline | 2.4 Md $ | v2-pipeline | ER |
| CPB | storm_impact | storm_impact | 14 M $ | v2-pipeline | ER |
| CPRT | ACV gross merchandise value 2025 ~$10B | Volume d'affaires d'ACV, société en cours de rachat |   | v2-pipeline-enrich | Transcript |
| CPRT | BluCar Q4 2026 nearly +20% | Croissance de BluCar |   | v2-pipeline-enrich | Transcript |
| CPRT | Collision claim frequency -3.4% | Fréquence des sinistres collision |   | v2-pipeline-enrich | Transcript |
| CPRT | Collision severity +8.8% | Coût moyen d'un sinistre collision |   | v2-pipeline-enrich | Transcript |
| CPRT | Dealer units Q4 2026 +5.8% | Véhicules vendus pour les concessionnaires (US) |   | v2-pipeline-enrich | Transcript |
| CPRT | Dedicated wholesale facilities 25 | Sites dédiés au marché de gros (US) |   | v2-pipeline-enrich | Transcript |
| CPRT | Global assignments Q4 2026 -2.2% | Véhicules confiés à Copart (monde) |   | v2-pipeline-enrich | Transcript |
| CPRT | International buyers dollar share FY2026 45.7% | Part des acheteurs étrangers en valeur (US) |   | v2-pipeline-enrich | Transcript |
| CPRT | NI Q3 2025 +6.4% | NI Q3 2025 +6.4% | 24.3 M $ | v2-pipeline | ER |
| CPRT | NI Q3 2026 -1.0% | NI Q3 2026 -1.0% | 1 % | v2-pipeline | ER |
| CPRT | NI Q4 2025 +22.9% | NI Q4 2025 +22.9% | 73.8 M $ | v2-pipeline | ER |
| CPRT | New buyers share FY2026 8.9% | Part des ventes à de nouveaux acheteurs |   | v2-pipeline-enrich | Transcript |
| CPRT | OpEx per car Q4 2026 +12.7% | Coût d'exploitation par véhicule |   | v2-pipeline-enrich | Transcript |
| CPRT | Rev Q3 2026 +2.1% | CA T3 2026 +2,1 % | 25.4 M $ | v2-pipeline | ER |
| CPRT | Revenue per unit Q4 2026 +5.4% | Revenu par véhicule vendu |   | v2-pipeline-enrich | Transcript |
| CPT | Lease-up de Camden Village District | Lease-up de Camden Village District | 139.4 M $ | v2-pipeline | data-lake |
| CPT | Nouveau programme de commercial paper | Nouveau programme de commercial paper | 1 Fait | v2-pipeline | data-lake |
| CPT | Relèvement guidance Core FFO 2025 | Relèvement guidance Core FFO 2025 | 1 Fait | v2-pipeline | data-lake |
| CRH | Americas Materials accelere | Americas Materials accélère | 14 % | v2-pipeline | ER |
| CRH | Entree au S&P 500 | Entrée au S&P 500 | 8 % | v2-pipeline | ER |
| CRH | International en redressement | International en redressement | 32 % | v2-pipeline | ER |
| CRH | Pivot vers l'eau | Pivot vers l'eau | 0.7 Md $ | v2-pipeline | ER |
| CRH | Rotation de portefeuille | Rotation de portefeuille | 1.9 $ | v2-pipeline | ER |
| CRL | EPSDropQ3 | EPSDropQ3 | 10.1 % | v2-pipeline | ER |
| CRL | MarginDropQ4 | MarginDropQ4 | 13.1 % | v2-pipeline | ER |
| CRL | RevDeclineQ4 | RevDeclineQ4 | 1.01 Md $ | v2-pipeline | ER |
| CRL | RevGrowthQ3 | RevGrowthQ3 | 1.03 Md $ | v2-pipeline | ER |
| CRM | 29 000 deals Agentforce | 29 000 deals Agentforce | 800 M $ | v2-pipeline | ER |
| CRM | 3,8 Md AWU delivres | 3,8 Md AWU délivrés | 111 % | v2-pipeline | ER |
| CRM | 52 000 Md records ingeres | 52 000 Md records ingérés | 136 % | v2-pipeline | ER |
| CRM | Agentforce ARR x2.7 | Agentforce ARR x2.7 | 3.4 Md $ | v2-pipeline | ER |
| CRM | Agentforce Apps revenue +9% | Revenu Agentforce Apps +9% | 6910 M $ | v2-pipeline | 10-Q Q1 FY2027 |
| CRM | Data 360 & Headless Platform revenue +25% | Revenu Data 360 et plateforme +25% | 3683 M $ | v2-pipeline | 10-Q Q1 FY2027 |
| CRM | Dividendes verses -9,2% | Dividendes verses en recul | 365 M $ | v2-pipeline | 10-Q Q1 FY2027 |
| CRM | Operating margin ~21% | Marge opérationnelle proche de 21% | 21 % | v2-pipeline | 10-Q Q1 FY2027 |
| CRM | RPO record 72 Md$ | RPO record 72 Md$ | 35.1 Md $ | v2-pipeline | ER |
| CRWD | Bascule IA-cyber | Bascule IA-cyber | 1 Fait | v2-pipeline | ER |
| CRWD | Cap des 5 Md$ ARR | Cap des 5 Md$ ARR | 5.25 Md $ | v2-pipeline | ER |
| CRWD | Cloud SIEM Customers | Clients Utilisant Cloud SIEM | 2.3 k | v2-pipeline-enrich | (aucun _source) |
| CRWD | Cloud SIEM Growth | Croissance Cloud SIEM | 62 % | v2-pipeline-enrich | (aucun _source) |
| CRWD | Coalition QuiltWorks | Coalition QuiltWorks | 1 Fait | v2-pipeline | ER |
| CRWD | Momentum Falcon Flex | Momentum Falcon Flex | 1.69 Md $ | v2-pipeline | ER |
| CRWD | ROI 273% Forrester | ROI 273% Forrester | 273 % | v2-pipeline | ER |
| CRWD | Zero Trust Clients | Clients Zéro Trust | 245 clients | v2-pipeline-enrich | (aucun _source) |
| CRWD | Zero Trust Expansion | Expansion du périmètre Zéro Trust | 340 clients | v2-pipeline-enrich | (aucun _source) |
| CRWD | Zero Trust Workloads | Charge de travail Zéro Trust | 4.3 M unités | v2-pipeline-enrich | (aucun _source) |
| CSCO | AI_HYPERSCALER_REV_SHARE | Part de l'IA cloud dans le chiffre d'affaires |   | v2-pipeline-enrich | 10-K |
| CSCO | AI_SUPPORT_CASES | Demandes d'assistance résolues par l'IA |   | v2-pipeline-enrich | transcript |
| CSCO | CA abonnements | Chiffre d'affaires des abonnements | 31.526 Mds $ | v2-pipeline | (aucun _source) |
| CSCO | CLOUD_CONTROL_SIGNUPS | Inscriptions à Cisco Cloud Control |   | v2-pipeline-enrich | transcript |
| CSCO | Commandes IA 1,3 Md$ | Commandes IA 1,3 Md$ | 1.3 Md $ | v2-pipeline | ER |
| CSCO | DC_NETWORKING_ORDERS | Commandes réseau des centres de données |   | v2-pipeline-enrich | transcript |
| CSCO | Global Cloud Tenant Wins | Nouveaux Grands Clients Cloud | 7 clients | v2-pipeline-enrich | (aucun _source) |
| CSCO | Global IoT Tenant Growth | Croissance des locataires mondiaux IoT | 47 clients | v2-pipeline-enrich | (aucun _source) |
| CSCO | Observabilité | Chiffre d'affaires produit Observabilité | 1.055 Mds $ | v2-pipeline | (aucun _source) |
| CSCO | RESTRUCTURING_FY26 | Plan de restructuration 2026 |   | v2-pipeline-enrich | 10-K |
| CSCO | SPLUNK_NEW_LOGOS | Nouveaux clients Splunk |   | v2-pipeline-enrich | transcript |
| CSCO | WIFI7_ORDER_SHARE | Part du Wi-Fi 7 dans les commandes sans fil |   | v2-pipeline-enrich | transcript |
| CSGP | Apartments.com >1 Md$ | Apartments.com >1 Md$ | 1 Md $ | v2-pipeline | ER |
| CSGP | Homes.com +600% | Homes.com +600% | 600 % | v2-pipeline | ER |
| CSGP | Lancement Homes.com | Lancement Homes.com | 40 M $ | v2-pipeline | ER |
| CSGP | Marges 41% commercial | Marges 41% commercial | 41 % | v2-pipeline | ER |
| CSGP | Trafic record 183M | Trafic record 183M | 183 M $ | v2-pipeline | ER |
| CTAS | Autres services accelerent | Autres services accélèrent | 12.9 % | v2-pipeline | ER |
| CTAS | Marge record route-based | Marge record route-based | 8.2 % | v2-pipeline | ER |
| CTAS | Organique soutenu | Organique soutenu | 7.8 % | v2-pipeline | ER |
| CTSH | AI Velocity Gap | AI Velocity Gap | 1 Fait | v2-pipeline | data-lake |
| CTSH | Deux mega deals >1 Md$ | Deux mega deals >1 Md$ | 1 Md $ | v2-pipeline | data-lake |
| CTSH | Financial Services Rev | Revenu Services financiers | 5.753 Mds $ | v2-pipeline | (aucun _source) |
| CTSH | Health Sciences Rev | Revenu Santé et sciences de la vie | 5.932 Mds $ | v2-pipeline | (aucun _source) |
| CTSH | Products & Resources Rev | Revenu Produits et ressources | 4.782 Mds $ | v2-pipeline | (aucun _source) |
| CTSH | Retour winner's circle | Retour winner's circle | 50 % | v2-pipeline | data-lake |
| CTSH | TCV grands contrats +70% | TCV grands contrats +70% | 70 % | v2-pipeline | data-lake |
| CTVA | AI-Driven Yield Uplift | Gain de Rendement Grâce à l'IA | 8.7 % | v2-pipeline-enrich | (aucun _source) |
| CTVA | Bio-Seed Launches | Lancements Semences Biologiques | 14 lancements | v2-pipeline-enrich | (aucun _source) |
| CTVA | Bio-Seed Pipeline | Bio-Seed Pipeline | 8 variétés | v2-pipeline-enrich | (aucun _source) |
| CTVA | Bio-Trait Adoption | Taux d'Adoption des Bio-Traits | 42.3 % | v2-pipeline-enrich | (aucun _source) |
| CTVA | Digital Farming Users | Utilisateurs Agriculture Numérique | 2.3 M utilisateurs | v2-pipeline-enrich | (aucun _source) |
| CTVA | Scission en deux | Scission en deux | 1 Fait | v2-pipeline | ER |
| CTVA | Sustainable Capacity Add | Ajout Capacité Durable | 1.2 M tonnes/an | v2-pipeline-enrich | (aucun _source) |
| CTVA | Trait Launches | Nouveaux Traits Lancés | 4 traits | v2-pipeline-enrich | (aucun _source) |
| CTVA | Trait Penetration | Taux de Pénétration des Traits | 68 % | v2-pipeline-enrich | (aucun _source) |
| CVNA | 6e trimestre +40% | 6e trimestre +40% | 40 % | v2-pipeline | ER |
| CVS | CEO appointment | CEO appointment | 1 Fait | v2-pipeline | ER |
| CVS | Cost-based reimbursement | Cost-based reimbursement | 1 Fait | v2-pipeline | ER |
| CVS | Prior authorizations speed | Prior authorizations speed | 95 % | v2-pipeline | ER |
| CVS | Q1 2026 results | Q1 2026 results | 100.4 Md $ | v2-pipeline | ER |
| CVS | Q4 2025 results | Q4 2025 results | 105.7 Md $ | v2-pipeline | ER |
| CVX | Production +15% | Production +15% | 5 Md $ | v2-pipeline | ER |
| D | Guidance affirmation | Guidance affirmation | 3.45 $ | v2-pipeline | ER |
| D | Long‑term growth guidance extended | Long‑term growth guidance extended | 5 % | v2-pipeline | ER |
| D | Net income decline Q1 | Net income decline Q1 | 621 M $ | v2-pipeline | ER |
| D | Operating earnings rise Q1 | Operating earnings rise Q1 | 847 M $ | v2-pipeline | ER |
| DAL | Discipline de capacité | Discipline de capacité | 1 Fait | v2-pipeline | data-lake |
| DAL | Hausse dividende +25% | Hausse dividende +25% | 25 % | v2-pipeline | data-lake |
| DAL | Marge record | Marge record |   | v2-pipeline-enrich | ER/ES |
| DAL | Notation investment grade Fitch | Notation investment grade Fitch | 1 Fait | v2-pipeline | data-lake |
| DASH | Adjusted EBITDA growth Q4 2025 | Adjusted EBITDA growth Q4 2025 | 780 M $ | v2-pipeline | ER |
| DASH | GAAP net income jump Q4 2025 | GAAP net income jump Q4 2025 | 213 M $ | v2-pipeline | ER |
| DASH | Marketplace GOV expansion Q4 2025 | Marketplace GOV expansion Q4 2025 | 29.7 Md $ | v2-pipeline | ER |
| DASH | Record MAU growth | Record MAU growth | 1 Fait | v2-pipeline | ER |
| DASH | Total Orders surge Q1 2026 | Total Orders surge Q1 2026 | 933 M $ | v2-pipeline | ER |
| DD | Demande electronique IA | Demande électronique IA | 6 % | v2-pipeline | data-lake |
| DD | Rachat actions 2 Mds | Rachat actions 2 Mds | 2 Md $ | v2-pipeline | data-lake |
| DD | Spin-off Qnity | Spin-off Qnity | 1 Fait | v2-pipeline | data-lake |
| DD | ai_salesplay_winrate | Taux de réussite des actions commerciales assistées par l'IA | 30 % | v2-pipeline-enrich | transcript |
| DD | auto_portfolio_rev | Portefeuille automobile | 900 M$ | v2-pipeline-enrich | transcript |
| DD | copq_pct_sales | Coût de la non-qualité | 4 % du CA | v2-pipeline-enrich | transcript |
| DD | dle_market | Marché adressable de l'extraction directe du lithium | 200 M$ | v2-pipeline-enrich | transcript |
| DD | ev_battery_rev | CA batteries de véhicules électriques | 70 M$ | v2-pipeline-enrich | transcript |
| DD | ma_firepower | Capacité disponible pour acquisitions | 1 Md$ | v2-pipeline-enrich | transcript |
| DD | net_productivity_target | Objectif de productivité nette | 3 % du coût des ventes | v2-pipeline-enrich | transcript |
| DD | upw_semi_growth | Croissance des ventes d'eau ultra-pure aux fabricants de puces | 20 % | v2-pipeline-enrich | transcript |
| DDOG | Clients >1 M ARR | Clients à plus de 1 M$ d'ARR | 462 clients | v2-pipeline | (aucun _source) |
| DDOG | Clients >100k ARR | Clients à plus de 100 000 $ d'ARR | 3610 clients | v2-pipeline | (aucun _source) |
| DDOG | Clients haut de gamme | Clients haut de gamme | 100 $ | v2-pipeline | ER |
| DE | Bas de cycle 2026 | Bas de cycle 2026 | 1 Fait | v2-pipeline | ER |
| DE | Machines connectées | Machines connectées |   | v2-pipeline-enrich | Transcript |
| DE | Remboursements droits de douane | Remboursements de droits de douane |   | v2-pipeline-enrich | 10-Q |
| DE | Revenus encaissés d'avance | Revenus encaissés d'avance |   | v2-pipeline-enrich | 10-Q |
| DE | See & Spray sur 1/3 des commandes | Pulvérisateurs See & Spray commandés |   | v2-pipeline-enrich | Transcript |
| DE | Semoirs avancés 2027 | Semoirs avec options avancées |   | v2-pipeline-enrich | Transcript |
| DE | SmartGrade +50 % | Adoption du guidage SmartGrade |   | v2-pipeline-enrich | Transcript |
| DE | Tracteurs d'occasion -40 % | Stocks de tracteurs d'occasion récents |   | v2-pipeline-enrich | Transcript |
| DECK | DTC Store Count | Nombre de magasins DTC | 248 stores | v2-pipeline-enrich | (aucun _source) |
| DECK | HOKA China Entry | Pénétration de HOKA en Chine | 8.2 % | v2-pipeline-enrich | (aucun _source) |
| DECK | HOKA DTC Growth | Croissance DTC HOKA | 34.2 % | v2-pipeline-enrich | (aucun _source) |
| DECK | HOKA Run Club Size | Taille communauté HOKA Run Club | 142 k membres | v2-pipeline-enrich | (aucun _source) |
| DECK | HOKA moteur | HOKA moteur | 671.2 M $ | v2-pipeline | ER |
| DECK | Teva Revival Rate | Taux de croissance Teva | 27.5 % | v2-pipeline-enrich | (aucun _source) |
| DECK | UGG EMEA Share | Part de marché UGG EMEA | 18.7 % | v2-pipeline-enrich | (aucun _source) |
| DELL | AI_CUSTOMERS | Clients Dell AI Factory | 6500 clients | v2-pipeline-enrich | transcript |
| DELL | AI_ORDERS | Commandes de serveurs IA du trimestre | 60.9 Mds $ | v2-pipeline-enrich | transcript |
| DELL | DELL_IP_STREAK | Trimestres consécutifs de demande stockage Dell IP au-dessus du marché | 6 trimestres | v2-pipeline-enrich | transcript |
| DELL | DFS_ORIGINATIONS | Nouveaux financements accordés par Dell Financial Services | 7.5 Mds $ | v2-pipeline-enrich | 10-Q |
| DELL | OLD_SRV_BASE | Parc installé de serveurs 14G ou plus anciens | 1.2 M actifs | v2-pipeline-enrich | transcript |
| DELL | OPEX_RATE | Charges opérationnelles en % du chiffre d'affaires | 8.5 % du CA | v2-pipeline-enrich | transcript |
| DELL | SRV_18G_CONSOLIDATION | Ratio de consolidation des serveurs 18G | 14 anciens serveurs pour 1 | v2-pipeline-enrich | transcript |
| DELL | TRAD_SRV_SHARE_GAIN | Gain de part de marché serveurs traditionnels (2 trimestres) | 10 points | v2-pipeline-enrich | transcript |
| DG | EPS jump Q4 2025 | EPS jump Q4 2025 | 121.8 % | v2-pipeline | ER |
| DG | Net sales rise Q3 2025 | Net sales rise Q3 2025 | 4.6 % | v2-pipeline | ER |
| DG | Operating profit surge Q4 2025 | Operating profit surge Q4 2025 | 606.3 M $ | v2-pipeline | ER |
| DG | Real estate growth plan 2026 | Real estate growth plan exercice 2026 | 1 Fait | v2-pipeline | ER |
| DG | Same-store sales up Q3 2025 | Same-store sales up Q3 2025 | 2.5 % | v2-pipeline | ER |
| DGX | Advanced Diagnostics growth | Advanced Diagnostics growth | 1 Fait | v2-pipeline | ER |
| DGX | Dividend increase | Dividend increase | 7.5 % | v2-pipeline | ER |
| DGX | Q1 2026 EPS up 15.5% | Q1 2026 EPS up 15.5% | 15.5 % | v2-pipeline | ER |
| DGX | Q1 2026 revenue up 9.2% | Q1 2026 revenue up 9.2% | 2.9 Md $ | v2-pipeline | ER |
| DGX | Q4 2025 revenue up 7.1% | Q4 2025 revenue up 7.1% | 2.81 Md $ | v2-pipeline | ER |
| DHI | Commandes +11% | Commandes +11% | 9.2 Md $ | v2-pipeline | ER |
| DHI | Controlled Lots | Nombre de terrains contrôlés par contrat d'achat | 345.6 M unités | v2-pipeline-enrich | (aucun _source) |
| DHI | Controlled Lots Growth | Croissance des terrains contrôlés | 12.4 M unités | v2-pipeline-enrich | (aucun _source) |
| DHI | Lots in Sun Belt | Lots détenus dans le Sun Belt | 145000 lots | v2-pipeline-enrich | (aucun _source) |
| DHI | Sun Belt Lot Growth | Croissance des Terrains en Sun Belt | 14.2 % | v2-pipeline-enrich | (aucun _source) |
| DHI | Sun Belt Lot Share | Part de Marché des Terrains en Sun Belt | 22.4 % | v2-pipeline-enrich | (aucun _source) |
| DHR | Acquisition Masimo | Acquisition Masimo | 1 Fait | v2-pipeline | 10-Q Q2 FY2026 |
| DHR | Approbation FDA Cepheid | Approbation FDA Cepheid | 1 Fait | v2-pipeline | ER |
| DHR | Croissance EPS ajusté | Croissance EPS ajusté | 10 % | v2-pipeline | ER |
| DHR | Force Bioprocessing Q4 2025 | Force Bioprocessing Q4 2025 | 1 Fait | v2-pipeline | ER |
| DHR | Innovation produits 2025 | Innovation produits 2025 | 1 Fait | v2-pipeline | ER |
| DIS | Streaming rentable | Streaming rentable | 189 M $ | v2-pipeline | ER |
| DLR | Bookings |  |   | v2-pipeline | (aucun _source) |
| DLR | Capacite IA | Capacité IA | 3 GW | v2-pipeline | ER |
| DLR | Lease Rate |  |   | v2-pipeline | (aucun _source) |
| DLTR | 20e annee positive | 20e année positive | 1 Fait | v2-pipeline | ER |
| DOC | Healthpeak ownership of Janus | Healthpeak ownership of Janus | 6.9 Md $ | v2-pipeline | ER |
| DOC | Janus Living IPO | Janus Living IPO | 880 M $ | v2-pipeline | ER |
| DOC | Lease activity Q1 2026 | Lease activity Q1 2026 | 1.2 M $ | v2-pipeline | ER |
| DOC | Revenue & EBITDA growth | Revenue & EBITDA growth | 35 % | v2-pipeline | ER |
| DOV | Discontinued ops contribution | Discontinued ops contribution | 1 Fait | v2-pipeline | ER |
| DOV | Interest expense decline | Interest expense decline | 1 Fait | v2-pipeline | ER |
| DOV | Net earnings surge | Net earnings surge | 632221 $ | v2-pipeline | ER |
| DOV | Operating earnings up | Operating earnings up | 1 Fait | v2-pipeline | ER |
| DPW.DE | DHL Green Certificates | Certificats carbone vendus | 1.2 Mds $ | v2-pipeline-enrich | (aucun _source) |
| DPW.DE | Drone Delivery Routes | Routes de livraison par drone certifiées | 47 routes | v2-pipeline-enrich | (aucun _source) |
| DPW.DE | E-Bike Delivery Fleet | Flotte de livraison en vélos électriques | 12500 vélos | v2-pipeline-enrich | (aucun _source) |
| DPW.DE | Same-Hour Delivery Cities | Villes avec livraison en moins d'une heure | 18 villes | v2-pipeline-enrich | (aucun _source) |
| DPZ | App DAU Growth | Croissance des utilisateurs quotidiens actifs de l'application | 4.8 M unités | v2-pipeline-enrich | (aucun _source) |
| DPZ | Asia Store Growth | Croissance des magasins en Asie | 67 stores | v2-pipeline-enrich | (aucun _source) |
| DPZ | Delivery Time | Temps de livraison | 25 minutes | v2-pipeline-enrich | (aucun _source) |
| DPZ | Digital Orders Share | Part des commandes numériques | 68.4 % | v2-pipeline-enrich | (aucun _source) |
| DPZ | Digital Sales | Ventes numériques | 45.6 % du total des ventes | v2-pipeline-enrich | (aucun _source) |
| DPZ | Dividend increase | Dividend increase | 15 % | v2-pipeline | ER |
| DPZ | Eco-Fleet Vehicles | Véhicules de livraison écologiques | 1250 vehicles | v2-pipeline-enrich | (aucun _source) |
| DPZ | International Store Openings | Ouvertures de magasins internationaux | 217 stores | v2-pipeline-enrich | (aucun _source) |
| DPZ | New Product Launch Velocity | Vélocité de lancement de nouveaux produits | 4.3 lancements/trimestre | v2-pipeline-enrich | (aucun _source) |
| DPZ | Operating income up | Operating income up | 9.6 % | v2-pipeline | ER |
| DPZ | Share repurchase program | Share repurchase program | 1 Md $ | v2-pipeline | ER |
| DPZ | Store expansion | Store expansion | 1 Fait | v2-pipeline | ER |
| DPZ | Sustainable Stores | Magasins durables | 1200 magasins | v2-pipeline-enrich | (aucun _source) |
| DRI | AdjEPSGrowthQ3 | AdjEPSGrowthQ3 | 5.4 % | v2-pipeline | ER |
| DRI | BenchmarkOutperformance | BenchmarkOutperformance | 1 Fait | v2-pipeline | ER |
| DRI | CommodityHeadwinds | CommodityHeadwinds | 1 Fait | v2-pipeline | ER |
| DRI | NetNewRestaurantsQ3 | NetNewRestaurantsQ3 | 1 Fait | v2-pipeline | ER |
| DRI | ShareRepurchaseQ2 | ShareRepurchaseQ2 | 222 M $ | v2-pipeline | ER |
| DTE | Investissement reseau | Investissement réseau | 4.3 Md $ | v2-pipeline | ER |
| DVA | cash_flow_q1_2026 | cash_flow_q1_2026 | 321 M $ | v2-pipeline | ER |
| DVA | operating_income_q1_2026 | operating_income_q1_2026 | 482 M $ | v2-pipeline | ER |
| DVA | operating_income_q4_2025 | operating_income_q4_2025 | 561 M $ | v2-pipeline | ER |
| DVA | share_repurchase_q1_2026 | share_repurchase_q1_2026 | 3 M $ | v2-pipeline | ER |
| DVA | share_repurchase_q4_2025 | share_repurchase_q4_2025 | 2.7 M $ | v2-pipeline | ER |
| DVN | Accords LNG et gaz electrique | Accords LNG et gaz électrique | 1 Fait | v2-pipeline | data-lake |
| DVN | Acquisition Delaware Basin | Acquisition Delaware Basin | 168 M $ | v2-pipeline | data-lake |
| DVN | Cible optimisation 1 Md$ | Cible optimisation 1 Md$ | 1 Md $ | v2-pipeline | data-lake |
| DVN | Fusion Coterra | Fusion Coterra | 1 Fait | v2-pipeline | data-lake |
| DVN | Plan FCF +1 Md$ | Plan FCF +1 Md$ |   | v2-pipeline-enrich | ER/ES |
| DXCM | G7 15‑Day launch Q1 2026 | G7 15‑Day launch Q1 2026 | 1 Fait | v2-pipeline | ER |
| DXCM | G7 15‑Day system launch Q4 2025 | G7 15‑Day system launch Q4 2025 | 1 Fait | v2-pipeline | ER |
| DXCM | Operating margin boost Q1 2026 | Operating margin boost Q1 2026 | 255.3 M $ | v2-pipeline | ER |
| DXCM | Revenue growth Q1 2026 | Revenue growth Q1 2026 | 1.192 Md $ | v2-pipeline | ER |
| DXCM | Revenue growth Q4 2025 | Revenue growth Q4 2025 | 1.26 Md $ | v2-pipeline | ER |
| EBAY | customer_satisfaction | customer_satisfaction | 1 Fait | v2-pipeline | ER |
| EBAY | org_speed | org_speed | 1 Fait | v2-pipeline | ER |
| EBAY | workforce_cut | workforce_cut | 9 % | v2-pipeline | ER |
| ECHO | Broadband Subs | Abonnés Broadband (Hughes) | 0.739 M | v2-pipeline | 10-K EchoStar FY2025 (SATS_2026-03-02), Broadband subscribers as of period end |
| ECL | 2025 EPS outlook | 2025 EPS outlook | 7.42 $ | v2-pipeline | ER |
| ECL | Double-digit EPS growth | Double-digit EPS growth | 1 Fait | v2-pipeline | ER |
| ECL | Organic sales resilience | Organic sales resilience | 3 % | v2-pipeline | ER |
| ECL | Value pricing and productivity | Value pricing and productivity | 1 Fait | v2-pipeline | ER |
| ED | Q1 2025 capital plan | Q1 2025 capital plan | 72 Md $ | v2-pipeline | ER |
| ED | Q1 2025 strategy execution | Q1 2025 strategy execution | 1 Fait | v2-pipeline | ER |
| ED | Q1 2026 electrification trend | Q1 2026 electrification trend | 1 Fait | v2-pipeline | ER |
| ED | Q1 2026 operational strength | Q1 2026 operational strength | 1 Fait | v2-pipeline | ER |
| EFX | USIS +12% | USIS +12% | 12 % | v2-pipeline | ER |
| EG | Cashflow record | Cashflow record | 5 Md $ | v2-pipeline | ER |
| EG | Catastrophe loss surge | Catastrophe loss surge | 672 M $ | v2-pipeline | ER |
| EG | Combined ratio pressure | Combined ratio pressure | 102.3 % | v2-pipeline | ER |
| EG | Investment income peak | Investment income peak | 2 Md $ | v2-pipeline | ER |
| EG | Reserve hit | Reserve hit | 593 M $ | v2-pipeline | ER |
| EIX | Core EPS guidance affirmed | Core EPS guidance affirmed | 5.9 $ | v2-pipeline | ER |
| EIX | Net income decline Q1 2026 | Net income decline Q1 2026 | 531 M $ | v2-pipeline | ER |
| EIX | Regulatory progress on GRC decision | Regulatory progress on GRC decision | 1 Fait | v2-pipeline | ER |
| EIX | Wildfire Recovery Compensation Program | Wildfire Recovery Compensation Program | 1 Fait | v2-pipeline | ER |
| EIX | Wildfire mitigation progress | Wildfire mitigation progress | 90 % | v2-pipeline | ER |
| EL | Parfum et Chine | Parfum et Chine | 1 Fait | v2-pipeline | ER |
| ELV | Capital Return | Capital Return | 3.3 Md $ | v2-pipeline | ER |
| ELV | EPS Outlook Upgrade | EPS Outlook Upgrade | 34.05 $ | v2-pipeline | ER |
| ELV | Guidance 2025 | Guidance exercice 2025 | 90 % | v2-pipeline | ER |
| ELV | Revenue Growth Q3 2025 | Revenue Growth Q3 2025 | 50.1 Md $ | v2-pipeline | ER |
| ELV | Strategic Partnership | Strategic Partnership | 1 Fait | v2-pipeline | ER |
| EME | Q1 2026 EPS surge | Q1 2026 EPS surge | 30 % | v2-pipeline | ER |
| EME | RPO growth Q1 2026 | RPO growth Q1 2026 | 15.62 Md $ | v2-pipeline | ER |
| EME | RPO growth Q4 2025 | RPO growth Q4 2025 | 13.25 Md $ | v2-pipeline | ER |
| EME | Record Q1 2026 revenue | Record Q1 2026 revenue | 4.63 Md $ | v2-pipeline | ER |
| EME | Record Q4 2025 revenue | Record Q4 2025 revenue | 4.51 Md $ | v2-pipeline | ER |
| EMR | APAC Factory Adds | Nouveaux sites de production en Asie-Pacifique | 6 sites | v2-pipeline-enrich | (aucun _source) |
| EMR | Accelerating innovation and new products | Accelerating innovation and new products | 1 Fait | v2-pipeline | ER |
| EMR | Fourth consecutive quarter of strong orders | Fourth consecutive quarter of strong orders | 1 Fait | v2-pipeline | ER |
| EMR | Margins exceed expectations | Margins exceed expectations | 1 Fait | v2-pipeline | ER |
| EMR | Orders up 5% driven by Software Systems | Orders up 5% driven by Software Systems | 5 % | v2-pipeline | ER |
| EMR | R&D Pipeline Value | Valeur du portefeuille R&D | 0.9 Mds $ | v2-pipeline-enrich | (aucun _source) |
| EMR | Sales impacted by Middle East conflict | Sales impacted by Middle East conflict | 1 Fait | v2-pipeline | ER |
| EMR | Smart Valve Penetration | Pénétration des vannes intelligentes | 38 % | v2-pipeline-enrich | (aucun _source) |
| EMR | Software Attach Rate | Taux d'attachement logiciel | 68 % | v2-pipeline-enrich | (aucun _source) |
| EOAN.DE | Green Heat Networks | Réseaux de chaleur verte en service | 37 réseaux | v2-pipeline-enrich | (aucun _source) |
| EOAN.DE | Home Battery Units | Unités de stockage domestique vendues | 48000 unités | v2-pipeline-enrich | (aucun _source) |
| EOG | Acquisition Encino | Acquisition Encino | 4.5 Md $ | v2-pipeline | ER |
| EOG | Cout puits en baisse | Cout puits en baisse | 1 Fait | v2-pipeline | ER |
| EOG | Diversification internationale | Diversification internationale | 41.7 M $ | v2-pipeline | ER |
| EOG | Drilled but Uncompleted Wells | Puits forés mais non complétés | 142 unités | v2-pipeline-enrich | (aucun _source) |
| EOG | Free cash flow soutenu | Free cash flow soutenu | 493 M $ | v2-pipeline | ER |
| EOG | Production record | Production record | 399 M $ | v2-pipeline | ER |
| EOG | Reserves Replacement | Taux de remplacement des réserves | 115 % | v2-pipeline-enrich | (aucun _source) |
| EOG | Well Productivity | Productivité des puits | 1,250 boepd | v2-pipeline-enrich | (aucun _source) |
| EOG | Well Productivity Growth | Croissance de la Productivité des Puits | 15.2 % | v2-pipeline-enrich | (aucun _source) |
| EOG | Well Productivity Index | Indice de Productivité des Puits | 1.8 mboe/ft | v2-pipeline-enrich | (aucun _source) |
| EPAM | Retour a une croissance organique soutenue | Retour a une croissance organique soutenue | 1 Fait | v2-pipeline | data-lake |
| EPAM | Revenus AI-native en acceleration | Revenus AI-native en acceleration | 1 Fait | v2-pipeline | data-lake |
| EPAM | Succession du fondateur a la direction | Succession du fondateur à la direction | 1 Fait | v2-pipeline | data-lake |
| EQIX | Dividende +25% | Dividende +25% | 25 % | v2-pipeline | ER |
| EQIX | Revenus Q2 +11% | Revenus Q2 +11% | 2 Md $ | v2-pipeline | ER |
| EQIX | Revenus Q3 +12% | Revenus Q3 +12% | 2.1 Md $ | v2-pipeline | ER |
| EQIX | Réservations canal 40% | Réservations canal 40% | 40 % | v2-pipeline | ER |
| EQR | Blended Rate +130 pb | Blended Rate +130 pb | 1 Fait | v2-pipeline | ER |
| EQR | Concessions -21% | Concessions -21% | 21 % | v2-pipeline | ER |
| EQR | Demande locataires aises | Demande locataires aises | 1 Fait | v2-pipeline | ER |
| EQR | Pivot Expansion Markets | Pivot Expansion Markets | 1.26 Md $ | v2-pipeline | ER |
| EQT | Cout par pied -13% | Coût par pied -13% | 13 % | v2-pipeline | ER |
| EQT | Demande electrique IA | Demande électrique IA | 1 Fait | v2-pipeline | ER |
| EQT | FCF trimestriel record | FCF trimestriel record | 1832 M $ | v2-pipeline | ER |
| EQT | Low-Carbon Drilling Rate | Taux de forage à faible carbone | 18 puits | v2-pipeline-enrich | (aucun _source) |
| EQT | Midstream Capacity Growth | Croissance de la capacité midstream | 12.5 Bcf/jour | v2-pipeline-enrich | (aucun _source) |
| EQT | Offtake GNL 4,5 Mtpa | Offtake GNL 4,5 Mtpa | 4.5 M $ | v2-pipeline | ER |
| EQT | Resilience tempete Fern | Resilience tempête Fern | 1 Fait | v2-pipeline | ER |
| ERIE | foundation_100m | foundation_100m | 80.6 M $ | v2-pipeline | ER |
| ERIE | investment_income_up | investment_income_up | 84.9 M $ | v2-pipeline | ER |
| ERIE | opinc_106_q1 | opinc_106_q1 | 15.4 M $ | v2-pipeline | ER |
| ERIE | policies_7m | policies_7m | 1 Fait | v2-pipeline | ER |
| ERIE | premium_growth_engine | premium_growth_engine | 175.6 M $ | v2-pipeline | ER |
| ES | Choc FERC ROE | Choc FERC ROE | 10.57 % | v2-pipeline | ER |
| ES | Plan 26,5 Md$ | Plan 26,5 Md$ | 26.5 Md $ | v2-pipeline | ER |
| ES | Pure-play regule | Pure-play régulé | 7 % | v2-pipeline | ER |
| ES | Resilience Nor'easter | Resilience Nor'easter | 1 Fait | v2-pipeline | ER |
| ES | Riposte ROE 11,39% | Riposte ROE 11,39% | 11.39 % | v2-pipeline | ER |
| ESS | 32e hausse dividende | 32e hausse dividende | 0.8 % | v2-pipeline | ER |
| ESS | NOI bat le guidance | NOI bat le guidance | 2.3 % | v2-pipeline | ER |
| ESS | Occupation solide | Occupation solide | 96.5 % | v2-pipeline | ER |
| ESS | Reprise Nord Californie | Reprise Nord Californie | 3.9 % | v2-pipeline | ER |
| ESS | Tech-Enabled Units | Unités équipées de technologie intelligente | 48500 unités | v2-pipeline-enrich | (aucun _source) |
| ESS | West Coast Penetration | Pénétration sur la Côte Ouest | 8.4 % | v2-pipeline-enrich | (aucun _source) |
| ESS | West Coast Supply Share | Part de Marché Offre Côte Ouest | 6.7 % | v2-pipeline-enrich | (aucun _source) |
| ETN | aerospace_demand | aerospace_demand | 7 % | v2-pipeline | ER |
| ETN | americas_margin_record | americas_margin_record | 28.5 % | v2-pipeline | ER |
| ETN | book_to_bill | book_to_bill | 1 Fait | v2-pipeline | ER |
| ETN | capacity_investment | capacity_investment | 1 Md $ | v2-pipeline | ER |
| ETN | datacenter_backlog | datacenter_backlog | 18 % | v2-pipeline | ER |
| ETR | Demande data center | Demande data center | 2 Md $ | v2-pipeline | ER |
| EVRG | Cible EPS relevee | Cible EPS relevée | 6 % | v2-pipeline | ER |
| EW | TAVR sales surge Q1 2026 | TAVR sales surge Q1 2026 | 1.2 Md $ | v2-pipeline | ER |
| EW | TMTT sales jump Q4 2025 | TMTT sales jump Q4 2025 | 156 M $ | v2-pipeline | ER |
| EW | accelerated share repurchase | accelerated share repurchase | 500 M $ | v2-pipeline | ER |
| EW | confidence 2026 sales | confidence exercice 2026 sales | 10 % | v2-pipeline | ER |
| EW | guidance raise 2026 sales | guidance raise exercice 2026 sales | 9 % | v2-pipeline | ER |
| EXC | AdjOpEpsQ1 | AdjOpEpsQ1 | 0.91 $ | v2-pipeline | ER |
| EXC | CapExPlan | CapExPlan | 41.7 Md $ | v2-pipeline | ER |
| EXC | ComEd livraisons elec. | Volumes électriques livres ComEd | 36.1 TWh | v2-pipeline | (aucun _source) |
| EXC | FinancingProgress | FinancingProgress | 3.4 Md $ | v2-pipeline | ER |
| EXC | ReliabilityTopQuartile | ReliabilityTopQuartile | 1 Fait | v2-pipeline | ER |
| EXE | Entree au S&P 500 | Entrée au S&P 500 | 1 Fait | v2-pipeline | data-lake |
| EXE | SPA LNG Delfin 1,15 Mt/an | SPA LNG Delfin 1,15 Mt/an | 1.15 M $ | v2-pipeline | data-lake |
| EXE | SPA Lake Charles Methanol 15 ans | SPA Lake Charles Methanol 15 ans | 1 Fait | v2-pipeline | data-lake |
| EXE | Synergies +50% | Synergies +50% | 50 % | v2-pipeline | data-lake |
| EXPD | Airfreight margins up | Airfreight margins up | 1 Fait | v2-pipeline | ER |
| EXPD | Board approves $3 bn repurchase | Board approves $3 bn repurchase | 3 Md $ | v2-pipeline | ER |
| EXPD | Double‑digit growth in key services | Double‑digit growth in key services | 1 Fait | v2-pipeline | ER |
| EXPD | Investments in AI | Investments in AI | 1 Fait | v2-pipeline | ER |
| EXPD | Share repurchases Q1 2026 | Share repurchases Q1 2026 | 288 M $ | v2-pipeline | ER |
| EXR | Occupation stable | Occupation stable | 93 % | v2-pipeline | ER |
| F | Ford Pro Revenue | Revenu segment Ford Pro | 66.286 Mds $ | v2-pipeline | cat1-us/10K/2024 + 2026 F filings, Item 7 Ford Pro Segment Revenue ($M, FY2022-FY2025) |
| F | Ford Pro Wholesales | Volumes de gros Ford Pro | 1.488 M unités | v2-pipeline | cat1-us/10K/2024 + 2026 F filings, Item 7 Ford Pro Segment Wholesale Units (FY2022-FY2025) |
| FANG | Dividend hike Q1 2026 | Dividend hike Q1 2026 | 10 % | v2-pipeline | ER |
| FANG | Dividend hike Q4 2025 | Dividend hike Q4 2025 | 5 % | v2-pipeline | ER |
| FANG | Permian Acreage | Superficie Permien | 861 K acres | v2-pipeline | (aucun _source) |
| FANG | Production (BOE/d) | Production totale | 598 K BOE/d | v2-pipeline | (aucun _source) |
| FANG | Share repurchase Q1 2026 | Share repurchase Q1 2026 | 548 M $ | v2-pipeline | ER |
| FANG | Tender offer debt retirement | Tender offer debt retirement | 777 M $ | v2-pipeline | ER |
| FAST | DSR up 12.4% | DSR up 12.4% | 12.4 % | v2-pipeline | ER |
| FAST | FMI % des ventes | Part des ventes via FMI | 42.5 % | v2-pipeline | (aucun _source) |
| FAST | FMI Devices Installed | Parc de distributeurs FMI installes | 127 k MEU | v2-pipeline | (aucun _source) |
| FAST | Margin up 20 bps | Margin up 20 bps | 20.3 % | v2-pipeline | ER |
| FAST | OCF 111% of NI | OCF 111% of NI | 378 M $ | v2-pipeline | ER |
| FAST | Shareholder returns | Shareholder returns | 296 M $ | v2-pipeline | ER |
| FCX | Arizona leaching tech | Arizona leaching tech | 1 Fait | v2-pipeline | ER |
| FCX | El Abra expansion | El Abra expansion | 1 Fait | v2-pipeline | ER |
| FCX | Fonderie Manyar | Fonderie Manyar | 1 Fait | v2-pipeline | 10-K 2025 (data-lake/FCX/10K/FCX_2026-02-13.htm.gz) |
| FCX | Grasberg ramp-up | Grasberg ramp-up | 1 Fait | v2-pipeline | ER |
| FCX | MoU Indonésie | MoU Indonésie | 1 Fait | v2-pipeline | ER |
| FCX | Net income Q1 | Net income Q1 | 881 M $ | v2-pipeline | ER |
| FDS | Acceleration de l'ASV organique | Acceleration de l'ASV organique | 4.1 % | v2-pipeline | data-lake |
| FDS | Nouveau CEO Viswanathan | Nouveau CEO Viswanathan | 1 Fait | v2-pipeline | data-lake |
| FDS | Rachat d'actions x2,5 | Rachat d'actions x2,5 | 1 Md $ | v2-pipeline | data-lake |
| FDX | Cost‑Reduction Targets | Cost‑Reduction Targets |   | v2-pipeline-enrich | ER/ES |
| FDX | Cross-Border E-com Share | Part de marché en e-commerce transfrontalier | 23.4 % | v2-pipeline-enrich | (aucun _source) |
| FDX | Cross-Border Volume | Volume d'expéditions transfrontalières | 4.3 M unités | v2-pipeline-enrich | (aucun _source) |
| FDX | E-com Fulfillment Hubs | Centres de livraison e-commerce | 47 hubs | v2-pipeline-enrich | (aucun _source) |
| FDX | Elec Fleet | Flotte électrique | 6500 véhicules | v2-pipeline-enrich | (aucun _source) |
| FDX | Fleet Electrification | Flotte Électrifiée | 25,000 véhicules | v2-pipeline-enrich | (aucun _source) |
| FDX | Freight Spin‑Off | Freight Spin‑Off |   | v2-pipeline-enrich | ER/ES |
| FDX | Global E-com Hubs | Centres logistiques pour e-commerce dans le monde | 47 centres | v2-pipeline-enrich | (aucun _source) |
| FDX | Global Share | Part de marché mondiale | 41 % | v2-pipeline-enrich | (aucun _source) |
| FDX | Green Delivery Cities | Villes desservies en véhicules électriques | 28 villes | v2-pipeline-enrich | (aucun _source) |
| FDX | Network 2.0 | Network 2.0 |   | v2-pipeline-enrich | ER/ES |
| FER | Acquisition IRB Infrastructure | Prise de participation dans IRB Infrastructure Trust | 0.71 Mds € | v2-pipeline | (aucun _source) |
| FER | Croissance managed lanes | Croissance des autoroutes à péage |   | v2-pipeline | (aucun _source) |
| FER | Dividendes actionnaires | Distributions aux actionnaires | 0.895 Mds € | v2-pipeline | (aucun _source) |
| FER | Listing Nasdaq | Cotation sur Nasdaq |   | v2-pipeline | (aucun _source) |
| FER | Profitabilité construction | Amélioration de la marge EBIT construction |   | v2-pipeline | (aucun _source) |
| FER | Reconnaissance ESG | Leadership ESG reconnu |   | v2-pipeline | (aucun _source) |
| FER | Terminal One JFK | Nouveau Terminal One à l'aéroport JFK | 92 % | v2-pipeline | (aucun _source) |
| FRE.DE | DividendProposal_Q4_24 | DividendProposal_Q4_24 |   | v2-pipeline-enrich | ER/ES |
| FRE.DE | EBIT_EPS_Q3_24 | EBIT_EPS_Q3_24 |   | v2-pipeline-enrich | ER/ES |
| FRE.DE | LeverageImprovement_Q3_24 | LeverageImprovement_Q3_24 |   | v2-pipeline-enrich | ER/ES |
| FRE.DE | RevenueGrowthQ3_24 | RevenueGrowthQ3_24 |   | v2-pipeline-enrich | ER/ES |
| FSLR | Modules vendus |  |   | v2-pipeline | (aucun _source) |
| FSLR | Production de modules |  |   | v2-pipeline | (aucun _source) |
| FTNT | Part du service | Part du service dans les revenus | 68 % | v2-pipeline | (aucun _source) |
| FTNT | Revenus produits | Revenus produits (matériel) | 1.91 Mds $ | v2-pipeline | (aucun _source) |
| FTV | AHS Revenue |  |   | v2-pipeline | (aucun _source) |
| FTV | IOS Revenue |  |   | v2-pipeline | (aucun _source) |
| GE | Additive Capacity | Capacité Fabrication Additive | 45 M unités | v2-pipeline-enrich | (aucun _source) |
| GE | Additive Production Rate | Taux de production additive | 45000 pièces | v2-pipeline-enrich | (aucun _source) |
| GE | CFM RISE Share | Part de marché RISE | 62 % | v2-pipeline-enrich | (aucun _source) |
| GE | Commandes +74% | Commandes +74% |   | v2-pipeline-enrich | ER/ES |
| GE | Defense Avionics Share | Part de Marché Avionique Défense | 27 % | v2-pipeline-enrich | (aucun _source) |
| GE | RISE Engine Output | Production du moteur RISE | 8 unités/mois | v2-pipeline-enrich | (aucun _source) |
| GE | eVTOL Propulsion Deals | Accords propulsion eVTOL | 5 accords | v2-pipeline-enrich | (aucun _source) |
| GEN | AVG Mobile Downloads | Téléchargements mobiles AVG | 580 M téléchargements | v2-pipeline-enrich | (aucun _source) |
| GEN | Avast LATAM Growth | Croissance Avast Amérique latine | 18.2 % | v2-pipeline-enrich | (aucun _source) |
| GEN | Avira Zero-Day Blocks | Blocages de menaces zéro jour Avira | 2.7 M unités | v2-pipeline-enrich | (aucun _source) |
| GEN | LifeLock Family Plans | Forfaits familiaux LifeLock | 43 % | v2-pipeline-enrich | (aucun _source) |
| GEN | LifeLock Identity Alerts | Alertes d'usurpation LifeLock | 8.4 alertes/utilisateur/an | v2-pipeline-enrich | (aucun _source) |
| GILD | HIV Franchise | Ventes franchise VIH | 20.752 Mds $ | v2-pipeline | (aucun _source) |
| GILD | Trodelvy Sales | Ventes Trodelvy (oncologie) | 1.397 Mds $ | v2-pipeline | (aucun _source) |
| GILD | Veklury Sales | Ventes Veklury (remdesivir, COVID-19) | 0.911 Mds $ | v2-pipeline | (aucun _source) |
| GIS | Blue Buffalo Growth | Croissance de Blue Buffalo | 8.2 % | v2-pipeline-enrich | (aucun _source) |
| GIS | Blue Buffalo Vet Channel Pen | Pénétration de Blue Buffalo dans les cliniques vétérinaires US | 43 % | v2-pipeline-enrich | (aucun _source) |
| GIS | Häagen-Dazs Asia Growth | Croissance d'Häagen-Dazs en Asie | 18.3 % | v2-pipeline-enrich | (aucun _source) |
| GIS | Häagen-Dazs China Stores | Nombre de points de vente Häagen-Dazs en Chine | 87 stores | v2-pipeline-enrich | (aucun _source) |
| GIS | Häagen-Dazs Growth | Croissance du chiffre d'affaires Häagen-Dazs | 8.7 % | v2-pipeline-enrich | (aucun _source) |
| GIS | Nature Valley Expansion | Expansion Nature Valley | 7 marchés | v2-pipeline-enrich | (aucun _source) |
| GIS | Pet Food Innovation Rate | Taux d'innovation en alimentation animale | 7 lancements | v2-pipeline-enrich | (aucun _source) |
| GIS | Pet Food R&D Pipeline | Pipeline R&D Aliments pour Animaux | 14 produits | v2-pipeline-enrich | (aucun _source) |
| GIS | Pet Food Share US | Part de marché alimentation animale aux États-Unis | 14.3 % | v2-pipeline-enrich | (aucun _source) |
| GIS | Plant-Based Launches | Nouveaux produits végétaux lancés | 14 lancements | v2-pipeline-enrich | (aucun _source) |
| GIS | Plant-Based Sales | Ventes de produits d'origine végétale | 425 M $ | v2-pipeline-enrich | (aucun _source) |
| GLE.PA | AYVENS_MARGIN | Marge de location longue durée d'Ayvens |   | v2-pipeline-enrich | Communiqué |
| GLE.PA | BOURSO_AUA | Actifs administrés BoursoBank |   | v2-pipeline-enrich | Communiqué |
| GLE.PA | BOURSO_ORDERS | Ordres de bourse BoursoBank |   | v2-pipeline-enrich | Communiqué |
| GLE.PA | BOURSO_RONE | Rentabilité de BoursoBank (RONE) |   | v2-pipeline-enrich | Communiqué |
| GLE.PA | EFF_INITIATIVES | Initiatives d'efficacité des équipes |   | v2-pipeline-enrich | Transcript |
| GLE.PA | IT_PROVIDERS | Prestataires informatiques |   | v2-pipeline-enrich | Transcript |
| GLE.PA | LCR | Ratio de liquidité à court terme (LCR) |   | v2-pipeline-enrich | Communiqué |
| GLE.PA | NPL_RATIO | Taux brut d'encours douteux |   | v2-pipeline-enrich | Communiqué |
| GM | Autonomous Fleet Scale | Taille de la flotte autonome | 350 véhicules | v2-pipeline-enrich | (aucun _source) |
| GM | EV Design Wins | Victoires de conception VE | 12 modèles | v2-pipeline-enrich | (aucun _source) |
| GM | EV Export | Exportations de véhicules électriques | 25.1 M unités | v2-pipeline-enrich | (aucun _source) |
| GM | EV Sales Penetration US | Pénétration des Ventes de VE aux États-Unis | 8.7 % | v2-pipeline-enrich | (aucun _source) |
| GM | Super Cruise Cities | Villes couvertes par Super Cruise | 180 villes | v2-pipeline-enrich | (aucun _source) |
| GM | Super Cruise Mileage | Kilométrage Accumulé avec Super Cruise | 2.1 Mds km | v2-pipeline-enrich | (aucun _source) |
| GM | Super Cruise Utilisation | Taux d'utilisation de Super Cruise | 42.5 % | v2-pipeline-enrich | (aucun _source) |
| GM | Ultium Cell Production | Production de cellules Ultium | 12.8 GWh | v2-pipeline-enrich | (aucun _source) |
| GM | Ultium Charge Speed | Vitesse de Charge Ultium | 350 kW | v2-pipeline-enrich | (aucun _source) |
| GM | Ultium Gigafactories | Nombre d'usines géantes Ultium | 4 usines | v2-pipeline-enrich | (aucun _source) |
| GM | V2X Deployment | Déploiement V2X | 125 k unités | v2-pipeline-enrich | (aucun _source) |
| GOOG | AI Infra in Build | Actifs en construction | 78.592 Mds $ | v2-pipeline | (aucun _source) |
| GOOG | Gemini App DAU | Utilisateurs actifs journaliers de l'application Gemini | 28.7 M utilisateurs | v2-pipeline-enrich | (aucun _source) |
| GOOG | Gemini Pro Adoption | Adoption de Gemini Pro | 450 k | v2-pipeline-enrich | (aucun _source) |
| GOOG | Gemini Users | Utilisateurs Gemini | 250 M utilisateurs | v2-pipeline-enrich | (aucun _source) |
| GOOG | Intl Infra Assets | Actifs longue duree hors US | 66.481 Mds $ | v2-pipeline | (aucun _source) |
| GOOGL | 1er trim 100 Mds$ | Premier trimestre à plus de 100 milliards de dollars de revenus |   | v2-pipeline-enrich | ER/ES |
| GOOGL | AI Infra in Build | Actifs en construction | 78.592 Mds $ | v2-pipeline | (aucun _source) |
| GOOGL | Gemini 3 | Lancement de Gemini 3 |   | v2-pipeline-enrich | ER/ES |
| GOOGL | Intl Infra Assets | Actifs longue duree hors US | 66.481 Mds $ | v2-pipeline | (aucun _source) |
| GOOGL | Waymo 500k/sem | Waymo dépasse 500 000 trajets autonomes par semaine |   | v2-pipeline-enrich | ER/ES |
| GPC | AdjustedNetIncomeIncrease | AdjustedNetIncomeIncrease |   | v2-pipeline-enrich | ER/ES |
| GPC | EV Retrofit Kits | Kits de conversion électrique vendus | 18.7 M unités | v2-pipeline-enrich | (aucun _source) |
| GPC | EV Training Centers | Centres de formation NAPA dédiés aux véhicules électriques | 142 stores | v2-pipeline-enrich | (aucun _source) |
| GPC | Industrial Digital Clients | Clients industriels utilisant la plateforme numérique | 89.5 M unités | v2-pipeline-enrich | (aucun _source) |
| GPC | Industrial E-Procurement Clients | Clients industriels sur plateforme e-procurement | 23.4 M clients | v2-pipeline-enrich | (aucun _source) |
| GPC | NAPA EV Kits Sold | Nombre de kits NAPA pour véhicules électriques vendus | 45.2 M unités | v2-pipeline-enrich | (aucun _source) |
| GPC | NAPA Tech Hubs | Centres technologiques NAPA | 89 stores | v2-pipeline-enrich | (aucun _source) |
| GPC | SeparationProgress | SeparationProgress |   | v2-pipeline-enrich | ER/ES |
| GPC | StrongSalesGrowth | StrongSalesGrowth |   | v2-pipeline-enrich | ER/ES |
| GRMN | AI-Enabled Devices | Appareils compatibles IA | 2.3 M unités | v2-pipeline-enrich | (aucun _source) |
| GRMN | Aviation Design Wins | Victoires de conception en aviation | 7 projets | v2-pipeline-enrich | (aucun _source) |
| GRMN | Fitness Device Attach Rate | Taux d'attachement des appareils fitness | 27 % | v2-pipeline-enrich | (aucun _source) |
| GRMN | Fleet Expansion Rate | Taux d'expansion du parc | 9.2 % | v2-pipeline-enrich | (aucun _source) |
| GRMN | Marine Autopilot Wins | Nouvelles validations d'autopilote maritime | 147 unités | v2-pipeline-enrich | (aucun _source) |
| GRMN | Marine Connected Units | Unités marines connectées | 1.45 M unités | v2-pipeline-enrich | (aucun _source) |
| GRMN | Outdoor Connected Growth | Croissance des appareils outdoor connectés | 19.5 % | v2-pipeline-enrich | (aucun _source) |
| GRMN | Outdoor Segment Growth | Croissance du segment outdoor | 12.8 % | v2-pipeline-enrich | (aucun _source) |
| GRMN | Outdoor Segment Share | Part de marché Outdoor | 38 % | v2-pipeline-enrich | (aucun _source) |
| HBAN | AI-DRIVEN LOANS | Prêts pilotés par l'IA | 415 M $ | v2-pipeline-enrich | (aucun _source) |
| HBAN | MIDWEST DIGITAL SHARE | Part de marché numérique au Midwest | 23.4 % | v2-pipeline-enrich | (aucun _source) |
| HBAN | OHIO BRANCH LEAD | Leadership dans les Succursales en Ohio | 23.4 % | v2-pipeline-enrich | (aucun _source) |
| HBAN | OHIO DIGITAL PEN | Pénétration Numérique Ohio | 68.4 % | v2-pipeline-enrich | (aucun _source) |
| HBAN | SMB APP DIGITIZATION | Numérisation des Dossiers TPE | 74 % | v2-pipeline-enrich | (aucun _source) |
| HBAN | SMB APP ENGAGEMENT | Taux d'Engagement sur l'Application SMB | 6.7 sessions/mois | v2-pipeline-enrich | (aucun _source) |
| HBAN | SMB APP RETENTION | Taux de rétention SMB App | 87 % | v2-pipeline-enrich | (aucun _source) |
| HBAN | SMB LENDING GROWTH | Croissance du Prêt aux PME | 19.3 % | v2-pipeline-enrich | (aucun _source) |
| HBAN | TEXAS BRANCH GROWTH | Expansion Texas | 28 stores | v2-pipeline-enrich | (aucun _source) |
| HBAN | TEXAS DIGITAL SHARE | Part de Marché Numérique au Texas | 18.3 % | v2-pipeline-enrich | (aucun _source) |
| HD | Acquisition GMS | Acquisition GMS |   | v2-pipeline-enrich | ER/ES |
| HD | HD Pro Xtra Members | Nombre de membres HD Pro Xtra | 11.3 M membres | v2-pipeline-enrich | (aucun _source) |
| HD | Pro Customer Penetration | Pénétration chez les clients professionnels | 52 % | v2-pipeline-enrich | (aucun _source) |
| HD | Pro Member Growth | Croissance des Membres HD Pro Xtra | 9.2 % | v2-pipeline-enrich | (aucun _source) |
| HD | Rental Fleet Size | Taille du parc de location d'équipements | 295 k unités | v2-pipeline-enrich | (aucun _source) |
| HD | Same-Day Delivery % | Livraison le jour même | 44 % | v2-pipeline-enrich | (aucun _source) |
| HD | Same-Day Delivery Reach | Couverture de Livraison le Jour Même | 85 % | v2-pipeline-enrich | (aucun _source) |
| HD | Urban Store Density | Densité de magasins en zones urbaines | 14.3 stores | v2-pipeline-enrich | (aucun _source) |
| HEIA.AS | Brewery Capacity Growth | Croissance de la Capacité Brassière | 8.2 % | v2-pipeline-enrich | (aucun _source) |
| HEIA.AS | Digital Engagement Rate | Taux d'Engagement Numérique Client | 38.7 % | v2-pipeline-enrich | (aucun _source) |
| HEIA.AS | Digital Taproom Reach | Portée des taprooms numériques | 9.7 M utilisateurs | v2-pipeline-enrich | (aucun _source) |
| HEIA.AS | Emerging Markets Share | Part de Marché dans les Marchés Émergents | 23.4 % | v2-pipeline-enrich | (aucun _source) |
| HEIA.AS | Green Brew Capacity | Capacité de brassage durable | 65 % | v2-pipeline-enrich | (aucun _source) |
| HEIA.AS | HEINEKEN Share Control | Participation dans HEINEKEN N.V. | 50.005 % | v2-pipeline-enrich | (aucun _source) |
| HEIA.AS | Voting Rights Leverage | Découplage droit de vote / propriété | 50.0 pp | v2-pipeline-enrich | (aucun _source) |
| HEIA.AS | Zero-Alcohol Growth | Croissance des Ventes de Bières Sans Alcool | 23.4 % | v2-pipeline-enrich | (aucun _source) |
| HEIA.AS | Zero-Alcohol Share | Part des boissons sans alcool | 18.3 % | v2-pipeline-enrich | (aucun _source) |
| HEN.DE | APAC E-Commerce Share | Part e-commerce en Asie-Pacifique | 24 % | v2-pipeline-enrich | (aucun _source) |
| HEN.DE | Adhesive Capacity Add | Ajout de capacité adhésifs | 120 k tonnes | v2-pipeline-enrich | (aucun _source) |
| HEN.DE | Adhesive E-Mobility Sales | Ventes adhésifs mobilité électrique | 1.4 Mds $ | v2-pipeline-enrich | (aucun _source) |
| HEN.DE | Asia Pacific Growth | Croissance en Asie-Pacifique | 5.7 % | v2-pipeline-enrich | (aucun _source) |
| HEN.DE | Digital Channel Sales | Ventes par canaux numériques | 18.3 % | v2-pipeline-enrich | (aucun _source) |
| HEN.DE | Eco-Portfolio Share | Part du portefeuille éco-conçu | 62 % | v2-pipeline-enrich | (aucun _source) |
| HEN.DE | R&D Intensity | Dépenses de R&D en % du chiffre d'affaires | 2.1 % | v2-pipeline-enrich | (aucun _source) |
| HEN.DE | Salon Channel Growth | Croissance canal salon | 8.7 % | v2-pipeline-enrich | (aucun _source) |
| HLT | All-Suite Additions | Ajouts d'hôtels tout-suite | 124 hôtels | v2-pipeline-enrich | (aucun _source) |
| HLT | Asia Expansion | Expansion en Asie | 37 hôtels | v2-pipeline-enrich | (aucun _source) |
| HLT | Digital Check-In | Check-in Numérique | 68 % | v2-pipeline-enrich | (aucun _source) |
| HLT | Europe RevPAR Gain | Gain de part de marché en Europe sur le RevPAR | 3.8 pts | v2-pipeline-enrich | (aucun _source) |
| HLT | Honors App DAU | Utilisateurs actifs journaliers de l'application Hilton Honors | 4.7 M utilisateurs | v2-pipeline-enrich | (aucun _source) |
| HLT | Honors Engagement | Engagement des Membres Honors | 4.3 nuits/membre | v2-pipeline-enrich | (aucun _source) |
| HLT | Honors Redemption Rate | Taux de rédemption Honors | 41 % | v2-pipeline-enrich | (aucun _source) |
| HLT | LXR Pipeline Growth | Croissance du pipeline de la marque LXR | 34 hôtels | v2-pipeline-enrich | (aucun _source) |
| HLT | Luxury Pipeline | Pipeline de Luxe | 142 hôtels | v2-pipeline-enrich | (aucun _source) |
| HLT | Middle East Pipeline | Pipeline Moyen-Orient | 67 hôtels | v2-pipeline-enrich | (aucun _source) |
| HLT | Smart Room Rollout | Déploiement des chambres intelligentes | 85 M unités | v2-pipeline-enrich | (aucun _source) |
| HONA | FACTORY_OUTPUT_STREAK | Trimestres consécutifs de croissance de la production | 14 trimestres | v2-pipeline | (aucun _source) |
| HOT.DE | DC_BL_TURNER | Carnet de commandes data centers de Turner | 22 Mds € | v2-pipeline-enrich | transcript |
| HOT.DE | DEF_BACKLOG | Carnet de commandes défense | 2.2 Mds € | v2-pipeline-enrich | transcript |
| HOT.DE | EDGE_DC_TARGET | Objectif de data centers de proximité en Europe | 33 sites | v2-pipeline-enrich | SLIDES |
| HOT.DE | EQUITY_GROWTH | Investissements en capital engagés dans les marchés de croissance | 600 M € | v2-pipeline-enrich | SLIDES |
| HOT.DE | LOWRISK_SHARE | Part des contrats à faible risque dans le carnet | 90 % | v2-pipeline-enrich | RFS |
| HOT.DE | PIPE_TURNER | Projets attribués à Turner hors carnet (phase de conception) | 20 Mds € | v2-pipeline-enrich | transcript |
| HOT.DE | SEMI_ORDERS | Commandes dans les semi-conducteurs | 1 Md $ | v2-pipeline-enrich | SLIDES |
| HOT.DE | STRAT_ORDERS_SHARE | Part des commandes issues des marchés de croissance stratégiques | 60 % | v2-pipeline-enrich | RFS |
| HPQ | ai_pc_isv_partners | Éditeurs de logiciels partenaires des PC IA | 150 éditeurs | v2-pipeline-enrich | transcript |
| HPQ | ai_pc_mix | Part des PC IA dans les livraisons | 46 % | v2-pipeline-enrich | transcript |
| HPQ | big_tank_share_gain | Gain de part de marché imprimantes à réservoir | 4 pts | v2-pipeline-enrich | transcript |
| HPQ | industrial_print_growth_streak | Trimestres consécutifs de croissance de l'impression industrielle | 12 trimestres | v2-pipeline-enrich | transcript |
| HPQ | key_growth_areas_growth | Croissance des relais de croissance | 46 % | v2-pipeline-enrich | transcript |
| HPQ | precise_print_countries | Pays couverts par Precise Print | 150 pays | v2-pipeline-enrich | transcript |
| HPQ | premium_pc_share_gain | Gain de part de marché PC premium | 2.6 pts | v2-pipeline-enrich | transcript |
| HPQ | tank_printer_units_growth | Croissance des volumes d'imprimantes à réservoir | 42 % | v2-pipeline-enrich | transcript |
| HPQ | workstation_share_gain | Gain de part de marché stations de travail | 1.8 pts | v2-pipeline-enrich | transcript |
| HWM | Aero +19% | Aero +19% |   | v2-pipeline-enrich | ER/ES |
| IBM | consulting_backlog | Carnet de commandes Consulting | 30.8 Mds $ | v2-pipeline-enrich | 10-Q |
| IBM | dist_infra_backlog | Carnet de commandes Power et Storage | 500 M $ | v2-pipeline-enrich | 8-K |
| IBM | dist_infra_growth | Croissance Distributed Infrastructure (Power et Storage) | 37 % sur un an | v2-pipeline-enrich | 8-K |
| IBM | genai_share_signings | Part de l'IA générative dans les signatures Consulting | 50 % | v2-pipeline-enrich | transcript |
| IBM | lightwell_packages | Correctifs open source publiés par Lightwell | 7500 versions de paquets | v2-pipeline-enrich | transcript |
| IBM | openshift_arr | ARR OpenShift (Red Hat) | 2.2 Mds $ | v2-pipeline-enrich | transcript |
| IBM | quantum_invest_5y | Investissement prévu dans le quantique (5 ans) | 10 Mds $ | v2-pipeline-enrich | 8-K |
| IBM | spyre_adoption | Clients z17 équipés de l'accélérateur IA Spyre | 50 % des clients z17 | v2-pipeline-enrich | transcript |
| IBM | z17_program_ratio | Cycle z17 rapporté au cycle z16 | 130 % du cycle précédent | v2-pipeline-enrich | transcript |
| INGA.AS | Buyback | Buyback |   | v2-pipeline-enrich | ER/ES |
| INGA.AS | FeeGrowth | FeeGrowth |   | v2-pipeline-enrich | ER/ES |
| INGA.AS | MobileGrowth | MobileGrowth |   | v2-pipeline-enrich | ER/ES |
| INGA.AS | OpExDecline | OpExDecline |   | v2-pipeline-enrich | ER/ES |
| INGA.AS | Resilience | Resilience |   | v2-pipeline-enrich | ER/ES |
| INTU | ACCOUNTANT_SUITE_USERS | Comptables sur Intuit Accountant Suite |   | v2-pipeline-enrich | transcript |
| INTU | BIG_BETS_SHARE | Poids des trois grands paris |   | v2-pipeline-enrich | transcript |
| INTU | CK_ORIGINATION_SHARE | Part des crédits américains via Intuit |   | v2-pipeline-enrich | transcript |
| INTU | IES_ANNUALIZED_REV | Revenu annualisé d'Intuit Enterprise Suite |   | v2-pipeline-enrich | transcript |
| INTU | MONEY_REV_INCREASE | Hausse du revenu des services financiers PME |   | v2-pipeline-enrich | 10-K |
| INTU | Online Ecosystem | Chiffre d'affaires de l'écosystème en ligne | 8.302 Mds $ | v2-pipeline | (aucun _source) |
| INTU | QB_CAPITAL_LOAN_VOLUME | Volume de prêts QuickBooks Capital |   | v2-pipeline-enrich | transcript |
| IQV | Clinical Trial AI Use | Essais Cliniques avec IA | 157 essais | v2-pipeline-enrich | (aucun _source) |
| IQV | TAM Healthcare AI | TAM Santé et IA | 28.5 Mds $ | v2-pipeline-enrich | (aucun _source) |
| JCI | AI factory absorption chiller | Refroidisseur à absorption pour usines d'IA |   | v2-pipeline-enrich | Transcript |
| JCI | Alloy and Nantum AI acquisitions | Rachats d'Alloy Enterprises et de Nantum AI |   | v2-pipeline-enrich | Communiqué |
| JCI | CDU pipeline | Opportunités en unités de refroidissement liquide |   | v2-pipeline-enrich | Transcript |
| JCI | Data center revenue ambition | Ambition data centers |   | v2-pipeline-enrich | Transcript |
| JCI | FY26 adjusted EPS guidance | Prévision de BPA ajusté 2026 |   | v2-pipeline-enrich | Transcript |
| JCI | FY26 organic growth guidance | Prévision de croissance organique 2026 |   | v2-pipeline-enrich | Transcript |
| JCI | Middle East drag on EMEA | Pression du Moyen-Orient sur l'EMEA |   | v2-pipeline-enrich | Transcript |
| JCI | Net debt leverage | Levier d'endettement net |   | v2-pipeline-enrich | Transcript |
| JDEP.AS | Performance H1 2024 | Performance H1 2024 |   | v2-pipeline-enrich | ER/ES |
| JDEP.AS | Progrès en durabilité 2023 | Progrès en durabilité 2023 |   | v2-pipeline-enrich | ER/ES |
| JDEP.AS | Proposition de dividende 2023 | Proposition de dividende 2023 |   | v2-pipeline-enrich | ER/ES |
| JDEP.AS | Résultats annuels 2023 | Résultats annuels 2023 |   | v2-pipeline-enrich | ER/ES |
| JDEP.AS | Révision à la hausse du full‑year 2024 | Révision à la hausse du full‑year 2024 |   | v2-pipeline-enrich | ER/ES |
| JNJ | Adjusted EPS up | Adjusted EPS up |   | v2-pipeline-enrich | ER/ES |
| JNJ | CEO transition | CEO transition |   | v2-pipeline-enrich | ER/ES |
| JNJ | Emerging Markets Share | Part de marché dans les marchés émergents | 14.2 % | v2-pipeline-enrich | (aucun _source) |
| JNJ | Robotic Procedure Growth | Croissance des Procédures Robotiques | 34 % | v2-pipeline-enrich | (aucun _source) |
| JNJ | Robotic Surgery Sales | Ventes de systèmes chirurgicaux robotiques | 1.2 Mds $ | v2-pipeline-enrich | (aucun _source) |
| JNJ | Robotic Surgery Units | Unités de chirurgie robotique vendues | 142 unités | v2-pipeline-enrich | (aucun _source) |
| JNJ | Robust 2021 segment growth | Robust 2021 segment growth |   | v2-pipeline-enrich | ER/ES |
| JNJ | Smart Contact Lenses | Lancements de lentilles intelligentes | 2 lancements | v2-pipeline-enrich | (aucun _source) |
| JNJ | Smart Lens Trials | Nombre d'essais cliniques pour lentilles intelligentes | 5 essais | v2-pipeline-enrich | (aucun _source) |
| JNJ | Stelara impact | Stelara impact |   | v2-pipeline-enrich | ER/ES |
| JNJ | Strong Q3 2025 performance | Strong Q3 2025 performance |   | v2-pipeline-enrich | ER/ES |
| JPM | G-SIB Surcharge | Surcharge de capital G-SIB | 5.2 % | v2-pipeline-enrich | (aucun _source) |
| JPM | LatAm Branch Expansion | Expansion des succursales en Amérique latine | 15 stores | v2-pipeline-enrich | (aucun _source) |
| JPM | Markets record | Markets record |   | v2-pipeline-enrich | ER/ES |
| JPM | Wealth Client Retention | Taux de rétention clients gestion patrimoine | 94.7 % | v2-pipeline-enrich | (aucun _source) |
| JPM | Wealth Digital Penetration | Pénétration numérique en gestion de patrimoine | 68 % | v2-pipeline-enrich | (aucun _source) |
| KEY | Branchless Accounts | Comptes sans Agence | 1.6 M comptes | v2-pipeline-enrich | (aucun _source) |
| KEY | Data Center Financing | Financement de centres de données | 1.9 Mds $ | v2-pipeline-enrich | (aucun _source) |
| KEY | ESG Loan Approvals | Prêts ESG approuvés | 8.7 Mds $ | v2-pipeline-enrich | (aucun _source) |
| KEY | Green Loan Book | Encours de Prêts Verts | 12.4 Mds $ | v2-pipeline-enrich | (aucun _source) |
| KEY | Midwest Deposit Share | Part de Marché des Dépôts dans le Midwest | 14.3 % | v2-pipeline-enrich | (aucun _source) |
| KEY | Rural Branch Penetration | Pénétration en succursales rurales | 27 % | v2-pipeline-enrich | (aucun _source) |
| KEY | SME App Engagement | Engagement des PME dans l'appli mobile | 8.7 sessions/mois | v2-pipeline-enrich | (aucun _source) |
| KEY | SME Client Growth | Croissance des Clients TPE/PME | 42000 clients | v2-pipeline-enrich | (aucun _source) |
| KIM | Anchor Tenant Growth | Croissance des Locataires-Phares | 14 locataires | v2-pipeline-enrich | (aucun _source) |
| KIM | E-commerce Fulfillment Centers | Centres de livraison pour le commerce électronique | 1.2 M sq ft | v2-pipeline-enrich | (aucun _source) |
| KIM | Grocery Anchor Density | Densité d'ancres alimentaires | 1.8 ancres | v2-pipeline-enrich | (aucun _source) |
| KIM | Grocery-Anchored Centers | Centres Commerciaux Ancrés par des Épiceries | 587 centers | v2-pipeline-enrich | (aucun _source) |
| KIM | Mixed-Use Developments | Développements mixtes | 18 projets | v2-pipeline-enrich | (aucun _source) |
| KIM | Mixed-Use Pipeline SQFT | Superficie en projet - usages mixtes | 2.3 M sqft | v2-pipeline-enrich | (aucun _source) |
| KIM | Occupancy Rate | Taux d'occupation | 95.3 % | v2-pipeline-enrich | (aucun _source) |
| KIM | Same-Store NOI Growth | Croissance du revenu opérationnel net identique | 4.8 % | v2-pipeline-enrich | (aucun _source) |
| KIM | Urban Infill Portfolio | Portefeuille de Propriétés en Milieu Urbain Dense | 24.3 M sqft | v2-pipeline-enrich | (aucun _source) |
| KIM | Urban Infill SQFT | Superficie en Zones Urbaines Denses | 2.8 M sqft | v2-pipeline-enrich | (aucun _source) |
| KKR | Digital Client Logins | Connexions clients numériques | 18.7 M unités | v2-pipeline-enrich | (aucun _source) |
| KKR | Greenfield Offices | Bureaux en création | 5 stores | v2-pipeline-enrich | (aucun _source) |
| KKR | Tech PE Share | Part de marché PE technologie | 14.3 % | v2-pipeline-enrich | (aucun _source) |
| KLAC | Pilier IA | Pilier IA |   | v2-pipeline-enrich | ER/ES |
| KMB | Intl Personal Care Sales |  |   | v2-pipeline | (aucun _source) |
| KMX | Digitally Enabled Transactions | Transactions activées numériquement | 81 % | v2-pipeline | (aucun _source) |
| KMX | Omni Sales | Ventes omnicanal | 68 % | v2-pipeline | (aucun _source) |
| KNIN.SW | Centres intelligents | Centres logistiques intelligents | 47 centres | v2-pipeline-enrich | (aucun _source) |
| KNIN.SW | Clients Fortune 500 | Clients parmi le Fortune 500 | 214 clients | v2-pipeline-enrich | (aucun _source) |
| KNIN.SW | Emissions évitées | Émissions de CO2 évitées | 1.2 M tonnes | v2-pipeline-enrich | (aucun _source) |
| KNIN.SW | Part marché Asie-Pacifique | Part de marché en Asie-Pacifique | 14.3 % | v2-pipeline-enrich | (aucun _source) |
| KNIN.SW | Smart Warehouses | Centres intelligents | 85 centres | v2-pipeline-enrich | (aucun _source) |
| KR | CYCLOSPORA_ID_SALES_HEADWIND_BPS | Impact de la contamination Cyclospora sur les ventes comparables | 35 pb | v2-pipeline-enrich | Transcript |
| KR | ECOMMERCE_NEW_CUSTOMERS_GROWTH | Croissance des nouveaux clients en ligne | 20 % | v2-pipeline-enrich | Transcript |
| KR | FUEL_REDEMPTIONS_GROWTH | Croissance des remises carburant utilisées | 6 % | v2-pipeline-enrich | Transcript |
| KR | IRA_ID_SALES_HEADWIND_BPS | Impact de la loi sur les prix des médicaments sur les ventes comparables | 138 pb | v2-pipeline-enrich | ER/ES |
| KR | MEDIA_MONETIZATION_BPS | Hausse du taux de monétisation média | 88 pb | v2-pipeline-enrich | Transcript |
| KR | NET_DEBT_TO_ADJ_EBITDA | Dette nette rapportée à l'EBITDA ajusté | 1.91 x | v2-pipeline-enrich | ER/ES |
| KR | NEW_NATURAL_ORGANIC_ITEMS | Nouveaux produits naturels et biologiques | 600 produits | v2-pipeline-enrich | Transcript |
| KR | OUR_BRANDS_PENETRATION_BPS | Gain de part des marques propres dans les ventes | 50 pb | v2-pipeline-enrich | Transcript |
| KR | PRIVATE_SELECTION_SALES_GROWTH | Croissance des ventes de la marque Private Selection | 14 % | v2-pipeline-enrich | Transcript |
| KVUE | Fusion avec Kimberly-Clark |  |   | v2-pipeline | (aucun _source) |
| KVUE | Skin Health and Beauty Sales |  |   | v2-pipeline | (aucun _source) |
| LDOS | Digital Factory Scale | Capacité de l'Usine Numérique | 1250 équivalent développeurs | v2-pipeline-enrich | (aucun _source) |
| LDOS | Digital Factory Sites | Nombre de sites d'usines numériques | 7 sites | v2-pipeline-enrich | (aucun _source) |
| LDOS | Health IT Wins | Nouveaux contrats en technologie de santé | 7 contrats | v2-pipeline-enrich | (aucun _source) |
| LEN | book_value_per_share | Valeur comptable par action | 91 $ | v2-pipeline-enrich | (aucun _source) |
| LEN | inventory_turn | Rotation des stocks | 2.4 x | v2-pipeline-enrich | (aucun _source) |
| LEN | pace_per_community | Rythme par communauté | 4.1 logements/mois | v2-pipeline-enrich | (aucun _source) |
| LKQ | Parts and Services Revenue | Revenu des pièces et services | 97.5 % | v2-pipeline | (aucun _source) |
| LLY | China Facility Capacity | Capacité de Production en Chine | 120 M unités | v2-pipeline-enrich | (aucun _source) |
| LLY | Zepbound Scripts | Ordonnances Zepbound | 250 k | v2-pipeline-enrich | (aucun _source) |
| LOGN.SW | Cash flow FY26 | Cash flow FY26 |   | v2-pipeline-enrich | ER/ES |
| LOGN.SW | GAAP operating income up | GAAP operating income up |   | v2-pipeline-enrich | ER/ES |
| LOGN.SW | Non-GAAP operating income up | Non-GAAP operating income up |   | v2-pipeline-enrich | ER/ES |
| LOGN.SW | Sales growth | Sales growth |   | v2-pipeline-enrich | ER/ES |
| LOGN.SW | Shareholder return | Shareholder return |   | v2-pipeline-enrich | ER/ES |
| LONN.SW | ADC Platform Utilization | Taux d'Utilisation des Plateformes ADC | 85 % | v2-pipeline-enrich | (aucun _source) |
| LONN.SW | Cell & Gene Therapy Capacity | Capacité en Thérapies Cellulaires et Géniques | 125 kL | v2-pipeline-enrich | (aucun _source) |
| LONN.SW | Microbial Platform Sales Share | Part des Ventes sur Plateforme Microbienne | 38 % | v2-pipeline-enrich | (aucun _source) |
| LONN.SW | New CDMO Customer Wins | Nouveaux Clients CDMO | 34 clients | v2-pipeline-enrich | (aucun _source) |
| LONN.SW | mRNA Development Projects | Projets de Développement mRNA | 47 projets | v2-pipeline-enrich | (aucun _source) |
| LSCC | AI_DESIGN_WINS | Contrats de conception liés à l'intelligence artificielle | en croissance qualitatif | v2-pipeline | (aucun _source) |
| LSCC | COMM_COMPUTING_SHARE | Part du marché communications et informatique | 55.9 % | v2-pipeline | (aucun _source) |
| LSCC | EMPLOYEES | Effectifs | 1174 salaries | v2-pipeline | (aucun _source) |
| LW | Volume growth | Croissance du volume | 2 % | v2-pipeline | (aucun _source) |
| LYB | Asia PE Capacity | Capacité PE en Asie | 1.4 M tonnes | v2-pipeline-enrich | (aucun _source) |
| LYB | Auto Polymer Wins | Victoires en Polymères Auto | 7 contrats | v2-pipeline-enrich | (aucun _source) |
| LYB | Capacité PE Asie | Capacité de production de polyéthylène en Asie | 2,5 M tonnes | v2-pipeline-enrich | (aucun _source) |
| LYB | India PE Expansion | Expansion PE en Inde | 0.8 M tonnes | v2-pipeline-enrich | (aucun _source) |
| LYB | Part de marché PE | Part de marché du polyéthylène | 12 % | v2-pipeline-enrich | (aucun _source) |
| LYB | Southeast Asia PP Demand | Demande en PP en Asie du Sud-Est | 9.2 % | v2-pipeline-enrich | (aucun _source) |
| LYB | Tech Licensing Deals | Accords de licence technologique | 7 accords | v2-pipeline-enrich | (aucun _source) |
| MCHP | Auto MCU Share | Part de marché des MCU automobiles | 18.4 % | v2-pipeline-enrich | (aucun _source) |
| MCHP | Capacité de production | Capacité de production | 1,2 M unités | v2-pipeline-enrich | (aucun _source) |
| MCHP | Embedded FPGA Units | Unités FPGA embarquées | 142 M unités | v2-pipeline-enrich | (aucun _source) |
| MCHP | Part de marché FPGA | Part de marché des FPGA | 12 % | v2-pipeline-enrich | (aucun _source) |
| MCHP | Rebond du cycle | Rebond du cycle |   | v2-pipeline-enrich | ER/ES |
| MDT | Cardiac Ablation Solutions surge | Cardiac Ablation Solutions surge |   | v2-pipeline-enrich | ER/ES |
| MDT | Hugo FDA clearance | Hugo FDA clearance |   | v2-pipeline-enrich | ER/ES |
| MDT | M&A activity | M&A activity |   | v2-pipeline-enrich | ER/ES |
| MDT | Organic revenue growth | Organic revenue growth |   | v2-pipeline-enrich | ER/ES |
| MDT | Sphere-360 CE Mark | Sphère-360 CE Mark |   | v2-pipeline-enrich | ER/ES |
| MELI | AUM_PER_USER | Encours géré par utilisateur | 264 $ | v2-pipeline | (aucun _source) |
| MELI | ECOSYSTEMIC_USERS | Croissance des utilisateurs présents sur les deux activités | 37 % sur un an | v2-pipeline | (aucun _source) |
| MELI | ITEMS_PER_BUYER | Articles achetés par acheteur | 14 % sur un an | v2-pipeline | (aucun _source) |
| META | DAP recul Iran/Russie | Repli trimestriel des utilisateurs (Iran, Russie) |   | v2-pipeline-enrich | ER/ES |
| META | Leadership lunettes IA | Position de leader sur les lunettes IA |   | v2-pipeline-enrich | ER/ES |
| META | Meta Superintelligence Labs | Premier modèle de Meta Superintelligence Labs |   | v2-pipeline-enrich | ER/ES |
| MKC | Asia Capacity Add | Ajout de capacité en Asie | 120 M unités | v2-pipeline-enrich | (aucun _source) |
| MKC | Asia Digital Penetration | Pénétration numérique en Asie | 22.4 % | v2-pipeline-enrich | (aucun _source) |
| MKC | Digital Recipe Engagements | Interactions sur recettes numériques | 45.3 M interactions | v2-pipeline-enrich | (aucun _source) |
| MKC | EMEA Brand Penetration | Pénétration de marque EMEA | 42.3 % | v2-pipeline-enrich | (aucun _source) |
| MKC | EMEA Plant Automation | Niveau d'automatisation des usines EMEA | 68 % | v2-pipeline-enrich | (aucun _source) |
| MKC | Flavor Solutions Wins | Nouveaux clients grands comptes | 15 clients | v2-pipeline-enrich | (aucun _source) |
| MKC | Private Label Growth | Croissance des marques de distributeur | 14.7 % | v2-pipeline-enrich | (aucun _source) |
| MLM | Aggregates Capacity Add | Ajout de capacité en granulats | 45 M unités | v2-pipeline-enrich | (aucun _source) |
| MLM | Crushed Stone Share | Part de marché en granulats concassés | 18.4 % | v2-pipeline-enrich | (aucun _source) |
| MLM | Magnesia Chem Sales | Ventes de Produits Chimiques à Base de Magnésie | 412.3 M $ | v2-pipeline-enrich | (aucun _source) |
| MLM | Railroad Customer Wins | Nouveaux contrats ferroviaires | 7 contrats | v2-pipeline-enrich | (aucun _source) |
| MRK.DE | Bioprocessing Capacity Growth | Croissance de la capacité de bioproduction | 25 % | v2-pipeline-enrich | (aucun _source) |
| MRK.DE | Bioprocessing Utilization | Taux d'utilisation des capacités de bioproduction | 88 % | v2-pipeline-enrich | (aucun _source) |
| MRK.DE | Emerging Markets Revenue Share | Part des marchés émergents dans le chiffre d'affaires | 38 % | v2-pipeline-enrich | (aucun _source) |
| MRK.DE | New Product Sales Penetration | Pénétration des ventes de nouveaux produits | 27 % | v2-pipeline-enrich | (aucun _source) |
| MRSH | Asia Risk Share | Part de marché Asie en courtage risque | 23.4 % | v2-pipeline-enrich | (aucun _source) |
| MRSH | Cyber Retention | Taux de rétention des clients cybersécurité | 94.7 % | v2-pipeline-enrich | (aucun _source) |
| MRSH | Digital Platforms | Plateformes numériques déployées | 89 plateformes | v2-pipeline-enrich | (aucun _source) |
| MRSH | Digital Underwriting | Capacité de souscription digitale | 61 % | v2-pipeline-enrich | (aucun _source) |
| MRSH | Digital Underwriting Capacity | Capacité annuelle de souscription numérique (en milliards USD) | 18.5 Mds $ | v2-pipeline-enrich | (aucun _source) |
| MRSH | ESG Client Attach Rate | Taux d'attachement des services ESG par client entreprise | 68 % | v2-pipeline-enrich | (aucun _source) |
| MRVL | DC_SHARE_Q | Part du data center dans le chiffre d'affaires | 79 % | v2-pipeline | (aucun _source) |
| MRVL | GM_NONGAAP_Q | Marge brute non-GAAP | 58.9 % | v2-pipeline | (aucun _source) |
| MRVL | GUIDANCE_Q3 | Chiffre d'affaires attendu au trimestre suivant | 3.15 Mds $ | v2-pipeline | (aucun _source) |
| MSCI | Climate Data Clients | Nombre de clients institutionnels utilisant les données climatiques de MSCI | 642 clients | v2-pipeline-enrich | (aucun _source) |
| MSCI | Climate Stress Tests | Tests de Résistance Climatiques | 132 tests | v2-pipeline-enrich | (aucun _source) |
| MSCI | ESG Clients | Clients ESG | 550 clients | v2-pipeline-enrich | (aucun _source) |
| MSCI | ESG Data API Calls | Appels API Données ESG | 1.2 Mds | v2-pipeline-enrich | (aucun _source) |
| MSCI | ESG Index AUM | Encours sous gestion des fonds utilisant les indices ESG de MSCI | 1.8 Mds $ | v2-pipeline-enrich | (aucun _source) |
| MSCI | ESG Index Launches | Nouveaux indices ESG lancés | 27 indices | v2-pipeline-enrich | (aucun _source) |
| MSCI | Index Launches | Lancements d'indices | 12 indices | v2-pipeline-enrich | (aucun _source) |
| MSCI | ai_fueled_innovation | ai_fueled_innovation |   | v2-pipeline-enrich | ER/ES |
| MSCI | best_q1_net_new_since_2022 | best_q1_net_new_since_2022 |   | v2-pipeline-enrich | ER/ES |
| MSCI | eleventh_year_double_digit | eleventh_year_double_digit |   | v2-pipeline-enrich | ER/ES |
| MSCI | record_etf_aum | record_etf_aum |   | v2-pipeline-enrich | ER/ES |
| MSCI | retention_resilient | retention_resilient |   | v2-pipeline-enrich | ER/ES |
| MSFT | Azure Utilisation | Taux d'utilisation Azure | 82 % | v2-pipeline-enrich | (aucun _source) |
| MSTR | BTC_HOLDINGS_LATEST | Bitcoins détenus au dernier point d'étape | 845050 bitcoins | v2-pipeline | (aucun _source) |
| MSTR | CREDIT_BUYBACK_AUTH | Autorisation de rachat de titres de crédit numérique | 2.0 Mds $ | v2-pipeline | (aucun _source) |
| MSTR | USD_RESERVE | Réserve en dollars | 5.1 Mds $ | v2-pipeline | (aucun _source) |
| MTD | Automated Lab Wins | Victoires dans les Laboratoires Automatisés | 47 clients | v2-pipeline-enrich | (aucun _source) |
| MTD | Emerging Market Labs | Laboratoires dans les Marchés Émergents | 158 installations | v2-pipeline-enrich | (aucun _source) |
| MTD | Lab Instrument Orders | Commandes d'instruments de laboratoire | 850 M $ | v2-pipeline-enrich | (aucun _source) |
| MTD | New Lab Product Launches | Nouveaux Lancements Produits Laboratoire | 14 lancements | v2-pipeline-enrich | (aucun _source) |
| MTD | Smart Lab Expansion | Expansion des laboratoires intelligents | 120 unités | v2-pipeline-enrich | (aucun _source) |
| MTD | Smart Lab Units | Unités de laboratoire intelligentes | 14200 unités | v2-pipeline-enrich | (aucun _source) |
| MUV2.DE | MIRA Digital Clients | Clients utilisant MIRA Digital | 48 k | v2-pipeline-enrich | (aucun _source) |
| MUV2.DE | MIRA PoS Clients | Clients MIRA PoS | 85 k | v2-pipeline-enrich | (aucun _source) |
| MUV2.DE | lh_strength | lh_strength |   | v2-pipeline-enrich | ER/ES |
| MUV2.DE | major_loss_impact | major_loss_impact |   | v2-pipeline-enrich | ER/ES |
| NBIS | LANDMARK_DEALS | Contrats majeurs signés dans le trimestre | 4 contrats | v2-pipeline | (aucun _source) |
| NBIS | POWER_TARGET | Objectif de puissance électrique contractée | 5 GW | v2-pipeline | (aucun _source) |
| NBIS | PREPAYMENTS | Acomptes clients attendus sur l'année | 9 Mds $ | v2-pipeline | (aucun _source) |
| NEE | Battery Utilization Rate | Taux d'utilisation des batteries | 320 cycles/an | v2-pipeline-enrich | (aucun _source) |
| NEE | Clean Energy Share | Part des énergies propres | 78 % | v2-pipeline-enrich | (aucun _source) |
| NEE | Solar Farm ROI | ROI des fermes solaires | 14.2 % | v2-pipeline-enrich | (aucun _source) |
| NESN.SW | AI-Powered Personalization | Utilisateurs de services personnalisés par IA | 4.7 M unités | v2-pipeline-enrich | (aucun _source) |
| NESN.SW | Asia E-commerce Share | Part de marché e-commerce en Asie | 23.4 % | v2-pipeline-enrich | (aucun _source) |
| NESN.SW | Coffee Pod Recycling Rate | Taux de recyclage des dosettes café | 32 % | v2-pipeline-enrich | (aucun _source) |
| NESN.SW | Coffee Subscriptions | Abonnements Nescafé Dolce Gusto | 8.7 M unités | v2-pipeline-enrich | (aucun _source) |
| NESN.SW | E-commerce Penetration | Pénétration du e-commerce | 18 % | v2-pipeline-enrich | (aucun _source) |
| NESN.SW | Emerging Markets Growth | Croissance dans les marchés émergents | 5.8 % | v2-pipeline-enrich | (aucun _source) |
| NESN.SW | Plant-Based Growth | Croissance des ventes de produits à base végétale | 14.2 % | v2-pipeline-enrich | (aucun _source) |
| NESN.SW | Plant-Based Sales | Ventes en produits à base végétale | 1.8 Mds $ | v2-pipeline-enrich | (aucun _source) |
| NESN.SW | R&D Pipeline Value | Valeur du portefeuille R&D | 3.2 Mds $ | v2-pipeline-enrich | (aucun _source) |
| NESN.SW | Water Replenishment Rate | Taux de réapprovisionnement en eau | 110 % | v2-pipeline-enrich | (aucun _source) |
| NFLX | Global Paid Net Adds | Abonnes payants nets ajoutes (monde) | 41.35 M | v2-pipeline | (aucun _source) |
| NFLX | Pub x2 | Pub x2 |   | v2-pipeline-enrich | ER/ES |
| NN.AS | capital_return_step_up | capital_return_step_up |   | v2-pipeline-enrich | ER/ES |
| NN.AS | exceeding_2025_targets | exceeding_2025_targets |   | v2-pipeline-enrich | ER/ES |
| NN.AS | future_ready_programme | future_ready_programme |   | v2-pipeline-enrich | ER/ES |
| NN.AS | vnb_growth_segments | vnb_growth_segments |   | v2-pipeline-enrich | ER/ES |
| NOVN.SW | China Oncology Share | Part de Marché Chine en Oncologie | 19.3 % | v2-pipeline-enrich | (aucun _source) |
| NOVN.SW | Digital Therapeutics Adoption | Adoption des thérapies numériques | 1.8 M patients | v2-pipeline-enrich | (aucun _source) |
| NOVN.SW | Gene Therapy Approvals | Approbations de thérapies géniques | 3 traitements | v2-pipeline-enrich | (aucun _source) |
| NOVN.SW | Pluvicto Output Rate | Taux de production Pluvicto | 8500 unités/mois | v2-pipeline-enrich | (aucun _source) |
| NOVN.SW | Pluvicto Prescriptions Growth | Croissance des prescriptions de Pluvicto | 34.7 % | v2-pipeline-enrich | (aucun _source) |
| NOVN.SW | Pluvicto Production Sites | Sites de Production Pluvicto | 5 sites | v2-pipeline-enrich | (aucun _source) |
| NOVN.SW | R&D AI Trial Acceleration | Accélération des essais cliniques par IA | 35 % | v2-pipeline-enrich | (aucun _source) |
| NOVN.SW | Radioligand Site Expansion | Expansion du nombre de sites de production de radioligands | 7 sites | v2-pipeline-enrich | (aucun _source) |
| NOVN.SW | Radioligand Uptake | Pénétration des Radioligands | 28.4 % | v2-pipeline-enrich | (aucun _source) |
| NOVN.SW | Siponimod US Penetration | Pénétration Siponimod aux États-Unis | 68 % | v2-pipeline-enrich | (aucun _source) |
| NOVN.SW | Zolgensma Cost Reduction | Réduction des coûts de production de Zolgensma | 18.4 % | v2-pipeline-enrich | (aucun _source) |
| NOW | ai_control_tower_positioning | ai_control_tower_positioning |   | v2-pipeline-enrich | ER/ES |
| NOW | anthropic_claude_partnership | anthropic_claude_partnership |   | v2-pipeline-enrich | ER/ES |
| NOW | armis_veza_security_stack | armis_veza_security_stack |   | v2-pipeline-enrich | ER/ES |
| NOW | autonomous_workforce_launch | autonomous_workforce_launch |   | v2-pipeline-enrich | ER/ES |
| NOW | now_assist_1m_acv_130pct | now_assist_1m_acv_130pct |   | v2-pipeline-enrich | ER/ES |
| NOW | rule_of_55_profile | rule_of_55_profile |   | v2-pipeline-enrich | ER/ES |
| NVDA | Cloud RPO | Revenu contractuel à plus d'un an | 2.3 Mds $ | v2-pipeline | (aucun _source) |
| NVDA | DGX SuperPOD Deployments | Déploiements DGX SuperPOD | 37 unités | v2-pipeline-enrich | (aucun _source) |
| NVR | Capacity Additions | Ajouts de capacité | 1200 unités | v2-pipeline-enrich | (aucun _source) |
| NVR | Southeast Expansion | Expansion dans le Sud-Est | 12 comtés | v2-pipeline-enrich | (aucun _source) |
| NVR | Southeast Units | Unités en expansion du Sud-Est | 1250 unités | v2-pipeline-enrich | (aucun _source) |
| NWS | Bookings | Commandes nettes | 3.1 B $ | v2-pipeline | (aucun _source) |
| NWSA | Bookings | Commandes nettes | 3.1 B $ | v2-pipeline | (aucun _source) |
| NXPI | Acq Aviva | Acquisition Aviva Links | 222 M$ | v2-pipeline | (aucun _source) |
| NXPI | Acq TTTech | Acquisition TTTech Auto | 766 M$ | v2-pipeline | (aucun _source) |
| O | Retail Rental Revenue | Revenu locatif Retail | 4325.7 M $ | v2-pipeline | 10-K FY2025 (O_2026-02-25) rental revenue by property type verbatim |
| O | UK Rental Revenue | Revenu locatif Royaume-Uni | 619.9 M $ | v2-pipeline | 10-K FY2025 (O_2026-02-25) rental revenue by geography verbatim |
| OKE | Acquisition d'EnLink | Acquisition d'EnLink | 4 Mds $ | v2-pipeline | (aucun _source) |
| OKE | Eiger Express Pipeline | Pipeline Eiger Express | 0.35 Mds $ | v2-pipeline | (aucun _source) |
| ORCL | 850 MW livrés | Capacité IA livrée au trimestre | 850 MW | v2-pipeline-enrich | transcript |
| ORCL | AI code gen | AI code gen |   | v2-pipeline-enrich | ER/ES |
| ORCL | Abilene 618 MW | Capacité livrée sur le campus d'Abilene | 618 MW | v2-pipeline-enrich | transcript |
| ORCL | Connecteur IA NetSuite | Clients du connecteur IA NetSuite | 10 milliers de clients | v2-pipeline-enrich | transcript |
| ORCL | Contrats IA 30 Mds | Nouveaux contrats IA signés au trimestre | 30 Mds $ | v2-pipeline-enrich | transcript |
| ORCL | GPU util. 97,9% | Taux d'utilisation du parc GPU | 97.9 % | v2-pipeline-enrich | transcript |
| ORCL | IA embarquée 150 M | Utilisations de l'IA embarquée dans les applications | 150 millions | v2-pipeline-enrich | transcript |
| ORCL | Multicloud +353% | Croissance du revenu Multicloud Database | 353 % | v2-pipeline-enrich | transcript |
| ORCL | Prépaiements 11,4 Mds | Prépaiements clients reçus au trimestre | 11.4 Mds $ | v2-pipeline-enrich | 10-Q |
| ORCL | Renouv. GPU +20% | Prime de prix sur les capacités GPU renouvelées | 20 % | v2-pipeline-enrich | transcript |
| ORCL | Tokens Fusion 900 Mds | Tokens IA consommés dans Fusion | 900 milliards | v2-pipeline-enrich | transcript |
| ORCL | Vente Ampere | Vente Ampère |   | v2-pipeline-enrich | ER/ES |
| ORLY | Magasins Mexique | Nombre de magasins au Mexique | 87 magasins | v2-pipeline | (aucun _source) |
| OTIS | China Share | Part de Marché Chine | 18.5 % | v2-pipeline-enrich | (aucun _source) |
| OTIS | India Install Growth | Croissance des installations en Inde | 24 % | v2-pipeline-enrich | (aucun _source) |
| OTIS | India Service Expansion | Expansion du Service en Inde | 12500 contrats | v2-pipeline-enrich | (aucun _source) |
| OTIS | Marché Chine | Part de marché en Chine | 30 % | v2-pipeline-enrich | (aucun _source) |
| OTIS | Modernization Rate | Taux de Modernisation | 48000 unités | v2-pipeline-enrich | (aucun _source) |
| OTIS | Smart Elevator Bookings | Commandes d'Ascenseurs Intelligents | 2.4 Mds $ | v2-pipeline-enrich | (aucun _source) |
| OTIS | Smart Fleet | Flotte Connectée | 2.3 M unités | v2-pipeline-enrich | (aucun _source) |
| OTIS | Smart Modernization Share | Part des modernisations intelligentes | 42 % | v2-pipeline-enrich | (aucun _source) |
| P911.DE | EV Deliveries | Livraisons de véhicules électriques | 28.5 M unités | v2-pipeline-enrich | (aucun _source) |
| P911.DE | R&D EV Focus | Part des dépenses R&D dédiée aux véhicules électriques | 68% % | v2-pipeline-enrich | (aucun _source) |
| P911.DE | Taycan Share | Part des livraisons représentée par le Taycan | 22% % | v2-pipeline-enrich | (aucun _source) |
| P911.DE | Zuffenhausen Capacity | Capacité annuelle de production à Zuffenhausen | 120 M unités | v2-pipeline-enrich | (aucun _source) |
| PANW | Cortex XSIAM Customers | Clients Cortex XSIAM | 310 clients | v2-pipeline-enrich | (aucun _source) |
| PANW | Unit 42 Threat Reports | Rapports de menaces Unit 42 | 89 rapports | v2-pipeline-enrich | (aucun _source) |
| PANW | Zero Trust Wins | Victoires Zero Trust | 480 contrats | v2-pipeline-enrich | (aucun _source) |
| PAYX | PEO/Insurance Revenue | Revenu PEO et assurance | 1.34 Mds $ | v2-pipeline | (aucun _source) |
| PCAR | New Loan & Lease Volume | Volume de prets et baux nouveaux | 7.5 Mds $ | v2-pipeline | (aucun _source) |
| PCAR | PACCAR Financial Portfolio | Portefeuille PACCAR Financial | 22.41 Mds $ | v2-pipeline | (aucun _source) |
| PCAR | PACCAR Parts Revenue | Ventes de pieces PACCAR | 6.67 Mds $ | v2-pipeline | (aucun _source) |
| PDD | CASH_POSITION | Trésorerie et placements à court terme | 456.4 Mds RMB | v2-pipeline | (aucun _source) |
| PG | Gillette SkinGuard Launch | Lancement Gillette SkinGuard | 18 pays | v2-pipeline-enrich | (aucun _source) |
| PG | Savon Factory Capacity | Capacité usine savon | 1.8 M unités | v2-pipeline-enrich | (aucun _source) |
| PG | Tide Eco Pods Volume | Volume des capsules écologiques Tide | 1.4 Mds unités | v2-pipeline-enrich | (aucun _source) |
| PGHN.SW | AVG_AUM_H | Encours moyens de la période | 145.9 Mds CHF | v2-pipeline-enrich | (aucun _source) |
| PGHN.SW | AVK_POWER_GW | Puissance électrique installee (AVK) | 3.5 GW | v2-pipeline-enrich | (aucun _source) |
| PGHN.SW | EQUITY_H | Fonds propres | 1464 M CHF | v2-pipeline-enrich | (aucun _source) |
| PGHN.SW | MGMT_INCOME_EBITDA_H | EBITDA du résultat de gestion | 572 M CHF | v2-pipeline-enrich | (aucun _source) |
| PGHN.SW | ROE_H | Rentabilité des fonds propres (semestre) | 55.0 % | v2-pipeline-enrich | (aucun _source) |
| PHIA.AS | ai_cardiology | ai_cardiology |   | v2-pipeline-enrich | ER/ES |
| PHIA.AS | monitoring_as_a_service | monitoring_as_a_service |   | v2-pipeline-enrich | ER/ES |
| PHIA.AS | order_intake_accel | order_intake_accel |   | v2-pipeline-enrich | ER/ES |
| PHIA.AS | patent_leadership | patent_leadership |   | v2-pipeline-enrich | ER/ES |
| PHIA.AS | personal_health_margin | personal_health_margin |   | v2-pipeline-enrich | ER/ES |
| PHIA.AS | tariff_pressure | tariff_pressure |   | v2-pipeline-enrich | ER/ES |
| PKG | Corrugated Product Shipments Growth | Croissance des expéditions de produits corrugés | 6.3 % | v2-pipeline | (aucun _source) |
| PLD | New Market Entry | Nouveaux marchés pénétrés | 5 marchés | v2-pipeline-enrich | (aucun _source) |
| PLD | Smart Hubs Penetration | Pénétration des hubs logistiques intelligents | 68 % | v2-pipeline-enrich | (aucun _source) |
| PLD | Smart Hubs in Emerging Markets | Hubs intelligents dans les marchés émergents | 18 hubs | v2-pipeline-enrich | (aucun _source) |
| PLD | Smart Hubs in Europe | Hubs intelligents en Europe | 68 hubs | v2-pipeline-enrich | (aucun _source) |
| PLD | Smart Logistics Hubs | Hubs logistiques intelligents | 89 centres | v2-pipeline-enrich | (aucun _source) |
| PLD | Smart Warehouse % | Pourcentage de entrepôts intelligents | 34 % | v2-pipeline-enrich | (aucun _source) |
| PLTR | Commercial US x7 en 3 ans | Le commercial US explose : de 77 M$ à 595 M$ par trimestre |   | v2-pipeline-enrich | ER/ES |
| PLTR | Record TCV 4,3 Mds$ | Valeur contractuelle signée record de 4,3 Mds$ au T4 2025 |   | v2-pipeline-enrich | ER/ES |
| PLTR | Rule of 40 a 145% | Rule of 40 pulvérisé à 145 % au T1 2026 |   | v2-pipeline-enrich | ER/ES |
| PNW | Flexible Gas Capacity | Capacité à gaz flexible ajoutée | 2000 MW | v2-pipeline | (aucun _source) |
| PPG | Aerospace Backlog | Carnet aéronautique | 315 M $ | v2-pipeline | PPG 10-K FY25 (2026-02-19) MD&A Performance Coatings |
| PPL | 2025 earnings hit | 2025 earnings hit |   | v2-pipeline-enrich | ER/ES |
| PPL | Capital plan execution | Capital plan execution |   | v2-pipeline-enrich | ER/ES |
| PPL | Cost savings leadership | Cost savings leadership |   | v2-pipeline-enrich | ER/ES |
| PPL | Rate case settlement | Rate case settlement |   | v2-pipeline-enrich | ER/ES |
| PPL | Reaffirmed EPS forecast | Reaffirmed EPS forecast |   | v2-pipeline-enrich | ER/ES |
| PPL | Solar Capacity Add | Capacité solaire ajoutée | 0.45 GW | v2-pipeline-enrich | (aucun _source) |
| PPL | Solar Farm Pipeline | Projet de parcs solaires en pipeline | 2.3 GW | v2-pipeline-enrich | (aucun _source) |
| PRU | Prismic Re | Participation Prismic Re | 20 % | v2-pipeline | Prudential 10-K FY25 (2026-02-12) MD&A Prismic |
| PSA | NOI 2025 | Revenu net d'exploitation 2025 | 1600 M$ | v2-pipeline | (aucun _source) |
| PSKY | Paramount+ Subs | Abonnés Paramount+ | 78.9 M | v2-pipeline | Paramount Skydance 10-K FY25 (2026-02-25) MD&A Direct-to-Consumer |
| PSX | Chemicals | Revenus Chemicals | 0.3 Mds $ | v2-pipeline | (aucun _source) |
| PSX | Midstream | Revenus Midstream | 2.8 Mds $ | v2-pipeline | (aucun _source) |
| PTC | ARR growth | ARR growth |   | v2-pipeline-enrich | ER/ES |
| PTC | Arena Cloud Migration | Clients Arena migrés vers le cloud | 76 % | v2-pipeline-enrich | (aucun _source) |
| PTC | Arena SaaS Retention | Rétention Arena SaaS | 95.5 % | v2-pipeline-enrich | (aucun _source) |
| PTC | New repurchase plan | New repurchase plan |   | v2-pipeline-enrich | ER/ES |
| PTC | Operating Cash Flow | Flux de trésorerie d'exploitation |  M $ | v2-pipeline-enrich (fusionnee avec la story v2-pipeline de meme id) | (aucun _source) |
| PTC | ServiceMax Attach Rate | Taux d'attachement ServiceMax | 38 % | v2-pipeline-enrich | (aucun _source) |
| PTC | Share repurchases Q2 | Share repurchases Q2 |   | v2-pipeline-enrich | ER/ES |
| PTC | ThingWorx IoT Customers | Clients ThingWorx IoT | 480 clients | v2-pipeline-enrich | (aucun _source) |
| PYPL | Buy Now Pay Later Penetration | Pénétration du Paiement Fractionné | 28.5 % | v2-pipeline-enrich | (aucun _source) |
| PYPL | Buy Now Pay Later Usage | Utilisation du Paiement en Plusieurs Fois | 185 M unités | v2-pipeline-enrich | (aucun _source) |
| PYPL | International TPV Share | Part des TPV Hors États-Unis | 42.3 % | v2-pipeline-enrich | (aucun _source) |
| PYPL | Transactions / compte | Transactions de paiement par compte actif | 60.6 transactions | v2-pipeline | (aucun _source) |
| PYPL | Venmo Credit Card Spend | Dépense sur Carte de Crédit Venmo | 12.4 Mds $ | v2-pipeline-enrich | (aucun _source) |
| PYPL | Venmo Credit Growth | Croissance du crédit Venmo | 37 % | v2-pipeline-enrich | (aucun _source) |
| PYPL | Venmo Monétisation | Taux de Monétisation de Venmo | 3.8 % | v2-pipeline-enrich | (aucun _source) |
| PYPL | Venmo P2P Volume Share | Part de marché des transferts P2P sur Venmo | 48 % | v2-pipeline-enrich | (aucun _source) |
| PYPL | Venmo Revenue Growth | Croissance des Revenus de Venmo | 45.2 Mds $ | v2-pipeline-enrich | (aucun _source) |
| Q | HBM Material Share | Part de marché des matériaux pour HBM | 35 % | v2-pipeline-enrich | (aucun _source) |
| Q | HBM5 Material Penetration | Pénétration Matériau HBM5 | 65 % | v2-pipeline-enrich | (aucun _source) |
| Q | India Fab Utilization Rate | Taux d'Utilisation Usine Inde | 82 % | v2-pipeline-enrich | (aucun _source) |
| Q | India Facility Output | Production de l'usine en Inde | 4.2 M unités | v2-pipeline-enrich | (aucun _source) |
| Q | Southeast Asia Capacity | Capacité de production en Asie du Sud-Est | 18 GW | v2-pipeline-enrich | (aucun _source) |
| Q | Vietnam Output | Production Vietnam | 45 M unités | v2-pipeline-enrich | (aucun _source) |
| QCOM | Auto Platform Share | Part de marché des plateformes automobiles | 32 % | v2-pipeline-enrich | (aucun _source) |
| QCOM | Entree data center | Entrée data center |   | v2-pipeline-enrich | ER/ES |
| QCOM | XR Device Share | Part de marché des dispositifs XR | 62 % | v2-pipeline-enrich | (aucun _source) |
| QRVO | ANDROID_RESIZE | Réduction volontaire du chiffre d'affaires Android | -300 M$ | v2-pipeline | (aucun _source) |
| QRVO | DEFENSE_REV_FY | Chiffre d'affaires défense et aérospatial attendu | 500 M$ | v2-pipeline | (aucun _source) |
| RDDT | Ad Context Match | Taux de Correspondance Contextuelle | 68 % | v2-pipeline-enrich | (aucun _source) |
| RDDT | Intl Communities | Nouveaux forums internationaux | 14200 unités | v2-pipeline-enrich | (aucun _source) |
| RDDT | Intl Community Growth | Croissance des Communautés Internationales | 14200 communautés | v2-pipeline-enrich | (aucun _source) |
| RDDT | Video Upload Surge | Hausse des Téléversements Vidéo | 57 % | v2-pipeline-enrich | (aucun _source) |
| REGN | Dupixent Patient Growth | Croissance du nombre de patients sous Dupixent | 850 M patients | v2-pipeline-enrich | (aucun _source) |
| REGN | Ex-U.S. Sales Growth | Croissance des ventes hors États-Unis | 19.5 % | v2-pipeline-enrich | (aucun _source) |
| REGN | Pipeline Milestones | Jalons du pipeline | 8 jalons | v2-pipeline-enrich | (aucun _source) |
| RF | Digital Engagement | Taux d'Engagement Numérique | 42 % | v2-pipeline-enrich | (aucun _source) |
| RF | Midwest Loan AI Share | Part des Prêts Grand Centre avec IA | 67 % | v2-pipeline-enrich | (aucun _source) |
| RF | Texas Branch Expansion | Expansion des succursales au Texas | 12 succursales | v2-pipeline-enrich | (aucun _source) |
| RF | Texas Digital Penetration | Pénétration numérique au Texas | 68.4 % | v2-pipeline-enrich | (aucun _source) |
| RHI | Déploiement solutions IA (Protiviti) | Déploiement de solutions IA chez Protiviti | Non spécifié N/A | v2-pipeline | (aucun _source) |
| RHI | Investissement IA | Investissement dans l'IA | Non spécifié N/A | v2-pipeline | (aucun _source) |
| RHM.DE | Ammo Production Uptime | Taux d'Activité Usines Munitions | 94 % | v2-pipeline-enrich | (aucun _source) |
| RHM.DE | Hungary Plant Capacity | Capacité Usine Hongrie | 150 véhicules/an | v2-pipeline-enrich | (aucun _source) |
| RHM.DE | NATO Share Armored Vehicles | Part de Marché Véhicules Blindés OTAN | 38 % | v2-pipeline-enrich | (aucun _source) |
| RHM.DE | Ukraine Delivery Rate | Taux de Livraison Ukraine | 18 unités/mois | v2-pipeline-enrich | (aucun _source) |
| RJF | Académie IA | Personnes formées par l'académie IA |   | v2-pipeline-enrich | Transcript |
| RJF | Capital excédentaire 1,5 Mds $ | Capital excédentaire disponible |   | v2-pipeline-enrich | Transcript |
| RJF | Dépôts garantis 83 % | Part des dépôts garantis FDIC |   | v2-pipeline-enrich | 10-Q |
| RJF | Provisions sur prêts 0,70 % | Provisions pour pertes sur prêts |   | v2-pipeline-enrich | 10-Q |
| RJF | Prêts titres et immobilier 64 % | Part des prêts sur titres et immobiliers |   | v2-pipeline-enrich | Transcript |
| RJF | Rendement dépôts banques tierces | Rendement des dépôts placés en banques tierces |   | v2-pipeline-enrich | 10-Q |
| RJF | Satisfaction conseillers 97 % | Satisfaction des conseillers |   | v2-pipeline-enrich | Transcript |
| RKLB | ARCHIMEDES_HOTFIRES | Essais a feu du moteur Archimedes | 400 essais | v2-pipeline | (aucun _source) |
| RKLB | LAUNCH_BACKLOG | Carnet de lancements | 90 lancements | v2-pipeline | (aucun _source) |
| RKLB | NEUTRON_PAD | Livraison de Neutron sur le pas de tir | T4 2026 echeance | v2-pipeline | (aucun _source) |
| RKLB | USSF_CONTRACT | Contrat de lancement de l armee de l air spatiale américaine | 266 M$ | v2-pipeline | (aucun _source) |
| RMBS | HBM_DESIGN_WIN | Contrat de conception mémoire à haute bande passante | 1 contrat | v2-pipeline | (aucun _source) |
| RMBS | PCIE7_SWITCH | Débit de la propriété intellectuelle de commutateur PCIe 7 | 128 GT/s | v2-pipeline | (aucun _source) |
| RMD | CashReturn | CashReturn |   | v2-pipeline-enrich | ER/ES |
| RMD | Cloud Connect Growth | Croissance du taux de connexion cloud | 14.7 % | v2-pipeline-enrich | (aucun _source) |
| RMD | Cloud Connect Penetration | Pénétration des dispositifs connectés au cloud | 78 % | v2-pipeline-enrich | (aucun _source) |
| RMD | Cloud Connect Rate | Taux de connexion cloud | 89 % | v2-pipeline-enrich | (aucun _source) |
| RMD | RevenueGrowth | RevenueGrowth |   | v2-pipeline-enrich | ER/ES |
| RMD | RevenueStability | RevenueStability |   | v2-pipeline-enrich | ER/ES |
| RMD | TaxReserve | TaxReserve |   | v2-pipeline-enrich | ER/ES |
| ROG.SW | Global Test Volume | Volume mondial de tests | 11.8 Mds unités | v2-pipeline-enrich | (aucun _source) |
| ROG.SW | US Biomanufacturing Capacity | Capacité de bioproduction US | 120 kL | v2-pipeline-enrich | (aucun _source) |
| ROG.SW | Vabysmo Penetration | Pénétration de Vabysmo | 42 % | v2-pipeline-enrich | (aucun _source) |
| ROL | Mix recurrent | Part des services récurrents | 75 % | v2-pipeline | 10-K 2026 (ROL_2026-02-12), Item 1 Business |
| RTX | Commercial Backlog | Carnet commercial | 161 Mds $ | v2-pipeline | 10-K RTX FY2023-FY2025 (commercial backlog) |
| RVTY | Software Revenue | Revenu logiciels (Life Sciences) | 236.376 M $ | v2-pipeline | 10-K RVTY FY2025 (RVTY_2026-02-24), disaggregation Major goods/service lines |
| RWE.DE | Green Hydrogen Projects | Projets d'hydrogène vert | 6 projets | v2-pipeline-enrich | (aucun _source) |
| RWE.DE | Offshore Wind GW | Capacité éolien en mer | 5.1 GW | v2-pipeline-enrich | (aucun _source) |
| RXL.PA | 2026_outlook | 2026_outlook |   | v2-pipeline-enrich | ER/ES |
| RXL.PA | Smart Building Projects | Projets Bâtiment Intelligent | 147 projets | v2-pipeline-enrich | (aucun _source) |
| RXL.PA | digital_ramp_up | digital_ramp_up |   | v2-pipeline-enrich | ER/ES |
| RXL.PA | europe_recovery | europe_recovery |   | v2-pipeline-enrich | ER/ES |
| RXL.PA | north_america_growth | north_america_growth |   | v2-pipeline-enrich | ER/ES |
| RXL.PA | region_positive | region_positive |   | v2-pipeline-enrich | ER/ES |
| SAP.DE | Network Nodes | Nœuds Actifs sur SAP Business Network | 7.3 M unités | v2-pipeline-enrich | (aucun _source) |
| SAP.DE | S/4HANA Cloud Growth | Croissance S/4HANA Cloud | 28 % | v2-pipeline-enrich | (aucun _source) |
| SAP.DE | S/4HANA Industry Cloud | S/4HANA Cloud Sectoriel | 850 clients | v2-pipeline-enrich | (aucun _source) |
| SAP.DE | S/4HANA Migration | Taux de Migration vers S/4HANA | 78 % | v2-pipeline-enrich | (aucun _source) |
| SAP.DE | Signavio Customer Count | Nombre de clients Signavio | 4500 clients | v2-pipeline-enrich | (aucun _source) |
| SAP.DE | Signavio Process Maps | Cartes Processus Signavio | 1.2M unités | v2-pipeline-enrich | (aucun _source) |
| SAP.DE | Signavio Process Mining | Utilisateurs Actifs Signavio | 2.1 M utilisateurs | v2-pipeline-enrich | (aucun _source) |
| SBAC | Domestic Sites | Sites détenus aux États-Unis | 17394 unites | v2-pipeline | SEC EDGAR 10-K SBAC FY2023-FY2025 (Item 1, US sites owned) |
| SBUX | Magasins Chine | Magasins detenus en propre en Chine | 8009 magasins | v2-pipeline | (aucun _source) |
| SGSN.SW | Asia Growth Rate | Taux de croissance en Asie | 9.8 % | v2-pipeline-enrich | (aucun _source) |
| SGSN.SW | Cybersecurity Clients | Clients en cybersécurité | 230 clients | v2-pipeline-enrich | (aucun _source) |
| SGSN.SW | ESG Audits | Audits ESG réalisés | 1560 audits | v2-pipeline-enrich | (aucun _source) |
| SGSN.SW | New Labs Opened | Nouveaux laboratoires ouverts | 14 labos | v2-pipeline-enrich | (aucun _source) |
| SHL.DE | CEO dividend raise | CEO dividend raise |   | v2-pipeline-enrich | ER/ES |
| SHL.DE | EBIT margin up 2025 | EBIT margin up 2025 |   | v2-pipeline-enrich | ER/ES |
| SHL.DE | FCF 2025 | FCF 2025 |   | v2-pipeline-enrich | ER/ES |
| SHL.DE | record book-to-bill 2025 | record book-to-bill 2025 |   | v2-pipeline-enrich | ER/ES |
| SHOP | COUNTRIES | Pays où des marchands utilisent la plateforme | 175 pays | v2-pipeline-enrich | (aucun _source) |
| SHOP | FCF_MARGIN_Q | Marge de trésorerie disponible | 18 % | v2-pipeline-enrich | (aucun _source) |
| SHOP | GMV_GROWTH_CC_Q | Croissance du volume de marchandises à taux de change constant | 30 % | v2-pipeline-enrich | (aucun _source) |
| SHW | Coatings Capacity Add | Ajout de Capacité en Revêtements | 120 M gallons | v2-pipeline-enrich | (aucun _source) |
| SHW | LatAm Pro Penetration | Pénétration Pro en Amérique latine | 62 % | v2-pipeline-enrich | (aucun _source) |
| SHW | Mexico Store Density | Densité de Magasins au Mexique | 4.7 magasins/Mhab | v2-pipeline-enrich | (aucun _source) |
| SHW | Pro App Engagement | Engagement sur l'App Pro | 8.3 sessions/utilisateur/mois | v2-pipeline-enrich | (aucun _source) |
| SHW | Pro Retention Rate | Taux de Rétention des Clients Pros | 89.4 % | v2-pipeline-enrich | (aucun _source) |
| SHW | Smart App Active Users | Utilisateurs Actifs de l'Application Intelligente | 2.3 M utilisateurs | v2-pipeline-enrich | (aucun _source) |
| SLHN.SW | CSM_RELEASE_H | Liberation de marge sur services contractuels | 617 M CHF | v2-pipeline-enrich | (aucun _source) |
| SLHN.SW | GWP_CH_H | Primes brutes en Suisse | 6750 M CHF | v2-pipeline-enrich | (aucun _source) |
| SLHN.SW | INS_REV_H | Recettes d assurance | 4461 M CHF | v2-pipeline-enrich | (aucun _source) |
| SLHN.SW | JOB_CUTS_2028 | Postes supprimes d'ici fin 2028 | 600 postes | v2-pipeline-enrich | (aucun _source) |
| SLHN.SW | NET_INV_INC_H | Produit net des placements | 2403 M CHF | v2-pipeline-enrich | (aucun _source) |
| SMCI | CUSTOMERS_OVER_1BN | Clients à plus de 1 Md $ de chiffre d'affaires | 9 clients | v2-pipeline-enrich | Transcript |
| SMCI | DCBBS_KEY_SUBSYSTEMS | Sous-systèmes de l'offre data center clés en main | 10 sous-systèmes | v2-pipeline-enrich | 10-K |
| SMCI | FY2027_REVENUE_GUIDANCE_LOW | Objectif de chiffre d'affaires exercice 2027 (bas de fourchette) | 65 Mds $ | v2-pipeline-enrich | Transcript |
| SMCI | MANDATORY_CONVERTIBLE_PREFERRED | Actions préférentielles convertibles obligatoires émises | 4.2 Mds $ | v2-pipeline-enrich | Transcript |
| SMCI | OEM_LARGE_DC_REVENUE_Q4 | CA OEM et grands data centers au T4 | 5.5 Mds $ | v2-pipeline-enrich | Transcript |
| SMCI | US_MANUFACTURING_FOOTPRINT | Surface industrielle aux États-Unis | 4 M pieds carrés | v2-pipeline-enrich | Transcript |
| SNDK | Goodwill_Impairment |  |   | v2-pipeline | (aucun _source) |
| SNDK | Strategic_Equity_Investment_Nanya |  |   | v2-pipeline | (aucun _source) |
| SNPS | Revenus upfront | Revenus produits upfront | 2.01 Mds $ | v2-pipeline | (aucun _source) |
| SOLV | EMEA Dental Share | Part de marché dentaire EMEA | 18.5 % | v2-pipeline-enrich | (aucun _source) |
| SOLV | HIS SaaS Retention | Taux de rétention SaaS HIS | 94.7 % | v2-pipeline-enrich | (aucun _source) |
| SOLV | HIS Software Attach Rate | Taux d'attachement des logiciels HIS | 68 % | v2-pipeline-enrich | (aucun _source) |
| SOLV | Medsurg Smart Dressing Capacity | Capacité de production des pansements intelligents | 8.5 M unités | v2-pipeline-enrich | (aucun _source) |
| SOLV | New APAC Dental Clinics | Nouvelles cliniques en Asie-Pacifique | 470 cliniques | v2-pipeline-enrich | (aucun _source) |
| SOLV | Purification and Filtration Business Sale |  |   | v2-pipeline | (aucun _source) |
| SOLV | Smart Dressing Capacity | Capacité de production de pansements intelligents | 2.1 M unités | v2-pipeline-enrich | (aucun _source) |
| SOLV | Smart Wound Trials | Essais cliniques de pansements intelligents | 7 essais | v2-pipeline-enrich | (aucun _source) |
| SOLV | adoption_360_encompass | adoption_360_encompass |   | v2-pipeline-enrich | ER/ES |
| SOLV | launch_filketch_warmer | launch_filketch_warmer |   | v2-pipeline-enrich | ER/ES |
| SOLV | revenue_cycle_growth | revenue_cycle_growth |   | v2-pipeline-enrich | ER/ES |
| SOLV | sale_purification_filtration | sale_purification_filtration |   | v2-pipeline-enrich | ER/ES |
| SPCX | effectifs | Effectifs | 22000 salariés | v2-pipeline | Rapport de la societe : prospectus d introduction en Bourse 424B4 du 12 juin 2026, section |
| SPCX | falcon_cumul | Lancements Falcon cumulés depuis l'origine | 699 lancements | v2-pipeline | Wikipedia, List of Falcon 9 and Falcon Heavy launches, releve du 10 septembre 2026 |
| SPCX | lch_2026_ytd | Lancements Falcon depuis le 1er janvier 2026 | 106 lancements | v2-pipeline | Wikipedia, List of Falcon 9 and Falcon Heavy launches, releve du 10 septembre 2026 |
| SPCX | starlink_lances | Satellites Starlink lancés depuis l'origine | 12935 satellites | v2-pipeline | Base de suivi des satellites Starlink de Jonathan McDowell (planet4589.org), releve du 10  |
| SPCX | starship_essais | Vols d'essai Starship réalisés | 12 vols d'essai | v2-pipeline | Rapport de la societe : prospectus d introduction en Bourse 424B4 du 12 juin 2026, section |
| SPCX | tam_ai | Marché adressable estimé du secteur IA | 26500 Mds $ | v2-pipeline | Rapport de la societe : prospectus d introduction en Bourse 424B4 du 12 juin 2026, section |
| SPCX | tam_conn | Marché adressable estimé de la Connectivité | 870 Mds $ | v2-pipeline | Rapport de la societe : prospectus d introduction en Bourse 424B4 du 12 juin 2026, section |
| SPCX | tam_space | Marché adressable estimé du secteur Espace | 370 Mds $ | v2-pipeline | Rapport de la societe : prospectus d introduction en Bourse 424B4 du 12 juin 2026, section |
| SPGI | Asia-Pacific Client Penetration | Pénétration client en Asie-Pacifique | 68 % | v2-pipeline-enrich | (aucun _source) |
| SPGI | Auto Data Partners | Partenaires Données Automobile | 67 partners | v2-pipeline-enrich | (aucun _source) |
| SPGI | EMEA Client Growth | Croissance clients EMEA | 14.8 % | v2-pipeline-enrich | (aucun _source) |
| SPGI | Energy Transition Data Subscribers | Abonnés aux données sur la transition énergétique | 348 clients | v2-pipeline-enrich | (aucun _source) |
| SPGI | Green Index AUM | Encours des Indices Durables | 850 Mds $ | v2-pipeline-enrich | (aucun _source) |
| SPGI | LeadershipTransition2024 | LeadershipTransition2024 |   | v2-pipeline-enrich | ER/ES |
| SPGI | MarginImprovement2025 | MarginImprovement2025 |   | v2-pipeline-enrich | ER/ES |
| SPGI | Platform Attach Rate | Taux d'attachement plateforme | 67 % | v2-pipeline-enrich | (aucun _source) |
| SPGI | Platform Integration Rate | Taux d'intégration des plateformes | 54 % | v2-pipeline-enrich | (aucun _source) |
| SPGI | RevGrowth2025 | RevGrowth2025 |   | v2-pipeline-enrich | ER/ES |
| SPGI | ShareholderReturn2025 | ShareholderReturn2025 |   | v2-pipeline-enrich | ER/ES |
| SPGI | Sustainable Indices AUM Growth | Croissance de l'AUM des indices durables | 1.85 Mds $ | v2-pipeline-enrich | (aucun _source) |
| SPGI | VitalityShare2024 | VitalityShare2024 |   | v2-pipeline-enrich | ER/ES |
| SRE | Oncor Rate Base | Base tarifaire d'Oncor | 26.6 Mds $ | v2-pipeline | (aucun _source) |
| SREN.SW | Climate Risk Models | Modèles de Risque Climatique | 7 modèles | v2-pipeline-enrich | (aucun _source) |
| SREN.SW | Insurtech Partnerships | Partenariats Insurtech | 14 partenariats | v2-pipeline-enrich | (aucun _source) |
| SREN.SW | Parametric Insurance Penetration | Pénétration Assurance Paramétrique | 12 % | v2-pipeline-enrich | (aucun _source) |
| SREN.SW | Resilience Infrastructure Capacity | Capacité Infrastructures Résilientes | 4.2 Mds $ | v2-pipeline-enrich | (aucun _source) |
| SYK | Cyber recovery | Cyber recovery |   | v2-pipeline-enrich | ER/ES |
| SYK | Double-digit sales | Double-digit sales |   | v2-pipeline-enrich | ER/ES |
| SYK | Margin expansion | Margin expansion |   | v2-pipeline-enrich | ER/ES |
| SYK | Ortho Tech launch | Ortho Tech launch |   | v2-pipeline-enrich | ER/ES |
| SYK | Revenue milestone | Revenue milestone |   | v2-pipeline-enrich | ER/ES |
| SYY | Cold Chain Capacity | Capacité de la chaîne du froid | 14.8 M unités | v2-pipeline-enrich | (aucun _source) |
| SYY | Cold Chain Hubs | Centres de Chaîne Froide | 38 centres | v2-pipeline-enrich | (aucun _source) |
| SYY | Digital Customer Base | Base de clients numériques | 12000 clients | v2-pipeline-enrich | (aucun _source) |
| SYY | Digital Order Penetration | Pénétration des commandes numériques | 84.5 % | v2-pipeline-enrich | (aucun _source) |
| SYY | Fleet Electrification Rate | Taux d'électrification de la flotte | 12.4 % | v2-pipeline-enrich | (aucun _source) |
| SYY | Fleet Renewal Rate | Taux de renouvellement de la flotte | 30 % | v2-pipeline-enrich | (aucun _source) |
| SYY | Fresh Prep Penetration | Pénétration des produits Fresh Prep | 44.7 % | v2-pipeline-enrich | (aucun _source) |
| SYY | Healthcare Client Growth | Croissance des Clients en Santé | 147 établissements | v2-pipeline-enrich | (aucun _source) |
| SYY | Sustainable Products | Produits durables | 25 % | v2-pipeline-enrich | (aucun _source) |
| TECH | AI-Powered Assay Pipeline | Pipeline de Dosages avec IA | 14 projets | v2-pipeline-enrich | (aucun _source) |
| TECH | GeoMx DSP Installed Base | Parc Installé GeoMx DSP | 185 unités | v2-pipeline-enrich | (aucun _source) |
| TECH | Spatial Biology CRO Wins | Victoires Clients CRO en Biologie Spatiale | 7 contrats | v2-pipeline-enrich | (aucun _source) |
| TFX | BIOTRONIK VI Acquisition | Acquisition de la division Vascular Intervention de BIOTRONIK | 825.2 M$ | v2-pipeline | (aucun _source) |
| TMUS | Fixed Wireless (HSI) | Clients Internet fixe sans fil (postpaye) | 5.742 M | v2-pipeline | (aucun _source) |
| TPL | New Customer E&P Deals | Nouveaux contrats avec producteurs pétroliers | 14 contrats | v2-pipeline-enrich | (aucun _source) |
| TPL | Permian Royalty Acreage | Superficie en royalties dans le Permien | 920 M acres | v2-pipeline-enrich | (aucun _source) |
| TPL | Water Solutions Volume | Volume de solutions d'eau traitée | 4.8 M barils/mois | v2-pipeline-enrich | (aucun _source) |
| TRI | BIG3_EBITDA_MARGIN | Marge d'excédent brut d'exploitation ajusté des trois grands segments | 43.6 % | v2-pipeline | (aucun _source) |
| TRI | FCF_FY | Trésorerie disponible annuelle | 1.9 Mds $ | v2-pipeline | (aucun _source) |
| TROW | Actions faible écart 200 Mds $ | Stratégies actions intégrées et à faible écart de suivi |   | v2-pipeline-enrich | appel T2 2026 |
| TROW | Effectif 7 544 | Effectif |   | v2-pipeline-enrich | appel T2 2026 |
| TROW | Net market appreciation | Appréciation nette des marchés | 216.7 Mds $ | v2-pipeline | (aucun _source) |
| TROW | Solutions IA 130+ | Solutions IA déployées |   | v2-pipeline-enrich | appel T2 2026 |
| TROW | Target date 98% à 10 ans | Surperformance target date à 10 ans |   | v2-pipeline-enrich | appel T2 2026 |
| TSLA | Dojo Compute Power | Puissance de calcul Dojo | 120 exaflops | v2-pipeline-enrich | (aucun _source) |
| TSLA | FSD Mileage | Kilométrage cumulé en FSD | 10.5 B km | v2-pipeline-enrich | (aucun _source) |
| TSLA | Robotaxi Pre-orders | Précommandes pour Robotaxi | 750000 unités | v2-pipeline-enrich | (aucun _source) |
| TSLA | Supercharger Network | Nombre de Superchargeurs | 55000 bornes | v2-pipeline-enrich | (aucun _source) |
| TSM | ADVANCED_WAFER_SHARE_Q | Part des technologies avancées dans le chiffre d'affaires plaquettes | 77 % | v2-pipeline-enrich | (aucun _source) |
| TSM | CUSTOMERS_COUNT | Clients servis dans l'exercice | 534 clients | v2-pipeline-enrich | (aucun _source) |
| TSM | N2_WAFER_SHARE_Q | Part du 2 nanomètres dans le chiffre d'affaires plaquettes | 3 % | v2-pipeline-enrich | (aucun _source) |
| TSM | PROCESS_TECH_COUNT | Technologies de fabrication déployées | 305 technologies | v2-pipeline-enrich | (aucun _source) |
| TTWO | Cloud Streaming Partners | Nombre de partenaires de diffusion en continu cloud | 5 partenaires | v2-pipeline-enrich | (aucun _source) |
| TTWO | GTA Online Revenue Share | Part des revenus de GTA Online dans le total Recurring | 68 % | v2-pipeline-enrich | (aucun _source) |
| TTWO | Private Division Studio Count | Nombre de studios sous Private Division | 7 studios | v2-pipeline-enrich | (aucun _source) |
| TTWO | Recurrent Spending | Dépenses récurrentes des joueurs | 4.475 Mds $ | v2-pipeline | (aucun _source) |
| TXN | 300mm Capacity Add | Ajout de capacité 300mm | 150 M unités | v2-pipeline-enrich | (aucun _source) |
| TXN | 300mm Fab Output | Production du site 300mm | 22.5 M unités | v2-pipeline-enrich | (aucun _source) |
| TXN | 300mm Fab Yield | Rendement usine 300mm | 88.5 % | v2-pipeline-enrich | (aucun _source) |
| TXN | 300mm Utilisation | Taux d'Utilisation des Usines 300mm | 85 % | v2-pipeline-enrich | (aucun _source) |
| TXN | Analog Share Asia | Part de marché Analog en Asie | 18.7 % | v2-pipeline-enrich | (aucun _source) |
| TXN | Analog Share US | Part de marché Analog aux États-Unis | 19.3 % | v2-pipeline-enrich | (aucun _source) |
| TXN | CA Embedded Processing | Chiffre d'affaires du segment Embedded Processing | 2.533 Mds $ | v2-pipeline | (aucun _source) |
| TYL | Cloud Migration Rate | Taux de Migration vers le Cloud | 74 % | v2-pipeline-enrich | (aucun _source) |
| TYL | State Government Share | Part de Marché Étatique | 68 % | v2-pipeline-enrich | (aucun _source) |
| UNH | MCR ameliore | MCR amélioré |   | v2-pipeline-enrich | ER/ES |
| UNP | Intermodal SPI | Indice de performance de service intermodal | 99 % | v2-pipeline | 10-K FY2025 (UNP_2026-02-06) operating statistics SPI table |
| UPS | Forward‑looking risk disclaimer | Forward‑looking risk disclaimer |   | v2-pipeline-enrich | ER/ES |
| UPS | Management team | Management team |   | v2-pipeline-enrich | ER/ES |
| UPS | Q1 2026 earnings call | Q1 2026 earnings call |   | v2-pipeline-enrich | ER/ES |
| V | Click to Pay Users | Utilisateurs mensuels Click to Pay | 340 M unités | v2-pipeline-enrich | (aucun _source) |
| V | Global Acceptance Rate | Taux d'acceptation mondiale | 89 % | v2-pipeline-enrich | (aucun _source) |
| V | T2 2026 record | T2 exercice 2026 record |   | v2-pipeline-enrich | ER/ES |
| V | Tokenized Cards | Cartes tokenisées émises | 2.1 Mds unités | v2-pipeline-enrich | (aucun _source) |
| V | Visa Direct Volume | Volume de transactions sur Visa Direct | 850 Mds $ | v2-pipeline-enrich | (aucun _source) |
| VEEV | Client Vault MAU | Utilisateurs mensuels actifs Vault | 1.2 M utilisateurs | v2-pipeline-enrich | (aucun _source) |
| VEEV | Clients EMEA | Nouveaux clients EMEA | 48 clients | v2-pipeline-enrich | (aucun _source) |
| VEEV | R&D Projets IA | Projets de R&D en IA | 17 projets | v2-pipeline-enrich | (aucun _source) |
| VEEV | TAM Santé Europe | TAM Santé en Europe | 4.8 Mds $ | v2-pipeline-enrich | (aucun _source) |
| VICI | Experiential Square Footage | Superficie dédiée aux expériences | 127 M pieds² | v2-pipeline-enrich | (aucun _source) |
| VICI | Golf & Resort Capacity | Capacité des complexes golf et villégiature | 8.7 M unités | v2-pipeline-enrich | (aucun _source) |
| VICI | Golf Course Count | Nombre de terrains de golf | 4 terrains | v2-pipeline-enrich | (aucun _source) |
| VICI | Golf Course Partnerships | Partenariats sur parcours de golf | 4 partenariats | v2-pipeline-enrich | (aucun _source) |
| VICI | Wellness Lease Upside | Croissance des baux en bien-être | 19.5 % | v2-pipeline-enrich | (aucun _source) |
| VICI | Wellness Tenant Growth | Croissance des locataires bien-être | 7 contrats | v2-pipeline-enrich | (aucun _source) |
| VICI | Wellness Venue Count | Nombre de lieux dédiés au bien-être | 12 sites | v2-pipeline-enrich | (aucun _source) |
| VNA.DE | construction_pipeline | construction_pipeline |   | v2-pipeline-enrich | ER/ES |
| VNA.DE | non_rental_pivot | non_rental_pivot |   | v2-pipeline-enrich | ER/ES |
| VOW.DE | Autonomous Driving Pilots | Pilotes de conduite autonome | 7 projets | v2-pipeline-enrich | (aucun _source) |
| VOW.DE | Battery Cell Production | Production de cellules de batterie | 120 GWh | v2-pipeline-enrich | (aucun _source) |
| VOW.DE | Battery Gigafactories | Gigafactories Batteries | 3 usines | v2-pipeline-enrich | (aucun _source) |
| VOW.DE | CARIAD Design Wins | Réalisations Logicielles CARIAD | 12 modèles | v2-pipeline-enrich | (aucun _source) |
| VOW.DE | EV Orders Europe | Commandes VE en Europe | 48 % | v2-pipeline-enrich | (aucun _source) |
| VOW.DE | Mobility Subscribers | Abonnés Services Mobilité | 5.8 M utilisateurs | v2-pipeline-enrich | (aucun _source) |
| VOW.DE | Software Penetration | Pénétration Logicielle Véhicules | 42.3 % | v2-pipeline-enrich | (aucun _source) |
| VOW.DE | Software-defined Vehicles | Véhicules à logiciel embarqué | 1.8 M unités | v2-pipeline-enrich | (aucun _source) |
| VOW.DE | bev_decline | bev_decline |   | v2-pipeline-enrich | ER/ES |
| VOW.DE | volume_softness | volume_softness |   | v2-pipeline-enrich | ER/ES |
| VRSK | Client Retention Rate | Taux de Rétention Clients | 95.4 % | v2-pipeline-enrich | (aucun _source) |
| VRTX | CASGEVY Revenue | Chiffre d'affaires CASGEVY (therapie genique CRISPR) | 115.8 M $ | v2-pipeline | (aucun _source) |
| VST | Nuclear Capacity Added | Capacité nucléaire acquise | 4048 MW | v2-pipeline | (aucun _source) |
| VTR | Occupation SHOP | Occupation moyenne SHOP same-store | 88.9 % | v2-pipeline | 10-K FY2025 (vtr-20251231) Item 7, table same-store SHOP |
| VTRS | API Production Capacity | Capacité de production de principes actifs | 125 M kg | v2-pipeline-enrich | (aucun _source) |
| VTRS | Biosimilars EU Share | Part de Marché UE Biosimilaires | 27 % | v2-pipeline-enrich | (aucun _source) |
| VTRS | Biosimilars Revenue Share | Part des revenus biosimilaires | 22.5 % | v2-pipeline-enrich | (aucun _source) |
| VTRS | Chronic Care Penetration | Pénétration en soins chroniques | 27 % | v2-pipeline-enrich | (aucun _source) |
| VTRS | Emerging Markets Growth Rate | Taux de croissance des marchés émergents | 14.8 % | v2-pipeline-enrich | (aucun _source) |
| VTRS | Emerging Markets Penetration | Pénétration des marchés émergents | 38 % | v2-pipeline-enrich | (aucun _source) |
| VTRS | Manufacturing Capacity Add | Ajout de capacité de production | 1200 M unités | v2-pipeline-enrich | (aucun _source) |
| VTRS | New Product Launches | Lancements de nouveaux produits | 8 produits | v2-pipeline-enrich | (aucun _source) |
| VTRS | R&D Pipeline Depth | Profondeur du portefeuille R&D | 15 projets | v2-pipeline-enrich | (aucun _source) |
| WAB | Commandes locos Q4 | Commandes de locomotives Q4 2025 | 2.2 Mds $ | v2-pipeline | 10-K FY2025 (wab-20251231) Item 7 |
| WAT | Conso. chimie | Consommables de chimie | 631.458 M $ | v2-pipeline | 10-K FY2025 (wat-20251231) Item 7, table Waters Products and Services |
| WAT | Ventes services | Ventes de services | 1188.186 M $ | v2-pipeline | 10-K FY2025 (wat-20251231) Item 7, lignes Waters service + TA service |
| WBD | ARPU Streaming | Revenu moyen par abonné | 6.92 $ | v2-pipeline | (aucun _source) |
| WBD | Separation | Séparation |   | v2-pipeline-enrich | ER/ES |
| WDAY | 12-month Subscription Backlog | Carnet d'abonnements a 12 mois | 7.6 Mds $ | v2-pipeline | (aucun _source) |
| WDAY | Total Subscription RPO | Carnet d'abonnements total | 25.1 Mds $ | v2-pipeline | (aucun _source) |
| WDC | COST_PER_TB_DECLINE_Q4 | Baisse du coût par téraoctet au T4 | 8 % | v2-pipeline-enrich | Transcript |
| WDC | EPMR_40TB_VOLUME_CUSTOMERS | Clients en production de volume du disque ePMR 40 To | 2 clients | v2-pipeline-enrich | Transcript |
| WDC | HAMR_FIRST_DRIVE_TB | Capacité du premier disque HAMR | 44 To | v2-pipeline-enrich | Transcript |
| WDC | HBD_SAMPLING_CUSTOMERS | Clients testant les disques à haut débit | 5 clients | v2-pipeline-enrich | Transcript |
| WDC | INCREMENTAL_GROSS_MARGIN_FY26 | Marge brute incrémentale de l'exercice 2026 | 75 % | v2-pipeline-enrich | Transcript |
| WDC | Q1_FY27_REVENUE_GUIDANCE | Objectif de chiffre d'affaires du T1 exercice 2027 | 4.1 Mds $ | v2-pipeline-enrich | Transcript |
| WM | Healthcare Solutions Revenue |  |   | v2-pipeline | (aucun _source) |
| WM | WM Renewable Energy Revenue |  |   | v2-pipeline | (aucun _source) |
| WMT | PhonePe IPO | PhonePe vers une IPO |   | v2-pipeline-enrich | ER/ES |
| WMT | VIZIO | Acquisition de VIZIO pour la pub connectée |   | v2-pipeline-enrich | ER/ES |
| WMT | Walmart US eCommerce Contribution | Contribution e-commerce aux ventes comparables Walmart U.S. | 4.3 pts % | v2-pipeline | (aucun _source) |
| WMT | eCom $100Md | eCommerce franchit 100 Mds$ annuels |   | v2-pipeline-enrich | ER/ES |
| WRB | CapReturn | CapReturn |   | v2-pipeline-enrich | ER/ES |
| WRB | Global Specialty Share | Part de marché Spécialisée Globale | 6.8 % | v2-pipeline-enrich | (aucun _source) |
| WRB | NIIgrowth | NIIgrowth |   | v2-pipeline-enrich | ER/ES |
| WRB | NIgrowth | NIgrowth |   | v2-pipeline-enrich | ER/ES |
| WRB | OpIncRecord | OpIncRecord |   | v2-pipeline-enrich | ER/ES |
| WRB | ROE21 | ROE21 |   | v2-pipeline-enrich | ER/ES |
| WRB | Specialty Env Share | Part de marché Environnement Spécialisé | 23.4 % | v2-pipeline-enrich | (aucun _source) |
| WRB | Tech E&O Attach Rate | Taux d'attachement Responsabilité des Dirigeants Tech | 68 % | v2-pipeline-enrich | (aucun _source) |
| WY | Timberland Acreage | Superficie de forêts détenues | 12400 M acres | v2-pipeline-enrich | (aucun _source) |
| WY | Timberland Expansion | Superficie ajoutée de boisements | 55 M acres | v2-pipeline-enrich | (aucun _source) |
| WY | Timberland Growth | Croissance des terres forestières | 50 M acres | v2-pipeline-enrich | (aucun _source) |
| WY | Timberland Yield | Rendement des terres forestières | 6.8 m³/acre | v2-pipeline-enrich | (aucun _source) |
| XOM | Biofuel Feedstock | Matière Première Biocarburants | 8.7 M tonnes | v2-pipeline-enrich | (aucun _source) |
| XOM | Biofuel Production Capacity | Capacité de production de biocarburants | 1.8 M gallons/an | v2-pipeline-enrich | (aucun _source) |
| XOM | CCS Project Count | Nombre de Projets CCS | 11 projets | v2-pipeline-enrich | (aucun _source) |
| XOM | Carbon Capture Capacity | Capacité de captage de carbone | 10.2 M tonnes CO2/an | v2-pipeline-enrich | (aucun _source) |
| XOM | Hydrogen Capacity | Capacité d'Hydrogène | 1.5 M tonnes | v2-pipeline-enrich | (aucun _source) |
| XOM | LNG Export Capacity | Capacité d'exportation GNL | 20.5 M tonnes/an | v2-pipeline-enrich | (aucun _source) |
| XOM | LNG FID Count | Nombre de décisions d'investissement final (FID) pour le GNL | 3 projets | v2-pipeline-enrich | (aucun _source) |
| XOM | Low-Carbon Partnerships | Nombre de partenariats bas carbone | 7 partenariats | v2-pipeline-enrich | (aucun _source) |
| XOM | Low-Carbon Project Count | Nombre de projets bas carbone | 34 projets | v2-pipeline-enrich | (aucun _source) |
| XOM | Low-Carbon Revenue | Revenus Basse Carbone | 4.2 Mds $ | v2-pipeline-enrich | (aucun _source) |
| XOM | Methane Intensity | Intensité des émissions de méthane | 0.12 kg CO2e/baril | v2-pipeline-enrich | (aucun _source) |
| XOM | Offshore Guyana Output | Production offshore en Guyane | 550 kbarils/jour | v2-pipeline-enrich | (aucun _source) |
| XYL | Measurement & Control | CA segment Measurement and Control Solutions | 2.086 Mds $ | v2-pipeline | (aucun _source) |
| XYL | Water Solutions & Services | CA segment Water Solutions and Services | 2.464 Mds $ | v2-pipeline | (aucun _source) |
| ZTS | Pain and Sedation Rev | Revenu antidouleur et sédation | 840 M $ | v2-pipeline | (aucun _source) |
| ZURN.SW | Cyber Policies Growth | Croissance des Polices Cyber | 34 % | v2-pipeline-enrich | (aucun _source) |
| ZURN.SW | Cyber Premium Mix | Part des primes en cybersécurité | 18.7 % | v2-pipeline-enrich | (aucun _source) |
| ZURN.SW | Cyber Risk Coverage | Couverture des risques cyber par client | 2.4 produits | v2-pipeline-enrich | (aucun _source) |
| ZURN.SW | Insurtech Co-Innovations | Projets Co-Innovation Insurtech | 14 projets | v2-pipeline-enrich | (aucun _source) |
| ZURN.SW | Insurtech Deal Flow | Nombre d'accords avec des insurtechs par an | 15 accords | v2-pipeline-enrich | (aucun _source) |
| ZURN.SW | Insurtech Partners | Nombre de partenariats Insurtech | 27 partenariats | v2-pipeline-enrich | (aucun _source) |
| ZURN.SW | Smart Claim Adoption | Taux d'adoption des sinistres intelligents | 74 % | v2-pipeline-enrich | (aucun _source) |

## 6. Stories ecartees (non reintroduites) avec raison

| Ticker | Story (id) | Titre | Valeur | Categorie | Raison |
|---|---|---|---|---|---|
| A | Bookings | Commandes nettes | 3.1 B $ | amont | retiree en amont du remplacement (filtre KPI desactives ou fusion enrich) |
| BF.B | Total Revenue |  |   | amont | retiree en amont du remplacement (filtre KPI desactives ou fusion enrich) |
| FTNT | Billings | Facturations totales | 6.53 Mds $ | amont | retiree en amont du remplacement (filtre KPI desactives ou fusion enrich) |
| INTC | Data Center & AI | Revenu Data Center & AI | 12.8 Mds $ | amont | retiree en amont du remplacement (filtre KPI desactives ou fusion enrich) |
| NVDA | Automotive Revenue | Automobile et robotique | 2349 M $ | amont | retiree en amont du remplacement (filtre KPI desactives ou fusion enrich) |
| PTC | Operating cash flow | Operating cash flow |   | amont | retiree en amont du remplacement (filtre KPI desactives ou fusion enrich) |
| SIE.DE | order_growth_q1 | order_growth_q1 |   | amont | retiree en amont du remplacement (filtre KPI desactives ou fusion enrich) |
| SIE.DE | fcf_decline_q1 | fcf_decline_q1 |   | amont | retiree en amont du remplacement (filtre KPI desactives ou fusion enrich) |
| SIE.DE | profit_industrial_q1 | profit_industrial_q1 |   | amont | retiree en amont du remplacement (filtre KPI desactives ou fusion enrich) |
| SIE.DE | book_to_bill_improvement | book_to_bill_improvement |   | amont | retiree en amont du remplacement (filtre KPI desactives ou fusion enrich) |
| SIE.DE | outlook_raise | outlook_raise |   | amont | retiree en amont du remplacement (filtre KPI desactives ou fusion enrich) |
| ACLS | Systems Revenue | Revenu des systèmes | 571.0 M$ | b | titre identique a systems_revenue_annual (Chiffre d'affaires des systèmes neufs) |
| ADBE | AI-first ARR x3 (Q1) | AI-first ARR x3 (Q1) |   | b | doublon d une autre story de la base (titre prolonge) : AI-first ARR x3 |
| ADSK | Current RPO | Revenu contractualisé à 12 mois | 5.48 Mds $ | b | titre identique a RPO_CUR (Obligations de performance restantes courantes) |
| AEP | Capital Plan | Plan d'investissement 5 ans | 72 Mds $ | b | valeur identique a CAHIER_CAPEX_PLAN (Plan d'investissement pluriannuel) |
| AEP | Generation Added | Capacité de production ajoutée | 2.2 GW | b | titre prolonge identique a Owned generating capacity added in 2025 (Capacité de production ajoutée en 2025) |
| AES | LatAm Storage GW | Capacité Stockage Amérique Latine | 2.1 GW | b | doublon d une autre story de la base (valeur) : Storage Capacity Add |
| AKAM | Cloud Infrastructure Services | Revenu Cloud Infrastructure Services | 313.9 M $ | b | titre identique a cloud_infra_rev (Revenus Services d'infrastructure cloud) |
| AOS | R&D Invest | Dépenses de R&D | 50 Mds $ | b | titre identique a rd_exp (Dépenses de R&D) |
| ARES | New Product AUM | AUM des nouveaux produits | 12.4 Mds $ | b | titre prolonge identique a New products AUM (2 years) (AUM des nouveaux produits (2 ans)) |
| AVB | Under Development Homes | Logements en développement | 7200 unités | b | titre identique a Apartment homes under construction (Logements en développement) |
| AVB | Taux d'Occupation | Taux d'Occupation | 95.5 % | b | titre identique a Occupancy Rate (Taux d'occupation) |
| AVB | Part de Marché | Part de Marché | 12.5 % | b | doublon d une autre story de la base (titre) : Marché Part |
| BNR.DE | New Labs Opened | Nouveaux Laboratoires Ouverts | 7 labs | b | doublon d une autre story de la base (valeur) : New Application Labs |
| CASY | wings_stores | Magasins proposant les ailes de poulet | 850 magasins | b | titre identique a Stores offering sauced wings (Magasins proposant les ailes de poulet) |
| CINF | South Agent Density | Densité d'agents par État dans le Sud | 142 agents/État | b | doublon d une autre story de la base (valeur) : Agent Growth in South |
| CINF | Claims AI Capacity | Capacité mensuelle de traitement des sinistres par IA | 125 k sinistres | b | doublon d une autre story de la base (valeur) : Digital Claims Capacity |
| CNP | Industrial load commitment | Industrial load commitment |   | b | doublon d une autre story de la base (id) : Industrial load commitment |
| CNP | Data center load outlook | Data center load outlook |   | b | doublon d une autre story de la base (id) : Data center load outlook |
| CNP | Demand growth projection | Demand growth projection |   | b | doublon d une autre story de la base (id) : Demand growth projection |
| CNP | Non‑GAAP EPS increase | Non‑GAAP EPS increase |   | b | doublon d une autre story de la base (id) : Non‑GAAP EPS increase |
| COF | Rachat Discover | Rachat Discover |   | b | doublon d une autre story de la base (id) : Rachat Discover |
| COHR | RevGrowthQ3 | RevGrowthQ3 |   | b | doublon d une autre story de la base (id) : RevGrowthQ3 |
| COHR | EPSGrowthQ3 | EPSGrowthQ3 |   | b | doublon d une autre story de la base (id) : EPSGrowthQ3 |
| COHR | CapInvestQ3 | CapInvestQ3 |   | b | doublon d une autre story de la base (id) : CapInvestQ3 |
| COHR | RevGrowthQ2 | RevGrowthQ2 |   | b | doublon d une autre story de la base (id) : RevGrowthQ2 |
| COHR | EPSGrowthQ2 | EPSGrowthQ2 |   | b | doublon d une autre story de la base (id) : EPSGrowthQ2 |
| COP | Integration Marathon | Intégration Marathon |   | b | doublon d une autre story de la base (id) : Integration Marathon |
| COR | RevGrowth | RevGrowth |   | b | doublon d une autre story de la base (id) : RevGrowth |
| COR | GuidanceRaise | GuidanceRaise |   | b | doublon d une autre story de la base (id) : GuidanceRaise |
| COR | ShareRepurchase | ShareRepurchase |   | b | doublon d une autre story de la base (id) : ShareRepurchase |
| COR | EPSJump | EPSJump |   | b | doublon d une autre story de la base (id) : EPSJump |
| COST | Ventes Q3 2026 | Ventes Q3 exercice 2026 |   | b | doublon d une autre story de la base (id) : Ventes Q3 2026 |
| CPAY | Partenariat Mastercard | Partenariat Mastercard |   | b | doublon d une autre story de la base (id) : Partenariat Mastercard |
| CPAY | Acquisition d'AvidXchange | Acquisition d'AvidXchange |   | b | doublon d une autre story de la base (id) : Acquisition d'AvidXchange |
| CPAY | Croissance du segment Corporate Payments Q1 2025 | Croissance du segment Corporate Payments Q1 2025 |   | b | doublon d une autre story de la base (id) : Croissance du segment Corporate Payments Q1 2025 |
| CPAY | Record de revenus Q4 2024 | Record de revenus Q4 2024 |   | b | doublon d une autre story de la base (id) : Record de revenus Q4 2024 |
| CPAY | Acquisitions majeures 2024 | Acquisitions majeures 2024 |   | b | doublon d une autre story de la base (id) : Acquisitions majeures 2024 |
| CPB | sales_decline | sales_decline |   | b | doublon d une autre story de la base (id) : sales_decline |
| CPB | ebit_gain | ebit_gain |   | b | doublon d une autre story de la base (id) : ebit_gain |
| CPB | storm_impact | storm_impact |   | b | doublon d une autre story de la base (id) : storm_impact |
| CPB | rao_milestone | rao_milestone |   | b | doublon d une autre story de la base (id) : rao_milestone |
| CPRT | Rev Q3 2026 +2.1% | CA T3 2026 +2,1 % |   | b | doublon d une autre story de la base (id) : Rev Q3 2026 +2.1% |
| CPRT | NI Q3 2026 -1.0% | NI Q3 2026 -1.0% |   | b | doublon d une autre story de la base (id) : NI Q3 2026 -1.0% |
| CPRT | NI Q3 2025 +6.4% | NI Q3 2025 +6.4% |   | b | doublon d une autre story de la base (id) : NI Q3 2025 +6.4% |
| CPRT | NI Q4 2025 +22.9% | NI Q4 2025 +22.9% |   | b | doublon d une autre story de la base (id) : NI Q4 2025 +22.9% |
| CRH | Americas Materials accelere | Americas Materials accélère |   | b | doublon d une autre story de la base (id) : Americas Materials accelere |
| CRH | Pivot vers l'eau | Pivot vers l'eau |   | b | doublon d une autre story de la base (id) : Pivot vers l'eau |
| CRH | Rotation de portefeuille | Rotation de portefeuille |   | b | doublon d une autre story de la base (id) : Rotation de portefeuille |
| CRH | International en redressement | International en redressement |   | b | doublon d une autre story de la base (id) : International en redressement |
| CRH | Entree au S&P 500 | Entrée au S&P 500 |   | b | doublon d une autre story de la base (id) : Entree au S&P 500 |
| CRL | RevDeclineQ4 | RevDeclineQ4 |   | b | doublon d une autre story de la base (id) : RevDeclineQ4 |
| CRL | MarginDropQ4 | MarginDropQ4 |   | b | doublon d une autre story de la base (id) : MarginDropQ4 |
| CRL | RevGrowthQ3 | RevGrowthQ3 |   | b | doublon d une autre story de la base (id) : RevGrowthQ3 |
| CRL | EPSDropQ3 | EPSDropQ3 |   | b | doublon d une autre story de la base (id) : EPSDropQ3 |
| CRM | Agentforce ARR x2.7 | Agentforce ARR x2.7 |   | b | doublon d une autre story de la base (id) : Agentforce ARR x2.7 |
| CRM | 3,8 Md AWU delivres | 3,8 Md AWU délivrés |   | b | doublon d une autre story de la base (id) : 3,8 Md AWU delivres |
| CRM | RPO record 72 Md$ | RPO record 72 Md$ |   | b | doublon d une autre story de la base (id) : RPO record 72 Md$ |
| CRM | 29 000 deals Agentforce | 29 000 deals Agentforce |   | b | doublon d une autre story de la base (id) : 29 000 deals Agentforce |
| CRM | 52 000 Md records ingeres | 52 000 Md records ingérés |   | b | doublon d une autre story de la base (id) : 52 000 Md records ingeres |
| CRWD | Bascule IA-cyber | Bascule IA-cyber |   | b | doublon d une autre story de la base (id) : Bascule IA-cyber |
| CRWD | Coalition QuiltWorks | Coalition QuiltWorks |   | b | doublon d une autre story de la base (id) : Coalition QuiltWorks |
| CRWD | Cap des 5 Md$ ARR | Cap des 5 Md$ ARR |   | b | doublon d une autre story de la base (id) : Cap des 5 Md$ ARR |
| CRWD | Momentum Falcon Flex | Momentum Falcon Flex |   | b | doublon d une autre story de la base (id) : Momentum Falcon Flex |
| CRWD | ROI 273% Forrester | ROI 273% Forrester |   | b | doublon d une autre story de la base (id) : ROI 273% Forrester |
| CSCO | Sécurité (produit) | Chiffre d'affaires produit Sécurité | 8.094 Mds $ | b | titre identique a sec_rev (Revenu Sécurité (Splunk+Duo+Umbrella)) |
| CSCO | CA logiciel | Chiffre d'affaires logiciel total | 22.3 Mds $ | b | titre identique a sw_rev (Revenu Logiciel Total) |
| CSCO | Commandes IA 1,3 Md$ | Commandes IA 1,3 Md$ |   | b | doublon d une autre story de la base (id) : Commandes IA 1,3 Md$ |
| CSGP | Trafic record 183M | Trafic record 183M |   | b | doublon d une autre story de la base (id) : Trafic record 183M |
| CSGP | Lancement Homes.com | Lancement Homes.com |   | b | doublon d une autre story de la base (id) : Lancement Homes.com |
| CSGP | Homes.com +600% | Homes.com +600% |   | b | doublon d une autre story de la base (id) : Homes.com +600% |
| CSGP | Marges 41% commercial | Marges 41% commercial |   | b | doublon d une autre story de la base (id) : Marges 41% commercial |
| CSGP | Apartments.com >1 Md$ | Apartments.com >1 Md$ |   | b | doublon d une autre story de la base (id) : Apartments.com >1 Md$ |
| CTAS | Acquisition UniFirst | Acquisition UniFirst | 1 Fait | b | titre identique a UniFirst Corporation acquisition (Acquisition UniFirst) |
| CTAS | Acquisition UniFirst | Acquisition UniFirst |   | b | titre identique a UniFirst Corporation acquisition (Acquisition UniFirst) |
| CTAS | Marge record route-based | Marge record route-based |   | b | doublon d une autre story de la base (id) : Marge record route-based |
| CTAS | Organique soutenu | Organique soutenu |   | b | doublon d une autre story de la base (id) : Organique soutenu |
| CTAS | Autres services accelerent | Autres services accélèrent |   | b | doublon d une autre story de la base (id) : Autres services accelerent |
| CTVA | Scission en deux | Scission en deux |   | b | doublon d une autre story de la base (id) : Scission en deux |
| CVNA | 6e trimestre +40% | 6e trimestre +40% |   | b | doublon d une autre story de la base (id) : 6e trimestre +40% |
| CVS | CEO appointment | CEO appointment |   | b | doublon d une autre story de la base (id) : CEO appointment |
| CVS | Q1 2026 results | Q1 2026 results |   | b | doublon d une autre story de la base (id) : Q1 2026 results |
| CVS | Q4 2025 results | Q4 2025 results |   | b | doublon d une autre story de la base (id) : Q4 2025 results |
| CVS | Prior authorizations speed | Prior authorizations speed |   | b | doublon d une autre story de la base (id) : Prior authorizations speed |
| CVS | Cost-based reimbursement | Cost-based reimbursement |   | b | doublon d une autre story de la base (id) : Cost-based reimbursement |
| CVX | Production +15% | Production +15% |   | b | doublon d une autre story de la base (id) : Production +15% |
| D | Guidance affirmation | Guidance affirmation |   | b | doublon d une autre story de la base (id) : Guidance affirmation |
| D | Operating earnings rise Q1 | Operating earnings rise Q1 |   | b | doublon d une autre story de la base (id) : Operating earnings rise Q1 |
| D | Long‑term growth guidance extended | Long‑term growth guidance extended |   | b | doublon d une autre story de la base (id) : Long‑term growth guidance extended |
| D | Net income decline Q1 | Net income decline Q1 |   | b | doublon d une autre story de la base (id) : Net income decline Q1 |
| DASH | Record MAU growth | Record MAU growth |   | b | doublon d une autre story de la base (id) : Record MAU growth |
| DASH | Total Orders surge Q1 2026 | Total Orders surge Q1 2026 |   | b | doublon d une autre story de la base (id) : Total Orders surge Q1 2026 |
| DASH | GAAP net income jump Q4 2025 | GAAP net income jump Q4 2025 |   | b | doublon d une autre story de la base (id) : GAAP net income jump Q4 2025 |
| DASH | Marketplace GOV expansion Q4 2025 | Marketplace GOV expansion Q4 2025 |   | b | doublon d une autre story de la base (id) : Marketplace GOV expansion Q4 2025 |
| DASH | Adjusted EBITDA growth Q4 2025 | Adjusted EBITDA growth Q4 2025 |   | b | doublon d une autre story de la base (id) : Adjusted EBITDA growth Q4 2025 |
| DD | vitality_index | Indice de vitalité (part du CA issue des nouveaux produits) | 35 % | b | valeur identique a Vitality index (share of sales from products launched within 5 years) (Indice de vitalité (part des ventes de produits lancés sous 5 ans)) |
| DDOG | Clients haut de gamme | Clients haut de gamme |   | b | doublon d une autre story de la base (id) : Clients haut de gamme |
| DE | Bas de cycle 2026 | Bas de cycle 2026 |   | b | doublon d une autre story de la base (id) : Bas de cycle 2026 |
| DECK | HOKA moteur | HOKA moteur |   | b | doublon d une autre story de la base (id) : HOKA moteur |
| DELL | AI_BACKLOG | Carnet de commandes serveurs IA | 95 Mds $ | b | titre identique a AI server backlog (Carnet de commandes serveurs IA) |
| DG | Operating profit surge Q4 2025 | Operating profit surge Q4 2025 |   | b | doublon d une autre story de la base (id) : Operating profit surge Q4 2025 |
| DG | EPS jump Q4 2025 | EPS jump Q4 2025 |   | b | doublon d une autre story de la base (id) : EPS jump Q4 2025 |
| DG | Real estate growth plan 2026 | Real estate growth plan exercice 2026 |   | b | doublon d une autre story de la base (id) : Real estate growth plan 2026 |
| DG | Net sales rise Q3 2025 | Net sales rise Q3 2025 |   | b | doublon d une autre story de la base (id) : Net sales rise Q3 2025 |
| DG | Same-store sales up Q3 2025 | Same-store sales up Q3 2025 |   | b | doublon d une autre story de la base (id) : Same-store sales up Q3 2025 |
| DGX | Q1 2026 revenue up 9.2% | Q1 2026 revenue up 9.2% |   | b | doublon d une autre story de la base (id) : Q1 2026 revenue up 9.2% |
| DGX | Q1 2026 EPS up 15.5% | Q1 2026 EPS up 15.5% |   | b | doublon d une autre story de la base (id) : Q1 2026 EPS up 15.5% |
| DGX | Advanced Diagnostics growth | Advanced Diagnostics growth |   | b | doublon d une autre story de la base (id) : Advanced Diagnostics growth |
| DGX | Q4 2025 revenue up 7.1% | Q4 2025 revenue up 7.1% |   | b | doublon d une autre story de la base (id) : Q4 2025 revenue up 7.1% |
| DGX | Dividend increase | Dividend increase |   | b | doublon d une autre story de la base (id) : Dividend increase |
| DHI | Commandes +11% | Commandes +11% |   | b | doublon d une autre story de la base (id) : Commandes +11% |
| DHR | Acquisition Masimo | Acquisition Masimo |   | b | doublon d une autre story de la base (id) : Acquisition Masimo |
| DHR | Croissance EPS ajusté | Croissance EPS ajusté |   | b | doublon d une autre story de la base (id) : Croissance EPS ajusté |
| DHR | Force Bioprocessing Q4 2025 | Force Bioprocessing Q4 2025 |   | b | doublon d une autre story de la base (id) : Force Bioprocessing Q4 2025 |
| DHR | Innovation produits 2025 | Innovation produits 2025 |   | b | doublon d une autre story de la base (id) : Innovation produits 2025 |
| DHR | Approbation FDA Cepheid | Approbation FDA Cepheid |   | b | doublon d une autre story de la base (id) : Approbation FDA Cepheid |
| DIS | Streaming rentable | Streaming rentable |   | b | doublon d une autre story de la base (id) : Streaming rentable |
| DLR | Capacite IA | Capacité IA |   | b | doublon d une autre story de la base (id) : Capacite IA |
| DLTR | 20e annee positive | 20e année positive |   | b | doublon d une autre story de la base (id) : 20e annee positive |
| DOC | Janus Living IPO | Janus Living IPO |   | b | doublon d une autre story de la base (id) : Janus Living IPO |
| DOC | Healthpeak ownership of Janus | Healthpeak ownership of Janus |   | b | doublon d une autre story de la base (id) : Healthpeak ownership of Janus |
| DOC | Revenue & EBITDA growth | Revenue & EBITDA growth |   | b | doublon d une autre story de la base (id) : Revenue & EBITDA growth |
| DOC | Lease activity Q1 2026 | Lease activity Q1 2026 |   | b | doublon d une autre story de la base (id) : Lease activity Q1 2026 |
| DOV | Net earnings surge | Net earnings surge |   | b | doublon d une autre story de la base (id) : Net earnings surge |
| DOV | Operating earnings up | Operating earnings up |   | b | doublon d une autre story de la base (id) : Operating earnings up |
| DOV | Discontinued ops contribution | Discontinued ops contribution |   | b | doublon d une autre story de la base (id) : Discontinued ops contribution |
| DOV | Interest expense decline | Interest expense decline |   | b | doublon d une autre story de la base (id) : Interest expense decline |
| DPZ | Share repurchase program | Share repurchase program |   | b | doublon d une autre story de la base (id) : Share repurchase program |
| DPZ | Operating income up | Operating income up |   | b | doublon d une autre story de la base (id) : Operating income up |
| DPZ | Dividend increase | Dividend increase |   | b | doublon d une autre story de la base (id) : Dividend increase |
| DPZ | Store expansion | Store expansion |   | b | doublon d une autre story de la base (id) : Store expansion |
| DRI | BenchmarkOutperformance | BenchmarkOutperformance |   | b | doublon d une autre story de la base (id) : BenchmarkOutperformance |
| DRI | CommodityHeadwinds | CommodityHeadwinds |   | b | doublon d une autre story de la base (id) : CommodityHeadwinds |
| DRI | AdjEPSGrowthQ3 | AdjEPSGrowthQ3 |   | b | doublon d une autre story de la base (id) : AdjEPSGrowthQ3 |
| DRI | ShareRepurchaseQ2 | ShareRepurchaseQ2 |   | b | doublon d une autre story de la base (id) : ShareRepurchaseQ2 |
| DRI | NetNewRestaurantsQ3 | NetNewRestaurantsQ3 |   | b | doublon d une autre story de la base (id) : NetNewRestaurantsQ3 |
| DTE | Investissement reseau | Investissement réseau |   | b | doublon d une autre story de la base (id) : Investissement reseau |
| DVA | operating_income_q1_2026 | operating_income_q1_2026 |   | b | doublon d une autre story de la base (id) : operating_income_q1_2026 |
| DVA | cash_flow_q1_2026 | cash_flow_q1_2026 |   | b | doublon d une autre story de la base (id) : cash_flow_q1_2026 |
| DVA | share_repurchase_q1_2026 | share_repurchase_q1_2026 |   | b | doublon d une autre story de la base (id) : share_repurchase_q1_2026 |
| DVA | operating_income_q4_2025 | operating_income_q4_2025 |   | b | doublon d une autre story de la base (id) : operating_income_q4_2025 |
| DVA | share_repurchase_q4_2025 | share_repurchase_q4_2025 |   | b | doublon d une autre story de la base (id) : share_repurchase_q4_2025 |
| DXCM | Ventes directes | Ventes en circuit direct | 703 M $ | b | titre identique a direct_revenue (Chiffre d'affaires circuit direct) |
| DXCM | Revenue growth Q1 2026 | Revenue growth Q1 2026 |   | b | doublon d une autre story de la base (id) : Revenue growth Q1 2026 |
| DXCM | Operating margin boost Q1 2026 | Operating margin boost Q1 2026 |   | b | doublon d une autre story de la base (id) : Operating margin boost Q1 2026 |
| DXCM | G7 15‑Day launch Q1 2026 | G7 15‑Day launch Q1 2026 |   | b | doublon d une autre story de la base (id) : G7 15‑Day launch Q1 2026 |
| DXCM | Revenue growth Q4 2025 | Revenue growth Q4 2025 |   | b | doublon d une autre story de la base (id) : Revenue growth Q4 2025 |
| DXCM | G7 15‑Day system launch Q4 2025 | G7 15‑Day system launch Q4 2025 |   | b | doublon d une autre story de la base (id) : G7 15‑Day system launch Q4 2025 |
| EA | Total Net Bookings | Réservations nettes totales | 7.355 Mds $ | b | titre identique a net_bookings (Net bookings total) |
| EA | Full Game Net Revenue | Revenu jeux complets | 2.002 Mds $ | b | titre identique a full_game_rev (Revenus jeux complets) |
| EBAY | workforce_cut | workforce_cut |   | b | doublon d une autre story de la base (id) : workforce_cut |
| EBAY | org_speed | org_speed |   | b | doublon d une autre story de la base (id) : org_speed |
| EBAY | customer_satisfaction | customer_satisfaction |   | b | doublon d une autre story de la base (id) : customer_satisfaction |
| ECL | Double-digit EPS growth | Double-digit EPS growth |   | b | doublon d une autre story de la base (id) : Double-digit EPS growth |
| ECL | Value pricing and productivity | Value pricing and productivity |   | b | doublon d une autre story de la base (id) : Value pricing and productivity |
| ECL | Organic sales resilience | Organic sales resilience |   | b | doublon d une autre story de la base (id) : Organic sales resilience |
| ECL | 2025 EPS outlook | 2025 EPS outlook |   | b | doublon d une autre story de la base (id) : 2025 EPS outlook |
| ED | Q1 2026 operational strength | Q1 2026 operational strength |   | b | doublon d une autre story de la base (id) : Q1 2026 operational strength |
| ED | Q1 2026 electrification trend | Q1 2026 electrification trend |   | b | doublon d une autre story de la base (id) : Q1 2026 electrification trend |
| ED | Q1 2025 strategy execution | Q1 2025 strategy execution |   | b | doublon d une autre story de la base (id) : Q1 2025 strategy execution |
| ED | Q1 2025 capital plan | Q1 2025 capital plan |   | b | doublon d une autre story de la base (id) : Q1 2025 capital plan |
| EFX | USIS +12% | USIS +12% |   | b | doublon d une autre story de la base (id) : USIS +12% |
| EG | Reserve hit | Reserve hit |   | b | doublon d une autre story de la base (id) : Reserve hit |
| EG | Cashflow record | Cashflow record |   | b | doublon d une autre story de la base (id) : Cashflow record |
| EG | Combined ratio pressure | Combined ratio pressure |   | b | doublon d une autre story de la base (id) : Combined ratio pressure |
| EG | Investment income peak | Investment income peak |   | b | doublon d une autre story de la base (id) : Investment income peak |
| EG | Catastrophe loss surge | Catastrophe loss surge |   | b | doublon d une autre story de la base (id) : Catastrophe loss surge |
| EIX | Net income decline Q1 2026 | Net income decline Q1 2026 |   | b | doublon d une autre story de la base (id) : Net income decline Q1 2026 |
| EIX | Wildfire mitigation progress | Wildfire mitigation progress |   | b | doublon d une autre story de la base (id) : Wildfire mitigation progress |
| EIX | Wildfire Recovery Compensation Program | Wildfire Recovery Compensation Program |   | b | doublon d une autre story de la base (id) : Wildfire Recovery Compensation Program |
| EIX | Core EPS guidance affirmed | Core EPS guidance affirmed |   | b | doublon d une autre story de la base (id) : Core EPS guidance affirmed |
| EIX | Regulatory progress on GRC decision | Regulatory progress on GRC decision |   | b | doublon d une autre story de la base (id) : Regulatory progress on GRC decision |
| EL | Parfum et Chine | Parfum et Chine |   | b | doublon d une autre story de la base (id) : Parfum et Chine |
| ELV | Capital Return | Capital Return |   | b | doublon d une autre story de la base (id) : Capital Return |
| ELV | Guidance 2025 | Guidance exercice 2025 |   | b | doublon d une autre story de la base (id) : Guidance 2025 |
| ELV | Strategic Partnership | Strategic Partnership |   | b | doublon d une autre story de la base (id) : Strategic Partnership |
| ELV | EPS Outlook Upgrade | EPS Outlook Upgrade |   | b | doublon d une autre story de la base (id) : EPS Outlook Upgrade |
| ELV | Revenue Growth Q3 2025 | Revenue Growth Q3 2025 |   | b | doublon d une autre story de la base (id) : Revenue Growth Q3 2025 |
| EME | Record Q1 2026 revenue | Record Q1 2026 revenue |   | b | doublon d une autre story de la base (id) : Record Q1 2026 revenue |
| EME | Q1 2026 EPS surge | Q1 2026 EPS surge |   | b | doublon d une autre story de la base (id) : Q1 2026 EPS surge |
| EME | RPO growth Q1 2026 | RPO growth Q1 2026 |   | b | doublon d une autre story de la base (id) : RPO growth Q1 2026 |
| EME | Record Q4 2025 revenue | Record Q4 2025 revenue |   | b | doublon d une autre story de la base (id) : Record Q4 2025 revenue |
| EME | RPO growth Q4 2025 | RPO growth Q4 2025 |   | b | doublon d une autre story de la base (id) : RPO growth Q4 2025 |
| EMR | Orders up 5% driven by Software Systems | Orders up 5% driven by Software Systems |   | b | doublon d une autre story de la base (id) : Orders up 5% driven by Software Systems |
| EMR | Margins exceed expectations | Margins exceed expectations |   | b | doublon d une autre story de la base (id) : Margins exceed expectations |
| EMR | Sales impacted by Middle East conflict | Sales impacted by Middle East conflict |   | b | doublon d une autre story de la base (id) : Sales impacted by Middle East conflict |
| EMR | Fourth consecutive quarter of strong orders | Fourth consecutive quarter of strong orders |   | b | doublon d une autre story de la base (id) : Fourth consecutive quarter of strong orders |
| EMR | Accelerating innovation and new products | Accelerating innovation and new products |   | b | doublon d une autre story de la base (id) : Accelerating innovation and new products |
| EOG | Production record | Production record |   | b | doublon d une autre story de la base (id) : Production record |
| EOG | Acquisition Encino | Acquisition Encino |   | b | doublon d une autre story de la base (id) : Acquisition Encino |
| EOG | Cout puits en baisse | Coût puits en baisse |   | b | doublon d une autre story de la base (id) : Cout puits en baisse |
| EOG | Free cash flow soutenu | Free cash flow soutenu |   | b | doublon d une autre story de la base (id) : Free cash flow soutenu |
| EOG | Diversification internationale | Diversification internationale |   | b | doublon d une autre story de la base (id) : Diversification internationale |
| EQIX | Revenus Q3 +12% | Revenus Q3 +12% |   | b | doublon d une autre story de la base (id) : Revenus Q3 +12% |
| EQIX | Revenus Q2 +11% | Revenus Q2 +11% |   | b | doublon d une autre story de la base (id) : Revenus Q2 +11% |
| EQIX | Dividende +25% | Dividende +25% |   | b | doublon d une autre story de la base (id) : Dividende +25% |
| EQIX | Réservations canal 40% | Réservations canal 40% |   | b | doublon d une autre story de la base (id) : Réservations canal 40% |
| EQR | Blended Rate +130 pb | Blended Rate +130 pb |   | b | doublon d une autre story de la base (id) : Blended Rate +130 pb |
| EQR | Concessions -21% | Concessions -21% |   | b | doublon d une autre story de la base (id) : Concessions -21% |
| EQR | Demande locataires aises | Demande locataires aises |   | b | doublon d une autre story de la base (id) : Demande locataires aises |
| EQR | Pivot Expansion Markets | Pivot Expansion Markets |   | b | doublon d une autre story de la base (id) : Pivot Expansion Markets |
| EQT | Resilience tempete Fern | Résilience tempête Fern |   | b | doublon d une autre story de la base (id) : Resilience tempete Fern |
| EQT | Demande electrique IA | Demande électrique IA |   | b | doublon d une autre story de la base (id) : Demande electrique IA |
| EQT | Cout par pied -13% | Coût par pied -13% |   | b | doublon d une autre story de la base (id) : Cout par pied -13% |
| EQT | FCF trimestriel record | FCF trimestriel record |   | b | doublon d une autre story de la base (id) : FCF trimestriel record |
| EQT | Offtake GNL 4,5 Mtpa | Offtake GNL 4,5 Mtpa |   | b | doublon d une autre story de la base (id) : Offtake GNL 4,5 Mtpa |
| ERIE | policies_7m | policies_7m |   | b | doublon d une autre story de la base (id) : policies_7m |
| ERIE | opinc_106_q1 | opinc_106_q1 |   | b | doublon d une autre story de la base (id) : opinc_106_q1 |
| ERIE | foundation_100m | foundation_100m |   | b | doublon d une autre story de la base (id) : foundation_100m |
| ERIE | premium_growth_engine | premium_growth_engine |   | b | doublon d une autre story de la base (id) : premium_growth_engine |
| ERIE | investment_income_up | investment_income_up |   | b | doublon d une autre story de la base (id) : investment_income_up |
| ES | Plan 26,5 Md$ | Plan 26,5 Md$ |   | b | doublon d une autre story de la base (id) : Plan 26,5 Md$ |
| ES | Pure-play regule | Pure-play régulé |   | b | doublon d une autre story de la base (id) : Pure-play regule |
| ES | Choc FERC ROE | Choc FERC ROE |   | b | doublon d une autre story de la base (id) : Choc FERC ROE |
| ES | Riposte ROE 11,39% | Riposte ROE 11,39% |   | b | doublon d une autre story de la base (id) : Riposte ROE 11,39% |
| ES | Resilience Nor'easter | Résilience Nor'easter |   | b | doublon d une autre story de la base (id) : Resilience Nor'easter |
| ESS | Reprise Nord Californie | Reprise Nord Californie |   | b | doublon d une autre story de la base (id) : Reprise Nord Californie |
| ESS | 32e hausse dividende | 32e hausse dividende |   | b | doublon d une autre story de la base (id) : 32e hausse dividende |
| ESS | NOI bat le guidance | NOI bat le guidance |   | b | doublon d une autre story de la base (id) : NOI bat le guidance |
| ESS | Occupation solide | Occupation solide |   | b | doublon d une autre story de la base (id) : Occupation solide |
| ETN | datacenter_backlog | datacenter_backlog |   | b | doublon d une autre story de la base (id) : datacenter_backlog |
| ETN | americas_margin_record | americas_margin_record |   | b | doublon d une autre story de la base (id) : americas_margin_record |
| ETN | capacity_investment | capacity_investment |   | b | doublon d une autre story de la base (id) : capacity_investment |
| ETN | book_to_bill | book_to_bill |   | b | doublon d une autre story de la base (id) : book_to_bill |
| ETN | aerospace_demand | aerospace_demand |   | b | doublon d une autre story de la base (id) : aerospace_demand |
| ETR | Demande data center | Demande data center |   | b | doublon d une autre story de la base (id) : Demande data center |
| EVRG | Cible EPS relevee | Cible EPS relevée |   | b | doublon d une autre story de la base (id) : Cible EPS relevee |
| EW | guidance raise 2026 sales | Guidance raise exercice 2026 sales |   | b | doublon d une autre story de la base (id) : guidance raise 2026 sales |
| EW | accelerated share repurchase | Accelerated share repurchase |   | b | doublon d une autre story de la base (id) : accelerated share repurchase |
| EW | TAVR sales surge Q1 2026 | TAVR sales surge Q1 2026 |   | b | doublon d une autre story de la base (id) : TAVR sales surge Q1 2026 |
| EW | TMTT sales jump Q4 2025 | TMTT sales jump Q4 2025 |   | b | doublon d une autre story de la base (id) : TMTT sales jump Q4 2025 |
| EW | confidence 2026 sales | Confidence exercice 2026 sales |   | b | doublon d une autre story de la base (id) : confidence 2026 sales |
| EXC | AdjOpEpsQ1 | AdjOpEpsQ1 |   | b | doublon d une autre story de la base (id) : AdjOpEpsQ1 |
| EXC | ReliabilityTopQuartile | ReliabilityTopQuartile |   | b | doublon d une autre story de la base (id) : ReliabilityTopQuartile |
| EXC | CapExPlan | CapExPlan |   | b | doublon d une autre story de la base (id) : CapExPlan |
| EXC | FinancingProgress | FinancingProgress |   | b | doublon d une autre story de la base (id) : FinancingProgress |
| EXE | Synergies +50% | Synergies +50% |   | b | doublon d une autre story de la base (id) : Synergies +50% |
| EXPD | Airfreight margins up | Airfreight margins up |   | b | doublon d une autre story de la base (id) : Airfreight margins up |
| EXPD | Share repurchases Q1 2026 | Share repurchases Q1 2026 |   | b | doublon d une autre story de la base (id) : Share repurchases Q1 2026 |
| EXPD | Board approves $3 bn repurchase | Board approves $3 bn repurchase |   | b | doublon d une autre story de la base (id) : Board approves $3 bn repurchase |
| EXPD | Double‑digit growth in key services | Double‑digit growth in key services |   | b | doublon d une autre story de la base (id) : Double‑digit growth in key services |
| EXPD | Investments in AI | Investments in AI |   | b | doublon d une autre story de la base (id) : Investments in AI |
| EXPE | EG Advertising | Revenu publicitaire Expedia Group | 758 M $ | b | titre identique a eg_advertising_revenue (Chiffre d'affaires EG Advertising) |
| EXR | Occupation stable | Occupation stable |   | b | doublon d une autre story de la base (id) : Occupation stable |
| FANG | Dividend hike Q1 2026 | Dividend hike Q1 2026 |   | b | doublon d une autre story de la base (id) : Dividend hike Q1 2026 |
| FANG | Share repurchase Q1 2026 | Share repurchase Q1 2026 |   | b | doublon d une autre story de la base (id) : Share repurchase Q1 2026 |
| FANG | Tender offer debt retirement | Tender offer debt retirement |   | b | doublon d une autre story de la base (id) : Tender offer debt retirement |
| FANG | Dividend hike Q4 2025 | Dividend hike Q4 2025 |   | b | doublon d une autre story de la base (id) : Dividend hike Q4 2025 |
| FAST | Onsite Locations | Sites Onsite chez les clients | 2031 sites | b | valeur identique a onsite_locations_q (Sites Onsite actifs) |
| FAST | DSR up 12.4% | DSR up 12.4% |   | b | doublon d une autre story de la base (id) : DSR up 12.4% |
| FAST | Margin up 20 bps | Margin up 20 bps |   | b | doublon d une autre story de la base (id) : Margin up 20 bps |
| FAST | OCF 111% of NI | OCF 111% of NI |   | b | doublon d une autre story de la base (id) : OCF 111% of NI |
| FAST | Shareholder returns | Shareholder returns |   | b | doublon d une autre story de la base (id) : Shareholder returns |
| FCX | Grasberg ramp-up | Grasberg ramp-up |   | b | doublon d une autre story de la base (id) : Grasberg ramp-up |
| FCX | MoU Indonésie | MoU Indonésie |   | b | doublon d une autre story de la base (id) : MoU Indonésie |
| FCX | El Abra expansion | El Abra expansion |   | b | doublon d une autre story de la base (id) : El Abra expansion |
| FCX | Arizona leaching tech | Arizona leaching tech |   | b | doublon d une autre story de la base (id) : Arizona leaching tech |
| FCX | Net income Q1 | Net income Q1 |   | b | doublon d une autre story de la base (id) : Net income Q1 |
| FER | ORDER_BOOK_RECORD | Carnet de commandes Construction | 18.0 Mds € | b | titre identique a ORDER_BOOK (Carnet de commandes Construction) |
| FTNT | Abonnements sécurité | Revenus abonnements de sécurité | 2.32 Mds $ | b | titre identique a security_sub_rev (Revenus abonnements sécurité) |
| GE | Additive Factory Rate | Taux de production en usine additive | 420 M unités | b | doublon d une autre story de la base (titre) : Additive Production Rate |
| GILD | Oncology Revenue | Chiffre d'affaires oncologie | 3.236 Mds $ | b | titre identique a Oncologie Rev (Revenus Oncologie totaux) |
| GOOG | Gemini App MAU | Utilisateurs Mensuels Actifs de l'application Gemini | 120 M unités | b | titre identique a gemini_mau (Utilisateurs actifs mensuels de l'app Gemini) |
| HEIA.AS | Dividend Payout Ratio | Taux de distribution des dividendes | 100 % | b | titre identique a PAYOUT_FY (Taux de distribution du dividende) |
| HEN.DE | Green Product Share | Part des produits éco-conçus | 62 % | b | doublon d une autre story de la base (valeur) : Eco-Portfolio Share |
| HONA | RPO | Carnet de commandes contractuel | 18.2 Mds $ | b | titre prolonge identique a rpo_s (Carnet de commandes contractuel (RPO)) |
| HONA | BUYBACK_AUTH | Programme de rachat d'actions autorisé | 3.5 Mds $ | b | titre identique a buyback_auth_s (Programme de rachat d'actions autorisé) |
| HPQ | win11_refresh_complete | Avancement du renouvellement Windows 11 | 70 % | b | valeur identique a Installed base converted to Windows 11 (Part du parc installé migré vers Windows 11) |
| IBM | sw_arr | Revenu récurrent annuel Software (ARR) | 24.6 Mds $ | b | valeur identique a Total software annual recurring revenue (Revenu récurrent annuel logiciel) |
| INTC | Intel Foundry | Revenu Intel Foundry | 17.5 Mds $ | b | titre identique a FOUNDRY_REV (Revenu Intel Foundry) |
| INTC | Network & Edge | Revenu Network & Edge | 5.8 Mds $ | b | valeur identique a Networking & Edge (Revenu Networking & Edge (NEX)) |
| INTU | QuickBooks Online | Chiffre d'affaires comptabilité QuickBooks Online | 4.12 Mds $ | b | titre identique a QBO_ACCOUNTING_REV (Revenus QuickBooks Online Accounting) |
| INTU | Credit Karma | Chiffre d'affaires Credit Karma | 2.263 Mds $ | b | titre identique a CREDIT_KARMA_REV (Revenus Credit Karma) |
| KEY | SME Digital Onboarding | Intégration numérique des PME | 42000 clients | b | doublon d une autre story de la base (valeur) : SME Client Growth |
| KMX | Online Retail Sales | Ventes au détail entièrement en ligne | 13 % | b | titre identique a online_retail_pct (Part des ventes en ligne (online retail)) |
| KO | Sparkling Volume Share | Part des boissons gazeuses dans le volume | 69 % | b | valeur identique a sparkling_vol_share (Part volume boissons gazeuses) |
| KO | Concentrate Revenue Share | Part des opérations de concentrés dans le CA | 59 % | b | valeur identique a conc_rev_share (Part revenus opérations concentrés) |
| LLY | Zepbound Prescriptions | Ordonnances Zepbound | 125 k unités | b | doublon d une autre story de la base (titre) : Zepbound Scripts |
| LMT | Backlog Aeronautics | Carnet de commandes Aeronautics | 59.435 Mds $ | b | titre identique a Aero Backlog (Carnet de commandes Aeronautics) |
| LRCX | Part Chine | Part du revenu en Chine | 34 % | b | valeur identique a China Revenue % (Part du chiffre d'affaires Chine) |
| LULU | E-commerce Rev | Revenu e-commerce | 4.57 Mds $ | b | titre identique a ecom_rev (Chiffre d'affaires e-commerce) |
| META | Perte op. Reality Labs | Perte opérationnelle Reality Labs | -19.193 Mds $ | b | titre identique a RL_loss (Perte opérationnelle Reality Labs) |
| META | Croissance des impressions pub | Croissance des impressions publicitaires | 12 % | b | titre identique a ad_impr (Croissance impressions publicitaires) |
| META | Prix moyen par annonce | Prix moyen par annonce | 9 % | b | titre prolonge identique a avg_price_ad (Croissance prix moyen par pub) |
| MRK.DE | Emerging Markets Share | Part de chiffre d'affaires dans les marchés émergents | 34 % | b | doublon d une autre story de la base (titre) : Emerging Markets Revenue Share |
| MRK.DE | New Product Penetration | Pénétration des nouveaux produits | 27 % | b | doublon d une autre story de la base (titre prolonge) : New Product Sales Penetration |
| MRK.DE | Emerging Markets Lab Penetration | Pénétration des laboratoires en marchés émergents | 38 % | b | doublon d une autre story de la base (valeur) : Emerging Markets Revenue Share |
| MRSH | ESG Retention Rate | Taux de rétention ESG | 94.7 % | b | doublon d une autre story de la base (valeur) : Cyber Retention |
| MSCI | Climate Data AUM | Encours liés aux données climat | 1.8 Mds $ | b | doublon d une autre story de la base (valeur) : ESG Index AUM |
| NESN.SW | PetCare R&D Value | Valeur du portefeuille R&D Santé Animale | 1.8 Mds $ | b | doublon d une autre story de la base (titre prolonge) : R&D Pipeline Value |
| NFLX | UCAN ARM | Revenu mensuel moyen par abonne (USA-Canada) | 17.2 $ | b | titre prolonge identique a CAHIER_ARM_STREAMING (Revenu mensuel moyen par abonné) |
| NFLX | APAC Paid Members | Abonnes payants Asie-Pacifique | 57.541 M | b | titre identique a memb_apac (Abonnés payants APAC) |
| NVDA | Compute Revenue | Revenu Compute (calcul accéléré) | 162.361 Mds $ | b | titre identique a DC_COMPUTE (Revenu Calcul GPU) |
| NVDA | Pro Visualization | Visualisation professionnelle | 3191 M $ | b | titre identique a PROVIS_REV (Revenu Visualisation Pro) |
| NVDA | OEM and Other | Ventes OEM et autres | 619 M $ | b | valeur identique a OEM & Other Revenue (Revenu OEM & Autres) |
| NVDA | Supply Commitments | Engagements d'approvisionnement | 95.2 Mds $ | b | titre identique a SUPPLY_COMMIT (Engagements d'approvisionnement) |
| OMC | Media & Advertising | Chiffre d'affaires Media & Advertising | 10015.9 M $ | b | titre identique a media_adv_rev (Revenus Media & Publicité) |
| OMC | Precision Marketing | Chiffre d'affaires Precision Marketing | 1938.5 M $ | b | titre identique a precision_mktg_rev (Revenus Precision Marketing) |
| OMC | Healthcare Revenue | Chiffre d'affaires Healthcare | 1379.9 M $ | b | titre identique a healthcare_rev (Revenus Santé) |
| ORLY | Ventes comparables | Croissance des ventes a magasins comparables | 2.9 % | b | titre identique a comp_store_sales_growth (Croissance des ventes magasins comparables) |
| PAYX | Management Solutions Revenue | Revenu Management Solutions | 4.07 Mds $ | b | titre identique a mgmt_solutions_rev (Revenus Management Solutions (paie et RH)) |
| PDD | PAYABLE_MERCHANTS | Sommes dues aux marchands | 109.924 Mds RMB | b | valeur identique a WEB_SOMMES_DUES_AUX_MA (Sommes dues aux marchands de la plateforme) |
| PDD | MERCHANT_DEPOSITS | Dépôts de garantie des marchands | 18.545 Mds RMB | b | valeur identique a WEB_DEPOTS_DE_GARANTIE (Dépôts de garantie versés par les marchands) |
| PLTR | US Commercial Revenue | Revenu commercial Etats-Unis | 702.3 M $ | b | titre identique a US_COMM_REV (Revenu commercial US) |
| PSKY | Offre Warner Bros. | Offre sur Warner Bros. Discovery | 31 $ | b | valeur identique a Warner Bros. acquisition bid per share (Offre de rachat Warner Bros. par action) |
| PTC | Cloud Revenue | Revenu services cloud et support | 1469.2 M $ | b | titre identique a CA support et cloud (Chiffre d'affaires support et services cloud) |
| PTC | License Revenue | Revenu licences | 1162.7 M $ | b | titre identique a CA licences (Chiffre d'affaires licences) |
| PYPL | TPV transfrontalier % | Part du TPV transfrontalier | 12 % | b | valeur identique a CAHIER_CROSS_BORDER (Volume transfrontalier) |
| QRVO | BAW_FILTERS | Filtres à ondes acoustiques de volume livrés | 24 Mds de filtres | b | valeur identique a WEB_FILTRES_BAW_LIVRES (Filtres BAW livrés dans le monde (cumul)) |
| RDDT | CA_PUB_ANNUEL | Chiffre d'affaires publicitaire annuel | 2062.48 M$ | b | titre prolonge identique a CA_PUBLICITE (Chiffre d'affaires publicitaire) |
| RDDT | CA_AUTRES_ANNUEL | Chiffre d'affaires annuel hors publicite | 140.026 M$ | b | titre prolonge identique a CA_ANNUEL (Chiffre d'affaires annuel) |
| ROL | Croissance organique | Croissance organique du CA | 6.9 % | b | titre identique a organic_revenue_growth (Croissance Organique) |
| RSG | Environmental Solutions | CA Environmental Solutions (net) | 1.766 Mds $ | b | titre identique a env_solutions_rev (Revenus solutions environnementales) |
| RSG | Prix recyclables | Prix moyen des matières recyclées | 135 $/tonne | b | titre prolonge identique a CAHIER_RECYCLED_COMMODITY_PRICE (Prix moyen des matières recyclées vendues) |
| RVTY | Immunodiagnostics | Revenu Immunodiagnostics | 869.908 M $ | b | titre identique a immuno_rev (CA Immunodiagnostics) |
| RVTY | Reproductive Health | Revenu santé reproductive | 555.039 M $ | b | titre identique a repro_rev (CA Santé reproductive) |
| RXL.PA | Digital Sales Share | Part des ventes numériques | 38.2 % | b | titre identique a CAHIER_DIGITAL_SALES_MIX (Part des ventes numériques) |
| SBUX | Total magasins | Nombre total de magasins | 40990 magasins | b | valeur identique a CAHIER_PARC_UNITES (Parc mondial de magasins) |
| SNPS | Revenus time-based | Revenus produits time-based | 3.49 Mds $ | b | titre identique a Time-Based Revenue (Revenus produits time-based) |
| SNPS | Revenus Coree | Revenus en Corée | 0.947 Mds $ | b | titre identique a REV_KOREA (Revenus zone Corée du Sud) |
| SPCX | boosters_landings | Atterrissages de premier étage réussis | 657 atterrissages | b | titre prolonge identique a WEB_ATTERRISSAGES_DE_P (Atterrissages de premier étage réussis cumulés) |
| SPCX | starlink_orbite | Satellites Starlink en orbite | 11133 satellites | b | titre identique a WEB_SATELLITES_STARLIN (Satellites Starlink en orbite) |
| SPCX | starship_payload | Charge utile visée par Starship V3 | 100 t | b | valeur identique a WEB_CHARGE_UTILE_STARS (Charge utile Starship en configuration entièrement réutilisable) |
| SPCX | abo_q2_2026 | Abonnés Starlink au 30 juin 2026 | 12.0 M abonnés | b | valeur identique a starlink_abo (Abonnés Starlink) |
| SPCX | pays_couverts | Pays et territoires desservis par Starlink | 164 pays | b | titre identique a pays_couverts_q (Pays et territoires desservis par Starlink) |
| SPCX | carnet | Carnet de commandes | 28377 M $ | b | titre identique a backlog (Carnet de commandes) |
| SPCX | part_clients | Part du client principal dans le chiffre d'affaires | 20.9 % | b | titre identique a top_client_pct (Part du CA réalisée avec le premier client) |
| SPCX | prix_rideshare | Tarif d'entrée du programme de covoiturage orbital | 350000 $ | b | valeur identique a WEB_TARIF_D_ENTREE_DU_ (Tarif d'entrée du programme Rideshare) |
| STLD | Aluminum Net Sales | Chiffre d'affaires Aluminium | 318.69 M $ | b | titre identique a aluminum_revenue (Chiffre d’affaires aluminium) |
| TRI | BIG3_ORGANIC | Croissance organique des trois grands segments | 9 % | b | titre identique a ORGANIC_BIG3 (Croissance organique des "Big 3") |
| TROW | Taux de commission 38,1 pb | Taux de commission effectif |   | b | titre identique a efr (Taux de commission effectif) |
| TROW | BPA ajusté 2,57 $ | BPA dilué ajusté |   | b | titre identique a adj_eps (BPA dilué ajusté) |
| TSM | 3-nanometer Revenue | Revenu 3 nanomètres | 24 % | b | valeur identique a NODE_3NM_SHARE (Part du 3nm dans le CA wafers) |
| TTD | Dépense brute plateforme | Dépense brute sur la plateforme | 13.395 Mds $ | b | valeur identique a GROSS_SPEND (Dépense brute plateforme) |
| TTWO | RCS % du CA | Part des dépenses récurrentes | 79.4 % | b | titre prolonge identique a recurrent_spend_pct (Part des dépenses récurrentes des joueurs) |
| TXN | CA Analog | Chiffre d'affaires du segment Analog | 12.161 Mds $ | b | titre identique a analog_rev (Chiffre d'affaires segment Analog) |
| TXN | Avantage coût 300mm | Avantage de coût du wafer 300mm | 40 % | b | valeur identique a 300mm_cost_adv (Avantage coût puce 300mm vs 200mm) |
| TXN | Analog Share China | Part de marché Analog en Chine | 18.7 % | b | doublon d une autre story de la base (valeur) : Analog Share Asia |
| VMC | Aggregates Reserves | Réserves prouvées d'agrégats | 16.6 Mds tonnes | b | valeur identique a agg_reserves (Réserves de granulats prouvées et probables (Mds de tonnes)) |
| VRSK | Underwriting Revenue | Revenus souscription assurance | 2.024 Mds $ | b | titre identique a underwriting_rev (Revenu Underwriting) |
| VRSK | Claims Revenue | Revenus gestion des sinistres | 857 M $ | b | titre identique a claims_rev (Revenu Claims) |
| VST | Generation Capacity | Capacité de production | 44000 MW | b | valeur identique a total_gen_capacity (Capacité génération totale) |
| VST | Meta and AWS PPAs | Contrats long terme Meta et AWS | 3809 MW | b | valeur identique a dc_mw_contracted (MW data center contractés (AWS+Meta)) |
| VTR | Same-Store SHOP NOI | NOI same-store SHOP | 877.998 M $ | b | titre identique a SHOP SS NOI growth (NOI à périmètre constant des résidences seniors (périmètre propre à chaque trimestre)) |
| WAB | Commande KTZ | Commande locomotives Kazakhstan | 4.2 Mds $ | b | valeur identique a Kazakhstan National Railway order (Commande Kazakhstan (plus grosse commande ferroviaire de l'histoire)) |
| WHR | MDA North America Net Sales | Ventes nettes MDA Amérique du Nord | N/A M $ | b | titre identique a rev_mda_na (Revenus MDA Amérique du Nord) |
| WHR | SDA Global Net Sales | Ventes nettes SDA Global | N/A M $ | b | titre identique a rev_sda_global (Revenus SDA Global (petits électroménagers)) |
| WMT | Walmart US Comparable Sales | Ventes comparables Walmart U.S. | 4.3 % | b | titre prolonge identique a WMT_US_COMP_SALES (Walmart US - Ventes comparables (hors carburant)) |
| WSM | Pottery Barn Comparable Brand Revenue | Comp brand revenue Pottery Barn | 0.4 % | b | titre identique a COMP_PB (Ventes comparables Pottery Barn) |
| WSM | Williams Sonoma Comparable Brand Revenue | Comp brand revenue Williams Sonoma | 6.9 % | b | titre identique a COMP_WS (Ventes comparables marque Williams Sonoma) |
| WSM | Total Comparable Brand Revenue | Comp brand revenue total | 3.5 % | b | titre prolonge identique a COMP (Croissance comparable groupe (comps)) |
| WYNN | Las Vegas Adj Property EBITDAR | EBITDAR ajuste Las Vegas | 902.405 M $ | b | titre prolonge identique a Las Vegas Operations EBITDAR (EBITDAR ajusté Las Vegas Operations) |
| WYNN | Wynn Palace Adj Property EBITDAR | EBITDAR ajuste Wynn Palace | 682.9 M $ | b | titre identique a Wynn Palace EBITDAR (EBITDAR ajusté Wynn Palace) |
| WYNN | Encore Boston Adj Property EBITDAR | EBITDAR ajuste Encore Boston | 236.721 M $ | b | titre prolonge identique a Encore Boston Harbor EBITDAR (EBITDAR ajusté Encore Boston Harbor) |
| XYL | Water Infrastructure | CA segment Water Infrastructure | 2.636 Mds $ | b | titre identique a WI_REV (Revenu Water Infrastructure) |
| ALB | Energy Storage Volume | Volume de Stockage d'Énergie | 12.5 GWh | c | meme id qu un KPI kpis-haut : version corrigee servie |
| BE | systems_accepted | Systèmes acceptés par trimestre (équivalents 100 kW) | 737 systèmes | c | meme id qu un KPI kpis-haut : version corrigee servie |
| BE | mw_accepted | Mégawatts acceptés par trimestre | 74 MW | c | meme id qu un KPI kpis-haut : version corrigee servie |
| BE | installed_mw_cumulative | Base installée en mégawatts déployés | 1800 MW | c | meme id qu un KPI kpis-haut : version corrigee servie |
| BE | korea_deployed_mw | Parc déployé en Corée du Sud | 682 MW | c | meme id qu un KPI kpis-haut : version corrigee servie |
| BE | us_revenue_share | Part du chiffre d'affaires réalisée aux États-Unis | 81 % | c | meme id qu un KPI kpis-haut : version corrigee servie |
| BE | top_customer_share | Poids du premier client | 43 % | c | meme id qu un KPI kpis-haut : version corrigee servie |
| BE | phd_count | Docteurs dans les équipes de recherche | 62 personnes | c | meme id qu un KPI kpis-haut : version corrigee servie |
| BF.B | Net Income |  |   | c | meme id qu un KPI kpis-haut : version corrigee servie |
| BRK-B | Operating Earnings |  |   | c | meme id qu un KPI kpis-haut : version corrigee servie |
| BRK.B | Insurance Float | Flottant d'assurance | 165.2 Mds $ | c | meme id qu un KPI kpis-haut : version corrigee servie |
| EA | Live Services Bookings | Réservations services en ligne | 5.338 Mds $ | c | meme id qu un KPI kpis-haut : version corrigee servie |
| ECHO | Wireless Subs | Abonnés Wireless (Boost Mobile) | 7.511 M | c | meme id qu un KPI kpis-haut : version corrigee servie |
| ECHO | Pay-TV Subs | Abonnés Pay-TV (DISH + SLING) | 6.998 M | c | meme id qu un KPI kpis-haut : version corrigee servie |
| EXC | CustomerReliefFund | CustomerReliefFund | 60 M $ | c | meme id qu un KPI kpis-haut : version corrigee servie |
| EXC | CustomerReliefFund | CustomerReliefFund |   | c | meme id qu un KPI kpis-haut : version corrigee servie |
| EXPE | B2B Revenue | Revenu segment B2B | 4.842 Mds $ | c | meme id qu un KPI kpis-haut : version corrigee servie |
| EXPE | B2C Revenue | Revenu segment B2C | 9.474 Mds $ | c | meme id qu un KPI kpis-haut : version corrigee servie |
| FICO | ACV Bookings | Valeur annuelle des contrats signés (Software) | 102.4 M $ | c | meme id qu un KPI kpis-haut : version corrigee servie |
| FLEX | facilities_count | Sites de production | 100.0 unités | c | meme id qu un KPI kpis-haut : version corrigee servie |
| FLEX | segment_its_rev | CA segment Integrated Technology Solutions | 11109.0 M USD | c | meme id qu un KPI kpis-haut : version corrigee servie |
| FLEX | segment_rms_rev | CA segment Regulated Manufacturing Solutions | 10191.0 M USD | c | meme id qu un KPI kpis-haut : version corrigee servie |
| FLEX | segment_cpi_rev | CA segment Infrastructure cloud et énergie | 6614.0 M USD | c | meme id qu un KPI kpis-haut : version corrigee servie |
| FLEX | top10_customer_concentration | Concentration des 10 plus gros clients | 45.0 % | c | meme id qu un KPI kpis-haut : version corrigee servie |
| GOOG | Other Bets Rev | Revenu Other Bets | 1.537 Mds $ | c | meme id qu un KPI kpis-haut : version corrigee servie |
| GOOG | Other Bets Loss | Perte opérationnelle Other Bets | -7.515 Mds $ | c | meme id qu un KPI kpis-haut : version corrigee servie |
| GOOGL | Other Bets Rev | Revenu Other Bets | 1.537 Mds $ | c | meme id qu un KPI kpis-haut : version corrigee servie |
| GOOGL | Other Bets Loss | Perte opérationnelle Other Bets | -7.515 Mds $ | c | meme id qu un KPI kpis-haut : version corrigee servie |
| META | ARPP | Revenu moyen par personne | 57.03 $ | c | meme id qu un KPI kpis-haut : version corrigee servie |
| ODFL | LTL Tons per Day | Tonnage LTL par jour | 35.4 k tonnes | c | meme id qu un KPI kpis-haut : version corrigee servie |
| PANW | RPO | Carnet de commandes contractualisé | 15.8 Mds $ | c | meme id qu un KPI kpis-haut : version corrigee servie |
| RDDT | CA_ANNUEL | Chiffre d'affaires annuel | 2202.506 M$ | c | meme id qu un KPI kpis-haut : version corrigee servie |
| RDDT | NET_INCOME_ANNUEL | Résultat net annuel | 529.721 M$ | c | meme id qu un KPI kpis-haut : version corrigee servie |
| RDDT | CA_INTERNATIONAL | Chiffre d'affaires réalisé hors des États-Unis | 416.952 M$ | c | meme id qu un KPI kpis-haut : version corrigee servie |
| RDDT | EFFECTIFS | Effectifs (fin d'exercice) | 2555 personnes | c | meme id qu un KPI kpis-haut : version corrigee servie |
| RDDT | REMUN_ACTIONS | Charge de rémunération en actions (SBC) | 343.2 M$ | c | meme id qu un KPI kpis-haut : version corrigee servie |
| RDDT | TRESORERIE | Trésorerie et équivalents | 953.569 M$ | c | meme id qu un KPI kpis-haut : version corrigee servie |
| RMBS | PRODUCT_REV_Q | Chiffre d'affaires des composants | 99.2 M$ | c | meme id qu un KPI kpis-haut : version corrigee servie |
| SPCX | booster_record | Vols réalisés par le premier étage le plus utilisé | 37 vols | c | meme id qu un KPI kpis-haut : version corrigee servie |
| TJX | Marmaxx Comp | Ventes comparables Marmaxx | 4 % | c | meme id qu un KPI kpis-haut : version corrigee servie |
| TMUS | Postpaid Phone Customers | Clients postpayés mobile | 79.013 M | c | meme id qu un KPI kpis-haut : version corrigee servie |
| TMUS | Postpaid Phone Net Adds | Lignes postpayees nettes ajoutees | 3.077 M | c | meme id qu un KPI kpis-haut : version corrigee servie |

## 7. Autres KPI de base absents de la fiche (NON fusionnes)

- 11642 KPI non-story de v2-pipeline / enrich (kpis[]) sur 592 societes sont absents de ce qui est servi, sans KPI de meme id ni de meme titre. En plus : 118 remplaces par le meme id kpis-haut, 3399 doublons de titre d un KPI servi.
- Ils relevent du remplacement volontaire de la liste generique legacy par kpis-haut (decision du 2 juillet 2026). Ils ne sont pas reintroduits. Sources principales :

| _source | Nombre |
|---|---|
| (aucun) | 3235 |
| 10-Q Q1 FY2026 | 803 |
| data-lake | 296 |
| ER+earnings-calls | 262 |
| 10Q mai 2026 | 224 |
| 10Q avril 2026 | 185 |
| 10-Q avril 2026 | 151 |
| 10-Q mai 2026 | 146 |
| 10-Q Q3 FY2026 | 127 |
| ER (Cerebras) | 101 |
| 10-Q Q2 FY2026 | 90 |
| 10-Q 2026-05-07 | 87 |
| 10-Q 2026-05-01 | 86 |
| 10-Q 2026-04-30 | 81 |
| SEC 10-Q BS4 whitelist | 68 |

Liste complete : `fusion-stories-autres-kpi.json` (meme dossier).