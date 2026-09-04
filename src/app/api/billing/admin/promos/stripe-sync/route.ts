import { NextResponse, type NextRequest } from "next/server";
import { requireDeskOwner } from "@/lib/desk/auth";
import { listPromoCodes, upsertPromoCode } from "@/lib/billing/admin-queries";
import { getStripe } from "@/lib/billing/stripe";

export const dynamic = "force-dynamic";

/**
 * POST /api/billing/admin/promos/stripe-sync
 * Body : { promoId?: string }  → sync ce code seul. Sinon sync tous.
 *
 * Pour chaque promo is_active=true sans stripe_coupon_id :
 *  1. Crée un coupon Stripe (percent_off OU amount_off)
 *  2. Crée un promotion_code Stripe avec le code public lié au coupon
 *  3. Sauvegarde stripe_coupon_id en BDD
 *
 * Pour chaque promo is_active=false avec stripe_coupon_id :
 *  1. Update le promotion_code Stripe en active:false (jamais delete)
 *
 * Yann (11 mai 2026) : les codes promo sont éditables avec toutes les
 * libertés depuis /desk-mtk9x4kp/pricing onglet Promos, sync auto Stripe.
 */
export async function POST(req: NextRequest) {
  // Yann 4 sept 2026 : secours par jeton, comme les pages du back-office.
  // Sans lui, la synchronisation etait impossible des que la maintenance
  // fermait la page de connexion, donc aucun code promo ne pouvait partir
  // chez Stripe.
  const jeton = req.nextUrl.searchParams.get("audit_token") ?? "";
  const parJeton = !!jeton && !!process.env.VISUAL_AUDIT_TOKEN && jeton === process.env.VISUAL_AUDIT_TOKEN;
  if (!parJeton) await requireDeskOwner();
  const body = await req.json().catch(() => ({}));
  const onlyId: string | undefined = body.promoId;

  const stripe = getStripe();
  const promos = await listPromoCodes();
  const targets = onlyId ? promos.filter((p) => p.id === onlyId) : promos;

  let created = 0;
  let updated = 0;
  const errors: { code: string; error: string }[] = [];

  for (const p of targets) {
    try {
      if (p.is_active && !p.stripe_coupon_id) {
        // Crée le coupon Stripe
        const couponParams: {
          duration: "forever" | "once" | "repeating";
          duration_in_months?: number;
          percent_off?: number;
          amount_off?: number;
          currency?: string;
          name?: string;
          max_redemptions?: number;
          redeem_by?: number;
        } = {
          duration: p.recurring ? "forever" : "once",
          name: p.internal_label || p.code,
        };
        if (p.discount_type === "percent" && p.discount_percent) {
          couponParams.percent_off = Number(p.discount_percent);
        } else if (p.discount_type === "amount" && p.discount_amount_decimal && p.discount_currency) {
          couponParams.amount_off = Math.round(Number(p.discount_amount_decimal) * 100);
          couponParams.currency = p.discount_currency.toLowerCase();
        } else {
          throw new Error("Type de réduction invalide (% ou montant + devise requis)");
        }
        if (p.max_redemptions) couponParams.max_redemptions = p.max_redemptions;
        if (p.expires_at) couponParams.redeem_by = Math.floor(new Date(p.expires_at).getTime() / 1000);

        const coupon = await stripe.coupons.create(couponParams);

        // Crée aussi le promotion_code (= le code public que l'user tape)
        // Cast nécessaire : selon la version du SDK Stripe, le type
        // PromotionCodeCreateParams peut omettre `coupon` mais l'API
        // l'attend bien. Sécurisé.
        // Cast via unknown : signature évolue selon version Stripe SDK,
        // le runtime accepte bien {coupon, code, ...}.
        const promoCodeParams = {
          coupon: coupon.id,
          code: p.code,
          active: true,
          max_redemptions: p.max_redemptions ?? undefined,
          expires_at: p.expires_at ? Math.floor(new Date(p.expires_at).getTime() / 1000) : undefined,
          restrictions: p.new_customers_only ? { first_time_transaction: true } : undefined,
        };
        // Yann 4 sept 2026, cause de l echec silencieux des codes promo :
        // le compte est passe a la version d API 2026-04-22, qui n accepte
        // PLUS le parametre `coupon` sur la creation d un code promotionnel.
        // Stripe repondait "Received unknown parameter: coupon", l erreur
        // n etait affichee nulle part et aucun code n arrivait chez Stripe.
        // On epingle donc une version anterieure POUR CET APPEL uniquement :
        // le reste du paiement continue d utiliser la version du compte.
        await stripe.promotionCodes.create(
          promoCodeParams as unknown as Parameters<typeof stripe.promotionCodes.create>[0],
          { apiVersion: "2024-06-20" },
        );

        await upsertPromoCode({ id: p.id, stripe_coupon_id: coupon.id });
        created++;
      } else if (!p.is_active && p.stripe_coupon_id) {
        // Désactive le promotion_code Stripe correspondant (pas delete coupon)
        const codes = await stripe.promotionCodes.list({ code: p.code, limit: 5 });
        for (const pc of codes.data) {
          if (pc.active) {
            await stripe.promotionCodes.update(pc.id, { active: false });
            updated++;
          }
        }
      }
    } catch (e) {
      errors.push({ code: p.code, error: String((e as Error).message) });
    }
  }

  return NextResponse.json({ created, updated, errors });
}
