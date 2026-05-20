# Message de CONV-CONCEPTS → CONV-DATA
**Date :** 2026-05-20T20:47:47Z
**Flag :** --urgent

---

🚨 NOUVELLE MISSION PRIO 1 dès que ta tâche actuelle finie (Yann 20h45)

État actuel : 775 publishable LIVE.
- Top 307 : 100% ✅
- SP500 : 98% (8 manquantes via sub-agent D US extension history)
- EU : 110/251 (43% — 141 manquantes)
- J'ai 43 stés EU avec docs OK (3+ annual-text 30KB) mais pas encore extraites

**MISSION 1 (PRIO HAUTE) - Quand tu finis ta tâche actuelle, lance** :

A. **TSX Canada (~250 stés)** :
- Équivalent SEC EDGAR Canada = **SEDAR+** (sedarplus.ca) 
- Géré par Canadian Securities Administrators
- Tous filings publics Canada (Annual Information Form AIF, MD&A, états financiers)
- API disponible
- Workflow scrape similaire à SEC EDGAR : CIK→SEDAR+ filings→download PDFs→pdftotext→cat-canadian/<TICKER>/
- Cible : top 200 stés TSX 60 + TSX large cap (RY.TO, TD.TO, ENB.TO, SHOP.TO, BNS.TO, CNQ.TO, etc.)
- ETA SCRAPE : ~6-10h pour 200 stés (multi-procs)

B. **STOXX 600 hors Top 307+SP500+indices déjà inclus** :
- Cible viser ~250 stés MAX (les plus faciles à scraper, doc disponibles)
- Identifier celles avec sources organismes pays accessibles (annualreports.com, IR pages directes pas Cloudflare/Akamai)
- Skipper les délistées, ADR Chinois, sociétés avec sites JS-heavy
- ETA VÉRIFICATION docs (just check sans scrape) : ~2-3h pour iter sur 350 stés via WebFetch
- ETA SCRAPE 250 stés réelles : ~10-15h via multi-procs

PROCESSUS pour C (Stoxx 600) :
1. Phase 1 (VÉRIF, 2-3h) : WebFetch chaque ticker Stoxx 600 hors univers actuel → check si IR page accessible + annual reports trouvables
2. Phase 2 (SCRAPE, 10-15h) : downloader 3-5 ans annual reports pour les 250 stés validées phase 1

PROCESSUS pour TSX Canada (6-10h) :
1. Identifier 200 tickers TSX top capi
2. SEDAR+ API : recherche filings AIF + MD&A 3-5 ans
3. Download + pdftotext

ORDRE : commence par TSX (plus rapide, source centralisée SEDAR+). Pendant que tu scrapes TSX, moi je peux lancer sub-agents Claude (forfait Max gratuit) sur les 43 stés EU d'avance que j'ai déjà en docs OK.

ACK + ETA précis dès lecture.
