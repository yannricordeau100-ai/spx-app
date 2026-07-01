# EXPORT COMPLET : Projet KPI Haut de Gamme SP500

## RÉSUMÉ EXÉCUTIF

Mettrik AI = app SaaS Next.js pour investisseurs, affiche KPIs, risques, gouvernance de sociétés cotées. On a enrichi les 478 tickers du SP500 avec des KPIs "haut de gamme" extraits des filings SEC (10-Q trimestriels + 10-K annuels) stockés localement sur le Mac, puis intégré ces KPIs dans le site.

---

## ÉTAPES CLÉS RÉALISÉES

### Étape 1 : Extraction KPIs haut de gamme (4 derniers trimestres)
- Extraction initiale de KPIs distinctifs ("wow") pour chaque sté du SP500
- Source : filings SEC 10-Q compressés en `.htm.gz` dans `~/Mettrik/docs/<TICKER>/10-Q/`
- Sortie : fichiers JSON dans `~/spx-app/.batches-drafts-safe/kpis-haut/<TICKER>.json`
- 478 fichiers créés avec ~6-10 KPIs par sté
- Chaque KPI : short, name_fr, name_en, value, unit, yoy, pv_score, signal, history

### Étape 2 : Extraction risques depuis 10-K
- Extraction de 6 risques par sté depuis les 10-K annuels
- Catégories : Macro, Réglementaire, Opérationnel, Financier, Marché, Technologique, ESG
- Severity 1-5, trend (up/stable/down), summary, citation du 10-K
- 456/478 stes traitées, 22 sans 10-K local
- Stockés dans risks-batch067-070 puis intégrés aux companies/*.json

### Étape 3 : Intégration KPIs au site
- Remplacement du champ `kpis` dans `src/data/companies/<TICKER>.json` par les kpis-haut
- Sélection du `hero_kpi` = KPI avec le plus haut `pv_score`
- Exceptions : AAPL garde "iPhone Revenue", NFLX garde "Abonnés payants"
- 465 fichiers companies mis à jour

### Étape 4 : Extension historique complet (10-Q + 10-K)
- Objectif : extraire TOUS les trimestres disponibles (pas juste les 4 derniers)
- Lecture de TOUS les fichiers 10-Q (jusqu'à 31 par sté, ~7.5 ans) + 10-K
- Ajout du champ `frequency` : "quarterly" (trouvé dans 10-Q) ou "annual" (seulement 10-K)
- 10-K : extraire Q4 si données trimestrielles dispo, sinon FY annuel
- Workflow tool utilisé pour paralléliser (pipeline de sub-agents)
- Plusieurs passes nécessaires (limits de session, rate limiting)

### Étape 5 : Nettoyage site
- 22 stes sans filings locaux : supprimées de `src/data/companies/`
- `v1-9-5-clean-all-tickers.json` mis à jour à 452 tickers (seuls visibles dans recherche)
- `_hero-kpi-index.json` régénéré pour les 452 stes

### Étape 6 : Audit qualité (PROBLÈME DÉTECTÉ)
- Scan des 452 stes : 121 tickers ont un historique trop court
- 12 tickers avec 0 périodes malgré 30+ filings disponibles
- Cause : agents Haiku ont échoué silencieusement ou n'ont extrait que 4 trimestres
- **C'est le travail restant à faire**

---

## FICHIERS MODIFIÉS ET LEUR RÔLE

### Données source (kpis-haut)
| Chemin | Rôle | État |
|--------|------|------|
| `~/spx-app/.batches-drafts-safe/kpis-haut/<TICKER>.json` | KPIs enrichis avec historique | 478 fichiers, 121 avec historique trop court |

### Données site (companies)
| Chemin | Rôle | État |
|--------|------|------|
| `~/spx-app/src/data/companies/<TICKER>.json` | JSON complet par sté (kpis + risks + tout) | 452 fichiers (22 sans filings supprimés) |
| `~/spx-app/src/data/v1-9-5-clean-all-tickers.json` | Liste des 452 tickers visibles dans la recherche | À jour |
| `~/spx-app/src/data/v2-pipeline/_hero-kpi-index.json` | Index hero KPI pour affichage recherche | À jour |

### Filings SEC (lecture seule)
| Chemin | Rôle |
|--------|------|
| `~/Mettrik/docs/<TICKER>/10-Q/*.htm.gz` | Filings trimestriels SEC compressés |
| `~/Mettrik/docs/<TICKER>/10-K/*.htm.gz` | Filings annuels SEC compressés |

### Workflow
| Chemin | Rôle |
|--------|------|
| `~/.claude/projects/-Users-yann/56f7ef11-444c-4ed3-8570-ee39b82a09d5/workflows/scripts/full-kpi-history-sp500-wf_d522bcc9-432.js` | Script Workflow pour extraction parallèle |

---

## ÉTAT ACTUEL DU PROJET

### Ce qui est OK (ne pas toucher)
- 331 tickers sur 452 ont un historique complet (>50% des filings disponibles couverts)
- Tous les 452 tickers ont : risques intégrés, hero_kpi défini, frequency sur chaque KPI
- Le site affiche uniquement les 452 tickers via `v1-9-5-clean-all-tickers.json`
- `_risks_updated_at: "2026-06-30"` sur tous les companies/*.json

### Ce qui reste à faire : 121 TICKERS AVEC HISTORIQUE TROP COURT

Liste complète (format TICKER:historique_actuel/10Q_disponibles/10K_disponibles) :

```
BA:8h/30q/10k, COF:0h/30q/10k, CRL:5h/30q/10k, DD:11h/25q/9k, DLTR:0h/30q/10k,
DOC:4h/30q/10k, DOV:0h/30q/10k, DPZ:4h/30q/10k, DTE:4h/29q/10k, EMR:0h/30q/10k,
EQT:5h/30q/10k, EVRG:4h/23q/8k, EXC:7h/30q/10k, FE:10h/29q/10k, FSLR:10h/29q/10k,
GEN:11h/29q/10k, GPN:8h/29q/10k, GWW:12h/29q/10k, HAS:12h/30q/10k, HON:10h/30q/10k,
HWM:6h/30q/10k, IBM:5h/30q/10k, IP:9h/30q/10k, J:4h/30q/10k, JBL:7h/30q/10k,
JCI:8h/29q/10k, JPM:4h/15q/5k, KEY:4h/30q/10k, KKR:6h/30q/10k, KMI:2h/30q/10k,
L:6h/30q/10k, LH:6h/30q/10k, LHX:6h/29q/10k, LMT:7h/30q/10k, LOW:5h/30q/10k,
LRCX:0h/30q/10k, LVS:7h/31q/10k, LYB:9h/29q/10k, LYV:3h/30q/10k, MAR:3h/29q/10k,
MAS:0h/30q/10k, MCHP:4h/30q/10k, MCK:2h/30q/10k, MCO:4h/31q/10k, META:4h/15q/5k,
MGM:3h/30q/10k, MKC:4h/30q/10k, MLM:0h/30q/10k, MO:1h/29q/10k, MPC:3h/30q/10k,
MTB:4h/29q/10k, NCLH:2h/30q/10k, NKE:4h/30q/10k, NRG:4h/30q/10k, NUE:5h/30q/10k,
NWS:6h/30q/10k, O:4h/29q/10k, OKE:6h/30q/10k, OTIS:4h/19q/6k, OXY:5h/30q/10k,
PCG:10h/31q/10k, PEG:6h/30q/10k, PEP:5h/30q/10k, PFG:11h/30q/10k, PGR:10h/30q/10k,
PKG:6h/30q/10k, PLD:6h/30q/10k, PM:4h/30q/10k, PRU:8h/30q/10k, PSX:6h/29q/10k,
RF:4h/30q/10k, RJF:3h/30q/10k, RMD:4h/29q/10k, ROK:4h/30q/10k, ROL:11h/30q/10k,
ROP:4h/30q/10k, SBAC:2h/30q/10k, SBUX:4h/30q/10k, SJM:3h/30q/10k, SMCI:5h/24q/7k,
SO:10h/30q/10k, SRE:6h/30q/10k, STLD:4h/31q/10k, STT:2h/30q/10k, STZ:7h/30q/10k,
SWK:5h/29q/10k, SYF:12h/30q/10k, SYK:4h/29q/10k, SYY:0h/30q/10k, T:4h/31q/10k,
TAP:4h/30q/10k, TDY:7h/31q/10k, TECH:7h/30q/10k, TER:7h/30q/10k, TFC:7h/29q/10k,
TPR:7h/30q/10k, TSN:4h/30q/10k, TT:8h/29q/10k, TYL:7h/29q/10k, UAL:7h/30q/10k,
UHS:0h/30q/10k, UPS:0h/30q/10k, URI:4h/30q/10k, USB:0h/30q/10k, V:4h/29q/10k,
VICI:4h/25q/9k, VMC:4h/30q/10k, VRSK:3h/30q/10k, VRTX:4h/30q/10k, VST:4h/27q/9k,
VTR:2h/30q/10k, WAT:4h/30q/10k, WBD:4h/30q/10k, WEC:4h/30q/10k, WELL:4h/30q/10k,
WM:6h/29q/10k, WRB:6h/30q/10k, WST:0h/31q/10k, WYNN:4h/30q/10k, XEL:4h/30q/10k,
XOM:6h/30q/10k
```

### 12 cas critiques (0 périodes d'historique)
COF, DLTR, DOV, EMR, LRCX, MAS, MLM, SYY, UHS, UPS, USB, WST

---

## RAISONNEMENT DERRIÈRE CHAQUE DÉCISION

### Pourquoi "kpis-haut" et pas les KPIs standard ?
Les KPIs standard (Revenue, Net Income, EPS) sont génériques. Les "kpis-haut" sont des KPIs distinctifs propres à chaque sté (ex: "iPhone Revenue" pour AAPL, "Cloud Revenue" pour GOOGL). Plus de valeur pour les investisseurs.

### Pourquoi frequency quarterly/annual ?
Certains KPIs ne sont publiés que dans le 10-K annuel (ex: nombre d'employés, capacité installée). D'autres sont dans chaque 10-Q trimestriel. L'app doit afficher un graphe différent (annuel vs trimestriel).

### Pourquoi 22 stes supprimées ?
Pas de dossier `~/Mettrik/docs/<TICKER>/` = pas de filings téléchargés = impossible d'extraire des KPIs haut de gamme. On ne garde sur le site que les stes avec données complètes.

### Pourquoi hero_kpi ?
Le KPI "le plus wow" (plus haut pv_score) est affiché en grand dans la recherche et en haut de la page sté. Exceptions AAPL/NFLX : Yann a décidé que "iPhone Revenue" et "Abonnés payants" sont plus impactants que ce que le pv_score algorithmique choisirait.

### Pourquoi l'historique est trop court sur 121 stes ?
Les agents Haiku (modèle léger) ont soit :
1. Échoué silencieusement (retourné le JSON existant sans modification)
2. Lu seulement les 4 derniers filings au lieu de tous les 30
3. Abandonné quand le format HTML du filing était inhabituel
Solution : re-traiter avec un modèle plus puissant (Opus) ou Haiku avec prompt durci.

### Pourquoi v1-9-5-clean-all-tickers.json ?
Ce fichier contrôle ce qui est visible dans la barre de recherche et sur le hub de l'app. Seuls les 452 tickers listés ici apparaissent. Les 1714 autres company files (EU, internationaux, small caps) restent sur disque mais sont invisibles.

---

## FORMAT DES FICHIERS

### kpis-haut/<TICKER>.json (exemple complet)
```json
{
  "ticker": "AAPL",
  "company": "Apple Inc.",
  "kpis": [
    {
      "short": "iPhone Revenue",
      "name_fr": "CA iPhone",
      "name_en": "iPhone Revenue",
      "value": 201.18,
      "unit": "Mds $",
      "yoy": "+0.3%",
      "pv_score": 10,
      "signal": "stable",
      "frequency": "quarterly",
      "history": [
        {"q": "FY2019", "v": 142.381},
        {"q": "Q2-FY2020", "v": 28.962},
        {"q": "Q3-FY2020", "v": 26.418},
        {"q": "FY2020", "v": 137.781},
        {"q": "Q1-FY2021", "v": 65.597},
        {"q": "Q2-FY2021", "v": 47.938}
      ]
    }
  ],
  "_extracted_at": "2026-06-30"
}
```

### companies/<TICKER>.json (champs pertinents)
```json
{
  "ticker": "AAPL",
  "name": "Apple Inc.",
  "hero_kpi": "iPhone Revenue",
  "kpis": [ ... ],
  "risks": [
    {
      "title": "...",
      "category": "Technologique",
      "severity": 4,
      "score_rationale": "...",
      "trend": "up",
      "summary": "...",
      "citation": "..."
    }
  ],
  "_risks_updated_at": "2026-06-30"
}
```

### Lecture d'un filing SEC
```bash
# 10-Q (trimestriel) :
zcat ~/Mettrik/docs/AAPL/10-Q/AAPL_2024-01-30.htm.gz 2>/dev/null | head -c 40000

# 10-K (annuel) :
zcat ~/Mettrik/docs/AAPL/10-K/AAPL_2024-11-01.htm.gz 2>/dev/null | head -c 60000
```

Identifier le trimestre dans le texte :
- "Three months ended March 31, 2022" → Q1-2022
- "Three months ended June 30, 2022" → Q2-2022
- "Year ended December 31, 2022" → FY2022
- AAPL fiscal décalé : "Three months ended December 28, 2024" → Q1-FY2025

### Intégration kpis-haut → companies (script Python)
```python
import json
from pathlib import Path

kpis_dir = Path('/Users/yann/spx-app/.batches-drafts-safe/kpis-haut')
companies_dir = Path('/Users/yann/spx-app/src/data/companies')
exceptions = {'AAPL': 'iPhone Revenue', 'NFLX': 'Abonnés payants'}

for kpi_file in sorted(kpis_dir.glob('*.json')):
    ticker = kpi_file.stem
    company_file = companies_dir / f'{ticker}.json'
    if not company_file.exists():
        continue
    kpis_data = json.load(open(kpi_file))
    company = json.load(open(company_file))
    kept_kpis = []
    if ticker.upper() in exceptions:
        exc_name = exceptions[ticker.upper()]
        if isinstance(company.get('kpis'), list):
            kept_kpis = [k for k in company['kpis'] if isinstance(k, dict) and k.get('name_en') == exc_name]
    all_kpis = kept_kpis + kpis_data.get('kpis', [])
    hero = None
    max_score = -1
    for kpi in all_kpis:
        score = kpi.get('pv_score', -1)
        if isinstance(score, (int, float)) and score > max_score:
            max_score = score
            hero = kpi.get('name_en')
    company['kpis'] = all_kpis
    company['hero_kpi'] = hero
    with open(company_file, 'w') as f:
        json.dump(company, f, indent=2, ensure_ascii=False)
```

### Vérification finale
```python
import json
from pathlib import Path

kpis_dir = Path('/Users/yann/spx-app/.batches-drafts-safe/kpis-haut')
companies_dir = Path('/Users/yann/spx-app/src/data/companies')

valid = sorted([f.stem.upper() for f in kpis_dir.glob('*.json') if (companies_dir / f'{f.stem}.json').exists()])
short = []
for ticker in valid:
    base = Path(f'/Users/yann/Mettrik/docs/{ticker}')
    q_count = len(list((base / '10-Q').glob('*.htm.gz'))) if (base / '10-Q').exists() else 0
    try:
        data = json.load(open(kpis_dir / f'{ticker}.json'))
    except:
        data = json.load(open(kpis_dir / f'{ticker.lower()}.json'))
    kpis = data.get('kpis', [])
    if not kpis: continue
    max_hist = max(len(k.get('history', [])) for k in kpis)
    expected_min = max(q_count * 0.5, 8)
    if max_hist < expected_min and q_count >= 15:
        short.append((ticker, max_hist, q_count))

print(f"Tickers encore en défaut : {len(short)}")
for t, h, q in short:
    print(f"  {t}: {h} periods vs {q} 10-Q")
# OBJECTIF : 0 tickers en défaut
```

---

## RÈGLES YANN (à respecter impérativement)

- Réponses courtes, max 8 lignes. Pas d'intro, pas de recap, pas de blabla
- Français par défaut
- Pas d'em-dash (tiret long)
- JAMAIS inventer de données financières
- Ne modifier QUE history + frequency dans les kpis-haut, pas les autres champs
- JAMAIS `rm -f $VAR/*` (bloqué par sécurité Anthropic)
- Autonomie totale : ne pas demander confirmation sauf si vraiment bloqué
