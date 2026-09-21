---
name: project-mettrik-extraction-state
description: "Etat exact des extractions data-lake SP500 au 2026-06-22, règles de reprise, listes todo"
metadata: 
  node_type: memory
  type: project
  originSessionId: b53ac9f1-5cb9-4373-a064-a02acd73ca24
---

## Etat au 2026-06-22 13h30 TM

| Bloc | Fait | Restant | Bloqués (sans source) |
|---|---|---|---|
| `risks/extracted.json` | 96/656 | ~448 | ~90 (non-US sans _risks_src) |
| `KPI normaux/kpis_haut_fr.json` | 487/656 | 38 | ~131 (non-US sans 10Q) |
| `stories/extracted.json` ou `stories_fr.json` | 557/656 | 9 | ~90 (non-US sans _srctext) |

**Why:** chantier lancé le 2026-06-22 pour enrichir chaque dossier sté avec risques, KPI trimestriels 5 ans, stories.

**How to apply:** lire `/tmp/work_state_v2.json` pour listes todo exactes + formats JSON attendus.

## Structure cible par dossier `data-lake/<T>/`

```
data-lake/<T>/
  KPI normaux/
    kpis_haut_fr.json   # KPIs distinctifs (specifique:true), historique trimestriel
    kpis_milieu_fr.json # KPIs génériques (specifique:false), historique trimestriel
  risks/
    extracted.json      # 3-7 risques FR, du dernier doc disponible
  stories/
    extracted.json      # 3-6 stories FR/EN du dernier earnings
```

## Règles CRITIQUES pour la reprise

### 1. Risks — source fichier OBLIGATOIRE
- Toujours lire `_risks_src_30k.txt` (30KB, créé pour 502 tickers)
- JAMAIS `_risks_src.txt` (94KB = 24 000 tokens, cause de surconsommation)
- Fallback si pas de `_risks_src_30k.txt` : `_srctext.txt` tronqué à 30KB via Read limit

### 2. Wave size MAX 3 agents en parallèle
- Le serveur Anthropic rate-limite au-delà de 3 agents simultanés sur ce compte
- Waves de 2 = optimal, waves de 3 = acceptable

### 3. Session limit
- Reset à 6h00 TM (Europe/Zurich = Europe/Paris)
- Surveiller les erreurs "session limit · resets Xpm" pour savoir quand relancer

### 4. Format risks/extracted.json
```json
{
  "ticker": "<T>",
  "source": "_risks_src_30k.txt",
  "extracted_at": "2026-06-22T00:00:00Z",
  "risks": [{
    "category": "<Operational|Financial|Regulatory|Market|Technology|ESG>",
    "title": "<max 80 chars FR, PAS d'em-dash>",
    "description": "<100-200 chars FR, PAS d'em-dash>",
    "severity": 3,
    "trend": "<stable|improving|deteriorating>",
    "score_rationale": "<FR>",
    "source": "_risks_src_30k.txt"
  }]
}
```

### 5. Format KPI normaux (kpis_haut_fr.json et kpis_milieu_fr.json)
```json
[{
  "short": "<slug>",
  "nom_fr": "<FR, PAS d'em-dash>",
  "nom_en": "<EN>",
  "valeur": 123.4,
  "unite": "<M $|Mds $|%|K unités>",
  "periode_type": "quarter",
  "historique": [{"periode": "T1 2023", "valeur": 100.0, "date": "YYYY-MM-DD"}],
  "yoy": "+12,3 %",
  "source": "10Q YYYY-MM",
  "specifique": true
}]
```
- Source 10Q : lire les 4 fichiers `.htm.gz` les plus récents dans `data-lake/<T>/10Q/`
- Viser 12-20 trimestres d'historique

### 6. Tickers restants (à vérifier via script avant de lancer)
```bash
cd ~/spx-app && python3 -c "
import os, json
status = json.load(open('src/data/extraction-status.json'))
sp500 = list(status['tickers'].keys())
todo_risks = [t for t in sp500 if not os.path.exists(f'data-lake/{t}/risks/extracted.json') and os.path.exists(f'data-lake/{t}/_risks_src_30k.txt')]
todo_kpis = [t for t in sp500 if not os.path.exists(f'data-lake/{t}/KPI normaux/kpis_haut_fr.json') and os.path.exists(f'data-lake/{t}/10Q') and any(f.endswith('.gz') for f in os.listdir(f'data-lake/{t}/10Q'))]
todo_stories = [t for t in sp500 if not os.path.exists(f'data-lake/{t}/stories/extracted.json') and not os.path.exists(f'data-lake/{t}/stories_fr.json') and os.path.exists(f'data-lake/{t}/_srctext.txt')]
print(f'risks: {len(todo_risks)}, kpis: {len(todo_kpis)}, stories: {len(todo_stories)}')
print('risks:', todo_risks[:5])
print('stories:', todo_stories)
"
```

### 7. Après chaque batch terminé
Déplacer les nouveaux `kpis_haut_fr.json` / `kpis_milieu_fr.json` écrits à la racine vers `KPI normaux/` :
```python
import os, shutil, json
status = json.load(open('src/data/extraction-status.json'))
for t in status['tickers']:
    for f in ['kpis_haut_fr.json','kpis_milieu_fr.json']:
        src = f'data-lake/{t}/{f}'
        if os.path.exists(src):
            os.makedirs(f'data-lake/{t}/KPI normaux', exist_ok=True)
            shutil.move(src, f'data-lake/{t}/KPI normaux/{f}')
```

## MAJ 7 juillet 2026
- 503 stes SP500 en ligne. KPI: 10-Q/10-K (haut, historique complet) + ER/calls (2249) + calls 5 ans (191) + stories calls+filings (dedoublonnees, ~5400 nettes) + sectoriels banques/REIT/assureurs (448 sur 75 stes).
- Remuneration: comp_detail complet 502/503 depuis proxys EDGAR dates (edgar-latest_*.htm, source_fiscal_year>=2024). PSKY = pre-fusion, pas de proxy. BK 83.47M VERIFIE (mega-grant Vince).
- ATTENTION: fichiers DEF14A locaux historiques ont des noms UUID non tries — toujours utiliser edgar-latest_*.htm.
- Sources locales: ER 18176 docs (503/503), transcripts Fool 10009 (499/503), supplements 1348 (8-K ex-99.2+).
- Reste a faire: cron rafraichissement trimestriel (pas encore cree), detail salaire/bonus/actions pas affiche dans l'UI (donnees presentes dans governance.comp_detail).

## MAJ 7 juillet 2026 (soir)
- PIEGE 1: load-company.ts REMPLACE les kpis par kpis-haut (2 juil) — corrige le 7 juil pour reinjecter les KPI _source (ER+earnings-calls/calls-5y/stories-*/sectoriel). Toute integration future DOIT poser un _source de cette liste.
- PIEGE 2: les stories sans champ signal sont filtrees par isStoryKpiUsable (invisibles). Toujours mapper signal a l'integration.
- PIEGE 3: hero_kpi doit exister dans kpis v2 AVANT le remplacement kpis-haut ET avoir yoy non-null (heroKpiUsable), sinon la ste devient "preparing" = redirigee vers le hub silencieusement. Le dedoublonnage du 6 juil avait casse 436 heros (29 stes inaccessibles). Verifier l'eligibilite des 503 via loadV17Company apres toute passe de suppression.
- Verification finale 7 juil: 503/503 eligibles, stories visibles 10/10 en prod, tooltip comp_detail (salaire/bonus/actions/mediane/N2) en ligne.
