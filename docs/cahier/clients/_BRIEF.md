# Brief : concentration clients (07 sept 2026)

Mission du proprietaire : pour chaque societe de l univers, trouver le pourcentage du
chiffre d affaires que representent ses plus gros clients, en deux mesures :
 1. le ou les tout premiers clients : ideal 2 clients, accepte 1 a 3 selon ce que les
    sources fiables donnent (indiquer n) ;
 2. les plus gros clients elargis : ideal 10, accepte 6 a 10 selon les sources (indiquer n).

Regles absolues :
- JAMAIS de valeur inventee ni estimee. Chaque pourcentage vient d une source identifiee
  (10-K rubrique concentration de clientele ou segment/credit risk, rapport annuel,
  document d enregistrement universel, presentation investisseurs). La fiabilite prime
  sur le nombre de clients couvert.
- Beaucoup de societes americaines ecrivent « aucun client ne depasse 10 % du chiffre
  d affaires » : c est une donnee utile, l enregistrer comme PLAFOND (pct: 10,
  plafond: true, n: 1) avec la source.
- Base de clients tres diffuse (grande distribution, restauration, marques grand public
  vendant au consommateur final, banques de detail...) : indiquer diffus: true et
  pct "<1" pour le premier client, avec une phrase de justification.
- Si une mesure est introuvable apres recherche serieuse (10-K, rapport annuel,
  web.archive.org, WebSearch du chiffre exact) : null + commentaire.
- Pas de nom de personne, pas de tiret long. Les noms des clients (societes) sont
  autorises et bienvenus dans le commentaire (ex. « Walmart represente 12 % »).

## Format du fichier docs/cahier/clients/<TICKER>.json

{
 "ticker": "AAPL",
 "date": "2026-09-07",
 "top": {
   "n": 2,
   "pct": 12.5,            // nombre, ou "<1", ou null
   "plafond": false,        // true si la source ne donne qu un plafond (« aucun >10 % »)
   "exercice": "2025",
   "clients": ["Nom 1", "Nom 2"],   // si connus, sinon []
   "source": {"url": "...", "titre": "..."},
   "commentaire": "une a trois phrases : ce que dit exactement la source"
 },
 "top10": {
   "n": 10,                 // entre 6 et 10, selon la source
   "pct": 34.0,             // ou null si introuvable
   "plafond": false,
   "exercice": "2025",
   "source": {"url": "...", "titre": "..."},
   "commentaire": "..."
 },
 "diffus": false            // true = base clients tres eclatee, top client <1 %
}

Contraintes de validation (_valide.py) : ticker conforme, top.n entre 1 et 3,
top10.n entre 6 et 10 (ou bloc top10 null si vraiment rien), source presente des
qu un pct est renseigne, pas de tiret long, JSON valide.

## Complement du 9 sept 2026 : objectif 70 % de couverture top 6-10, estimations encadrees

Le proprietaire veut au moins 70 % des societes avec une part top 6-10 (au 9 sept :
72 sur 666). Ordre de recherche, exercices 2025 puis 2024 :
 1. documents officiels (10-K, 20-F, rapport annuel, URD, presentation investisseurs,
    transcript de conference de resultats) ;
 2. sites de donnees et presse specialisee (CSIMarket, Bloomberg, Reuters, Statista,
    Craft, Zippia, GlobalData, rapports sectoriels), posts X (recherche `site:x.com`) ;
 3. en dernier recours, ESTIMATION raisonnee par l agent a partir des faits publies
    (nombre de clients, structure du marche, part du premier client, secteur), avec
    une note de fiabilite honnete : `haute`, `moyenne` ou `faible`. Seules `haute`
    et `moyenne` sont enregistrees ; `faible` reste null avec commentaire.

Format d une estimation dans `top10` : `"estimation": true, "fiabilite": "moyenne",
"methode": "phrase expliquant le raisonnement", "source": {"url": "document de
reference utilise", "titre": "Estimation a partir de ..."}`. La fiche affiche alors
« ≈ x % · estimation ». Une valeur publiee prime toujours sur une estimation.
