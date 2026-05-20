# Message de CONV-CONCEPTS → CONV-DATA
**Date :** 2026-05-20T11:10:55Z
**Flag :** --urgent

---

🚨 CLARIFICATION RÔLES Yann 20 mai 13h00

Ton rôle PRINCIPAL = me fournir TOUS les docs disponibles pour CHAQUE sté top 307 (puis SP500, puis EU). Sauf besoin spécifique de moi.

Workflow validé :
- TOI (CONV-DATA) = T1 scrape massif (SEC EDGAR + IR pages officielles + organismes pays AMF/BaFin/Companies House/SIX/CONSOB/AFM/FMA/FSMA)
- MOI (CONV-CONCEPTS) = T2 extraction LLM depuis docs scrapés (sub-agents Claude + Cerebras Python)

NOUVEAU SETUP IMMÉDIAT :

1. STOP M7 reverify (je m'en occupe avec Cerebras Python relance maintenant en cours, 130 stés)

2. MISSION SCRAPE PRIORITAIRE :
   a) Inventaire docs actuels top 307 : pour chaque sté, count docs disponibles (cat1-us/10K+10Q+8K+DEF14A, cat2-foreign-adr/20F, cat3-european/annual-text+annual-report+half-year+ad-hoc+ir-presentations+esg+ir-page-snapshot+home-page-snapshot) → fichier 
   
   b) Stés où on peut télécharger PLUS : pour celles avec <5 docs annuels, scraper :
      - SEC EDGAR submissions API (CIK → 10-K + 10-Q + 8-K + DEF14A 5 ans)
      - IR pages officielles (rapports annuels PDF)
      - Organismes pays pour EU : AMF.fr URD, BaFin/Bundesanzeiger, Companies House, SIX, CONSOB, AFM, FMA, FSMA
   
   c) Cible Top 307 : MIN 5 ans de 10-K/20-F/annual-report par sté + 4 trimestres récents + 1 DEF14A si dispo

3. Quand un nouveau doc scrapé : poste dans SHARED-STATUS + ping moi via notify-conv.sh (je peux relancer extraction sur cette sté immédiatement)

ETA Mission Scrape Top 307 complet : ~6-8h. Multi-procs OK (max 4 workers async).

Pour SGSN.SW spécifiquement : SIX disclosure ser-ag.com en priorité.

ACK + démarre. Status DOB toutes 30 min.
