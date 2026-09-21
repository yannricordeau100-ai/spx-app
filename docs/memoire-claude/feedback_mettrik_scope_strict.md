---
name: Mettrik — RÈGLE IMMUABLE de scope strict
description: Ne réaliser QUE et UNIQUEMENT les modifications demandées dans le prompt user. Aucun ajout, retrait, refactor "pendant que j'y suis" non demandé.
type: feedback
originSessionId: 5d45ff1c-8ba0-49d7-b130-a1909a2357ee
---
**RÈGLE IMMUABLE** établie le 5 mai 2026 après que Yann ait constaté plusieurs régressions causées par des modifs non demandées (style néon ajouté quand seulement le logo l'était, year-band quand seulement la suppression de répétition l'était, variation chart cleanup en chaîne, etc.).

## Règle

Ne JAMAIS faire de modification que Yann n'a pas explicitement demandée dans le prompt courant. Y compris :
- Pas de "pendant que j'y suis je rajoute aussi…"
- Pas de "ce serait cohérent d'aussi changer…"
- Pas de refactor "tant qu'on est dedans…"
- Pas d'ajout d'éléments visuels (icônes, badges, watermarks, etc.) non demandés
- Pas de changement de valeurs / paramètres / styles non explicitement listés

## Exceptions tolérées

- **Bug fix bloquant** : si une modif explicite casse autre chose (TS error, runtime crash), corriger le minimum nécessaire pour que le code compile / tourne. Mentionner explicitement le fix dans la réponse.
- **Cohérence stricte i18n** : si Yann demande d'ajouter une string, ajouter aussi la clé EN du dictionnaire (sinon la clé crashe).
- **Mémo persistant / SHARED-STATUS** : autorisé si pertinent à la coordination.

## Procédure avant chaque modif

1. Lire le prompt user.
2. Lister mentalement chaque demande explicite (souvent numérotée 1) 2) 3)).
3. N'agir QUE sur ces points.
4. À la fin, relire le diff git et VÉRIFIER que chaque ligne modifiée correspond à un point du prompt. Sinon → reverter cette ligne.

## Symptômes du dysfonctionnement

- Yann dit "je t'ai demandé de changer X mais tu as aussi changé Y" → STOP, reverter Y.
- Yann dit "j'ai perdu la fonctionnalité Z" → vérifier si Z a été touché par une modif "pendant que j'y suis".
- Le commit comporte des modifs hors-scope du prompt → sortir du commit, garder uniquement les modifs demandées.

## Exemple concret (5 mai 2026)

Yann a demandé : "ajoute un bouton download sur le graph", j'ai aussi ajouté un watermark, agrandi les valeurs, refactor les labels d'axe X, etc. Résultat : le hub V1.7 a planté, les labels trimestriels ont disparu, Yann a dû repasser plusieurs prompts pour revenir au point initial.

**Faire moins ET plus juste, pas plus ET approximatif.**
