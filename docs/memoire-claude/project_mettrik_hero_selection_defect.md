---
name: project_mettrik_hero_selection_defect
description: "Mettrik - deux defauts de selection du hero KPI : la couche kpis-haut ecrase le hero, et isGenericKpi ignore les shorts en underscore (~14% des pages online)"
metadata: 
  node_type: memory
  type: project
  originSessionId: 36653cf7-97e2-47ae-87a0-a3630174d822
  modified: 2026-08-08T18:39:41.572Z
---

Trouve le 30 juillet 2026 en debloquant SATS et KVUE. Deux defauts distincts, aucun corrige, a arbitrer par Yann.

**1. La couche kpis-haut ecrase le hero pose en amont.**
Dans load-company.ts (fin de fichier, bloc kpisHaut), quand `.batches-drafts-safe/kpis-haut/<TICKER>.json` existe :
- `data.hero_kpi = max(pv_score)` des KPIs de ce fichier,
- `data.kpis = [...converted, ...keptExtras]` ou keptExtras ne garde que les KPIs dont `_source` est dans KEPT_SOURCES.
Consequence : `scripts/apply-hero-fix.py` (qui ecrit dans src/data/v2-pipeline/) est INOPERANT sur ces stes, le KPI ajoute est meme purement supprime du rendu. 540 fichiers kpis-haut existent.
**Contournement utilise :** injecter le hero directement dans le fichier kpis-haut, avec le pv_score le plus haut, `frequency` = "quarterly" ou "annual", et `history` au format `[{q,v}]` (labels "Q1-2024" ou "FY2024").

Confirme le 8 aout 2026 (ENX.PA et QRVO) : le champ `hero_kpi` **du fichier kpis-haut lui-meme est ignore**, seul `max(pv_score)` decide. Poser un pv_score superieur a tous les autres est donc obligatoire. Deux pieges verifies : (a) un KPI insere au format v2-pipeline (`period_type` + history en nombres bruts) est converti avec un history VIDE, il faut le format kpis-haut `frequency` + `[{q,v}]` ; (b) les labels trimestriels suivent la convention **calendaire**, pas fiscale (QRVO, exercice clos fin mars : le trimestre clos le 27 juin 2026 est etiquete "Q2-2026"). Apres injection, relancer `build-v2-pipeline-merged.ts` puis re-qualifier. Voir [[reference_mettrik_apply_hero_fix]].

**2. isGenericKpi ne normalise pas les underscore.**
src/lib/kpi-generic.ts normalise seulement casse et espaces. Donc EPS_DIL, eps_diluted, OP_INCOME, NET_INCOME, net_sales, gross_profit, revenue_total, total_revenues, ocf, fcf... echappent a la detection, passent pour des KPIs specifiques, et deviennent le hero reellement rendu via la branche `bestQ` de effectiveDefaultHero (meilleur quarterly non generique >=16 trimestres).
**Mesure : 10 stes sur 70 online tirees au hasard, soit 14%, environ 105 des 739 pages online**, affichent une ligne comptable comme hero. Exemples : SNA net_sales, BLDR net_sales, EIPAF / SAND.ST / ABI.BR / UPM.HE gross_profit, BCLYF net_income, ALLE revenue_total, FITB EPS_Dil, EQR eps_diluted.
**Le fix naif ne marche pas** : elargir isGenericKpi aux underscore a ete simule sur ces 10 stes, 6 restent inchangees (elles passent par la derniere branche de fallback) et BLDR se DEGRADE (net_sales -> inventory). EQR s'ameliore (eps_diluted -> normalized_ffo_ps). Il faut une vraie regle de selection du hero, pas un elargissement de la library generique.

Le qualifieur `scripts/qualify-stes.ts` reproduit fidelement effectiveDefaultHero, donc il donne un PASS sur une ste dont le hero rendu est EPS_DIL : **un PASS ne garantit pas un hero specifique, verifier le short affiche dans la sortie du qualifieur**.

Voir [[project_mettrik_v195_blocked_tail]] et [[feedback_verif_extractions_agents]].
