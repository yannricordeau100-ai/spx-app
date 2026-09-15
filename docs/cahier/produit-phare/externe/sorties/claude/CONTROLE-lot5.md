# Rapport de controle, lot 5 (26 societes)

Controle realise le 13 septembre 2026 sur les 26 societes du lot, apres ecriture de tous les fichiers.

## 1. Tableau de synthese

| Element | Nombre |
|---|---|
| Societes traitees en phase 1 | 26 |
| Societes traitees en phase 2 | 26 |
| Societes traitees en phase 3 | 26 |
| Series produites, statut ok | 16 |
| Echecs, statut echec | 10 |
| Exceptions, dont hesitation | 12, dont 6 hesitations et 6 sans produit |
| Series de 10 points | 9 |
| Series courtes, de 5 a 8 points | 7 |

Detail exact : 10 points pour MDLZ, LII, NDSN, MKC, MELI, MC.PA, MBG.DE, RHM.DE et MMM (9 societes), 8 points pour ML.PA, 7 pour LULU, 6 pour LHX, REN.AS et RKLB, 5 pour KVUE et NESN.SW.

## 2. Passage du validateur

Le script de validation a ete passe sur les 26 fichiers de serie. Les 16 fichiers au statut ok repondent tous OK. Les 10 fichiers au statut echec sont signales par le validateur comme ayant zero point et aucun controle : c est attendu, le validateur ne sait pas distinguer un echec declare d un fichier incomplet. Aucun de ces 10 fichiers ne pretend a une serie.

## 3. Relecture d un echantillon

Dix valeurs ont ete tirees dans dix series differentes et relues directement dans leur source, sans reutiliser le travail d extraction initial.

| Ticker | Annee | Valeur du fichier | Relecture dans la source | Ecart |
|---|---|---|---|---|
| MDLZ | 2019 | 11 438 | 11 438 | Aucun |
| LII | 2018 | 2 225,0 | 2 225,0 | Aucun |
| MKC | 2019 | 3 269,8 | 3 269,8 | Aucun |
| LULU | 2022 | 5 259 803 | 5 259 803 | Aucun |
| MELI | 2018 | 334,7 | 334,7 | Aucun |
| MMM | 2018 | 4 796 | 4 796 | Aucun |
| NDSN | 2020 | 1 143 423 | 1 143 423 | Aucun |
| RKLB | 2022 | 9 | neuf vehicules en 2022 | Aucun |
| KVUE | 2022 | 6 030 | 6 030 | Aucun |
| LHX | 2022 | 4 217 | 4 217 | Aucun |

Aucun ecart, aucune correction n a ete necessaire.

## 4. Controle croise dans une seconde source

Chaque fichier au statut ok porte deux controles, chacun renvoyant a un document distinct de la source d origine. Un seul controle est declare non concordant : l exercice 2021 de MMM, publie a 5 856 millions de dollars dans le rapport de l exercice 2021 puis a 5 509 millions dans celui de l exercice 2023 apres reexpression du segment. L ecart est signale dans la note du fichier et non corrige, les deux valeurs etant authentiques a leur date de publication.

Trois autres reexpressions sont signalees dans les notes sans etre traitees comme des ecarts de controle, la valeur retenue etant celle de l annee de publication : MDLZ 2020, MKC 2017 et 2018, ML.PA 2023, RHM.DE 2022.

## 5. Verification de l ouverture des adresses

Les 106 adresses distinctes citees dans les fichiers de serie ont ete appelees. 105 repondent avec un code 200. Une seule renvoie un code 403 :

- https://www.nestle.com/sites/default/files/2025-02/full-year-results-press-release-2024-en.pdf

Il s agit du communique de resultats annuels 2024 du groupe alimentaire suisse. Le document existe et s ouvre dans un navigateur, mais le site refuse les appels automatises. L adresse a ete conservee parce que c est le document officiel ; le controle de la valeur 2024 passe par le communique de resultats 2025, qui lui repond normalement.

## 6. Societes ou le produit choisi merite un arbitrage du proprietaire

1. NESN.SW. Nespresso a ete retenu parce que c est le seul des deux cafes du groupe a etre chiffre chaque annee comme segment declare. Nescafe est plus gros en volume et plus connu, mais ses ventes ne sont jamais publiees separement. Le choix est dicte par la donnee, pas par le produit.
2. REN.AS. Les revues Elsevier sont le produit historique et le plus reconnaissable, mais le segment Risque est devenu le premier contributeur au chiffre d affaires du groupe. Notoriete contre poids dans les ventes.
3. RHM.DE. L obus de 155 millimetres est devenu le produit le plus identifie au groupe, mais la division Vehicules, qui porte le Boxer et le Lynx, etait la premiere du groupe jusqu en 2023.
4. MMM. Post-it et Scotch sont a egalite et partagent le meme indicateur chiffre. Le proprietaire doit choisir le nom affiche.
5. MCD. Big Mac contre frites, sans donnee pour departager ni pour construire une serie.
6. OR.PA. Soin de la peau contre coloration, sans donnee publiee pour l un ni pour l autre.
7. LHX. Le segment retenu porte les radios tactiques mais aussi la vision nocturne et les liaisons de donnees : l indicateur est plus large que le produit.
8. MMM et KVUE, plus largement : le segment sert de substitut au produit, ce qui est prevu par la mission en dernier recours mais reste un compromis.

## 7. Points de vigilance sur la comparabilite

Sept des seize series portent la trace d un redecoupage de segments sur la periode : NDSN (2020 et 2024), LHX (2019 et 2023), ML.PA (2019 et 2025), RHM.DE (2021 et 2023), REN.AS (2025), MMM (plusieurs fois), MBG.DE (2020 et 2022). Chaque rupture est decrite dans la note du fichier concerne. Une lecture de la serie comme une evolution continue est trompeuse pour ces societes.
