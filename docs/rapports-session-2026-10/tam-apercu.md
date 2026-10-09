# Aperçu TAM (9 oct 2026)
Fichiers : src/components/sandbox/tam-atelier.tsx (ApercuFiche, carte "TAM non trouvé", aperçu immédiat), src/lib/desk/tam-apercu.ts (nouveau, conversion identique à tam-pose.py), src/app/sandbox/tam/page.tsx (lit les .tam.json en ligne, phrase de chaîne), src/app/api/sandbox/tam-arbitrage/route.ts (refuse un candidat sans TAM), scripts/tam-pose.py (ignore tam null).
- Aperçu sous chaque société : "Actuellement en ligne" (fichier .tam.json) et "Après validation" (MarketPositionCard réel, mis à jour au clic, annulé si l'enregistrement échoue).
- La carte ne disparaît plus de "À arbitrer" au premier clic.
- Limite 2 : le bloc public fait slice(0, 2) (company-view.tsx, contenu.tsx) et l'API refuse >2 : limite voulue, conservée et affichée.
- Chaîne : case -> POST API -> desk_page_content (base, immédiat) -> scripts/tam-pose.py -> src/data/v2-pipeline-enrich/<t>.tam.json (prime via _arbitrage_proprietaire dans load-company.ts) -> commit + déploiement (pas immédiat ; cache fiches).
- tam null (BE c1/c2, FDXF c2) : "TAM non trouvé", sans case, API 400, tam-pose ignore.
- Test réel : FERG et FDXF cochés puis effacés (666 choix, comme avant). tsc sans erreur.
- Limite de 2 levée (fiche, contenu, tam-pose, API, atelier) ; tri par revenu décroissant (trierPositions) ; 1 col mobile, 2 cols desktop, dernière carte large si impair ; testé 4 (2x2) et 3 (2+1) desktop, 3 mobile (375, sans débordement).
