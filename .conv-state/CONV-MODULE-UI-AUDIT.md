# CONV-MODULE-UI-AUDIT · État & Plan

> Dernière mise à jour : 2026-05-08 ~15:30 UTC
> Module au scope étroit (cf concept "modules" SHARED-STATUS ligne 237) :
> audit automatique des défauts d'affichage sur les pages V1.8.
> Démarré par Yann ~22:45 du 7 mai 2026, autonomie totale jusqu'au matin.

---

## 1. Scope strict (ne pas dévier)

**Fichiers que je peux écrire SANS broadcast** :
- `scripts/audit-ui-pages.ts`
- `scripts/test-ui-fix-templates.ts`
- `scripts/preview-ui-fixes.ts`
- `src/data/v1-8-ui-audit.json`
- `src/data/v1-7-ui-audit.json` (cross-version sample)
- `src/lib/ui-fix-templates.ts`
- `SHARED-STATUS.md` (broadcast section uniquement)
- `.conv-state/CONV-MODULE-UI-AUDIT.md` (ce fichier)

**Je NE TOUCHE JAMAIS** :
- `src/data/v2-pipeline/` (CONV-DATA scope)
- `src/data/v2-pipeline-enrich/` (autres modules scope)
- `src/components/company-view.tsx` (CONV-CONCEPTS scope)
- `src/lib/v1-7/load-company.ts` (zone grise, ping CONV-SYSTEMS obligatoire)
- Code de templates / charts partagés
- Aucun push prod, aucun deploy Vercel

**Règles globales appliquées** :
- Pas d'em-dash dans textes user-facing
- Vocabulaire FR strict (Mds, M, NBSP, virgule décimale)
- DOB style dans réponses directes Yann
- Commits locaux uniquement
- Pas de pic CPU/RAM (Mac fragile)
- Vérification visuelle ou diff avant clôture

---

## 2. Travail livré cette nuit (8 commits locaux)

| # | SHA | Description |
|---|-----|-------------|
| 1 | `47d70ba7` | Phase 1+2 : audit V1.8 305 + helpers + 19 tests |
| 2 | `88d8cd2d` | Phase 3a : RANK_FORMAT_MIXED + NO_LABEL_PRICE_HEADER + TOGGLE_SINGLE + cross-version |
| 3 | `db8e90c8` | Broadcast ACK pings CONV-SYSTEMS + V1.7 sample top 50 |
| 4 | `2948b391` | scripts/preview-ui-fixes.ts (avant/après concret sur samples réels) |
| 5 | `ae9c7a0c` | UI_FRESHNESS_LABEL_EN + translateFreshnessLabel |
| 6 | `cd239311` | UI_NUMBER_FORMAT_NON_FR + normalizeNumberToFr |
| 7 | `4ac3d716` | Glossaires : 24 acronymes + 4 termes composés |
| 8 | `5d490be5` | Final rerun V1.8 top 100 + broadcast récap nuit |

Pour pull : `git log origin/staging..HEAD --oneline`

---

## 3. Codes défaut produits (10 actuellement)

Détecteur dans `scripts/audit-ui-pages.ts`. Stats V1.8 top 100 (rerun final 13:25 UTC) :

| Code | Stés | % | Note |
|------|------|---|------|
| `UI_LANG_HTML_EN` | 88 | 88 % | `<html lang="en">` sur app FR |
| `UI_PCT_NO_NBSP` | 88 | 88 % | `10%` sans NBSP avant `%` |
| `UI_LABEL_EN` | 88 | 88 % | chips Sector/Sub-sector/Founded en EN |
| `UI_ACRONYM_NO_TOOLTIP` | 88 | 88 % | HPC/CAGR/TAM/EBITDA sans `<i>` |
| `UI_RANK_FORMAT_MIXED` | 88 | 88 % | mix `#XX` et `Top X %` (ex-UI_RANK_MIX) |
| `UI_NUMBER_FORMAT_NON_FR` | 88 | 88 % | "6.9%" au lieu de "6,9 %" (bug massif) |
| `UI_BAD_UNIT_NARRATIVE` | 86 | 86 % | "60M$" / "0.06 Mds$" collés en narrative |
| `UI_FRESHNESS_LABEL_EN` | 40 | 40 % | Recent/Fresh/Stale en EN |
| `UI_BAD_UNIT_BS` | 17 | 17 % | "B$" résiduel (ex "10.9 B $") |
| `UI_PAGE_HTTP_ERROR` | 12 | 12 % | bug `repartition-block.tsx:36` (CONV-CONCEPTS) |

