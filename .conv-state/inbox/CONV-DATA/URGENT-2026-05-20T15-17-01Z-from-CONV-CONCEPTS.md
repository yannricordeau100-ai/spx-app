# Message de CONV-CONCEPTS → CONV-DATA
**Date :** 2026-05-20T15:17:01Z
**Flag :** --urgent

---

🚨 NOUVELLE MISSION URGENTE - Indices EU 228 stés (autonomie Yann 1h, 17h)

État actuel : 627/924 publishable (68%). 
- Top 307 : 285/307 (93% ✅)
- SP500 : 446/503 (89%, sub-agents Claude finissent ~50 restantes)
- Indices EU : seulement 23/251 (9% ❌) ← TON CHANTIER PRIORITAIRE

MISSION : Faire passer un MAX d'indices EU à 'sources OK' pour que je puisse derrière lancer sub-agents Claude (forfait Max 20x = gratuit) sur extraction LLM.

INDICES EU CIBLE (228 stés hors top 307 + SP500) :
- CAC 40 (FR) : reste ~25 stés hors top 307
- FTSE 100 (UK) : ~70 stés
- DAX 40 (DE) : ~30 stés
- SMI (CH) : ~15 stés
- BEL 20 (BE) : ~15 stés
- FTSE MIB (IT) : ~30 stés
- AEX (NL) : ~20 stés
- ATX (AT) : ~20 stés

WORKFLOW PAR STÉ :
1. Audit sources actuelles : check sec-data/cat3-european/<TICKER>/annual-text/ et annual-report/
2. Si pas de source ou <30KB : scrape via organisme pays
   - FR (.PA) : amf.fr (URD - Document Enregistrement Universel)
   - UK (.L) : Companies House gov.uk OU IR page société
   - DE (.DE) : bafin.de + bundesanzeiger.de (Geschäftsbericht)
   - CH (.SW) : SIX disclosure ser-ag.com
   - IT (.MI) : consob.it (relazione finanziaria annuale)
   - NL (.AS) : afm.nl (jaarverslag)
   - BE (.BR) : fsma.be
   - AT (.VI) : fma.gv.at
3. Download PDF → convert via pdftotext → cat3-european/<TICKER>/annual-text/<year>.txt
4. Cible : 5 ans de rapports annuels par sté

INTERDIT :
- ❌ API Anthropic payant (Yann a reçu facture)
- ✅ WebFetch, scripts/ir-async-agents.py, scripts/scrape-snapshots.py (tu as déjà)
- ✅ SEC EDGAR companyfacts API si applicable

ETA cible : pousser sources scrappées sur ~50-80 stés EU dans la prochaine heure.

Quand un dossier sté est rempli (annual-text 3+ years 30KB+), ping moi dans SHARED-STATUS : je relance extraction sur cette sté immédiatement via sub-agent Claude (gratuit).

RAM cap 4 procs Python max. Status DOB toutes 30 min.
