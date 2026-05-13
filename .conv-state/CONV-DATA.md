# CONV-DATA — État du travail

---

## 🟢 SESSION 13 mai 14:55-16:20 CEST · RÉSUMÉ POUR REPRISE (Time Machine transfer prévu 17:00)

**Faits accomplis** :
- ✅ Fix bug AAPL CAGR "+Infinity %/an" : `src/components/dividend-aristocrat-card.tsx`
  ligne 132-135 + 465-478 (badge conditionnel). Vérifié visuellement via Claude
  Preview sur /cat (V1 demo public) → no Infinity, no NaN, "CAGR 5y 7.3 %" rendu.
- ✅ Re-extract 12 hero history hallucinées (broadcast CONV-TRANSCRIPTS) :
  - 6 ✅ vérifiées via 10-K (BJ, BURL, COST, ELAN, PANW, T)
  - 6 ⚪ marquées `_hero_history_unverified=true` + history réduite à 1 point
    (BAC, DANSKE.CO, GIS, NOKIA.HE, NVS, WWD). Plus de data fake.
- ✅ Events 3 stés top 307 manquantes : ADYEN.AS, NTNX, AOS → fetchés via yfinance.news.
- ✅ Audit `audit-top307-v18-blocks.py` réécrit avec fuzzy hero match + AI positioning correct.
  Nouvelle vérité : ranks 100%, events 100%, customer_type 99%, logo 98%,
  ai_positioning 98%, hero_history 96%, freshness 94%, kpis 93%.
- ✅ Re-extract enhance-only mode tenté sur 30 stés hero_history short : 0 succès
  car ces 30 stés ont un `hero_kpi` qui ne matche pas le tableau `kpis[]` exactement
  (compensé côté UI par fuzzy fallback de `load-company.ts`).

**Trous structurels restants** (non comblables sans nouveau pipeline) :
- Risks 78% / Gov 59% / Segment 54% / Geography 44% : sources EU/FPI sans
  DEF14A ou 10-K, nécessitent extracteur cat3-european multilingue (~3-5h dev).
