# Spec extension quarterly-history — chantier KPI graphs

## Objectif
Pour chaque sté SP500 × KPI standard, s'assurer que le graph affiche une série cohérente d'au moins 5 ans si la data-lake permet, jusqu'au maximum possible.

## Critères d'un KPI "propre" (à préserver)
Un KPI dans `v2-pipeline-enrich/<t>.json` (section `kpis[]` OU `_quarterly_history_extension.kpis[]`) est propre si :
- `history` = array de nombres non vide
- `history_periods` = array de strings (labels) de MÊME longueur
- `last_data_date` = string ISO (YYYY-MM-DD) non vide
- `period_type` = "quarter" | "year" | "ttm"
- Aucune valeur "projected" / "estimate" / hallucinée

## KPI standard à couvrir (par ordre priorité)
1. Total Revenue / Net Sales (annuel + quarterly)
2. Net Income (annuel + quarterly)
3. EPS Diluted (annuel + quarterly)
4. Operating Margin (%) (annuel)
5. Gross Margin (%) (annuel)
6. Free Cash Flow (annuel + quarterly si dispo)
7. Operating Cash Flow (annuel)
8. Total Assets (annuel)
9. Headcount (annuel)
10. R&D expenses (annuel)
11. Capex (annuel)

## Source d'extraction
- Data-lake : `data-lake/<TICKER>/10K/*.htm.gz` (annuel 5-10 filings)
- Data-lake : `data-lake/<TICKER>/10Q/*.htm.gz` (trimestriel 20-40 filings)
- Data-lake : `data-lake/<TICKER>/xbrl/*` si présent (XBRL structuré = source la plus fiable)

## Méthode
Pour chaque sté × KPI :
1. Lire les 10-K décompressés (gunzip), extraire les valeurs annuelles via patterns robustes (chercher "Net sales", "Total revenue", "Net income", etc. dans les tables consolidées de résultat)
2. Lire les 10-Q pour les valeurs trimestrielles
3. Cross-checker chaque valeur avec au moins 2 filings différents pour éliminer les hallucinations
4. Construire un array {value, period, date} propre

## Écriture
Dans `src/data/v2-pipeline-enrich/<t>.json` :
- Trouver le KPI dans `kpis[]` correspondant (short EXACT après normalisation lowercase/trim)
- Si présent : merger l'history (union sans doublon, tri chronologique)
- Si absent : ajouter dans `_quarterly_history_extension.kpis[]` avec method="llm-filing-crosschecked"

Champs obligatoires :
```json
{
  "short": "<short exact matchant celui de v2-pipeline>",
  "name_fr": "...",
  "history": [n1, n2, ...],
  "history_periods": ["FY2021", "FY2022", ...] ou ["Q1-FY22", "Q2-FY22", ...],
  "last_data_date": "2026-04-30",
  "period_type": "year" | "quarter",
  "unit": "$M" | "$B" | "%" | ...,
  "method": "llm-filing-crosschecked",
  "source": "10-K <TICKER> FY26 + 10-Q Q1-Q4 FY22-FY26"
}
```

## Règles strictes
- Ne JAMAIS inventer un chiffre. Si pas trouvable dans data-lake, laisser tel quel.
- Ne JAMAIS mélanger 2 KPI (ex : "Revenue Data Center" ≠ "Total Revenue")
- Vérifier l'unité : $M vs $B vs $K vs $000. Standardiser en $M interne.
- last_data_date = date de FIN du trimestre le plus récent extrait (pas la date de filing).
- TTM séparé, jamais dans le compte des années.

## Validation
Après extraction, chaque KPI doit :
- history.length ≥ 5 (années) OU ≥ 12 (quarters ~3 ans) minimum
- history_periods.length === history.length
- Aucune duplicate période
- Toutes valeurs numériques positives (sauf marges qui peuvent être négatives)
- last_data_date parseable en Date valide

## Priorité stés
1. Top 10 témoin : NVDA, AAPL, MSFT, GOOGL, AMZN, META, TSLA, V, JPM, BRK-B
2. Large caps SP500 (top 100 par capi)
3. Reste SP500

## Sortie du sub-agent
Fichier `.conv-state/chantier-quarters-log-<chunk>.json` avec :
```json
{"chunk_id":N,"tickers_processed":[...],"kpis_extended":N,"kpis_skipped_ok":N,"failures":[...]}
```
