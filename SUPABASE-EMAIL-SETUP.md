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

## Option C — Brander aussi le contenu HTML des emails (15 min, optionnel)

Une fois SMTP configuré (Option B), tu peux remplacer les templates par défaut Supabase par ceux Mettrik (logo, couleurs, ton).

1. Supabase Dashboard → **Authentication** → **Email Templates**
2. Pour chaque template, colle le HTML que je t'ai préparé dans `email-templates/confirm-signup.html` (déjà existant, créé par CONV-CONCEPTS hier)
3. Sauvegarde

---

## Recommandation

**Si tu veux la qualité pro pour le lancement** : fais l'Option B aujourd'hui (20 min de toi). C'est ce que toutes les apps SaaS sérieuses font.

**Si tu veux du quick-fix pour ce soir** : Option A, ça marche tout de suite, pas pro mais correct.

Dis-moi laquelle tu prends, je guide étape par étape.
