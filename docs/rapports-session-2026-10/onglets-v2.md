# Fiche à onglets : rail-survol-v2 (version finale)

Page : `/concepts/fiche-onglets/rail-survol-v2`. Elle figure dans la liste `/concepts/fiche-onglets` avec le badge « Nouveau ». L'ancienne version `rail-survol` est conservée telle quelle.
Rien n'a été commité ni déployé.

## Fichiers
- Nouveaux : `src/app/concepts/fiche-onglets/rail-survol-v2/page.tsx`, `v2-client.tsx` (rail, barre mobile, outils, fiche), `v2-indicateurs.tsx` (bloc graphique et liste des KPI).
- Modifiés : `liste.ts` (ajout du style). Dans `src/components/company-header.tsx`, deux props optionnelles ont été ajoutées : `rangs` (« tous », « aucun » ou « seuls ») et `aideRangs`. Les valeurs par défaut reproduisent le rendu actuel, donc rien ne change ailleurs sur le site.

## Fait (les 7 demandes)
1. **Rail.** 92 px fermé, avec le titre du bloc sous chaque icône (11 px, sur 2 lignes au plus). Au survol, il s'ouvre à 288 px : logo Mettrik complet (`LogoMettrik`, emplacement « retour-societe ») plus une phrase par bloc. Fermé, il affiche le logo simple (`public/brand/mettrik-mark`). « Sources » est supprimé, les nombres aussi, et « Résultats et transcripts » s'appelle désormais « Publications officielles ».
2. **En-tête collant.** La barre du nom (logo, nom, secteur, capitalisation et cours) reste fixe en haut au défilement. Le retour et le sélecteur GOOGL / MC.PA du concept sont descendus en pied de page.
3. **Rangs.** Le point d'interrogation (curseur d'aide et texte au survol) est supprimé. Les rangs ne s'affichent plus que dans le bloc « Aperçu », qui remplace « Vue d'ensemble », et sont masqués dans tous les autres blocs. Vérifié bloc par bloc.
4. **Bloc unique « Indicateurs clés ».** Il réunit le graphique du KPI principal (`ChartCycle` + `buildChartSpec`, modes Barres / Courbe / Variation, Annuel / Trimestriel) et la liste `KpiRow`. Un clic sur une ligne fait passer le KPI dans le graphique, recale la fréquence, remonte au graphique (en tenant compte de l'en-tête collant) et fait briller le cadre. Un bouton plein écran utilise `ChartFullscreen`, et sur mobile, toucher le graphique l'ouvre aussi en plein écran.
5. **Outils sous le trait.** Ils reprennent les fonctions du site :
   - Favoris : `StarButton` « Suivre », Mes sociétés, Mes KPI.
   - Comparer : le vrai `CompareControl`, et `ComparePanel` s'affiche sous l'en-tête après un choix.
   - Mon compte : lien vers `/account`.
   - Jour/Nuit : même clé de stockage, même filtre et même préférence de compte que `ThemeToggle`.
   - Rechercher : la vraie `CompanySearch`.

   « Intégral » est placé sous « Thèse et anti-thèse » et affiche tous les blocs à la suite, chacun avec son intertitre.
6. **Effets de survol, un par icône :**
   - boussole qui tourne
   - barres qui rebondissent
   - pile qui se soulève
   - courbe qui se redessine
   - cible qui pulse
   - triangle qui tremble
   - immeuble qui monte
   - cerveau qui s'illumine
   - page qui se tourne
   - balance qui oscille
   - lignes qui s'étirent
   - étoile qui pivote
   - flèches qui s'échangent
   - silhouette qui salue
   - soleil qui tourne ou lune qui bascule
   - loupe qui s'incline

   Ces effets sont coupés quand le système demande de réduire les animations.
7. **Mobile.** Une barre d'onglets en bas (icône et titre) défile au doigt et recentre l'onglet actif. Le bouton « Menu » ouvre un tiroir qui contient tous les blocs, puis les 5 outils. Les panneaux s'ouvrent en feuille au-dessus de la barre. Les boutons ronds du site (aide, remonter) sont remontés au-dessus de la barre. Le style KPI court terme actuel (`KpiStories`) est inchangé.

## Vérifications
- `npx tsc --noEmit` passe sans erreur.
- Tests faits sur le serveur de dev (port 3000), sur ordinateur (1440x900) et sur mobile (375x812), sur GOOGL et sur LVMH. Le serveur est arrêté et la taille ordinateur est rétablie.
- Accès sans connexion grâce au jeton d'audit local.

## Captures
Dossier : `/private/tmp/claude-501/-Users-yann/f6e0203b-2aed-4432-a0b3-a87ba8db1323/scratchpad/captures-onglets-v2/`

| Fichier | Ce qu'il montre |
|---|---|
| 01 | Aperçu avec les rangs |
| 02 | Rail ouvert au survol |
| 03 | Indicateurs clés, sans les rangs |
| 04 | En-tête collant au défilement |
| 05 | Clic sur un KPI qui ouvre son graphique |
| 06 | Intégral |
| 07 | Favoris |
| 08 | Comparer |
| 09 | Recherche |
| 10 | Mode jour |
| 11 | Plein écran |
| 12 | Mobile, Aperçu |
| 13 | Mobile, tiroir |
| 14 | Mobile, Indicateurs clés |
| 15 | Mobile, clic sur un KPI |
| 16 | Mobile, KPI court terme |
| 17 | Mobile, Comparer |

## Au-dessus du nom de la société
- Rien sur la page du concept.
- La barre du haut de la vraie fiche (logo, recherche, Comparer, favoris, thème, compte) n'est pas reprise. Ses fonctions sont dans le rail.
- Il reste un élément ajouté par le site sous le ticker : la petite pastille « n/16 ». Elle provient de `CompanyHeader` et n'a pas été touchée.

## Problèmes et points d'attention
- **En-tête collant trop haut sur mobile.** Il mesure environ 205 à 225 px sur 812, soit un quart de l'écran, parce que le bloc capitalisation et cours passe sous le nom. Une version compacte au défilement est possible si Yann le souhaite.
- **Graphique sur mobile.** Le choix Annuel / Trimestriel n'apparaît pas sous le graphique, car les contrôles du site le masquent sur mobile. La vraie fiche, elle, passe par le menu Réglages.
- **Comparer.** Testé sur des KPI qui n'ont aucune société comparable (le message s'affiche). Le choix d'une société, qui ouvre `ComparePanel`, n'a pas été testé de bout en bout. Une fois, l'appel à l'API de comparaison a échoué pendant une recompilation du serveur, puis « Réessayer » a fonctionné.
- **Bloc Admin.** Il ne s'affiche que pour une session admin. Il n'a pas été vu, car l'accès s'est fait par le jeton d'audit.
- **Mode jour.** Le logo Google de l'en-tête disparaît, un comportement qui vient du `LogoTile` existant du site et non de ce concept.
- **Erreurs 500 passagères.** `/api/stock-prices` et `/api/company/favorites-state` ont renvoyé des erreurs 500 pendant les recompilations sur MC.PA. Elles répondent 200 ensuite.

