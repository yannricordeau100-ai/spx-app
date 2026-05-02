# VERCEL DEPLOY · Mettrik AI

> Procédure step-by-step pour le PREMIER déploiement de mettrik.ai sur Vercel.
> Une fois fait, les déploiements suivants sont auto à chaque `git push`.

---

## Pré-requis (à valider AVANT de cliquer Deploy)

- [x] Build local clean (`npm run build`) : vérifié.
- [x] TypeScript clean (`tsc --noEmit`) : vérifié.
- [x] `.env.local` complet (Supabase, Stripe, etc.).
- [x] Routing i18n path-based (/fr) en place.
- [x] Pages légales avec juridiction française.
- [ ] Code commit + push sur GitHub `main` (toi à valider).

## Étape 1 : push le code sur GitHub

Je n'ai pas commit/push pendant que tu dormais. Tu dois d'abord :

```bash
cd ~/spx-app
git status                # voir ce qui a changé
git add .                 # tout staged
git commit -m "feat: i18n /fr routing + V1.7 robust + recovery kit + cleanup"
git push origin main
```

(Adapte le message si tu préfères. Le push est manuel parce que c'est TON
compte GitHub et que je ne dois jamais push à ta place sans go explicite.)

## Étape 2 : créer le projet Vercel (uniquement la 1ère fois)

1. Va sur https://vercel.com/new
2. Click **"Import Git Repository"**
3. Sélectionne ton repo `spx-app` (autorise GitHub si demandé)
4. Vercel détecte automatiquement Next.js : laisse les settings par défaut.
5. AVANT de cliquer Deploy, va dans **Environment Variables** et colle
   chaque ligne de `.env.local` (sauf les vars de dev type localhost).
   Variables minimales requises :
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `STRIPE_SECRET_KEY` (sk_test_ pour démarrer)
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (pk_test_ pour démarrer)
   - `STRIPE_WEBHOOK_SECRET` (peut rester whsec_TODO_PASTE_AT_WAKE_UP)
   - `DESK_OWNER_EMAIL=yannricordeau100@gmail.com`
   - `NEXT_PUBLIC_SITE_URL=https://www.mettrik.ai`
6. Click **Deploy**.

## Étape 3 : connecter le domaine `mettrik.ai`

Une fois le 1er deploy réussi, tu auras une URL du type
`spx-app-xxxx.vercel.app`. Pour pointer `mettrik.ai` dessus :

1. Dans Vercel : projet -> Settings -> Domains -> Add `mettrik.ai`
2. Vercel te donne 2 records DNS à ajouter (un A record + un CNAME).
3. Va sur **Spaceship** (ton registrar) -> DNS -> ajoute les 2 records.
4. Attendre 5-30 min la propagation DNS.
5. Vercel coche automatiquement le domaine quand DNS OK + pose un cert
   HTTPS Let's Encrypt.

## Étape 4 : ajouter les redirect URL Supabase

Pour que l'auth fonctionne en prod, va dans Supabase :
1. Dashboard -> Authentication -> URL Configuration
2. **Site URL** : `https://www.mettrik.ai`
3. **Redirect URLs** : ajoute :
   - `https://www.mettrik.ai/auth/callback`
   - `https://www.mettrik.ai/auth/update-password`
   - `https://www.mettrik.ai/fr/auth/callback`
   - `https://www.mettrik.ai/fr/auth/update-password`
   (Garde aussi les redirect localhost pour le dev local.)

## Étape 5 : webhook Stripe (peut être fait plus tard quand tu utiliseras Stripe)

1. Dashboard Stripe (mode TEST) -> Developers -> Webhooks -> Add endpoint
2. Endpoint URL : `https://www.mettrik.ai/api/billing/webhook`
3. Events : sélectionner `checkout.session.completed`,
   `customer.subscription.created`, `customer.subscription.updated`,
   `customer.subscription.deleted`, `invoice.payment_succeeded`,
   `invoice.payment_failed`
4. Copier le webhook secret généré (whsec_xxxx)
5. Mettre dans Vercel env var `STRIPE_WEBHOOK_SECRET` + redeploy

## Étape 6 : vérifier que tout marche

Après le 1er deploy + DNS propagé :
- https://www.mettrik.ai : home en anglais
- https://www.mettrik.ai/fr : home en français
- https://www.mettrik.ai/googl : page Alphabet en anglais
- https://www.mettrik.ai/fr/googl : page Alphabet en français
- https://www.mettrik.ai/legal/cgv : CGV
- https://www.mettrik.ai/sitemap.xml : sitemap avec hreflang FR/EN
- Connexion via email + mot de passe : doit fonctionner
- Connexion Google OAuth : doit fonctionner

---

## En cas de problème

### Build échoue sur Vercel
- Lire le log Vercel.
- Souvent : variable d'env manquante. Re-vérifier la liste § Étape 2.5.

### Auth marche pas en prod
- Vérifier que les Redirect URLs Supabase contiennent bien les URL prod.
- Vérifier que `NEXT_PUBLIC_SITE_URL` est bien `https://www.mettrik.ai`.

### `/fr/...` retourne 404
- Vérifier que `proxy.ts` est bien déployé (pas dans `.gitignore`).
- Lire le log Vercel sur la requête fautive.

### Le domaine ne pointe pas
- Vérifier les 2 records DNS sur Spaceship (A + CNAME exactement comme
  Vercel les a donnés).
- Patience : la propagation peut prendre jusqu'à 30 min.

---

Bon deploy.
