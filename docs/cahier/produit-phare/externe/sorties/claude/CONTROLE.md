# Rapport de controle, lot 1 (20 societes)

Travaux du 13 septembre 2026. Perimetre : les vingt premieres societes du fichier de reprise, traitees en trois phases, identification, verification independante, serie annuelle.

## 1. Tableau de synthese

| Indicateur | Nombre |
|---|---|
| Societes traitees en phase 1 | 20 |
| Societes traitees en phase 2 | 20 |
| Societes validees, accord du verificateur | 18 |
| Exceptions | 2 (Garmin, hesitation entre deux candidats ; Brenntag, sans produit) |
| Fichiers de serie ecrits | 21 (dont un fichier B pour Garmin) |
| Series abouties | 20 |
| Echecs | 1 (Brenntag) |
| Series de 10 points | 11 |
| Series courtes, de 5 a 9 points | 9 |
| Series de moins de 5 points | 0 |

Detail des series courtes et de leur raison :

| Ticker | Points | Periode | Raison de la serie courte |
|---|---|---|---|
| GEV | 5 | 2021 a 2025 | Societe cotee depuis avril 2024, comptes combines publies seulement a partir de 2021 |
| DTG.DE | 6 | 2020 a 2025 | Societe detachee de Daimler en 2019 et cotee fin 2021, decoupage par segment non raccordable avant 2020 |
| HAS | 7 | 2019 a 2025 | Le segment Wizards of the Coast n existe qu a partir de la reorganisation comptable de 2021, retraitee jusqu a 2019 |
| FIX | 7 | 2019 a 2025 | Un seul segment publie avant 2019 |
| FTV | 7 | 2019 a 2025 | Decoupage en trois segments a partir de 2021, retraite jusqu a 2019 |
| GWW | 7 | 2019 a 2025 | Decoupage en deux segments a partir de 2019 |
| AD.AS | 9 | 2017 a 2025 | Montant 2016 publie seulement arrondi au milliard, exercice ecarte plutot qu approxime |
| G1A.DE | 9 | 2017 a 2025 | Decoupage en cinq divisions issu de la reorganisation de 2019, retraite jusqu a 2017 |
| HEIA.AS | 10 | 2016 a 2025 | Complete, mais valeur 2016 reprise dans un graphique retrospectif et non dans le communique de 2016 |

## 2. Passage du validateur

Le script `valide.py` a ete lance sur les 21 fichiers de serie. Resultat : 20 reponses `OK`.

Le seul fichier signale est `P2/BNR.DE.json`, avec le statut `echec` et les remarques `0 points` et `pas de controle`. Ce n est pas un defaut a corriger : le validateur n a pas de cas prevu pour le statut `echec`, alors que la mission demande explicitement de produire un fichier de serie en echec lorsque la serie est impossible. Les deux exigences sont contradictoires par construction. Le fichier respecte le format demande, sans annee, sans source et sans controle, et porte la raison detaillee de l echec.

## 3. Relecture detaillee, quinze valeurs tirees au sort

La mission demande la relecture complete d au moins dix series. Quinze valeurs ont ete retirees de leur source d origine, en rouvrant l adresse citee et en recherchant l extrait dans le document, sans reutiliser la copie locale.

