# 🌅 Wakeup checklist · 29 avril 2026

> Lis ce fichier au réveil. Toutes les étapes nécessitant TON action sont marquées 🟡.

---

## 🎯 TL;DR — ce qui a été fait pendant que tu dormais

| Domaine | Livré |
|---|---|
| Bug "Lien invalide" auth | ✅ Fixé (handling `?token_hash=&type=signup`, 6 messages explicites) |
| Auth errors Supabase | ✅ Traduits FR/EN automatiquement (9 messages mappés) |
| Mettrik → Mettrik AI | ✅ Renommé partout (UI, footers, layouts, BrandWordmark) |
| 4 emails | ✅ antoine@/yann@/contact@/noreply@mettrik.ai préconfigurés dans `/lib/email/resend.ts` |
| 3 templates emails | ✅ Onglet `/concepts` → "Email templates" (Minimal / Branded / Editorial) |
| 4 pages légales | ✅ `/legal/mentions`, `/legal/cgu`, `/legal/cgv`, `/legal/confidentialite` |
| Disclaimer financier | ✅ Composant `<DisclaimerFooter />` (FR/CH ready) |
| 404/500 stylées | ✅ `not-found.tsx`, `error.tsx` |
| Sitemap + robots | ✅ Auto-générés par Next.js, `/sitemap.xml`, `/robots.txt` |
| OG images dynamiques | ✅ `/api/og/<ticker>` génère 1200×630 PNG par société |
| Resend stub | ✅ `/lib/email/resend.ts` prêt, env var `RESEND_API_KEY=re_TODO` |
| Plausible stub | ✅ `<PlausibleScript />` prêt, env var `NEXT_PUBLIC_PLAUSIBLE_DOMAIN=TODO` |

**Total fichiers créés ou modifiés cette nuit : ~25.**

---

## 🟡 Actions requises de ta part (ordre conseillé)

### 1. Migration SQL Supabase (si pas déjà fait, 2 min)

Si pas encore exécutée hier, exécute la migration `supabase/migrations/20251127_desk_and_billing.sql` (12 tables : desk_*, subscriptions, billing_events). Le SQL est aussi consultable dans la conversation précédente du chat.

> Vérifie dans Supabase Dashboard → Database → Tables : tu dois voir 12 tables avec cadenas 🔒 (RLS).

### 2. Compléter les pages légales (10 min)

Ouvre les 4 fichiers et remplace les `[placeholders]` jaunes :

```
src/app/legal/mentions/page.tsx
src/app/legal/cgu/page.tsx
src/app/legal/cgv/page.tsx
src/app/legal/confidentialite/page.tsx
```

Infos à compléter :
- **Statut juridique** (FR : auto-entreprise / SASU / SARL ; CH : Sàrl / RI / sole proprietorship)
- **Adresse** complète du siège
- **Numéro d'identification** (SIREN/SIRET pour FR, IDE pour CH)
- **Numéro TVA** intracommunautaire (si applicable)
- **Ville** du tribunal compétent
- **Droit applicable** : "français" ou "suisse"

### 3. Email Mettrik AI (option à choisir)

Lis `SUPABASE-EMAIL-SETUP.md` à la racine. 3 options :

- **Option A** (5 min) : Quick fix nom expéditeur "Mettrik AI" dans Supabase Dashboard. Email reste `noreply@mail.app.supabase.io`.
- **Option B** (20 min) : Resend SMTP → vrai expéditeur `noreply@mettrik.ai`. Reco pour la prod.
- **Option C** (15 min de plus) : Templates HTML brandés Mettrik AI.

Ma reco : **B + C** quand tu as 30-40 min. Pour ce matin si tu pars dans 1h : juste A.

### 4. Choisir un design email (5 min)

Va sur http://localhost:3000/concepts → onglet **"Email templates"**. Switch entre :
- Minimal (épuré, blanc, type Linear)
- Branded (sombre, glow violet/cyan, marqué Mettrik)
- Editorial (cream warm, ton chaleureux, Georgia)

Click sur un design. Click "Copier le HTML". Colle dans Supabase Email Templates. Dis-moi lequel tu retiens, je l'applique aux 4 templates (confirm, magic, reset, welcome).

---

## 🔍 Routes à tester en local

Toutes vérifiées 200 ce matin :

```
/                          → home
/legal/mentions            → mentions légales
/legal/cgu                 → CGU
/legal/cgv                 → CGV
/legal/confidentialite     → politique confidentialité
/sitemap.xml               → sitemap auto-généré
/robots.txt                → robots auto-généré
/api/og/googl              → OG image dynamique GOOGL (PNG 1200×630)
/api/og/meta               → idem META (chaque ticker testé OK)
/concepts                  → hub concepts (avec onglet Email templates)
/desk-mtk9x4kp             → desk interne (auth requis, ton email)
/whoami                    → diagnostic auth
```

---

## ⏳ À faire la prochaine session de travail

- **i18n FR/EN routing** : structure `[locale]/`, fichiers messages EN+FR, switcher de langue. **Pas commencé** cette nuit (chantier > 2h, à faire en plein focus avec toi pour valider les libellés).
- **Connecter `<DisclaimerFooter />` aux pages publiques** : home, /<ticker>, /aurora/<ticker>, /spatial/<ticker>. Petit refactor 30 min. À faire après que tu aies validé les pages légales (pour éviter de doubler le travail si tu changes des paragraphes).
- **Ajouter `<PlausibleScript />` au layout root** : 2 lignes après création compte Plausible.
- **Vercel deploy** : étape de promotion. ~20 min de toi avec moi.

---

## 📡 Sur la coordination des 3 conversations

J'ai laissé un message à **CONV-CONCEPTS** dans `SHARED-STATUS.md` pour qu'elle valide / améliore les 3 templates email proposés. Quand tu retournes sur la conv concepts, elle va voir le message et te proposer son retour design.

---

## ⚠️ Notes & limites connues

- **Edge runtime OG** : la première requête `/api/og/<ticker>` est lente (~20s, compile Edge). Les suivantes sont instantanées. En prod sur Vercel : pas d'enjeu, tout est précompilé au déploiement.
- **Pages légales en FR uniquement** : à dupliquer en EN quand tu veux i18n complet (estimation : 1h pour traduire les 4).
- **Disclaimer dans le footer pas encore branché aux pages prod** : voir todo ci-dessus.

---

## 🛠️ Si quelque chose casse au démarrage

| Symptôme | Solution |
|---|---|
| Dev server down | `npm run dev` depuis `~/spx-app` |
| Page légale 404 | Restart dev server (env vars proxy.ts modifiées) |
| OG image 500 | Première requête lente, attendre 30s. Si toujours 500, dis-le moi |
| Desk 404 | Va sur http://localhost:3000/whoami pour voir ton état auth |
| Trad password "should be different" toujours en EN | Vérifie cookie `NEXT_LOCALE=fr` côté navigateur (DevTools → Application → Cookies) |

Bon réveil. 🌞
