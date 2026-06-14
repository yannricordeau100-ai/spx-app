# FREEZE-STATUS — data-lake Mettrik (gel propre)

Gelé le 2026-06-14 sur demande de Yann (pause ~1 semaine). **Reprise = dire "continue".**

## Reprise rapide
- Reprendre la gouvernance (skip auto des faites) :
  `Workflow({scriptPath:"/Users/yann/.claude/projects/-Users-yann/249317fd-c7f3-41f7-b3be-b3d3512f8bdc/workflows/scripts/gov-sp500-eff5-wf_d5e2fa8c-a9b.js"})`
- Après tout run : `cd ~/spx-app && python3 scripts/datalake/ingest_drafts.py && python3 scripts/datalake/build_status.py`

## État par bloc (au gel)
| Bloc | État | Détail |
|---|---|---|
| hero (KPI haut de gamme) | ✅ FAIT | **503/503 SP500**, vérifié verbatim (grep), rangé par ticker `data-lake/<t>/hero/`. 0 sté sans haut de gamme. |
| gouvernance | 🟡 PARTIEL (ARRÊTÉ) | **334 fichiers, 215/503 SP500 complets**. Reste ~288. Reprise = relancer le workflow gov (skip-done). |
| description | 🟡 4/503 | Seulement les 4 démo (GOOGL META PLTR WMT). |
| TAM (market_positions) | 🟡 4/503 | Seulement les 4 démo (TAM externe sourcé, `data-lake/<t>/tam/`). NON câblé à la page. |
| segments / quarterly | ancien pipeline | 374 / 386 (depuis `src/data/v2-pipeline`). |
| risks / AI / events / répartition | ancien pipeline | dans `src/data/v2-pipeline`, pas refaits. |

Monitor au gel : financier 512 / kpi_normaux 335 / story 477 / gouvernance 211 (vert).

## Les 4 stés démo (GOOGL META PLTR WMT)
- hero **enrichi** (GOOGL +6 dont Gemini MAU / Cloud run rate / AI Overviews ; META +4 dont Family DAP ; PLTR +6 dont clients 954 / RPO / TRV 11,2 Md$ ; WMT +4 dont e-commerce US-Intl-Sam's + revenu adhésions).
- description + gouvernance + TAM = faits dans le data-lake.
- **RESTE pour faire les pages** : câblage data-lake → page (`src/data/v2-pipeline-enrich/<t>.tam.json` + ordre KPI haut de gamme d'abord) + refonte UI (aperçu boursier → gros « i » barre de prix ; TAM dans « Comprendre la société ») + deploy niveau2 + validation visuelle Yann (GOOGL/META témoins).

## ES/ER (découverte importante pour la reprise)
- Pas tous en local : `~/Mettrik/sec-data/ir-scrape/` = **309 stés** (≥73 avec ER/ES au nom explicite, sûrement plus sous noms opaques type UUID). Bureau `DATA/` = 17. **WMT/PLTR : aucun en local.**
- **MAIS récupérables à 100% via EDGAR 8-K exhibits** : Ex99.1 = earnings release (ER), Ex99.2 = earnings presentation/slides (ES). Test WMT = 20/20 ER + 20/20 ES sur 5 ans ; PLTR = 20/20 ER, 0 ES (ne publie pas de slides).
- Le 8-K **local** n'a que la coquille de couverture (pas les exhibits) → d'où l'absence apparente.
- Compte ES/ER exact NON terminé (PDF `ir-scrape` à classer par contenu) : passe d'agents à relancer si besoin.

## Ordre suggéré à la reprise
1. Gouvernance : finir les ~288 restantes (workflow skip-done).
2. Pages des 4 démo : câblage + UI + QA niveau2 + ta validation.
3. ES/ER : récupérer Ex99.1/99.2 via EDGAR pour les stés voulues (le levier).
