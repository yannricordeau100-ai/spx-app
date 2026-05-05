# Vercel V2.0 — Checklist à plugger

Tout ce qui est à coller / activer demain (5 min côté Yann). Le code est déjà prêt.

## 1. Stripe (priorité 1)

### Webhook URL à créer dans Stripe Dashboard

1. Aller sur https://dashboard.stripe.com/test/webhooks
2. **Add endpoint**
3. URL : `https://mettrik-staging.vercel.app/api/billing/webhook`
4. **Select events** : cocher
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
5. **Add endpoint**
6. Copier le **Signing secret** affiché (format `whsec_...`)
7. Aller sur Vercel → mettrik project → Settings → Environment Variables
8. Update `STRIPE_WEBHOOK_SECRET` (env Production + Preview) avec la valeur copiée
9. Sauvegarder

### Stripe Dashboard config

- Settings → **Tax** → Activate Stripe Tax (Suisse + EU + UK + CA)
  - Note : R consulting CH n'est pas assujettie TVA, donc Stripe Tax = OFF
    pour la France/EU. Mais à activer pour les locales où la sté locale
    devrait collecter (ex : si on facture USD aux US sales tax). Pour
    l'instant **laisser DÉSACTIVÉ** (cohérent avec CG R consulting).
- Settings → **Branding** → upload logo Mettrik AI (apparaît sur emails + checkout)
- Settings → **Customer portal** → Activate avec defaults (annulation, factures)
  - Cancellation reason : optionnel mais recommandé
  - Allow payment method update : oui
  - Allow invoice history : oui
- Settings → **Smart Retries** → Activate (pour cartes expirées auto-retry)

### Vérification produits

- Products section : 3 produits existent (Mettrik AI Free, Premium mensuel, annuel)
- Si à recréer ou refresh : `npx tsx scripts/setup-stripe-products.ts` (idempotent)

## 2. Vercel env vars

Variables déjà présentes (vérifier sur Vercel → Settings → Environment Variables) :

| Variable | Présente ? | Valeur |
|---|---|---|
| `STRIPE_SECRET_KEY` | ✅ | sk_test_... (test mode) |
| `STRIPE_PUBLISHABLE_KEY` | ✅ | pk_test_... |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | ✅ | pk_test_... (= au-dessus) |
| `STRIPE_WEBHOOK_SECRET` | À UPDATE | whsec_... (de l'étape 1.6) |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | déjà OK |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | déjà OK |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | déjà OK |
| `MAINTENANCE_MODE` | ✅ Prod = `on` | Garder `on` jusqu'au lancement public |

À vérifier dans Vercel après modif : **Redeploy** Production une fois le webhook secret update (sinon l'ancienne valeur reste en cache fonction).

## 3. Supabase migration V2.0

À appliquer quand on bascule pipeline data → Supabase :
1. Supabase Studio → SQL Editor → coller le contenu de `supabase/migrations/20260504_companies_v2.sql`
2. Run
3. Vérifier les RLS policies (public read sur `companies_v2`, RLS strict sur `subscriptions`)
4. Lancer `npx tsx scripts/migrate-pipeline-to-supabase.ts` une fois pour pousser les datasets

## 4. À tester après plugging

1. https://mettrik-staging.vercel.app/pricing → sélecteur devise visible, switch devise → prix changent
2. Click "Choisir mensuel" → si non connecté, redirect /signup. Si connecté, redirect Stripe Checkout
3. Sur Stripe Checkout : payer avec carte test `4242 4242 4242 4242`, n'importe quelle date future + CVC + ZIP
4. Vérifier redirect retour `/account?billing=success`
5. Vérifier dans Stripe Dashboard test → Customers → nouvelle subscription créée
6. Vérifier dans Supabase → table `subscriptions` → ligne créée par le webhook

## 5. PayPal (test mode)

PayPal en test : il faut un **compte PayPal Sandbox**.
1. https://developer.paypal.com → Sandbox accounts → créer un buyer test
2. Sur Stripe Checkout en test, "Pay with PayPal" → connexion via le buyer test
3. Si PayPal n'apparaît pas comme méthode → vérifier `payment_method_types` dans `src/app/api/billing/checkout/route.ts` (déjà inclut "paypal")

## 6. Customer Portal Link

Pour donner un bouton "Gérer mon abonnement" dans `/account` :
1. Stripe Dashboard → Settings → Customer portal → Configuration → copier l'URL
2. Le code est déjà prêt dans `src/app/api/billing/portal/route.ts` (à créer demain si pas existant)

---

## Ce que je n'ai PAS fait (besoin de toi pour décider)

| Question | Décision attendue |
|---|---|
| **Sentry** account | Free tier OK ? Je crée si oui |
| **Status page** | Maintenant ou Phase 2 ? |
| **Cancel/retention** : remise 50% 1 mois quand user veut annuler ? | Y/N + montant |
| **Onboarding email sequence** (J+1, J+3, J+7) : draft FR/EN ? | Tu écris le copy ou je drafte |
| **Backup Supabase** : Free tier 7 jours OK | ✅ confirmé |

---

## État actuel V2.0 stés (au 5 mai 2026 ~05h)

- **V1.7 strict** = 1052 stés Pass 3 prêtes (filtre qualité + enrichment 327 stés terminé)
- **TAM V2.0 shortlist** = 10 stés finalisées (NFLX, NVDA, AAPL, ASML, SAP, TSLA, MC.PA, SIE.DE, TTE.PA, NOVO)
- **Stripe** = 3 produits + 14 prices test mode prêts
- **CG conditions** = R consulting (Suisse, non assujettie TVA) intégrée comme entité de facturation, AIRSCAPE FR reste éditeur
- **Cron horaire** = `mettrik-rebuild-merged` actif, propage les nouveaux Pass 3 toutes les heures

---

Document généré automatiquement par CONV-SYSTEMS le 5 mai 2026.