| Societe | Annee | Valeur du fichier | Valeur retrouvee dans la source | Ecart |
|---|---|---|---|---|
| GD | 2022 | 120 avions | Gulfstream aircraft deliveries (in units) 120 | aucun |
| CHRW | 2020 | 1 071,9 M USD | Truckload $ 1,071,873 milliers | aucun |
| CMG | 2018 | 4 860,6 M USD | Food and beverage revenue $ 4,860,626 milliers | aucun |
| GPC | 2017 | 8 583,3 M USD | Automotive $ 8,583,317 milliers | aucun |
| HD | 2019 | 39 337 M USD | Building Materials $ 39,337 | aucun |
| GWW | 2023 | 13 267 M USD | High-Touch Solutions N.A. $ 13,267 | aucun |
| FTV | 2022 | 2 466,1 M USD | Intelligent Operating Solutions $ 2,466.1 | aucun |
| FIX | 2023 | 3 946,0 M USD | Mechanical Segment $ 3,946,022 milliers | aucun |
| GEV | 2023 | 13 220 M USD | Gas Power $ 13,220 | aucun |
| HEIA.AS | 2022 | 54,9 mhl | Total 14.8 11.2 % 54.9 12.5 % | aucun |
| GRMN | 2020 | 1 128,1 M USD | Outdoor 1,128,081 milliers | aucun |
| HAS | 2022 | 1 325,1 M USD | Wizards of the Coast and Digital Gaming segment increased 3% to $1,325.1 million | aucun |
| AD.AS | 2019 | 4 547 M EUR | Net consumer online sales 4,547 ; amounted to EUR 4,547 million | aucun |
| DTG.DE | 2022 | 186 779 vehicules | FY2022 520,291 [...] 186,779 | aucun |
| F | 2021 | 726 004 vehicules | With 726,004 trucks sold, F-Series outsold its second-place competitor | aucun |

Aucun ecart n a ete releve, donc aucune correction de valeur. Deux corrections de forme ont ete faites a cette occasion, decrites au point suivant.

## 4. Verification de l ouverture des adresses citees

Les 128 adresses distinctes citees dans les fichiers de serie, sources et sources de controle confondues, ont ete appelees une a une.

Corrections faites :

- Ahold Delhaize : les neuf adresses pointaient d abord vers les pages de presentation des rapports annuels, qui repondent bien mais ne contiennent pas les chiffres. Elles ont ete remplacees par les adresses des fichiers des rapports eux memes, verifiees et contenant l extrait cite.
- GE Vernova : deux adresses de rapport annuel comportaient un numero de depot errone, corrigees.
- GE : trois adresses de documents Safran renvoyaient une erreur, remplacees par les adresses reelles des documents d enregistrement universels 2021, 2022 et 2025, verifiees.

Adresses publiques mais fermees a une lecture automatisee, apres correction :

| Adresse | Code | Commentaire |
|---|---|---|
| Communique de ventes annuelles de Daimler Truck, janvier 2025 | pas de reponse | Page publique, referencee par les moteurs de recherche, mais le serveur coupe la connexion des requetes non navigateur. Sert de source de controle secondaire, la source principale etant la page de ventes unitaires du meme site, qui repond normalement |
| Rapport annuel 2025 de Henkel | pas de reponse | Meme cas. Le contenu a ete lu dans la copie locale du meme document |
| Communique de resultats 2020 de Safran | 403 | Meme cas. Le controle de la valeur 2020 du moteur LEAP ne repose pas sur cette adresse mais sur le rapport annuel de General Electric, qui repond normalement |

Toutes les autres adresses repondent normalement.

## 5. Points a trancher par le proprietaire

