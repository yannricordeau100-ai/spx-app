---
name: reference-mettrik-kpi-dedup-sync
description: "Mécanismes KPI Mettrik : overrideValue ligne active (sync chart), dedup runtime des séries recouvrantes, YoY des KPI en % en points"
metadata: 
  node_type: memory
  type: reference
  originSessionId: ffd85f8a-b3ef-49ef-afa6-f6cd1c84397b
  modified: 2026-08-30T04:16:48.400Z
---

Corrections du 30 août 2026 (commit f0276a1224), à connaître avant de toucher aux KPI :

- **Ligne active du tableau** : `overrideValue` = dernier point visible du chart (company-view). Le clic sur une ligne recale désormais `graphPeriod` sur le `period_type` du KPI promu (handleKpiClick), sinon un KPI trimestriel promu en vue annuelle affichait FY N-1 au lieu de la valeur courante (bug KO 2 % → 6 %, 262 stés exposées).
- **Dedup runtime** : `dedupKpisSeriesRecouvrantes` en fin de `loadV17Company` (load-company.ts). v2 du 30 août : égalité de points à 1,5 % près (arrondis), essai des 3 échelles 1/1000/0,001 SANS pré-filtre par médianes (un pré-filtre ratait BKNG room_nights, série courte plus récente = médiane décalée), inclusion totale ≥6 pts (NVDA Networking 9/9), + paires revues à la main dans `src/data/kpi-doublons-forces.json` (court-circuitent les gardes). On garde la série qui va le plus loin. Faux positifs volontairement épargnés : CPT mkt_austin/phoenix, LUV Div/Buybacks (plateaux), KO revenue_us_q vs segrev_na_q (métriques voisines réelles).
- **Leçon vérification** : mon audit et ma dedup partageaient le MÊME critère → l'audit ne pouvait pas voir ce que la dedup ratait (NVDA 9 pts sous le seuil 10 des deux). Le vérificateur doit être PLUS LARGE que le correcteur (tolérance 2 %, fenêtre ≥5) et le résiduel se juge cas par cas. Et local ≠ prod possible : toujours confirmer par curl prod.
- **YoY d'un KPI en %** : delta en POINTS affiché " %" (plus jamais "pp"/"pts", plus jamais de ratio type -60 %). Appliqué dans kpi-row (3 branches) et company-view (hero). Décision Yann.
- Vue par défaut du chart = fréquence du hero initial (`heroDefaultPeriod`) : une page à hero annuel affiche tous les charts en annuel jusqu'au clic.

**How to apply :** tout audit rendu KPI passe par `npx tsx --env-file=.env.local` + `loadV17Company(t, {mode:"v18"})` (mêmes routes prod) ; ne pas auditer les JSON bruts seuls, la fusion runtime change tout. Lié : [[reference-mettrik-apply-hero-fix]].
