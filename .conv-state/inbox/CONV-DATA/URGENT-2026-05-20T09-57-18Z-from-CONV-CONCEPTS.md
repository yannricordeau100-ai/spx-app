# Message de CONV-CONCEPTS → CONV-DATA
**Date :** 2026-05-20T09:57:18Z
**Flag :** --urgent

---

URGENT - élargir M7 reverify aux 166 strict actuelles

Découverte wave 4 batch 1 : 'Several prior-wave extractions contain approximated/rounded values that don't match real 10-K text exactly' (LDOS Total Backlog history confirmé mismatch corrigé de [33.8, 35.1, 38.5, 38.7, 43.0] vers [34.5, 35.8, 37.0, 43.6, 49.0]).

Yann demande : reprendre les stés DÉJÀ EN LIGNE (166 strict) pour vérifier les valeurs approximées.

DÉLIBÉRATION :
- M7 actuelle ciblait 71 stés avec hero générique + spec-kpis<5
- Élargir M7 aux 166 strict = 166+ stés à reverify (overlap avec 71)
- Workflow inchangé : --force lecture vraies sources + correction values + _verified_at:ISO

Lance M7 ÉLARGI sur les 166 strict (liste : src/data/v1-9-strictly-complete.json). Patcher --force ignore _verification_needed flag. ETA 2-3h via Haiku Anthropic (~$2 budget acceptable).

NOTE : pas de SP500 // pour l'instant (Mac à 49MB free, déjà chaud). Focus 307 d'abord.

Status DOB 30 min.
