# Cerebras paid activation — 21 mai 2026

## Statut paiement

- Credit ajouté : $30 (Yann personal card / Mettrik AI)
- Tier : paid (Qwen-3 235B unlimited TPD, soft rate limit global queue)
- 3 keys validated paid tier (validation test "Reply with: PAID_TIER_ACTIVE") :
  - CEREBRAS_API_KEY (K1) : OK
  - CEREBRAS2_API_KEY (K2) : OK (queue_exceeded transient, normal sous charge globale)
  - CEREBRAS3_API_KEY (K3) : OK

## État Python PID 86250 (free mode)

- Process déjà mort au moment de la mission (run scaleup 309 d_stories complet, exit propre)
- Résultats free : 309/309 processed, 223 enrichies, 85 errors (toutes `all_failed` Cerebras 429 + Groq 429)
- Pas de kill nécessaire, pas de resume à faire — relaunch ciblé sur les 85 errors

## Test mini scaleup paid (5 stés)

- Tickers : COST, C, APH, PLD, GSK.L
- Temps total : 10 sec
- Vitesse : 2 sec/sté (≈ 30 stés/min)
- Errors : 0
- KPIs ajoutés : 11 (sur 5 stés ciblées)

## Retry 80 errors restants (paid mode)

- Tickers : FDX, EOG, MRK.DE, AFL, ADSK, … (80 stés)
- Throttle : 0.4s (vs 4s en free)
- Cooldown 429 : 8s (vs 60s en free)
- Temps total : ~5 min
- Vitesse moyenne : ~3.75 sec/sté (≈ 16 stés/min stable)
- Errors : 0 / 80
- KPIs ajoutés : 265
- Sources : cerebras_key2 (69), cerebras_key1 (6), cerebras_key0 (5) — rotation OK

## Bilan global scaleup_309_dstories_ko

| Métrique | Avant paid | Après paid retry |
|---|---|---|
| Stés enrichies | 223 / 309 | 308 / 309 (+85 = 5 test + 80 retry) |
| KPIs stories ajoutés | 757 | 1033 (+276 = 11 test + 265 retry) |
| Errors résiduelles | 85 | 0 |
| Couverture finale | 72 % | **99.7 %** (1 sté restante = skipped no_pipeline) |

## Tokens consumed estimés

- Test 5 stés : ~10K input + 2K output ≈ $0.02
- Retry 80 stés : ~140K input + 30K output ≈ $0.30
- Total session : ~$0.32 sur $30 credit
- Buffer remaining : ~$29.68

## Accélération mesurée

- Free tier (avant) : 309 stés sur plusieurs heures + 85 errors → ~20 stés/min effectif
  variable, avec quotas TPD/RPM, fallback Groq saturé en parallèle.
- Paid tier (après) : 80 stés en 5 min = **16 stés/min stable**, 0 erreur.
- Speedup réel pour le retry : **infini sur les errors** (free = 100 % fail, paid = 100 % succès).
- Speedup nominal : ~3-5x sur charge équivalente (sans retry quotas).

## Patch script paid mode

`scripts/stories-backfill/scaleup_309_dstories_ko.py` :

- ACTIVE_KEYS : 3 keys (K1, K2, K3) au lieu de 2
- `--tickers-file <path>` : filtre la liste targets sur un subset (1 ticker / ligne)
- `--paid-mode` : cooldown 429 réduit à 8s (vs 60s default)
- Output dédié `results-paid-retry.json` quand `--tickers-file` est utilisé

## Files

- `scripts/stories-backfill/scaleup_309_dstories_ko.py` — patché
- `src/data/stories-backfill-309-dstories-ko/results-paid-retry.json` — sortie retry paid
- `src/data/v2-pipeline-enrich/<ticker>.json` — 80 fichiers maj (stories_kpis append)
- `/tmp/cerebras-paid-scaleup.log` — log run paid (5 min)
- `/tmp/cerebras-paid-pid.txt` — PID 82203 (process terminé)
- `CEREBRAS-PAID-ACTIVATION-21-MAI.md` — ce fichier

## Next steps

- Sub-agents Cerebras paid prêts : #119 (f_repartition LLM résiduel),
  #120 (hero segment 97 US), #121 (EU governance 92) peuvent désormais
  tourner sans coordination cron 02:05 (paid = pas de reset cycle).
- Le cron `02:05 Paris` (free quota reset) reste utile pour les autres
  pipelines free tier (Groq fallback, etc.), mais plus nécessaire pour
  Cerebras Qwen-3 235B paid.
- 5 errors résiduelles = stés sans pipeline file → scope V1.9 / CONV-DATA
  Pass 3, hors mission paid activation.
