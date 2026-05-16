# Recette canonique de construction d'un chart hero · Mettrik AI

> Source de vérité pour la construction des graphs hero de toute fiche
> société. Suivre cette recette + avoir des ingrédients (data) corrects
> garantit un rendu parfait du 1er coup.
>
> Maintenue : Yann + CONV-SYSTEMS. Mise à jour quand un nouveau bug est
> détecté → ajouter le check dans `src/lib/chart-spec-verify.ts` +
> l'entrée correspondante dans la section "Anti-patterns connus".

---

## 1. Ingrédients requis (data)

Chaque chart hero a besoin de ces 5 champs sur le KPI sélectionné :

| Champ | Type | Exemple | Obligatoire ? |
|---|---|---|---|
| `kpi.history` | `number[]` (oldest first) | `[9.57, 10.3, 11.3, 12.0, 12.3, 13.6, 15.2, 17.7, 20.0]` | ✅ |
| `kpi.period_type` | `"quarter" \| "semester" \| "year"` | `"quarter"` | ✅ |
| `kpi.last_data_date` | ISO date YYYY-MM-DD | `"2026-03-31"` | ✅ |
| `kpi.unit` | string | `"Mds $"` | ✅ |
| `kpi.type` ou `kpi.short`/`name_fr` | string | `"Revenue"` | ✅ (pour flow/stock) |

**Ingrédients secondaires** (utilisés pour cas spéciaux) :

- `ticker` : pour fiscal year audit (NVDA jan, AAPL sept, etc.)
- `kpi.ttm` : valeur de référence stockée. ⚠ Recalculée dynamiquement
  par défaut (la valeur stockée est souvent périmée).
- `kpi.history_periods` : si présent, donne les labels exacts par index
  (utile pour history non-contigu).

---

## 2. Étapes algorithmiques

La fonction `buildChartSpec(kpi, ticker, period, options)` (cf.
`src/lib/chart-template.ts`) exécute :

### Étape 1 — Audit fiscal year
```
fiscalYearEndMonth = getFiscalAudit(ticker)?.fiscalYearEndMonth ?? 12
isFiscalShifted = fiscalYearEndMonth !== 12
```
Cas spéciaux connus :
- NVDA : FY end **janvier** (FY26 = fév 2025 → jan 2026)
- AAPL : FY end **septembre** (FY25 = oct 2024 → sept 2025)
- MSFT : FY end **juin** (FY25 = juil 2024 → juin 2025)
- Toyota : FY end **mars** (FY25 = avr 2024 → mars 2025)
- Stés calendrier (défaut) : FY end **décembre**

