# Controle du lot 6

Perimetre : entrees 27 a 52 de `.conv-state/phare-reste-2.json`, soit 26 tickers, moins RMS.PA, SAF.PA et SPCX dont le produit phare etait deja pose. 23 societes traitees, aucune n avait de fichier P2 prealable.

## 1. Tableau de synthese

| Phase | Nombre |
|---|---|
| Societes traitees en phase 1 | 23 |
| Societes traitees en phase 2 | 23 |
| Societes validees sans reserve | 19 |
| Exceptions | 4 (ROK, ROST, SGO.PA, RXL.PA) |
| Fichiers P2 ecrits | 26 (dont 3 fichiers de candidat B) |
| Series abouties (statut ok) | 22 |
| Series en echec | 4 (ROK~B, RXL.PA, SGO.PA, SGO.PA~B) |
| Series de 10 points | 16 |
| Series courtes, de 5 a 9 points | 6 (ROK 7, TSCO 7, TSLA 8, VLTO 5, VRT 7, WKL.AS 9) |

## 2. Detail par societe

| Ticker | Produit | Points | Statut |
|---|---|---|---|
| ROK | Materiels d automatisation Allen-Bradley, segment Intelligent Devices | 7 | ok |
| ROK~B | Automates Logix | 0 | echec |
| ROST | Decoration de la maison, linge de lit et de bain | 10 | ok |
| ROST~B | Vetements pour femmes | 10 | ok |
| RTX | Moteurs Pratt & Whitney, GTF et F135 | 10 | ok |
| RXL.PA | aucun produit identifiable | 0 | echec |
| SGO.PA | Plaques de platre Placo, Gyproc, CertainTeed | 0 | echec |
| SGO.PA~B | Vitrage plat et automobile, Sekurit | 0 | echec |
| SJM | Cafe Folgers, Cafe Bustelo, Dunkin | 10 | ok |
| STZ | Bieres mexicaines Modelo Especial et Corona | 10 | ok |
| SYY | Viandes fraiches et surgelees | 10 | ok |
| TJX | Vetements et chaussures a prix reduit | 10 | ok |
| TSCO | Aliments et fournitures pour animaux | 7 | ok |
| TSLA | Model 3 et Model Y | 8 | ok |
| TT | Climatisation Trane et refrigeration Thermo King | 10 | ok |
| TXT | Avions d affaires Cessna Citation | 10 | ok |
| UAL | Transport aerien de passagers | 10 | ok |
| ULTA | Produits de maquillage | 10 | ok |
| URI | Flotte de location d equipements | 10 | ok |
| VLTO | Analyse de la qualite de l eau, marque Hach | 5 | ok |
| VRT | Alimentation et refroidissement de centres de donnees | 7 | ok |
| WAB | Locomotives de fret, segment Fret | 10 | ok |
| WKL.AS | UpToDate et solutions cliniques | 9 | ok |
| WM | Enfouissement de dechets solides | 10 | ok |
| WSM | Mobilier et decoration Pottery Barn | 10 | ok |
| WYNN | Jeux de casino | 10 | ok |

## 3. Relecture d un echantillon tire au sort

Vingt valeurs ont ete relues directement contre leur source en ligne, soit environ 9 pour cent des 219 points de la totalite des series, et davantage que le minimum de dix relectures demande. Chaque relecture a consiste a retelecharger le document cite et a y retrouver le nombre exact.

| Ticker | Annee | Valeur | Resultat |
|---|---|---|---|
| STZ | 2019 | 294,1 millions de caisses | concorde |
| WM | 2019 | 120 556 milliers de tonnes | concorde |
| URI | 2018 | 14,18 milliards de dollars | concorde |
| UAL | 2021 | 104 082 milliers de passagers | concorde |
| TT | 2023 | 17 677,6 millions de dollars | concorde |
| SJM | 2023 | 2 735,3 millions de dollars | concorde |
| WYNN | 2020 | 1 237,2 millions de dollars | concorde |
| RTX | 2017 | 16 160 millions de dollars | concorde |
| WSM | 2019 | 2 214,4 millions de dollars | concorde |
| ULTA | 2020 | 44 pour cent | concorde |
| TJX | 2022 | 48 pour cent | concorde |
| SYY | 2019 | 19 pour cent | concorde |
| ROST | 2020 | 28 pour cent | concorde |
| VRT | 2023 | 6 863,2 millions de dollars | concorde |
| VLTO | 2024 | 3 138 millions de dollars | concorde |
| WAB | 2016 | 1 543,1 millions de dollars | concorde |
| TSLA | 2020 | 442 562 vehicules | concorde |
| ROK | 2023 | 4 098,2 millions de dollars | concorde |
| TXT | 2021 | 167 avions | concorde apres changement de source, voir ci dessous |
| WKL.AS | 2020 | 1 193 millions d euros | concorde apres changement de source, voir ci dessous |

