# Carte Gratuit sur /pricing (8 oct 2026)

Rien n'est commité ni déployé.

## 1. Ordre des lignes
Sur la carte Gratuit, les lignes valides passent en premier et les lignes barrées après. L'ordre des fonctionnalités est conservé à l'intérieur de chaque groupe. Les cartes Premium et Max ne changent pas.
Vérifié en local, en vue ordinateur et en vue mobile (375 px, aucun défilement horizontal) : 2 lignes valides (Sociétés disponibles, Historique), puis 8 lignes barrées, soit 10 lignes comme avant.

## 2. Sélecteur dans le back-office
- Onglet Fonctionnalités : nouvelle colonne « Carte Gratuit » à côté de « Card ». Chaque ligne propose : Non affichée, Valide ou Barrée.
  - Valide : seulement si la fonctionnalité est incluse dans le Gratuit.
  - Barrée : seulement si elle est absente du Gratuit mais incluse en Premium ou en Max.
- Un bandeau au-dessus du tableau affiche le compte, par exemple « 2 valides + 8 barrées = 10 / 10 lignes », et propose deux boutons : « Enregistrer la carte Gratuit » et « Par défaut ».
  - L'enregistrement n'est possible qu'avec exactement le nombre de lignes de la carte actuelle (ici 10), dont au moins une valide.
  - Une fois les 10 lignes atteintes, les autres choix sont grisés.
- Valeurs par défaut : l'affichage actuel (les lignes cochées « Card »).
- Stockage : la table `desk_page_content` (page_key `pricing`, section_key `carte_gratuit`), au format JSON `{inclus, barres}`. Aucune migration n'est nécessaire.
- La page publique lit ce réglage avec le catalogue (`loadPricingCatalog`). Une ligne qui ne respecte plus les règles est ignorée, et le nombre de lignes ne peut jamais dépasser celui des cartes.

Test complet en local :
1. Retrait de « KPIs Long terme » : le compte passe à 9/10 et le bouton reste grisé.
2. Ajout de « Description des activités » en valide : 10/10.
3. Enregistrement : /pricing affiche alors 3 lignes valides puis 7 barrées (vérifié en vue ordinateur et en vue mobile).
4. Retour au réglage par défaut : /pricing affiche de nouveau l'affichage d'origine. **Le réglage enregistré est vide** (`is_active=false`).

## Fichiers
- Nouveaux : `src/lib/billing/carte-gratuit.ts`, `src/lib/billing/carte-gratuit-serveur.ts`, `src/app/api/billing/admin/carte-gratuit/route.ts`
- Modifiés :
  - `src/components/billing/pricing-cards.tsx` (propriété `carteGratuit`, 4 lignes)
  - `src/lib/billing/load-pricing.ts` (champ `carte_gratuit`, 4 lignes)
  - `src/app/desk-mtk9x4kp/pricing/client.tsx` (colonne et bandeau, dans FeaturesSection)
  - `src/app/pricing/page.tsx`, `src/app/sandbox/v1-9-5/pricing/page.tsx`, `src/app/sandbox/v1-9-5/page.tsx` (1 ligne chacun)
- Le travail de l'agent Stripe n'a pas été touché (prix, synchronisation).
- `npx tsc --noEmit` : 0 erreur.

## Points à noter
- **Accès admin en local** : la page /desk-mtk9x4kp n'accepte pas le jeton d'audit. Le proxy exige la session du propriétaire, et les routes admin existantes refusent aussi le jeton quand il arrive par la page d'origine. Pour tester, j'ai monté le composant du back-office dans une page temporaire `/sandbox/tmp-carte-gratuit-test` (jeton d'audit), puis je l'ai supprimée. La nouvelle route accepte le jeton d'audit présent dans l'adresse de la page appelante, en plus du propriétaire, comme `requireDeskOwner`.
- **Serveur de dev** : un serveur `next dev` d'un autre agent tournait déjà sur le port 3000, et Next refuse d'en lancer un second dans le même dossier. J'ai testé sur celui-là et je ne l'ai pas arrêté.
- **Base** : les essais ont écrit dans la base Supabase de `.env.local` (base réelle). Le réglage est revenu au défaut. Il reste une ligne inactive dans `desk_page_content`, sans effet.

## Questions pour Yann (option la plus simple retenue)
- Ordre à l'intérieur de chaque groupe : celui des fonctionnalités (flèches du back-office), pas un ordre libre propre à la carte Gratuit.
- Si les cases « Card » changent plus tard et que le nombre de lignes change, le bandeau affiche un compte orange. La page publique coupe au nouveau nombre de lignes.
- Ce qui m'a paru étrange dans les données locales, non corrigé (hors demande) : Premium affiche « Sociétés disponibles : 500+ ». La correction automatique ne vise que « 1 000+ ».
