---
name: project-mettrik-maj-nuit-pieges
description: "Pièges de la tâche maj-societes-nuit (nuit du 13-14 sept 2026) : écrasements concurrents, comparatifs N-1, transcripts contaminés"
metadata: 
  node_type: memory
  type: project
  originSessionId: c35b9972-b26a-46d4-a2d9-97e0a14c6774
  modified: 2026-09-15T22:20:35.943Z
---

Nuit du 13 au 14 sept 2026, tâche planifiée maj-societes-nuit (~/spx-app, scripts/earnings-refresh.py) :

- Quota hebdo du compte 20x atteint jusqu'au 14 sept 01h : tester `claude -p "OK"` AVANT de lancer la passe (sinon 6 h pour 0).
- Une autre session faisait tourner signaux-150.py, types-kpi.py et d'autres passes sur les MÊMES fichiers (kpis-haut, v2-pipeline, v2-pipeline-enrich) : des points vérifiés ont été écrasés 2 fois. Toujours relancer un contrôle final (points datés du jour présents dans les fichiers) et commiter tôt, fichier par fichier.
- earnings-refresh accepte le comparatif de l'année précédente sur les séries sans étiquette de période (ADS.DE 2523, SHL.DE 2973, ROG.SW, HST, EXPD, GIS) : repérer toute valeur ajoutée déjà présente plus haut dans la série, puis vérifier dans la source.
- Les sauvegardes .conv-state/quarterly-refresh-backups/<nom>.bak s'écrasent entre elles sur macOS (AVGO.json et avgo.json donnent le même fichier) : se servir de git comme filet.
- 13 transcripts fool.com attribués à la mauvaise société (le script prend n'importe quel mot du slug comme ticker, par exemple red-cat donne CAT). Ils sont revenus sur disque après correction ; corrigés de nouveau dans le commit c82294a12f. Tâche de correction du script proposée.
- Les points KPI vivent dans .batches-drafts-safe/kpis-haut (hors src) : `git add -A src` ne les met pas en ligne, il faut les ajouter nommément.

Nuit du 15 au 16 sept 2026 :
- CLI `claude -p` (compte 5x ricordeauyann) en limite hebdo jusqu au 21 sept 01h, profil ~/.claude-20x non connecte : ne PAS lancer la passe complete (moteur mort = ~7 h pour 0). Contournement qui marche : agents de cette session (opus) ecrivent des brouillons <t>_draft.json en scratchpad, verification mecanique (extrait present dans la source, periode contigue, pas de valeur deja dans la serie, echelle) puis ecriture ; syntheses via prompts de summaries-refresh (consigne()) et reponses importees.
- Les 8-K de resultats de septembre n ont que la page de garde (aucun fichier _complet depuis le 27 aout) : communiques recuperes a la main sur EDGAR (index du depot, fichier *ex99*). Tache proposee.
- Un commit d une autre session (e6c30cca25, 15 sept) a remis 5 transcripts contamines (WELL, YUM, ARES, ON, CAT) : toujours scanner les slugs fool.com avant de synthetiser. KEY et FIX avaient des syntheses Key Tronic / Stitch Fix.
- Python urllib : CERTIFICATE_VERIFY_FAILED pour scripts/alerte-mises-a-jour.py ; utiliser curl pour l endpoint alertes-maj.

Nuit du 16 au 17 sept 2026 :
- Meme blocage CLI (limite hebdo jusqu au 21 sept). Beaucoup de rouges « Indicateurs cles » etaient faux : T2/S1 2026 deja en historique mais last_data_date reste a l ancienne date (la page prend le max de last_data_date). Realigner sur la fin de periode de la derniere etiquette, SAUF exercices decales (JCI, BEN : Q2-2026 = mars) ; verifier 1 valeur dans la source avant.
- Rouges structurels : series seulement annuelles (RHM.DE, SREN.SW), KPI trimestriels flagues is_short_history (Q, SPCX), aucun document 2026 au data-lake (VOW.DE, DPW.DE, P911.DE...).
- Les agents reformattent l extrait (separateurs |) : comparer extrait et document sur [A-Za-z0-9%] seulement.

Liens : [[feedback-verif-extractions-agents]] [[project-mettrik-earnings-refresh-gardes]]
