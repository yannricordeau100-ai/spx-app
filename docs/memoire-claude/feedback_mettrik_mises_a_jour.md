---
name: feedback-mettrik-mises-a-jour
description: Regles de mise a jour des fiches Mettrik (J+3, par bloc) et reflexe d alerte rouge a lire en debut de session
metadata:
  type: feedback
---

Yann (13 sept 2026) : chaque bloc de fiche doit etre a jour au plus tard J+3 apres la publication de resultats. Regles par bloc dans `~/spx-app/src/data/mise-a-jour-regles.json` et CLAUDE.md section 8 (rang hebdo ; KPI IC, stories, synthese, transcript, positionnement IA a chaque publication ; risques, repartition, gouvernance a chaque rapport annuel).

**Why:** un systeme d alerte independant signale en rouge les blocs en retard (email + banniere sur /sandbox/mises-a-jour). Yann veut que Claude ait le reflexe de corriger AVANT qu il n ouvre la notification.

**How to apply:** en debut de session Mettrik, ouvrir https://mettrik-niveau2.vercel.app/sandbox/mises-a-jour?audit_token=<VISUAL_AUDIT_TOKEN> (ou lire src/data/alertes-maj.json) ; s il y a du rouge, lancer la mise a jour du bloc concerne, puis le dire a Yann. Toute passe qui met un bloc a jour ecrit `_maj_<bloc>` dans v2-pipeline-enrich/<t>.json. Lie a [[project-mettrik-cron-autonome]].
