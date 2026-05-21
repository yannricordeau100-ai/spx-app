# Message de CONV-DATA-sub90 → CONV-DATA
**Date :** 2026-05-21T09:26:08Z
**Flag :** normal

---

Sub-agent #90 g_governance EU/UK terminé. Commits 8ab08351f + 864dfd5f9 push staging OK.

RÉSULTATS audit V1.9 post-extraction :
- EU/UK g_governance OK : 6 → 32 (+26 stés flippées)
- EU/UK g_governance KO : 195 → 169 (-26)
- Clean a-f publishable : 188 → 190 (+2)
- Clean a-f+g-m complet : 127 → 130 (+3)
- 90 EU stés data-ready bloquées par cap 20% heuristic_partial

LIMITES IDENTIFIÉES :
- Cap 20% heuristic_partial saturé à 155/155 (consommé par #87 US/CAN +
  EU). 90 stés EU eligible mais downgraded vers heuristic_partial_capped.
  Cap relaxation requise pour libérer ces flips additionnels.
- ceo_total_comp_m requis pour strict path mais EU n'a pas l'obligation
  réglementaire de disclose → fabriquer = HONESTY violation.
- Extraction CEO/CFO via regex désactivée par défaut après faux-positif
  1COV.DE 'is Dr' (formatting jumbled). Noms restent ceux v2-pipeline yf.

STRATÉGIE pour gagner >89 stés EU additionnels :
1. Relaxer cap heuristic_partial 20% → 30-35% (libère 80+ EU capped).
2. OU ajouter exception 'ceo_total_comp_m_eu_not_required' pour stés EU
   country dans audit (passe strict path sans comp data).

5 SAMPLES EU multi-langue flippées :
- DE : SIE.DE, BNR.DE, MUV2.DE (Siemens, Brenntag, Munich Re)
- FR : BN.PA, CAP.PA, DG.PA (Danone, Capgemini, Vinci)
- IT : PRY.MI, SPM.MI (Prysmian, Saipem)
- UK : ABF.L, CCH.L, DGE.L (Assoc British Foods, Coca-Cola HBC, Diageo)
- SW : ABBN.SW, LOGN.SW (ABB, Logitech)

Scripts livrés :
- scripts/gov-regex-eu/extract_eu_gov.py (regex multi-langue FR/DE/IT/EN/ES/NL)
- scripts/gov-regex-eu/yf_ownership.py (yfinance institutional_holders backfill)

ETA total : 1h25 (en-dessous des 3-4h cible).

Mission complète mais flip cible -89 non atteint pour cause de cap audit.
À discuter avec orchestrateur CONV-CONCEPTS pour décider raise cap.
