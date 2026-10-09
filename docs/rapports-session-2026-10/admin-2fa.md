# Seconde vérification admin (code par e-mail) : 9 oct 2026

## État
- Code écrit, `npx tsc --noEmit` sans erreur. Rien de commité ni déployé.
- **BLOQUANT : la table Supabase n'est PAS créée.** Le jeton SUPABASE_PAT de .env.local est en lecture seule
  (utilisateur `supabase_read_only_user`, l'API de migrations répond « Missing required permission: database_migrations_write »).
  À faire par Yann : coller `supabase/migrations/20261009_admin_2fa_codes.sql` dans l'éditeur SQL Supabase
  (projet idpsbtgvuyfwtvzelogw ; et dans la base de niveau 1 si elle est séparée).
- **Ne pas déployer avant la création de la table** : sinon l'envoi du code échoue (503) et l'outillage des préversions
  n'est plus accessible qu'avec le jeton d'audit.

## Fichiers
| Fichier | Rôle |
|---|---|
| `src/lib/security/admin-2fa.ts` (nouveau) | HMAC Web Crypto, cookie signé `mtk_admin_2fa` = `<userId>.<exp>.<hmac>`, hachage du code, tirage du code, liste des routes, retour sûr |
| `src/lib/email/admin-2fa.ts` (nouveau) | e-mail du code, Resend direct, expéditeur `Mettrik AI <noreply@mettrik.ai>` (contourne EMAIL_DRY_RUN et la règle « aucun e-mail client ») |
| `src/app/api/admin-2fa/envoyer/route.ts` (nouveau) | POST, compte admin requis (sinon 404), 5 envois/heure, code valable 10 min, stocké haché |
| `src/app/api/admin-2fa/verifier/route.ts` (nouveau) | POST {code, retour}, dernier code seulement, 5 essais, usage unique, pose le cookie (httpOnly, secure, sameSite=lax, 30 j) |
| `src/app/verification-admin/page.tsx` + `client.tsx` (nouveaux) | page de saisie en français, sobre, mobile (noindex) |
| `src/proxy.ts` (modifié, 3 endroits) | import ; `/verification-admin` ajouté à PREFIXES_INTERNES (404 sur mettrik.ai et pour les non-admin) ; après le contrôle comptesAdmin : admin sans cookie valide sur /sandbox, /concepts, /admin, /desk-<slug>, /email-lab, /chart-lab → 307 vers `/verification-admin?retour=<chemin+requête>` |
| `supabase/migrations/20261009_admin_2fa_codes.sql` (nouveau) | table `admin_2fa_codes`, RLS activée sans politique, droits anon/authenticated retirés |
| `.env.local` | `ADMIN_2FA_SECRET` ajouté (64 hex) |
| Vercel | `ADMIN_2FA_SECRET` ajouté en Production et Preview (Preview par l'API REST : la CLI 53.1.0 boucle en non interactif) |

## Comportement
- La session Supabase n'est jamais modifiée : pas de déconnexion.
- Inchangés : site public, pages client, jeton d'audit (`isAuditBypass` saute tout le bloc), poste local (localhost).
- Sans `ADMIN_2FA_SECRET` (secret < 32 caractères) : fermé (cookie refusé, envoi en 503).
- Non couvert (hors demande) : les routes `/api/sandbox/...` appelées par les outils restent protégées par la seule session admin ; /whoami, /faq, /populaire-investisseurs pas soumis au code.

## Tests faits
- 15/15 tests unitaires (tsx) : cookie valide, lié à l'identifiant, signature ou expiration falsifiée refusée, expiré à 31 j refusé, valide à 29 j, codes 6 chiffres uniformes, empreinte stable, routes couvertes/exclues, retour `//evil.com` neutralisé, sans secret = refus.
- Serveur local (celui déjà lancé sur :3000 a été réutilisé, Next refuse un second serveur dans le même dossier ; rien à arrêter de mon côté) :
  - `/api/admin-2fa/envoyer` et `/verifier` sans session : 404.
  - Hôte niveau2 sans session sur /sandbox, /concepts, /verification-admin : 404 (inchangé). Hôte mettrik.ai : 404.
  - Jeton d'audit sur niveau2 /sandbox/lancement : 200, pas de redirection vers le code.
  - Page /verification-admin rendue (200, « Vérification de sécurité », « Recevoir le code », noindex).
- Envoi réel Resend à l'adresse propriétaire : **délivré** (statut Resend `delivered`, expéditeur `Mettrik AI <noreply@mettrik.ai>`, sujet « Votre code de vérification Mettrik : NNNNNN »).

## Non testé (et pourquoi)
- Parcours complet avec une vraie session admin (envoi → saisie → cookie → refus d'un mauvais code → 6e envoi refusé) :
  impossible sans la table (jeton en lecture seule) et sans me connecter au compte de Yann (interdit).
  À faire après création de la table : sur la préversion, ouvrir /sandbox → redirection vers le code → « Recevoir le code »
  → saisir un faux code (message « 4 essais restants ») → saisir le bon → retour sur /sandbox ; rouvrir /sandbox : pas de nouveau code.
