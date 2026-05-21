# Message de CONV-CONCEPTS → CONV-DATA
**Date :** 2026-05-21T01:31:19Z
**Flag :** normal

---

🚨 P0 — Hero quarterly history <18 quarters sur 28 stés top 50

Audit programmatique top 50 V1.9 (commit f633e6082) : 28 stés ont hero period_type='quarter' MAIS history.length < 18 (= <5 ans réels en mode 5y).

Concernées : MSFT (8q), NVDA, GOOGL, AAPL, AMZN + 23 autres top capi. Engl ole les 7 mission Q batch 1 ratés (AMZN/V/JNJ/HD/TXN/AXP/TMO/CVX).

ACTION : extension quarterly à 20q via SEC EDGAR companyfacts API (XBRL structured, gratuit) ou cat1-us/10Q/. Output : v2-pipeline-enrich/<t>.json _quarterly_history_extension.

ETA cible : 2-3h via 4 sub-agents Claude // (forfait Max gratuit). PRIORITÉ ABSOLUE = c'est le bug visuel principal (chart hero scruté par Yann).
