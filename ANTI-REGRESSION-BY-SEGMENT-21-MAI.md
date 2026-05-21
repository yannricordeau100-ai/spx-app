# Audit anti-regression V1.9 par segment géographique — 21 mai 2026 matin

Source : `src/data/v1-9-pre-publication-audit.json` (généré 2026-05-21T09:50:08.912Z)
Mission sub-agent #105 — lecture pure, aucune modif données.

## Vue globale
- Total tickers : **778**
- Clean a-f publishable : **198** (25.4%)
- Clean a-f+g-m : **196** (25.2%)

Règles de classification :
- **US/CAN** : pas de suffix OU suffix `.TO` / `.V`
- **EU continental** : suffix `.PA .DE .MI .BR .AS .MC .VI .HE .CO .OL .ST .LS`
- **UK** : suffix `.L`
- **CH** : suffix `.SW`
- **Others** : tout autre suffix (ex. `.T` Japon)

## Détail par segment

### US/CAN
- Total : **572** tickers
- Clean a-f : **183** (32.0%)
- Clean a-f+g-m : **181** (31.6%)
- KO par critère : a=101(17.7%) b=2(0.3%) c=0(0.0%) d=274(47.9%) e=1(0.2%) f=165(28.8%) g=71(12.4%) h=0(0.0%) i=16(2.8%) j=0(0.0%) k=0(0.0%) l=3(0.5%) m=3(0.5%)
- Top 5 clean par MC : NVDA (5.71T$), AAPL (4.38T$), TSLA (1.66T$), MU (875.1G$), ASML (659.6G$)
- Top 5 KO par MC (à fixer prio) :
  - **GOOGL** (4.86T$) — failed=1 critères=`d`
  - **GOOG** (4.81T$) — failed=1 critères=`d`
  - **MSFT** (3.04T$) — failed=2 critères=`ad`
  - **AVGO** (2.08T$) — failed=1 critères=`d`
  - **LLY** (897.7G$) — failed=1 critères=`d`
- Drift vs global : clean_af +6.5pp / clean_all +6.5pp
- Quick wins (0 critère a-f KO + 1-2 g-m KO) : **2** stés
  - AZO (56.0G$) — KO `g`
  - TKO (n/a) — KO `g`

### EU continental
- Total : **132** tickers
- Clean a-f : **13** (9.8%)
- Clean a-f+g-m : **13** (9.8%)
- KO par critère : a=18(13.6%) b=7(5.3%) c=0(0.0%) d=111(84.1%) e=1(0.8%) f=78(59.1%) g=49(37.1%) h=0(0.0%) i=27(20.5%) j=0(0.0%) k=0(0.0%) l=1(0.8%) m=0(0.0%)
- Top 5 clean par MC : AZN.ST (251.0G$), OR.PA (206.9G$), ATCO-A.ST (80.0G$), DG.PA (75.9G$), NESTE.HE (23.7G$)
- Top 5 KO par MC (à fixer prio) :
  - **SIE.DE** (225.5G$) — failed=1 critères=`d`
  - **TTE.PA** (188.1G$) — failed=1 critères=`d`
  - **BBVA.MC** (114.2G$) — failed=1 critères=`d`
  - **ISP.MI** (109.4G$) — failed=1 critères=`f`
  - **CS.PA** (86.7G$) — failed=2 critères=`df`
- Drift vs global : clean_af -15.6pp / clean_all -15.3pp
- Quick wins (0 critère a-f KO + 1-2 g-m KO) : **0** stés

### UK
- Total : **55** tickers
- Clean a-f : **2** (3.6%)
- Clean a-f+g-m : **2** (3.6%)
- KO par critère : a=6(10.9%) b=4(7.3%) c=0(0.0%) d=51(92.7%) e=0(0.0%) f=33(60.0%) g=24(43.6%) h=0(0.0%) i=15(27.3%) j=0(0.0%) k=0(0.0%) l=1(1.8%) m=3(5.5%)
- Top 5 clean par MC : NG.L (82.2G$)
- Top 5 KO par MC (à fixer prio) :
  - **BP.L** (106.9G$) — failed=2 critères=`df`
  - **GLEN.L** (89.4G$) — failed=1 critères=`d`
  - **BARC.L** (75.9G$) — failed=2 critères=`df`
  - **BA.L** (72.3G$) — failed=2 critères=`df`
  - **NWG.L** (58.1G$) — failed=1 critères=`d`
- Drift vs global : clean_af -21.8pp / clean_all -21.6pp
- Quick wins (0 critère a-f KO + 1-2 g-m KO) : **0** stés

