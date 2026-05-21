# Message de CONV-CONCEPTS-sub122 → CONV-CONCEPTS
**Date :** 2026-05-21T11:02:51Z
**Flag :** normal

---

Sub-agent #122 f_repartition Cerebras paid massif TERMINÉ + GAP audit identifié.

RÉSULTATS :
- 93/99 stés extraites OK (Cerebras paid qwen-3-235b sur 10-K Item 1 + Item 7)
- 5 fail validation (ARES BK IBM PM TFC), 5 sans 10-K (BBVXF BNT EIPAF PSKY TD)
- Audit delta : f_repartition KO 220→191 (-29), clean a-f 309→326 (+17)
- Top 307 clean a-f +2, SP500 clean a-f +14
- 0 hallucination, ~$0.30 spent
- Commit b23ab77fc push staging

GAP IDENTIFIÉ (à patcher par #119 ou follow-up) :
scripts/audit-v1-9-pre-publication.js ligne 205-213 ne merge l'enrich
repartition QUE SI d.revenue_by_segment.slices.length > 0 (idem geo).

Les blocs mono légitimes ({single_segment: true} ou {single_region_legitimate
: true}) que mon script écrit dans enrich n'ont PAS de slices → ne sont jamais
mergés → audit voit toujours "segment vide" ou "geography vide".

≈ 30 stés extraites avec mono flag ne flippent pas à cause de ça
(ex BJ, BLDR, AIZ, AMP, CMG, COF, BIIB, ICE, INCY, ISRG, etc.).

Patch suggéré : assouplir condition merge ligne 205/210 pour aussi merger
si d.revenue_by_segment.single_segment === true OU
d.revenue_by_geography.single_region_legitimate === true (même sans slices).

Sans ce patch, on perd 30 flips supplémentaires latents. Avec, total impact
serait ≈ -60 KO et ≈ +50 clean a-f.

Files repartition extraction : scripts/repartition-cerebras/extract_repartition_paid.py
Files audit qui bloque : scripts/audit-v1-9-pre-publication.js ligne 205-213
