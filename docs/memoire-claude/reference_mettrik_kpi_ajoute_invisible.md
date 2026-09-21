---
name: reference-mettrik-kpi-ajoute-invisible
description: "Un KPI ajoute au fichier v2-pipeline/<t>.json n est PAS servi si un fichier kpis-haut existe, sauf _source dans KEPT_SOURCES ; l override de heros doit viser le short SERVI"
metadata: 
  node_type: memory
  type: reference
  originSessionId: f6e0203b-2aed-4432-a0b3-a87ba8db1323
  modified: 2026-09-17T12:21:48.926Z
---

Deux pieges constates le 17 sept 2026 pendant le chantier KPI star (Mettrik, ~/spx-app) :

1. `load-company.ts` : quand `.batches-drafts-safe/kpis-haut/<T>.json` existe, la fusion REMPLACE tous les KPI du fichier de base `src/data/v2-pipeline/<t>.json`, sauf ceux dont `_source` figure dans `KEPT_SOURCES` (ER+earnings-calls, calls-5y, stories-*, sectoriel, kpis-haut 10-Q/10-K, kpi-star...). Un KPI ajoute avec un `_source` libre disparait silencieusement de la page (vu sur MUV2, ALV, VTR). Regle : `_source: "kpi-star"` (ou une autre valeur de la liste), provenance detaillee dans `_source_detail`.

2. L override `desk_hero_kpi_overrides.hero_kpi_short` n est applique que si ce short existe dans la liste FINALE servie (apres kpis-haut, fusion trimestrielle, dedoublonnage par nom). Les shorts servis different souvent du fichier de base (JPM : `NIM` et non `Net yield on interest-earning assets (NIM)`).

**Comment l appliquer :** apres tout ajout de KPI ou bascule de heros, controler sur la page servie (niveau2, `?audit_token=`) que `hero_kpi` vaut bien le short voulu ; script de verification dans la conversation du 17 sept (`grep "short":"..."` sur la page). Etat du chantier : `.conv-state/secteurs-kpi-star.json`.

Liens : [[reference-mettrik-hero-override-supabase]] [[project-mettrik-hero-selection-defect]] [[reference-mettrik-cache-fiches-version]]
