# FAQ Mettrik : résumé des questions et des éléments de réponse (2 sept 2026)

Page publique : /faq. Édition : /sandbox/faq (effet immédiat, base desk_page_content page_key "faq").
Contenu de départ : src/data/faq.json. Le même contenu alimente les données structurées
schema.org FAQPage (Google, moteurs de réponse IA) et /llms-full.txt.

## Comprendre Mettrik
1. Qu'est-ce que Mettrik AI ? Service d'intelligence KPI : indicateurs opérationnels extraits des documents officiels ; une fiche par société (KPI principal, indicateurs notés, histoires, risques scorés, gouvernance, IA, synthèse call).
2. À qui s'adresse-t-il ? Particuliers actifs, étudiants finance, conseillers, family offices, gérants. Aucune compétence technique.
3. KPI opérationnel vs comptable : mesure l'activité réelle, bouge avant le CA et le bénéfice ; ce que lisent d'abord les analystes.
4. Conseil d'investissement ? Non. Information structurée, décisions = l'utilisateur, renvoi aux conditions.
5. Différence avec screener / Yahoo / terminal : indicateurs propres à chaque société vs ratios identiques ; profondeur d'un terminal au prix grand public.

## Données et méthode
6. Sociétés couvertes : plus de 650, par indice (S&P 500, CAC 40, DAX 40, AEX 25, SMI, SOX) ; suit la composition des indices.
7. Sources : documents publiés par les sociétés (10-K, 10-Q, 8-K, rapports EU, communiqués, présentations, proxys, transcriptions). Rien d'estimé ; TAM seulement si déclaré.
8. Fréquence : veille quotidienne, intégration des nouveaux trimestres après publication, pastille « À jour », badge orange au-delà de 12 mois.
9. Notes Excellent / Bon / Moyen / Faible : dynamique (1 an, croissance 5 ans) + position vs sous-secteur, en mots simples ; Top 5 %.
10. Score des risques 1 à 5 : ordre dans le rapport, intensité du langage, évolution vs rapport précédent, poids de la catégorie ; justification visible.
11. Trimestres décalés : exercices non calendaires (Apple, Nike, Kroger) affichés en équivalent calendaire, « i » d'explication.
12. Histoires clés : faits chiffrés récents sans historique long, par thème ; deviennent des KPI quand l'historique suffit.
13. Télécharger / partager : PNG HD signé, partage X, plein écran mobile.

## Offres, prix et paiement
14. Gratuit : Alphabet et Meta en intégralité, le reste flouté, sans carte, sans limite.
15. Premium vs Max : 29,90 €/mois ou 238,80 €/an (4 mois offerts) : toutes les fiches ; Max 59,90 €/mois ou 478,80 €/an : historique étendu, exports, alertes illimitées, support < 24 h, accès anticipé.
16. Annulation / remboursement : sans engagement, 1 clic, accès jusqu'à fin de période ; pas de remboursement des périodes entamées (exécution immédiate) ; le gratuit sert d'essai.
17. Paiement : Stripe, carte, mensuel ou annuel, TTC, facture dans le compte.
18. Parrainage : abonné Premium actif génère un code ; 1 mois Premium offert chacun ; sans limite.
19. Pros / équipes : Max ; besoins d'équipe via contact.

## Confidentialité et sécurité
20. Données personnelles : email + facturation Stripe ; mesure d'audience interne sans traqueur tiers ; IP jamais en clair ; suppression du compte possible.
21. Entraînement IA : non ; contenu protégé, robots d'entraînement refusés ; IA utilisée en interne avec vérification contre le texte source.

## Utilisation
22. Mobile : site responsive, pas d'application à installer.
23. Langues : français ; noms anglais d'origine dans le « i » ; anglais en préparation.
24. Retrouver une société : nom ou ticker dans la recherche ; adresse directe mettrik.ai/<ticker>.
25. Contact / support : page contact ou contact@mettrik.ai ; support prioritaire < 24 h pour Max ; signalement d'erreur vérifié contre la source.

## Points à trancher par Yann (incohérences relevées pendant la rédaction)
- Page tarifs : « 1 000+ américaines & européennes » alors que l'univers en ligne est de 666 sociétés (indices). Proposition A : « Plus de 650 sociétés (S&P 500, CAC 40, DAX 40, AEX, SMI, SOX) ». Proposition B : garder « 1 000+ » et élargir l'univers avant l'ouverture.
- Grille tarifs : « Comparaison 2 sociétés » et « panier de comparaison » promis, alors que le Comparer est archivé (COMPARER_ACTIF=false). Proposition A : retirer ces 3 lignes de la grille. Proposition B : réactiver le Comparer avant l'ouverture.
- Alertes email, calendrier des résultats, export PDF/CSV, accès API : présents dans la grille, existence réelle à confirmer avant de les promettre dans la FAQ (la FAQ reste volontairement générale sur ces points).
