# Note session 25 juil 2026 ~05h40
- 166/503 done. Etat fiable dans kpi-v3-state.json.
- 5 agents Opus encore en vol au moment du stop: PSX, AEP, DASH, ECL, HOOD (leurs resultats arriveront; marquer done apres verif lint 0 rouge, sinon relancer selon regle handoff).
- WBD retire d'in_progress (non lance).
- Parallelisme valide: 6 agents OK sur ce Mac (free ~75%, swap ~4 Go, seuils: libre <12% ou swap >4,6 Go).
- Discipline qualite: relance corrective si point differe/hors scope/faible PV alors que la donnee est locale (methode: differences de cumuls YTD, controle somme segments = consolide).

- A signaler a Yann (validation requise, couche canonique): src/data/v2-pipeline/fix.json contient une story 'Record Annual EPS 4,09 $' erronee (reel FY2024 = 14,60 $ verbatim communique 19 fev 2026). Non corrige (regle 0nonies).
- A signaler a Yann: v2-pipeline/mco.json contient un 'Backlog MA 4,9 Mds $' sans source SEC verifiable (0 occurrence backlog dans 10-Q/ER 2026). Non modifie (regle 0nonies).
