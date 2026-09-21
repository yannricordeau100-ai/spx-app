---
name: feedback-mettrik-liens-outils
description: "Ne jamais donner un lien mettrik.ai vers une page d outillage interne : tout lien d outil ou de concept se donne sur le domaine de preversion"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: f6e0203b-2aed-4432-a0b3-a87ba8db1323
  modified: 2026-09-20T21:25:57.692Z
---

Regle posee par Yann le 20 septembre 2026, apres que je lui ai donne trois liens
mettrik.ai vers des pages internes alors que je venais moi-meme de lui expliquer
que ces adresses repondent 404 sur le domaine public.

**Regle dure** : aucun lien vers /sandbox, /admin, /concepts, /chart-lab,
/email-lab, /desk-mtk9x4kp ne se donne sur https://mettrik.ai. Ces chemins se
donnent TOUJOURS sur https://mettrik-niveau2.vercel.app.
Seules les pages clientes (accueil, fiches societe, tarifs, compte) se donnent
sur mettrik.ai.

**Pourquoi** : depuis le 19 septembre 2026, `src/proxy.ts` renvoie un 404 sec
sur mettrik.ai pour les prefixes internes (constante PREFIXES_INTERNES), pour ne
pas annoncer au public l existence de l outillage. Un lien mettrik.ai vers un
outil est donc toujours casse, et Yann perd du temps a cliquer dans le vide.
Les pages /concepts ne sont pas dans PREFIXES_INTERNES mais exigent une session :
elles restent de l outillage, donc elles se donnent aussi sur la preversion.

**Comment appliquer** : avant d envoyer un lien, verifier le prefixe. S il est
interne, ecrire le domaine de preversion. En cas de doute, tester le code HTTP
avant d envoyer le lien.

Liens : [[feedback-liens-et-builds-vercel]] [[feedback-mettrik-deploy-chain]]
