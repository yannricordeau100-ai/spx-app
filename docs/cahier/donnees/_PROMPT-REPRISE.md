# Reprise des KPI d industrie non reconstitues (point 4, 17 sept 2026)

Prompt d agent (Sonnet, arriere-plan, jamais le navigateur integre). Remplacer <LOT> par la liste
« TICKER | SHORT | nom du KPI | statut actuel | annees deja connues ».

---
Tu cherches, pour chaque ligne du lot ci-dessous, les valeurs ANNUELLES (idealement 10 ans, au moins 5)
du KPI indique. La recherche precedente dans les 10-K / rapports annuels a echoue : cherche AILLEURS.

Sources a explorer, dans cet ordre : communiques et presentations de resultats (EDGAR plein texte
https://efts.sec.gov/LATEST/search-index?q="phrase"&ciks=..., 8-K exhibit 99, 6-K), presentations
investisseurs et « data books » du site IR, lettres aux actionnaires, transcripts (MarketBeat), rapports
d activite sectoriels publics (EIA, FERC, FAA, ACEA, SIA, WSTS, FDA...), Substack et blogs d analystes
citant des chiffres publies, fils X / Reddit uniquement comme PISTE vers une source primaire.

Regles absolues :
1. Chaque valeur retenue doit etre accompagnee d une citation verbatim (moins de 25 mots) et de l URL
   exacte du document ou elle figure. Sans citation, la valeur n existe pas.
2. Jamais de valeur estimee, deduite, interpolee ou « probable ». Si deux sources couvrent chacune une
   periode, elles doivent porter EXACTEMENT sur le meme sujet et la meme unite ; le dire explicitement.
3. Une donnee partielle (2 a 4 ans) est acceptee et signalee comme telle.
4. Pas de tiret long, pas de prenom, francais dans les champs libres.

Rends UNIQUEMENT un JSON :
[{"ticker":"...","short":"...","annees":{"2019":12.3,...},"unite":"...","citations":{"2019":{"url":"...","texte":"..."}},
  "sujet_exact":"...","commentaire":"..."}]
<LOT>
---

Verification (Fable) : sonder au moins 3 valeurs par societe contre l URL citee avant d ecrire dans
docs/cahier/donnees/<T>.json (statut trouve, sources = citations), puis `_valide.py` et `scripts/cahier-pose.py`.
Compter apres chaque lot : `python3 - <<'PY'` du 17 sept (kpis avec >= 5 ans / 3441) et noter dans
.conv-state/kpi-industrie-reprise.json.
