---
name: reference-mettrik-chaine-deploiement-pieges
description: "Pieges de la chaine alias-niveau2-attente puis go-n0 (Mettrik) : aucun commit pendant la chaine, fichiers de veille regeneres a committer juste avant go-n0, builds Vercel empiles a annuler"
metadata: 
  node_type: memory
  type: reference
  originSessionId: f6e0203b-2aed-4432-a0b3-a87ba8db1323
  modified: 2026-09-17T22:55:06.168Z
---

Constate les 17 et 18 sept 2026 (chaine `bash scripts/alias-niveau2-attente.sh && bash scripts/go-n0.sh`, ~20 min) :

1. go-n0 refuse (verrou rouge « commit local pousse ») des qu un commit local n est pas pousse, et refuse aussi s il existe un fichier servi non commite. Regle : pousser chaque commit immediatement, et ne plus committer entre le lancement de la chaine et son bilan.
2. Des veilles locales regenerent en continu `src/data/_fr-doc-watcher-status.json`, `_daily-doc-watcher-status.json`, `_data-lake-dernier-doc.json`, `earnings-calendar.json`, parfois `.batches-drafts-safe/kpis-haut/<T>.json`. Avant de relancer go-n0 seul : `git add -u src/data .batches-drafts-safe && git commit && git push && bash scripts/go-n0.sh` dans la MEME commande (sinon un fichier est regenere entre les deux).
3. Chaque push declenche un build Vercel ; apres une rafale de pushes, les builds s empilent en « Building » et la chaine attend le mauvais. Annuler les intermediaires avec `vercel rm <url> --yes`, garder celui du HEAD, relancer la chaine.
4. Verifier la version servie sur la page (pied de fiche « v2026.09.xx.y ») avant d annoncer « en production » : une promotion « identique a niveau2 » peut pointer sur un ancien build si l alias niveau2 n a pas bouge.

Liens : [[feedback-mettrik-deploy-chain]] [[reference-mettrik-cache-fiches-version]]

5. Next.js : un export non-composant (constante, tableau) d un module « use client » importe dans une page serveur passe pour une reference client et casse a l execution (500 seulement sur le chemin qui le lit, ex. `?onglet=`) ; `tsc` ne le voit pas. Mettre les constantes partagees dans un module sans directive (ex. `reglages-kpi/onglets.ts`). Constate le 18 sept 2026.
