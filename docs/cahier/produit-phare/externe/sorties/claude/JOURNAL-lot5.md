# Journal de travail, lot 5 (26 societes)

Travail realise le 13 septembre 2026. Societes traitees dans l ordre du fichier de depart pour la decision, mais regroupees par type de source pour la collecte : d abord les deposants americains, dont les rapports annuels etaient deja presents dans le data-lake local, puis les societes europeennes, dont les documents ont ete cherches sur le web. Chaque fichier a ete ecrit des qu il etait pret, sans rien garder en memoire.

## Preparation

| Etape | Resultat | Difficulte |
|---|---|---|
| Lecture de la mission et des exemples de format | Format P2 repris a l identique de l exemple BA | Aucune |
| Verification des fichiers deja presents | Aucun des 26 tickers n avait de fichier P2 dans le dossier de sortie, les 26 ont donc ete traites | Aucune |
| Mise en place des outils de lecture | Conversion des rapports compresses du data-lake en texte, recuperation des adresses officielles des depots via l interface du regulateur americain | Aucune |

## Societes avec serie produite

| Ticker | Produit retenu | Indicateur | Points | Difficulte rencontree |
|---|---|---|---|---|
| MDLZ | Biscuit Oreo | Ventes de la categorie Biscuits et snacks cuits | 10 | Categorie renommee en 2021, signalee dans la note |
| LII | Chauffage et climatisation residentiels Lennox | Ventes du segment Confort residentiel | 10 | Segment renomme en 2023, perimetre inchange |
| NDSN | Depose de colle thermofusible | Ventes du segment porteur | 10 | Deux ruptures de perimetre, en 2020 et en 2024 |
| MKC | Epices et assaisonnements McCormick | Ventes du segment Grand public | 10 | Exercice clos le 30 novembre, deux annees legerement reexprimees |
| LULU | Legging Align | Chiffre d affaires de la categorie Femme | 7 | Ventilation par categorie publiee seulement depuis l exercice 2019 |
| MELI | Place de marche Mercado Libre | Nombre d articles vendus | 10 | Aucune |
| RKLB | Lanceur Electron | Lancements realises dans l annee | 6 | Societe cotee depuis 2021, decompte disponible a partir de 2020 |
| KVUE | Tylenol | Ventes du segment Sante grand public | 5 | Societe separee de sa maison mere en 2023, comptes remontant a 2021 |
| LHX | Radios tactiques | Revenus du segment Communication Systems | 6 | Changement d exercice en 2019 et redecoupage en 2023 |
| MC.PA | Sacs Louis Vuitton | Chiffre d affaires Mode et Maroquinerie | 10 | Valeur 2025 arrondie faute de communique detaille accessible |
| ML.PA | Pneumatiques tourisme et camionnette | Ventes du secteur Automobile | 8 | Perimetre du secteur modifie en 2019 et en 2025 |
| MBG.DE | Voitures particulieres Mercedes-Benz | Ventes unitaires mondiales | 10 | Division fusionnee avec les utilitaires en 2020 et 2021, contournee par les communiques de ventes |
| RHM.DE | Obus de 155 millimetres | Ventes de la division Armes et munitions | 10 | Exercice 2022 reexprime, signale dans la note |
| NESN.SW | Nespresso | Ventes du segment declare Nespresso | 5 | Segment declare seulement depuis 2020, site de la societe inaccessible |
| REN.AS | Articles de recherche Elsevier | Chiffre d affaires du segment Scientifique, technique et medical | 6 | Perimetre modifie a l exercice 2025 |
| MMM | Post-it et Scotch | Ventes du segment Grand public | 10 | Segment plusieurs fois reexprime, un ecart de controle assume |

## Societes en echec

| Ticker | Motif |
|---|---|
| LR.PA | Portefeuille atomise, aucune donnee par famille de produits |
| ORLY | Distributeur de pieces automobiles, aucune ventilation publiee |
| PAH3.DE | Holding financiere sans production propre |
| PDD | Place de marche tierce, volume d affaires plus publie depuis 2021 |
| POOL | Distributeur en gros, seule granularite publiee une part de ventes arrondie |
| RAND.AS | Prestataire de services, le travail temporaire se confond avec le total |
| MCD | Aucun chiffre par produit publie, segments geographiques uniquement |
| MTX.DE | Site investisseurs inaccessible, activite moteurs civils retrouvee seulement pour 2024 et 2025 et arrondie |
| OR.PA | Aucune ventilation du chiffre d affaires du groupe par categorie de produits |
| PRX.AS | Nombre annuel de commandes iFood non publie de facon continue |

## Difficultes generales

1. Les sites investisseurs de plusieurs societes europeennes refusent l acces automatise, notamment celui du constructeur automobile allemand, celui du groupe alimentaire suisse et celui du motoriste aeronautique. Le contournement a consiste a passer par les depots aupres du regulateur americain quand ils existent, par les archives publiques de communiques et par les depots hebergeres sur des sites d archivage de rapports annuels.
2. Les changements de perimetre de segments sont le probleme de fond du lot : sept societes sur les seize avec serie ont redecoupe leurs segments au moins une fois sur la periode. Chaque rupture est signalee dans la note du fichier concerne.
3. Aucune valeur n a ete inventee. Quand une annee n a pas ete retrouvee, la serie a ete raccourcie plutot que completee.
