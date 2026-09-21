---
name: reference-mettrik-cache-fiches-version
description: "Le cache partage des fiches Mettrik est invalide par VERSION : si src/lib/version.ts n est pas commite, le deploiement sert les anciennes fiches"
metadata: 
  node_type: memory
  type: reference
  originSessionId: f6e0203b-2aed-4432-a0b3-a87ba8db1323
  modified: 2026-09-15T12:11:18.339Z
---

`chargeAvecCachePartage` (src/lib/company-core/load-company.ts) met les fiches en cache 6 h avec la cle `["fiche-societe", VERSION]`, VERSION venant de `src/lib/version.ts`.

Piege verifie le 15 sept 2026 : `scripts/version-bump.sh` ECRIT version.ts et CHANGELOG.md mais ne les commite pas. Trois deploiements successifs ont tourne avec l ancienne VERSION (2026.09.15.3) parce que mes `git add` ciblaient seulement src/data et un composant : la cle de cache ne changeait pas, et les fiches servies dataient du premier de ces deploiements (donnees a jour, champs de code recents absents, ici `_estime_libelle`).

**Comment l appliquer :** apres `bash scripts/version-bump.sh "..."`, TOUJOURS `git add src/lib/version.ts CHANGELOG.md` dans le meme commit. Controle apres deploiement : `git show origin/staging:src/lib/version.ts` doit montrer le nouveau numero, et le badge de la page doit l afficher.

Liens : [[feedback-mettrik-deploy-chain]] [[feedback-liens-et-builds-vercel]]
