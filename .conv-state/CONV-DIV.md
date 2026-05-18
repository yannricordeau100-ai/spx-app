# CONV-DIV — état au 2026-05-12 03:35

## Identité

Conv dédiée à l'enrichissement des KPIs dividendes (DPS, Cap Return, Payout Ratio + dividend_meta) pour les sociétés du pipeline Mettrik AI. Créée par Yann le 8 mai 2026. Périmètre EXCLUSIF : `src/data/v2-pipeline-enrich/<ticker>.json`. Ne touche pas à `src/data/v2-pipeline/<ticker>.json` (scope CONV-DATA).

Lit au démarrage : `RULES-GOLDEN.md`, `SHARED-STATUS.md`, `CLAUDE.md`, `AGENTS.md`, `HANDOFF.md`. Règle 7 active : 100 % autonomie, aucune autorisation à Yann.

## Mission V1+V2+V3+V4 LIVRÉE — 738 stés couvertes

| Source | Stés OK |
|---|---|
| cat1-us 10-K (Cerebras qwen-3-235b) | 114 |
| yfinance fallback (DPS + cashflow + NI) | 114 |
| cat3-european annual-text multi-langue | 19 + 240 (universe batch) |
| SEC EDGAR API directe | 5 |
| cat2-foreign-adr 20-F (V4) | 11 |
| **TOTAL avec 3 KPIs complets** | **738** |
| dont enrichies dividend_meta XBRL | 464 |

Sur l'univers de 4404 stés `v2-pipeline/`, ~3000 stés correctement identifiées non-payeuses (small-caps US/tech/biotech, qui ne distribuent pas).

## Patches UI livrés (scope normalement CONV-CONCEPTS, autorisé Yann explicitement)

1. **load-company.ts** : merge `enrich.kpis` append-only (V1). Patch survivant après modifs de CONV-CONCEPTS et linter.
2. **dividend-stories.tsx** : refonte 9 mai 23h — carrousel → grid 3 colonnes côte à côte sans défilement (suppression autoplay, swipe, dots, tap-zones, phone frame).
3. **dividend-aristocrat-card.tsx + dividend-calculator-card.tsx + dividend-snowball-card.tsx** :
   - Tailles texte bumpées d'un palier (8.5/9 → 11-12 px, 10/11 → 12.5-13, 12 → 14, 13.5/14 → 15-17)
   - Tax par défaut 0% (était 30%)
   - "Capital ≈" majuscule (était "capital ≈")
   - Fix espace JSX `{ticker}{" "}faut-il` (rendu "CAT faut-il" au lieu de "CATfaut-il")
   - CAGR : 5 ans net, 10/20/50 ans flou + badge "V2"
   - CAGR : auto-filter périodes sans valeur (refonte 10 mai 2026)

## Outils éphémères (scripts Python, /tmp/conv-div/)

- `extract_dividends.py` : extracteur V1 cat1-us 10-K
- `extract_v2_strict.py` : V2 chunking table-strict (Item 5 / income statement)
- `extract_v2_sec_api.py` : V2 SEC EDGAR API direct (CIK → 10-K/20-F)
- `extract_v2_eu.py` : V2 cat3-european multi-langue
- `extract_v2_xbrl.py` : V4 XBRL companyconcept (first_year + streak + history)
- `extract_v3_yfinance.py` : V3 yfinance fallback massif
- `extract_v4_cat2.py` : V4 cat2 20-F (monkey-patch v2_strict pour cat2)
- `cleanup_partial.py` : remove KPIs avec last value null
- `qa_pass.py` : flag suspect extractions
- Logs : batch1.log, retry.log, retry2.log, v2-1.log, v2-2.log, v2-3.log, v3-universe.log, v3-xbrl-universe.log, v3-cerebras-fallback.log, v3-eu-massive.log, v3-eu-fallback.log, v4-cat2.log

## Procs Python actifs au moment de l'arrêt

Aucun. Toutes les passes V1→V4 sont terminées et leurs résultats persistés dans `src/data/v2-pipeline-enrich/`.

## Commits sur staging

- `4bf970ad` : CONV-DIV V4 + readability + grid layout (738 stés enrichies + 3 cards patchées)
- `585731f8` : DividendStories micro-fixes Yann 10 mai (tax 0%, Capital majuscule, espace CAT, CAGR flou V2)

Alias `mettrik-staging.vercel.app` à jour. TS clean. Build merged 2208 stés.

## Tâches en cours / prochaines

**Rien en cours.** Mission V4 livrée et confirmée.

Prochaines tâches si Yann reprend :
1. (Optionnel) Étendre cat2 ADR encore — 160 stés tentées V4, 11 ok → ~1100 stés restantes à essayer avec un extracteur plus permissif sur les sous-formats 20-F
2. (Optionnel) Améliorer streak XBRL pour les Aristocrats vrais (KO 60+ ans réels vs XBRL 5 ans, JNJ 60+ vs XBRL 0). Solution : croiser avec curated list S&P Dividend Aristocrats publique
3. (Optionnel) yearsStreak réel via parsing narratif 10-K (LLM extrait "since 1893" etc.) — partiellement déjà fait via dividend_meta.first_year
4. Lisibilité supplémentaire si Yann revient avec un point précis

## Coordination autres convs

🤝 CONV-CONCEPTS : a patché dividend-aristocrat-card.tsx (CAGR auto-filter périodes vides, 10 mai). A patché load-company.ts (merge dividend_meta). Compatible avec mon scope.

🤝 CONV-SYSTEMS : a patché load-company.ts (sanitizeCompanyData, normalizeHistory). Compatible avec mon patch (mes 11 lignes pour merge enrich.kpis y sont toujours).

🤝 CONV-DATA : a 2 procs Python sec-download-v2 actifs (PIDs 98908 + 98930). Pas de chevauchement avec mon scope. Lui dire de `disown` + écrire son état.

## Reprise au redémarrage

Yann doit dire en premier message à la nouvelle conv :
> "Tu es CONV-DIV, lis ~/spx-app/.conv-state/CONV-DIV.md et continue selon les règles RULES-GOLDEN.md"

OU si le hook SessionStart est configuré et qu'il tape juste `CONV-DIV` comme premier mot, le mécanisme charge automatiquement ce fichier.

**Rien à relancer immédiatement.** Au repos jusqu'à nouveau brief Yann.

## Coût total mission

- Cerebras free tier (3 clés) : 0 €
- SEC EDGAR : 0 €
- yfinance : 0 €
- **Total : 0 €** sur V1+V2+V3+V4
