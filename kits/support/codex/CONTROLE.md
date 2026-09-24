# Contrôle du kit

Contrôle effectué le 10 septembre 2026. « fait » désigne une réalisation présente dans les fichiers, pas une validation de production. Les tests externes non exécutés sont précisés ci-dessous.

## Section 1 : résultat attendu

| Exigence | État | Fichier et constat |
| :--- | :--- | :--- |
| Aide intégrée avec réponses complètes | fait | `components/support-faq.tsx`, `data/faq.json` : 60 réponses. |
| Recherche instantanée | fait | `components/support-faq.tsx` : filtrage local, accents et casse neutralisés. |
| Six thèmes demandés | fait | `data/faq.json` : dix réponses par thème. |
| Sujet, catégorie, message, capture facultative | fait | `components/support-ticket-form.tsx` : PNG, 512 Kio maximum. |
| E-mail prérempli si connecté | fait | Formulaire et `api/support/route.ts` GET : utilisateur Supabase SSR vérifié ; hypothèse d’intégration dans KIT.md. |
| Enregistrement en base | fait | `api/support/route.ts`, `sql/support_tickets.sql`. |
| Notification à SUPPORT_EMAIL | fait | Route POST ; variable documentée avec support@mettrik.ai. |
| Accusé de réception à l’utilisateur | fait | Route POST : envoi indépendant, état et échec signalés. |
| Escalade avec question préremplie | fait | FAQ et formulaire : sujet, message et thème repris. |
| Import dynamique au clic | fait | `components/support-widget.tsx` : import uniquement dans le gestionnaire du bouton. |
| JSON statique, aucune lecture réseau d’aide via API | fait | JSON importé dans le module différé ; recherche locale. Le module doit être téléchargé au premier clic. |
| Aucune dépendance lourde | fait | `KIT.md`, aucun ajout npm. |
| Zéro ralentissement et poids initial total de 0 | pas fait | Le déclencheur interactif ajoute du code, HTML et CSS. Poids compilé non mesuré, aide différée par construction. |

## Section 2 : contraintes techniques

| Exigence | État | Fichier et constat |
| :--- | :--- | :--- |
| TypeScript strict | fait | `tests/tsconfig.json` : compilation sans erreur. |
| Composants React fonctionnels | fait | Les trois fichiers de `components/`. |
| Tailwind v4, utilitaires seulement | fait | Les trois composants ; aucun CSS ajouté. |
| Français et absence de tiret long | fait | Interface, FAQ, messages et documentation contrôlés. |
| Dépendances déclarées et justifiées | fait | `KIT.md` : aucune nouvelle dépendance. |
| Aucun secret dans le code, variables listées | fait | `KIT.md`, route ; valeurs factices dans les tests. |
| Table support_tickets et SQL fourni | fait | `sql/support_tickets.sql`. |
| Lecture et écriture côté serveur seulement | fait | Route API ; privilèges révoqués aux rôles navigateur. |
| Clé de service jamais exposée au navigateur | fait | Utilisée uniquement dans la route serveur. |
| Validation stricte, tailles et e-mail | fait | `api/support/validation.ts`, lecture plafonnée à 730 000 octets dans la route. |
| Maximum cinq tickets par heure et par adresse | fait | Fonction SQL sous verrou transactionnel, normalisation et fenêtre glissante. Tests SQL réels non exécutés. |
| Champ piège anti-robot | fait | Formulaire, validation et abandon avant insertion dans la route. |
| Échappement des e-mails | fait | `escapeHTML`, insertion de la référence serveur uniquement sans échappement. |
| Navigation clavier | fait | Dialogue natif modal, Échap, focus initial et retour ; essai navigateur non exécuté. |
| Libellés et contraste | fait | Labels explicites, texte sombre sur fond blanc, boutons blancs sur fond sombre. Audit visuel non exécuté. |
| Kit sans modification du site existant | fait | Tous les fichiers créés sous `kits/support/codex/`. |
| Une ligne JSX et route à copier | fait | `KIT.md` : `<SupportWidget />`, import préalable et copie du helper de validation explicités. |

## Section 4 : erreurs à éviter

| Exigence | État | Fichier et constat |
| :--- | :--- | :--- |
| Ne pas utiliser la clé de service côté client | fait | Route seule, aucun import runtime de la route dans les composants. |
| Ne pas charger panneau et JSON sur chaque page | fait | Import au clic dans le widget ; seul le déclencheur initial est chargé. Vérification réseau après intégration requise. |
| Ne pas inventer tarifs, délais ou garanties | fait | `data/faq.json` : informations absentes marquées « à compléter par le propriétaire ». |
| Ne pas importer de bibliothèque UI ou formulaire lourde | fait | Composants natifs React. |
| Ne pas écrire de CSS global | fait | Aucun fichier CSS. |
| Ne pas modifier layout.tsx, package.json ou un fichier existant | fait | Aucun fichier préexistant modifié ; `MANIFESTE.txt`. |
| Ne pas oublier accusé, quota, échappement | fait | Route, validation, SQL et tests. |
| Ne pas laisser de texte anglais dans l’interface | fait | Textes visibles en français ; noms techniques réservés au code. |

## Tests et mesures

- 13 tests Node de validation, seuil, contrat SQL et contenu FAQ : réussis.
- 9 tests de route avec services simulés : réussis. Couverture de l’enregistrement, des deux e-mails, de l’échappement, de l’adresse connectée, du quota 429, d’une panne de base ou de Resend, du piège, de l’origine, de la taille et du GET sans cache.
- Vérification TypeScript stricte et sans émission : réussie.
- Test SQL transactionnel fourni : non exécuté. Les tests unitaires du seuil et de la forme SQL ne prouvent pas l’exécution PostgreSQL, la concurrence ou les permissions en déploiement.
- Intégration Supabase/Resend, audit navigateur et mesure du bundle : non exécutés. Aucune base contactée et aucun e-mail envoyé.
- Taille exacte du JSON d’aide UTF-8 : 25561 octets.
- Poids ajouté au premier chargement : non mesuré, strictement non nul pour le bouton interactif. Le JSON et le panneau sont différés ; aucun résultat de build n’est revendiqué.
- Aucune commande git, aucune installation, aucun fichier écrit hors du dossier du kit.
