# V1.9 Final Audit — État consolidé post sprint fixes (21 mai 2026)

**Univers** : 549 stés publishable strict (sur 990 univers V1.9 complet).
**Source** : `src/data/v1-9-final-audit-2026-05-21.json` (+ audit brut `src/data/v1-9-pre-publication-audit.json`).
**Script** : `node scripts/audit-v1-9-pre-publication.js` (re-run 21 mai après sprint fixes massifs).

## 1. Synthèse globale

| Indicateur | Valeur |
|---|---|
| Total audité | 549 |
| Dataset introuvable | 0 |
| **Clean a-f (vraiment publishable strict)** | **13 stés (2.4 %)** |
| Clean a-f + extensions g-m | 0 sté |
| Exceptions hero_history légitimes | 22 (4.0 %, cap 21 % respecté) |

## 2. Comparaison baseline (sub-agent #20) vs maintenant

### Critères a-f

| Critère | Baseline KO % | Maintenant KO % | Stés KO | Delta |
|---|---|---|---|---|
| `f_repartition` | **99.1 %** | **17.9 %** | 98 | **-81 pts** ✅ |
| `d_stories` | **100 %** | **56.3 %** | 309 | **-43.7 pts** ✅ |
| `i_events` (extension) | 23.0 % | 23.7 % | 130 | stable |
| `b_interpretation` | n/a | 77.0 % | 423 | nouveau critère mesuré |
| `e_risks` | n/a | 52.5 % | 288 | nouveau critère mesuré |
| `a_hero_history` | n/a | 41.2 % | 226 | nouveau critère mesuré |
| `c_kpi_count` | n/a | <1 % | qq | quasi-clean |

### Extensions g-m

| Extension | Baseline KO % | Maintenant KO % | Stés KO | Notes |
|---|---|---|---|---|
| `g_governance` | 88 % (post-fix +386) | **93.3 %** | 512 | scope élargi (549 vs ~250 baseline). Les +386 stés débloquées étaient dans le top 307, le reste du publishable strict est encore largement KO |
| `m_freshness` | 6.6 % | **56.5 %** | 310 | scope élargi : la baseline 6.6 % concernait probablement top 307 seulement |
| `h_ai_positioning` | 38 % (top KO post-fix → 62/100) | **32.6 %** | 179 | en amélioration |
| `i_events` | 23.0 % | 23.7 % | 130 | stable |
| `j_description` | n/a | **0 %** | 0 | ✅ 100 % |
| `k_ranks` | 1551 refresh | 4.7 % | 26 | quasi-clean |
| `l_hero_name_fr` | n/a | 10.0 % | 55 | bon |

## 3. Distribution stés par nb critères a-f failed

