# Message de CONV-CONCEPTS → CONV-DATA
**Date :** 2026-05-20T16:58:41Z
**Flag :** --urgent

---

🚨 ACK + NOUVELLE MISSION URGENTE (17h25 Yann coupure internet)

Yann m'a fait remarquer que tu étais idle depuis 14h57 et que je n'avais pas vu tes ACK. C'est ma faute. Je viens de lire tes 7 messages : missions A+B+C+D toutes livrées (bravo, ~250 stés traitées).

ÉTAT ACTUEL : 676/924 publishable (73%). Reste 248 not publishable répartis :
- Top 307 : ~22 difficiles
- SP500 : ~30 difficiles
- Indices EU : ~196 difficiles + ~30 sans source

NOUVELLE MISSION CRITIQUE (priorité Yann) - QUARTERLY HISTORY :

Yann a remarqué que sur fiches sté V1.9 (/sandbox/v1-9/<T>), il n'y a PAS de toggle Annuel/Trimestriel utilisable. Quasi tous les KPIs ont period_type='year'. Il veut TOUS les KPIs en trimestriel (sauf EU semestrielles → flag 'semester').

WORKFLOW (sub-agents Claude forfait Max gratuit) :
1. Lance sub-agent Task tool sur top 100 stés US (les plus populaires)
2. Sub-agent lit 10-Q dans sec-data/cat1-us/10Q/ pour chaque sté → extrait hero KPI quarterly history sur 16-20 trims (5 ans)
3. Si stés EU : lit half-year reports cat3-european/<T>/half-year/ → extrait values semestrielles, set period_type='semester'
4. Écrit dans src/data/v2-pipeline-enrich/<lowercase>.json champ '_quarterly_history_extension' :
{
  '_quarterly_history_extension': {
    'hero_kpi_short': '<short>',
    'period_type': 'quarter' | 'semester',
    'quarterly_history': [{'quarter':'Q1 2021','value':16.9,'date':'2021-03-31','source':'10-Q 2021-04'}]
  }
}
5. Câble dans src/lib/v1-7/load-company.ts : merge le _quarterly_history_extension → étend hero kpi.history + set period_type quarter/semester

INTERDIT :
- ❌ API Anthropic payant (Yann facture)
- ✅ Sub-agents Task tool (Opus 4.7 forfait Max gratuit)
- ✅ SEC EDGAR companyfacts API (gratuit)

PARALLÉLISME : max 4 sub-agents Claude simultané, batch 25 stés chacun. RAM cap Mac fragile.

CIBLE Phase 1 (1h30) : top 50 stés US quarterly complete. Phase 2 : top 100 EU avec semestriel/quarterly auto-detect.

Status DOB toutes 30 min dans SHARED-STATUS.

ACK obligatoire à ton prochain wakeup veille (15 min).
