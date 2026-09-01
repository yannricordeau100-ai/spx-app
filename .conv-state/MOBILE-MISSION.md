# MISSION MOBILE — Optimisation complète de Mettrik en version mobile
> Rédigé le 2 sept 2026 par la conversation principale (Opus/Fable), pour exécution
> autonome par un autre compte Claude (Fable MAX). Tout le nécessaire est ici.

## 0. Objectif et périmètre
Rendre l'app **parfaite sur mobile (375x812 et proches)** SANS CHANGER le rendu
desktop actuel, qui est validé. Aucune refonte : uniquement du responsive.
Standard exigé : "parfait", pas "bien". Zéro chevauchement, zéro débordement
horizontal, zéro texte coupé, zéro cible tactile trop petite, graphs lisibles.

## 1. Environnement
- Repo : `~/spx-app` (Next.js 16, React 19, Tailwind v4). Branche `staging`.
- Dev : `cd ~/spx-app && npm run dev` (port 3000) ou preview_start `mettrik-dev`
  (`.claude/launch.json`). `.env.local` complet, ne rien y toucher.
- Vue mobile : Browser pane -> resize_window preset "mobile" (375x812). Ouvrir
  d'abord une URL, puis resize (l'ordre inverse échoue).
- Compte de test connecté (OBLIGATOIRE pour voir les pages comme Yann) :
  `audit.claude@mettrik-internal.test` / mot de passe régénérable via
  `PUT $SUPABASE_URL/auth/v1/admin/users/0b5f4935-7297-49fa-b113-046290aeb244`
  avec la clé service_role de `.env.local` (body `{"password":"..."}`).
  Login fiable : formulaire `/?auth=signin`, remplir via setter natif
  HTMLInputElement + dispatchEvent('input') + form.requestSubmit()
  (il y a DEUX formulaires dans le DOM : prendre celui visible/offsetParent).

## 2. Règles d'or (NON NÉGOCIABLES, héritées du projet)
- NE PAS CHANGER LE DESKTOP. Technique imposée : la classe de base devient la
  version mobile et le rendu desktop actuel est préservé par un préfixe
  `sm:`/`md:` reprenant la valeur d'origine. Exemple : `px-6` devient
  `px-3 sm:px-6`. Après chaque fichier modifié, re-vérifier la page en
  desktop (resize preset "desktop") : rendu STRICTEMENT identique.
- Jamais inventer de données ; ne toucher qu'au CSS/markup responsive, jamais
  aux données ni aux textes.
