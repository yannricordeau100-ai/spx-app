# Jour de lancement Mettrik : liste de controle (30 aout 2026)

## A. Avant le go : 4 actions Yann (~1h10)
1. STRIPE LIVE (20 min)
   - Cles live : https://dashboard.stripe.com/apikeys
   - Webhook prod : https://dashboard.stripe.com/webhooks -> endpoint
     https://mettrik.ai/api/billing/webhook (events checkout + subscription)
   - Remplacer les 4 variables STRIPE_* (des cles TEST y sont posees en
     attendant) : https://vercel.com/yannricordeau100-7226s-projects/mettrik/settings/environment-variables
2. RESEND (15 min)
   - Cle : https://resend.com/api-keys -> variable RESEND_API_KEY (meme page Vercel)
   - Domaine d envoi verifie : https://resend.com/domains
3. SUPABASE AUTH (20 min)
   - Site URL https://mettrik.ai + Redirect https://mettrik.ai/** :
     https://supabase.com/dashboard/project/_/auth/url-configuration
   - SMTP personnalise (le SMTP par defaut = ~3 emails/h, les inscriptions
     echoueraient) : https://supabase.com/dashboard/project/_/settings/auth
   - Provider Google : origines mettrik.ai dans la console Google
4. PARCOURS REEL (15 min, apres 1-3) : inscription email + confirmation +
   connexion Google + achat carte test + vue gratuite floutee.

## B. Le go (Claude, 10 min)
- Redeployer (les variables d env ne s appliquent qu au prochain deploiement)
- Passer MAINTENANCE_MODE a off (variable Vercel) et re-deployer/aliaser
- Verifier mettrik.ai : home, une page ste, pricing, legal, inscription ouverte

## C. Deja verifie le 30 aout (audit complet)
- 666 pages : toutes 200, aucune > 10 s
- Routes desk/admin : 403 sans session ; API publiques saines ; captcha actif
- Legal public, sitemap OK, robots OK, favicon OK
- Floutage gratuit configure en base (zones nommees, autre compte : ancres posees)
- Home allegee (les 666 fiches ne sont plus embarquees dans le HTML)
- Visuel de partage OpenGraph cree et declare
- Cron emails onboarding programme (manquait totalement)
- Titres d onglet sans marque doublee

## D. Surveillance J1
- /tmp/earnings-refresh.log (cron 23h) ; .conv-state/publications-manquees.json
- Stripe webhooks (livraisons) ; Supabase Auth logs (inscriptions)
- Vercel Analytics + logs erreurs
