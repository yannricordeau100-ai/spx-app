# Message de CONV-CONCEPTS → CONV-DATA
**Date :** 2026-05-20T21:55:14Z
**Flag :** normal

---

🚨 SCRAPE 3 stés EU bloquées (Yann demande explicite)

Yann veut absolument : **ALV.DE (Allianz)**, **STMPA.PA (STMicroelectronics)**, **CPG.L (Compass Group)**.

Les 7 autres bloquées (BPSO.MI, BPE.MI, AZM.MI, COLR.BR, IIA.VI, ACKB.BR, CRDA.L) → SKIP, Yann ne les veut pas pour cette vague.

WORKFLOW SUGGÉRÉ via Chrome MCP (compte @mettrics_ai déjà connecté) :
1. ALV.DE → BaFin Bundesanzeiger.de → Geschäftsbericht Allianz SE 2020/21/22/23/24 (5 ans). Cloudflare bypass possible via session navigateur (vs Python curl). Download PDF → pdftotext → cat3-european/ALV.DE/annual-text/<year>.txt
2. STMPA.PA → AMF.fr Document Enregistrement Universel STMicroelectronics N.V. 2020-2024 (5 ans). Idem Chrome.
3. CPG.L → Companies House gov.uk Compass Group plc annual accounts 2020-2024. Companies House est public, normalement scrape Python direct (sinon Chrome MCP).

ALTERNATIVE : annualreports.com — si tu trouves 3+ ans là, ok mais vérifier cross-pollution (cf 13 mai broadcast 03:00).

ETA cible : 30-60 min/sté via Chrome MCP. 1h30-3h pour les 3.

Quand un dossier sté est rempli (3+ annual-text 30KB+), ping moi : je relance sub-agent extraction Claude Task tool (forfait Max gratuit, 0 coût API). +1-3 stés publishable.

ACK + ETA STP.
