# Origine des KPI IC servis (7 oct 2026)

Lecture seule. Périmètre : KPI IC servis = kpis-haut (658 sociétés) + KPI de la base v2-pipeline conservés par KEPT_SOURCES (6 464) + 36 KPI de 4 sociétés sans fichier kpis-haut (SOON.SW, LI.PA, DIM.PA, AGN.AS). Total : **36 554 KPI** sur 662 sociétés.
Note : le compte officiel « KPI IC total » de scripts/compte-types-kpi.py (47 713) ajoute 15 347 KPI de la base que le chargeur écrase (non servis). Aucun KPI yfinance n'est servi (707 existent seulement dans des sauvegardes .bak de v2-pipeline).

## Résultat chiffré (36 554 KPI servis)

| Classe | Nombre | Part |
|---|---|---|
| (a) Source = document de la société | 12 982 | 35,5 % |
| dont source décrite par KPI (document, URL, tableau) | 5 265 | |
| dont KPI posés depuis le Cahier avec URL de document | 1 236 | |
| dont simple étiquette de lot (stories-calls 3 034, ER+earnings-calls 1 288, kpis-haut 10-Q/10-K 359, sectoriel 237, calls-5y 121, stories-filings 12) | 5 051 | |
| dont « site web de la société » (WEB_*), pas un dépôt réglementaire | 1 430 | |
| (b) Au moins une source tierce citée | 67 (48 sociétés) | 0,2 % |
| dont tierce seule, sans document société | 30 | |
| dont mixte (document société + tierce) | 37 | |
| (c) Aucune trace de source dans le fichier | 23 505 | 64,3 % |

