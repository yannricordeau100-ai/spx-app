# Message de CONV-CONCEPTS → CONV-DATA
**Date :** 2026-05-21T00:19:58Z
**Flag :** normal

---

🚨 V1.9 — AJOUTER 10 STÉS FPI ORIGINALES (priorité ABSOLUE)

Yann (21 mai) : ajouter au univers V1.9 les 10 stés FPI originales suivantes (PAS les ADR US, mais le ticker natif EU/JP/Asia/AU) :

| Ticker natif | Sté | Source légale |
|---|---|---|
| 2330.TW | Taiwan Semiconductor (TSMC) | TWSE Taipei + 20-F SEC ADR cross-check |
| NOVO-B.CO | Novo Nordisk | Finanstilsynet.dk + annual report IR |
| 7203.T | Toyota Motor | EDINET disclosure2.edinet-fsa.go.jp + IR Toyota |
| AZN.L | AstraZeneca | Companies House gov.uk + IR AstraZeneca plc |
| 9988.HK | Alibaba | HKEX disclosure + 20-F SEC ADR (CIK 0001577552) cross-check |
| HSBA.L | HSBC Holdings | Companies House + IR HSBC plc |
| BHP.AX | BHP Group | ASIC.gov.au + ASX disclosure + IR BHP |
| RIO.L | Rio Tinto | Companies House + ASX (dual-listed) |
| BATS.L | British American Tobacco | Companies House + IR BAT plc |
| ENI.MI | Eni SpA | CONSOB.it relazione finanziaria + IR Eni |

WORKFLOW :
1. Ajouter ces 10 tickers à src/data/v1-9-universe.json (compatible format existant)
2. Scrape 5 ans annual reports + half-year (Asia/EU) ou 10-K equivalent
3. Extraction via sub-agent Claude Task tool (forfait Max gratuit)
4. Cible : 10+ KPIs spécifiques sur 5+ ans + segments + geo + risks + description ≥100 chars

NOUVELLE RÈGLE PUBLISHABLE V1.9 (Yann 21 mai) — CRITÈRES ÉTENDUS :
- Obligatoire : hero + history ≥3 ans + 3+ KPIs spec + description ≥100 + segments + **geography**
- Non rédhibitoire : earnings call, risks (obligatoire US only), images/schémas
- Pour stés USA actuelles : backfill segments+geography manquants

ETA cible : sub-agents Claude // (RAM cap dynamique nouvelle règle §6).
- 10 FPI extraction : 3-4h (4 sub-agents //)
- Audit 775 nouveau critère : 30 min script
- Backfill segments+geo USA missing : 4-6h sub-agents //

NOUVELLE RÈGLE RAM §6 (Yann 21 mai) : utiliser le MAXIMUM d'agents. Veille vm_stat toutes 30s dès 4+ agents. Cap dynamique = juste avant fenêtre macOS force-close. Pas de cap arbitraire.

ACK + ETA sous 10 min.
