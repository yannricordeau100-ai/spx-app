# État CONV-CONCEPTS

> Périmètre : visuels, charts, mockups, `/concepts/*` hors mockups système.
> Fichiers : `src/app/concepts/`, `src/components/lab/`, `src/components/charts/`,
> `src/app/chart-lab/`, `src/components/company-view.tsx` (visuels).

> Mis à jour 13 mai 2026 ~02h10. Si Claude est coupé de force, RELIRE ce
> fichier AVANT la prochaine action. Reprendre où on en est sans re-questionner
> Yann.

## 🔄 EN COURS — 2026-05-13 ~02h10

**Deploy chain Vercel** (3 deploys empilés, le dernier doit aliaser staging) :
- `mettrik-hck6no3yl` ✅ Ready — fiscal calendar + Y-axis Millions/Milliards — commit `f74ce228`
- `mettrik-x2t8xudu3` ⏳ Building — fix label calendrier "Q2 2026" (pas "FY2026 Q2") — commit `69795c7e`
- `mettrik-lqoj5v0dl` ⏳ Queued — soulignement nom interlocuteur punchline + badge "Pourquoi utiliser Mettrik AI ?" top-border — commit `16db590d`

**Action à faire dès que les 3 sont Ready** :
```bash
vercel alias set https://mettrik-lqoj5v0dl-yannricordeau100-7226s-projects.vercel.app mettrik-staging.vercel.app
curl -sL https://mettrik-staging.vercel.app/ -H "cookie: NEXT_LOCALE=fr" | grep -o "Pourquoi utiliser" | head -1
```

## ✅ FAIT cette session (13 mai 2026, soirée 12→13)

### Chantier fiscal calendar (priorité 1, top 307 V1.8)
- `scripts/fiscal/audit-fiscal-top307.py` : pull SEC EDGAR submissions API.
  Sortie `src/data/fiscal-audit.json` avec 211 stés US (90 foreign skip,
  4 sans CIK).
- 62 stés à exercice décalé identifiées : MSFT (juin), AAPL (sept),
  NVDA (jan), ORCL (mai), AVGO (nov), V/QCOM (sept), COST/AZO (août),
  TGT/ROST (fév), HD/CRM/ADSK/KR (jan), etc.
- `src/lib/fiscal-calendar.ts` : `fiscalLabelsForTicker(ticker)` →
  `{ lastLabel: "FY26 Q3", publicationDate, nextLabel: "FY26 Q4", ... }`.
- `FreshnessIndicator` branché : MSFT affiche "FY26 Q3 (publié le 29 avril
  2026)" au lieu de calendrier trompeur.
- Paragraphe "~est. = estimation..." supprimé (plus utile avec SEC dates).
- `scripts/fiscal/update-data-from-sec-audit.py` créé. SES SORTIES (199
  v2-pipeline JSON modifiés) sont dans le working tree NON STAGED. Inutile
  de les pousser : FreshnessIndicator lit fiscal-audit.json directement.

### UI charts
- Y-axis monétaire : "$ en M/Mds" → **"$ en Millions/Milliards"**.
  Touché : curve-chart, bars-chart, bars-3d-variants.
- 3 photons lumineux glissent sur la courbe (SVG animateMotion + mpath, 4s cycle).
- chart-mini-logo : PNG `/brand-mini-logo.png` rendu transparent (luminance
  < 25 → alpha 0, conservé via PIL).

### Home punchline
- Rotation auto 6.5s → 10s → **15s** (Yann 3 itérations).
- Chevron flèche remplacé par **3 barres équaliseur** qui pulsent + label
  "suivant" mono uppercase.
- 3 ombres décalées 3/6/9px avec bordures intensifiées (/35 /25 /18).
- Effet 3D rotateX 6° + perspective 1200px + halo violet/cyan + catch light
  + inner/outer shadow.
- Swipe gauche actif sur mobile (touchHandlers).
- 1er italique de chaque part = nom interlocuteur, **souligné violet-400/70**.
- Badge **"Pourquoi utiliser Mettrik AI ?"** mono uppercase, gradient
  violet→cyan→violet, à cheval sur bordure haute du cadre.
- Variantes A/B/C explorées sur `/concepts/punchline-hint`.

### Search
- Compteur "X visibles · Y total" → **"Tape pour filtrer"**.

### Mobile
- `export const viewport` dans `layout.tsx` : device-width, theme-color
  `#06060a`, colorScheme dark.
- globals.css : tap-highlight violet subtle, input font-size 16px (no iOS
  zoom auto), safe-area utilities, respect `prefers-reduced-motion`.

### Data fix
- google.json hero Cloud : history fakes `[5.8..9.6]` → réels
  `[9.57, 10.35, 11.35, 11.96, 12.26, 13.62, 15.16, 17.66, 20.03]`
  (Q1 2024 → Q1 2026). YoY 22 % → **63.4 %**. Value 9.6 → **20.03 Mds $**.
  Source : ER ta lib + 10-Q SEC fraîchement téléchargé `goog-20260331.htm`.

## ⏳ EN ATTENTE DE GO YANN

Aucun blocage. Yann revoit staging quand le dernier deploy est aliasé.

## 🔮 CHANTIER PROPOSÉ NON DÉMARRÉ — Yann attend go

**Vraie automatisation SEC EDGAR** (ETA 3-5 jours en autonomie) :
- Cron quotidien sur top 307 → détection nouveau 10-Q/10-K
- Download + extraction LLM ciblée sur hero_kpi
- Validation anti-hallucination (variation > 50 % → flag, pas de publish auto)
- Rebuild merged + redeploy staging auto

Pas encore le go explicite.

## 📂 Fichiers de référence

- `~/spx-app/CLAUDE.md` — règles + état + vocab
- `~/spx-app/RULES-GOLDEN.md` — 9+ règles d'or (V1.8-first)
- `~/spx-app/SHARED-STATUS.md` — coordination 5 convs
- `~/spx-app/.conv-state/CONV-CONCEPTS.md` (CE FICHIER) — état reprise

## 🔁 PROCÉDURE DE REPRISE après coupure Claude

1. Lire ce fichier en entier.
2. `vercel ls | head -10` — voir si les deploys empilés sont finis.
3. Aliaser le DERNIER deploy `Ready` à `mettrik-staging.vercel.app`.
4. `curl -sL https://mettrik-staging.vercel.app/ -H "cookie: NEXT_LOCALE=fr"
   | grep "Pourquoi utiliser"` — vérifier badge live.
5. Reprendre la conversation avec Yann en confirmant l'état (live ou pas).
6. Si chantier "auto SEC EDGAR" lancé entre-temps : `ls scripts/fiscal/` +
   `git log --oneline -10` pour voir l'avancement.