## Corrections du coordinateur
- **En-tête au défilement.** Sur mobile, ou sur ordinateur quand l'en-tête dépasse 140 px, l'en-tête complet défile normalement. Dès qu'il sort de l'écran, une ligne fixe de 60 px la remplace : logo, nom, ticker, cours et variation, via la même API `/api/stock-prices`. L'en-tête complet réapparaît en haut de page. À 1440 px, il mesure 103 px et reste donc collé en entier. À 820 px, il mesure 184 px et la ligne compacte prend le relais. Les défilements vers le graphique tiennent compte de la hauteur réellement affichée.
- **Pastille « n/16 ».** C'est le bouton `KpiInstitutionnelsButton`, un outil réservé à l'admin. Il indique combien des KPI suivis par les investisseurs institutionnels pour l'industrie GICS de la société figurent sur la fiche (ici 6 sur 16). C'est une information interne, il est donc retiré du concept grâce à une nouvelle option `outilsAdmin={false}` de `CompanyHeader` (activée par défaut ailleurs, rien ne change sur le site).
- Captures 18 à 22 ajoutées :
  - 18 : mobile, ligne compacte
  - 19 : mobile, clic sur un KPI avec la ligne compacte
  - 20 : mobile, en haut de page, en-tête complet sans la pastille
  - 21 : ordinateur 1440, en-tête complet collé
  - 22 : ordinateur 820, ligne compacte
- `tsc` passe sans erreur. Serveur arrêté, taille ordinateur rétablie.
