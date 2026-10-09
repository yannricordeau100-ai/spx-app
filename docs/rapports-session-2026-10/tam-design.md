# Bloc « Position marché · TAM » : nouvelle présentation (9 oct 2026)

## Ce qui change
- Une seule carte « Position marché » ; une ligne par segment, triée par revenu du segment décroissant.
- Ordinateur (carte >= 48rem) : tableau à 5 colonnes alignées : Segment | Part captée (chiffre 22 px + barre fine) | Revenu du segment | Taille du marché | Croissance (+x %/an ou « n.d. »). En-têtes de colonnes en haut. Hauteur de ligne constante (87 px mesurés pour 1 à 5 segments).
- Mobile et largeurs moyennes : même structure empilée pour chaque ligne (nom, part + barre, trois chiffres avec unité dessous). Hauteur constante (181 à 198 px selon la fiche, identique entre lignes).
- Nom du segment : partie principale sur 1 ligne (tronquée proprement, nom complet au survol) ; le détail entre parenthèses passe en 2e ligne grise. « Estimation indicative » reste en tête de cette 2e ligne quand elle s'applique.
- « i » par segment : nom complet, méthodologie (filtrée comme avant, aucune source), fourchette, mention d'estimation. Aucune source visible dans le bloc.
- Part captée : unités ramenées à la même échelle (M vs Mds) ; « < 0,1 % » pour les parts infimes.
- Barre : largeur posée dès le rendu serveur, croissance en CSS pur (l'animation motion restait bloquée à 0 tant que la page n'était pas hydratée).

## Fichiers
- src/components/market-position-card.tsx : `MarketPositionCard` remplacé par `MarketPositionList` (noteMethodologie, sansMentionSource, estimationIndicative inchangés).
- src/components/company-view.tsx : le bloc appelle `MarketPositionList`.
- src/app/concepts/fiche-onglets/contenu.tsx (onglet Marché) et src/components/sandbox/tam-atelier.tsx (aperçu) : même composant.
- src/lib/desk/tam-apercu.ts : `enMilliards` exporté ; `grilleTam` et `derniereLarge` supprimés (plus utilisés).
- tsc : 0 erreur.

## Vérification locale (localhost:3000)
- 1 TAM : qrvo (réel). 2 TAM : googl (réel). 3, 4, 5 TAM : coin, vtrs, rtx avec .tam.json temporaires (segments ajoutés, noms longs, unité M $, croissance négative, sans croissance).
- Largeurs : 1440, 1024, 633, 375 (mobile). Aucun débordement mesuré dans les cellules.
- Fichiers temporaires restaurés (comparaison octet par octet OK) ; 3 entrées du cache disque de dev contenant les données de test supprimées. Le cache mémoire du serveur de dev peut encore servir ces fiches de test jusqu'à 10 min (vers 02 h 44).
- Limites : hors GOOGL, les fiches sont vues en anonyme (textes brouillés, flou retiré pour la capture) ; le contenu du « i » n'a pas pu être ouvert en anonyme (clic = inscription).
- Captures : captures/avant-*.jpg et captures/apres-*.jpg dans ce dossier.

## Non touché
- Cartes « Déclaré par la société » (TAM d'événement) sous le bloc : inchangées.
- Le fichier tam-atelier.tsx a été réécrit par une autre session pendant le travail ; seul l'appel du composant y a été remis.
