# Spec complétion Q4 — TOUS les KPI secondaires (1130 KPI, 327 stés)

Objectif : chaque KPI trimestriel promouvable en principal doit avoir une vue
annuelle fonctionnelle (≥1 FY complète, idéalement toutes les FY couvertes par
sa série trimestrielle). Même méthode éprouvée que les 90 héros.

## Où vivent les KPI
- `.batches-drafts-safe/kpis-haut/<T>.json` : source runtime des KPI (remplace
  tout au load). History = [{q:"Q1-2023"|"Q1-FY2023"|"FY2023", v}].
  Les entrées {q:"FY2023",v} déjà présentes donnent la valeur annuelle SANS
  ouvrir le 10-K (à privilégier).
- Compléments éventuels : `src/data/v2-pipeline-enrich/<t>.json` (history +
  history_periods + last_data_date).

## Méthode par KPI
1. Identifier les exercices où 3 trimestres existent sans le 4e.
2. Valeur FY : entrées FY du fichier → sinon 10-K data-lake (gunzip) →
   sinon xbrl/facts.json → sinon 8-K EX-99.1 (résultats Q4) → sinon EDGAR
   (UA "Mettrik research", throttle 0.5s).
3. Dérivation :
   - FLUX (revenus, volumes, unités, bookings) : Q4 = FY − somme des 3 autres.
     Plausibilité obligatoire (ordre de grandeur des autres trimestres ;
     négatif → rejeter sauf justification réelle).
   - TAUX / STOCK / fins de période (marges %, comp sales %, AUM, backlog,
     comptages) : Q4 = valeur trimestrielle publiée (8-K/10-K MD&A Q4) ;
     à défaut pour un stock pur : valeur de fin d'exercice du 10-K.
   - Débits journaliers/moyennes (PRASM, ADV, /d) : Q4 = 4×FY − somme des 3.
4. Labels : respecter le format existant de la série ("Q4-2023" ou "Q4-FY2023").
   Fiscal décalé (FY juin/juillet/octobre/janvier) : mapper correctement.
   Normaliser les labels cassés rencontrés (Q#-FY17 → Q#-FY2017 ; FQ# → Q#-FY####).
5. Si le libellé du KPI n'est pas reconnu par getKpiAggregationKind
   (src/lib/kpi-aggregation.ts STOCK_PATTERNS / STOCK_UNIT_PATTERNS) : ajouter
   le pattern (plusieurs déjà ajoutés : AUM/AUA, PRASM, per piece, /d, per sq ft).
6. FY introuvable OU incohérente → SAUTER cet exercice (zéro invention). Un KPI
   structurellement récent (série < 4 trimestres, segment créé récemment)
   reste tel quel : le bouton Annuel grisé est alors LÉGITIME.
7. Si une série est manifestement corrompue (valeurs incohérentes vs filings) :
   la reconstruire entièrement depuis les 10-Q/10-K/8-K comme fait pour KR.

## Auto-vérification OBLIGATOIRE par sté (pas par KPI un à un)
```bash
cd /Users/yann/spx-app && npx tsx -e "
import fs from 'node:fs';
import { loadV17Company } from './src/lib/company-core/load-company';
import { buildChartSpec } from './src/lib/chart-template';
(async()=>{
  for (const t of ['T1','T2']) {  // tes tickers
    const o=await loadV17Company(t,{mode:'v18'}); if(o.kind!=='ready')continue;
    let empty=0,total=0;
    for (const k of (o.company.kpis??[])) {
      if ((k as any).is_short_history || (k as any).period_type!=='quarter' || !(k.history??[]).length) continue;
      total++;
      const s=buildChartSpec(k as any,t,'year') as any;
      if((s.values??[]).length===0) empty++;
    }
    console.log(t, empty+'/'+total, 'vides');
  }
})();"
```
Objectif : 0 vide par sté, sauf KPI structurellement récents (à lister dans la réponse).
