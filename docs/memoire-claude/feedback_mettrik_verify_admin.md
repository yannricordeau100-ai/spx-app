---
name: feedback-mettrik-verify-admin
description: "Toute vérification visuelle Mettrik doit se faire en vue CONNECTÉE (tier max), jamais en anonyme"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 4bf8aa19-2999-41a7-a35e-17c39ca05d9c
---

Yann, 12 juil 2026 : "là tu es sur la version free, il ne faut regarder que la version admin réelle. c'est la raison de tous les problèmes entre ce que tu me dis et la réalité."

**Why :** les curl/browser sans session = tier "anon" (floutage, gate signup, rendu différent). Yann regarde toujours l'app connecté (tier max). Tout écart entre mes rapports et ce qu'il voit venait de là.

**How to apply :** avant toute vérification visuelle sur mettrik-niveau2, se connecter avec le compte de test interne `audit.claude@mettrik-internal.test` (créé 12 juil 2026 via Supabase admin, mot de passe régénérable via l'API service_role). Un user connecté quelconque = tier max = même rendu que Yann. Le loader et les fingerprints data restent identiques anon/connecté ; seul le rendu visuel (floutage, animations, gates) diffère. Lié : [[feedback-mettrik-deploy-chain]].
