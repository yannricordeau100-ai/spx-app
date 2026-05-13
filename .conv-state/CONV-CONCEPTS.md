# État CONV-CONCEPTS

> Périmètre : visuels, charts, mockups, `/concepts/*` hors mockups système.
> Mis à jour 13 mai 2026 ~03h45. RAM-light mode (Yann a dit "ralenti").

## 🔄 EN COURS

Mode autonomie RAM-light : pas de proc Python lourd, pas de scraper, pas de
LLM. Travail purement code TS + commit + deploy Vercel (build serveur-side).

**Deploy en attente d'alias** : `mettrik-mhpntfqfq` (commit `040f9ae8`) +
`mettrik-[force-rebuild v3]` à venir avec commit `57747d2f` (touch handlers).

## ✅ FAIT cette session (10h autonomie)

### Cette nuit (13 mai 2026, après "stop RAM")
- Touch handlers sur curve-chart, bars-chart, bars-3d-variants : `onTouchStart`
  + `onClick` toggle pour tap mobile + `touchAction: manipulation`. Les data
  points sont maintenant cliquables sur mobile (avant : seulement hover desktop).
- Retrait fractions exotiques (S/J/H/m/s) du `TimeFractionToggle`. Garde A
  (année) + M (mois). Diviseurs legacy conservés en interne pour rétro-compat.
- Comment v3 sur curve-chart pour forcer rebuild Vercel (chunks ne montraient
  pas "Milliards" malgré --force).

### Plus tôt aujourd'hui (12-13 mai 2026)
- Fiscal calendar : src/lib/fiscal-calendar.ts + src/data/fiscal-audit.json
  pour 211 stés US (62 à exercice décalé). FreshnessIndicator affiche
  "FY26 Q3" au lieu de calendrier trompeur pour MSFT, AAPL, NVDA, etc.
- Y-axis labels : "$/Mds $/M $" → "$ en Milliards/Millions" (mot complet).
  Couvre formats bruts ($B, $M) + déjà-formatés (Mds $, M €, etc.).
- Y-axis adaptive : heuristique calculée sans TTM (range < 40 % de
  dataMax → zoom). Effet AAPL Services : 19-24 sur axe ~18-25 au lieu 0-25.
- Badge "Pourquoi utiliser Mettrik AI ?" agrandi : text-[14.5px] sm + extrabold
  + glow 28px + halo cyan 14px.
- Punchline : rotation 6.5s → 15s, chevron → 3 barres équaliseur + label
  "suivant", swipe gauche mobile, 1er italique souligné = nom interlocuteur.
- 3D effet rectangle : rotateX 6° + 3 ombres 3/6/9 px + halo violet/cyan.
- Espacement tagline_sub → rectangle : mt-6/7 → mt-14/20.
- 3 photons lumineux glissent sur courbe (animateMotion + mpath).
- chart-mini-logo : PNG `/brand-mini-logo.png` transparent.
- Compteur "X visibles · Y total" → "Tape pour filtrer".
- Mobile : `export const viewport` + tap-highlight + input 16px + safe-area
  + `prefers-reduced-motion` respect.

## ⏳ EN ATTENTE

- **Verification visuelle Yann** : badge plus visible ? Y-axis zoom OK ?
  Milliards/Millions affiché ? Fiscal "FY26 Q3" sur MSFT ?
- **Référence image pie chart** : Yann doit fournir pour redesign.

## 🤝 COORDINATION RAM (Yann 13 mai 2026 ~03h25)

Broadcast posté dans SHARED-STATUS.md (commit `502190ac`) avec règles :
- Max 2 procs Python lourds total entre toutes convs
- `vm_stat` + `ps aux` avant gros run
- 1 caffeinate + 1 next-server global
- Annonce + ack avant tout run lourd

Mes procs tués : vercel ×2, next-server, enrich-topcap-v2,
transcript-summarizer-all-sources, caffeinate. Reste rien à moi.

CONV-TRANSCRIPTS bosse sur extraction KPI top 307 V1.8 (anti-hallucination).
CONV-SYSTEMS en mode RAM-light séquentiel (intégration helpers UI).
CONV-DATA en repos après iter v3 fini.

## 🔁 PROCÉDURE DE REPRISE si Claude coupé

1. Lire ce fichier en entier.
2. `vercel ls | head -10` : voir deploys finis.
3. Aliaser le dernier `Ready` à `mettrik-staging.vercel.app`.
4. `curl -sL https://mettrik-staging.vercel.app/ -H "cookie: NEXT_LOCALE=fr"
   | grep -E "mt-14|Pourquoi utiliser|brand-mini-logo"` : vérifier live.
5. Reprendre la conv avec Yann en confirmant.
