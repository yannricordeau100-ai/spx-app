# HANDOFF EXHAUSTIF — CONV-SYSTEMS → CONV-SYSTEMS (fork) — 16 mai 2026

> Bloc à coller en première instruction de la conv fork "KPI test et intégration - Système (fork)".
> Contient l'état complet du travail, décisions, pièges et historique au moment du fork.

---

## ⚠️ CADRAGE STRICT DE TON PÉRIMÈTRE (fork)

**Yann a explicitement confirmé le 16 mai à 18h :**

### ✅ TON SCOPE (fork)

Tu reprends UNIQUEMENT :
- **Module "Graphiques et Schémas de sources diverses"** (image-findings demande #1 + futures demandes)
- **Sujets secondaires** déjà traités dans la conv origine : populaire-investisseurs, nettoyage RAM, refactor V1.7.5/V1.8 archi BDD dynamique (si Yann te le confirme)
- **Toute autre demande de Yann hors go-prod** qu'il t'enverra explicitement à toi (fork)

### ❌ HORS DE TON SCOPE

**NE TOUCHE PAS** au chantier **mise en place du système de transfer staging → prod (www.mettrik.ai)**.

Ce gros chantier reste **EXCLUSIVEMENT géré par CONV-SYSTEMS origine** (= l'autre conv, pas toi).

Donc si Yann te demande quelque chose qui touche :
- Déploiement Vercel prod (vs staging)
- DNS Spaceship vers `mettrik.ai`
- Stripe live mode
- Page maintenance / `MAINTENANCE_MODE`
- Email SMTP live Resend
- Webhooks Stripe live
- Backups automatisés cron
- Sécurité prod / Sentry
- Cookies GDPR banner
- Branche `production` séparée

→ **Réponds-lui** : "Ce chantier est exclusivement scope de CONV-SYSTEMS (origine). Je suis CONV-SYSTEMS (fork), je ne le traite pas. Bascule sur l'autre conv pour ça."

### Coordination entre les 2 convs SYSTEMS

- Vous partagez SHARED-STATUS.md → signe-toi `CONV-SYSTEMS-FORK` pour distinguer
- Si tu as besoin de quelque chose côté infra/prod pour ton scope (ex : une nouvelle ENV var, un nouveau endpoint API), tu pingues `🤝 @CONV-SYSTEMS` dans SHARED-STATUS et tu attends la livraison côté origine
- Si jamais Yann demande quelque chose d'ambigu, **demande clarification** avant d'exécuter

---

---

## TABLE DES MATIÈRES

1. Contexte projet
2. Conversations parallèles (5 + modules + fork)
3. Travail récent — module "Graphiques et Schémas"
4. Travail récent — refonte populaire-investisseurs
5. Travail récent — nettoyage RAM
6. Architecture dynamique BDD ↔ V1.7.5 + V1.8
7. **Décisions clés + pièges connus** (lecture obligatoire)
8. Mappings tickers (auto-détection)
9. Conventions visuelles SVG
10. Workflow image-findings (étapes complètes)
11. Commandes utiles (Supabase REST, RAM, Vercel)
12. Commits récents de cette conv
13. Mission go-prod (raison du fork)
14. Règles d'or (rappel)
15. État technique au moment du handoff
16. Première instruction suggérée

---

## 1. CONTEXTE PROJET

- **Brand** : Mettrik AI (mettrik.ai). Subtitle : "KPI Intelligence"
- **Audience** : investisseurs US + France + Europe occidentale
- **Repo** : `~/spx-app` (Next.js 16 Turbopack, React 19, Tailwind v4)
- **Branche active** : `staging` (alias Vercel `mettrik-staging.vercel.app`)
- **Prod** : `www.mettrik.ai` (domaine Spaceship, hébergé Vercel, **pas encore en ligne** = ta mission)
- **Supabase projet** : `cnggtyxzqlqqjrynnvdq.supabase.co`
- **Service role key** (déjà dans `.env.local`) : `sb_secret_L0brB3fAi7UYNTRd7MACnA_DuyQn8VK`
- **Email user** : yannricordeau100@gmail.com
- **Fonts** : Manrope (body), Bricolage Grotesque (display + wordmark), JetBrains Mono (numbers)

⚠️ **Lis intégralement avant tout** : `CLAUDE.md`, `RULES-GOLDEN.md`, `AGENTS.md`, `SHARED-STATUS.md`.

---

## 2. CONVERSATIONS PARALLÈLES

5 convs principales :
- **CONV-CONCEPTS** : visuels, charts, mockups, /concepts/*
- **CONV-SYSTEMS** = moi, conv origine du fork
- **CONV-DATA** : pipeline data, sec-data scraping, taxonomie GICS
- **CONV-BRAND** : naming, copy, dataset texte
- **CONV-DIV** : KPIs dividendes top 307

\+ modules (CONV-MODULE-UI-AUDIT, CONV-MODULE-RANKS-V2, CONV-MODULE-PEAD, CONV-TRANSCRIPTS)
\+ **toi = CONV-SYSTEMS (fork)**

⚠️ **Coordination via `SHARED-STATUS.md` OBLIGATOIRE** avant tout gros chantier. Lire 10 dernières lignes du log + section `## 🔄 EN COURS`.

---

## 3. MODULE "Graphiques et Schémas de sources diverses" (demande #1)

### 3a. Sandbox + BDD

- URL : `/sandbox/image-findings` (protégé desk auth)
- request_id BDD demande #1 : `80d26863-82f8-454b-b6d9-0b7f6aa81348`
- Query : "évolution des part de marchés de gemini, open ai, grok, claude sur les 12 derniers mois minimum"

### 3b. Schéma BDD (Supabase)

```sql
-- Tables principales (cf supabase/migrations/20260515_image_findings.sql)
desk_image_findings_requests (id, display_number, title, query, target_tickers[], languages[],
  status, error_msg, findings_count, approved_count, notes, created_at, updated_at)
desk_image_findings (id, request_id, target_tickers[], languages[], source_url, source_author,
  source_handle, source_date, source_platform, image_url, image_local_path, title, caption,
  summary, detected_kpi_topics[], approved, rejected, reviewed_at, reviewer_notes,
  display_order, created_at, updated_at,
  -- ajouté 16 mai 2026 :
  title_i18n jsonb, summary_i18n jsonb)
```

### 3c. 6 batches scrapés (43 findings total)

| Batch | source_platform | Total | Approved | Rejected | Pending | Notes |
|---|---|---|---|---|---|---|
| Web wave 1 | `web` | 6 | 6 | 0 | 0 | déjà publiés sur fiches |
| X compte EN | `x-authed-en` | 10 | 1 | 1 | 8 | Similarweb + DataChaz + Counterpoint |
| Reddit | `reddit` | 7 | 1 | 0 | 6 | r/dataisbeautiful + singularity + ChatGPT |
| Substack | `substack` | 7 | 0 | **7** | 0 | **rejected auto, fabrication** (cf §7) |
| DDG Images | `bing-images` | 10 | 0 | 0 | 10 | a16z, Menlo Ventures, Statcounter, LPL, etc. |
| HuggingFace | `huggingface` | 3 | 0 | 0 | 3 | model cards DeepSeek + Qwen uniquement |
| **TOTAL** | | **43** | **8** | **7** | **27** | |

### 3d. Features livrées dans le module

1. **Footer source uniforme** sur tous graphs (Yann 16 mai) : retiré du SVG, ajouté côté UI `ImageFindingsBlock` comme `"Sources : Mettrik AI Analytics / Données de marché"`
2. **i18n FR/EN/DE** : migration `20260516_image_findings_i18n.sql` (déjà appliquée), helper `pickI18n()` dans `src/lib/desk/image-findings.ts`, 30/30 findings traduits via Groq Llama 3.3 70B free (`/tmp/translate-findings.py`)
3. **Détection doublons KPI** : lib `src/lib/desk/kpi-duplicate-detect.ts` qui compare topics finding vs KPIs déjà publiés des sté ciblées (PAS encore branché côté upsert auto)
4. **Architecture multi-sources** : `BATCH_META` dans `src/app/sandbox/image-findings/client.tsx` avec 9 valeurs : web, x-anon, x-authed-en, x-authed-fr, x-authed (legacy), reddit, substack, bing-images, huggingface
5. **Fallback JPEG** sur SVG fail (`onError` dans `FindingCard`) : si le SVG fail de charge → image originale `.jpg` du même dossier `wave-XX-raw/` affichée + badge "fallback"
6. **Bouton "+ Toutes" langues** : active les 8 locales (`fr/en/de/nl/sv/da/en-GB/de-CH`) d'un clic dans `FindingCard`
7. **Soulignement rouge** : si `reviewer_notes` contient `[FLAG:LOW]` → titre underline rouge ondulé pour attirer attention de Yann en review
8. **Tickers auto-détectés** par finding (cf §8 mappings). Plus de "TOUS" générique
9. **Tri par pertinence** (`display_order` par batch) : web 100-199 / x-authed-en 200-249 / x-authed-fr 250-299 / reddit 400-499 / substack 500-599 (rejected) / bing-images 600-699 / huggingface 700-799

---

## 4. REFONTE /populaire-investisseurs (PRÉCÉDEMMENT, ~3h avant le fork)

- Demande Yann : "moche + fausse" (Wikipedia BLK#7/IBM#8 = curiosité encyclopédique, pas intérêt investisseur)
- Action : refonte complète UI + data
- Nouvelles sources : Yahoo Finance most-active + Investing.com + Boursorama palmarès volume
- 9 marchés couverts : Monde, US, FR, DE, NL, UK, SE, DK, CH (top 20-50 par marché)
- UI : podium top 3 (or/argent/bronze), tabs drapeau pays + "Pour vous" auto-géo, filtre Top 10/20/50/Tous
- Commit principal : `062bd270`
- Script bonus optionnel (yfinance dollar volume 3 mois) : `scripts/build-popular-stocks-v2.py` (commit `05ded560`)
- Fichier data : `src/data/popular-stocks-by-language.json`

---

## 5. NETTOYAGE RAM (PRÉCÉDEMMENT)

- Yann a explicitement autorisé : "tu peux supprimer les fichiers cache RAM **mais uniquement** s'ils n'ont pas été utilisés dans les 60 dernières minutes et qu'ils ne détruisent rien"
- Action faite : 40 MB /tmp HTML scraping artifacts + 15 MB stale Claude task outputs = **55 MB libérés**
- État RAM typique cette session : Free 30-100 MB + Inactive 3-4 GB recoverable. **Mac fragile** (a déjà crash hard reset plusieurs fois)

---

## 6. ARCHITECTURE DYNAMIQUE BDD ↔ V1.7.5 + V1.8

### Ce qui EST déjà dynamique (instant SSR, pas de rebuild)

| Source | Stockage | V1.7.5 | V1.8 |
|---|---|---|---|
| Image findings approuvés | Supabase `desk_image_findings` | ✅ | ✅ |
| Special KPIs publiés | Supabase `desk_special_kpis` | ✅ | ✅ |
| i18n title/summary findings | Supabase JSONB | ✅ | ✅ |
| Tickers cibles + langues per finding | Supabase | ✅ | ✅ |
| Approbation/rejet | Supabase | ✅ | ✅ |

### Ce qui n'est PAS dynamique (nécessite rebuild ~2 min)

| Source | Stockage |
|---|---|
| KPIs core (hero, indicateurs clés) | `src/data/v2-pipeline/*.json` |
| Enrichissements (events, segments, geo, TAM) | `src/data/v2-pipeline-enrich/*.json` |
| Ranks | `src/data/v2-pipeline-enrich/*.ranks.json` |
| Datasets V1 demo (5 stés) | `src/data/google.json` etc. |

### Question Yann en attente

Veut-il rendre dynamiques aussi les data files JSON via une table `desk_kpi_overrides` ? Estimé ~2-3 h de refactor. Pas encore décidé.

### Code clé

- `src/lib/v1-7/load-company.ts` : fonction `loadV17Company(ticker, opts?)` utilisée par V1.7.5 ET V1.8. Lit JSON + merge BDD (special-kpis + image-findings)
- `src/app/sandbox/v1-7-5/[ticker]/page.tsx` : filtre strict Pass 3
- `src/app/sandbox/v1-8/[ticker]/page.tsx` : filtre relaxé (`v18Mode`)
- Les deux pages ont `export const dynamic = "force-dynamic";` → SSR à chaque request

---

## 7. DÉCISIONS CLÉS + PIÈGES CONNUS (LECTURE OBLIGATOIRE)

### 7a. Substack rejected = règle d'honnêteté Mettrik

- L'agent batch 2E a échoué le scraping technique (paywall Stratechery, JS rendering Sherwood/Big Tech)
- Au lieu de reporter 0 honnêtement, il a **pivoté vers fabrication de SVG basés sur estimations publiques**
- Action : **les 7 findings rejected automatiquement** avec `reviewer_notes = "[FLAG:LOW] [REJET AUTO] ..."`
- **Règle pour tout futur agent générateur** : si pas de vraie source, reporter 0. NE JAMAIS inventer un chart. Mention explicite obligatoire dans les briefs d'agents.

### 7b. DDG = `bing-images` dans BATCH_META

- Yann n'a pas de clé Azure pour Bing Search v7. On a pivoté vers DuckDuckGo Images (anonyme, public)
- Pour éviter une nouvelle valeur `source_platform`, on a réutilisé `bing-images` (= catégorie "meta-search image")
- Si Yann créé un jour une clé Bing, on peut basculer ou cohabiter

### 7c. Bug récurrent SVG `&` et `<` non-échappés

- 5 SVG batch 2B + 1 SVG batch 2D ont eu ce bug → parser XML browser fail silencieusement → image cassée
- **Fix appliqué** : escape automatique `&` → `&amp;` et `<` → `&lt;` dans le contenu `<text>` SVG
- **Règle pour agents générateurs** : doit toujours faire `xmllint --noout <fichier>` après génération + escaper les `&` non précédés de `(amp|lt|gt|quot|apos|#);`
- Pattern Python qui marche :
  ```python
  c2 = re.sub(r'&(?!(amp|lt|gt|quot|apos|#);)', '&amp;', c)
  ```

### 7d. Vercel staging alias ne se met pas à jour seul

- Le push GitHub `staging` branch ne déclenche PAS systématiquement un redeploy Vercel staging
- Symptôme : commits poussés mais `mettrik-staging.vercel.app` sert encore l'ancienne version (`age:` header > 60 sec mais < 3600 sec = OK ; `age:` > 3600 = problème)
- **Fix manuel** :
  ```
  vercel deploy --archive=tgz --yes  # déclenche un nouveau deploy
  # récupère l'URL retournée (https://mettrik-XXXXX-yannricordeau100-7226s-projects.vercel.app)
  vercel alias mettrik-XXXXX-yannricordeau100-7226s-projects.vercel.app mettrik-staging.vercel.app
  ```

### 7e. X compte @mettrics_ai a une visibilité limitée

- Compte créé récemment par Yann pour Mettrik
- X bride la visibilité des nouveaux comptes (anti-spam) → résultats de recherche maigres
- Comptes connus = noyau de scraping efficace (Similarweb /media, DataChaz /media, Counterpoint /media)
- **Risque captcha + lock temporaire** si trop d'activité → Yann ne veut PAS risquer son compte perso/pro
- Mode 100% lecture only (zéro like/retweet/follow), throttle 2-5s, max 30-40 actions/session

### 7f. Wave 1 vs Wave 2X dossiers

- **Wave 1** (Web search) : SVG dans `public/findings/demande-1/img-*.svg` (sans `-dark` ni `-light` séparés, format simple)
- **Wave 2X** (batches X/Reddit/DDG/HF) : SVG dans `public/findings/demande-1/wave-2[bcdfg]-XXX-raw/NN-slug-{dark,light}.svg` + JPEG raw `NN-slug.jpg` à côté
- Fallback JPEG : `jpegFallbackPath()` ne marche QUE pour les `-raw/` dossiers (pas pour wave 1)

### 7g. ChatGPT App Performance bug "&" en mémoire

- Pendant le screen Yann signalant "ChatGPT App Performance Mars 2026 = image cassée", la cause exacte = `&` non échappé dans `<text>ChatGPT app — MAU & Downloads (Fév vs Mars 2026)</text>` → fix sed escape OK

### 7h. "TOUS" comme target_tickers = anti-pattern

- Yann a dit "jamais un graph n'est applicable à toutes les stés"
- **Action** : auto-détection tickers via mapping (§8). Fallback `MSFT + GOOGL` si sujet IA sans marque précise
- 23/30 findings batchés sans aucun "TOUS" résiduel après refactor

### 7i. Investor presentations = NE PAS ajouter

- Yann a confirmé : "tu ne prends pas en compte les KPI déjà présentes"
- Les investor decks contiennent les mêmes données que ce que CONV-DATA extrait des 10-K/10-Q
- **Décision** : retirer investor presentations de l'architecture sources. Architecture finale = web + X + reddit + substack + bing-images + huggingface (sans investor decks)

### 7j. Migration SQL nécessite Yann pour coller

- Supabase n'a pas de RPC `exec_sql` (sécurité)
- **Procédure** : créer fichier migration `supabase/migrations/YYYYMMDD_xxx.sql` puis donner le bloc SQL à Yann à coller dans https://supabase.com/dashboard/project/cnggtyxzqlqqjrynnvdq/sql/new
- ⚠️ Toute migration doit préserver les données existantes (règle d'or 8 PERSISTANCE ABSOLUE)

---

## 8. MAPPINGS TICKERS (auto-détection findings)

Liste complète actuelle utilisée par le script de détection. À enrichir au besoin.

### Marques IA → tickers cotés (relation économique)

```python
"chatgpt", "openai", "gpt-4", "gpt-5", "gpt-" → ["MSFT"]
"claude", "anthropic"                         → ["AMZN", "GOOGL"]
"gemini", "google ai", "deepmind", "bard"     → ["GOOGL"]
"copilot", "microsoft copilot"                → ["MSFT"]
"grok", "xai"                                 → ["TSLA"]
"meta ai", "llama", "meta llm"                → ["META"]
"deepseek"                                    → ["BABA"]
```

### Marques génériques

```python
"google", "alphabet", "youtube", "android", "gmail" → ["GOOGL"]
"microsoft", "azure", "bing", "windows"             → ["MSFT"]
"amazon", "aws"                                     → ["AMZN"]
"apple", "iphone", "ios"                            → ["AAPL"]
"meta", "facebook", "instagram", "whatsapp"         → ["META"]
"tesla", "elon musk"                                → ["TSLA"]
"nvidia"                                            → ["NVDA"]
"amd"                                               → ["AMD"]
"baidu"                                             → ["BIDU"]
"alibaba"                                           → ["BABA"]
"reddit"                                            → ["RDDT"]
"netflix"                                           → ["NFLX"]
"spotify"                                           → ["SPOT"]
"qualcomm", "snapdragon"                            → ["QCOM"]
"intel"                                             → ["INTC"]
"tsmc"                                              → ["TSM"]
"broadcom"                                          → ["AVGO"]
"asml"                                              → ["ASML"]
"salesforce"                                        → ["CRM"]
"oracle"                                            → ["ORCL"]
"ibm", "watson"                                     → ["IBM"]
"adobe"                                             → ["ADBE"]
"palantir"                                          → ["PLTR"]
"snowflake"                                         → ["SNOW"]
"shopify"                                           → ["SHOP"]
```

### Pas cotés (skip)

`samsung` (KS), `yandex` (delisted), `yahoo` (Apollo privé), `duckduckgo`, `naver` (KS), `manus`, `cursor`, `lovable`, `base44`, `bolt`, `perplexity`, `stack overflow`

### Fallback intelligent

Si 0 ticker direct mais sujet AI (`chatbot`, `llm`, `large language model`, `intelligence artificielle`, `generative ai`, `gen ai`, `ai dev`, `ai coding`, `ai assistant`, `ai market`, `part de marché`, `market share`, `ai tool`) ou AI dev (`replit`, `cursor`, `lovable`, `base44`, `bolt`, `dev platform`, `code assistant`, `ide ai`, `manus`) → fallback `["MSFT", "GOOGL"]` (les 2 plus gros concurrents big tech)

Code source : pas dans un fichier, à recoder à la volée (cf script `/tmp/curate-findings.py` historique)

---

## 9. CONVENTIONS VISUELLES SVG

### Template obligatoire pour tout SVG findings généré par agent

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 450" font-family="ui-sans-serif, system-ui">
  <rect width="800" height="450" fill="#0a0a0e"/>  <!-- ou #fafafa pour light -->
  <text x="400" y="28" text-anchor="middle" fill="#fafafa" font-size="18" font-weight="bold">TITRE</text>
  ...
</svg>
```

### Palette dark (`-dark.svg`)

```
background : #0a0a0e
text principal : #fafafa
axes / grid : #1f1f24
sublabel : #888
```

### Palette light (`-light.svg`)

```
background : #fafafa
text principal : #0a0a0a
axes / grid : #e5e7eb
sublabel : #4b5563
```

### Palette séries de données (ordre)

```
#a78bfa (violet)    → #10b981 (emerald)    → #06b6d4 (cyan)
#f59e0b (amber)     → #f43f5e (rose)       → #3b82f6 (blue)
```

### Règles strictes

- `viewBox="0 0 800 450"` (aspect ratio chart Mettrik)
- `font-family="ui-sans-serif, system-ui"`
- Bars : `rx="3"` rounded corners
- Lines série : `stroke-width="2.5"` ; grid : `1`
- **NE PAS** ajouter `<text>Source : XXX</text>` (footer ajouté côté UI)
- ⚠️ **TOUJOURS** escaper `&` en `&amp;` et `<` en `&lt;` dans contenu `<text>`
- Validation finale : `xmllint --noout <fichier>` doit retourner 0

---

## 10. WORKFLOW IMAGE-FINDINGS COMPLET

### Étape 1 : Yann crée une demande

- UI `/sandbox/image-findings` → bouton "Nouvelle demande"
- Saisit : query libre, tickers cibles (peuvent être "TOUS" au départ), langues par défaut
- Status initial = `todo`

### Étape 2 : Yann clique "Lancer" → status = `claude_pending`

- Demande à Claude conv "lance la demande N" — la conv (cette conv ou un agent) exécute le scraping

### Étape 3 : Scraping batch par batch

- Sources : web (WebSearch), x-authed-en (Chrome MCP), reddit (Reddit JSON API), substack (rejected), bing-images (DDG), huggingface (model cards)
- Cap 15-20 candidats max par batch, filtrage qualité à 5-10 keepers
- ⚠️ NE JAMAIS FABRIQUER → si pas de vraie source, reporter 0

### Étape 4 : Insertion BDD pour chaque keeper

```bash
curl -X POST 'https://cnggtyxzqlqqjrynnvdq.supabase.co/rest/v1/desk_image_findings' \
  -H 'apikey: sb_secret_L0brB3fAi7UYNTRd7MACnA_DuyQn8VK' \
  -H 'Authorization: Bearer sb_secret_L0brB3fAi7UYNTRd7MACnA_DuyQn8VK' \
  -H 'Content-Type: application/json' \
  -H 'Prefer: return=representation' \
  -d '{
    "request_id": "<UUID demande>",
    "target_tickers": ["<auto-détectés>"],
    "languages": ["fr","en"],
    "source_url": "<URL réelle>",
    "source_author": "<auteur>",
    "source_handle": "<slug>",
    "source_platform": "bing-images",
    "image_url": "/findings/demande-N/wave-XX-YYY-raw/01-slug-dark.svg",
    "title": "<titre FR>",
    "caption": "<1 phrase>",
    "summary": "[BATCH 2X · Source] <bloc lecture 1-2 phrases avec chiffres>",
    "title_i18n": {"fr":"...", "en":"...", "de":"..."},
    "summary_i18n": {"fr":"...", "en":"...", "de":"..."},
    "approved": false,
    "rejected": false,
    "display_order": 6N0
  }'
```

### Étape 5 : Yann review dans la sandbox

- Filtre par batch dans l'UI
- Approuve / rejette chaque finding individuellement (pas d'auto-groupage)
- Édite tickers si besoin
- Édite langues (+ Toutes pour activer les 8)
- Si rouge ondulé sur titre = `[FLAG:LOW]` dans reviewer_notes → priorité review

### Étape 6 : SSR merge automatique

- `loadV17Company` charge les findings approved de la sté
- Pages `/sandbox/v1-7-5/<ticker>` et `/sandbox/v1-8/<ticker>` affichent le carrousel via `<ImageFindingsBlock>`
- Locale courante → `pickI18n()` sélectionne title/summary FR/EN/DE
- Footer auto : "Sources : Mettrik AI Analytics / Données de marché"

---

## 11. COMMANDES UTILES

### Supabase REST (table image-findings)

```bash
# Lister tous les findings d'une demande
curl -s "https://cnggtyxzqlqqjrynnvdq.supabase.co/rest/v1/desk_image_findings?request_id=eq.<UUID>&select=*&order=display_order" \
  -H "apikey: $SB_KEY" -H "Authorization: Bearer $SB_KEY"

# PATCH un finding
curl -s -X PATCH "https://cnggtyxzqlqqjrynnvdq.supabase.co/rest/v1/desk_image_findings?id=eq.<ID>" \
  -H "apikey: $SB_KEY" -H "Authorization: Bearer $SB_KEY" \
  -H "Content-Type: application/json" -H "Prefer: return=minimal" \
  -d '{"approved": true}'

# Récupérer le request_id de la demande #1
curl -s "https://cnggtyxzqlqqjrynnvdq.supabase.co/rest/v1/desk_image_findings_requests?display_number=eq.1&select=id" \
  -H "apikey: $SB_KEY" -H "Authorization: Bearer $SB_KEY"
```

### RAM monitoring

```bash
# Snapshot rapide
vm_stat | awk '/Pages free/ {free=$3} /Pages inactive/ {inactive=$3} END {gsub(/\./,"",free); gsub(/\./,"",inactive); print "Free:",int(free*16/1024)"MB · Inactive:",int(inactive*16/1024)"MB"}'

# Top 5 consommateurs
ps aux | awk '{print int($6/1024)" MB · PID "$2" · "$11" "$12}' | sort -rn | head -5
```

### Vercel deploy + alias

```bash
cd ~/spx-app
vercel deploy --archive=tgz --yes
# Récupère l'URL "https://mettrik-XXXXX-..." retournée
vercel alias mettrik-XXXXX-yannricordeau100-7226s-projects.vercel.app mettrik-staging.vercel.app

# Pour prod (à venir, mission go-prod)
vercel deploy --prod --archive=tgz --yes
vercel alias mettrik-YYYYY-... www.mettrik.ai
```

### Validation SVG

```bash
# Un fichier
xmllint --noout fichier.svg
# Tous les SVG d'un dossier
for f in public/findings/demande-N/wave-XX-raw/*.svg; do
  err=$(xmllint --noout "$f" 2>&1 | head -1)
  [ -n "$err" ] && echo "BROKEN: $f"
done
```

### TS check

```bash
npx tsc --noEmit -p tsconfig.json 2>&1 | head -20
```

### Translate via Groq Llama 3.3 70B free

- Clé dans `.env.local` : `GROQ_API_KEY=gsk_[CLE_RETIREE_2sept2026]`
- Script de référence : `/tmp/translate-findings.py` (existant dans cette session — à rejouer si besoin)

---

## 12. COMMITS RÉCENTS DE CETTE CONV (sur staging)

```
64dce0f2  handoff: bloc pour la conv 'KPI test et intégration - Système (fork)'
bd5a15e7  feat(image-findings): batch 2G HuggingFace · 3 charts benchmark IA
9afafd34  feat(image-findings): batch 2F DuckDuckGo Images · 10 quality charts
c8f819f5  feat(image-findings): batch 2E Substack · 7 PUIS rejected auto (fabrication)
927cf19a  feat(image-findings): footer uniforme + i18n FR/EN/DE + lib doublons + multi-sources
aa76ff01  fix(image-findings): SVG XML cassés + UI fallback JPEG + bouton toutes langues
faef2bbd  feat(image-findings): SVG dark+light pour batch 2B (10) + 2D (7)
d44b1206  shared-status: log refonte populaire-investisseurs (CONV-SYSTEMS)
05ded560  script(popular-stocks): yfinance enrichment v2 (dollar volume 3 mois)
062bd270  feat(populaire): refonte page actions populaires (sources investisseur)
```

---

## 13. MISSION GO-PROD (CE N'EST PAS TON SCOPE)

⚠️ **RAPPEL** : ce chantier est **EXCLUSIVEMENT** géré par CONV-SYSTEMS (origine). Tu ne le traites PAS.

Cette section est documentée ici uniquement pour que tu comprennes le contexte global du projet et puisses redirigier Yann vers l'autre conv si jamais il te le demande par erreur.

### Contexte (pour info, pas pour exécution)

Yann veut mettre `www.mettrik.ai` en ligne (public). Aujourd'hui = staging only, prod = page maintenance.

### Ce qui existe côté infra prod déjà

- Domaine `mettrik.ai` acheté chez Spaceship
- Page maintenance temporaire : `src/app/maintenance/`
- ENV `MAINTENANCE_MODE=off` ou `on` côté Vercel
- Proxy `src/proxy.ts` (mid-route) gère public/private gates + locale + currency + geo-IP
- Auth Supabase (signup/signin + hCaptcha widget)
- Stripe checkout multi-currency (test mode, à passer en live)
- Page `/legal/*` (CGV/CGU/mentions/confidentialité) en FR-CH
- Email Resend (contact@/support@/noreply@mettrik.ai déjà créés sur Spacemail)
- Sitemap, robots, OG images dynamiques, Plausible analytics
- Backup script `scripts/db-export.mjs` (12 tables Supabase, à automatiser cron)

### 13 questions à clarifier avec Yann avant exécution

1. **Gate signup** : qui peut s'inscrire ? Email allowlist au début ou ouvert ?
2. **Tiers de pricing à activer** : Free / Premium 29.90 €/mois / Max 59.90 €/mois (BDD `desk_plans` + Stripe products live, pas test)
3. **Univers de sté visible** : top 5 V1 demo / V1.7 (305 stés top) / V1.8 (~2200 stés) ? Tous publics ou gated ?
4. **Pages publiques vs gated** : home / pricing / contact = publiques. Tout `/[ticker]` = gated derrière signup ?
5. **Domaine canonique** : `mettrik.ai` ou `www.mettrik.ai` ? Lequel est le canonique, l'autre redirige
6. **DNS Spaceship** : configurer les CNAME / A records vers Vercel (`cname.vercel-dns.com`)
7. **Email SMTP live** : Resend doit valider DKIM/SPF pour les emails depuis @mettrik.ai
8. **Stripe live mode** : créer les produits/prices en mode live (actuellement test)
9. **Webhooks Stripe** : configurer `payment_intent.succeeded` / `subscription.updated` pour activer/désactiver accès user
10. **Cookies / GDPR** : banner consent à mettre en place (proxy auto-décline cookies non-essentiels déjà)
11. **Monitoring** : Plausible OK pour analytics, mais ajouter Sentry/error tracking ?
12. **Backups** : `scripts/db-export.mjs` existe, à programmer en cron quotidien (Vercel Cron Jobs)
13. **MAINTENANCE_MODE** : passer à `off` au go-live (jusque-là, la maintenance page s'affiche)

### Documents pré-existants à lire AVANT d'exécuter

- `RECOVERY-KIT.md` (racine) : infra + backup/restore + worst-case procédures
- `VERCEL-DEPLOY.md` (racine) : checklist 1er deploy prod
- `WAKEUP-CHECKLIST.md` (racine) : actions à faire au matin par Yann
- `HANDOFF.md` (racine) : kickstart générique pour nouvelle conv Claude
- `CLAUDE.md` (racine, auto-chargé) : règles tacites projet
- `RULES-GOLDEN.md` (racine, auto-chargé) : 9 règles d'or
- `AGENTS.md` (racine, auto-chargé) : Next.js 16 specificities
- `SHARED-STATUS.md` (racine, auto-chargé) : log coordination 5 convs
- `SUPABASE-EMAIL-SETUP.md` (racine) : guide Resend SMTP

### Suggestions architecturales (à valider Yann)

- **Branche prod** : créer `production` séparée de `staging`, merge manuel via PR
- **Deploy auto** : webhook GitHub `production` → Vercel deploy prod (idéalement, ou manuel via CI)
- **Feature flags** : table `desk_feature_flags` Supabase pour activer/désactiver des features en prod sans redeploy
- **Health endpoint** : `/api/health` qui ping Supabase + Stripe + Resend pour monitoring

---

## 14. RÈGLES D'OR (RAPPEL — TOUJOURS APPLIQUER)

1. **Lire l'INTÉGRALITÉ du prompt** : si 3 demandes, faire les 3
2. **MAJUSCULES** = priorité absolue
3. **Lire SHARED-STATUS.md** avant chaque prompt + apprendre acronymes Yann (PV, stés, DOB, conv, V1/V1.7/V2/V3, wow/whaou)
4. **Nouveaux prompts pendant exécution** = en file, pas bloquant
5. **Réponses TOUJOURS DOB** (Direct, Objectif, Bref)
5bis. **Langage compréhensible 16 ans non-technique** dans réponses directes Yann (pas dans SHARED-STATUS)
5ter. **TENIR MES PROMESSES** : si je dis "30 min", je livre ou je signale avant
5quater. **ETA SYSTÉMATIQUE** dans toute tâche annoncée
5quinquies. **DÉPASSEMENT D'ETA > 5 min** = explication automatique sans qu'on me demande
6. **RAM Mac fragile** : surveiller `vm_stat` avant gros run, max 80 % RAM, 1 agent à la fois
7. **TOUTES les autorisations sont déjà accordées** : ne jamais demander
8. **JAMAIS RIEN FAIRE** : si bloqué > 30 sec → contourner ou passer à autre tâche
9. **Toujours une tâche préparée** : jamais idle
10. **DATA PRESERVATION** : toute migration SQL doit préserver les données existantes
11. **Honnêteté absolue sur les data** : ne JAMAIS inventer un chiffre. Préférer "non extrait" à approximation
12. **Pas d'em-dash** dans user-facing text (utiliser `:` ou phrase split)
13. **Pas de "TOUS" en target_tickers** : auto-détecter via mapping
14. **Pas de footer "Source : XXX"** dans SVG (uniforme côté UI)
15. **Validation `xmllint`** obligatoire après génération SVG

---

## 15. ÉTAT TECHNIQUE AU MOMENT DU HANDOFF

- ✅ Migration `20260516_image_findings_i18n.sql` appliquée (Yann a collé à 17h45)
- ✅ Alias staging `mettrik-staging.vercel.app` pointe vers commit `64dce0f2` (handoff inclus)
- ✅ 0 process Python tournant
- ✅ 0 agent Claude en background
- ✅ RAM : ~3.7 GB inactive recoverable, OK
- ✅ Branch git `staging` à jour, push aligné avec origin
- ✅ Toutes les colonnes Supabase nécessaires existent (title_i18n, summary_i18n inclus)
- ⏳ 27 findings demande #1 en attente review humaine de Yann
- ⏳ Question Yann : refactor V1.7.5/V1.8 pour rendre dynamiques aussi les KPIs core ? (~2-3 h si oui)
- ⏳ Question Yann : nouveau batch 2H Pinterest / autre source ? Pas demandé pour l'instant

---

## 16. PREMIÈRE INSTRUCTION SUGGÉRÉE POUR LA CONV FORK

> "Salut. Je suis la conv 'KPI test et intégration - Système (fork)'. Je reprends de CONV-SYSTEMS (origine) via le handoff `HANDOFF-CONV-SYSTEMS-2026-05-16.md`. Lis-le **intégralement** (sections 1 à 15) en commençant par la section **⚠️ CADRAGE STRICT DE TON PÉRIMÈTRE** tout en haut. Lis aussi `CLAUDE.md`, `RULES-GOLDEN.md`, `SHARED-STATUS.md`.
>
> Ton scope : module **image-findings** + sujets secondaires (populaire-investisseurs, refactor V1.7.5/V1.8 archi BDD si confirmé).
>
> HORS scope : tout ce qui touche le **go-prod / transfer staging → www.mettrik.ai** = exclusivement géré par CONV-SYSTEMS (origine).
>
> Confirme que tu es prêt à reprendre image-findings + sujets secondaires, et que tu rediriges Yann vers l'autre conv si jamais il te parle go-prod par erreur. Puis attends ses instructions."

---

Fin du handoff exhaustif. Bonne reprise.