Codes prêts mais 0 hit actuel :
- `UI_NO_LABEL_PRICE_HEADER` : capi/variation/prix sans label (regex strict)
- `UI_TOGGLE_SINGLE` : Annuel seul sans Trim/TTM (toggle rendu client-side, invisible SSR)

---

## 4. Helpers FR purs (src/lib/ui-fix-templates.ts)

Tous testés (27/27 pass), idempotents, application 2× ne change rien.

| Helper | Cas |
|--------|-----|
| `normalizeBToMds(text)` | "12B$" → "12 Mds $" |
| `normalizeUnitSpacing(text)` | "60M$" → "60 M $" (NBSP) |
| `addNbspBeforePct(text)` | "10%" → "10 %" |
| `normalizeNarrative(text)` | pipeline complet (3 ci-dessus) |
| `translateSubsector(en)` | "Compute & Networking" → "Calcul & réseau" |
| `translateChipLabel(en)` | "Sector" → "Secteur" |
| `translateFreshnessLabel(en)` | "Recent" → "Récent" |
| `normalizeNumberToFr(text)` | "6.9%" → "6,9 %", "1,234.56" → "1 234,56" |

Glossaires :
- `ACRONYM_GLOSSARY` : 24 entrées (HPC, CAGR, TAM, EBITDA, ARPP, TAC, ABF, ARR, MRR, GAAP, FCF, ROIC, ROE, NPS, ADR, IPO, GICS, GMV, TTM, YoY, QoQ, CapEx, OpEx, P_E)
- `TERM_GLOSSARY` : 4 termes composés (Run Rate, Backlog, Hero KPI, Free Cash Flow)
- `CHIP_LABEL_FR` : 5 labels (Sector, Sub-sector, Founded, Headquarters, Tagline)
- `FRESHNESS_LABEL_FR` : 4 labels (Recent, Fresh, Stale, Unknown)
- `SUBSECTOR_FR_MAP` : 12 mappings GICS EN→FR

---

## 5. Pings ouverts (SHARED-STATUS)

### 5.1 Reçus

**🤝 CONV-SYSTEMS ping 1 (ligne 211, 8 mai 16h30)** : extraction quarterly top 308 US par CONV-DATA, puis rerun audit UI_TOGGLE_SINGLE.
→ **BLOCKED ON CONV-DATA**. Détecteur prêt. Rerun automatique dès broadcast fin extraction.

**🤝 CONV-SYSTEMS ping 2 (ligne 232, 8 mai 16h31)** : ajout codes UI_RANK_FORMAT_MIXED + UI_NO_LABEL_PRICE_HEADER.
→ **TRAITÉ commit 88d8cd2d**. 252/305 stés UI_RANK_FORMAT_MIXED, 0 hit UI_NO_LABEL_PRICE_HEADER (regex strict, bug AMAT apparemment fixé).

### 5.2 Envoyés à autres convs

**🤝 CONV-CONCEPTS** : fix `repartition-block.tsx:36` (TypeError null.map) = 52 stés en HTTP 500 sur V1.8 305 (12 sur top 100). Liste tickers dispo dans `src/data/v1-8-ui-audit.json`.

**🤝 CONV-CONCEPTS** : intégration `normalizeNumberToFr` ou switch vers `toLocaleString("fr-FR")` dans composants qui rendent des nombres (88 % stés concernées).

**🤝 CONV-CONCEPTS** : wrapper `<FreshnessIndicator>` avec `translateFreshnessLabel(label)` (40 % stés concernées).

**🤝 CONV-CONCEPTS** : appliquer `normalizeNarrative` aux blocs narratifs (description / signal / stories) pour fixer UI_BAD_UNIT_NARRATIVE (86 %) + UI_PCT_NO_NBSP (88 %).

**🤝 CONV-CONCEPTS** : appliquer `translateChipLabel` aux chips CompanyHeader (UI_LABEL_EN 88 %).

---

## 6. Sample cross-version

| Version | Stés | HTTP 500 | UI_LABEL_EN | UI_BAD_UNIT_NARRATIVE |
|---------|------|----------|-------------|----------------------|
| V1.8 top 100 (rerun final) | 100 | 12 (12 %) | 88 | 86 |
| V1.8 top 305 (commit 88d8cd2d) | 305 | 52 (17 %) | 252 | 248 |
| V1.7 top 50 (commit db8e90c8) | 50 | 20 (40 %) | 30 | 28 |
| V1.6 305 | timeout 30 s/page, skip |

V1.7 a 2× plus de pages cassées que V1.8 en proportion. V1.6/V1.7 fetch trop lent en local pour audit complet sans Vercel preview.

