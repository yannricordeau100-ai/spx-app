# Journal de travail, lot 1 (20 societes)

Toutes les heures sont locales, le 13 septembre 2026. Les societes sont traitees dans l ordre de decouverte des donnees et non dans l ordre du fichier de depart, la recherche de sources ayant ete regroupee par type de document (rapports annuels deposes aupres du regulateur boursier americain d un cote, rapports europeens de l autre). Chaque fichier a ete ecrit des qu il etait pret.

## Preparation

| Heure | Etape | Resultat | Difficulte |
|---|---|---|---|
| 15 h 09 | Lecture de la mission, des exemples et du validateur | Regles et format assimiles | Aucune |
| 15 h 10 | Lecture de la liste des societes et releve des dossiers locaux du lac de donnees | 20 societes du lot identifiees, rapports locaux disponibles pour les 20 | Les fichiers locaux sont des liens vers une autre arborescence, lisibles avec l outil de decompression du systeme et non avec la commande par defaut |
| 15 h 12 | Ecriture du manifeste de securite avant travaux | Fait | Aucune |

## Phase 1 et phase 2, identification et verification

| Heure | Societe | Resultat phase 1 | Resultat phase 2 | Difficulte |
|---|---|---|---|---|
| 15 h 20 | F, Ford | Pick-up F-Series | Accord | Aucune, produit evident |
| 15 h 30 | GD, General Dynamics | Avions d affaires Gulfstream | Accord | Aucune |
| 15 h 40 | GM, General Motors | Pick-up Chevrolet Silverado | Accord | Aucune |
| 15 h 50 | GRMN, Garmin | Montres de plein air, gamme fenix | Hesitation avec le segment Sport et fitness | Les deux familles de montres sont dans deux segments differents ; exception ouverte, deux fichiers de serie |
| 16 h 00 | HAS, Hasbro | Jeu de cartes MAGIC: THE GATHERING | Accord | Aucune |
| 16 h 10 | HEIA.AS, Heineken | Biere de marque Heineken | Accord | Aucune |
| 16 h 20 | HEN3.DE, Henkel | Lessive Persil | Accord, avec Loctite signale comme alternative | Le serveur de Henkel refuse les requetes automatisees |
| 16 h 30 | DTG.DE, Daimler Truck | Camions Freightliner, gamme Cascadia | Accord, Actros signale comme alternative | Segment Amerique du Nord et segment Mercedes-Benz de tailles voisines |
| 16 h 40 | AD.AS, Ahold Delhaize | Vente de courses en ligne | Accord, avec reserve sur la nature de canal | Distributeur pur, aucun produit physique chiffre |
| 16 h 50 | G1A.DE, GEA Group | Separateurs centrifuges | Accord | Aucune |
| 17 h 00 | BNR.DE, Brenntag | Aucun produit identifiable, statut confirme | Accord sur l absence de produit | Distributeur pur, aucun tonnage publie |
| 17 h 10 | CHRW, C.H. Robinson | Transport routier de lots complets | Accord | Conclusion precedente sans produit revue : le service existe et il est chiffre |
| 17 h 20 | CMG, Chipotle | Bol burrito au poulet | Accord | Aucun chiffre par plat, recours au chiffre d affaires des ventes de nourriture |
| 17 h 30 | GE, GE Aerospace | Moteur LEAP | Accord, GEnx signale comme alternative | Le LEAP est deja attribue a Safran par le proprietaire, arbitrage a rendre |
| 17 h 40 | GEV, GE Vernova | Turbines a gaz lourdes | Accord | Societe cotee depuis 2024, historique court |
| 17 h 50 | GPC, Genuine Parts | Pieces automobiles NAPA | Accord | Aucune |
| 18 h 00 | FIX, Comfort Systems | Travaux de chauffage, ventilation et climatisation | Accord | Aucune |
| 18 h 10 | FTV, Fortive | Instruments de mesure Fluke | Accord | La raison invoquee par l analyse precedente, le depart de Fluke avec Ralliant, est fausse : Fluke est toujours chez Fortive |
| 18 h 20 | GWW, Grainger | Offre de fournitures d entretien a forte valeur ajoutee | Accord | Aucun produit physique dominant, service retenu |
| 18 h 30 | HD, Home Depot | Materiaux de construction, premiere ligne de produits | Accord | L enseigne reclasse regulierement ses lignes de produits |

## Phase 3, series annuelles

| Heure | Societe | Points | Statut | Difficulte |
|---|---|---|---|---|
| 15 h 25 | F | 10 | ok | Le communique de ventes 2019 ne donne pas le total F-Series seul, il faut le deduire du total avec le Ranger ; le communique 2024 ne donne que des pourcentages, valeur prise dans la presse |
| 15 h 35 | GD | 10 | ok | Changement de presentation en 2017, livraisons vertes et livraisons amenagees fusionnees en une ligne unique |
| 15 h 45 | GM | 10 | ok | Le site investisseurs de General Motors bloque la lecture automatique ; serie prise dans une base publique de ventes par modele, a methode constante |
| 15 h 55 | GRMN et GRMN~B | 10 et 10 | ok | Aucune |
| 16 h 05 | HAS | 7 | ok | Le segment n existe qu a partir de 2019 |
| 16 h 15 | HEIA.AS | 10 | ok | Changement de definition en 2017, valeur 2016 reprise dans le graphique quinquennal du rapport 2019 |
| 16 h 25 | HEN3.DE | 10 | ok | La division a fusionne dans Grand public en 2023, mais le domaine d activite continue d etre publie |
| 16 h 35 | DTG.DE | 6 | ok | Pas de donnees comparables avant 2020 |
| 16 h 45 | AD.AS | 9 | ok | Valeur 2016 publiee seulement arrondie, exercice ecarte |
| 16 h 55 | G1A.DE | 9 | ok | Piege de l entree de commandes confondue avec le chiffre d affaires, corrige apres verification dans le texte du rapport |
| 17 h 05 | BNR.DE | 0 | echec | Aucun indicateur produit possible |
| 17 h 15 | CHRW | 10 | ok | Changement de nom de l indicateur en 2020, definition inchangee |
| 17 h 25 | CMG | 10 | ok | Aucune |
| 17 h 35 | GE | 10 | ok | GE ne publie que des ecarts, valeurs absolues prises chez Safran et dans la presse aeronautique |
| 17 h 45 | GEV | 5 | ok | Historique limite a 2021 |
| 17 h 55 | GPC | 10 | ok | Scission du pole automobile en deux segments en 2025, addition verifiee sur 2023 |
| 18 h 05 | FIX | 7 | ok | Deux segments seulement depuis 2019 |
| 18 h 15 | FTV | 7 | ok | Retraitement des exercices 2023 et 2024 apres la scission de Ralliant |
| 18 h 25 | GWW | 7 | ok | Deux segments seulement depuis 2019 |
| 18 h 35 | HD | 10 | ok | Reclassements de categories, serie construite sur la valeur la plus recemment publiee pour chaque exercice |

## Controles de fin de tranche

| Heure | Etape | Resultat |
|---|---|---|
| 18 h 40 | Passage du validateur sur les 21 fichiers de serie | 20 reponses OK, le seul fichier signale etant celui de Brenntag, en echec par construction |
| 18 h 45 | Verification de l ouverture des adresses citees | Cinq adresses corrigees, quatre adresses inaccessibles a un robot mais publiques, detail dans le rapport de controle |
| 18 h 50 | Relecture de dix series contre leurs sources | Detail dans le rapport de controle |
| 18 h 55 | Ecriture du rapport de controle et du manifeste | Fait |
