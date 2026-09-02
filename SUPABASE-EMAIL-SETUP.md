# 📧 Configurer les emails Mettrik (Supabase)

> **Pourquoi** : par défaut, Supabase envoie les emails depuis `noreply@mail.app.supabase.io` avec le sender "Supabase". Ça fait amateur. On veut `noreply@mettrik.ai` avec sender "Mettrik".

---

## Option A — Quick fix tout de suite (5 min, gratuit)

Configure juste le **nom d'expéditeur** dans Supabase. L'adresse reste `@mail.app.supabase.io` (technique) mais le NOM affiché sera "Mettrik" au lieu de "Supabase".

1. Va sur https://supabase.com/dashboard → ton projet
2. Sidebar gauche : **Authentication** → **Email Templates**
3. Pour chaque template (Confirm signup, Magic Link, Reset Password, Change Email Address) :
   - Modifie la ligne `Subject` : ex `Confirme ton inscription Mettrik`
   - Modifie le `Sender Name` (en haut, dans les Auth settings) : `Mettrik`
4. Sauvegarde

> **Limitation** : l'expéditeur reste `noreply@mail.app.supabase.io`. Beaucoup de mails arrivent en spam.

---

## Option B — Setup pro avec Resend (~20 min, gratuit jusqu'à 3 000 emails/mois)

Tu envoies les emails depuis **`noreply@mettrik.ai`** vraiment (pas une adresse Supabase). Plus pro, moins de spam, fait gagner en délivrabilité.

### Étape 1 — Créer compte Resend (3 min)

1. Va sur https://resend.com → **Sign up** (gratuit)
2. Confirme ton email
3. Tu arrives sur le dashboard Resend

### Étape 2 — Ajouter le domaine mettrik.ai (5 min)

1. Sidebar **Domains** → **Add Domain**
2. Saisis `mettrik.ai`
3. Choisis la région : **EU West** (Frankfurt) pour RGPD
4. Resend te donne 3 enregistrements DNS à ajouter (SPF, DKIM, DMARC). Copie-les.

### Étape 3 — Coller les DNS sur Spaceship (5 min)

1. Va sur https://www.spaceship.com → ton compte → **Domains** → `mettrik.ai`
2. Click **Manage** → **DNS** (ou "DNS records")
3. Pour chacun des 3 enregistrements Resend, click **Add record** :
   - **TXT record** (SPF) : Name = `send` (ou ce que Resend dit), Value = `v=spf1 ...`
   - **TXT record** (DKIM) : Name = `resend._domainkey`, Value = la longue clé Resend
   - **TXT record** (DMARC) : Name = `_dmarc`, Value = `v=DMARC1; p=none;`
4. Sauvegarde
5. Reviens dans Resend → **Verify Domain** (peut prendre 1-30 min pour propagation DNS)

### Étape 4 — Récupérer la clé API SMTP Resend (1 min)

1. Resend Dashboard → **API Keys** → **Create API Key**
2. Permission : `Sending access`
3. Copie la clé (commence par `re_...`)
4. Resend te donne aussi les credentials SMTP :
   - Host : `smtp.resend.com`
   - Port : `465` (TLS)
   - Username : `resend`
   - Password : ta clé API `re_...`

### Étape 5 — Coller dans Supabase (3 min)

1. Supabase Dashboard → ton projet → **Project Settings** (icône engrenage en bas) → **Authentication** → onglet **SMTP Settings**
2. Toggle **Enable Custom SMTP** sur ON
3. Remplis :
   - **Sender email** : `noreply@mettrik.ai`
   - **Sender name** : `Mettrik`
   - **Host** : `smtp.resend.com`
   - **Port** : `465`
   - **Username** : `resend`
   - **Password** : ta clé API `re_...`
4. Click **Save**

### Étape 6 — Tester (1 min)

1. Va sur https://mettrik.ai/?auth=signup
2. Inscris-toi avec un email test (peut être un alias `+test@gmail.com`)
3. Tu reçois un email de **Mettrik <noreply@mettrik.ai>** au lieu de Supabase
4. ✅ Done

---

## Option C — Brander le contenu HTML des emails (10 min, recommandé)

> Redesign sept 2026 : les 5 templates dark (charte Mettrik AI, logo, violet/cyan,
> bouton bulletproof, preheader) sont prêts dans `email-templates/`.

1. Supabase Dashboard → **Authentication** → **Email Templates**
2. Pour CHAQUE type ci-dessous, colle le contenu COMPLET du fichier (DOCTYPE inclus) dans le champ "Message body" et remplace le Subject :

| Template Supabase | Fichier repo | Subject à saisir |
|---|---|---|
| **Confirm signup** | `email-templates/confirm-signup.html` | `Active ton accès Mettrik AI` |
| **Invite user** | `email-templates/invite.html` | `Ton invitation Mettrik AI` |
| **Magic Link** | `email-templates/magic-link.html` | `Ton lien de connexion Mettrik AI` |
| **Change Email Address** | `email-templates/change-email.html` | `Confirme ta nouvelle adresse Mettrik AI` |
| **Reset Password** | `email-templates/password-reset.html` | `Réinitialise ton mot de passe Mettrik AI` |

3. Sauvegarde chaque template (bouton Save par template)

Points d'attention :
- Ne PAS toucher aux variables `{{ .ConfirmationURL }}`, `{{ .Email }}`, `{{ .NewEmail }}` : elles sont déjà placées dans les fichiers.
- Le `<style>` en tête de chaque fichier masque le footer Supabase ajouté par le SMTP par défaut ; il devient inerte avec Custom SMTP (Option B).
- Le logo est servi depuis `https://mettrik-niveau2.vercel.app/brand/mettrik-ai-white-purple.png` : vérifier que cette URL reste publique (pas de mode maintenance qui bloque les statiques).
- Les emails Resend (welcome, billing, onboarding J+1/3/7/14/25) utilisent le même design via `src/lib/email/layout.ts`, rien à coller pour eux.

---

## Recommandation

**Si tu veux la qualité pro pour le lancement** : fais l'Option B aujourd'hui (20 min de toi). C'est ce que toutes les apps SaaS sérieuses font.

**Si tu veux du quick-fix pour ce soir** : Option A, ça marche tout de suite, pas pro mais correct.

Dis-moi laquelle tu prends, je guide étape par étape.
