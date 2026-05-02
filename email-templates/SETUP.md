# Mettrik · Emails — Setup Supabase + Resend

Objectif : emails modernes (DA Mettrik) qui arrivent **dans la boîte
principale**, pas dans les spams.

---

## A0) Mention « powered by Supabase » en bas de mail

Tant que **Custom SMTP n'est pas branché**, Supabase ajoute automatiquement
au bas de chaque email :

> You're receiving this email because you signed up for an application powered by Supabase ⚡️ Opt out of these emails

**Cette mention est appendée APRÈS notre HTML** : impossible de la supprimer
depuis le template lui-même. Deux solutions :

1. **Recommandé : brancher Custom SMTP via Resend (section B ci-dessous).**
   Dès que c'est actif, Supabase n'ajoute plus son footer. C'est la seule
   solution propre.

2. **Workaround temporaire** (si tu lances l'app avant d'avoir Resend) :
   ajoute à la toute fin de chaque template HTML, juste avant `</body>` :

   ```html
   <!-- masque le footer Supabase appendé après ce HTML -->
   <div style="font-size:0;line-height:0;color:#050507;background:#050507;height:0;overflow:hidden;visibility:hidden;display:none;">&nbsp;</div>
   <style>body > *:not(table) { display:none !important; visibility:hidden !important; color:#050507 !important; }</style>
   ```

   Ça tente de masquer tout élément que Supabase ajoute après notre `<table>`
   principale. **Pas garanti** (certains clients email ignorent le `<style>`),
   donc à valider sur Gmail / Outlook / Apple Mail avant de s'en contenter.

---

## A) Coller les templates dans Supabase Dashboard

1. Va sur https://supabase.com/dashboard/project/cnggtyxzqlqqjrynnvdq
2. **Authentication → Email Templates**
3. Pour chaque template, remplace tout le HTML existant :

| Template Supabase            | Fichier à coller                  |
| ---------------------------- | --------------------------------- |
| **Confirm signup**           | `confirm-signup.html`             |
| **Magic Link**               | `magic-link.html`                 |
| **Invite user** (option.)    | `confirm-signup.html` (réutilise) |
| **Change Email Address**     | `magic-link.html` (réutilise)     |
| **Reset Password** (V1.5)    | à créer plus tard                 |

4. Sujets recommandés (champ "Subject heading") :
   - Confirm signup : `Active ton accès Mettrik`
   - Magic link    : `Ton lien de connexion Mettrik`

5. **Save** sur chaque template.

> Les variables `{{ .ConfirmationURL }}` sont remplacées par Supabase au moment
> d'envoyer. Ne les enlève pas.

---

## B) Sortir des spams — Custom SMTP via Resend

Le SMTP Supabase par défaut est partagé entre tous les projets free :
réputation IP médiocre → spam quasi systématique chez Gmail / Outlook.
La solution propre est de brancher **ton propre domaine** via Resend.

### B.1 Créer un compte Resend (gratuit jusqu'à 3 000 emails/mois)

1. https://resend.com → Sign up (Google OAuth ok)
2. **Domains → Add domain → `mettrik.ai`**
3. Resend te donne 3 enregistrements DNS à créer :
   - 1 × `TXT` SPF (`v=spf1 include:amazonses.com ~all` ou similaire)
   - 1 × `TXT` DKIM (long, avec sélecteur `resend._domainkey` ou autre)
   - 1 × `MX` ou `TXT` selon la région choisie

### B.2 Ajouter les enregistrements chez Spaceship

1. Spaceship → mes domaines → `mettrik.ai` → **Advanced DNS**
2. Pour chaque enregistrement Resend, **Add record** :
   - Type = `TXT` (ou `MX`)
   - Host = la valeur exacte donnée par Resend (ex: `@`, `resend._domainkey`)
   - Value = la valeur Resend (copie-colle telle quelle)
   - TTL = `Automatic` ou `1 hour`
3. **Save**, puis sur Resend clique **Verify** → laisse 5–60 min puis re-clique.

### B.3 Ajouter un DMARC (très fort signal anti-spam)

Toujours sur Spaceship → Advanced DNS → Add :

- Type = `TXT`
- Host = `_dmarc`
- Value =
  `v=DMARC1; p=quarantine; rua=mailto:postmaster@mettrik.ai; pct=100; adkim=s; aspf=s`

### B.4 Connecter Resend → Supabase

1. Resend → **API Keys** → Create API Key (scope: `Sending access`)
2. Copie la clé (commence par `re_...`).
3. Supabase Dashboard → **Project Settings → Authentication → SMTP Settings**
4. Active **Enable custom SMTP** et remplis :
   - Sender email : `noreply@mettrik.ai` (doit matcher ton domaine vérifié)
   - Sender name : `Mettrik`
   - Host : `smtp.resend.com`
   - Port : `465` (SSL) ou `587` (STARTTLS)
   - Username : `resend`
   - Password : la clé `re_...`
   - Min interval : `60s` (ou `0` au début pour tests)
5. **Save**, puis envoie-toi un magic link pour tester.

---

## C) Vérifier la délivrabilité

1. https://www.mail-tester.com → tu obtiens une adresse `test-xxx@mail-tester.com`
2. Sur Mettrik, lance un signup avec cette adresse.
3. Recharge mail-tester → score idéal ≥ 9/10.
4. Vérifie **SPF + DKIM + DMARC = pass** dans le rapport.

Si score < 7 :
- Re-vérifie que SPF/DKIM/DMARC sont bien propagés (`dig TXT mettrik.ai`,
  `dig TXT _dmarc.mettrik.ai`, `dig TXT resend._domainkey.mettrik.ai`).
- Vérifie que le From est bien `noreply@mettrik.ai` (pas un alias hasardeux).

---

## D) Pourquoi cette config évite les spams

| Cause spam Gmail/Outlook                     | Fix appliqué                          |
| -------------------------------------------- | ------------------------------------- |
| IP partagée mal réputée (SMTP Supabase free) | SMTP dédié Resend                     |
| Pas de SPF                                   | TXT SPF Resend                        |
| Pas de DKIM signature                        | TXT DKIM Resend                       |
| Pas de DMARC                                 | TXT DMARC `p=quarantine`              |
| Domaine émetteur ≠ domaine du lien           | `noreply@mettrik.ai` + lien `mettrik.ai` |
| Texte « 2009 », trop bourré de liens         | Template moderne, 1 seul CTA          |

---

## E) Refresh du design tous les 3-6 mois

Garde toujours les fichiers `email-templates/*.html` versionnés dans le repo.
Quand tu veux changer le style :

1. Édite `confirm-signup.html` (et/ou `magic-link.html`).
2. Re-paste dans Supabase Dashboard → Email Templates.
3. Commit + push.

Pas de variable de saison automatique : c'est un copier-coller manuel à chaque
refresh, comme tu l'as demandé.
