# Top 307 fix plan — 56 stés à débloquer pour 100% publishable

**Généré** : 2026-05-21 par sub-agent #114 (lecture+plan, zéro modif données)
**Baseline strict** : `src/data/v1-9-publishable-strict.json` (criteria hero_spec + hero_hist + spec_3plus + desc_100 + segments_2plus + geography_2plus + risks_3plus_us)
**Audit critères** : `src/data/v1-9-pre-publication-audit.json`

## Bilan

- Top 307 : **251/307 publié (81.8%)** — gap **56 stés**
- ETA cumulé estimé : **48-72h** (post patches #113 + 2-3 nuits cron Cerebras + sub-agents dédiés)

### Blockers non-exclusifs (overlap)

| Critère KO | N stés concernées |
|---|---|
| f_repartition | 53 |
| d_stories | 37 |
| g_governance | 19 |
| a_hero_history | 9 |
| l_hero_name_fr | 2 |
| b_interpretation | 2 |
| NO_AUDIT (absent publishable 771) | 2 |

## Cluster par bloqueur (exclusif, priorité hero > gov > stories > repart)

### Cluster F — Easy wins 1 critère (12 stés)

Un seul critère KO, débloque rapide via fix ciblé.

Tickers (tri MC desc) :
- `9984.T` (US, MC=217.0B) — KO: f_repartition
- `BPAQF` (US, MC=145.6B) — KO: f_repartition
- `ISP.MI` (IT, MC=109.4B) — KO: f_repartition
- `BP.L` (GB, MC=106.9B) — KO: d_stories
- `CRH` (US, MC=77.7B) — KO: f_repartition
- `PSX` (US, MC=68.8B) — KO: f_repartition
- `NDA-FI.HE` (US, MC=56.6B) — KO: f_repartition
- `NDA-SE.ST` (US, MC=53.6B) — KO: f_repartition
- `SHL.DE` (DE, MC=41.2B) — KO: f_repartition
- `CGNX` (US, MC=11.0B) — KO: f_repartition
- `POWL` (US, MC=10.8B) — KO: f_repartition
- `RRC` (US, MC=9.8B) — KO: f_repartition

**Solution** : sub-agent dédié — extraction f_repartition locale (regex sec-data) ou ré-extraction d_stories ciblée.
**ETA** : 6-8h (1 sub-agent, ≤30 min/sté)

### Cluster A — d_stories (2 KO dont d_stories) (14)
- `BBVXF` (US, MC=127.1B) — KO: d_stories,f_repartition
- `KKR` (US, MC=92.8B) — KO: d_stories,f_repartition
- `CS.PA` (FR, MC=86.7B) — KO: d_stories,f_repartition
- `EIPAF` (US, MC=85.0B) — KO: d_stories,f_repartition
- `BA.L` (GB, MC=72.3B) — KO: d_stories,f_repartition
- `ARES` (US, MC=42.4B) — KO: d_stories,f_repartition
- `LONN.SW` (CH, MC=37.1B) — KO: d_stories,f_repartition
- `SLHN.SW` (CH, MC=26.2B) — KO: d_stories,f_repartition
- `TROW` (US, MC=21.9B) — KO: d_stories,f_repartition
- `NHY.OL` (US, MC=19.7B) — KO: d_stories,f_repartition
- `YAR.OL` (US, MC=12.6B) — KO: d_stories,f_repartition
- `AGN.AS` (NL, MC=11.9B) — KO: d_stories,f_repartition
- `PAH3.DE` (DE, MC=10.6B) — KO: d_stories,f_repartition
- `LI.PA` (FR, MC=10.6B) — KO: d_stories,f_repartition

**Solution** : Python stories backfill PID 86250 en cours + cron Cerebras 02:05 nuit prochaine.
**ETA** : 24h (post Python + cron).

### Cluster B — f_repartition (2 KO non-stories non-hero non-gov) (2)
- `INGA.AS` (NL, MC=80.4B) — KO: f_repartition,l_hero_name_fr
- `NYT` (US, MC=12.2B) — KO: b_interpretation,f_repartition

**Solution** : extraction f_repartition locale (regex sec-data) ou cron Cerebras 02:05.
**ETA** : 24-48h.

### Cluster C — a_hero_history (2 KO incl. hero) (0)
_(aucun ticker dans ce bucket exclusif — tous les a_hero_history KO sont en E_multi 3+)_

**Solution** : XBRL pivot type sub-agent #96 (US/CAN), yfinance fallback (EU).
**ETA** : 24h sub-agent dédié.

### Cluster D — g_governance (2 KO incl. gov) (4)
- `ROG.SW` (CH, MC=287.2B) — KO: f_repartition,g_governance
- `CRWV` (US, MC=62.3B) — KO: f_repartition,g_governance
- `STT` (US, MC=42.6B) — KO: f_repartition,g_governance
- `FUTU` (US, MC=2.5B) — KO: f_repartition,g_governance

**Solution** : regex sec-data (DEF 14A) — attention audit cross-pollution #110 (14.8% contaminés).
**ETA** : 12h sub-agent dédié.

### Cluster E — multi-critères 3+ KO (22)
- `TD` (US, MC=132.5B) — KO: a_hero_history,d_stories,f_repartition
- `SHOP` (US, MC=92.3B) — KO: a_hero_history,d_stories,f_repartition
- `CTAS` (US, MC=66.4B) — KO: a_hero_history,d_stories,f_repartition
- `MLM` (US, MC=34.5B) — KO: d_stories,f_repartition,g_governance
- `WRB` (US, MC=24.6B) — KO: d_stories,f_repartition,g_governance
- `AV.L` (GB, MC=24.1B) — KO: d_stories,f_repartition,g_governance
- `MRNA` (US, MC=19.9B) — KO: d_stories,f_repartition,l_hero_name_fr
- `RIVN` (US, MC=19.5B) — KO: d_stories,f_repartition,g_governance
- `AMUN.PA` (FR, MC=18.8B) — KO: d_stories,f_repartition,g_governance
- `SGSN.SW` (CH, MC=18.8B) — KO: a_hero_history,d_stories,f_repartition
- `MB.MI` (IT, MC=18.1B) — KO: b_interpretation,d_stories,f_repartition,g_governance
- `UNI.MI` (IT, MC=17.3B) — KO: d_stories,f_repartition,g_governance
- `RI.PA` (FR, MC=16.6B) — KO: d_stories,f_repartition,g_governance
- `NBIX` (US, MC=16.0B) — KO: a_hero_history,d_stories,f_repartition,g_governance
- `BCP.LS` (US, MC=15.0B) — KO: a_hero_history,d_stories,f_repartition,g_governance
- `CA.PA` (FR, MC=13.1B) — KO: d_stories,f_repartition,g_governance
- `BNT` (US, MC=13.0B) — KO: d_stories,f_repartition,g_governance
- `AIZ` (US, MC=12.5B) — KO: a_hero_history,d_stories,f_repartition
- `CNA.L` (GB, MC=11.7B) — KO: d_stories,f_repartition,g_governance
- `SPM.MI` (IT, MC=9.8B) — KO: d_stories,f_repartition,g_governance
- `CHWY` (US, MC=9.0B) — KO: a_hero_history,d_stories,f_repartition
- `CAVA` (US, MC=8.9B) — KO: a_hero_history,d_stories,f_repartition,g_governance

**Solution** : long-terme, enchaînement de plusieurs sub-agents (hero pivot + stories Cerebras + gov sec-data).
**ETA** : 48-72h.

### NO_AUDIT — absent de publishable 771 (2)
- `ABVX` (US) — pas de dataset publishable. À investiguer (création v1-9-complete/ABVX.json ou v2-pipeline)
- `URW.PA` (FR) — pas de dataset publishable. À investiguer (création v1-9-complete/URW.PA.json ou v2-pipeline)

**Solution** : générer fichier dataset complet via pipeline v2 enrich.
**ETA** : 24h sub-agent dédié (2 stés seulement).

## Priorité dispatch sub-agents (post patches audit #113)

1. **Sub-agent #115** : Easy wins cluster F (12 stés) — 60 min, immédiat post-#113, débloque 12/56 = 21.4%
2. **Sub-agent #116** : d_stories cluster A (14 stés) — coord avec Python PID 86250, 90 min, débloque 14/56 = 25%
3. **Sub-agent #117** : regex sec-data cluster D (4 stés non-contaminées par #110) — 60 min, débloque 4/56 = 7.1%
4. **Sub-agent #118** : f_repartition local extraction cluster B (2 stés sans LLM) — 30 min, débloque 2/56 = 3.6%
5. **Sub-agent #119** : NO_AUDIT (2 stés ABVX, URW.PA) — création dataset, 60 min
6. **Sub-agent #120** : Cluster E_multi (22 stés) — coordination longue, plusieurs nuits cron 02:05 Cerebras + hero pivot
7. **Cron 02:05 Cerebras** : d_stories cluster A résiduel + f_repartition LLM cluster E

**Quick win projeté post #115-118+119** : 32/56 stés = **57.1% du gap fermé en 24h** → top 307 passe de 81.8% à **92.2%** publié.

## Preview SP500 — top 20 par MC manquants

SP500 strict : **390/503 publié (77.5%)** — gap **113 stés**.

Note baseline : Yann annonce 265/367 (72%). La baseline 367 n'est pas reproduite ici (strict donne 503 cible, 390 publié). À investiguer dans agent suivant.

Cluster counts SP500 :

- F_easy: 24
- A_stories: 19
- C_hero: 14
- D_gov: 13
- E_multi: 33
- NO_AUDIT: 10

Top 20 SP500 manquants par MC :

- `KKR` (MC=92.8B) cluster=A_stories — KO: d_stories,f_repartition
- `CRH` (MC=77.7B) cluster=F_easy — KO: f_repartition
- `PSX` (MC=68.8B) cluster=F_easy — KO: f_repartition
- `CTAS` (MC=66.4B) cluster=E_multi — KO: a_hero_history,d_stories,f_repartition
- `STT` (MC=42.6B) cluster=D_gov — KO: f_repartition,g_governance
- `ARES` (MC=42.4B) cluster=A_stories — KO: d_stories,f_repartition
- `MLM` (MC=34.5B) cluster=E_multi — KO: d_stories,f_repartition,g_governance
- `WRB` (MC=24.6B) cluster=E_multi — KO: d_stories,f_repartition,g_governance
- `TROW` (MC=21.9B) cluster=A_stories — KO: d_stories,f_repartition
- `MRNA` (MC=19.9B) cluster=E_multi — KO: d_stories,f_repartition,l_hero_name_fr
- `AIZ` (MC=12.5B) cluster=E_multi — KO: a_hero_history,d_stories,f_repartition
- `ACGL` (MC=n/a) cluster=F_easy — KO: f_repartition
- `ACN` (MC=n/a) cluster=E_multi — KO: d_stories,f_repartition,g_governance,l_hero_name_fr
- `ALLE` (MC=n/a) cluster=E_multi — KO: d_stories,f_repartition,g_governance
- `AMP` (MC=n/a) cluster=C_hero — KO: a_hero_history,f_repartition
- `AMZN` (MC=n/a) cluster=NO_AUDIT — KO: NO_AUDIT
- `ARE` (MC=n/a) cluster=C_hero — KO: a_hero_history,f_repartition
- `BEN` (MC=n/a) cluster=E_multi — KO: a_hero_history,f_repartition,g_governance
- `BIIB` (MC=n/a) cluster=C_hero — KO: a_hero_history,f_repartition
- `BK` (MC=n/a) cluster=D_gov — KO: f_repartition,g_governance

## Fichiers livrés

- `/Users/yann/spx-app/TOP-307-FIX-PLAN-21-MAI.md` (ce document)
- `/Users/yann/spx-app/src/data/v1-9-top307-gap-analysis.json` (données structurées)

## Contraintes respectées

- ZÉRO modif données (lecture pure)
- 2 fichiers livrés uniquement
- Sub-agents en cours non touchés (PID 86250, #112, #113)
