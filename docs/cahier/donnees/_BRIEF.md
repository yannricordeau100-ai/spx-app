# Brief : données annuelles des KPI organiques, société par société

Mission (5 sept 2026) : pour chaque société de l'univers, retrouver les valeurs ANNUELLES (idéalement 10 ans) des KPI organiques de sa sous-industrie GICS, avec des sources fiables, et consigner le résultat dans `docs/cahier/donnees/<TICKER>.json`. Les KPI sont le cœur de Mettrik : la qualité prime sur la vitesse.

## Entrées
- `docs/cahier/donnees/_lots/<secteur>-<nn>.json` : lot de 5 sociétés (ticker, nom, code de sous-industrie).
- `docs/cahier/kpi/<code>.json` : les KPI de la sous-industrie ; ne traiter que ceux de `type` = "organique".
- KPI déjà en ligne pour la société : `src/data/companies/<TICKER>.json` (champ `kpis`, chaque KPI a `short`, `name_fr`, `name_en`, `history`, `history_periods`) et, s'il existe, `.batches-drafts-safe/kpis-haut/<TICKER>.json` (même structure, `history` en objets {q, v}). Le nom de fichier suit le ticker tel quel (ex. `MC.PA.json`, `BRK-B.json`) ; essayer aussi en minuscules.

## Méthode, pour chaque société puis chaque KPI organique
1. **Existence** : comparer le KPI cherché aux KPI déjà en ligne (par sens, pas seulement par nom : « Book-to-bill » = « Ratio commandes / facturations »). S'il existe : statut `existe`, noter le `short` en ligne et le nombre d'années présentes. Ne pas rechercher de données.
2. **Recherche** : sources fiables uniquement, dans cet ordre : rapport annuel / document d'enregistrement universel / 10-K de la société (section KPI ou données opérationnelles), présentations de résultats et « fact sheets » investisseurs sur le site IR, rapports intégrés, bases réglementaires (SEC, EDGAR full-text, ESMA, régulateurs sectoriels), organismes de statistiques du secteur. Tu peux utiliser WebSearch et WebFetch. Wikipedia, blogs, agrégateurs non sourcés et estimations d'analystes ne sont PAS des sources de données.
3. **Valeurs** : une valeur par exercice fiscal, en nombre brut (pas de « 4,3 Mds » : écrire 4300000000 avec l'unité « $ », ou noter l'unité exacte du KPI : « magasins », « %», « millions d'abonnés »...). Année = exercice fiscal de la société (clé "2019" pour l'exercice clos en 2019). Année manquante = on la laisse absente, jamais interpolée ni estimée. Une valeur retraitée dans un rapport ultérieur prime sur la valeur initiale (le noter).
4. **Statuts** possibles (champ `statut`) :
   - `existe` : déjà en ligne sur la fiche ;
   - `trouve` : au moins 2 années fiables ; renseigner `annees`, `complet` (true si aucune année manquante entre la première et la dernière) ;
   - `actuel_seulement` : uniquement la valeur des 12 derniers mois : cas anormal, expliquer en `commentaire` pourquoi l'historique est introuvable ;
   - `non_trouve` : aucune donnée fiable après une recherche sérieuse (dire en `commentaire` ce qui a été cherché) ;
   - `autre` : tout cas hors de ces catégories, avec `commentaire` obligatoire (ex. KPI non applicable à cette société, définition différente, série publiée seulement en trimestriel).
5. **Sources** : pour chaque KPI, au moins une URL précise (document, pas la page d'accueil) et le titre ; pour une série longue, plusieurs documents.
6. **Rigueur** : vérifier chaque valeur dans sa source ; ne jamais inventer ; ne pas mélanger deux définitions ; unité constante sur toute la série ; noter tout changement de périmètre.

## Format `docs/cahier/donnees/<TICKER>.json`
```json
{
  "ticker": "NVDA",
  "code": "45301020",
  "date": "2026-09-05",
  "kpis": [
    {
      "short": "BOOK_TO_BILL",
      "nom_fr": "Ratio commandes / facturations",
      "statut": "non_trouve",
      "unite": "ratio",
      "annees": {},
      "complet": false,
      "sources": [],
      "commentaire": "NVIDIA ne publie pas de book-to-bill ; recherché dans les 10-K 2016-2025 et les présentations de résultats."
    },
    {
      "short": "DATA_CENTER_REV",
      "nom_fr": "Chiffre d'affaires centres de données",
      "statut": "existe",
      "short_en_ligne": "DC_REV",
      "annees_en_ligne": 8,
      "unite": "Mds $",
      "annees": {},
      "complet": true,
      "sources": [],
      "commentaire": ""
    },
    {
      "short": "FAB_UTIL",
      "nom_fr": "Taux d'utilisation des usines",
      "statut": "trouve",
      "unite": "%",
      "annees": {"2019": 82.0, "2020": 88.5, "2021": 95.0},
      "complet": true,
      "sources": [{"url": "https://...", "titre": "Rapport annuel 2021, p. 34"}],
      "commentaire": "Valeurs 2019 et 2020 retraitées dans le rapport 2021."
    }
  ]
}
```

## Livrable de l'agent
Les fichiers JSON de son lot, valides (`python3 docs/cahier/donnees/_valide.py`), puis UNIQUEMENT un JSON : `{"faits": ["NVDA", ...], "resume": {"existe": n, "trouve": n, "non_trouve": n, "actuel_seulement": n, "autre": n}, "problemes": [{"ticker": "...", "quoi": "..."}]}`.
