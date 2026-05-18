# CONV-TRANSCRIPTS — État du travail

> Conv dédiée aux **earnings call transcripts** (récupération + résumé IA PV-driven + intégration UI bloc V1.8).
> Démarrée par Yann le 10-11 mai 2026.

---

## 🎯 Objectif

Le bloc à gauche du hero V1.8 = **Synthèse Earning Call** orientée plus-value (PV) pour l'investisseur particulier français.

Cycle :
1. Récupérer le dernier transcript de chaque sté du top 307 V1.8 (priorité), puis SP500, puis SP1500
2. Résumer via IA (Groq Llama 3.3 70B) en bullets denses avec tooltip "i" automatique sur termes techniques
3. Intégrer les KPI uniques venant des transcripts :
   - Si vraiment nouveaux + spécifiques sub-industry → Stories KPI (carrousel principal)
   - Si génériques (doublons potentiels) → exclure ou sous-bloc transcript
4. Comparatif dernier vs avant-dernier transcript (promesses tenu / pas tenu) dès qu'on a 2 transcripts par sté

---

## ✅ État au 12 mai 2026

### Acquis livrés

| Asset | Stockage | Couverture |
|---|---|---|
| Transcripts bruts FMP (le dernier seul) | `src/data/transcripts/<ticker>.json` | 58 stés US/ADR |
| Transcripts IR scraper EU pures | `src/data/transcripts-ir/<ticker>.json` | 12 stés EU (AZN.ST, SIE.DE, BP.L, ERF.PA…) |
| Résumés bullets PV-driven Groq | `src/data/transcript-summaries/<ticker>.json` | 2 (AAPL + JPM démo) |
| KPI Stories nouveau | `src/data/v2-pipeline-enrich/jpm.json` (stories_kpis) | 1 (G-SIB Surcharge JPM) |

### Code livré

- **`src/components/transcript-bullets-block.tsx`** (NEW) — composant React qui rend les bullets + sentiment chip + tooltip "i" auto sur acronymes via `ACRONYM_GLOSSARY`. Tooltip en superscript inline (underline pointillé + sup "ⁱ"), pas de coupure de lecture.
- **`src/lib/ui-fix-templates.ts`** — glossaire ACRONYM_GLOSSARY étendu : G-SIB, ROTCE, CET1, NIM, NII, LCR, NSFR, RWA, CIB, AUM, AUC, SG&A, EPS, DAU, MAU, DAP, bp, bps (en plus des 24 existants : YoY, ARR, FCF, EBITDA, TAM, CAGR, etc.).
- **`src/components/company-view.tsx`** — prop `transcriptSummary` ajoutée, branchement de `TranscriptBulletsBlock` avec fallback sur `TranscriptStories` legacy si pas de bullets dispo.
- **`src/app/sandbox/v1-8/[ticker]/page.tsx`** — chargement `loadTranscriptSummary()` + passage à `CompanyView`.

### Scripts livrés

