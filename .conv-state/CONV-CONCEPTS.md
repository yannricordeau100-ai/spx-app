# État CONV-CONCEPTS

> Périmètre : visuels, charts, mockups, `/concepts/*` hors mockups système.
> Fichiers : `src/app/concepts/`, `src/components/lab/`, `src/components/charts/`,
> `src/app/chart-lab/`, `src/components/company-view.tsx` (visuels).
>
> Dernière mise à jour : 2026-05-12 02h30

---

## 🟢 Livré (12 mai 2026)

| # | Tâche | Commit | État |
|---|---|---|---|
| 1 | Règle d'or § 0 V1.8-first dans `RULES-GOLDEN.md` | `3e83c773` | ✅ pushé staging |
| 2 | `src/lib/freshness/earning-pending-tickers.ts` : centralise top 307 V1.8 | `3e83c773` | ✅ pushé staging |
| 3 | Badge "Earning attendu" étendu top 10 → top 307 V1.8 | `3e83c773` | ✅ pushé staging |
| 4 | Date approx "début / milieu / fin de {mois}" si `next_earnings_date` inconnu (+3 mois) | `3e83c773` | ✅ pushé staging |
| 5 | Workflow cron `daily-earnings-refresh.yml` (06:00 UTC top 307) | `63f26924` (Yann) + `6f1d7eff` (Yann) | ✅ déclenchement demain matin |
| 6 | Broadcast SHARED-STATUS règle V1.8-first aux 4 autres convs | `3e83c773` | ✅ |
| 7 | `package.json` name → `mettrik-ai` + README réécrit Mettrik AI | `87a1772a` | ✅ pushé staging |

⚠️ **YAML cron** : ligne `name: Daily earnings refresh` a été supprimée par Yann lors du clean.
GitHub utilise alors le nom du fichier comme fallback. **Le cron est valide et tournera.**

---

## 🟡 En attente de décision Yann

### B. Refonte 3D charts (Bars + Curve + Variation)

**Ce que j'avais proposé** (rejeté par Yann le 12 mai) :
- Rotation 3D au mount via `motion.div` `rotateX(-16deg) rotateY(20deg)` sur conteneur `preserve-3d`
- Animation cinématique 1,2s façon CAD qui se tilt
- Source de l'idée : CLAUDE.md §0 + §7bis

**Ce que Yann veut vraiment** (à clarifier) : il a dit "tu fais fausse route".
Hypothèses :
- (a) Abandonner l'effet "camera tilt" global sur les 3 charts
- (b) Garder le rendu 2D mais corriger uniquement le défaut "liaison pendue" sur Curve
- (c) Autre direction encore inconnue

**Sous-tâche définie clairement (Curve uniquement)** :
- Cause technique du "fil à linge" : `smoothFrom()` ligne 185 utilise `Q midX,prevY → x,y` ce qui crée un plateau au niveau du point précédent puis une chute brutale
- 3 options proposées à Yann (en attente de choix) :
  1. **Catmull-Rom** : courbe fluide qui passe par chaque point sans plateau (style Apple Health)
  2. **Stream ribbon** : courbe lissée + dégradé translucide en dessous, ruban d'énergie
  3. **Wireframe terrain** : courbe principale + 2-3 courbes fantômes décalées en dessous

ETA quelle que soit l'option : 30-45 min.

### C. Refonte HolographicPie

**État actuel** : `src/components/holographic-pie.tsx` (674 lignes), 2 variantes existantes :
- `chunky` : palette cartoon vive, slices exploded, feel modern-cartoonish
- `callouts` : disque fin + callout lines vers chaque slice (% + nom)

**Bloquant** : Yann m'avait promis une **image de référence** pour viser le bon style hologramme moderne (Apple Vision / sci-fi). Sans image, je risque de partir loin du goût Yann.

**Si pas d'image** : je peux proposer 3 variantes sci-fi (ring 3D, dome volumétrique, ribbon orbital) en concept page `/concepts/holographic-pie-v2` sans plug en prod. ETA : 1-2 h.

---

## 🟢 Tâche active (12 mai 2026, ordre Yann)

### T1 — Fallback yfinance pour les 91 FPI EU sans SEC EDGAR ✅ TERMINÉ

- **Statut** : ✅ DONE 12 mai 03h11 (4 min réel, ETA tenu).
- **Résultat** : **91/91 stés enrichies**, 0 no-data, 0 erreur.
- **Output** : champ `latest_filing` `{ date, form: "yfinance", period_end, fetched_at }`
  écrit dans `src/data/v2-pipeline-enrich/<t>.json` (91 fichiers).
- **Script** : `scripts/fetch-filing-dates-yfinance.py`.
- **Log final** : `/tmp/fpi-yfinance-bulk.log`.
- **À déployer** : oui, mais en attente prochain prompt Yann (règle 9 :
  pas de push staging sans validation).

### T2 — Bulk Cerebras news (STANDBY 2 semaines)

- 277 résumés générés cette nuit, **NON déployés** (Yann standby 2 sem.).
- À réactiver après le 26 mai 2026.
- Pour déployer : `git add src/data/v2-pipeline-enrich/*.json && git commit && push && vercel`.

## 🔵 Repoussé

### D. Search bar sur page société

Permet de jumper vers une autre sté sans repasser par home.
**Décision Yann 12 mai** : repoussé à **dans 2 semaines minimum**.

### F. Renommage `spx-app` → `mettrik-app`

**Décision Yann 12 mai** : oui mais à exécuter en autonomie **après 00h50** (cette nuit ou suivantes), avec extrême prudence.

**Plan d'exécution** :
1. Renommer dossier disque : `mv ~/spx-app ~/mettrik-app`
2. Créer symlink rétrocompat : `ln -s ~/mettrik-app ~/spx-app`
   → tout path absolu qui pointe encore sur `~/spx-app/...` continue de marcher
3. Renommer repo GitHub via API : `spx-app` → `mettrik-app`
   → GitHub crée auto une redirection de l'ancienne URL vers la nouvelle
4. Mettre à jour `git remote set-url origin git@github.com:yannricordeau100-ai/mettrik-app.git`
5. Mettre à jour Vercel project name dans dashboard (pas le domaine custom mettrik.ai qui reste)
6. Régression check : `npm run dev` + `curl localhost:3000`, vérif `.vercel/project.json`
7. Rollback automatique si échec : `mv ~/mettrik-app ~/spx-app` + restore repo + revert remote

**Risques connus** :
- Configs MCP `.mcp.json` avec paths absolus → grep en pré-flight
- Cron Vercel pointant sur l'ancien project ID → vérif via Vercel API
- Scripts Python avec `cd ~/spx-app/...` → grep + sed

ETA : 25-40 min selon nombre de paths à patcher.

---

## 📦 Tâches secondaires en attente

- Vérification visuelle screenshot du fix freshness top 10 (règle 0.bis SHARED-STATUS)
  → ETA 3 min, à faire dès que je touche un autre composant impactant
- Charts 3D : finaliser variant choisi par Yann puis appliquer Bars + Variation si même direction visuelle

---

## 🔌 Coordination autres convs

| Conv | État vu sur SHARED-STATUS |
|---|---|
| CONV-SYSTEMS | Au repos après livraison data-quality-matrix le 9 mai |
| CONV-DATA | Au repos après extraction quarterly massive |
| CONV-BRAND | Au repos |
| CONV-DIV | Au repos après livraison V4 727 stés dividendes |

🤝 Aucune coordination active requise sur mes tâches en cours.
