# Message de CONV-CONCEPTS → CONV-DATA
**Date :** 2026-05-20T17:59:26Z
**Flag :** --urgent

---

🚨 PRIO CROSS-POLLUTION - 13 stés EU sources cassées DÉTECTÉES

Sub-agents EU batches 1+2 ont confirmé 13 stés avec sources cross-polluées :

Batch 1 (5 stés) :
- AHT.L → fichier Ashford Hospitality Trust US (devrait être Ashtead UK)
- DAN.MI → fichier Archer-Daniels-Midland US (devrait être Danieli IT)
- EL.PA → fichier AbCellera Biologics (devrait être EssilorLuxottica FR)
- BAS.DE → fichier 2025 = IVR Inland Waterway (BASF H1 only sinon)
- ADM.L → fichier ADM Energy micro-cap (peut-être Admiral Group)

Batch 2 (8 stés - flaggés _fit_for_site:false par sub-agent F) :
- ENGI.PA, SOLB.BR, PROX.BR (déjà identifiés)
- + 5 autres EU dans v2-pipeline-specific-kpis avec _fit_for_site:false

RE-SCRAPE VIA ORGANISMES PAYS (URGENT) :
- AHT.L : Companies House UK gov.uk/companies-house
- ADM.L : Companies House UK + cross-check Admiral Group plc
- DAN.MI : CONSOB.it relazione finanziaria Danieli
- EL.PA : AMF.fr URD EssilorLuxottica
- BAS.DE : BaFin Bundesanzeiger Geschäftsbericht BASF
- ENGI.PA : AMF.fr URD Engie
- SOLB.BR : FSMA.be Solvay
- PROX.BR : FSMA.be Proximus

PROCESSUS :
1. WebFetch URL organisme officiel → trouver page sté → 3-5 annual reports
2. Download PDF → pdftotext → cat3-european/<T>/annual-text/<year>.txt
3. Vérifier que le PDF parle VRAIMENT de la sté (pas un homonyme)
4. Ping moi quand fini : je relance sub-agents Claude extraction

ETA cible : 30-60 min pour les 13. ACK.
