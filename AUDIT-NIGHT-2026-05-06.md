# Audit nuit Mettrik AI — 2026-05-06

> Audit fait par CONV-SYSTEMS (l'agent verifier indépendant n'a pas pu
> exécuter — Bash + WebFetch + Chrome MCP tous denied dans sa session,
> il a refusé de fabriquer un rapport sans avoir touché les pages, choix
> correct).
> Méthode utilisée ici : curl HTTP + grep contenu (pas de visuel).

## 1. Pages publiques · HTTP status

Toutes les pages testées renvoient **200 OK** sur `https://mettrik-staging.vercel.app` :

| Page | Status |
|---|---|
| `/` | 200 |
| `/sandbox/v1-7` | 200 |
| `/sandbox` | 200 |
| `/pricing` | 200 |
| `/legal/conditions` | 200 |
| `/contact` | 200 |
| `/maintenance` | 200 |
| `/sandbox/v1-7/nflx` | 200 |
| `/sandbox/v1-7/aapl` | 200 |
| `/sandbox/v1-7/nvda` | 200 |
| `/sandbox/v1-7/asml` | 200 |
| `/sandbox/v1-7/brk-b` | 200 |

`/` répond 307 brut (redirect locale) puis 200 après follow.

## 2. Contenu attendu · présence

| Page | Élément vérifié | Résultat |
|---|---|---|
| `/` | "Mettrik" + "KPI" | OK |
| `/pricing` | plan "Premium" + plan "Free" | OK |
| `/legal/conditions` | mention "AIRSCAPE" | OK |
| `/legal/conditions` | mention "R consulting" | OK |
| `/legal/conditions` | adresse "Kreuzlingen" | OK |
| `/contact` | mot "contact" | OK |
| `/sandbox/v1-7` | "NFLX" présent dans hub | OK |
| `/sandbox/v1-7/nflx` | "Netflix" sur la page | OK |
| `/sandbox/v1-7/aapl` | "Apple" | OK |
| `/sandbox/v1-7/nvda` | "NVIDIA" | OK |
| `/sandbox/v1-7/asml` | "ASML" | OK |
| `/sandbox/v1-7/brk-b` | "Berkshire" | OK |

## 3. Badge "Données vieillissantes"

Aucune des 4 fiches testées (NFLX, AAPL, NVDA, ASML) ne montre
"Données vieillissantes" dans le HTML. Le backfill `enhance-freshness.ts`
fonctionne.

## 4. Limites de cet audit

- **Pas de vérif visuelle** : axes Y, labels horizontaux 2 lignes
  T1/21, watermark Mettrik AI sur charts, gradients fond, contraste
  logos non vérifiés (verifier agent aurait dû prendre les screenshots).
- **Pas de vérif post-hydration** : les charts sont rendus côté client,
  un grep HTML ne voit que le markup serveur. Une régression visuelle
  (axe écrasé, label chevauché) passerait inaperçue ici.
- **5 fiches sondées sur 1052 prêtes** : NFLX/AAPL/NVDA/ASML/BRK-B.
  Le reste n'est pas garanti.

## 5. Recommandation

Au réveil, relancer l'audit visuel via :
```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new --disable-gpu --hide-scrollbars \
  --window-size=1600,2400 \
  --screenshot=/tmp/audit-nflx.png \
  "https://mettrik-staging.vercel.app/sandbox/v1-7/nflx"
```
puis ouvrir le PNG. Si Yann veut le faire faire par un agent, lui donner
explicitement le droit Bash + Read.

— fin audit
