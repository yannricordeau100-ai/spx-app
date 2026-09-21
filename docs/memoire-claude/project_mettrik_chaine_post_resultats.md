---
name: project-mettrik-chaine-post-resultats
description: "Chaine automatique Mettrik apres chaque publication de resultats : telechargement des documents puis extraction, alerte rouge a J+7 seulement"
metadata: 
  node_type: memory
  type: project
  originSessionId: f6e0203b-2aed-4432-a0b3-a87ba8db1323
  modified: 2026-09-19T00:28:10.709Z
---

Mise en place le 18 sept 2026 sur demande de Yann, en remplacement du delai J+3 qui sanctionnait l absence de document.

`scripts/post-earnings-pipeline.py`, cron local a la minute 15 de chaque heure, journal `.conv-state/post-earnings-etat.json` :
1. attend le delai de mise a disposition propre a la place de cotation (communique le jour meme partout, rapport trimestriel americain sous 3 jours, document complet europeen sous 1 a 3 jours) ;
2. telecharge les documents manquants et retente chaque heure jusqu a J+12 ;
3. lance l extraction des KPI immediatement apres chaque nouveau document ;
4. tient par societe les tentatives, les documents, l extraction et le statut.

Le delai des blocs declenches par une publication est passe a 7 jours dans `src/data/mise-a-jour-regles.json`. Un document non disponible ne declenche JAMAIS de rouge ; le rouge ne sanctionne que l absence de mise a jour des KPI sept jours apres la publication, et le motif de l alerte dit si les documents sont arrives.

**Registre des societes sans appel de resultats** : `src/data/sans-appel-resultats.json`, lu par `src/lib/synchro/etat.ts`, qui les classe hors perimetre du bloc transcript au lieu de les compter en retard. Y figurent NVR et Berkshire (pas d appel par principe), Porsche SE (conference annuelle seulement), et les societes en rachat qui ont cesse leurs appels : EA, QRVO, AES, KVUE, JDEP.AS. Chaque entree porte la raison et la date du constat.

**Regles de l etat affinees le 19 sept :** une fin de periode posterieure a la date de depot est impossible et retombe sur la fin du trimestre precedent ; le bloc stories se juge aussi sur la date d ajout `_maj_le` car beaucoup de ces KPI sont ponctuels ; une annee de donnees ancienne ne vaut signalement que si le releve a plus d un an.

Liens : [[feedback-mettrik-mises-a-jour]] [[reference-mettrik-kpi-ecriture-series]]
