# Spec RECALIBRAGE des notes de risques — Yann 12 juil 2026

## Problème constaté par Yann
Trop de risques affichés 3-5/5 alors que le 10-K de la sté les présente comme
mineurs (mériteraient 1-2/5). Le score affiché doit refléter EXACTEMENT la
façon dont la sté elle-même présente le risque. Zéro invention, zéro décalage.

## Règle de notation STRICTE (à appliquer risque par risque)
Chaque note doit être JUSTIFIABLE par citation du 10-K :

- **5/5 (Critique)** : risque dans le premier tiers de l'Item 1A, langage
  maximal ("would materially harm", "would have a material adverse effect",
  "substantial portion of our revenue depends"), et exposition chiffrée
  majeure (ex >30% du CA dépendant d'un client/pays/produit). Rare : 0 à 2
  par sté typiquement.
- **4/5 (Élevé)** : haut de l'Item 1A OU langage fort ("could materially
  adversely affect") avec exposition concrète significative.
- **3/5 (Modéré)** : milieu de l'Item 1A, langage conditionnel standard
  ("may adversely affect", "could harm"), pas d'exposition chiffrée alarmante.
- **2/5 (Faible)** : bas de l'Item 1A, langage prudentiel générique
  ("cannot assure", "may be subject to"), risque boilerplate commun à toute
  l'industrie sans spécificité pour la sté.
- **1/5 (Marginal)** : mention brève de fin de liste, purement générique
  (ex "our stock price may fluctuate", "future sales of shares may depress
  the price"), aucun développement.

## Points d'attention (les sur-notations typiques à corriger)
- Risques BOILERPLATE (litiges génériques, fluctuations de change sans
  exposition matérielle, "attract and retain talent", stock price volatility,
  catastrophes naturelles génériques) : rarement plus de 1-2/5 sauf si la sté
  les développe longuement avec chiffres.
- Ne PAS sur-noter par prudence : la note reflète la présentation de la sté,
  pas la gravité théorique du sujet.
- Ne PAS sous-noter non plus un risque que la sté chiffre et répète (ex
  concentration client 40% du CA = 5/5 légitime).

## Procédure par sté
1. Lire `data-lake/<T>/_risks_src_30k.txt` (Item 1A réel).
2. Pour CHAQUE risque de `src/data/v2-pipeline-enrich/<t>.json` champ risks :
   a. Retrouver le passage correspondant dans la source.
   b. Vérifier : le risque existe-t-il vraiment dans le 10-K ? (sinon le
      SUPPRIMER : invention interdite).
   c. Recalibrer score ET severity (les DEUX champs, même valeur) selon la
      règle ci-dessus. Réviser à la baisse sans hésiter.
   d. Réécrire score_rationale : DOIT contenir une courte citation anglaise
      exacte du 10-K entre guillemets (≤15 mots) + position dans l'Item 1A +
      pourquoi cette note.
3. Distribution finale attendue par sté : réaliste et étagée. Une sté
   typique : 0-2 risques ≥4, une majorité 2-3, possibles 1. Une distribution
   "tout à 4-5" est presque toujours fausse.
4. `_risks_recalibrated_at` = ISO now dans le fichier.
5. Validation : JSON valide, aucun em-dash, chaque score_rationale contient
   une citation entre guillemets.

## FALLBACK source (ajout 12 juil, constaté lot 1)
Certains `_risks_src_30k.txt` ne contiennent PAS l'Item 1A (Business/MD&A à la
place). Dans ce cas : extraire l'Item 1A directement du 10-K le plus récent de
`data-lake/<T>/10K/*.htm.gz` (gunzip, strip HTML, section entre "Item 1A" et
"Item 1B" ; si géant, tronquer à ~40k chars). Si aucun 10-K local : SEC EDGAR
(UA "Mettrik research", throttle 0.5s). Ne JAMAIS abandonner une sté sans avoir
tenté ce fallback ; ne jamais recalibrer sans source.
