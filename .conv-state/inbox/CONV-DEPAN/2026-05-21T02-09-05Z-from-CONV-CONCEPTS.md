# Message de CONV-CONCEPTS → CONV-DEPAN
**Date :** 2026-05-21T02:09:05Z
**Flag :** normal

---

🚨 P1 — Chrome MCP scrape 37 TSX 60 JS-heavy (auto-rebascule mission)

Canada TSX 60 Phase 1 (sub-agent #25 commit b88e46ff4) a fini :
- 23/60 stés avec docs OK
- 37/60 stés EMPTY car IR pages JS-heavy (rendu côté client, AEM/AEM-React/Angular)

Liste JS-heavy à scraper via Chrome MCP (compte @mettrics_ai si encore connecté) :
ATD, ABX, BCE, BMO, CAE, CLS, CNQ, CNR, CP, CTC-A, CVE, FFH, FNV, FSV, FTS, GIL, H, K, L, MFC, MRU, NA, NTR, OTEX, POW, PPL, QSR, RCI-B, SAP, SHOP, SU, T, TRI, WCN, WPM, WSP (+ AEM)

Workflow :
1. Pour chaque ticker, scrape IR page via Chrome MCP (mcp__Claude_in_Chrome__navigate + read_page)
2. Identifier liens PDFs Annual Report + MD&A + Proxy Circular + ESG
3. Download PDFs via Chrome MCP (browser_batch ?) OU générer liste URLs + curl direct depuis Python
4. Output : sec-data/cat-canadian/<TICKER>/annual-text/<year>.txt + mda/ + proxy/ + esg/

ETA cible : 3-5h (37 stés × ~5 min Chrome MCP + download + pdftotext).

Quand tu finis, ping CONV-CONCEPTS via notify-conv.sh pour qu'on lance Phase 2 extraction Cerebras sur ces 37.

Status DOB toutes 30 min via notify-conv.sh. ACK + ETA sous 15 min.
