@AGENTS.md
@HANDOFF.md
@SHARED-STATUS.md

> 🔍 **RÈGLE TEST RÉEL OBLIGATOIRE** (ajoutée 3 mai 2026) :
> Avant de dire à Yann « à tester côté toi », je DOIS tester en réel sur la prod
> via curl (HTTP status + grep du contenu attendu). Pour les pages qui demandent
> auth/cookie, je vérifie au minimum que la route est servie sans erreur. Yann
> m'a déjà eu plusieurs fois sur des pages qui ne marchaient pas alors que je
> disais « live ». Plus jamais.

> ⚡⚡⚡ **YANN A UPGRADÉ À CLAUDE MAX 20× LE 3 MAI 2026.** Plus aucune limite
> de tokens ni de quota côté user. Si tu te dis "il faut économiser des tokens"
> ou "je dois ralentir pour ne pas saturer", c'est FAUX. Toutes les auths
> données par le passé restent valides + élargies. **N'attends pas, ne demande
> pas confirmation pour des raisons de quota, ne te bloque pas en pensant que
> Yann va manquer de crédit.** Travaille à plein régime jusqu'au 5 mai 2026
> au moins.

# Mettrik AI — Context for new Claude Code sessions

This file is auto-loaded by Claude Code at the project root.
**Read this entire file before answering any question.** Don't make assumptions
that contradict the rules below — they were established with the user across
many hours of iteration.

> **🔴 RÈGLE ABSOLUE — coordination 4 conversations**
>
> Avant de répondre à CHAQUE prompt user :
> 1. Re-lire `SHARED-STATUS.md` (au moins les 10 dernières lignes du log + section
>    "🔄 EN COURS").
> 2. Vérifier qu'aucune autre conv n'est en train de toucher au même périmètre.
> 3. Si chevauchement détecté → l'évoquer explicitement avant d'agir.
> 4. Esprit **entraide**, pas rivalité. Ne jamais re-faire / dé-faire / dupliquer
>    le travail d'une autre conv.
> 5. Les 4 conversations : **CONCEPTS · SYSTEMS · DATA · BRAND**. Pas d'autre nom.
> 6. Le terme **"Pulse"** ne désigne plus rien : la marque est **Mettrik AI**.
>    Toute mention résiduelle de "Pulse" dans un fichier = reliquat à signaler
>    ou remplacer selon ton scope.
> 7. **DATA PRESERVATION ABSOLUE** : toute migration / refactor qui touche
>    une structure de données (BDD, fichiers JSON `src/data/`, configs user)
>    DOIT préserver les données existantes. Migration SQL = `UPDATE` de
>    mapping AVANT de changer le schéma. Jamais de `DROP TABLE` ni
>    `DELETE FROM` sans backup explicite + go user. Les éléments saisis dans
>    le desk (notes, todos, idées, drafts, calendar, bookmarks, links,
>    inspiration, pitch) doivent survivre à TOUTES les mises à jour.

---

## 0. CURRENT STATE / WHERE WE LEFT OFF

The user wants to **resume work on 3D chart designs** for the main hero charts
(Curve, Bars, Variation). Previous attempts felt static and "Excel 2015".

**The exact 3D effect the user wants:**

> "Vue de face qui se décale automatiquement vers en haut à droite comme pour
> voir depuis le dessus mais décalé, qui rend le graph vu de côté légèrement
> et donc en 3D."

Translation: the chart starts as a flat front view, then **animates a smooth
camera rotation toward a top-right perspective angle** — like a CAD model
tilting itself for inspection. Final position = slight tilt, viewer eye is
top-right with a "vue d'ensemble" perspective. Must feel cinematic/futuristic,
NOT pseudo-isometric (current attempt failed because it was a flat skewed face,
not a real 3D camera move).

**Bonus 1 (open):** the holographic pie chart on Top 3 Capital / Voting blocks
(component `holographic-pie.tsx`) needs to be redesigned to match a reference
image the user will provide. Current version is OK but not the target.

**Bonus 2 (open):** search bar on company pages — was requested earlier, may
or may not be implemented (verify). Should let the user search/jump to another
company without going back to home.

