---
name: feedback-mettrik-deploy-chain
description: "Chaine de mise en ligne Mettrik depuis le 3 sept 2026 : niveau2 = alias preview via scripts/deploy-niveau2.sh, mettrik.ai (n0) ne bouge QUE par scripts/go-n0.sh (promotion explicite + verif-release), jamais de redeploy --target production en autonomie"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 8757e5cb-d96c-4ff2-adf6-031b2457fc47
  modified: 2026-09-02T23:00:03.120Z
---

Depuis le 3 sept 2026 (demande de Yann de garantir la non-contamination entre niveaux) :
- `bash scripts/deploy-niveau2.sh` : push, attend le build PREVIEW du commit, alias mettrik-niveau2.vercel.app. C est la seule mise en ligne autorisee en autonomie.
- `bash scripts/go-n0.sh` : lance `scripts/verif-release.py --strict` puis promeut EXACTEMENT le deploiement servi sur niveau2 vers la production (mettrik.ai, www). Uniquement sur ordre explicite de Yann (« go n0 », « ouvre le site »).
- INTERDIT : `npx vercel redeploy ... --target production` ou `vercel promote` en autonomie : un deploiement production recoit automatiquement les domaines mettrik.ai.
- Les variables Preview sont alignees sur Production (Stripe live, site URL). Manque : RESEND_API_KEY en Preview (valeur sensible, a copier par Yann dans Vercel).

**Why:** avant, chaque promotion sur niveau2 etait un deploiement production : mettrik.ai et niveau2 servaient le meme build (verifie le 2-3 sept), donc zero isolation. Yann veut pouvoir travailler sur n2 sans jamais affecter le site public.

**How to apply:** toujours finir un lot par `deploy-niveau2.sh` + verification curl sur niveau2 ; ne jamais toucher mettrik.ai sans ordre ; avant un go n0, lancer `verif-release.py` et lire les feux. Voir aussi [[reference-mettrik-visibility-gate]] et [[feedback-mettrik-verify-admin]].

Mise a jour 05/09/2026 : le jeton CLI Vercel (~/Library/Application Support/com.vercel.cli/auth.json) est EXPIRE (403 forbidden). scripts/alias-niveau2-attente.sh boucle a vide avec ce jeton. Contournement valide : VERCEL_TOKEN de .env.local + API REST (GET /v6/deployments pour trouver le build READY du SHA, puis POST /v2/deployments/<uid>/aliases avec {"alias":"mettrik-niveau2.vercel.app"}). Ne jamais relancer npx vercel avec le jeton CLI mort (risque tempete d onglets Safari).
