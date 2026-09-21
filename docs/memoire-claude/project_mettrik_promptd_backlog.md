---
name: project-mettrik-promptd-backlog
description: "Backlog data restant après le Prompt D du 9 août 2026 (20 audits pages populaires) : sweeps univers à faire, gaps documentés"
metadata: 
  node_type: memory
  type: project
  originSessionId: f9760fc2-7eac-4e41-821a-262ae5427645
  modified: 2026-08-08T23:53:26.455Z
---

État au 9 août 2026, après les 20 audits Prompt D (10 US + 10 FR, tous déployés). Détail complet : `~/spx-app/.conv-state/promptd-state.json` (clés `alertes`, `backlog_data`, `data_gaps`).

Sweeps univers à faire (détectés sur échantillon, non traités) :
- **Cross-pollution events/enrich** : TTE.PA avait des news Shell/Devon (purgé), SU.PA a un event Regal Rexnord, AMZN des news Cisco/Netflix, TSLA des risques génériques partagés avec T/TXN/STZ. Sweep de `enrich_events` + `events[]` sur tout l'univers.
- **Contamination identité v1-9-complete** : DG.PA était "Virbac" (corrigé) ; STMMI.MI, ENI.MI, AUTO.L, RACE.MI, VIV.PA, SN.L portent name "IVR"/Inland Waterway (fichiers non rendus mais toxiques pour tout script qui les lit).
- **Lot CAC40 sans accents** : risks + ai_positioning désaccentués sur ~4 stés corrigées à la main (TTE, OR, AI, SAN, AIR, RMS, DG) mais le lot d'extraction complet EU est suspect ; passe outillée nécessaire (cas ambigus utilise/utilisé).
- **Transcripts en retard** : gap d'ingestion earning calls (GOOGL, META, TSLA à 1-2 trimestres de retard). Le cron ne télécharge pas les nouveaux transcripts.
- **MNST** : rebase EPS après split 2:1 effectif 10 août 2026 (différé volontairement).
- data-lake/MC.PA/10K-10Q = filings de Moelis & Company (mauvais ticker SEC "MC") ; vraies sources LVMH dans ir/. Scripts itérant sur 10K/10Q liraient la mauvaise sté.
- JPM géo incomplète (somme 121,6 vs 182,4 Mds), META ~12 KPI doublons DAP/MAU (canonique, validation Yann), AAPL board_women_pct contradictoire (50 vs 37,5, DEF14A muet).

Fait et déployé le 9 août (ne pas re-faire) : 5 lots de fixes UI systémiques (commits 3c65908679→326f914b8e) : casse Interprétation, catégories risques normalisées (~3500 stés), badge période FY/semestre par labels, dédup TTM relatif, devise €/CHF, dual-class singulier, CAGR honnête, treemap labels fallback, onglet Segment dégelé, title dédupliqué. Cron : kpi-lag-detect branché au daily-doc-watcher (alerte `.conv-state/kpi-lag-alert.json` si lagging>0).
