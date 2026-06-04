# Checklist bascule niveau 0 (prod publique www.mettrik.ai)

Yann 4 juin 2026 : actions externes à faire AVANT le promote prod.

## A. Actions Yann (externes, ~30-45 min)

### A1. Sentry (5 min, gratuit)
- [ ] Compte sur https://sentry.io
- [ ] Créer projet Next.js → nom `mettrik-ai`
- [ ] Copier le DSN (format `https://...@...ingest.sentry.io/...`)
- [ ] Vercel env vars Production : `NEXT_PUBLIC_SENTRY_DSN=<dsn>`
- [ ] Vercel env vars Preview : même valeur (optionnel)

### A2. Stripe live keys (10 min)
- [ ] Activer le compte Stripe en mode "live"
- [ ] Récupérer `sk_live_*`, `pk_live_*`, webhook secret `whsec_live_*`
- [ ] Vercel env vars Production :
  - `STRIPE_SECRET_KEY=sk_live_...`
  - `STRIPE_PUBLISHABLE_KEY=pk_live_...`
  - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...`
  - `STRIPE_WEBHOOK_SECRET=whsec_live_...`
- [ ] Webhook URL Stripe dashboard : `https://www.mettrik.ai/api/billing/webhook`

### A3. Email Resend (5 min)
- [ ] Domain `mettrik.ai` vérifié sur Resend (DKIM, SPF, DMARC)
- [ ] API key live
- [ ] Vercel env vars Production :
  - `RESEND_API_KEY=re_...`
  - `EMAIL_DRY_RUN=0` (force envoi réel)

### A4. DNS Spaceship (10 min)
- [ ] CNAME `www.mettrik.ai` → `cname.vercel-dns.com`
- [ ] CNAME apex `mettrik.ai` → `cname.vercel-dns.com` (ou A record sur 76.76.21.21)
- [ ] Vérification Vercel domain settings : ajout du domain `www.mettrik.ai` + `mettrik.ai`

### A5. Supabase prod (5 min)
- [ ] Vérifier `redirect URLs` Supabase production project contient `https://www.mettrik.ai/auth/callback`
- [ ] Email templates Supabase → URL `https://www.mettrik.ai` (sites URL)

## B. Promote prod (1 commande, 2 min)

```bash
cd /Users/yann/spx-app
set -a && source .env.local && set +a
# Récupère le commit déployé sur niveau1 (déjà validé Yann)
LATEST=$(npx vercel ls --token="$VERCEL_TOKEN" 2>&1 | grep "mettrik-niveau1" | head -1)
# Promote ce deploy en prod
npx vercel promote <DEPLOY_URL> --token="$VERCEL_TOKEN"
```

Alternative : créer un nouveau deploy prod avec env vars Production :
```bash
npx vercel deploy --prod --token="$VERCEL_TOKEN"
```

## C. Vérification post-prod (10 min)

| Check | URL | Attendu |
|---|---|---|
| Page home FR | `https://www.mettrik.ai` | Ouvre sans erreur |
| Page société | `https://www.mettrik.ai/sandbox/v1-9-5/aapl` | Apple logo visible + data |
| Pricing | `https://www.mettrik.ai/pricing` | Plans en EUR, Stripe live |
| Signup | `https://www.mettrik.ai/signup` | Email confirmation reçu (vraie boîte) |
| Sentry test | DevTools console error | Apparaît dans Sentry dashboard |
| GHA cron | `.github/workflows/daily-earnings-refresh.yml` | Active, prochain run visible |
| Lang picker | n'importe quelle page publique | INVISIBLE (FR forcé) |
| Floutage | page sté en mode anon | Blocs `████` non lisibles via DevTools |

## D. Points d'attention (risques résiduels)

- Cache navigateur des anciens utilisateurs (V1 demo) : redirect 301 V1.0→V1.9.5 actif
- Stripe live : éviter de tester avec une vraie carte avant test E2E sandbox
- Crons Vercel : Hobby tier limite 2 crons (GHA prend le relais)
- Bundle size : 250MB max function (actuel ~240MB, surveiller)
- Cerebras free tier : 90M tokens/jour (1.4% utilisé en pic), pas de risque
