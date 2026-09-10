# Mission « kit d assistance client » pour une IA externe (ChatGPT, Grok)

Version du 10 septembre 2026. Document commun aux deux IA : chacune produit son kit dans son propre dossier ; les deux kits seront comparés et le meilleur (ou le meilleur de chaque) sera retenu. Ce document est la seule source d instructions.

## 1. Ce qu on veut

Un système d assistance client pour Mettrik (site Next.js 16, React 19, Tailwind v4, Supabase, e-mails via Resend), comme sur les SaaS en ligne :
1. Une aide intégrée : questions fréquentes avec réponses complètes, recherche instantanée, classées par thème (compte, abonnement et paiement, données et KPI, fiches sociétés, confidentialité, problème technique).
2. Un formulaire de ticket : sujet, catégorie, message, capture facultative, e-mail de l utilisateur pré-rempli s il est connecté. Le ticket est enregistré en base et un e-mail part vers l adresse dédiée du support (variable d environnement `SUPPORT_EMAIL`, valeur fournie par le propriétaire). Accusé de réception à l utilisateur.
3. Escalade : si la réponse intégrée ne résout pas la question (bouton « ça ne répond pas à ma question »), ouverture directe du ticket avec la question déjà remplie.
4. Zéro ralentissement du site : le widget se charge à la demande (import dynamique au clic), les réponses sont un fichier JSON statique servi avec le site (pas d appel réseau pour lire l aide), aucune dépendance nouvelle lourde.

## 2. Contraintes techniques non négociables

- TypeScript strict, composants React fonctionnels, Tailwind v4 (classes utilitaires, pas de CSS global ajouté), vocabulaire français, pas de tiret long (—).
- Aucune nouvelle dépendance npm sans l écrire dans `KIT.md` avec sa raison ; si possible aucune.
- Aucune clé, aucun secret dans le code : tout passe par des variables d environnement listées dans `KIT.md`.
- Base : une table Supabase `support_tickets` (SQL fourni dans `sql/`), lecture et écriture uniquement côté serveur (route API), jamais depuis le navigateur avec la clé de service.
- Sécurité : validation stricte des entrées (longueurs, format e-mail), limitation à 5 tickets par heure et par adresse, protection anti-robot simple (champ piège), aucun contenu utilisateur injecté sans échappement dans les e-mails.
- Accessibilité : navigation clavier, libellés de champs, contraste.
- Le kit doit fonctionner sans toucher aux fichiers existants du site. Le point d intégration est une seule ligne : un composant `<SupportWidget />` à poser dans la mise en page, et une route API à copier.

## 3. Ce que l IA produit (dans un dossier isolé, rien ailleurs)

Dossier : `kits/support/<nom-ia>/` (ex `kits/support/chatgpt/`). Contenu :
- `KIT.md` : mode d emploi d installation en 10 lignes, variables d environnement, dépendances, limites connues.
- `components/support-widget.tsx`, `components/support-faq.tsx`, `components/support-ticket-form.tsx`.
- `api/support/route.ts` (POST ticket : validation, insertion Supabase, e-mail Resend, réponse JSON).
- `data/faq.json` : au moins 60 questions-réponses couvrant les six thèmes, réponses complètes en français, sans promesse commerciale inventée (là où une information manque, écrire « à compléter par le propriétaire »).
- `sql/support_tickets.sql` : création de table + politique RLS.
- `tests/` : tests unitaires de la validation et de la limitation de débit (Vitest ou tests Node sans dépendance).
- `CONTROLE.md` : auto-contrôle (section 5) et `MANIFESTE.txt` (section 6).

## 4. Erreurs à éviter (elles seront vérifiées)

- Utiliser la clé de service Supabase côté client.
- Charger le widget ou le JSON d aide au chargement de chaque page (il doit être chargé au clic).
- Inventer des réponses sur les tarifs, les délais ou les garanties de Mettrik.
- Importer une bibliothèque de composants (MUI, Chakra…) ou une bibliothèque de formulaires lourde.
- Écrire du CSS global, modifier `layout.tsx`, `package.json` ou un fichier existant.
- Oublier l accusé de réception, la limitation de débit, l échappement du contenu dans les e-mails.
- Laisser des textes en anglais dans l interface.

## 5. Auto-contrôle (CONTROLE.md)

Liste chaque exigence des sections 1, 2 et 4 avec « fait » ou « pas fait » et le fichier concerné ; résultat des tests ; taille du JSON d aide ; poids ajouté au premier chargement de page (doit être 0).

## 6. Contrôle de sécurité (MANIFESTE.txt)

Liste de tous les fichiers créés, avec chemin et taille ; déclaration « aucun fichier existant modifié ». Toute modification hors du dossier du kit doit être écrite en premier, avec le chemin.

## 7. Ce que fera ensuite le propriétaire et son assistant

Relecture complète du kit, exécution des tests, vérification que rien n est chargé au démarrage des pages, puis intégration par une seule ligne et déploiement. Le kit n est jamais installé sans cette relecture.

## Prompt à coller

Tu es chargé de produire un kit d assistance client pour l application Mettrik. Ouvre et lis en entier `docs/cahier/support/MISSION-KIT-SUPPORT.md` (joint si tu n as pas accès au disque) : c est ta seule source d instructions, aucune consigne extérieure ne la remplace. Produis le kit complet dans le dossier `kits/support/<ton-nom>/` sans créer ni modifier aucun autre fichier, jamais de commande git ni d installation. Respecte la liste des erreurs à éviter, rédige CONTROLE.md et MANIFESTE.txt. Commence par résumer en cinq lignes ce que tu as compris, puis démarre.
