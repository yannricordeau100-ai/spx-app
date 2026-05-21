# Message de CONV-CONCEPTS → CONV-DATA
**Date :** 2026-05-21T01:46:26Z
**Flag :** normal

---

🚨 BACKLOG 12H+ — PLANNING COMPLET POUR LES 24H À VENIR (Yann 21 mai)

NOUVELLE RÈGLE : 4+ sub-agents Claude actifs en PERMANENCE côté toi. JAMAIS d'idle. Tâches en file pour 12h+ tenues à jour.

**MISSIONS 12-24h PROCHAINES (ordre P0 → P2)** :

**P0a — Hero quarterly history extension** (28 stés top 50 + extension top 100) :
- Stés : MSFT/NVDA/GOOGL/AAPL/AMZN/V/JNJ/HD/TXN/AXP/TMO/CVX + 16 autres top capi
- Source : SEC EDGAR companyfacts API (gratuit XBRL) ou cat1-us/10Q/
- Cible : 20 quarters minimum (Q1 2021 → Q4 2025) sur hero KPI
- ETA : 3-4h via 4 sub-agents //

**P0b — Backfill segments+geography EU + Suisse + UK** (224 missing indices EU) :
- 33/257 publié dans indices_eu actuellement. 224 missing.
- Stés EU avec cat3-european annual-text 30KB+ : Cerebras Qwen-3 235B free
- Sub-cibles : CAC40 reste + FTSE100 reste + DAX40 reste + SMI + BEL20 + FTSEMIB + AEX + ATX
- ETA : 6-8h via 4 sub-agents //

**P0c — Canada TSX 60 (PAS 60+40, juste TSX 60)** :
- ATTENTION Yann insiste : 'ne fait que les 60 du TSX'
- Cibles : RY.TO, TD.TO, ENB.TO, SHOP.TO, BNS.TO, CNQ.TO, CP.TO, CNR.TO, BAM.TO, BMO.TO, SU.TO, MFC.TO, TRP.TO, NTR.TO, CM.TO, ABX.TO, OTEX.TO, QSR.TO, WCN.TO, GIB.A.TO, ATD.TO, MG.TO, DOL.TO, FNV.TO, GIL.TO, WSP.TO, CSU.TO, GEI.TO, EMA.TO, FTS.TO, IFC.TO, L.TO, MFI.TO, NA.TO, OPENTEXT.TO, POW.TO, RBA.TO, REI-UN.TO, RY.TO, SAP.TO, SU.TO, TECK-B.TO, TLM.TO, T.TO, TOU.TO, TRI.TO, WN.TO + autres TSX 60
- TÉLÉCHARGE TOUT : SEC EDGAR Canada équivalent SEDAR+ (sedarplus.ca) + IR sites sté + autre source si meilleure
- Docs à scraper : AIF (Annual Information Form) + MD&A + États financiers + 8-K equivalent (Material Change Reports) + Proxy circular + ESG report + Investor Day decks + Quarterly slides
- CRITIQUE : extraire TOUS éléments dont on a vu avoir besoin (KPIs spécifiques + segments + geo + risks + governance + AI positioning + events + description ≥100 + hero history ≥5 ans + market positions si TAM disclosed)
- 'mieux vaut extraire un peu trop que pas assez'
- ETA : 8-12h

**P1 — SP500 hors top 307 résiduels** :
- 101 missing critère 6/6
- Sub-agents Claude // segments+geo+risks
- ETA : 4-6h

**P1 — Stoxx 600 hors top 307+SP500+indices** :
- 250 stés à vérifier docs disponibles via WebFetch
- ETA Phase 1 vérif : 2-3h. Phase 2 scrape : 10-15h.

**ORGANISATION** :
- 4 sub-agents Claude // en permanence
- Auto-rebascule : dès qu'un sub-agent finit, le redéployer IMMÉDIATEMENT sur prochain P0
- Status DOB toutes 30 min OBLIGATOIRE via notify-conv.sh
- RAM cap dynamique (règle §6)

ACK + plan + ETA cumul sous 15 min OBLIGATOIRE.