**A chart-lab page exists** at `/chart-lab/[ticker]` with 5 stylistic
proposals per chart type (15 total). The user has NOT picked any of them.
This page is for reference / inspiration, not a deliverable.

---

## 1. PROJECT IDENTITY

- **Name (brand):** Mettrik
- **Domain:** mettrik.ai (purchased on Spaceship, domain only for now)
- **Subtitle:** "KPI Intelligence"
- **Audience:** investors (US + France + Western world). NOT for retail
  consumers — speak to investors, give "PV" (plus-value).
- **Stack:** Next.js 16 (Turbopack), React 19, Tailwind v4, motion/react,
  lucide-react. Fonts: **Manrope** (body), **Bricolage Grotesque** (display +
  Mettrik wordmark), **JetBrains Mono** (numbers).
- **Dev server:** `npm run dev` from `~/spx-app` (port 3000).

---

## 2. THE 5 COMPANIES (V1 SCOPE)

The app currently covers only these 5 companies:

| Ticker | Name | Sector | Sub-sector |
|---|---|---|---|
| GOOGL | Alphabet (Google) | Communication Services | Internet & Search |
| META  | Meta Platforms     | Communication Services | Social Media & Messaging |
| MSCI  | MSCI Inc.          | Finance                | Indices, Analytics & ESG |
| SPGI  | S&P Global         | Finance                | Données financières & notation |
| CAT   | Caterpillar        | Industrie              | Machines lourdes & Énergie |

