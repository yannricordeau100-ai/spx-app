---
name: reference-mettrik-logotheque
description: "Logotheque Mettrik : ou vit le reglage du logo par emplacement, et ce qui n est pas pilotable"
metadata: 
  node_type: memory
  type: reference
  originSessionId: f9760fc2-7eac-4e41-821a-262ae5427645
  modified: 2026-08-31T00:55:05.866Z
---

Logothèque créée le 31 août 2026 (`/sandbox/logotheque`). Elle choisit quelle
variante de logo s affiche à chaque endroit du site.

Le réglage n est PAS dans un fichier du dépôt. Il vit en base, table
`desk_page_content`, `page_key="logotheque"`, `section_key="emplacements"`,
JSON `{emplacement: varianteId}`. `src/data/active-wordmark.json` reste la
valeur par défaut quand un emplacement n a pas de choix propre. Chercher un
JSON de logos dans src/data est donc une fausse piste.

Emplacements pilotables : `maintenance`, `home`, `retour-societe`, `tarifs`.
Volontairement absents : connexion/compte (aucun logo affiché aujourd hui) et
la signature des exports PNG (dessinée sur un canvas depuis une image, aucune
variante React ne peut s y appliquer). Les 26 variantes viennent de
`WORDMARK_VARIANT_META` dans `src/components/wordmark-variants.tsx`.

Piège corrigé le même jour : en mode maintenance, `src/proxy.ts` redirigeait
TOUT sauf `/api/*` vers `/maintenance`, donc `/brand/*.png` renvoyait du HTML
et le logo de mettrik.ai ne s affichait pas. Les fichiers statiques sont
maintenant en liste blanche. Si un asset disparaît sur mettrik.ai mais marche
sur mettrik-niveau2, regarder cette liste en premier.

Lié : [[reference-mettrik-hero-override-supabase]] (même logique : la vraie
source est en base, pas dans le dépôt), [[feedback-mettrik-deploy-chain]].
