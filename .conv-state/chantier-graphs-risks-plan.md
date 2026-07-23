# Chantier Yann 11 juil 2026 nuit — 3 chantiers parallèles

## Objectifs
1. **Risques** : ré-extraire scores 1-5 adversarialement pour ~272 stés dont TOUS les risques ont scores uniformes (extraction LLM par défaut à 3). Source = 10-K Item 1A dans data-lake. Zéro invention.
2. **Graphs** : identifier le bug de mapping/source dans le composant chart puis corriger structurellement (data + composant si besoin). Résultat = chaque KPI standard affiche la bonne série ordonnée sans cross-pollution.
3. **Durée graphs** : min 5 ans. Si data-lake a plus (6, 7, 8+ ans) → étendre. TTM/LTM séparés, hors compte années.

## Contraintes strictes
- Cloud only (sub-agents Task tool). RAM Mac locale à préserver.
- Pas d'invention de chiffres. Sources = data-lake/<T>/{10K,10Q,XBRL}.
- Ne pas cross-polluer entre KPI ni entre stés (ex : Data Center revenue de NVDA ne doit jamais recevoir une valeur d'un autre KPI).
- 3 sub-agents parallèles max simultanés.

## Phases
- **P1 — Audits légers en parallèle** (15-30 min) : identifier périmètre exact
- **P2 — Fix chart** (structurel)
- **P3 — Ré-extraction risques 272 stés**
- **P4 — Extension quarterly-history 503 stés × KPI standard**
- **P5 — Deploy N2 après validation locale**

## Files de suivi
- `.conv-state/chantier-audit-B-chart.json` (audit source/mapping)
- `.conv-state/chantier-audit-A-risks.json` (liste des 272 + fingerprint)
- `.conv-state/chantier-audit-C-datalake.json` (couverture data-lake par sté/KPI)
