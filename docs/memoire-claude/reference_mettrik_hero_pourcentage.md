---
name: reference-mettrik-hero-pourcentage
description: "Un hero KPI en pourcentage ou en marge etait interdit par une regle du 9 juin 2026 ; depuis le 18 sept 2026 un override pose a la main prime, avec 6 points d historique minimum"
metadata: 
  node_type: memory
  type: reference
  originSessionId: f6e0203b-2aed-4432-a0b3-a87ba8db1323
  modified: 2026-09-19T00:28:25.358Z
---

Constate le 18 sept 2026 en cherchant pourquoi la marge nette d interet n apparaissait sur aucune fiche bancaire malgre les overrides poses.

`company-view.tsx` (et son miroir `scripts/dump-hero-context.ts`) ecartait tout hero dont l unite vaut `%` ou dont le short contient margin, marge, ratio, taux, growth, croissance, yield, rendement, ainsi que GM, ROE, ROTE, ROIC, ROA, ROCE, NIM, ROTCE. Regle posee par Yann le 9 juin 2026 contre un hero automatique tombant sur la marge brute d Apple. Elle ecartait aussi les heros CHOISIS a la main.

**Correctif du 18 sept 2026 :** `load-company.ts` pose `hero_kpi_force = true` quand l override Supabase `desk_hero_kpi_overrides` est applique, et `company-view.tsx` respecte alors le choix meme en pourcentage, a condition que la serie ait au moins 6 points. La regle du 9 juin continue de s appliquer au hero automatique.

**Effet mesure :** 28 fiches non bancaires ont enfin affiche le KPI choisi (ratio combine chez les assureurs, croissance organique chez les courtiers et les fabricants de dispositifs medicaux, rendement par jour-lit chez les croisieristes), en plus des 27 banques passees a la marge d interet.

**Verification :** le payload d une page expose `hero_kpi`, qui est la valeur CONFIGUREE, pas celle affichee. Pour lire le titre reellement rendu, utiliser `scripts/verif-hero-affiche.mjs` (Playwright, cookie de session du compte de test, selecteur `span.text-[24px].font-bold`). Le cookie se fabrique avec un lien magique admin Supabase (`admin/generate_link` puis `verify` avec `token_hash`), le mot de passe est bloque par le captcha.

Liens : [[reference-mettrik-kpi-ajoute-invisible]] [[reference-mettrik-hero-override-supabase]] [[feedback-mettrik-verify-admin]]
