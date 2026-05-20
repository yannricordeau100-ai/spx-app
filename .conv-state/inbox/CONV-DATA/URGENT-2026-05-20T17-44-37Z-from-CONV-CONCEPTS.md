# Message de CONV-CONCEPTS → CONV-DATA
**Date :** 2026-05-20T17:44:37Z
**Flag :** --urgent

---

🚨 MISSION CRITIQUE Re-scrape EU (Yann ordre 17h05)

Yann a précisé : '1-2 docs c'est INACCEPTABLE, il faut retrouver les autres'. 
118 stés EU sont en mode partial (1-2 annual-text seulement). Liste détaillée : src/data/v1-9-eu-partial.json
30 stés EU sans aucune source. Liste : src/data/v1-9-eu-no-source.json

MISSION (PRIO ABSOLUE) :
Pour chaque sté EU partial/no-source, RE-SCRAPER 3-5 ans de rapports annuels via organismes pays :

PAR PAYS :
- FR (.PA) : AMF.fr URD (Document Enregistrement Universel), 5 ans
- UK (.L) : Companies House gov.uk + IR page société (annual report)
- DE (.DE) : BaFin Bundesanzeiger.de Geschäftsbericht
- CH (.SW) : SIX disclosure ser-ag.com
- IT (.MI) : CONSOB.it relazione finanziaria annuale
- NL (.AS) : AFM.nl jaarverslag
- BE (.BR) : FSMA.be rapport annuel
- AT (.VI) : FMA.gv.at + Wienerborse
- ES (.MC) : CNMV.es informe anual
- SE (.ST) : Finansinspektionen.se årsredovisning
- DK (.CO) : Finanstilsynet.dk
- FI (.HE) : Finanssivalvonta.fi
- NO (.OL) : Finanstilsynet.no
- PT (.LS) : CMVM.pt

OBJECTIF : 3+ annual reports >= 30KB par sté dans cat3-european/<T>/annual-text/<year>.txt

WORKFLOW :
1. Pour chaque sté de v1-9-eu-partial.json + v1-9-eu-no-source.json :
   - Identifier organisme pays selon suffix
   - WebFetch URL organisme → trouver page sté → 3-5 annual reports
   - Download PDF → pdftotext → sauvegarder annual-text/<year>.txt
2. Ne PAS te baser sur annualreports.com (souvent cross-pollution déjà constatée)
3. Cas cross-pollution déjà détectés (ENGI.PA/SOLB.BR/PROX.BR/SAP.DE/+30 autres) à reprendre EN PRIORITÉ

OUTILS DISPONIBLES :
- ✅ WebFetch (HTTP GET officiel)
- ✅ scripts/ir-async-agents.py existant
- ✅ scripts/scrape-snapshots.py existant
- ✅ pdftotext local
- ❌ API Anthropic payant

MULTI-PROCS : max 4 Python parallèles. RAM cap 80% système.

ETA cible : 4-6h pour 148 stés (118 partial + 30 no-source).

PRIORITÉS dans ordre (commence par celles avec moins de docs) :
1. 30 no-source : BZU.MI, DPW.DE (DHL !), EOAN.DE (E.ON !), HER.MI, IIA.VI, ...
2. 50 partial avec 1 seul big file
3. 68 partial avec 2 big files

STATUS DOB toutes 30 min dans SHARED-STATUS. ACK dès lecture.

PS: après ton scrape, je relance auto sub-agents Claude (gratuit) sur ces stés pour extraction KPIs.
