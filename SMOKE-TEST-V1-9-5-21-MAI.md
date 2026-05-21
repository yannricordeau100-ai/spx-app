# Smoke test V1.9.5 — 21 mai après-midi (sub-agent #142)

## Contexte

- Deploy testé : commit `f54193764` (`feat(v1-9-5): release V1.9.5 stés validées qualité audit strict`).
- URL spec mission : `https://staging.mettrik.app/sandbox/v1-9-5`.
- URL réelle staging (cf. SHARED-STATUS) : `https://mettrik-staging.vercel.app/sandbox/v1-9-5` (le DNS `staging.mettrik.app` n'existe pas, NXDOMAIN).
- Test effectué via `curl` HTTP HEAD + GET (lecture seule, conforme contrainte mission).

## Phase A — Smoke test routes

### HEAD (sans suivi redirect)

| URL | HTTP | Latency | Server | Behavior |
|-----|------|---------|--------|----------|
| /sandbox/v1-9-5 | 307 | 2.53s | Vercel | Redirect → `/?auth=signin&next=%2Fsandbox%2Fv1-9-5` |
| /sandbox/v1-9-5/aapl | 307 | 1.94s | Vercel | Redirect → `/?auth=signin&next=%2Fsandbox%2Fv1-9-5%2Faapl` |
| /sandbox/v1-9-5/avgo | 307 | 0.35s | Vercel | Redirect → `/?auth=signin&next=%2Fsandbox%2Fv1-9-5%2Favgo` |
| /sandbox/v1-9-5/jpm | 307 | 0.37s | Vercel | Redirect → `/?auth=signin&next=%2Fsandbox%2Fv1-9-5%2Fjpm` |
| /sandbox/v1-9-5/wfc | 307 | 0.37s | Vercel | Redirect → `/?auth=signin&next=%2Fsandbox%2Fv1-9-5%2Fwfc` |
| /sandbox/v1-9-5/asmlf | 307 | 2.28s | Vercel | Redirect → `/?auth=signin&next=%2Fsandbox%2Fv1-9-5%2Fasmlf` |

### GET avec follow redirect (-L)

| URL | HTTP final | Latency | Size DL | Final URL |
|-----|------------|---------|---------|-----------|
| /sandbox/v1-9-5 | 200 | 3.89s | 1.39 MB | `…/sandbox/v1-8?auth=signin&next=%2Fsandbox%2Fv1-9-5` |
| /sandbox/v1-9-5/aapl | 200 | 5.34s | 1.39 MB | `…/sandbox/v1-8?auth=signin&next=…aapl` |
| /sandbox/v1-9-5/avgo | 200 | 4.85s | 1.39 MB | `…?next=…avgo` |
| /sandbox/v1-9-5/jpm | 200 | 4.71s | 1.39 MB | `…?next=…jpm` |
| /sandbox/v1-9-5/wfc | 200 | 3.27s | 1.39 MB | `…?next=…wfc` |
| /sandbox/v1-9-5/asmlf | 200 | 2.80s | 1.39 MB | `…?next=…asmlf` |

## Tableau de synthèse — markers présents dans HTML servi (après redirect)

Toutes les 6 URLs renvoient le MÊME HTML shell (auth gate sandbox v1-8 sign-in). Les markers détectés ci-dessous correspondent au shell de la home/sandbox v1-8, pas à la page v1-9-5 réelle. Pas d'accès aux blocs de la page sté en mode anonyme.

| URL | HTTP | Latency | Hero KPI | Répartition | Stories | KPIs grid | Gouvernance | Risques | Verdict route |
|-----|------|---------|----------|-------------|---------|-----------|-------------|---------|---------------|
| /sandbox/v1-9-5 | 307 → 200 (gate) | 3.9s | n/a (gated) | n/a | n/a | n/a | n/a | n/a | OK route + auth |
| /sandbox/v1-9-5/aapl | 307 → 200 (gate) | 5.3s | n/a | n/a | n/a | n/a | n/a | n/a | OK route + auth |
| /sandbox/v1-9-5/avgo | 307 → 200 (gate) | 4.9s | n/a | n/a | n/a | n/a | n/a | n/a | OK route + auth |
| /sandbox/v1-9-5/jpm | 307 → 200 (gate) | 4.7s | n/a | n/a | n/a | n/a | n/a | n/a | OK route + auth |
| /sandbox/v1-9-5/wfc | 307 → 200 (gate) | 3.3s | n/a | n/a | n/a | n/a | n/a | n/a | OK route + auth |
| /sandbox/v1-9-5/asmlf | 307 → 200 (gate) | 2.8s | n/a | n/a | n/a | n/a | n/a | n/a | OK route + auth |

Légende :
- **HTTP final 200** = shell sign-in v1-8 servi correctement.
- **HTTP origine 307** = middleware redirige correctement = route v1-9-5 enregistrée et auth-gating actif (comportement attendu).
- **Pas de 404** ni **500** détectés.
- **Pas de build crash** ni erreur runtime visible côté server (response time stable < 5.5s).

## Phase B — Vérification audit cohérence

Source : `src/data/v1-9-pre-publication-audit.json` (généré 2026-05-21T11:44:02Z).

| Ticker | is_clean_all | is_clean_af | failed_count | failed_criteria | failed_extensions |
|--------|--------------|-------------|--------------|-----------------|-------------------|
| AAPL | true | true | 0 | [] | [] |
| AVGO | true | true | 0 | [] | [] |
| JPM | true | true | 0 | [] | [] |
| WFC | true | true | 0 | [] | [] |
| ASMLF | true | true | 0 | [] | [] |

(Pour info : `ASML` (sans `F`) est `clean_all=false` avec `failed_criteria=['a_hero_history']` + `failed_extensions=['g_governance']` → `ASMLF` est bien la variante clean retenue pour V1.9.5.)

Audit cohérence : ✅ les 5 stés cibles sont bien dans le set `is_clean_all=true` (208 stés total cf stats `clean_all=208`).

## Verdict global

- **6/6 routes répondent correctement** (307 sur HEAD direct, 200 sur GET avec follow).
- **Aucune erreur HTTP 404/500/502/503** détectée.
- **Auth-gate fonctionne** (redirect vers sign-in v1-8) = comportement attendu, conforme à la règle "sandbox auth-only".
- **Latency acceptable** (0.35s à 5.34s, dépend du cold/warm cache Vercel).
- **Audit DATA cohérent** : les 5 stés testées (AAPL, AVGO, JPM, WFC, ASMLF) sont bien `is_clean_all=true` dans l'audit pré-publication.
- **Limitation HTTP-only** : le smoke test ne peut PAS valider visuellement les blocs (Hero KPI, Répartition, Stories, KPIs grid, Gouvernance, Risks) car les pages sont auth-gated server-side. Validation visuelle nécessite session authentifiée (Yann en navigateur connecté, ou Chrome MCP via compte admin Mettrik).

## Issues détectées

1. **DNS staging.mettrik.app inexistant** (NXDOMAIN). La mission spec citait `https://staging.mettrik.app/sandbox/v1-9-5` mais le DNS pointe `mettrik-staging.vercel.app` (cf SHARED-STATUS ligne 6 `Aliases Vercel actuels`). Pas un blocker, mais à uniformiser dans les broadcasts futurs.
2. **HTML rendered = shell sign-in v1-8 (1.39 MB répété)** = identique pour les 6 URLs. C'est attendu (pas de session), mais empêche toute vérification visuelle automatisée HTTP-only.

## Recommandations

- ✅ **V1.9.5 prêt côté infra HTTP** : routes 200/307 OK, audit data cohérent, deploy commit `f54193764` actif sur staging.
- ⚠️ **Validation visuelle pending** : Yann doit ouvrir une session authentifiée (sur `mettrik-niveau1.vercel.app` ou `mettrik-staging.vercel.app`) et naviguer manuellement sur les 6 URLs pour confirmer le rendu Hero / Répartition / Stories / KPIs grid / Gouvernance / Risks.
- ✅ **Aucune action correctrice requise** sur la couche route/build/data.
- 💡 **Suggestion** : compléter ce smoke test par un audit visuel Chrome MCP (compte admin Mettrik authentifié) sur les 6 URLs pour cocher les markers UI (Hero / Répartition / Stories / KPIs / Gouvernance / Risks) — scope CONV-DEPAN.