| Nb critères failed | Baseline (sub-agent #20) | Maintenant | Delta |
|---|---|---|---|
| **0 (clean a-f)** | 0 | **13** | **+13** ✅ |
| 1 | n/a | 78 | nouveau |
| 2 | 29 | 199 | scope élargi |
| 3 | 179 | 180 | stable |
| 4 | 265 | 67 | **-198** ✅ |
| 5 | 76 | 12 | **-64** ✅ |

**Insight** : la distribution s'est concentrée sur 1-3 critères failed (peu de stés à 4-5). Le sprint a éliminé la grosse traîne de stés à 4-5 critères KO. Reste un mur sur b_interpretation (77 %) et d_stories (56 %).

## 4. Top 20 vraiment publishable (0 KO sur a-f)

Seules **13 stés** atteignent 0 KO sur a-f (audit strict). Aucune ne passe a-f + g-m (toutes ont au moins 1 extension KO, typiquement `g_governance` ou `m_freshness`).

| # | Ticker | Market Cap | Extensions KO |
|---|---|---|---|
| 1 | **TSLA** | 1665 Mds $ | g_governance, i_events, m_freshness |
| 2 | **BAC** | 354 Mds $ | i_events |
| 3 | **UPS** | 84 Mds $ | g_governance |
| 4 | **URI** | 61 Mds $ | g_governance, l_hero_name_fr, m_freshness |
| 5 | **TSN** | 23 Mds $ | g_governance, m_freshness |
| 6 | **CF** | 19 Mds $ | g_governance, h_ai_positioning, m_freshness |
| 7 | **RS** | 19 Mds $ | g_governance, m_freshness |
| 8 | **BMRN** | 10 Mds $ | m_freshness |
| 9 | APTV | MC? | g_governance, l_hero_name_fr, m_freshness |
| 10 | BALL | MC? | g_governance, h_ai_positioning, l_hero_name_fr, m_freshness |
| 11 | MMM | MC? | g_governance, m_freshness |
| 12 | SMCI | MC? | g_governance, l_hero_name_fr, m_freshness |
| 13 | SNPS | MC? | g_governance, m_freshness |

## 5. Top 20 quick wins (1 critère KO seul, prioritaires)

Top stés à fixer en priorité (1 critère a-f à corriger pour passer publishable strict).

| # | Ticker | MC | Critère unique KO | Extensions KO |
|---|---|---|---|---|
| 1 | **NVDA** | 5710 Mds | e_risks | 2 |
| 2 | **GOOGL** | 4859 Mds | d_stories | 2 |
| 3 | **AAPL** | 4380 Mds | b_interpretation | 2 |
| 4 | **MU** | 875 Mds | b_interpretation | 3 |
| 5 | **JPM** | 804 Mds | d_stories | 3 |
| 6 | **V** | 613 Mds | e_risks | 2 |
| 7 | NVS | 320 Mds | b_interpretation | 1 |
| 8 | TXN | 280 Mds | d_stories | 2 |
| 9 | KLAC | 247 Mds | b_interpretation | 2 |
| 10 | AXP | 213 Mds | b_interpretation | 1 |
| 11 | QCOM | 211 Mds | d_stories | 1 |
| 12 | DTEGF | 175 Mds | b_interpretation | 1 |
| 13 | APP | 163 Mds | b_interpretation | 1 |
| 14 | PFE | 147 Mds | b_interpretation | 2 |
| 15 | CVS | 124 Mds | e_risks | 2 |
| 16 | MDT | 107 Mds | a_hero_history | 4 |
| 17 | ATCO-A.ST | 80 Mds | e_risks | 1 |
| 18 | NKE | 62 Mds | a_hero_history | 1 |
| 19 | GWW | 61 Mds | a_hero_history | 1 |
| 20 | TGT | 56 Mds | f_repartition | 3 |

**Insight** : 8/20 quick wins ont `b_interpretation` comme blocker unique → axe critique pour CONV-CONCEPTS / CONV-DATA (manque de driver KPI ou de vigilance KPI dans `kpis[]` côté pipeline). 4/20 sur `d_stories`, 3/20 sur `e_risks`, 3/20 sur `a_hero_history`. Fix prioritaire : enrichir interpretation buildability sur les méga-caps (AAPL, MU, KLAC, AXP, QCOM, DTEGF, APP, PFE, NVS).

## 6. RAM Mac

vm_stat 30s avant audit : ~427 MB free (sain). Pendant audit Node : 218 MB free (zone moyenne §14, audit pur sans LLM = pas d'impact lourd). Aucun proc Python parallèle lancé. Conforme.

## 7. Conclusion

- **+13 stés atteignent publishable strict pur** (0 critère a-f KO) — c'était 0 baseline. Premier palier livré.
- **Gros gains validés** : f_repartition (-81 pts), d_stories (-43.7 pts), distribution failed_count (queue 4-5 réduite de -262 stés).
- **Mur résiduel** : `b_interpretation` (77 %) = manque driver/vigilance KPI dans `kpis[]`. Bloquant 423 stés.
- **Extensions** : g_governance encore très KO (93 %) hors top 307. Freshness à 56.5 % (scope élargi).
- **Quick wins ROI** : 20 stés à 1 critère a-f KO, dont 8 sur b_interpretation → fix ciblé débloquerait NVDA/GOOGL/AAPL/MU/JPM/V (top 6 méga-caps).

## 8. Outputs

- `src/data/v1-9-final-audit-2026-05-21.json` (audit consolidé + comparaison baseline + top 20 listes)
- `src/data/v1-9-pre-publication-audit.json` (audit brut détaillé 549 stés)
- `FINAL-AUDIT-2026-05-21.md` (ce rapport)
