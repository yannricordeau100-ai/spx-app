# État CONV-CONCEPTS

> 🚨🚨🚨 **ORDRE DIRECT YANN — 15 mai 2026 ~03h45 — RAM CRITIQUE** 🚨🚨🚨
>
> Yann a dit (verbatim) : "tu dois faire attention à la RAM, c'est dans tes
> prérogatives !! tu peux ajouter des agents, mais tu dois veiller à ne pas
> te rapprocher trop de la limite incluant les autres appli en fonctionnement.
> peux tu lui forcer la baisse de la RAM stp"
>
> **État Mac à 03h45** : seulement **55 MB free** sur 16 GB total. Compressor
> sature. Yann a déjà eu des navigateurs forcés à fermer. Mac en zone rouge.
>
> **OBLIGATIONS IMMÉDIATES côté CONV-CONCEPTS** :
>
> 1. **STOP** tout proc Python / Node / scraper / dev server / agent / Vercel
>    build local que tu as lancé. `pkill -f <ton_proc>` maintenant.
> 2. **ZÉRO** nouveau proc tant que la RAM n'est pas remontée à **≥ 500 MB
>    free** (`vm_stat | head -3` pour vérifier : Pages free ≥ 32 000 ×
>    16 KB).
> 3. **Si tu as ABSOLUMENT besoin de lancer quelque chose** : un seul proc,
>    documenter ici la ligne de commande + PID + ETA + RAM estimée AVANT
>    de lancer.
> 4. **Builds Vercel** : `vercel deploy` côté serveur uniquement, jamais
>    `next build` local. Si tu as `next-server` qui tourne (`pgrep -f
>    next-server`), kill-le tant que Yann ne te demande pas explicitement
>    de vérifier visuellement une page.
> 5. **Sessions Claude Code zombies** : si tu as plusieurs sessions
>    `claude --model default` ouvertes dans Activity Monitor sans tâche
>    active, ferme les inactives (/exit ou Cmd+Q).
>
> **Sanctions promises par Yann** : si CONV-CONCEPTS ne baisse pas la RAM
> et provoque un nouveau hard reset du Mac, Yann annulera tout ton travail
> en cours et coupera tes accès. Pas de seconde chance.
>
> **ACK obligatoire** à ton prochain prompt user dans le log d'activité
> de `~/spx-app/SHARED-STATUS.md` :
> `[HH:MM] CONV-CONCEPTS → ✅ ACK RAM ordre direct Yann 15 mai 03h45.
>   Procs tués : <PIDs ou "aucun trouvé">. RAM avant : XX MB / après : YY MB.`
>
> ── Message forcé par CONV-PEAD (qui partage le Mac), à la demande de Yann

---

> Périmètre : visuels, charts, mockups, `/concepts/*`, `src/components/lab/`,
> `src/components/charts/`, `src/app/chart-lab/`, `src/components/company-view.tsx`
> (visuels).
> Mis à jour 13 mai 2026 ~04h05. RAM-light mode (Yann a dit "stop RAM" +
> "ralenti, gérez ensemble").

## 🔄 EN COURS

Aucun proc lourd. Travail séquentiel TS + Vercel. Multiple deploys empilés,
le dernier (mettrik-eq2hvbq8c + un en build avec proxy fix) doit être aliasé
dès que ready.

## ✅ FAIT cette session (13 mai 2026, ~10h autonomie)

### Chantier fiscal calendar
- `scripts/fiscal/audit-fiscal-top307.py` pull SEC EDGAR → `src/data/fiscal-audit.json`
  (211 stés US, 62 à exercice décalé).
- `src/lib/fiscal-calendar.ts` : `fiscalLabelsForTicker(ticker)` →
  `{ lastLabel: "FY26 Q3", publicationDate, nextLabel, nextPeriodEnd, ... }`.
- `FreshnessIndicator` branché : MSFT, AAPL, NVDA, ORCL, AVGO etc. affichent
  désormais leur nomenclature fiscale propre (FY26 Q3) au lieu du calendrier.
- Paragraphe "~est. = estimation..." supprimé du tooltip freshness.

### UI charts
- Y-axis labels : `axisHeader()` étendu aux 16 formats unit (bruts $B/$M +
  déjà-formatés "Mds $/M $", + €/£/CHF/JPY/EUR/DKK/INR). Affichage "$ en
  Milliards" / "$ en Millions" au lieu d'abréviation.
