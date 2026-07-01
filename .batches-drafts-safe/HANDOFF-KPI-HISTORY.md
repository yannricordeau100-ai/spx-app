# HANDOFF : Extraction historique KPI complet SP500

## CONTEXTE

Tu reprends un travail d'extraction de KPIs "haut de gamme" depuis les filings SEC (10-Q + 10-K) pour 452 sociétés du SP500. 452 fichiers kpis-haut existent déjà avec des KPIs définis. Le problème : **121 tickers ont un historique trop court** (certains 0 périodes, d'autres seulement 4 trimestres) alors que les filings locaux couvrent 7-10 ans.

## CHEMINS MAC

- **App Next.js** : `~/spx-app/`
- **Filings SEC** : `~/Mettrik/docs/<TICKER>/10-Q/*.htm.gz` et `~/Mettrik/docs/<TICKER>/10-K/*.htm.gz`
- **KPIs haut de gamme (source)** : `~/spx-app/.batches-drafts-safe/kpis-haut/<TICKER>.json`
- **Companies site (destination)** : `~/spx-app/src/data/companies/<TICKER>.json`
- **Tickers visibles** : `~/spx-app/src/data/v1-9-5-clean-all-tickers.json` (452 tickers)
- **Hero KPI index (recherche)** : `~/spx-app/src/data/v2-pipeline/_hero-kpi-index.json`

