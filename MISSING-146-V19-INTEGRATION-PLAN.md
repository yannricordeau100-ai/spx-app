# Plan intégration stés V1.9 manquantes — 21 mai matin

Sub-agent #109 — investigation gap univers vs audit, scripts prêts pour cron 02:05 Paris.

## Univers cible vs audité

| Champ | Valeur |
|---|---|
| Univers cible V1.9 (`src/data/v1-9-universe.json`) | **990 tickers** |
| Audité (`src/data/v1-9-pre-publication-audit.json`) | **771 tickers** |
| **Gap réel** | **219 tickers** (pas 146 — estimation Yann sous-estimait) |
| In audit mais pas in univers | 0 |

Estimation initiale Yann (146) était basée sur le smoke test status page V1.9 (549/990 publié), mais le compteur **publishable** est différent du compteur **audité**. Le vrai gap d'extraction (univers - audité) est de 219.

## Décomposition du gap par scope (overlap possible entre sources)

| Scope | Manquants | Commentaire |
|---|---|---|
| tsx60 | 52 | Canada quasi-vide (8/60 audités seulement) |
| ftse100 | 49 | UK gros résiduel |
| ftsemib | 20 | Italie |
| dax40 | 19 | Allemagne |
| sp500 | 18 | US résiduel small-mid cap |
| aex | 15 | Pays-Bas |
| atx | 15 | Autriche (vide quasi-total) |
| bel20 | 11 | Belgique |
| top307 | 10 | Top 307 résiduel (recouvre sp500 / ftse) |
| cac40 | 10 | France |
| smi | 6 | Suisse |
| fpi-batch-0 | 2 | FPI batch 0 (TSM/NVO/TM/BABA absents univers) |

Top 3 pays manquants : CA (52), GB (49), US (21).

## P0 — 10 FPI EU/UK/CH (Yann 13 mai)

**Tickers cibles** : TSM, NVO, TM, AZN, BABA, HSBA, BHP, RIO, BATS, ENI
**Exclus Yann** : ITUB, VALE, HDB

État actuel :
- `TSM`, `NVO`, `TM`, `BABA` → **absents univers v1-9-universe.json** (à AJOUTER avant extraction)
- `RIO.L`, `BATS.L`, `ENI.MI` → univers ftse100/ftsemib mais **non audités** (extraction directe)
- `AZN.L`, `BHP.AX`, `HSBA.L` → univers + déjà fpi-batch / audités (confort skip)

Script : `scripts/extract-v1-9-missing/extract_fpi_eu.py`
Dry-run validé : `--dry-run` montre BHP.AX déjà présent.
ETA Cerebras : 2-3h Qwen-3 235B (stories + risks).

## P0 — Stoxx 600 top 30 par MC

**Tickers sélectionnés** :
ASML.AS, ALV.DE, AIR.PA, EL.PA, SHELL.AS, BAS.DE, BMW.DE, MBG.DE, ADS.DE, IFX.DE,
DBK.DE, BEI.DE, UBSG.SW, SIKA.SW, GIVN.SW, CFR.SW, STMPA.PA, PUB.PA, AC.PA, ENEL.MI,
G.MI, RACE.MI, UCG.MI, HEIA.AS, MT.AS, ABN.AS, AAL.L, LLOY.L, VOD.L, RKT.L

Script : `scripts/extract-v1-9-missing/extract_stoxx_top30.py`
ETA Cerebras : 4-6h.

## P1 — Stoxx 600 résiduel (~114 mid-cap)

Reste 144 EU - 30 P0 = ~114 stés sur 8 indices (atx/bel20/smi/aex/cac40/dax40/ftsemib/ftse100).
ETA Cerebras : 8-12h (cron multi-fenêtres 02:05).

## P1 — SP500 résiduel (18)

`AMGN, AMZN, DIS, KHC, KIM, KO, MO, ROL, ROP, RSG, SATS, SNDK, TPR, UPS, VEEV, VRT, VTRS, WY`
ETA : 1-2h.

## P2 — TSX 60 résiduel (52)

Liste complète embarquée dans `extract_tsx60_residuel.py`.
Script : `scripts/extract-v1-9-missing/extract_tsx60_residuel.py`
ETA Cerebras : 4-6h (sec-data cat2-canadian lookup local).

## P2 — TOP 307 résiduel (10, mostly overlap)

`ABF.L, ABVX, AMGN, III.L, KHC, MO, UPM.HE, UPS, URW.PA, VIAV` — overlap sp500/ftse, déjà couvert par scripts EU/SP500.

## Total ETA cumulé

| Priorité | ETA Cerebras |
|---|---|
| P0 FPI | 2-3h |
| P0 Stoxx top 30 | 4-6h |
| P1 Stoxx résiduel | 8-12h |
| P1 SP500 | 1-2h |
| P2 TSX 60 | 4-6h |
| P2 Top 307 résiduel | overlap, 0 net |
| **Total** | **19-29h** |

Multi-fenêtres cron 02:05 Paris : 3-5 nuits.

## Cron 02:05 prochaine fenêtre — exécution préparée

1. `scripts/cron-cerebras-restart.sh` trigger automatique (LaunchAgent `com.mettrik.cerebras-restart.plist`)
2. Mission ordering : `scripts/cerebras-queue-22-mai.json` (mis à jour avec 5 nouvelles missions 219 stés P0/P1/P2)
3. Logs : `/tmp/cerebras-restart-22-mai.log`

## Dépendances

- Cerebras Qwen-3 235B 3 keys (`CEREBRAS_API_KEY` / `_2` / `_3`) — reset 02:05 Paris
- Groq Llama 3.3 70B free fallback — reset 12:00 Pacific
- yfinance gratuit unlimited
- sec-data local : check coverage par sté avant extraction (lookup paths inclus dans scripts)

## Pré-requis avant exécution

1. Ajouter `TSM`, `NVO`, `TM`, `BABA` à `src/data/v1-9-universe.json` (fpi-v19-yann-21mai)
2. Vérifier que les LaunchAgents Cerebras sont actifs (`launchctl list | grep mettrik`)
3. CONV-DATA valide les listes P0/P1/P2

## Files livrés par #109

- `MISSING-146-V19-INTEGRATION-PLAN.md` (ce fichier)
- `scripts/extract-v1-9-missing/extract_fpi_eu.py`
- `scripts/extract-v1-9-missing/extract_stoxx_top30.py`
- `scripts/extract-v1-9-missing/extract_tsx60_residuel.py`
- `scripts/cerebras-queue-22-mai.json` (mis à jour)
- `.conv-state/inbox/CONV-DATA/2026-05-21T12-00-00Z-from-CONV-CONCEPTS-integration-plan.md`

Aucun appel Cerebras / Groq effectué par #109.
