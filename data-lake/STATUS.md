# STATUS data-lake (avancement)

Dernière maj : 2026-06-12

## FAIT (0-token, plafond atteint — un re-run n'ajoute rien)
- financier (XBRL)              : 563 stés
- segments / mid-range annuel   : 374 stés   (data-lake/<T>/kpis/)
- trimestriel (toggle)          : 386 stés   (data-lake/<T>/kpis_q/)
- gouvernance / actionnariat    : 252 stés   (data-lake/<T>/governance/)

## À FAIRE (travail "token")
- [ ] **KPI HAUT DE GAMME** (hero + stories) → `data-lake/<T>/hero/extracted.json`  [PRIORITÉ]
      source : tableaux 8-K (communiqués résultats) + ES/ER (~19 stés) ; résidu prose = LLM gratuit + citation
- [ ] **Branchement** data-lake → pages (+ gate "complète") : laisser en staging, validation Yann
- [ ] (plus tard) élargir segments banques/mono, rému CEO, Q4 calculé
- [ ] PAS d'EU

## Journal (ajouter 1 ligne par palier)
- 2026-06-12 : base 0-token livrée (financier 563 / segments 374 / trimestriel 386 / gouvernance 252). Reste = haut de gamme + branchement.

## CAC 40 docs (2026-06-12)
- 38/40 vérifiés complets + propres (anti-cross-pollution OK).
- MT.PA : 5 × 20-F SEC vérifiés (ArcelorMittal).
- 10 docs cross-pollués détectés + mis en QUARANTAINE (sec-data/cat3-european/_quarantine_cac40/) : 0 gardé.
- RESTE 2 : ORA.PA (Orange) + DG.PA (Vinci) à 4/5 docs vérifiés. Le 5e = URD orange.com / vinci.com (PAS de dépôt SEC). DDG donne du garbage -> à récupérer proprement via IR FR direct pendant le build EU (post-lundi).
