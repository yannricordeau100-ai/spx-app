# HANDOFF — Base KPI 0-token (data-lake)

> Pour un 2e compte Claude (Max 20x, budget plein) qui démarre le travail "token"
> avant lundi. Tu écris UNIQUEMENT dans `data-lake/`, jamais sur les pages sté.
> À la reprise, le compte #1 voit l'avancement en 2 min via : `data-lake/STATUS.md`
> + présence des fichiers + monitor. Lire ce fichier EN ENTIER avant de commencer.

## Mission
Base 5 ans VERBATIM, ZÉRO hallucination, pour le **SP500 uniquement** (PAS l'EU pour l'instant).
Chaque valeur = copie-coller d'un tableau d'un doc LOCAL + sa source. Aucune invention.

## RÈGLES DURES (non négociables)
- **VERBATIM seulement** : valeur copiée d'un tableau + `quote` (texte de la cellule) + `accession` (nom du fichier source). Si pas citable verbatim → ne pas l'inclure. JAMAIS inventer / estimer / calculer une valeur absente.
- **0 API payante** (pas `api.anthropic.com`). LLM autorisé = **Cerebras / Groq free UNIQUEMENT**, et SEULEMENT pour le résidu en PROSE des KPI haut de gamme, toujours avec citation vérifiée.
- **KPI SPÉCIFIQUES seulement** sur les pages. Les "données financières" génériques (CA global, marge op, EPS) restent dans le bloc `financier` (XBRL), NON affichées.
- **0 réseau requis** : tous les docs sont en LOCAL. Pas de re-téléchargement.
- Pas d'em-dash. FR strict.
- **NE PAS écrire sur les pages sté ni pousser en prod.** Écrire UNIQUEMENT dans `data-lake/`. Le branchement sur les pages = validation Yann (règle freeze top 10 témoins).

## SOURCES (toutes LOCALES, 0 internet) — décompresser .gz avec gzip, parser BeautifulSoup + **lxml**
- 10-K : `~/Mettrik/sec-data/cat1-us/10K/<année>/<TICKER>_<date>.htm.gz`
- 10-Q : `~/Mettrik/sec-data/cat1-us/10Q/...` (trimestriel)
- **8-K** : `~/Mettrik/sec-data/cat1-us/8K/...` = communiqués de résultats → **tableaux KPI HAUT DE GAMME**
- DEF 14A : `~/Mettrik/sec-data/cat1-us/DEF14A/...` (gouvernance)
- **Earnings slides/reports** (HAUT DE GAMME, ~19 stés manuelles) : `~/Desktop/Projets 2025 26/App KPI/DATA/<NOM>/ES` et `/ER`
(le symlink `~/spx-app/sec-data` pointe sur `~/Mettrik/sec-data`)

## STRUCTURE data-lake (où écrire)
```
data-lake/
  mettrik.db                       # SQLite maître (table facts)
  STATUS.md                        # AVANCEMENT — à mettre à jour à chaque palier
  <TICKER>/
    xbrl/facts.json                # financier (XBRL)            — FAIT
    kpis/extracted.json            # segments annuels (mid-range)— FAIT
    kpis_q/extracted.json          # trimestriel (toggle)        — FAIT
    governance/extracted.json      # actionnariat                — FAIT (partiel)
    hero/extracted.json            # <-- À FAIRE : KPI HAUT DE GAMME (earnings)
```
Schéma d'un fichier KPI (respecter EXACTEMENT) :
```json
{"ticker":"AAPL","kpis":[{"short":"iPhone","name_fr":"Revenu iPhone","unit":"M $",
  "period_type":"quarter","history":[
    {"period_end":"2025-12-31","value":113743,"accession":"local:AAPL_2026-01-30.htm.gz","quote":"113,743"}]}]}
```

## SCRIPTS (tous resumable, 0 token au runtime, `cd ~/spx-app`)
- `scripts/datalake/extract_specific.py` : segments + gouvernance (local+lxml) `--workers 6`
- `scripts/datalake/extract_quarterly.py` : trimestriel depuis 10-Q `--workers 6`
- `scripts/datalake/ingest_drafts.py` : ingère `kpis/` + `governance/` dans la DB
- `scripts/datalake/build_status.py` : régénère `src/data/extraction-status.json` (le monitor)
Lancer DÉTACHÉ pour survivre aux interruptions (échap) :
```
nohup python3 scripts/datalake/<script>.py --workers 6 > /tmp/run.log 2>&1 & disown
```

## FAIT (2026-06-12) — plafond atteint, un re-run n'ajoute rien
| Bloc | Stés |
|---|---|
| financier (XBRL) | 563 |
| segments / mid-range annuel | 374 |
| trimestriel (kpis_q) | 386 |
| gouvernance / actionnariat | 252 |

## À FAIRE (le travail du compte #2, dans l'ordre)
1. **KPI HAUT DE GAMME** (hero + stories) — PRIORITÉ.
   - Source : **tableaux des 8-K** (exhibit communiqué de résultats) + **ES/ER** des ~19 stés.
   - Méthode : parser déterministe des TABLEAUX (BS4+lxml) d'abord ; le résidu en PROSE → LLM gratuit (Cerebras/Groq) + citation vérifiée.
   - Écrire dans `data-lake/<T>/hero/extracted.json` (même schéma).
   - = KPI distinctifs et frais à mettre en avant (hero + haut du bloc indicateurs).
2. **Branchement** data-lake → pages : préparer le code + un gate "complète", mais **laisser en staging, NE PAS pousser sur les pages** (validation Yann).
3. Plus tard (pas maintenant) : élargir segments banques/mono, rému CEO, Q4 calculé.
4. **PAS d'EU.**

## VISIBILITÉ (pour que le compte #1 reprenne en 2 min)
- `ls data-lake/*/hero/extracted.json | wc -l` = nb de stés haut de gamme faites.
- `python3 scripts/datalake/build_status.py` puis regarder `src/data/extraction-status.json`.
- **`data-lake/STATUS.md`** : ajouter 1-3 lignes à CHAQUE palier (date, bloc, N stés, ce qui reste). Le compte #1 lit ça EN PREMIER.

## COORDINATION
- Les 2 comptes partagent le MÊME Mac / repo / data-lake.
- Ne PAS tourner les mêmes scripts en même temps (race). Le #2 bosse avant lundi, le #1 reprend lundi.
- Commits OK sur `data-lake/` + `scripts/`. **JAMAIS** de push/alias touchant les pages sté sans Yann.
