# CONV-MODULE-RANKS-V2 — État du module

> Démarré : 2026-05-08 ~22:50
> Dernière maj : 2026-05-12 (reprise après nouvelle règle §0 V1.8-first)

## Reprise 12 mai 2026

Vérif post-règle d'or §0 (V1.8 EN PREMIER) :

- ✅ **V1.8 top 307 = 100 % couvert** (305/305 stés ont leur ranks.json,
  V1.7 ⊇ V1.8 par effet de bord, mon run initial 615 stés couvre tout)
- ✅ **load-company.ts ligne 232 actuel** : `if (ranksEnrich.ranks[k])`
  → ranks.json gagne TOUJOURS sur v2-pipeline. Le bug merge priority est
  vraiment fixé (vu directement dans le fichier).
- ✅ **Top 10 V1.8 = top 10 ranks calculés** (v1-8-tickers-sorted.json
  ordonné par market cap, donc les ranks naturels correspondent au
  rang V1.8) : NVDA #1 → GOOGL #2 → AAPL #3 → MSFT #4 → AVGO #5 → TSLA
  #6 → LLY #7 → JPM #8 → MU #9 → V #10. Sanity check OK.
- ✅ **Staging V1.8 NVDA** : HTTP 200, "#1 dans Information Technology"
  + "#1 dans Semiconductors" rendus (labels traduits FR par CONV-SYSTEMS
  via commit 2c43a2a8).
- ⚠️ **ASMLF #11 V1.8** : doublon ASML (#10), pas dans load-company.ts
  ALIASES. À signaler à CONV-DATA.

## ACKs broadcasts depuis 8 mai

- §0 (12 mai) V1.8 EN PREMIER : appliqué par effet de bord (V1.7 ⊇ V1.8,
  pas de travail supplémentaire requis pour mon module)
- 7-bis (9 mai) ZÉRO AUTORISATION : module bulk one-shot, pas concerné
- 8bis (8 mai) JAMAIS RIEN FAIRE : déjà acké dans la conv



## Scope unique (immuable)