- `npx tsc --noEmit` doit passer avant chaque commit.
- Commits ciblés (`git add <fichiers>`, JAMAIS `git add -A`), messages français
  sans em-dash, terminés par `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- Max 2-3 processus lourds en parallèle (Mac 16 Go, a déjà crashé).
- Une sté citée dans un bug = corriger le pattern sur TOUTES (composants partagés).
- Si une nouvelle règle entre en conflit avec une existante : LE SIGNALER EN
  LETTRES CAPITALES à Yann et suspendre, sauf solution évidente.
- Ne PAS toucher : `src/data/**` (données), scripts accents, `proxy.ts` (gating),
  pages legal (contenu), `chart-export.ts` (le document téléchargé est validé).

## 3. Pages à auditer et rendre parfaites (dans cet ordre)
Toutes en 375x812, CONNECTÉ, thème sombre puis un passage rapide en clair :
1. `/` (home) : header, citation, recherche, grilles de cartes KPI (wow),
   constellation, FAQ, footer.
2. `/sandbox/v1-9-5/aapl` puis `/googl`, `/meta`, `/ko`, `/mc.pa` (fiche sté,
   LE plus important) : nav haute (logo retour + recherche + boutons), hero
   (valeur, CAGR, graph), toggles de graph (Barres/Courbe/Variation, Annuel/
   Trimestriel, 2D/3D), tableau Indicateurs clés (6 colonnes en desktop !),
   carrousel Story, blocs Comprendre la société, Répartition, Gouvernance,
   Rémunération, Risques (jauges), Positionnement IA, Événements, tooltips "i".
3. `/pricing` (cartes des 3 plans, toggle mensuel/annuel, FAQ).
4. `/legal/conditions`, `/legal/mentions`, `/legal/confidentialite`.
5. Modal d'inscription/connexion (`/?auth=signup`) + captcha.
6. `/parrainage`, `/account` (si accessible), page `/maintenance`.
Le sandbox d'admin (Yann seul) est HORS périmètre sauf demande.

## 4. Défauts déjà repérés (point de départ, à confirmer/corriger)
- Home 375px : 33 éléments dépassent du viewport selon getBoundingClientRect,
  MAIS scrollWidth reste 375 : la plupart sont des halos décoratifs
  `pointer-events-none absolute` volontairement débordants (bénins). Le critère
  de jugement est VISUEL (screenshot) + `document.documentElement.scrollWidth
  === 375` + aucun contenu utile coupé. Ne pas "corriger" les halos.
- Fiche sté : le tableau Indicateurs clés a 6 colonnes desktop ; en mobile il
  passe en `col-span-12` empilé, vérifier chaque cellule (nom, valeur, badge
  qualité, signal) et l'alignement des tooltips "i".
- Graphs SVG : viewBox fixe ~992px, réduit sur mobile => textes ~12px réels.
  Vérifier lisibilité des ticks, labels de barres (nouvellement affichés sur
  TOUTES les barres, survol = tap sur mobile), bandeau des années.
- Carrousel Story : la carte a un ajustement de largeur du grand chiffre
  (ResizeObserver, `kpi-story-card.tsx`) : vérifier qu'aucun chiffre n'est
  coupé sur 3-4 stés (KO avait "600 00(" coupé, corrigé, re-vérifier).
- Nav haute fiche sté : logo + recherche + Comparer + Enregistrer + Compte sur
  UNE ligne `whitespace-nowrap` : très probablement trop large en 375px.
- Modal auth : vérifier le clickwrap (liens Conditions) et le captcha en 375px.

## 5. Méthode de travail exigée
Boucle par page : screenshot mobile -> lister les défauts -> corriger (classes
mobiles uniquement) -> re-screenshot mobile ET desktop -> passer à la page
suivante. Itérer jusqu'à ce que ce soit parfait. Prendre des screenshots aux
tailles 375, 390 et 430 de large pour les pages critiques (home + fiche sté).
Contrôle final : `scrollWidth===innerWidth` sur chaque page + lecture visuelle.

## 6. Vérification desktop (anti-régression)
Après CHAQUE lot de modifs : resize preset "desktop", recharger `/` et
`/sandbox/v1-9-5/aapl`, comparer visuellement aux rendus d'avant (faire un
screenshot AVANT de commencer, le garder comme référence). Le moindre pixel
de différence desktop = corriger la classe (le `sm:` manque quelque part).

## 7. Mise en ligne (IMPORTANT, la connexion de Yann est trop faible pour uploader)
- JAMAIS `npx vercel deploy` (upload 257 Mo, échoue, et si la session CLI
  expire chaque commande ouvre un onglet Safari chez Yann : interdit).
- Chaîne correcte, 100 % côté serveur :
  1. `git push origin HEAD` -> Vercel construit un PREVIEW automatiquement.
  2. Attendre READY via l'API (token `VERCEL_TOKEN` de `.env.local`) :
     `GET https://api.vercel.com/v6/deployments?app=mettrik&limit=1&teamId=team_3A8Ft1Kze0wYzGbuyHmsaEwC`
  3. `npx vercel redeploy https://<url-du-preview> --target production --no-wait`
     (rebuild serveur avec les variables PRODUCTION ; le preview a des clés
     Stripe TEST, ne JAMAIS aliaser un preview).
  4. Attendre READY du build production (même API), puis
     `npx vercel alias set https://<url-prod> mettrik-niveau2.vercel.app`.
  5. Vérifier `https://mettrik-niveau2.vercel.app/api/billing/health` renvoie
     `"cle_secrete":"live"` (preuve que c'est bien un build production).
- mettrik.ai reste derrière la page de pré-lancement (interrupteur en base,
  `/sandbox/lancement`) : ne pas y toucher.
- Ne dire "fait" à Yann qu'après alias posé + vérification visuelle en ligne.

## 8. Rapport final attendu par Yann
Un tableau : page | défaut trouvé | correction | vérifié mobile | vérifié
desktop intact. Court, sans blabla, en français.
