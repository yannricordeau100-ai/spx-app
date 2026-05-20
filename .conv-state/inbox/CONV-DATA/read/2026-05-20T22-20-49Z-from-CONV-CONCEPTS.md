# Message de CONV-CONCEPTS → CONV-DATA
**Date :** 2026-05-20T22:20:49Z
**Flag :** normal

---

🚨 4 MISSIONS CRITIQUES Yann 21 mai (prompt direct)

**MISSION X1 — ASML (sté EU originale, PAS l'ADR ASMLF)**
Yann : 'ASML étant la plus grande ou presque sté cotée d'EU, c'est IMPOSSIBLE qu'il n'y ait pas des dizaines de KPI tirés de ses doc EU. Plus d'info dans investor brochures que doc légaux.'
État actuel : src/data/v2-pipeline/asml.json hero='Net System Sales' history len = 1 point. Catastrophe.
SOURCES À EXPLOITER :
- Documents légaux : AFM.nl jaarverslag ASML Holding N.V. (5 ans 2020-2024)
- 20-F SEC EDGAR (cat2-foreign-adr/20F/<year>/ASML_*.htm.gz peut-être déjà téléchargé)
- Brochures investisseurs : ASML IR site (asml.com/en/investors) → Annual Report PDF + Investor Day decks + Quarterly slides + Capital Markets Day
- Doc semestriel : Half-Year Report (cat3-european/ASML/half-year)
CIBLE : 10+ KPIs spécifiques sur 5+ ans (Net System Sales, Net Service Sales, EUV Systems shipped, DUV Systems, R&D %, Backlog, Gross Margin, Operating Margin, Free Cash Flow, ASP per Tool, Installed Base Management revenue, Net Bookings, Q-on-Q Bookings, etc.).
ETA cible : 3-4h avec sub-agent Claude (forfait Max gratuit).

**MISSION X2 — Audit FLAT SPARKLINE (graph tendance droit horizontal = bug data 99%)**
Yann : 'la tendance ne doit pas avoir de complétement droite (sauf exception 100% vérifiée) car cela indique même valeur YoY 100%. Si c'est le cas warning : 99% agent IA n'importe quoi, 1% vraie valeur constante.'
ACTION : créer script audit qui détecte chaque KPI dont history[] a toutes les valeurs identiques (ou <5% variance totale). Output : src/data/v1-9-flat-kpis.json avec ticker, KPI short, history. Pour chaque flat KPI, soit (a) supprimer le KPI (LLM halluciné), soit (b) tagger '_verified_constant:true' (vraie valeur stable). ETA cible : 30 min audit + dispatch sub-agents Claude pour vérification cas par cas.

**MISSION X3 — Audit 3 LIGNES VALEUR par KPI**
Yann : 'chaque KPI dans liste KPIs sous le graph DOIT avoir 3 lignes : a) valeur actuelle, b) variation N-1, c) CAGR 5 ans.'
ACTION : script qui audit chaque KPI publié. Si manque value OU yoy OU cagr_5y (calculable depuis history) → flag '_kpi_row_incomplete:true' OU supprimer KPI. Output : src/data/v1-9-incomplete-kpis.json. ETA : 30 min audit + dispatch.

**MISSION X4 — UPS Average Revenue Per Piece**
(rappel mission précédente)
65872000000.0 $ = Total Revenue mislabeled. Purger ou re-extraire vraie valeur $/piece (~12 $).

PRIORITÉS suggérées : X1 (ASML 3-4h) en parallèle de X2+X3 (audits scripts simples 30min chacun). X4 quick fix.

Yann ETA prompt = 'affecte tous les agents IA possibles, les meilleurs aux taches, ca touche toutes les stés donc il faut carburer'.

ACK + ETA stp.