### Étape 2 — Classification flow / stock
```
kind = getKpiAggregationKind(kpi)
```
- **flow** (= aggregation = SUM des Q de l'année) : Revenue, Sales,
  Profit, Cash flow, Recurring, Demand, Investment, Dividende payout.
- **stock** (= aggregation = LAST Q de l'année) : Margin, Profitability,
  Risk, Balance Sheet, Capital, User count (DAP, MAU), Backlog,
  Headcount, AUM, Loan book, Reserves.

Heuristiques (ordre de priorité) :
1. Unit contient `%` ou `ratio` ou `bps` → stock
2. Type matche `/margin|profitability|risk|balance|capital|backlog|headcount|user/` → stock
3. Nom matche `/subscribers?|abonnés|users?|backlog|encours|AUM|reserves/` → stock
4. Sinon → flow (= cas majoritaire P&L)

### Étape 3 — Construction des values + labels selon le mode

| Mode demandé × period_type natif | Action |
|---|---|
| `year` × `quarter` | `aggregateQuarterlyToAnnual()` → values = sums (flow) ou Q4 (stock), 1 par FY complète, skip FY partielle |
| `year` × `semester` | Somme 2 S (flow) ou S2 (stock) par year |
| `year` × `year` | history brute |
| `quarter` × `quarter` | history brute, labels Tx YY (fiscal-aware) |
| `semester` × `semester` | history brute, labels Sx YY |

**Règle d'or** : aucune période partielle ne devient un point complet.
L'année courante incomplète → exclue, remplacée par le TTM.

### Étape 4 — TTM dynamique

- **flow** : TTM = somme des 4 derniers quarters publiés
- **stock** : TTM = dernier Q publié

**Dédup** : si TTM ≈ dernière FY complète (cas où aucun Q de l'année
suivante n'est encore publié), nullify le TTM pour éviter doublon
visuel.

### Étape 5 — Labels axe X

- Mode annuel : labels = `["2021", "2022", ..., "2025"]` (complete FYs only)
  + `"TTM"` si TTM non null (= last value distincte)
- Mode trimestriel calendrier : `["T1 24", "T2 24", ..., "T1 26"]`
- Mode trimestriel fiscal-shifted : `["T1 25", "T2 25", ..., "T1 27"]`
  où T1 25 = premier quarter de la FY25 fiscale (≠ Q1 calendrier)
- Mode semestriel : `["S1 22", "S2 22", ..., "S1 26"]`

### Étape 6 — Rescale unit auto

Si toutes les values < 1 alors que unit = "Mds X" ou "M X" :
- "Mds X" → "M X" (×1000)
- "M X" → "X" brute (×1 000 000)
- "M $" → "$" (×1 000 000) etc.

Évite "0,41 M unités" alors qu'on a en fait 410 000 unités.

### Étape 7 — Vérification + auto-fix

`verifyAndFix(spec)` applique les corrections automatiques connues
(cf. section "Anti-patterns connus").

---

## 3. Sources data — ordre de priorité (merge)

`load-company.ts` merge 2 sources possibles dans cet ordre :

1. **XBRL companyfacts** (`v2-pipeline-enrich/<t>.quarterly-history.json`,
   method="xbrl-companyfacts") : history long (10-15 ans), figures
   taggées par la sté elle-même via SEC EDGAR. Source canonique pour
   les stés US.

2. **CONV-DATA pipeline LLM** (`v2-pipeline/<t>.json`) : history court
   (5-10 ans), extraction LLM depuis filings. Couvre US + EU + FPI.

**Merge intelligent** (16 mai 2026) :
- Base = source avec history le plus long
- Si l'autre source a un `last_data_date` plus récent → append les
  quarters supplémentaires à la base.
- `last_data_date` mis à jour vers le plus récent.
- `history_periods` du source XBRL conservés si présents.

→ Permet à GOOGL d'avoir Q2 2020 (XBRL) ∪ Q1 2026 (Pipeline) = 23 quarters
contigus malgré 2 sources distinctes.

---

## 4. Anti-patterns connus + fixes auto

Chaque anti-pattern a un **ID stable** matchant un node du
`quality-tree.ts`. Si Gemini visual-audit flag un fail sur cet ID, le
fix-dispatcher peut appeler `applyAutoFix(spec, issueId)`.

| ID | Description | Fix auto |
|---|---|---|
| `chart.history_empty` | Aucune valeur historique | UI affiche "Données en cours de validation" |
| `chart.history_linear_synthetic` | Suite linéaire parfaite (signature LLM halluciné) | Mark `_history_unverified: true`, réduit history à [last] |
| `chart.history_direction_mismatch_yoy` | yoy positif mais history décroissante | Reverse history |
| `chart.no_complete_fy` | <4 Q consécutifs pour vue annuelle | UI fallback sur vue trimestrielle |
| `chart.ttm_equals_last_fy` | TTM ≈ dernière FY | Nullify TTM (déjà visible via dernière FY) |
| `chart.label_count_mismatch` | labels.length ≠ values.length | Truncate au min |
| `chart.cagr_division_by_zero` | history[0] ≤ 0 | Hide CAGR badge |
| `chart.value_magnitude_jump` | Saut ×100 entre 2 points consécutifs | Warning, suggère mix unités |
| `chart.value_negative_unexpected` | Valeur négative sur KPI flux positif | Warning, à vérifier humain |
| `chart.ttm_outlier` | TTM > 5× max(values) | Warning, suggère mauvais calcul TTM |
| `chart.label_format_mixed` | Mix T1 25 + 2025 sur même chart | Warning, mode incohérent |
| `chart.xbrl_history_has_fiscal_gaps` | XBRL extracteur a sauté Q4 fiscal (cas NVDA/AAPL/MSFT). Aucune FY complète détectée. | Pipeline-only fallback à venir (load-company.ts amélioré) |

---

## 5. Variantes & cas spéciaux

### 5.1 Stés à fiscal year décalé (~120 stés)
Liste maintenue dans `src/lib/fiscal-calendar.ts`. Pour chaque sté :
- Labels Tx fiscal au lieu de calendrier
- Aggrégation respecte la FY fiscale, pas calendrier
- TTM = somme 4 derniers Q calendaires (peut chevaucher 2 FYs fiscales)

### 5.2 Dual-class shares (GOOG/GOOGL, BRK.A/.B, FOX/FOXA)
- Une seule fiche pour les 2 classes (alias dans `load-company.ts`)
- Ticker canonical = série la plus liquide

### 5.3 IPO récente (<6 ans, ex RDDT, ARM, ABVX)
- History < 5 ans → CAGR 5 ans peut être faux
- Badge "Young IPO" affiché en haut de fiche
- maxPeriodYears adaptatif (5 / 10 / 20 ans grisé)

### 5.4 Dividende-payer vs non-payer
- Non-payer : pas de bloc DividendStories rendu
- Aristocrat (≥25 ans streak) : badge spécial + carte dédiée

### 5.5 Cat 1 (US) / Cat 2 (FPI ADR) / Cat 3 (EU pures)
- Cat 1 : source 10-K + 10-Q + 8-K, fréquence quarterly
- Cat 2 : source 20-F + 6-K, fréquence souvent semestrielle
- Cat 3 : source annual-text scrapé IR, fréquence variable
- Le mode par défaut s'adapte automatiquement au `period_type` natif
  du hero KPI.

### 5.6 Stés sans wow (banques, utilities, REIT)
- Hero KPI = générique secteur (Revenue total, Loan book, AUM)
- Pas de Stories block (si pas de short-history KPI)

---

## 6. Procédure de mise à jour de la recette

Quand un nouveau bug est détecté (screen Yann ou audit auto) :

1. **Identifier l'élément concerné** dans le quality-tree (cf. ID stable)
2. **Reproduire** le bug sur la sté témoin
3. **Ajouter le check** dans `src/lib/chart-spec-verify.ts` avec son ID
4. **Ajouter l'auto-fix** si possible (sinon warning seul)
5. **Ajouter l'entrée** dans cette doc, section "Anti-patterns connus"
6. **Tester** sur 5 stés témoins (GOOGL / NVDA / AAPL / CAT / META)
7. **Commit** avec message `fix(chart): <ID>`
8. **Re-run** `python3 scripts/visual-audit-gemini.py --top307` pour
   confirmer 0 régression globale

---

## 7. Versioning + revert

`buildChartSpec()` accepte `options.preset` :
- `"v2-canonical"` (défaut, recommandé)
- `"v1-legacy"` : ancienne logique (last-Q-of-year sans somme) pour
  comparer ou revert temporairement.

Permet de comparer avant/après sur une sté donnée sans déploiement.

---

## 8. Mémo prompt LLM auditeur

Si tu (LLM) reviewes un chart, vérifie dans l'ordre :

1. ✅ Le dernier point annuel est-il une FY COMPLÈTE (4 Q) ?
2. ✅ Si non, un point TTM distinct est-il visible avec sa valeur ?
3. ✅ Les sommes annuelles sont cohérentes avec les quarters publiés ?
4. ✅ Pour les KPIs `%` / `ratio`, l'aggrégation est la moyenne (pas la somme) ?
5. ✅ Aucun Q futur (> today) n'est plotté ?
6. ✅ Labels fiscal-aware pour les stés du fiscal-calendar ?
7. ✅ Unité affichée sur axe Y ?
8. ✅ CAGR sans Infinity / NaN ?
9. ✅ Pas de superposition watermark / TTM badge / Y-axis labels ?
10. ✅ Events filtrés à la zone plotted (pas de cluster bord droit) ?

Si UN seul de ces 10 points fail → le chart n'est pas livrable.
