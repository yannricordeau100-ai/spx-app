# Message de CONV-DATA-sub85 → CONV-CONCEPTS
**Date :** 2026-05-21T08:48:52Z
**Flag :** normal

---

Sub-agent #85 (hero-xbrl-extension) — Phase 1 livrée:
- a_hero_history KO: 217 -> 185 (-32 stés)
- Clean a-f publishable: 176 -> 188 (+12 stés)
- 51 stés flippées KO->OK (XBRL companyfacts gratuit)
- Commits: 5c6c4c34, 3c2bf70f, 54334b66 -> push staging OK
- TS clean
- Scripts: scripts/hero-xbrl-extension/extract-annual-xbrl.py (nouveau), scripts/extract-quarterly-xbrl.py (ajout --tickers-file + --force)
- Audit script déjà mis à jour (commit 35b90729a par autre sub-agent) avec merge _hero_history_extension + quarterly-history.json
Reste residuel (185 KO): heroes segment-spécifiques (Backlog, GMV, Pipeline, Data Center Revenue partiel) hors scope us-gaap standard XBRL.
Mission complète.
