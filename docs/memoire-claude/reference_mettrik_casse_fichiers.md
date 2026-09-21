---
name: reference_mettrik_casse_fichiers
description: "Fichiers de donnees Mettrik nommes en majuscules = 404 en production (macOS ignore la casse, Linux non)"
metadata: 
  node_type: memory
  type: reference
  originSessionId: 886a0a4b-b33e-4198-9761-63baf371b26d
  modified: 2026-08-27T03:59:35.253Z
---

Dans ~/spx-app, `loadV17Company` lit `src/data/v2-pipeline/<ticker en minuscule>.json`. Un fichier nomme `IMB.L.json` au lieu de `imb.l.json` fonctionne en local (macOS ignore la casse) mais renvoie un 404 sur Vercel (Linux). Trouve le 27 aout 2026 : 21 fichiers concernes, 13 stes en ligne en 404 silencieux.

Controle a lancer apres tout ajout de fiche :
`ls src/data/v2-pipeline src/data/v2-pipeline-specific-kpis | grep -E "[A-Z]"`

Renommage sur macOS : passer par un nom temporaire (`git mv X.json tmp_x.json` puis `git mv tmp_x.json x.json`), sinon git ne voit pas le changement.

Piege de verification : le CDN Vercel garde le 404 en cache apres l alias. Toujours retester avec un parametre anti-cache (`&cb=$RANDOM`) avant de conclure que le correctif a echoue.

Voir [[reference_mettrik_visibility_gate]] pour l autre cause de fiche invisible.