- TAM 2% : **honesty rule = normal** (TAM seulement si sté l'a chiffré).

**Commits cette session** (branche `staging`) :
- `59036eb3` fix top307 hero re-extract + AAPL CAGR (23 files)
- `ff7fd85f` audit fuzzy hero + AI fix + enhance-only mode (4 files)
- `7c0a274f` visual verif Mettrik via Claude Preview

**Scripts ajoutés (idempotents)** :
- `scripts/reextract-hero-history-v18.py` (modes strict + enhance via env REEXTRACT_MODE)
- `scripts/audit-top307-v18-blocks.py` (fuzzy + multi-source-files)
- `scripts/fetch-events-3missing.py` (one-shot 3 stés)
- `scripts/fetch-logos-top307.py` (utilise /tmp/logos-pending-top307.txt)

**État technique** : 0 proc Python actif, dev server PID 63413 port 3000, RAM ~2.6 GB usable.
**Stés top 307 100% sur 13 blocs** : 4 (incluant MSFT, TSLA).

**Pour reprendre** : `python3 scripts/audit-top307-v18-blocks.py` donne l'état courant.

---

> 🚨🚨 **TÂCHE PRIORITAIRE CRITIQUE — DEMANDÉE PAR YANN VIA CONV-TRANSCRIPTS (13 mai 2026 ~03h00)** (LARGEMENT TRAITÉE CETTE SESSION, cf. encadré 🟢 ci-dessus)
>
> **PROBLÈME** : 75 stés ont un hero KPI history complètement FAKE. Yann a détecté
> visuellement sur BAC (Loan Book = +5 Mds chaque trim × 8 = mathématiquement
> impossible). C'est de la **donnée hallucinée par LLM** (Cerebras qui invente
> plutôt que de skip quand le 10-K ne donne pas l'history).
>
> **15 stés concernées dans le top 307 V1.8** (URGENT démo) :
> BAC, AMZN, COST, BJ, BURL, DANSKE.CO, ELAN, GIS, NOKIA.HE, NVS, PANW, T, WWD, +2
>
> **Exemple le plus parlant** : WWD Aerospace Revenue history = [2024, 2023, 2022, 2021, 2020]
> → ce sont LITTÉRALEMENT LES ANNÉES, pas du chiffre d'affaires !
> Le LLM a confondu axis labels et valeurs.
>
> **Liste complète + détection automatique** :
> ```bash
> python3 -c "
> import json, glob, os
> for f in glob.glob('src/data/v2-pipeline/*.json'):
>     if '_' in os.path.basename(f): continue
>     d = json.load(open(f))
>     hero = d.get('hero_kpi')
>     for k in d.get('kpis',[]):
>         if k.get('short') != hero: continue
>         h = k.get('history', [])
>         if len(h) < 4: continue
>         diffs = [round(h[i+1]-h[i], 6) for i in range(len(h)-1)]
>         if all(x == diffs[0] for x in diffs) and diffs[0] != 0:
>             print(f'{d.get(\"ticker\"):10} {hero:35} {h}')
>             break
> "
> ```
> Le JSON détaillé est sauvegardé dans `/tmp/synthetic-suspects.json`.
>
> **ACTIONS DEMANDÉES** :
> 1. **Ré-extraction urgente top 307 (15 stés)** via Cerebras avec **prompt
>    strict anti-fabrication** : « si la source ne contient pas explicitement
>    l'history numérique, retourner NULL plutôt qu'inventer une progression
>    linéaire ». ETA estimé : 30-45 min Cerebras.
> 2. **Pour les 60 hors top 307** : marquer `_fit_for_site: false` ou
>    `hero_kpi: null` dans v2-pipeline/<ticker>.json → la sté affichera
>    "Fiche en préparation" plutôt que mentir.
> 3. **Audit Pass 1/2/3 pipeline** : pourquoi le LLM hallucine au lieu de
>    skip ? Probable bug dans le prompt système (trop permissif). Renforcer
>    consigne « ne JAMAIS inventer, retourner NULL si pas d'info dans le doc ».
> 4. **Re-run filtre admission** après nettoyage → rebuild v1-7-public.json.
>
> **DEADLINES** :
> - ACK + plan : 30 min après ton prochain prompt user (ou autonomie)
> - Ré-extraction 15 top 307 : 4h max après ACK
> - Cleanup 60 hors top 307 : 6h max après ACK
> - Renforcement prompt anti-fabrication : avant prochain run extraction
>
> **MÉCANISME DE SUIVI** :
> - CONV-TRANSCRIPTS programme un wakeup dans 4h pour vérifier
> - SI à ce moment les datasets fake sont toujours là → escalation à Yann
>   + CONV-TRANSCRIPTS peut faire le cleanup `_fit_for_site: false` elle-même
>   en override scope (pour éviter que Yann voie du fake en démo)
>
> **CRITICITÉ MAXIMALE** : démo investisseur baggr.fr / iq-invest compromise
> si data fake reste visible. Yann a explicitement dit que c'est inacceptable.
>
> Ne pas ignorer ce broadcast.

---

# CONV-DATA — État du travail (12 mai 2026 ~00:50 CEST)

> Pipeline data Mettrik : sec-data scraping + transcripts + résumé IA + bloc UI V1.8
> + risks + governance + freshness.
> Périmètre SHARED-STATUS : `sec-data/`, scripts Python, JSON `src/data/`.

---

## ⚠️ RAM CRITIQUE — RÈGLE STRICTE

Yann a déjà été forcé de fermer 2 navigateurs. **1 SEUL proc lourd à la fois.**
Sleep 3-5s entre appels API. Pas de dev server sauf pour test final ponctuel.
Si Claude coupé de force : reprendre depuis ce fichier (chaque tâche a une
commande de relance complète plus bas).

---

## ✅ TÂCHES TERMINÉES CETTE SESSION

| Tâche | Stés OK | Date |
|---|---|---|
| Freshness top 307 V1.8 (publication_date + next_earnings_date) | 214 updated + 91 unchanged | 12 mai 04:48 |
| Enlever `latest_news` partout | 288 fichiers nettoyés + load-company.ts patché | 12 mai 04:42 |
| Facteurs de risque (format strict V1) | **204 stés écrites**, top 307 V1.8 = 236/305 (77%) | 12 mai 14:11 |
| Gouvernance & rémunération (9 metrics + voting + top 3) | **1195 stés écrites** | 12 mai 16:20 |

---

## 🔄 TÂCHES RESTANTES (à faire / en attente)

### Priorité 1 — top_capital ciblée 2e pass
**Problème**: 1195 governance écrits MAIS `top_capital=0` pour la majorité (NVDA,
MSFT, ZBH...). Le LLM n'a pas matché la section "Security Ownership of Certain
Beneficial Owners" du DEF14A.

**Action**: 2e pass ciblée sur cette section uniquement, avec prompt plus précis
pour extraire top 3 actionnaires.

**Cible**: ~1100 stés avec governance mais top_capital vide.
**ETA**: ~55 min avec sleep 3s, 1 proc (RAM safe).

### Priorité 2 — Pass 3 SP500 manquantes accessibles
**Problème**: Cisco (CSCO) inaccessible page V1.8 car:
1. CSCO PAS dans `v1-8-tickers-sorted.json` (305 stés)
2. CSCO dataset `_fit_for_site: false` (`hero_history_too_short_0`)

**SP500 hors top 307 V1.8 (367 stés)** distribution:
- 36 "ready" (Pass 3 OK, fit OK) → **ajouter à v1-8-tickers-sorted.json**
- 30 "no_p3" → lancer Pass 3 Haiku 4× rapide
- **296 "fit_false"** (causes: history_too_short 166, no_yoy 105, too_few_kpis 97, hero_value_null 12) → besoin Pass 1 ré-extraction (LOURD, REPORTÉ)
- 5 "no_dataset" → Pass 1+2+3 from scratch (REPORTÉ)

**Quick wins** (Priorité 2a, ETA 5 min):
- Ajouter les 36 "ready" à v1-8-tickers-sorted.json
- Pass 3 Haiku sur les 30 "no_p3" (1 proc, sleep 3s)
- Pass 3 sur les 6 top 307 V1.8 missing P3 (AMAT, UNH, PGR, BP, EIX, WST)

**Reportées RAM-heavy** (Priorité 3, à faire quand Mac dispo plein régime):
- Pass 1 ré-extraction hero_history des 166 stés `history_too_short`
- Pass 2 KPI re-extraction des 97 stés `too_few_kpis`
- Extraction Pass 1+2+3 from scratch des 5 stés `no_dataset`

---

## 🟢 PROCS À RELANCER SI MAC SLEEP / CLAUDE COUPÉ

### Aucun proc actif actuellement
- sec-download-v2 PIDs 98908/98930 sont morts (Mac sleep ~05:00 → 13:00)
- gov-run PID 3266 a fini à 16:20
- next dev (port 3000) killé pour libérer RAM
- tail consolidé killé (sec-download morts)

### Commandes de relance (1 proc à la fois, sleep 3s)

```bash
# 1) Régénérer la liste pending governance top_capital (Priorité 1)
python3 << 'PY'
import json
from pathlib import Path
P = Path("/Users/yann/spx-app/src/data/v2-pipeline")
candidates = []
for f in P.glob("*.json"):
    if f.name.startswith("_") or ".gemini." in f.name: continue
    try:
        d = json.loads(f.read_text())
        g = d.get("governance")
        if isinstance(g, dict) and (g.get("ceo_name") or g.get("board_size")):
            tc = g.get("top_capital") or []
            if not isinstance(tc, list) or len(tc) < 1:
                candidates.append(d.get("ticker") or f.stem.upper())
    except: pass
Path("/tmp/governance-topcap-pending.txt").write_text("\n".join(candidates))
print(f"💾 {len(candidates)} stés top_capital pending")
PY

# 2) Lancer top_capital 2e pass (script à créer : scripts/enrich-topcap-v2.py)
PY312=/Library/Frameworks/Python.framework/Versions/3.12/bin/python3
cd ~/spx-app && (nohup caffeinate -s $PY312 scripts/enrich-topcap-v2.py > /tmp/topcap-run.log 2>&1 < /dev/null &)

# 3) Pass 3 quick wins SP500 (script déjà existant, voir scripts/_pass3-haiku-orchestrator.sh)
# À adapter pour ne traiter QUE les 30+6 missing P3
# Régénérer liste pending d'abord :
python3 -c "
import json
from pathlib import Path
P = Path('/Users/yann/spx-app/src/data/v2-pipeline')
top307 = set(json.load(open('/Users/yann/spx-app/src/data/v1-8-tickers-sorted.json')))
sp1500 = json.load(open('/Users/yann/spx-app/sec-data/_meta/sp1500.json'))
sp500 = [x['ticker'] for x in sp1500['tickers'] if x.get('index') == 'sp500']
missing_p3 = []
for tk in list(top307) + sp500:
    f = P / f'{tk.lower()}.json'
    if not f.exists(): continue
    try:
        d = json.loads(f.read_text())
        if '_validation' not in d:
            missing_p3.append(tk)
    except: pass
Path('/tmp/pass3-pending.txt').write_text('\n'.join(set(missing_p3)))
print(f'{len(set(missing_p3))} stés missing P3')
"

# 4) Restart dev server pour test visuel (UNIQUEMENT si besoin)
cd ~/spx-app && (nohup npm run dev > /tmp/mettrik-dev-server.log 2>&1 < /dev/null &)
```

---

## 📋 ÉTAT V1.8 ACCESSIBILITÉ ACTUEL

| Indicateur | Valeur |
|---|---|
| Top 307 V1.8 défini dans `v1-8-tickers-sorted.json` | 305 stés |
| Top 307 V1.8 `isV18Eligible=true` (accessibles) | 299/305 (98%) |
| Top 307 V1.8 missing Pass 3 | 6 (AMAT, UNH, PGR, BP, EIX, WST) |
| Top 307 V1.8 avec risks complets (score_rationale) | 236/305 (77%) |
| Top 307 V1.8 avec governance complète | 53/305 (17%, en cours d'amélioration) |
| Total stés v2-pipeline | 4401 |
| SP500 (503 stés) hors top 307 V1.8 | 367 |
| SP500 hors top 307 ready à ajouter | 36 (Pass 3 OK + fit OK) |

---

## 🔧 SCRIPTS CLÉS (chemins absolus)

| Script | Rôle |
|---|---|
| `~/spx-app/scripts/enrich-freshness-top307-v18.py` | publication_date + next_earnings_date |
| `~/spx-app/scripts/enrich-risks-v18-pipeline.py` | Facteurs de risque format V1 |
| `~/spx-app/scripts/enrich-governance-v18-pipeline.py` | 9 metrics + voting + top 3 |
| `~/spx-app/scripts/enrich-risks-governance-haiku.py` | OBSOLETE (v1 CONV-SYSTEMS) |
| `~/spx-app/scripts/pipeline-llm-pass2.py` | Pass 2 enrichissement |
| `~/spx-app/scripts/_pass3-haiku-orchestrator.sh` | Pass 3 multi-procs |

**Python 3.12 explicit path** : `/Library/Frameworks/Python.framework/Versions/3.12/bin/python3` (PAS `python3` qui est 3.9 et casse les `str | None`).

---

## 🐛 PROBLÈMES IDENTIFIÉS

1. **Mac sleep tue tous les procs** même PPID=1. Workaround = `caffeinate -s` (mais inefficace si clapet fermé).
2. **CSCO et nombreuses SP500 inaccessibles** car `_fit_for_site:false` (hero_history vide). Nécessite Pass 1 ré-extraction (RAM-lourd).
3. **DEF14A top_capital extraction faible** : ~80% des governance écrites ont top_capital=0. Solution = 2e pass ciblée section "Security Ownership of Certain Beneficial Owners".
4. **Annual-text EU pures incomplet** (Roche, AZN.ST, SIE.DE, etc. = 22 KB d'extrait). Limite du scraper CONV-CONCEPTS V3 sur les rapports européens.

---

## 📂 FICHIERS LOGS (où vérifier le progrès)

```
~/spx-app/.conv-state/CONV-DATA.md                  ← ce fichier
~/spx-app/.conv-state/CONV-DATA-freshness-top307.log
~/spx-app/.conv-state/CONV-DATA-risks.log
~/spx-app/.conv-state/CONV-DATA-governance.log
~/spx-app/.conv-state/CONV-DATA-topcap.log          ← à créer
~/spx-app/.conv-state/CONV-DATA-pass3.log           ← à créer
```

---

## 🔄 PLAN NUIT 13 mai 03:00 → 16:00 CEST (~13h Yann)

| # | Tâche | ETA | Total |
|---|---|---|---|
| 0 | Finir topcap en cours (PID 28630, 603/1021 → fin ~03:44) | 40 min | 0:40 |
| 1 | URGENT broadcast CONV-TRANSCRIPTS : fake hero history (15 top 307 + 60 hors) | 1h30 | 2:10 |
| 2 | Fix `revenue_by_geography.slices null` (Apple + similaires) | 1h | 3:10 |
| 3 | Compléter revenue_by_geography top 307 (228 manquants) | 2h | 5:10 |
| 4 | Compléter revenue_by_segment top 307 (176 manquants) | 1h30 | 6:40 |
| 5 | Risks manquants top 307 (~69, limité par source EU) | 1h | 7:40 |
| 6 | Governance complétion top 307 | 1h | 8:40 |
| 7 | KPI Pass 1 ré-extract depuis nouveaux 10-Q sec-download (296 SP500 fit_false) | 3h | 11:40 |
| 8 | Vérif visuelle finale + résumé nuit DOB | 30 min | 12:10 |

**Total ~12h dans budget 13h. Marge 1h pour imprévus.**

---

## 🔄 EN COURS — résumé SHARED-STATUS (13 mai 03:38 CEST)

- ✅ Étape 1 FAIT (13 mai 02:34) : 36 stés "ready" ajoutées à `v1-8-tickers-sorted.json` (305 → 341).
- ⏸ top_capital 2e pass : interrompu à 03:25, 952/1021 (197 ✅ écrits). À reprendre si RAM dispo.
- ✅ Cleanup fake hero (03:35) : 38 stés _fit_for_site=false (7 top 307: T, BAC, WWD, NVS, CRWD, DANSKE.CO, NOKIA.HE + 31 hors). Backup `/tmp/backup-fake-hero-cleanup-20260513-0335/`.
- ✅ Cleanup null slices (03:35) : 116 fichiers nettoyés (47 geo + 90 seg supprimés, 8 nettoyés). AAPL geo purgé. Backup `/tmp/backup-null-slices-20260513-0335/`.
- ⏸ FILE D'ATTENTE (RAM critique 107M unused) : rebuild public.json, phases 2-8 du plan 13h.
- 🛌 RAM stratégie : 0 nouveau proc tant que <500M unused. Si seuil OK : 1 proc sleep 5s.

### Si RAM remonte (≥500M unused), commande de relance topcap (69 stés restantes):

```bash
# Régénérer pending (skip ceux déjà OK)
python3 -c "
import json
from pathlib import Path
P = Path('/Users/yann/spx-app/src/data/v2-pipeline')
top307 = set(json.load(open('/Users/yann/spx-app/src/data/v1-8-tickers-sorted.json')))
sp1500 = json.load(open('/Users/yann/spx-app/sec-data/_meta/sp1500.json'))
sp500 = {x['ticker'] for x in sp1500['tickers'] if x.get('index') == 'sp500'}
prio_set = top307 | sp500
candidates = []
for f in P.glob('*.json'):
    if f.name.startswith('_') or '.gemini.' in f.name: continue
    try:
        d = json.loads(f.read_text())
        g = d.get('governance')
        if isinstance(g, dict) and (g.get('ceo_name') or g.get('board_size')):
            tc = g.get('top_capital') or []
            if not isinstance(tc, list) or len(tc) < 1:
                candidates.append(d.get('ticker') or f.stem.upper())
    except: pass
prio = [t for t in candidates if t in prio_set]
others = [t for t in candidates if t not in prio_set]
Path('/tmp/topcap-pending.txt').write_text('\n'.join(prio + others))
print(f'{len(prio + others)} pending')
"
# Relance avec sleep 5s (plus prudent)
PY312=/Library/Frameworks/Python.framework/Versions/3.12/bin/python3
sed -i.bak 's/SLEEP_BETWEEN_CALLS = 3.0/SLEEP_BETWEEN_CALLS = 5.0/' ~/spx-app/scripts/enrich-topcap-v2.py
cd ~/spx-app && (nohup caffeinate -s $PY312 scripts/enrich-topcap-v2.py > /tmp/topcap-run.log 2>&1 < /dev/null &)
```

### Si coupure pendant top_capital (commande relance):

```bash
# Régénérer pending (skip les déjà faits)
python3 -c "
import json
from pathlib import Path
P = Path('/Users/yann/spx-app/src/data/v2-pipeline')
candidates = []
for f in P.glob('*.json'):
    if f.name.startswith('_') or '.gemini.' in f.name: continue
    try:
        d = json.loads(f.read_text())
        g = d.get('governance')
        if isinstance(g, dict) and (g.get('ceo_name') or g.get('board_size')):
            tc = g.get('top_capital') or []
            if not isinstance(tc, list) or len(tc) < 1:
                candidates.append(d.get('ticker') or f.stem.upper())
    except: pass
top307 = set(json.load(open('/Users/yann/spx-app/src/data/v1-8-tickers-sorted.json')))
sp1500 = json.load(open('/Users/yann/spx-app/sec-data/_meta/sp1500.json'))
sp500 = {x['ticker'] for x in sp1500['tickers'] if x.get('index') == 'sp500'}
prio_set = top307 | sp500
prio = [t for t in candidates if t in prio_set]
others = [t for t in candidates if t not in prio_set]
Path('/tmp/topcap-pending.txt').write_text('\n'.join(prio + others))
print(f'{len(prio + others)} pending ({len(prio)} prio)')
"

# Relance
PY312=/Library/Frameworks/Python.framework/Versions/3.12/bin/python3
cd ~/spx-app && (nohup caffeinate -s $PY312 scripts/enrich-topcap-v2.py > /tmp/topcap-run.log 2>&1 < /dev/null &)
```
