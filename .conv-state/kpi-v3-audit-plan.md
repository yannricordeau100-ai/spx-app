# Audit par échantillon KPI v3 — à exécuter APRÈS la 503e

Déclencheur : `done` = 503 dans `.conv-state/kpi-v3-state.json`, après le commit final et le déploiement.

## Échantillon
35 tickers tirés dans `done` par pas régulier (index 0, 14, 28, ... soit `done[::14]`), de façon à couvrir toute la chaîne, du début (séries les plus anciennes, avant les consignes 9 et 10) à la fin.

## Protocole par ticker (1 agent, budget 40k tokens, 15 appels d'outils max)
1. Ouvrir `.batches-drafts-safe/kpis-haut/<T>.json`.
2. Tirer 3 KPI de nature différente : un financier consolidé, un segment ou géo, un opérationnel sectoriel.
3. Pour chacun, prendre le DERNIER point de l'history et le confronter à la source dans `data-lake/<T>/` (10-Q ou 10-K couvrant la période) ou à `companyfacts` pour les tags XBRL.
4. Vérifier aussi que `value` = dernier point de l'history et que `yoy` correspond au même trimestre de l'année précédente.

## Retour attendu (strict, 8 lignes max)
```
<T>: 3/3 OK
```
ou, si écart :
```
<T>: 2/3 OK
ECART: <short> | publié <valeur fichier> | source <valeur filing> | <fichier source + ligne verbatim>
```

## Consolidation
- Taux d'erreur = nombre de valeurs fausses / 105 valeurs sondées.
- Toute sté avec un écart confirmé est repassée intégralement (mission v3 complète, pas seulement le KPI fautif).
- Si le taux dépasse 5 %, élargir l'échantillon à 100 stés avant de conclure.

## Parallélisme
5 agents en vol maximum, surveiller la RAM (rester au-dessus de 30 % libre).
