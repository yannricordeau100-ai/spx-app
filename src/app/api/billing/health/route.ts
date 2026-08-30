/**
 * GET /api/billing/health — controle de pre-lancement (Yann 30 aout 2026).
 * Ne revele RIEN de sensible : uniquement le MODE des cles (test/live) et la
 * coherence de la configuration tarifaire. Sert a verifier que la production
 * est bien branchee sur Stripe live avant d ouvrir le site.
 */
import { NextResponse } from "next/server";
import productsConfig from "@/lib/billing/stripe-products.json";

export const dynamic = "force-dynamic";

function mode(v: string | undefined): string {
  if (!v) return "absente";
  if (v.startsWith("sk_live") || v.startsWith("pk_live")) return "live";
  if (v.startsWith("sk_test") || v.startsWith("pk_test")) return "test";
  if (v.startsWith("whsec_")) return "definie";
  return "inconnue";
}

export async function GET() {
  return NextResponse.json({
    cle_secrete: mode(process.env.STRIPE_SECRET_KEY),
    cle_publique: mode(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY),
    webhook: mode(process.env.STRIPE_WEBHOOK_SECRET),
    tarifs_configures_en: (productsConfig as { mode?: string }).mode ?? "?",
    coherent:
      mode(process.env.STRIPE_SECRET_KEY) ===
      ((productsConfig as { mode?: string }).mode ?? "?"),
  });
}
