# Stripe aligné sur le back-office (8 oct 2026)

Règle : le back-office fait foi. Affiché sur /pricing = facturé.

## 1. Prix avant / après (Stripe live, appliqué le 8 oct)

| Plan | Devise | Période | Stripe avant | Stripe après (= back-office) | Ancien prix (désactivé) | Nouveau prix |
|---|---|---|---|---|---|---|
| Premium | EUR | mensuel | 29,90 | **19,90** | price_1UAIrlClUEb0T7vSrnhPe2ZV | price_1UOEZDClUEb0T7vShnSgHJXi |
| Premium | EUR | annuel | 238,80 | **166,80** | price_1UAIrpClUEb0T7vSC7Ib4uwK | price_1UOEZFClUEb0T7vSd5QN3OuO |
| Premium | CHF | mensuel | 29,90 | **24,90** | price_1UAIrnClUEb0T7vSC6LvWB4H | price_1UOEZGClUEb0T7vSMybfQTLt |
| Max | EUR | mensuel | 59,90 | **29,90** | price_1UAIp9ClUEb0T7vSwXp2YjA2 | price_1UOEZ2ClUEb0T7vSygGCxQ80 |
| Max | EUR | annuel | 478,80 | **298,80** | price_1UAIpEClUEb0T7vSEyvctJ3g | price_1UOEZ4ClUEb0T7vSBYpCr0wK |
| Max | USD | mensuel | 69,90 | **49,90** | price_1UAIpAClUEb0T7vSOzfBiMeY | price_1UOEZ6ClUEb0T7vSz9Nvh0i1 |
| Max | USD | annuel | 598,80 | **478,80** | price_1UAIpFClUEb0T7vS0kYBqjPj | price_1UOEZBClUEb0T7vSosmDSTkF |
| Max | CHF | mensuel | 59,90 | **49,90** | price_1UAIpBClUEb0T7vSquNRGcTv | price_1UOEZ8ClUEb0T7vSmp3XUoV0 |
| Max | CHF | annuel | 478,80 | **498,80** (hausse) | price_1UAIpGClUEb0T7vSExwBUQA0 | price_1UOEZ9ClUEb0T7vSBNX92JR8 |

Inchangés (déjà conformes, seule la clé stable a été posée) : Premium USD 34,90 / 298,80, GBP 29,90 / 238,80, SEK 279 / 2099, CHF annuel 238,80 ; Max GBP 59,90 / 478,80, SEK 599 / 4999.

Chaque nouveau prix : même produit, même devise et périodicité, clé stable `mettrik_<plan>_<periode>_<devise>` (transfer_lookup_key), métadonnées `remplace`, `synchro_le`, `synchro_source`. Les 20 prix actifs portent désormais leur clé.
Abonnés existants : non migrés, ils gardent leur ancien prix (Stripe facture un prix désactivé sur les abonnements en cours).

Remise annuelle affichée (calculée depuis ces prix, src/lib/billing/remise-annuelle.ts) : Premium EUR 30 %, USD 29 %, GBP 33 %, CHF 20 %, SEK 37 % ; Max EUR 17 %, USD 20 %, GBP 33 %, CHF 17 %, SEK 30 %.

## 2. Vérifications faites

- API Stripe : les 20 prix actifs de la grille = montant, devise, période du back-office, et id relié en base = prix porteur de la clé (20/20).
- Les 9 anciens prix : active=false.
- Résolution du checkout (lecture anonyme de la grille + clé stable) : 20/20 sur le bon prix.
- Session de paiement de test Premium EUR mensuel : ligne price_1UOEZDClUEb0T7vShnSgHJXi, total 19,90 EUR, puis expirée (aucun paiement).
- Journal : 9 lignes `billing_events` type `mettrik.price_sync`.
- Chargeur /pricing (loadPricingForPublic) : montants du back-office et nouveaux ids.
- verif-release : contrôle vert (20 prix identiques) ; rouge vérifié sur un écart simulé.
- `npx tsc --noEmit` : 0 erreur.

## 3. Mécanisme

- `src/lib/billing/stripe-prix-sync.ts` (nouveau) : alignement plan × période × devise ; nouveau prix si montant différent, bascule du prix par défaut du produit si besoin, désactivation de l'ancien, mise à jour `pricing_prices.stripe_price_id`, journal. Jamais de nouveau produit tant qu'un prix du même plan et de la même période existe (corrige le risque de doublons de produits de l'ancienne synchro, qui cherchait les produits par `metadata.code`, absent en live).
- Enregistrement d'un prix (POST /api/billing/admin/prices) : synchro automatique du plan, erreur Stripe signalée au back-office sans annuler l'enregistrement.
- Bouton « Synchroniser Stripe » (POST /api/billing/admin/stripe-sync, `?simulation=1` pour voir les écarts sans rien changer) : rejoue tout, affiche le journal.
- Checkout : prix actif lu par la clé stable, repli sur l'id en base ; le chemin `{plan, currency}` lit la grille en base (plus le fichier figé stripe-products.json). Un id périmé (page ouverte pendant un changement) renvoie « Ce tarif vient de changer : recharge la page des tarifs. »
- /pricing : retour aux montants du back-office (lecture des montants Stripe d'hier retirée).

## 4. Fichiers modifiés (non commités, non déployés)

- `src/lib/billing/stripe-prix-sync.ts` (nouveau)
- `src/app/api/billing/admin/stripe-sync/route.ts` (réécrit)
- `src/app/api/billing/admin/prices/route.ts`
- `src/app/api/billing/checkout/route.ts`
- `src/app/desk-mtk9x4kp/pricing/client.tsx` (bouton, texte, alerte d'échec)
- `src/lib/billing/load-pricing.ts` (montant = back-office)
- `src/lib/billing/stripe-montants.ts` : supprimé (fichier d'hier, non suivi, plus utilisé)
- `scripts/verif-release.py` (contrôle 6bis)

## 5. Points d'attention

- Stripe live est déjà aux nouveaux prix ; la prod actuelle relit l'id en base, donc la caisse facture déjà les nouveaux montants. Le code (synchro auto, clé stable) n'est actif en prod qu'après déploiement.
- Max EUR mensuel 29,90 est au niveau de l'ancien Premium ; Max CHF annuel monte (478,80 vers 498,80). Saisies du 21 sept reprises telles quelles.
- `src/lib/billing/stripe-products.json` et `scripts/setup-stripe-products.ts` restent figés au 31 août ; plus lus par le paiement.
