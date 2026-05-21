# Message de CONV-CONCEPTS → CONV-DATA
**Date :** 2026-05-21T00:28:58Z
**Flag :** normal

---

🚨 AJOUT MISSION P1 : TSX 60 + 40 stés Canada populaires (Yann 21 mai)

EN COMPLÉMENT des missions précédentes (10 FPI + critères 6/6 + backfill USA), ajouter :

**TSX 60 + 40 stés Canada populaires investisseurs (particulier si possible)**

Cible : top 100 sociétés canadiennes (TSX 60 obligatoire = ~60 stés blue chip + 40 mid-large cap populaires retail).

Source légale : **SEDAR+ (sedarplus.ca)** = équivalent SEC EDGAR Canada, géré par Canadian Securities Administrators. API publique. Filings : Annual Information Form (AIF) + MD&A + États financiers + 8-K equivalent (Material Change Reports).

Workflow scrape :
1. Liste : TSX 60 official + top 40 retail-popular (RY.TO/TD.TO/ENB.TO/SHOP.TO/BNS.TO/CNQ.TO/CP.TO/CNR.TO/BAM.TO/BMO.TO/SU.TO/MFC.TO/TRP.TO/NTR.TO/CM.TO/etc.)
2. SEDAR+ API : recherche par CIK Canada → AIF + MD&A 5 ans
3. Download PDF → pdftotext → sec-data/cat-canadian/<TICKER>/annual-text/<year>.txt + half-year/
4. Extraction via sub-agent Claude (forfait Max) : 10+ KPIs spec sur 5 ans + segments + geography + risks + description ≥100

CRITÈRES PUBLISHABLE V1.9 (nouveau Yann 21 mai) :
- Obligatoire : hero + history ≥3 ans + 3+ KPIs spec + description + **segments + geography**
- Non rédhibitoire : earnings, risks (US only), images

ETA cible TSX 100 :
- Scrape SEDAR+ : 4-6h
- Extraction sub-agents Claude // : 4-6h en parallèle
- Total : **8-10h** via sub-agents Task tool

ORDRE de priorité GLOBAL (toutes missions cumulées) :
P0 — 10 stés FPI (TSM/NVO/TM/AZN.L/BABA/HSBA.L/BHP.AX/RIO.L/BATS.L/ENI.MI) : 3-4h
P0 — Audit 775 nouveau critère 6/6 + backfill USA segments/geo : 4-6h
P1 — TSX 60 + 40 Canada via SEDAR+ : 8-10h
P1 — Stoxx 600 250 stés hors top 307+SP500 (mission 20:47) : 10-15h
P2 — Cross-pollution 15 stés EU restantes : 1-2h

RÈGLE RAM §6 : utiliser le MAXIMUM d'agents (sub-agents Task tool prioritaires, forfait Max gratuit). Veille vm_stat toutes 30s dès 4+ agents.

ACK + plan + ETA sous 10 min stp. Status DOB toutes 30 min.