### CH (Suisse)
- Total : **14** tickers
- Clean a-f : **0** (0.0%)
- Clean a-f+g-m : **0** (0.0%)
- KO par critère : a=2(14.3%) b=0(0.0%) c=0(0.0%) d=13(92.9%) e=0(0.0%) f=10(71.4%) g=4(28.6%) h=0(0.0%) i=3(21.4%) j=0(0.0%) k=0(0.0%) l=0(0.0%) m=0(0.0%)
- Top 5 clean par MC : aucun
- Top 5 KO par MC (à fixer prio) :
  - **ROG.SW** (287.2G$) — failed=2 critères=`dfg`
  - **ABBN.SW** (168.5G$) — failed=1 critères=`d`
  - **LONN.SW** (37.1G$) — failed=2 critères=`df`
  - **SLHN.SW** (26.2G$) — failed=2 critères=`df`
  - **SGSN.SW** (18.8G$) — failed=3 critères=`adfi`
- Drift vs global : clean_af -25.4pp / clean_all -25.2pp
- Quick wins (0 critère a-f KO + 1-2 g-m KO) : **0** stés

### Others
- Total : **5** tickers
- Clean a-f : **0** (0.0%)
- Clean a-f+g-m : **0** (0.0%)
- KO par critère : a=0(0.0%) b=0(0.0%) c=0(0.0%) d=4(80.0%) e=0(0.0%) f=2(40.0%) g=1(20.0%) h=0(0.0%) i=0(0.0%) j=0(0.0%) k=0(0.0%) l=0(0.0%) m=0(0.0%)
- Top 5 clean par MC : aucun
- Top 5 KO par MC (à fixer prio) :
  - **9984.T** (217.0G$) — failed=1 critères=`f`
- Drift vs global : clean_af -25.4pp / clean_all -25.2pp
- Quick wins (0 critère a-f KO + 1-2 g-m KO) : **0** stés

## Drift analysis

- **Plus grand écart clean_af** : `US_CAN` 32.0% vs `CH` 0.0% → **delta 32.0pp**

Variance KO par critère (max% - min% entre segments) :
- `d` : 45.0pp
- `f` : 42.6pp
- `g` : 31.2pp
- `i` : 27.3pp
- `a` : 17.7pp
- `b` : 7.3pp
- `m` : 5.5pp
- `l` : 1.8pp
- `e` : 0.8pp

**Critère le plus segment-dépendant** : `d` (45.0pp)

Lecture : `d_stories` (stories synthétiques) et `f_repartition` (CA / segments) dominent le drift géographique. Les filings EU/UK/CH ne livrent pas la même densité de KPIs sectoriels que les 10-K US, donc moins de stories construites et moins de répartition CA détaillée. `g_governance` confirme la fracture US (proxy DEF 14A) vs EU/UK (rapports annuels hétérogènes, voting/capital partial).

## Quick wins par segment (≤30 min/sté, 0 critère a-f KO + 1-2 g-m KO)

- **US/CAN** : 2 stés (~40 min total estimé)
- **EU continental** : 0 stés (~0 min total estimé)
- **UK** : 0 stés (~0 min total estimé)
- **CH (Suisse)** : 0 stés (~0 min total estimé)
- **Others** : 0 stés (~0 min total estimé)
- **TOTAL** : 2 stés quick win pures (a-f propre + g-m léger)

Note : la majorité des KO EU/UK/CH cumulent a-f ET g-m → quick win pur impossible sans d'abord générer stories (d) et répartition (f).

## Recommandations matin

1. **Cibler `d_stories` en priorité absolue** — 453/778 KO globaux dont 111/132 EU (84%), 51/55 UK (93%), 13/14 CH (93%). C'est LE blocker structurel inter-segment. Le pipeline `d_stories` (sub-agent Python PID 86250) doit prioriser EU/UK/CH après US.

2. **Fix `f_repartition` pour EU/UK/CH** — 78/132 EU, 33/55 UK, 10/14 CH KO sur la répartition CA. Probablement parse de segments operating dans rapports annuels non-SEC à compléter. Gain potentiel : +30-40 stés clean si combiné avec fix `d`.

3. **Booster Top KO MC EU/UK** — `SIE.DE` (225G$), `TTE.PA` (188G$), `BP.L` (107G$), `BARC.L` (76G$), `ROG.SW` (287G$ – plus grosse sté CH KO) — chacun manque seulement 1-2 critères, fix unitaire = grosse couverture MC. Cible 5-10 grosses caps EU/UK/CH avant d'élargir la longue traîne.

Bonus : `g_governance` reste sous cap (149/778 = 19%, dont 161 regex_real_sourced déjà acceptés en exception). Pas une priorité matin, mais surveiller que les fixes EU/UK ne fassent pas sauter le cap heuristic_partial (213/233 actuellement).