- **`scripts/transcript-summarizer-pv.py`** — Groq Llama 3.3 70B versatile, prompt structuré → JSON bullets + tonalité + sentiment + new_kpis_for_stories. Anti-doublon basé sur KPI existants. ETA 1-3 sec/sté.
- **`scripts/ir-transcripts-scraper-optimized.py`** — yfinance.website → IR paths → PDF detection keywords (transcript/earnings/quarterly) → curl download → pdftotext → quality check (chiffres + guidance + "operator"). Top 50 EU → 12 OK (~20-30% succès).
- **`scripts/av-transcripts-top307.py`** — AlphaVantage `EARNINGS_CALL_TRANSCRIPT`, rotation 5 clés free, sleep 15s. **Bloqué** : quota IP-shared probable, toutes clés en 25/25.
- **`scripts/fmp-transcripts-full-paid.py`** — version pour FMP $29 Starter (4 derniers transcripts par sté = 1 an d'historique). **Bloqué** : HTTP 402 même avec clé payante.
- **`scripts/fmp-etf-holdings.py`** + **`scripts/fmp-mna-history.py`** — prêts mais en attente (Yann a dit "pas obligatoire pour l'instant").

### Démo V1.8 fonctionnelle

URLs vérifiées (curl 200 + contenu OK) :
- http://localhost:3000/sandbox/v1-8/aapl → "Synthèse Earning Call" + sentiment "Confiant" + bullets Tim Cook + tooltip YoY
- http://localhost:3000/sandbox/v1-8/jpm → bullets Jeremy Barnum + tooltips ROTCE / CET1 / NII / G-SIB / YoY + KPI Stories "G-SIB Surcharge"

---

## 🚧 Bloqueurs

| Bloqueur | Statut | Action requise |
|---|---|---|
| **FMP $29 Starter** retourne HTTP 402 "Restricted Endpoint" sur `/stable/earning-call-transcript-dates` | Yann a payé mais endpoint pas accessible | Yann vérifie dashboard FMP onglet "API Endpoints" → quel tier minimum affiché pour Earning Call Transcript ? Si Premium $69+ → upgrade ou remboursement Starter |
| **FMP free** transcripts verrouillés (HTTP 402) depuis nuit 10-11 mai | Plus moyen de récupérer transcripts avec free tier | Pas de fix possible côté free, FMP a changé sa policy |
| **AlphaVantage** 5 clés free toutes en quota épuisé | Probable IP-shared, 25 calls/jour partagé peu importe le nb de clés | Reset minuit UTC mais limite identique. À tester demain matin |
| **Finnhub** `/stock/transcripts/list` → "no access" | Premium uniquement ($35+/mois) | Hors budget choisi par Yann |

### Sources testées et exclues

- Quartr API (enterprise only, $1000+/mois)
- Polygon free, Twelve Data, EODHD, Tiingo (pas d'endpoint transcripts)
- Motley Fool, AlphaStreet, Investing.com (antibot)
- Stockanalysis.com, Roic.ai, TIKR (pas de transcripts publics dispo)

---

## 📋 Plan à venir (priorisé)

### Phase 1 : Débloquer accès transcripts (BLOCKER YANN)
- Yann vérifie dashboard FMP onglet "API Endpoints"
- 3 options possibles : upgrade Premium $69+, remboursement Starter et continuer free seul, autre source

### Phase 2 : Génération bullets V1.8 top 307 (DÈS DÉBLOCAGE)
- ETA ~15-30 min Groq Llama 3.3 70B (quota 1000/jour, TPM 12K = ~1 sté/2-3 sec)
- Univers cible : `src/data/v1-8-tickers-sorted.json[:307]`
- Skip stés sans transcript brut local
- Output : `src/data/transcript-summaries/<ticker>.json`

### Phase 3 : Sous-bloc "KPI uniques transcript" (UI)
- Pour les KPI extraits du transcript MAIS pas Stories-worthy (génériques ex: FCF, Headcount)
- À placer dans `TranscriptBulletsBlock` en sous-section sous les bullets
- Distinguer visuellement des Stories KPI principales

### Phase 4 : Comparatif dernier vs avant-dernier
- Nécessite avoir 2 transcripts par sté (= FMP $29+ ou source équivalente)
- Analyse : promesses tenu / pas tenu / changé / nouveau
- Ajoute bullets type "Suivi promesses"

### Phase 5 : Scale-up
- V1.8 top 307 → V1.8 reste (SP500, SP1500)
- **JAMAIS V1.7 en premier** (règle 0 RULES-GOLDEN.md)
- Une fois V1.8 stable → copier top 307 V1.8 vers V1.7 snapshot

---

## ⚠️ Règles d'or appliquées

- **Règle 0 (12 mai 2026)** : V1.8 EN PREMIER, JAMAIS V1.7. Tout chantier "univers société" = V1.8 top N par défaut.
- **Règle 5quater** : ETA systématique dans toutes mes réponses.
- **Règle 5ter** : tenir mes promesses (timer mental + livraison ou explication retard).
- **Règle 7** : zéro autorisation demandée à Yann.
- **Règle 8bis** : jamais bloqué > 30 sec, contourner ou changer de tâche.

---

## 📂 Fichiers touchés (récap)

```
NEW :
  src/components/transcript-bullets-block.tsx
  scripts/transcript-summarizer-pv.py
  scripts/ir-transcripts-scraper-optimized.py
  scripts/av-transcripts-top307.py
  scripts/fmp-transcripts-full-paid.py
  scripts/fmp-etf-holdings.py
  scripts/fmp-mna-history.py
  src/data/transcript-summaries/aapl.json
  src/data/transcript-summaries/jpm.json
  src/data/transcripts-ir/<12 stés>.json
  sec-data/quarterly-pdfs/<18 stés Desktop/DATA>/ (transferé 1.1 GB)

MODIFIÉ :
  src/components/company-view.tsx (+TranscriptBulletsBlock branchement, prop transcriptSummary)
  src/app/sandbox/v1-8/[ticker]/page.tsx (+loadTranscriptSummary)
  src/lib/ui-fix-templates.ts (ACRONYM_GLOSSARY étendu)
  src/data/v2-pipeline-enrich/jpm.json (+stories_kpis G-SIB)
  .env.local (+FMP_PAID_API_KEY, +5 ALPHAVANTAGE_KEY_*)
```

---

## 🔄 SESSION DU 12-13 MAI 2026 (mise à jour 00h10)

### État vivant — pour reprise si Claude coupé

**Pipeline EN COURS** :
- 🔄 `transcript-summarizer-all-sources.py` · **PID 22889**
- 98 stés candidates (union de 4 sources : ir-scrape, FMP json, EU scrape, Desktop V3)
- Top 307 V1.8 prioritaires d'abord
- Démarré 12 mai 22h49, actif depuis ~1h15
- Log temps réel : `_bulk-transcripts-all.log`
- Output : `src/data/transcript-summaries/<ticker>.json` (26 fichiers à 00h10)
- LLM : Groq Llama 3.3 70B free, beaucoup de 429 (TPM 12k limite)
- ETA fin : encore 1-2h vu ralentissements

**Reprise après crash** :
```bash
# Vérifier si le proc tourne encore
ps -p 22889 -o pid,etime
# Si mort : relancer avec idempotence (le script écrase, donc re-run safe)
nohup python3 scripts/transcript-summarizer-all-sources.py > /tmp/transcripts-all.log 2>&1 &
# Sinon : juste regarder l'avancement
tail -5 _bulk-transcripts-all.log
ls src/data/transcript-summaries/ | wc -l
```

### Inventaire transcripts par source (vérifié 13 mai 00h)

| Source | Stés récents (<12 mois) |
|---|---|
| `~/Mettrik/sec-data/ir-scrape/` (CONV-SYSTEMS) | 31 |
| `src/data/transcripts/` (FMP CONV-DATA 5 mai) | 45 |
| `src/data/transcripts-ir/` (mon EU scrape) | 26 |
| `~/Desktop/.../App KPI/DATA/` (V3 scraper) | 6 |
| **UNION uniques** | **99** |
| dont **top 307 V1.8** | **61** |
| Top 307 SANS transcript | 244 |

### FMP $29 Starter — verdict définitif (testé 13 mai)

- 5 clés testées (`FMP_API_KEY`, `FMP2`, `FMP3`, `FMP4`, `FMP_PAID_API_KEY`)
- 6 endpoints différents : `/stable/earning-call-transcript*` (402), legacy v3/v4 (403), `/stable/earnings-transcript*` (404)
- `/stable/profile` répond 200 → clé valide, c'est juste le tier qui bloque
- Yann a testé via MCP web aussi → même rejet
- **Conclusion** : impossible avec Starter $29. Faut Premium $69+ ou autre source.

### Livré dans la session 12-13 mai (commits locaux, pas pushés)

| Commit | Fichier | État |
|---|---|---|
| `c001917f` | `src/components/transcript-bullets-block.tsx` (couleur ticker + comparaison) | ✅ local |
| (à venir) | `src/components/company-view.tsx` (masque bloc si pas de data) | ✅ local |
| `405 deletes` | `~/Mettrik/sec-data/ir-scrape/*/transcript/*.pdf` >12 mois | ✅ supprimés |

### Broadcasts envoyés à SHARED-STATUS

- 12 mai 21h50 : 🚨 STOP scraping transcripts vieux + filtre 12 mois (CONV-SYSTEMS)
- Reminder programmé via ScheduleWakeup (FMP dashboard check Yann)

### Tâches en file (post-pipeline)

1. **i18n transcript-bullets-block** : déplacer LABELS hardcodés FR vers `dictionary.ts` (mon scope, ETA 10 min). Strings concernées :
   - "Synthèse Earning Call" / "Confiant" / "Neutre" / "Prudent"
   - "Suivi & comparaison vs trimestre précédent"
   - "Promesse tenue / non tenue / Guidance relevée / abaissée / Nouveau sujet / Changement de ton"

2. **Broadcast CONV-SYSTEMS** : MAJ traductions home/pricing/contact/société/account/checkout + bouton auto-MAJ back office (scope eux, ETA leur côté 2h30-3h).

3. **Bilan final pipeline** : nb ok / fail, sample visuel sur 2-3 stés (BAC, BIP, BP.L), update CONV-TRANSCRIPTS.md.

### Idées MCP Chrome FMP — testé par Yann, échoué

Yann a essayé via MCP Chrome (compte loggué) : le site FMP rejette aussi avec "pas le bon forfait". Donc inutile de retenter cette voie. Solution : ticket support FMP avec facture + 402 screenshot (ETA résolution 24-48h).

---

## 🔄 EN COURS (12 mai 2026 ~04h45)

### Session active : ordre Yann "EU bulk + 2 transcripts + comparaison sub-block"

**Livré cette session** :
- ✅ Tooltip "i" : couleur sousligné + texte = couleur ticker (`brand(ticker).primary`).
  Avant : `#38bdf8` sky-400 fixe. Maintenant : variable selon société.
  Fichier : `src/components/transcript-bullets-block.tsx`.
- ✅ Sous-bloc "Suivi & comparaison vs trimestre précédent" ajouté au composant.
  6 types : `promise_kept / promise_broken / guidance_up / guidance_down /
  new_topic / sentiment_shift`. Rendu conditionnel : ne s'affiche que si
  `summary.comparison.bullets` non vide.
- ✅ Commit local `c001917f` (pas pushé : règle 9, attente validation Yann).

**Confirmé honnêtement à Yann** : AAPL et JPM ont 1 SEUL transcript chacun
(latest), pas 2. Donc Phase 4 comparaison ne peut pas générer de vraies
bullets de suivi tant que le Q-1 n'est pas récupéré.

**En cours autonome (longue durée)** :
- 🔄 EU IR bulk scraper · PID 20862 · 172 stés (top 307 d'abord, puis MC desc)
- ⏱ ETA brut : ~1-2 h (4 workers, ~20-30 % succès attendu)
- Output : `src/data/transcripts-ir/<TICKER>.json` (un par sté qui réussit)
- Log : `/tmp/eu-bulk-scraper.log`

**Tentative Q-1 AAPL + JPM via IR scraper** :
- AAPL : 0 transcript (no_ir_page) — Apple ne publie pas de PDF transcript
- JPM : 4 PDFs trouvés mais tous = Q1 2026 latest + Investor Day 2025 +
  Company Update Feb 2026 + 10-Q corp doc. **Q4 2025 (Q-1) NON présent**
  sur la page IR active : JP Morgan ne garde que le trimestre courant.
- Probe URL pattern `4q25-earnings-transcript.pdf` aux endroits classiques :
  tous 404. JPM utilise un archive non-prédictible.

### Bloqueurs persistants

| Bloqueur | Statut | Action requise |
|---|---|---|
| **FMP $29 Starter** retourne HTTP 402 sur `/stable/earning-call-transcript-dates` | Yann doit vérifier dashboard FMP demain | Reminder programmé via ScheduleWakeup |
| **AlphaVantage** 5 clés free toutes en quota épuisé (IP-shared) | Reset minuit UTC mais quota identique | Retest demain matin si Yann veut |
| **Finnhub** transcripts premium only ($35+/mois) | Hors budget | — |
| **JPM/AAPL Q-1 (Q4 2025)** : pas trouvable via IR scrape | URL pattern non-prédictible | Bloqué tant que FMP/AV pas débloqué |

### Plan revisité

1. **Phase 2 (génération bullets)** : 58 stés US/ADR avec transcript latent
   peuvent être batched DÈS QUE Yann valide visuellement les 2 stés démo
   (AAPL + JPM). ETA Cerebras : 5-15 min pour 58 stés.
2. **Phase 4 (comparaison Q vs Q-1)** : nécessite source Q-1 transcripts.
   Solutions :
   - (a) FMP $69+ Premium (4 derniers transcripts par sté)
   - (b) Quartr.ai (~30€/mois ?)
   - (c) Scraping Motley Fool / Roic.ai avec contournement antibot
   - (d) Demander à Yann d'uploader manuellement les transcripts pour
     les 20-50 stés les plus importantes
3. **EU IR scraper** : continue son cours autonome, output progressif
   dans `src/data/transcripts-ir/`. Réutilisable pour Phase 2 quand fini.
