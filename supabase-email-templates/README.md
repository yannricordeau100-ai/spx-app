# Supabase Email Templates · Mettrik AI

Templates HTML prêts à coller dans **Supabase Dashboard → Authentication → Email Templates**.

3 types d'email × 6 locales = 18 fichiers.

## Locales couvertes

- `fr` français
- `en` anglais (sert aussi en-GB)
- `de` allemand (sert aussi de-CH)
- `nl` néerlandais
- `sv` suédois
- `da` danois

## Variables Supabase utilisées

- `{{ .ConfirmationURL }}` : lien d'action (confirm signup, magic link, reset password)
- `{{ .Email }}` : email du destinataire
- `{{ .Token }}` : token brut (utile si on veut un OTP en plus du lien)
- `{{ .SiteURL }}` : https://mettrik.ai (set dans Supabase project URL)

## Procédure de paste

Supabase ne supporte qu'**un seul template par type** (pas de natif i18n).
Stratégie : on garde le template **EN par défaut** côté Supabase, et on
gère la localisation **côté app** via `sendEmail()` de `src/lib/email/resend.ts`
quand on émettra nos propres emails (welcome, billing, etc.).

Pour les emails Supabase Auth (signup confirm, magic link, password reset), on
configure la version **EN** dans Supabase et on **redirige le user vers une
page localisée** côté app après clic sur le lien (`/auth/callback?lang=...`).

Les fichiers FR/DE/NL/SV/DA sont fournis pour référence si Supabase publie
l'i18n natif des templates auth dans le futur.

## Fichiers

- `signup-confirm-{fr,en,de,nl,sv,da}.html` : email de confirmation après inscription
- `magic-link-{fr,en,de,nl,sv,da}.html` : email de connexion sans mot de passe
- `password-reset-{fr,en,de,nl,sv,da}.html` : email de réinitialisation mot de passe
