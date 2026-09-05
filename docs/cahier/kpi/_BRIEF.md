# Brief : KPI par sous-industrie GICS (163 fichiers)

Mission (5 sept 2026) : pour CHAQUE sous-industrie GICS (code à 8 chiffres), écrire le fichier `docs/cahier/kpi/<code>.json` listant les KPI qu'un investisseur professionnel attend pour juger une société de cette activité précise.

## Sources autorisées
- Standards sectoriels **SASB / ISSB** (IFRS Foundation, 77 industries SICS) : reprendre les métriques pertinentes pour l'activité, en citant l'industrie SASB et le sujet (le code de métrique, ex. `TC-SC-410a.1`, seulement s'il est connu avec certitude, sinon le laisser vide).
- **Guides de l'investisseur** et pratiques de place : KPI opérationnels reconnus du métier (ex. RevPAR, load factor, book-to-bill, same-store sales, NIM, combined ratio, ARPU, churn, backlog, taux d'occupation, coût cash par once…).
- Pour le **cadre européen** : ESRS / CSRD (normes thématiques E1…E5, S1…S4, G1 les plus matérielles pour l'activité, avec le datapoint clé) et ESMA (orientations sur les mesures alternatives de performance, APM : définition, réconciliation, cohérence dans le temps).
- **Interdit** : documents des sociétés (10-K, 10-Q, rapports annuels, présentations) comme source des KPI. Les sociétés servent uniquement d'exemples de publication (`exemples_societes`, tickers pris dans `docs/cahier/societes-gics.json` pour ce code).

## Règles de qualité
- KPI **propres à l'activité** de la sous-industrie : « organique » = né du métier lui-même ; « complémentaire » = transversal mais indispensable pour cette activité (ex. capex/CA pour une activité capitalistique). Les KPI purement comptables (CA, résultat net, BPA, marge nette) sont EXCLUS : ils sont déjà partout.
- **3 à 5 KPI organiques** est la norme ; dépasser 6 est un signe que l'on prend trop large. 1 à 3 complémentaires.
- Chaque KPI : définition en UNE phrase précise (numérateur / dénominateur si ratio), unité, fréquence habituelle de publication, où les sociétés le publient d'ordinaire (présentation résultats, rapport annuel, communiqué, base réglementaire), référence du standard.
- Ne rien inventer : un KPI dont on n'est pas sûr qu'il est publié dans la pratique reste en statut `a_verifier` avec une note ; un KPI dont on est sûr est en `a_verifier` aussi (validation humaine ensuite), mais avec `confiance: "haute"`.
- Noms : FR et EN. Pas de jargon inutile, pas d'em-dash. Jamais de nom de personne dans les fichiers.
- Distinguer les activités proches : « Distribution automobile » ≠ « Constructeurs automobiles » ; « REITs de bureaux » ≠ « REITs de commerce de détail » (KPI différents : taux d'occupation vs ventes au m² des locataires).

## Format du fichier `<code>.json`
```json
{
  "code": "45301020",
  "nom_fr": "Semi-conducteurs",
  "nom_en": "Semiconductors",
  "secteur": "45",
  "statut": "a_verifier",
  "sources_consultees": [
    { "type": "SASB", "reference": "Semiconductors (TC-SC)", "url": "https://sasb.ifrs.org/standards/" },
    { "type": "guide", "reference": "Pratiques de place : book-to-bill, utilisation des fabs" }
  ],
  "kpis": [
    {
      "short": "BOOK_TO_BILL",
      "nom_fr": "Ratio commandes / facturations",
      "nom_en": "Book-to-bill ratio",
      "type": "organique",
      "definition": "Commandes reçues sur la période divisées par le chiffre d'affaires facturé sur la même période.",
      "unite": "ratio",
      "frequence": "trimestre",
      "source_habituelle": "présentation résultats",
      "reference_standard": "Pratique de place (guides investisseurs semi-conducteurs)",
      "confiance": "haute",
      "wow": true,
      "exemples_societes": ["AMAT", "LRCX"],
      "statut": "a_verifier"
    }
  ],
  "cadre_europeen": {
    "esrs": [
      { "norme": "ESRS E1", "datapoint": "E1-6 émissions de GES scopes 1, 2, 3 ; E1-5 consommation d'énergie", "pertinence": "activité très énergivore (fabs)" },
      { "norme": "ESRS E3", "datapoint": "E3-4 consommation et prélèvements d'eau", "pertinence": "eau ultra-pure" }
    ],
    "esma_apm": "Les APM courants (marge brute ajustée, résultat opérationnel non-GAAP) doivent être définis, réconciliés avec les comptes IFRS et présentés de façon constante d'une période à l'autre (orientations ESMA sur les APM)."
  },
  "notes": "Difficultés ou ambiguïtés rencontrées, le cas échéant."
}
```

## Livrable de chaque agent
Uniquement les fichiers JSON (un par code) + un compte rendu final de la forme `{"ok": [codes], "problemes": [{"code": "...", "quoi": "..."}]}`. Aucun autre texte.
