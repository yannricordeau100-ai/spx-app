# Phase 2 EU 100% — Plan d'exécution

## Statut

- **Phase 1 actuelle** : top 307 + SP500 (priorité). En cours via #131 DEF14A US (k1), #137 hard_multi + easy_board + retry hero (k2), #135 redirect v1-9, #136 V1.9.5 release pages.
- **Phase 2 EU** : démarrera quand top 307+SP500 audit atteint **≥95%** (ou signal explicite Yann "phase 2 go").

## Directive Yann

Phase 2 = EU 100% après top 307+SP500. Ordre strict :
1. Phase 1 stabilisée à ≥95% audit OK
2. Bascule cluster `medium_eu_full` (24 stés URD)
3. Puis 14 EU gap clean_all
4. Puis EU résiduel (Stoxx 600) — out of scope V1.9, V2.0+

## Décomposition EU à fixer

| Cluster | Stés | Source | Script | Statut |
|---|---|---|---|---|
| `medium_eu_full` | 24 | URD / Annual Report cat3-european | `scripts/governance-cerebras/extract_urd_eu_paid.py` (#138) | **Ready, NOT executed** |
| EU gap clean_all | 14 | mix g_governance + autres | À créer post-#138 | Pending |
| EU residual Stoxx 600 | ~283 | Stoxx 600 résiduel | Out of V1.9 scope | Pending V2.0+ |

## Cluster medium_eu_full — détail des 24 stés

```
1COV.DE     ADYEN.AS    AGS.BR      BARC.L      BBVA.MC     BVI.PA
DB1.DE      FRE.DE      GLEN.L      HEXA-B.ST   HIK.L       IP.MI
ITRK.L      JDEP.AS     NDA-DK.CO   NG.L        NN.AS       OR.PA
PGHN.SW     REC.MI      RR.L        SAMPO.HE    SOF.BR      ZURN.SW
```

Sources locales vérifiées : 24/24 ont des fichiers dans
`sec-data/cat3-european/<TICKER>/annual-text/`. Profondeur variable
(1 à 6 années) mais toutes ont au minimum 1 annual-text récent
exploitable.

## Scripts prêts

1. **`scripts/governance-cerebras/extract_urd_eu_paid.py`** (#138)
   - Cluster medium_eu_full (24 EU URD)
   - Cerebras qwen-3-235b-a22b-instruct-2507 (paid)
   - Multi-langue : FR, DE, IT, EN, ES, NL, PT
   - Garde-fou : `PAID_MODE=1` requis pour exécution (sinon exit 2)
   - Output : `src/data/v2-pipeline-enrich/<lower>.json` champ `overrides_governance`
   - Source tagging : `urd_eu_cerebras_real_eu` → audit regex regex_real_sourced

2. **(à créer post-phase 1)** Scripts complémentaires pour 14 EU gap clean_all

## ETA estimation Phase 2

| Étape | ETA |
|---|---|
| #138 EU URD Cerebras paid (24 stés) | 30 min execution + 60 min audit/commits |
| Scripts complémentaires 14 EU gap clean_all | 1-2h |
| Audit + revalidation cluster | 30 min |
| **Total phase 2 EU V1.9** | **2-4h post-phase 1 completion** |

## Activation

Quand l'un de ces signaux est atteint :
- Yann signale explicitement "phase 2 go" / "EU go"
- Top 307+SP500 audit ≥95% OK
- Phase 1 dispatchers (#131, #137) signalent terminé

Lancer la séquence :

```bash
# 1. Exec sub-agent #138 (24 EU URD)
cd /Users/yann/spx-app
PAID_MODE=1 KEY_INDEX=0 python3 scripts/governance-cerebras/extract_urd_eu_paid.py

# 2. Audit re-run pour mesurer flips
python3 scripts/audit-v1-9-pre-publication.js  # ou equivalent

# 3. Commit batch
git add src/data/v2-pipeline-enrich/ src/data/governance-cerebras/
git commit -m "feat(governance): EU URD Cerebras paid extraction batch 1 (#138)"
git push origin staging

# 4. Continuer avec autres clusters EU (14 gap clean_all)
```

## Contraintes

- **ZÉRO Cerebras / ZÉRO Groq pendant Phase 1**. Script #138 est PREP uniquement.
- Activation explicite par Yann ou trigger audit ≥95%.
- 1 commit par batch, push staging.
- Coordination clé Cerebras avec runs concurrents (#131 k1, #137 k2 → #138 k0).