Data is sourced from **the user's own PDF library** at
`/Users/yann/Desktop/Projets 2025 26/App KPI/10-K/<TICKER>/` — these are
real 10-K and Earnings Releases for 2021–2025. Extracted with `pdftotext` (via
`/opt/homebrew/bin/pdftotext`, since Homebrew bin isn't in PATH for sub-shells).

**HONESTY RULE on data**: never invent numbers. If a value can't be sourced
from the user's PDFs (or a clearly-stated public estimate with citation),
omit the field rather than fabricate. The user will spot fake numbers and
they will catastrophically harm credibility for his demo to baggr.fr / iq-invest
founders.

**DO NOT scale up to more companies until the user explicitly says
"on scale up" / "V2".** Polish the 5, do not start scraping more.

---

## 3. SINGLE VISUAL IDENTITY

Une seule vue par société : `/<ticker>` (composant `company-view.tsx`),
dark + violet/cyan gradients + conic-border sur les cards.

Les anciennes variantes Aurora (glass-morphism) et Spatial (embossed) ont
été supprimées : elles fragmentaient le brand pour aucun gain produit.
Toutes traces (routes, composants, CSS, sitemap, page-search variant prop,
compare-control variant prop) ont été nettoyées.

Un éventuel mode clair/sombre futur passera par un `ThemeToggle` (déjà
présent dans la top-nav), pas par des routes séparées.

Le chart-lab est à `/chart-lab/<ticker>` (galerie de styles, pas une
variante d'app). Les concepts sont à `/concepts` (prototype isolé).

---

## 4. KEY DATA TYPES (`src/lib/data.ts`)

```ts
type KPI = {
  short, name_fr, name_en?, explanation,
  value, unit, yoy, type, nature, comparable,
  compare_key?, signal, description, history: number[],
  last_data_date?: string,  // for freshness indicator
}

type Company = {
  ticker, name, sector, subsector, hero_kpi, tagline (in EN),
  founded, ipo, ranks, logo_treatment,
  kpis: KPI[],
  market_positions?: MarketPosition[],
  risks?: CompanyRisk[],
  governance?: Governance,
  ai_positioning?: AIPositioning,
}
```

Helper functions: `formatUnit`, `formatCAGR`, `cagr`, `interpretStructured`,
`findComparable`, `getFreshness`.

---

## 4bis. ORDRE D'AFFICHAGE DES KPI (Hero / Indicateurs clés / Stories)

**Règle figée pour toutes les sociétés.** Une fois appliquée pour une société,
l'ordre des KPIs ne change plus, même quand de nouvelles données trimestrielles
arrivent. L'ajout de data ne réordonne JAMAIS la liste.

### Tags KPI (dans `data.ts`)

```ts
type KPI = {
  // … champs existants …
  is_wow?: boolean;          // distinctif, propre à la sté ou sous-industrie
  is_generic?: boolean;      // comptable banal (Revenue, Net Income, EPS, …)
  is_short_history?: boolean; // <5 ans → bouge dans bloc Stories
  story_category?: string;   // "Innovation", "Marché", "Adoption", "Capacité"
};

type Company = {
  hero_kpi: string;            // KPI.short choisi comme Hero
  hero_kpi_rationale?: string; // pourquoi ce choix (1-2 phrases)
  // …
};
```

### 1. Hero KPI (en haut, avec le graph)

Le KPI dont les investisseurs ont le plus envie de connaître la valeur,
en privilégiant un KPI **wow** (distinctif). Doit avoir ≥5 ans d'historique.
Doit pouvoir alimenter un bloc Interprétation 4 points (Lead, Moteur,
Vigilance, Surveillance).

Choix V1 :
| Sté | Hero | Rationale |
|---|---|---|
| **META** | DAP | Audience effective cross-apps, base de monétisation |
| **GOOGL** | Cloud | Segment qui change la trajectoire d'Alphabet |
| **MSCI** | Total Run Rate | KPI maître secteur indices/analytics |
| **SPGI** | Ratings | Segment cyclique le plus suivi (signal crédit) |
| **CAT** | Backlog | Visibilité 6-18 mois sur revenu futur (cycles longs) |

### 2. Indicateurs clés (liste sous le graph)

Ordre d'alternance (par `orderKpis()` dans `src/lib/kpi-ordering.ts`) :
- Position 1 : wow
- Position 2 : wow
- Position 3 : generic
- Position 4 : wow
- Position 5 : generic
- Position 6+ : alternance générique / wow jusqu'à épuisement
- Generics restants en bas dans leur ordre original

**KPI generic** = Total Revenue, Net Income, EPS dilué, Op Margin, Headcount,
Capex (sauf si magnitude wow), Free Cash Flow.

### 3. Stories (sous Indicateurs clés)

Bloc carrousel autoplay 5s avec :
- KPIs avec `is_short_history: true`
- MarketPositions intégrées (catégorie "Marché")
- Boucle infinie 2 sens, pause au hover, flèches + dots
- Component : `src/components/kpi-stories.tsx` + `kpi-story-card.tsx`
- Logic : `src/lib/kpi-stories-ordering.ts` (groupage par story_category)

Le bloc Stories REMPLACE l'ancien bloc "Position marché · TAM" qui n'existe
plus sous sa forme propre — TAM est intégré comme story.

---

## 5. UI STRUCTURE OF A COMPANY PAGE (in order of appearance)

1. **Top nav** — back link + VariantSwitcher + CompareControl + Save button
2. **CompanyHeader** — logo (real SVG of brand) + name (display font) + ticker +
   sector/sub-sector + tagline (in English, original) + 6 stat chips
   (Rang mondial, Rang USA, Secteur, Sous-secteur, Fondée, IPO)
3. **HERO SECTION** (the most important block):
   - Left col (4/12): KPI principal label + freshness indicator + acronym +
     name FR + name EN (smaller) + InfoTooltip with explanation + huge
     animated number + KPI **shoulder** (vertical stack):
     - YoY pill (green/red, with tone arrow)
     - Quality chip (Excellent/Bon/Moyen/Faible — green to red)
     - CAGR pill ("+22.4 % / an (CAGR 5 ans)")
     - Percentile chip ("Top 5 % · Sous-secteur Internet & Search" — gold for top tier)
   - Right col (8/12): PeriodToggle + ChartCycle (Courbe/Barres/Variation/Tableau de bord)
   - EventTimeline below the chart (4 hand-curated events per company)
   - InterpretationBlock at the bottom: lead + 3 bullets (Moteur de croissance,
     Point de vigilance, Génération de cash) + 1 future-watch bullet
     (cyan, equal weight, "À surveiller au prochain trimestre")
4. **Compare panel** (conditional) — appears below HERO when user clicks Comparer
5. **KPI table** — 5-12 KPIs ordonnés via `orderKpis()` (cf. § 4bis), click to
   promote to hero, scroll smoothly to top.
6. **Stories** (conditional) — carrousel autoplay 5s avec KPIs short-history +
   MarketPositions intégrées. REMPLACE l'ancien "Position marché · TAM".
   Voir `src/components/kpi-stories.tsx`.
7. **Facteurs de risque** — 5-8 risks per company, each with category badge,
   trend chip (new/up/stable/down/removed), severity score 1-5 + score_rationale
   tooltip with 4 inputs (10-K position, language intensity, trend vs N-1, category weight)
8. **Gouvernance & rémunération** — 9 metrics + voting structure note + 2 blocks
   (Top 3 Droits de vote / Top 3 Capital détenu) — clicking a block opens
   the **HolographicPie 3D modal**
9. **Positionnement IA** — stance (leader/integrator/cautious/absent) +
   3-5 evidence items + source
10. **Footer** — "Mettrik · KPI Intelligence — V1" or variant equivalent

---

## 6. VOCABULARY & USER MICRO-RULES (TACIT)

These were established progressively. **Respect them strictly.**

### Wording
- **No em-dash (—) in user-facing text.** Use `:` or split into two sentences.
  This includes data files, components, footers, descriptions. Em-dashes are
  the user's #1 hated AI tic.
- **"À jour"** never "En direct" for live-data labels.
- **"Approbation de la rémunération"** never "say-on-pay" raw (anglicism).
  English term can appear in tooltip, italic, smaller, in parentheses.
- **"PV"** = plus-value (used in user prompts).
- **"stés"** = sociétés (used in user prompts).
- All UI in French. Taglines stay in **English** (companies' original taglines).
- KPI labels: short acronym + name FR + (smaller) name EN + italic
  explanation in tooltip "i".

### Peer-rank language (governance)
Simple words a 16-year-old understands :
- "Plus bas que la moyenne" / "Dans la moyenne" / "Plus haut que la moyenne" /
  "Bien au-dessus"
- NEVER use "Bas vs pairs", "extrême vs pairs", or jargon.

### Numbers / units
- "B" → **"Mds"** (e.g. "$B" displays as "Mds $", "B" displays as "Mds").
- For currency Y axis ticks, **integer values only** (no decimal).
- For % and ratios, 1 decimal max.
- French locale: `toLocaleString("fr-FR", {...})`.

### Risk scoring
Each risk has a `score: 1-5` AND a `score_rationale` string. The rationale
must explicitly cite the 4 criteria : (1) position in 10-K order,
(2) language intensity ("could materially harm" vs "may affect"),
(3) trend vs N-1, (4) category weight (cyber/regulatory weighted high).

### Data freshness
Use `getFreshness(lastDate)` returning `fresh | recent | stale | unknown`.
Display `<FreshnessIndicator>` next to "KPI principal" label. Stale data
(>12 months) gets the orange ⚠ badge.

### TAM honesty
Only show a `MarketPosition` card when **the company itself** has disclosed
both segment revenue AND TAM (in 10-K, 10-Q, investor day, or earnings call).
External TAM + company revenue = methodology mismatch = NEVER do that.

### AI positioning stance
4 values only : `leader | integrator | cautious | absent`. Pick honestly,
don't inflate.

### Background animations
Background drift animations (Aurora halos) must be **VERY SLOW** (90–120s
per cycle). The user has explicitly said multiple times that fast or even
medium animations are distracting.

### Don't ask for validation between actions
The user said "ne me demande pas plus de 2 autorisations entre 2 prompt"
and later "ne me demande pas de confirmation : c'est ok à chaque fois". When
in doubt, execute. Only stop for **one** explicit decision when truly
necessary.

### Concise responses
When the user's prompt is long, **keep the response short**. No bullet-explosion,
no recap of what they just said. Get to action.

---

## 7. FILE STRUCTURE

```
spx-app/
  src/
    app/
      layout.tsx           # fonts (Manrope/Bricolage/JetBrains), metadata
      page.tsx             # home → HomeView
      [ticker]/page.tsx    # vue société (la seule)
      chart-lab/[ticker]/  # 15-style gallery (reference)
      concepts/            # prototypes isolés (preview shell)
    data/
      google.json  meta.json  msci.json  spgi.json  cat.json
    lib/
      data.ts        # types, helpers, freshness
      brand.ts       # brand colors, rate(), detectAnomalies()
      compare.ts     # CAGR, volatility, momentum, gap analysis
      events.ts      # hand-curated events per company
      scroll.ts      # smoothScrollTo
      utils.ts       # cn, yoyTone, yoyColor
    components/
      home-view.tsx
      company-view.tsx       # vue société (la seule)
      company-header.tsx
      kpi-row.tsx
      chart-cycle.tsx        # Curve/Bars/Variation/Panel toggle
      charts/
        curve-chart.tsx      # CURRENT 3D attempt (axonometric — needs redo)
        bars-chart.tsx       # CURRENT 3D attempt
        delta-chart.tsx      # variation chart
        mini-multiples-chart.tsx
        chart-3d-wrapper.tsx # wrapper added by linter, integrated in chart-cycle
      lab/
        bars-variants.tsx       # 5 styles (gallery)
        curve-variants.tsx      # 5 styles
        variation-variants.tsx  # 5 styles
      market-position-card.tsx
      risk-stack.tsx
      governance-card.tsx
      ai-positioning-card.tsx
      holographic-pie.tsx        # 3D pie modal — needs visual redesign
      compare-control.tsx
      compare-panel.tsx
      compare-overlay-chart.tsx
      variant-switcher.tsx
      event-timeline.tsx
      interpretation-block.tsx
      period-toggle.tsx
      info-tooltip.tsx
      anomaly-info.tsx
      freshness-indicator.tsx
      logos.tsx                  # real SVG brand logos
      effects/
        spotlight.tsx
        number-ticker.tsx
        magic-card.tsx
        sparkline.tsx
      quality-badge.tsx
  next.config.ts                  # allowedDevOrigins for hotspot IPs
```

---

## 7bis. RECENT DISCUSSION TOPICS (the user may bring these up)

These topics were discussed at length right before the handoff and the user
expects you to remember the substance.

### Charts 3D — what was rejected and what's wanted
- **Rejected:** axonometric/isometric projection (looks like Excel 2015), simple
  side-face skew, pseudo-3D with parallelogram top/right faces.
- **Wanted:** front-view that **animates a smooth camera rotation toward a
  top-right perspective angle** at mount, like a CAD model tilting itself.
  Final position = slight tilt with eye at top-right, "vue d'ensemble". The
  current `bars-chart.tsx` includes a CSS `preserve-3d` stage with a `motion.div`
  wrapper that tries this (`rotateX(-16deg) rotateY(20deg)`) — improve on this,
  don't start from scratch. Pie chart popup should be redesigned similarly.

### Holographic pie modal
- Component : `src/components/holographic-pie.tsx`. Currently OK but the user
  has a reference image to provide for redesign. Background overlay was
  reduced from `bg-black/0.7 + blur-md` to `bg-black/0.45 + blur-2px` so the
  app behind stays slightly visible.

### Chart-lab gallery
- Route `/chart-lab/[ticker]` shows 5 styles per chart type (15 total).
- Bars : Crystal, Hologram, Mercury, Particle Stream, Floating Panels
- Curve : Energy Ribbon, Wireframe Terrain, Light Beam, Cosmic Trail, Liquid Wave
- Variation : Ripple Waves, Geyser, Tornado, Diving Arrows, Stacked Discs
- The user has NOT picked any yet. It's a gallery for inspiration.

### Data freshness rule (V2+ critical)
- Every KPI may carry `last_data_date` ISO string.
- `getFreshness(date)` returns `fresh | recent | stale | unknown`.
- `<FreshnessIndicator>` shows a small pill with a "i" tooltip explaining the tier.
- Stale data (>12 months) gets the orange ⚠ badge. Critical for V2 DB.

### TAM honesty rule (locked)
- Only show a `MarketPosition` card when **the company itself** has disclosed
  both segment revenue AND TAM (10-K, 10-Q, investor day, earnings call).
- External TAM + internal company revenue = methodology mismatch. Forbidden.
- Coverage drop is acceptable, fabrication is not.

### Risk scoring rationale (locked)
- Every `CompanyRisk` has `score: 1-5` AND `score_rationale` string.
- The rationale must cite the 4 inputs: (1) position in 10-K order,
  (2) language intensity, (3) trend vs N-1, (4) category weight.
- Trend chip values: `new | up | stable | down | removed`.

### Company peer ranks
- Only show in Governance card for now.
- Use simple words: "Plus bas que la moyenne" / "Dans la moyenne" /
  "Plus haut que la moyenne" / "Bien au-dessus".
- For "lower is better" metrics (CEO comp, pay ratio), set `inverse: true`.

### V2 financial pipeline (planned, NOT to start)
- Sources: SEC EDGAR (free, all filings) + IR-page scraping (free, Python +
  pdftotext) + Brave Search API (2000 free/mo) for fallback TAM research.
- LLM: Groq Llama 3.3 70B (free tier, ~$50 if paid for speed).
- Languages: 10-K, 10-Q, 8-K mandatory ; DEF 14A V2.1 ; transcripts V2.2.
- Coverage: 2000 largest US + ~700 EU (Stoxx 600 + FTSE 100 + SMI, capi >5 Md€).
- Total V2 budget cap: $150.

## 8. ROADMAP

### Done (V1)
✅ 5 companies × 3 visual variants × all routes 200 OK.
✅ KPIs, market positions (TAM), risks, governance, AI positioning blocks.
✅ Compare panel with quantitative analysis (CAGR, momentum, consistency, position).
✅ Event timeline.
✅ HolographicPie modal on shareholders blocks.
✅ Freshness indicator on hero KPI.
✅ Chart-lab with 15 styles for inspiration.

### Open V1 (priority order)
1. **3D charts redesign** — face-view with auto-tilt-to-top-right animation
   (cinematic camera rotation). User has REJECTED current axonometric attempts.
2. **Pie chart redesign** — to match reference image user will provide.
3. **Search bar on company pages** (verify if implemented; mentioned earlier).
4. **Yesterday's link issue** — user mentioned "le meme lien qu'hier et rien
   n'a changé" without context. To clarify when resumed.

### Open V2+ (DO NOT start without explicit user approval)
- Scale to 2000 largest US companies + ~700 EU (Stoxx 600 / FTSE 100 / SMI,
  capi > 5 Md€).
- Document pipeline: 10-K + 10-Q + 8-K (+ DEF 14A in V2.1, transcripts in V2.2).
- Free LLM extraction via **Groq** + Llama 3.3 70B (free tier, ~$50 if paid).
- TAM via **Brave Search API** (2000 free req/month) + Tavily (1000 free).
- Only show TAM if company-disclosed (honesty rule preserved).
- DB: Supabase free tier or similar.
- Total V2 launch budget cap: **$150**.

---

## 9. DEV / RUN

```bash
cd ~/spx-app
npm run dev   # port 3000
```

Mobile / iPhone Personal Hotspot: open `http://192.0.0.2:3000` on the iPhone.
`next.config.ts` already whitelists `192.0.0.2`, `172.20.10.2`, `192.168.1.49`,
`*.local`. To add a new local IP: edit `allowedDevOrigins`.

NO public tunnel by default. The user previously rejected localtunnel/serveo
because it leaks IP and adds warning pages.

---

## 10. WHEN IN DOUBT

- **Design changes:** show the user before deciding.
- **New data:** never invent. Ask for the source PDF or skip the field.
- **Naming:** the brand is `Mettrik AI`. Don't suggest renames.
- **Vue unique:** `company-view.tsx` est la seule vue société. Aurora /
  Spatial supprimées (cf. §3).

---

End of CLAUDE.md.
