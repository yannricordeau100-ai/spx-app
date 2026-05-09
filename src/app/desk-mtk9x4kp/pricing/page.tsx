import { requireDeskOwner } from "@/lib/desk/auth";
import { listPlans, listPrices, listFeatures, listAllPlanFeatures, listPromoCodes } from "@/lib/billing/admin-queries";
import { PricingAdminClient } from "./client";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Pricing admin · Mettrik (interne)",
  robots: { index: false, follow: false },
};

/**
 * Back-office /desk-mtk9x4kp/pricing — gestion complète des plans tarifs.
 *
 * Tabs (cf client.tsx) :
 *  1. Plans : CRUD + duplication + activation + highlight "Recommandé"
 *  2. Prix : grille devises × fréquences par plan, % réduction annuelle
 *     auto-calculé + override possible
 *  3. Features : catalogue + assignation par plan + COPIE inter-plans
 *  4. Promos : codes promo avec toutes options (durée, limites, ciblage)
 *  5. Stripe sync : push vers Stripe (Yann valide d'abord en preview)
 *
 * Yann 8 mai 2026 : "tout doit être TTC sans l'indiquer" → côté UI on
 * affiche les prix bruts. Stripe est configuré pour ne PAS ajouter de
 * tax automatique (à régler dans le dashboard Stripe Settings > Tax,
 * cf banner d'avertissement dans l'UI).
 */
export default async function PricingAdminPage() {
  await requireDeskOwner();

  const [plans, prices, features, planFeatures, promos] = await Promise.all([
    listPlans(),
    listPrices(),
    listFeatures(),
    listAllPlanFeatures(),
    listPromoCodes(),
  ]);

  return (
    <PricingAdminClient
      initialPlans={plans}
      initialPrices={prices}
      initialFeatures={features}
      initialPlanFeatures={planFeatures}
      initialPromoCodes={promos}
    />
  );
}
