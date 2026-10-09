# Fiche à onglets : rail-survol-v2, version 3 (modifiée sur place)

Page : `/concepts/fiche-onglets/rail-survol-v2` (même URL). Rien n'a été commité ni déployé.

## Fichiers touchés
- `src/app/concepts/fiche-onglets/v2-client.tsx` : rail, page unique, navigation au défilement, Sources. Sauvegarde de la version d'avant : `scratchpad/v2-client.tsx.avant-v3`.
- `src/app/concepts/fiche-onglets/contenu.tsx` : 3 grilles (`gouv`, `these`, `admin`) passent de `grid gap-4` à `grid grid-cols-1 gap-4`. Sans cette correction, le bloc Gouvernance débordait à 510 px sur un écran de 375 px, ce qui décalait toute la page mobile. Ce fichier est partagé avec les autres styles d'onglets. La correction ne change que la largeur maximale, rien d'autre.

## Les 6 demandes
1. **Une seule page.** L'icône et le mode « Intégral » sont supprimés. Tous les blocs sont affichés les uns sous les autres, chacun avec son intertitre (sauf l'Aperçu, juste sous l'en-tête). Un clic dans le rail (ou dans la barre et le tiroir sur mobile) fait défiler jusqu'au bloc, juste sous l'en-tête collant. Au défilement, le bloc dont le haut passe la ligne de l'en-tête est mis en évidence (trait de couleur et icône active). En bas de page, c'est le dernier bloc visible qui est mis en évidence. Si du contenu se charge pendant le trajet, la position est recalée une fois à l'arrivée.
   - **Rangs :** ils restent dans l'Aperçu, premier bloc de la page. L'en-tête collant ne les affiche jamais, donc ils n'apparaissent qu'une seule fois.
   - **En-tête :** à 1440 px, l'en-tête complet (103 px) reste collé. Sur mobile, la ligne compacte de 60 px prend le relais. Les défilements tiennent compte de la hauteur réellement affichée et du zoom du site.
   - Mesures : le haut du bloc arrive à 130 px (en-tête de 113 px avec le zoom, plus 16 px) sur ordinateur, et à 82 px sur mobile.
2. **Sources.** Le mini onglet « Sources utilisées » est remis en bas de page, sous Thèse et anti-thèse, avec le composant `SourcesExternes` de la fiche actuelle. Il n'a pas d'icône dans le rail. Comme sur la vraie fiche, il ne s'affiche pas s'il n'y a aucune source : c'est le cas pour LVMH.
3. **Logo complet.** Il est plus grand (taille lg, agrandi d'environ 1,75 fois) et centré dans le rail ouvert. L'en-tête du rail passe de 54 à 64 px.
4. **Largeur.** Le rail passe de 92 à 104 px fermé et de 288 à 400 px ouvert. Les titres et les phrases ne sont plus coupés (« Graphique du KPI principal et liste des indicateurs » s'affiche en entier).
5. **Icônes centrées.** Les blocs et les outils forment un seul groupe, centré verticalement dans la hauteur qui reste sous Rechercher. Si l'écran est trop bas, le groupe défile.
6. **Rechercher.** L'icône est en haut, sous le logo, séparée par un trait. Favoris, Comparer, Mon compte et Jour/Nuit restent en bas du groupe.

Le reste n'a pas changé : effets au survol, barre et tiroir mobiles, en-tête compact, panneaux Favoris et Comparer.
- Retiré : animation « déroule » (Intégral), fondu entre onglets.
- Ajouté : `overflow-x-clip` sur la page. Les flèches du carrousel KPI court terme débordaient de 37 px à droite sur LVMH en 1440 px, ce qui faisait apparaître un défilement horizontal.

## Vérifications
- `npx tsc --noEmit` passe sans erreur. Une erreur passagère dans `src/app/sandbox/consignes-societes`, qui vient d'une autre session, a disparu d'elle-même.
- Tests avec Playwright (1440x900 et mobile 375x812) et avec le panneau navigateur (ordinateur et mobile, taille ordinateur rétablie à la fin) :
  - clic sur Risques, IA puis Aperçu ;
  - mise en évidence au défilement ;
  - Sources en bas de page ;
  - mobile : clic sur Risques dans la barre ;
  - LVMH sur ordinateur et sur mobile (clic sur Gouvernance).
- Largeur de page : 1440 sur ordinateur et 375 sur mobile, donc plus aucun défilement horizontal.
- Le serveur de dev du port 3000 n'a pas été arrêté.

## Captures
Dossier : `scratchpad/captures-onglets-v3/`. Les captures `avant-*` montrent l'état d'avant, les captures `apres-*` le nouveau.

| Numéro | Ce qu'il montre |
|---|---|
| 01 | Rail fermé |
| 02 | Rail ouvert |
| 03 | Défilement |
| 04 | Bas de page avec Sources |
| 05 et 05b | Clic sur Risques, puis sur IA |
| 06, 07, 08 | Mobile : haut de page, défilement, bas de page avec Sources |
| 09 | Mobile, clic sur Risques |
| 10 | LVMH |

## Points d'attention
- Sur ordinateur, le badge de développement Next (« N ») recouvre en partie « Mon compte », en bas à gauche du rail. Ce badge n'existe qu'en local.
- Le panneau navigateur était ouvert sur `/fdxf`. Il a été redirigé vers la page du concept.