## FORMAT kpis-haut/<TICKER>.json

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
      "signal": "...",
      "frequency": "quarterly",
      "history": [
        {"q": "Q1-2020", "v": 55.957},
        {"q": "Q2-2020", "v": 28.962},
        {"q": "Q3-2020", "v": 26.418},
        {"q": "Q4-2020", "v": 26.444},
        {"q": "Q1-2021", "v": 65.597}
      ]
    }
  ],
  "_extracted_at": "2026-06-30"
}
```

## RÈGLES CRITIQUES

### Format history
- Trimestriel : `{"q": "Q1-2022", "v": 12.5}` (Q1=jan-mar, Q2=avr-jun, Q3=jul-sep, Q4=oct-dec)
- Annuel fiscal : `{"q": "FY2022", "v": 50.0}` (pour KPIs uniquement dans les 10-K)
- Fiscal year décalé (AAPL=sep, NKE=mai, etc.) : utiliser le format fiscal de la sté (ex: AAPL Q1-FY2022 = oct-dec 2021)
- Trié chronologiquement, sans doublons

### Champ frequency (OBLIGATOIRE sur chaque KPI)
- `"frequency": "quarterly"` si le KPI apparaît dans au moins un 10-Q
- `"frequency": "annual"` si le KPI n'apparaît que dans les 10-K

### Lecture des filings
- 10-Q : `zcat <fichier> 2>/dev/null | head -c 40000`
- 10-K : `zcat <fichier> 2>/dev/null | head -c 60000`
- Identifier le trimestre : chercher "Three months ended March 31, 2022" → Q1-2022
- 10-K couvre Q4 + année complète. Extraire Q4 si données trimestrielles dispo, sinon FY

### NE PAS modifier
- Les champs `short`, `name_fr`, `name_en`, `value`, `unit`, `yoy`, `pv_score`, `signal`
- Seuls `history` et `frequency` doivent être mis à jour

### Interdictions sécurité
- JAMAIS `rm -f $VAR/*` (bloqué par Anthropic, utiliser chemins littéraux)
- JAMAIS inventer de valeurs. Si pas trouvé dans le filing = ne pas ajouter ce trimestre
- JAMAIS écraser un historique long par un historique court

## LES 121 TICKERS À TRAITER

Format : TICKER:historique_actuel/10-Q_disponibles/10-K_disponibles

```
BA:8h/30q/10k,COF:0h/30q/10k,CRL:5h/30q/10k,DD:11h/25q/9k,DLTR:0h/30q/10k,DOC:4h/30q/10k,DOV:0h/30q/10k,DPZ:4h/30q/10k,DTE:4h/29q/10k,EMR:0h/30q/10k,EQT:5h/30q/10k,EVRG:4h/23q/8k,EXC:7h/30q/10k,FE:10h/29q/10k,FSLR:10h/29q/10k,GEN:11h/29q/10k,GPN:8h/29q/10k,GWW:12h/29q/10k,HAS:12h/30q/10k,HON:10h/30q/10k,HWM:6h/30q/10k,IBM:5h/30q/10k,IP:9h/30q/10k,J:4h/30q/10k,JBL:7h/30q/10k,JCI:8h/29q/10k,JPM:4h/15q/5k,KEY:4h/30q/10k,KKR:6h/30q/10k,KMI:2h/30q/10k,L:6h/30q/10k,LH:6h/30q/10k,LHX:6h/29q/10k,LMT:7h/30q/10k,LOW:5h/30q/10k,LRCX:0h/30q/10k,LVS:7h/31q/10k,LYB:9h/29q/10k,LYV:3h/30q/10k,MAR:3h/29q/10k,MAS:0h/30q/10k,MCHP:4h/30q/10k,MCK:2h/30q/10k,MCO:4h/31q/10k,META:4h/15q/5k,MGM:3h/30q/10k,MKC:4h/30q/10k,MLM:0h/30q/10k,MO:1h/29q/10k,MPC:3h/30q/10k,MTB:4h/29q/10k,NCLH:2h/30q/10k,NKE:4h/30q/10k,NRG:4h/30q/10k,NUE:5h/30q/10k,NWS:6h/30q/10k,O:4h/29q/10k,OKE:6h/30q/10k,OTIS:4h/19q/6k,OXY:5h/30q/10k,PCG:10h/31q/10k,PEG:6h/30q/10k,PEP:5h/30q/10k,PFG:11h/30q/10k,PGR:10h/30q/10k,PKG:6h/30q/10k,PLD:6h/30q/10k,PM:4h/30q/10k,PRU:8h/30q/10k,PSX:6h/29q/10k,RF:4h/30q/10k,RJF:3h/30q/10k,RMD:4h/29q/10k,ROK:4h/30q/10k,ROL:11h/30q/10k,ROP:4h/30q/10k,SBAC:2h/30q/10k,SBUX:4h/30q/10k,SJM:3h/30q/10k,SMCI:5h/24q/7k,SO:10h/30q/10k,SRE:6h/30q/10k,STLD:4h/31q/10k,STT:2h/30q/10k,STZ:7h/30q/10k,SWK:5h/29q/10k,SYF:12h/30q/10k,SYK:4h/29q/10k,SYY:0h/30q/10k,T:4h/31q/10k,TAP:4h/30q/10k,TDY:7h/31q/10k,TECH:7h/30q/10k,TER:7h/30q/10k,TFC:7h/29q/10k,TPR:7h/30q/10k,TSN:4h/30q/10k,TT:8h/29q/10k,TYL:7h/29q/10k,UAL:7h/30q/10k,UHS:0h/30q/10k,UPS:0h/30q/10k,URI:4h/30q/10k,USB:0h/30q/10k,V:4h/29q/10k,VICI:4h/25q/9k,VMC:4h/30q/10k,VRSK:3h/30q/10k,VRTX:4h/30q/10k,VST:4h/27q/9k,VTR:2h/30q/10k,WAT:4h/30q/10k,WBD:4h/30q/10k,WEC:4h/30q/10k,WELL:4h/30q/10k,WM:6h/29q/10k,WRB:6h/30q/10k,WST:0h/31q/10k,WYNN:4h/30q/10k,XEL:4h/30q/10k,XOM:6h/30q/10k
```

## MÉTHODE DE TRAVAIL

Pour chaque ticker :

1. **Lire** le fichier kpis-haut : `cat ~/spx-app/.batches-drafts-safe/kpis-haut/<TICKER>.json`
2. **Lister** tous les 10-Q : `ls ~/Mettrik/docs/<TICKER>/10-Q/*.htm.gz 2>/dev/null | sort`
3. **Lister** tous les 10-K : `ls ~/Mettrik/docs/<TICKER>/10-K/*.htm.gz 2>/dev/null | sort`
4. **Pour chaque filing** (du plus ancien au plus récent) : `zcat <fichier> 2>/dev/null | head -c 40000`
   - Identifier le trimestre/année
   - Chercher chaque KPI (par son `short` ou `name_en`)
   - Extraire la valeur numérique
5. **Construire** l'historique complet (merger avec existant, ne pas perdre de données)
6. **Écrire** le fichier mis à jour avec Python :
```python
import json
with open(f'~/spx-app/.batches-drafts-safe/kpis-haut/{TICKER}.json') as f:
    d = json.load(f)
# Mettre à jour d['kpis'][i]['history'] et d['kpis'][i]['frequency']
with open(f'~/spx-app/.batches-drafts-safe/kpis-haut/{TICKER}.json', 'w') as f:
    json.dump(d, f, indent=2, ensure_ascii=False)
```

## VÉRIFICATION OBLIGATOIRE APRÈS CHAQUE TICKER

Après écriture, relire le fichier et vérifier :
- Chaque KPI a `frequency` ("quarterly" ou "annual")
- Le KPI avec le plus de `history` a au moins `nombre_10Q * 0.4` entries
- Aucun trimestre en doublon
- History trié chronologiquement

Script de vérification rapide :
```python
import json
d = json.load(open(f'path/{TICKER}.json'))
for k in d['kpis']:
    h = k.get('history', [])
    print(f"  {k['short']}: {len(h)} periods, freq={k.get('frequency','MANQUANT')}")
```

## INTÉGRATION SITE (APRÈS TOUS LES 121 TERMINÉS)

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

## VÉRIFICATION FINALE GLOBALE

Après intégration, lancer :
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
for t, h, q in short[:20]:
    print(f"  {t}: {h} periods vs {q} 10-Q")
```

**Objectif : 0 tickers en défaut.**

## POINTS DE CONTRÔLE POUR YANN

À chaque batch de ~20 tickers terminés, écrire un message à Yann avec :
1. Nombre de tickers traités / restants
2. Tickers avec problèmes détectés (si applicable)
3. ETA restante

## WORKFLOW RECOMMANDÉ

Utiliser le Workflow tool pour paralléliser. Le script existe déjà :
`/Users/yann/.claude/projects/-Users-yann/56f7ef11-444c-4ed3-8570-ee39b82a09d5/workflows/scripts/full-kpi-history-sp500-wf_d522bcc9-432.js`

Mais tu peux aussi traiter séquentiellement si plus fiable (agent par agent).
