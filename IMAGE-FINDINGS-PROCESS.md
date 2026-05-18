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
