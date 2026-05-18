# Image Findings — Procédure standardisée

> Édictée par Yann le 17 mai 2026.
> Auto-chargée pour toute nouvelle demande dans `/sandbox/image-findings`.
> Lecture obligatoire AVANT de démarrer une demande.

---

## 🚨 RÈGLE D'OR — Contenu accepté (édictée par Yann le 18 mai 2026)

**UNIQUEMENT** des graphiques et schémas data-driven :
- ✅ Charts barres, lignes, donut, scatter, area, sankey, treemap
- ✅ Schémas comparatifs avec valeurs chiffrées
- ✅ Heat maps, geo maps avec data
- ✅ Diagrammes flow avec métriques

**INTERDIT** (skip + n'insère PAS) :
- ❌ Slides de titre / cover pages (ex "ASML reports €32.7B in 2025")
- ❌ Pages de texte (paragraphes, bullets, citations)
- ❌ Tableaux purs sans visualisation
- ❌ Logos / branding / photos / portraits
- ❌ Captures d'écran d'UI / interfaces software
- ❌ Mèmes / images humoristiques

Si l'agent inspecte une source et n'y trouve **AUCUN vrai graphique** :
il SKIP (ne crée pas de finding bidon).

## 🚨 RÈGLE — Rendu côté frontend

Le composant `<FindingCard>` (sandbox) et `<ImageFindingsBlock>` (public
fiches sté) affichent le SVG **local recréé** (`image_local_path`),
**JAMAIS** l'image source externe (`image_url`).

L'agent doit **TOUJOURS** remplir `image_local_path` avec le chemin SVG
qu'il a créé dans `/findings/demande-N/...`. Sinon le finding est invalide.

`image_url` sert uniquement comme lien "Source" (traçabilité, clic →
ouvre la page d'origine pour vérification).

## 🚨 RÈGLE — Langues (édictée par Yann le 18 mai 2026)

**Langue canonique : EN** (anglais) — c'est la langue **par défaut** du site
quand le visiteur n'a pas de traduction dans sa locale.

**3 langues obligatoires** pour chaque finding (créer dans cet ordre) :
1. **EN** (créé en premier, version canonique)
2. **DE** (traduit depuis EN)
3. **FR** (traduit depuis EN)

Champs i18n à remplir : `title_i18n`, `summary_i18n`, et `caption` doit être
en EN par défaut.

**Mapping locale visiteur → langue finding** (côté frontend) :
- `en`, `en-GB`, `en-US`, `en-AU`, etc. → **EN**
- `fr`, `fr-FR`, `fr-CA`, etc. → **FR**
- `de`, `de-CH` (suisse allemand), `de-AT` → **DE**
- TOUTES les autres locales (sv, da, nl, it, es, pt, ja, zh, etc.) → **EN** (fallback)

Tout SVG créé doit avoir le texte en **EN** par défaut. Pour servir un
visuel en DE/FR, l'agent crée 3 versions du SVG :
- `finding-XX-en-dark.svg` + `finding-XX-en-light.svg` (canonique)
- `finding-XX-de-dark.svg` + `finding-XX-de-light.svg`
- `finding-XX-fr-dark.svg` + `finding-XX-fr-light.svg`

Si l'agent ne crée qu'une seule version SVG (gain de temps) : EN
obligatoire, et les autres locales tomberont sur EN au rendu.

## 🚨 RÈGLE — Findings depuis docs sté (`source_platform=company_docs`)

Pour chaque finding extrait d'un document officiel d'une société
(Q earnings, Investor Day, ESG report, etc.), l'agent doit ÉGALEMENT :
1. Inspecter si les données affichées dans le graph peuvent constituer
   un **KPI normal** (= un KPI avec `value` actuelle, `history` ≥ 4 points,
   `unit`, `yoy`).
2. Si oui : tag le finding avec `convertible_to_kpi: true` + remplir le
   champ `kpi_draft` (objet JSON KPI prêt à insérer dans `company.kpis[]`).
3. Yann reviewera dans la sandbox et pourra décider de créer le KPI
   officiel d'un clic.

Exemple : graph "ASML revenus 2021-2025" → `convertible_to_kpi: true`
+ `kpi_draft: { short: "Net Sales", name_en: "Net Sales", value: 32.7,
unit: "Mds €", history: [18.6, 21.2, 27.6, 28.3, 32.7], ... }`.

## 🚨 Workflow autonome (édicté par Yann le 18 mai 2026)

Quand l'utilisateur clique "Lancer" sur une demande dans la sandbox :
- L'app trigger un worker GitHub Action `image-findings-autorun.yml`
  via `workflow_dispatch` (comme VIP Inspection).
- Le worker exécute le scraping autonome (9 sources, agents Claude).
- **AUCUNE intervention manuelle** dans une conv Claude n'est plus
  nécessaire pour démarrer une demande.
- Si une erreur survient : `error_msg` rempli en BDD → UI affiche une
  **cloche de notification** dans `/sandbox/image-findings` avec popup
  descriptif (clic → détail de l'erreur).

## 🚨 Validation SVG avant insertion BDD

Pour chaque SVG créé, vérifier :
- XML bien formé (`xmllint --noout fichier.svg` → exit 0)
- viewBox défini
- Caractères spéciaux échappés (`&` → `&amp;`, `<` → `&lt;`)
- Taille < 50 KB

Si validation échoue → refaire ou skip.

---

## Sources standard à utiliser pour CHAQUE demande

À chaque demande "Graphiques et Schémas de sources diverses", utiliser
SYSTÉMATIQUEMENT les 9 sources suivantes :

### Sources fixes (toutes obligatoires)

| # | Source | Méthode |
|---|---|---|
| 1 | Web search général | `WebSearch` |
| 2 | X (Twitter) anonyme | `WebFetch` nitter/web preview |
| 3 | X (Twitter) authentifié `@mettrics_ai` | Chrome MCP (claude-in-chrome) |
| 4 | Reddit | `WebSearch site:reddit.com` + `WebFetch` |
| 5 | Substack | `WebSearch site:substack.com` + `WebFetch` |
| 6 | DuckDuckGo Images | `WebFetch duckduckgo.com/?q=...&iax=images&ia=images` |
| 7 | HuggingFace | `WebFetch huggingface.co/...` |

### Sources additionnelles (autorisées sous conditions)

| # | Source | Condition |
|---|---|---|
| 8 | **Docs officiels de la société** | DATE ≤ 3 mois (Q earnings le plus récent, Investor Day, Capital Markets Day, ESG report, slides IR). Vérifier la date AVANT de récupérer. |
| 9 | **Autre source haute réputation** | Réputation établie de fournir des graphiques/data justes : SemiAnalysis, Stratechery, Bloomberg, Reuters, FT, IEEE Spectrum, SemiWiki, etc. JAMAIS de blog perso aléatoire ni source douteuse. |

### Sources INTERDITES

- Blogs personnels sans réputation établie
- Aggregators de contenu de qualité douteuse (StockNews, SeekingAlpha sans paywall, etc.)
- Sites de rumeurs / shitposting financier
- Anything posted as opinion sans data chiffrée + source primaire citée

---

## Workflow d'exécution

### Étape 1 : Setup
1. Update statut BDD `desk_image_findings_requests.status` → `in_progress`
2. Créer dossier `public/findings/demande-<N>/` pour stocker les SVG
3. Lire ce fichier (IMAGE-FINDINGS-PROCESS.md) avant de scraper

### Étape 2 : Scrape parallèle (4-6 agents max)
- 4-6 agents Claude en parallèle (1 source = 1 agent quand possible)
- **RAM check toutes les 60s** (`vm_stat`). Si Pages free < 200 MB → réduire à 2 agents. Si < 100 MB → freeze + 1 agent séquentiel.
- Chaque agent **PUSH BDD au fur et à mesure** (pas d'attente globale)
- Notifier l'utilisateur DÈS qu'une source a livré ses premiers findings

### Étape 3 : Insertion BDD (par finding)
Insert dans `desk_image_findings` avec :
```ts
{
  request_id: "<demande-uuid>",
  target_tickers: ["ASML", "AMAT", "LRCX", ...], // auto-détectés selon contenu du graph
  languages: ["fr","en","de"],
  source_url: "https://...",
  source_author: "Nom auteur ou compte",
  source_handle: "@handle",
  source_date: "2026-XX-XX",
  source_platform: "x_authed" | "x_anon" | "reddit" | "substack" | "web" | "ddg_images" | "huggingface" | "company_docs" | "high_rep",
  image_url: "https://...",
  image_local_path: "/findings/demande-2/finding-XX-dark.svg",
  title: "...",
  caption: "...",
  summary: "Lecture FR pour investisseur 16 ans non-tech...",
  title_i18n: { fr: "...", en: "...", de: "..." },
  summary_i18n: { fr: "...", en: "...", de: "..." },
  detected_kpi_topics: ["market_share","euv","r_and_d","backlog",...],
  approved: false, // Yann review
  rejected: false,
  show_summary: true, // default
}
```

### Étape 4 : SVG dark+light
Pour chaque finding :
- Créer SVG dark : `public/findings/demande-<N>/finding-XX-dark.svg`
- Créer SVG light : `public/findings/demande-<N>/finding-XX-light.svg`
- Light = mapping couleurs (#0a0a0e→#fafafa, #fafafa→#0a0a0e, etc.)

### Étape 5 : Review Yann
- Statut BDD → `pending_review`
- Yann approuve/rejette dans `/sandbox/image-findings`
- Findings approuvés affichés via merge SSR `load-company.ts` sur les `target_tickers` détectés

---

## Détection automatique tickers

Chaque finding DOIT avoir `target_tickers[]` rempli automatiquement par
l'agent qui scrape, sur la base :
- Tickers explicitement cités dans la légende/caption/source
- Concurrents évidents du sujet (ex demande #2 ASML → AMAT, LRCX, KLAC,
  8035.T, ASMI.AS, TOELY)
- Stés clientes pertinentes (ex ASML → TSM, INTC, 005930.KS Samsung)
- `["TOUS"]` si le graph est universel (ex market share global)

Le finding apparaîtra ensuite sur TOUTES les fiches sté listées.

---

## ETA cible

- Vague 1 (1ère source live) : ≤ 20 min après lancement
- Vague complète (8-9 sources livrées) : ≤ 60 min
- Cible : 30-50 findings candidats par demande, dont 10-20 approuvés
  par Yann

---

## Historique demandes

| # | Date | Query | Findings | Approved |
|---|---|---|---|---|
| 1 | 14 mai 2026 | AI market share gemini/openai/grok/claude 12 mois | 43 | 8 |
| 2 | 17 mai 2026 | ASML avance/sophistication vs concurrents | en cours | — |
