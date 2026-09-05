# Prompt à donner à chaque agent de recherche (un lot de 5 sociétés)

Remplacer `<LOT>` par le nom du lot (ex. `20-05`). Lancer avec l'outil Agent, `subagent_type: general-purpose`, `model: opus`, en arrière-plan, 6 agents en parallèle au maximum.

```
Tu travailles dans le dépôt ~/spx-app (Mettrik AI, indicateurs pour investisseurs). Mission : retrouver les données annuelles des KPI organiques pour les sociétés du lot `docs/cahier/donnees/_lots/<LOT>.json`. Commence par `python3 docs/cahier/donnees/_valide.py <TICKER>` pour chaque ticker du lot ; un fichier existant qui passe le contrôle est conservé tel quel, ne refais que les tickers absents ou en problème.

INTERDIT : n'utilise JAMAIS les outils du navigateur intégré (mcp__Claude_Browser__*, mcp__claude-in-chrome__*) : un autre travail y tourne. Utilise uniquement WebSearch, WebFetch, Bash (curl) et la lecture de fichiers.

Lis d'abord intégralement `docs/cahier/donnees/_BRIEF.md` : méthode (vérifier d'abord si le KPI existe déjà sur la fiche, puis recherche dans des sources fiables uniquement, valeurs annuelles brutes par exercice fiscal, idéalement 10 ans, années manquantes laissées absentes, statuts `existe` / `trouve` / `non_trouve` / `actuel_seulement` / `autre` avec commentaire), format JSON exact et livrable. Si la fiche `src/data/companies/<TICKER>.json` n'existe pas sous ce nom, essaie les variantes de ticker (minuscules, autre place de cotation) et `.batches-drafts-safe/kpis-haut/`.

Règles absolues : ne jamais inventer ni estimer une valeur ; chaque valeur vérifiée dans sa source (rapport annuel, document d'enregistrement universel, 10-K, présentations de résultats, site investisseurs, bases réglementaires, API XBRL de la SEC pour les sociétés américaines) ; URL précise pour chaque source ; unité constante ; pas de nom de personne ni de tiret long. La qualité prime sur la vitesse. Quand une société publie le KPI sous un autre nom ou une définition voisine, cherche vraiment avant de conclure « non trouvé ». Si un KPI existe déjà en ligne mais avec un historique court, statut `existe` et `annees` remplies avec les exercices antérieurs retrouvés. Si les valeurs en ligne ne correspondent pas aux documents officiels, le dire en commentaire avec les valeurs officielles. Si une série est calculée à partir de deux postes publiés, le dire en commentaire.

Pour chaque société : écris `docs/cahier/donnees/<TICKER>.json` (ticker exactement comme dans le lot), puis lance `python3 docs/cahier/donnees/_valide.py <TICKER>` et corrige ce qui est signalé.

Réponds UNIQUEMENT par un JSON : {"faits": [tickers], "resume": {"existe": n, "trouve": n, "non_trouve": n, "actuel_seulement": n, "autre": n}, "problemes": [{"ticker": "...", "quoi": "..."}]} sans aucun autre texte.
```

# Prompt de contre-vérification (une fois un secteur complet)

Remplacer `<SECTEUR>` par le code (ex. `20`) et `<n>` par le nombre de sociétés.

```
Tu es contrôleur indépendant pour Mettrik AI (dépôt ~/spx-app). Des agents ont écrit `docs/cahier/donnees/<TICKER>.json` pour les <n> sociétés du secteur <SECTEUR> (tickers : fichiers `docs/cahier/donnees/_lots/<SECTEUR>-*.json`). INTERDIT : outils du navigateur intégré. Utilise WebFetch, WebSearch, Bash (curl, /opt/homebrew/bin/pdftotext) et la lecture de fichiers.

Mission : pour CHAQUE série ayant au moins 2 années (statut `trouve`, ou `existe` / `autre` avec `annees` non vide), vérifie 2 valeurs (la plus ancienne et la plus récente) dans la source citée, ainsi que l'unité et l'exercice fiscal. Source injoignable : cherche l'équivalent officiel ; sinon « non vérifiable ». En cas d'écart : corrige le fichier si la valeur exacte est établie avec certitude (dis-le en `commentaire`), sinon passe la série en `autre` avec commentaire précis. Ne change rien d'autre ; `python3 docs/cahier/donnees/_valide.py` doit rester au vert.

Livrable : `docs/cahier/donnees/_VERIFICATION-<SECTEUR>.md` (tableau ticker, KPI, années sondées, résultat, détail), puis UNIQUEMENT un JSON : {"series_sondees": n, "conformes": n, "corrigees": n, "non_verifiables": n, "passees_en_autre": n, "exemples": [...]}.
```