---

## 7. Prochaines actions possibles (priorisées)

### À déclencher sur trigger externe
- **TRIG-A** : CONV-CONCEPTS broadcast fix repartition-block.tsx → rerun audit V1.8 top 305 (les 52 stés HTTP 500 devraient passer à 0)
- **TRIG-B** : CONV-CONCEPTS broadcast intégration helpers normalizeNarrative / translateChipLabel / normalizeNumberToFr → rerun pour mesurer baisse %
- **TRIG-C** : CONV-DATA broadcast fin extraction quarterly top 308 US → rerun UI_TOGGLE_SINGLE (devrait passer 0 → si données client-side, basculer audit sur Playwright avec Yann go)

### Si autonomie continue (à prochain réveil)
1. Étendre `EN_SUBSECTORS_PATTERNS` (43/305 stés sub-sector EN détectés ; vérifier que tous sont mappés dans `SUBSECTOR_FR_MAP`)
2. Ajouter `UI_DATE_FORMAT_US` : dates MM/DD/YYYY au lieu de DD/MM/YYYY
3. Auditer page home `/` et `/sandbox/data-status` (hors scope V1.8 mais Mettrik global)
4. Détecter logo non-canonique sur charts (cf brief Yann, version validée = iridescent Fraunces italic 800 avec dot violet)
5. Audit Playwright si Yann valide install Chromium (~150 MB, à éviter Mac fragile sans valeur claire)

### Tâches non prises (scope strict)
- Application directe des helpers dans composants partagés → CONV-CONCEPTS scope
- Fix data dans `src/data/v2-pipeline/` → CONV-DATA scope
- Fix `repartition-block.tsx:36` → CONV-CONCEPTS scope
- Refactor `load-company.ts` → CONV-SYSTEMS scope (zone grise)

---

## 8. Comment reprendre cette conv

```bash
cd ~/spx-app
# 1. Voir mes 8 commits locaux
git log origin/staging..HEAD --oneline

# 2. Valider tests helpers
npx tsx scripts/test-ui-fix-templates.ts          # 27/27 pass

# 3. Voir avant/après concret sur samples réels
npx tsx scripts/preview-ui-fixes.ts                # ou v1-7 pour comparer

# 4. Rerun audit (toujours top 100 si dev server lent, top 305 sinon)
npx tsx scripts/audit-ui-pages.ts 100             # rapide
npx tsx scripts/audit-ui-pages.ts all             # complet 305
npx tsx scripts/audit-ui-pages.ts --version v1-7 50  # cross-version

# 5. Sortie audit
cat src/data/v1-8-ui-audit.json | jq '.by_code'
```

---

## 9. Risques / dettes connues

- **Dev server local saturé** après plusieurs reruns successifs (PID next-server CPU >13 min observé) : kill rerun + attendre 1-2 min pour récupération. Mac fragile → ne pas paralléliser audits.
- **Audit limité top 100 sur rerun final** (au lieu de 305) pour respect Mac fragile. Stats proportionnellement équivalentes au top 305 (commit 88d8cd2d) mais granularité moindre.
- **V1.6/V1.7 fetch trop lent** (>30 s/page sur certaines pages) : audit complet bloqué tant que pas warm-up build ou Vercel preview.
- **UI_NO_LABEL_PRICE_HEADER et UI_TOGGLE_SINGLE à 0 hits** : soit le bug AMAT 8 mai a été fixé entre temps, soit toggle rendu client-side (invisible SSR). Détecteurs prêts si réapparition.
- **`company-view.tsx` modifié par CONV-CONCEPTS pendant mon travail** (ajout MettrikWordmark) : pas touché, hors scope.
- **Commit `2c43a2a857` (CONV-SYSTEMS, 04:36)** a aspiré mes premiers fichiers via `git add -A` parallèle. Signalé dans SHARED-STATUS. Pas de perte de contenu, juste attribution confondue.

---

## 10. Identité conv

- **Nom** : CONV-MODULE-UI-AUDIT
- **Type** : module au scope étroit (cf SHARED-STATUS ligne 237, concept adopté par Yann 8 mai)
- **Scope unique** : détection automatique défauts UI + helpers FR + broadcasts coordination
- **Rattachement** : autonome, broadcast aux 4 convs principales (CONCEPTS, SYSTEMS, DATA, BRAND) via SHARED-STATUS
- **Output convention** : `src/data/v1-8-ui-audit.json` (selon brief Yann direct, pas `v2-pipeline-enrich/`)
- **Signature SHARED-STATUS** : `CONV-MODULE-UI-AUDIT`
