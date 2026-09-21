---
name: reference-mettrik-kpi-ecriture-series
description: "Pieges d ecriture d un point dans une serie de KPI Mettrik : deux formats d historique, echelle d unite, history_periods, creation d un KPI story"
metadata: 
  node_type: memory
  type: reference
  originSessionId: f6e0203b-2aed-4432-a0b3-a87ba8db1323
  modified: 2026-09-19T00:27:55.670Z
---

Constate le 18 et 19 sept 2026 pendant le rattrapage des 148 blocs en retard, apres avoir corrompu 468 points sur 70 fiches.

**Deux formats d historique coexistent.** `src/data/v2-pipeline/<t>.json` stocke `history` comme une liste de nombres avec `history_periods` a cote. La couche `.batches-drafts-safe/kpis-haut/<T>.json` stocke `history` comme une liste d objets `{"q":"Q2-2026","v":12.3}` avec `frequency`, sans `history_periods`. Ecrire un nombre nu dans une serie au format objet produit un point sans periode, invisible ou faux a l affichage.

**Why :** un applicateur qui ne gere qu un format detruit silencieusement l autre ; rien ne remonte d erreur, la page continue de s afficher.

**How to apply :** avant d ajouter un point, tester `all(isinstance(x,dict) for x in history[-3:])` et ecrire dans le bon format. Puis verifier trois choses sur les KPI modifies du jour : aucun melange de types dans `history`, `len(history_periods) == len(history)` sinon retirer le champ, et pas de point au dela d un facteur 5 de la mediane de sa serie. Une conversion d unite n est acceptable qu au facteur 1000 exact (millions vers milliards), jamais un ajustement libre.

**Creation d un KPI story :** `_source` doit valoir `stories-filings` (valeur de KEPT_SOURCES) sinon la couche kpis-haut l efface, avec `story_category`, `is_short_history`, `name_fr`, `unit`. Un KPI comptable majeur (chiffre d affaires, resultat, marge, flux) ne doit PAS porter `story_category` sinon il ne compte pas comme indicateur cle et la societe reste en retard.

**Exercices decales :** une periode notee `FY2025-26` se termine le 31 mars 2026, pas le 31 decembre. Sans `last_data_date` la societe reste comptee en retard (Sonova).

Liens : [[reference-mettrik-kpi-ajoute-invisible]] [[feedback-verif-extractions-agents]]
