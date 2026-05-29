# cross-source-validate.py — Doc

## Objectif
Phase 2C Mettrik : comparer les donnees Mettrik (`src/data/v2-pipeline/<ticker>.json`)
avec les donnees market live yfinance pour detecter les incoherences (rang, capi, secteur).

**Read-only sur v2-pipeline/** : aucune modif des fichiers data, juste production d'un fichier d'alertes.

## Lancement

```bash
cd /Users/yann/spx-app
python3 scripts/cross-source-validate.py
```

Duree : ~1 min (50 tickers × 1s sleep + fetch).
RAM : <100 MB. 1 seul process. Pas de parallelisme.

Dependances :
- Python 3
- yfinance (`pip install yfinance` ou deja installe)

## Output

`src/data/cross-source-deltas.json` :

```json
{
  "generated_at": "2026-05-29T...",
  "source_tickers_file": "v1-8-tickers-sorted.json",
  "tickers_checked": 50,
  "summary": {"ok": N, "info": N, "warning": N, "critical": N},
  "thresholds": { ... },
  "deltas": [
    {
      "ticker": "BRK-B",
      "field": "ranks.global_world",
      "mettrik": "≈ #1",
      "yfinance_marketcap_mds": 1029,
      "estimated_real_rank": 10,
      "severity": "critical",
      "note": "Mettrik dit '≈ #1' mais capi 1029 Mds$ implique rang ~#10"
    }
  ]
}
```

## Severites

| Niveau   | Sens                                                              |
|----------|-------------------------------------------------------------------|
| critical | Faute factuelle (ex: rang "#1" alors que capi le situe rang ~#10) |
| warning  | Divergence > 5% capi, ou secteur incoherent                        |
| info     | Champ non comparable (hero KPI, capi non stockee Mettrik)         |

## Seuils

- Ecart capi warning : 5%
- Ecart capi critical : 20%
- Capi minimum pour pretendre "#1 mondial" : 2 000 Mds$

## Interpretation des cas connus

- **BRK-B** : Mettrik affiche rank `≈ #1`. yfinance capi ~1029 Mds$ => rang reel ~#9-10.
  Severite **critical**. Action : corriger `src/data/v2-pipeline/brk-b.json` ranks.global_world.

- **MU (Micron)** : Si valeur R&D = 10 Mds$ dans hero_kpi mais reelle = 3 Mds$, c'est une
  hallucination LLM. Hors scope yfinance (R&D non disponible via market data). A controler
  via cross-check filings 10-K.

- **META DAP** : Unit "Mds $" au lieu de "Mds users". Hors scope yfinance (concept metier).
  A controler via audit d'unites.

## Integration cron (optionnel)

Ajouter dans `crontab -e` ou `~/spx-app/scripts/_autopilot-pass3.sh` :

```cron
# Cross-source validation Mettrik vs yfinance, tous les lundis 06h00
0 6 * * 1 cd /Users/yann/spx-app && /usr/bin/python3 scripts/cross-source-validate.py >> logs/cross-source.log 2>&1
```

## Workflow d'usage

1. Run le script (~1 min).
2. Ouvrir `src/data/cross-source-deltas.json`.
3. Filtrer `severity: critical` et `severity: warning`.
4. Pour chaque delta, ouvrir le fichier `v2-pipeline/<ticker>.json` correspondant et corriger
   manuellement (CONV-DATA s'en charge — pas d'auto-correction).
5. Re-run pour verifier que `summary.critical == 0`.

## Limites

- yfinance peut etre rate-limite ou retourner des donnees stale (delai 15 min).
- Le script estime le rang mondial via une grille de seuils statiques (mai 2026).
  A re-calibrer trimestriellement.
- Hero KPI non comparable : seul un audit metier (filings SEC, 10-K) le permet.
- Capi non stockee dans v2-pipeline/*.json : le script note la capi live mais ne peut
  pas detecter d'erreur passee. A envisager : ajouter `market_cap_snapshot_usd` dans v2-pipeline.
