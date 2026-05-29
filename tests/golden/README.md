# Tests Golden Phase 2B — Mettrik AI

Système de snapshots Playwright sur les 10 sociétés témoin du chantier
Phase 2B. Objectif : détecter automatiquement toute régression visuelle
(value affichée, nom KPI, unité, top 4 KPIs, capi) après changement
data, fix mapping, ré-extraction LLM, etc.

## Stés témoin (10)

NVDA · AAPL · MSFT · GOOGL · AMZN · META · TSLA · V · JPM · BRK-B

URL canonique : `https://mettrik-niveau2.vercel.app/sandbox/v1-9-5/<lowercase>?audit_token=...`

## Champs extraits (cf. `extract.ts`)

| Champ | Source DOM | Tolérance test |
|---|---|---|
| `hero_kpi_name` | `<span class="font-display">` titre hero | exact match |
| `hero_kpi_value` | NumberTicker (`.gradient-text.font-display`) | ±5 % |
| `hero_kpi_unit` | sibling div `text-zinc-400` | exact match |
| `hero_yoy_pct` | chip pill `+X,X %` | ±2 pts |
| `capi_mds_dollar` | stock-price-block col 1 (tabular-nums) | ±10 % (live yfinance) |
| `top_4_kpi_shorts` | 4 spans `font-mono uppercase` après hero | exact match (ordre) |

## Workflow

### 1. Régénérer les snapshots proposés depuis le live

```bash
npm run test:golden:propose
```

Cela écrit `tests/golden/snapshots-proposed/<ticker>.proposed.json`. Yann
review chaque fichier (1 par sté) et compare avec
`src/data/inspection-log.json` pour identifier les bugs déjà détectés
(MU R&D 10 Mds, NVDA Data Center 68, MSFT Azure Growth unit, JPM Tier 1
unit, META DAP unit, BRK-B 1 KPI seulement, etc.).

### 2. Promouvoir un proposed en golden (validation manuelle)

Quand Yann a vérifié que la value affichée correspond à ce qu'il veut
figer comme référence :

```bash
cp tests/golden/snapshots-proposed/nvda.proposed.json tests/golden/snapshots/nvda.golden.json
```

Le test associé devient actif. Tant qu'un golden n'existe pas, le test
de la sté est skipé (avec un warning lisible).

### 3. Vérifier que le live correspond au golden

```bash
npm run test:golden
```

Si une régression apparaît (ex : pipeline ré-écrit NVDA hero à 12 Mds $
au lieu de 68), le test échoue avec un diff clair value live vs golden.

## Interprétation des diffs

| Diff | Cause probable | Action |
|---|---|---|
| `hero_kpi_name` change | Pipeline a renommé / switché hero KPI | Vérifier cohérence avec mission Mettrik |
| `hero_kpi_value` ±5 % dépassé | Re-extraction LLM a sorti une valeur différente | Cross-check sources (10-K, IR) |
| `hero_kpi_unit` change | Bug unit récurrent (cf. inspection-log) | Fix unit dans v2-pipeline/<t>.json |
| `hero_yoy_pct` dépassé | History a changé (point ajouté/retiré) | Vérifier history cohérence |
| `capi_mds_dollar` ±10 % dépassé | Live yfinance peut bouger plus de 10 % en 1 jour si flash crash, sinon vraie régression | Re-run le snapshot après 24h, sinon investigate |
| `top_4_kpi_shorts` change | Pipeline a ré-ordonné ou ajouté/supprimé KPIs | Vérifier `is_wow` / `is_generic` flags |

## Update du golden (cas légitime)

Si Yann valide volontairement un changement (ex : NVDA passe officielle-
ment de Data Center 68 → 130 Mds après nouveau filing), il suffit de :

```bash
npm run test:golden:propose
cp tests/golden/snapshots-proposed/nvda.proposed.json tests/golden/snapshots/nvda.golden.json
git add tests/golden/snapshots/nvda.golden.json
git commit -m "chore(golden): bump NVDA hero après FY26 Q4"
```

## Contraintes (Mac fragile)

- **Chromium uniquement** (économie RAM, pas Firefox/WebKit).
- **1 instance Playwright à la fois** (`workers: 1` dans `playwright.config.ts`).
- **Pas d'Anthropic API payant** : extraction purement DOM.

## Scripts npm

| Commande | Effet |
|---|---|
| `npm run test:golden` | Run les 10 tests, compare live vs golden/ |
| `npm run test:golden:propose` | Régénère snapshots-proposed/ depuis le live |
