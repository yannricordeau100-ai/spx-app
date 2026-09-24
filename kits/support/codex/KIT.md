# Kit d’assistance Mettrik

## Installation en 10 lignes, à effectuer par le propriétaire après relecture
1. Relire tout le kit, les réponses à compléter et `CONTROLE.md` avant toute intégration.
2. Copier `components/` et `data/` dans `src/components/support-kit/`, en conservant ces deux sous-dossiers voisins.
3. Copier `api/support/route.ts` et `api/support/validation.ts` dans `src/app/api/support/`, sans écraser une route existante.
4. Exécuter `sql/support_tickets.sql` dans une base Supabase de test, puis dans la base cible après validation.
5. Renseigner les variables ci-dessous dans l’environnement serveur et vérifier le domaine expéditeur dans Resend.
6. Importer `SupportWidget` depuis `@/components/support-kit/components/support-widget`, puis insérer la seule ligne JSX `<SupportWidget />` dans la mise en page.
7. Vérifier que Tailwind détecte les fichiers copiés sous `src/` et tester le panneau au clavier sur mobile et ordinateur.
8. Exécuter les commandes de tests ci-dessous depuis la racine du projet, avec Node 22.16 ou ultérieur compatible.
9. Sur la base de test, exécuter le test SQL fourni et vérifier l’authentification, les deux e-mails et les refus d’accès navigateur.
10. Contrôler les ressources réseau avant/après clic, mesurer le poids compilé, puis déployer uniquement après relecture du propriétaire.

## Variables d’environnement

| Variable | Usage |
| :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL HTTPS du projet Supabase existant. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clé publique du même projet, utilisée ici uniquement côté serveur pour vérifier la session. |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret serveur, réservé à la route. Ne jamais utiliser de préfixe public. |
| `SUPPORT_ORIGIN` | Origine publique exacte du site, par exemple `https://mettrik.ai` ; adapter au domaine réellement utilisé. |
| `SUPPORT_EMAIL` | `support@mettrik.ai`, boîte recevant les notifications. |
| `SUPPORT_FROM_EMAIL` | Adresse simple d’expédition sur un domaine validé dans Resend ; valeur à compléter par le propriétaire. |
| `RESEND_API_KEY` | Secret serveur Resend. |

Aucune clé réelle n’est incluse. Les valeurs des tests sont factices. Ne pas remplacer les valeurs de tests par des secrets.

## Dépendances

Aucune installation, aucune nouvelle dépendance npm. Le kit utilise React, Next.js et `@supabase/ssr`, déjà présents dans ce projet. L’accès à la base et à Resend utilise `fetch` natif, sans SDK supplémentaire. Les tests de route utilisent le compilateur TypeScript déjà présent ; les autres tests utilisent uniquement Node. Aucun CSS global ni bibliothèque de composants.

## Tests

```sh
node --experimental-strip-types --test kits/support/codex/tests/validation.test.mjs
node --test kits/support/codex/tests/route.test.cjs
node node_modules/typescript/bin/tsc -p kits/support/codex/tests/tsconfig.json
```

Node 22.16 émet des avertissements sur le chargement direct de TypeScript ; ils ne nécessitent aucune modification du `package.json`. Le compilateur ne produit aucun fichier. `tests/rate-limit.integration.sql` s’exécute manuellement dans une base de test après création du schéma et annule ses données par transaction. Les tests de route simulent les services externes : aucun e-mail n’est envoyé et aucune base n’est contactée.

## Fonctionnement et limites connues

- Le composant d’entrée contient seulement le bouton et le déclencheur `import()` au clic. Le panneau, le formulaire et les 60 réponses sont dans le module différé. Le JSON est inclus dans ce module statique, sans appel API ni téléchargement JSON séparé pour la recherche. Le téléchargement du module au premier clic nécessite une connexion.
- L’exigence littérale de 0 octet ajouté au premier chargement n’est pas atteinte : le bouton interactif nécessite du code, du HTML et des classes CSS. Aucun chiffre de bundle de production n’est inventé. Le contenu d’aide est différé ; son absence dans les ressources initiales reste à confirmer après compilation et intégration. Le site n’a pas été modifié pour mesurer cela.
- L’intégration visuelle est une ligne JSX, précédée de l’import TypeScript obligatoire. La route nécessite aussi son fichier local de validation. Les copies et le SQL sont les étapes d’installation ; aucun fichier existant n’a été modifié dans cette livraison.
- Le préremplissage utilise `GET /api/support`, seulement à l’ouverture du formulaire. Il suppose une session Supabase SSR standard avec les cookies du même projet. Le serveur vérifie l’utilisateur avec `getUser` et impose son adresse lors du POST ; le champ reste saisissable pour les visiteurs sans session. Une configuration d’authentification différente nécessite une adaptation après relecture.
- Le quota glissant est calculé en base sur l’adresse normalisée, sous verrou transactionnel. Il est commun aux instances serveur. Le petit prédicat `rateLimited` est une référence unitaire du seuil ; la décision réelle s’exécute dans la fonction SQL, et non dans la mémoire du serveur. La vérification de concurrence réelle nécessite plusieurs connexions de test et n’a pas été exécutée.
- Le champ piège et le contrôle d’origine sont une protection simple, pas une preuve d’humanité. Un acteur utilisant plusieurs adresses peut contourner un quota par adresse. Une adresse non connectée n’est pas vérifiée par lien. Ne pas présenter l’e-mail saisi comme une identité vérifiée.
- Capture limitée à un PNG de 512 Kio, vérifié par format, encodage, signature et en-tête. Ce contrôle n’est pas une analyse antivirus ni un décodage complet de l’image. Le fichier n’est jamais rendu dans la page, reste dans la table privée et est envoyé en pièce jointe au support seulement.
- Le ticket est conservé avant les deux envois indépendants. Une réponse 201 signifie que l’enregistrement est confirmé ; elle prévient si un envoi ou la sauvegarde de son état échoue. Une acceptation Resend ne garantit pas la livraison dans la boîte destinataire.
- Pas de relance automatique d’e-mail : le propriétaire doit surveiller les lignes avec `support_sent = false` ou `receipt_sent = false`, vérifier les journaux Resend et reprendre les envois nécessaires avec les clés d’idempotence `support-<id>-notification` et `support-<id>-reception`. Une réponse réseau perdue peut laisser un état incertain. Au-delà de la fenêtre de conservation d’idempotence du prestataire, vérifier les envois avant toute reprise.
- Pas de déduplication de soumission côté serveur, de suivi public du ticket, de tableau de bord ni de purge automatique. Les durées de conservation, les habilitations internes et la procédure de traitement sont à compléter par le propriétaire. Les réponses sur les tarifs, délais et garanties ne prétendent pas connaître ces informations.

## Vérifications avant déploiement

Ouvrir une page avec le panneau Réseau : aucun module FAQ/formulaire ne doit être demandé avant clic. Cliquer, rechercher un mot avec et sans accents, ouvrir une réponse et utiliser l’escalade. Parcourir le dialogue avec Tab et Maj+Tab, fermer avec Échap et vérifier le retour au bouton. Tester une session connectée, un visiteur, une capture valide/refusée, cinq tickets puis un sixième et une panne simulée de Resend. Vérifier avec les rôles `anon` et `authenticated` que ni la table ni la fonction SQL ne sont accessibles. Pour la concurrence, lancer six POST simultanés avec une adresse de test neuve : cinq insertions et un refus 429 sont attendus. Aucun de ces essais externes n’a été exécuté dans cette livraison.
