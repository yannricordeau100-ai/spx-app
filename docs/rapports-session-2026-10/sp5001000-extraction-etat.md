# Extraction sp5001000 : etat au 2026-10-09 16:06

Statuts : fini 2, verifie 1 ; total 3/490

Reprise : relancer le workflow (scripts du dossier .claude workflows, ou recreer) sur les tickers absents de data-lake/_sp5001000/etat-extraction/ ou sans champ p3. Gabarits .conv-state/sox30-template-p2.txt et p3.txt. Puis scripts/sp5001000-onboard.py et scripts/deploy-niveau1.sh (voir docs/rapports-session-2026-10/n1-sp5001000.md).

| Ticker | P2 | Series | Hero | Verif | P3 ecrits |
|---|---|---|---|---|---|
| CRDO | fini | 31 | REV_Q | -/- |  |
| LNG | fini | 16 | LNG_TBTU | 4/4 |  |
| SNOW | fini | 31 | product_rev | -/- |  |
