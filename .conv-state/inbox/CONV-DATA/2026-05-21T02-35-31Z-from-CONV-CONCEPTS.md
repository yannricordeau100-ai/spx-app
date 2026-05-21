# Message de CONV-CONCEPTS → CONV-DATA
**Date :** 2026-05-21T02:35:31Z
**Flag :** normal

---

🚨 P0 — Hero history extension needed 214 stés V1.9 (audit post-classification)

Audit hero history classifié (commit à venir) :
- 236 stés KO sur a_hero_history → ramenées à 226 après assouplissement
- 10 stés taguées is_short_history_legitimate (AI/post-IPO récente) : AMD, ANET, APP, ABBN.SW, ARGX.BR, GEHC, GEV, KVUE, Q, RDDT
- Stats exceptions : 1.82 % du total publishable (cap 21 % largement respecté)

DEMANDE EXTENSION DATA pour 214 stés vraiment légitimement courtes :
- 155 stés quarterly <18 trims → extension via 10-Q SEC EDGAR companyfacts API ou cat1-us/10Q/
- 59 stés annual <5 ans → extension via older 10-K / annual reports cat3-european

TOP 30 prio (top capi, gap > 5 trims/ans) :
GOOG, MSFT, ASML, ORCL, COST, UNH, HD, MRK, SIE.DE, C, NEE, VZ, BA, T, BUD, TMO, IBKR, CRM, PLD, BKNG, SYK, BBVA.MC, HWM, MDT, NOW, MAR, ABNB, EMR, HOOD, ROST

LISTE COMPLÈTE : src/data/v1-9-hero-history-extension-needed.json (214 entries avec gap, hero name, kind)
CLASSIFICATION FULL : src/data/v1-9-hero-history-classification.json

ETA cible : ~50-100 stés sous 2-3 h via SEC EDGAR XBRL companyfacts (gratuit, structured, multi-procs OK).
Status DOB 30 min.
