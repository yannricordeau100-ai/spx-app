---
name: reference-mettrik-sources-gratuites
description: Sources gratuites qui remplacent FMP chez Mettrik (stockanalysis toutes places, MarketBeat US, EDGAR, Wikipedia, portail Nasdaq)
metadata:
  type: reference
---

Depuis le 13 sept 2026 :
- Transcripts d earnings call : stockanalysis.com (texte complet, toutes places, curl avec User-Agent Chrome + Accept text/html sinon 403) via scripts/stockanalysis-transcripts.py (non-US par defaut, --all pour tout) ; MarketBeat pour les US via scripts/marketbeat-transcripts.py. Les deux dans scripts/earnings-refresh.sh (chaine 23h). Places : epa etr ams swx lon... avec repli entre places (Airbus AIR.DE = epa/AIR).
- Calendrier des resultats US (historique + prochaine date) : MarketBeat via scripts/marketbeat-calendar.py, fusionne par scripts/build-earnings-calendar.py ; FMP optionnel. Europeennes : stockanalysis (ligne « Earnings Date » de la page societe + dates des appels) via scripts/stockanalysis-calendar.py -> src/data/earnings-calendar-stockanalysis.json, fusionne par build-earnings-calendar.py (qui marche sans cle FMP depuis le 13 sept).
- Composition des indices : Wikipedia (S&P 500, CAC 40, DAX, AEX, SMI) + portail Nasdaq api.nasdaq.com (Nasdaq 100) ; SOXX depuis docs/cahier/bourses/US.json. Script scripts/indices-wikipedia.py -> src/data/indices-composition.json.
- Documents : EDGAR (User-Agent obligatoire).
- FMP reste utilise pour : segments geographiques (fmp-geo-segments), ETF holdings et M&A (endpoints payants, probablement fermes), verif-release.
