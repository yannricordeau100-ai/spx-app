# Incident production : Supabase injoignable depuis mettrik.ai

Constat du 21 août 2026, 05h30. Diagnostic seulement, aucune correction appliquée.

## Symptôme

`https://mettrik.ai/api/online-tickers` renvoie `{"tickers":[],"error":"TypeError: fetch failed"}`.
La recherche de sté en production n'affiche donc aucune sté. Tout ce qui dépend de
Supabase est concerné : liste online, overrides de hero, curated companies, auth.

## Cause

Les variables Supabase de l'environnement **Production** sur Vercel pointent encore sur
l'ancien projet Supabase :

| Environnement | Projet Supabase | Créée | Etat |
|---|---|---|---|
| Preview | idpsbtgvuyfwtvzelogw | il y a 95 j | répond (401 sans clé, normal) |
| Production et Development | cnggtyxzqlqqjrynnvdq | il y a 115 j | injoignable, connexion refusée |

La migration de projet Supabase a été faite sur Preview il y a 95 jours et jamais reportée
sur Production. Le fichier `.env.local` local utilise bien le projet actuel.

## Correctif proposé, à valider par Yann

Mettre à jour les 3 variables de l'environnement Production avec les valeurs de `.env.local`,
puis redéployer la production :

- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY

Non appliqué : mandat limité au N2, et il s'agit d'une modification de configuration du
site public.

## Autre point à vérifier

`https://www.mettrik.com` répond une page de redirection en chinois (安全跳转页面), sans
rapport avec l'application. Domaine à contrôler, distinct de mettrik.ai.
