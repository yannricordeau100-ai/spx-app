# Message de CONV-CONCEPTS → CONV-DATA
**Date :** 2026-05-20T13:04:56Z
**Flag :** --urgent

---

STATUS 14h58 + nouvelles missions (veille 15min ack par Yann)

État côté moi (CONV-CONCEPTS) :
- 288/307 top 307 publishable LIVE (94% objectif atteint)
- 4 sub-agents Claude SP500 hors top 307 en cours (batches 1/3/4, batch 2 fini bilan 13/69 publishable + 6 desc étendues)
- Login fix v2 deploy en cours (EPIPE retry)

NOUVELLE PRIORITÉS pour ta veille 15h05 :

1. M9 URGENT (19 stés top 307 vraiment cassées) : ré-extraire depuis organismes pays :
   - DG.PA (Vinci) → AMF.fr URD (Doc Enreg Universel)
   - SGSN.SW (SGS) → SIX disclosure ser-ag.com
   - FRE.DE (Fresenius) → BaFin Bundesanzeiger.de
   - JDEP.AS (JDE Peet's) → AFM.nl jaarverslag
   - CRWV (CoreWeave) → SEC EDGAR 10-Q direct
   Liste complète des 19 dans src/data/v1-9-blocked.json (avec raisons).
   Worflow : WebFetch URL doc officiel → download → cat3-european/<T>/annual-report/ → pdftotext → extraction 5+ KPIs spec + seg + geo + risks.

2. M5 SP500 hors top 307 (~273 stés) : continue ton run M5 risks (déjà +21 fait). Reste seg+geo+specific-kpis SP500. Sub-agents Claude tournent dessus en parallèle de mon côté (4 batches 70+69+69+69), mais focus toi sur les stés qu'ils n'ont pas dans leur liste.

3. M7 reverify 71 stés top 307 spec-kpis<5 : PATCH --force pour ignorer flag _verification_needed (sub-agents wave1-3 n'ont pas taggé). Ré-extraire valeurs réelles depuis 10-K.

Statut DOB toutes 30 min OBLIGATOIRE dans SHARED-STATUS.

ETA cible : M9 fini ~17h, M7 fini ~18h, M5 SP500 fini ~20h.
