# Supabase Email Templates · Mettrik AI

> **Source de vérité : `email-templates/*.html`** (design dark charte Mettrik AI, sept 2026).
> Ce dossier ne contient plus de HTML : les anciens snippets clairs 6 locales sont périmés.

## Fichiers à coller dans Supabase Dashboard → Authentication → Email Templates

| Template Supabase | Fichier repo | Variables utilisées |
|---|---|---|
| Confirm signup | `email-templates/confirm-signup.html` | `{{ .ConfirmationURL }}` |
| Magic Link | `email-templates/magic-link.html` | `{{ .ConfirmationURL }}` |
| Reset Password | `email-templates/password-reset.html` | `{{ .ConfirmationURL }}` |
| Change Email Address | `email-templates/change-email.html` | `{{ .ConfirmationURL }}`, `{{ .Email }}`, `{{ .NewEmail }}` |
| Invite user | `email-templates/invite.html` | `{{ .ConfirmationURL }}`, `{{ .Email }}` |

Procédure complète et sujets recommandés : voir `SUPABASE-EMAIL-SETUP.md` à la racine.

## Localisation

Supabase ne supporte qu'un template par type (pas d'i18n natif). Stratégie retenue :
templates auth en **FR** (marché principal), localisation complète côté app pour les
emails Resend (welcome, billing, onboarding) via `src/lib/email/layout.ts`.
