# Procédure manuelle dispatcher mode modéré FR

Cible : Claude (assistant) qui supervise les sub-agents post-01h00, scope FR EU5+N.

## Règle 1 : Détection notif sub-agent

Quand notif `task-notification status=completed` arrive :
1. **Attendre 1 minute** avant relance (laisse Mac respirer)
2. Lire `vm_stat | head -5` pour vérifier RAM
3. Si free < 200 MB → freeze 5 min + relire SHARED-STATUS

## Règle 2 : Vérifier nb sub-agents actifs

Avant dispatch :
```
ps aux | grep -i "claude.*--effort high" | grep -v grep | wc -l
```

- Si ≥ 3 sub-agents actifs : **NE PAS DISPATCHER**, attendre prochaine notif
- Si 2 sub-agents : dispatch 1 supplémentaire OK
- Si 0-1 sub-agent : dispatch 2 simultanés OK (max)

## Règle 3 : Priorité dispatch

Lire `/tmp/eu5n-fr-remaining.json` (généré par script audit). Ordre :

1. **needs_review** (9/11) — proche objectif, gain immédiat
2. **partial 7-8/11** — gap modéré
3. **partial 5-6/11** — gap large
4. **low <5/11** — audit sources d'abord (vérifier annual-text 5/5 ans), skip si sources cassées

## Règle 4 : Templates sub-agent par bloc manquant

### Si transcript_summary manquant (51 stés)
```
Mission : extraire transcript_summary pour <TICKER>.
Source : earning call FY2024 ou FY2025 si dispo (scope FR uniquement).
Output : /tmp/eu5n-fr-ultra-quality/<TICKER>.complete.json
Champ : transcript_summary = { highlights: [], guidance: {}, qa_themes: [], sentiment_chip: "bullish|neutral|cautious" }
Anti-invention : si pas de transcript dispo, retourner {} avec note "_no_transcript_source".
```

### Si hero_history manquant (57 stés)
```
Mission : compléter hero_kpi.history sur 5+ ans pour <TICKER>.
Source : annual-text 2020-2024 dans sec-data/cat3-european/<TICKER>/annual-text/
Format : { quarter: "Q4 2024", value: <float>, date: "2024-12-31" }
Anti-invention : NULL si non chiffré dans rapport. Pas d'extrapolation.
```

### Si governance manquant (32 stés)
```
Mission : extraire governance pour <TICKER>.
Source : Document Enregistrement Universel (URD) section "Gouvernance" + comité rémunération.
Champs : ceo_name, ceo_total_comp_m, board_independent_pct, top3_voting, top3_capital
Anti-invention : NULL si non disclosed.
```

## Règle 5 : Heartbeat 30 min

Toutes les 30 min :
1. Lire SHARED-STATUS.md tail -100
2. Vérifier git status + git pull
3. Rebuild classification :
```python
python3 << 'EOF'
# Recompute /tmp/eu5n-fr-final-classification.json
# (script identique à audit-final-fr.py)
EOF
```
4. Si delta positif (ready+needs_review augmenté), continuer
5. Si stagnation > 1 heartbeat, investiguer (sources cassées ? rate-limit ? Cerebras saturé ?)

## Règle 6 : Pas d'écriture SHARED-STATUS.md

Règle session : aucune écriture dans SHARED-STATUS.md depuis le dispatcher.
Logs en local : `/tmp/eu5n-fr-mode-modere.log`

## Règle 7 : Anti-invention strict

Chaque sub-agent doit signer `_extracted_by` et `_source_lines`.
Si retour sans source explicite → REJECT et redispatch.

## Règle 8 : Stop conditions

Stop dispatch si :
- Mac freeze RAM <50 MB (kill all sub-agents)
- Yann envoie message direct
- Cerebras + Anthropic free tier épuisés simultanément
- 3 sub-agents échec consécutif sur même bloc (probable bug pipeline)

## Workflow nominal (post-01h00)

```
01h00 : Bombardement Max 20× termine
01h05 : Dispatcher démarre, lit /tmp/eu5n-fr-remaining.json
01h10 : Dispatch batch 1 (3 sub-agents Opus // sur 6 stés needs_review chacun)
01h40 : Notifs batch 1 → rebuild classification → dispatch batch 2
02h20 : Notifs batch 2 → rebuild → dispatch batch 3
03h00 : Notifs batch 3 → rebuild final
03h30 : Mission transcript_summary séparée (gap 100%)
04h30 : Cible atteinte (38 stés ≥10/11) OU rapport final blockers
```
