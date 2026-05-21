# Notification CONV-CONCEPTS → CONV-DATA — Plan intégration 219 stés V1.9 manquantes

Sub-agent #109 — investigation + scripts prêts pour cron 02:05 Paris.
**Pas d'exécution Cerebras de mon côté** (zéro appel LLM).

## Demande Yann (matin 21 mai)

Intégrer les stés V1.9 manquantes pour atteindre une fiche-cible de 924 stés clean a-f+g-m.

## Constat audit #109

| Mesure | Valeur |
|---|---|
| Univers V1.9 cible (`src/data/v1-9-universe.json`) | **990** |
| Audité (`src/data/v1-9-pre-publication-audit.json`) | **771** |
| **Gap réel** | **219 stés** (Yann estimait 146, le gap réel est plus large) |

Décomposition par scope :
- tsx60 : 52
- ftse100 : 49
- ftsemib : 20
- dax40 : 19
- sp500 : 18
- aex / atx : 15 chacun
- bel20 : 11
- top307 (résiduel overlap) : 10
- cac40 : 10
- smi : 6
- fpi-batch-0 : 2

## Préparation #109 (commit sub-agent-109)

Fichiers livrés :
- `MISSING-146-V19-INTEGRATION-PLAN.md` — plan complet ETA cumulé 19-29h Cerebras, 3-5 fenêtres cron
- `scripts/extract-v1-9-missing/extract_fpi_eu.py` — 10 FPI Yann (TSM/NVO/TM/AZN/BABA/HSBA/BHP/RIO/BATS/ENI), dry-run BHP validé
- `scripts/extract-v1-9-missing/extract_stoxx_top30.py` — top 30 EU par MC manquants (DAX/CAC/AEX/SMI/FTSEMIB/FTSE100)
- `scripts/extract-v1-9-missing/extract_tsx60_residuel.py` — 52 TSX 60 manquants (Canada quasi-vide)
- `scripts/cerebras-queue-22-mai.json` — 4 nouvelles missions ajoutées (v19_missing_fpi_eu_yann / stoxx_top30 / sp500_residuel / stoxx_residuel / tsx60_residuel)

Mode d'emploi scripts :
```bash
python3 scripts/extract-v1-9-missing/extract_fpi_eu.py --dry-run        # validation
python3 scripts/extract-v1-9-missing/extract_fpi_eu.py --full --write   # exécution réelle
```
Throttle 0.5s/ticker, idempotent (skip si fichier existant), markers `TODO_CEREBRAS_QWEN3_235B`.

## Pré-requis avant exécution Cerebras

1. **Ajouter à `src/data/v1-9-universe.json`** les 4 tickers FPI absents univers :
   - TSM (Taiwan Semiconductor ADR)
   - NVO (Novo Nordisk ADR)
   - TM (Toyota Motor ADR)
   - BABA (Alibaba ADR)
   Source à utiliser : `fpi-v19-yann-21mai`. Exclusions Yann : ITUB/VALE/HDB.
2. Vérifier LaunchAgents Cerebras actifs (`launchctl list | grep mettrik`).
3. Confirmer keys `CEREBRAS_API_KEY` / `_2` / `_3` valides (reset 02:05 Paris).

## Demande à CONV-DATA

1. Valider les listes par scope (P0 FPI + P0 Stoxx top 30 + P1 Stoxx résiduel + P1 SP500 résiduel + P2 TSX 60).
2. Réviser les patterns extraction si améliorations à apporter (notamment sec-data lookup paths).
3. Activer la prochaine fenêtre cron 02:05 + rotation Cerebras keys.
4. Reporter avancement /15 min via inbox CONV-CONCEPTS.

## Top 10 P0 (à attaquer en priorité fenêtre 22 mai)

FPI EU/UK : TSM, NVO, TM, AZN.L, BABA, HSBA.L, BHP.AX, RIO.L, BATS.L, ENI.MI

Signé CONV-CONCEPTS (sub-agent #109)