Deux ecarts ont ete trouves et corriges, aucun ne portait sur une valeur :

- TXT 2021 : le fichier du rapport annuel 2021 de Textron n est plus servi par le site de la SEC, il renvoie une reponse vide. La source a ete remplacee par le rapport annuel 2022, qui rappelle les 167 avions livres en 2021. Valeur inchangee.
- WKL.AS : les pages de communique de Wolters Kluwer diffusees par GlobeNewswire ne contiennent pas le tableau par division, qui se trouve dans le rapport complet joint au format PDF. Les dix sources ont ete remplacees par les cinq rapports complets en PDF, qui contiennent bien le tableau. L exercice 2016 a du etre retire de la serie, aucune source ouverte encore accessible ne portant le tableau par division de cette annee ; la serie passe de dix a neuf points, de 2017 a 2025.

## 4. Passage du validateur

`python3 valide.py` a ete lance sur les 26 fichiers P2. Les 22 fichiers de statut ok repondent tous OK. Les 4 fichiers de statut echec sont signales comme depourvus de points et de controle, ce qui est attendu et conforme au format des echecs deja livres dans les lots precedents.

## 5. Verification des liens

Les 161 adresses distinctes citees dans les fichiers P2 du lot ont ete appelees une a une. Une seule renvoyait autre chose qu un code 200, l annexe du rapport trimestriel de Tesla, dont le nom de fichier reel est `tsla-ex99_1.htm` et non `ex99_1.htm` : l adresse a ete corrigee et verifiee a 200. Les cinq adresses PDF introduites pour Wolters Kluwer ont ete verifiees a 200 apres correction. Le fichier du rapport annuel 2021 de Textron repond 200 mais renvoie un contenu vide, motif du changement de source decrit plus haut.

## 6. Societes ou le choix du produit reste a trancher par le proprietaire

- **ROK, Rockwell Automation.** Le produit le plus emblematique, l automate Logix, n est pas celui qui pese le plus dans les ventes, et la societe ne publie aucun chiffre propre a cette famille. Le fichier livre porte sur le segment qui regroupe les materiels Allen-Bradley. A trancher : garder ce segment, ou renoncer au produit faute de donnee propre.
- **ROST, Ross Stores.** Deux familles se disputent la premiere place, les vetements pour femmes jusqu en 2019, la decoration de la maison depuis 2020. Deux series completes sont livrees, une par candidat.
- **SGO.PA, Saint-Gobain.** Les deux candidats, plaques de platre et vitrage, sont de poids comparable et aucun ne peut etre chiffre depuis la reorganisation de 2021, qui ne laisse qu une ventilation par region. Aucune serie n est possible en l etat.
- **RXL.PA, Rexel.** Distributeur pur sans produit identifiable, statut confirme apres nouvelle recherche.
- **SYY, Sysco et TJX, The TJX Companies.** Ces deux societes sont des distributeurs purs. Faute de produit propre, l indicateur livre est la part de la premiere categorie de produits dans le chiffre d affaires, un pis aller assume. Le proprietaire peut preferer les classer sans produit, comme Rexel.
- **TSCO, Tractor Supply et ULTA, Ulta Beauty.** Meme logique : l indicateur est une part de categorie dans le chiffre d affaires et non un produit de la societe. La serie de Tractor Supply s arrete en outre a 2022, la societe ayant change son decoupage de categories en 2023.
- **URI, United Rentals.** L indicateur retenu, le cout d origine de la flotte, est un montant a la cloture et non un flux de ventes : c est la mesure de reference du secteur de la location mais elle n a pas la meme nature que les autres series.
- **WAB, Wabtec.** La serie du segment Fret est continue mais son perimetre triple en 2019 avec l apport de GE Transportation, ce qui rend la lecture avant et apres 2019 difficile.
