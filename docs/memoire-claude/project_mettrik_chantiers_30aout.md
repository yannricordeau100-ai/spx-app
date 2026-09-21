---
name: project-mettrik-chantiers-30aout
description: "Chantiers Mettrik ouverts au 30 août 2026 : définitions KPI batch, 164 synthèses en retard, 90 stances IA douteuses, fiscal_year texte, logos SVG V1 restants"
metadata: 
  node_type: memory
  type: project
  originSessionId: ffd85f8a-b3ef-49ef-afa6-f6cd1c84397b
  modified: 2026-08-30T04:17:04.247Z
---

Restes ouverts après la session du 30 août 2026 (commits 0ea37d→53cd7b+), à traiter ou faire valider par Yann :

- **Définitions KPI** : repli générique serveur couvre ~55 % des 35 789 KPI sans définition (`src/lib/kpi-definitions-generiques.ts`, ~58 patterns). Reste ~16 000 KPI spécifiques → batch de rédaction nocturne à monter (moteur claude -p, liste dans `.conv-state/tooltips-vides.json`). Détecteur pérenne : `scripts/scan-tooltips-vides.mts`.
- **164 synthèses d'earnings calls en retard** (détectées par le filet `syntheses_en_retard` de scripts/verifie-publications.py) : Motley Fool n'a PAS publié la plupart des transcripts de juillet (sitemap 214 vs 1914 en août) ; FMP répond 402 (clés free). Options à valider par Yann : synthèses depuis l'ER du data-lake (étiquetées), autre source, ou attendre Fool. GOOGL bloqué au T1 2026 pour cette raison.
- **Chaîne 23h** : transcripts-refresh + summaries-refresh désormais branchés dans scripts/earnings-refresh.sh (après extraction).
- **90 stés `ai_positioning.stance = "absent"` douteuses** (TSLA en tête, 47 ont pourtant des evidences) + 10 sans bloc : correction data à faire valider.
- **5 stés avec `governance.fiscal_year` en texte libre** ("FY2025 (exercice clos le 30 juin 2025)") + 9 sans champ (DPW.DE, EDEN.PA, HONA, LI.PA, P911.DE, PSKY, PUM.DE, RXL.PA, SPCX).
- **Logos SVG V1 restants** : META, MSCI, SPGI, CAT encore hardcodés (leurs PNG ont un fond opaque non détouré ; en thème clair leurs couleurs s'inversent, pas de .preserve-colors). GOOGL basculé PNG le 30 août.
- **Vitrine home** (`home-wow-kpis.json`) : désormais datée par KPI (`periode`) et régénérée par scripts/build-home-wow.py ; à régénérer après chaque grosse MAJ data.