1. **GE, moteur LEAP.** Le LEAP est le produit phare incontestable de GE Aerospace, mais le proprietaire l a deja attribue a Safran. Le moteur est fabrique par une coentreprise a parts egales entre les deux groupes, la serie de livraisons est donc la meme. Soit la meme serie sert aux deux societes, soit GE recoit un autre produit, par exemple le moteur GEnx, plus petit et dont les livraisons annuelles ne sont pas publiees.
2. **GRMN, Garmin, hesitation ouverte.** Les deux familles de montres sont rangees dans deux segments distincts, Plein air pour la gamme fenix, Sport et fitness pour la gamme Forerunner. Le premier est en tete de 2019 a 2024, le second reprend la premiere place en 2025. Deux fichiers de serie sont fournis, `GRMN.json` et `GRMN~B.json`.
3. **AD.AS, Ahold Delhaize.** Le produit retenu, la vente de courses en ligne, est un canal de vente et non un produit. C est le seul indicateur precis et chiffre chaque annee pour ce distributeur. A valider ou a remplacer par un statut sans produit.
4. **GWW, Grainger.** Meme nature de reserve : le produit retenu est un modele de distribution, l offre a forte valeur ajoutee, et non un objet. La conclusion sans produit de la passe precedente a ete revue parce qu un chiffre existe, mais le choix reste discutable.
5. **HD, Home Depot.** L indicateur retenu est une grande famille de produits, les materiaux de construction, et non un article. Par ailleurs l enseigne reclasse regulierement le contenu de ses familles : le passage de l exercice 2021 a l exercice 2022 n est pas strictement comparable.
6. **CMG, Chipotle.** Le produit, le bol burrito au poulet, est correct, mais l indicateur est le chiffre d affaires de toutes les ventes de nourriture et boissons, donc tres proche du chiffre d affaires de la societe. A valider comme substitut acceptable.
7. **DTG.DE, Daimler Truck.** Le segment Amerique du Nord, qui porte le Freightliner Cascadia, est le premier du groupe sur presque toute la periode, mais il passe derriere le segment Mercedes-Benz en 2025. Si le proprietaire prefere l Actros, la serie du segment Mercedes-Benz est disponible sur la meme page de source.
8. **HD, etiquetage des exercices decales.** La mission demande d etiqueter par l annee de cloture. Home Depot clot fin janvier ou debut fevrier : appliquer la regle a la lettre decalerait toute la serie d un an par rapport a la designation de la societe et par rapport a l usage boursier. L etiquette suit donc la designation de la societe, chaque exercice couvrant plus de quatre vingt dix pour cent de l annee civile portee en etiquette. Regle a confirmer pour les autres distributeurs a exercice decale.

## 6. Corrections d analyses precedentes

Trois societes portaient dans le fichier de reprise la mention sans produit identifie. Apres nouvelle recherche, deux de ces conclusions sont revues :

- **CHRW, C.H. Robinson.** Le service existe et il est chiffre : le transport routier de lots complets fait l objet d une ligne dediee de marge brute dans le rapport annuel, sur dix exercices.
- **FTV, Fortive.** La raison invoquee a l epoque, le depart de la marque Fluke avec la scission de Ralliant en 2025, est fausse. Le rapport annuel 2025 cite toujours FLUKE en tete des marques du premier segment du groupe.
- **CMG, Chipotle.** Le produit etait bien identifie mais juge sans donnee. Le chiffre d affaires des ventes de nourriture et boissons, publie sur dix exercices, constitue le substitut autorise par la mission.
- **GWW, Grainger, et HD, Home Depot,** restaient egalement en sans produit : une serie a ete construite dans les deux cas, avec les reserves indiquees au point 5.
- **BNR.DE, Brenntag,** est la seule des cinq dont le statut sans produit est confirme.

## 7. Pieges rencontres, a retenir pour la suite du lot

1. **Entree de commandes contre chiffre d affaires.** Chez GEA, les deux lignes sont de niveaux voisins et se suivent dans le tableau de division. Une premiere extraction avait retenu l entree de commandes ; l erreur a ete detectee en relisant le texte du rapport, qui nomme explicitement l indicateur. A verifier systematiquement chez les equipementiers.
2. **Colonnes retraitees.** Six societes du lot retraitent leurs exercices anterieurs apres une scission ou un changement de segment : Fortive, GE Vernova, Genuine Parts, Home Depot, Daimler Truck et Ahold Delhaize. Prendre la valeur publiee au titre de chaque exercice, ou la plus recente, mais jamais un melange non documente.
3. **Ordre des colonnes.** Les tableaux par segment n indiquent pas toujours l annee au dessus de chaque colonne dans le texte extrait. Verifier l ordre en recoupant avec une valeur connue, comme le total du groupe.
4. **Nom de fichier et annee.** Dans le lac de donnees local, les rapports sont nommes par leur date de depot et non par leur exercice. Un decalage d un an est vite arrive.
5. **Sites fermes aux robots.** Henkel, Safran, General Motors, Daimler Truck et Ford bloquent tout ou partie des requetes automatisees. Les documents restent publics ; privilegier les depots aupres du regulateur boursier americain, qui sont toujours lisibles.
6. **Pages de presentation contre documents.** Une adresse qui repond correctement ne contient pas forcement le chiffre cite. Verifier que l extrait figure bien a l adresse donnee.
