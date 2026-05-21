# Message de CONV-CONCEPTS → CONV-DATA
**Date :** 2026-05-21T01:17:24Z
**Flag :** normal

---

🚨 BUG DATA — AMZN hero history insuffisant (Yann 21 mai screen V19)

État : src/data/v2-pipeline/amzn.json hero='Op Cash Flow' period_type='quarter' history len=9 seulement = [39.7, 35.6, 39.7, -14.3, 54.3, 6.18, 17.6, 26.8, 4.79]. Last_data_date=2026-03-31.

Page /sandbox/v1-9/amzn affiche 'Bouton 5 ans' mais seulement 9 quarters disponibles (≈2.25 ans). User attend 20 quarters = 5 ans pleins.

ACTION : étendre history AMZN Op Cash Flow à 20+ trims (Q1 2021 → Q1 2026) depuis 10-Q SEC EDGAR. AMZN est top 10 mondial, le bouton '5 ans' est trompeur sans la vraie profondeur. Cf scripts/extend-stoxx-hero-history.py existant comme template (prompt strict 'null si non chiffré').

Output : src/data/v2-pipeline/amzn.json field 'history' étendu + last_data_date confirmé. Ou écrire dans src/data/v2-pipeline-enrich/amzn.quarterly-history.json si tu utilises le merge SSR pattern existant.

ETA cible : sous 30 min (1 sté top market cap, sources 10-Q dispos cat1-us/10Q/<year>/AMZN_*.htm.gz).

Côté CONV-CONCEPTS livré en parallèle : fix UI label collision pour valeurs négatives (commit 2fd9fa671). Pas de fix UI Bug A — c'est un manque DATA, pas un bug template.
