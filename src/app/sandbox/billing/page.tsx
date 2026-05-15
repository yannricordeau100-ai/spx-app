import Link from "next/link";
import { ArrowLeft, CreditCard } from "lucide-react";
import { PLANS } from "@/lib/billing/stripe";
import { BillingTestClient } from "./client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Sandbox · Billing test · Mettrik",
  robots: { index: false, follow: false },
};

export default function SandboxBillingPage() {
  return (
    <div className="min-h-screen bg-[#050507] text-zinc-100">
      <div className="border-b border-white/8 px-6 py-3.5">
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <Link href="/sandbox" className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-[12.5px] text-zinc-300 hover:text-zinc-100">
            <ArrowLeft className="size-3.5" />Sandbox
          </Link>
          <h1 className="font-display text-[18px] font-bold tracking-tight">Billing test</h1>
          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-amber-200">test mode</span>
        </div>
      </div>

      <div className="mx-auto max-w-5xl p-6">
        <div className="mb-6 rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-4 text-[13px] text-amber-200">
          <div className="font-semibold">⚠️ Page de test billing : sandbox uniquement</div>
          <p className="mt-1 text-amber-200/80">
            Cette page utilise Stripe en mode <strong>TEST</strong>. Aucun argent réel n'est débité. Pour tester un checkout :
          </p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-[12px]">
            <li>Click "Souscrire" sur un plan ci-dessous (besoin de créer les products+prices dans Stripe au préalable, voir HANDOFF-NIGHT.md)</li>
            <li>Tu es redirigé vers Stripe Checkout</li>
            <li>Carte test : <code className="rounded bg-white/[0.05] px-1">4242 4242 4242 4242</code> · Exp : n'importe quelle date future · CVC : 3 chiffres</li>
            <li>Tu reviens sur /account?billing=success</li>
            <li>Le webhook update la table <code>subscriptions</code> Supabase</li>
          </ol>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {Object.values(PLANS).map((plan) => (
            <BillingTestClient key={plan.id} plan={plan} />
          ))}
        </div>

        <div className="mt-8 rounded-xl border border-white/8 bg-white/[0.02] p-4">
          <h2 className="text-[13px] font-medium text-zinc-200">Stripe Pricing Table (alternative recommandée)</h2>
          <p className="mt-1 text-[12px] text-zinc-400">
            Au lieu des boutons custom ci-dessus, tu peux embed la <strong>Pricing Table Stripe</strong> (Dashboard → Product catalog → Pricing tables → Create). Stripe te génère un snippet HTML que tu colles ici. Avantage : Stripe gère 100% de l'UI, multi-devises auto selon géoloc, traductions auto, tax auto.
          </p>
          <pre className="mt-2 overflow-x-auto rounded-md border border-white/10 bg-black/30 p-3 text-[11px] text-zinc-400">
{`<stripe-pricing-table
  pricing-table-id="prctbl_..."
  publishable-key="pk_test_..."
></stripe-pricing-table>
<script async src="https://js.stripe.com/v3/pricing-table.js"></script>`}
          </pre>
        </div>
      </div>
    </div>
  );
}