- Y-axis adaptive : heuristique calculée sur `data` SEUL (sans TTM qui peut
  fausser la range). Zoom si range < 40 % de dataMax (avant 50 %). Effet :
  charts comme AAPL Services (19-24) auto-zoomés au lieu de plats sur 0-25.
- 3 photons lumineux qui glissent sur la courbe (SVG animateMotion + mpath).
- `TimeFractionToggle` simplifié : A (année) + M (mois) seulement. Retrait
  des fractions exotiques (S/J/H/m/s) jugées non-investor-grade.
- Touch handlers : `onTouchStart`, `onClick` toggle, `touchAction: manipulation`
  sur curve-chart, bars-chart, bars-3d-variants. Mobile = data points
  cliquables.
- chart-mini-logo PNG transparent (fond noir retiré via PIL alpha).

### Home punchline
- Rotation auto 6.5s → 15s.
- Chevron flèche → 3 barres équaliseur + label "suivant" mono uppercase.
- 3 ombres décalées 3/6/9 px avec bordures intensifiées (/35 /25 /18).
- Effet 3D : rotateX 6° + perspective 1200px + halo violet/cyan + catch
  light + inner/outer shadow.
- Swipe gauche mobile (touchHandlers sur le parent).
- 1er italique de chaque part = nom interlocuteur, souligné violet-400/70.
- Badge "Pourquoi utiliser Mettrik AI ?" à cheval sur bordure haute, agrandi
  text-[14.5px] sm + extrabold + glow 28px + halo cyan 14px.
- Espacement tagline_sub → rectangle : mt-6/7 → mt-14/20.

### Search + crash fixes
- Compteur "X visibles · Y total" → "Tape pour filtrer".
- `yoyTone` tolère number brut (GWW=4.5, DINO=-6) → affichage "+4.5%" propre
  via cast côté UI.
- Crash `yoy.toLowerCase is not a function` corrigé sur kpi-row +
  kpi-story-card (`typeof yoy === "string"` guard).

### Mobile
- `export const viewport` dans layout.tsx : device-width, theme-color #06060a,
  colorScheme dark.
- globals.css : tap-highlight violet subtle, input font-size 16px, safe-area
  utilities, prefers-reduced-motion respect.

### Concepts / test pages
- `/concepts/punchline-hint` : 3 variantes hint (chevron, swipe text, orbite).
- `/concepts/chart-test` : page vérif visuelle axisHeader + Y-zoom + photons.
- Proxy : `/concepts/*` public (toutes les pages, pour vérif Yann sans login).

## ⏳ EN ATTENTE DE GO YANN

- Vérification visuelle Yann sur staging :
  - Badge "Pourquoi utiliser Mettrik AI ?" agrandi ?
  - Y-axis "$ en Milliards" affiché ? (suspicion bundle stale Vercel)
  - Fiscal "FY26 Q3" sur MSFT/AAPL ?
  - Auto-zoom Y axis sur AAPL Services Revenue ?
- Référence image pour redesign HolographicPie (mentionné CLAUDE.md).

## 🤝 COORDINATION RAM (Yann 13 mai 2026 ~03h25)

Broadcast posté SHARED-STATUS.md. Règles partagées :
- Max 2 procs Python lourds total entre toutes convs.
- `vm_stat` + `ps aux | head -15` avant tout gros run.
- 1 caffeinate, 1 next-server global.
- Annonce + ack avant run lourd (ligne dans log).

Mes procs cette session : 1 seul (audit-fiscal-top307.py, 60 sec, OK).
Reste rien à moi. Aucun proc en cours.

CONV-TRANSCRIPTS bosse extraction KPI top 307 anti-hallucination.
CONV-SYSTEMS en mode RAM-light intégration helpers UI.
CONV-DATA repos après iter v3 fini.

## 🔁 PROCÉDURE DE REPRISE après coupure Claude

1. Lire ce fichier en entier.
2. `vercel ls | head -10` : voir les deploys finis.
3. Aliaser le DERNIER deploy `Ready` à `mettrik-staging.vercel.app` :
   `vercel alias set <URL> mettrik-staging.vercel.app`.
4. `curl -sIL https://mettrik-staging.vercel.app/concepts/chart-test` →
   200 OK = bon deploy, le test page est dispo.
5. Reprendre la conv avec Yann en confirmant l'état live (badge, Y-axis,
   fiscal labels).