Corriger les ranks (#mondial, #US, sector, subsector) sur les 615 stés
V1.7 Pass 3 strict (sur 622 après dédup alias GOOG→GOOGL etc.).

Constat factuel à la prise de mandat : NVDA annoncée rank #10 mondial
dans `v2-pipeline/nvda.json` (extraction LLM 10-K) alors que NVDA est
#1 mondial à $5.14T market cap (yfinance + FMP /stable/quote).

## Périmètre strict

- ✅ Écris UNIQUEMENT dans `src/data/v2-pipeline-enrich/<ticker>.ranks.json`
- ✅ Écris dans `scripts/enrich-ranks-v2.py`
- ❌ Jamais dans `src/data/v2-pipeline/` (scope CONV-DATA)
- ❌ Pas de touche `load-company.ts` sans broadcast à CONV-SYSTEMS
- ❌ Pas de touche CompanyView, charts, proxy

## Plan d'exécution (terminé)

### Phase 1 — Diagnostic (✅ FAIT)
- [x] Lu `scripts/enrich-ranks-yfinance.py` existant
- [x] Identifié bug racine : le script v1 skippait les stés ayant des
      ranks "usables" dans v2-pipeline (ex : `"≈ #10"` est valide).
      Pas un bug yfinance staleness mais bug de skip logic.
- [x] Confirmé via FMP /stable/quote : NVDA = $5.14T, GOOGL $4.82T,
      AAPL $4.22T (cohérent avec yfinance, sources alignées).
- [x] Vérifié load-company.ts:238 : merge ranks.json UNIQUEMENT si
      pipeline rank invalide (`-`, `—`, `...`). NVDA `"≈ #10"` valide
      donc jamais remplacé.

### Phase 2 — Sources évaluées (✅ FAIT)
| Source | Verdict | Notes |
|---|---|---|
| FMP `/api/v3/quote` (legacy) | ❌ HTTP 402 deprecated août 2025 | inutilisable |
| FMP `/stable/quote` | ✅ OK US only | NVDA $5.14T, mais 0 sur BRK-B, MC.PA, ASML.AS, 9984.T |
| FMP `/stable/batch-quote` | ❌ 402 paid only | |
| Yahoo direct `/v7/finance/quote` | ❌ 401 Unauthorized | |
| yfinance (Python lib) | ✅ OK US + foreign | renvoie marketCap en monnaie locale, FX conversion requise |
| Stooq | ⚠️ HTML scraping seulement | dernier recours |

**Choix retenu** : yfinance comme source primaire avec pre-fetch FX rates.

### Phase 3 — Script V2 (✅ FAIT)
Fichier : `scripts/enrich-ranks-v2.py`

Corrections vs v1 :
- [x] Pre-fetch FX rates (EUR, GBP, JPY, CHF, SEK, NOK, DKK, CAD, HKD,
      SGD, AUD, CNY, BRL, INR, MXN, TWD, ZAR, ILS, PLN, TRY, KRW) AVANT
      le pool parallèle (évite race + yfinance double-load).
- [x] Conversion mc → USD via FX rate (sinon SoftBank apparaît à $34T
      au lieu de $230B).
- [x] Normalisation GBp → GBP, ZAc → ZAR.
- [x] Workers 4 (vs 8) pour éviter rate-limit yfinance après ~500 calls.
- [x] Dédup alias map sync avec load-company.ts (GOOG→GOOGL, BRK.A→BRK-B,
      FOX→FOXA, NWSA→NWS, UAA→UA, BRK.B→BRK-B). Évite doublons dans le
      ranking.
- [x] Force-write pour TOUTES les stés (vs v1 qui skippait stés avec
      ranks pipeline valides).
- [x] Format compatible load-company.ts existant.
- [x] Champ `_data_freshness_date` ISO ajouté.
- [x] Retry séquentiel avec backoff 1s pour les fails.
- [x] Fallback `sharesOutstanding × price` quand marketCap absent.

### Phase 4 — Test top 30 (✅ FAIT)

Top 30 calculé (USD) sur 615 stés V1.7 :
```
# 1 NVDA      $5141B  ✓
# 2 GOOGL     $4822B  ✓
# 3 AAPL      $4222B
# 4 MSFT      $3126B
# 5 AVGO      $1953B
# 6 TSLA      $1547B
# 7 LLY       $869B
# 8 JPM       $821B
# 9 MU        $729B   (Micron, AI memory)
#10 V         $611B
#11 ASML      $585B   NL (FX EUR→USD ✓)
#12 ASMLF     $582B   doublon ASML (OTC pink sheet)
#13 ORCL      $560B
#14 JNJ       $536B
#15 COST      $449B
#16 BAC       $374B
#17 NFLX      $372B
#18 CVX       $361B
#19 PG        $340B
#20 BABA      $338B   HK
#21 UNH       $336B
#22 ROG.SW    $329B   CH (FX CHF→USD ✓)
#23 AMAT      $326B
#24 HD        $321B
#25 GE        $316B
#26 AZN.ST    $281B   UK (FX SEK→USD ✓)
#27 NVS       $277B
#28 MRK       $277B
#29 TXN       $260B
#30 RY        $252B   CA
```

Note : AMZN, META, WMT, BRK-B, XOM, MA absents car PAS dans
v1-7-public.json (scope CONV-DATA, pas mon scope).

### Phase 5 — Run 622 stés + écriture (✅ FAIT)
- 615 ranks.json écrits (622 après dédup alias - 7 fails)
- ETA : 62s fetch + 7s retry + 1s write = ~70s total
- Fails : 7 stés warrants/delisted (AVU, BPYPN, CNCKW, CRGOW, GHBWF,
  HAB.DE, TLS1V.HE)
- HAB.DE résolu manuellement via fallback shares × price → +1 → 615

### Phase 6 — Commit + push staging (✅ FAIT)
- Commit 1 : run principal v2 (script + 615 ranks.json)
- Commit 2 : `52109e4d` — fallback shares×price + HAB.DE rescue
- Push staging OK

### Phase 7 — Vérif staging (✅ FAIT)
Curl prod sur 5 EU foreign tickers :
- BP.L : $114B → "Top 10 Energy" + "#1 Oil & Gas Integrated" ✓
- 9984.T : $223B → "Top 25 IT" + "#1 Conglomerate" ✓ (FX yen ok)
- SAP : $206B → "#1 Enterprise Software" ✓
- ASML : $585B → "#3 Semiconductors" ✓

## Limitation connue / dette

### ⚠️ Bug merge priority dans load-company.ts:238
Le merge depuis ranks.json se fait UNIQUEMENT si `cur[k]` est invalide
("-", "—", "..."). Pour NVDA, v2-pipeline a `"≈ #10"` qui est "usable"
donc ranks.json n'override JAMAIS le pipeline rank.

**Conséquence** : NVDA continue d'afficher "≈ #10" mondial en prod
malgré le ranks.json correctement écrit avec "#1".

**Fix recommandé** (touche scope CONV-SYSTEMS, pas appliqué) :
Inverser priorité dans load-company.ts:238 :
```ts
// AVANT (bug)
if (!isUsableRank(cur[k]) && ranksEnrich.ranks[k]) {
  cur[k] = ranksEnrich.ranks[k];
}
// APRÈS (fix)
if (ranksEnrich.ranks[k]) {
  cur[k] = ranksEnrich.ranks[k];  // ranks.json est l'autorité (market cap live)
}
```

**Action requise** : broadcast SHARED-STATUS ping `🤝 @CONV-SYSTEMS`
pour qu'ils flippent cette priorité. Sinon le travail RANKS-V2 reste
invisible pour les stés où v2-pipeline a un rank LLM "usable".

### ⚠️ Doublon ASML / ASMLF
Les deux apparaissent #11 / #12 mondial (même sté, NASDAQ + OTC).
Pas dans `load-company.ts` ALIASES. Devrait être signalé à CONV-DATA
pour ajout d'alias ASMLF → ASML.

### ⚠️ 6 fails non-récupérables
AVU, BPYPN, CNCKW, CRGOW, GHBWF, TLS1V.HE = warrants/preferred shares
ou stés delisted. Pas de marketCap ni shares×price disponibles via
yfinance. Pas d'invention possible.

### ⚠️ Stés absentes de V1.7
AMZN, META, WMT, BRK-B, XOM, MA, COST etc. ABSENTES de
`v1-7-public.json` malgré leur taille. C'est un manquant CONV-DATA
upstream, pas mon scope.

## Métriques finales

- Stés traitées : 622 → 615 dédup → 615 écrits (+ 1 fallback HAB.DE)
- Fails persistants : 6 (warrants/delisted)
- Durée totale run : ~70s (fetch + retry + write)
- Source primaire : yfinance .info["marketCap"] + FX conversion live
- ETA promise initiale : <1h pour top 30 → livré en ~55 min
- Bug merge priority : signalé, fix touche CONV-SYSTEMS scope, non appliqué

## TODO résiduels (autonomie hors blocage)

- [x] ~~Merge priority dans load-company.ts:238~~ DÉJÀ FLIPPÉ (vérifié
      12 mai, commit `7f61e2a4` du 8 mai). ranks.json gagne sur v2-pipeline.
- [ ] Broadcast SHARED-STATUS : ping `🤝 @CONV-DATA` pour ajouter alias
      ASMLF → ASML dans `load-company.ts` ALIASES (ASMLF #11 V1.8 doublon
      d'ASML #10). 1 ligne ajout dans le dict ALIASES.
- [ ] Cron auto re-run ranks-v2 (hebdo) pour maintenir freshness
      market cap < 7 jours. Hook idéal = `.github/workflows/` ou
      Vercel cron (CONV-SYSTEMS a déjà setup `vercel.json` cron 9h UTC
      pour emails, modèle dispo).
- [ ] Cross-check FMP /stable/quote sur top 50 US (sanity check fresh
      via 2e source, détecter divergences > 5 % vs yfinance). Utile si
      yfinance commence à driffer.
- [ ] Étendre run aux 305 V1.8 stés strictement (re-run forcé, ranks.json
      datés du 8 mai = 4 jours d'âge, encore frais mais pourrait être
      rerun pour les top movers).

## Outils utilisés

- yfinance (Python lib) — primary
- FMP /stable/quote — sanity check sur US tickers (4 clés dispo dans .env.local)
- concurrent.futures.ThreadPoolExecutor — parallel x4
- scripts/work-claim.ts — pas utilisé (script bulk one-shot, pas concurrent)

## Fichiers touchés

```
scripts/enrich-ranks-v2.py                              (créé)
src/data/v2-pipeline-enrich/<ticker>.ranks.json × 615  (overwrite)
src/data/v2-pipeline-enrich/hab.de.ranks.json           (créé fallback)
.conv-state/CONV-MODULE-RANKS-V2.md                     (ce fichier)
```

## Commits

- `52109e4d` — ranks(v2): fallback shares×price + HAB.DE récupéré
  (le commit principal du run 615 stés a précédé celui-ci ; voir
  `git log --oneline -- src/data/v2-pipeline-enrich/` pour détail)
