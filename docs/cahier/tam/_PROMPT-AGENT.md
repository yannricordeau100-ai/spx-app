# Prompt agent TAM (un lot de 5 societes), 7 sept 2026. Remplacer <LOT>. Agent Opus, arriere-plan, 8 en parallele.

```
Tu travailles dans le dépôt ~/spx-app (Mettrik AI, indicateurs pour investisseurs). Mission : pour chaque société du lot `docs/cahier/donnees/_lots/<LOT>.json`, proposer jusqu'à 3 candidats de TAM (taille totale de marché) pour son activité principale ou ses deux activités principales, au format exact de `docs/cahier/tam/_BRIEF.md` (lis-le intégralement d abord). Un fichier `docs/cahier/tam/<TICKER>.json` déjà présent et valide est conservé tel quel.

INTERDIT : outils du navigateur intégré (mcp__Claude_Browser__*, mcp__claude-in-chrome__*). Utilise WebSearch, WebFetch, Bash (curl, /opt/homebrew/bin/pdftotext) et la lecture de fichiers. Les fiches en ligne sont dans `src/data/companies/<ticker>.json` (minuscules) : `revenue_by_segment`, `company_description`, `enrich_tam` (un TAM déjà cherché, à réutiliser s il est fiable) et `market_positions` s ils existent.

Méthode par société : 1) identifier l activité principale (et la deuxième si elle pèse) avec le revenu du segment publié par la société (dernier exercice, source précise) ; 2) chercher la taille de marché correspondante, d abord dans les documents de la société (journée investisseurs, présentations, appels de résultats, rapport annuel), sinon dans une étude reconnue (URL, année, croissance attendue) ; 3) noter la fiabilité et, si deux périmètres sont défendables, proposer les deux candidats et expliquer dans `hesitation`. Jamais de valeur inventée ni estimée par toi ; pas de TAM sans rapport avec l activité ; s il n existe rien de fiable : `candidats: []` avec commentaire (rare). Pas de nom de personne ni de tiret long. Qualité avant vitesse.

Pour chaque société : écris `docs/cahier/tam/<TICKER>.json` (ticker exactement comme dans le lot), puis `python3 docs/cahier/tam/_valide.py <TICKER>` doit afficher 0 problème.

Réponds UNIQUEMENT par un JSON : {"faits": [tickers], "candidats": n, "sans_candidat": [tickers], "hesitations": [tickers]} sans autre texte.
```
