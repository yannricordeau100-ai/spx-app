# TAM nouveaux candidats
- Cause : "À arbitrer" = sociétés sans choix enregistré (5). Les 666 déjà arbitrées étaient exclues.
- Baseline : docs/cahier/tam/_vus.json (ids présents au commit c88f1ad780, avant le lot du 8 oct). Nouveau = id absent de la baseline, validable (TAM chiffré), jamais coché.
- tam-atelier.tsx : "À arbitrer" = non arbitrées OU avec nouveau candidat ; badge "nouveau" ; ligne compteur ; choix conservés. page.tsx passe `vus`.
- Test local (rendu serveur) : onglet À arbitrer 214 sociétés ; compteur 209 sociétés / 297 candidats (299 valides moins 2 déjà cochés). tsc OK. Rien commité ni déployé.
