# Mission admin : cours de bourse x KPI, comparaison de KPI, bloc « KPI admin sur-mesure » (demande de Yann, 1er oct 2026)

## Perimetre et garde-fous
- TOUT est reserve au mode admin et ne doit exister QUE sur la preversion (niveau 2, mettrik-niveau2.vercel.app). Rien de visible
  sur mettrik.ai (n0). Exception unique : l espacement de la barre de separation des exports (point 8) qui va PARTOUT au prochain go n0.
- Ne pas interferer avec le travail en cours sur les donnees des fiches (corrections, controles, dettes) : ne modifier aucun fichier de
  donnees de societe (src/data/v2-pipeline*, .batches-drafts-safe, kpi-annuel-fiche...), aucun commit de fichiers qui ne sont pas les tiens.
- Exigence : fonctionnalite irreprochable avant le design pur (l admin est un brouillon), mais design sobre et propre.
- Jamais de valeur inventee. Donnees les plus recentes possibles, source citee.

## 1. Cours de bourse via l API FMP gratuite (cle FMP_API_KEY de .env.local)
- Tester l API GRATUITE sur toutes les societes de l univers (src/data/v1-9-5-clean-all-tickers.json) et dire precisement lesquelles
  sont couvertes, d apres les REPONSES DE L API (pas d apres le site FMP, juge incorrect). Commencer par un test sur un echantillon
  varie (US, Europe : .PA .DE .AS .SW, ADR), puis tout l univers. Livrer la liste couverte / non couverte avec le motif (erreur, plan, vide).
- Respecter le quota gratuit (mise en cache locale des series, pas d appel a chaque affichage).

## 2. Graphique KPI + cours
- Superposer le cours de bourse au graphique KPI : axes de temps alignes entre KPI et cours, adaptation a la frequence du KPI
  (trimestriel, semestriel, annuel), cours actuel affiche, cours au survol de la souris.
- Bouton pour afficher ou masquer le cours.
- Pouvoir afficher le « % du cours par rapport au plus haut historique (ATH) » et le « % depuis le debut de l annee (YTD) ».
- Etudier le design des services concurrents (docs/concurrents.md, 224 services) et retenir le meilleur design, sans extravagance.
- Integration dans le bloc existant si l ergonomie reste maximale, sinon dans un bloc separe (admin).

## 3. Comparer deux KPI sur le meme graphique (deux series, echelles adaptees).

## 4. Exports (PNG)
- 100 % des nouveautes ont leur export travaille independamment, avec les memes codes que les exports actuels (src/lib/chart-export.ts).
- Multi societes (2 et plus) : reduire la distance entre le logo et le nom de la societe ; si les noms ne tiennent pas en largeur,
  afficher le ticker a la place et, en dessous, entre parentheses et en petit, le nom (assez petit pour ne pas depasser la largeur
  logo + ticker).
- Le nom du KPI partage, en dessous : aucun espace anormal a gauche, a droite, en haut, en bas.
- Garder la signature en bas. Tous les documents telechargeables doivent pouvoir porter un pseudo (mecanisme existant
  pseudo-graph-cookie / user-prefs).

## 5. Nouveau bloc « KPI admin sur-mesure » (onglet ou bascule)
- Respecter consignes, design et ergonomie du bloc KPI moyen terme actuel, mais graphiques differents.
- Premier graphique : les 5 actions du CAC 40 au rendement du dividende le plus eleve, avec leur taux de distribution (payout),
  en barres associees (5 groupes de 2 barres). Idem pour le S&P 500, et pour les actions eligibles au PEA. Donnees les plus recentes.

## 6. Verification visuelle obligatoire
- Pour litteralement tout ce qui est cree : telecharger physiquement les configurations extremes (ticker long, titre long, barres,
  courbe, 1 et 2+ societes, valeurs extremes, clair/sombre...), analyser chaque image soi-meme ET la faire relire par un autre modele
  (image jointe) pour trouver lignes trop ou pas assez espacees, debordements, etc. Corriger puis recommencer.

## 7. Interpretation
- Au moindre doute : faire relire par un autre modele avant de coder.

## 8. Partout (n0 au prochain go) : barre de separation des exports
- La barre de separation doit avoir le meme espace a sa gauche (cote pseudo) et a sa droite (cote signature Mettrik).

## Precisions apres relecture (1er oct)
- « calculer » = calcul des % ATH / YTD et du cours au survol. % vs ATH et % YTD : series affichables (bascule ATH / YTD) avec la valeur
  actuelle. Si l historique FMP gratuit est limite, l ATH est libelle « plus haut sur la periode disponible ».
- Comparaison de 2 KPI : deux KPI de la MEME societe, double axe si unites differentes.
- La regle multi societes (logo plus proche du nom ; ticker + nom en petit entre parentheses si trop long) s applique aussi aux exports
  multi societes existants, MAIS seulement en mode admin (drapeau admin dans chart-export.ts) : l export public de n0 ne change pas.
- « modeles 10/10 » : ne pas se fier a des marges par defaut ; mesurer les marges du nom de KPI partage sur l image reelle.
- Relecture visuelle : chaque PNG relu par un second modele (agent de controle avec l image jointe), le « mode chat » de claude.ai
  n etant pas pilotable depuis ici.
- PEA : societes de l univers domiciliees dans l UE/EEE (France, Allemagne, Pays-Bas...), Suisse exclue. Source rendement et payout :
  FMP gratuit si disponible, sinon yfinance ; date de la donnee affichee.
- Uniquement les societes couvertes par l API : pour les autres, libelle de non-couverture, pas de bloc vide.
- Point 8 deja code le 20 sept (chart-export.ts, trois espaces de chaque cote) : verifier sur PNG reel que l ecart est visuellement egal,
  corriger seulement si besoin. C est le seul changement autorise a partir sur n0.
- Rien de cette mission ne doit partir sur n0 (sauf point 8) : garde admin stricte (routes /sandbox ou drapeau admin verifie cote serveur).
