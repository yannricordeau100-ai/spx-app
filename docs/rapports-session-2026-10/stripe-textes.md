# Stripe : remise annuelle et descriptions produits (8 oct 2026)

## 0. ALERTE : prix affiché sur /pricing différent du prix facturé

Le site affichait `pricing_prices.amount_decimal` (modifié en back-office le 21 sept), mais le paiement facture le prix Stripe relié (`stripe_price_id`, créé le 31 août). Modifier un montant en back-office ne crée pas de nouveau prix Stripe (stripe-sync ne crée un prix que si `stripe_price_id` est vide).

| Plan / devise | Base (affiché avant) mensuel / annuel | Stripe (facturé) mensuel / annuel |
|---|---|---|
| Premium EUR | 19,90 / 166,80 | **29,90 / 238,80** |
| Premium CHF | 24,90 / 238,80 | **29,90** / 238,80 |
| Premium USD, GBP, SEK | identiques | identiques |
| Max EUR | 29,90 / 298,80 | **59,90 / 478,80** |
| Max USD | 49,90 / 478,80 | **69,90 / 598,80** |
| Max CHF | 49,90 / 498,80 | **59,90 / 478,80** |
| Max GBP, SEK | identiques | identiques |

Décision prise (A) : le site lit maintenant le montant Stripe de chaque prix relié (même source que le paiement), base en repli seulement. Le site affiche donc le prix réellement facturé.
Option B pour Yann : si les prix du 21 sept sont les bons, créer de nouveaux prix Stripe à ces montants (interdit pour moi) et les relier dans `pricing_prices` ; le site suivra tout seul.

## 1. Remise annuelle

Origine des 37 % de la page Stripe : texte en dur dans la description du produit « Premium (annuel) » (« ~37% d'économie vs mensuel »), calculé en mai sur d'anciens prix (24,90 / 189). Stripe ne calcule rien ici. Supprimé (voir §2).

Remise réelle (12 × mensuel − annuel) / (12 × mensuel), arrondi à l'entier le plus proche :

| Plan | Devise | Site avant | Stripe réel = site après |
|---|---|---|---|
| Premium | EUR | 30 % | **33 %** (33,4) |
| Premium | USD | 30 % (28,65 forcé à 30) | **29 %** (28,65) |
| Premium | GBP | 33 % | 33 % |
| Premium | CHF | 20 % | **33 %** |
| Premium | SEK | 37 % | 37 % (37,3) |
| Max | EUR | 17 % | **33 %** (33,4) |
| Max | USD | 20 % | **29 %** (28,6) |
| Max | GBP | 33 % | 33 % |
| Max | CHF | 17 % | **33 %** |
| Max | SEK | 30 % | 30 % (30,5) |
| Bandeau « jusqu'à » EUR | | -30 % | **-33 %** |

DKK et CAD : pas de prix relié en base, le site convertit l'EUR (33 %). Prix Stripe existants non reliés : Premium DKK 33 %, CAD 29 % ; Max DKK 33 %, CAD 29 %.
Arrondi : Stripe ne documente pas d'arrondi pour ce cas (son « upsell » affiche montant ou pourcentage). Arrondi standard retenu ; l'ancien forçage « 29 → 30 » (7 oct) supprimé car il gonflait la remise.

## 2. Descriptions des produits Stripe (live, relues après envoi)

Noms inchangés (déjà clairs).

| Produit | Avant | Après |
|---|---|---|
| Premium (mensuel) prod_VAcaMsISTZosCb | Accès complet à toutes les sociétés couvertes, comparaison N-vs-N, watchlists illimitées, alertes par KPI, digest hebdo. | Plus de 600 sociétés cotées : KPI court, moyen et long terme, risques, thèses et comparaisons. Sans engagement. (111 car.) |
| Premium (annuel) prod_VAcaUdynew2imE | Mêmes fonctionnalités que Premium mensuel, payé en une fois. ~37% d'économie vs mensuel. | Tout Premium sur 12 mois, réglé en une fois : plus de 600 sociétés, KPI, risques, thèses et comparaisons. (105) |
| Max (mensuel) prod_VAe7FOb65PcSeu | Tout Premium, plus les outils avances destines aux family offices, conseillers et fonds. | Tout Premium, plus un historique plus long, le chat IA, les alertes KPI par e-mail et le support prioritaire. (109) |
| Max (annuel) prod_VAe7pzTlDFhMk2 | Memes fonctionnalites que Max mensuel, paye en une fois. | Tout Max sur 12 mois, réglé en une fois : historique plus long, chat IA, alertes KPI par e-mail, support prioritaire. (117) |

Fidélité : chaque élément vient de la grille /pricing (pricing_plan_features) : « Plus de 600 » sociétés, KPI court/moyen/long terme, facteurs de risque, thèse et anti-thèse, comparaison entre sociétés (Premium) ; historique 72+ mois, chat IA, notification e-mails KPI, support prioritaire (Max seul). Supprimé car absent de la grille : watchlists illimitées, digest hebdo, alertes KPI pour Premium, « N-vs-N ». Aucun pourcentage (varie selon la devise), aucun nombre de KPI, aucun indice.
Non touchés : produit Free (jamais en caisse), anciens produits archivés prod_UPSx00hVXviH0x et prod_UPSyHRCfbVt0ct.

Qui l'avait posée : `scripts/setup-stripe-products.ts` (PRODUCT_DEFS, création du 31 août). Source corrigée. `stripe-sync` ne touche pas la description (il ne pose que le nom, et cherche les produits par `metadata.code`, absent des produits live : à surveiller, une synchro créerait des produits « Premium »/« Max » en double).

## 3. Sources consultées

- Stripe, upsells d'abonnement (calcul de l'économie, affichage montant ou %) : https://docs.stripe.com/payments/checkout/upsells
- Stripe, personnalisation Checkout (nom, description, images produit) : https://docs.stripe.com/payments/checkout/customization
- Stripe, augmenter la conversion du paiement (transparence totale du prix, pas de surprise) : https://stripe.com/resources/more/how-to-increase-checkout-conversion
- Stripe, bonnes pratiques de caisse e-commerce : https://stripe.com/resources/more/ecommerce-checkout-best-practices
- Baymard, guide du parcours de paiement (récapitulatif de commande visible, sans surprise) : https://baymard.com/blog/checkout-flow-ux-optimization
- Baymard, audit SaaS et abonnements (langage et jargon des descriptions de fonctions, données de revue de commande) : https://baymard.com/audits/saas-and-digital-subscriptions
- Baymard, recherche abonnements numériques : https://baymard.com/research/digital-subscriptions

Principes retenus : une ligne qui confirme ce qu'on achète, concrète, sans jargon, aucune promesse ni chiffre susceptible de différer du montant affiché.

## 4. Fichiers modifiés (non commités, non déployés)

- `src/lib/billing/remise-annuelle.ts` (nouveau) : formule unique de remise.
- `src/lib/billing/stripe-montants.ts` (nouveau) : lecture des montants Stripe actifs, cache 5 min, repli base.
- `src/lib/billing/load-pricing.ts` : montant = prix Stripe relié ; légende via remise-annuelle.
- `src/components/billing/pricing-cards.tsx` : bandeau et légende via remise-annuelle, forçage 29→30 retiré.
- `scripts/setup-stripe-products.ts` : nouvelles descriptions.

Vérification : tsc sans erreur sur ces fichiers ; chargeur testé en réel pour les 7 devises (tableau §1). Rendu navigateur non vérifié : le serveur local (port 3000) s'est arrêté pendant le test.
