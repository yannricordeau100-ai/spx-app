# Cleanup audit cat3-european / SP500 — 25 mai 04h15

Audit précédent : commit `aeb2403b625f447cd`.

## Contexte

Audit a identifié 21 dossiers parasites dans `sec-data/cat3-european/` :
- **1 vraie cross-pollution** : `BLK/annual-text/2024.txt` = iShares World ex Switzerland ESG Screened Equity Index Fund (CH), 0 mention "BlackRock" (au lieu du 10-K BlackRock Inc.).
- **20 cas routing incorrect** : contenu valide (vrai 10-K ou doc satellite du bon ticker) mais placé en cat3-european au lieu de cat1-us.

## Actions effectuées

### 1. BLK purge + re-scrape

- Backup tar.gz : `/tmp/cleanup-cat3-25mai-0415/BLK-purge.tar.gz` (154 KB)
- Suppression de `sec-data/cat3-european/BLK/` (PDF iShares ESG cross-pollué)
- Re-scrape SEC EDGAR via CIK 0001364742 :
  - 5 nouveaux 10-K téléchargés (2019, 2020, 2022, 2023, 2024)
  - 2 déjà présents conservés (2025, 2026)
  - **Total 7 BLK 10-K** en `cat1-us/10K/<year>/BLK_<date>.htm.gz`
- Vérif mentions "BlackRock" :
  - 2019 → 453 mentions
  - 2020 → 481
  - 2022 → 482
  - 2023 → 449
  - 2024 → 475
  - 2025 → 500
  - 2026 → 210

Tous ≥210, largement au-dessus du seuil 50.

### 2. 20 dossiers cat3 → archivage `_misplaced-cat3/`

Stratégie : archivage en `sec-data/_misplaced-cat3/<T>/` plutôt que tentative de fusion vers `cat1-us/10K/<year>/`, car :
- Format incompatible : `cat3-european/*/annual-report/<year>.pdf` vs `cat1-us/10K/<year>/<T>_<date>.htm.gz`
- 33/38 années cibles ont DÉJÀ un 10-K HTM gzipé en cat1-us (pas de gain à écraser)
- Les PDFs cat3 sont des copies redondantes des annual reports (déjà couvertes par 10-K SEC)

Tickers archivés (20) :
- **13 vrais 10-K** : AMD, BAC, DIS, GEV, INTC, JPM, KO, PEP, TKO, UNH, VLTO, VZ, WFC
- **7 docs satellites** : BA, HOOD, MS, MSFT, ORCL, SOLV, XOM (sustainability / transparency / CRS, pas substituts de 10-K)

### 3. Scraper patché (garde anti-US)

Fichier : `scripts/cat3-annualreports-scraper.py`

Ajout :
- Constante `EU_TICKERS_NO_SUFFIX_WHITELIST = {SIEGY, ENI, STLA, SONY, TSMC/TSM}` (rares EU sans suffixe place boursière, ADR OTC tolérés).
- Fonction `is_us_ticker(ticker)` : retourne `True` si pas de "." dans ticker et pas dans whitelist.
- Check début de boucle main : si `is_us_ticker(ticker)` → log `[SKIP-US]` + `continue`, ne tente pas de scraper.
- Counter `n_skip_us` ajouté au log final.

Tests garde : 9/9 OK
- US purs (BLK/MSFT/AMD) → True (skip)
- EU avec suffixe (MC.PA/ASML.AS/ROG.SW) → False (process)
- EU whitelist (SIEGY/SONY/STLA) → False (process)

## Vérifications post-cleanup

```bash
# Test 1 : cat3-european vide pour 21 tickers
ls sec-data/cat3-european/ | grep -E '^(BLK|AMD|BAC|DIS|GEV|INTC|JPM|KO|PEP|TKO|UNH|VLTO|VZ|WFC|BA|HOOD|MS|MSFT|ORCL|SOLV|XOM)$'
→ VIDE (tous déplacés)

# Test 2 : BLK re-scrapé en cat1-us
ls sec-data/cat1-us/10K/*/BLK_*.htm.gz
→ 7 fichiers (2019-2026)

# Test 3 : mentions BlackRock dans chaque 10-K
→ Tous ≥210 mentions (largement >50)
```

## Note importante

Les dossiers `sec-data/_misplaced-cat3/<T>/` contiennent des PDFs valides mais en format/emplacement non-canonique. À reclasser dans une future session si besoin (extraction texte, conversion HTML, ou simple archive cold). Aucun pipeline production ne lit `_misplaced-cat3/` actuellement.

## Backup disponibles

- `/tmp/cleanup-cat3-25mai-0415/BLK-purge.tar.gz` (PDFs iShares ESG cross-pollués originaux BLK)
- `sec-data/_misplaced-cat3/` (20 dossiers PDFs satellites/redondants, intacts)