Les chiffres (a) et (b) sont tirés des champs de source (_source, source, _source_detail, _src_note, _source_note, source_extension, _maj_source, _sources_urls, source_url/citation par point d'historique), plus, pour les KPI « produit phare », les URL de docs/cahier/produit-phare/*.json (le fichier KPI ne les porte pas).

## (c) : origine probable, preuve partielle

- 23 503 sont dans kpis-haut, 2 dans la base. 19 032 KPI de sociétés US et 3 156 de sociétés européennes (tickers avec point).
- Chaîne de production documentée : docs et scripts décrivent l'extraction de kpis-haut depuis les dépôts SEC (10-Q/10-K via data-lake, voir .batches-drafts-safe/HANDOFF-KPI-HISTORY.md : « JAMAIS inventer de valeurs »), puis kpi-v3 (méthode kpi-v3-xbrl+filings), XBRL companyfacts, URD/communiqués pour l'Europe. Aucun script de la chaîne principale ne lit de source tierce ; les scripts yfinance écrivent dans v2-pipeline et leurs KPI sont écartés par le chargeur.
- Git ne remonte pas assez : kpis-haut est versionné depuis le 2 juil 2026 (commit « monitor refresh auto »), 305 commits, aucun message ne détaille l'origine d'un KPI donné. Pas de preuve par l'historique git.
- **Test de corroboration (échantillon)** : 309 KPI de la classe (c) tirés au hasard (30 sociétés US + 22 européennes, 6 KPI chacune, 6 derniers points non dérivés), valeurs cherchées dans tous les textes de la société du data-lake (10-Q, 10-K, 8-K, XBRL, URD, communiqués, présentations en .txt.gz ; PDF non lus).
  - 83 % des KPI (256/309) ont au moins 80 % de leurs points retrouvés tels quels dans les documents de la société ; 87,5 % des points retrouvés au total.
  - Témoin (mêmes valeurs perturbées de 1,4 %) : 10 % des KPI (30/305) et 31 % des points « retrouvés » par hasard. Estimation corrigée : environ 80 % des (c) sont prouvés issus des documents de la société.
  - Reste (environ 20 %) : non corroboré par ce test, sans preuve du contraire. Cas types : ratios calculés (marges, parts, prix par To), conversions d'unité, données seulement dans des PDF non lus (ER/EP US, présentations européennes). Exemples : STX mass_cap_rev_pct, ERIE dividends_paid, META op_margin, EME dc_total, BESI SEGDA, CS.PA HEALTH_REV.
  - Vérification ciblée de 14 « parts de marché » sans source (PM, F, GM, PCAR, KLAC, MO, CL, BALL, CBOE, NDAQ, HSY, EG) : les chiffres sont tous dans les documents de la société. Mais plusieurs sociétés citent elles-mêmes une donnée externe (Ford, GM, PACCAR, Philip Morris, Altria) : le document est de la société, la mesure vient d'un tiers. 39 KPI « part de marché / rang » sont dans (c).
- Conclusion (c) : plausiblement document de la société (chaîne documentée + 80 % corroboré), mais **non prouvable KPI par KPI** sans source écrite.

## Autres nuances

- Étiquette de lot seule (5 051) : la source est le lot de production (appels, communiqués, 10-Q), pas une citation par KPI. « sectoriel » = extraction par modèle Cerebras (gpt-oss-120b) lisant 10-Q/20-F (scripts/sa22c-new-sectoral-quarterly.py) : document de la société lu par un modèle, non revérifié.
- Un KPI Airbus (AIR.PA BA_ORD_NET) vient de documents Boeing (8-K), donc document d'une autre société.
- FOXA FOX_NEWS_SUBS : abonnés estimés par Nielsen, repris dans le 10-K de Fox (classé société, donnée d'origine tierce). TROW perf_morningstar : idem (10-Q avec référence Morningstar).
- PLTR « Pays partenaires » : « Recensement Mettrik : communiqués Palantir et clients, annonces gouvernementales, marchés publics, presse nationale et financière » (compté en (b)).
- 1 430 KPI WEB_* : pages du site de la société (parfois archive.org d'une page société, ou filiale : lexisnexis/elsevier pour RELX, Tikkie pour ABN AMRO). 9 sont des articles de presse ou sites tiers (voir tableau).
- Les KPI « produit phare » étiquetés « externe (ChatGPT) » ou « claude » : chaque année est sourcée dans docs/cahier/produit-phare ; la majorité vient de sec.gov/IR, mais pour 20 d'entre eux une partie des années vient d'agrégateurs (macrotrends, stockanalysis, companiesmarketcap, ycharts, annual-statements.com, Wikipedia...).

## (b) Liste nominative (67 KPI)

| Ticker | KPI | Intitulé | Type | Source tierce |
|---|---|---|---|---|
| AAPL | iPhone Units | Unités iPhone vendues | pure | counterpoint, idc, strategy analytics |
| AAPL | iPhone Cumul | Unités iPhone vendues (cumul total) | mixte | idc |
| ADI | WEB_USINES_INTERNES_MODELE | Usines internes (modèle fab-lite) | mixte | manufacturingdive.com |
| AEE | CAHIER_CUSTOMER_RELIABILITY | Clients électricité (compteurs) | pure | eia.gov |
| AIR.PA | GMF_DEMANDE_20ANS | Demande d'avions neufs sur 20 ans prévue par Airbus | pure | presse spécialis |
| AIR.PA | BA_BACKLOG_U | Carnet de commandes de Boeing, avant ajustement ASC 606 | pure | forecast international |
| AMD | mercury_serveur_part | Part d'AMD dans les revenus des processeurs serveur x86 | mixte | mercury research, tom's hardware, wccftech |
| BF.B | JDTW_VOL | Volumes mondiaux Jack Daniel's Tennessee Whiskey | mixte | thespiritsbusiness.com (10 années sur 10 via ces sites) |
| COST | ROTI_CHICKENS | Poulets rôtis vendus dans le monde | mixte | thehustle.co, chowhound.com, eatthis.com, foxbusiness.com, supermarketnews.com, tastingtable.com (8 années sur 9 via ces sites) |
| CPRT | VEHICLE_SALES_REV | Chiffre d'affaires des véhicules achetés puis revendus | mixte | ebs.publicnow.com (1 années sur 10 via ces sites) |
| D | CAHIER_CUSTOMER_RELIABILITY | Clients électricité Virginia Power (compteurs) | pure | eia.gov |
| DG.PA | VC_REV10_B | Chiffre d'affaires de VINCI Construction | mixte | zonebourse.com (3 années sur 10 via ces sites) |
| DTE | CAHIER_CUSTOMER_RELIABILITY | Clients électricité (compteurs) | pure | eia.gov |
| ED | CAHIER_CUSTOMER_RELIABILITY | Fréquence des interruptions par client (hors grandes tempête | mixte | dps.ny.gov |
| EIX | CAHIER_SAIDI_SAIFI | Durée moyenne des coupures (SAIDI) | mixte | cpuc.ca.gov |
| EN.PA | ASPHALT_MIX | Production d’enrobés bitumineux | mixte | scribd.com (1 années sur 6 via ces sites) |
| ENR.DE | REV_EOLIEN_FY_B | Chiffre d'affaires de l'éolien (Siemens Gamesa) | mixte | offshorewind.biz (1 années sur 10 via ces sites) |
| EXC | ventes_d_electricite_au_detail_des_six_c | Ventes d'électricité au détail des six compagnies de distrib | mixte | eia.gov, eia, |
| FGR.PA | APRR_VKT | Trafic des réseaux APRR et AREA | mixte | investorpa.com (5 années sur 7 via ces sites) |
| FISV | ORGANIC | Croissance organique du CA | mixte | marketbeat.com |
| GOOGL | search_share_ww | Part de marché mondiale de Google Search | pure | statcounter |
| GOOGL | chrome_share_ww | Part de marché mondiale du navigateur Chrome | pure | statcounter |
| GOOGL | android_share_mobile | Part de marché mondiale d'Android (mobile) | pure | statcounter |
| GOOGL | gcp_cloud_share | Part de marché de Google Cloud dans l'infrastructure cloud | pure | statista, synergy research |
| GOOGL | waymo_cities | Villes desservies par Waymo | pure | cnbc, sherwood.news |
| HLT | HAMPTON_ROOMS | Chambres Hampton by Hilton en fin d’année | mixte | annual-statements.com (4 années sur 10 via ces sites) |
| IR | ITS_REVENUE | Chiffre d’affaires Technologies et services industriels | mixte | financialfilings.com (3 années sur 10 via ces sites) |
| MAS | DECORATIVE_SALES | Ventes du segment Decorative Architectural Products | mixte | finviz.com (3 années sur 10 via ces sites) |
| MCD | PHARE_MCD | Prix moyen du Big Mac aux États-Unis | pure | raw.githubusercontent.com (1 années sur 1 via ces sites) |
| META | whatsapp_mau | Utilisateurs mensuels de WhatsApp | pure | statista, techcrunch |
| META | quest_vr_share | Part de marché des casques Quest dans la VR | mixte | idc |
| META | fb_ados_us | Part des ados américains qui utilisent Facebook | pure | pew research |
| META | insta_ados_us | Part des ados américains qui utilisent Instagram | pure | pew research |
| MO | MARLBORO_US_SHIPMENTS | Expeditions domestiques de cigarettes Marlboro | mixte | annual-statements.com (1 années sur 10 via ces sites) |
| NEE | CAHIER_CUSTOMER_RELIABILITY | Clients de FPL | pure | eia.gov |
| NSC | INTERMODAL_UNITS | Unités intermodales transportées (annuel) | mixte | quarterlytics.com (1 années sur 7 via ces sites) |
| ORA.PA | WEB_CLIENTS_ORANGE_MONEY | Clients Orange Money | mixte | lesoleil.com |
| ORA.PA | WEB_CABLES_SOUS_MARINS | Câbles sous-marins exploités par Orange Wholesale | mixte | universfreebox.com |
| ORA.PA | WEB_REPARATI_REALISEE_LIAISONS | Réparations réalisées sur liaisons sous-marines | mixte | universfreebox.com |
| ORA.PA | WEB_CONQUETE_FIBRE_FRANCE | Part de conquête fibre en France | mixte | lesoleil.com |
| PCG | CAHIER_CUSTOMER_RELIABILITY | Clients desservis et fiabilité du service | pure | eia.gov |
| PEG | CAHIER_SAIDI_SAIFI | Durée et fréquence moyennes des coupures | pure | eia.gov |
| PNW | CAHIER_CUSTOMER_RELIABILITY | Durée moyenne des coupures par client (SAIDI) | pure | eia.gov |
| PNW | ventes_d_electricite_au_detail_d_arizona | Ventes d'électricité au détail d'Arizona Public Service (GWh | mixte | eia.gov, eia, |
| PPL | CAHIER_SAIDI_SAIFI | Durée et fréquence moyennes des coupures | pure | eia.gov |
| RCL | PASSENGERS_CARRIED | Passagers transportes | mixte | analystreports.som.yale.edu, annual-statements.com, fintel.io, publicnow.com (7 années sur 10 via ces sites) |
| RNO.PA | CLIO_EU_REG | Immatriculations de Renault Clio en Europe | pure | de.motor1.com, en.wikipedia.org, motor1.com, wikip (10 années sur 10 via ces sites) |
| RNO.PA | PHARE_RNO_PA | Ventes mondiales de la Dacia Sandero (gamme Sandero, tous ca | mixte | de.motor1.com, en.wikipedia.org, motor1.com, wikip (10 années sur 15 via ces sites) |
| RSG | COLLECTION_REVENUE | Chiffre d'affaires de l'activité de collecte | mixte | annual-statements.com, companiesmarketcap.com, ebs.publicnow.com (3 années sur 10 via ces sites) |
| SBUX | NET_REVENUE | Chiffre d'affaires net de Starbucks | mixte | cincodias.elpais.com, worldlypartners.com, macrotrends.net (10 années sur 10 via ces sites) |
| SNA | NET_SALES | Ventes nettes annuelles (hors services financiers) | pure | macrotrends.net (7 années sur 10 via ces sites) |
| SO | CAHIER_SAIDI_SAIFI | Durée moyenne des coupures | pure | eia.gov |
| SPCX | falcon_lch | Lancements Falcon | mixte | wikip |
| SPCX | WEB_SATELLITES_STARLIN | Satellites Starlink en orbite | mixte | mcdowell, planet4589 |
| SPCX | part_lancements_monde | Part de SpaceX dans les lancements orbitaux mondiaux | pure | mcdowell, planet4589, wikip |
| SPCX | booster_record | Vols réalisés par le premier étage le plus utilisé | pure | mcdowell, planet4589, wikip |
| STLAP.PA | RAM_PICKUP_US_SALES | Ventes de Ram Pickup aux États-Unis | mixte | autoevolution.com, goodcarbadcar.net, wikizero.net (10 années sur 10 via ces sites) |
| SWK | GROUP_REVENUE | Chiffre d'affaires de Stanley Black & Decker | mixte | companiesmarketcap.com (9 années sur 10 via ces sites) |
| TSM | WEB_DEMANDES_BREVETS_INVENTIO | Demandes de brevets d'invention déposées à Taiwan (10e année | mixte | tipo.gov.tw |
| TSM | WEB_BANDE_PASSANTE_AGREGEE | Bande passante agrégée de la plateforme photonique COUPE (op | mixte | tweaktown.com |
| TSN | GROUP_REVENUE | Chiffre d'affaires de Tyson Foods | pure | macrotrends.net (10 années sur 10 via ces sites) |
| UNA.AS | GROUP_TURNOVER | Chiffre d'affaires d'Unilever | mixte | marketgenius.app (5 années sur 10 via ces sites) |
| UNP | GROUP_REVENUE | Chiffre d'affaires de Union Pacific | pure | stockanalysis.com, ycharts.com (10 années sur 10 via ces sites) |
| VOW.DE | TIGUAN_PRODUCTION | Production mondiale de Volkswagen Tiguan | mixte | wikiland.org (1 années sur 10 via ces sites) |
| XYL | GROUP_REVENUE | Chiffre d'affaires de Xylem | pure | macrotrends.net (10 années sur 10 via ces sites) |
| YUM | GROUP_REVENUE | Chiffre d'affaires de Yum! Brands | pure | macrotrends.net (10 années sur 10 via ces sites) |
| PLTR | Pays partenaires | Pays partenaires de Palantir | pure | presse nationale et financière, annonces gouvernementales, marchés publics (recensement Mettrik) |

(66 lignes détectées automatiquement + PLTR ajouté à la main = 67.)

## Limites

- Détection de la source par champs et mots-clés ; une source tierce citée sans mot-clé reconnu pourrait m'échapper en (a). Balayage complémentaire fait (presse, étude, analyste, tracker, Nielsen, IDC, etc.).
- Le test de corroboration compare des nombres, il ne prouve pas la lecture du bon tableau.
- Les 15 347 KPI écrasés de la base ne sont pas classés.
